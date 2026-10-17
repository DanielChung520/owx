//! 骨架整合測試：驗證 `/health` 與 `/rpc/hook` 端到端（不需真實連接埠）。

use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use tower::ServiceExt;

async fn body_json(resp: axum::response::Response) -> serde_json::Value {
    let bytes = resp
        .into_body()
        .collect()
        .await
        .expect("collect body")
        .to_bytes();
    serde_json::from_slice(&bytes).expect("parse json")
}

#[tokio::test]
async fn health_returns_ok() {
    let resp = owx_boundary::router(owx_boundary::AppState::default())
        .oneshot(
            Request::builder()
                .uri("/health")
                .body(Body::empty())
                .expect("request"),
        )
        .await
        .expect("oneshot");

    assert_eq!(resp.status(), StatusCode::OK);
    assert_eq!(body_json(resp).await["status"], "ok");
}

#[tokio::test]
async fn hook_roundtrip_allows() {
    let payload = serde_json::json!({ "hook": "tool.execute.before", "payload": {} }).to_string();
    let resp = owx_boundary::router(owx_boundary::AppState::default())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/rpc/hook")
                .header("content-type", "application/json")
                .body(Body::from(payload))
                .expect("request"),
        )
        .await
        .expect("oneshot");

    assert_eq!(resp.status(), StatusCode::OK);
    assert_eq!(body_json(resp).await["decision"], "allow");
}

#[tokio::test]
async fn mcp_tools_list_exposes_status() {
    let payload =
        serde_json::json!({ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }).to_string();
    let resp = owx_boundary::router(owx_boundary::AppState::default())
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/mcp")
                .header("content-type", "application/json")
                .body(Body::from(payload))
                .expect("request"),
        )
        .await
        .expect("oneshot");

    assert_eq!(resp.status(), StatusCode::OK);
    let body = body_json(resp).await;
    assert_eq!(body["result"]["tools"][0]["name"], "owx_status");
}

#[tokio::test]
async fn hook_blocks_denied_tool() {
    use owx_tools::{Action, Rule, ToolPolicy};
    let state = owx_boundary::AppState::new(
        ToolPolicy::new(vec![Rule::new("bash", Action::Deny)]),
        3,
        owx_orchestrator::CategoryRegistry::default(),
    );
    let payload = serde_json::json!({
        "hook": "tool.execute.before",
        "payload": { "tool": "bash", "args": { "cmd": "ls" } }
    })
    .to_string();
    let resp = owx_boundary::router(state)
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/rpc/hook")
                .header("content-type", "application/json")
                .body(Body::from(payload))
                .expect("request"),
        )
        .await
        .expect("oneshot");

    assert_eq!(resp.status(), StatusCode::OK);
    assert_eq!(body_json(resp).await["decision"], "block");
}

#[tokio::test]
async fn hook_blocks_on_doom_loop() {
    let state = owx_boundary::AppState::new(
        owx_tools::ToolPolicy::default(),
        3,
        owx_orchestrator::CategoryRegistry::default(),
    );
    let router = owx_boundary::router(state);
    let payload = serde_json::json!({
        "hook": "tool.execute.before",
        "payload": { "tool": "read", "args": { "path": "a" } }
    })
    .to_string();

    let mut last = serde_json::Value::Null;
    for _ in 0..3 {
        let resp = router
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/rpc/hook")
                    .header("content-type", "application/json")
                    .body(Body::from(payload.clone()))
                    .expect("request"),
            )
            .await
            .expect("oneshot");
        last = body_json(resp).await;
    }
    assert_eq!(last["decision"], "block");
}

#[tokio::test]
async fn delegate_returns_plan() {
    use owx_orchestrator::{Category, CategoryRegistry};
    let mut categories = CategoryRegistry::default();
    categories.register(Category {
        name: "general".into(),
        model_chain: vec!["m/1".into(), "m/2".into()],
        skills: vec!["explore".into()],
        allow_delegate: true,
    });
    let state = owx_boundary::AppState::new(owx_tools::ToolPolicy::default(), 3, categories);
    let payload = serde_json::json!({
        "category": "general",
        "depth": 0,
        "max_depth": 2,
        "is_worker": false,
        "remaining_budget": 3
    })
    .to_string();
    let resp = owx_boundary::router(state)
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/rpc/delegate")
                .header("content-type", "application/json")
                .body(Body::from(payload))
                .expect("request"),
        )
        .await
        .expect("oneshot");

    assert_eq!(resp.status(), StatusCode::OK);
    let body = body_json(resp).await;
    assert_eq!(body["category"], "general");
    assert_eq!(body["model_chain"][0], "m/1");
    assert_eq!(body["skills"][0], "explore");
}

#[tokio::test]
async fn delegate_rejects_worker() {
    let state = owx_boundary::AppState::new(
        owx_tools::ToolPolicy::default(),
        3,
        owx_orchestrator::CategoryRegistry::default(),
    );
    let payload = serde_json::json!({
        "category": "general",
        "depth": 0,
        "max_depth": 2,
        "is_worker": true,
        "remaining_budget": 3
    })
    .to_string();
    let resp = owx_boundary::router(state)
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/rpc/delegate")
                .header("content-type", "application/json")
                .body(Body::from(payload))
                .expect("request"),
        )
        .await
        .expect("oneshot");

    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    let body = body_json(resp).await;
    assert_eq!(body["error"], "worker_cannot_delegate");
}

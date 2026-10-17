use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::{extract::Path, routing::post, Json, Router};
use http_body_util::BodyExt;
use std::net::SocketAddr;
use tower::ServiceExt;

async fn spawn_mock() -> SocketAddr {
    let app = Router::new()
        .route(
            "/session",
            post(|| async { Json(serde_json::json!({ "id": "s1" })) }),
        )
        .route(
            "/session/:id/message",
            post(|Path(_id): Path<String>| async { Json(serde_json::json!({ "ok": true })) }),
        );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind");
    let addr = listener.local_addr().expect("addr");
    tokio::spawn(async move {
        axum::serve(listener, app).await.expect("serve");
    });
    addr
}

async fn body_json(resp: axum::response::Response) -> serde_json::Value {
    let bytes = resp
        .into_body()
        .collect()
        .await
        .expect("collect")
        .to_bytes();
    serde_json::from_slice(&bytes).expect("json")
}

#[tokio::test]
async fn client_creates_session_and_sends() {
    let addr = spawn_mock().await;
    let client = owx_boundary::opencode::OpenCodeClient::new(format!("http://{addr}"));
    let id = client.create_session().await.expect("create");
    assert_eq!(id, "s1");
    client.send_message(&id, "hi").await.expect("send");
}

#[tokio::test]
async fn delegate_run_creates_session() {
    use owx_orchestrator::{Category, CategoryRegistry};
    use owx_tools::ToolPolicy;

    let addr = spawn_mock().await;
    let mut categories = CategoryRegistry::default();
    categories.register(Category {
        name: "general".into(),
        model_chain: vec!["m/1".into()],
        skills: Vec::new(),
        allow_delegate: true,
    });
    let state = owx_boundary::AppState::new(ToolPolicy::default(), 3, categories).with_opencode(
        owx_boundary::opencode::OpenCodeClient::new(format!("http://{addr}")),
    );

    let payload = serde_json::json!({
        "category": "general",
        "prompt": "do it",
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
                .uri("/rpc/delegate/run")
                .header("content-type", "application/json")
                .body(Body::from(payload))
                .expect("request"),
        )
        .await
        .expect("oneshot");

    assert_eq!(resp.status(), StatusCode::OK);
    let body = body_json(resp).await;
    assert_eq!(body["session_id"], "s1");
    assert_eq!(body["category"], "general");
}

#[tokio::test]
async fn delegate_run_unconfigured_returns_503() {
    use owx_orchestrator::{Category, CategoryRegistry};
    use owx_tools::ToolPolicy;

    let mut categories = CategoryRegistry::default();
    categories.register(Category {
        name: "general".into(),
        model_chain: Vec::new(),
        skills: Vec::new(),
        allow_delegate: true,
    });
    let state = owx_boundary::AppState::new(ToolPolicy::default(), 3, categories);
    let payload = serde_json::json!({
        "category": "general",
        "depth": 0,
        "max_depth": 2,
        "is_worker": false,
        "remaining_budget": 1
    })
    .to_string();
    let resp = owx_boundary::router(state)
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/rpc/delegate/run")
                .header("content-type", "application/json")
                .body(Body::from(payload))
                .expect("request"),
        )
        .await
        .expect("oneshot");

    assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(body_json(resp).await["error"], "opencode_unconfigured");
}

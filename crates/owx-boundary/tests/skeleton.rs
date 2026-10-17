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
    let resp = owx_boundary::router()
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
    let resp = owx_boundary::router()
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
    let resp = owx_boundary::router()
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

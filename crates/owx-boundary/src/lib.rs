//! owx Harness 邊界（boundary）骨架。
//!
//! 提供 loopback HTTP 端點：`GET /health`、`POST /rpc/hook`（shim → sidecar）、
//! `POST /mcp`（opencode model → sidecar，最小 JSON-RPC）。
//! 契約見 `docs/design/interfaces.md`；決策見 `docs/adr/ADR-0004-harness-opencode-boundary.md`。

use axum::{
    extract::{Json, State},
    http::StatusCode,
    routing::{get, post},
    Router,
};
use owx_core::{HarnessError, HookDecision, HookRequest};
use owx_discipline::DoomLoopGuard;
use owx_tools::{Action, Rule, ToolPolicy};
use serde_json::json;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct AppState {
    policy: Arc<ToolPolicy>,
    doom: Arc<Mutex<DoomLoopGuard>>,
}

impl AppState {
    pub fn new(policy: ToolPolicy, doom_threshold: u32) -> Self {
        Self {
            policy: Arc::new(policy),
            doom: Arc::new(Mutex::new(DoomLoopGuard::new(doom_threshold))),
        }
    }

    /// 由環境變數建構：`OWX_DENY_TOOLS`（逗號分隔 glob）、`OWX_DOOM_THRESHOLD`（預設 3）。
    pub fn from_env() -> Self {
        let rules = std::env::var("OWX_DENY_TOOLS")
            .unwrap_or_default()
            .split(',')
            .filter(|s| !s.trim().is_empty())
            .map(|p| Rule::new(p.trim(), Action::Deny))
            .collect();
        let threshold = std::env::var("OWX_DOOM_THRESHOLD")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(3);
        Self::new(ToolPolicy::new(rules), threshold)
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new(ToolPolicy::default(), 3)
    }
}

/// 建構路由（供 `serve` 與測試共用）。
pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/rpc/hook", post(rpc_hook))
        .route("/mcp", post(mcp))
        .with_state(state)
}

/// 在 `addr` 上服務，直到程序結束。
pub async fn serve(addr: SocketAddr, state: AppState) -> Result<(), HarnessError> {
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!(%addr, "owx-boundary listening");
    axum::serve(listener, router(state)).await?;
    Ok(())
}

async fn health() -> Json<serde_json::Value> {
    Json(json!({ "status": "ok" }))
}

async fn rpc_hook(
    State(state): State<AppState>,
    Json(req): Json<HookRequest>,
) -> Result<Json<HookDecision>, (StatusCode, Json<serde_json::Value>)> {
    if req.hook == "event" {
        tracing::debug!(hook = %req.hook, "hook request received");
    } else {
        tracing::info!(hook = %req.hook, "hook request received");
    }
    match req.hook.as_str() {
        "tool.execute.before" => Ok(Json(decide_tool(&state, &req))),
        "chat.message" | "chat.params" | "permission.ask" => Ok(Json(HookDecision::Allow)),
        other => Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": format!("unhandled hook: {other}") })),
        )),
    }
}

fn decide_tool(state: &AppState, req: &HookRequest) -> HookDecision {
    let tool = req
        .payload
        .get("tool")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let args = req
        .payload
        .get("args")
        .map(|v| v.to_string())
        .unwrap_or_default();
    let signature = format!("{tool}:{args}");

    let tripped = state
        .doom
        .lock()
        .map(|mut guard| guard.observe(&signature))
        .unwrap_or(false);
    if tripped {
        return HookDecision::Block {
            reason: format!("owx: doom loop detected for tool '{tool}'"),
        };
    }

    match state.policy.decide(tool) {
        Action::Deny => HookDecision::Block {
            reason: format!("owx: tool '{tool}' denied by policy"),
        },
        Action::Allow | Action::Ask => HookDecision::Allow,
    }
}

/// 最小 MCP（streamable HTTP）：支援 `initialize`、`tools/list`、`tools/call`
/// （單一工具 `owx_status`）。骨架階段以手寫 JSON-RPC 實作。
async fn mcp(Json(req): Json<serde_json::Value>) -> Json<serde_json::Value> {
    let id = req.get("id").cloned().unwrap_or(serde_json::Value::Null);
    let method = req.get("method").and_then(|m| m.as_str()).unwrap_or("");

    match method {
        "initialize" => Json(json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": { "tools": {} },
                "serverInfo": { "name": "owx-harnessd", "version": env!("CARGO_PKG_VERSION") }
            }
        })),
        "tools/list" => Json(json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {
                "tools": [{
                    "name": "owx_status",
                    "description": "owx harness sidecar status",
                    "inputSchema": { "type": "object", "properties": {} }
                }]
            }
        })),
        "tools/call" => {
            let name = req
                .pointer("/params/name")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            if name == "owx_status" {
                Json(json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "result": {
                        "content": [{ "type": "text", "text": "owx-harnessd: ok" }]
                    }
                }))
            } else {
                Json(json!({
                    "jsonrpc": "2.0",
                    "id": id,
                    "error": { "code": -32602, "message": format!("unknown tool: {name}") }
                }))
            }
        }
        other => Json(json!({
            "jsonrpc": "2.0",
            "id": id,
            "error": { "code": -32601, "message": format!("method not found: {other}") }
        })),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn router_builds() {
        let _ = router(AppState::default());
    }
}

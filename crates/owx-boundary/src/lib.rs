//! owx Harness 邊界（boundary）骨架。
//!
//! 提供 loopback HTTP 端點：`GET /health`、`POST /rpc/hook`（shim → sidecar）、
//! `POST /mcp`（opencode model → sidecar，最小 JSON-RPC）。
//! 契約見 `docs/design/interfaces.md`；決策見 `docs/adr/ADR-0004-harness-opencode-boundary.md`。

pub mod opencode;

use axum::{
    extract::{Json, State},
    http::StatusCode,
    routing::{get, post},
    Router,
};
use owx_core::{HarnessError, HookDecision, HookRequest};
use owx_discipline::{DoomLoopGuard, IntentGate};
use owx_orchestrator::{
    Category, CategoryRegistry, DelegateError, DelegationPlan, DelegationRequest,
};
use owx_tools::{Action, Rule, ToolPolicy};
use serde_json::json;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct AppState {
    policy: Arc<ToolPolicy>,
    doom: Arc<Mutex<DoomLoopGuard>>,
    categories: Arc<CategoryRegistry>,
    opencode: Option<opencode::OpenCodeClient>,
}

impl AppState {
    pub fn new(policy: ToolPolicy, doom_threshold: u32, categories: CategoryRegistry) -> Self {
        Self {
            policy: Arc::new(policy),
            doom: Arc::new(Mutex::new(DoomLoopGuard::new(doom_threshold))),
            categories: Arc::new(categories),
            opencode: None,
        }
    }

    pub fn with_opencode(mut self, client: opencode::OpenCodeClient) -> Self {
        self.opencode = Some(client);
        self
    }

    /// 由環境變數建構：`OWX_DENY_TOOLS`、`OWX_DOOM_THRESHOLD`（預設 3）、`OWX_DEFAULT_MODEL`、`OWX_OPENCODE_URL`。
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
        let default_model = std::env::var("OWX_DEFAULT_MODEL").unwrap_or_default();
        let mut categories = CategoryRegistry::default();
        categories.register(Category {
            name: "general".into(),
            model_chain: if default_model.is_empty() {
                Vec::new()
            } else {
                vec![default_model]
            },
            skills: Vec::new(),
            allow_delegate: true,
        });
        let state = Self::new(ToolPolicy::new(rules), threshold, categories);
        match std::env::var("OWX_OPENCODE_URL") {
            Ok(url) if !url.is_empty() => state.with_opencode(opencode::OpenCodeClient::new(url)),
            _ => state,
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new(ToolPolicy::default(), 3, CategoryRegistry::default())
    }
}

/// 建構路由（供 `serve` 與測試共用）。
pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/rpc/hook", post(rpc_hook))
        .route("/rpc/delegate", post(rpc_delegate))
        .route("/rpc/delegate/run", post(rpc_delegate_run))
        .route("/rpc/intent", post(rpc_intent))
        .route("/rpc/fallback", post(rpc_fallback))
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

#[derive(serde::Deserialize)]
struct DelegateBody {
    category: String,
    #[serde(default)]
    prompt: Option<String>,
    #[serde(flatten)]
    request: DelegationRequest,
}

async fn rpc_delegate(
    State(state): State<AppState>,
    Json(body): Json<DelegateBody>,
) -> Result<Json<DelegationPlan>, (StatusCode, Json<serde_json::Value>)> {
    state
        .categories
        .plan(&body.category, body.request)
        .map(Json)
        .map_err(|err| {
            (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": error_name(err) })),
            )
        })
}

async fn rpc_delegate_run(
    State(state): State<AppState>,
    Json(body): Json<DelegateBody>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let plan = state
        .categories
        .plan(&body.category, body.request)
        .map_err(|err| {
            (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": error_name(err) })),
            )
        })?;
    let Some(client) = state.opencode.as_ref() else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "error": "opencode_unconfigured" })),
        ));
    };
    let session_id = client.create_session().await.map_err(|err| {
        (
            StatusCode::BAD_GATEWAY,
            Json(json!({ "error": format!("create_session: {err}") })),
        )
    })?;
    client
        .send_message(&session_id, &body.prompt.unwrap_or_default())
        .await
        .map_err(|err| {
            (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": format!("send_message: {err}") })),
            )
        })?;
    Ok(Json(json!({
        "session_id": session_id,
        "category": plan.category,
        "model_chain": plan.model_chain,
    })))
}

#[derive(serde::Deserialize)]
struct IntentBody {
    text: String,
}

async fn rpc_intent(Json(body): Json<IntentBody>) -> Json<serde_json::Value> {
    Json(json!({ "intent": IntentGate::classify(&body.text) }))
}

#[derive(serde::Deserialize)]
struct FallbackBody {
    category: String,
    failed_model: String,
}

async fn rpc_fallback(
    State(state): State<AppState>,
    Json(body): Json<FallbackBody>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let Some(category) = state.categories.get(&body.category) else {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "unknown_category" })),
        ));
    };
    match category.next_model(&body.failed_model) {
        Some(next) => Ok(Json(json!({ "next_model": next }))),
        None => Err((StatusCode::NOT_FOUND, Json(json!({ "error": "exhausted" })))),
    }
}

fn error_name(err: DelegateError) -> &'static str {
    match err {
        DelegateError::UnknownCategory => "unknown_category",
        DelegateError::DepthExceeded => "depth_exceeded",
        DelegateError::WorkerCannotDelegate => "worker_cannot_delegate",
        DelegateError::BudgetExhausted => "budget_exhausted",
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

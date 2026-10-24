//! owx Harness 邊界（boundary）骨架。
//!
//! 提供 loopback HTTP 端點：`GET /health`、`POST /rpc/hook`（shim → sidecar）、
//! `POST /mcp`（opencode model → sidecar，最小 JSON-RPC）。
//! 契約見 `docs/design/interfaces.md`；決策見 `docs/adr/ADR-0004-harness-opencode-boundary.md`。

pub mod opencode;
pub mod projects;

use axum::{
    extract::{Json, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Router,
};
use base64::Engine as _;
use owx_core::{HarnessError, HookDecision, HookRequest};
use owx_discipline::{DoomLoopGuard, IntentGate};
use owx_orchestrator::{
    Category, CategoryRegistry, DelegateError, DelegationPlan, DelegationRequest,
};
use owx_tools::{Action, Rule, ToolPolicy};
use serde_json::json;
use std::io::Write as _;
use std::net::SocketAddr;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct AppState {
    policy: Arc<ToolPolicy>,
    doom: Arc<Mutex<DoomLoopGuard>>,
    categories: Arc<CategoryRegistry>,
    opencode: Option<opencode::OpenCodeClient>,
    knowledge_dir: PathBuf,
    config_dir: PathBuf,
    sample_dir: PathBuf,
    standard_file: PathBuf,
}

impl AppState {
    pub fn new(policy: ToolPolicy, doom_threshold: u32, categories: CategoryRegistry) -> Self {
        Self {
            policy: Arc::new(policy),
            doom: Arc::new(Mutex::new(DoomLoopGuard::new(doom_threshold))),
            categories: Arc::new(categories),
            opencode: None,
            knowledge_dir: default_knowledge_dir(),
            config_dir: owx_config::config_dir(),
            sample_dir: default_sample_dir(),
            standard_file: default_standard_file(),
        }
    }

    pub fn with_opencode(mut self, client: opencode::OpenCodeClient) -> Self {
        self.opencode = Some(client);
        self
    }

    pub fn with_knowledge_dir(mut self, dir: PathBuf) -> Self {
        self.knowledge_dir = dir;
        self
    }

    pub fn with_config_dir(mut self, dir: PathBuf) -> Self {
        self.config_dir = dir;
        self
    }

    pub fn with_sample_dir(mut self, dir: PathBuf) -> Self {
        self.standard_file = dir.join("owx-Standard.json");
        self.sample_dir = dir;
        self
    }

    pub fn with_standard_file(mut self, file: PathBuf) -> Self {
        self.standard_file = file;
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
        let mut state = Self::new(ToolPolicy::new(rules), threshold, categories)
            .with_knowledge_dir(knowledge_dir_from_env())
            .with_sample_dir(sample_dir_from_env());
        if let Ok(file) = std::env::var("OWX_STANDARD_FILE") {
            if !file.trim().is_empty() {
                state = state.with_standard_file(PathBuf::from(file));
            }
        }
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
        .route("/rpc/project/create", post(rpc_project_create))
        .route("/rpc/knowledge/list", get(rpc_knowledge_list))
        .route("/rpc/project/get", get(projects::rpc_project_get))
        .route("/rpc/project/update", post(projects::rpc_project_update))
        .route(
            "/rpc/project/base-dirs",
            get(projects::rpc_project_base_dirs),
        )
        .route(
            "/rpc/project/base-dirs/apply",
            post(projects::rpc_project_base_dirs_apply),
        )
        .route("/rpc/standards/list", get(projects::rpc_standards_list))
        .route("/rpc/standards/get", get(projects::rpc_standards_get))
        .route("/rpc/git/status", get(rpc_git_status))
        .route("/rpc/git/commit", post(rpc_git_commit))
        .route("/rpc/fs/mkdir", post(rpc_fs_mkdir))
        .route("/rpc/fs/write", post(rpc_fs_write))
        .route("/rpc/fs/rename", post(rpc_fs_rename))
        .route("/rpc/fs/copy", post(rpc_fs_copy))
        .route("/rpc/fs/move", post(rpc_fs_move))
        .route("/rpc/fs/delete", post(rpc_fs_delete))
        .route("/rpc/fs/info", get(rpc_fs_info))
        .route("/rpc/fs/raw", get(rpc_fs_raw))
        .route("/rpc/import/file", post(rpc_import_file))
        .route("/rpc/import/notion", post(rpc_not_configured))
        .route("/rpc/convert", post(rpc_not_configured))
        .route("/rpc/export/filer", post(rpc_not_configured))
        .route("/rpc/export/notion", post(rpc_not_configured))
        .route("/rpc/share", post(rpc_not_configured))
        .route("/rpc/archive/create", post(rpc_archive_create))
        .route("/rpc/archive/extract", post(rpc_archive_extract))
        .route("/rpc/models", get(rpc_models))
        .route(
            "/rpc/settings",
            get(rpc_settings_get).post(rpc_settings_post),
        )
        .route(
            "/rpc/settings/logo",
            get(rpc_settings_logo_get).post(rpc_settings_logo_upload),
        )
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

fn default_knowledge_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    Path::new(&home).join("knowledge")
}

fn knowledge_dir_from_env() -> PathBuf {
    std::env::var("OWX_KNOWLEDGE_DIR")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(default_knowledge_dir)
}

fn default_sample_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    Path::new(&home).join("owx-sample")
}

fn sample_dir_from_env() -> PathBuf {
    std::env::var("OWX_SAMPLE_DIR")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(default_sample_dir)
}

fn default_standard_file() -> PathBuf {
    std::env::var("OWX_STANDARD_FILE")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| default_sample_dir().join("owx-Standard.json"))
}

fn resolved_knowledge_dir(state: &AppState) -> PathBuf {
    owx_config::Settings::load(&state.config_dir)
        .global
        .knowledge_root
        .filter(|root| !root.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| state.knowledge_dir.clone())
}

const DEFAULT_MODELS_URL: &str = "https://models.opencode.ai";

fn models_source() -> String {
    std::env::var("OPENCODE_MODELS_URL")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_MODELS_URL.to_string())
}

fn models_file_from(path: Option<&str>, xdg: Option<&str>, home: Option<&str>) -> PathBuf {
    if let Some(file) = path.filter(|value| !value.trim().is_empty()) {
        return PathBuf::from(file);
    }
    let cache = xdg
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            let home = home.filter(|value| !value.trim().is_empty()).unwrap_or(".");
            Path::new(home).join(".cache")
        });
    cache.join("opencode").join("models.json")
}

fn models_file() -> PathBuf {
    models_file_from(
        std::env::var("OPENCODE_MODELS_PATH").ok().as_deref(),
        std::env::var("XDG_CACHE_HOME").ok().as_deref(),
        std::env::var("HOME").ok().as_deref(),
    )
}

fn normalize_models(raw: &serde_json::Value) -> Vec<serde_json::Value> {
    let mut providers: Vec<serde_json::Value> = raw
        .as_object()
        .map(|map| {
            map.iter()
                .map(|(id, entry)| {
                    let name = entry
                        .get("name")
                        .and_then(|value| value.as_str())
                        .unwrap_or(id);
                    let models: Vec<serde_json::Value> = entry
                        .get("models")
                        .and_then(|value| value.as_object())
                        .map(|models| {
                            models
                                .iter()
                                .map(|(model_id, model)| {
                                    let model_name = model
                                        .get("name")
                                        .and_then(|value| value.as_str())
                                        .unwrap_or(model_id);
                                    json!({ "id": model_id, "name": model_name })
                                })
                                .collect()
                        })
                        .unwrap_or_default();
                    json!({ "id": id, "name": name, "models": models })
                })
                .collect()
        })
        .unwrap_or_default();
    providers.sort_by(|a, b| {
        a["id"]
            .as_str()
            .unwrap_or("")
            .cmp(b["id"].as_str().unwrap_or(""))
    });
    providers
}

async fn rpc_models() -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let text = std::fs::read_to_string(models_file())
        .map_err(|_| fail(StatusCode::BAD_GATEWAY, "models_unavailable"))?;
    let raw: serde_json::Value =
        serde_json::from_str(&text).map_err(|_| fail(StatusCode::BAD_GATEWAY, "models_invalid"))?;
    Ok(Json(json!({
        "source": models_source(),
        "providers": normalize_models(&raw),
    })))
}

fn valid_slug(slug: &str) -> bool {
    !slug.is_empty()
        && slug.len() <= 64
        && slug
            .chars()
            .next()
            .map(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
            .unwrap_or(false)
        && slug
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

fn now_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn project_code(created_ms: u64, slug: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    slug.hash(&mut hasher);
    created_ms.hash(&mut hasher);
    let suffix = (hasher.finish() & 0xffff) as u16;
    format!("OWX-{suffix:04X}")
}

#[derive(serde::Deserialize)]
struct CreateProjectBody {
    name: String,
    slug: String,
    #[serde(default)]
    tags: Vec<String>,
}

/// 建立專案時生成的預設「一般性規範」檔名。
const DEFAULT_AGENTS_FILENAME: &str = "AGENTS.md";
/// 樣本庫中的範本路徑（隨 `OWX_SAMPLE_DIR` 覆寫）。
const AGENTS_TEMPLATE_REL: &str = "templates/AGENTS.md";
/// 範本缺檔時的最小內建內容（正式內容以樣本庫為準）。
const AGENTS_FALLBACK: &str = "# {{project_name}}\n\n> 一般性規範（owx 預設）。\n\n- 文件優先：決策先落文件。\n- 測試是唯一合約：沒測試 = 沒做完。\n- 禁止硬編碼；設定走 config／環境變數。\n";

/// 讀取一般性規範範本並帶入專案名稱；缺檔時退回內建最小內容。
fn default_agents_md(sample_dir: &Path, name: &str) -> String {
    let template = std::fs::read_to_string(sample_dir.join(AGENTS_TEMPLATE_REL))
        .unwrap_or_else(|_| AGENTS_FALLBACK.to_string());
    template.replace("{{project_name}}", name)
}

fn create_project(
    base: &Path,
    sample_dir: &Path,
    name: &str,
    slug: &str,
    tags: &[String],
) -> Result<serde_json::Value, (StatusCode, &'static str)> {
    let slug = slug.trim().to_lowercase();
    if !valid_slug(&slug) {
        return Err((StatusCode::BAD_REQUEST, "invalid_slug"));
    }
    let dir = base.join(&slug);
    if dir.exists() {
        return Err((StatusCode::CONFLICT, "already_exists"));
    }
    std::fs::create_dir_all(&dir)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "mkdir_failed"))?;
    let created = now_millis();
    let id = project_code(created, &slug);
    let meta = json!({
        "id": &id,
        "name": name,
        "slug": &slug,
        "tags": tags,
        "created": created,
    });
    let _ = std::fs::write(
        dir.join(".owx-project.json"),
        serde_json::to_vec_pretty(&meta).unwrap_or_default(),
    );
    let _ = std::fs::write(
        dir.join(DEFAULT_AGENTS_FILENAME),
        default_agents_md(sample_dir, name),
    );
    let _ = std::process::Command::new("git")
        .arg("init")
        .arg("-q")
        .current_dir(&dir)
        .status();
    Ok(json!({
        "id": &id,
        "name": name,
        "slug": &slug,
        "tags": tags,
        "created": created,
        "worktree": dir,
    }))
}

async fn rpc_project_create(
    State(state): State<AppState>,
    Json(body): Json<CreateProjectBody>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    create_project(
        &resolved_knowledge_dir(&state),
        &state.sample_dir,
        &body.name,
        &body.slug,
        &body.tags,
    )
    .map(Json)
    .map_err(|(status, code)| (status, Json(json!({ "error": code }))))
}

fn fail(status: StatusCode, code: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(json!({ "error": code })))
}

fn max_upload_bytes() -> u64 {
    std::env::var("OWX_MAX_UPLOAD_BYTES")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(50 * 1024 * 1024)
}

fn safe_join(root: &Path, rel: &str) -> Result<PathBuf, &'static str> {
    let rel = rel.trim().trim_start_matches("./");
    if rel.is_empty() {
        return Err("invalid_path");
    }
    let candidate = Path::new(rel);
    for component in candidate.components() {
        match component {
            Component::Normal(_) | Component::CurDir => {}
            _ => return Err("outside_worktree"),
        }
    }
    let canonical_root = root.canonicalize().map_err(|_| "outside_worktree")?;
    let joined = canonical_root.join(candidate);
    let mut probe = joined.as_path();
    while !probe.exists() {
        probe = probe.parent().ok_or("outside_worktree")?;
    }
    let canonical_probe = probe.canonicalize().map_err(|_| "outside_worktree")?;
    if !canonical_probe.starts_with(&canonical_root) {
        return Err("outside_worktree");
    }
    Ok(joined)
}

#[derive(serde::Deserialize)]
struct DirPathBody {
    directory: String,
    path: String,
}

async fn rpc_fs_mkdir(
    Json(body): Json<DirPathBody>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let target = safe_join(Path::new(&body.directory), &body.path)
        .map_err(|code| fail(StatusCode::BAD_REQUEST, code))?;
    if target.exists() {
        return Err(fail(StatusCode::CONFLICT, "already_exists"));
    }
    std::fs::create_dir_all(&target)
        .map_err(|_| fail(StatusCode::INTERNAL_SERVER_ERROR, "mkdir_failed"))?;
    Ok(Json(json!({ "path": body.path })))
}

#[derive(serde::Deserialize)]
struct WriteBody {
    directory: String,
    path: String,
    content: String,
    #[serde(default)]
    overwrite: bool,
}

async fn rpc_fs_write(
    Json(body): Json<WriteBody>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if body.content.len() as u64 > max_upload_bytes() {
        return Err(fail(StatusCode::PAYLOAD_TOO_LARGE, "too_large"));
    }
    let target = safe_join(Path::new(&body.directory), &body.path)
        .map_err(|code| fail(StatusCode::BAD_REQUEST, code))?;
    if target.exists() && !body.overwrite {
        return Err(fail(StatusCode::CONFLICT, "already_exists"));
    }
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|_| fail(StatusCode::INTERNAL_SERVER_ERROR, "write_failed"))?;
    }
    std::fs::write(&target, body.content.as_bytes())
        .map_err(|_| fail(StatusCode::INTERNAL_SERVER_ERROR, "write_failed"))?;
    Ok(Json(
        json!({ "path": body.path, "bytes": body.content.len() }),
    ))
}

/// 刪除時移入的專案內垃圾桶目錄（預設隱藏）。
const TRASH_DIR: &str = ".owx-trash";

fn valid_entry_name(name: &str) -> bool {
    let trimmed = name.trim();
    !trimmed.is_empty()
        && trimmed != "."
        && trimmed != ".."
        && !trimmed.contains('/')
        && !trimmed.contains('\\')
        && !trimmed.contains('\0')
}

fn relative_rename(path: &str, name: &str) -> String {
    match path.rsplit_once('/') {
        Some((parent, _)) => format!("{parent}/{name}"),
        None => name.to_string(),
    }
}

fn copy_tree(src: &Path, dest: &Path) -> Result<(), &'static str> {
    let meta = std::fs::metadata(src).map_err(|_| "not_found")?;
    if meta.is_dir() {
        std::fs::create_dir_all(dest).map_err(|_| "copy_failed")?;
        for entry in std::fs::read_dir(src).map_err(|_| "read_failed")? {
            let entry = entry.map_err(|_| "read_failed")?;
            copy_tree(&entry.path(), &dest.join(entry.file_name()))?;
        }
        Ok(())
    } else {
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent).map_err(|_| "copy_failed")?;
        }
        std::fs::copy(src, dest).map_err(|_| "copy_failed")?;
        Ok(())
    }
}

fn move_path(src: &Path, dest: &Path) -> Result<(), &'static str> {
    if std::fs::rename(src, dest).is_ok() {
        return Ok(());
    }
    copy_tree(src, dest)?;
    if src.is_dir() {
        std::fs::remove_dir_all(src).map_err(|_| "move_failed")
    } else {
        std::fs::remove_file(src).map_err(|_| "move_failed")
    }
}

fn modified_millis(meta: &std::fs::Metadata) -> Option<u64> {
    meta.modified()
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|delta| delta.as_millis() as u64)
}

fn inside_subtree(src: &Path, dest: &Path) -> bool {
    dest != src && dest.starts_with(src)
}

#[derive(serde::Deserialize)]
struct RenameBody {
    directory: String,
    path: String,
    #[serde(rename = "newName")]
    new_name: String,
}

/// `POST /rpc/fs/rename`：檔案／資料夾重新命名（同層；不覆蓋既有）。
async fn rpc_fs_rename(
    Json(body): Json<RenameBody>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let src = safe_join(Path::new(&body.directory), &body.path)
        .map_err(|code| fail(StatusCode::BAD_REQUEST, code))?;
    if !src.exists() {
        return Err(fail(StatusCode::NOT_FOUND, "not_found"));
    }
    let name = body.new_name.trim();
    if !valid_entry_name(name) {
        return Err(fail(StatusCode::BAD_REQUEST, "invalid_name"));
    }
    let parent = src
        .parent()
        .ok_or_else(|| fail(StatusCode::BAD_REQUEST, "invalid_path"))?;
    let dest = parent.join(name);
    if dest.exists() {
        return Err(fail(StatusCode::CONFLICT, "already_exists"));
    }
    std::fs::rename(&src, &dest)
        .map_err(|_| fail(StatusCode::INTERNAL_SERVER_ERROR, "rename_failed"))?;
    Ok(Json(json!({ "path": relative_rename(&body.path, name) })))
}

#[derive(serde::Deserialize)]
struct TransferBody {
    directory: String,
    path: String,
    dest: String,
    #[serde(default)]
    resolve: Option<String>,
}

fn unique_dest(parent: &Path, name: &str) -> PathBuf {
    if !parent.join(name).exists() {
        return parent.join(name);
    }
    let path = Path::new(name);
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or(name);
    let extension = path.extension().and_then(|value| value.to_str());
    for index in 1..1000 {
        let file = match extension {
            Some(ext) => format!("{stem} ({index}).{ext}"),
            None => format!("{stem} ({index})"),
        };
        if !parent.join(&file).exists() {
            return parent.join(file);
        }
    }
    parent.join(format!("{stem}-copy"))
}

/// 依 `resolve` 策略解析最終目標路徑（`unique` 時自動避讓；否則衝突即錯誤）。
fn resolve_dest(
    root: &Path,
    dest_rel: &str,
    resolve: Option<&str>,
) -> Result<(PathBuf, String), (StatusCode, Json<serde_json::Value>)> {
    let dest = safe_join(root, dest_rel).map_err(|code| fail(StatusCode::BAD_REQUEST, code))?;
    if !dest.exists() {
        return Ok((dest, dest_rel.to_string()));
    }
    if resolve != Some("unique") {
        return Err(fail(StatusCode::CONFLICT, "already_exists"));
    }
    let parent = dest
        .parent()
        .ok_or_else(|| fail(StatusCode::BAD_REQUEST, "invalid_path"))?
        .to_path_buf();
    let name = dest
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("item")
        .to_string();
    let unique = unique_dest(&parent, &name);
    let unique_name = unique
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("item")
        .to_string();
    let relative = match dest_rel.rsplit_once('/') {
        Some((prefix, _)) => format!("{prefix}/{unique_name}"),
        None => unique_name,
    };
    Ok((unique, relative))
}

/// `POST /rpc/fs/copy`：複製副本（`dest` 為完整相對路徑；不覆蓋既有）。
async fn rpc_fs_copy(
    Json(body): Json<TransferBody>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let root = Path::new(&body.directory);
    let src = safe_join(root, &body.path).map_err(|code| fail(StatusCode::BAD_REQUEST, code))?;
    if !src.exists() {
        return Err(fail(StatusCode::NOT_FOUND, "not_found"));
    }
    let (dest, relative) = resolve_dest(root, &body.dest, body.resolve.as_deref())?;
    if inside_subtree(&src, &dest) {
        return Err(fail(StatusCode::BAD_REQUEST, "invalid_target"));
    }
    copy_tree(&src, &dest).map_err(|code| fail(StatusCode::INTERNAL_SERVER_ERROR, code))?;
    Ok(Json(json!({ "path": relative })))
}

/// `POST /rpc/fs/move`：移動／改名至其他路徑（不覆蓋既有）。
async fn rpc_fs_move(
    Json(body): Json<TransferBody>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let root = Path::new(&body.directory);
    let src = safe_join(root, &body.path).map_err(|code| fail(StatusCode::BAD_REQUEST, code))?;
    if !src.exists() {
        return Err(fail(StatusCode::NOT_FOUND, "not_found"));
    }
    let (dest, relative) = resolve_dest(root, &body.dest, body.resolve.as_deref())?;
    if inside_subtree(&src, &dest) {
        return Err(fail(StatusCode::BAD_REQUEST, "invalid_target"));
    }
    move_path(&src, &dest).map_err(|code| fail(StatusCode::INTERNAL_SERVER_ERROR, code))?;
    Ok(Json(json!({ "path": relative })))
}

#[derive(serde::Deserialize)]
struct DeleteBody {
    directory: String,
    path: String,
    #[serde(default)]
    trash: Option<bool>,
}

/// `POST /rpc/fs/delete`：刪除節點；預設移入 `.owx-trash`（`trash:false` 才永久刪除）。
async fn rpc_fs_delete(
    Json(body): Json<DeleteBody>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let relative = body.path.trim().trim_matches('/');
    if relative.is_empty() || relative == "." {
        return Err(fail(StatusCode::BAD_REQUEST, "invalid_path"));
    }
    let root = Path::new(&body.directory);
    let target = safe_join(root, &body.path).map_err(|code| fail(StatusCode::BAD_REQUEST, code))?;
    if !target.exists() {
        return Err(fail(StatusCode::NOT_FOUND, "not_found"));
    }
    if !body.trash.unwrap_or(true) {
        let removed = if target.is_dir() {
            std::fs::remove_dir_all(&target)
        } else {
            std::fs::remove_file(&target)
        };
        removed.map_err(|_| fail(StatusCode::INTERNAL_SERVER_ERROR, "delete_failed"))?;
        return Ok(Json(
            json!({ "path": body.path, "deleted": true, "trashed": false }),
        ));
    }
    let trash = safe_join(root, TRASH_DIR).map_err(|code| fail(StatusCode::BAD_REQUEST, code))?;
    std::fs::create_dir_all(&trash)
        .map_err(|_| fail(StatusCode::INTERNAL_SERVER_ERROR, "delete_failed"))?;
    let base = target
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("item");
    let archived = trash.join(format!("{}-{base}", now_millis()));
    move_path(&target, &archived).map_err(|code| fail(StatusCode::INTERNAL_SERVER_ERROR, code))?;
    Ok(Json(
        json!({ "path": body.path, "deleted": true, "trashed": true }),
    ))
}

#[derive(serde::Deserialize)]
struct FsInfoQuery {
    directory: String,
    path: String,
}

#[derive(serde::Deserialize)]
struct FsRawQuery {
    directory: String,
    path: String,
}

fn content_type_for_path(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("avif") => "image/avif",
        Some("bmp") => "image/bmp",
        Some("ico") => "image/x-icon",
        Some("svg") => "image/svg+xml",
        Some("pdf") => "application/pdf",
        Some("html") | Some("htm") => "text/html; charset=utf-8",
        Some("txt") | Some("log") | Some("md") => "text/plain; charset=utf-8",
        Some("json") => "application/json; charset=utf-8",
        Some("xml") => "application/xml; charset=utf-8",
        Some("csv") => "text/csv; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("js") | Some("mjs") => "text/javascript; charset=utf-8",
        Some("ts") | Some("tsx") | Some("jsx") => "text/plain; charset=utf-8",
        Some("yaml") | Some("yml") => "text/yaml; charset=utf-8",
        Some("mp3") => "audio/mpeg",
        Some("wav") => "audio/wav",
        Some("ogg") => "audio/ogg",
        Some("m4a") => "audio/mp4",
        Some("mp4") => "video/mp4",
        Some("webm") => "video/webm",
        Some("mov") => "video/quicktime",
        Some("docx") => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        Some("xlsx") | Some("xlsm") => {
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
        Some("pptx") => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        _ => "application/octet-stream",
    }
}

/// `GET /rpc/fs/raw`：受控讀取原始檔案（用於圖片／PDF／HTML／多媒體等預覽）。
async fn rpc_fs_raw(
    Query(query): Query<FsRawQuery>,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    let root = Path::new(&query.directory);
    let target =
        safe_join(root, &query.path).map_err(|code| fail(StatusCode::BAD_REQUEST, code))?;
    if !target.exists() {
        return Err(fail(StatusCode::NOT_FOUND, "not_found"));
    }
    if target.is_dir() {
        return Err(fail(StatusCode::BAD_REQUEST, "invalid_path"));
    }
    let bytes = std::fs::read(&target)
        .map_err(|_| fail(StatusCode::INTERNAL_SERVER_ERROR, "read_failed"))?;
    let content_type = content_type_for_path(&target);
    let headers = [
        (header::CONTENT_TYPE, content_type),
        (header::CONTENT_DISPOSITION, "inline"),
        (header::CACHE_CONTROL, "no-cache"),
    ];
    let mut response = Response::new(bytes.into());
    *response.status_mut() = StatusCode::OK;
    for (key, value) in headers {
        response.headers_mut().insert(key, value.parse().unwrap());
    }
    Ok(response)
}

/// `GET /rpc/fs/info`：節點資訊（型別／大小／項目數／修改時間）。
async fn rpc_fs_info(
    Query(query): Query<FsInfoQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let target = safe_join(Path::new(&query.directory), &query.path)
        .map_err(|code| fail(StatusCode::BAD_REQUEST, code))?;
    let meta = std::fs::metadata(&target).map_err(|_| fail(StatusCode::NOT_FOUND, "not_found"))?;
    let is_dir = meta.is_dir();
    let entries = if is_dir {
        std::fs::read_dir(&target)
            .map(|items| items.filter_map(Result::ok).count())
            .unwrap_or(0)
    } else {
        0
    };
    Ok(Json(json!({
        "path": query.path,
        "type": if is_dir { "directory" } else { "file" },
        "size": if is_dir { serde_json::Value::Null } else { json!(meta.len()) },
        "entries": entries,
        "modified": modified_millis(&meta),
    })))
}

#[derive(serde::Deserialize)]
struct ImportFileBody {
    directory: String,
    path: String,
    #[serde(rename = "contentBase64")]
    content_base64: String,
    #[serde(default)]
    overwrite: bool,
}

async fn rpc_import_file(
    Json(body): Json<ImportFileBody>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(body.content_base64.as_bytes())
        .map_err(|_| fail(StatusCode::BAD_REQUEST, "invalid_base64"))?;
    if decoded.len() as u64 > max_upload_bytes() {
        return Err(fail(StatusCode::PAYLOAD_TOO_LARGE, "too_large"));
    }
    let target = safe_join(Path::new(&body.directory), &body.path)
        .map_err(|code| fail(StatusCode::BAD_REQUEST, code))?;
    if target.exists() && !body.overwrite {
        return Err(fail(StatusCode::CONFLICT, "already_exists"));
    }
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|_| fail(StatusCode::INTERNAL_SERVER_ERROR, "write_failed"))?;
    }
    std::fs::write(&target, &decoded)
        .map_err(|_| fail(StatusCode::INTERNAL_SERVER_ERROR, "write_failed"))?;
    Ok(Json(json!({ "path": body.path, "bytes": decoded.len() })))
}

#[derive(serde::Deserialize)]
struct ArchiveCreateBody {
    directory: String,
    path: String,
    #[serde(default)]
    format: Option<String>,
}

fn add_dir_to_zip(
    zip: &mut zip::ZipWriter<std::fs::File>,
    base: &Path,
    dir: &Path,
    options: zip::write::SimpleFileOptions,
) -> Result<(), &'static str> {
    for entry in std::fs::read_dir(dir).map_err(|_| "read_failed")? {
        let entry = entry.map_err(|_| "read_failed")?;
        let path = entry.path();
        let rel = path.strip_prefix(base).map_err(|_| "archive_failed")?;
        let name = rel.to_string_lossy().replace('\\', "/");
        if path.is_dir() {
            add_dir_to_zip(zip, base, &path, options)?;
        } else {
            zip.start_file(name, options)
                .map_err(|_| "archive_failed")?;
            zip.write_all(&std::fs::read(&path).map_err(|_| "read_failed")?)
                .map_err(|_| "archive_failed")?;
        }
    }
    Ok(())
}

fn write_tar<W: std::io::Write>(writer: W, name: &str, src: &Path) -> std::io::Result<W> {
    let mut builder = tar::Builder::new(writer);
    if src.is_dir() {
        builder.append_dir_all(name, src)?;
    } else {
        builder.append_path_with_name(src, name)?;
    }
    builder.into_inner()
}

fn create_archive(src: &Path, format: &str) -> Result<(), &'static str> {
    let parent = src.parent().ok_or("invalid_path")?;
    let name = src
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("invalid_path")?;
    let out = match format {
        "zip" => parent.join(format!("{name}.zip")),
        "tar.gz" | "tgz" => parent.join(format!("{name}.tar.gz")),
        "tar" => parent.join(format!("{name}.tar")),
        _ => return Err("unsupported_format"),
    };
    if format == "zip" {
        let file = std::fs::File::create(&out).map_err(|_| "archive_failed")?;
        let mut zip = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);
        if src.is_dir() {
            add_dir_to_zip(&mut zip, parent, src, options)?;
        } else {
            zip.start_file(name, options)
                .map_err(|_| "archive_failed")?;
            zip.write_all(&std::fs::read(src).map_err(|_| "read_failed")?)
                .map_err(|_| "archive_failed")?;
        }
        zip.finish().map_err(|_| "archive_failed")?;
    } else if format == "tar.gz" || format == "tgz" {
        let file = std::fs::File::create(&out).map_err(|_| "archive_failed")?;
        let encoder = flate2::write::GzEncoder::new(file, flate2::Compression::default());
        let encoder = write_tar(encoder, name, src).map_err(|_| "archive_failed")?;
        encoder.finish().map_err(|_| "archive_failed")?;
    } else {
        let file = std::fs::File::create(&out).map_err(|_| "archive_failed")?;
        write_tar(file, name, src).map_err(|_| "archive_failed")?;
    }
    Ok(())
}

fn extract_archive(src: &Path, dest: &Path) -> Result<(), &'static str> {
    let name = src.file_name().and_then(|n| n.to_str()).unwrap_or("");
    std::fs::create_dir_all(dest).map_err(|_| "extract_failed")?;
    if name.ends_with(".zip") {
        let file = std::fs::File::open(src).map_err(|_| "not_found")?;
        let mut archive = zip::ZipArchive::new(file).map_err(|_| "unsupported_format")?;
        for index in 0..archive.len() {
            let mut entry = archive.by_index(index).map_err(|_| "extract_failed")?;
            let out_path = match entry.enclosed_name() {
                Some(path) => dest.join(path),
                None => return Err("outside_worktree"),
            };
            if entry.is_dir() {
                std::fs::create_dir_all(&out_path).map_err(|_| "extract_failed")?;
            } else {
                if let Some(parent) = out_path.parent() {
                    std::fs::create_dir_all(parent).map_err(|_| "extract_failed")?;
                }
                let mut out = std::fs::File::create(&out_path).map_err(|_| "extract_failed")?;
                std::io::copy(&mut entry, &mut out).map_err(|_| "extract_failed")?;
            }
        }
    } else if name.ends_with(".tar.gz") || name.ends_with(".tgz") {
        let file = std::fs::File::open(src).map_err(|_| "not_found")?;
        let decoder = flate2::read::GzDecoder::new(file);
        tar::Archive::new(decoder)
            .unpack(dest)
            .map_err(|_| "extract_failed")?;
    } else if name.ends_with(".tar") {
        let file = std::fs::File::open(src).map_err(|_| "not_found")?;
        tar::Archive::new(file)
            .unpack(dest)
            .map_err(|_| "extract_failed")?;
    } else {
        return Err("unsupported_format");
    }
    Ok(())
}

async fn rpc_archive_create(
    Json(body): Json<ArchiveCreateBody>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let src = safe_join(Path::new(&body.directory), &body.path)
        .map_err(|code| fail(StatusCode::BAD_REQUEST, code))?;
    if !src.exists() {
        return Err(fail(StatusCode::NOT_FOUND, "not_found"));
    }
    let format = body.format.unwrap_or_else(|| "zip".to_string());
    create_archive(&src, &format).map_err(|code| match code {
        "unsupported_format" => fail(StatusCode::UNSUPPORTED_MEDIA_TYPE, code),
        _ => fail(StatusCode::INTERNAL_SERVER_ERROR, code),
    })?;
    let ext = match format.as_str() {
        "zip" => "zip",
        "tar.gz" | "tgz" => "tar.gz",
        _ => "tar",
    };
    Ok(Json(json!({ "archive": format!("{}.{}", body.path, ext) })))
}

#[derive(serde::Deserialize)]
struct ArchiveExtractBody {
    directory: String,
    path: String,
    #[serde(default)]
    dest: Option<String>,
}

async fn rpc_archive_extract(
    Json(body): Json<ArchiveExtractBody>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let src = safe_join(Path::new(&body.directory), &body.path)
        .map_err(|code| fail(StatusCode::BAD_REQUEST, code))?;
    if !src.exists() {
        return Err(fail(StatusCode::NOT_FOUND, "not_found"));
    }
    let dest_rel = match &body.dest {
        Some(dest) if !dest.trim().is_empty() => dest.clone(),
        _ => {
            let name = body.path.rsplit('/').next().unwrap_or(&body.path);
            let stem = match name.split_once('.') {
                Some((stem, _)) => stem,
                None => name,
            };
            let parent = match body.path.rsplit_once('/') {
                Some((parent, _)) => format!("{parent}/{stem}"),
                None => stem.to_string(),
            };
            parent
        }
    };
    let dest = safe_join(Path::new(&body.directory), &dest_rel)
        .map_err(|code| fail(StatusCode::BAD_REQUEST, code))?;
    extract_archive(&src, &dest).map_err(|code| match code {
        "unsupported_format" => fail(StatusCode::UNSUPPORTED_MEDIA_TYPE, code),
        "not_found" => fail(StatusCode::NOT_FOUND, code),
        _ => fail(StatusCode::INTERNAL_SERVER_ERROR, code),
    })?;
    Ok(Json(json!({ "dest": dest_rel })))
}

async fn rpc_not_configured() -> (StatusCode, Json<serde_json::Value>) {
    fail(StatusCode::NOT_IMPLEMENTED, "not_configured")
}

const MAX_LOGO_BYTES: usize = 2 * 1024 * 1024;
#[derive(serde::Deserialize)]
struct LogoBody {
    #[serde(rename = "dataBase64")]
    data_base64: String,
    ext: String,
}

fn normalize_logo_ext(ext: &str) -> Option<&'static str> {
    match ext.trim().to_lowercase().as_str() {
        "png" => Some("png"),
        "jpg" => Some("jpg"),
        "jpeg" => Some("jpeg"),
        "svg" => Some("svg"),
        "webp" => Some("webp"),
        _ => None,
    }
}

fn logo_content_type(name: &str) -> &'static str {
    let lower = name.to_lowercase();
    if lower.ends_with(".png") {
        "image/png"
    } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        "image/jpeg"
    } else if lower.ends_with(".svg") {
        "image/svg+xml"
    } else if lower.ends_with(".webp") {
        "image/webp"
    } else {
        "application/octet-stream"
    }
}

async fn rpc_settings_get(State(state): State<AppState>) -> Json<owx_config::Settings> {
    Json(owx_config::Settings::load(&state.config_dir))
}

async fn rpc_settings_post(
    State(state): State<AppState>,
    Json(body): Json<owx_config::Settings>,
) -> Result<Json<owx_config::Settings>, (StatusCode, Json<serde_json::Value>)> {
    if let Err(reason) = body.validate() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "invalid_settings", "detail": reason })),
        ));
    }
    body.save(&state.config_dir)
        .map_err(|_| fail(StatusCode::INTERNAL_SERVER_ERROR, "write_failed"))?;
    Ok(Json(body))
}

async fn rpc_settings_logo_upload(
    State(state): State<AppState>,
    Json(body): Json<LogoBody>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let ext = normalize_logo_ext(&body.ext)
        .ok_or_else(|| fail(StatusCode::BAD_REQUEST, "invalid_image"))?;
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(body.data_base64.as_bytes())
        .map_err(|_| fail(StatusCode::BAD_REQUEST, "invalid_image"))?;
    if decoded.len() > MAX_LOGO_BYTES {
        return Err(fail(StatusCode::PAYLOAD_TOO_LARGE, "too_large"));
    }
    std::fs::create_dir_all(&state.config_dir)
        .map_err(|_| fail(StatusCode::INTERNAL_SERVER_ERROR, "write_failed"))?;
    let file_name = format!("logo.{ext}");
    std::fs::write(state.config_dir.join(&file_name), &decoded)
        .map_err(|_| fail(StatusCode::INTERNAL_SERVER_ERROR, "write_failed"))?;
    let mut settings = owx_config::Settings::load(&state.config_dir);
    settings.global.logo = Some(file_name.clone());
    settings
        .save(&state.config_dir)
        .map_err(|_| fail(StatusCode::INTERNAL_SERVER_ERROR, "write_failed"))?;
    Ok(Json(json!({ "logo": file_name })))
}

async fn rpc_settings_logo_get(
    State(state): State<AppState>,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    let settings = owx_config::Settings::load(&state.config_dir);
    let Some(name) = settings.global.logo else {
        return Err(fail(StatusCode::NOT_FOUND, "not_found"));
    };
    let bytes = std::fs::read(state.config_dir.join(&name))
        .map_err(|_| fail(StatusCode::NOT_FOUND, "not_found"))?;
    Ok(([(header::CONTENT_TYPE, logo_content_type(&name))], bytes).into_response())
}

#[derive(serde::Deserialize)]
struct GitStatusQuery {
    directory: String,
}

async fn rpc_git_status(
    Query(query): Query<GitStatusQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let dir = Path::new(&query.directory);
    if !dir.is_dir() {
        return Err(fail(StatusCode::BAD_REQUEST, "invalid_directory"));
    }
    let mut files = Vec::new();
    if let Ok(output) = std::process::Command::new("git")
        .arg("-C")
        .arg(dir)
        .args(["status", "--porcelain"])
        .output()
    {
        let text = String::from_utf8_lossy(&output.stdout);
        for line in text.lines() {
            if line.len() < 4 {
                continue;
            }
            let code = &line[..2];
            let path = line[3..].trim().to_string();
            let status = if code.contains('?') {
                "untracked"
            } else if code.contains('A') {
                "added"
            } else if code.contains('D') {
                "deleted"
            } else if code.contains('R') {
                "renamed"
            } else {
                "modified"
            };
            files.push(json!({ "path": path, "status": status }));
        }
    }
    Ok(Json(json!({ "files": files })))
}

#[derive(serde::Deserialize)]
struct GitCommitBody {
    directory: String,
    message: String,
}

async fn rpc_git_commit(
    Json(body): Json<GitCommitBody>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let dir = Path::new(&body.directory);
    if !dir.is_dir() {
        return Err(fail(StatusCode::BAD_REQUEST, "invalid_directory"));
    }
    let _ = std::process::Command::new("git")
        .arg("-C")
        .arg(dir)
        .args(["add", "-A"])
        .output();
    let clean = std::process::Command::new("git")
        .arg("-C")
        .arg(dir)
        .args(["status", "--porcelain"])
        .output()
        .map(|output| output.stdout.is_empty())
        .unwrap_or(true);
    if clean {
        return Ok(Json(
            json!({ "committed": false, "reason": "nothing_to_commit" }),
        ));
    }
    let commit = std::process::Command::new("git")
        .arg("-C")
        .arg(dir)
        .args(["-c", "user.name=owx", "-c", "user.email=owx@localhost"])
        .args(["commit", "-m", &body.message])
        .output()
        .map_err(|_| fail(StatusCode::INTERNAL_SERVER_ERROR, "git_failed"))?;
    if commit.status.success() {
        return Ok(Json(json!({ "committed": true })));
    }
    let detail = format!(
        "{}{}",
        String::from_utf8_lossy(&commit.stdout),
        String::from_utf8_lossy(&commit.stderr)
    );
    Err((
        StatusCode::BAD_REQUEST,
        Json(json!({ "error": "commit_failed", "detail": detail.trim() })),
    ))
}

async fn rpc_knowledge_list(State(state): State<AppState>) -> Json<serde_json::Value> {
    let mut projects = Vec::new();
    let base = resolved_knowledge_dir(&state);
    if let Ok(entries) = std::fs::read_dir(&base) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let slug = entry.file_name().to_string_lossy().to_string();
            if slug.starts_with('.') {
                continue;
            }
            let meta = std::fs::read(path.join(".owx-project.json"))
                .ok()
                .and_then(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).ok());
            let id = meta
                .as_ref()
                .and_then(|m| m.get("id").cloned())
                .unwrap_or(serde_json::Value::Null);
            let name = meta
                .as_ref()
                .and_then(|m| m.get("name").and_then(|v| v.as_str()))
                .unwrap_or(&slug)
                .to_string();
            let tags = meta
                .as_ref()
                .and_then(|m| m.get("tags").cloned())
                .unwrap_or(serde_json::Value::Null);
            let created = meta
                .as_ref()
                .and_then(|m| m.get("created").cloned())
                .unwrap_or(serde_json::Value::Null);
            let dirty = std::process::Command::new("git")
                .arg("-C")
                .arg(&path)
                .args(["status", "--porcelain"])
                .output()
                .map(|output| !output.stdout.is_empty())
                .unwrap_or(false);
            projects.push(json!({
                "slug": slug,
                "name": name,
                "id": id,
                "tags": tags,
                "created": created,
                "worktree": path.to_string_lossy(),
                "dirty": dirty,
            }));
        }
    }
    projects.sort_by(|a, b| {
        a["slug"]
            .as_str()
            .unwrap_or("")
            .cmp(b["slug"].as_str().unwrap_or(""))
    });
    Json(json!({ "projects": projects }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn router_builds() {
        let _ = router(AppState::default());
    }

    #[test]
    fn slug_validation() {
        assert!(valid_slug("my-project"));
        assert!(valid_slug("a1"));
        assert!(!valid_slug("My Project"));
        assert!(!valid_slug("-bad"));
        assert!(!valid_slug("../escape"));
        assert!(!valid_slug(""));
    }

    #[test]
    fn creates_project_dir_with_metadata() {
        let base = std::env::temp_dir().join(format!("owx-test-{}", now_millis()));
        let sample = std::env::temp_dir().join(format!("owx-sample-{}", now_millis()));
        std::fs::create_dir_all(sample.join("templates")).unwrap();
        std::fs::write(
            sample.join("templates/AGENTS.md"),
            "# {{project_name}}\n\n一般性規範\n",
        )
        .unwrap();
        let created = create_project(
            &base,
            &sample,
            "測試專案",
            "my-doc",
            &["a".into(), "b".into()],
        )
        .expect("create should succeed");
        assert_eq!(created["slug"], "my-doc");
        let dir = base.join("my-doc");
        assert!(dir.is_dir());
        let raw = std::fs::read(dir.join(".owx-project.json")).expect("metadata written");
        let meta: serde_json::Value = serde_json::from_slice(&raw).expect("valid json");
        assert_eq!(meta["name"], "測試專案");
        assert_eq!(meta["tags"][1], "b");
        let agents = std::fs::read_to_string(dir.join("AGENTS.md")).expect("agents written");
        assert!(agents.contains("測試專案"));
        let _ = std::fs::remove_dir_all(&base);
        let _ = std::fs::remove_dir_all(&sample);
    }

    #[test]
    fn rejects_duplicate_and_invalid() {
        let base = std::env::temp_dir().join(format!("owx-test-dup-{}", now_millis()));
        let sample = std::env::temp_dir().join(format!("owx-sample-dup-{}", now_millis()));
        std::fs::create_dir_all(&sample).unwrap();
        assert!(create_project(&base, &sample, "n", "dup", &[]).is_ok());
        assert_eq!(
            create_project(&base, &sample, "n", "dup", &[])
                .unwrap_err()
                .1,
            "already_exists"
        );
        assert_eq!(
            create_project(&base, &sample, "n", "Bad Slug", &[])
                .unwrap_err()
                .1,
            "invalid_slug"
        );
        let _ = std::fs::remove_dir_all(&base);
        let _ = std::fs::remove_dir_all(&sample);
    }
}

#[cfg(test)]
mod node_ops_tests {
    use super::*;

    fn tmp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("owx-{}-{}", name, now_millis()));
        std::fs::create_dir_all(&dir).expect("tmp");
        dir
    }

    #[test]
    fn safe_join_rejects_escapes() {
        let root = tmp("safejoin");
        assert!(safe_join(&root, "a/b.txt").is_ok());
        assert_eq!(safe_join(&root, "../x").unwrap_err(), "outside_worktree");
        assert_eq!(
            safe_join(&root, "/etc/passwd").unwrap_err(),
            "outside_worktree"
        );
        assert_eq!(safe_join(&root, "").unwrap_err(), "invalid_path");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn mkdir_write_import_handlers() {
        let root = tmp("handlers");
        let directory = root.to_string_lossy().to_string();

        assert!(rpc_fs_mkdir(Json(DirPathBody {
            directory: directory.clone(),
            path: "docs".into(),
        }))
        .await
        .is_ok());
        assert!(root.join("docs").is_dir());

        assert!(rpc_fs_write(Json(WriteBody {
            directory: directory.clone(),
            path: "docs/a.md".into(),
            content: "# hi".into(),
            overwrite: false,
        }))
        .await
        .is_ok());
        assert_eq!(
            std::fs::read_to_string(root.join("docs/a.md")).unwrap(),
            "# hi"
        );

        let dup = rpc_fs_write(Json(WriteBody {
            directory: directory.clone(),
            path: "docs/a.md".into(),
            content: "x".into(),
            overwrite: false,
        }))
        .await
        .unwrap_err();
        assert_eq!(dup.0, StatusCode::CONFLICT);

        let content = base64::engine::general_purpose::STANDARD.encode(b"png-bytes");
        assert!(rpc_import_file(Json(ImportFileBody {
            directory: directory.clone(),
            path: "img.png".into(),
            content_base64: content,
            overwrite: false,
        }))
        .await
        .is_ok());
        assert_eq!(std::fs::read(root.join("img.png")).unwrap(), b"png-bytes");

        let escape = rpc_fs_write(Json(WriteBody {
            directory,
            path: "../evil".into(),
            content: "x".into(),
            overwrite: true,
        }))
        .await
        .unwrap_err();
        assert_eq!(escape.0, StatusCode::BAD_REQUEST);

        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn zip_roundtrip() {
        let root = tmp("zip");
        let src = root.join("proj");
        std::fs::create_dir_all(&src).unwrap();
        std::fs::write(src.join("a.md"), b"# a").unwrap();
        create_archive(&src, "zip").unwrap();
        let archive = root.join("proj.zip");
        assert!(archive.is_file());
        let dest = root.join("out");
        extract_archive(&archive, &dest).unwrap();
        assert_eq!(std::fs::read(dest.join("proj/a.md")).unwrap(), b"# a");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn tar_gz_roundtrip() {
        let root = tmp("targz");
        let src = root.join("proj");
        std::fs::create_dir_all(&src).unwrap();
        std::fs::write(src.join("a.md"), b"hello").unwrap();
        create_archive(&src, "tar.gz").unwrap();
        let archive = root.join("proj.tar.gz");
        assert!(archive.is_file());
        let dest = root.join("out");
        extract_archive(&archive, &dest).unwrap();
        assert_eq!(std::fs::read(dest.join("proj/a.md")).unwrap(), b"hello");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn rename_moves_entry_and_rejects_conflicts() {
        let root = tmp("rename");
        let directory = root.to_string_lossy().to_string();
        std::fs::write(root.join("old.md"), b"x").unwrap();
        let done = rpc_fs_rename(Json(RenameBody {
            directory: directory.clone(),
            path: "old.md".into(),
            new_name: "new.md".into(),
        }))
        .await
        .expect("rename");
        assert_eq!(done.0["path"], json!("new.md"));
        assert!(root.join("new.md").is_file());

        std::fs::write(root.join("taken.md"), b"y").unwrap();
        let conflict = rpc_fs_rename(Json(RenameBody {
            directory: directory.clone(),
            path: "new.md".into(),
            new_name: "taken.md".into(),
        }))
        .await
        .unwrap_err();
        assert_eq!(conflict.0, StatusCode::CONFLICT);

        let bad = rpc_fs_rename(Json(RenameBody {
            directory,
            path: "new.md".into(),
            new_name: "../escape".into(),
        }))
        .await
        .unwrap_err();
        assert_eq!(bad.0, StatusCode::BAD_REQUEST);
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn delete_defaults_to_trash_and_supports_permanent() {
        let root = tmp("delete");
        let directory = root.to_string_lossy().to_string();
        std::fs::create_dir_all(root.join("dir/sub")).unwrap();
        std::fs::write(root.join("dir/sub/a.md"), b"x").unwrap();

        let trashed = rpc_fs_delete(Json(DeleteBody {
            directory: directory.clone(),
            path: "dir".into(),
            trash: None,
        }))
        .await
        .expect("trash");
        assert_eq!(trashed.0["trashed"], json!(true));
        assert!(!root.join("dir").exists());
        assert!(root.join(TRASH_DIR).is_dir());

        std::fs::write(root.join("gone.md"), b"x").unwrap();
        let purged = rpc_fs_delete(Json(DeleteBody {
            directory: directory.clone(),
            path: "gone.md".into(),
            trash: Some(false),
        }))
        .await
        .expect("purge");
        assert_eq!(purged.0["trashed"], json!(false));
        assert!(!root.join("gone.md").exists());

        let root_delete = rpc_fs_delete(Json(DeleteBody {
            directory,
            path: ".".into(),
            trash: None,
        }))
        .await
        .unwrap_err();
        assert_eq!(root_delete.0, StatusCode::BAD_REQUEST);
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn copy_and_move_guard_targets() {
        let root = tmp("copymove");
        let directory = root.to_string_lossy().to_string();
        std::fs::create_dir_all(root.join("src/inner")).unwrap();
        std::fs::write(root.join("src/inner/a.md"), b"hello").unwrap();

        let copied = rpc_fs_copy(Json(TransferBody {
            directory: directory.clone(),
            path: "src".into(),
            dest: "copy".into(),
            resolve: None,
        }))
        .await
        .expect("copy");
        assert_eq!(copied.0["path"], json!("copy"));
        assert_eq!(
            std::fs::read(root.join("copy/inner/a.md")).unwrap(),
            b"hello"
        );

        let nested = rpc_fs_copy(Json(TransferBody {
            directory: directory.clone(),
            path: "src".into(),
            dest: "src/inside".into(),
            resolve: None,
        }))
        .await
        .unwrap_err();
        assert_eq!(nested.0, StatusCode::BAD_REQUEST);

        let moved = rpc_fs_move(Json(TransferBody {
            directory: directory.clone(),
            path: "copy".into(),
            dest: "renamed".into(),
            resolve: None,
        }))
        .await
        .expect("move");
        assert_eq!(moved.0["path"], json!("renamed"));
        assert!(root.join("renamed/inner/a.md").is_file());
        assert!(!root.join("copy").exists());

        let occupied = rpc_fs_move(Json(TransferBody {
            directory,
            path: "renamed".into(),
            dest: "src".into(),
            resolve: None,
        }))
        .await
        .unwrap_err();
        assert_eq!(occupied.0, StatusCode::CONFLICT);
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn transfer_resolve_unique_avoids_overwrite() {
        let root = tmp("resolve");
        let directory = root.to_string_lossy().to_string();
        std::fs::create_dir_all(root.join("a")).unwrap();
        std::fs::write(root.join("a/note.md"), b"one").unwrap();
        std::fs::write(root.join("note.md"), b"existing").unwrap();

        let copied = rpc_fs_copy(Json(TransferBody {
            directory: directory.clone(),
            path: "a/note.md".into(),
            dest: "note.md".into(),
            resolve: Some("unique".into()),
        }))
        .await
        .expect("copy unique");
        assert_eq!(copied.0["path"], json!("note (1).md"));
        assert_eq!(std::fs::read(root.join("note.md")).unwrap(), b"existing");
        assert_eq!(std::fs::read(root.join("note (1).md")).unwrap(), b"one");

        let moved = rpc_fs_move(Json(TransferBody {
            directory: directory.clone(),
            path: "a/note.md".into(),
            dest: "note.md".into(),
            resolve: Some("unique".into()),
        }))
        .await
        .expect("move unique");
        assert_eq!(moved.0["path"], json!("note (2).md"));

        let strict = rpc_fs_copy(Json(TransferBody {
            directory,
            path: "note.md".into(),
            dest: "note (1).md".into(),
            resolve: None,
        }))
        .await
        .unwrap_err();
        assert_eq!(strict.0, StatusCode::CONFLICT);
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn info_reports_type_size_and_entries() {
        let root = tmp("info");
        let directory = root.to_string_lossy().to_string();
        std::fs::create_dir_all(root.join("d")).unwrap();
        std::fs::write(root.join("d/a.md"), b"12345").unwrap();

        let file = rpc_fs_info(Query(FsInfoQuery {
            directory: directory.clone(),
            path: "d/a.md".into(),
        }))
        .await
        .expect("file info");
        assert_eq!(file.0["type"], json!("file"));
        assert_eq!(file.0["size"], json!(5));

        let dir = rpc_fs_info(Query(FsInfoQuery {
            directory,
            path: "d".into(),
        }))
        .await
        .expect("dir info");
        assert_eq!(dir.0["type"], json!("directory"));
        assert_eq!(dir.0["entries"], json!(1));
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn git_commit_roundtrip() {
        let root = tmp("gitcommit");
        let _ = std::process::Command::new("git")
            .arg("-C")
            .arg(&root)
            .args(["init", "-q"])
            .status();
        std::fs::write(root.join("a.md"), b"hi").unwrap();
        let directory = root.to_string_lossy().to_string();
        let first = rpc_git_commit(Json(GitCommitBody {
            directory: directory.clone(),
            message: "init".into(),
        }))
        .await
        .expect("commit");
        assert_eq!(first.0["committed"], json!(true));
        let second = rpc_git_commit(Json(GitCommitBody {
            directory,
            message: "again".into(),
        }))
        .await
        .expect("commit");
        assert_eq!(second.0["committed"], json!(false));
        let _ = std::fs::remove_dir_all(&root);
    }
}

#[cfg(test)]
mod settings_tests {
    use super::*;

    fn tmp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("owx-settings-{}-{}", name, now_millis()));
        std::fs::create_dir_all(&dir).expect("tmp");
        dir
    }

    #[test]
    fn resolved_knowledge_dir_falls_back_to_state_dir() {
        let base = tmp_dir("fallback");
        let state = AppState::default()
            .with_knowledge_dir(base.join("know"))
            .with_config_dir(base.join("cfg"));
        assert_eq!(resolved_knowledge_dir(&state), base.join("know"));
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn resolved_knowledge_dir_uses_override() {
        let base = tmp_dir("override");
        let cfg = base.join("cfg");
        let mut settings = owx_config::Settings::default();
        settings.global.knowledge_root = Some(base.join("custom").to_string_lossy().to_string());
        settings.save(&cfg).expect("save");
        let state = AppState::default()
            .with_knowledge_dir(base.join("know"))
            .with_config_dir(cfg);
        assert_eq!(resolved_knowledge_dir(&state), base.join("custom"));
        let _ = std::fs::remove_dir_all(&base);
    }

    #[tokio::test]
    async fn settings_get_returns_defaults() {
        let base = tmp_dir("get");
        let state = AppState::default().with_config_dir(base.join("cfg"));
        let got = rpc_settings_get(State(state)).await;
        assert_eq!(got.0.global.system_name, "owx");
        assert_eq!(got.0.personal.theme, owx_config::Theme::System);
        let _ = std::fs::remove_dir_all(&base);
    }

    #[tokio::test]
    async fn settings_post_rejects_invalid_and_persists_valid() {
        let base = tmp_dir("post");
        let cfg = base.join("cfg");
        let state = AppState::default().with_config_dir(cfg.clone());

        let mut bad = owx_config::Settings::default();
        bad.global.accent = Some("red".into());
        let err = rpc_settings_post(State(state.clone()), Json(bad))
            .await
            .expect_err("invalid accent");
        assert_eq!(err.0, StatusCode::BAD_REQUEST);

        let mut good = owx_config::Settings::default();
        good.global.system_name = "acme".into();
        good.global.accent = Some("#034cff".into());
        let saved = rpc_settings_post(State(state), Json(good))
            .await
            .expect("save");
        assert_eq!(saved.0.global.system_name, "acme");
        assert_eq!(owx_config::Settings::load(&cfg).global.system_name, "acme");
        let _ = std::fs::remove_dir_all(&base);
    }

    #[tokio::test]
    async fn logo_upload_then_get_roundtrip() {
        let base = tmp_dir("logo");
        let state = AppState::default().with_config_dir(base.join("cfg"));
        let png = base64::engine::general_purpose::STANDARD.encode(b"\x89PNG\r\n\x1a\n");
        let up = rpc_settings_logo_upload(
            State(state.clone()),
            Json(LogoBody {
                data_base64: png,
                ext: "PNG".into(),
            }),
        )
        .await
        .expect("upload");
        assert_eq!(up.0["logo"], json!("logo.png"));

        let resp = rpc_settings_logo_get(State(state)).await.expect("get");
        assert_eq!(resp.status(), StatusCode::OK);

        let empty = AppState::default().with_config_dir(base.join("empty"));
        assert_eq!(
            rpc_settings_logo_get(State(empty)).await.unwrap_err().0,
            StatusCode::NOT_FOUND
        );
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn normalize_models_shapes_and_sorts() {
        let raw = json!({
            "b": { "name": "B", "models": { "m2": { "name": "M2" } } },
            "a": { "name": "A", "models": { "m1": {} } }
        });
        let list = normalize_models(&raw);
        assert_eq!(list[0]["id"], "a");
        assert_eq!(list[0]["models"][0]["id"], "m1");
        assert_eq!(list[0]["models"][0]["name"], "m1");
        assert_eq!(list[1]["id"], "b");
    }

    #[test]
    fn models_file_resolution() {
        assert_eq!(
            models_file_from(Some("/x/models.json"), None, None),
            PathBuf::from("/x/models.json")
        );
        assert_eq!(
            models_file_from(None, Some("/xdg"), None),
            PathBuf::from("/xdg/opencode/models.json")
        );
        assert_eq!(
            models_file_from(None, None, Some("/home/u")),
            PathBuf::from("/home/u/.cache/opencode/models.json")
        );
    }
}

//! owx Harness 邊界（boundary）骨架。
//!
//! 提供 loopback HTTP 端點：`GET /health`、`POST /rpc/hook`（shim → sidecar）、
//! `POST /mcp`（opencode model → sidecar，最小 JSON-RPC）。
//! 契約見 `docs/design/interfaces.md`；決策見 `docs/adr/ADR-0004-harness-opencode-boundary.md`。

pub mod opencode;

use axum::{
    extract::{Json, Query, State},
    http::StatusCode,
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
}

impl AppState {
    pub fn new(policy: ToolPolicy, doom_threshold: u32, categories: CategoryRegistry) -> Self {
        Self {
            policy: Arc::new(policy),
            doom: Arc::new(Mutex::new(DoomLoopGuard::new(doom_threshold))),
            categories: Arc::new(categories),
            opencode: None,
            knowledge_dir: default_knowledge_dir(),
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
        let state = Self::new(ToolPolicy::new(rules), threshold, categories)
            .with_knowledge_dir(knowledge_dir_from_env());
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
        .route("/rpc/git/status", get(rpc_git_status))
        .route("/rpc/git/commit", post(rpc_git_commit))
        .route("/rpc/fs/mkdir", post(rpc_fs_mkdir))
        .route("/rpc/fs/write", post(rpc_fs_write))
        .route("/rpc/import/file", post(rpc_import_file))
        .route("/rpc/import/notion", post(rpc_not_configured))
        .route("/rpc/convert", post(rpc_not_configured))
        .route("/rpc/export/filer", post(rpc_not_configured))
        .route("/rpc/export/notion", post(rpc_not_configured))
        .route("/rpc/share", post(rpc_not_configured))
        .route("/rpc/archive/create", post(rpc_archive_create))
        .route("/rpc/archive/extract", post(rpc_archive_extract))
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

fn create_project(
    base: &Path,
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
    create_project(&state.knowledge_dir, &body.name, &body.slug, &body.tags)
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
    if let Ok(entries) = std::fs::read_dir(&state.knowledge_dir) {
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
        let created = create_project(&base, "測試專案", "my-doc", &["a".into(), "b".into()])
            .expect("create should succeed");
        assert_eq!(created["slug"], "my-doc");
        let dir = base.join("my-doc");
        assert!(dir.is_dir());
        let raw = std::fs::read(dir.join(".owx-project.json")).expect("metadata written");
        let meta: serde_json::Value = serde_json::from_slice(&raw).expect("valid json");
        assert_eq!(meta["name"], "測試專案");
        assert_eq!(meta["tags"][1], "b");
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn rejects_duplicate_and_invalid() {
        let base = std::env::temp_dir().join(format!("owx-test-dup-{}", now_millis()));
        assert!(create_project(&base, "n", "dup", &[]).is_ok());
        assert_eq!(
            create_project(&base, "n", "dup", &[]).unwrap_err().1,
            "already_exists"
        );
        assert_eq!(
            create_project(&base, "n", "Bad Slug", &[]).unwrap_err().1,
            "invalid_slug"
        );
        let _ = std::fs::remove_dir_all(&base);
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

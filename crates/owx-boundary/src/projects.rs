//! 專案屬性（project properties）與規範目錄 RPC。
//!
//! 對應規格 `docs/spec/project-properties-requirements.md`（FR-H-27～49）與
//! [`ADR-0011`](../../../docs/adr/ADR-0011-project-metadata-and-standards-catalog.md)：
//! - `GET  /rpc/project/get?directory=<abs>`：讀取專案中繼資料（缺欄補預設）。
//! - `POST /rpc/project/update`：驗證並原子寫回 `.owx-project.json`；可冪等生成基礎目錄、
//!   抄錄選定規範文件。
//! - `GET  /rpc/standards/list`：讀取規範目錄（`owx-Standard.json`；僅識別資料）。
//! - `GET  /rpc/project/base-dirs`：回傳「專案屬性 → 建議基礎目錄」對照（資料驅動＋內建預設）。
//!
//! 紅線：規範目錄僅含識別資料，**不複製標準原文**（NFR-22）。

use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

use super::{fail, now_millis, resolved_knowledge_dir, safe_join, AppState};

/// 機密等級預設值（FR-H-37）。
const DEFAULT_CONFIDENTIALITY: &str = "一般";
/// 允許的機密等級。
const CONFIDENTIALITY_LEVELS: [&str; 3] = ["絕對機密", "機密", "一般"];
/// 專案屬性選項（規格 §1.3）。
const PROPERTIES: [&str; 7] = [
    "系統開發文件",
    "公司手冊",
    "產品文件",
    "專利文件",
    "流程規劃",
    "研究專案",
    "一般報告",
];

/// 相容群組（規格 §1.3.2）；`S` 為獨立項（不可與他項並存）。
fn property_group(property: &str) -> Option<&'static str> {
    match property {
        "系統開發文件" | "產品文件" => Some("A"),
        "公司手冊" | "流程規劃" => Some("B"),
        "專利文件" | "研究專案" => Some("C"),
        "一般報告" => Some("S"),
        _ => None,
    }
}

fn is_known_property(property: &str) -> bool {
    PROPERTIES.contains(&property)
}

/// 內建「屬性 → 建議基礎目錄」對照（規格 §1.4）。
fn builtin_base_dirs(property: &str) -> Option<(&'static str, Vec<&'static str>)> {
    let entry = match property {
        "系統開發文件" => (
            "system-docs",
            vec!["docs", "specs", "design", "api", "adr", "tests", "skills"],
        ),
        "公司手冊" => (
            "handbook",
            vec![
                "handbook",
                "policies",
                "onboarding",
                "processes",
                "faq",
                "skills",
            ],
        ),
        "產品文件" => (
            "product",
            vec![
                "product",
                "features",
                "guides",
                "release-notes",
                "faq",
                "skills",
            ],
        ),
        "專利文件" => (
            "patent",
            vec![
                "patents",
                "drafts",
                "prior-art",
                "figures",
                "disclosures",
                "skills",
            ],
        ),
        "流程規劃" => (
            "process",
            vec![
                "processes",
                "workflows",
                "templates",
                "roles",
                "kpi",
                "skills",
            ],
        ),
        "研究專案" => (
            "research",
            vec![
                "research",
                "literature",
                "notes",
                "data",
                "findings",
                "skills",
            ],
        ),
        "一般報告" => (
            "report",
            vec!["reports", "drafts", "attachments", "archive", "skills"],
        ),
        _ => return None,
    };
    Some(entry)
}

/// 專案中繼資料之預設值（實際檔案以 deep-fill 補齊缺欄）。
fn project_defaults() -> Value {
    json!({
        "name_en": Value::Null,
        "properties": [],
        "base_dirs": { "sample_ref": Value::Null, "enabled": false, "dirs": [] },
        "writing_standard": {
            "versioning": true,
            "require_title": true,
            "require_revision": true,
            "require_change_log": true,
            "confidentiality_default": DEFAULT_CONFIDENTIALITY,
            "compliance": [],
            "submit_checks": { "consistency": false, "objectivity": false, "audit": false }
        },
        "params": { "show_hidden": false, "autosave_minutes": 10 }
    })
}

/// 遞迴填入 `target` 缺漏的鍵（來自 `fill`）；兩者皆物件時遞迴。
fn deep_fill(target: &mut Value, fill: &Value) {
    if let (Value::Object(t), Value::Object(f)) = (&mut *target, fill) {
        for (key, value) in f {
            match t.get_mut(key) {
                Some(existing) => deep_fill(existing, value),
                None => {
                    t.insert(key.clone(), value.clone());
                }
            }
        }
    }
}

/// 遞迴以 `patch` 覆蓋 `target`；兩者皆物件時遞迴，否則整體取代。
fn deep_overlay(target: &mut Value, patch: &Value) {
    if let (Value::Object(t), Value::Object(p)) = (&mut *target, patch) {
        for (key, value) in p {
            match t.get_mut(key) {
                Some(existing) => deep_overlay(existing, value),
                None => {
                    t.insert(key.clone(), value.clone());
                }
            }
        }
    } else {
        *target = patch.clone();
    }
}

/// 驗證 patch 的領域欄位（名稱、屬性、機密等級、自動保存）。
fn validate_patch(patch: &Value) -> Result<(), &'static str> {
    if let Some(name) = patch.get("name") {
        match name.as_str() {
            Some(text) if !text.trim().is_empty() => {}
            _ => return Err("invalid_name"),
        }
    }
    if let Some(properties) = patch.get("properties") {
        let Some(items) = properties.as_array() else {
            return Err("invalid_property");
        };
        let mut group: Option<&str> = None;
        for item in items {
            let Some(value) = item.as_str() else {
                return Err("invalid_property");
            };
            if !is_known_property(value) {
                return Err("invalid_property");
            }
            let Some(item_group) = property_group(value) else {
                return Err("invalid_property");
            };
            if item_group == "S" && items.len() > 1 {
                return Err("invalid_property");
            }
            match group {
                None => group = Some(item_group),
                Some(existing) if existing == item_group => {}
                Some(_) => return Err("invalid_property"),
            }
        }
    }
    if let Some(default_level) = patch.pointer("/writing_standard/confidentiality_default") {
        match default_level.as_str() {
            Some(level) if CONFIDENTIALITY_LEVELS.contains(&level) => {}
            _ => return Err("invalid_confidentiality"),
        }
    }
    if let Some(minutes) = patch.pointer("/params/autosave_minutes") {
        match minutes.as_u64() {
            Some(value) if value <= 120 => {}
            _ => return Err("invalid_autosave"),
        }
    }
    Ok(())
}

/// 專案目錄須落在 `OWX_KNOWLEDGE_DIR` 之下（路徑邊界）。
fn require_in_knowledge_dir(state: &AppState, directory: &str) -> Result<PathBuf, &'static str> {
    let dir = PathBuf::from(directory);
    if !dir.is_dir() {
        return Err("invalid_directory");
    }
    let base = resolved_knowledge_dir(state);
    let canonical_base = base.canonicalize().map_err(|_| "outside_worktree")?;
    let canonical_dir = dir.canonicalize().map_err(|_| "outside_worktree")?;
    if !canonical_dir.starts_with(&canonical_base) {
        return Err("outside_worktree");
    }
    Ok(canonical_dir)
}

fn read_metadata(dir: &Path) -> Value {
    std::fs::read(dir.join(".owx-project.json"))
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
        .unwrap_or_else(|| json!({}))
}

/// 原子寫入中繼資料（暫存檔 + rename），避免半寫入損毀。
fn write_metadata(dir: &Path, meta: &Value) -> Result<(), &'static str> {
    let text = serde_json::to_string_pretty(meta).map_err(|_| "write_failed")?;
    let target = dir.join(".owx-project.json");
    let tmp = dir.join(format!(".owx-project.json.{}.tmp", now_millis()));
    std::fs::write(&tmp, text.as_bytes()).map_err(|_| "write_failed")?;
    std::fs::rename(&tmp, &target).map_err(|_| "write_failed")?;
    Ok(())
}

/// 讀取規範目錄（僅識別資料）；缺檔／格式錯誤 → 空清單（降級，不整體失敗）。
fn read_standard_catalog(state: &AppState) -> Value {
    std::fs::read(&state.standard_file)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
        .map(|value| {
            if value.get("categories").is_some() {
                value
            } else {
                json!({ "categories": [] })
            }
        })
        .unwrap_or_else(|| json!({ "categories": [] }))
}

#[derive(serde::Deserialize)]
pub struct ProjectGetQuery {
    directory: String,
}

/// `GET /rpc/project/get`
pub async fn rpc_project_get(
    State(state): State<AppState>,
    Query(query): Query<ProjectGetQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let dir = require_in_knowledge_dir(&state, &query.directory)
        .map_err(|code| fail(StatusCode::BAD_REQUEST, code))?;
    let mut meta = read_metadata(&dir);
    if !meta.is_object() {
        meta = json!({});
    }
    deep_fill(&mut meta, &project_defaults());
    if let Some(object) = meta.as_object_mut() {
        object.insert("worktree".into(), json!(dir.to_string_lossy()));
    }
    Ok(Json(meta))
}

#[derive(serde::Deserialize)]
pub struct UpdateBody {
    directory: String,
    patch: Value,
}

/// `POST /rpc/project/update`
pub async fn rpc_project_update(
    State(state): State<AppState>,
    Json(body): Json<UpdateBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let dir = require_in_knowledge_dir(&state, &body.directory)
        .map_err(|code| fail(StatusCode::BAD_REQUEST, code))?;
    if !body.patch.is_object() {
        return Err(fail(StatusCode::BAD_REQUEST, "invalid_patch"));
    }
    validate_patch(&body.patch).map_err(|code| fail(StatusCode::BAD_REQUEST, code))?;

    let mut meta = read_metadata(&dir);
    if !meta.is_object() {
        meta = json!({});
    }
    // `slug`／`id`／`created` 不可由 patch 變更。
    let mut patch = body.patch.clone();
    if let Some(object) = patch.as_object_mut() {
        object.remove("slug");
        object.remove("id");
        object.remove("created");
    }
    deep_overlay(&mut meta, &patch);
    deep_fill(&mut meta, &project_defaults());

    let base_dirs = side_effects_base_dirs(&dir, &meta);
    let compliance_copied = side_effects_compliance(&state, &dir, &meta);

    write_metadata(&dir, &meta).map_err(|code| fail(StatusCode::INTERNAL_SERVER_ERROR, code))?;

    if let Some(object) = meta.as_object_mut() {
        object.insert("worktree".into(), json!(dir.to_string_lossy()));
        object.insert(
            "applied".into(),
            json!({ "base_dirs": base_dirs, "compliance_copied": compliance_copied }),
        );
    }
    Ok(Json(meta))
}

/// 若 `base_dirs.enabled`，冪等建立清單中的子目錄；回傳實際新建者。
fn side_effects_base_dirs(dir: &Path, meta: &Value) -> Vec<String> {
    let mut created = Vec::new();
    let enabled = meta
        .pointer("/base_dirs/enabled")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    if !enabled {
        return created;
    }
    if let Some(dirs) = meta.pointer("/base_dirs/dirs").and_then(Value::as_array) {
        for entry in dirs {
            let Some(name) = entry.as_str() else { continue };
            let Ok(target) = safe_join(dir, name) else {
                continue;
            };
            if !target.exists() && std::fs::create_dir_all(&target).is_ok() {
                created.push(name.to_string());
            }
        }
    }
    created
}

/// 依 `writing_standard.compliance[]`，自規範樣本目錄抄錄 `<id>.md`（冪等；僅識別資料）。
fn side_effects_compliance(state: &AppState, dir: &Path, meta: &Value) -> Vec<String> {
    let mut copied = Vec::new();
    let Some(ids) = meta
        .pointer("/writing_standard/compliance")
        .and_then(Value::as_array)
    else {
        return copied;
    };
    let sample_standards = state.sample_dir.join("standards");
    for entry in ids {
        let Some(id) = entry.as_str() else { continue };
        if id.is_empty() || id.contains('/') || id.contains("..") {
            continue;
        }
        let source = sample_standards.join(format!("{id}.md"));
        let Ok(dest) = safe_join(dir, &format!("standards/{id}.md")) else {
            continue;
        };
        if dest.exists() {
            continue;
        }
        if let Ok(bytes) = std::fs::read(&source) {
            if let Some(parent) = dest.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            if std::fs::write(&dest, bytes).is_ok() {
                copied.push(id.to_string());
            }
        }
    }
    copied
}

/// `GET /rpc/standards/list`
pub async fn rpc_standards_list(State(state): State<AppState>) -> Json<Value> {
    Json(read_standard_catalog(&state))
}

/// `GET /rpc/project/base-dirs`
pub async fn rpc_project_base_dirs(State(state): State<AppState>) -> Json<Value> {
    let mut mapping = serde_json::Map::new();
    for property in PROPERTIES {
        let Some((sample_ref, _)) = builtin_base_dirs(property) else {
            continue;
        };
        mapping.insert(
            property.to_string(),
            json!({ "sample_ref": sample_ref, "dirs": template_dirs(&state, property) }),
        );
    }
    Json(json!({ "base_dirs": mapping, "properties": PROPERTIES }))
}

/// 解析專案屬性的建議基礎目錄：`owx-sample/base-dirs/<ref>.json` 優先，缺檔／格式錯誤時用內建預設。
fn template_dirs(state: &AppState, property: &str) -> Vec<String> {
    let Some((sample_ref, fallback)) = builtin_base_dirs(property) else {
        return Vec::new();
    };
    let sample_file = state
        .sample_dir
        .join("base-dirs")
        .join(format!("{sample_ref}.json"));
    std::fs::read(&sample_file)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
        .and_then(|value| {
            value.get("dirs").and_then(Value::as_array).map(|items| {
                items
                    .iter()
                    .filter_map(Value::as_str)
                    .map(String::from)
                    .collect::<Vec<_>>()
            })
        })
        .unwrap_or_else(|| fallback.iter().map(|s| (*s).to_string()).collect())
}

fn maintained_dirs(meta: &Value) -> Vec<String> {
    meta.pointer("/base_dirs/dirs")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(String::from)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn resolve_candidates(
    state: &AppState,
    property: &str,
    meta: &Value,
    requested: Vec<String>,
) -> Vec<String> {
    if !requested.is_empty() {
        return requested;
    }
    let maintained = maintained_dirs(meta);
    if maintained.is_empty() {
        template_dirs(state, property)
    } else {
        maintained
    }
}

#[derive(serde::Deserialize)]
pub struct ApplyBaseDirsBody {
    directory: String,
    /// UI 目前顯示的清單（含未儲存的勾選）；缺省則由中繼資料／屬性範本決定。
    #[serde(default)]
    dirs: Option<Vec<String>>,
}

/// `POST /rpc/project/base-dirs/apply`
///
/// 一次性依專案屬性建立預設資料夾：**只建立缺少者**，已存在者略過，
/// 不刪除、不改名、不改寫 `.owx-project.json`（不覆蓋既有維護結果）。
pub async fn rpc_project_base_dirs_apply(
    State(state): State<AppState>,
    Json(body): Json<ApplyBaseDirsBody>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let dir = require_in_knowledge_dir(&state, &body.directory)
        .map_err(|code| fail(StatusCode::BAD_REQUEST, code))?;
    let meta = read_metadata(&dir);
    let property = meta
        .get("properties")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();

    let requested: Vec<String> = body
        .dirs
        .unwrap_or_default()
        .into_iter()
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
        .collect();

    let candidates = resolve_candidates(&state, &property, &meta, requested);

    let mut seen = std::collections::HashSet::new();
    let mut resolved = Vec::new();
    let mut created = Vec::new();
    let mut skipped = Vec::new();
    let mut failed = Vec::new();

    for name in candidates {
        if !seen.insert(name.clone()) {
            continue;
        }
        resolved.push(name.clone());
        let Ok(target) = safe_join(&dir, &name) else {
            failed.push(name);
            continue;
        };
        if target.is_dir() {
            skipped.push(name);
        } else if target.exists() {
            failed.push(name);
        } else if std::fs::create_dir_all(&target).is_ok() {
            created.push(name);
        } else {
            failed.push(name);
        }
    }

    Ok(Json(json!({
        "property": property,
        "dirs": resolved,
        "created": created,
        "skipped": skipped,
        "failed": failed,
    })))
}

#[derive(serde::Deserialize)]
pub struct StandardGetQuery {
    id: String,
}

pub async fn rpc_standards_get(
    State(state): State<AppState>,
    Query(query): Query<StandardGetQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let id = query.id.trim();
    if id.is_empty() || id.contains('/') || id.contains('\\') || id.contains("..") {
        return Err(fail(StatusCode::BAD_REQUEST, "invalid_id"));
    }
    let path = state.sample_dir.join("standards").join(format!("{id}.md"));
    let content =
        std::fs::read_to_string(&path).map_err(|_| fail(StatusCode::NOT_FOUND, "not_found"))?;
    Ok(Json(json!({ "id": id, "content": content })))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("owx-proj-{}-{}", name, now_millis()));
        std::fs::create_dir_all(&dir).expect("tmp");
        dir
    }

    fn state_with(base: &Path) -> AppState {
        AppState::default()
            .with_knowledge_dir(base.join("know"))
            .with_config_dir(base.join("cfg"))
            .with_sample_dir(base.join("sample"))
    }

    #[tokio::test]
    async fn project_get_fills_defaults() {
        let base = tmp("get");
        let know = base.join("know");
        let proj = know.join("demo");
        std::fs::create_dir_all(&proj).unwrap();
        std::fs::write(
            proj.join(".owx-project.json"),
            r#"{"id":"OWX-0001","name":"測試","slug":"demo","tags":["a"],"created":1}"#,
        )
        .unwrap();
        let state = state_with(&base);
        let got = rpc_project_get(
            State(state),
            Query(ProjectGetQuery {
                directory: proj.to_string_lossy().to_string(),
            }),
        )
        .await
        .expect("get");
        assert_eq!(got.0["name"], json!("測試"));
        assert_eq!(got.0["properties"], json!([]));
        assert_eq!(
            got.0["writing_standard"]["confidentiality_default"],
            json!("一般")
        );
        assert_eq!(got.0["params"]["autosave_minutes"], json!(10));
        let _ = std::fs::remove_dir_all(&base);
    }

    #[tokio::test]
    async fn project_update_writes_and_creates_dirs() {
        let base = tmp("update");
        let proj = base.join("know").join("demo");
        std::fs::create_dir_all(&proj).unwrap();
        std::fs::write(
            proj.join(".owx-project.json"),
            br#"{"id":"OWX-0001","name":"demo","slug":"demo","tags":[],"created":1}"#,
        )
        .unwrap();
        let state = state_with(&base);
        let patch = json!({
            "name": "研究計畫",
            "properties": ["研究專案"],
            "tags": ["r", "d"],
            "base_dirs": { "sample_ref": "base-dirs/research", "enabled": true, "dirs": ["research", "skills"] },
            "writing_standard": { "confidentiality_default": "機密" },
            "params": { "autosave_minutes": 15 }
        });
        let got = rpc_project_update(
            State(state),
            Json(UpdateBody {
                directory: proj.to_string_lossy().to_string(),
                patch,
            }),
        )
        .await
        .expect("update");
        assert_eq!(got.0["name"], json!("研究計畫"));
        assert_eq!(got.0["properties"][0], json!("研究專案"));
        assert!(proj.join("research").is_dir());
        assert!(proj.join("skills").is_dir());
        let stored: Value =
            serde_json::from_slice(&std::fs::read(proj.join(".owx-project.json")).unwrap())
                .unwrap();
        assert_eq!(stored["params"]["autosave_minutes"], json!(15));
        assert_eq!(
            stored["writing_standard"]["confidentiality_default"],
            json!("機密")
        );
        // id 不可由 patch 變更
        assert_eq!(stored["id"], json!("OWX-0001"));
        let _ = std::fs::remove_dir_all(&base);
    }

    #[tokio::test]
    async fn project_update_rejects_invalid() {
        let base = tmp("invalid");
        let proj = base.join("know").join("demo");
        std::fs::create_dir_all(&proj).unwrap();
        let state = state_with(&base);
        let directory = proj.to_string_lossy().to_string();

        let bad_property = rpc_project_update(
            State(state.clone()),
            Json(UpdateBody {
                directory: directory.clone(),
                patch: json!({ "properties": ["不存在"] }),
            }),
        )
        .await
        .expect_err("bad property");
        assert_eq!(bad_property.0, StatusCode::BAD_REQUEST);

        let cross_group = rpc_project_update(
            State(state.clone()),
            Json(UpdateBody {
                directory: directory.clone(),
                patch: json!({ "properties": ["系統開發文件", "公司手冊"] }),
            }),
        )
        .await
        .expect_err("cross group");
        assert_eq!(cross_group.0, StatusCode::BAD_REQUEST);

        let bad_autosave = rpc_project_update(
            State(state.clone()),
            Json(UpdateBody {
                directory: directory.clone(),
                patch: json!({ "params": { "autosave_minutes": 999 } }),
            }),
        )
        .await
        .expect_err("bad autosave");
        assert_eq!(bad_autosave.0, StatusCode::BAD_REQUEST);

        let _ = std::fs::remove_dir_all(&base);
    }

    #[tokio::test]
    async fn standards_list_missing_file_is_empty() {
        let base = tmp("std");
        let state = state_with(&base);
        let got = rpc_standards_list(State(state)).await;
        assert_eq!(got.0["categories"], json!([]));
        let _ = std::fs::remove_dir_all(&base);
    }

    #[tokio::test]
    async fn base_dirs_contains_research() {
        let base = tmp("basedirs");
        let state = state_with(&base);
        let got = rpc_project_base_dirs(State(state)).await;
        assert_eq!(
            got.0["base_dirs"]["研究專案"]["sample_ref"],
            json!("research")
        );
        assert_eq!(got.0["base_dirs"]["研究專案"]["dirs"][0], json!("research"));
        let _ = std::fs::remove_dir_all(&base);
    }

    #[tokio::test]
    async fn base_dirs_apply_creates_missing_and_skips_existing() {
        let base = tmp("apply");
        let proj = base.join("know").join("demo");
        std::fs::create_dir_all(proj.join("research")).unwrap();
        std::fs::write(proj.join("research/keep.md"), "keep").unwrap();
        std::fs::write(proj.join("data"), "occupied").unwrap();
        std::fs::write(
            proj.join(".owx-project.json"),
            r#"{"id":"OWX-0001","name":"demo","properties":["研究專案"],"base_dirs":{"sample_ref":"research","enabled":true,"dirs":["research","notes","literature","data"]}}"#,
        )
        .unwrap();
        let state = state_with(&base);
        let got = rpc_project_base_dirs_apply(
            State(state),
            Json(ApplyBaseDirsBody {
                directory: proj.to_string_lossy().to_string(),
                dirs: None,
            }),
        )
        .await
        .expect("apply");
        assert_eq!(got.0["property"], json!("研究專案"));
        assert_eq!(got.0["created"], json!(["notes", "literature"]));
        assert_eq!(got.0["skipped"], json!(["research"]));
        assert_eq!(got.0["failed"], json!(["data"]));
        assert!(proj.join("notes").is_dir());
        assert_eq!(
            std::fs::read_to_string(proj.join("research/keep.md")).unwrap(),
            "keep"
        );
        assert_eq!(
            std::fs::read_to_string(proj.join("data")).unwrap(),
            "occupied"
        );
        let _ = std::fs::remove_dir_all(&base);
    }

    #[tokio::test]
    async fn base_dirs_apply_uses_body_list_over_stored_dirs() {
        let base = tmp("applybody");
        let proj = base.join("know").join("demo");
        std::fs::create_dir_all(&proj).unwrap();
        std::fs::write(
            proj.join(".owx-project.json"),
            r#"{"id":"OWX-0001","name":"demo","properties":["一般報告"],"base_dirs":{"sample_ref":"report","enabled":false,"dirs":["drafts"]}}"#,
        )
        .unwrap();
        let state = state_with(&base);
        let got = rpc_project_base_dirs_apply(
            State(state),
            Json(ApplyBaseDirsBody {
                directory: proj.to_string_lossy().to_string(),
                dirs: Some(vec!["reports".into(), "reports".into(), "".into()]),
            }),
        )
        .await
        .expect("apply");
        assert_eq!(got.0["dirs"], json!(["reports"]));
        assert_eq!(got.0["created"], json!(["reports"]));
        assert!(proj.join("reports").is_dir());
        assert!(!proj.join("drafts").exists());
        let _ = std::fs::remove_dir_all(&base);
    }

    #[tokio::test]
    async fn base_dirs_apply_rejects_directory_outside_knowledge() {
        let base = tmp("applyout");
        let outside = base.join("outside");
        std::fs::create_dir_all(&outside).unwrap();
        let state = state_with(&base);
        let err = rpc_project_base_dirs_apply(
            State(state),
            Json(ApplyBaseDirsBody {
                directory: outside.to_string_lossy().to_string(),
                dirs: None,
            }),
        )
        .await
        .expect_err("outside");
        assert_eq!(err.0, StatusCode::BAD_REQUEST);
        let _ = std::fs::remove_dir_all(&base);
    }

    #[tokio::test]
    async fn standards_get_reads_doc_and_rejects_bad_id() {
        let base = tmp("stdget");
        let sample = base.join("sample");
        std::fs::create_dir_all(sample.join("standards")).unwrap();
        std::fs::write(sample.join("standards/ISO-27001.md"), "# ISO\nhi").unwrap();
        let state = state_with(&base);
        let got = rpc_standards_get(
            State(state.clone()),
            Query(StandardGetQuery {
                id: "ISO-27001".into(),
            }),
        )
        .await
        .expect("get");
        assert_eq!(got.0["content"], json!("# ISO\nhi"));

        let missing = rpc_standards_get(
            State(state.clone()),
            Query(StandardGetQuery { id: "nope".into() }),
        )
        .await
        .expect_err("missing");
        assert_eq!(missing.0, StatusCode::NOT_FOUND);

        let bad = rpc_standards_get(
            State(state),
            Query(StandardGetQuery {
                id: "../secret".into(),
            }),
        )
        .await
        .expect_err("bad id");
        assert_eq!(bad.0, StatusCode::BAD_REQUEST);
        let _ = std::fs::remove_dir_all(&base);
    }
}

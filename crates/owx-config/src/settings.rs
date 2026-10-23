//! owx UI／系統設定（持久化於 config dir 的 `settings.json`）。
//!
//! 設定分為全域（`global`）與個人（`personal`）兩層；未知鍵**刻意忽略**
//! （不設 `deny_unknown_fields`），以維持向前相容：舊版程式讀到新版寫入的
//! 額外欄位時不應失敗。

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// 全域（系統層級）設定。
///
/// 未知鍵刻意忽略（向前相容）。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GlobalSettings {
    /// 系統顯示名稱（預設 `"owx"`）。
    pub system_name: String,
    /// 知識根目錄覆寫；`None` 表示沿用 boundary 的預設。
    pub knowledge_root: Option<String>,
    /// 標誌檔名（位於 config dir 內，如 `"logo.png"`）。
    pub logo: Option<String>,
    /// 主色（`#rrggbb`）。
    pub accent: Option<String>,
    /// 預設 provider id。
    pub default_provider_id: Option<String>,
    /// 預設 model id。
    pub default_model_id: Option<String>,
    /// 預設 agent。
    pub default_agent: Option<String>,
}

impl Default for GlobalSettings {
    fn default() -> Self {
        Self {
            system_name: "owx".to_string(),
            knowledge_root: None,
            logo: None,
            accent: None,
            default_provider_id: None,
            default_model_id: None,
            default_agent: None,
        }
    }
}

/// 個人（使用者層級）設定。
///
/// 未知鍵刻意忽略（向前相容）。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct PersonalSettings {
    /// 佈景主題。
    pub theme: Theme,
}

/// 佈景主題。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    /// 跟隨系統。
    #[default]
    System,
    /// 淺色。
    Light,
    /// 深色。
    Dark,
}

/// owx UI／系統設定根。
///
/// 未知鍵刻意忽略（向前相容）。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    /// 全域設定。
    pub global: GlobalSettings,
    /// 個人設定。
    pub personal: PersonalSettings,
}

impl Settings {
    /// 讀取 `<dir>/settings.json`；檔案不存在或無法解析時回傳預設值（永不 panic）。
    pub fn load(dir: &Path) -> Settings {
        std::fs::read_to_string(dir.join("settings.json"))
            .ok()
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or_default()
    }

    /// 將設定以 pretty JSON 寫入 `<dir>/settings.json`（必要時建立目錄）。
    pub fn save(&self, dir: &Path) -> std::io::Result<()> {
        std::fs::create_dir_all(dir)?;
        let text = serde_json::to_string_pretty(self)
            .map_err(|err| std::io::Error::other(err.to_string()))?;
        std::fs::write(dir.join("settings.json"), text)
    }

    /// 驗證設定；目前僅檢查 `global.accent` 格式（`#rrggbb`）。
    pub fn validate(&self) -> Result<(), String> {
        if let Some(accent) = &self.global.accent {
            if !is_valid_accent(accent) {
                return Err("invalid_accent".to_string());
            }
        }
        Ok(())
    }
}

/// 解析 owx config dir：`OWX_CONFIG_DIR` → `$XDG_CONFIG_HOME/owx` → `$HOME/.config/owx`。
pub fn config_dir() -> PathBuf {
    config_dir_from(
        std::env::var("OWX_CONFIG_DIR").ok().as_deref(),
        std::env::var("XDG_CONFIG_HOME").ok().as_deref(),
        std::env::var("HOME").ok().as_deref(),
    )
}

/// `config_dir` 的可測試核心（避免測試改動全域環境變數）。
fn config_dir_from(owx: Option<&str>, xdg: Option<&str>, home: Option<&str>) -> PathBuf {
    if let Some(dir) = owx.filter(|value| !value.is_empty()) {
        return PathBuf::from(dir);
    }
    if let Some(dir) = xdg.filter(|value| !value.is_empty()) {
        return PathBuf::from(dir).join("owx");
    }
    let home = home.filter(|value| !value.is_empty()).unwrap_or(".");
    PathBuf::from(home).join(".config").join("owx")
}

/// 檢查 `#rrggbb` 格式（`^#[0-9a-fA-F]{6}$`）。
fn is_valid_accent(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 7 && bytes[0] == b'#' && bytes[1..].iter().all(u8::is_ascii_hexdigit)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "owx-settings-{}-{}",
            name,
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        std::fs::create_dir_all(&dir).expect("tmp");
        dir
    }

    #[test]
    fn defaults_are_expected() {
        let settings = Settings::default();
        assert_eq!(settings.global.system_name, "owx");
        assert_eq!(settings.personal.theme, Theme::System);
        assert!(settings.global.knowledge_root.is_none());
        assert!(settings.global.logo.is_none());
        assert!(settings.global.accent.is_none());
        assert!(settings.global.default_provider_id.is_none());
        assert!(settings.global.default_model_id.is_none());
        assert!(settings.global.default_agent.is_none());
    }

    #[test]
    fn save_load_roundtrip_preserves_values() {
        let dir = tmp("roundtrip");
        let mut settings = Settings::default();
        settings.global.system_name = "acme".to_string();
        settings.global.knowledge_root = Some("/data/knowledge".to_string());
        settings.global.accent = Some("#034cff".to_string());
        settings.global.default_agent = Some("general".to_string());
        settings.personal.theme = Theme::Dark;
        settings.save(&dir).expect("save");
        let loaded = Settings::load(&dir);
        assert_eq!(loaded, settings);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn load_missing_dir_returns_default() {
        let dir = tmp("missing").join("nested");
        assert_eq!(Settings::load(&dir), Settings::default());
    }

    #[test]
    fn load_corrupt_json_returns_default() {
        let dir = tmp("corrupt");
        std::fs::write(dir.join("settings.json"), b"{ not json").expect("write");
        assert_eq!(Settings::load(&dir), Settings::default());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn unknown_keys_are_ignored() {
        let dir = tmp("unknown");
        std::fs::write(
            dir.join("settings.json"),
            br#"{"global":{"systemName":"x","futureKey":1},"personal":{"theme":"light"}}"#,
        )
        .expect("write");
        let loaded = Settings::load(&dir);
        assert_eq!(loaded.global.system_name, "x");
        assert_eq!(loaded.personal.theme, Theme::Light);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn validate_rejects_bad_accents() {
        for bad in ["red", "#fff", "#12345", "#gggggg", ""] {
            let mut settings = Settings::default();
            settings.global.accent = Some(bad.to_string());
            assert_eq!(settings.validate(), Err("invalid_accent".to_string()));
        }
    }

    #[test]
    fn validate_accepts_good_accent() {
        let mut settings = Settings::default();
        settings.global.accent = Some("#034cff".to_string());
        assert_eq!(settings.validate(), Ok(()));
        settings.global.accent = Some("#ABCDEF".to_string());
        assert_eq!(settings.validate(), Ok(()));
        settings.global.accent = None;
        assert_eq!(settings.validate(), Ok(()));
    }

    #[test]
    fn config_dir_precedence() {
        assert_eq!(
            config_dir_from(Some("/custom"), Some("/xdg"), Some("/home/u")),
            PathBuf::from("/custom")
        );
        assert_eq!(
            config_dir_from(None, Some("/xdg"), Some("/home/u")),
            PathBuf::from("/xdg/owx")
        );
        assert_eq!(
            config_dir_from(None, None, Some("/home/u")),
            PathBuf::from("/home/u/.config/owx")
        );
        assert_eq!(
            config_dir_from(None, None, None),
            PathBuf::from("./.config/owx")
        );
        assert_eq!(
            config_dir_from(Some(""), Some(""), Some("")),
            PathBuf::from("./.config/owx")
        );
    }
}

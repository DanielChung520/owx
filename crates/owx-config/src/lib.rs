//! owx 設定分層與 profile 解析（FR-F）＋ UI／系統設定（FR-H-27/28）。

pub mod settings;

pub use settings::{config_dir, GlobalSettings, PersonalSettings, Settings, Theme};

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::PathBuf;

/// 分層設定（未知鍵拒絕）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub struct Config {
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub agent: BTreeMap<String, AgentConfig>,
}

/// 單一 agent 的設定。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub struct AgentConfig {
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub prompt: Option<String>,
}

/// 設定錯誤。
#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    /// 設定內容不合法（含未知鍵）。
    #[error("invalid config: {0}")]
    Invalid(String),
}

impl Config {
    /// 由 JSON 解析；未知鍵為錯誤（FR-F-1 hard-fail）。
    pub fn from_json(text: &str) -> Result<Self, ConfigError> {
        serde_json::from_str(text).map_err(|e| ConfigError::Invalid(e.to_string()))
    }

    /// 以 `over` 覆蓋 `self`（後者優先）。
    pub fn merged_with(&self, over: &Config) -> Config {
        let mut out = self.clone();
        if over.model.is_some() {
            out.model = over.model.clone();
        }
        for (name, agent) in &over.agent {
            let merged = match out.agent.get(name) {
                Some(base) => base.overlay(agent),
                None => agent.clone(),
            };
            out.agent.insert(name.clone(), merged);
        }
        out
    }
}

impl AgentConfig {
    fn overlay(&self, over: &AgentConfig) -> AgentConfig {
        AgentConfig {
            model: over.model.clone().or_else(|| self.model.clone()),
            prompt: over.prompt.clone().or_else(|| self.prompt.clone()),
        }
    }
}

/// 依序深合併多層（越後面優先；如 global → project → inline）。
pub fn merge_layers(layers: &[Config]) -> Config {
    layers
        .iter()
        .cloned()
        .fold(Config::default(), |acc, layer| acc.merged_with(&layer))
}

/// 帳號 profile。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Profile {
    pub name: String,
    pub worktree: PathBuf,
    pub port: u16,
    pub data_dir: PathBuf,
    pub config_dir: PathBuf,
}

/// 五根隔離路徑（FR-F-3）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Roots {
    pub data: PathBuf,
    pub config: PathBuf,
    pub state: PathBuf,
    pub tmp: PathBuf,
    pub cache: PathBuf,
}

impl Profile {
    /// 由 profile 推導五根（data/config 為權威；state/tmp/cache 置於 data 下）。
    pub fn roots(&self) -> Roots {
        Roots {
            data: self.data_dir.clone(),
            config: self.config_dir.clone(),
            state: self.data_dir.join("state"),
            tmp: self.data_dir.join("tmp"),
            cache: self.data_dir.join("cache"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_minimal_config() {
        let cfg = Config::from_json(r#"{"model":"a/b"}"#).expect("parse");
        assert_eq!(cfg.model.as_deref(), Some("a/b"));
        assert!(cfg.agent.is_empty());
    }

    #[test]
    fn rejects_unknown_key() {
        let err = Config::from_json(r#"{"nope":1}"#);
        assert!(matches!(err, Err(ConfigError::Invalid(_))));
    }

    #[test]
    fn rejects_unknown_agent_key() {
        let err = Config::from_json(r#"{"agent":{"x":{"weird":true}}}"#);
        assert!(matches!(err, Err(ConfigError::Invalid(_))));
    }

    #[test]
    fn project_overrides_global_model() {
        let global = Config::from_json(r#"{"model":"g/1"}"#).unwrap();
        let project = Config::from_json(r#"{"model":"p/2"}"#).unwrap();
        assert_eq!(global.merged_with(&project).model.as_deref(), Some("p/2"));
    }

    #[test]
    fn absent_override_keeps_base() {
        let global = Config::from_json(r#"{"model":"g/1"}"#).unwrap();
        let project = Config::from_json(r#"{}"#).unwrap();
        assert_eq!(global.merged_with(&project).model.as_deref(), Some("g/1"));
    }

    #[test]
    fn agent_maps_merge_per_key() {
        let base = Config::from_json(r#"{"agent":{"a":{"model":"m/1"}}}"#).unwrap();
        let over =
            Config::from_json(r#"{"agent":{"a":{"prompt":"hi"},"b":{"model":"m/2"}}}"#).unwrap();
        let merged = base.merged_with(&over);
        assert_eq!(merged.agent["a"].model.as_deref(), Some("m/1"));
        assert_eq!(merged.agent["a"].prompt.as_deref(), Some("hi"));
        assert_eq!(merged.agent["b"].model.as_deref(), Some("m/2"));
    }

    #[test]
    fn merge_layers_orders_precedence() {
        let a = Config::from_json(r#"{"model":"a"}"#).unwrap();
        let b = Config::from_json(r#"{"model":"b"}"#).unwrap();
        let c = Config::from_json(r#"{"model":"c"}"#).unwrap();
        assert_eq!(merge_layers(&[a, b, c]).model.as_deref(), Some("c"));
    }

    #[test]
    fn profile_roots_are_distinct_and_stable() {
        let p = Profile {
            name: "demo".into(),
            worktree: PathBuf::from("/wt/demo"),
            port: 4097,
            data_dir: PathBuf::from("/data/demo"),
            config_dir: PathBuf::from("/cfg/demo"),
        };
        let r = p.roots();
        assert_eq!(r.data, PathBuf::from("/data/demo"));
        assert_eq!(r.config, PathBuf::from("/cfg/demo"));
        assert_eq!(r.state, PathBuf::from("/data/demo/state"));
        assert_eq!(r.tmp, PathBuf::from("/data/demo/tmp"));
        assert_eq!(r.cache, PathBuf::from("/data/demo/cache"));
        assert_ne!(r.data, r.config);
    }
}

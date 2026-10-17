//! owx Harness 核心型別與決策（無 I/O）。
//!
//! 佈局見 `docs/design/harness-architecture.md`；邊界決策見
//! `docs/adr/ADR-0004-harness-opencode-boundary.md`；契約見
//! `docs/design/interfaces.md`。本 crate 為骨架階段最小版，只含 hook 決策模型。

use serde::{Deserialize, Serialize};

/// 進入 sidecar 的 hook 呼叫（thin shim → sidecar）。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HookRequest {
    /// hook 名稱，例如 `"tool.execute.before"`。
    pub hook: String,
    /// 原始 payload；結構依 hook 而異，骨架階段維持為任意 JSON。
    pub payload: serde_json::Value,
}

impl HookRequest {
    /// 建立請求。
    pub fn new(hook: impl Into<String>, payload: serde_json::Value) -> Self {
        Self {
            hook: hook.into(),
            payload,
        }
    }
}

/// sidecar 對 hook 的決策回覆。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "decision", rename_all = "snake_case")]
pub enum HookDecision {
    /// 放行。
    Allow,
    /// 阻擋，附原因。
    Block {
        /// 阻擋原因（給 agent／使用者）。
        reason: String,
    },
    /// 放行但改寫 payload（骨架階段保留，尚未套用）。
    Rewrite {
        /// 改寫後的 payload。
        payload: serde_json::Value,
    },
}

impl HookDecision {
    /// 是否為阻擋。
    pub fn is_blocked(&self) -> bool {
        matches!(self, HookDecision::Block { .. })
    }
}

/// Harness 錯誤分類。
#[derive(Debug, thiserror::Error)]
pub enum HarnessError {
    /// 請求格式不合法。
    #[error("invalid hook request: {0}")]
    InvalidRequest(String),
    /// 未支援的 hook 名稱。
    #[error("unhandled hook: {0}")]
    UnhandledHook(String),
    /// I/O 錯誤。
    #[error("i/o error: {0}")]
    Io(#[from] std::io::Error),
}

/// 決策核心（骨架階段）。
///
/// 目前僅實作 `tool.execute.before` → 一律 `Allow`；其餘 hook 回
/// [`HarnessError::UnhandledHook`]，由呼叫端以 fail-open 處理。
pub fn decide(req: &HookRequest) -> Result<HookDecision, HarnessError> {
    match req.hook.as_str() {
        "tool.execute.before" => Ok(HookDecision::Allow),
        other => Err(HarnessError::UnhandledHook(other.to_string())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hook_request_json_roundtrip() {
        let req = HookRequest::new("tool.execute.before", serde_json::json!({ "tool": "read" }));
        let text = serde_json::to_string(&req).expect("serialize");
        let back: HookRequest = serde_json::from_str(&text).expect("deserialize");
        assert_eq!(req, back);
    }

    #[test]
    fn allow_decision_serializes_with_tag() {
        let text = serde_json::to_value(HookDecision::Allow).expect("serialize");
        assert_eq!(text, serde_json::json!({ "decision": "allow" }));
    }

    #[test]
    fn decide_allows_tool_execute_before() {
        let req = HookRequest::new("tool.execute.before", serde_json::Value::Null);
        assert_eq!(decide(&req).expect("decide"), HookDecision::Allow);
    }

    #[test]
    fn decide_rejects_unhandled_hook() {
        let req = HookRequest::new("nope", serde_json::Value::Null);
        assert!(matches!(decide(&req), Err(HarnessError::UnhandledHook(_))));
    }

    #[test]
    fn block_decision_is_blocked() {
        assert!(HookDecision::Block { reason: "x".into() }.is_blocked());
        assert!(!HookDecision::Allow.is_blocked());
    }
}

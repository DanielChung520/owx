//! owx session 參考與工作計畫（boulder）狀態（FR-C-5 / FR-D）。
//!
//! 注意（ADR-0004 / interfaces.md §7）：opencode 擁有訊息/session 儲存；本 crate
//! 只持有 harness 自有的**政策與 boulder 進度**，以 session id 為鍵，不複製歷史。

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// session 參考（含父 session）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SessionRef {
    pub id: String,
    pub parent: Option<String>,
}

/// 工作計畫中的單一步驟。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BoulderEntry {
    pub step: String,
    pub verified: bool,
}

/// 跨 session 保存的已驗證進度（FR-C-5）。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct BoulderState {
    entries: Vec<BoulderEntry>,
}

impl BoulderState {
    /// 記錄一步；同 step 覆寫（保留最新）。
    pub fn record(&mut self, step: impl Into<String>, verified: bool) {
        let step = step.into();
        match self.entries.iter_mut().find(|e| e.step == step) {
            Some(entry) => entry.verified = verified,
            None => self.entries.push(BoulderEntry { step, verified }),
        }
    }

    pub fn is_verified(&self, step: &str) -> bool {
        self.entries
            .iter()
            .find(|e| e.step == step)
            .is_some_and(|e| e.verified)
    }

    pub fn verified_steps(&self) -> Vec<&str> {
        self.entries
            .iter()
            .filter(|e| e.verified)
            .map(|e| e.step.as_str())
            .collect()
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}

/// 以 session id 為鍵的 boulder 儲存。
#[derive(Debug, Clone, Default)]
pub struct SessionStore {
    boulders: BTreeMap<String, BoulderState>,
}

impl SessionStore {
    pub fn boulder_mut(&mut self, session_id: &str) -> &mut BoulderState {
        self.boulders.entry(session_id.to_string()).or_default()
    }

    pub fn boulder(&self, session_id: &str) -> Option<&BoulderState> {
        self.boulders.get(session_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn record_and_query() {
        let mut b = BoulderState::default();
        b.record("spec", true);
        b.record("impl", false);
        assert!(b.is_verified("spec"));
        assert!(!b.is_verified("impl"));
        assert!(!b.is_verified("absent"));
        assert_eq!(b.verified_steps(), vec!["spec"]);
        assert_eq!(b.len(), 2);
        assert!(!b.is_empty());
    }

    #[test]
    fn record_overwrites_same_step() {
        let mut b = BoulderState::default();
        b.record("impl", false);
        b.record("impl", true);
        assert_eq!(b.len(), 1);
        assert!(b.is_verified("impl"));
    }

    #[test]
    fn store_is_keyed_by_session() {
        let mut store = SessionStore::default();
        store.boulder_mut("s1").record("a", true);
        store.boulder_mut("s2").record("b", false);
        assert!(store.boulder("s1").unwrap().is_verified("a"));
        assert!(!store.boulder("s2").unwrap().is_verified("b"));
        assert!(store.boulder("s3").is_none());
    }

    #[test]
    fn boulder_state_roundtrips_json() {
        let mut b = BoulderState::default();
        b.record("x", true);
        let text = serde_json::to_string(&b).unwrap();
        let back: BoulderState = serde_json::from_str(&text).unwrap();
        assert_eq!(b, back);
    }
}

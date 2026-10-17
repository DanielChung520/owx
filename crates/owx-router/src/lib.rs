//! owx 模型鏈選擇政策（FR-E-2/3、FR-HAR-12/13）。
//!
//! 本 crate 只負責「鏈的表示與選擇」；實際**注入路徑**（如何把選定模型交給 opencode）
//! 見 [`ADR-0005`](../../docs/adr/ADR-0005-model-chain-injection-path.md)。

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// 有序模型鏈：primary ＋ 有序 fallback。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ModelChain {
    pub primary: String,
    pub fallbacks: Vec<String>,
}

impl ModelChain {
    pub fn new(primary: impl Into<String>, fallbacks: Vec<String>) -> Self {
        Self {
            primary: primary.into(),
            fallbacks,
        }
    }

    /// primary 起、依序 fallback。
    pub fn ordered(&self) -> Vec<&str> {
        let mut out = Vec::with_capacity(1 + self.fallbacks.len());
        out.push(self.primary.as_str());
        out.extend(self.fallbacks.iter().map(String::as_str));
        out
    }

    pub fn len(&self) -> usize {
        1 + self.fallbacks.len()
    }

    pub fn is_empty(&self) -> bool {
        false
    }

    /// reactive fallback：`current` 之後的下一個模型。
    pub fn next_after(&self, current: &str) -> Option<&str> {
        let ordered = self.ordered();
        let idx = ordered.iter().position(|m| *m == current)?;
        ordered.get(idx + 1).copied()
    }
}

/// 以 agent／category 為鍵的鏈選擇器。
#[derive(Debug, Clone, Default)]
pub struct Router {
    chains: BTreeMap<String, ModelChain>,
}

impl Router {
    pub fn set(&mut self, key: impl Into<String>, chain: ModelChain) {
        self.chains.insert(key.into(), chain);
    }

    pub fn chain_for(&self, key: &str) -> Option<&ModelChain> {
        self.chains.get(key)
    }

    pub fn primary_for(&self, key: &str) -> Option<&str> {
        self.chains.get(key).map(|c| c.primary.as_str())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ordered_is_primary_then_fallbacks() {
        let chain = ModelChain::new("a", vec!["b".into(), "c".into()]);
        assert_eq!(chain.ordered(), vec!["a", "b", "c"]);
        assert_eq!(chain.len(), 3);
    }

    #[test]
    fn next_after_walks_chain() {
        let chain = ModelChain::new("a", vec!["b".into(), "c".into()]);
        assert_eq!(chain.next_after("a"), Some("b"));
        assert_eq!(chain.next_after("b"), Some("c"));
        assert_eq!(chain.next_after("c"), None);
        assert_eq!(chain.next_after("z"), None);
    }

    #[test]
    fn single_model_chain_has_no_fallback() {
        let chain = ModelChain::new("solo", vec![]);
        assert_eq!(chain.ordered(), vec!["solo"]);
        assert_eq!(chain.next_after("solo"), None);
    }

    #[test]
    fn router_resolves_by_key() {
        let mut router = Router::default();
        router.set("research", ModelChain::new("r/1", vec!["r/2".into()]));
        assert_eq!(router.primary_for("research"), Some("r/1"));
        assert_eq!(
            router.chain_for("research").unwrap().next_after("r/1"),
            Some("r/2")
        );
        assert!(router.chain_for("absent").is_none());
    }
}

//! owx 工具註冊與政策（FR-B）。

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// 工具政策的處置。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Action {
    Allow,
    Ask,
    Deny,
}

/// 單條政策規則（pattern 為 glob）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Rule {
    pub pattern: String,
    pub action: Action,
}

impl Rule {
    pub fn new(pattern: impl Into<String>, action: Action) -> Self {
        Self {
            pattern: pattern.into(),
            action,
        }
    }
}

/// 工具政策：多規則、last-match-wins；預設 `Allow`。
#[derive(Debug, Clone, Default)]
pub struct ToolPolicy {
    rules: Vec<Rule>,
}

impl ToolPolicy {
    pub fn new(rules: Vec<Rule>) -> Self {
        Self { rules }
    }

    pub fn add(&mut self, rule: Rule) {
        self.rules.push(rule);
    }

    pub fn decide(&self, tool: &str) -> Action {
        let mut action = Action::Allow;
        for rule in &self.rules {
            if glob_match(&rule.pattern, tool) {
                action = rule.action;
            }
        }
        action
    }
}

/// 工具註冊表（可停用，FR-B-6）。
#[derive(Debug, Clone, Default)]
pub struct ToolRegistry {
    tools: BTreeMap<String, bool>,
}

impl ToolRegistry {
    pub fn register(&mut self, name: impl Into<String>) {
        self.tools.insert(name.into(), true);
    }

    pub fn disable(&mut self, name: &str) {
        if let Some(flag) = self.tools.get_mut(name) {
            *flag = false;
        }
    }

    pub fn enabled(&self, name: &str) -> bool {
        self.tools.get(name).copied().unwrap_or(false)
    }

    pub fn enabled_names(&self) -> Vec<&str> {
        self.tools
            .iter()
            .filter(|(_, enabled)| **enabled)
            .map(|(name, _)| name.as_str())
            .collect()
    }
}

/// 簡易 glob：支援 `*`（任意序列）與 `?`（單一字元）。
pub fn glob_match(pattern: &str, input: &str) -> bool {
    fn go(p: &[char], s: &[char]) -> bool {
        match p.first() {
            None => s.is_empty(),
            Some('*') => go(&p[1..], s) || (!s.is_empty() && go(p, &s[1..])),
            Some('?') => !s.is_empty() && go(&p[1..], &s[1..]),
            Some(c) => !s.is_empty() && s[0] == *c && go(&p[1..], &s[1..]),
        }
    }
    go(
        &pattern.chars().collect::<Vec<_>>(),
        &input.chars().collect::<Vec<_>>(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn glob_literal_and_wildcards() {
        assert!(glob_match("bash", "bash"));
        assert!(!glob_match("bash", "bashful"));
        assert!(glob_match("b*", "bash"));
        assert!(glob_match("*h", "bash"));
        assert!(glob_match("b?sh", "bash"));
        assert!(glob_match("*", "anything"));
        assert!(glob_match("mcp_*", "mcp_tool"));
        assert!(!glob_match("mcp_*", "tool_mcp"));
    }

    #[test]
    fn policy_defaults_to_allow() {
        let policy = ToolPolicy::default();
        assert_eq!(policy.decide("read"), Action::Allow);
    }

    #[test]
    fn policy_matches_pattern() {
        let policy = ToolPolicy::new(vec![Rule::new("bash*", Action::Ask)]);
        assert_eq!(policy.decide("bash"), Action::Ask);
        assert_eq!(policy.decide("read"), Action::Allow);
    }

    #[test]
    fn policy_last_match_wins() {
        let policy = ToolPolicy::new(vec![
            Rule::new("*", Action::Deny),
            Rule::new("read", Action::Allow),
        ]);
        assert_eq!(policy.decide("read"), Action::Allow);
        assert_eq!(policy.decide("bash"), Action::Deny);
    }

    #[test]
    fn registry_disable_hides_from_enabled() {
        let mut reg = ToolRegistry::default();
        reg.register("read");
        reg.register("bash");
        reg.disable("bash");
        assert!(reg.enabled("read"));
        assert!(!reg.enabled("bash"));
        assert!(!reg.enabled("ghost"));
        assert_eq!(reg.enabled_names(), vec!["read"]);
    }
}

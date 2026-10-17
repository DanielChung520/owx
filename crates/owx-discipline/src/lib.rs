//! owx 紀律機制（FR-C）：doom-loop 防護、todo 狀態、意圖分類。

use serde::{Deserialize, Serialize};

/// doom-loop 防護：連續相同呼叫達門檻即觸發（FR-C-9）。
#[derive(Debug, Clone, Default)]
pub struct DoomLoopGuard {
    last: Option<String>,
    repeat: u32,
    threshold: u32,
}

impl DoomLoopGuard {
    pub fn new(threshold: u32) -> Self {
        Self {
            last: None,
            repeat: 0,
            threshold: threshold.max(1),
        }
    }

    /// 回傳 `true` 表示已達門檻（應攔截）。
    pub fn observe(&mut self, signature: &str) -> bool {
        if self.last.as_deref() == Some(signature) {
            self.repeat += 1;
        } else {
            self.last = Some(signature.to_string());
            self.repeat = 1;
        }
        self.repeat >= self.threshold
    }
}

/// todo 狀態。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TodoStatus {
    Pending,
    InProgress,
    Completed,
}

/// 單一 todo。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Todo {
    pub id: usize,
    pub text: String,
    pub status: TodoStatus,
}

/// todo 清單（FR-C-2）。
#[derive(Debug, Clone, Default)]
pub struct TodoList {
    items: Vec<Todo>,
    next_id: usize,
}

impl TodoList {
    pub fn add(&mut self, text: impl Into<String>) -> usize {
        let id = self.next_id;
        self.next_id += 1;
        self.items.push(Todo {
            id,
            text: text.into(),
            status: TodoStatus::Pending,
        });
        id
    }

    pub fn start(&mut self, id: usize) -> bool {
        self.set_status(id, TodoStatus::InProgress)
    }

    pub fn complete(&mut self, id: usize) -> bool {
        self.set_status(id, TodoStatus::Completed)
    }

    fn set_status(&mut self, id: usize, status: TodoStatus) -> bool {
        match self.items.iter_mut().find(|t| t.id == id) {
            Some(todo) => {
                todo.status = status;
                true
            }
            None => false,
        }
    }

    pub fn pending_count(&self) -> usize {
        self.items
            .iter()
            .filter(|t| t.status != TodoStatus::Completed)
            .count()
    }

    pub fn all_done(&self) -> bool {
        !self.items.is_empty() && self.items.iter().all(|t| t.status == TodoStatus::Completed)
    }

    pub fn items(&self) -> &[Todo] {
        &self.items
    }
}

/// 意圖分類結果。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Intent {
    Research,
    Implementation,
    Investigation,
    Evaluation,
    Fix,
    Unknown,
}

/// 意圖閘門：以關鍵詞啟發式分類（FR-C-1）。
pub struct IntentGate;

impl IntentGate {
    pub fn classify(prompt: &str) -> Intent {
        let p = prompt.to_lowercase();
        if contains_any(&p, &["fix", "bug", "broken", "error", "修", "錯誤", "壞"]) {
            Intent::Fix
        } else if contains_any(
            &p,
            &[
                "implement",
                "add ",
                "create",
                "build",
                "實作",
                "新增",
                "建立",
                "做一個",
            ],
        ) {
            Intent::Implementation
        } else if contains_any(
            &p,
            &[
                "explain",
                "how does",
                "why",
                "研究",
                "解釋",
                "為什麼",
                "怎麼運作",
            ],
        ) {
            Intent::Research
        } else if contains_any(&p, &["investigate", "check", "find", "查", "調查", "找"]) {
            Intent::Investigation
        } else if contains_any(
            &p,
            &[
                "think about",
                "evaluate",
                "tradeoff",
                "評估",
                "可行",
                "哪個好",
            ],
        ) {
            Intent::Evaluation
        } else {
            Intent::Unknown
        }
    }
}

fn contains_any(haystack: &str, needles: &[&str]) -> bool {
    needles.iter().any(|n| haystack.contains(n))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn doom_loop_trips_at_threshold() {
        let mut guard = DoomLoopGuard::new(3);
        assert!(!guard.observe("read:foo"));
        assert!(!guard.observe("read:foo"));
        assert!(guard.observe("read:foo"));
    }

    #[test]
    fn doom_loop_resets_on_different_signature() {
        let mut guard = DoomLoopGuard::new(2);
        assert!(!guard.observe("a"));
        assert!(!guard.observe("b"));
        assert!(guard.observe("b"));
    }

    #[test]
    fn doom_loop_threshold_min_one() {
        let mut guard = DoomLoopGuard::new(0);
        assert!(guard.observe("x"));
    }

    #[test]
    fn todo_lifecycle() {
        let mut todos = TodoList::default();
        let a = todos.add("one");
        let b = todos.add("two");
        assert_eq!(todos.pending_count(), 2);
        assert!(todos.start(a));
        assert!(todos.complete(a));
        assert!(todos.complete(b));
        assert!(todos.all_done());
        assert_eq!(todos.pending_count(), 0);
    }

    #[test]
    fn todo_complete_unknown_id_is_false() {
        let mut todos = TodoList::default();
        todos.add("one");
        assert!(!todos.complete(99));
        assert!(!todos.all_done());
    }

    #[test]
    fn todo_empty_is_not_all_done() {
        let todos = TodoList::default();
        assert!(!todos.all_done());
    }

    #[test]
    fn intent_classification() {
        assert_eq!(IntentGate::classify("please fix the bug"), Intent::Fix);
        assert_eq!(IntentGate::classify("新增一個按鈕"), Intent::Implementation);
        assert_eq!(
            IntentGate::classify("explain how X works"),
            Intent::Research
        );
        assert_eq!(IntentGate::classify("調查這個問題"), Intent::Investigation);
        assert_eq!(
            IntentGate::classify("評估這個方案可行嗎"),
            Intent::Evaluation
        );
        assert_eq!(IntentGate::classify("你好"), Intent::Unknown);
    }

    #[test]
    fn fix_takes_precedence_over_implementation_keyword() {
        assert_eq!(IntentGate::classify("fix 並新增測試"), Intent::Fix);
    }
}

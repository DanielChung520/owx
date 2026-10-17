//! owx 委派編排（FR-A、FR-HAR-1..5）的**決策**部分。
//!
//! 純決策；實際生成子 session／呼叫模型由 `owx-boundary` 對 substrate 完成。

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// category 定義（領域預設）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Category {
    pub name: String,
    pub model_chain: Vec<String>,
    pub skills: Vec<String>,
    pub allow_delegate: bool,
}

/// category 註冊表。
#[derive(Debug, Clone, Default)]
pub struct CategoryRegistry {
    categories: BTreeMap<String, Category>,
}

impl CategoryRegistry {
    pub fn register(&mut self, category: Category) {
        self.categories.insert(category.name.clone(), category);
    }

    pub fn get(&self, name: &str) -> Option<&Category> {
        self.categories.get(name)
    }
}

/// 委派請求的上下文。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DelegationRequest {
    pub depth: u32,
    pub max_depth: u32,
    pub is_worker: bool,
    pub remaining_budget: u32,
}

/// 委派拒絕原因。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DelegateError {
    UnknownCategory,
    DepthExceeded,
    WorkerCannotDelegate,
    BudgetExhausted,
}

/// 委派計畫（決策結果）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DelegationPlan {
    pub category: String,
    pub model_chain: Vec<String>,
    pub skills: Vec<String>,
}

impl CategoryRegistry {
    /// 依 category 與委派上下文產生計畫，或拒絕。
    pub fn plan(
        &self,
        name: &str,
        req: DelegationRequest,
    ) -> Result<DelegationPlan, DelegateError> {
        if req.is_worker {
            return Err(DelegateError::WorkerCannotDelegate);
        }
        if req.remaining_budget == 0 {
            return Err(DelegateError::BudgetExhausted);
        }
        if req.depth >= req.max_depth {
            return Err(DelegateError::DepthExceeded);
        }
        let category = self
            .categories
            .get(name)
            .ok_or(DelegateError::UnknownCategory)?;
        Ok(DelegationPlan {
            category: category.name.clone(),
            model_chain: category.model_chain.clone(),
            skills: category.skills.clone(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn registry() -> CategoryRegistry {
        let mut reg = CategoryRegistry::default();
        reg.register(Category {
            name: "research".into(),
            model_chain: vec!["r/1".into(), "r/2".into()],
            skills: vec!["explore".into()],
            allow_delegate: false,
        });
        reg
    }

    fn ok_req() -> DelegationRequest {
        DelegationRequest {
            depth: 0,
            max_depth: 2,
            is_worker: false,
            remaining_budget: 5,
        }
    }

    #[test]
    fn plans_known_category() {
        let plan = registry().plan("research", ok_req()).expect("plan");
        assert_eq!(plan.category, "research");
        assert_eq!(plan.model_chain, vec!["r/1", "r/2"]);
        assert_eq!(plan.skills, vec!["explore"]);
    }

    #[test]
    fn rejects_unknown_category() {
        assert_eq!(
            registry().plan("ghost", ok_req()),
            Err(DelegateError::UnknownCategory)
        );
    }

    #[test]
    fn worker_cannot_delegate() {
        let req = DelegationRequest {
            is_worker: true,
            ..ok_req()
        };
        assert_eq!(
            registry().plan("research", req),
            Err(DelegateError::WorkerCannotDelegate)
        );
    }

    #[test]
    fn depth_limit_enforced() {
        let req = DelegationRequest {
            depth: 2,
            max_depth: 2,
            ..ok_req()
        };
        assert_eq!(
            registry().plan("research", req),
            Err(DelegateError::DepthExceeded)
        );
    }

    #[test]
    fn budget_exhaustion_enforced() {
        let req = DelegationRequest {
            remaining_budget: 0,
            ..ok_req()
        };
        assert_eq!(
            registry().plan("research", req),
            Err(DelegateError::BudgetExhausted)
        );
    }
}

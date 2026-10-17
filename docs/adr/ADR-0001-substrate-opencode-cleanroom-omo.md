# ADR-0001：以 opencode 為 substrate、omo 僅作 clean-room 需求來源

- **Status**：Accepted
- **Date**：2026-10-17
- **Deciders**：Daniel（專案負責人）

## Context

owx 的目標是重做一個「文件優先」的 agent 執行環境，形狀類 opencode + omo，但：

1. **職業用途限制**：owx 用於**為企業導入 AI**，交付物**不得含非正式授權程式碼**。
2. **omo（oh-my-openagent）為 SUL-1.0**（source-available，限制商用散布）——**不可進交付物**。
3. **opencode 為 MIT**——可自由重用/改/散布。
4. 需要一個成熟、領域無關的 agent substrate（session/tool/agent/permission），避免重造輪子。

## Decision

- **substrate 採用 opencode（MIT）**，以包裝/外掛方式使用，**不改其原始碼**（「包裝不擴充」）。
- **omo 僅作需求來源**：以 **clean-room**（黑箱回溯公開文件與行為）抽取功能需求，寫入 owx 規格；**harness 由 owx 原創自建**。
- **禁止**複製 omo 之原始碼、prompt、skill 文字、文件或**任何品牌名**（清單見 `scripts/cleanroom-scan.mjs`）。
- 達成機制：`AGENTS.md` §2 + [`docs/standards/governance/licensing.md`](../standards/governance/licensing.md)（PR 閘門）。

## Consequences

**正面**
- 交付物授權潔淨（僅 MIT + 自有），符合企業導入要求。
- 站在 opencode 成熟生態上，聚焦差異化（文件優先 + 統一知識圖 + 紀律）。

**負面 / 成本**
- harness 需**重工**：omo 的調校 prompt/skill **不能抄**，須自行重養（最大成本）。
- 受 substrate 能力邊界限制；跨邊界整合需以 MCP/sidecar 為之。

## Alternatives

| 方案 | 為何否決 |
|---|---|
| 直接用 omo | SUL 限制商用散布 → 不合法於企業交付 |
| fork omo 改授權 | SUL 傳染性；且構成衍生作品 → 侵權風險 |
| 完全自造（不用 opencode）| 重造 session/tool/permission 輪子，違反「不重複造輪子」且耗時 |
| 改用 Codex/pi 為 substrate | opencode 生態最成熟、MIT、且已驗證可用 |

## Refs

- `AGENTS.md` §2 §3
- `docs/spec/base-core-requirements.md`
- `docs/standards/governance/licensing.md`

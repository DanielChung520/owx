# ADR-0005：模型鏈／fallback 的注入路徑

- **Status**：Proposed（待 Daniel 拍板）
- **Date**：2026-10-17
- **Deciders**：Daniel（專案負責人）

## Context

FR-HAR-12／13 要求 harness 提供**模型鏈（primary＋有序 fallback）**與**兩套 fallback**（proactive 選鏈／reactive 復原），且此能力**源自 omo、由 harness 自建**（`base-core` §6）。

step② 的 live 驗證（[`../design/interfaces.md`](../design/interfaces.md) §7.4）發現：opencode（1.18.x）plugin hook `chat.params` 的 **output 不含 `model`**，故**無法經該 hook 換模型**。可用於影響模型的介面僅：

| 路徑 | 機制 | 限制 |
|---|---|---|
| (a) agent 設定 | opencode 設定中 `agent.<name>.model`／`model` | 靜態；每 agent 一個模型 |
| (b) server API／SDK | 建立 session／子 session 時指定模型 | harness 需驅動 session |
| (c) provider hook | `Hooks.provider` 註冊自訂 model | 需自建 provider 包裝，較重 |
| (d) `chat.params` | 只改溫度／token 等 | **不含 model（不可用）** |

## Decision（提議）

採 **(a) ＋ (b) 混合**：

- **選鏈（proactive）**：harness 依 category／agent 解析模型鏈，並以 **(a) agent 設定**落實（harness 管理 agent 定義）；主 session 模型由 agent 決定。
- **委派模型的指定**：harness 以 **(b) server API／SDK** 生成子 session 時帶入解析後的模型。
- **reactive 復原**：因無法於同一輪換模型，harness 於觀察到失敗（`event`／`tool.execute.after`）後，以**新的請求／子 session** 改用具 fallback 模型重試。
- **(c) provider hook** 保留為未來統一入口（可註冊虛擬 model）之評估項。

> 待決：上述之具體 wire（agent 設定格式、SDK 呼叫、失敗判定來源）需以 spike 驗證後定稿。

## Consequences

**正面**：不需改 opencode；模型控制落在 harness 可控的 agent 設定與 session 建立點。

**負面 / 成本**：reactive fallback 非「同輪透明重試」，而是「換模型重發」，語意與成本不同；需 harness 管理 agent 定義。

## Alternatives

| 方案 | 為何不採（或未定） |
|---|---|
| 純 (d) `chat.params` | output 無 model，不可行（已 live 驗證）|
| 純 (c) provider hook | 可行但重；且需維護 provider 包裝 |
| 完全依賴 opencode 內建 provider fallback | 僅同 model ID 的 provider fallback，非跨模型鏈 |

## Refs

- [`ADR-0004`](ADR-0004-harness-opencode-boundary.md)、[`../design/interfaces.md`](../design/interfaces.md) §7.4
- `docs/spec/base-core-requirements.md` FR-E-2／FR-E-3、FR-HAR-12／FR-HAR-13

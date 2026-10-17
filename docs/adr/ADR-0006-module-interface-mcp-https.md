# ADR-0006：模組外掛介面＝MCP / HTTPS（第一階段先不實作外掛）

- **Status**：Accepted（2026-10-17）
- **Date**：2026-10-17
- **Deciders**：Daniel（專案負責人）
- **決策原則**：一律**參照 opencode／opencode-web**；第一階段**先不實作外掛**。

## Context

D4（`AGENTS.md` §9）：外掛模組（KAC／CodeGraph／Doc-Edit／Standards）如何接入、以何介面。架構（`AGENTS.md` §3）已定模組為**獨立微服務**、核心與模組解耦（NFR-2）。opencode 生態原生支援 **MCP**。

## Decision

- 外掛模組一律以 **MCP / HTTPS** 介面接入：**MCP** 供 agent 工具呼叫、**HTTPS** 供服務呼叫。
- **第一階段先不實作任何外掛**；核心**不得依賴**特定外掛，維持可獨立交付。
- 外掛優先序（KAC vs CodeGraph）延後，需要時再定並記 ADR。

## Consequences

**正面**
- 核心可獨立交付；模組可獨立部署／替換（NFR-2）。
- 介面與 opencode 生態一致（MCP），並貼合既有 `opencode-web` MCP server 經驗。

**負面 / 成本**
- 外掛功能延後；相關 FR（Doc-Edit／Standards／KAC／CodeGraph）暫無實作。

## Alternatives

| 方案 | 為何不採 |
|---|---|
| 內嵌於核心 | 耦合、違微服務邊界與可替換性 |
| 僅 HTTPS（無 MCP）| MCP 更貼合 agent 工具呼叫，且 opencode 原生支援 |
| 其他 RPC 機制 | 非 opencode 生態既有做法（違決策原則）|

## Refs

- `AGENTS.md` §3 §9、[`ADR-0004`](ADR-0004-harness-opencode-boundary.md)
- `docs/spec/functional-spec.md` §5 邊界、NFR-2

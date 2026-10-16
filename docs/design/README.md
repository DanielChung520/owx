# owx L3 設計文件索引（docs/design）

> 版本：v0.1　|　日期：2026-10-17　|　狀態：Draft
> 來源：彙整自 [`../spec/`](../spec/)、[`../adr/`](../adr/) 與 [`../standards/document-standards.md`](../standards/document-standards.md) §4.4。

## 0. 定位與關聯

- **本檔是**：owx **L3 技術設計**文件的索引與導覽。
- **本檔不是**：需求（屬 [`../spec/`](../spec/)）、決策記錄（屬 [`../adr/`](../adr/)）或實作。
- 各設計文件遵循 [`document-standards.md`](../standards/document-standards.md) §4.4。

## 1. 分層關係

```mermaid
flowchart LR
    L1["L1 需求<br/>spec/base-core-requirements.md"] --> L2["L2 功能規格<br/>spec/functional-spec.md"]
    L2 --> L3["L3 技術設計<br/>design/*（本目錄）"]
    ADR["ADR（決策）<br/>adr/ADR-0001..0004"] -.->|依據| L3
    L3 --> L4["L4 實作與測試<br/>尚未開始"]
```

## 2. 文件清單

| 文件 | 內容 | 主要依據 |
|---|---|---|
| [harness-architecture.md](harness-architecture.md) | 分層與邊界拓撲、Rust crate 分解、執行期資料流、風險與緩解 | ADR-0004、NFR-3、FR-A／C／E |
| [interfaces.md](interfaces.md) | 邊界契約（hook RPC／MCP tools／opencode API）、內部 Rust 介面、錯誤模型 | ADR-0004、FR-G、FR-A |
| [data-and-state.md](data-and-state.md) | 資料模型（ER）、狀態機（session／委派／fallback） | FR-D、FR-A、FR-C、FR-E |
| [frontend.md](frontend.md) | React 前端：畫面、元件樹、狀態、SSE、iframe、a11y | FR-H、FR-CARRIER |
| [testing.md](testing.md) | 測試策略、FR→TC 全對映（157）、覆蓋率、TDD、clean-room 掃描、CI | AGENTS.md §5.5、coding／document／licensing |

## 3. 建議閱讀順序

1. [harness-architecture.md](harness-architecture.md)（先懂邊界與分解）
2. [interfaces.md](interfaces.md)（契約）
3. [data-and-state.md](data-and-state.md)（資料與生命週期）
4. [frontend.md](frontend.md)（UI）
5. [testing.md](testing.md)（如何驗證）

## 4. 上游與決策連結

- 需求（L1）：[`../spec/base-core-requirements.md`](../spec/base-core-requirements.md)
- 功能（L2）：[`../spec/functional-spec.md`](../spec/functional-spec.md)
- 決策（ADR）：[`ADR-0001`](../adr/ADR-0001-substrate-opencode-cleanroom-omo.md)、[`ADR-0002`](../adr/ADR-0002-iterative-spiral-workflow.md)、[`ADR-0003`](../adr/ADR-0003-harness-rust-core-react-frontend.md)、[`ADR-0004`](../adr/ADR-0004-harness-opencode-boundary.md)
- 規範：[document-standards](../standards/document-standards.md)、[coding-standards](../standards/coding-standards.md)、[licensing](../standards/governance/licensing.md)

## 5. 缺口與待決

- 皆依附 L2 的 D2–D5（[`AGENTS.md`](../../AGENTS.md) §9）；外掛模組（KAC／CodeGraph／Doc-Edit／Standards）之設計待 D2–D4 定案。
- 各設計文件內的「缺口與待決」節為權威。

## 6. 變更紀錄

| 日期 | 版本 | 變更 |
|---|---|---|
| 2026-10-17 | v0.1 | 初版：L3 設計索引（harness-architecture／interfaces／data-and-state／frontend／testing）與分層導覽。 |

# ADR-0010：文件匯入／轉換／匯出／分享由 owx harness 提供（規劃中）

- **Status**：Proposed
- **Date**：2026-10-19
- **Deciders**：Daniel（專案負責人）

## Context

Explorer 節點選單（[`ADR-0009`](ADR-0009-filetree-node-operations-via-harness.md)）須擴及 **filetree 的每個節點**，並涵蓋文件生命週期的對外/格式操作：

- **匯入**：from file（上傳本機檔案）／from Notion（**待設置 Notion API**）；
- **格式轉換**：`md → pdf`；`pdf → md`（**待評估可行性**）；
- **匯出**：to filer（載體 filer）／to Notion（待設置）；
- **分享**：產生分享連結。

**原則**：**建立文檔以 `md` 為主（可編輯）**；**匯入之任何檔案皆可**，但**非 `md` 為唯讀（不可編輯）**。

這些操作皆需後端（檔案上傳、Notion API、filer、PDF 轉換），而 opencode **無此類 API**（同 [`ADR-0008`](ADR-0008-project-lifecycle-owned-by-owx-harness.md)／[`ADR-0009`](ADR-0009-filetree-node-operations-via-harness.md)）。故由 **owx harness** 提供。

## Decision

harness（`owx-boundary`）擴充文件生命週期 RPC（**規劃中**；契約見 [`interfaces.md`](../design/interfaces.md) §2.7）：

| RPC | 用途 | 狀態 |
|---|---|---|
| `POST /rpc/import/file` | 匯入本機檔案至專案目錄（任何格式；非 md 唯讀） | 規劃 |
| `POST /rpc/import/notion` | 自 Notion 匯入 | 規劃（待 Notion API） |
| `POST /rpc/convert` | 格式轉換（`md → pdf`；`pdf → md` 待評估） | 規劃 |
| `POST /rpc/export/filer` | 匯出至載體 filer，回 URL | 規劃 |
| `POST /rpc/export/notion` | 匯出至 Notion | 規劃（待 Notion API） |
| `POST /rpc/share` | 產生分享連結 | 規劃 |

**安全/邊界**（沿用 ADR-0009）：所有 `path` 限 `directory`（worktree）之下；外部整合（Notion／filer）之憑證與端點以 config/env 注入，**不寫死**。**資源上限**：上傳／封裝預設 **50MB**（系統參數，env `OWX_MAX_UPLOAD_BYTES` 可調）。

**`md → pdf` 引擎建議**：採 **Rust 原生、MIT／Apache-2.0 授權**——`pulldown-cmark`（MIT，md 解析）＋ `printpdf`（MIT，PDF 產生），或 `typst`（Apache-2.0）；**不使用 GPL 之 `pandoc`**（授權紅線）。CJK 內容需**內嵌字型**（如 Noto，OFL）。最終選型待 spike 後定案。

**分享模型（參考 KAC `doc-server`）**：生成**分享 token**；token 帶**包含哪些文件**（`paths` 清單）與**權限（查詢／編輯，預設查詢 = `view`）**；連結含**文件 id＋token**；可**重新產生**（舊 token 失效）。

**可編輯性**：`md` 可編輯；匯入之非 `md` 檔案唯讀（前端 Preview 不提供編輯；寫入 RPC 僅接受允許之目標）。

## Consequences

**正面**
- 文件專案可**對外協作**（匯入/匯出 Notion、filer）與**交換格式**（pdf），對齊「文件開發」定位。
- 仍落於 owx 自有邊界，opencode 不擴充。

**負面 / 成本**
- 外部整合多（Notion API、filer、PDF 引擎），依賴與授權須逐一查核（PDF 函式庫授權尤須注意）。
- 轉換保真度、pdf→md 可行性與資源成本待驗證。

**風險與緩解**
- **`pdf → md` 可行性** → 先做 spike 評估（開源工具/函式庫之授權與品質）；不確定前**不承諾**。
- **外部 API 憑證** → env/config 注入；`/rpc` 授權（go-live）。
- **Notion 尚未設置** → 以 stub/501 先佔位（`501 not_configured`），不假造成功。

## Alternatives

| 方案 | 為何否決 |
|---|---|
| 前端直接轉檔/上傳 | 瀏覽器受限；外部 API 憑證不宜在前端 |
| 用 opencode API | 無匯入/匯出/轉換/分享端點 |
| 各整合各自為政（不成 harness） | 無單一邊界、難治理與稽核 |

## Refs

- `AGENTS.md` §2 §3 §10
- [`ADR-0004`](ADR-0004-harness-opencode-boundary.md)、[`ADR-0008`](ADR-0008-project-lifecycle-owned-by-owx-harness.md)、[`ADR-0009`](ADR-0009-filetree-node-operations-via-harness.md)
- [`../design/interfaces.md`](../design/interfaces.md) §2.7、[`../design/frontend.md`](../design/frontend.md) §2
- `docs/spec/base-core-requirements.md` FR-H-18、FR-H-20～22

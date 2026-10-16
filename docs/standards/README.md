# owx 開發規範總覽（docs/standards）

> 版本：v0.1　|　日期：2026-10-17　|　狀態：Draft
> 來源：改寫自 ASM 專案（`~/github/asm/docs/standards/`）之模式，依 owx（文件優先、企業交付、clean-room omo、Rust + TS + React）調整。

本目錄是 owx 團隊與 AI agent 的**強制工作規範**。規格需求見 [`../spec/`](../spec/)；架構決策見 [`../adr/`](../adr/)；專案入口見 [`../../AGENTS.md`](../../AGENTS.md)。

## 規範清單

| 分類 | 文件 | 內容 |
|---|---|---|
| 開發規範 | [coding-standards.md](coding-standards.md) | 核心哲學、版本控制、Conventional Commits、PR、測試紀律、Rust／TypeScript／React 標準、錯誤處理、效能、安全 |
| 文件標準 | [document-standards.md](document-standards.md) | 文件類型、格式、命名、版本/狀態表頭、ID 規則、可追溯性、撰寫原則 |
| 治理 | [governance/licensing.md](governance/licensing.md) | **授權潔淨（企業交付閘門）＋ clean-room 回溯流程**——owx 特有且為最高優先 |

## 適用技術棧（規範前提；⚠️ 尚未凍結，見 `AGENTS.md` §4 / §9）

**Rust**（harness 核心：cargo workspace、clippy、thiserror）× **TypeScript**（substrate 整合、前端）**strict** × **React**（聊天 UI）；外部模組以 **HTTP / MCP** 接。

## 優先順序

文件間歧異時：**`AGENTS.md` §2 授權治理 ＞ ADR ＞ 本目錄規範 ＞ 其他**。規範需修改時，先實際驗證、commit 後更新本目錄。

## 變更紀錄

| 日期 | 版本 | 變更 |
|---|---|---|
| 2026-10-17 | v0.1 | 初版：由 ASM 模式抽離並改寫為 owx 適用版本；新增 `governance/licensing.md`（授權潔淨與 clean-room 流程）。 |

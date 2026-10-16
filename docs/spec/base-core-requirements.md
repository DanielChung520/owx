# 基礎核心需求規格 v0.1（clean-room 回溯）

> 目的：把「基礎核心 = opencode + omo，以 opencode-web 為載體」的**功能需求**回溯成規格，
> 作為下一步「**調整功能**」與最終「**開發**」的輸入。
>
> 方法：**clean-room**——只讀公開文件與可觀察行為，抽取**功能需求**；
> **不**複製任何 omo 的原始碼、prompt、skill 文字、文件，也**不**沿用其品牌名。
>
> 授權狀態：`opencode` = **MIT**（可直接重用/改）；`omo` = **SUL-1.0**（**只回溯需求，不可複製**）；
> `opencode-web` = 自有（Proprietary）。

---

## 0. 範圍

| 面向 | 內容 |
|---|---|
| **IN** | 一個「agent 執行環境」的核心能力：agent 編排、工具、紀律機制、session/context、模型路由、設定隔離、擴充機制、UI、部署 |
| **OUT**（本版） | 具體的「文件優先」功能調整（下一階段做）、KAC/CodeGraph 等外掛模組、商業模式 |
| **不變量** | 授權可交付企業（僅 MIT/自有）；架構可被模組微服務擴充；以 opencode 為 substrate |

---

## 1. 系統定位（一句話）

> 一個**多 agent、有紀律的執行環境**：主 agent 透過委派（`task`）驅動專業 sub-agent，
> 以工具操作真實檔案系統，以 session 承載上下文，以設定隔離支援多帳號/多 app。

---

## 2. 架構視圖（三層）

```
┌─ 載體層（ow，自有）──────────────────────────────┐
│  CLI（profile/lock/launchd）· reverse proxy · MCP server │
└───────────────┬───────────────────────────────────┘
                │ spawn / proxy
┌─ Substrate（opencode，MIT）─────────────────────┐
│  server(HTTP+SSE) · SDK · plugin API · agents ·   │
│  tools · sessions · permissions · providers · UI   │
└───────────────┬───────────────────────────────────┘
                │ plugin（hooks）
┌─ Harness 層（omo，SUL → 僅回溯，自建）───────────┐
│  委派編排 · categories · 紀律(plan/verify/todo) ·  │
│  team mode · model fallback · skills+embedded MCP  │
└──────────────────────────────────────────────────┘
```

---

## 3. 功能需求（FR）

### FR-A｜Agent 執行與編排
- **FR-A-1** 主 agent 在 session 內執行，透過 `task` 工具**委派**給 sub-agent。
- **FR-A-2** sub-agent 可為**同步**（等待結果）或**背景**（`run_in_background`，完成後通知、可 `background_output` 取回）。
- **FR-A-3** 委派時可指定 **category**（領域預設）與 **skills**（注入知識/工具）。
- **FR-A-4** 提供**唯讀**研究型 sub-agent（探索、文件檢索、計畫諮詢、計畫審查），其工具受白名單限制（不可寫/不可再委派）。
- **FR-A-5** category worker **不可再委派**（防無限迴圈）。
- **FR-A-6**（進階）**Team Mode**：1 lead + 最多 N 成員、共享信箱、共享任務清單、可選 per-member git worktree、可選終端可視化。
- **FR-A-7** 每個 agent 有獨立 **prompt / model chain / tool policy / permission**。

### FR-B｜工具
- **FR-B-1** 檔案：讀、寫、編輯、多編輯、glob、grep、list。
- **FR-B-2** 執行：bash（含權限閘門）。
- **FR-B-3** 程式理解：LSP（診斷/定義/參考/符號/rename）、AST-grep。
- **FR-B-4** 網路：webfetch、websearch。
- **FR-B-5** 流程：todowrite、question（向使用者提問）。
- **FR-B-6** 工具可被設定**停用**（`tools: { name: false }`）。

### FR-C｜紀律機制（harness 核心價值）
- **FR-C-1** **意圖閘門**：每個 prompt 在動用工具前，先強制確認意圖/分類。
- **FR-C-2** **todo 強制**：多步任務建立 todo、逐步標記完成、閒置時再觸發續作。
- **FR-C-3** **規劃—驗證**節奏：先規劃、逐步驗證、計畫審查後才執行。
- **FR-C-4** **續作機制**（goal/continuation）：設定持久目標，session 閒置時重新注入續作提示，直到完成審計通過。
- **FR-C-5** **工作計畫狀態**（boulder）：跨 session 保存已驗證的進度記錄。
- **FR-C-6** **session 復原**：缺工具結果、thinking block 不匹配、空訊息、context 超限、JSON 解析錯誤→透明復原。

### FR-D｜Session 與上下文
- **FR-D-1** session CRUD、messages、parts、子 session、share、summarize、abort。
- **FR-D-2** 事件流（SSE）即時推送 session/訊息/權限請求等狀態。
- **FR-D-3** context 壓縮（compaction）與工具輸出截斷。
- **FR-D-4** prompt 歷史、undo/snapshot。

### FR-E｜模型與 Provider
- **FR-E-1** 多 provider、統一介面；provider 由 registry + 憑證解析。
- **FR-E-2** **模型鏈**：primary + 有序 fallback。
- **FR-E-3** **兩套 fallback**：proactive（chat params 選鏈）+ reactive（執行後失敗復原）。
- **FR-E-4** per-agent / per-category 指定 model、reasoning level、temperature、max tokens、provider options。
- **FR-E-5** 可標記 agent 為 unstable → 強制背景監控。

### FR-F｜設定與隔離
- **FR-F-1** 設定檔分層 deep-merge（project > user），未知鍵拒絕（hard-fail）。
- **FR-F-2** agent/category 可 inline 或檔案定義；prompt 可指向外部檔（`file://`）與 `prompt_append`。
- **FR-F-3** **五根隔離**：data / config / state / tmp（+ cache 可選），以 env 切換。
- **FR-F-4** **多帳號 profile**：每 profile 獨立 port / worktree / dataDir / configDir / stateDir / tmpDir / pid。
- **FR-F-5** **slug 與 token 職責分離**：真 token 只存 profile 的 `auth.json`，不進路徑/git/listing。
- **FR-F-6** env escape hatch（跳過專案設定、注入 inline config、跳過外掛等）。

### FR-G｜擴充機制
- **FR-G-1** **Plugin API（TS）**：hook 表面（event/config/chat.*/tool.execute.*/permission.ask/…）。
- **FR-G-2** **Skills**：`SKILL.md`（frontmatter: name/description/mcp/…），可嵌 MCP。
- **FR-G-3** **Commands**：slash 指令，markdown 模板 + `$ARGUMENTS`。
- **FR-G-4** **MCP**：local（stdio）與 remote（http）；支援 `{env:VAR}`/`{file:}` 插值。
- **FR-G-5** skill/command/plugin 皆有載入優先序（project > user > opencode > builtin）。

### FR-H｜UI
- **FR-H-1** TUI（終端）與 Web UI 共用同一 server。
- **FR-H-2** Web UI 為 iframe 可嵌入（供其他 app 使用）。
- **FR-H-3** 終端可視化（tmux/cmux panes）顯示背景 agent。

### FR-I｜部署與多租戶
- **FR-I-1** 內外網分離：內部 port 綁 `127.0.0.1`，對外由 reverse proxy 暴露。
- **FR-I-2** 鎖定模式：隱藏「新增專案」、攔截 `POST /project`、注入預選 worktree。
- **FR-I-3** CORS 白名單、HTTP Basic 密碼。
- **FR-I-4** 開機自啟（launchd）與 crash 重啟。

---

## 4. 非功能需求（NFR）

| 編號 | 需求 |
|---|---|
| NFR-1 | **授權可交付**：交付物僅含 MIT / 自有程式碼；SUL 元件不得進交付物 |
| NFR-2 | **可擴充**：核心以微服務/模組邊界開放外掛（KAC、CodeGraph、…） |
| NFR-3 | **不擴充 substrate 行為**：opencode 以包裝/外掛方式使用，不改其原始碼 |
| NFR-4 | **可觀測**：session/事件/權限/fallback 皆可觀察 |
| NFR-5 | **可復原**：常見失敗自動復原，不中斷長任務 |
| NFR-6 | **隔離**：帳號/app/設定/資料互不洩漏 |
| NFR-7 | **文件優先可達**：架構須能承載「以文件/知識為原生對象」（下一階段調整） |

---

## 5. 邊界

- **本核心做**：編排、工具、紀律、session、模型路由、擴充、隔離、UI。
- **本核心不做**（外掛微服務）：知識本體/GraphRAG（KAC）、code graph（CodeGraph）、文件格式引擎（Doc-Edit）、標準本體（Standards）等。

---

## 6. 來源對映與授權

| 能力群 | 主要來源 | 授權 | 處置 |
|---|---|---|---|
| FR-B 工具、FR-D session、FR-E provider、FR-G plugin/skill/MCP、FR-H UI、FR-I 部署 | **opencode** | MIT | **可重用/改/散布** |
| FR-A 委派、FR-C 紀律、FR-A-6 team mode、FR-E-2/3 fallback、skills+embedded MCP | **omo** | SUL-1.0 | **僅回溯需求，自建（Rust）** |
| 載體：CLI/proxy/MCP server、profile、lock mode、workspace、commit-doc | **opencode-web** | 自有 | 可自由改 |

---

## 7. 相對「文件優先」目標的缺口（供步驟②調整）

1. **原生對象仍是程式碼**：工具（LSP/AST/bash）偏 code；缺 doc-native 工具（md 結構編輯、版本/審核、格式無損）。
2. **紀律綁在 code 語境**：plan/verify/todo 的 prompt 需重寫為「規格/文件」語境。
3. **無統一知識圖**：缺 doc+code + 標準本體的 GraphRAG 介面（FR 需新增）。
4. **無 traceability 產出**：紀律需擴充為「需求↔文件↔測試↔實作」可證追溯。
5. **skills/commands 需重養**：現有 skills 多為 code 導向，須重建為文件/規格導向。

---

## 8. 待決（步驟②前需拍板）

1. **自建 harness 的語言/邊界**：Rust 核心 vs 沿用 opencode 的 TS plugin？ | 
2. **文件格式**：初期只 md，還是要 docx/pdf？（影響 Doc-Edit 模組）
3. **標準本體的範圍**：規格/測試/品質之外，是否納入治理/合規？
4. **優先外掛**：KAC 與 CodeGraph 誰先接？以何介面（MCP？）？
5. **可交付清單**：企業交付時，明確列出「MIT/自有」元件表（授權閘門）。

---

*本文件為 clean-room 需求追溯，不含任何 omo 之原始碼、prompt、skill、文件內容或品牌名。*

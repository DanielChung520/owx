# owx 開發規範（coding-standards.md）

> 版本：v0.1　|　日期：2026-10-17　|　狀態：Draft
> 來源：改寫自 ASM `coding-standards.md`，移植可通用部分，並對齊 owx 技術棧（Rust 核心 + TypeScript + React）。

---

## 0. 核心哲學

owx 是 AI agent 大量產出程式碼的專案：

> **人類 review 對細節已無實際驗證能力；測試是唯一的合約與驗收機制。**

規範優先序：

| 優先序 | 規範 | 說明 |
|---|---|---|
| 1 | **可測試性** | 無法測試者，等同不存在 |
| 2 | **可讀性** | 寫給未來人類（含 AI）讀，不是寫給 compiler |
| 3 | **一致性** | 遵循既有風格比「我的版本更好」重要 |
| 4 | **明確性** | magic number、隱式行為、隱藏 side effect 一律禁止 |

### 0.1 適用範圍
- **Rust**（harness 核心、MCP server、工具層）、**TypeScript**（substrate 整合、腳本）、**React**（前端）、所有設定與文件。
- 授權相關規則見 [`governance/licensing.md`](governance/licensing.md)（優先於本檔）。

### 0.2 通用指令（待程式碼落地後補實；現僅列目標）

| 指令 | 作用 |
|---|---|
| `cargo fmt --check` | Rust 格式檢查 |
| `cargo clippy --all-targets -- -D warnings` | Rust lint（警告視同錯誤）|
| `cargo test` | Rust 測試 |
| `pnpm typecheck` | TS 型別檢查（`tsc --noEmit`）|
| `pnpm test` | JS/TS 測試 |

---

## 1. 版本控制

### 1.1 策略：Trunk-based Development

| 項目 | 規則 |
|---|---|
| 主分支 | 唯一長期分支 `main`，**永遠保持可建置** |
| Feature branch | 從 `main` 開出，**壽命 ≤2 天** |
| 分支命名 | `<type>/<scope>-<short-desc>`，全小寫、連字號 |
| Merge | **Squash merge**（每 PR 一 commit 進 `main`）|
| Tag | semver：v1 前 `v0.<minor>.<patch>` |
| 重大變更 | commit footer 加 `BREAKING CHANGE: <desc>` |

### 1.2 不可破壞 trunk
- 禁止對已合入/共用分支 force-push。
- 純 spike 不進 `main`：放獨立 branch 或本機暫存。

---

## 2. Conventional Commits（強制）

```
<type>(<scope>): <subject>

<body>

<footer>
```

| 欄位 | 規則 |
|---|---|
| type | `feat`／`fix`／`refactor`／`perf`／`test`／`docs`／`chore`／`ci`／`build` |
| scope | 對應模組：`core`／`substrate`／`harness`／`web`／`mcp`／`docs`／`ci`；跨域可省略 |
| subject | ≤72 字，祈使句（"add …"），首字小寫，句末無句點 |
| body | 解釋「**為何**」，非「什麼」|
| footer | `Refs: #<issue>`／`BREAKING CHANGE:`／`Co-authored-by:` |

---

## 3. PR 規則

| 規則 | 細則 |
|---|---|
| 大小 | **≤400 行 diff**（不含 lockfile／generated）|
| 標題 | 與 squash commit 同 |
| 內容 | **What／Why／How to test／Risks** 四段必填 |
| 合入門檻 | `cargo fmt --check` + `clippy -D warnings` + `cargo test`（Rust）；`pnpm typecheck` + `pnpm test`（TS）。CI 待建。 |
| Reviewer | 自 review 為基線；關鍵領域（授權邊界、orchestrator）需人工 review |
| Force-push | 禁止 |

---

## 4. 測試紀律（強制）

### 4.1 TDD 強制
任何 PR 須含「失敗測試（紅）→ 實作（綠）→ 重構」。例外僅限純文件、純設定。

### 4.2 測試金字塔

```
        ╱ e2e ╲          15%  端到端（真實啟動服務）
       ╱───────╲
      ╱ contract ╲       20%  契約（API/MCP 邊界、schema 校對）
     ╱─────────────╲
    ╱     unit      ╲    60%  純邏輯（orchestrator、狀態轉換、parser）
   ╱─────────────────╲
  ╱  property-based    ╲  5%  變形測試
 ╱──────────────────────╲
```
- 測試依 **Given／When／Then**：一個 When 對一個測試。
- **禁止對 prompt／自然語言文字做快照或字串斷言**；只斷言機器消費的結構（工具名、路由決策、結構化欄位）。

### 4.3 覆蓋率門檻（目標）

| 範圍 | 最小門檻 |
|---|---|
| 整體 | 80% |
| 關鍵領域 | 100% |
| UI component | 60% |

**必須 100%**：授權/授權邊界檢查（§2 紅線）、orchestrator 編排決策、model fallback 決策、clean-room 元件的來源標註。

### 4.4 Bug fix 紀律
先寫失敗測試重現 → 確認真的因 bug 失敗 → 修 → 確認綠 → 覆蓋率不退步。禁止「修 bug 不附測試」。

---

## 5. Rust 標準（harness 核心）

| 項目 | 規則 |
|---|---|
| 格式/lint | `cargo fmt`；`cargo clippy -- -D warnings`（警告即錯誤）|
| 錯誤 | 用 `Result` + `thiserror` 定義**定型錯誤**；**禁止**在非測試程式碼 `unwrap()`／`expect()`（例外：可證明的不變式須附註解）|
| panic | 禁止以 panic 作錯誤處理；`panic`/`unsafe` 僅在明示並註解理由時允許 |
| 型別 | **parse, don't validate**：邊界解析成 domain 型別，內部只流通已定型值 |
| match | 對 enum 用**窮舉** match，不用 catch-all 掩蓋未處理分支 |
| async | `tokio`；禁止未處理的 fire-and-forget future（須 await 或明確記錄失敗）|
| 檔案大小 | 單檔 250 LOC 為上限，超過即拆分模組 |
| 命名 | 型別 PascalCase、函式/變數 snake_case、常數 UPPER_SNAKE |

---

## 6. TypeScript 標準

- **strict**：目標開啟 `strict`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`；app 層不得無故放寬。
- **型別安全禁令**：❌ `as any`／`as unknown as T`；❌ `@ts-ignore`／`@ts-expect-error`；❌ 非空斷言 `!` 掩蓋 nullish。例外：`as const`、合法 `satisfies`。
- **輸入驗證**：所有跨邊界輸入以 **Zod** 在邊界解析一次（config、API、MCP）。
- **Config**：環境變數以 Zod `parse`，**啟動即 fail fast**；禁止業務碼直接讀 `process.env`。
- 命名：變數/函式 camelCase、型別 PascalCase、常數 UPPER_SNAKE、React 元件 PascalCase、hook `use` 前綴。
- 一般檔名 kebab-case。

---

## 7. React 標準（前端）

- 元件**單一職責**；業務邏輯抽 hook／service，不寫在 JSX。
- **server state** 用 TanStack Query（或專案選定方案）管理，不與 UI state 混。
- 禁止未審核 `dangerouslySetInnerHTML`；渲染使用者內容一律 sanitize。
- 樣式以**設計 token**（CSS 變數）為準，禁止硬編碼 raw color。
- 無障礙：目標 WCAG 2.1 AA。

---

## 8. 錯誤處理

- 邊界錯誤**統一形狀**（Rust：定型錯誤 → 邊界轉為 HTTP/MCP 錯誤；TS：RFC 7807 problem+json）。
- **外部依賴失敗**（provider、MCP、檔案）→ 包裝成定型領域錯誤，保留 `cause`，不直接外拋第三方錯誤形狀。
- 禁止空 `catch {}`；捕獲須限縮型別並處理/轉譯/重拋。
- 5xx 記結構化 log；4xx 不以 error 等級灌爆日誌。
- **不對外洩漏堆疊與內部細節**。

---

## 9. 效能

| 規則 | 細則 |
|---|---|
| N+1 | 禁止；列表端點查詢數須固定 |
| 分頁 | 逾 ~1000 筆用 cursor pagination |
| 並行 | 獨立 I/O 並行（Rust `tokio`、JS `Promise.all`）|
| Bundle | 前端程式碼分割與 lazy loading |

---

## 10. 安全 coding

| 場景 | 規則 |
|---|---|
| SQL | 一律參數化查詢，禁止字串拼接 |
| 輸入 | 邊界 Zod/解析一次 |
| 路徑 | 檔案存取限 allowlist 目錄，拒絕 `..` 與絕對路徑穿越 |
| SSRF | 對外目標 host/port allowlist；禁以使用者輸入直接構造 URL |
| Secrets | 程式碼/文件禁寫 secret；`.env` 進 `.gitignore`；`.env.example` 僅變數名與非敏感預設 |
| 授權檢查 | 不依賴前端隱藏作為存取控制 |

---

## 11. 註解、TODO 與魔術數字

- 註解寫「**為何/如何**」，不寫「做什麼」；公開項目須簡短說明用途與邊界條件。
- `TODO(owner): <描述> Refs #<issue>`；裸 `TODO`/`FIXME` 禁止。
- 禁止 inline magic number/string；提取為命名常數或設定。

---

## 12. 授權潔淨 coding 規則（owx 特有）

- **禁止**任何檔案出現 omo（oh-my-openagent）之原始碼、prompt、skill 文字或其**任何品牌名**（禁止字串清單以編碼保存於 `scripts/cleanroom-scan.mjs`）。
- 新增依賴須在 PR body 標明授權；**SUL/SSPL/BUSL 一律不得進交付物**。
- clean-room 產出（自建 harness）不得暗示衍生自 omo 之表達；僅可依「功能需求」實作。

---

## 13. 變更紀錄

| 日期 | 版本 | 變更 |
|---|---|---|
| 2026-10-17 | v0.1 | 初版：改寫自 ASM `coding-standards.md`。移植核心哲學、版本控制、Conventional Commits、PR、測試紀律；新增 **Rust 標準（§5）**、React 標準（§7）、**授權潔淨 coding 規則（§12）**；技術棧改為 Rust + TS + React。 |

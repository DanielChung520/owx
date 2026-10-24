HANDOFF CONTEXT（owx 專案交接）— 更新於 2026-10-17（session 2，step② 完成）
=====================================================================

> session 交接文件：把 owx（opencode-web eXperiment）的脈絡、決策與產出交給下一個 session。
> 不含憑證。**本檔不進版控**（維持 untracked）。

STATE AT A GLANCE
-----------------
- 階段：第一階段迭代螺旋；**step② 完成**（骨架 ＋ 真決策 ＋ 前端 ＋ 測試 ＋ live 驗證）。
- `~/github/owx`：master，**20 commits**（最後 `7c36cfa`）；唯一 untracked = 本檔。
- 分層：規範（L1）→ 功能（L2）→ 設計（L3）→ 骨架＋測試（L4 進行中）。
- **決策全數定案**（D1–D5；ADR-0001..0006）。
- 外掛（模組微服務）**第一階段不做**；介面已定 = MCP / HTTPS。

USER REQUESTS（本 session，重點）
---------------------------------
- 分階段做：翻寫規格 → 立 Rust+React 框架 → 實作驗證 → 需求回流 → 持續實作。
- 架構/流程/交互一律 Mermaid，寫進文件規範。
- 完善 L2、L3（規格細節）。
- 先做 Step2；**以可見的實際操作驗證實作，務必嚴格單元驗證/測試**。
- 決策原則：**一律參照 opencode／opencode-web**；外掛先不做；外掛介面 = MCP/HTTPS。
- (1) 委派落地 (2) 更新 HANDOFF (3) 進 step③ —— 三者都做。

GOAL（續作方向）
----------------
- 續 **step③**：把紀律/路由做深（意圖→category 自動選、todo 紀律端點、委派結果回饋）。
- 需要時再做外掛（MCP/HTTPS 介面已定）。

WORK COMPLETED（本 session）
----------------------------
規範與文件
- `AGENTS.md` v0.3；`docs/standards/document-standards.md` v0.4（Mermaid §6、文關聯 §2.5、設計 §4.4）。
- `docs/spec/base-core-requirements.md` v0.3（107 FR）；`docs/spec/functional-spec.md` v0.3（三層、可測驗收）。
- `docs/design/`：harness-architecture／interfaces／data-and-state／frontend／testing（+ README 索引）。
- `docs/adr/`：ADR-0002（螺旋）、0003（D1 Rust+React）、0004（邊界：Rust sidecar + thin TS shim）、
  0005（模型注入：agent 設定 + session 建立，Accepted）、0006（外掛介面＝MCP/HTTPS，先不做）。

程式（Rust harness，9 crate）
- `owx-core`（hook 決策型別）、`owx-config`（分層設定/profile）、`owx-tools`（政策/註冊表）、
  `owx-discipline`（doom-loop/todo/意圖）、`owx-session`（boulder）、`owx-router`（模型鏈）、
  `owx-orchestrator`（categories/委派決策/next_model）、`owx-boundary`、`owx-harnessd`。
- `owx-boundary` 端點：`/health`、`/rpc/hook`（政策 deny + doom-loop 真攔截）、`/rpc/delegate`
  （計畫）、`/rpc/delegate/run`（以 opencode API 建子 session 並送訊）、`/rpc/intent`（意圖閘門）、
  `/rpc/fallback`（reactive 換模型）、`/mcp`。

程式（前端 + shim）
- `packages/opencode-plugin-owx`：thin shim（opencode hook → sidecar RPC，fail-open）。
- `apps/web`：Vite+React+TS；chat reducer、opencode API client（建 session/送訊）、SSE 事件對映。

閘門與 CI
- `scripts/`：cleanroom-scan（品牌編碼清單）、license-check、check-docs、sbom；`.github/workflows/ci.yml`。

驗證（實證，非自稱）
- **Rust 54 tests**、**web 17 tests** 全綠；`cargo fmt/clippy -D warnings` 綠；三閘門 OK。
- **live**：真 opencode（bash 被 harness 攔）；`/rpc/delegate` 回計畫；`/rpc/intent`、`/rpc/fallback`。

CURRENT STATE
-------------
- 可實作、可跑、可測；step② 完成。未決：無（D 全定案）。
- 環境落差：**Node v20 < 規範 ≥22**（僅警告）。
- 委派執行需 `OWX_OPENCODE_URL` 指向 opencode server（`/rpc/delegate/run`）。

PENDING TASKS
-------------
- step③ 深化：意圖 → category 自動選、todo 紀律端點、委派結果回流。
- （可選）Node 升 ≥22；`/rpc/delegate/run` 之 live 驗證（需 opencode server）。
- 外掛（KAC/CodeGraph/Doc-Edit/Standards）：需要時再做（MCP/HTTPS）。

KEY FILES
---------
- `AGENTS.md`、`docs/standards/*`、`docs/spec/*`、`docs/design/*`、`docs/adr/ADR-0001..0006`
- `crates/owx-{core,config,tools,discipline,session,router,orchestrator,boundary,harnessd}`
- `packages/opencode-plugin-owx`、`apps/web`、`scripts/*.mjs`、`.github/workflows/ci.yml`

IMPORTANT DECISIONS
-------------------
- substrate = opencode（MIT），包裝不改；omo（SUL）僅需求來源，clean-room。
- D1：Rust 核心 + React 前端。D2：只 md。D3：標準本體屬外掛。D4：介面 MCP/HTTPS（先不做）。
- 邊界（ADR-0004）：Rust sidecar + thin TS shim（loopback RPC）；同 sidecar 兼 MCP server 與 opencode client。
- 模型注入（ADR-0005）：agent 設定 + session 建立；**chat.params 無 model（已 live 證）**。
- 決策原則：一律參照 opencode／opencode-web。

EXPLICIT CONSTRAINTS
--------------------
- 交付物僅 MIT / 自有；omo 禁抄（code/prompt/skill/品牌）。
- 分模組微服務；不改 substrate；外掛先不做。
- Git 鐵則：未經明確要求不 commit；回滾類先確認。
- 測試為驗收機制：**嚴格單元驗證/測試**（Rust ≥80% 核心；不刪測試求綠）。

CONTEXT FOR CONTINUATION
------------------------
- 起手：`AGENTS.md` → `docs/design/README.md` → `docs/adr/ADR-0004/0005/0006`。
- 執行：`cargo test --workspace`、`pnpm -r test`、`cargo run -p owx-harnessd`。
- 注意：`event` hook 高頻（勿同步重工）；`chat.params` 不能換 model；委派需 `OWX_OPENCODE_URL`。
- 委派注意：本 session 的 subagent 對重任務曾失敗（逾時/abort）；重要實作建議親自或小步委派。

# owx 整合功能規格（functional-spec.md）

> 版本：v0.1　|　日期：2026-10-17　|　狀態：Draft
> 來源：整合自 [`AGENTS.md`](../../AGENTS.md)、[`base-core-requirements.md`](base-core-requirements.md)、[`ADR-0001`](../adr/ADR-0001-substrate-opencode-cleanroom-omo.md)、[`ADR-0002`](../adr/ADR-0002-iterative-spiral-workflow.md)、[`ADR-0003`](../adr/ADR-0003-harness-rust-core-react-frontend.md)、[`document-standards.md`](../standards/document-standards.md)、[`licensing.md`](../standards/governance/licensing.md)，以及載體 repo `opencode-web` 之規格（`docs/spec/ow-workspace-layout.md`、`docs/spec/ow-document-access.md`、`docs/mcp.md`、`README.md`、`AGENTS.md`）。

---

## 0. 目的、方法、範圍與授權狀態

### 0.1 目的

本規格是 owx 的**整合功能規格**：把三層（載體層 owx、Substrate opencode、Harness owx 自建）的架構、流程、互動、逐條驗收條件與授權對映，收斂成單一可追溯文件。

它承接 [`base-core-requirements.md`](base-core-requirements.md) 的 core 需求清單（FR-A 至 FR-I），補上該檔刻意不重複的**載體層細節**與**交互流程**，作為迭代螺旋（[`ADR-0002`](../adr/ADR-0002-iterative-spiral-workflow.md)）中「立框架、實作、需求回流」的輸入。

### 0.2 方法（clean-room）

- **只讀公開文件與可觀察行為**，抽取功能需求；**不**複製任何 omo（SUL-1.0）的原始碼、prompt、skill 文字、文件，也**不**沿用其品牌名。流程見 [`licensing.md`](../standards/governance/licensing.md) §3。
- Harness 層（§4）的每一條 FR，皆由 [`base-core-requirements.md`](base-core-requirements.md) §3 的 FR-A、FR-C、FR-E-2/3 **自寫轉化**而來，非逐條重抄。
- 載體層（§2）以**連結引用**載體 repo 的權威規格，不複製其內容。

### 0.3 範圍與邊界（IN / OUT）

| 面向 | 內容 |
|---|---|
| **IN** | 三層架構與端到端互動；載體層 FR（profile／lock／workspace ensure／reverse proxy／MCP／部署）；Substrate 層的點名條目；Harness 層 clean-room FR；交互流程（委派／SSE／權限／fallback／邊界守衛）；NFR；來源對映與授權；缺口與待決 |
| **OUT** | 具體「文件優先」功能調整的實作細節（下一輪迭代）；KAC／CodeGraph／Doc-Edit／Standards 等外掛模組的內部設計；商業模式；omo 任何內部實作 |
| **不變量** | 交付物僅含 MIT／自有程式碼；架構可被模組微服務擴充；opencode 以包裝／外掛使用，不改其原始碼 |

**本規格做**：定義三層的功能需求、驗收條件、交互流程與授權對映，作為迭代螺旋的輸入。

**本規格不做**：不定義外掛模組（KAC／CodeGraph／Doc-Edit／Standards）的內部設計；不重抄 Substrate 的 FR-B／D／E／G／H／I（以連結指向）；不複製載體 repo 規格內容（以連結引用）；不實作任何程式碼。

### 0.4 授權狀態

| 元件 | 授權 | 在 owx 的角色 | 處置 |
|---|---|---|---|
| **opencode** | **MIT** | Substrate | 可重用／改／散布 |
| **owx 自有程式** | **Proprietary** | 載體層 + Harness 核心 | 自有 |
| **opencode-web（ow）** | **自有（Proprietary）** | 載體層來源 | 可自由改 |
| **CodeGraph** | **MIT（非自有）** | 未來 code 圖模組 | 可用；標註非自有 |
| **omo（oh-my-openagent）** | **SUL-1.0** | **需求來源，非程式碼來源** | 不進交付物；僅黑箱回溯 |

> 紅線與 PR 閘門見 [`licensing.md`](../standards/governance/licensing.md) §4、§5。

### 0.5 變更紀錄

| 日期 | 版本 | 變更 |
|---|---|---|
| 2026-10-17 | v0.1 | 初版：整合三層架構、載體／Substrate／Harness FR、交互流程、NFR、來源對映與授權、缺口與待決。 |

---

## 1. 系統總覽

### 1.1 三層架構

owx 由三層構成：載體層（owx 自有）、Substrate（opencode，MIT）、Harness（owx 自建，clean-room）。模組微服務為未來外掛，各自獨立部署。

```mermaid
flowchart TB
    UI["React 前端（聊天視窗）"]
    OW["載體層 owx（自有）<br/>CLI · reverse proxy · MCP server · lock/profile"]
    SUB["Substrate：opencode（MIT）<br/>server HTTP+SSE · SDK · plugin API · agents · tools · sessions · permissions · providers · UI"]
    HAR["Harness 層 owx（自建，clean-room）<br/>委派編排 · categories · 紀律 · model router · session/memory"]
    MOD["模組微服務（未來外掛）<br/>KAC · CodeGraph · Doc-Edit · Standards"]
    UI -->|"iframe / HTTP"| OW
    OW -->|"spawn / proxy"| SUB
    SUB -->|"plugin / sidecar"| HAR
    HAR -->|"HTTP / MCP"| MOD
```

圖說：載體層包裝並代理 Substrate；Harness 以 plugin／sidecar 掛在 Substrate 邊界；模組以 HTTP／MCP 越過微服務邊界。授權邊界即架構邊界，SUL 元件不得越過 Harness 邊界進入交付物。

### 1.2 端到端互動

下圖描述一次使用者請求如何穿越四層：UI 到載體層、載體層到 Substrate、Substrate 到 Harness，再逐層回傳。

```mermaid
sequenceDiagram
    participant U as 使用者（瀏覽器）
    participant C as 載體層 owx（proxy/CLI）
    participant S as Substrate opencode
    participant H as Harness owx（Rust）
    U->>C: 開啟 iframe 或送出 prompt
    C->>S: reverse proxy 轉發（注入 lock）
    S->>H: plugin / sidecar 呼叫
    H->>H: 意圖閘門 → 委派 → 紀律
    H-->>S: 工具結果 / 事件
    S-->>C: SSE 事件流
    C-->>U: 串流回應（response rewrite）
```

---

## 2. 載體層 owx（`FR-CARRIER-*`）

> **連結慣例**：載體層權威規格位於**另一個 repo**（`opencode-web`）。本節以可解析的相對路徑連結（`../../../opencode-web/...`），並註明「carrier repo 內路徑」；內容不複製，衝突時以載體 repo 規格為準。
>
> 載體層的職責是**隔離、profile 管理、文件流程與邊界強制**，不寫 AI 邏輯。

### 2.1 profile 與多帳號隔離

**FR-CARRIER-1｜五根隔離**
每個 profile 以 env 切換 opencode 的五個路徑根：data（`XDG_DATA_HOME`）、config（`XDG_CONFIG_HOME`）、state（`XDG_STATE_HOME`）、tmp（`TMPDIR`）、cache（刻意共用）。目錄不存在時 opencode 會安靜退回全域，故啟動前必須建立。
- **驗收**：給定 `ow status <profile>`，則輸出必須列出 data／config／state／tmp／cache 五個實際路徑；給定任一 profile 目錄不存在，則啟動流程先建立再啟動（`TC-CARRIER-1`）。
- **來源**：carrier repo 內路徑 `docs/spec/ow-workspace-layout.md` §5.2、`README.md`「設定隔離」。

```mermaid
flowchart LR
    P["profile：&lt;slug&gt;"] --> D["data<br/>~/.local/share/ow/&lt;slug&gt;/opencode/"]
    P --> C["config<br/>~/.config/ow/&lt;slug&gt;/opencode/"]
    P --> S["state<br/>~/.local/state/ow/&lt;slug&gt;/opencode/"]
    P --> T["tmp<br/>~/.local/share/ow/&lt;slug&gt;/tmp/"]
    P --> CA["cache（刻意共用）<br/>~/.cache/opencode/"]
```

**FR-CARRIER-2｜profile 註冊與輸入驗證**
`ow profile add <slug> --worktree <path> --port <n>` 註冊 profile；必須驗證 worktree 目錄存在、`--worktree` 漏值不得吞掉下一個 flag、slug 須符合 `^[a-z0-9][a-z0-9_-]*$`。
- **驗收**：給定不存在的 worktree 路徑，則 `ow profile add` 拒絕並回可讀錯誤；給定 `--worktree` 後直接接 `--port`，則拒絕而非把 `--port` 當路徑寫入；給定 `../../etc` 這類 slug，則拒絕（`TC-CARRIER-2`）。
- **來源**：carrier repo 內路徑 `docs/spec/ow-workspace-layout.md` §3、§6；`AGENTS.md` §2.3。

**FR-CARRIER-3｜slug 與 token 職責分離**
目錄名／分支名／profile 名／SeaweedFS 子路徑四者同名且等於 slug；真 token 只存 profile 的 `auth.json`，不得出現在任何路徑、git 記錄或 listing。
- **驗收**：給定任一 profile，則 `ps`、`ls`、`git worktree list`、SeaweedFS listing 皆不含真 token；token 僅見於 `~/.local/share/ow/<slug>/opencode/auth.json`（`TC-CARRIER-3`）。
- **來源**：carrier repo 內路徑 `docs/spec/ow-workspace-layout.md` §4。

**FR-CARRIER-4｜路徑解析只讀 profile 記錄**
ow 解析工作區一律走 profile 記錄（`profiles.json`），不反查 app；app 掛掉時既有工作區仍可定位。
- **驗收**：給定 app 服務不可用，則 `ow status <profile>` 仍能解析並印出 worktree 路徑（`TC-CARRIER-4`）。
- **來源**：carrier repo 內路徑 `docs/spec/ow-workspace-layout.md` §4.2。

### 2.2 lock mode（鎖定模式）

**FR-CARRIER-5｜鎖定注入與新增專案攔截**
`OW_LOCK=1` 時：隱藏「新增專案」UI、攔截 `POST /project` 回 403、注入預選 worktree、內部 port 只綁 `127.0.0.1`。
- **驗收**：給定 `OW_LOCK=1`，則 `POST /project` 回 403；給定移除注入，則同一請求回 200（反向驗證）；給定鎖定模式，則 opencode 內部 port 僅 loopback 可連（`TC-CARRIER-5`）。
- **來源**：carrier repo 內路徑 `README.md`「鎖定模式」、`AGENTS.md` §0.4。

```mermaid
sequenceDiagram
    participant B as 瀏覽器
    participant P as ow-proxy（對外 :4096）
    participant O as opencode（內部 :13001）
    B->>P: GET /（HTML）
    P-->>B: 注入 /__ow-inject.js（隱藏 Add project）
    B->>P: POST /project
    P-->>B: 403（禁止新增專案）
    B->>P: GET /session?directory=...
    P->>P: 路徑邊界守衛
    P->>O: 轉發（界內）
    O-->>P: 200
    P-->>B: 200（回應改寫）
```

### 2.3 請求與回應邊界守衛

**FR-CARRIER-6｜請求側路徑邊界守衛（參數驅動、全 method）**
守衛條件為 `LOCKED && hasPathParams(url) && pathParamsOutsideWorktree(url) → 403`。不列舉路由、不限 method；逐一驗四個參數面：`directory`、`workspace`、`path`（相對 `directory` resolve）、`location`（JSON 物件或 bracket notation）。須處理 URL decode、`..` 穿越與 symlink（realpath 後再判一次）。
- **驗收**：給定任一帶界外路徑參數的請求（含 `POST`、含 bracket notation、含 symlink 祖先逃逸），則回 403；給定界內或無路徑參數的請求，則仍回 200（不誤殺 UI 檔案樹）（`TC-CARRIER-6`）。
- **來源**：carrier repo 內路徑 `docs/spec/ow-document-access.md` §8.1.0 至 §8.1.2、§9.4。

**FR-CARRIER-7｜回應側守衛與改寫**
請求側攔不到的回應內容洩漏，須在回應層處理：`GET /project/{id}/directories` 過濾 JSON 陣列只留界內；`GET /project` 保留全部條目、只改寫 `worktree` 欄位並清空 `sandboxes`；`GET /session/<id>` 只改寫 session 物件頂層 `directory`，不遞迴改寫 message／tool 引數。改寫一律 fail-open，且重寫 body 時須移除互斥的 `transfer-encoding`。
- **驗收**：給定 `GET /project/{id}/directories` 上游回含界外目錄，則回應只含界內項目；給定 `GET /project` 上游含界外 `worktree`，則條目數／順序／`id` 不變而 `worktree` 被改寫；給定 gzip 上游，則改寫後回應可被瀏覽器解析（無 `ERR_CONTENT_DECODING_FAILED`）（`TC-CARRIER-7`）。
- **來源**：carrier repo 內路徑 `docs/spec/ow-document-access.md` §8.1.3 至 §8.1.6。

**FR-CARRIER-8｜注入鍵名權威契約**
注入腳本寫入的 localStorage 鍵名屬外部契約：權威鍵為 `opencode.global.dat:server`（保留 `server.v3` 供舊版相容），並改寫 `opencode.window.browser.dat:tabs` 與 `…:tabs.info` 各自攜帶的 `directory`。
- **驗收**：給定注入後載入 UI，則 `projects.local[0].worktree` 維持界內、不被 app 改回界外；鍵名契約有迴歸測試鎖定（`TC-CARRIER-8`）。
- **來源**：carrier repo 內路徑 `docs/spec/ow-document-access.md` §8.1.5。

### 2.4 reverse proxy

**FR-CARRIER-9｜代理端點與 upgrade**
ow-proxy 對外提供：`/__ow-inject.js`（注入腳本，繞 CSP inline 限制）、`/__ow-doc-status`（文件狀態聚合）、`/__ow-masters`（master 清單），並轉發 HTTP／SSE／WebSocket upgrade。CORS 由 upstream opencode 提供，proxy 不自行產生 CORS 標頭。
- **驗收**：給定請求 `/__ow-inject.js`，則回 200 且內容為注入腳本；給定 SSE 或 WS upgrade 請求，則正確轉發；給定跨源請求，則 CORS 標頭來自 upstream（`TC-CARRIER-9`）。
- **來源**：carrier repo 內路徑 `docs/spec/ow-document-access.md` §9.3、`README.md`「鎖定模式」。

```mermaid
flowchart LR
    B["瀏覽器 / iframe"] --> P["ow-proxy :4096"]
    P -->|"/__ow-inject.js"| INJ["注入腳本"]
    P -->|"/__ow-doc-status"| DS["文件狀態聚合"]
    P -->|"/__ow-masters"| MS["master 清單"]
    P -->|"HTTP / SSE / WS upgrade"| O["opencode :13001"]
    O -->|"CORS 由 upstream 提供"| P
```

**FR-CARRIER-10｜文件狀態聚合端點**
`GET /__ow-doc-status` 在 proxy 端完成 BFS 列檔與 md5 計算，回傳 `[{path, state, md5, fileSize}]`。狀態四態為 draft／published／modified／remote-only。每個 listing 請求須帶 `Accept: application/json`；目錄判斷用 `Mode & 0x80000000`；md5 取 base64（與 filer 的 `Md5` 對齊）；BFS 深度上限 8；僅納入 `.md`；回應加 `Cache-Control: no-store`；端點僅在 `LOCKED` 時掛載；與邊界守衛共用同一個 `isInsideWorktree()`。
- **驗收**：給定 filer 不可達，則 `filerReachable=false` 且 `entries` 退為 workspace-only，端點不整體失敗；給定工作區與 filer 兩份副本 md5 相同，則該檔標 `published`；給定 md5 不同，則標 `modified`（`TC-CARRIER-10`）。
- **來源**：carrier repo 內路徑 `docs/spec/ow-document-access.md` §3.2、§9.4。

**FR-CARRIER-11｜統一檔案選擇器**
`#` 觸發單一選擇器，範圍限 `.docs/**` 與根 `AGENTS.md`，每個檔案帶狀態徽章並依 🟠 → 🔵 → 🟡 → 🟢 排序；選取後插入帶狀態的結構化指示區塊（非 inline 全文）。碰撞避免：符號後不可有空格、前方需為邊界、無匹配則不彈。
- **驗收**：給定輸入 `#PLAN`，則彈出選擇器並列出 `.docs/PLAN.md` 與其狀態；給定輸入 `# 標題`（markdown 標題），則不觸發；給定選取 `modified` 檔，則插入含警示與可執行指令的指示區塊（`TC-CARRIER-11`）。
- **來源**：carrier repo 內路徑 `docs/spec/ow-document-access.md` §3、§4、§5。

### 2.5 workspace ensure（代建）

**FR-CARRIER-12｜工作區代建（層 A）**
`ow workspace ensure <app> <slug> --repo <path>` 在**已授權 app root** 下冪等代建 `<slug>/`。七條護欄：冪等（絕不 `rm -rf`）、不覆蓋非空目錄、app／slug 白名單、併發鎖、分支出處一律 `-b <slug>`、不代簽 token、app root 白名單。只代建層 A（工作區存在性），層 B（實例啟動與路由）屬 app 側。
- **驗收**：給定 profile 已存在且 worktree 相符，則回 `{created:false, reason:"exists"}`；給定目標目錄非空，則拒絕；給定同一 slug 併發觸發，則只建一份（`TC-CARRIER-12`）。
- **來源**：carrier repo 內路徑 `docs/spec/ow-workspace-layout.md` §6.2。

```mermaid
flowchart TB
    A["ow workspace ensure &lt;app&gt; &lt;slug&gt;"] --> B{"profile 已存在且 worktree 相符？"}
    B -->|是| C["回 created:false, reason:exists"]
    B -->|否| D{"app/slug 白名單通過？"}
    D -->|否| E["拒絕"]
    D -->|是| F{"目標目錄非空？"}
    F -->|是| E
    F -->|否| G["git worktree add -b &lt;slug&gt;"]
    G --> H["寫入 profile"]
    H --> I["（可選）bootstrap"]
```

### 2.6 MCP server

**FR-CARRIER-13｜MCP 工具契約**
ow 對外提供 MCP server（stdio 與 HTTP `:13010/mcp`），v1 共 8 個 `opencode_*` tools：`list_projects`、`create_session`、`list_sessions`、`send_message`、`read_file`、`list_files`、`get_theme`、`set_theme`。所有需專案的操作要求 `project` 參數，且只能操作已 Import 的專案。MCP 層只做包裝與專案限定，不新增 opencode 沒有的能力。
- **驗收**：給定 MCP client 連線，則可列出 8 個 tools 且名稱與 `docs/mcp.md` §3.1 一致；給定未 Import 的專案 id，則操作被拒（`TC-CARRIER-13`）。
- **來源**：carrier repo 內路徑 `docs/mcp.md` §3.1、§5。

```mermaid
flowchart LR
    A["外部 Agent"] -->|"stdio"| M["ow MCP server"]
    A -->|"HTTP :13010/mcp"| M
    M --> T1["opencode_list_projects"]
    M --> T2["opencode_create_session"]
    M --> T3["opencode_send_message"]
    M --> T4["其餘 5 tools（共 8）"]
    M --> O["opencode server API"]
```

### 2.7 部署（launchd）

**FR-CARRIER-14｜開機自啟與 crash 重啟**
`ow service <profile>` 生成 LaunchAgent plist，含 `KeepAlive=true`（crash 重啟）、`RunAtLoad=true`（開機自啟）、完整 PATH 與 `XDG_*` env。launchd 管理的實例，`ow restart` 改用 `launchctl kickstart -k`，`ow stop` 拒絕執行並提示改用 `launchctl unload`。
- **驗收**：給定 `kill -9` opencode 行程，則 launchd 於數秒內自動重啟；給定 launchd 管理實例，則 `ow stop` 拒絕執行而非謊報已停止（`TC-CARRIER-14`）。
- **來源**：carrier repo 內路徑 `README.md`「開機自啟」、`AGENTS.md` §5.1。

```mermaid
flowchart TB
    S["ow service &lt;profile&gt;"] --> PL["生成 plist<br/>com.opencode-web.&lt;profile&gt;.plist"]
    PL --> L["launchctl load"]
    L --> K["KeepAlive=true（crash 重啟）"]
    L --> R["RunAtLoad=true（開機自啟）"]
    PL --> E["EnvironmentVariables：完整 PATH + XDG_*"]
```

### 2.8 文件流程邊界（兩個必須標明的事實）

**FR-CARRIER-15｜commit-doc 實作在 KAC repo（外部）**
`/commit-doc` 的實作（`.opencode/command/commit-doc.md` 與 `scripts/commit-doc.sh`）位於 **KAC repo**（`~/github/kac`），**不在載體 repo**。載體 repo 只有 `scripts/start.sh`。commit-doc 只做 git commit（分支 `<slug>`，不 push GitHub）與 filer 上傳（`/kac-docs/<slug>/`），編輯期不寫回中央儲存。
- **驗收**：給定在載體 repo 搜尋 commit-doc 實作，則**不應**找到（實作在 KAC repo）；給定執行 commit-doc，則落點為 `/kac-docs/<slug>/` 且不 push GitHub（`TC-CARRIER-15`）。
- **來源**：carrier repo 內路徑 `docs/spec/ow-workspace-layout.md` §7、`AGENTS.md` §0.5。

**FR-CARRIER-16｜`ow doc pull`（規格規劃中、尚未實作）**
`ow doc pull <profile> <path>` 為補齊文件生命週期的反向拉取指令，**目前僅在規格規劃中，尚未實作**。現況 `commit-doc` 只有上傳、沒有讀回，故 `remote-only` 狀態只能唯讀引用。
- **驗收**：給定現行載體 repo，則 `ow doc pull` **不存在**（不得宣稱已實作）；實作後，給定 `remote-only` 檔案，則 pull 後工作區出現副本且狀態轉為 `published`（`TC-CARRIER-16`）。
- **來源**：carrier repo 內路徑 `docs/spec/ow-document-access.md` §3.5、§9.3。

### 2.9 載體 FR 追溯表

| FR ID | 能力 | carrier ID | 來源檔案（carrier repo 內路徑） |
|---|---|---|---|
| FR-CARRIER-1 | 五根隔離 | I1, I3 | `docs/spec/ow-workspace-layout.md` §5.2 |
| FR-CARRIER-2 | profile 註冊與驗證 | I2, I3 | `docs/spec/ow-workspace-layout.md` §3, §6 |
| FR-CARRIER-3 | slug／token 分離 | I4 | `docs/spec/ow-workspace-layout.md` §4 |
| FR-CARRIER-4 | 路徑解析只讀 profile | I7 | `docs/spec/ow-workspace-layout.md` §4.2 |
| FR-CARRIER-5 | lock 注入與攔截 | （無，見 README 鎖定模式） | `README.md`、`AGENTS.md` §0.4 |
| FR-CARRIER-6 | 請求側邊界守衛 | R4, R5 | `docs/spec/ow-document-access.md` §8.1 |
| FR-CARRIER-7 | 回應側守衛與改寫 | R4 | `docs/spec/ow-document-access.md` §8.1.3 至 §8.1.6 |
| FR-CARRIER-8 | 注入鍵名權威 | （無，見 §8.1.5） | `docs/spec/ow-document-access.md` §8.1.5 |
| FR-CARRIER-9 | 代理端點與 upgrade | C7, C12 | `docs/spec/ow-document-access.md` §9.3 |
| FR-CARRIER-10 | 文件狀態聚合 | C1 至 C5, C9, C10, D1 至 D7 | `docs/spec/ow-document-access.md` §3.2, §9.4 |
| FR-CARRIER-11 | 統一檔案選擇器 | Q1, Q2, Q3 | `docs/spec/ow-document-access.md` §3 至 §5 |
| FR-CARRIER-12 | workspace ensure | I9 | `docs/spec/ow-workspace-layout.md` §6.2 |
| FR-CARRIER-13 | MCP 工具契約 | （無，見 `docs/mcp.md`） | `docs/mcp.md` §3.1 |
| FR-CARRIER-14 | launchd 部署 | （無，見 README launchd） | `README.md`、`AGENTS.md` §5.1 |
| FR-CARRIER-15 | commit-doc 邊界 | I5, I6 | `docs/spec/ow-workspace-layout.md` §7 |
| FR-CARRIER-16 | `ow doc pull`（規劃中） | C6, Q2 | `docs/spec/ow-document-access.md` §3.5, §9.3 |

> 標「（無）」者為載體規格未給對應 ID 的條目，來源以檔案章節註明。

---

## 3. Substrate 層 opencode（`FR-SUB-*`）

> Substrate 為 opencode（**MIT**），以包裝／外掛使用，**不改其原始碼**。本節**不逐條重抄** [`base-core-requirements.md`](base-core-requirements.md) §3 的 FR-B／FR-D／FR-E／FR-G／FR-H／FR-I，僅以連結指向，並補「本規格需要點名」的條目。

| 群 | 內容 | 連結 |
|---|---|---|
| FR-B | 工具（檔案／執行／程式理解／網路／流程） | [`base-core-requirements.md`](base-core-requirements.md) §3 FR-B |
| FR-D | Session 與上下文（CRUD／SSE／compaction／undo） | [`base-core-requirements.md`](base-core-requirements.md) §3 FR-D |
| FR-E | 模型與 Provider（多 provider／模型鏈／fallback） | [`base-core-requirements.md`](base-core-requirements.md) §3 FR-E |
| FR-G | 擴充機制（plugin／skill／command／MCP） | [`base-core-requirements.md`](base-core-requirements.md) §3 FR-G |
| FR-H | UI（TUI／Web UI／iframe 可嵌入） | [`base-core-requirements.md`](base-core-requirements.md) §3 FR-H |
| FR-I | 部署與多租戶（內外網分離／鎖定／CORS／launchd） | [`base-core-requirements.md`](base-core-requirements.md) §3 FR-I |

**FR-SUB-1｜SSE 事件流為即時狀態來源**
Substrate 以 SSE（`/global/event`）推送 session／訊息／權限請求等狀態；載體層只轉發，不自行產生事件。
- **驗收**：給定 UI 訂閱事件流，則 session／訊息／權限事件即時到達；給定載體層，則不新增 opencode 沒有的自製事件（`TC-SUB-1`）。
- **來源**：base-core FR-D-2；carrier repo 內路徑 `README.md`「已知問題」。

**FR-SUB-2｜權限請求可觀察**
Substrate 的 permission 機制在工具執行前發出請求，結果可觀察（allow／deny）。
- **驗收**：給定需權限的工具呼叫，則發出 permission 事件並等待結果；給定結果，則記錄於日誌可查（`TC-SUB-2`）。
- **來源**：base-core FR-B-2、FR-D-2。

**FR-SUB-3｜Web UI 可 iframe 嵌入**
Substrate 的 Web UI 可被 iframe 嵌入，供其他 app 使用；載體層以環境感知 URL 避免 mixed content。
- **驗收**：給定 https 環境，則 iframe 指向 https 端點；給定 http 環境，則指向 localhost（`TC-SUB-3`）。
- **來源**：base-core FR-H-2；carrier repo 內路徑 `README.md`「其他專案整合」。

**FR-SUB-4｜CORS 由 upstream 提供**
CORS 白名單由 upstream opencode 提供（`OPENCODE_WEB_CORS`），載體層不自行產生 CORS 標頭。
- **驗收**：給定跨源請求，則 `access-control-*` 標頭來自 upstream；給定載體層，則不注入自製 CORS 標頭（`TC-SUB-4`）。
- **來源**：base-core FR-I-3；carrier repo 內路徑 `docs/spec/ow-document-access.md` §5.2。

**FR-SUB-5｜plugin／sidecar 為 Harness 掛載點**
Substrate 的 plugin API 與 sidecar 邊界是 Harness 的掛載點；Harness 不擴充 Substrate 行為。
- **驗收**：給定 Harness 掛載，則經 plugin／sidecar 邊界互動；給定 Substrate 原始碼，則未被修改（`TC-SUB-5`）。
- **來源**：base-core FR-G-1；[`ADR-0003`](../adr/ADR-0003-harness-rust-core-react-frontend.md)。

**FR-SUB-6｜內部 port 綁 loopback**
鎖定模式下 Substrate 內部 port 只綁 `127.0.0.1`，對外由 reverse proxy 暴露。
- **驗收**：給定鎖定模式，則內部 port 僅 loopback 可連；給定外部直連內部 port，則失敗（`TC-SUB-6`）。
- **來源**：base-core FR-I-1；carrier repo 內路徑 `AGENTS.md` §0.3。

---

## 4. Harness 層 owx 自建（`FR-HAR-*`）

> Harness 為 owx **clean-room 自建**（Rust 核心，[`ADR-0003`](../adr/ADR-0003-harness-rust-core-react-frontend.md)），由 [`base-core-requirements.md`](base-core-requirements.md) 的 FR-A、FR-C、FR-E-2/3 **自寫轉化**。內容不含任何 omo（SUL-1.0）原始碼、prompt、skill 文字或品牌名。

### 4.1 委派編排與 categories

**FR-HAR-1｜委派（sync／background）**
主 agent 透過 `task` 工具委派給 sub-agent；sub-agent 可為同步（等待結果）或背景（`run_in_background`，完成後通知、可 `background_output` 取回）。
- **驗收**：給定同步委派，則主 agent 等待並取得結果；給定背景委派，則立即取得 task_id，完成後收到通知並可取回結果（`TC-HAR-1`）。
- **來源**：base-core FR-A-1、FR-A-2。

**FR-HAR-2｜category 與 skills 注入**
委派時可指定 category（領域預設）與 skills（注入知識／工具）。
- **驗收**：給定指定 category，則套用該 category 的 model chain 與 tool policy；給定指定 skills，則對應知識／工具被注入（`TC-HAR-2`）。
- **來源**：base-core FR-A-3。

**FR-HAR-3｜唯讀研究型 sub-agent**
提供唯讀研究型 sub-agent（探索、文件檢索、計畫諮詢、計畫審查），工具受白名單限制（不可寫、不可再委派）。
- **驗收**：給定研究型 sub-agent，則寫入工具與委派工具不可用（`TC-HAR-3`）。
- **來源**：base-core FR-A-4。

**FR-HAR-4｜category worker 不可再委派**
category worker 不可再委派，防無限迴圈。
- **驗收**：給定 category worker 嘗試委派，則被拒（`TC-HAR-4`）。
- **來源**：base-core FR-A-5。

**FR-HAR-5｜per-agent 設定**
每個 agent 有獨立 prompt／model chain／tool policy／permission。
- **驗收**：給定兩個 agent，則各自的 prompt、model chain、tool policy、permission 互不影響（`TC-HAR-5`）。
- **來源**：base-core FR-A-7。

### 4.2 紀律機制

**FR-HAR-6｜意圖閘門**
每個 prompt 在動用工具前，先強制確認意圖／分類。
- **驗收**：給定新 prompt，則在首次工具呼叫前出現意圖確認步驟（`TC-HAR-6`）。
- **來源**：base-core FR-C-1。

**FR-HAR-7｜todo 強制**
多步任務建立 todo、逐步標記完成、閒置時再觸發續作。
- **驗收**：給定多步任務，則建立 todo 並逐步標記；給定閒置，則觸發續作（`TC-HAR-7`）。
- **來源**：base-core FR-C-2。

**FR-HAR-8｜規劃與驗證節奏**
先規劃、逐步驗證、計畫審查後才執行。
- **驗收**：給定任務，則先產出計畫並經審查，才進入執行（`TC-HAR-8`）。
- **來源**：base-core FR-C-3。

**FR-HAR-9｜續作機制**
設定持久目標，session 閒置時重新注入續作提示，直到完成審計通過。
- **驗收**：給定持久目標未完成，則閒置後重新注入續作提示；給定完成審計通過，則停止續作（`TC-HAR-9`）。
- **來源**：base-core FR-C-4。

**FR-HAR-10｜工作計畫狀態**
跨 session 保存已驗證的進度記錄。
- **驗收**：給定跨 session 續作，則已驗證進度可被讀回（`TC-HAR-10`）。
- **來源**：base-core FR-C-5。

**FR-HAR-11｜session 復原**
缺工具結果、thinking block 不匹配、空訊息、context 超限、JSON 解析錯誤，皆透明復原。
- **驗收**：給定上述任一失敗情境，則 session 透明復原且長任務不中斷（`TC-HAR-11`）。
- **來源**：base-core FR-C-6。

### 4.3 model router

**FR-HAR-12｜模型鏈**
primary + 有序 fallback。
- **驗收**：給定 primary 可用，則使用 primary；給定 primary 不可用，則依序嘗試 fallback（`TC-HAR-12`）。
- **來源**：base-core FR-E-2。

**FR-HAR-13｜兩套 fallback**
proactive（chat params 選鏈）與 reactive（執行後失敗復原）。
- **驗收**：給定 proactive 選鏈，則在呼叫前決定鏈；給定執行後失敗，則 reactive 復原（`TC-HAR-13`）。
- **來源**：base-core FR-E-3。

### 4.4 文件優先轉化（承接缺口）

**FR-HAR-14｜紀律語境重寫為文件優先**
plan／verify／todo 的 prompt 須重寫為「規格／文件」語境，而非 code 語境。
- **驗收**：給定文件編輯任務，則紀律提示以規格／文件為對象；不得沿用 code 導向措辭（`TC-HAR-14`）。
- **來源**：base-core §7 缺口 2。

**FR-HAR-15｜traceability 產出**
紀律擴充為「需求 ↔ 文件 ↔ 測試 ↔ 實作」可證追溯。
- **驗收**：給定一條需求，則可追溯其對應文件、測試與實作（`TC-HAR-15`）。
- **來源**：base-core §7 缺口 4。

### 4.5 Harness 互動圖

```mermaid
sequenceDiagram
    participant M as 主 agent
    participant R as model router
    participant W as category worker
    participant D as 紀律層
    M->>D: 意圖閘門（分類）
    D-->>M: 通過
    M->>D: 建立 todo
    M->>R: 選 model chain（primary + fallback）
    R-->>M: 解析 provider
    M->>W: task 委派（category + skills）
    W-->>M: 結果（sync）或背景通知
    D-->>M: 逐步驗證 / 續作
```

---

## 5. 交互與流程

### 5.1 委派（sync／background）

```mermaid
sequenceDiagram
    participant M as 主 agent
    participant T as task 工具
    participant S as sub-agent
    M->>T: task（sync）
    T->>S: 執行
    S-->>T: 結果
    T-->>M: 等待後回傳
    M->>T: task（run_in_background=true）
    T-->>M: 立即回 task_id
    S-->>T: 完成
    T-->>M: 完成通知
    M->>T: background_output(task_id)
    T-->>M: 取回結果
```

### 5.2 SSE 事件流

```mermaid
sequenceDiagram
    participant U as UI
    participant P as ow-proxy
    participant O as opencode server
    U->>P: GET /global/event（SSE）
    P->>O: 轉發（upgrade）
    O-->>P: event session / message / permission
    P-->>U: 串流推送
```

### 5.3 權限請求

```mermaid
sequenceDiagram
    participant A as agent
    participant O as opencode
    participant U as 使用者
    A->>O: 工具呼叫（需權限）
    O-->>U: permission.ask 事件
    U->>O: 允許 / 拒絕
    O-->>A: 結果
```

### 5.4 model fallback

```mermaid
sequenceDiagram
    participant H as Harness router
    participant P1 as primary provider
    participant P2 as fallback provider
    H->>P1: 呼叫（proactive 選鏈）
    P1-->>H: 失敗
    H->>P2: reactive fallback
    P2-->>H: 成功
```

### 5.5 lock-mode 請求邊界守衛

```mermaid
sequenceDiagram
    participant B as 瀏覽器
    participant P as ow-proxy
    participant O as opencode
    B->>P: 請求（帶路徑參數）
    P->>P: hasPathParams？逐一驗值
    alt 界外
        P-->>B: 403 path outside worktree
    else 界內
        P->>O: 轉發
        O-->>P: 回應
        P->>P: 回應守衛（改寫 /project、/session）
        P-->>B: 改寫後回應
    end
```

---

## 6. 非功能需求（NFR）

> NFR-1 至 NFR-7 沿用 [`base-core-requirements.md`](base-core-requirements.md) §4，並補可驗證判準；NFR-8 起為本規格增補。

| 編號 | 需求 | 可驗證判準 |
|---|---|---|
| NFR-1 | **授權可交付**：交付物僅含 MIT／自有程式碼；SUL 元件不得進交付物 | 交付物掃描無 SUL／SSPL／BUSL／GPL 授權；元件授權表齊備（`TC-NFR-1`） |
| NFR-2 | **可擴充**：核心以微服務／模組邊界開放外掛 | 新增模組不需改核心；以 HTTP／MCP 邊界接入（`TC-NFR-2`） |
| NFR-3 | **不擴充 substrate 行為**：opencode 以包裝／外掛使用，不改其原始碼 | Substrate 原始碼 diff 為空；整合只經 plugin／sidecar／proxy（`TC-NFR-3`） |
| NFR-4 | **可觀測**：session／事件／權限／fallback 皆可觀察 | 上述四類事件皆可於日誌或事件流觀察（`TC-NFR-4`） |
| NFR-5 | **可復原**：常見失敗自動復原，不中斷長任務 | 注入常見失敗情境，長任務仍完成（`TC-NFR-5`） |
| NFR-6 | **隔離**：帳號／app／設定／資料互不洩漏 | 兩 profile 同時跑，各自 `/project` 回不同 worktree；五根路徑互異（`TC-NFR-6`） |
| NFR-7 | **文件優先可達**：架構須能承載「以文件／知識為原生對象」 | 存在 doc-native 工具與知識圖介面的擴充點（`TC-NFR-7`） |
| NFR-8 | **可測試性**：每條 FR 皆有可觀察／可測的驗收判準 | 每條 FR 附「驗收」與 `TC-*` 佔位；無驗收的 FR 視為未完成（`TC-NFR-8`） |
| NFR-9 | **文件即知識資產**：架構／流程／互動圖一律 Mermaid，可 diff、可被 RAG 解析 | 文件中無 ASCII art／圖檔；所有圖為 Mermaid 原始碼（`TC-NFR-9`） |
| NFR-10 | **授權閘門可自動化**：可產出授權元件表（形如 SBOM） | 以 `cargo metadata`／`pnpm licenses list` 可產出元件授權表（`TC-NFR-10`） |
| NFR-11 | **代理延遲可控**：reverse proxy 不顯著增加請求延遲 | 經 proxy 與直連 upstream 的延遲差在既定門檻內（門檻待定，見 §8）（`TC-NFR-11`） |
| NFR-12 | **隔離可觀察**：`ow status <profile>` 印出五根路徑 | 執行 `ow status <profile>` 可見 data／config／state／tmp／cache 五行（`TC-NFR-12`） |
| NFR-13 | **跨語言邊界明確**：Rust 核心 ↔ TS substrate 以 plugin／sidecar／MCP 互動 | 邊界互動有明確契約；無跨語言直接記憶體耦合（`TC-NFR-13`） |

---

## 7. 來源對映與授權

| FR 群 | 主要來源 | 授權 | 處置 |
|---|---|---|---|
| FR-CARRIER-1 至 FR-CARRIER-16（載體層） | **opencode-web（ow）** | **自有（Proprietary）** | 可自由改 |
| FR-SUB-1 至 FR-SUB-6（Substrate 點名條目） | **opencode** | **MIT** | 可重用／改／散布 |
| FR-HAR-1 至 FR-HAR-5（委派編排） | **omo**（回溯） | **SUL-1.0** | 僅回溯需求，自建（Rust） |
| FR-HAR-6 至 FR-HAR-11（紀律機制） | **omo**（回溯） | **SUL-1.0** | 僅回溯需求，自建（Rust） |
| FR-HAR-12 至 FR-HAR-13（model router） | **omo**（回溯） | **SUL-1.0** | 僅回溯需求，自建（Rust） |
| FR-HAR-14 至 FR-HAR-15（文件優先轉化） | **owx 自寫**（承接 base-core §7 缺口） | **Proprietary** | 自有 |
| 未來 code 圖模組（未在本規格展開） | **CodeGraph** | **MIT（非自有）** | 可用；標註非自有 |
| 未來知識／標準模組（未在本規格展開） | **KAC／owx 自寫** | **Proprietary** | 自有 |

> 任何新增外部元件（npm／cargo／工具／服務）須更新 [`licensing.md`](../standards/governance/licensing.md) §2 元件清單並於 PR body 標明授權。

---

## 8. 缺口 / 待決

### 8.1 承接 D2 至 D5（[`AGENTS.md`](../../AGENTS.md) §9）

| # | 決策 | 影響 | 狀態 |
|---|---|---|---|
| D2 | **文件格式**範圍（初期只 md，或含 docx／pdf） | Doc-Edit 模組範圍 | 待決 |
| D3 | **標準本體**範圍（規格／測試／品質，是否含治理／合規） | Standards 模組 | 待決 |
| D4 | **優先外掛**（KAC vs CodeGraph 先接）與介面（MCP？） | 微服務邊界 | 待決 |
| D5 | **可交付清單**（企業交付的授權元件表） | §7 落地 | 待決 |

### 8.2 本規格未完備處

1. **載體層 FR 未涵蓋全部載體能力**：本規格聚焦 profile／lock／proxy／MCP／部署與文件流程；載體 repo 的 `ow scan`、`ow upgrade`、`ow version` 等指令未逐條展開。
2. **`ow doc pull` 尚未實作**（FR-CARRIER-16）：文件生命週期閉環缺一環，`remote-only` 目前只能唯讀引用。
3. **commit-doc 實作在 KAC repo**（FR-CARRIER-15）：載體 repo 無此實作，跨 repo 改動需獨立授權。
4. **NFR-11 延遲門檻未定**：reverse proxy 的延遲門檻值待實測後回填。
5. **Harness 尚未有程式碼**：FR-HAR-* 為 clean-room 需求，實作與測試待迭代螺旋後續輪次產出。
6. **模組微服務未展開**：KAC／CodeGraph／Doc-Edit／Standards 的介面與契約未在本規格定義（見 D2 至 D4）。
7. **待確認**：載體層部分能力（如 `/__ow-masters` 的完整契約、session 刪除注入的邊界）僅見於載體 repo 變更紀錄，未收斂為穩定規格，須回 carrier repo 確認後補入。

### 8.3 迭代回寫義務

依 [`ADR-0002`](../adr/ADR-0002-iterative-spiral-workflow.md)，每輪迭代結束**必須回寫本規格**；規格落後於實作，視為該輪未完成。規格與現實衝突時，以實作驗證為準，回頭更新本規格。

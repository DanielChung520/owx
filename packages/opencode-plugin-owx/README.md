# @owx/opencode-plugin-owx

owx 的 **thin opencode plugin shim**（骨架階段）。

把 opencode 的 plugin hook 轉呼叫 Rust harness sidecar（`owx-harnessd`）的 loopback RPC。

- 邊界決策：[`../../docs/adr/ADR-0004-harness-opencode-boundary.md`](../../docs/adr/ADR-0004-harness-opencode-boundary.md)
- hook 契約：[`../../docs/design/interfaces.md`](../../docs/design/interfaces.md) §2
- 架構：[`../../docs/design/harness-architecture.md`](../../docs/design/harness-architecture.md)

## 行為

- 掛載 hook：`tool.execute.before`（骨架階段）。
- 轉呼叫：`POST http://127.0.0.1:${OWX_HARNESS_PORT ?? 13100}/rpc/hook`，body `{ hook, payload }`，逾時 250ms。
- **fail-open**：sidecar 不可達/逾時/非 2xx 時，一律放行，不阻擋 agent。
- 若 sidecar 回 `block`，throw 以阻擋該工具呼叫。

## 安裝（opencode）

將本套件放到 opencode 的外掛載入位置（例如專案 `.opencode/plugins/`，或以 config `plugin` 指向），並確保 `owx-harnessd` 已在 `OWX_HARNESS_PORT` 上運行。

## 開發

```bash
# repo 根目錄
pnpm install
pnpm --filter @owx/opencode-plugin-owx run typecheck
pnpm --filter @owx/opencode-plugin-owx run build
```

- 依賴授權：`typescript`（MIT）、`@types/node`（MIT）。
- 執行期不需第三方依賴（使用全域 `fetch`）。

## 已驗證與待決

已驗證（對 `@opencode-ai/plugin` 1.18.x 型別，`tsc` 通過）：

1. plugin 進入點為 `async (PluginInput) => Hooks`；hook 為 `{ "<name>": async (input, output) => {} }`。
2. `tool.execute.before` 的 output 只有 `{args}`（可改寫）；**阻擋須 throw**。
3. 已掛載 `tool.execute.before`、`permission.ask`、`chat.message`、`chat.params`、`event`。

待決：

1. **模型鏈／fallback 不經 `chat.params`**（output 無 model 欄位）→ 注入路徑另議。
2. `tool.execute.before` 阻擋（throw）的正式行為需 live 執行驗證。
3. 傳輸：目前用 loopback HTTP；是否改用 MCP/stdio 待 `docs/design/interfaces.md` §7 收斂。

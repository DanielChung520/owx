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

## 已知不確定（待迭代以真實 opencode 驗證）

1. **plugin 進入點與 hook 簽章**：目前依公開文件形狀實作；實際 `tool.execute.before` 的
   `input`/`output` 型別與「阻擋」的正式機制（throw 或專用回傳）需以真實 opencode 執行驗證。
2. 其餘 hook（`chat.params`、`permission.ask`、`event`）尚未掛載。
3. 傳輸：目前用 loopback HTTP；是否改用 MCP/stdio 待 `docs/design/interfaces.md` §7 收斂。

# @owx/web

owx 前端（骨架階段）：Vite + React + TypeScript 的**聊天視窗**外殼。

- 設計：[`../../docs/design/frontend.md`](../../docs/design/frontend.md)
- 技術決策：[`../../docs/adr/ADR-0003-harness-rust-core-react-frontend.md`](../../docs/adr/ADR-0003-harness-rust-core-react-frontend.md)
- 需求：`docs/spec/base-core-requirements.md` FR-H、`docs/spec/functional-spec.md` FR-SUB

## 範圍（骨架）

- 版面：Header（品牌 + 連線狀態）、訊息列表、輸入框。
- SSE：`useSessionStream` 連 `GET ${VITE_OPENCODE_URL}/global/event`；事件→訊息對映待迭代。
- 狀態：`connecting` / `live` / `reconnecting` / `closed`。

## 開發

```bash
# repo 根目錄
pnpm install
pnpm --filter @owx/web run typecheck
pnpm --filter @owx/web run build
pnpm --filter @owx/web run dev   # http://localhost:5173
```

`VITE_OPENCODE_URL` 留空時不建立 SSE 連線（見 `.env.example`）。

## 依賴授權

`react` / `react-dom` / `vite` / `@vitejs/plugin-react` / `typescript` 皆 **MIT**（可交付）。

# owx — opencode-web eXperiment

> 以 **opencode + omo** 為基礎核心，重做一個**文件優先（document-first）**的 agent 執行環境。
> 定位形狀像 opencode/omo，但**原生對象是文件與知識**，不是程式碼。

| 項目 | 說明 |
|---|---|
| **狀態** | Inception：2026-10-17 建立；尚無程式碼，先立規範與規格 |
| **規範入口** | [`AGENTS.md`](AGENTS.md)（根知識庫，唯一全專案入口）|
| **開發規範** | [`docs/standards/`](docs/standards/)（coding / document / governance）|
| **基礎核心規格** | [`docs/spec/base-core-requirements.md`](docs/spec/base-core-requirements.md)（clean-room 回溯）|
| **架構決策** | [`docs/adr/`](docs/adr/) |

## 核心原則（不可違反）

1. **授權潔淨**：交付物只含 **MIT** 或**自有**程式碼；`omo` 為 **SUL-1.0**，**只能回溯需求、不可複製**（見 [`docs/standards/governance/licensing.md`](docs/standards/governance/licensing.md)）。
2. **文件優先**：agent 的原生對象是文件／知識；coding 只是文件工程的特例。
3. **包裝不擴充**：`opencode`（MIT）以包裝／外掛方式使用，**不改其原始碼**。
4. **微服務可擴充**：核心之外的模組（知識、code graph、標準本體…）以獨立微服務外掛。

## 目錄結構

```
owx/
├── AGENTS.md                 # 根知識庫（開發規範入口）
├── docs/
│   ├── standards/            # 開發規範（coding / document / governance）
│   ├── spec/                 # 需求規格（clean-room 回溯）
│   └── adr/                  # 架構決策記錄
└── ...
```

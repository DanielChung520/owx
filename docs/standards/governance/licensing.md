# owx 授權治理（governance/licensing.md）

> 版本：v0.1　|　日期：2026-10-17　|　狀態：Draft
> **優先序：本檔僅次於 `AGENTS.md` §2，高於其他規範。**
> 背景：owx 的用途是**為企業導入 AI**——交付物**不得含非正式授權程式碼**。這不是偏好，是硬性驗收條件。

---

## 0. 第一原則

> **交付物只允許：MIT / Apache-2.0 / BSD / 自有（Proprietary）之程式碼。**
> 其餘授權（**SUL / SSPL / BUSL** 等 source-available 或限制商用者）**不得進交付物**。

---

## 1. 授權分級

| 分級 | 授權 | 處置 |
|---|---|---|
| ✅ **可交付** | MIT、Apache-2.0、BSD、ISC、自有 | 可直接使用/散布 |
| ⚠️ **須查核** | 其他寬鬆授權、雙授權 | 逐一確認可商用可散布，記錄於 PR |
| ❌ **禁止進交付物** | **SUL-1.0**、SSPL、BUSL、非商用授權 | 不得使用；如需其概念，走 §3 clean-room |
| ⚠️ **傳染性** | GPL/AGPL 等 copyleft | 預設排除（除非明確接受其義務，需 ADR）|

---

## 2. 元件授權清單（權威）

| 元件 | 授權 | 在 owx 的角色 | 處置 |
|---|---|---|---|
| **opencode**（anomalyco/opencode）| **MIT** | substrate | ✅ 可重用/改/散布 |
| **owx 自有程式** | Proprietary | 核心產品 | ✅ 自有 |
| **CodeGraph**（@colbymchenry/codegraph）| **MIT** | 第三方 code 圖（非自有）| ✅ 可用；標註非自有 |
| 其他第三方 | 逐案 | — | 依 §1 分級 |
| **omo**（oh-my-openagent）| **SUL-1.0** | **需求來源，非程式碼來源** | ❌ 不進交付物；見 §3 |

> **更新規則**：新增任何外部元件（npm/cargo/工具/服務），須更新本表並附授權來源，PR 方可合併。

---

## 3. clean-room 流程（對 omo）

owx 的 harness 是 **clean-room** 自建，omo 僅作**需求來源**。

### 3.1 允許 ✅
- 讀 omo 的**公開文件**、觀察其**對外行為**，抽取**功能需求**。
- 把需求寫進 owx **自己的**規格（如 `docs/spec/base-core-requirements.md`）。

### 3.2 禁止 ❌
- ❌ 複製 omo 的**原始碼**、**prompt**、**skill 文字**、**文件內容**。
- ❌ 沿用其**品牌名**（OmO / `ultrawork` / `mass ulw` / Sisyphus / Hashline / Kibitzer…）。
- ❌ 在 owx 檔案中出現任何 omo 的表達片段。

### 3.3 最安全姿勢
> **黑箱回溯**：只看「它對外做什麼」，不看它內部怎麼寫。
> 產出 = **功能需求規格**（自寫），再由 owx 以**原創程式**實作。

### 3.4 已知限制
- omo 的核心價值含**調校過的 prompt/skill**——那是**受著作權保護的表達**，**不能抄**。owx 必須**重養**自己的 prompt/skill。

---

## 4. 紅線清單（違反 = 阻斷合併）

- 交付物含 SUL/SSPL/BUSL/GPL 程式碼。
- 任一檔案出現 omo 原始碼/prompt/skill 文字/品牌名。
- 新增依賴未在 PR 標明授權。
- 文件中把「未來該做」寫成「已做」（誤導稽核）。
- 於程式碼/文件寫入任何 secret。

---

## 5. 依賴審查流程（PR 閘門）

```
新增依賴前 →
  Step 1 查授權（npm view <pkg> license / cargo info / 官網）
  Step 2 對照 §1 分級
  Step 3 可交付？ → 更新 §2 元件清單 + PR body 標授權 → 合併
                  → 不可交付？ → 找替代或走 clean-room（§3）
```

---

## 6. 可交付清單產出（未來）

企業交付時，須產出一份**授權元件表**（形如 SBOM）：
- 列出所有 runtime 依賴 + 授權 + 來源。
- 掃描指令（待建）：`cargo metadata`、`pnpm licenses list` / `license-checker`。

---

## 7. 變更紀錄

| 日期 | 版本 | 變更 |
|---|---|---|
| 2026-10-17 | v0.1 | 初版：定義授權分級、元件授權清單、omo clean-room 流程（允許/禁止/最安全姿勢/已知限制）、紅線清單、PR 閘門、可交付清單。 |

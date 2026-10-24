# 標準文件樣板（_TEMPLATE.md）

> 版本：v0.2　|　日期：2026-10-20　|　狀態：Draft
> 用途：`owx-sample/standards/<id>.md` 之**樣板**。文件一律為**自撰**（非標準原文）。
> 目標：**自評估／撰寫文件**導向；未來若要**正式認證**，再付費下載官方標準。
> 目錄來源：[`../owx-Standard.json`](../owx-Standard.json)；產生器：[`../../scripts/gen-standards.mjs`](../../scripts/gen-standards.mjs)（僅補**未撰寫**者之佔位）。

---

## 型態 A：可下載（`public-domain`／`open`）

```markdown
# <name>（<id>）

> 收錄形式：summary＋自撰綱要（可收錄全文）　|　授權：<license>　|　可收錄全文：是　|　分類：<category>
> 版本：v0.1　|　日期：2026-10-20　|　狀態：Draft　|　內容性質：**自撰**（非標準原文）
> 來源：<source_url>

## 摘要
<一至三句>

## 適用範圍
- <對象與用途>

## 自撰檢核綱要（供自評；非原文）
- [ ] <面向 1>
- [ ] <面向 2>

## 全文（官方；授權）
- 官方來源：<source_url>（授權：<license>；可收錄）
- <若已下載，附全文或存放路徑>

## 與 owx 的關聯
- 作為「依循規範」（`writing_standard.compliance[]`）；抄錄後於專案 `standards/<id>.md` 供自評佐證。

## 取得方式
- 官方來源：<source_url>
- 取得：免費（<license>）

## 變更紀錄
| 日期 | 版本 | 變更 |
|---|---|---|
| 2026-10-20 | v0.1 | 建立自撰綱要（來源：公開資料；非標準原文）。 |
```

## 型態 B/C：不可下載（`restricted`／`proprietary`）

```markdown
# <name>（<id>）

> 收錄形式：summary＋自撰綱要　|　授權：<license>　|　可收錄全文：否　|　分類：<category>
> 版本：v0.1　|　日期：2026-10-20　|　狀態：Draft　|　內容性質：**自撰**（非標準原文）
> 來源：<source_url>

## 摘要
<一至三句>

## 自撰檢核綱要（自評用；**非標準原文**，來源為公開資料）
- [ ] <面向 1>
- [ ] <面向 2>

## 與 owx 的關聯
- 作為「依循規範」（`writing_standard.compliance[]`）；抄錄後於專案 `standards/<id>.md` 供自評佐證。

## 取得方式
- 官方來源：<source_url>
- 取得：**需購買授權**（本文件僅自撰綱要）；**未來認證時**再付費下載官方全文。

## 待增補
- 購買授權後，於 `owx-Standard.json` 將 `acquisition` 改 `full` 並補入內文。

## 變更紀錄
| 日期 | 版本 | 變更 |
|---|---|---|
| 2026-10-20 | v0.1 | 建立自撰綱要（來源：公開資料；非標準原文）。 |
```

> **授權紅線**：`restricted`／`proprietary` **一律不得**收錄原文，僅自撰綱要＋官方連結（NFR-22）。可收錄全文者（`public-domain`／`open`）於取得後得嵌入，並保留授權與出處標示。

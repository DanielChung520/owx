#!/usr/bin/env node
// Generate one markdown doc per standard from owx-sample/owx-Standard.json,
// plus a README index. Deterministic + data-driven (no standard original text).
//
// Usage: node scripts/gen-standards.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ROOT = process.cwd();
const CATALOG = resolve(ROOT, "owx-sample/owx-Standard.json");
const OUT_DIR = resolve(ROOT, "owx-sample/standards");

const catalog = JSON.parse(readFileSync(CATALOG, "utf8"));

const acquisitionLabel = { full: "full（全文）", summary: "summary（摘要）", byo: "byo（自備）" };
const obtain = {
  "public-domain": "公眾領域（可自由收錄）",
  open: "免費可讀（開放／法規；依條款可收錄）",
  restricted: "免費可讀（再散布受限）",
  proprietary: "需購買授權",
};

function docBody(std, catName) {
  const label = acquisitionLabel[std.acquisition] ?? std.acquisition;
  const allowed = std.full_text_allowed === true ? "是" : "否";
  return `# ${std.name}（${std.id}）

> 收錄形式：${label}　|　授權：${std.license}　|　可收錄全文：${allowed}　|　分類：${catName}
> 版本：v0.1　|　日期：2026-10-20　|　狀態：Draft
> 來源：${std.source_url}

## 摘要
${std.summary}

## 取得方式
- 官方來源：${std.source_url}
- 取得：${obtain[std.license] ?? std.license}

## 待增補
- 若取得授權（或屬可收錄全文者），依標準條文補入「稽核檢核清單」與內文，並將 \`owx-Standard.json\` 之 \`acquisition\` 改為 \`full\`。

## 變更紀錄
| 日期 | 版本 | 變更 |
|---|---|---|
| 2026-10-20 | v0.1 | 建立摘要佔位（自 owx-Standard.json 產生）。 |
`;
}

mkdirSync(OUT_DIR, { recursive: true });

let count = 0;
let written = 0;
const indexRows = [];
for (const cat of catalog.categories) {
  const rows = [];
  for (const std of cat.standards) {
    const rel = `${std.id}.md`;
    const target = resolve(OUT_DIR, rel);
    // Only fill stubs for docs that have NOT been authored yet — never clobber
    // hand-authored self-assessment content.
    if (!existsSync(target)) {
      writeFileSync(target, docBody(std, cat.name), "utf8");
      written += 1;
    }
    rows.push(
      `| ${std.name} | ${std.acquisition} | ${std.license} | ${std.full_text_allowed === true ? "是" : "否"} | [${std.id}.md](${rel}) |`,
    );
    count += 1;
  }
  const req = cat.required === true ? "（必要）" : "";
  indexRows.push(`### ${cat.name}${req}\n\n| 標準 | 收錄形式 | 授權 | 可收錄全文 | 文件 |\n|---|---|---|---|---|\n${rows.join("\n")}`);
}

const readme = `# owx 標準文件索引（owx-sample/standards）

> 版本：v0.1　|　日期：2026-10-20　|　狀態：Draft
> 由 [\`../../scripts/gen-standards.mjs\`](../../scripts/gen-standards.mjs) 自 [\`../owx-Standard.json\`](../owx-Standard.json) 產生；**請勿手改**，改目錄後重新產生。
> 樣板見 [\`_TEMPLATE.md\`](_TEMPLATE.md)。收錄原則：僅識別資料／摘要；受限與付費標準**不得**收錄原文。

共 ${count} 項標準。

${indexRows.join("\n\n")}
`;

writeFileSync(resolve(OUT_DIR, "README.md"), readme, "utf8");

console.log(`gen-standards: ${count} standards — wrote ${written} new stub(s), kept ${count - written} existing; README.md updated`);

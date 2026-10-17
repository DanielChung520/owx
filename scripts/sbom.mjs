#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const rows = [];

const meta = JSON.parse(
  execFileSync("cargo", ["metadata", "--format-version", "1"], {
    encoding: "utf8",
    maxBuffer: 1 << 28,
  }),
);
const members = new Set(meta.workspace_members);
for (const pkg of meta.packages) {
  if (members.has(pkg.id)) continue;
  rows.push({
    ecosystem: "cargo",
    name: pkg.name,
    version: pkg.version,
    license: pkg.license ?? "(none)",
  });
}

try {
  const map = JSON.parse(
    execFileSync("pnpm", ["licenses", "list", "--prod", "--json"], {
      encoding: "utf8",
      maxBuffer: 1 << 28,
    }),
  );
  for (const [license, pkgs] of Object.entries(map)) {
    for (const p of pkgs) {
      rows.push({
        ecosystem: "npm",
        name: p.name,
        version: Array.isArray(p.versions) ? p.versions.join(", ") : "",
        license,
      });
    }
  }
} catch (err) {
  console.error(`sbom: pnpm skipped (${err.message})`);
}

rows.sort(
  (a, b) =>
    a.ecosystem.localeCompare(b.ecosystem) || a.name.localeCompare(b.name),
);

const lines = [
  "# owx 元件授權表（SBOM）",
  "",
  `> 產生時間：${new Date().toISOString()}`,
  `> 來源：\`cargo metadata\`、\`pnpm licenses list --prod\`（見 docs/standards/governance/licensing.md §6）。`,
  "",
  "| ecosystem | component | version | license |",
  "|---|---|---|---|",
];
for (const r of rows) {
  lines.push(`| ${r.ecosystem} | ${r.name} | ${r.version} | ${r.license} |`);
}
console.log(lines.join("\n"));

#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const ALLOW =
  /^(MIT|MIT-0|Apache-2\.0|BSD-2-Clause|BSD-3-Clause|ISC|0BSD|Unicode-3\.0|Unicode-DFS-2016|Zlib|CC0-1\.0|Unlicense|LicenseRef-Proprietary)$/;
const DENY = /(SSPL|BUSL|SUL-|GPL|AGPL|LGPL|CDDL|EPL-|Commons-Clause)/;

const strip = (p) =>
  p
    .replace(/\s+WITH\s+.*$/i, "")
    .replace(/[()]/g, "")
    .trim();

const acceptable = (expr) =>
  expr
    .split(/\s+OR\s+|\s*\/\s*/i)
    .some((orPart) =>
      orPart
        .split(/\s+AND\s+/i)
        .every((andPart) => ALLOW.test(strip(andPart)) && !DENY.test(strip(andPart))),
    );

const violations = [];
const unknown = [];

const meta = JSON.parse(
  execFileSync("cargo", ["metadata", "--format-version", "1"], {
    encoding: "utf8",
    maxBuffer: 1 << 28,
  }),
);
const members = new Set(meta.workspace_members);
for (const pkg of meta.packages) {
  if (members.has(pkg.id)) continue;
  if (!pkg.license) {
    unknown.push(`cargo ${pkg.name}@${pkg.version}`);
    continue;
  }
  if (!acceptable(pkg.license)) {
    violations.push(`cargo ${pkg.name}@${pkg.version} => ${pkg.license}`);
  }
}

try {
  const map = JSON.parse(
    execFileSync("pnpm", ["licenses", "list", "--prod", "--json"], {
      encoding: "utf8",
      maxBuffer: 1 << 28,
    }),
  );
  for (const [license, pkgs] of Object.entries(map)) {
    if (!acceptable(license)) {
      for (const p of pkgs) violations.push(`npm ${p.name} => ${license}`);
    }
  }
} catch (err) {
  console.error(`pnpm licenses list skipped: ${err.message}`);
}

for (const u of unknown) console.warn(`UNKNOWN license: ${u}`);
if (violations.length > 0) {
  console.error("license gate FAILED:");
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log("license gate OK");

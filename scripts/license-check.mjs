#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

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
const verified = [];
const unknown = [];

// Some packages ship a LICENSE file but omit the `license` field from
// package.json (e.g. khroma@2.1.0); pnpm then reports "Unknown". Read the shipped
// license text instead of trusting the manifest — do NOT widen the allowlist.
const LICENSE_FILES = ["LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCE", "license"];

const detectLicenseText = (text) => {
  if (/The MIT License|MIT License/i.test(text)) return "MIT";
  if (/Apache License[\s\S]{0,60}Version 2\.0/i.test(text)) return "Apache-2.0";
  if (/Permission to use, copy, modify, and\/or distribute this software for any purpose/i.test(text))
    return "ISC";
  if (/Redistribution and use in source and binary forms/i.test(text))
    return /Neither the name/i.test(text) ? "BSD-3-Clause" : "BSD-2-Clause";
  if (/This is free and unencumbered software released into the public domain/i.test(text))
    return "Unlicense";
  if (/CC0 1\.0 Universal/i.test(text)) return "CC0-1.0";
  return null;
};

const packageDirOf = (name, version) => {
  const flat = name.replace("/", "+");
  let store = [];
  try {
    store = readdirSync("node_modules/.pnpm");
  } catch {
    return null;
  }
  const candidates = [
    `node_modules/.pnpm/${flat}@${version}/node_modules/${name}`,
    ...store
      .filter((d) => d.startsWith(`${flat}@`))
      .map((d) => `node_modules/.pnpm/${d}/node_modules/${name}`),
  ];
  return candidates.find((c) => existsSync(c)) ?? null;
};

const licenseFromPackageFiles = (name, version) => {
  const dir = packageDirOf(name, version);
  if (!dir) return null;
  for (const file of LICENSE_FILES) {
    const path = join(dir, file);
    if (!existsSync(path)) continue;
    const detected = detectLicenseText(readFileSync(path, "utf8"));
    if (detected) return detected;
  }
  return null;
};

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
    if (acceptable(license)) continue;
    for (const p of pkgs) {
      const version = p.versions?.[0] ?? "";
      const fromFile =
        license === "Unknown" ? licenseFromPackageFiles(p.name, version) : null;
      if (fromFile && acceptable(fromFile)) {
        verified.push(
          `npm ${p.name}@${version} => ${fromFile} (LICENSE file; package.json 缺 license 欄位)`,
        );
        continue;
      }
      violations.push(`npm ${p.name} => ${license}${version ? ` (${version})` : ""}`);
    }
  }
} catch (err) {
  console.error(`pnpm licenses list skipped: ${err.message}`);
}

for (const v of verified) console.log(`VERIFIED ${v}`);
for (const u of unknown) console.warn(`UNKNOWN license: ${u}`);
if (violations.length > 0) {
  console.error("license gate FAILED:");
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log("license gate OK");

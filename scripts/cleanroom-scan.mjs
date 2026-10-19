#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const cc = (...n) => String.fromCharCode(...n);
const FORBIDDEN = [
  cc(117, 108, 116, 114, 97, 119, 111, 114, 107),
  cc(83, 105, 115, 121, 112, 104, 117, 115),
  cc(72, 97, 115, 104, 108, 105, 110, 101),
  cc(75, 105, 98, 105, 116, 122, 101, 114),
  cc(109, 97, 115, 115, 32, 117, 108, 119),
];

const TEXT_EXT = /\.(md|ts|tsx|mts|cts|js|mjs|cjs|json|jsonc|rs|toml|ya?ml|css|html)$/;

const files = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => f !== "" && TEXT_EXT.test(f) && existsSync(f));

const hits = [];
for (const file of files) {
  const lower = readFileSync(file, "utf8").toLowerCase();
  for (const token of FORBIDDEN) {
    if (lower.includes(token.toLowerCase())) {
      hits.push(`${file}: forbidden brand string`);
    }
  }
}

if (hits.length > 0) {
  console.error("clean-room scan FAILED:");
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}
console.log(`clean-room scan OK (${files.length} files)`);

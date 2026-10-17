#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ROOT = process.cwd();
const files = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => f !== "" && f.endsWith(".md"));

const problems = [];
const linkRe = /\]\(([^)]+\.md)\)/g;

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const dir = dirname(file);
  let match;
  while ((match = linkRe.exec(text)) !== null) {
    const target = match[1];
    if (/^https?:/.test(target)) continue;
    const abs = resolve(dir, target);
    if (!abs.startsWith(ROOT)) continue;
    if (!existsSync(abs)) {
      problems.push(`${file}: dangling link -> ${target}`);
    }
  }
}

if (problems.length > 0) {
  console.error("doc-link check FAILED:");
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`doc-link check OK (${files.length} files)`);

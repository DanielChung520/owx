import { describe, expect, it } from "vitest";
import { filterHidden, isHiddenName } from "./hidden";

const entries = [
  { name: ".owx-project.json" },
  { name: ".git" },
  { name: "notes.md" },
  { name: "a.b.md" },
];

describe("hidden entries", () => {
  it("detects dot-prefixed names only", () => {
    expect(isHiddenName(".git")).toBe(true);
    expect(isHiddenName("a.b.md")).toBe(false);
    expect(isHiddenName("docs")).toBe(false);
  });

  it("hides dot entries by default", () => {
    expect(filterHidden(entries, false).map((entry) => entry.name)).toEqual([
      "notes.md",
      "a.b.md",
    ]);
  });

  it("keeps every entry when show_hidden is enabled", () => {
    expect(filterHidden(entries, true)).toHaveLength(entries.length);
  });
});

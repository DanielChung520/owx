import { describe, expect, it } from "vitest";
import { parseOutline, slugify } from "./outline";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("keeps unicode letters (CJK)", () => {
    expect(slugify("文件優先")).toBe("文件優先");
  });

  it("drops punctuation and trims hyphens", () => {
    expect(slugify("Hello, World!")).toBe("hello-world");
  });
});

describe("parseOutline", () => {
  it("extracts H1–H6 with levels", () => {
    const md = "# A\n## B\n### C\n#### D\n##### E\n###### F";
    expect(parseOutline(md)).toEqual([
      { level: 1, text: "A", id: "a" },
      { level: 2, text: "B", id: "b" },
      { level: 3, text: "C", id: "c" },
      { level: 4, text: "D", id: "d" },
      { level: 5, text: "E", id: "e" },
      { level: 6, text: "F", id: "f" },
    ]);
  });

  it("ignores headings inside fenced code blocks", () => {
    const md = "# Real\n```\n# Not a heading\n```\n## Also real";
    const items = parseOutline(md);
    expect(items.map((item) => item.text)).toEqual(["Real", "Also real"]);
  });

  it("ignores lines without a space after hashes", () => {
    expect(parseOutline("#nope")).toEqual([]);
  });

  it("returns empty for text without headings", () => {
    expect(parseOutline("just some\nparagraph text")).toEqual([]);
  });
});

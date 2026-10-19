import { describe, expect, it } from "vitest";
import {
  baseName,
  isArchive,
  isMarkdown,
  isText,
  joinPath,
  parentPath,
} from "./files";

describe("file helpers", () => {
  it("detects markdown", () => {
    expect(isMarkdown("a.md")).toBe(true);
    expect(isMarkdown("a.MD")).toBe(true);
    expect(isMarkdown("a.txt")).toBe(false);
  });

  it("detects archives", () => {
    expect(isArchive("a.zip")).toBe(true);
    expect(isArchive("a.tar.gz")).toBe(true);
    expect(isArchive("a.tgz")).toBe(true);
    expect(isArchive("a.tar")).toBe(true);
    expect(isArchive("a.md")).toBe(false);
  });

  it("detects text-ish files", () => {
    expect(isText("a.csv")).toBe(true);
    expect(isText("a.rs")).toBe(true);
    expect(isText("a.png")).toBe(false);
  });

  it("computes base name", () => {
    expect(baseName("docs/guide/a.md")).toBe("a.md");
    expect(baseName("docs/")).toBe("docs");
    expect(baseName("a.md")).toBe("a.md");
  });

  it("joins paths", () => {
    expect(joinPath("docs/", "a.md")).toBe("docs/a.md");
    expect(joinPath("docs", "a.md")).toBe("docs/a.md");
    expect(joinPath("", "a.md")).toBe("/a.md");
  });

  it("computes parent path", () => {
    expect(parentPath("docs/a.md")).toBe("docs");
    expect(parentPath("a.md")).toBe("");
  });
});

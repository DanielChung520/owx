import { describe, expect, it } from "vitest";
import {
  baseName,
  isArchive,
  isAudio,
  isHtml,
  isImage,
  isMarkdown,
  isOffice,
  isPdf,
  isText,
  isVideo,
  joinPath,
  nodePath,
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

  it("detects html", () => {
    expect(isHtml("a.html")).toBe(true);
    expect(isHtml("a.htm")).toBe(true);
    expect(isHtml("a.md")).toBe(false);
    expect(isHtml("README.HTML")).toBe(true);
  });

  it("detects media", () => {
    expect(isImage("a.png")).toBe(true);
    expect(isPdf("a.pdf")).toBe(true);
    expect(isAudio("a.mp3")).toBe(true);
    expect(isVideo("a.mp4")).toBe(true);
    expect(isOffice("a.docx")).toBe(true);
    expect(isOffice("a.xlsx")).toBe(true);
  });

  it("computes base name", () => {
    expect(baseName("docs/guide/a.md")).toBe("a.md");
    expect(baseName("docs/")).toBe("docs");
    expect(baseName("a.md")).toBe("a.md");
  });

  it("strips trailing slashes for node operations", () => {
    expect(nodePath("docs-renamed/")).toBe("docs-renamed");
    expect(nodePath("a/b/")).toBe("a/b");
    expect(nodePath("docs/a.md")).toBe("docs/a.md");
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

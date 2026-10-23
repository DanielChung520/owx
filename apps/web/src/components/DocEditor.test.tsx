import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocEditor } from "./DocEditor";

describe("DocEditor", () => {
  it("opens in split mode with editor and live preview", () => {
    const html = renderToStaticMarkup(
      <DocEditor
        path="docs/note.md"
        initial={"# 標題\n\n| a |\n| --- |\n| 1 |"}
        onSave={async () => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain("doc-editor-body split");
    expect(html).toContain("<textarea");
    expect(html).toContain('aria-label="編輯 docs/note.md"');
    expect(html).toContain("編輯模式");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("<h1");
    expect(html).toContain("md-table");
  });

  it("renders only the textarea in edit mode", () => {
    const html = renderToStaticMarkup(
      <DocEditor
        path="docs/note.md"
        initial={"# 標題"}
        initialMode="edit"
        onSave={async () => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain("doc-editor-body edit");
    expect(html).toContain("<textarea");
    expect(html).not.toContain("doc-editor-preview");
    expect(html).not.toContain("<h1");
    expect(html).toContain('aria-pressed="true"');
  });

  it("renders only the preview in preview mode", () => {
    const html = renderToStaticMarkup(
      <DocEditor
        path="docs/note.md"
        initial={"# 標題"}
        initialMode="preview"
        onSave={async () => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain("doc-editor-body preview");
    expect(html).not.toContain("<textarea");
    expect(html).toContain("doc-editor-preview");
    expect(html).toContain("<h1");
  });
});

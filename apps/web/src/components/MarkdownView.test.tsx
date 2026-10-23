import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownView } from "./MarkdownView";

describe("MarkdownView", () => {
  it("renders GFM tables", () => {
    const html = renderToStaticMarkup(
      <MarkdownView content={"| 欄位 | 說明 |\n| --- | --- |\n| a | 1 |"} />,
    );
    expect(html).toContain('class="md-table"');
    expect(html).toContain("<table>");
    expect(html).toContain("<th>欄位</th>");
  });

  it("renders task lists with checkboxes", () => {
    const html = renderToStaticMarkup(<MarkdownView content={"- [x] done\n- [ ] todo"} />);
    expect(html).toContain("contains-task-list");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("checked");
  });

  it("keeps heading ids for outline anchors", () => {
    const html = renderToStaticMarkup(<MarkdownView content={"## 專案屬性設定"} />);
    expect(html).toContain("<h2");
    expect(html).toContain('id="專案屬性設定"');
  });

  it("renders strikethrough and autolinks (GFM)", () => {
    const html = renderToStaticMarkup(
      <MarkdownView content={"~~舊~~ https://example.com"} />,
    );
    expect(html).toContain("<del>舊</del>");
    expect(html).toContain('href="https://example.com"');
  });

  it("delegates mermaid fences to the diagram block", () => {
    const html = renderToStaticMarkup(
      <MarkdownView content={"```mermaid\ngraph TD;\nA-->B;\n```"} />,
    );
    expect(html).toContain('data-testid="mermaid"');
    expect(html).toContain("graph TD");
  });

  it("leaves other fenced code blocks as pre/code", () => {
    const html = renderToStaticMarkup(<MarkdownView content={"```ts\nconst a = 1;\n```"} />);
    expect(html).toContain("<pre>");
    expect(html).toContain("language-ts");
    expect(html).not.toContain('data-testid="mermaid"');
  });

  it("renders GFM footnotes", () => {
    const html = renderToStaticMarkup(
      <MarkdownView content={"正文[^1]\n\n[^1]: 註腳說明"} />,
    );
    expect(html).toContain('data-footnote-ref="true"');
    expect(html).toContain('class="footnotes');
    expect(html).toContain("註腳說明");
  });
});

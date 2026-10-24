import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownDocView } from "./DocumentOutline";

describe("MarkdownDocView", () => {
  it("renders outline rail when showOutline is true", () => {
    const html = renderToStaticMarkup(
      <MarkdownDocView content={"# 標題\n\n內文"} showOutline={true} />,
    );
    expect(html).toContain('class="doc-body"');
    expect(html).toContain('class="doc-outline"');
    expect(html).toContain('aria-label="文件大綱"');
    expect(html).toContain("大綱");
    expect(html).toContain("標題");
    expect(html).toContain("<h1");
  });

  it("does not render outline rail when showOutline is false", () => {
    const html = renderToStaticMarkup(
      <MarkdownDocView content={"# 標題\n\n內文"} showOutline={false} />,
    );
    expect(html).toContain('class="doc-body"');
    expect(html).not.toContain('class="doc-outline"');
    expect(html).not.toContain('aria-label="文件大綱"');
    expect(html).toContain("<h1");
  });

  it("shows empty state when there are no headings", () => {
    const html = renderToStaticMarkup(
      <MarkdownDocView content={"內文\n無標題"} showOutline={true} />,
    );
    expect(html).toContain('class="doc-outline"');
    expect(html).toContain("此文件沒有標題（H1–H6）");
  });
});

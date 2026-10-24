import { describe, expect, it, vi } from "vitest";

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  getDocument: vi.fn(),
}));

vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({
  default: "",
}));

import { renderToStaticMarkup } from "react-dom/server";
import { PdfPreview } from "./PdfPreview";

describe("PdfPreview", () => {
  it("renders outline rail with page thumbnails when showOutline is true", () => {
    const html = renderToStaticMarkup(<PdfPreview src="/test.pdf" showOutline={true} />);
    expect(html).toContain('aria-label="PDF 頁面縮圖"');
    expect(html).toContain('class="pdf-thumbs"');
    expect(html).toContain('class="pdf-layout"');
  });

  it("does not render pdf outline rail when showOutline is false", () => {
    const html = renderToStaticMarkup(<PdfPreview src="/test.pdf" showOutline={false} />);
    expect(html).not.toContain('aria-label="PDF 頁面縮圖"');
    expect(html).not.toContain('class="doc-outline"');
    expect(html).toContain('class="pdf-layout"');
  });
});

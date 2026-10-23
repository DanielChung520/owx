import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StandardsModal } from "./StandardsModal";

describe("StandardsModal", () => {
  it("renders the dialog shell and empty-state hint before data loads", () => {
    const html = renderToStaticMarkup(<StandardsModal onClose={() => {}} />);
    expect(html).toContain('aria-label="標準規範"');
    expect(html).toContain("規範目錄未設置");
  });
});

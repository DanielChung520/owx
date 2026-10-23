import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ACCOUNT_MAINTENANCE_ITEMS,
  FEATURE_MAINTENANCE_ITEMS,
  PlaceholderModal,
} from "./PlaceholderModal";

describe("PlaceholderModal", () => {
  it("renders the feature-maintenance items", () => {
    const html = renderToStaticMarkup(
      <PlaceholderModal
        title="功能維護"
        items={FEATURE_MAINTENANCE_ITEMS}
        onClose={() => {}}
      />,
    );
    expect(html).toContain("功能維護");
    expect(html).toContain("模組／外掛清單");
  });

  it("renders the account-maintenance items", () => {
    const html = renderToStaticMarkup(
      <PlaceholderModal
        title="賬號維護"
        items={ACCOUNT_MAINTENANCE_ITEMS}
        onClose={() => {}}
      />,
    );
    expect(html).toContain("賬號維護");
    expect(html).toContain("profile 清單");
  });
});

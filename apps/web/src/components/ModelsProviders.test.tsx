import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ModelsProviders } from "./ModelsProviders";

describe("ModelsProviders", () => {
  it("renders the model-list and provider-connect sections", () => {
    const html = renderToStaticMarkup(<ModelsProviders />);
    expect(html).toContain("模型下載清單");
    expect(html).toContain("Provider 連線");
    expect(html).toContain("已連線 provider");
  });

  it("renders the provider form with id / key / base url inputs", () => {
    const html = renderToStaticMarkup(<ModelsProviders />);
    expect(html).toContain("Provider ID");
    expect(html).toContain("API Key");
    expect(html).toContain("Base URL");
    expect(html).toContain('type="password"');
  });
});

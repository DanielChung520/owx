import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { type Settings } from "../lib/api";
import { SettingsModal, type SettingsTab } from "./SettingsModal";

const settings: Settings = {
  global: {
    systemName: "acme",
    knowledgeRoot: null,
    logo: null,
    accent: null,
    defaultProviderId: null,
    defaultModelId: null,
    defaultAgent: null,
  },
  personal: { theme: "dark" },
};

const providers = [
  {
    id: "anthropic",
    name: "Anthropic",
    models: [{ providerID: "anthropic", id: "claude" }],
  },
];

function renderModal(initialParamTab: SettingsTab = "general"): string {
  return renderToStaticMarkup(
    <SettingsModal
      settings={settings}
      providers={providers}
      agents={["build"]}
      onSave={async () => {}}
      onClose={() => {}}
      initialParamTab={initialParamTab}
    />,
  );
}

describe("SettingsModal", () => {
  it("renders the system title and parameter group tabs", () => {
    const html = renderModal();
    expect(html).toContain("系統設置");
    for (const label of ["一般", "外觀", "模型"]) {
      expect(html).toContain(label);
    }
  });

  it("reflects the passed system name", () => {
    expect(renderModal()).toContain('value="acme"');
  });

  it("renders provider options from the providers prop", () => {
    expect(renderModal("model")).toContain("Anthropic");
  });

  it("renders theme options with the active one checked", () => {
    const html = renderModal("appearance");
    for (const label of ["深", "淺", "隨系統"]) {
      expect(html).toContain(label);
    }
    expect(html).toMatch(/checked=""[^>]*value="dark"/);
  });
});

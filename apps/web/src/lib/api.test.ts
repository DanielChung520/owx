import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SETTINGS,
  createSession,
  listConnectedProviders,
  listModels,
  logoUrl,
  projectApplyBaseDirs,
  projectBaseDirs,
  projectGet,
  projectUpdate,
  removeProviderAuth,
  sendMessageAsync,
  setProviderApiKey,
  setProviderBaseUrl,
  standardsGet,
  standardsList,
} from "./api";

interface MockResponse {
  ok: boolean;
  status?: number;
  json?: unknown;
}

function mockFetch(response: MockResponse) {
  const fn = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 500),
    json: async () => response.json ?? {},
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api", () => {
  it("createSession posts to /session and returns id", async () => {
    const fn = mockFetch({ ok: true, json: { id: "s1" } });
    const id = await createSession();
    expect(id).toBe("s1");
    const call = fn.mock.calls[0];
    expect(call).toBeDefined();
    expect(String(call?.[0])).toContain("/session");
    expect((call?.[1] as RequestInit).method).toBe("POST");
  });

  it("createSession throws on non-ok", async () => {
    mockFetch({ ok: false, status: 500 });
    await expect(createSession()).rejects.toThrow(/createSession failed/);
  });

  it("createSession throws when id missing", async () => {
    mockFetch({ ok: true, json: {} });
    await expect(createSession()).rejects.toThrow(/missing id/);
  });

  it("sendMessageAsync posts text parts to /session/{id}/prompt_async", async () => {
    const fn = mockFetch({ ok: true });
    await sendMessageAsync("s1", "hello");
    const call = fn.mock.calls[0];
    expect(call).toBeDefined();
    expect(String(call?.[0])).toContain("/session/s1/prompt_async");
    const init = call?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      parts: [{ type: "text", text: "hello" }],
    });
  });

  it("sendMessageAsync throws on non-ok", async () => {
    mockFetch({ ok: false, status: 400 });
    await expect(sendMessageAsync("s1", "x")).rejects.toThrow(/sendMessageAsync failed/);
  });

  it("logoUrl returns null when there is no logo", () => {
    expect(logoUrl(null)).toBeNull();
  });

  it("logoUrl points at the harness settings logo endpoint", () => {
    const url = logoUrl("logo.png");
    expect(url).toContain("/rpc/settings/logo");
    expect(url).toContain("logo.png");
  });

  it("DEFAULT_SETTINGS matches the frozen shape", () => {
    expect(DEFAULT_SETTINGS.global.systemName).toBe("owx");
    expect(DEFAULT_SETTINGS.personal.theme).toBe("system");
    expect(DEFAULT_SETTINGS.global.knowledgeRoot).toBeNull();
    expect(DEFAULT_SETTINGS.global.logo).toBeNull();
    expect(DEFAULT_SETTINGS.global.accent).toBeNull();
    expect(DEFAULT_SETTINGS.global.defaultProviderId).toBeNull();
    expect(DEFAULT_SETTINGS.global.defaultModelId).toBeNull();
    expect(DEFAULT_SETTINGS.global.defaultAgent).toBeNull();
  });

  it("listModels reads the harness model registry", async () => {
    const fn = mockFetch({ ok: true, json: { source: "https://models.opencode.ai", providers: [] } });
    const catalog = await listModels();
    expect(catalog.source).toContain("models.opencode.ai");
    expect(String(fn.mock.calls[0]?.[0])).toContain("/rpc/models");
  });

  it("listConnectedProviders returns connected ids", async () => {
    const fn = mockFetch({ ok: true, json: { connected: ["anthropic"] } });
    expect(await listConnectedProviders()).toEqual(["anthropic"]);
    expect(String(fn.mock.calls[0]?.[0])).toContain("/provider");
  });

  it("setProviderApiKey PUTs an api credential", async () => {
    const fn = mockFetch({ ok: true });
    await setProviderApiKey("anthropic", "sk-1");
    const call = fn.mock.calls[0];
    expect(String(call?.[0])).toContain("/auth/anthropic");
    const init = call?.[1] as RequestInit;
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ type: "api", key: "sk-1" });
  });

  it("setProviderBaseUrl PATCHes global config", async () => {
    const fn = mockFetch({ ok: true });
    await setProviderBaseUrl("myprovider", "https://api.example.com/v1");
    const call = fn.mock.calls[0];
    expect(String(call?.[0])).toContain("/global/config");
    const init = call?.[1] as RequestInit;
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({
      provider: { myprovider: { options: { baseURL: "https://api.example.com/v1" } } },
    });
  });

  it("removeProviderAuth DELETEs the credential", async () => {
    const fn = mockFetch({ ok: true });
    await removeProviderAuth("anthropic");
    const call = fn.mock.calls[0];
    expect(String(call?.[0])).toContain("/auth/anthropic");
    expect((call?.[1] as RequestInit).method).toBe("DELETE");
  });

  it("projectGet queries /rpc/project/get with the directory", async () => {
    const fn = mockFetch({ ok: true, json: { id: "OWX-0001", name: "demo" } });
    const meta = await projectGet("/tmp/know/demo");
    expect(meta.name).toBe("demo");
    const url = String(fn.mock.calls[0]?.[0]);
    expect(url).toContain("/rpc/project/get");
    expect(url).toContain(encodeURIComponent("/tmp/know/demo"));
  });

  it("projectUpdate posts directory and patch", async () => {
    const fn = mockFetch({ ok: true, json: { name: "y" } });
    await projectUpdate("/tmp/know/demo", { name: "y" });
    const init = fn.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      directory: "/tmp/know/demo",
      patch: { name: "y" },
    });
  });

  it("standardsList returns empty categories when absent", async () => {
    mockFetch({ ok: true, json: {} });
    expect(await standardsList()).toEqual([]);
  });

  it("projectBaseDirs returns the property mapping", async () => {
    mockFetch({
      ok: true,
      json: {
        base_dirs: { 研究專案: { sample_ref: "research", dirs: ["research", "skills"] } },
        properties: ["研究專案"],
      },
    });
    const catalog = await projectBaseDirs();
    expect(catalog.base_dirs["研究專案"]?.sample_ref).toBe("research");
  });

  it("projectApplyBaseDirs posts directory and dirs", async () => {
    const fn = mockFetch({
      ok: true,
      json: { property: "研究專案", dirs: ["research"], created: ["research"], skipped: [], failed: [] },
    });
    const result = await projectApplyBaseDirs("/tmp/know/demo", ["research"]);
    expect(result.created).toEqual(["research"]);
    const init = fn.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(String(fn.mock.calls[0]?.[0])).toContain("/rpc/project/base-dirs/apply");
    expect(JSON.parse(init.body as string)).toEqual({
      directory: "/tmp/know/demo",
      dirs: ["research"],
    });
  });

  it("standardsGet fetches a standard document", async () => {    const fn = mockFetch({ ok: true, json: { id: "ISO-27001", content: "# ISO" } });
    const doc = await standardsGet("ISO-27001");
    expect(doc.content).toBe("# ISO");
    const url = String(fn.mock.calls[0]?.[0]);
    expect(url).toContain("/rpc/standards/get");
    expect(url).toContain("ISO-27001");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { createSession, sendMessageAsync } from "./api";

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
});

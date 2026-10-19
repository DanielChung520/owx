import { describe, expect, it, vi } from "vitest";
import { runBuiltinCommand, type CommandContext } from "./command-actions";

function makeContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    activeSessionId: null,
    newSession: async () => "session-1",
    refreshSessions: async () => {},
    setNotice: () => {},
    openDialog: () => {},
    toggleTheme: () => {},
    focus: () => {},
    goHome: () => {},
    getMessages: () => [],
    ...overrides,
  };
}

describe("runBuiltinCommand", () => {
  it("toggles the theme for /themes", async () => {
    const toggleTheme = vi.fn();
    await runBuiltinCommand("themes", makeContext({ toggleTheme }));
    expect(toggleTheme).toHaveBeenCalledOnce();
  });

  it("focuses the model picker for /models", async () => {
    const focus = vi.fn();
    await runBuiltinCommand("models", makeContext({ focus }));
    expect(focus).toHaveBeenCalledWith('select[aria-label="model"]');
  });

  it("focuses the composer for /editor", async () => {
    const focus = vi.fn();
    await runBuiltinCommand("editor", makeContext({ focus }));
    expect(focus).toHaveBeenCalledWith("#prompt");
  });

  it("goes home for /exit", async () => {
    const goHome = vi.fn();
    await runBuiltinCommand("exit", makeContext({ goHome }));
    expect(goHome).toHaveBeenCalledOnce();
  });

  it("reports unknown commands via notice (no silent no-op)", async () => {
    const setNotice = vi.fn();
    await runBuiltinCommand("does-not-exist", makeContext({ setNotice }));
    expect(setNotice).toHaveBeenCalledOnce();
  });

  it("throws when a session-scoped command has no active session", async () => {
    await expect(runBuiltinCommand("share", makeContext())).rejects.toThrow(
      "no active session",
    );
  });
});

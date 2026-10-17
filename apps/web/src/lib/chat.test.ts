import { describe, expect, it } from "vitest";
import { chatReducer, initialChatState } from "./chat";

describe("chatReducer", () => {
  it("initial state has no messages and is connecting", () => {
    expect(initialChatState.messages).toHaveLength(0);
    expect(initialChatState.status).toBe("connecting");
  });

  it("updates connection status", () => {
    const state = chatReducer(initialChatState, {
      type: "connection",
      status: "live",
    });
    expect(state.status).toBe("live");
  });

  it("appends a new message", () => {
    const state = chatReducer(initialChatState, {
      type: "message",
      message: { id: "1", role: "user", text: "hi" },
    });
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]?.text).toBe("hi");
  });

  it("replaces a message with the same id", () => {
    let state = chatReducer(initialChatState, {
      type: "message",
      message: { id: "1", role: "assistant", text: "a" },
    });
    state = chatReducer(state, {
      type: "message",
      message: { id: "1", role: "assistant", text: "b" },
    });
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]?.text).toBe("b");
  });

  it("clears messages", () => {
    let state = chatReducer(initialChatState, {
      type: "message",
      message: { id: "1", role: "user", text: "hi" },
    });
    state = chatReducer(state, { type: "clear" });
    expect(state.messages).toHaveLength(0);
  });
});

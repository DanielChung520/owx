import { describe, expect, it } from "vitest";
import { mapEvent } from "./events";

describe("mapEvent", () => {
  it("maps enveloped message.updated to a patch with role", () => {
    const action = mapEvent({
      directory: "/x",
      payload: {
        type: "message.updated",
        properties: { info: { id: "m1", role: "assistant" } },
      },
    });
    expect(action).toEqual({ type: "patch", id: "m1", role: "assistant" });
  });

  it("maps a bare text part to a patch with text", () => {
    const action = mapEvent({
      type: "message.part.updated",
      properties: { part: { type: "text", messageID: "m1", text: "hi" } },
    });
    expect(action).toEqual({ type: "patch", id: "m1", text: "hi" });
  });

  it("ignores non-text parts", () => {
    const action = mapEvent({
      type: "message.part.updated",
      properties: { part: { type: "reasoning", messageID: "m1" } },
    });
    expect(action).toBeNull();
  });

  it("ignores unknown event types", () => {
    expect(
      mapEvent({ type: "session.idle", properties: { sessionID: "s1" } }),
    ).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(mapEvent("nope")).toBeNull();
    expect(mapEvent(null)).toBeNull();
    expect(mapEvent({ type: "message.updated" })).toBeNull();
  });
});

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

  it("maps a reasoning part to a patch with reasoning", () => {
    const action = mapEvent({
      type: "message.part.updated",
      properties: { part: { type: "reasoning", messageID: "m1", text: "think" } },
    });
    expect(action).toEqual({ type: "patch", id: "m1", reasoning: "think" });
  });

  it("maps session.status busy to busy", () => {
    const action = mapEvent({
      type: "session.status",
      properties: { sessionID: "s1", status: { type: "busy" } },
    });
    expect(action).toEqual({ type: "busy", busy: true });
  });

  it("maps session.idle to not busy", () => {
    const action = mapEvent({
      type: "session.idle",
      properties: { sessionID: "s1" },
    });
    expect(action).toEqual({ type: "busy", busy: false });
  });

  it("ignores unknown event types", () => {
    expect(
      mapEvent({ type: "server.heartbeat", properties: {} }),
    ).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(mapEvent("nope")).toBeNull();
    expect(mapEvent(null)).toBeNull();
    expect(mapEvent({ type: "message.updated" })).toBeNull();
  });
});

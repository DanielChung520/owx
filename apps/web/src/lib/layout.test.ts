import { describe, expect, it } from "vitest";
import { CHAT_MAX, CHAT_MIN, SIDE_MAX, SIDE_MIN, clamp } from "./layout";

describe("clamp", () => {
  it("returns the value when within range", () => {
    expect(clamp(300, 160, 480)).toBe(300);
  });

  it("clamps below the minimum", () => {
    expect(clamp(10, 160, 480)).toBe(160);
  });

  it("clamps above the maximum", () => {
    expect(clamp(9999, 160, 480)).toBe(480);
  });

  it("respects the panel width constraints", () => {
    expect(clamp(0, SIDE_MIN, SIDE_MAX)).toBe(SIDE_MIN);
    expect(clamp(1000, CHAT_MIN, CHAT_MAX)).toBe(CHAT_MAX);
  });
});

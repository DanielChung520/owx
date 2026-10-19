import { describe, expect, it } from "vitest";
import { BUILTIN_COMMANDS } from "./builtin-commands";
import {
  availableFlat,
  filterCommands,
  groupCommands,
  mergeCommands,
  toServerPalette,
  type PaletteCommand,
} from "./commands";

const sample: PaletteCommand = {
  id: "foo",
  title: "Foo",
  description: "",
  category: "server",
  kind: "server",
  available: true,
};

describe("toServerPalette", () => {
  it("maps server commands to palette entries", () => {
    const result = toServerPalette([
      { name: "init", description: "guided setup", source: "command" },
    ]);
    expect(result).toEqual([
      {
        id: "init",
        title: "init",
        description: "guided setup",
        category: "server",
        kind: "server",
        available: true,
      },
    ]);
  });

  it("defaults a missing description to an empty string", () => {
    expect(toServerPalette([{ name: "a" }])[0]?.description).toBe("");
  });
});

describe("mergeCommands", () => {
  const builtin: PaletteCommand = {
    ...sample,
    id: "models",
    kind: "builtin",
    category: "app",
  };

  it("keeps builtins and appends unique server commands", () => {
    const merged = mergeCommands([builtin], toServerPalette([{ name: "init" }]));
    expect(merged.map((command) => command.id)).toEqual(["models", "init"]);
  });

  it("skips server commands colliding with a builtin id", () => {
    const merged = mergeCommands(
      [builtin],
      toServerPalette([{ name: "models" }, { name: "init" }]),
    );
    expect(merged.map((command) => command.id)).toEqual(["models", "init"]);
    expect(merged.filter((command) => command.id === "models")).toHaveLength(1);
    expect(merged[0]?.kind).toBe("builtin");
  });
});

describe("filterCommands", () => {
  const list: PaletteCommand[] = [
    { ...sample, id: "models", title: "Switch model" },
    { ...sample, id: "compact", title: "Compact session" },
    { ...sample, id: "mcps", title: "List MCP servers" },
  ];

  it("returns all for an empty query", () => {
    expect(filterCommands(list, "")).toHaveLength(3);
  });

  it("ranks prefix matches before contains matches", () => {
    const ids = filterCommands(list, "m").map((command) => command.id);
    expect(ids[0]).toBe("models");
    expect(ids).toEqual(["models", "mcps", "compact"]);
  });

  it("matches by title", () => {
    expect(filterCommands(list, "compact").map((c) => c.id)).toContain("compact");
  });

  it("returns empty when nothing matches", () => {
    expect(filterCommands(list, "zzz")).toHaveLength(0);
  });
});

describe("groupCommands", () => {
  it("groups by category in fixed order and skips empty groups", () => {
    expect(groupCommands(BUILTIN_COMMANDS).map((group) => group.category)).toEqual([
      "app",
      "session",
      "prompt",
      "plugin",
    ]);
  });
});

describe("availableFlat", () => {
  it("excludes unavailable commands", () => {
    const flat = availableFlat(BUILTIN_COMMANDS);
    expect(flat.length).toBeGreaterThan(0);
    expect(flat.every((command) => command.available)).toBe(true);
    expect(flat.some((command) => command.id === "warp")).toBe(false);
  });
});

describe("BUILTIN_COMMANDS catalog", () => {
  it("has unique ids", () => {
    const ids = BUILTIN_COMMANDS.map((command) => command.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every unavailable command a reason", () => {
    for (const command of BUILTIN_COMMANDS) {
      if (!command.available) {
        expect(command.reason).toBeTruthy();
      }
    }
  });

  it("mirrors the opencode built-in command count", () => {
    expect(BUILTIN_COMMANDS).toHaveLength(31);
  });
});

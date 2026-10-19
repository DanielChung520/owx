import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BUILTIN_COMMANDS } from "../lib/builtin-commands";
import { CommandPalette } from "./CommandPalette";

describe("CommandPalette", () => {
  it("renders every command with no cap", () => {
    const html = renderToStaticMarkup(
      <CommandPalette
        commands={BUILTIN_COMMANDS}
        activeId={null}
        onSelect={() => {}}
        onHover={() => {}}
      />,
    );
    const options = html.match(/role="option"/g) ?? [];
    expect(options).toHaveLength(BUILTIN_COMMANDS.length);
  });

  it("renders category group labels", () => {
    const html = renderToStaticMarkup(
      <CommandPalette
        commands={BUILTIN_COMMANDS}
        activeId={null}
        onSelect={() => {}}
        onHover={() => {}}
      />,
    );
    expect(html).toContain("palette-group-label");
    expect(html).toContain("App");
    expect(html).toContain("Session");
  });

  it("marks unavailable options as aria-disabled", () => {
    const html = renderToStaticMarkup(
      <CommandPalette
        commands={BUILTIN_COMMANDS}
        activeId={null}
        onSelect={() => {}}
        onHover={() => {}}
      />,
    );
    expect(html).toContain('aria-disabled="true"');
  });

  it("marks the active option as selected", () => {
    const html = renderToStaticMarkup(
      <CommandPalette
        commands={BUILTIN_COMMANDS}
        activeId="models"
        onSelect={() => {}}
        onHover={() => {}}
      />,
    );
    expect(html).toContain('aria-selected="true"');
  });

  it("renders nothing when there are no commands", () => {
    const html = renderToStaticMarkup(
      <CommandPalette
        commands={[]}
        activeId={null}
        onSelect={() => {}}
        onHover={() => {}}
      />,
    );
    expect(html).toBe("");
  });
});

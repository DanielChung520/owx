import { Fragment } from "react";
import { groupCommands, type PaletteCommand } from "../lib/commands";

/**
 * 指令面板（見 docs/design/frontend.md §2.1、FR-H-11）。
 *
 * 呈現層：不自行持有狀態；鍵盤導覽與選取由 Composer（MessageInput）驅動，
 * 以 `aria-activedescendant` 模式讓焦點留在輸入框。
 */
export function CommandPalette({
  commands,
  activeId,
  onSelect,
  onHover,
}: {
  commands: readonly PaletteCommand[];
  activeId: string | null;
  onSelect: (command: PaletteCommand) => void;
  onHover: (id: string) => void;
}): JSX.Element | null {
  const groups = groupCommands(commands);
  if (groups.length === 0) {
    return null;
  }
  return (
    <ul
      id="command-listbox"
      className="suggest palette"
      role="listbox"
      aria-label="指令"
    >
      {groups.map((group) => (
        <Fragment key={group.category}>
          <li className="palette-group-label" role="presentation">
            {group.label}
          </li>
          {group.commands.map((command) => (
            <li
              key={command.id}
              id={`cmd-${command.id}`}
              role="option"
              aria-selected={command.id === activeId}
              aria-disabled={!command.available}
              className={`palette-option${command.id === activeId ? " active" : ""}`}
              onMouseEnter={() => onHover(command.id)}
              onMouseDown={(event) => {
                event.preventDefault();
                if (command.available) {
                  onSelect(command);
                }
              }}
            >
              <span className="cmd-name">/{command.id}</span>
              <span className="dim">
                {command.available ? command.description : command.reason ?? "unavailable"}
              </span>
            </li>
          ))}
        </Fragment>
      ))}
    </ul>
  );
}

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { findFiles, listCommands } from "../lib/api";
import { BUILTIN_COMMANDS } from "../lib/builtin-commands";
import {
  availableFlat,
  filterCommands,
  invocationFor,
  mergeCommands,
  toServerPalette,
  type PaletteCommand,
} from "../lib/commands";
import { CommandPalette } from "./CommandPalette";

function SendIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 13V3M8 3 3.5 7.5M8 3l4.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MessageInput({
  disabled,
  onSend,
  onCommand,
}: {
  disabled: boolean;
  onSend: (text: string) => void;
  onCommand: (command: PaletteCommand) => void;
}): JSX.Element {
  const [value, setValue] = useState("");
  const [serverCommands, setServerCommands] = useState<PaletteCommand[]>([]);
  const [files, setFiles] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 抓取 opencode server 指令：連線（live）後才抓；`disabled` 由 false→true 亦會重抓。
  useEffect(() => {
    if (disabled) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const list = await listCommands();
        if (!cancelled) {
          setServerCommands(toServerPalette(list));
        }
      } catch {
        if (!cancelled) {
          setServerCommands([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [disabled]);

  const allCommands = useMemo(
    () => mergeCommands(BUILTIN_COMMANDS, serverCommands),
    [serverCommands],
  );

  const commandQuery =
    value.startsWith("/") && !value.includes(" ") ? value.slice(1) : null;

  const matches = useMemo(
    () =>
      commandQuery === null || dismissed
        ? []
        : filterCommands(allCommands, commandQuery),
    [commandQuery, dismissed, allCommands],
  );

  const flat = useMemo(() => availableFlat(matches), [matches]);

  useEffect(() => {
    setDismissed(false);
  }, [commandQuery]);

  useEffect(() => {
    setActiveId((current) => {
      if (current !== null && flat.some((command) => command.id === current)) {
        return current;
      }
      return flat[0]?.id ?? null;
    });
  }, [flat]);

  const select = (command: PaletteCommand): void => {
    if (!command.available) {
      return;
    }
    const invocation = invocationFor(command);
    if (invocation.type === "insert") {
      setValue(invocation.text);
    } else {
      setValue("");
      setDismissed(true);
      onCommand(command);
    }
    textareaRef.current?.focus();
  };

  const move = (delta: number): void => {
    if (flat.length === 0) {
      return;
    }
    const index = flat.findIndex((command) => command.id === activeId);
    const next = (index + delta + flat.length) % flat.length;
    setActiveId(flat[next]?.id ?? null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (matches.length === 0) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Enter" && !event.shiftKey) {
      const active = flat.find((command) => command.id === activeId) ?? flat[0];
      if (active !== undefined) {
        event.preventDefault();
        select(active);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDismissed(true);
    }
  };

  const atMatch = /(?:^|\s)@([^\s]*)$/.exec(value);
  const atQuery = atMatch === null ? null : (atMatch[1] ?? "");

  useEffect(() => {
    if (atQuery === null || atQuery === "") {
      setFiles([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const result = await findFiles(atQuery);
        if (!cancelled) {
          setFiles(result.slice(0, 8));
        }
      } catch {
        if (!cancelled) {
          setFiles([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [atQuery]);

  return (
    <div className="composer-wrap">
      <CommandPalette
        commands={matches}
        activeId={activeId}
        onSelect={select}
        onHover={setActiveId}
      />
      {atQuery !== null && files.length > 0 ? (
        <ul className="suggest">
          {files.map((file) => (
            <li key={file}>
              <button
                type="button"
                onClick={() => setValue(value.replace(/@[^\s]*$/, `@${file} `))}
              >
                {file}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          const text = value.trim();
          if (text !== "") {
            onSend(text);
            setValue("");
          }
        }}
      >
        <label className="sr-only" htmlFor="prompt">
          輸入訊息
        </label>
        <textarea
          id="prompt"
          ref={textareaRef}
          className="composer-input"
          value={value}
          disabled={disabled}
          placeholder={disabled ? "未連線" : "輸入訊息…（/ 指令、@ 檔案）"}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          aria-controls={matches.length > 0 ? "command-listbox" : undefined}
          aria-activedescendant={activeId !== null ? `cmd-${activeId}` : undefined}
        />
        <button
          type="submit"
          className="composer-send"
          aria-label="送出"
          title="送出"
          disabled={disabled || value.trim() === ""}
        >
          <SendIcon />
        </button>
      </form>
    </div>
  );
}

import { useEffect, useState } from "react";
import { findFiles, listCommands, type CommandInfo } from "../lib/api";

export function MessageInput({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (text: string) => void;
}): JSX.Element {
  const [value, setValue] = useState("");
  const [commands, setCommands] = useState<CommandInfo[]>([]);
  const [files, setFiles] = useState<string[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        setCommands(await listCommands());
      } catch {
        setCommands([]);
      }
    })();
  }, []);

  const commandQuery =
    value.startsWith("/") && !value.includes(" ") ? value.slice(1) : null;
  const commandMatches =
    commandQuery === null
      ? []
      : commands
          .filter((command) => command.name.startsWith(commandQuery))
          .slice(0, 8);

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
      {commandMatches.length > 0 ? (
        <ul className="suggest">
          {commandMatches.map((command) => (
            <li key={command.name}>
              <button type="button" onClick={() => setValue(`/${command.name} `)}>
                /{command.name}
                <span className="dim">{command.description}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
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
          rows={2}
          value={value}
          disabled={disabled}
          placeholder={disabled ? "未連線" : "輸入訊息…（/ 指令、@ 檔案）"}
          onChange={(event) => setValue(event.target.value)}
        />
        <button type="submit" disabled={disabled || value.trim() === ""}>
          送出
        </button>
      </form>
    </div>
  );
}

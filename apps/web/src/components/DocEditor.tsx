import { useState } from "react";
import { MarkdownView } from "./MarkdownView";

export type EditorMode = "edit" | "split" | "preview";

const MODE_LABEL: Record<EditorMode, string> = {
  edit: "編輯",
  split: "並排",
  preview: "預覽",
};

const MODES: readonly EditorMode[] = ["edit", "split", "preview"];

export function DocEditor({
  path,
  initial,
  onSave,
  onCancel,
  initialMode = "split",
}: {
  path: string;
  initial: string;
  onSave: (content: string) => Promise<void>;
  onCancel: () => void;
  initialMode?: EditorMode;
}): JSX.Element {
  const [value, setValue] = useState(initial);
  const [mode, setMode] = useState<EditorMode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = (): void => {
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        await onSave(value);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        setBusy(false);
      }
    })();
  };

  return (
    <div className="doc-editor">
      <div className="doc-editor-toolbar">
        <span className="doc-editor-path" title={path}>
          {path}
        </span>
        <div className="doc-editor-modes" role="group" aria-label="編輯模式">
          {MODES.map((item) => (
            <button
              key={item}
              type="button"
              className="btn-ghost"
              aria-pressed={mode === item}
              onClick={() => setMode(item)}
            >
              {MODE_LABEL[item]}
            </button>
          ))}
        </div>
      </div>
      <div className={`doc-editor-body ${mode}`}>
        {mode === "preview" ? null : (
          <textarea
            className="doc-editor-area"
            aria-label={`編輯 ${path}`}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            spellCheck={false}
          />
        )}
        {mode === "edit" ? null : (
          <div className="doc-editor-preview doc-preview">
            <MarkdownView content={value} />
          </div>
        )}
      </div>
      {error !== null ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="form-actions">
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
          取消
        </button>
        <button type="button" className="btn-primary" onClick={save} disabled={busy}>
          {busy ? "儲存中…" : "儲存"}
        </button>
      </div>
    </div>
  );
}

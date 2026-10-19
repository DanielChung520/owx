import { useState } from "react";

export function DocEditor({
  path,
  initial,
  onSave,
  onCancel,
}: {
  path: string;
  initial: string;
  onSave: (content: string) => Promise<void>;
  onCancel: () => void;
}): JSX.Element {
  const [value, setValue] = useState(initial);
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
      <textarea
        className="doc-editor-area"
        aria-label={`編輯 ${path}`}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        spellCheck={false}
      />
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

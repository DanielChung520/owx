import { useState } from "react";
import type { CreatedProject, NewProjectInput } from "../lib/api";

export function NewProjectModal({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (input: NewProjectInput) => Promise<CreatedProject>;
}): JSX.Element {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = (): void => {
    const parsedTags = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag !== "");
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        await onCreate({
          name: name.trim(),
          slug: slug.trim().toLowerCase(),
          tags: parsedTags,
        });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        setBusy(false);
      }
    })();
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="新增專案"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="modal-title">新增專案</h2>
        <form
          className="project-form"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label className="field">
            <span>名稱</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：台股研究"
              required
              autoFocus
            />
          </label>
          <label className="field">
            <span>文件英文名稱（資料夾）</span>
            <input
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="例如：stock-research"
              pattern="[a-z0-9][a-z0-9-]*"
              title="僅小寫英文、數字、連字號"
              required
            />
          </label>
          <label className="field">
            <span>標籤（以「,」分隔多個）</span>
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="例如：finance, research"
            />
          </label>
          <p className="field-hint">
            系統自動生成專案編號與建立時間；路徑 `~/knowledge/&lt;英文名&gt;`。
          </p>
          {error !== null ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
              取消
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={busy || name.trim() === "" || slug.trim() === ""}
            >
              {busy ? "建立中…" : "建立並開啟"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { standardsGet, standardsList, type StandardCategory } from "../lib/api";

export function StandardsModal({ onClose }: { onClose: () => void }): JSX.Element {
  const [categories, setCategories] = useState<StandardCategory[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await standardsList();
        if (cancelled) {
          return;
        }
        setCategories(list);
        const first = list.flatMap((category) => category.standards)[0];
        if (first !== undefined) {
          setActiveId(first.id);
          const owner = list.find((category) =>
            category.standards.some((entry) => entry.id === first.id),
          );
          if (owner !== undefined) {
            setExpanded({ [owner.id]: true });
          }
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeId === null) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const doc = await standardsGet(activeId);
        if (!cancelled) {
          setContent(doc.content);
        }
      } catch (cause) {
        if (!cancelled) {
          setContent("");
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const normalizedQuery = query.trim().toLowerCase();
  const isSearching = normalizedQuery !== "";
  const groups = categories
    .map((category) => ({
      category,
      standards: isSearching
        ? category.standards.filter(
            (entry) =>
              entry.name.toLowerCase().includes(normalizedQuery) ||
              entry.id.toLowerCase().includes(normalizedQuery),
          )
        : category.standards,
    }))
    .filter((group) => group.standards.length > 0);

  const toggleGroup = (id: string): void => {
    setExpanded((prev) => ({ ...prev, [id]: prev[id] !== true }));
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal settings-modal standards-modal"
        role="dialog"
        aria-modal="true"
        aria-label="標準規範"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="standards-header">
          <h2 className="modal-title">標準規範</h2>
          <input
            className="settings-search standards-search"
            type="search"
            value={query}
            placeholder="搜尋標準…"
            aria-label="搜尋標準"
            onChange={(event) => setQuery(event.target.value)}
          />
        </header>

        <div className="standards-body">
          <nav className="settings-nav standards-nav" aria-label="標準清單">
            {categories.length === 0 ? (
              <p className="field-hint">規範目錄未設置（`owx-Standard.json`）。</p>
            ) : groups.length === 0 ? (
              <p className="field-hint">無符合的標準。</p>
            ) : (
              groups.map(({ category, standards }) => {
                const isExpanded = isSearching || expanded[category.id] === true;
                return (
                  <div key={category.id} className="standards-group">
                    <button
                      type="button"
                      className="standards-group-toggle"
                      aria-expanded={isExpanded}
                      onClick={() => toggleGroup(category.id)}
                    >
                      <span className="standards-group-caret" aria-hidden="true">
                        {isExpanded ? "▾" : "▸"}
                      </span>
                      <span className="standards-group-label">
                        {category.name}
                        {category.required === true ? "（必要）" : ""}
                      </span>
                    </button>
                    {isExpanded
                      ? standards.map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            className={activeId === entry.id ? "active" : ""}
                            aria-pressed={activeId === entry.id}
                            onClick={() => setActiveId(entry.id)}
                          >
                            {entry.name}
                          </button>
                        ))
                      : null}
                  </div>
                );
              })
            )}
          </nav>

          <div className="standards-content">
            {error !== null ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            {content === "" ? (
              <p className="field-hint">選擇左側標準以檢視內容。</p>
            ) : (
              <div className="doc-preview" id="doc-scroll">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

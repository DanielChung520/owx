import { useEffect, useMemo, useState } from "react";
import {
  projectApplyBaseDirs,
  projectBaseDirs,
  projectGet,
  projectUpdate,
  standardsList,
  type AppliedBaseDirs,
  type BaseDirsCatalog,
  type ProjectProperties,
  type StandardCategory,
} from "../lib/api";

type Tab = "basic" | "dirs" | "standard" | "params";

const NAV: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: "basic", label: "基本資料" },
  { id: "dirs", label: "基礎目錄範例" },
  { id: "standard", label: "文件撰寫規範" },
  { id: "params", label: "參數" },
];

const CONFIDENTIALITY_LEVELS: readonly string[] = ["絕對機密", "機密", "一般"];

const FALLBACK_PROPERTIES: readonly string[] = [
  "系統開發文件",
  "公司手冊",
  "產品文件",
  "專利文件",
  "流程規劃",
  "研究專案",
  "一般報告",
];

export function parseTags(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(",")) {
    const tag = raw.trim();
    if (tag !== "" && !seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
  }
  return out;
}

export function describeApply(result: AppliedBaseDirs): string {
  const parts: string[] = [];
  if (result.created.length > 0) {
    parts.push(`已建立：${result.created.join("、")}`);
  }
  if (result.skipped.length > 0) {
    parts.push(`已存在（略過）：${result.skipped.join("、")}`);
  }
  if (result.failed.length > 0) {
    parts.push(`未建立：${result.failed.join("、")}`);
  }
  return parts.length === 0 ? "沒有需要建立的資料夾。" : parts.join("；");
}

export function ProjectPropertyModal({
  directory,
  onClose,
  onSaved,
}: {
  directory: string;
  onClose: () => void;
  onSaved: (notice: string) => void;
}): JSX.Element {
  const [tab, setTab] = useState<Tab>("basic");
  const [draft, setDraft] = useState<ProjectProperties | null>(null);
  const [tagsText, setTagsText] = useState("");
  const [categories, setCategories] = useState<StandardCategory[]>([]);
  const [catalog, setCatalog] = useState<BaseDirsCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyNotice, setApplyNotice] = useState<string | null>(null);

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
        const [meta, list, dirs] = await Promise.all([
          projectGet(directory),
          standardsList().catch(() => [] as StandardCategory[]),
          projectBaseDirs().catch(() => null),
        ]);
        if (cancelled) {
          return;
        }
        setDraft(meta);
        setTagsText((meta.tags ?? []).join(", "));
        setCategories(list);
        setCatalog(dirs);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [directory]);

  const propertyOptions = catalog?.properties ?? [...FALLBACK_PROPERTIES];
  const selectedProperty = draft?.properties?.[0] ?? "";
  const suggestedDirs = useMemo(() => {
    if (selectedProperty === "" || catalog === null) {
      return [];
    }
    return catalog.base_dirs[selectedProperty]?.dirs ?? [];
  }, [selectedProperty, catalog]);

  const effectiveDirs = useMemo(() => {
    const maintained = draft?.base_dirs?.dirs ?? [];
    return maintained.length > 0 ? maintained : suggestedDirs;
  }, [draft?.base_dirs?.dirs, suggestedDirs]);

  const patch = (next: Partial<ProjectProperties>): void =>
    setDraft((prev) => (prev === null ? prev : { ...prev, ...next }));

  const setStandard = (next: Partial<NonNullable<ProjectProperties["writing_standard"]>>): void =>
    setDraft((prev) =>
      prev === null ? prev : { ...prev, writing_standard: { ...prev.writing_standard, ...next } },
    );

  const toggleDir = (dir: string): void => {
    setApplyNotice(null);
    setDraft((prev) => {
      if (prev === null) {
        return prev;
      }
      const current = prev.base_dirs?.dirs ?? [];
      const dirs = current.includes(dir)
        ? current.filter((item) => item !== dir)
        : [...current, dir];
      return { ...prev, base_dirs: { ...prev.base_dirs, dirs } };
    });
  };

  const toggleCompliance = (id: string): void =>
    setDraft((prev) => {
      if (prev === null) {
        return prev;
      }
      const current = prev.writing_standard?.compliance ?? [];
      const compliance = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      return { ...prev, writing_standard: { ...prev.writing_standard, compliance } };
    });

  const pickProperty = (value: string): void => {
    setApplyNotice(null);
    setDraft((prev) => {
      if (prev === null) {
        return prev;
      }
      const sampleRef = catalog?.base_dirs[value]?.sample_ref ?? null;
      const dirs = catalog?.base_dirs[value]?.dirs ?? prev.base_dirs?.dirs ?? [];
      return {
        ...prev,
        properties: value === "" ? [] : [value],
        base_dirs: { ...prev.base_dirs, sample_ref: sampleRef, dirs },
      };
    });
  };

  const submit = (): void => {
    if (draft === null) {
      return;
    }
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        await projectUpdate(directory, {
          name: draft.name,
          name_en: draft.name_en ?? null,
          tags: parseTags(tagsText),
          properties: draft.properties ?? [],
          base_dirs: draft.base_dirs,
          writing_standard: draft.writing_standard,
          params: draft.params,
        });
        onSaved("專案屬性已儲存");
        onClose();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        setBusy(false);
      }
    })();
  };

  const applyDirs = (): void => {
    if (draft === null) {
      return;
    }
    const dirs = effectiveDirs;
    if (dirs.length === 0) {
      setApplyNotice("尚無可生成的資料夾清單，請先於「基礎目錄範例」勾選。");
      return;
    }
    void (async () => {
      setApplying(true);
      setApplyNotice(null);
      setError(null);
      try {
        setApplyNotice(describeApply(await projectApplyBaseDirs(directory, dirs)));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setApplying(false);
      }
    })();
  };

  const ws = draft?.writing_standard;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="專案屬性設定"
        onClick={(event) => event.stopPropagation()}
      >
        <nav className="settings-nav" aria-label="屬性分類">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? "active" : ""}
              aria-pressed={tab === item.id}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="settings-body">
          {draft === null ? (
            <p className="field-hint">載入中…</p>
          ) : (
            <>
              {tab === "basic" ? (
                <div className="settings-panel">
                  <label className="field">
                    <span>ID（系統生成）</span>
                    <input value={draft.id ?? "（未編號）"} readOnly disabled />
                  </label>
                  <label className="field">
                    <span>名稱（中文）</span>
                    <input
                      value={draft.name ?? ""}
                      onChange={(event) => patch({ name: event.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>名稱（英文）</span>
                    <input
                      value={draft.name_en ?? ""}
                      onChange={(event) => patch({ name_en: event.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>目錄名（已建立後唯讀）</span>
                    <input value={draft.slug ?? ""} readOnly disabled />
                  </label>
                  <label className="field">
                    <span>專案屬性</span>
                    <select value={selectedProperty} onChange={(event) => pickProperty(event.target.value)}>
                      <option value="">（未指定）</option>
                      {propertyOptions.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="field">
                    <span>專案預設資料夾</span>
                    <p className="field-hint">
                      {selectedProperty === ""
                        ? "選擇專案屬性後，可於「基礎目錄範例」勾選清單並建立。"
                        : `依「${selectedProperty}」預設：${effectiveDirs.join("、") || "（無）"}（於「基礎目錄範例」建立）`}
                    </p>
                  </div>
                  <label className="field">
                    <span>標籤（以「,」分隔多個）</span>
                    <input
                      value={tagsText}
                      onChange={(event) => setTagsText(event.target.value)}
                      placeholder="例如：finance, research"
                    />
                  </label>
                </div>
              ) : null}

              {tab === "dirs" ? (
                <div className="settings-panel">
                  {selectedProperty === "" ? (
                    <p className="field-hint">請先於「基本資料」選擇專案屬性。</p>
                  ) : (
                    <>
                      <label className="field">
                        <span>建議基礎目錄（可勾選）</span>
                        <div className="check-list">
                          {suggestedDirs.map((dir) => (
                            <label key={dir} className="check-row">
                              <input
                                type="checkbox"
                                checked={(draft.base_dirs?.dirs ?? []).includes(dir)}
                                onChange={() => toggleDir(dir)}
                              />
                              <span>{dir}</span>
                            </label>
                          ))}
                        </div>
                      </label>
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={draft.base_dirs?.enabled === true}
                          onChange={(event) =>
                            patch({
                              base_dirs: { ...draft.base_dirs, enabled: event.target.checked },
                            })
                          }
                        />
                        <span>依此清單生成專案資料夾（冪等，不覆蓋既有內容）</span>
                      </label>
                      <div className="field">
                        <div className="base-dirs-actions">
                          <button
                            type="button"
                            className="btn-ghost"
                            disabled={applying || effectiveDirs.length === 0}
                            onClick={applyDirs}
                          >
                            {applying ? "建立中…" : "立即建立資料夾"}
                          </button>
                          <span className="field-hint">
                            依上方清單建立缺少的目錄；已存在或自訂的目錄不覆蓋、不刪除。
                          </span>
                        </div>
                        {applyNotice !== null ? (
                          <p className="field-hint" role="status">
                            {applyNotice}
                          </p>
                        ) : null}
                      </div>
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={draft.params?.show_hidden === true}
                          onChange={(event) =>
                            patch({
                              params: { ...draft.params, show_hidden: event.target.checked },
                            })
                          }
                        />
                        <span>顯示隱藏檔案（預設：不顯示）</span>
                      </label>
                      <p className="field-hint">
                        以「.」開頭的檔案與目錄；關閉時檔案總管不列出（僅影響顯示，不改動檔案）。
                      </p>
                    </>
                  )}
                </div>
              ) : null}

              {tab === "standard" ? (
                <div className="settings-panel">
                  <h3 className="settings-section-title">基礎規範</h3>
                  {(
                    [
                      ["versioning", "文件必須版本管理"],
                      ["require_title", "須有標題"],
                      ["require_revision", "須有版次"],
                      ["require_change_log", "須有變更履歷"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="check-row">
                      <input
                        type="checkbox"
                        checked={ws?.[key] === true}
                        onChange={(event) => setStandard({ [key]: event.target.checked })}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                  <label className="field">
                    <span>預設機密等級</span>
                    <select
                      value={ws?.confidentiality_default ?? "一般"}
                      onChange={(event) =>
                        setStandard({ confidentiality_default: event.target.value })
                      }
                    >
                      {CONFIDENTIALITY_LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </label>

                  <h3 className="settings-section-title">文件提交</h3>
                  {(
                    [
                      ["consistency", "檢查一致性"],
                      ["objectivity", "檢查客觀屬實"],
                      ["audit", "設置審計流程"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="check-row">
                      <input
                        type="checkbox"
                        checked={ws?.submit_checks?.[key] === true}
                        onChange={(event) =>
                          setStandard({
                            submit_checks: {
                              ...ws?.submit_checks,
                              [key]: event.target.checked,
                            },
                          })
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}

                  <h3 className="settings-section-title">依循規範</h3>
                  {categories.length === 0 ? (
                    <p className="field-hint">規範目錄未設置（`owx-Standard.json`）。</p>
                  ) : (
                    categories.map((category) => (
                      <div key={category.id}>
                        <p className="field-hint">
                          {category.name}
                          {category.required === true ? "（必要）" : ""}
                        </p>
                        {category.standards.map((entry) => (
                          <label key={entry.id} className="check-row">
                            <input
                              type="checkbox"
                              checked={
                                entry.required === true ||
                                (ws?.compliance ?? []).includes(entry.id)
                              }
                              disabled={entry.required === true}
                              onChange={() => toggleCompliance(entry.id)}
                            />
                            <span>{entry.name}</span>
                          </label>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              ) : null}

              {tab === "params" ? (
                <div className="settings-panel">
                  <label className="field">
                    <span>自動保存草稿（分鐘；0＝停用）</span>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      value={draft.params?.autosave_minutes ?? 10}
                      onChange={(event) => {
                        const value = Number.parseInt(event.target.value, 10);
                        patch({
                          params: {
                            ...draft.params,
                            autosave_minutes: Number.isNaN(value) ? 0 : value,
                          },
                        });
                      }}
                    />
                  </label>
                  <p className="field-hint">其餘參數（AI 建議）待後續輪次擴充。</p>
                </div>
              ) : null}
            </>
          )}

          {error !== null ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="settings-actions">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
              取消
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={submit}
              disabled={busy || draft === null}
            >
              {busy ? "儲存中…" : "儲存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

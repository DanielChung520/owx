import { useEffect, useState } from "react";
import {
  logoUrl,
  uploadLogo,
  type ProviderGroup,
  type Settings,
  type ThemeMode,
} from "../lib/api";
import { ModelsProviders } from "./ModelsProviders";

export type SettingsTab = "general" | "appearance" | "model";

const SETTINGS_TABS: ReadonlyArray<{ id: SettingsTab; label: string }> = [
  { id: "general", label: "一般" },
  { id: "appearance", label: "外觀" },
  { id: "model", label: "模型" },
];

const THEME_OPTIONS: ReadonlyArray<{ value: ThemeMode; label: string }> = [
  { value: "dark", label: "深" },
  { value: "light", label: "淺" },
  { value: "system", label: "隨系統" },
];

const FALLBACK_ACCENT = "#034cff";

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

function splitDataUrl(dataUrl: string): { base64: string; ext: string } | null {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (match === null) {
    return null;
  }
  const mime = match[1];
  const base64 = match[2];
  if (mime === undefined || base64 === undefined) {
    return null;
  }
  const ext = MIME_EXT[mime];
  return ext === undefined ? null : { base64, ext };
}

export function SettingsModal({
  settings,
  providers,
  agents,
  onSave,
  onClose,
  initialParamTab = "general",
}: {
  settings: Settings;
  providers: ProviderGroup[];
  agents: string[];
  onSave: (next: Settings) => Promise<void>;
  onClose: () => void;
  initialParamTab?: SettingsTab;
}): JSX.Element {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialParamTab);
  const [draft, setDraft] = useState<Settings>(() => ({
    global: { ...settings.global },
    personal: { ...settings.personal },
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const setGlobal = (patch: Partial<Settings["global"]>): void =>
    setDraft((prev) => ({ ...prev, global: { ...prev.global, ...patch } }));
  const setPersonal = (patch: Partial<Settings["personal"]>): void =>
    setDraft((prev) => ({ ...prev, personal: { ...prev.personal, ...patch } }));

  const selectedProvider =
    providers.find((item) => item.id === draft.global.defaultProviderId) ?? null;
  const models = selectedProvider?.models ?? [];

  const onLogoChange = (file: File): void => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      const parsed = splitDataUrl(dataUrl);
      if (parsed === null) {
        setError("不支援的圖片格式");
        return;
      }
      void (async () => {
        try {
          setError(null);
          const result = await uploadLogo(parsed.base64, parsed.ext);
          setGlobal({ logo: result.logo });
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      })();
    };
    reader.readAsDataURL(file);
  };

  const submit = (): void => {
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        await onSave(draft);
        onClose();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        setBusy(false);
      }
    })();
  };

  const logoPreview = logoUrl(draft.global.logo);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="系統設置"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="settings-body">
          <h2 className="modal-title">系統設置</h2>

          <div className="settings-subtabs" role="tablist">
            {SETTINGS_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={activeTab === item.id}
                className={activeTab === item.id ? "active" : ""}
                onClick={() => setActiveTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {activeTab === "general" ? (
            <div className="settings-panel">
              <label className="field">
                <span>系統名稱</span>
                <input
                  value={draft.global.systemName}
                  onChange={(event) => setGlobal({ systemName: event.target.value })}
                />
              </label>

              <label className="field">
                <span>知識根目錄</span>
                <input
                  value={draft.global.knowledgeRoot ?? ""}
                  placeholder="~/knowledge（留空＝沿用 OWX_KNOWLEDGE_DIR）"
                  onChange={(event) =>
                    setGlobal({
                      knowledgeRoot: event.target.value === "" ? null : event.target.value,
                    })
                  }
                />
              </label>
            </div>
          ) : null}

          {activeTab === "appearance" ? (
            <div className="settings-panel">
              <div className="field">
                <span>Logo</span>
                <div className="logo-row">
                  {logoPreview !== null ? (
                    <img className="brand-logo" src={logoPreview} alt="logo" height={22} />
                  ) : null}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file !== undefined) {
                        onLogoChange(file);
                      }
                    }}
                  />
                </div>
              </div>

              <div className="field">
                <span>品牌主色</span>
                <div className="accent-row">
                  <input
                    type="color"
                    value={draft.global.accent ?? FALLBACK_ACCENT}
                    onChange={(event) => setGlobal({ accent: event.target.value })}
                  />
                  <code className="accent-value">{draft.global.accent ?? "（預設）"}</code>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setGlobal({ accent: null })}
                  >
                    清除
                  </button>
                </div>
              </div>

              <div className="field">
                <span>主題</span>
                <div className="theme-options">
                  {THEME_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={`theme-option${
                        draft.personal.theme === option.value ? " active" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="theme"
                        value={option.value}
                        checked={draft.personal.theme === option.value}
                        onChange={() => setPersonal({ theme: option.value })}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "model" ? (
            <>
              <div className="settings-panel">
                <label className="field">
                  <span>預設 provider</span>
                  <select
                    value={draft.global.defaultProviderId ?? ""}
                    onChange={(event) =>
                      setGlobal({
                        defaultProviderId: event.target.value === "" ? null : event.target.value,
                        defaultModelId: null,
                      })
                    }
                  >
                    <option value="">（未指定）</option>
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name ?? provider.id}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>預設 model</span>
                  <select
                    value={draft.global.defaultModelId ?? ""}
                    disabled={selectedProvider === null}
                    onChange={(event) =>
                      setGlobal({
                        defaultModelId: event.target.value === "" ? null : event.target.value,
                      })
                    }
                  >
                    <option value="">（未指定）</option>
                    {models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.id}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>預設 agent</span>
                  <select
                    value={draft.global.defaultAgent ?? ""}
                    onChange={(event) =>
                      setGlobal({
                        defaultAgent: event.target.value === "" ? null : event.target.value,
                      })
                    }
                  >
                    <option value="">（未指定）</option>
                    {agents.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <ModelsProviders />
            </>
          ) : null}

          {error !== null ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="settings-actions">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
              取消
            </button>
            <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
              {busy ? "儲存中…" : "儲存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

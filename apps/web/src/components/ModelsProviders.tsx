import { useEffect, useMemo, useState } from "react";
import {
  listConnectedProviders,
  listModels,
  removeProviderAuth,
  setProviderApiKey,
  setProviderBaseUrl,
  type ModelProvider,
} from "../lib/api";

export function ModelsProviders(): JSX.Element {
  const [catalog, setCatalog] = useState<ModelProvider[] | null>(null);
  const [source, setSource] = useState("");
  const [connected, setConnected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ id: "", key: "", baseUrl: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = (): void => {
    void (async () => {
      try {
        const models = await listModels();
        setCatalog(models.providers);
        setSource(models.source);
      } catch (cause) {
        setCatalog([]);
        setError(cause instanceof Error ? cause.message : String(cause));
      }
      try {
        setConnected(await listConnectedProviders());
      } catch {
        setConnected([]);
      }
    })();
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    if (catalog === null) {
      return null;
    }
    const needle = query.trim().toLowerCase();
    if (needle === "") {
      return catalog;
    }
    return catalog
      .map((provider) => ({
        ...provider,
        models: provider.models.filter(
          (model) =>
            model.id.toLowerCase().includes(needle) ||
            model.name.toLowerCase().includes(needle),
        ),
      }))
      .filter(
        (provider) =>
          provider.id.toLowerCase().includes(needle) ||
          provider.name.toLowerCase().includes(needle) ||
          provider.models.length > 0,
      );
  }, [catalog, query]);

  const connect = (): void => {
    const id = form.id.trim();
    if (id === "" || form.key.trim() === "") {
      setError("Provider ID 與 API Key 為必填");
      return;
    }
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        await setProviderApiKey(id, form.key.trim());
        if (form.baseUrl.trim() !== "") {
          await setProviderBaseUrl(id, form.baseUrl.trim());
        }
        setForm({ id: "", key: "", baseUrl: "" });
        setConnected(await listConnectedProviders());
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setBusy(false);
      }
    })();
  };

  const remove = (id: string): void => {
    if (!window.confirm(`移除 ${id} 的憑證？`)) {
      return;
    }
    void (async () => {
      try {
        await removeProviderAuth(id);
        setConnected(await listConnectedProviders());
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    })();
  };

  return (
    <>
      <div className="settings-panel">
        <h3 className="settings-section-title">模型下載清單</h3>
        <p className="field-hint">
          來源：opencode 預設 registry（{source !== "" ? source : "https://models.opencode.ai"}）。
        </p>
        <input
          className="settings-search"
          value={query}
          placeholder="搜尋 provider／model…"
          aria-label="搜尋模型"
          onChange={(event) => setQuery(event.target.value)}
        />
        {filtered === null ? (
          <p className="field-hint">載入中…</p>
        ) : filtered.length === 0 ? (
          <p className="field-hint">（無資料）</p>
        ) : (
          <ul className="model-list">
            {filtered.map((provider) => (
              <li key={provider.id}>
                <details>
                  <summary>
                    {provider.name}
                    <span className="model-count">{provider.models.length}</span>
                  </summary>
                  <ul className="model-sublist">
                    {provider.models.map((model) => (
                      <li key={model.id}>{model.name}</li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="settings-panel">
        <h3 className="settings-section-title">Provider 連線（等同 opencode /connect）</h3>
        <div className="provider-form">
          <label className="field">
            <span>Provider ID</span>
            <input
              value={form.id}
              placeholder="例如 anthropic／myprovider"
              onChange={(event) => setForm({ ...form, id: event.target.value })}
            />
          </label>
          <label className="field">
            <span>API Key</span>
            <input
              type="password"
              value={form.key}
              onChange={(event) => setForm({ ...form, key: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Base URL（可留空）</span>
            <input
              value={form.baseUrl}
              placeholder="https://api.example.com/v1"
              onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
            />
          </label>
          <button type="button" className="btn-primary" onClick={connect} disabled={busy}>
            {busy ? "連線中…" : "連線"}
          </button>
        </div>

        <h4 className="settings-subtitle">已連線 provider</h4>
        {connected.length === 0 ? (
          <p className="field-hint">（尚未連線任何 provider）</p>
        ) : (
          <ul className="provider-list">
            {connected.map((id) => (
              <li key={id}>
                <span>{id}</span>
                <button type="button" className="btn-ghost" onClick={() => remove(id)}>
                  移除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error !== null ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

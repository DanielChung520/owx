import type { ProviderGroup } from "../lib/api";
import type { ConnStatus } from "../lib/types";

const LABELS: Record<ConnStatus, string> = {
  connecting: "連線中",
  live: "已連線",
  reconnecting: "重連中",
  closed: "未連線",
};

export function Header({
  status,
  title,
  agent,
  model,
  agents,
  providers,
  onAgent,
  onModel,
}: {
  status: ConnStatus;
  title?: string;
  agent?: string;
  model?: string;
  agents: string[];
  providers: ProviderGroup[];
  onAgent: (name: string) => void;
  onModel: (providerID: string, id: string) => void;
}): JSX.Element {
  return (
    <header className="header">
      <div className="header-left">
        <span className="brand">owx</span>
        {title !== undefined ? <span className="title">{title}</span> : null}
      </div>
      <div className="header-right">
        <select
          className="picker"
          aria-label="agent"
          value={agent ?? ""}
          onChange={(event) => onAgent(event.target.value)}
        >
          {agent === undefined ? <option value="">agent…</option> : null}
          {agents.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          className="picker"
          aria-label="model"
          value={model ?? ""}
          onChange={(event) => {
            const slash = event.target.value.indexOf("/");
            if (slash > 0) {
              onModel(
                event.target.value.slice(0, slash),
                event.target.value.slice(slash + 1),
              );
            }
          }}
        >
          {model === undefined ? <option value="">model…</option> : null}
          {providers.map((group) => (
            <optgroup key={group.id} label={group.name ?? group.id}>
              {group.models.map((m) => (
                <option key={`${group.id}/${m.id}`} value={`${group.id}/${m.id}`}>
                  {m.id}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <span className={`status status-${status}`} aria-live="polite">
          {LABELS[status]}
        </span>
      </div>
    </header>
  );
}

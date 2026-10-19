import type { ProviderGroup, SessionSummary } from "../lib/api";
import type { ConnStatus } from "../lib/types";
import { SessionMenu } from "./SessionMenu";

type ConnLight = "green" | "red" | "gray";

function connLight(status: ConnStatus): ConnLight {
  if (status === "live") {
    return "green";
  }
  if (status === "reconnecting") {
    return "red";
  }
  return "gray";
}

const LIGHT_LABELS: Record<ConnLight, string> = {
  green: "已連線",
  red: "連線異常",
  gray: "未連接",
};

export function Header({
  status,
  agent,
  model,
  agents,
  providers,
  sessions,
  activeId,
  onAgent,
  onModel,
  onSelectSession,
  onNewSession,
  docCollapsed,
  onToggleDoc,
}: {
  status: ConnStatus;
  agent?: string;
  model?: string;
  agents: string[];
  providers: ProviderGroup[];
  sessions: readonly SessionSummary[];
  activeId: string | null;
  onAgent: (name: string) => void;
  onModel: (providerID: string, id: string) => void;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  docCollapsed: boolean;
  onToggleDoc: () => void;
}): JSX.Element {
  const light = connLight(status);
  return (
    <header className="header">
      <div className="header-left">
        <span
          className={`conn conn-${light}`}
          role="status"
          aria-label={LIGHT_LABELS[light]}
          title={LIGHT_LABELS[light]}
        />
        <SessionMenu
          sessions={sessions}
          activeId={activeId}
          onSelect={onSelectSession}
          onNew={onNewSession}
        />
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
        <button
          type="button"
          className="icon-btn"
          aria-label={docCollapsed ? "顯示文件" : "隱藏文件"}
          title={docCollapsed ? "顯示文件" : "隱藏文件"}
          onClick={onToggleDoc}
        >
          ▤
        </button>
      </div>
    </header>
  );
}

import type { ProviderGroup, SessionSummary } from "../lib/api";
import type { ConnStatus } from "../lib/types";
import { DropdownButton, type DropdownItem } from "./DropdownButton";

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

function SessionIcon(): JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M2 4h12M2 8h12M2 12h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AgentIcon(): JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="5.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M3 14c0-2.6 2.2-4.5 5-4.5s5 1.9 5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function ModelIcon(): JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="4.5" y="4.5" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M6.5 1.5v2.2M9.5 1.5v2.2M6.5 12.3v2.2M9.5 12.3v2.2M1.5 6.5h2.2M1.5 9.5h2.2M12.3 6.5h2.2M12.3 9.5h2.2"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

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
  const sessionItems: DropdownItem[] = [
    { label: "＋ 新增 session", onSelect: onNewSession },
    ...sessions.map((session) => ({
      label: session.title ?? session.id,
      active: session.id === activeId,
      onSelect: () => onSelectSession(session.id),
    })),
  ];
  const agentItems: DropdownItem[] = agents.map((name) => ({
    label: name,
    active: name === agent,
    onSelect: () => onAgent(name),
  }));
  const modelItems: DropdownItem[] = providers.flatMap((group) =>
    group.models.map((item) => ({
      label: item.id,
      group: group.name ?? group.id,
      active: `${group.id}/${item.id}` === model,
      onSelect: () => onModel(group.id, item.id),
    })),
  );

  return (
    <header className="header">
      <div className="header-left">
        <span
          className={`conn conn-${light}`}
          role="status"
          aria-label={LIGHT_LABELS[light]}
          title={LIGHT_LABELS[light]}
        />
      </div>
      <div className="header-right">
        <DropdownButton icon={<SessionIcon />} label="session" items={sessionItems} />
        <DropdownButton icon={<AgentIcon />} label="agent" items={agentItems} />
        <DropdownButton icon={<ModelIcon />} label="model" items={modelItems} />
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

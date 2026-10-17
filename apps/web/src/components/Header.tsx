import type { ConnStatus } from "../lib/types";

const LABELS: Record<ConnStatus, string> = {
  connecting: "連線中",
  live: "已連線",
  reconnecting: "重連中",
  closed: "未連線",
};

export function Header({ status }: { status: ConnStatus }): JSX.Element {
  return (
    <header className="header">
      <span className="brand">owx</span>
      <span className={`status status-${status}`} aria-live="polite">
        {LABELS[status]}
      </span>
    </header>
  );
}

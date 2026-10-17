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
  context,
}: {
  status: ConnStatus;
  title?: string;
  context?: string;
}): JSX.Element {
  return (
    <header className="header">
      <div className="header-left">
        <span className="brand">owx</span>
        {title !== undefined ? <span className="title">{title}</span> : null}
      </div>
      <div className="header-right">
        {context !== undefined ? (
          <span className="context">{context}</span>
        ) : null}
        <span className={`status status-${status}`} aria-live="polite">
          {LABELS[status]}
        </span>
      </div>
    </header>
  );
}

import type { SessionSummary } from "../lib/api";

export function Sidebar({
  sessions,
  activeId,
  onSelect,
}: {
  sessions: SessionSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
}): JSX.Element {
  return (
    <aside className="sidebar" aria-label="Sessions">
      <h1>Sessions</h1>
      <ul className="session-list">
        {sessions.map((session) => (
          <li key={session.id}>
            <button
              type="button"
              className={`session${session.id === activeId ? " active" : ""}`}
              onClick={() => onSelect(session.id)}
            >
              {session.title ?? session.id}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

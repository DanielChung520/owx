import type { SessionSummary } from "../lib/api";

const NEW_SESSION = "__new__";

export function SessionMenu({
  sessions,
  activeId,
  onSelect,
  onNew,
}: {
  sessions: readonly SessionSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}): JSX.Element {
  return (
    <select
      className="picker session-menu"
      aria-label="session"
      value={activeId ?? ""}
      onChange={(event) => {
        const value = event.target.value;
        if (value === NEW_SESSION) {
          onNew();
          return;
        }
        onSelect(value);
      }}
    >
      {activeId === null ? <option value="">（未選取 session）</option> : null}
      <option value={NEW_SESSION}>+ 新增 session</option>
      {sessions.map((session) => (
        <option key={session.id} value={session.id}>
          {session.title ?? session.id}
        </option>
      ))}
    </select>
  );
}

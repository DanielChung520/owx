export function Sidebar({
  activeSession,
}: {
  activeSession: string | null;
}): JSX.Element {
  return (
    <aside className="sidebar" aria-label="Sessions">
      <h1>Sessions</h1>
      <div className={`session${activeSession === null ? " active" : ""}`}>
        {activeSession ?? "new session"}
      </div>
    </aside>
  );
}

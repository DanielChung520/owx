export type SidePanel = "explorer" | "outline" | "graph";

function ExplorerIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M1.5 3.5h4l1.2 1.5h7.8v7.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function OutlineIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M2 4h2M6 4h8M2 8h2M6 8h8M2 12h2M6 12h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GraphIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        <circle cx="4" cy="4" r="1.8" />
        <circle cx="12" cy="5" r="1.8" />
        <circle cx="8" cy="12" r="1.8" />
        <path d="M5.4 5.1l5-0.6M4.8 5.6l2.5 4.8M11.2 6.5l-2.5 4.2" />
      </g>
    </svg>
  );
}

function SettingsIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        <circle cx="8" cy="8" r="2.2" />
        <path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M12.6 3.4l-1.3 1.3M4.7 11.3l-1.3 1.3" />
      </g>
    </svg>
  );
}

export function ActivityBar({
  active,
  collapsed,
  onSelect,
  onSettingsMenu,
}: {
  active: SidePanel;
  collapsed: boolean;
  onSelect: (panel: SidePanel) => void;
  onSettingsMenu: (anchor: { right: number; bottom: number }) => void;
}): JSX.Element {
  return (
    <nav className="activitybar" aria-label="活動列">
      <button
        type="button"
        className={`activity${active === "explorer" && !collapsed ? " active" : ""}`}
        aria-pressed={active === "explorer" && !collapsed}
        aria-label="檔案總管"
        title="Explorer"
        onClick={() => onSelect("explorer")}
      >
        <ExplorerIcon />
      </button>
      <button
        type="button"
        className={`activity${active === "outline" && !collapsed ? " active" : ""}`}
        aria-pressed={active === "outline" && !collapsed}
        aria-label="大綱"
        title="Outline"
        onClick={() => onSelect("outline")}
      >
        <OutlineIcon />
      </button>
      <button
        type="button"
        className={`activity${active === "graph" && !collapsed ? " active" : ""}`}
        aria-pressed={active === "graph" && !collapsed}
        aria-label="知識圖譜"
        title="Knowledge Graph"
        onClick={() => onSelect("graph")}
      >
        <GraphIcon />
      </button>
      <div className="activitybar-bottom">
        <button
          type="button"
          className="activity"
          aria-haspopup="menu"
          aria-label="設定"
          title="Settings"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            onSettingsMenu({ right: rect.right, bottom: rect.bottom });
          }}
        >
          <SettingsIcon />
        </button>
      </div>
    </nav>
  );
}

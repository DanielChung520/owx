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
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="8" cy="8" r="3.8" />
        <path d="M12.2 8h2.2M8 12.2v2.2M3.8 8H1.6M8 3.8V1.6M10.97 10.97l1.56 1.56M5.03 10.97l-1.56 1.56M10.97 5.03l1.56-1.56M5.03 5.03L3.47 3.47" />
      </g>
    </svg>
  );
}

function AvatarIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        <circle cx="8" cy="8" r="6.5" />
        <circle cx="8" cy="6.1" r="2.1" />
        <path d="M3.9 13.1a4.6 4.6 0 0 1 8.2 0" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function SunIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3.05 3.05l1.13 1.13M11.82 11.82l1.13 1.13M12.95 3.05l-1.13 1.13M4.18 11.82l-1.13 1.13" />
      </g>
    </svg>
  );
}

function MoonIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M13.4 9.7A5.6 5.6 0 0 1 6.3 2.6a5.6 5.6 0 1 0 7.1 7.1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ActivityBar({
  active,
  collapsed,
  dark,
  onSelect,
  onProfile,
  onTheme,
  onSettingsMenu,
}: {
  active: SidePanel;
  collapsed: boolean;
  dark: boolean;
  onSelect: (panel: SidePanel) => void;
  onProfile: () => void;
  onTheme: () => void;
  onSettingsMenu: (anchor: { right: number; bottom: number }) => void;
}): JSX.Element {
  return (
    <nav className="activitybar" aria-label="活動列">
      <div className="activitybar-top">
        <button
          type="button"
          className="activity activity-logo"
          aria-label="owx"
          title="owx"
        >
          <img src="/owx-logo.svg" alt="owx logo" />
        </button>
      </div>
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
          className="activity activity-avatar"
          aria-label="個人頭像"
          title="個人頭像"
          onClick={onProfile}
        >
          <AvatarIcon />
        </button>
        <button
          type="button"
          className="activity"
          aria-label="主題樣式"
          title={dark ? "切換為淺色主題" : "切換為深色主題"}
          onClick={onTheme}
        >
          {dark ? <SunIcon /> : <MoonIcon />}
        </button>
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

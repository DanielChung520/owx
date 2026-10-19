import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

export interface DropdownItem {
  label: string;
  onSelect: () => void;
  active?: boolean;
  group?: string;
}

const MENU_WIDTH = 220;

export function DropdownButton({
  icon,
  label,
  items,
}: {
  icon: ReactNode;
  label: string;
  items: readonly DropdownItem[];
}): JSX.Element {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pos === null) {
      return;
    }
    const close = (event: MouseEvent): void => {
      if (ref.current !== null && !ref.current.contains(event.target as Node)) {
        setPos(null);
      }
    };
    const onResize = (): void => setPos(null);
    document.addEventListener("mousedown", close);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("resize", onResize);
    };
  }, [pos]);

  useEffect(() => {
    if (pos !== null) {
      inputRef.current?.focus();
    }
  }, [pos]);

  const open = (event: ReactMouseEvent<HTMLButtonElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    setQuery("");
    setPos({
      left: Math.max(8, rect.right - MENU_WIDTH),
      top: rect.bottom + 4,
    });
  };

  const normalized = query.trim().toLowerCase();
  const filtered =
    normalized === ""
      ? items
      : items.filter(
          (item) =>
            item.label.toLowerCase().includes(normalized) ||
            (item.group?.toLowerCase().includes(normalized) ?? false),
        );

  return (
    <span className="dropdown" ref={ref}>
      <button
        type="button"
        className={`icon-btn${pos !== null ? " active" : ""}`}
        aria-haspopup="menu"
        aria-expanded={pos !== null}
        aria-label={label}
        title={label}
        onClick={(event) => (pos !== null ? setPos(null) : open(event))}
      >
        {icon}
      </button>
      {pos !== null ? (
        <div
          className="ctx-menu dropdown-menu"
          style={{ left: pos.left, top: pos.top }}
          role="menu"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <input
            ref={inputRef}
            className="dropdown-search"
            type="text"
            value={query}
            placeholder="搜尋…"
            aria-label={`搜尋 ${label}`}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setPos(null);
              } else if (event.key === "Enter") {
                const first = filtered[0];
                if (first !== undefined) {
                  setPos(null);
                  first.onSelect();
                }
              }
            }}
          />
          {filtered.length === 0 ? (
            <span className="dropdown-empty">（無）</span>
          ) : (
            filtered.map((item, index) => (
              <Fragment key={`${item.label}-${index}`}>
                {item.group !== undefined && item.group !== filtered[index - 1]?.group ? (
                  <div className="dropdown-group">{item.group}</div>
                ) : null}
                <button
                  type="button"
                  className={`menu-item${item.active === true ? " active" : ""}${
                    item.group !== undefined ? " grouped" : ""
                  }`}
                  role="menuitem"
                  onClick={() => {
                    setPos(null);
                    item.onSelect();
                  }}
                >
                  {item.label}
                </button>
              </Fragment>
            ))
          )}
        </div>
      ) : null}
    </span>
  );
}

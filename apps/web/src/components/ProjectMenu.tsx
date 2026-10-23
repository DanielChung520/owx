import { useEffect, useRef, useState } from "react";

export function ProjectMenu({
  onOpen,
  onNew,
  onClose,
  onPropertySettings,
}: {
  onOpen: () => void;
  onNew: () => void;
  onClose: () => void;
  onPropertySettings: () => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDocClick = (event: MouseEvent): void => {
      if (ref.current !== null && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const run = (action: () => void): void => {
    setOpen(false);
    action();
  };

  return (
    <div className="menu" ref={ref}>
      <button
        type="button"
        className="icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="專案選單"
        title="專案選單"
        onClick={() => setOpen((value) => !value)}
      >
        ⋯
      </button>
      {open ? (
        <div className="menu-list" role="menu">
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            onClick={() => run(onOpen)}
          >
            開啟專案
          </button>
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            onClick={() => run(onNew)}
          >
            新增專案
          </button>
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            onClick={() => run(onClose)}
          >
            關閉專案
          </button>
          <div className="menu-separator" role="separator" />
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            onClick={() => run(onPropertySettings)}
          >
            專案屬性設定
          </button>
        </div>
      ) : null}
    </div>
  );
}

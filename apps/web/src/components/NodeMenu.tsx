import { Fragment, useEffect } from "react";

export interface NodeMenuItem {
  label: string;
  onSelect: () => void;
}

export function NodeMenu({
  x,
  y,
  groups,
  onClose,
}: {
  x: number;
  y: number;
  groups: readonly (readonly NodeMenuItem[])[];
  onClose: () => void;
}): JSX.Element {
  useEffect(() => {
    const close = (): void => onClose();
    document.addEventListener("mousedown", close);
    window.addEventListener("blur", close);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("blur", close);
    };
  }, [onClose]);

  const visible = groups.filter((group) => group.length > 0);

  return (
    <div
      className="ctx-menu"
      style={{ left: x, top: y }}
      role="menu"
      onMouseDown={(event) => event.stopPropagation()}
    >
      {visible.map((group, groupIndex) => (
        <Fragment key={groupIndex}>
          {groupIndex > 0 ? <div className="ctx-sep" role="separator" /> : null}
          {group.map((item) => (
            <button
              key={item.label}
              type="button"
              className="menu-item"
              role="menuitem"
              onClick={() => {
                onClose();
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </Fragment>
      ))}
    </div>
  );
}

import { useEffect } from "react";

export interface SettingsItem {
  key: string;
  label: string;
  onSelect: () => void;
}

export function SettingsMenu({
  left,
  bottom,
  items,
  onClose,
}: {
  left: number;
  bottom: number;
  items: readonly SettingsItem[];
  onClose: () => void;
}): JSX.Element {
  useEffect(() => {
    const close = (): void => onClose();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      const hit = items.find(
        (item) => item.key.toLowerCase() === event.key.toLowerCase(),
      );
      if (hit !== undefined) {
        event.preventDefault();
        onClose();
        hit.onSelect();
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [items, onClose]);

  return (
    <div
      className="ctx-menu settings-menu"
      style={{ left, bottom }}
      role="menu"
      onMouseDown={(event) => event.stopPropagation()}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className="menu-item"
          role="menuitem"
          onClick={() => {
            onClose();
            item.onSelect();
          }}
        >
          <span>{item.label}</span>
          <span className="kbd">[{item.key}]</span>
        </button>
      ))}
    </div>
  );
}

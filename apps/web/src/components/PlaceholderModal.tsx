import { useEffect } from "react";

export const FEATURE_MAINTENANCE_ITEMS: readonly string[] = [
  "模組／外掛清單（啟用停用、狀態）",
  "功能開關（feature flags：KG／Doc-Edit／Standards）",
  "MCP servers 管理",
  "版本／更新檢查",
];

export const ACCOUNT_MAINTENANCE_ITEMS: readonly string[] = [
  "profile 清單（新增／切換／刪除）",
  "當前帳號資訊",
  "provider 認證",
  "權限／角色",
  "登出",
];

export function PlaceholderModal({
  title,
  items,
  onClose,
}: {
  title: string;
  items: readonly string[];
  onClose: () => void;
}): JSX.Element {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="settings-body">
          <h2 className="modal-title">{title}</h2>
          <ul className="settings-list">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="field-hint">尚未實作（佔位）。</p>
          <div className="settings-actions">
            <button type="button" className="btn-primary" onClick={onClose}>
              關閉
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

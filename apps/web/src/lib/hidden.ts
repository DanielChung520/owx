/** 隱藏項目判定：名稱以 `.` 開頭（dotfile／dotdir）。 */
export function isHiddenName(name: string): boolean {
  return name.startsWith(".");
}

/**
 * 依 `show_hidden` 參數過濾檔案總管項目。
 * 預設（`false`）不列出隱藏項目；僅影響顯示，不改動檔案系統。
 */
export function filterHidden<T extends { name: string }>(
  entries: T[],
  showHidden: boolean,
): T[] {
  return showHidden ? entries : entries.filter((entry) => !isHiddenName(entry.name));
}

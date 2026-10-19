import type { OutlineItem } from "../lib/outline";

export function DocumentOutline({
  items,
  onSelect,
}: {
  items: readonly OutlineItem[];
  onSelect: (id: string) => void;
}): JSX.Element {
  if (items.length === 0) {
    return <p className="panel-empty">此文件沒有標題（H1–H6）。</p>;
  }
  return (
    <ul className="outline">
      {items.map((item, index) => (
        <li key={`${item.id}-${index}`} className={`outline-item level-${item.level}`}>
          <button type="button" onClick={() => onSelect(item.id)}>
            {item.text}
          </button>
        </li>
      ))}
    </ul>
  );
}

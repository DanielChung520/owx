import type { OutlineItem } from "../lib/outline";
import { parseOutline } from "../lib/outline";
import { MarkdownView } from "./MarkdownView";

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

function scrollToHeading(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function MarkdownDocView({
  content,
  showOutline,
}: {
  content: string;
  showOutline: boolean;
}): JSX.Element {
  const outline = parseOutline(content);
  return (
    <div className="doc-body">
      {showOutline ? (
        <aside className="doc-outline" aria-label="文件大綱">
          <div className="panel-header">
            <span className="panel-title">大綱</span>
          </div>
          <DocumentOutline items={outline} onSelect={scrollToHeading} />
        </aside>
      ) : null}
      <div className="doc-preview" id="doc-scroll">
        <MarkdownView content={content} />
      </div>
    </div>
  );
}

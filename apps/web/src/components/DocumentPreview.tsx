import { baseName, isMarkdown, isText } from "../lib/files";
import { MarkdownView } from "./MarkdownView";

export function DocumentPreview({
  path,
  content,
}: {
  path: string | null;
  content: string | null;
}): JSX.Element {
  if (path === null) {
    return (
      <div className="doc-preview empty">
        <p>從左側檔案總管選擇一份文件以預覽。</p>
      </div>
    );
  }
  if (!isMarkdown(path)) {
    if (isText(path)) {
      return (
        <div className="doc-preview" id="doc-scroll">
          <pre className="doc-text">{content ?? ""}</pre>
        </div>
      );
    }
    return (
      <div className="doc-preview empty">
        <p>此格式（非 md／文字）尚不支援預覽：{baseName(path)}</p>
      </div>
    );
  }
  return (
    <div className="doc-preview" id="doc-scroll">
      <MarkdownView content={content ?? ""} />
    </div>
  );
}

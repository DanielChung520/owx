import { isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { baseName, isMarkdown, isText } from "../lib/files";
import { slugify } from "../lib/outline";

function nodeText(node: ReactNode): string {
  if (typeof node === "string") {
    return node;
  }
  if (typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map((child) => nodeText(child as ReactNode)).join("");
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return nodeText(node.props.children);
  }
  return "";
}

function Heading({
  level,
  children,
}: {
  level: number;
  children?: ReactNode;
}): JSX.Element {
  const id = slugify(nodeText(children));
  switch (level) {
    case 1:
      return <h1 id={id}>{children}</h1>;
    case 2:
      return <h2 id={id}>{children}</h2>;
    case 3:
      return <h3 id={id}>{children}</h3>;
    case 4:
      return <h4 id={id}>{children}</h4>;
    case 5:
      return <h5 id={id}>{children}</h5>;
    default:
      return <h6 id={id}>{children}</h6>;
  }
}

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
      <ReactMarkdown
        components={{
          h1: ({ children }) => <Heading level={1}>{children}</Heading>,
          h2: ({ children }) => <Heading level={2}>{children}</Heading>,
          h3: ({ children }) => <Heading level={3}>{children}</Heading>,
          h4: ({ children }) => <Heading level={4}>{children}</Heading>,
          h5: ({ children }) => <Heading level={5}>{children}</Heading>,
          h6: ({ children }) => <Heading level={6}>{children}</Heading>,
        }}
      >
        {content ?? ""}
      </ReactMarkdown>
    </div>
  );
}

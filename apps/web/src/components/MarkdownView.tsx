import { isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { slugify } from "../lib/outline";
import { MermaidBlock } from "./MermaidBlock";

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

/** Chart source of a fenced ```mermaid block, or null for other code blocks. */
function mermaidChart(children: ReactNode): string | null {
  if (!isValidElement<{ className?: string; children?: ReactNode }>(children)) {
    return null;
  }
  const className = children.props.className ?? "";
  if (!className.split(/\s+/).includes("language-mermaid")) {
    return null;
  }
  return nodeText(children.props.children).replace(/\n$/, "");
}

/**
 * Single Markdown renderer for preview, editor split view and standards modal.
 *
 * Uses CommonMark + GFM (tables, task lists, strikethrough, autolinks,
 * footnotes) and renders ```mermaid fences as diagrams.
 */
export function MarkdownView({ content }: { content: string }): JSX.Element {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <Heading level={1}>{children}</Heading>,
        h2: ({ children }) => <Heading level={2}>{children}</Heading>,
        h3: ({ children }) => <Heading level={3}>{children}</Heading>,
        h4: ({ children }) => <Heading level={4}>{children}</Heading>,
        h5: ({ children }) => <Heading level={5}>{children}</Heading>,
        h6: ({ children }) => <Heading level={6}>{children}</Heading>,
        table: ({ children }) => (
          <div className="md-table">
            <table>{children}</table>
          </div>
        ),
        pre: ({ children }) => {
          const chart = mermaidChart(children);
          if (chart !== null) {
            return <MermaidBlock chart={chart} />;
          }
          return <pre>{children}</pre>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

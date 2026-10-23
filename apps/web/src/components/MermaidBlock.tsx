import { useEffect, useId, useState } from "react";

/**
 * Renders a Mermaid diagram from a fenced ```mermaid block.
 *
 * Mermaid is loaded on demand (dynamic import) so the initial bundle stays lean;
 * until the SVG is ready the raw chart is shown, and render errors degrade to a
 * readable message plus the source instead of breaking the preview.
 */
export function MermaidBlock({ chart }: { chart: string }): JSX.Element {
  const rawId = useId();
  const id = `mermaid-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setError(null);
    void (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
        });
        const result = await mermaid.render(id, chart);
        if (!cancelled) {
          setSvg(result.svg);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error !== null) {
    return (
      <div className="mermaid-block error" data-testid="mermaid">
        <p className="field-hint">Mermaid 圖表渲染失敗：{error}</p>
        <pre>{chart}</pre>
      </div>
    );
  }
  if (svg === null) {
    return (
      <div className="mermaid-block" data-testid="mermaid" aria-busy="true">
        <pre>{chart}</pre>
      </div>
    );
  }
  return (
    <div
      className="mermaid-block"
      data-testid="mermaid"
      // Mermaid output is an SVG produced by mermaid with securityLevel "strict".
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

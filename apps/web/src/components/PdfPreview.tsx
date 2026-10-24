import { useEffect, useRef, useState } from "react";
import { loadPdf } from "../lib/pdf";

const THUMB_WIDTH = 132;

function PdfThumb({
  src,
  pageNum,
  active,
  onClick,
}: {
  src: string;
  pageNum: number;
  active: boolean;
  onClick: () => void;
}): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const renderThumb = async (): Promise<void> => {
      try {
        const pdf = await loadPdf(src);
        if (cancelled) return;
        const page = await pdf.getPage(pageNum);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1 });
        const scale = THUMB_WIDTH / viewport.width;
        const scaledViewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext("2d");
        if (!context) return;
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        await page.render({ canvasContext: context, viewport: scaledViewport, canvas }).promise;
      } catch {
        // noop
      }
    };
    void renderThumb();
    return () => {
      cancelled = true;
    };
  }, [src, pageNum]);

  return (
    <button type="button" className={active ? "pdf-thumb active" : "pdf-thumb"} onClick={onClick}>
      <canvas ref={canvasRef} />
      <span className="pdf-thumb-label">{pageNum}</span>
    </button>
  );
}

export function PdfPreview({ src, showOutline }: { src: string; showOutline: boolean }): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [activePage, setActivePage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const pdf = await loadPdf(src);
        if (cancelled) return;
        setPageCount(pdf.numPages);
        setActivePage(1);
        const container = containerRef.current;
        if (!container || cancelled) return;
        container.innerHTML = "";
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
          if (cancelled) break;
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.2 });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) continue;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "pdf-page";
          canvas.dataset.page = String(pageNum);
          container.appendChild(canvas);
          await page.render({ canvasContext: context, viewport, canvas }).promise;
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "pdf_load_failed");
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [src]);

  const scrollToPage = (pageNum: number): void => {
    setActivePage(pageNum);
    containerRef.current
      ?.querySelector<HTMLElement>(`[data-page="${pageNum}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (error) {
    return (
      <div className="doc-preview empty">
        <p>PDF 載入失敗：{error}</p>
        <a href={src} target="_blank" rel="noreferrer">
          直接開啟 PDF
        </a>
      </div>
    );
  }

  return (
    <div className="pdf-layout">
      {showOutline ? (
        <aside className="doc-outline" aria-label="PDF 頁面縮圖">
          <div className="panel-header">
            <span className="panel-title">頁面</span>
          </div>
          <div className="pdf-thumbs">
            {Array.from({ length: pageCount }, (_, index) => {
              const pageNum = index + 1;
              return (
                <PdfThumb
                  key={pageNum}
                  src={src}
                  pageNum={pageNum}
                  active={activePage === pageNum}
                  onClick={() => scrollToPage(pageNum)}
                />
              );
            })}
          </div>
        </aside>
      ) : null}
      <div className="pdf-viewer" ref={containerRef} />
    </div>
  );
}

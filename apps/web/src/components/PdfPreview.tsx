import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export function PdfPreview({ src }: { src: string }): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const pdf = await pdfjsLib.getDocument({ url: src }).promise;
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

  return <div className="pdf-viewer" ref={containerRef} />;
}

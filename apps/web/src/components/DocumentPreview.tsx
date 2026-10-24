import {
  baseName,
  isAudio,
  isHtml,
  isImage,
  isMarkdown,
  isOffice,
  isPdf,
  isText,
  isVideo,
} from "../lib/files";
import { MarkdownDocView } from "./DocumentOutline";
import { PdfPreview } from "./PdfPreview";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { useEffect, useState } from "react";

function DocxPreview({ src }: { src: string }): JSX.Element {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`http_${res.status}`);
        const buf = await res.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer: buf });
        if (!cancelled) setHtml(result.value);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "docx_load_failed");
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
        <p>DOCX 載入失敗：{error}</p>
        <a href={src} target="_blank" rel="noreferrer">
          下載檢視
        </a>
      </div>
    );
  }
  if (html === null) {
    return (
      <div className="doc-preview empty">
        <p>載入 DOCX...</p>
      </div>
    );
  }
  return <div className="doc-preview docx" dangerouslySetInnerHTML={{ __html: html }} />;
}

function XlsxPreview({ src }: { src: string }): JSX.Element {
  const [sheets, setSheets] = useState<Record<string, string[][]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`http_${res.status}`);
        const buf = await res.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const next: Record<string, string[][]> = {};
        for (const name of wb.SheetNames) {
          const ws = wb.Sheets[name];
          if (!ws) continue;
          next[name] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as string[][];
        }
        if (!cancelled) {
          setSheets(next);
          setActive(wb.SheetNames[0] ?? "");
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "xlsx_load_failed");
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
        <p>XLSX 載入失敗：{error}</p>
        <a href={src} target="_blank" rel="noreferrer">
          下載檢視
        </a>
      </div>
    );
  }
  if (sheets === null) {
    return (
      <div className="doc-preview empty">
        <p>載入 XLSX...</p>
      </div>
    );
  }
  const rows = sheets[active] ?? [];
  return (
    <div className="doc-preview xlsx">
      <div className="xlsx-tabs">
        {Object.keys(sheets).map((name) => (
          <button
            key={name}
            className={name === active ? "active" : ""}
            onClick={() => setActive(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="xlsx-table-wrap">
        <table className="xlsx-table">
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c}>{String(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DocumentPreview({
  path,
  content,
  directory,
  outlineOpen = false,
}: {
  path: string | null;
  content: string | null;
  directory?: string | null;
  outlineOpen?: boolean;
}): JSX.Element {
  if (path === null) {
    return (
      <div className="doc-preview empty">
        <p>從左側檔案總管選擇一份文件以預覽。</p>
      </div>
    );
  }

  const rawSrc =
    directory && path
      ? `/rpc/fs/raw?directory=${encodeURIComponent(directory)}&path=${encodeURIComponent(path)}`
      : `/rpc/fs/raw?path=${encodeURIComponent(path)}`;

  if (isImage(path)) {
    return (
      <div className="doc-preview image">
        <img src={rawSrc} alt={baseName(path)} loading="lazy" />
      </div>
    );
  }

  if (isPdf(path)) {
    return (
      <div className="doc-preview pdf">
        <PdfPreview src={rawSrc} showOutline={outlineOpen} />
      </div>
    );
  }

  if (isHtml(path)) {
    return (
      <div className="doc-preview html">
        <iframe src={rawSrc} title={baseName(path)} sandbox="" />
      </div>
    );
  }

  if (isAudio(path)) {
    return (
      <div className="doc-preview media">
        <audio controls src={rawSrc}>
          您的瀏覽器不支援 audio 標籤。
        </audio>
      </div>
    );
  }

  if (isVideo(path)) {
    return (
      <div className="doc-preview media">
        <video controls src={rawSrc}>
          您的瀏覽器不支援 video 標籤。
        </video>
      </div>
    );
  }

  if (isOffice(path)) {
    const ext = path.toLowerCase();
    if (ext.endsWith(".docx")) {
      return <DocxPreview src={rawSrc} />;
    }
    if (ext.endsWith(".xlsx") || ext.endsWith(".xlsm")) {
      return <XlsxPreview src={rawSrc} />;
    }
    return (
      <div className="doc-preview empty">
        <p>
          Office 檔案（{baseName(path)}）暫不支援線上預覽：
          <a href={rawSrc} target="_blank" rel="noreferrer">
            下載檢視
          </a>
        </p>
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
        <p>此格式尚不支援預覽：{baseName(path)}</p>
      </div>
    );
  }
  return <MarkdownDocView content={content ?? ""} showOutline={outlineOpen} />;
}

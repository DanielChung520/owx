import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const cache = new Map<string, Promise<pdfjsLib.PDFDocumentProxy>>();

export function loadPdf(url: string): Promise<pdfjsLib.PDFDocumentProxy> {
  const existing = cache.get(url);
  if (existing) {
    return existing;
  }
  const promise = pdfjsLib.getDocument({ url }).promise.catch((err) => {
    cache.delete(url);
    throw err;
  });
  cache.set(url, promise);
  return promise;
}

export type { PDFDocumentProxy } from "pdfjs-dist";

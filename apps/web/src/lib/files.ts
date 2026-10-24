export function isMarkdown(path: string): boolean {
  return /\.(md|markdown)$/i.test(path);
}

export function isArchive(path: string): boolean {
  return /\.(zip|tar\.gz|tgz|tar)$/i.test(path);
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|ico|svg)$/i;
const PDF_EXT = /\.pdf$/i;
const HTML_EXT = /\.(html?|)/i;
const AUDIO_EXT = /\.(mp3|wav|ogg|m4a)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov)$/i;
const OFFICE_EXT = /\.(docx|xlsx|xlsm|pptx)$/i;

const TEXT_EXT =
  /\.(md|markdown|txt|csv|tsv|json|jsonc|ya?ml|toml|ini|log|ts|tsx|js|jsx|mjs|cjs|rs|py|go|java|c|h|cpp|css|sh|xml|sql|conf)$/i;

export function isImage(path: string): boolean {
  return IMAGE_EXT.test(path);
}

export function isPdf(path: string): boolean {
  return PDF_EXT.test(path);
}

export function isHtml(path: string): boolean {
  return HTML_EXT.test(path);
}

export function isAudio(path: string): boolean {
  return AUDIO_EXT.test(path);
}

export function isVideo(path: string): boolean {
  return VIDEO_EXT.test(path);
}

export function isOffice(path: string): boolean {
  return OFFICE_EXT.test(path);
}

export function isText(path: string): boolean {
  return TEXT_EXT.test(path);
}

export function baseName(path: string): string {
  const trimmed = path.replace(/\/$/, "");
  const parts = trimmed.split("/").filter((part) => part !== "");
  return parts[parts.length - 1] ?? trimmed;
}

export function nodePath(path: string): string {
  return path.replace(/\/+$/, "");
}

export function joinPath(dir: string, name: string): string {
  const base = dir.endsWith("/") ? dir : `${dir}/`;
  return `${base}${name}`;
}

export function parentPath(path: string): string {
  const trimmed = path.replace(/\/$/, "");
  const index = trimmed.lastIndexOf("/");
  return index < 0 ? "" : trimmed.slice(0, index);
}

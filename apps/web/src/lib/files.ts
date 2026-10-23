export function isMarkdown(path: string): boolean {
  return /\.(md|markdown)$/i.test(path);
}

export function isArchive(path: string): boolean {
  return /\.(zip|tar\.gz|tgz|tar)$/i.test(path);
}

const TEXT_EXT =
  /\.(md|markdown|txt|csv|tsv|json|jsonc|ya?ml|toml|ini|log|ts|tsx|js|jsx|mjs|cjs|rs|py|go|java|c|h|cpp|css|html?|sh|xml|sql)$/i;

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

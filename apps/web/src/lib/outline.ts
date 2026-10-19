export interface OutlineItem {
  level: number;
  text: string;
  id: string;
}

export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function parseOutline(markdown: string): OutlineItem[] {
  const items: OutlineItem[] = [];
  let inFence = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (match === null) {
      continue;
    }
    const hashes = match[1];
    const text = match[2];
    if (hashes === undefined || text === undefined) {
      continue;
    }
    items.push({ level: hashes.length, text, id: slugify(text) });
  }
  return items;
}

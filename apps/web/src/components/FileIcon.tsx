const COLORS: Record<string, string> = {
  folder: "#dcb67a",
  markdown: "#519aba",
  image: "#a074c4",
  data: "#89d185",
  archive: "#cc8b3e",
  pdf: "#e05252",
  code: "#e37933",
  file: "#8a8a8a",
};

const MARKS: Record<string, string> = {
  markdown: "M",
  code: "<>",
  data: "=",
  image: "▧",
  archive: "▤",
  pdf: "P",
};

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

function familyOf(name: string, directory: boolean): string {
  if (directory) {
    return "folder";
  }
  const ext = extensionOf(name);
  if (ext === "md" || ext === "markdown") return "markdown";
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"].includes(ext)) {
    return "image";
  }
  if (["json", "csv", "tsv", "yaml", "yml", "toml", "xml", "ini"].includes(ext)) {
    return "data";
  }
  if (["zip", "tar", "gz", "tgz", "rar", "7z"].includes(ext)) {
    return "archive";
  }
  if (ext === "pdf") {
    return "pdf";
  }
  if (
    [
      "ts",
      "tsx",
      "js",
      "jsx",
      "mjs",
      "cjs",
      "rs",
      "py",
      "go",
      "java",
      "c",
      "h",
      "cpp",
      "rb",
      "php",
      "sh",
      "css",
      "html",
      "htm",
      "sql",
    ].includes(ext)
  ) {
    return "code";
  }
  return "file";
}

export function FileIcon({
  name,
  type,
}: {
  name: string;
  type: "file" | "directory";
}): JSX.Element {
  const kind = familyOf(name, type === "directory");
  const color = COLORS[kind] ?? COLORS.file;
  if (kind === "folder") {
    return (
      <svg className="ft-icon" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" style={{ color }}>
        <path
          d="M1.5 3.5h4l1.2 1.5h7.8v7.2a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z"
          fill="currentColor"
          opacity="0.85"
        />
      </svg>
    );
  }
  const mark = MARKS[kind];
  return (
    <svg className="ft-icon" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" style={{ color }}>
      <path
        d="M3 1.5h6.6L13 5V14a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 3 14z"
        fill="currentColor"
        opacity="0.85"
      />
      {mark !== undefined ? (
        <text x="8" y="11.5" fontSize="5.5" textAnchor="middle" fill="#ffffff">
          {mark}
        </text>
      ) : null}
    </svg>
  );
}

/**
 * 指令面板（CommandPalette）之型別與純函式。
 *
 * 來源兩半（見 docs/design/frontend.md §2.1、docs/spec/base-core-requirements.md FR-H-11）：
 * - `server`：以 opencode `GET /command` 為權威，即時取得。
 * - `builtin`：opencode TUI 內建指令之**鏡射目錄**（opencode 無此 API），為 owx 自有常數。
 */

export type CommandCategory = "server" | "app" | "session" | "prompt" | "plugin";

export type CommandKind = "server" | "builtin";

export interface PaletteCommand {
  /** 指令 id（不含前導斜線），例如 `models`。 */
  id: string;
  /** 顯示標題。 */
  title: string;
  /** 一行描述（可為空字串）。 */
  description: string;
  category: CommandCategory;
  kind: CommandKind;
  /** 是否可在此（瀏覽器）環境執行。 */
  available: boolean;
  /** 不可用之原因（`available === false` 時應提供）。 */
  reason?: string;
}

export interface ServerCommand {
  name: string;
  description?: string;
  source?: string;
}

/** 類別之固定顯示順序與標籤。 */
export const CATEGORY_ORDER: readonly CommandCategory[] = [
  "server",
  "app",
  "session",
  "prompt",
  "plugin",
];

export const CATEGORY_LABELS: Record<CommandCategory, string> = {
  server: "Server",
  app: "App",
  session: "Session",
  prompt: "Prompt",
  plugin: "Plugin",
};

/** 將 opencode `GET /command` 之 server 指令轉為面板項目。 */
export function toServerPalette(server: readonly ServerCommand[]): PaletteCommand[] {
  return server.map((command) => ({
    id: command.name,
    title: command.name,
    description: command.description ?? "",
    category: "server",
    kind: "server",
    available: true,
  }));
}

/**
 * 合併內建鏡射與 server 指令。
 * 內建一律保留；server 指令若與內建同 id 則略過（避免重複）。
 */
export function mergeCommands(
  builtin: readonly PaletteCommand[],
  server: readonly PaletteCommand[],
): PaletteCommand[] {
  const ids = new Set(builtin.map((command) => command.id));
  const serverUnique = server.filter((command) => !ids.has(command.id));
  return [...builtin, ...serverUnique];
}

/**
 * 依 query 過濾。空 query 回全部。
 * 排序：id／title 前綴命中優先，其次為包含命中；同層維持原順序。
 */
export function filterCommands(
  commands: readonly PaletteCommand[],
  query: string,
): PaletteCommand[] {
  const q = query.trim().toLowerCase();
  if (q === "") {
    return [...commands];
  }
  const prefix: PaletteCommand[] = [];
  const contains: PaletteCommand[] = [];
  for (const command of commands) {
    const id = command.id.toLowerCase();
    const title = command.title.toLowerCase();
    if (id.startsWith(q) || title.startsWith(q)) {
      prefix.push(command);
    } else if (id.includes(q) || title.includes(q)) {
      contains.push(command);
    }
  }
  return [...prefix, ...contains];
}

export interface CommandGroup {
  category: CommandCategory;
  label: string;
  commands: PaletteCommand[];
}

/** 依 category 分組，維持 CATEGORY_ORDER 之固定順序；空群組略過。 */
export function groupCommands(commands: readonly PaletteCommand[]): CommandGroup[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    commands: commands.filter((command) => command.category === category),
  })).filter((group) => group.commands.length > 0);
}

/** 供鍵盤導覽用之扁平順序（與畫面群組順序一致），僅含可用指令。 */
export function availableFlat(commands: readonly PaletteCommand[]): PaletteCommand[] {
  return groupCommands(commands)
    .flatMap((group) => group.commands)
    .filter((command) => command.available);
}

export type CommandInvocation = { type: "insert"; text: string } | { type: "run" };

/** 選取語意：server 指令插入文字（可續補 `$ARGUMENTS`）；內建指令立即執行。 */
export function invocationFor(command: PaletteCommand): CommandInvocation {
  return command.kind === "server"
    ? { type: "insert", text: `/${command.id} ` }
    : { type: "run" };
}

/**
 * 內建指令之執行情派（dispatcher）。
 *
 * 與 UI 解耦：`CommandContext` 由 App 提供（server 呼叫走 api.ts，client 行為走回呼），
 * 因此本模組可在 node 環境以 mock context 單元測試（見 command-actions.test.ts）。
 */

import * as api from "./api";
import { BUILTIN_COMMANDS } from "./builtin-commands";

export interface CommandDialogPayload {
  title: string;
  body: string;
}

export interface CommandContext {
  activeSessionId: string | null;
  newSession: () => Promise<string>;
  refreshSessions: () => Promise<void>;
  /** 顯示／清除一行狀態提示。 */
  setNotice: (message: string | null) => void;
  openDialog: (payload: CommandDialogPayload) => void;
  toggleTheme: () => void;
  /** 依 CSS selector 聚焦元素（models／agents／editor／timeline 用）。 */
  focus: (selector: string) => void;
  /** 回到未選取 session 的首頁狀態（exit 用）。 */
  goHome: () => void;
  getMessages: () => ReadonlyArray<{ role: string; text: string }>;
}

const HELP_TEXT = BUILTIN_COMMANDS.map(
  (command) => `/${command.id} — ${command.description}`,
).join("\n");

function requireSessionId(ctx: CommandContext): string {
  if (ctx.activeSessionId === null) {
    throw new Error("no active session");
  }
  return ctx.activeSessionId;
}

function exportMessages(ctx: CommandContext): void {
  const blob = new Blob([JSON.stringify(ctx.getMessages(), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "owx-session.json";
  anchor.click();
  URL.revokeObjectURL(url);
  ctx.setNotice("session exported");
}

async function copyLastAssistant(ctx: CommandContext): Promise<void> {
  const messages = ctx.getMessages();
  const last = [...messages].reverse().find((message) => message.role === "assistant");
  if (last === undefined) {
    ctx.setNotice("nothing to copy");
    return;
  }
  await navigator.clipboard.writeText(last.text);
  ctx.setNotice("copied last assistant message");
}

/**
 * 執行一個內建指令。未知／未支援者以提示回報（不靜默）。
 */
export async function runBuiltinCommand(
  id: string,
  ctx: CommandContext,
): Promise<void> {
  switch (id) {
    // App
    case "sessions":
      ctx.focus(".session-list button");
      return;
    case "new":
      await ctx.newSession();
      await ctx.refreshSessions();
      ctx.setNotice("new session started");
      return;
    case "models":
      ctx.focus('select[aria-label="model"]');
      return;
    case "agents":
      ctx.focus('select[aria-label="agent"]');
      return;
    case "mcps": {
      const config = await api.listConfig();
      ctx.openDialog({
        title: "MCP servers",
        body: JSON.stringify(config.mcp ?? {}, null, 2),
      });
      return;
    }
    case "connect": {
      const auth = await api.providerAuth();
      ctx.openDialog({
        title: "Provider authentication",
        body:
          JSON.stringify(auth, null, 2) +
          "\n\n(OAuth connect flow is not implemented in the web UI yet.)",
      });
      return;
    }
    case "status": {
      const [app, config] = await Promise.all([api.appInfo(), api.listConfig()]);
      ctx.openDialog({
        title: "Status",
        body: JSON.stringify({ app, config }, null, 2),
      });
      return;
    }
    case "debug": {
      const app = await api.appInfo();
      ctx.openDialog({
        title: "Debug info",
        body: JSON.stringify(
          { version: app.version, userAgent: navigator.userAgent, activeSessionId: ctx.activeSessionId },
          null,
          2,
        ),
      });
      return;
    }
    case "themes":
      ctx.toggleTheme();
      return;
    case "help":
      ctx.openDialog({ title: "Commands", body: HELP_TEXT });
      return;
    case "exit":
      ctx.goHome();
      return;

    // Session
    case "share": {
      const result = await api.shareSession(requireSessionId(ctx));
      ctx.openDialog({ title: "Shared session", body: JSON.stringify(result, null, 2) });
      return;
    }
    case "rename": {
      const title = window.prompt("New session title");
      if (title === null || title.trim() === "") {
        return;
      }
      await api.updateSessionTitle(requireSessionId(ctx), title.trim());
      await ctx.refreshSessions();
      ctx.setNotice("session renamed");
      return;
    }
    case "timeline":
      ctx.focus(".messages");
      return;
    case "fork": {
      const forked = await api.forkSession(requireSessionId(ctx));
      await ctx.refreshSessions();
      ctx.setNotice(`forked session ${forked.id ?? ""}`.trim());
      return;
    }
    case "compact":
      await api.summarizeSession(requireSessionId(ctx));
      ctx.setNotice("session summarized");
      return;
    case "unshare":
      await api.unshareSession(requireSessionId(ctx));
      ctx.setNotice("session unshared");
      return;
    case "undo":
      await api.revertSession(requireSessionId(ctx));
      ctx.setNotice("reverted last message");
      return;
    case "redo":
      await api.unrevertSession(requireSessionId(ctx));
      ctx.setNotice("restored reverted messages");
      return;
    case "copy":
      await copyLastAssistant(ctx);
      return;
    case "export":
      exportMessages(ctx);
      return;

    // Prompt
    case "editor":
      ctx.focus("#prompt");
      return;
    case "skills": {
      const skills = await api.listSkills();
      ctx.openDialog({ title: "Skills", body: JSON.stringify(skills, null, 2) });
      return;
    }

    // Plugin
    case "diff": {
      const diff = await api.sessionDiff(requireSessionId(ctx));
      ctx.openDialog({ title: "Session diff", body: JSON.stringify(diff, null, 2) });
      return;
    }

    default:
      ctx.setNotice(`/${id}: not implemented in the web UI yet`);
      return;
  }
}

/**
 * owx opencode plugin shim（thin）。
 *
 * 將 opencode plugin hook 轉呼叫 Rust harness sidecar（loopback RPC）。
 * 邊界決策見 docs/adr/ADR-0004-harness-opencode-boundary.md；
 * hook 契約見 docs/design/interfaces.md §2。
 *
 * 行為原則：**fail-open**。sidecar 不可達或逾時時，一律放行，不阻擋 agent。
 *
 * 本檔的 hook 形狀已對 `@opencode-ai/plugin`（opencode 1.18.x）的 `Hooks` 型別
 * 做編譯期驗證（回傳型別 `Promise<Hooks>`）。
 */

import type { Hooks, Plugin, PluginInput } from "@opencode-ai/plugin";

const DEFAULT_PORT = 13100;
const DEFAULT_TIMEOUT_MS = 250;

type HookDecision =
  | { decision: "allow" }
  | { decision: "block"; reason: string }
  | { decision: "rewrite"; payload: unknown };

function sidecarHookUrl(): string {
  const port = process.env.OWX_HARNESS_PORT ?? String(DEFAULT_PORT);
  return `http://127.0.0.1:${port}/rpc/hook`;
}

async function callSidecar(
  hook: string,
  payload: unknown,
): Promise<HookDecision | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(sidecarHookUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hook, payload }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as HookDecision;
  } catch {
    return null; // fail-open
  } finally {
    clearTimeout(timer);
  }
}

export const OwxPlugin: Plugin = async (
  _input: PluginInput,
): Promise<Hooks> => {
  console.error(`[owx] plugin loaded; sidecar=${sidecarHookUrl()}`);
  return {
    "tool.execute.before": async (input, output) => {
      const decision = await callSidecar("tool.execute.before", {
        tool: input.tool,
        sessionID: input.sessionID,
        callID: input.callID,
        args: output.args,
      });
      if (decision?.decision === "block") {
        // output 無 block 欄位，阻擋須 throw。
        throw new Error(`owx: blocked by harness: ${decision.reason}`);
      }
      if (decision?.decision === "rewrite") {
        output.args = decision.payload;
      }
    },

    "permission.ask": async (input, output) => {
      const decision = await callSidecar("permission.ask", input);
      if (decision?.decision === "block") {
        output.status = "deny";
      }
    },

    "chat.message": async (input) => {
      await callSidecar("chat.message", {
        sessionID: input.sessionID,
        agent: input.agent,
      });
    },

    // chat.params output 無 model 欄位：模型鏈/fallback 不經此 hook（見 interfaces.md §7）。
    "chat.params": async (input) => {
      await callSidecar("chat.params", {
        sessionID: input.sessionID,
        agent: input.agent,
      });
    },

    event: async ({ event }) => {
      await callSidecar("event", event);
    },
  };
};

export default OwxPlugin;

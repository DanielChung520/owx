/**
 * owx opencode plugin shim（thin）。
 *
 * 將 opencode plugin hook 轉呼叫 Rust harness sidecar（loopback RPC）。
 * 邊界決策見 docs/adr/ADR-0004-harness-opencode-boundary.md；
 * hook 契約見 docs/design/interfaces.md §2。
 *
 * 行為原則：**fail-open**。sidecar 不可達或逾時時，一律放行，不阻擋 agent。
 */

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

/**
 * opencode plugin 進入點。
 *
 * hook 形狀依 opencode plugin API（`{ "tool.execute.before": async (input, output) => {} }`）。
 * 骨架階段僅掛 `tool.execute.before`；其餘 hook（chat.params / permission.ask / event）
 * 待後續迭代補上。實際 API 形狀若與此略有出入，見 README 的「已知不確定」。
 */
export const OwxPlugin = async (_context: unknown) => ({
  "tool.execute.before": async (
    input: unknown,
    _output: unknown,
  ): Promise<void> => {
    const decision = await callSidecar("tool.execute.before", input);
    if (decision?.decision === "block") {
      throw new Error(`owx: blocked by harness: ${decision.reason}`);
    }
    // allow / rewrite（骨架階段忽略改寫）/ null（fail-open）皆放行。
  },
});

export default OwxPlugin;

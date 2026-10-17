import { useEffect, useState } from "react";
import type { ChatMessage, ConnStatus } from "./types";

const baseUrl = import.meta.env.VITE_OPENCODE_URL ?? "";

/**
 * 訂閱 opencode 事件流（`GET /global/event`）並回傳連線狀態。
 *
 * 骨架階段：僅建立連線與狀態機；事件到訊息的對映待後續迭代
 * （見 docs/design/frontend.md §5）。
 */
export function useSessionStream(): {
  messages: ChatMessage[];
  status: ConnStatus;
} {
  const [messages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConnStatus>("connecting");

  useEffect(() => {
    if (baseUrl === "") {
      setStatus("closed");
      return;
    }
    const source = new EventSource(`${baseUrl}/global/event`);
    source.onopen = () => setStatus("live");
    source.onerror = () => setStatus("reconnecting");
    source.onmessage = () => {
      // TODO(iteration): 將 session/message/part 事件對映為 ChatMessage。
    };
    return () => {
      source.close();
      setStatus("closed");
    };
  }, []);

  return { messages, status };
}

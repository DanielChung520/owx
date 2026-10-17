import { useEffect, useReducer } from "react";
import { chatReducer, initialChatState } from "./chat";
import { mapEvent } from "./events";
import type { ChatMessage, ConnStatus } from "./types";

const baseUrl = import.meta.env.VITE_OPENCODE_URL ?? "";

export function useSessionStream(): {
  messages: ChatMessage[];
  status: ConnStatus;
} {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);

  useEffect(() => {
    if (baseUrl === "") {
      dispatch({ type: "connection", status: "closed" });
      return;
    }
    const source = new EventSource(`${baseUrl}/global/event`);
    source.onopen = () => dispatch({ type: "connection", status: "live" });
    source.onerror = () =>
      dispatch({ type: "connection", status: "reconnecting" });
    source.onmessage = (event) => {
      let raw: unknown;
      try {
        raw = JSON.parse(event.data);
      } catch {
        return;
      }
      const action = mapEvent(raw);
      if (action !== null) {
        dispatch(action);
      }
    };
    return () => {
      source.close();
      dispatch({ type: "connection", status: "closed" });
    };
  }, []);

  return { messages: state.messages, status: state.status };
}

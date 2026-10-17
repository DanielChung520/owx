import { useEffect } from "react";
import type { Dispatch } from "react";
import type { ChatAction } from "./chat";
import { mapEvent } from "./events";

const baseUrl = import.meta.env.VITE_OPENCODE_URL ?? "";

export function useSessionStream(
  sessionId: string | null,
  dispatch: Dispatch<ChatAction>,
): void {
  useEffect(() => {
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
      const action = mapEvent(raw, sessionId);
      if (action !== null) {
        dispatch(action);
      }
    };
    return () => {
      source.close();
      dispatch({ type: "connection", status: "closed" });
    };
  }, [sessionId, dispatch]);
}

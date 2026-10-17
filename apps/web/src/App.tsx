import { useEffect, useReducer, useState } from "react";
import { Header } from "./components/Header";
import { MessageInput } from "./components/MessageInput";
import { MessageList } from "./components/MessageList";
import { Sidebar } from "./components/Sidebar";
import {
  createSession,
  listMessages,
  listSessions,
  sendMessage,
  toChatMessages,
  type SessionSummary,
} from "./lib/api";
import { chatReducer, initialChatState } from "./lib/chat";
import { useSessionStream } from "./lib/useSessionStream";

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function App(): JSX.Element {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useSessionStream(activeId, dispatch);

  useEffect(() => {
    void (async () => {
      try {
        setSessions(await listSessions());
      } catch (cause) {
        setError(describe(cause));
      }
    })();
  }, []);

  const selectSession = (id: string): void => {
    setActiveId(id);
    void (async () => {
      try {
        const envelopes = await listMessages(id);
        dispatch({ type: "hydrate", messages: toChatMessages(envelopes) });
      } catch (cause) {
        setError(describe(cause));
      }
    })();
  };

  const handleSend = (text: string): void => {
    void (async () => {
      try {
        let id = activeId;
        if (id === null) {
          id = await createSession();
          setActiveId(id);
          setSessions(await listSessions());
        }
        await sendMessage(id, text);
        setError(null);
      } catch (cause) {
        setError(describe(cause));
      }
    })();
  };

  return (
    <div className="app">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={selectSession}
      />
      <div className="main">
        <Header status={state.status} />
        {error !== null ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <MessageList messages={state.messages} />
        <MessageInput disabled={state.status !== "live"} onSend={handleSend} />
      </div>
    </div>
  );
}

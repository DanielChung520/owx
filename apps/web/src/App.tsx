import { useState } from "react";
import { Header } from "./components/Header";
import { MessageInput } from "./components/MessageInput";
import { MessageList } from "./components/MessageList";
import { Sidebar } from "./components/Sidebar";
import { createSession, hasApi, sendMessage } from "./lib/api";
import { useSessionStream } from "./lib/useSessionStream";

export function App(): JSX.Element {
  const { messages, status } = useSessionStream();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSend = (text: string): void => {
    if (!hasApi()) {
      return;
    }
    void (async () => {
      try {
        let id = sessionId;
        if (id === null) {
          id = await createSession();
          setSessionId(id);
        }
        await sendMessage(id, text);
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    })();
  };

  return (
    <div className="app">
      <Sidebar activeSession={sessionId} />
      <div className="main">
        <Header status={status} />
        {error !== null ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <MessageList messages={messages} />
        <MessageInput disabled={status !== "live"} onSend={handleSend} />
      </div>
    </div>
  );
}

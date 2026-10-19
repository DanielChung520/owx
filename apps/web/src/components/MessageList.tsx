import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "../lib/types";

export function MessageList({
  messages,
  busy,
}: {
  messages: ChatMessage[];
  busy: boolean;
}): JSX.Element {
  if (messages.length === 0 && !busy) {
    return (
      <main className="messages empty" aria-label="訊息">
        <p>尚無訊息。開始對話以操作文件與知識。</p>
      </main>
    );
  }
  return (
    <main className="messages" aria-label="訊息">
      <ul>
        {messages.map((m) => (
          <li key={m.id} className={`msg msg-${m.role}`}>
            {m.role === "assistant" && m.reasoning !== undefined && m.reasoning !== "" ? (
              <details className="reasoning">
                <summary>思考</summary>
                <pre className="reasoning-body">{m.reasoning}</pre>
              </details>
            ) : null}
            {m.role === "assistant" ? (
              <div className="md">
                <ReactMarkdown>{m.text}</ReactMarkdown>
              </div>
            ) : (
              <p>{m.text}</p>
            )}
          </li>
        ))}
        {busy ? (
          <li className="msg msg-assistant busy" role="status">
            <span className="busy-dot" /> 產生中…
          </li>
        ) : null}
      </ul>
    </main>
  );
}

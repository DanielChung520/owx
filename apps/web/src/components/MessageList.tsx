import ReactMarkdown from "react-markdown";
import type { ChatMessage } from "../lib/types";

export function MessageList({
  messages,
}: {
  messages: ChatMessage[];
}): JSX.Element {
  if (messages.length === 0) {
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
            <span className="role">{m.role}</span>
            {m.role === "assistant" ? (
              <div className="md">
                <ReactMarkdown>{m.text}</ReactMarkdown>
              </div>
            ) : (
              <p>{m.text}</p>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}

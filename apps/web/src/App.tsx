import { Header } from "./components/Header";
import { MessageInput } from "./components/MessageInput";
import { MessageList } from "./components/MessageList";
import { useSessionStream } from "./lib/useSessionStream";

export function App(): JSX.Element {
  const { messages, status } = useSessionStream();
  return (
    <div className="app">
      <Header status={status} />
      <MessageList messages={messages} />
      <MessageInput disabled={status !== "live"} />
    </div>
  );
}

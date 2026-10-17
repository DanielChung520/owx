import { useEffect, useReducer, useState } from "react";
import { Header } from "./components/Header";
import { MessageInput } from "./components/MessageInput";
import { MessageList } from "./components/MessageList";
import { Sidebar } from "./components/Sidebar";
import {
  createSession,
  listAgents,
  listMessages,
  listProviders,
  listSessions,
  sendMessage,
  setSessionAgent,
  setSessionModel,
  toChatMessages,
  type ProviderGroup,
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
  const [agents, setAgents] = useState<string[]>([]);
  const [providers, setProviders] = useState<ProviderGroup[]>([]);
  const [error, setError] = useState<string | null>(null);

  useSessionStream(activeId, dispatch);

  const refreshSessions = async (): Promise<void> => {
    setSessions(await listSessions());
  };

  useEffect(() => {
    void (async () => {
      try {
        const list = await listAgents();
        const primary = list
          .filter((item) => item.mode === "primary")
          .map((item) => item.name);
        setAgents(primary.length > 0 ? primary : list.map((item) => item.name));
      } catch (cause) {
        setError(describe(cause));
      }
      try {
        setProviders(await listProviders());
      } catch (cause) {
        setError(describe(cause));
      }
      try {
        await refreshSessions();
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
        }
        await sendMessage(id, text);
        await refreshSessions();
        setError(null);
      } catch (cause) {
        setError(describe(cause));
      }
    })();
  };

  const changeAgent = (name: string): void => {
    if (activeId === null) {
      return;
    }
    void (async () => {
      try {
        await setSessionAgent(activeId, name);
        await refreshSessions();
      } catch (cause) {
        setError(describe(cause));
      }
    })();
  };

  const changeModel = (providerID: string, id: string): void => {
    if (activeId === null) {
      return;
    }
    void (async () => {
      try {
        await setSessionModel(activeId, providerID, id);
        await refreshSessions();
      } catch (cause) {
        setError(describe(cause));
      }
    })();
  };

  const active = sessions.find((session) => session.id === activeId) ?? null;
  const modelValue =
    active?.model !== undefined && active.model.id !== undefined
      ? `${active.model.providerID ?? ""}/${active.model.id}`
      : undefined;

  return (
    <div className="app">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={selectSession}
      />
      <div className="main">
        <Header
          status={state.status}
          title={active?.title}
          agent={active?.agent}
          model={modelValue}
          agents={agents}
          providers={providers}
          onAgent={changeAgent}
          onModel={changeModel}
        />
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

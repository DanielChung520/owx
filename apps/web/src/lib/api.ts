import type { ChatMessage, Role } from "./types";

const baseUrl = import.meta.env.VITE_OPENCODE_URL ?? "";

export interface SessionSummary {
  id: string;
  title?: string;
  agent?: string;
  model?: { id?: string; providerID?: string };
}

export interface MessagePart {
  type: string;
  text?: string;
}

export interface MessageEnvelope {
  info: { id: string; role: string };
  parts: MessagePart[];
}

export interface CommandInfo {
  name: string;
  description?: string;
}

export async function listSessions(): Promise<SessionSummary[]> {
  const res = await fetch(`${baseUrl}/session`);
  if (!res.ok) {
    throw new Error(`listSessions failed: ${res.status}`);
  }
  return (await res.json()) as SessionSummary[];
}

export async function listMessages(sessionId: string): Promise<MessageEnvelope[]> {
  const res = await fetch(`${baseUrl}/session/${sessionId}/message`);
  if (!res.ok) {
    throw new Error(`listMessages failed: ${res.status}`);
  }
  return (await res.json()) as MessageEnvelope[];
}

export async function listCommands(): Promise<CommandInfo[]> {
  const res = await fetch(`${baseUrl}/command`);
  if (!res.ok) {
    throw new Error(`listCommands failed: ${res.status}`);
  }
  return (await res.json()) as CommandInfo[];
}

export async function findFiles(query: string): Promise<string[]> {
  const res = await fetch(`${baseUrl}/find/file?query=${encodeURIComponent(query)}`);
  if (!res.ok) {
    throw new Error(`findFiles failed: ${res.status}`);
  }
  return (await res.json()) as string[];
}

export function toChatMessages(envelopes: MessageEnvelope[]): ChatMessage[] {
  return envelopes.map((env) => {
    const text = env.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("");
    const role: Role = env.info.role === "user" ? "user" : "assistant";
    return { id: env.info.id, role, text };
  });
}

export interface ProviderModel {
  providerID: string;
  id: string;
}

export interface ProviderGroup {
  id: string;
  name?: string;
  models: ProviderModel[];
}

export interface AgentInfo {
  name: string;
  mode?: string;
}

export async function listAgents(): Promise<AgentInfo[]> {
  const res = await fetch(`${baseUrl}/agent`);
  if (!res.ok) {
    throw new Error(`listAgents failed: ${res.status}`);
  }
  return (await res.json()) as AgentInfo[];
}

export async function listProviders(): Promise<ProviderGroup[]> {
  const res = await fetch(`${baseUrl}/config/providers`);
  if (!res.ok) {
    throw new Error(`listProviders failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    providers?: Array<{
      id: string;
      name?: string;
      models?: Record<string, unknown>;
    }>;
  };
  return (data.providers ?? []).map((provider) => ({
    id: provider.id,
    name: provider.name,
    models: Object.keys(provider.models ?? {}).map((id) => ({
      providerID: provider.id,
      id,
    })),
  }));
}

export async function setSessionAgent(
  sessionId: string,
  agent: string,
): Promise<void> {
  const res = await fetch(`${baseUrl}/api/session/${sessionId}/agent`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agent }),
  });
  if (!res.ok) {
    throw new Error(`setSessionAgent failed: ${res.status}`);
  }
}

export async function setSessionModel(
  sessionId: string,
  providerID: string,
  id: string,
): Promise<void> {
  const res = await fetch(`${baseUrl}/api/session/${sessionId}/model`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: { providerID, id } }),
  });
  if (!res.ok) {
    throw new Error(`setSessionModel failed: ${res.status}`);
  }
}

export async function createSession(): Promise<string> {
  const res = await fetch(`${baseUrl}/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    throw new Error(`createSession failed: ${res.status}`);
  }
  const data = (await res.json()) as { id?: string };
  if (data.id === undefined) {
    throw new Error("createSession: response missing id");
  }
  return data.id;
}

export async function sendMessage(sessionId: string, text: string): Promise<void> {
  const res = await fetch(`${baseUrl}/session/${sessionId}/message`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ parts: [{ type: "text", text }] }),
  });
  if (!res.ok) {
    throw new Error(`sendMessage failed: ${res.status}`);
  }
}

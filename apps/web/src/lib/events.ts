import type { ChatAction } from "./chat";
import type { Role } from "./types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function asRole(value: unknown): Role | undefined {
  return value === "user" || value === "assistant" || value === "system"
    ? value
    : undefined;
}

export function mapEvent(raw: unknown): ChatAction | null {
  const envelope = asRecord(raw);
  if (envelope === null) {
    return null;
  }
  const payload = asRecord(envelope.payload) ?? envelope;
  const type = payload.type;
  const properties = asRecord(payload.properties);
  if (typeof type !== "string" || properties === null) {
    return null;
  }

  if (type === "message.updated") {
    const info = asRecord(properties.info);
    const id = info?.id;
    if (typeof id !== "string") {
      return null;
    }
    const action: ChatAction = { type: "patch", id };
    const role = asRole(info?.role);
    if (role !== undefined) {
      action.role = role;
    }
    return action;
  }

  if (type === "message.part.updated") {
    const part = asRecord(properties.part);
    if (part?.type !== "text") {
      return null;
    }
    const id = part.messageID;
    const text = part.text;
    if (typeof id !== "string" || typeof text !== "string") {
      return null;
    }
    return { type: "patch", id, text };
  }

  return null;
}

import type { ChatMessage, ConnStatus, Role } from "./types";

export interface ChatState {
  messages: ChatMessage[];
  status: ConnStatus;
}

export const initialChatState: ChatState = { messages: [], status: "connecting" };

export type ChatAction =
  | { type: "connection"; status: ConnStatus }
  | { type: "message"; message: ChatMessage }
  | { type: "patch"; id: string; role?: Role; text?: string }
  | { type: "hydrate"; messages: ChatMessage[] }
  | { type: "clear" };

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "connection":
      return { ...state, status: action.status };
    case "message": {
      const index = state.messages.findIndex((m) => m.id === action.message.id);
      if (index < 0) {
        return { ...state, messages: [...state.messages, action.message] };
      }
      const messages = state.messages.slice();
      messages[index] = action.message;
      return { ...state, messages };
    }
    case "patch": {
      const index = state.messages.findIndex((m) => m.id === action.id);
      if (index < 0) {
        return {
          ...state,
          messages: [
            ...state.messages,
            {
              id: action.id,
              role: action.role ?? "assistant",
              text: action.text ?? "",
            },
          ],
        };
      }
      const messages = state.messages.slice();
      const current = messages[index];
      if (current === undefined) {
        return state;
      }
      messages[index] = {
        ...current,
        role: action.role ?? current.role,
        text: action.text ?? current.text,
      };
      return { ...state, messages };
    }
    case "hydrate":
      return { ...state, messages: action.messages };
    case "clear":
      return { ...state, messages: [] };
    default:
      return state;
  }
}

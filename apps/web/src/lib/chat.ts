import type { ChatMessage, ConnStatus, Role } from "./types";

export interface ChatState {
  messages: ChatMessage[];
  status: ConnStatus;
  busy: boolean;
}

export const initialChatState: ChatState = {
  messages: [],
  status: "connecting",
  busy: false,
};

export type ChatAction =
  | { type: "connection"; status: ConnStatus }
  | { type: "busy"; busy: boolean }
  | { type: "message"; message: ChatMessage }
  | { type: "patch"; id: string; role?: Role; text?: string; reasoning?: string }
  | { type: "hydrate"; messages: ChatMessage[] }
  | { type: "clear" };

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "connection":
      return { ...state, status: action.status };
    case "busy":
      return { ...state, busy: action.busy };
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
              reasoning: action.reasoning,
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
        reasoning: action.reasoning ?? current.reasoning,
      };
      return { ...state, messages };
    }
    case "hydrate":
      return { ...state, messages: action.messages };
    case "clear":
      return { ...state, messages: [], busy: false };
    default:
      return state;
  }
}

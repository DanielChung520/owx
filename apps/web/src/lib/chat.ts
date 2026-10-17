import type { ChatMessage, ConnStatus } from "./types";

export interface ChatState {
  messages: ChatMessage[];
  status: ConnStatus;
}

export const initialChatState: ChatState = { messages: [], status: "connecting" };

export type ChatAction =
  | { type: "connection"; status: ConnStatus }
  | { type: "message"; message: ChatMessage }
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
    case "clear":
      return { ...state, messages: [] };
    default:
      return state;
  }
}

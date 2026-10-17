/** 前端共用型別（骨架階段）。 */

export type Role = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: Role;
  text: string;
}

/** SSE 連線生命週期狀態。 */
export type ConnStatus = "connecting" | "live" | "reconnecting" | "closed";

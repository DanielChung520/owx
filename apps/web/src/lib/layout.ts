export const SIDE_MIN = 160;
export const SIDE_MAX = 480;
export const CHAT_MIN = 300;
export const CHAT_MAX = 760;
export const SIDE_DEFAULT = 280;
export const CHAT_DEFAULT = 400;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

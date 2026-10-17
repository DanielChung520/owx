const baseUrl = import.meta.env.VITE_OPENCODE_URL ?? "";

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

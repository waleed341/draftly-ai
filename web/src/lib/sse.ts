import { copy } from "@/features/drafts/constants";

export async function readEventStream<T>(
  response: Response,
  onEvent: (event: T) => void,
  signal?: AbortSignal,
) {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(typeof data.detail === "string" ? data.detail : copy.errors.stream);
  }
  if (!response.body) throw new Error(copy.errors.stream);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    if (signal?.aborted) { await reader.cancel(); return; }
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const data = frame.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
      if (data) onEvent(JSON.parse(data) as T);
    }
  }
}

import { apiFetch } from "./http";

/** POST a JSON body and read the `text/event-stream` reply, calling `onEvent` for every `data:` message. */
export async function postStream<E>(
  path: string,
  body: unknown,
  onEvent: (event: E) => void,
  signal: AbortSignal,
): Promise<void> {
  const response = await apiFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { Accept: "text/event-stream" },
    signal,
  });
  if (!response.body) return;

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  // Aborting does not always reach a piped stream, so cancel the reader ourselves.
  const cancel = () => void reader.cancel().catch(() => undefined);
  signal.addEventListener("abort", cancel, { once: true });
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (signal.aborted) throw new DOMException("The run was stopped.", "AbortError");
      if (done) break;
      buffer += value;
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = block
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (data) onEvent(JSON.parse(data) as E);
        boundary = buffer.indexOf("\n\n");
      }
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}

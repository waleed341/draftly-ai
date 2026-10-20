import { request } from "@/lib/http";
import { Draft, DraftEdit, StreamEvent } from "@/features/drafts/types";
import { readEventStream } from "@/lib/sse";

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

async function stream(path: string, payload: unknown, onEvent: (event: StreamEvent) => void, signal?: AbortSignal) {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal,
  });
  await readEventStream<StreamEvent>(response, onEvent, signal);
}

export const draftApi = {
  create: (idea: string, onEvent: (event: StreamEvent) => void, signal?: AbortSignal) =>
    stream("/api/drafts/stream", { idea, timezone: tz() }, onEvent, signal),
  rewrite: (id: string, instruction: string, onEvent: (event: StreamEvent) => void, signal?: AbortSignal) =>
    stream(`/api/drafts/${id}/rewrite`, instruction ? { text: instruction } : null, onEvent, signal),
  history: () => request<Draft[]>("/api/drafts"),
  get: (id: string) => request<Draft>(`/api/drafts/${id}`),
  edit: (id: string, data: DraftEdit) => request<Draft>(`/api/drafts/${id}/edit`, { method: "PUT", body: JSON.stringify(data) }),
  approve: (id: string) => request<Draft>(`/api/drafts/${id}/approve`, { method: "POST", body: JSON.stringify({ reviewed: true }) }),
  discard: (id: string) => request<void>(`/api/drafts/${id}`, { method: "DELETE" }),
  safety: (text: string) => request<{ checks: Draft["checks"] }>("/api/safety/check", { method: "POST", body: JSON.stringify({ text }) }),
};

import { request } from "@/lib/http";
import { postStream } from "@/lib/sse";
import type {
  CheckResult,
  Connector,
  CreateDraftInput,
  Draft,
  DraftStats,
  DraftSummary,
  RewriteInput,
  StreamEvent,
} from "./types";

export const draftKeys = {
  all: ["drafts"] as const,
  list: () => [...draftKeys.all, "list"] as const,
  stats: () => [...draftKeys.all, "stats"] as const,
  detail: (id: number) => [...draftKeys.all, "detail", id] as const,
  connectors: ["connectors"] as const,
};

type OnEvent = (event: StreamEvent) => void;

export const draftsApi = {
  list: () => request<DraftSummary[]>("/api/drafts?limit=30"),
  stats: () => request<DraftStats>("/api/drafts/stats"),
  get: (id: number) => request<Draft>(`/api/drafts/${id}`),
  connectors: () => request<Connector[]>("/api/connectors"),

  write: (input: CreateDraftInput, onEvent: OnEvent, signal: AbortSignal) =>
    postStream<StreamEvent>("/api/drafts/stream", input, onEvent, signal),
  rewrite: (id: number, input: RewriteInput, onEvent: OnEvent, signal: AbortSignal) =>
    postStream<StreamEvent>(`/api/drafts/${id}/rewrite/stream`, input, onEvent, signal),

  edit: (id: number, subject: string, body: string) =>
    request<Draft>(`/api/drafts/${id}`, { method: "PUT", body: JSON.stringify({ subject, body }) }),
  approve: (id: number, details: { to: string[]; gmail_connection_id: number }) =>
    request<Draft>(`/api/drafts/${id}/approve`, { method: "POST", body: JSON.stringify({ reviewed: true, ...details }) }),
  saveGmailDraft: (id: number, connection_id: number) =>
    request<{ status: string }>(`/api/gmail/drafts/${id}`, { method: "POST", body: JSON.stringify({ connection_id }) }),
  schedule: (approval_id: number, send_at: string) =>
    request<{ id: number; status: string }>("/api/schedules", { method: "POST", body: JSON.stringify({ approval_id, send_at }) }),
  discard: (id: number) => request<void>(`/api/drafts/${id}`, { method: "DELETE" }),
  check: (subject: string, body: string, signal?: AbortSignal) =>
    request<CheckResult>("/api/safety/check", { method: "POST", body: JSON.stringify({ subject, body }), signal }),
};

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

const OFFLINE = "We can't reach Draftly right now. Check your connection and try again.";
const GENERIC = "Something went wrong. Please try again.";
let csrfToken: string | null = null;

export function setCsrfToken(value: string | null) {
  csrfToken = value;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string = "error",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Turn a failed response into an ApiError carrying the server's friendly message. */
export async function toApiError(response: Response): Promise<ApiError> {
  try {
    const data = (await response.json()) as { detail?: string; error?: { code?: string; message?: string } };
    if (data.error?.message) return new ApiError(data.error.message, response.status, data.error.code);
    if (data.detail) return new ApiError(data.detail, response.status);
  } catch {
    // not JSON
  }
  return new ApiError(GENERIC, response.status);
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}), ...init.headers },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(OFFLINE, 0, "offline");
  }
  if (!response.ok) throw await toApiError(response);
  return response;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function friendlyMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : GENERIC;
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

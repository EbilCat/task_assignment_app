import type { ErrorBody, ErrorCode, IssueDetail } from "./types";

// Every path is relative to /api: the Vite proxy (dev) and, later, the
// frontend's web server in Docker forward it to the backend.
const BASE = "/api";

// One error type for every failed call. Components switch on `code`:
// the backend's codes, plus NO_API when no backend answered at all
// (server down, proxy error, HTML instead of JSON).
export class ApiRequestError extends Error {
  readonly status: number; // HTTP status; 0 = the request never got an answer
  readonly code: ErrorCode | "NO_API";
  readonly details: IssueDetail[];

  constructor(status: number, code: ErrorCode | "NO_API", message: string, details: IssueDetail[] = []) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  // The message for one form field, e.g. fieldMessage("subtasks.1.assigneeId")
  fieldMessage(path: string): string | undefined {
    return this.details.find((d) => d.path === path)?.message;
  }
}

// fetch() only rejects when there is no response at all. A 404 or 422 is a
// "successful" fetch, so request() checks res.ok itself and throws.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, init);
  } catch {
    throw new ApiRequestError(0, "NO_API", "Cannot reach the server");
  }

  const body = parseJson(await res.text());
  if (res.ok) return body as T;
  if (isErrorBody(body)) {
    const { code, message, details } = body.error;
    throw new ApiRequestError(res.status, code, message, details);
  }
  throw new ApiRequestError(res.status, "NO_API", `The API did not answer (HTTP ${res.status})`);
}

export function get<T>(path: string): Promise<T> {
  return request<T>(path, { headers: { Accept: "application/json" } });
}

// Without Content-Type: application/json, express.json() ignores the body
// and the backend answers 400.
export function send<T>(method: "POST" | "PATCH", path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method,
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function parseJson(text: string): unknown {
  if (text === "") return null;
  try {
    return JSON.parse(text);
  } catch {
    return null; // e.g. an HTML error page from a proxy
  }
}

function isErrorBody(value: unknown): value is ErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const error = (value as { error: unknown }).error;
  return typeof error === "object" && error !== null && "code" in error && "message" in error;
}
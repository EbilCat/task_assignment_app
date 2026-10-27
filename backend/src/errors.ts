// Every error the API can send, in one place.
// A route (or the code it calls) THROWS an ApiError; the error handler in
// app.ts is the only code that turns it into a response.

// The code is what a client switches on; the status follows from the code.
// Add a new error here and both stay in step.
export const STATUS_BY_CODE = {
  BAD_REQUEST: 400, // malformed input, or it names something that doesn't exist
  BAD_JSON: 400, // the body isn't JSON at all
  NOT_FOUND: 404, // no such route, or no such task
  NOT_QUALIFIED: 422, // rule 1: assignee lacks a required skill
  SUBTASKS_NOT_DONE: 422, // rule 2: Done while something below isn't
  PARENT_DONE: 422, // rule 2: reopening under a Done ancestor
  INTERNAL: 500, // a bug or an outage: details stay in the server log
} as const;

export type ErrorCode = keyof typeof STATUS_BY_CODE;
export type IssueDetail = { path: string; message: string };

// The ONE error body. details is always an array (empty when no single
// field is to blame), so a client never has to check whether it exists.
export type ErrorBody = {
  error: { code: ErrorCode; message: string; details: IssueDetail[] };
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: IssueDetail[];

  constructor(code: ErrorCode, message: string, details: IssueDetail[] = []) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }

  toBody(): ErrorBody {
    return { error: { code: this.code, message: this.message, details: this.details } };
  }
}

// One field is to blame:
//   fieldError("NOT_QUALIFIED", "subtasks.1.assigneeId", "Alice lacks ...")
//   -> message "subtasks.1.assigneeId: Alice lacks ...", details [{ path, message }]
export function fieldError(code: ErrorCode, path: string, message: string): ApiError {
  return new ApiError(code, path ? `${path}: ${message}` : message, [{ path, message }]);
}

export function notFound(message: string): ApiError {
  return new ApiError("NOT_FOUND", message);
}

// Put in the `default:` of a switch over a tagged union. If someone adds a
// new `kind` and forgets a case, this line stops compiling.
export function assertNever(value: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`);
}
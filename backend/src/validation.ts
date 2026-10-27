import type { ZodError } from "zod";

export type IssueDetail = { path: string; message: string };

// Turn zod's issues into our usual error body, plus a `details` list so a
// frontend can show the message next to the right field.
//   path "subtasks.0.title" = the title of the first subtask
export function validationError(error: ZodError) {
  const details: IssueDetail[] = error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
  const first = details[0];
  const message = !first
    ? "Invalid request"
    : first.path
      ? `${first.path}: ${first.message}`
      : first.message;
  return { error: { code: "BAD_REQUEST", message, details } };
}


// The same error body for a problem the SERVICE found, pointing at one field:
//   problemBody("NOT_QUALIFIED", "subtasks.1.assigneeId", "Alice lacks ...")
export function problemBody(code: string, path: string, message: string) {
  return {
    error: { code, message: path ? `${path}: ${message}` : message, details: [{ path, message }] },
  };
}



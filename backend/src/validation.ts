import { z, type ZodError } from "zod";
import { ApiError, type IssueDetail } from "./errors.js";

// zod's issues -> our ApiError (400 BAD_REQUEST), with a `details` list so a
// client (our React form) can show each message next to the right field.
//   path "subtasks.0.title" = the title of the first subtask
export function zodToApiError(error: ZodError): ApiError {
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
  return new ApiError("BAD_REQUEST", message, details);
}

// The 400 body for a ZodError
export function validationError(error: ZodError) {
  return zodToApiError(error).toBody();
}

// Validate or throw. Routes call this instead of safeParse + if + res.status:
//   const body = parse(CreateTaskBody, req.body);
// On failure it throws an ApiError, which the error handler sends as a 400.
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw zodToApiError(result.error);
  return result.data;
}
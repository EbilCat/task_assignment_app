import { ApiRequestError } from "./client";

// One line for any error: "NOT_QUALIFIED (422): Alice lacks required skill: Backend".
// Used where there is no field to attach the message to.
export function describe(err: unknown): string {
  if (err instanceof ApiRequestError) return `${err.code} (${err.status}): ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}
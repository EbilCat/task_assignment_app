import type { CreateTaskInput, TaskStatus } from "../api/types";

// What the form holds while the user types: exactly what the inputs show.
// One draft = one node of the tree; `subtasks` holds its children, any depth.
export type TaskDraft = {
  key: string; // React key ONLY: stays the same while siblings come and go; never sent
  title: string;
  status: TaskStatus;
  assigneeId: string; // "" = Unassigned; otherwise a developer id as a string
  skills: string[]; // ticked skill names, in GET /skills order
  subtasks: TaskDraft[];
};

// Same cap as the backend schema: z.array(CreateTaskBody).max(20)
export const MAX_SUBTASKS = 20;

let lastKey = 0;
export function emptyDraft(): TaskDraft {
  lastKey += 1;
  return { key: `draft-${lastKey}`, title: "", status: "To Do", assigneeId: "", skills: [], subtasks: [] };
}

// Recursive: the POST /tasks body has the same tree shape as the draft.
// `key` is left out on purpose: CreateTaskBody is a strictObject, so an
// unknown field would come back as a 400.
export function toInput(draft: TaskDraft): CreateTaskInput {
  const input: CreateTaskInput = {
    title: draft.title, // the backend trims it and rejects a blank title (400)
    status: draft.status,
    assigneeId: draft.assigneeId === "" ? null : Number(draft.assigneeId),
    skills: draft.skills,
  };
  if (draft.subtasks.length > 0) input.subtasks = draft.subtasks.map(toInput);
  return input;
}

export function countDrafts(draft: TaskDraft): number {
  return 1 + draft.subtasks.reduce((n, child) => n + countDrafts(child), 0);
}

// ---- immutable list helpers: return a NEW array, never change the old one ----

export function replaceAt<T>(list: readonly T[], index: number, item: T): T[] {
  return list.map((x, i) => (i === index ? item : x));
}

export function removeAt<T>(list: readonly T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}

// ---- error paths ----------------------------------------------------------
// A node's PREFIX is where its fields live in details[].path:
//   ""                        root        -> "title", "assigneeId", ...
//   "subtasks.1."             2nd child   -> "subtasks.1.assigneeId"
//   "subtasks.1.subtasks.0."  its child   -> "subtasks.1.subtasks.0.status"
export const NODE_FIELDS = ["title", "status", "assigneeId", "skills"] as const;

export function childPrefix(prefix: string, index: number): string {
  return `${prefix}subtasks.${index}.`;
}

// A field owns its exact path and anything below it (skills.0 -> skills box).
export function owns(field: string, path: string): boolean {
  return path === field || path.startsWith(`${field}.`);
}

// Does any node of this draft show an error for `path`? Errors nobody owns
// (NO_API, INTERNAL, a root-level "Unrecognized key") go to the top of the form.
// "<prefix>subtasks" itself (e.g. too many subtasks) belongs to that node's list.
export function ownsPath(draft: TaskDraft, path: string, prefix = ""): boolean {
  if (NODE_FIELDS.some((f) => owns(prefix + f, path))) return true;
  if (path === `${prefix}subtasks`) return true;
  return draft.subtasks.some((child, i) => ownsPath(child, path, childPrefix(prefix, i)));
}
import type { CreateTaskInput, TaskStatus } from "../api/types";

// What the form holds while the user types: exactly what the inputs show
// (strings for <select> values, an array of ticked skill names).
// toInput() turns it into the POST /tasks body. The next lesson adds
// `subtasks: TaskDraft[]` here, so one draft = one node of the tree.
export type TaskDraft = {
  title: string;
  status: TaskStatus;
  assigneeId: string; // "" = Unassigned; otherwise a developer id as a string
  skills: string[]; // ticked skill names, in GET /skills order
};

export function emptyDraft(): TaskDraft {
  return { title: "", status: "To Do", assigneeId: "", skills: [] };
}

export function toInput(draft: TaskDraft): CreateTaskInput {
  return {
    title: draft.title, // the backend trims it and rejects a blank title (400 at "title")
    status: draft.status,
    assigneeId: draft.assigneeId === "" ? null : Number(draft.assigneeId),
    skills: draft.skills,
  };
}
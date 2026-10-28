import { get, send } from "./client";
import type { CreateTaskInput, Developer, DeveloperSummary, Skill, Task, TaskStatus } from "./types";

// One function per backend endpoint. Each unwraps the response object
// ({ tasks }, { task }, ...) so callers get the data itself.
// Every function either resolves with data or rejects with ApiRequestError.
export const api = {
  listTasks: () => get<{ tasks: Task[] }>("/tasks").then((r) => r.tasks),

  getTask: (id: number) => get<{ task: Task }>(`/tasks/${id}`).then((r) => r.task),

  listDevelopers: () => get<{ developers: Developer[] }>("/developers").then((r) => r.developers),

  listSkills: () => get<{ skills: Skill[] }>("/skills").then((r) => r.skills),

  qualifiedDevelopers: (taskId: number) =>
    get<{ taskId: number; developers: DeveloperSummary[] }>(`/tasks/${taskId}/qualified-developers`).then(
      (r) => r.developers,
    ),

  createTask: (input: CreateTaskInput) => send<{ task: Task }>("POST", "/tasks", input).then((r) => r.task),

  assignTask: (taskId: number, assigneeId: number | null) =>
    send<{ task: Task }>("PATCH", `/tasks/${taskId}/assignee`, { assigneeId }).then((r) => r.task),

  setStatus: (taskId: number, status: TaskStatus) =>
    send<{ task: Task }>("PATCH", `/tasks/${taskId}/status`, { status }).then((r) => r.task),
};
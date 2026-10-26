import type { TaskStatus } from "./types.js";

export type TaskRow = {
  id: number;
  title: string;
  status: TaskStatus;
  assignee_id: number | null;
  parent_task_id: number | null;
};

export type Task = {
  id: number;
  title: string;
  status: TaskStatus;
  assigneeId: number | null;
  parentTaskId: number | null;
  skills: string[];
  subtasks: Task[];
};

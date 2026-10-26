import type { Task, TaskRow } from "./domain.js";

export function buildTaskTree(
  rows: TaskRow[],
  skillsByTask: Map<number, string[]> = new Map(),
): Task[] {
  const byId = new Map<number, Task>();
  for (const r of rows) {
    byId.set(r.id, {
      id: r.id,
      title: r.title,
      status: r.status,
      assigneeId: r.assignee_id,
      parentTaskId: r.parent_task_id,
      skills: skillsByTask.get(r.id) ?? [],
      subtasks: [],
    });
  }

  const roots: Task[] = [];
  for (const task of byId.values()) {
    if (task.parentTaskId === null) {
      roots.push(task);
      continue;
    }
    const parent = byId.get(task.parentTaskId);
    if (parent) parent.subtasks.push(task);
    else roots.push(task); // parent not in this result set
  }
  return roots;
}
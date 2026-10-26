import { buildTaskTree } from "./tree.js";
import type { Task, TaskRow } from "./domain.js";

const rows: TaskRow[] = [
  { id: 1, title: "Build login page",  status: "In Progress", assignee_id: 3,    parent_task_id: null },
  { id: 2, title: "Design form UI",    status: "Done",        assignee_id: 1,    parent_task_id: 1 },
  { id: 3, title: "Auth API endpoint", status: "In Progress", assignee_id: 2,    parent_task_id: 1 },
  { id: 4, title: "Hash passwords",    status: "To Do",       assignee_id: 4,    parent_task_id: 3 },
  { id: 5, title: "Write README",      status: "To Do",       assignee_id: null, parent_task_id: null },
];

const skills = new Map<number, string[]>([
  [1, ["Frontend", "Backend"]],
  [2, ["Frontend"]],
  [3, ["Backend"]],
  [4, ["Backend"]],
]);

function print(tasks: Task[], depth = 0): void {
  for (const t of tasks) {
    const s = t.skills.length ? t.skills.join(",") : "(none yet)";
    console.log(
      `${"  ".repeat(depth)}#${t.id} ${t.title}  [${t.status}]  assignee=${t.assigneeId ?? "-"}  skills=${s}`,
    );
    print(t.subtasks, depth + 1);
  }
}

print(buildTaskTree(rows, skills));
import type { Db } from "../db.js";
import type { TaskRow } from "../domain.js";

export async function findTaskById(db: Db, id: number): Promise<TaskRow | null> {
  const { rows } = await db.query<TaskRow>(
    `SELECT id, title, status, assignee_id, parent_task_id
       FROM tasks
      WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

// How many tasks anywhere below this one are not Done (children, grandchildren, ...).
export async function countUnfinishedDescendants(db: Db, taskId: number): Promise<number> {
  const { rows } = await db.query<{ not_done: string }>(
    `WITH RECURSIVE subtree AS (
       SELECT id, status FROM tasks WHERE parent_task_id = $1
       UNION ALL
       SELECT t.id, t.status FROM tasks t JOIN subtree s ON t.parent_task_id = s.id
     )
     SELECT COUNT(*) FILTER (WHERE status <> 'Done') AS not_done FROM subtree`,
    [taskId],
  );
  return Number(rows[0]?.not_done ?? 0); // COUNT is bigint -> string in pg
}
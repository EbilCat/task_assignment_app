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


// A tasks row plus its required skill names, folded in by array_agg.
export type TaskRowWithSkills = TaskRow & { skills: string[] };

// Every task at every level, with its skills, ordered by id. The result is
// flat on purpose: the service turns it into a tree with buildTaskTree.
export async function listTasksWithSkills(db: Db): Promise<TaskRowWithSkills[]> {
  const { rows } = await db.query<TaskRowWithSkills>(
    `SELECT t.id, t.title, t.status, t.assignee_id, t.parent_task_id,
            COALESCE(
              array_agg(s.name ORDER BY s.name) FILTER (WHERE s.id IS NOT NULL),
              '{}'
            ) AS skills
       FROM tasks t
       LEFT JOIN task_skills ts ON ts.task_id = t.id
       LEFT JOIN skills s       ON s.id = ts.skill_id
      GROUP BY t.id
      ORDER BY t.id`,
  );
  return rows;
}


// One task plus everything below it, with skills. Unlike
// countUnfinishedDescendants, the recursion starts AT the task, so the root
// row is included. An empty array means the task does not exist.
export async function listSubtreeWithSkills(db: Db, rootId: number): Promise<TaskRowWithSkills[]> {
  const { rows } = await db.query<TaskRowWithSkills>(
    `WITH RECURSIVE subtree AS (
       SELECT id FROM tasks WHERE id = $1
       UNION ALL
       SELECT t.id FROM tasks t JOIN subtree st ON t.parent_task_id = st.id
     )
     SELECT t.id, t.title, t.status, t.assignee_id, t.parent_task_id,
            COALESCE(
              array_agg(s.name ORDER BY s.name) FILTER (WHERE s.id IS NOT NULL),
              '{}'
            ) AS skills
       FROM subtree st
       JOIN tasks t             ON t.id = st.id
       LEFT JOIN task_skills ts ON ts.task_id = t.id
       LEFT JOIN skills s       ON s.id = ts.skill_id
      GROUP BY t.id
      ORDER BY t.id`,
    [rootId],
  );
  return rows;
}
import type { Db } from "../db.js";
import type { TaskRow } from "../domain.js";
import type { TaskStatus } from "../types.js";


export type NewTask = {
  title: string;
  status: TaskStatus;
  assigneeId: number | null;
  parentTaskId: number | null;
};


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


export async function insertTask(db: Db, task: NewTask): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO tasks (title, status, assignee_id, parent_task_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [task.title, task.status, task.assigneeId, task.parentTaskId],
  );
  const row = rows[0];
  if (!row) throw new Error("INSERT ... RETURNING returned no row");
  return row.id;
}


export async function insertTaskSkills(db: Db, taskId: number, skillIds: number[]): Promise<void> {
  if (skillIds.length === 0) return;
  await db.query(
    `INSERT INTO task_skills (task_id, skill_id)
     SELECT $1, unnest($2::int[])`,
    [taskId, skillIds],
  );
}


// The names of the skills one task requires, alphabetical. Empty when the
// task requires none (or does not exist: check that first).
export async function findTaskSkillNames(db: Db, taskId: number): Promise<string[]> {
  const { rows } = await db.query<{ name: string }>(
    `SELECT s.name
       FROM task_skills ts
       JOIN skills s ON s.id = ts.skill_id
      WHERE ts.task_id = $1
      ORDER BY s.name`,
    [taskId],
  );
  return rows.map((r) => r.name);
}


// Set or clear (null) a task's assignee. Returns false if no row matched.
export async function updateAssignee(db: Db, taskId: number, assigneeId: number | null): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE tasks SET assignee_id = $2 WHERE id = $1`,
    [taskId, assigneeId],
  );
  return (rowCount ?? 0) > 0;
}


// The closest task ABOVE this one whose status is Done, or null if no
// ancestor is Done. The recursion walks UP: start at the parent, then the
// parent's parent, ... `depth` lets us pick the nearest one.
export async function findNearestDoneAncestor(
  db: Db,
  taskId: number,
): Promise<{ id: number; title: string } | null> {
  const { rows } = await db.query<{ id: number; title: string }>(
    `WITH RECURSIVE ancestors AS (
       SELECT p.id, p.title, p.status, p.parent_task_id, 1 AS depth
         FROM tasks c
         JOIN tasks p ON p.id = c.parent_task_id
        WHERE c.id = $1
       UNION ALL
       SELECT p.id, p.title, p.status, p.parent_task_id, a.depth + 1
         FROM tasks p
         JOIN ancestors a ON p.id = a.parent_task_id
     )
     SELECT id, title
       FROM ancestors
      WHERE status = 'Done'
      ORDER BY depth
      LIMIT 1`,
    [taskId],
  );
  return rows[0] ?? null;
}

// Set a task's status. Returns false if no row matched.
export async function updateStatus(db: Db, taskId: number, status: TaskStatus): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE tasks SET status = $2 WHERE id = $1`,
    [taskId, status],
  );
  return (rowCount ?? 0) > 0;
}
import { pool } from "./db.js";

type DeveloperRow = { id: number; name: string };

const taskId = Number(process.argv[2] ?? 1);

const qualified = await pool.query<DeveloperRow>(
  `SELECT d.id, d.name
     FROM developers d
    WHERE NOT EXISTS (
      SELECT 1 FROM task_skills ts
       WHERE ts.task_id = $1
         AND NOT EXISTS (SELECT 1 FROM developer_skills ds
                          WHERE ds.developer_id = d.id AND ds.skill_id = ts.skill_id))
    ORDER BY d.id`,
  [taskId],
);
const names = qualified.rows.map((r) => r.name).join(", ");
console.log(`Qualified for task ${taskId}: ${names || "(nobody)"}`);

const blockers = await pool.query<{ not_done: string }>(
  `WITH RECURSIVE subtree AS (
     SELECT id, status FROM tasks WHERE parent_task_id = $1
     UNION ALL
     SELECT t.id, t.status FROM tasks t JOIN subtree s ON t.parent_task_id = s.id
   )
   SELECT COUNT(*) FILTER (WHERE status <> 'Done') AS not_done FROM subtree`,
  [taskId],
);
// COUNT is a bigint, so pg returns a string. rows[0] may be undefined under
// noUncheckedIndexedAccess, hence the ?.
const notDone = Number(blockers.rows[0]?.not_done ?? 0);
console.log(`Unfinished subtasks under task ${taskId}: ${notDone}`);

await pool.end(); // close the pool, or Node keeps running
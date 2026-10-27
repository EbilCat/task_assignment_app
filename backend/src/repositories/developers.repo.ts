import type { Db } from "../db.js";

export type DeveloperSummary = { id: number; name: string };

// Developers who have every skill the task requires ("no required skill is
// missing"). Note: a task with no required skills, or a task id that does not
// exist, matches every developer. Checking that the task exists is the
// service's job.
export async function findQualifiedForTask(db: Db, taskId: number): Promise<DeveloperSummary[]> {
  const { rows } = await db.query<DeveloperSummary>(
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
  return rows;
}
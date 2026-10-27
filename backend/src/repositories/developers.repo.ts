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


export type DeveloperWithSkills = { id: number; name: string; skills: string[] };

// Every developer with their skill names, in ONE query.
// LEFT JOIN keeps a developer who has no skills yet. For that developer the
// join produces a single row with s.name = NULL; FILTER drops it, and
// COALESCE turns the resulting NULL array into an empty one.
export async function listDevelopers(db: Db): Promise<DeveloperWithSkills[]> {
  const { rows } = await db.query<DeveloperWithSkills>(
    `SELECT d.id, d.name,
            COALESCE(
              array_agg(s.name ORDER BY s.name) FILTER (WHERE s.id IS NOT NULL),
              '{}'
            ) AS skills
       FROM developers d
       LEFT JOIN developer_skills ds ON ds.developer_id = d.id
       LEFT JOIN skills s            ON s.id = ds.skill_id
      GROUP BY d.id
      ORDER BY d.id`,
  );
  return rows;
}


export async function findExistingDeveloperIds(db: Db, ids: number[]): Promise<number[]> {
  if (ids.length === 0) return [];
  const { rows } = await db.query<{ id: number }>(
    `SELECT id FROM developers WHERE id = ANY($1::int[])`,
    [ids],
  );
  return rows.map((r) => r.id);
}
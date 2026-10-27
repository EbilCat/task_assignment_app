import type { Db } from "../db.js";

export type SkillRow = { id: number; name: string };

// Alphabetical, because the frontend shows this as a pick list.
export async function listSkills(db: Db): Promise<SkillRow[]> {
  const { rows } = await db.query<SkillRow>(
    `SELECT id, name FROM skills ORDER BY name`,
  );
  return rows;
}
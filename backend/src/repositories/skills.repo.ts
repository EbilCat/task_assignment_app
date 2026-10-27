import type { Db } from "../db.js";

export type SkillRow = { id: number; name: string };

// Alphabetical, because the frontend shows this as a pick list.
export async function listSkills(db: Db): Promise<SkillRow[]> {
  const { rows } = await db.query<SkillRow>(
    `SELECT id, name FROM skills ORDER BY name`,
  );
  return rows;
}


export async function findSkillsByNames(db: Db, names: string[]): Promise<SkillRow[]> {
  if (names.length === 0) return [];
  const { rows } = await db.query<SkillRow>(
    `SELECT id, name FROM skills WHERE name = ANY($1::text[])`,
    [names],
  );
  return rows;
}
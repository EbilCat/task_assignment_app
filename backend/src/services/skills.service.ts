import { pool } from "../db.js";
import * as skillsRepo from "../repositories/skills.repo.js";
import type { SkillRow } from "../repositories/skills.repo.js";

export async function listSkills(): Promise<SkillRow[]> {
  return skillsRepo.listSkills(pool);
}
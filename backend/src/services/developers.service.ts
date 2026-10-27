import { pool } from "../db.js";
import * as developersRepo from "../repositories/developers.repo.js";
import type { DeveloperWithSkills } from "../repositories/developers.repo.js";

// No rule applies to listing developers yet. It still goes through a service
// so routes never import repositories: imports point down one layer only.
export async function listDevelopers(): Promise<DeveloperWithSkills[]> {
  return developersRepo.listDevelopers(pool);
}
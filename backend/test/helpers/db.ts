import { readFile } from "node:fs/promises";
import { config } from "../../src/config.js";
import { pool } from "../../src/db.js";

// resetDb() wipes every table. Refuse to run against anything that is not
// the Postgres container on this machine.
if (!/@(localhost|127\.0\.0\.1)(:\d+)?\//.test(config.databaseUrl)) {
  throw new Error("Tests reset the database: DATABASE_URL must point at localhost");
}

// The same seed file Postgres runs on first boot: one source of test data.
// (this file is backend/test/helpers/db.ts, so ../../../ is the repo root)
const seedSql = await readFile(new URL("../../../db/init/002_seed.sql", import.meta.url), "utf8");

// Back to exactly the seed: Alice 1, Bob 2, Carol 3, Dave 4; tasks 1-5.
// RESTART IDENTITY resets the id counters, so the next new task is #6 again.
export async function resetDb(): Promise<void> {
  await pool.query(
    "TRUNCATE task_skills, developer_skills, tasks, developers, skills RESTART IDENTITY CASCADE",
  );
  await pool.query(seedSql); // no $1 params, so several statements in one call are fine
}
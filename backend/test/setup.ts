import { afterAll } from "vitest";
import { pool } from "../src/db.js";

// Each test file gets its own copy of src/db.ts, so its own pool. Close it
// when the file is done, or vitest waits on the open connections and
// reports "close timed out".
afterAll(async () => {
  await pool.end();
});
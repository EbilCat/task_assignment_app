import { afterAll } from "vitest";
import { config } from "../src/config.js";
import { pool } from "../src/db.js";

// Tests never call the real Gemini, even if our .env has a key: with no key,
// generateJson answers { ok: false, reason: "no_key" } and POST /tasks falls
// back to "no skills" for unticked nodes, exactly as before inference existed.
// (test/inference.test.ts replaces generateJson with a fake instead.)
config.gemini.apiKey = null;

// Each test file gets its own copy of src/db.ts, so its own pool. Close it
// when the file is done, or vitest waits on the open connections and
// reports "close timed out".
afterAll(async () => {
  await pool.end();
});
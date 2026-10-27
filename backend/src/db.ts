import pg from "pg";
import type { QueryResult, QueryResultRow } from "pg";
import { config } from "./config.js";

// One pool for the whole process.
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,                        // at most 10 open connections
  idleTimeoutMillis: 30_000,      // close a connection idle for 30 s
  connectionTimeoutMillis: 2_000, // give up waiting for a connection after 2 s
});

// An idle connection can die (Postgres restarted, network blip). The pool then
// emits 'error'. Without a listener Node treats it as unhandled and crashes.
pool.on("error", (err) => {
  console.error("Idle Postgres connection failed:", err.message);
});

export interface Db {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<R>>;
}

// Round trip to the database. Throws if Postgres can't be reached.
export async function pingDb(): Promise<number> {
  const start = performance.now();
  await pool.query("SELECT 1");
  return Math.round(performance.now() - start);
}

// Run `work` inside ONE transaction on ONE connection.
// Every query in `work` must use the `db` it is given (never `pool`), because
// BEGIN/COMMIT only cover queries sent on the same connection.
//   resolves -> COMMIT, returns work's result
//   throws   -> ROLLBACK, rethrows the original error
// The connection always goes back to the pool (finally), and is destroyed
// instead if even ROLLBACK failed (it is probably broken).
export async function withTransaction<T>(work: (db: Db) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let broken = false;
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      broken = true;
    }
    throw err;
  } finally {
    client.release(broken); // release(true) destroys the connection
  }
}
import { buildApp } from "./app.js";
import { config } from "./config.js";
import { pool } from "./db.js";

const server = buildApp().listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});

// docker compose stop sends SIGTERM; Ctrl+C sends SIGINT
function shutdown(signal: string): void {
  console.log(`${signal} received, closing server`);
  server.close(async () => {
    await pool.end(); // waits for running queries, then closes every connection
    process.exit(0);
  });
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
import { buildApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);

const server = buildApp().listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

// docker compose stop sends SIGTERM; Ctrl+C sends SIGINT
function shutdown(signal: string): void {
  console.log(`${signal} received, closing server`);
  server.close(() => process.exit(0));
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

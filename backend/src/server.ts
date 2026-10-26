import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Developer } from "./types.js";

const PORT = Number(process.env.PORT ?? 3000);

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const sampleDevs: Developer[] = [
  { id: 1, name: "Alice", skills: ["Frontend"] },
  { id: 2, name: "Bob", skills: ["Backend"] },
  { id: 3, name: "Carol", skills: ["Frontend", "Backend"] },
  { id: 4, name: "Dave", skills: ["Backend"] },
];

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  switch (req.url) {
    case "/health":
      return send(res, 200, { status: "ok" });
    case "/types-demo":
      return send(res, 200, sampleDevs.filter((d) => d.skills.includes("Backend")));
    default:
      return send(res, 404, { error: "Not found" });
  }
}

createServer((req, res) => {
  handle(req, res).catch((err: unknown) => {
    console.error(err);
    send(res, 500, { error: "Internal error" });
  });
}).listen(PORT, () => console.log(`backend listening on :${PORT}`));
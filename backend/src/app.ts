import express, { type Request, type Response, type NextFunction } from "express";
import { requestLog } from "./middleware/requestLog.js";
import { healthRouter } from "./routes/health.js";

export function buildApp() {
  const app = express();

  // 1. middleware, logging and conversion to json
  app.use(requestLog);
  app.use(express.json());

  // 2. routes, only /health for now
  app.use(healthRouter);

  // 3. nothing matched: throw 404
  app.use((req, res) => {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.path}` },
    });
  });

  // 4. error handling
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (isBadJson(err)) {
      res.status(400).json({ error: { code: "BAD_JSON", message: "Request body is not valid JSON" } });
      return;
    }
    console.error(err);
    res.status(500).json({ error: { code: "INTERNAL", message: "Something went wrong" } });
  });

  return app;
}

// express.json() throws an error with type "entity.parse.failed" for malformed bodies
function isBadJson(err: unknown): boolean {
  return typeof err === "object" && err !== null && "type" in err && err.type === "entity.parse.failed";
}


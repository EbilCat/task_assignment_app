import express, { type Request, type Response, type NextFunction } from "express";
import { ZodError } from "zod";
import { requestLog } from "./middleware/requestLog.js";
import { healthRouter } from "./routes/health.js";
import { tasksRouter } from "./routes/tasks.js";
import { developersRouter } from "./routes/developers.js";
import { skillsRouter } from "./routes/skills.js";
import { ApiError, notFound } from "./errors.js";
import { zodToApiError } from "./validation.js";

export function buildApp({ log = true }: { log?: boolean } = {}) {
  const app = express();

  // 1. middleware that runs for every request, in this order
  if (log) app.use(requestLog);
  app.use(express.json());

  // 2. routes (one router per resource; each lives in src/routes/)
  app.use(healthRouter);
  app.use(tasksRouter);
  app.use(developersRouter);
  app.use(skillsRouter);

  // 3. nothing matched: must come after every route. Hand it to the error
  //    handler like any other error, so the body is built in one place.
  app.use((req, _res, next) => {
    next(notFound(`No route for ${req.method} ${req.path}`));
  });

  // 4. error handler: the four parameters are how Express recognises it.
  //    Express 5 sends here anything a handler throws, sync or async.
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err); // too late for a JSON body: let Express close the connection
      return;
    }
    const apiError = toApiError(err);
    if (apiError.status >= 500) console.error(err); // the real cause, server side only
    res.status(apiError.status).json(apiError.toBody());
  });

  return app;
}

// Anything thrown -> an ApiError. Unknown errors become INTERNAL with a
// generic message: never send err.message or a stack to the client.
function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof ZodError) return zodToApiError(err); // a stray .parse() somewhere
  if (isBadJson(err)) return new ApiError("BAD_JSON", "Request body is not valid JSON");
  return new ApiError("INTERNAL", "Something went wrong");
}

// express.json() throws an error with type "entity.parse.failed" for malformed bodies
function isBadJson(err: unknown): boolean {
  return typeof err === "object" && err !== null && "type" in err && err.type === "entity.parse.failed";
}
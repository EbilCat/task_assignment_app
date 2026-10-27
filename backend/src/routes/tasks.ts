import { Router, type Request, type Response } from "express";
import * as tasksService from "../services/tasks.service.js";
import { TaskIdParams } from "../schemas/tasks.schema.js";
import { validationError } from "../validation.js";

export const tasksRouter = Router();


////////////////
//* Functions
////////////////
function taskNotFound(taskId: number) {
  return { error: { code: "NOT_FOUND", message: `Task ${taskId} not found` } };
}

// Validates req.params with zod. On failure it sends the 400 itself and
// returns null, so each handler only needs `if (taskId === null) return;`.
function parseTaskId(req: Request, res: Response): number | null {
  const parsed = TaskIdParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json(validationError(parsed.error));
    return null;
  }
  return parsed.data.id;
}


////////////////
//* Routes
////////////////
tasksRouter.get("/tasks", async (_req, res) => {
  const tasks = await tasksService.listTaskTree();
  res.json({ tasks });
});

tasksRouter.get("/tasks/:id", async (req, res) => {
  const taskId = parseTaskId(req, res);
  if (taskId === null) return;

  const task = await tasksService.getTaskTree(taskId);
  if (task === null) {
    res.status(404).json(taskNotFound(taskId));
    return;
  }

  res.json({ task });
});

tasksRouter.get("/tasks/:id/qualified-developers", async (req, res) => {
  const taskId = parseTaskId(req, res);
  if (taskId === null) return;

  const developers = await tasksService.getQualifiedDevelopers(taskId);
  if (developers === null) {
    res.status(404).json(taskNotFound(taskId));
    return;
  }

  res.json({ taskId, developers });
});
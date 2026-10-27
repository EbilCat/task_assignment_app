import { Router, type Request, type Response } from "express";
import * as tasksService from "../services/tasks.service.js";
import { CreateTaskBody, TaskIdParams } from "../schemas/tasks.schema.js";
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


tasksRouter.post("/tasks", async (req, res) => {
  // shape: zod (req.body is undefined without Content-Type: application/json,
  // which zod also rejects with a 400)
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(validationError(parsed.error));
    return;
  }

  const result = await tasksService.createTask(parsed.data);
  if (!result.ok) {
    const { path, message } = result.problem;
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: `${path}: ${message}`, details: [{ path, message }] },
    });
    return;
  }

  res.status(201).location(`/tasks/${result.task.id}`).json({ task: result.task });
});
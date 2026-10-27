import { Router, type Request, type Response } from "express";
import * as tasksService from "../services/tasks.service.js";
import { CreateTaskBody, TaskIdParams, AssignBody, UpdateStatusBody } from "../schemas/tasks.schema.js";
import { problemBody, validationError } from "../validation.js";

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
    const { code, path, message } = result.problem;
    // 400: the body refers to something that doesn't exist
    // 422: everything exists, but the request breaks a business rule
    //      (NOT_QUALIFIED = rule 1, SUBTASKS_NOT_DONE = rule 2)
    res.status(code === "BAD_REQUEST" ? 400 : 422).json(problemBody(code, path, message));
    return;
  }

  res.status(201).location(`/tasks/${result.task.id}`).json({ task: result.task });
});


// Rule 1 on an existing task. Body: { "assigneeId": 3 } or { "assigneeId": null }.
tasksRouter.patch("/tasks/:id/assignee", async (req, res) => {
  const taskId = parseTaskId(req, res);
  if (taskId === null) return;

  const parsed = AssignBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(validationError(parsed.error));
    return;
  }

  const result = await tasksService.assignTask(taskId, parsed.data.assigneeId);
  switch (result.kind) {
    case "ok":
      res.json({ task: result.task });
      return;
    case "task_not_found":
      res.status(404).json(taskNotFound(taskId));
      return;
    case "developer_not_found":
      res.status(400).json(problemBody("BAD_REQUEST", "assigneeId", `Developer ${result.developerId} not found`));
      return;
    case "not_qualified":
      res.status(422).json(problemBody("NOT_QUALIFIED", "assigneeId", result.message));
      return;
  }
});


// Rule 2 on an existing task. Body: { "status": "Done" } (or "To Do" / "In Progress").
tasksRouter.patch("/tasks/:id/status", async (req, res) => {
  const taskId = parseTaskId(req, res);
  if (taskId === null) return;

  const parsed = UpdateStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(validationError(parsed.error));
    return;
  }

  const result = await tasksService.changeStatus(taskId, parsed.data.status);
  switch (result.kind) {
    case "ok":
      res.json({ task: result.task });
      return;
    case "task_not_found":
      res.status(404).json(taskNotFound(taskId));
      return;
    case "subtasks_not_done":
      res.status(422).json(problemBody("SUBTASKS_NOT_DONE", "status", result.message));
      return;
    case "parent_done":
      res.status(422).json(problemBody("PARENT_DONE", "status", result.message));
      return;
  }
});
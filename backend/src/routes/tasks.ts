import { Router } from "express";
import * as tasksService from "../services/tasks.service.js";
import { AssignBody, CreateTaskBody, TaskIdParams, UpdateStatusBody } from "../schemas/tasks.schema.js";
import { parse } from "../validation.js";
import { assertNever, fieldError, notFound } from "../errors.js";

export const tasksRouter = Router();

// Routes translate HTTP <-> service calls: parse input (parse() throws a 400),
// call one service function, then send the success response or THROW an
// ApiError. The error handler in app.ts writes every error response; no
// route calls res.status(4xx) any more.

const taskNotFound = (taskId: number) => notFound(`Task ${taskId} not found`);

tasksRouter.get("/tasks", async (_req, res) => {
  const tasks = await tasksService.listTaskTree();
  res.json({ tasks });
});

tasksRouter.post("/tasks", async (req, res) => {
  // shape: zod (req.body is undefined without Content-Type: application/json,
  // which zod also rejects with a 400)
  const body = parse(CreateTaskBody, req.body);

  // facts + rules + insert: the service
  const result = await tasksService.createTask(body);
  if (!result.ok) {
    const { code, path, message } = result.problem;
    throw fieldError(code, path, message); // 400 or 422: STATUS_BY_CODE decides
  }

  res.status(201).location(`/tasks/${result.task.id}`).json({ task: result.task });
});

tasksRouter.get("/tasks/:id", async (req, res) => {
  const { id } = parse(TaskIdParams, req.params);
  const task = await tasksService.getTaskTree(id);
  if (task === null) throw taskNotFound(id);
  res.json({ task });
});

tasksRouter.get("/tasks/:id/qualified-developers", async (req, res) => {
  const { id } = parse(TaskIdParams, req.params);
  const developers = await tasksService.getQualifiedDevelopers(id);
  if (developers === null) throw taskNotFound(id);
  res.json({ taskId: id, developers });
});

// Rule 1 on an existing task. Body: { "assigneeId": 3 } or { "assigneeId": null }.
tasksRouter.patch("/tasks/:id/assignee", async (req, res) => {
  const { id } = parse(TaskIdParams, req.params);
  const { assigneeId } = parse(AssignBody, req.body);

  const result = await tasksService.assignTask(id, assigneeId);
  switch (result.kind) {
    case "ok":
      res.json({ task: result.task });
      return;
    case "task_not_found":
      throw taskNotFound(id);
    case "developer_not_found":
      throw fieldError("BAD_REQUEST", "assigneeId", `Developer ${result.developerId} not found`);
    case "not_qualified":
      throw fieldError("NOT_QUALIFIED", "assigneeId", result.message);
    default:
      assertNever(result);
  }
});

// Rule 2 on an existing task. Body: { "status": "Done" } (or "To Do" / "In Progress").
tasksRouter.patch("/tasks/:id/status", async (req, res) => {
  const { id } = parse(TaskIdParams, req.params);
  const { status } = parse(UpdateStatusBody, req.body);

  const result = await tasksService.changeStatus(id, status);
  switch (result.kind) {
    case "ok":
      res.json({ task: result.task });
      return;
    case "task_not_found":
      throw taskNotFound(id);
    case "subtasks_not_done":
      throw fieldError("SUBTASKS_NOT_DONE", "status", result.message);
    case "parent_done":
      throw fieldError("PARENT_DONE", "status", result.message);
    default:
      assertNever(result);
  }
});
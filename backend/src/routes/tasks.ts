import { Router } from "express";
import * as tasksService from "../services/tasks.service.js";

export const tasksRouter = Router();

const BAD_TASK_ID = {
  error: { code: "BAD_REQUEST", message: "Task id must be a positive integer" },
};

function taskNotFound(taskId: number) {
  return { error: { code: "NOT_FOUND", message: `Task ${taskId} not found` } };
}

function parseTaskId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}


tasksRouter.get("/tasks", async (_req, res) => {
  const tasks = await tasksService.listTaskTree();
  res.json({ tasks });
});

tasksRouter.get("/tasks/:id", async (req, res) => {
  const taskId = parseTaskId(req.params.id);
  if (taskId === null) {
    res.status(400).json(BAD_TASK_ID);
    return;
  }

  const task = await tasksService.getTaskTree(taskId);
  if (task === null) {
    res.status(404).json(taskNotFound(taskId));
    return;
  }

  res.json({ task });
});

tasksRouter.get("/tasks/:id/qualified-developers", async (req, res) => {
  const taskId = parseTaskId(req.params.id);
  if (taskId === null) {
    res.status(400).json(BAD_TASK_ID);
    return;
  }

  const developers = await tasksService.getQualifiedDevelopers(taskId);
  if (developers === null) {
    res.status(404).json(taskNotFound(taskId));
    return;
  }

  res.json({ taskId, developers });
});
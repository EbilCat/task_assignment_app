import { Router } from "express";
import * as tasksService from "../services/tasks.service.js";

export const tasksRouter = Router();

// Routes translate HTTP <-> service calls: parse input, call one service
// function, pick the status code. No SQL here.
tasksRouter.get("/tasks/:id/qualified-developers", async (req, res) => {
  const taskId = Number(req.params.id);
  if (!Number.isInteger(taskId) || taskId <= 0) {
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: "Task id must be a positive integer" },
    });
    return;
  }

  const developers = await tasksService.getQualifiedDevelopers(taskId);
  if (developers === null) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: `Task ${taskId} not found` } });
    return;
  }

  res.json({ taskId, developers });
});
import { Router } from "express";
import { pingDb } from "../db.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", uptimeSeconds: Math.round(process.uptime()) });
});

healthRouter.get("/health/db", async (_req, res) => {
  try {
    const latencyMs = await pingDb();
    res.json({ db: "up", latencyMs });
  } catch (err) {
    console.error("DB health check failed:", err instanceof Error ? err.message : err);
    res.status(503).json({ db: "down" });
  }
});
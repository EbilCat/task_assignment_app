import { Router } from "express";
import * as skillsService from "../services/skills.service.js";

export const skillsRouter = Router();

skillsRouter.get("/skills", async (_req, res) => {
  const skills = await skillsService.listSkills();
  res.json({ skills });
});
import { Router } from "express";
import * as developersService from "../services/developers.service.js";

export const developersRouter = Router();

developersRouter.get("/developers", async (_req, res) => {
  const developers = await developersService.listDevelopers();
  res.json({ developers });
});
import { pool } from "../db.js";
import * as tasksRepo from "../repositories/tasks.repo.js";
import * as developersRepo from "../repositories/developers.repo.js";
import type { DeveloperSummary } from "../repositories/developers.repo.js";


export async function getQualifiedDevelopers(taskId: number): Promise<DeveloperSummary[] | null> {
  const task = await tasksRepo.findTaskById(pool, taskId);
  if (!task) return null; // without this, task 999 would "match" everyone
  return developersRepo.findQualifiedForTask(pool, taskId);
}

export type DoneCheck = { canBeDone: boolean; unfinishedSubtasks: number };

// The Done rule: a task can be Done only when every descendant is Done.
export async function checkCanBeDone(taskId: number): Promise<DoneCheck | null> {
  const task = await tasksRepo.findTaskById(pool, taskId);
  if (!task) return null;
  const unfinishedSubtasks = await tasksRepo.countUnfinishedDescendants(pool, taskId);
  return { canBeDone: unfinishedSubtasks === 0, unfinishedSubtasks };
}
import { pool } from "../db.js";
import * as tasksRepo from "../repositories/tasks.repo.js";
import * as developersRepo from "../repositories/developers.repo.js";
import type { DeveloperSummary } from "../repositories/developers.repo.js";
import type { TaskRowWithSkills } from "../repositories/tasks.repo.js";
import type { Task } from "../domain.js";
import { buildTaskTree } from "../tree.js";


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


// All tasks as a forest: only top-level tasks at the root, subtasks nested.
export async function listTaskTree(): Promise<Task[]> {
  const rows = await tasksRepo.listTasksWithSkills(pool);
  return buildTaskTree(rows, skillsByTask(rows));
}


// One task with its whole subtree. The root's parent is not in this result
// set, so buildTaskTree puts it at the root (its "parent not found" branch).
export async function getTaskTree(taskId: number): Promise<Task | null> {
  const rows = await tasksRepo.listSubtreeWithSkills(pool, taskId);
  if (rows.length === 0) return null;
  const [root] = buildTaskTree(rows, skillsByTask(rows));
  return root ?? null;
}


// buildTaskTree takes skills as a Map keyed by task id.
function skillsByTask(rows: TaskRowWithSkills[]): Map<number, string[]> {
  return new Map(rows.map((r) => [r.id, r.skills]));
}
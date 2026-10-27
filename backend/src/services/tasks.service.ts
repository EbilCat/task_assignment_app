import { pool, withTransaction, type Db } from "../db.js";
import * as skillsRepo from "../repositories/skills.repo.js";
import type { CreateTaskInput } from "../schemas/tasks.schema.js";
import * as tasksRepo from "../repositories/tasks.repo.js";
import * as developersRepo from "../repositories/developers.repo.js";
import type { DeveloperSummary } from "../repositories/developers.repo.js";
import type { TaskRowWithSkills } from "../repositories/tasks.repo.js";
import type { Task } from "../domain.js";
import { buildTaskTree } from "../tree.js";
import { missingSkills, notQualifiedMessage } from "../rules.js";


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


// ---- assign ---------------------------------------------------------------

// Every way PATCH /tasks/:id/assignee can end. The route maps each kind to
// a status code; the service never sees HTTP.
export type AssignResult =
  | { kind: "ok"; task: Task }
  | { kind: "task_not_found" }
  | { kind: "developer_not_found"; developerId: number }
  | { kind: "not_qualified"; message: string; missing: string[] };

// Rule 1 for an EXISTING task: the task's skills come from the database,
// the developer's skills too, and the same missingSkills() decides.
// null = unassign, always allowed.
export async function assignTask(taskId: number, assigneeId: number | null): Promise<AssignResult> {
  const task = await tasksRepo.findTaskById(pool, taskId);
  if (!task) return { kind: "task_not_found" };

  if (assigneeId !== null) {
    const [developer] = await developersRepo.findDevelopersByIds(pool, [assigneeId]);
    if (!developer) return { kind: "developer_not_found", developerId: assigneeId };

    const required = await tasksRepo.findTaskSkillNames(pool, taskId);
    const missing = missingSkills(required, developer.skills);
    if (missing.length > 0) {
      return { kind: "not_qualified", message: notQualifiedMessage(developer.name, missing), missing };
    }
  }

  await tasksRepo.updateAssignee(pool, taskId, assigneeId);
  const updated = await getTaskTree(taskId);
  if (!updated) return { kind: "task_not_found" }; // deleted in between
  return { kind: "ok", task: updated };
}


// ---- create ---------------------------------------------------------------

// Why a create was refused, pointing at the offending field with the same
// dotted path style as zod ("subtasks.1.skills.0").
//   BAD_REQUEST   the body names something that doesn't exist (400)
//   NOT_QUALIFIED rule 1: the assignee lacks a required skill (422)
export type ProblemCode = "BAD_REQUEST" | "NOT_QUALIFIED";
export type CreateTaskProblem = { code: ProblemCode; path: string; message: string };
export type CreateTaskResult =
  | { ok: true; task: Task }
  | { ok: false; problem: CreateTaskProblem };

// Create a task and its whole subtask tree.
//  1. Check the facts zod can't (do these skills / developers exist?) with
//     two queries for the whole tree, BEFORE opening a transaction.
//  2. Insert every row inside one transaction: all of them or none.
//  3. Read the new tree back the same way GET /tasks/:id does.
export async function createTask(input: CreateTaskInput): Promise<CreateTaskResult> {
  const nodes = flatten(input);

  // 1a. skills: one lookup for every distinct name in the tree
  const names = [...new Set(nodes.flatMap(({ node }) => node.skills ?? []))];
  const skills = await skillsRepo.findSkillsByNames(pool, names);
  const skillIdByName = new Map(skills.map((s) => [s.name, s.id]));
  for (const { path, node } of nodes) {
    for (const [i, name] of (node.skills ?? []).entries()) {
      if (!skillIdByName.has(name)) {
        return fail(join(path, `skills.${i}`), `Unknown skill "${name}"`);
      }
    }
  }

  // 1b. assignees: one lookup (with their skills) for every distinct id
  const ids = [...new Set(nodes.flatMap(({ node }) => (node.assigneeId == null ? [] : [node.assigneeId])))];
  const developers = await developersRepo.findDevelopersByIds(pool, ids);
  const developerById = new Map(developers.map((d) => [d.id, d]));
  for (const { path, node } of nodes) {
    if (node.assigneeId == null) continue; // unassigned is always allowed
    const developer = developerById.get(node.assigneeId);
    if (!developer) {
      return fail(join(path, "assigneeId"), `Developer ${node.assigneeId} not found`);
    }
    // 1c. rule 1, per node: only THIS node's own skills count
    const missing = missingSkills(node.skills ?? [], developer.skills);
    if (missing.length > 0) {
      return fail(join(path, "assigneeId"), notQualifiedMessage(developer.name, missing), "NOT_QUALIFIED");
    }
  }

  

  // 2. all rows or none
  const rootId = await withTransaction((db) => insertTree(db, input, null, skillIdByName));

  // 3. committed, so a normal pool query sees it
  const task = await getTaskTree(rootId);
  if (!task) throw new Error(`Task ${rootId} missing right after insert`);
  return { ok: true, task };
}

// Depth-first: insert the parent, use its new id as the children's
// parent_task_id. Awaited one by one: a transaction is one connection, and
// one connection runs one query at a time anyway.
async function insertTree(
  db: Db,
  node: CreateTaskInput,
  parentTaskId: number | null,
  skillIdByName: Map<string, number>,
): Promise<number> {
  const id = await tasksRepo.insertTask(db, {
    title: node.title,
    status: node.status ?? "To Do",
    assigneeId: node.assigneeId ?? null,
    parentTaskId,
  });
  const skillIds = (node.skills ?? []).flatMap((name) => {
    const skillId = skillIdByName.get(name);
    return skillId === undefined ? [] : [skillId];
  });
  await tasksRepo.insertTaskSkills(db, id, skillIds);
  for (const child of node.subtasks ?? []) {
    await insertTree(db, child, id, skillIdByName);
  }
  return id;
}

// Every node of the input tree with its path: "" for the root,
// "subtasks.1", "subtasks.1.subtasks.0", ...
type Located = { path: string; node: CreateTaskInput };
function flatten(node: CreateTaskInput, path = ""): Located[] {
  const children = (node.subtasks ?? []).flatMap((child, i) =>
    flatten(child, join(path, `subtasks.${i}`)),
  );
  return [{ path, node }, ...children];
}

function join(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

function fail(path: string, message: string, code: ProblemCode = "BAD_REQUEST"): CreateTaskResult {
  return { ok: false, problem: { code, path, message } };
}
import { pool, withTransaction, type Db } from "../db.js";
import * as skillsRepo from "../repositories/skills.repo.js";
import type { CreateTaskInput } from "../schemas/tasks.schema.js";
import * as tasksRepo from "../repositories/tasks.repo.js";
import * as developersRepo from "../repositories/developers.repo.js";
import type { DeveloperSummary } from "../repositories/developers.repo.js";
import type { TaskRowWithSkills } from "../repositories/tasks.repo.js";
import type { Task } from "../domain.js";
import { buildTaskTree } from "../tree.js";
import { suggestSkillsForTasks, type SkillQuestion } from "../llm/skills.js";
import type { LlmFailure } from "../llm/gemini.js";
import { countUnfinishedBelow, missingSkills, notQualifiedMessage, parentDoneMessage, subtasksNotDoneMessage } from "../rules.js";
import type { TaskStatus } from "../types.js";
import type { ErrorCode } from "../errors.js";


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


// ---- status ---------------------------------------------------------------

// Every way PATCH /tasks/:id/status can end (same pattern as AssignResult).
export type StatusResult =
  | { kind: "ok"; task: Task }
  | { kind: "task_not_found" }
  | { kind: "subtasks_not_done"; message: string; unfinished: number }
  | { kind: "parent_done"; message: string; parentId: number };

// Rule 2 for an EXISTING task, in both directions:
//  - moving TO Done: every descendant must already be Done
//  - moving AWAY from Done (or staying not Done): no ancestor may be Done,
//    otherwise that ancestor would be Done with an unfinished subtask
export async function changeStatus(taskId: number, status: TaskStatus): Promise<StatusResult> {
  const task = await tasksRepo.findTaskById(pool, taskId);
  if (!task) return { kind: "task_not_found" };

  if (status === "Done") {
    const unfinished = await tasksRepo.countUnfinishedDescendants(pool, taskId);
    if (unfinished > 0) {
      return { kind: "subtasks_not_done", message: subtasksNotDoneMessage(unfinished), unfinished };
    }
  } else {
    const parent = await tasksRepo.findNearestDoneAncestor(pool, taskId);
    if (parent) {
      return { kind: "parent_done", message: parentDoneMessage(parent.id, parent.title), parentId: parent.id };
    }
  }

  await tasksRepo.updateStatus(pool, taskId, status);
  const updated = await getTaskTree(taskId);
  if (!updated) return { kind: "task_not_found" }; // deleted in between
  return { kind: "ok", task: updated };
}


// ---- create ---------------------------------------------------------------

// Why a create was refused, pointing at the offending field with the same
// dotted path style as zod ("subtasks.1.skills.0").
//   BAD_REQUEST       the body names something that doesn't exist
//   NOT_QUALIFIED     rule 1: the assignee lacks a required skill
//   SUBTASKS_NOT_DONE rule 2: a node is Done but something below it isn't
// Only the code: the HTTP status comes from STATUS_BY_CODE in errors.ts.
export type ProblemCode = Extract<ErrorCode, "BAD_REQUEST" | "NOT_QUALIFIED" | "SUBTASKS_NOT_DONE">;
export type CreateTaskProblem = { code: ProblemCode; path: string; message: string };

// What skill inference did for this request. It goes back to the client
// so the form can say what was suggested, or that suggestions were off.
//   skipped  every node had skills ticked: no Gemini call was made
//   ok       Gemini answered; `inferred` lists every node it was asked about
//   failed   no key / timeout / bad answer: those nodes were saved with NO skills
export type InferredSkills = { path: string; title: string; skills: string[] };
export type InferenceReport =
  | { status: "skipped" }
  | { status: "ok"; inferred: InferredSkills[]; ms: number }
  | { status: "failed"; reason: LlmFailure; ms: number };

export type CreateTaskResult =
  | { ok: true; task: Task; inference: InferenceReport }
  | { ok: false; problem: CreateTaskProblem };

// Added to a rule-1 message when the skills came from Gemini, so the user
// knows why a skill they never ticked is "required".
const INFERRED_NOTE = " (skills suggested from the title; tick skills yourself to override)";

// Create a task and its whole subtask tree.
//  1. Cheap checks first, so a request that will fail anyway never costs
//     a Gemini call: skill names exist, assignees exist, rule 2.
//  2. Skill inference for nodes with NO skills: one call for the whole tree,
//     outside any transaction. It never fails the request.
//  3. Rule 1 against the FINAL skills (ticked or inferred).
//  4. Insert every row inside one transaction: all of them or none.
//  5. Read the new tree back the same way GET /tasks/:id does.
export async function createTask(body: CreateTaskInput): Promise<CreateTaskResult> {
  const located = flatten(body);

  // 1a. skills: the table is tiny, so load all of it once. It is both the
  //     name -> id map and the allowed list we give Gemini.
  const allSkills = await skillsRepo.listSkills(pool);
  const skillIdByName = new Map(allSkills.map((s) => [s.name, s.id]));
  for (const { path, node } of located) {
    for (const [i, name] of (node.skills ?? []).entries()) {
      if (!skillIdByName.has(name)) {
        return fail(join(path, `skills.${i}`), `Unknown skill "${name}"`);
      }
    }
  }

  // 1b. assignees: one lookup (with their skills) for every distinct id
  const ids = [...new Set(located.flatMap(({ node }) => (node.assigneeId == null ? [] : [node.assigneeId])))];
  const developers = await developersRepo.findDevelopersByIds(pool, ids);
  const developerById = new Map(developers.map((d) => [d.id, d]));
  for (const { path, node } of located) {
    if (node.assigneeId != null && !developerById.has(node.assigneeId)) {
      return fail(join(path, "assigneeId"), `Developer ${node.assigneeId} not found`);
    }
  }

  // 1c. rule 2, per node: a Done node needs every node below it Done.
  //     No query: the whole new tree is in the body. (A new task is always
  //     a root, so there is no saved parent to check.)
  for (const { path, node } of located) {
    if (node.status !== "Done") continue;
    const unfinished = countUnfinishedBelow(node);
    if (unfinished > 0) {
      return fail(join(path, "status"), subtasksNotDoneMessage(unfinished), "SUBTASKS_NOT_DONE");
    }
  }

  // 2. inference: `input` is a COPY of the body with skills filled in
  const { input, inference } = await inferMissingSkills(body, allSkills.map((s) => s.name));
  const inferredPaths = new Set(inference.status === "ok" ? inference.inferred.map((i) => i.path) : []);

  // 3. rule 1, per node: only THIS node's own (final) skills count
  for (const { path, node } of flatten(input)) {
    if (node.assigneeId == null) continue; // unassigned is always allowed
    const developer = developerById.get(node.assigneeId)!; // existence checked in 1b
    const missing = missingSkills(node.skills ?? [], developer.skills);
    if (missing.length > 0) {
      const message = notQualifiedMessage(developer.name, missing) + (inferredPaths.has(path) ? INFERRED_NOTE : "");
      return fail(join(path, "assigneeId"), message, "NOT_QUALIFIED");
    }
  }

  // 4. all rows or none
  const rootId = await withTransaction((db) => insertTree(db, input, null, skillIdByName));

  // 5. committed, so a normal pool query sees it
  const task = await getTaskTree(rootId);
  if (!task) throw new Error(`Task ${rootId} missing right after insert`);
  return { ok: true, task, inference };
}

// ---- skill inference ------------------------------------------------------

// Nodes with no skills ticked (skills missing or []) are the ones to infer.
// Returns a copy of the body with their skills filled in, plus a report.
// Fallback on ANY failure: keep those nodes skill-less (anyone may take
// them) and log why. A missing key is normal in dev and tests: not logged.
async function inferMissingSkills(
  body: CreateTaskInput,
  allowed: string[],
): Promise<{ input: CreateTaskInput; inference: InferenceReport }> {
  const todo = flatten(body).filter(({ node }) => (node.skills ?? []).length === 0);
  if (todo.length === 0) return { input: body, inference: { status: "skipped" } };

  // Short made-up ids ("T1", "T2", ...) instead of paths: easier for the
  // model, and they become an enum in the answer schema.
  const questions: SkillQuestion[] = todo.map(({ node, parent }, i) => ({
    id: `T${i + 1}`,
    title: node.title,
    ...(parent ? { parentTitle: parent.title } : {}),
  }));
  const result = await suggestSkillsForTasks(questions, allowed);

  if (!result.ok) {
    if (result.reason !== "no_key") {
      console.warn(`[llm] skill inference ${result.reason} after ${result.ms} ms: ${result.message}`);
    }
    return { input: body, inference: { status: "failed", reason: result.reason, ms: result.ms } };
  }

  const skillsByPath = new Map<string, string[]>();
  const inferred = todo.map(({ path, node }, i) => {
    const skills = result.data.get(`T${i + 1}`) ?? []; // an id the model left out = no skills
    skillsByPath.set(path, skills);
    return { path, title: node.title, skills };
  });
  return { input: withSkills(body, skillsByPath), inference: { status: "ok", inferred, ms: result.ms } };
}

// A copy of the tree with skills replaced where skillsByPath has an entry.
// The parsed body is never changed in place.
function withSkills(node: CreateTaskInput, skillsByPath: Map<string, string[]>, path = ""): CreateTaskInput {
  const copy: CreateTaskInput = { ...node, skills: skillsByPath.get(path) ?? node.skills };
  if (node.subtasks) {
    copy.subtasks = node.subtasks.map((child, i) => withSkills(child, skillsByPath, join(path, `subtasks.${i}`)));
  }
  return copy;
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

// Every node of the input tree with its path ("" for the root,
// "subtasks.1", "subtasks.1.subtasks.0", ...) and its parent (null for the root).
type Located = { path: string; node: CreateTaskInput; parent: CreateTaskInput | null };
function flatten(node: CreateTaskInput, path = "", parent: CreateTaskInput | null = null): Located[] {
  const children = (node.subtasks ?? []).flatMap((child, i) =>
    flatten(child, join(path, `subtasks.${i}`), node),
  );
  return [{ path, node, parent }, ...children];
}

function join(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

function fail(path: string, message: string, code: ProblemCode = "BAD_REQUEST"): CreateTaskResult {
  return { ok: false, problem: { code, path, message } };
}
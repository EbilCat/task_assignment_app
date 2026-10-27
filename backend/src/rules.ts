import type { TaskStatus } from "./types.js";

// Rule 1: a developer may be assigned to a task only if they have EVERY
// skill the task requires. Returns the required skills the developer lacks;
// an empty array means "qualified".
//   missingSkills(["Frontend", "Backend"], ["Backend"])  -> ["Frontend"]
//   missingSkills([], ["Backend"])                       -> []  (no requirement)
//   missingSkills(["Backend"], [])                       -> ["Backend"]
export function missingSkills(required: readonly string[], has: readonly string[]): string[] {
  const owned = new Set(has);
  return required.filter((skill) => !owned.has(skill));
}


export function notQualifiedMessage(developerName: string, missing: readonly string[]): string {
  const noun = missing.length === 1 ? "skill" : "skills";
  return `${developerName} lacks required ${noun}: ${missing.join(", ")}`;
}



// Rule 2: a task can be Done only when EVERY task below it (children,
// grandchildren, ...) is Done. This version works on a tree that is not in
// the database yet (the body of POST /tasks); for saved tasks the SQL
// countUnfinishedDescendants answers the same question.
// A missing status means "To Do" (the column default).
export type StatusTree = {
  status?: TaskStatus | undefined;
  subtasks?: readonly StatusTree[] | undefined;
};

// How many nodes BELOW this one (not counting itself) are not Done.
//   Done -> [To Do]              -> 1
//   Done -> [Done -> [To Do]]    -> 1  (the grandchild counts too)
//   To Do -> []                  -> 0
export function countUnfinishedBelow(node: StatusTree): number {
  let unfinished = 0;
  for (const child of node.subtasks ?? []) {
    if ((child.status ?? "To Do") !== "Done") unfinished++;
    unfinished += countUnfinishedBelow(child);
  }
  return unfinished;
}

// "Cannot be Done: 1 subtask is not Done"
// "Cannot be Done: 2 subtasks are not Done"
export function subtasksNotDoneMessage(unfinished: number): string {
  return unfinished === 1
    ? "Cannot be Done: 1 subtask is not Done"
    : `Cannot be Done: ${unfinished} subtasks are not Done`;
}

// The other direction: reopening a subtask under a Done parent would leave
// that parent Done with an unfinished subtask, so it is refused too.
// 'Parent task #3 "Auth API endpoint" is Done; reopen it first'
export function parentDoneMessage(parentId: number, parentTitle: string): string {
  return `Parent task #${parentId} "${parentTitle}" is Done; reopen it first`;
}
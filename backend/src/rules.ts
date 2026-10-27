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
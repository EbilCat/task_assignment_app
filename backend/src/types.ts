// One list of statuses: the TaskStatus type and the zod enum both come from it.
export const TASK_STATUSES = ["To Do", "In Progress", "Done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type Skill = "Frontend" | "Backend";
export type Developer = { id: number; name: string; skills: Skill[] };
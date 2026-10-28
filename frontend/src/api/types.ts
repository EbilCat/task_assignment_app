// The API's shapes, as the frontend sees them. These MIRROR the backend
// (backend/src/domain.ts, types.ts, errors.ts and the repositories); there is
// no shared package, so when a backend shape changes, change it here too.

export const TASK_STATUSES = ["To Do", "In Progress", "Done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

// GET /tasks -> { tasks: Task[] }, GET /tasks/:id -> { task: Task }
export type Task = {
  id: number;
  title: string;
  status: TaskStatus;
  assigneeId: number | null;
  parentTaskId: number | null;
  skills: string[]; // skill names, alphabetical
  subtasks: Task[];
};

// GET /developers -> { developers: Developer[] }
export type Developer = { id: number; name: string; skills: string[] };

// GET /tasks/:id/qualified-developers -> { taskId, developers: DeveloperSummary[] }
export type DeveloperSummary = { id: number; name: string };

// GET /skills -> { skills: Skill[] }
export type Skill = { id: number; name: string };

// POST /tasks body (backend: CreateTaskBody in schemas/tasks.schema.ts)
export type CreateTaskInput = {
  title: string;
  status?: TaskStatus;
  assigneeId?: number | null;
  skills?: string[];
  subtasks?: CreateTaskInput[];
};


// POST /tasks -> { task, inference } (backend: InferenceReport in
// services/tasks.service.ts, LlmFailure in llm/gemini.ts)
export type LlmFailure = "no_key" | "timeout" | "api_error" | "empty" | "bad_json" | "bad_shape";
export type InferredSkills = { path: string; title: string; skills: string[] }; // path "" = the root
export type InferenceReport =
  | { status: "skipped" } // every node had skills ticked
  | { status: "ok"; inferred: InferredSkills[]; ms: number }
  | { status: "failed"; reason: LlmFailure; ms: number }; // saved with no skills
export type CreateTaskResponse = { task: Task; inference: InferenceReport };


// Every error body (backend: errors.ts)
export type ErrorCode =
  | "BAD_REQUEST"
  | "BAD_JSON"
  | "NOT_FOUND"
  | "NOT_QUALIFIED"
  | "SUBTASKS_NOT_DONE"
  | "PARENT_DONE"
  | "INTERNAL";
export type IssueDetail = { path: string; message: string };
export type ErrorBody = {
  error: { code: ErrorCode; message: string; details: IssueDetail[] };
};
import { z } from "zod";
import { TASK_STATUSES } from "../types.js";


const ID_MESSAGE = "Task id must be a positive integer";

export const TaskIdParams = z.object({
  id: z.coerce
    .number({ error: ID_MESSAGE })
    .int({ error: ID_MESSAGE })
    .positive({ error: ID_MESSAGE }),
});


export const TaskStatusSchema = z.enum(TASK_STATUSES);


export const CreateTaskBody = z.strictObject({
  title: z.string().trim().min(1, { error: "Title must not be empty" }).max(200),
  status: TaskStatusSchema.optional(),
  assigneeId: z.number().int().positive().nullable().optional(),
  skills: z
    .array(z.string().trim().min(1))
    .max(10)
    .refine((names) => new Set(names).size === names.length, {
      error: "Skills must not repeat",
    })
    .optional(),
  get subtasks() {
    return z.array(CreateTaskBody).max(20).optional();
  },
});

export type CreateTaskInput = z.infer<typeof CreateTaskBody>;


// The body of PATCH /tasks/:id/assignee. assigneeId is REQUIRED: send a
// positive integer to assign, or null to unassign. {} is a 400, not "no change".
export const AssignBody = z.strictObject({
  assigneeId: z.number().int().positive().nullable(),
});
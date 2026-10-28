import { useState, type FormEvent } from "react";
import { describe } from "../api/describe";
import { useCreateTask, useDevelopers, useSkills } from "../api/queries";
import type { CreateTaskResponse, Task } from "../api/types";
import { FieldError } from "../components/FieldError";
import { TaskFields, type FormContext } from "../components/TaskFields";
import { countDrafts, emptyDraft, ownsPath, toInput, type TaskDraft } from "../forms/taskDraft";
import { hrefFor } from "../router";
import { InferenceNote } from "../components/InferenceNote";

function countTasks(task: Task): number {
  return 1 + task.subtasks.reduce((n, sub) => n + countTasks(sub), 0);
}

// The Task Creation page: a task and its subtasks, any depth.
// The DRAFT (one tree of TaskDraft) is the user's own input, so it lives in
// ONE useState here; everything from the server comes from TanStack Query.
export function TaskCreatePage() {
  const skills = useSkills();
  const developers = useDevelopers();
  const create = useCreateTask();
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft);
  const [created, setCreated] = useState<CreateTaskResponse | null>(null);

  if (!skills.data || !developers.data) {
    const error = skills.error ?? developers.error;
    return error ? <p role="alert">Could not load the form: {describe(error)}</p> : <p>Loading form…</p>;
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); // no browser form post: we send JSON ourselves
    setCreated(null);
    create.mutate(toInput(draft), {
      onSuccess: (response) => {
        setCreated(response); // { task, inference }
        setDraft(emptyDraft());
      },
    });
  }

  const error = create.error;
  const dismiss = () => create.reset();
  const ctx: FormContext = {
    skills: skills.data,
    developers: developers.data,
    details: error?.details ?? [],
    dismiss,
    // Adding/removing a subtask shifts the indices in the error paths, so an
    // old "subtasks.1.assigneeId" could land on the wrong node: clear it.
    onStructureChange: dismiss,
  };
  // Errors no node owns (NO_API, INTERNAL, an unexpected path) go on top.
  const unclaimed = error && !error.details.some((d) => ownsPath(draft, d.path));
  const total = countDrafts(draft);

  return (
    <section aria-labelledby="create-title">
      <header className="page-head">
        <h1 id="create-title">New task</h1>
      </header>

      {created && (
        <div role="status">
          <p className="notice">
            Created task #{created.task.id} “{created.task.title}”
            {countTasks(created.task) > 1 ? ` with ${countTasks(created.task) - 1} subtasks` : ""}.{" "}
            <a href={hrefFor("list")}>See it in the list</a>
          </p>
          <InferenceNote inference={created.inference} />
        </div>
      )}

      {unclaimed && <FieldError id="new-form-error" message={describe(error)} onDismiss={dismiss} />}

      <form className="task-form" onSubmit={onSubmit}>
        {/* the root node; it renders its own subtasks */}
        <TaskFields draft={draft} onChange={setDraft} prefix="" numbering="" ctx={ctx} />

        <button type="submit" className="primary" disabled={create.isPending}>
          {create.isPending ? "Creating (suggesting skills)…" : total === 1 ? "Create task" : `Create ${total} tasks`}
        </button>
      </form>
    </section>
  );
}
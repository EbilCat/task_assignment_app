import { useState, type FormEvent } from "react";
import { describe } from "../api/describe";
import { useCreateTask, useDevelopers, useSkills } from "../api/queries";
import { TASK_STATUSES, type Task, type TaskStatus } from "../api/types";
import { FieldError } from "../components/FieldError";
import { SkillPicker } from "../components/SkillPicker";
import { emptyDraft, toInput, type TaskDraft } from "../forms/taskDraft";
import { hrefFor } from "../router";

// The fields of a root task the backend can name in details[].path.
const FIELDS = ["title", "status", "assigneeId", "skills"];
const owns = (field: string, path: string) => path === field || path.startsWith(`${field}.`);

// The Task Creation page: one task (subtasks come next lesson).
// The DRAFT is the user's own input, so it lives in useState; everything
// that comes from the server (skills, developers, the created task, errors)
// comes from TanStack Query.
export function TaskCreatePage() {
  const skills = useSkills();
  const developers = useDevelopers();
  const create = useCreateTask();
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft);
  const [created, setCreated] = useState<Task | null>(null);

  if (!skills.data || !developers.data) {
    const error = skills.error ?? developers.error;
    return error ? <p role="alert">Could not load the form: {describe(error)}</p> : <p>Loading form…</p>;
  }

  const update = (patch: Partial<TaskDraft>) => setDraft((d) => ({ ...d, ...patch }));

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); // no browser form post: we send JSON ourselves
    setCreated(null);
    create.mutate(toInput(draft), {
      // runs after the hook's onSuccess, i.e. after ["tasks"] has refetched
      onSuccess: (task) => {
        setCreated(task);
        setDraft(emptyDraft());
      },
    });
  }

  const error = create.error;
  const msgFor = (field: string) => error?.details.find((d) => owns(field, d.path))?.message;
  const unclaimed = error && !error.details.some((d) => FIELDS.some((f) => owns(f, d.path)));
  const dismiss = () => create.reset();
  const invalid = (field: string) =>
    msgFor(field) ? { "aria-invalid": true, "aria-describedby": `new-${field}-error` } : {};

  return (
    <section aria-labelledby="create-title">
      <header className="page-head">
        <h1 id="create-title">New task</h1>
      </header>

      {created && (
        <p className="notice" role="status">
          Created task #{created.id} “{created.title}”. <a href={hrefFor("list")}>See it in the list</a>
        </p>
      )}
      {unclaimed && <FieldError id="new-form-error" message={describe(error)} onDismiss={dismiss} />}

      <form className="task-form" onSubmit={onSubmit}>
        <div className="field wide">
          <label htmlFor="new-title">Title</label>
          <input
            id="new-title"
            value={draft.title}
            required
            maxLength={200}
            onChange={(e) => update({ title: e.target.value })}
            {...invalid("title")}
          />
          {msgFor("title") && <FieldError id="new-title-error" message={msgFor("title")!} onDismiss={dismiss} />}
        </div>

        <SkillPicker
          idPrefix="new"
          skills={skills.data}
          selected={draft.skills}
          onChange={(names) => update({ skills: names })}
          error={msgFor("skills")}
          onDismissError={dismiss}
        />

        <div className="form-row">
          <div className="field">
            <label htmlFor="new-assigneeId">Assignee</label>
            <select
              id="new-assigneeId"
              value={draft.assigneeId}
              onChange={(e) => update({ assigneeId: e.target.value })}
              {...invalid("assigneeId")}
            >
              <option value="">Unassigned</option>
              {/* ALL developers, with their skills: the server decides rule 1 (422 below). */}
              {developers.data.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name} ({d.skills.join(", ") || "no skills"})
                </option>
              ))}
            </select>
            {msgFor("assigneeId") && (
              <FieldError id="new-assigneeId-error" message={msgFor("assigneeId")!} onDismiss={dismiss} />
            )}
          </div>

          <div className="field">
            <label htmlFor="new-status">Status</label>
            <select
              id="new-status"
              value={draft.status}
              onChange={(e) => update({ status: e.target.value as TaskStatus })}
              {...invalid("status")}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {msgFor("status") && <FieldError id="new-status-error" message={msgFor("status")!} onDismiss={dismiss} />}
          </div>
        </div>

        <button type="submit" className="primary" disabled={create.isPending}>
          {create.isPending ? "Creating…" : "Create task"}
        </button>
      </form>
    </section>
  );
}
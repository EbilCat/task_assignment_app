import { TASK_STATUSES, type Developer, type IssueDetail, type Skill, type TaskStatus } from "../api/types";
import {
  childPrefix,
  emptyDraft,
  MAX_SUBTASKS,
  owns,
  removeAt,
  replaceAt,
  type TaskDraft,
} from "../forms/taskDraft";
import { FieldError } from "./FieldError";
import { SkillPicker } from "./SkillPicker";

// What every node needs from the page. Passed down unchanged to all levels.
export type FormContext = {
  skills: Skill[]; // GET /skills
  developers: Developer[]; // GET /developers (ALL of them; the server decides rule 1)
  details: IssueDetail[]; // the last refused POST's details ([] when none)
  dismiss: () => void; // create.reset(): clears the error everywhere
  onStructureChange: () => void; // a subtask was added/removed: old paths are stale
};

type Props = {
  draft: TaskDraft; // THIS node
  onChange: (next: TaskDraft) => void; // hand a NEW node object to the parent
  onRemove?: () => void; // absent on the root task
  prefix: string; // "" | "subtasks.1." | "subtasks.1.subtasks.0." ...
  numbering: string; // "" for the root, "2", "2.1" ... (labels only)
  ctx: FormContext;
};

// One task's fields, then one <TaskFields> per subtask: the component
// renders itself for its children, so the form is as deep as the draft.
// CONTROLLED all the way down: no state here, the page's useState owns it all.
export function TaskFields({ draft, onChange, onRemove, prefix, numbering, ctx }: Props) {
  const idPrefix = numbering === "" ? "new" : `new-${numbering.replaceAll(".", "-")}`; // unique ids per node
  const label = numbering === "" ? "Task" : `Subtask ${numbering}`;

  const update = (patch: Partial<TaskDraft>) => onChange({ ...draft, ...patch });
  const msg = (field: string) => ctx.details.find((d) => owns(prefix + field, d.path))?.message;
  const listMsg = ctx.details.find((d) => d.path === `${prefix}subtasks`)?.message;
  const invalid = (field: string) =>
    msg(field) ? { "aria-invalid": true, "aria-describedby": `${idPrefix}-${field}-error` } : {};

  // Children: replace or drop ONE entry, keep the others as the same objects.
  const setChild = (i: number, child: TaskDraft) => update({ subtasks: replaceAt(draft.subtasks, i, child) });
  function addChild() {
    update({ subtasks: [...draft.subtasks, emptyDraft()] });
    ctx.onStructureChange();
  }
  function removeChild(i: number) {
    update({ subtasks: removeAt(draft.subtasks, i) });
    ctx.onStructureChange();
  }

  return (
    <fieldset className={numbering === "" ? "task-node" : "task-node subtask"}>
      <legend>{label}</legend>

      <div className="field wide">
        <label htmlFor={`${idPrefix}-title`}>Title</label>
        <input
          id={`${idPrefix}-title`}
          value={draft.title}
          required
          maxLength={200}
          onChange={(e) => update({ title: e.target.value })}
          {...invalid("title")}
        />
        {msg("title") && <FieldError id={`${idPrefix}-title-error`} message={msg("title")!} onDismiss={ctx.dismiss} />}
      </div>

      <SkillPicker
        idPrefix={idPrefix}
        skills={ctx.skills}
        selected={draft.skills}
        onChange={(names) => update({ skills: names })}
        error={msg("skills")}
        onDismissError={ctx.dismiss}
      />

      <div className="form-row">
        <div className="field">
          <label htmlFor={`${idPrefix}-assigneeId`}>Assignee</label>
          <select
            id={`${idPrefix}-assigneeId`}
            value={draft.assigneeId}
            onChange={(e) => update({ assigneeId: e.target.value })}
            {...invalid("assigneeId")}
          >
            <option value="">Unassigned</option>
            {ctx.developers.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.name} ({d.skills.join(", ") || "no skills"})
              </option>
            ))}
          </select>
          {msg("assigneeId") && (
            <FieldError id={`${idPrefix}-assigneeId-error`} message={msg("assigneeId")!} onDismiss={ctx.dismiss} />
          )}
        </div>

        <div className="field">
          <label htmlFor={`${idPrefix}-status`}>Status</label>
          <select
            id={`${idPrefix}-status`}
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
          {msg("status") && <FieldError id={`${idPrefix}-status-error`} message={msg("status")!} onDismiss={ctx.dismiss} />}
        </div>
      </div>

      {draft.subtasks.length > 0 && (
        <ol className="subtask-list">
          {draft.subtasks.map((child, i) => {
            const childNumbering = numbering === "" ? `${i + 1}` : `${numbering}.${i + 1}`;
            return (
              <li key={child.key}>
                <TaskFields
                  draft={child}
                  onChange={(next) => setChild(i, next)}
                  onRemove={() => removeChild(i)}
                  prefix={childPrefix(prefix, i)}
                  numbering={childNumbering}
                  ctx={ctx}
                />
              </li>
            );
          })}
        </ol>
      )}
      {listMsg && <FieldError id={`${idPrefix}-subtasks-error`} message={listMsg} onDismiss={ctx.dismiss} />}

      <div className="node-actions">
        {/* type="button": a plain <button> inside a <form> would SUBMIT it */}
        <button type="button" onClick={addChild} disabled={draft.subtasks.length >= MAX_SUBTASKS}>
          + Add subtask{numbering === "" ? "" : ` to ${numbering}`}
        </button>
        {onRemove && (
          <button type="button" className="danger" onClick={onRemove}>
            Remove subtask {numbering}
          </button>
        )}
      </div>
    </fieldset>
  );
}
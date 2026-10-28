import { useState } from "react";
import { describe } from "../api/describe";
import { useAssignTask, useQualifiedDevelopers } from "../api/queries";
import type { Developer, Task } from "../api/types";
import { FieldError } from "./FieldError";

const UNASSIGNED = ""; // <select> values are strings; "" stands for null

// Rule 1 in the UI: offer only developers who have ALL the task's skills.
// The list comes from GET /tasks/:id/qualified-developers (the same SQL the
// backend tests check against missingSkills), fetched LAZILY: only once the
// user points at, taps or tabs into this row's select.
export function AssigneeSelect({ task, developers }: { task: Task; developers: Developer[] }) {
  const [wanted, setWanted] = useState(false);
  const qualified = useQualifiedDevelopers(task.id, wanted);
  const assign = useAssignTask();

  const id = `assignee-${task.id}`;
  const errorId = `${id}-error`;
  const error = assign.error;
  const want = () => setWanted(true);

  // Server value, or the value being saved while the PATCH is in flight.
  const shownId = assign.isPending ? (assign.variables?.assigneeId ?? null) : task.assigneeId;

  // The current assignee must always be an option, or the select could not
  // display it before the list arrives (or if they no longer qualify).
  const options = qualified.data ?? [];
  const current = task.assigneeId;
  const currentListed = current === null || options.some((d) => d.id === current);
  const currentName = developers.find((d) => d.id === current)?.name ?? `#${current}`;

  return (
    <div className="field">
      <label htmlFor={id}>Assignee</label>
      <select
        id={id}
        value={shownId === null ? UNASSIGNED : String(shownId)}
        disabled={assign.isPending}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onPointerEnter={want}
        onPointerDown={want}
        onFocus={want}
        onChange={(e) =>
          assign.mutate({
            taskId: task.id,
            assigneeId: e.target.value === UNASSIGNED ? null : Number(e.target.value),
          })
        }
      >
        <option value={UNASSIGNED}>Unassigned</option>
        {!currentListed && (
          <option key="current" value={String(current)}>
            {currentName}
            {qualified.data ? " (missing skills)" : ""}
          </option>
        )}
        {options.map((d) => (
          <option key={d.id} value={String(d.id)}>
            {d.name}
          </option>
        ))}
        {qualified.isPending && wanted && <option disabled>Loading qualified developers…</option>}
        {qualified.error && <option disabled>Could not load the list</option>}
      </select>
      {error && (
        <FieldError
          id={errorId}
          message={error.fieldMessage("assigneeId") ?? describe(error)}
          onDismiss={() => assign.reset()}
        />
      )}
    </div>
  );
}
import { describe } from "../api/describe";
import { useSetStatus } from "../api/queries";
import { TASK_STATUSES, type Task, type TaskStatus } from "../api/types";
import { FieldError } from "./FieldError";

// A CONTROLLED select whose value is the server's status. Nothing is copied
// into useState: if the backend refuses the change (422), the select simply
// keeps showing task.status, i.e. it snaps back on its own.
export function StatusSelect({ task }: { task: Task }) {
  const setStatus = useSetStatus(); // one mutation per row = one error per row
  const id = `status-${task.id}`;
  const errorId = `${id}-error`;
  const error = setStatus.error;

  // While saving (PATCH + the ["tasks"] refetch), show the value being saved.
  const shown: TaskStatus = setStatus.isPending ? (setStatus.variables?.status ?? task.status) : task.status;

  return (
    <div className="field">
      <label htmlFor={id}>Status</label>
      <select
        id={id}
        value={shown}
        disabled={setStatus.isPending}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        data-status={shown}
        onChange={(e) => setStatus.mutate({ taskId: task.id, status: e.target.value as TaskStatus })}
      >
        {TASK_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {error && (
        <FieldError
          id={errorId}
          message={error.fieldMessage("status") ?? describe(error)}
          onDismiss={() => setStatus.reset()}
        />
      )}
    </div>
  );
}
import { ApiRequestError } from "./api/client";
import { useAssignTask, useDevelopers, useSetStatus, useSkills, useTasks } from "./api/queries";
import type { Task } from "./api/types";

// Still a smoke page, now on TanStack Query: three cached reads and two
// mutations that refresh the tree. The Task List page (next lesson)
// replaces the buttons with a real assignee dropdown and status select.

export default function App() {
  const tasks = useTasks();
  const developers = useDevelopers();
  const skills = useSkills();
  const assign = useAssignTask();
  const setStatus = useSetStatus();

  const taskList = tasks.data;
  const devList = developers.data;
  const skillList = skills.data;

  // Only block the page when there is nothing to show yet. A failed
  // BACKGROUND refetch keeps the old data, so we keep rendering it.
  if (!taskList || !devList || !skillList) {
    const error = tasks.error ?? developers.error ?? skills.error;
    return error ? <p role="alert">Could not load: {describe(error)}</p> : <p>Loading…</p>;
  }

  const nameOf = (id: number | null) =>
    id === null ? "unassigned" : (devList.find((d) => d.id === id)?.name ?? `#${id}`);
  const busy = assign.isPending || setStatus.isPending;

  return (
    <main>
      <h1>Task Assignment</h1>
      <p>
        <small>
          {tasks.isFetching ? "Refreshing tasks…" : "Tasks up to date"}
          {tasks.error && ` · last refresh failed: ${describe(tasks.error)}`}
        </small>
      </p>

      <h2>Tasks</h2>
      <TaskTree tasks={taskList} nameOf={nameOf} />

      <h2>Developers</h2>
      <ul>
        {devList.map((d) => (
          <li key={d.id}>
            {d.name} ({d.skills.join(", ") || "no skills"})
          </li>
        ))}
      </ul>

      <h2>Skills</h2>
      <p>{skillList.map((s) => s.name).join(", ")}</p>

      <h2>Mutation check</h2>
      <p>
        <button type="button" disabled={busy} onClick={() => setStatus.mutate({ taskId: 4, status: "Done" })}>
          Mark #4 Done
        </button>{" "}
        <button type="button" disabled={busy} onClick={() => setStatus.mutate({ taskId: 4, status: "To Do" })}>
          Reopen #4
        </button>{" "}
        <button type="button" disabled={busy} onClick={() => setStatus.mutate({ taskId: 1, status: "Done" })}>
          Mark #1 Done
        </button>{" "}
        <button type="button" disabled={busy} onClick={() => assign.mutate({ taskId: 3, assigneeId: 1 })}>
          Assign Alice to #3
        </button>
      </p>
      {setStatus.isPending && <p>Saving…</p>}
      {setStatus.isSuccess && (
        <p>
          Saved: #{setStatus.data.id} is now {setStatus.data.status}
        </p>
      )}
      {setStatus.error && <p role="alert">{describe(setStatus.error)}</p>}
      {assign.error && <p role="alert">{describe(assign.error)}</p>}
      {assign.isSuccess && <p>Unexpected: the backend accepted it</p>}
    </main>
  );
}

function TaskTree({ tasks, nameOf }: { tasks: Task[]; nameOf: (id: number | null) => string }) {
  return (
    <ul>
      {tasks.map((t) => (
        <li key={t.id}>
          #{t.id} {t.title} · {t.status} · {nameOf(t.assigneeId)}
          {t.skills.length > 0 && ` · [${t.skills.join(", ")}]`}
          {t.subtasks.length > 0 && <TaskTree tasks={t.subtasks} nameOf={nameOf} />}
        </li>
      ))}
    </ul>
  );
}

function describe(err: unknown): string {
  if (err instanceof ApiRequestError) return `${err.code} (${err.status}): ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}
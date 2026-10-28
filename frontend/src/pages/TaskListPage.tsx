import { describe } from "../api/describe";
import { useDevelopers, useTasks } from "../api/queries";
import { TaskRow } from "../components/TaskRow";

// The Task List page: the whole tree, with an assignee and a status select
// on every task and subtask. Writes go through the row's own mutation and
// refresh ["tasks"]; nothing here holds a copy of server data.
export function TaskListPage() {
  const tasks = useTasks();
  const developers = useDevelopers(); // only for showing the current assignee's name

  const taskList = tasks.data;
  const devList = developers.data;

  if (!taskList || !devList) {
    const error = tasks.error ?? developers.error;
    return error ? <p role="alert">Could not load tasks: {describe(error)}</p> : <p>Loading tasks…</p>;
  }

  return (
    <section aria-labelledby="task-list-title">
      <header className="page-head">
        <h1 id="task-list-title">Tasks</h1>
        <small className="sync">
          {tasks.isFetching ? "Refreshing…" : "Up to date"}
          {tasks.error && ` · last refresh failed: ${describe(tasks.error)}`}
        </small>
      </header>
      {taskList.length === 0 ? (
        <p>No tasks yet.</p>
      ) : (
        <ul className="task-tree">
          {taskList.map((t) => (
            <TaskRow key={t.id} task={t} developers={devList} />
          ))}
        </ul>
      )}
    </section>
  );
}
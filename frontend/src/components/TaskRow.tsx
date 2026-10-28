import type { Developer, Task } from "../api/types";
import { AssigneeSelect } from "./AssigneeSelect";
import { StatusSelect } from "./StatusSelect";

// One task and, recursively, its subtasks. Each row owns its two selects,
// and each select owns its own mutation, so an error lands on its own row.
export function TaskRow({ task, developers }: { task: Task; developers: Developer[] }) {
  return (
    <li className="task" data-status={task.status}>
      <div className="task-card">
        <div className="task-main">
          <span className="task-id">#{task.id}</span>
          <span className="task-title">{task.title}</span>
          <span className="skills">
            {task.skills.length > 0 ? (
              task.skills.map((s) => (
                <span key={s} className="chip">
                  {s}
                </span>
              ))
            ) : (
              <span className="chip chip-muted">no skills</span>
            )}
          </span>
        </div>
        <div className="task-controls">
          <AssigneeSelect task={task} developers={developers} />
          <StatusSelect task={task} />
        </div>
      </div>
      {task.subtasks.length > 0 && (
        <ul className="subtasks">
          {task.subtasks.map((st) => (
            <TaskRow key={st.id} task={st} developers={developers} />
          ))}
        </ul>
      )}
    </li>
  );
}
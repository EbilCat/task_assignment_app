import { pool } from "./db.js";
import { getQualifiedDevelopers, checkCanBeDone } from "./services/tasks.service.js";

// Same checks as before, but through the service layer: no Express, no SQL here.
const taskId = Number(process.argv[2] ?? 1);

const developers = await getQualifiedDevelopers(taskId);
const done = await checkCanBeDone(taskId);

if (developers === null || done === null) {
  console.log(`Task ${taskId} does not exist`);
} else {
  const names = developers.map((d) => d.name).join(", ");
  console.log(`Qualified for task ${taskId}: ${names || "(nobody)"}`);
  console.log(`Unfinished subtasks under task ${taskId}: ${done.unfinishedSubtasks} (can be Completed: ${done.canBeDone})`);
}

await pool.end(); // a script must close the pool, or Node keeps running
import { useEffect, useState } from "react";
import { api } from "./api/endpoints";
import { ApiRequestError } from "./api/client";
import type { Developer, Skill, Task } from "./api/types";

// A smoke-test page: proves browser -> Vite proxy -> Express -> Postgres works
// and that errors arrive typed. The next lesson replaces the useEffect
// loading below with TanStack Query.

type Loaded = { tasks: Task[]; developers: Developer[]; skills: Skill[] };

export default function App() {
  const [data, setData] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [probe, setProbe] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false; // StrictMode runs effects twice in dev; ignore the stale run
    Promise.all([api.listTasks(), api.listDevelopers(), api.listSkills()])
      .then(([tasks, developers, skills]) => {
        if (!cancelled) setData({ tasks, developers, skills });
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(describe(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A request the backend refuses (rule 1): Alice lacks Backend for task 3.
  // Nothing is written, so it is safe to click as often as you like.
  async function tryRefusedAssign() {
    try {
      await api.assignTask(3, 1);
      setProbe("Unexpected: the backend accepted it");
    } catch (err) {
      setProbe(describe(err));
    }
  }

  if (loadError) return <p role="alert">Could not load: {loadError}</p>;
  if (!data) return <p>Loading…</p>;

  const nameOf = (id: number | null) =>
    id === null ? "unassigned" : (data.developers.find((d) => d.id === id)?.name ?? `#${id}`);

  return (
    <main>
      <h1>Task Assignment</h1>

      <h2>Tasks</h2>
      <TaskTree tasks={data.tasks} nameOf={nameOf} />

      <h2>Developers</h2>
      <ul>
        {data.developers.map((d) => (
          <li key={d.id}>
            {d.name} ({d.skills.join(", ") || "no skills"})
          </li>
        ))}
      </ul>

      <h2>Skills</h2>
      <p>{data.skills.map((s) => s.name).join(", ")}</p>

      <h2>Error check</h2>
      <button type="button" onClick={tryRefusedAssign}>
        Assign Alice to task 3
      </button>
      {probe && <p>{probe}</p>}
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
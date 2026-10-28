import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { missingSkills } from "../src/rules.js";
import { resetDb } from "./helpers/db.js";

// No listen(): supertest starts the app on a throwaway port for each request.
const app = buildApp({ log: false });

// Every test starts from the seed: Alice 1 (FE), Bob 2 (BE), Carol 3 (FE+BE),
// Dave 4 (BE); task 1 FE+BE (Carol), 2 FE, 3 BE (Bob), 4 BE (Dave), 5 none.
beforeEach(resetDb);

const assign = (taskId: number, assigneeId: number | null) =>
  request(app).patch(`/tasks/${taskId}/assignee`).send({ assigneeId });

describe("PATCH /tasks/:id/assignee (rule 1)", () => {
  it("refuses Alice (Frontend) on task 3, which needs Backend", async () => {
    const res = await assign(3, 1);
    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      error: {
        code: "NOT_QUALIFIED",
        message: "assigneeId: Alice lacks required skill: Backend",
        details: [{ path: "assigneeId", message: "Alice lacks required skill: Backend" }],
      },
    });
  });

  it("leaves the task unchanged when it refuses", async () => {
    await assign(3, 1);
    const res = await request(app).get("/tasks/3");
    expect(res.body.task.assigneeId).toBe(2); // still Bob
  });

  it("refuses Bob (Backend) on task 1, which needs Frontend and Backend", async () => {
    const res = await assign(1, 2);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("NOT_QUALIFIED");
    expect(res.body.error.details[0].message).toBe("Bob lacks required skill: Frontend");
  });

  it("accepts Dave (Backend) on task 3", async () => {
    const res = await assign(3, 4);
    expect(res.status).toBe(200);
    expect(res.body.task.assigneeId).toBe(4);
  });

  it("accepts anyone on task 5, which needs no skills", async () => {
    for (const developerId of [1, 2, 3, 4]) {
      const res = await assign(5, developerId);
      expect(res.status).toBe(200);
      expect(res.body.task.assigneeId).toBe(developerId);
    }
  });

  it("always allows unassigning", async () => {
    const res = await assign(3, null);
    expect(res.status).toBe(200);
    expect(res.body.task.assigneeId).toBeNull();
  });

  it("answers 400 for a developer that doesn't exist", async () => {
    const res = await assign(3, 42);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
    expect(res.body.error.details).toEqual([{ path: "assigneeId", message: "Developer 42 not found" }]);
  });

  it("answers 400 when assigneeId is missing", async () => {
    const res = await request(app).patch("/tasks/3/assignee").send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("answers 404 for a task that doesn't exist", async () => {
    const res = await assign(999, 1);
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: "NOT_FOUND", message: "Task 999 not found", details: [] });
  });
});

describe("POST /tasks applies rule 1 to every node", () => {
  // The signup tree from the create-task lesson; only the "Signup API"
  // assignee changes between tests.
  const signup = (signupApiAssignee: number) => ({
    title: "Build signup page",
    skills: ["Frontend", "Backend"],
    assigneeId: 3, // Carol
    subtasks: [
      { title: "Signup form", skills: ["Frontend"], assigneeId: 1 }, // Alice
      {
        title: "Signup API",
        skills: ["Backend"],
        assigneeId: signupApiAssignee,
        subtasks: [{ title: "Validate email", skills: ["Backend"] }],
      },
    ],
  });

  it("refuses Alice on the Backend subtask and points at that field", async () => {
    const res = await request(app).post("/tasks").send(signup(1));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("NOT_QUALIFIED");
    expect(res.body.error.details).toEqual([
      { path: "subtasks.1.assigneeId", message: "Alice lacks required skill: Backend" },
    ]);
  });

  it("writes nothing when it refuses", async () => {
    await request(app).post("/tasks").send(signup(1));
    const res = await request(app).get("/tasks");
    expect(res.body.tasks.map((t: { id: number }) => t.id)).toEqual([1, 5]); // the seed's roots only
  });

  it("creates the whole tree when every assignee qualifies", async () => {
    const res = await request(app).post("/tasks").send(signup(2)); // Bob
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe("/tasks/6"); // ids restart after resetDb
    expect(res.body.task.subtasks).toHaveLength(2);
    expect(res.body.task.subtasks[1].subtasks[0].title).toBe("Validate email");
  });
});

// Rule 1 exists twice: SQL (double NOT EXISTS) behind the dropdown, and
// missingSkills() behind every write. This is the formal version of
// rules-demo.ts: for each seed task, both must name the same developers.
describe("the dropdown and the write rule agree", () => {
  it.each([
    [1, [3]], // FE+BE: Carol
    [2, [1, 3]], // FE: Alice, Carol
    [3, [2, 3, 4]], // BE: Bob, Carol, Dave
    [4, [2, 3, 4]], // BE
    [5, [1, 2, 3, 4]], // no skills: everyone
  ])("task %i -> developers %j", async (taskId, expected) => {
    const [developers, task, qualified] = await Promise.all([
      request(app).get("/developers"),
      request(app).get(`/tasks/${taskId}`),
      request(app).get(`/tasks/${taskId}/qualified-developers`),
    ]);

    const fromSql = qualified.body.developers.map((d: { id: number }) => d.id);
    const fromRule = developers.body.developers
      .filter((d: { skills: string[] }) => missingSkills(task.body.task.skills, d.skills).length === 0)
      .map((d: { id: number }) => d.id);

    expect(fromSql).toEqual(expected);
    expect(fromRule).toEqual(expected);
  });
});
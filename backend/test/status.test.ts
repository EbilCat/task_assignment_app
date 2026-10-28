import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { resetDb } from "./helpers/db.js";

const app = buildApp({ log: false });

// Seed tree: 1 Build login page (In Progress)
//              ├─ 2 Design form UI (Done)
//              └─ 3 Auth API endpoint (In Progress)
//                   └─ 4 Hash passwords (To Do)
//            5 Write README (To Do, no subtasks)
beforeEach(resetDb);

const setStatus = (taskId: number, status: string) =>
  request(app).patch(`/tasks/${taskId}/status`).send({ status });

describe("PATCH /tasks/:id/status (rule 2)", () => {
  it("refuses Done on task 1 while 2 tasks below it are unfinished", async () => {
    const res = await setStatus(1, "Done");
    expect(res.status).toBe(422);
    expect(res.body.error).toEqual({
      code: "SUBTASKS_NOT_DONE",
      message: "status: Cannot be Done: 2 subtasks are not Done",
      details: [{ path: "status", message: "Cannot be Done: 2 subtasks are not Done" }],
    });

    const after = await request(app).get("/tasks/1");
    expect(after.body.task.status).toBe("In Progress"); // nothing written
  });

  it("counts a grandchild: task 3 is blocked by task 4", async () => {
    const res = await setStatus(3, "Done");
    expect(res.status).toBe(422);
    expect(res.body.error.details[0].message).toBe("Cannot be Done: 1 subtask is not Done");
  });

  it("allows Done bottom-up: 4, then 3, then 1", async () => {
    for (const taskId of [4, 3, 1]) {
      const res = await setStatus(taskId, "Done");
      expect(res.status).toBe(200);
      expect(res.body.task.status).toBe("Done");
    }
  });

  it("refuses reopening a subtask under a Done parent", async () => {
    await setStatus(4, "Done");
    await setStatus(3, "Done");

    const res = await setStatus(4, "To Do");
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("PARENT_DONE");
    expect(res.body.error.details[0].message).toBe(
      'Parent task #3 "Auth API endpoint" is Done; reopen it first',
    );
  });

  it("allows reopening top-down: parent first, then the subtask", async () => {
    await setStatus(4, "Done");
    await setStatus(3, "Done");

    expect((await setStatus(3, "In Progress")).status).toBe(200);
    expect((await setStatus(4, "To Do")).status).toBe(200);
  });

  it("allows Done on a task with no subtasks", async () => {
    const res = await setStatus(5, "Done");
    expect(res.status).toBe(200);
  });

  it("answers 400 for a status that doesn't exist", async () => {
    const res = await setStatus(5, "Finished");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
    expect(res.body.error.details[0].path).toBe("status");
  });

  it("answers 404 for a task that doesn't exist", async () => {
    const res = await setStatus(999, "Done");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("POST /tasks applies rule 2 to the new tree", () => {
  // Root and both subtasks Done; "Validate email" (a grandchild) is the
  // node that decides.
  const signupTree = (validateEmailStatus?: "Done") => ({
    title: "Build signup page",
    status: "Done",
    subtasks: [
      { title: "Signup form", status: "Done" },
      {
        title: "Signup API",
        status: "Done",
        subtasks: [
          validateEmailStatus
            ? { title: "Validate email", status: validateEmailStatus }
            : { title: "Validate email" }, // no status = To Do
        ],
      },
    ],
  });

  it("refuses a Done root with an unfinished grandchild", async () => {
    const res = await request(app).post("/tasks").send(signupTree());
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("SUBTASKS_NOT_DONE");
    // the root is checked first (pre-order), so the root's own status is blamed
    expect(res.body.error.details).toEqual([
      { path: "status", message: "Cannot be Done: 1 subtask is not Done" },
    ]);
  });

  it("creates the tree when everything is Done", async () => {
    const res = await request(app).post("/tasks").send(signupTree("Done"));
    expect(res.status).toBe(201);
    expect(res.body.task.status).toBe("Done");
  });
});
import request from "supertest";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// Replace the ONE file that talks to Gemini with a fake. vi.mock is hoisted
// above the imports, so skills.ts and the service get the fake too.
vi.mock("../src/llm/gemini.js", () => ({ generateJson: vi.fn() }));

import { generateJson } from "../src/llm/gemini.js";
import { buildApp } from "../src/app.js";
import { resetDb } from "./helpers/db.js";

const app = buildApp({ log: false });
type FakeGemini = Mock<(req: { system: string; prompt: string }) => Promise<unknown>>;
const fakeGemini = generateJson as unknown as FakeGemini;

// What our fake "model" answers for each title.
const LABELS: Record<string, string[]> = {
  "Build signup page": ["Frontend", "Backend"], // any order: the code sorts
  "Signup form": ["Frontend"],
  "Signup API": ["Backend"],
  "Validate email": ["Backend"],
  "Write release notes": [],
};

// Reads the ids and titles out of the real prompt ("T2: <<<Signup form>>> ...")
// and answers like a well-behaved model would.
async function labelByTitle(req: { prompt: string }) {
  const tasks = [...req.prompt.matchAll(/^(T\d+): <<<(.*?)>>>/gm)].map(([, id, title]) => ({
    id,
    skills: LABELS[title!] ?? [],
  }));
  return { ok: true, data: { tasks }, ms: 5 };
}

// No skills anywhere: every node goes to the model.
const signupTree = () => ({
  title: "Build signup page",
  subtasks: [
    { title: "Signup form" },
    { title: "Signup API", subtasks: [{ title: "Validate email" }] },
  ],
});

beforeEach(async () => {
  await resetDb();
  fakeGemini.mockReset();
  fakeGemini.mockImplementation(labelByTitle);
});

describe("POST /tasks infers skills for nodes with none", () => {
  it("fills every node in ONE call and saves the skills", async () => {
    const res = await request(app).post("/tasks").send(signupTree());

    expect(res.status).toBe(201);
    expect(fakeGemini).toHaveBeenCalledTimes(1);
    expect(res.body.inference.status).toBe("ok");
    expect(res.body.inference.inferred).toEqual([
      { path: "", title: "Build signup page", skills: ["Backend", "Frontend"] },
      { path: "subtasks.0", title: "Signup form", skills: ["Frontend"] },
      { path: "subtasks.1", title: "Signup API", skills: ["Backend"] },
      { path: "subtasks.1.subtasks.0", title: "Validate email", skills: ["Backend"] },
    ]);

    // read back: the skills were really stored (task_skills rows)
    const saved = (await request(app).get("/tasks/6")).body.task;
    expect(saved.skills).toEqual(["Backend", "Frontend"]);
    expect(saved.subtasks[1].subtasks[0].skills).toEqual(["Backend"]);
  });

  it("keeps ticked skills and only asks about the rest", async () => {
    const body = signupTree();
    const res = await request(app)
      .post("/tasks")
      .send({ ...body, skills: ["Frontend"] }); // root ticked by hand

    expect(res.status).toBe(201);
    expect(res.body.task.skills).toEqual(["Frontend"]); // NOT overwritten
    const prompt = fakeGemini.mock.calls[0]![0].prompt;
    expect(prompt).not.toMatch(/^T\d+: <<<Build signup page>>>/m); // root not asked
    expect(prompt).toContain("<<<Signup form>>> (part of <<<Build signup page>>>)");
    expect(res.body.inference.inferred).toHaveLength(3);
  });

  it("makes no call when every node has skills", async () => {
    const res = await request(app)
      .post("/tasks")
      .send({ title: "Rate-limit login", skills: ["Backend"] });

    expect(res.status).toBe(201);
    expect(fakeGemini).not.toHaveBeenCalled();
    expect(res.body.inference).toEqual({ status: "skipped" });
  });

  it("falls back to no skills when Gemini fails, and still creates the task", async () => {
    fakeGemini.mockResolvedValue({ ok: false, reason: "timeout", message: "No answer within 8000 ms", ms: 8000 });

    const res = await request(app).post("/tasks").send(signupTree());

    expect(res.status).toBe(201);
    expect(res.body.inference).toEqual({ status: "failed", reason: "timeout", ms: 8000 });
    expect(res.body.task.skills).toEqual([]);
    expect(res.body.task.subtasks[1].subtasks[0].skills).toEqual([]);
  });

  it("treats a node the model left out as 'no skills'", async () => {
    fakeGemini.mockResolvedValue({ ok: true, data: { tasks: [{ id: "T1", skills: ["Frontend"] }] }, ms: 5 });

    const res = await request(app).post("/tasks").send(signupTree());

    expect(res.status).toBe(201);
    expect(res.body.task.skills).toEqual(["Frontend"]);
    expect(res.body.task.subtasks[0].skills).toEqual([]);
  });

  it("checks rule 1 AFTER inference, and says the skills were suggested", async () => {
    // Alice (Frontend only) on "Signup API", nothing ticked: the model says Backend
    const res = await request(app)
      .post("/tasks")
      .send({
        title: "Build signup page",
        subtasks: [{ title: "Signup form" }, { title: "Signup API", assigneeId: 1 }],
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("NOT_QUALIFIED");
    expect(res.body.error.details[0].path).toBe("subtasks.1.assigneeId");
    expect(res.body.error.details[0].message).toMatch(/^Alice lacks required skill: Backend \(skills suggested/);
    expect((await request(app).get("/tasks")).body.tasks).toHaveLength(2); // nothing written
  });

  it("does not call Gemini for a body that fails a cheap check first", async () => {
    const res = await request(app)
      .post("/tasks")
      .send({ title: "Build signup page", assigneeId: 42 });

    expect(res.status).toBe(400);
    expect(fakeGemini).not.toHaveBeenCalled();
  });
});
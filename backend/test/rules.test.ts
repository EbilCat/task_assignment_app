import { describe, expect, it } from "vitest";
import {
  countUnfinishedBelow,
  missingSkills,
  notQualifiedMessage,
  parentDoneMessage,
  subtasksNotDoneMessage,
} from "../src/rules.js";

// Pure functions: no database, no HTTP. These run in milliseconds and pin
// down the edge cases that are awkward to set up through the API.

describe("rule 1: missingSkills(required, has)", () => {
  it("is empty when the developer has every required skill", () => {
    expect(missingSkills(["Frontend", "Backend"], ["Backend", "Frontend"])).toEqual([]);
  });

  it("lists what is missing, in the task's order", () => {
    expect(missingSkills(["Frontend", "Backend"], ["Backend"])).toEqual(["Frontend"]);
    expect(missingSkills(["Frontend", "Backend"], [])).toEqual(["Frontend", "Backend"]);
  });

  it("accepts anyone when the task requires nothing", () => {
    expect(missingSkills([], [])).toEqual([]);
  });

  it("ignores extra skills the developer has", () => {
    expect(missingSkills(["Backend"], ["Backend", "Frontend"])).toEqual([]);
  });

  it("compares names exactly (case matters)", () => {
    expect(missingSkills(["Backend"], ["backend"])).toEqual(["Backend"]);
  });

  it("words the message for one skill and for several", () => {
    expect(notQualifiedMessage("Alice", ["Backend"])).toBe("Alice lacks required skill: Backend");
    expect(notQualifiedMessage("Bob", ["Backend", "Frontend"])).toBe(
      "Bob lacks required skills: Backend, Frontend",
    );
  });
});

describe("rule 2: countUnfinishedBelow(tree)", () => {
  it("is 0 for a task with no subtasks", () => {
    expect(countUnfinishedBelow({ status: "To Do" })).toBe(0);
  });

  it("does not count the task itself", () => {
    expect(countUnfinishedBelow({ status: "To Do", subtasks: [{ status: "Done" }] })).toBe(0);
  });

  it("treats a missing status as To Do", () => {
    expect(countUnfinishedBelow({ status: "Done", subtasks: [{}] })).toBe(1);
  });

  it("counts grandchildren, not just children", () => {
    // Done -> [Done -> [To Do]]: the child looks fine, the grandchild is not
    expect(
      countUnfinishedBelow({ status: "Done", subtasks: [{ status: "Done", subtasks: [{ status: "To Do" }] }] }),
    ).toBe(1);
    // In Progress child AND its To Do child both count
    expect(
      countUnfinishedBelow({ subtasks: [{ status: "In Progress", subtasks: [{ status: "To Do" }] }] }),
    ).toBe(2);
  });

  it("is 0 when everything below is Done", () => {
    expect(
      countUnfinishedBelow({
        status: "Done",
        subtasks: [{ status: "Done" }, { status: "Done", subtasks: [{ status: "Done" }] }],
      }),
    ).toBe(0);
  });

  it("words the messages", () => {
    expect(subtasksNotDoneMessage(1)).toBe("Cannot be Done: 1 subtask is not Done");
    expect(subtasksNotDoneMessage(2)).toBe("Cannot be Done: 2 subtasks are not Done");
    expect(parentDoneMessage(3, "Auth API endpoint")).toBe(
      'Parent task #3 "Auth API endpoint" is Done; reopen it first',
    );
  });
});
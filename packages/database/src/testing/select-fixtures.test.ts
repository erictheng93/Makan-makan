import { describe, expect, it } from "vitest";
import { createSelectFixtureDb } from "./select-fixtures";

describe("createSelectFixtureDb", () => {
  it("routes fixtures by source table instead of select execution order", async () => {
    const shifts = {};
    const registers = {};
    const db = createSelectFixtureDb(
      { shifts, registers },
      { shifts: [["shift"]], registers: [["register"]] },
    );

    await expect(db.select().from(registers)).resolves.toEqual(["register"]);
    await expect(db.select().from(shifts)).resolves.toEqual(["shift"]);
  });

  it("names skipped, missing, and exhausted fixtures precisely", async () => {
    const shifts = {};
    const db = createSelectFixtureDb({ shifts }, { shifts: [[]] });

    await expect(db.select()).rejects.toThrow(
      "Select fixture query never called from(table)",
    );
    await expect(db.select().from({})).rejects.toThrow(
      "Missing select fixture for <unknown table>",
    );
    await expect(db.select().from(shifts)).resolves.toEqual([]);
    await expect(db.select().from(shifts)).rejects.toThrow(
      "No select fixtures remaining for shifts",
    );
  });

  it("supports get and all query terminals", async () => {
    const shifts = {};
    const db = createSelectFixtureDb(
      { shifts },
      { shifts: [["first"], ["all"]] },
    );

    await expect(db.select().from(shifts).get()).resolves.toBe("first");
    await expect(db.select().from(shifts).all()).resolves.toEqual(["all"]);
  });

  it("supports offset pagination before resolving a fixture", async () => {
    const shifts = {};
    const db = createSelectFixtureDb({ shifts }, { shifts: [["shift"]] });

    await expect(db.select().from(shifts).limit(1).offset(1)).resolves.toEqual([
      "shift",
    ]);
  });

  it("shares table queues with selectDistinct", async () => {
    const shifts = {};
    const db = createSelectFixtureDb({ shifts }, { shifts: [["shift"]] });

    await expect(db.selectDistinct().from(shifts)).resolves.toEqual(["shift"]);
  });
});

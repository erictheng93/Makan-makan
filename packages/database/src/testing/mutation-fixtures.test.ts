import { describe, expect, it } from "vitest";
import { createMutationFixtureDb } from "./mutation-fixtures";

describe("createMutationFixtureDb", () => {
  it("keys fixtures by table and operation so insert and update cannot share a queue", async () => {
    const markets = {};
    const db = createMutationFixtureDb(
      { markets },
      {
        markets: {
          insert: [[{ id: "created" }]],
          update: [[{ id: "updated" }]],
        },
      },
    );

    await expect(
      db.update(markets).set({ name: "n" }).where().returning(),
    ).resolves.toEqual([{ id: "updated" }]);
    await expect(
      db.insert(markets).values({ name: "n" }).returning(),
    ).resolves.toEqual([{ id: "created" }]);
  });

  it("names unregistered, missing, and exhausted fixtures precisely", async () => {
    const markets = {};
    const db = createMutationFixtureDb(
      { markets },
      { markets: { insert: [[]] } },
    );

    await expect(db.insert({}).values({}).returning()).rejects.toThrow(
      "Missing insert fixture for <unknown table>",
    );
    await expect(db.update(markets).set({}).returning()).rejects.toThrow(
      "Missing update fixture for markets",
    );
    await expect(db.insert(markets).values({}).returning()).resolves.toEqual(
      [],
    );
    await expect(db.insert(markets).values({}).returning()).rejects.toThrow(
      "No insert fixtures remaining for markets",
    );
  });

  it("answers run(), await, and returning() from the one fixture", async () => {
    const markets = {};
    const db = createMutationFixtureDb(
      { markets },
      {
        markets: {
          update: [{ changes: 2 }, [{ id: "row" }]],
          delete: [{ changes: 1 }],
        },
      },
    );

    await expect(
      db.update(markets).set({}).where().run(),
    ).resolves.toMatchObject({
      changes: 2,
      meta: { changes: 2 },
    });
    // Rows answer a change count too: one fixture, whichever terminal is used.
    await expect(db.update(markets).set({}).where()).resolves.toMatchObject({
      meta: { changes: 1 },
    });
    await expect(db.delete(markets).where().run()).resolves.toMatchObject({
      meta: { changes: 1 },
    });
  });

  it("rejects returning() when the fixture is only a change count", async () => {
    const markets = {};
    const db = createMutationFixtureDb(
      { markets },
      { markets: { update: [{ changes: 1 }] } },
    );

    await expect(
      db.update(markets).set({}).where().returning(),
    ).rejects.toThrow("returning() needs rows");
  });

  it("rejects with a queued Error instead of resolving", async () => {
    const markets = {};
    const failure = new Error("write failed");
    const db = createMutationFixtureDb(
      { markets },
      { markets: { update: [failure, [{ id: "ok" }]] } },
    );

    await expect(db.update(markets).set({}).where()).rejects.toThrow(
      "write failed",
    );
    await expect(
      db.update(markets).set({}).where().returning(),
    ).resolves.toEqual([{ id: "ok" }]);
  });

  it("records written payloads and reports undrained fixtures", async () => {
    const markets = {};
    const db = createMutationFixtureDb(
      { markets },
      { markets: { insert: [[]], update: [[], []] } },
    );

    await db.insert(markets).values({ name: "created" }).returning();
    await db.update(markets).set({ name: "patched" }).where().returning();

    expect(db.inserted).toEqual([{ name: "created" }]);
    expect(db.updated).toEqual([{ name: "patched" }]);
    expect(db.remaining()).toEqual({ "markets:update": 1 });
  });
});

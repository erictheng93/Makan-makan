import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Miniflare } from "miniflare";
import type { D1Database } from "@cloudflare/workers-types";
import { listUserTables } from "../run-migrations";

describe("listUserTables", () => {
  let mf: Miniflare;
  let db: D1Database;

  beforeAll(async () => {
    mf = new Miniflare({
      modules: true,
      script: "export default {};",
      d1Databases: { DB: ":memory:" },
    });
    const bindings = await mf.getBindings<{ DB: D1Database }>();
    db = bindings.DB;
  });

  afterAll(async () => {
    await mf.dispose();
  });

  it("returns an empty array for a fresh database", async () => {
    const tables = await listUserTables(db);
    expect(tables).toEqual([]);
  });

  it("returns user table names, excluding sqlite_* and drizzle migrations metadata", async () => {
    await db.prepare(`CREATE TABLE foo (id INTEGER PRIMARY KEY)`).run();
    await db.prepare(`CREATE TABLE bar (id INTEGER PRIMARY KEY)`).run();
    await db
      .prepare(`CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY)`)
      .run();

    const tables = await listUserTables(db);
    expect(tables.sort()).toEqual(["bar", "foo"]);
  });
});

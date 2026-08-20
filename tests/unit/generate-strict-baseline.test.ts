import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  generateStrictBaseline,
  addStrict,
  replayTrack,
}: {
  generateStrictBaseline: (options?: { root?: string; track?: string }) => {
    sql: string;
    counts: Record<string, number>;
    failures: string[];
  };
  addStrict: (sql: string) => string;
  replayTrack: (
    dir: string,
    db: typeof Database,
  ) => { db: Database.Database; failures: string[] };
} = require("../../scripts/generate-strict-baseline.cjs");

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const TRACK = "packages/database/migrations_fresh";

type Inventory = Map<string, string>;

/** type:name -> whitespace-normalized DDL, with any STRICT option removed. */
function inventory(db: Database.Database): Inventory {
  const rows = db
    .prepare(
      `SELECT type, name, sql FROM sqlite_master
       WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'`,
    )
    .all() as Array<{ type: string; name: string; sql: string }>;

  return new Map(
    rows.map((row) => [
      `${row.type}:${row.name}`,
      row.sql
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\)\s*STRICT$/i, ")"),
    ]),
  );
}

function applySql(sql: string): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = OFF");
  for (const statement of sql.split(/--> statement-breakpoint/)) {
    const trimmed = statement
      .split("\n")
      .map((line) => line.replace(/^\s*--.*$/, ""))
      .join("\n")
      .trim();
    if (trimmed) db.exec(trimmed);
  }
  return db;
}

describe("addStrict", () => {
  it("appends the option after the column list", () => {
    expect(addStrict("CREATE TABLE `a` (`id` text)")).toBe(
      "CREATE TABLE `a` (`id` text) STRICT",
    );
  });

  it("keeps nested parens in defaults intact", () => {
    expect(
      addStrict("CREATE TABLE `a` (`t` integer DEFAULT (unixepoch()))"),
    ).toBe("CREATE TABLE `a` (`t` integer DEFAULT (unixepoch())) STRICT");
  });

  it("is idempotent — regenerating a STRICT baseline is a no-op", () => {
    const once = addStrict("CREATE TABLE `a` (`id` text)");
    expect(addStrict(once)).toBe(once);
    expect(
      addStrict("CREATE TABLE `a` (`id` text) WITHOUT ROWID, STRICT"),
    ).toBe("CREATE TABLE `a` (`id` text) WITHOUT ROWID, STRICT");
  });

  it("comma-joins onto an existing table option", () => {
    // `) STRICT WITHOUT ROWID` is a syntax error — table options are a list.
    expect(addStrict("CREATE TABLE `a` (`id` text) WITHOUT ROWID")).toBe(
      "CREATE TABLE `a` (`id` text) WITHOUT ROWID, STRICT",
    );
  });
});

describe("STRICT baseline generation", () => {
  const replayed = replayTrack(path.join(REPO_ROOT, TRACK), Database);
  const generated = generateStrictBaseline({ root: REPO_ROOT, track: TRACK });

  it("replays the fresh track with no failing statements", () => {
    expect(replayed.failures).toEqual([]);
  });

  it("reproduces every schema object verbatim apart from STRICT", () => {
    const before = inventory(replayed.db);
    const after = inventory(applySql(generated.sql));

    // fts5 shadow tables are rebuilt by CREATE VIRTUAL TABLE, so the
    // generator does not emit them — but applying the baseline must
    // recreate them all the same.
    expect([...after.keys()].sort()).toEqual([...before.keys()].sort());

    const drifted = [...before.entries()]
      .filter(([key, ddl]) => after.get(key) !== ddl)
      .map(([key]) => key);
    expect(drifted).toEqual([]);
  });

  it("marks every non-virtual table STRICT", () => {
    const db = applySql(generated.sql);
    const notStrict = (
      db.prepare("PRAGMA table_list").all() as Array<{
        schema: string;
        name: string;
        strict: number;
      }>
    )
      .filter((t) => t.schema === "main" && !t.name.startsWith("sqlite_"))
      .filter((t) => t.strict === 0)
      .map((t) => t.name);

    // Only the fts5 virtual table and its shadow tables may be non-STRICT.
    expect(notStrict.every((name) => name.startsWith("dish_search_fts"))).toBe(
      true,
    );
    expect(generated.counts.table).toBeGreaterThan(100);
  });

  it("rejects a wrongly-typed value that flexible typing would accept", () => {
    const db = applySql(generated.sql);
    const columns = db
      .prepare("PRAGMA table_info('restaurants')")
      .all() as Array<{
      name: string;
      type: string;
      notnull: number;
      pk: number;
    }>;
    const required = columns.filter((c) => c.notnull === 1 || c.pk > 0);
    const wellTyped = (type: string): string | number =>
      ["INTEGER", "REAL"].includes(type.toUpperCase()) ? 1 : "x";

    const insert = db.prepare(
      `INSERT INTO restaurants (${required.map((c) => `"${c.name}"`).join(",")})
       VALUES (${required.map(() => "?").join(",")})`,
    );

    // Sanity: the row is otherwise valid, so a failure below is about typing.
    expect(() =>
      insert.run(required.map((c) => wellTyped(c.type))),
    ).not.toThrow();

    // STRICT still performs *lossless* coercion, so 42 into a TEXT column is
    // accepted. What it rejects is a value that cannot be converted at all —
    // which is exactly the silent corruption a non-STRICT table allows.
    const intColumn = required.findIndex(
      (c) => c.type.toUpperCase() === "INTEGER" && c.pk === 0,
    );
    expect(intColumn).toBeGreaterThan(-1);
    const wrong = required.map((c) => wellTyped(c.type));
    wrong[intColumn] = "not-a-number";
    wrong[required.findIndex((c) => c.pk > 0)] = "another-id";

    expect(() => insert.run(wrong)).toThrow(
      /cannot store TEXT value in INTEGER column/i,
    );
  });
});

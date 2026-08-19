import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  checkStrictTables,
  parseTableEvents,
}: {
  checkStrictTables: (options: { root: string; configPath: string }) => {
    ok: boolean;
    errors: string[];
  };
  parseTableEvents: (
    sql: string,
  ) => Array<{ kind: string; table: string; strict?: boolean; to?: string }>;
} = require("../../scripts/check-strict-tables.cjs");

function createFixture(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strict-guard-"));
  fs.mkdirSync(path.join(dir, "migrations"), { recursive: true });
  return dir;
}

function writeSql(root: string, file: string, sql: string): void {
  fs.writeFileSync(path.join(root, "migrations", file), sql);
}

function writeConfig(root: string, exemptTables: string[] = []): void {
  fs.writeFileSync(
    path.join(root, "policy.json"),
    JSON.stringify({
      tracks: [{ dir: "migrations", enforceFrom: 10 }],
      exemptTables,
    }),
  );
}

function run(root: string) {
  return checkStrictTables({ root, configPath: "policy.json" });
}

describe("STRICT table guard", () => {
  it("reads STRICT past a multi-line column list with nested parens", () => {
    const events = parseTableEvents(
      "CREATE TABLE `orders` (\n" +
        "  `id` text PRIMARY KEY NOT NULL,\n" +
        "  `total` integer DEFAULT (unixepoch()) NOT NULL,\n" +
        "  `note` text DEFAULT '(unbalanced'\n" +
        ") STRICT;",
    );

    expect(events).toEqual([{ kind: "create", table: "orders", strict: true }]);
  });

  it("does not treat CREATE VIRTUAL TABLE as a create event", () => {
    expect(
      parseTableEvents("CREATE VIRTUAL TABLE dish_fts USING fts5(name);"),
    ).toEqual([]);
  });

  it("passes when a post-checkpoint migration declares STRICT", () => {
    const fixture = createFixture();
    writeConfig(fixture);
    writeSql(fixture, "0010_new.sql", "CREATE TABLE `a` (`id` text) STRICT;");

    expect(run(fixture).ok).toBe(true);
  });

  it("fails when a post-checkpoint migration omits STRICT", () => {
    const fixture = createFixture();
    writeConfig(fixture);
    writeSql(fixture, "0010_new.sql", "CREATE TABLE `a` (`id` text);");

    const result = run(fixture);
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("a must be created with");
  });

  it("ignores pre-checkpoint migrations without STRICT", () => {
    const fixture = createFixture();
    writeConfig(fixture);
    writeSql(fixture, "0009_legacy.sql", "CREATE TABLE `a` (`id` text);");

    expect(run(fixture).ok).toBe(true);
  });

  it("honours exemptTables", () => {
    const fixture = createFixture();
    writeConfig(fixture, ["a"]);
    writeSql(fixture, "0010_new.sql", "CREATE TABLE `a` (`id` text);");

    expect(run(fixture).ok).toBe(true);
  });

  it("catches drizzle's recreate-table dance downgrading a STRICT table", () => {
    const fixture = createFixture();
    writeConfig(fixture);
    writeSql(fixture, "0005_base.sql", "CREATE TABLE `a` (`id` text) STRICT;");
    // Verbatim shape of what `drizzle-kit generate` emits — it has no STRICT
    // support, so the rebuilt table silently loses the constraint.
    writeSql(
      fixture,
      "0006_drizzle_alter.sql",
      "CREATE TABLE `__new_a` (`id` text, `extra` integer);\n" +
        "INSERT INTO `__new_a`(`id`) SELECT `id` FROM `a`;\n" +
        "DROP TABLE `a`;\n" +
        "ALTER TABLE `__new_a` RENAME TO `a`;",
    );

    const result = run(fixture);
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain(
      "renaming __new_a to a downgrades a STRICT table",
    );
  });

  it("allows the recreate dance when the staging table keeps STRICT", () => {
    const fixture = createFixture();
    writeConfig(fixture);
    writeSql(fixture, "0005_base.sql", "CREATE TABLE `a` (`id` text) STRICT;");
    writeSql(
      fixture,
      "0006_alter.sql",
      "CREATE TABLE `__new_a` (`id` text, `extra` integer) STRICT;\n" +
        "DROP TABLE `a`;\n" +
        "ALTER TABLE `__new_a` RENAME TO `a`;",
    );

    expect(run(fixture).ok).toBe(true);
  });

  it("catches an in-place recreate that drops STRICT, even pre-checkpoint", () => {
    const fixture = createFixture();
    writeConfig(fixture);
    writeSql(fixture, "0005_base.sql", "CREATE TABLE `a` (`id` text) STRICT;");
    writeSql(fixture, "0006_regress.sql", "CREATE TABLE `a` (`id` text);");

    const result = run(fixture);
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain(
      "a was STRICT and is re-created without STRICT",
    );
  });
});

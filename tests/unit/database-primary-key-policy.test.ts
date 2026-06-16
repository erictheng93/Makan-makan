import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = process.cwd();
const schemaRoot = join(repoRoot, "packages/database/src/schema");
const policyPath = join(
  repoRoot,
  "docs/architecture/database/integer-primary-key-policy.json",
);
const allowedCategories = new Set([
  "legacy_domain",
  "leaf_local",
  "audit_log",
  "join_edge",
]);
const allowedMigrationPlans = new Set(["retain", "migrate_to_uuid_v7"]);

interface IntegerPrimaryKeySurface {
  tableName: string;
  schemaFile: string;
  line: number;
}

interface IntegerPrimaryKeyPolicyEntry extends IntegerPrimaryKeySurface {
  category: "legacy_domain" | "leaf_local" | "audit_log" | "join_edge";
  migrationPlan: "retain" | "migrate_to_uuid_v7";
  rationale: string;
}

function listSchemaFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory)) {
    const absolutePath = join(directory, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      files.push(...listSchemaFiles(absolutePath));
    } else if (
      absolutePath.endsWith(".ts") &&
      !absolutePath.endsWith(".test.ts")
    ) {
      files.push(absolutePath);
    }
  }

  return files.sort();
}

function discoverIntegerPrimaryKeys(): IntegerPrimaryKeySurface[] {
  const surfaces: IntegerPrimaryKeySurface[] = [];

  for (const file of listSchemaFiles(schemaRoot)) {
    const schemaFile = relative(repoRoot, file);
    let currentTableName: string | null = null;
    let expectingTableName = false;

    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        if (line.includes("sqliteTable(")) {
          expectingTableName = true;
        }

        const tableMatch = expectingTableName ? line.match(/"([^"]+)"/) : null;
        if (tableMatch) {
          currentTableName = tableMatch[1];
          expectingTableName = false;
        }

        if (
          line.includes('integer("id").primaryKey({ autoIncrement: true })')
        ) {
          surfaces.push({
            tableName: currentTableName ?? "<unknown>",
            schemaFile,
            line: index + 1,
          });
        }
      });
  }

  return surfaces.sort((left, right) =>
    `${left.schemaFile}:${left.tableName}`.localeCompare(
      `${right.schemaFile}:${right.tableName}`,
    ),
  );
}

function keyOf(
  surface: Pick<IntegerPrimaryKeySurface, "schemaFile" | "tableName">,
) {
  return `${surface.schemaFile}#${surface.tableName}`;
}

describe("database primary key policy", () => {
  it("requires every integer autoincrement table id to be inventoried", () => {
    expect(existsSync(policyPath)).toBe(true);

    const discovered = discoverIntegerPrimaryKeys();
    const policy = JSON.parse(
      readFileSync(policyPath, "utf8"),
    ) as IntegerPrimaryKeyPolicyEntry[];
    const policyByKey = new Map(policy.map((entry) => [keyOf(entry), entry]));
    const discoveredByKey = new Map(
      discovered.map((surface) => [keyOf(surface), surface]),
    );

    const missing = discovered
      .filter((surface) => !policyByKey.has(keyOf(surface)))
      .map(keyOf);
    const stale = policy
      .filter((entry) => !discoveredByKey.has(keyOf(entry)))
      .map(keyOf);

    expect({ missing, stale }).toEqual({ missing: [], stale: [] });

    for (const surface of discovered) {
      const entry = policyByKey.get(keyOf(surface));
      expect(entry, keyOf(surface)).toBeDefined();
      expect(entry?.line).toBe(surface.line);
      expect(allowedCategories.has(entry?.category ?? ""), keyOf(surface)).toBe(
        true,
      );
      expect(
        allowedMigrationPlans.has(entry?.migrationPlan ?? ""),
        keyOf(surface),
      ).toBe(true);
      expect(entry?.rationale.trim().length, keyOf(surface)).toBeGreaterThan(
        20,
      );
    }
  });
});

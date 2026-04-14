/**
 * Database Migrations Integration Tests
 *
 * Verifies that all migration SQL files can be applied sequentially
 * on a fresh in-memory SQLite database (via sql.js) without errors.
 *
 * No vi.mock() -- uses a real SQLite engine to validate migration correctness.
 */

import { describe, it, expect, beforeAll } from "vitest";
import initSqlJs, { type Database } from "sql.js";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIGRATIONS_DIR = join(
  __dirname,
  "../../../../../packages/database/migrations_fresh",
);

const EXPECTED_MIGRATION_COUNT = 14;

/** All .sql files sorted by name (0000..0013) */
function getMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/**
 * Drizzle-generated migrations use `--> statement-breakpoint` as a delimiter
 * between SQL statements. Plain migrations just use semicolons.
 * We split on the breakpoint marker first, then fall back to returning the
 * whole file (sql.js db.exec() handles multiple semicolon-delimited statements).
 */
function splitStatements(sql: string): string[] {
  if (sql.includes("--> statement-breakpoint")) {
    return sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  // For raw SQL migrations, return the whole file -- db.exec() handles
  // multiple semicolon-delimited statements in one call.
  return [sql.trim()];
}

describe("Database Migrations Integration", () => {
  let sqlDb: Database;
  const migrationFiles = getMigrationFiles();

  beforeAll(async () => {
    const SQL = await initSqlJs();
    sqlDb = new SQL.Database();

    // Register `unixepoch` -- sql.js may use an older SQLite build that lacks it.
    (sqlDb as any).create_function("unixepoch", (arg: string | null) => {
      if (arg === "now" || arg === null) {
        return Math.floor(Date.now() / 1000);
      }
      return Math.floor(new Date(arg).getTime() / 1000);
    });
  });

  // -----------------------------------------------------------------------
  // 1. Migration files exist and are readable
  // -----------------------------------------------------------------------
  it("should have all 14 migration files present and readable", () => {
    expect(migrationFiles.length).toBe(EXPECTED_MIGRATION_COUNT);

    for (const file of migrationFiles) {
      const content = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
      expect(content.length).toBeGreaterThan(0);
    }

    // Verify sequential numbering 0000..0013
    for (let i = 0; i < EXPECTED_MIGRATION_COUNT; i++) {
      const prefix = String(i).padStart(4, "0");
      const match = migrationFiles.find((f) => f.startsWith(prefix));
      expect(match).toBeDefined();
    }
  });

  // -----------------------------------------------------------------------
  // 2. Apply all migrations sequentially -- no SQL errors
  // -----------------------------------------------------------------------
  it(
    "should apply all migrations sequentially without errors",
    { timeout: 60_000 },
    () => {
      const errors: { file: string; error: string }[] = [];

      for (const file of migrationFiles) {
        const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
        const statements = splitStatements(sql);

        for (const stmt of statements) {
          try {
            sqlDb.exec(stmt);
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push({ file, error: message });
            // Log but continue so we get a full report
            console.error(`[MIGRATION FAIL] ${file}: ${message}`);
          }
        }
      }

      if (errors.length > 0) {
        console.table(errors);
      }
      expect(errors).toEqual([]);
    },
  );

  // -----------------------------------------------------------------------
  // 3. Key tables exist after all migrations
  // -----------------------------------------------------------------------
  it("should contain all key tables after migrations", () => {
    const rows = sqlDb.exec(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );

    const tableNames: string[] =
      rows[0]?.values.map((row) => row[0] as string) ?? [];

    const expectedTables = [
      "restaurants",
      "users",
      "customers",
      "categories",
      "menu_items",
      "tables",
      "seats",
      "orders",
      "order_items",
      "sessions",
      "audit_logs",
      "qr_codes",
      "images",
      "coupons",
      "receipts",
      "refunds",
      // From later migrations
      "forecast_cache",
      "ingredient_definitions",
      "menu_item_ingredients",
      "dish_search_index",
      "reservations",
      "waiting_list",
    ];

    for (const table of expectedTables) {
      expect(tableNames).toContain(table);
    }
  });

  // -----------------------------------------------------------------------
  // 4. Key indexes exist (spot check)
  // -----------------------------------------------------------------------
  it("should contain key indexes after migrations", () => {
    const rows = sqlDb.exec(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );

    const indexNames: string[] =
      rows[0]?.values.map((row) => row[0] as string) ?? [];

    const expectedIndexes = [
      // From migration 0000/0005 -- core table indexes
      "orders_restaurant_status_idx",
      "menu_items_restaurant_category_idx",
      "tables_restaurant_number_idx",
      "seats_table_id_idx",
      // From migration 0001 -- customer indexes
      "idx_customers_email",
      "idx_customers_phone",
      // From discovery migration -- search indexes
      "dish_search_name_available_idx",
      "dish_search_restaurant_available_idx",
    ];

    for (const idx of expectedIndexes) {
      expect(indexNames).toContain(idx);
    }
  });

  // -----------------------------------------------------------------------
  // 5. Basic referential integrity -- insert restaurant then user
  // -----------------------------------------------------------------------
  it("should enforce referential integrity for restaurant and user inserts", () => {
    // Enable foreign keys (some migrations toggle this off for ALTER operations)
    sqlDb.exec("PRAGMA foreign_keys = ON;");

    const now = Date.now();

    // After all migrations: restaurants.id is TEXT, timestamps use _ms suffix
    sqlDb.exec(`
      INSERT INTO restaurants (
        id, name, type, category, address, district, city, phone,
        is_available, is_active, created_at_ms, updated_at_ms
      ) VALUES (
        'rest-1', 'Test Restaurant', 'restaurant', 'chinese', '123 Main St',
        'Xitun', '台中市', '0912345678', 1, 1, ${now}, ${now}
      );
    `);

    // Verify the restaurant was inserted
    const restaurantRows = sqlDb.exec(
      "SELECT id, name FROM restaurants WHERE id = 'rest-1'",
    );
    expect(restaurantRows[0]?.values[0]?.[1]).toBe("Test Restaurant");

    // Insert a user (id is INTEGER AUTOINCREMENT, timestamps use _ms suffix)
    sqlDb.exec(`
      INSERT INTO users (
        username, full_name, password_hash, role,
        restaurant_id, is_active, is_verified, created_at_ms, updated_at_ms
      ) VALUES (
        'testuser', 'Test User', 'hashed_pw', 0,
        'rest-1', 1, 0, ${now}, ${now}
      );
    `);

    // Verify the user was inserted
    const userRows = sqlDb.exec(
      "SELECT id, username, restaurant_id FROM users WHERE username = 'testuser'",
    );
    expect(userRows[0]?.values[0]?.[1]).toBe("testuser");
    expect(userRows[0]?.values[0]?.[2]).toBe("rest-1");

    // Insert an order referencing a non-existent table_id -- should fail with FK on
    expect(() => {
      sqlDb.exec(`
        INSERT INTO orders (
          restaurant_id, table_id, order_number, status,
          subtotal, total_amount, created_at_ms, updated_at_ms
        ) VALUES (
          'rest-1', 9999, 'ORD-001', 'pending',
          100.0, 100.0, ${now}, ${now}
        );
      `);
    }).toThrow();
  });
});

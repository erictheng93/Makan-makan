// Undo the global vi.mock("drizzle-orm/d1") from services/__tests__/setup.ts
// so this test uses the real drizzle implementation.
vi.unmock("drizzle-orm/d1");

import { describe, it, expect, afterEach } from "vitest";
import { createTestDatabase, type TestDatabase } from "../create-test-database";

describe("createTestDatabase", () => {
  let testDb: TestDatabase | null = null;

  afterEach(async () => {
    if (testDb) {
      await testDb.dispose();
      testDb = null;
    }
  });

  it("returns a TestDatabase with db, bindings, drizzle, truncateAll, dispose", async () => {
    testDb = await createTestDatabase();
    expect(testDb.db).toBeDefined();
    expect(testDb.bindings.DB).toBe(testDb.db);
    expect(testDb.bindings.CACHE_KV).toBeDefined();
    expect(testDb.bindings.IMAGES_BUCKET).toBeDefined();
    expect(typeof testDb.drizzle.select).toBe("function");
    expect(typeof testDb.truncateAll).toBe("function");
    expect(typeof testDb.dispose).toBe("function");
  });

  it("has all migrations applied so schema tables exist", async () => {
    testDb = await createTestDatabase();
    const result = await testDb.db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name = 'restaurants'`,
      )
      .first();
    expect(result).toBeTruthy();
  });

  it("truncateAll empties user tables and resets sqlite_sequence", async () => {
    testDb = await createTestDatabase();
    // restaurants.id is TEXT (UUID), no AUTOINCREMENT — supply explicit id
    await testDb.db
      .prepare(
        `INSERT INTO restaurants (id, name, type, category, address, district, phone, created_at_ms, updated_at_ms) VALUES ('test-id-1', 'Test', 'cafe', 'food', '1 St', 'KL', '000', 1735689600000, 1735689600000)`,
      )
      .run();
    // users.id is INTEGER AUTOINCREMENT — this creates a sqlite_sequence entry
    await testDb.db
      .prepare(
        `INSERT INTO users (username, full_name, password_hash, role, restaurant_id, created_at_ms, updated_at_ms) VALUES ('testuser', 'Test User', 'hash', 4, 'test-id-1', 1735689600000, 1735689600000)`,
      )
      .run();

    const before = await testDb.db
      .prepare(`SELECT COUNT(*) as c FROM restaurants`)
      .first<{ c: number }>();
    expect(before?.c).toBe(1);

    // Confirm sqlite_sequence has an entry from the users AUTOINCREMENT insert
    // so the post-truncate assertion is non-vacuous.
    const seqBefore = await testDb.db
      .prepare(`SELECT COUNT(*) as c FROM sqlite_sequence`)
      .first<{ c: number }>();
    expect(seqBefore?.c).toBeGreaterThan(0);

    await testDb.truncateAll();

    const after = await testDb.db
      .prepare(`SELECT COUNT(*) as c FROM restaurants`)
      .first<{ c: number }>();
    expect(after?.c).toBe(0);

    const seq = await testDb.db
      .prepare(`SELECT COUNT(*) as c FROM sqlite_sequence`)
      .first<{ c: number }>();
    expect(seq?.c).toBe(0);
  });

  it("dispose releases the miniflare instance without throwing", async () => {
    testDb = await createTestDatabase();
    await expect(testDb.dispose()).resolves.not.toThrow();
    testDb = null; // prevent afterEach double-dispose
  });
});

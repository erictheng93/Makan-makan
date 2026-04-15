/**
 * Real integration smoke — Coupons seed helper
 *
 * Pilot migration, commit 1: verifies that the new `seed.coupon()` helper
 * inserts a real row through Drizzle + miniflare D1. This file intentionally
 * ships with ONE smoke test — the full migration of the 7 legacy coupons
 * tests arrives in a later commit.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";
import { coupons } from "@makanmakan/database";
import { eq } from "drizzle-orm";

// Undo the global vi.mock("drizzle-orm/d1") so this test uses the real drizzle.
vi.unmock("drizzle-orm/d1");

describe("Coupons seed helper — real integration smoke", () => {
  let testApp: RealIntegrationTestApp;
  let seed: ReturnType<typeof buildSeedHelpers>;

  beforeAll(async () => {
    testApp = await createRealIntegrationTestApp();
    seed = buildSeedHelpers(testApp.testDb);
  });

  afterAll(async () => {
    await testApp.dispose();
  });

  beforeEach(async () => {
    await testApp.testDb.truncateAll();
  });

  it("seeds a coupon row with defaults that satisfy the real schema", async () => {
    const restaurant = await seed.restaurant();

    const created = await seed.coupon(restaurant.id);

    expect(created.id).toBeGreaterThan(0);
    expect(created.code).toMatch(/^TEST-[A-Z0-9]{6}$/);

    // Verify the row actually lives in the DB with all required fields.
    const rows = await testApp.testDb.drizzle
      .select()
      .from(coupons)
      .where(eq(coupons.id, created.id));

    expect(rows).toHaveLength(1);
    const row = rows[0] as any;
    expect(row.restaurantId).toBe(String(restaurant.id));
    expect(row.discountType).toBe("percentage");
    expect(row.discountValue).toBe(10);
    // validFrom / validTo are TEXT columns in YYYY-MM-DD format.
    expect(row.validFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(row.validTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // isActive is stored as boolean via Drizzle's `mode: "boolean"` — Drizzle
    // serialises to integer 0/1 in SQLite and reads back as a JS boolean.
    expect(row.isActive).toBe(true);
  });

  it("honours overrides for discount shape and validity window", async () => {
    const restaurant = await seed.restaurant();

    const created = await seed.coupon(restaurant.id, {
      discountType: "fixed",
      discountValue: 25,
      validFrom: "2020-01-01",
      validTo: "2020-12-31",
      isActive: false,
    });

    const rows = await testApp.testDb.drizzle
      .select()
      .from(coupons)
      .where(eq(coupons.id, created.id));

    const row = rows[0] as any;
    expect(row.discountType).toBe("fixed");
    expect(row.discountValue).toBe(25);
    expect(row.validFrom).toBe("2020-01-01");
    expect(row.validTo).toBe("2020-12-31");
    expect(row.isActive).toBe(false);
  });
});

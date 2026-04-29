/**
 * Real-D1 tests for ReservationService methods that previously built SQL by
 * hand and substituted parameters as literal text via a `replaceParams`
 * helper. The main ReservationService.test.ts file stubs these methods via
 * vi.spyOn — so the actual SQL path is never exercised. This file runs the
 * real implementation against an in-memory D1 (via miniflare + Drizzle) so
 * that any future regression to hand-rolled string SQL with manual
 * parameter substitution will be caught by CI.
 *
 * Covers:
 *   - updateReservation (Drizzle update builder)
 *   - listReservations (Drizzle sql template + schema column refs)
 *   - getReservationStats (Drizzle sql template + schema column refs)
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
  createTestDatabase,
  type TestDatabase,
} from "../../testing/create-test-database";
import { ReservationStatus } from "@makanmakan/shared-types";
import { ReservationService } from "../ReservationService";
import type { CloudflareEnv } from "../base";

// Undo the global vi.mock("drizzle-orm/d1") from setup.ts so this file
// uses the real Drizzle implementation, not the pass-through identity mock.
vi.unmock("drizzle-orm/d1");

const RESTAURANT_ID = "rest-real-1";
const OTHER_RESTAURANT_ID = "rest-real-2";

async function seedRestaurant(testDb: TestDatabase, id: string): Promise<void> {
  await testDb.db
    .prepare(
      `INSERT INTO restaurants (id, name, type, category, address, district, phone, created_at_ms, updated_at_ms)
       VALUES (?, 'Test Bistro', 'cafe', 'food', '1 St', 'KL', '000', 1735689600000, 1735689600000)`,
    )
    .bind(id)
    .run();
}

interface SeedReservationOptions {
  restaurantId?: string;
  partySize?: number;
  status?: string;
  reservationDate?: string;
  reservationTime?: string;
  customerPhone?: string;
  specialRequests?: string | null;
  createdAt?: number;
}

async function seedReservation(
  testDb: TestDatabase,
  id: string,
  opts: SeedReservationOptions = {},
): Promise<void> {
  const now = opts.createdAt ?? Date.now();
  await testDb.db
    .prepare(
      `INSERT INTO reservations
         (id, restaurant_id, customer_name, customer_phone, party_size,
          reservation_date, reservation_time, duration_minutes, status,
          confirmation_code, special_requests, created_at, updated_at)
       VALUES (?, ?, '王小明', ?, ?, ?, ?, 90, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      opts.restaurantId ?? RESTAURANT_ID,
      opts.customerPhone ?? "0912345678",
      opts.partySize ?? 2,
      opts.reservationDate ?? "2026-05-01",
      opts.reservationTime ?? "18:30",
      opts.status ?? "pending",
      // Use full id as confirmation code so seed never collides on the
      // UNIQUE constraint, regardless of how callers name their fixtures.
      id,
      opts.specialRequests ?? null,
      now,
      now,
    )
    .run();
}

let testDb: TestDatabase;
let service: ReservationService;

// Shared miniflare instance across all describes — boot + 22 migrations
// is ~10s, so we pay it once instead of per file/describe.
beforeAll(async () => {
  testDb = await createTestDatabase();
}, 60000);

afterAll(async () => {
  await testDb?.dispose();
  // Restore the global setup.ts mock for `drizzle-orm/d1`. With
  // `isolate: false` in vitest.config.ts, modules are cached across files,
  // so leaving the unmock in effect would cause subsequent service tests
  // (which pass mockDB to BaseService) to construct against the real
  // Drizzle and fail with `this.client.prepare is not a function`.
  vi.doMock("drizzle-orm/d1", () => ({
    drizzle: (d1: any) => d1,
  }));
  vi.resetModules();
});

beforeEach(async () => {
  await testDb.truncateAll();
  await seedRestaurant(testDb, RESTAURANT_ID);
  const env = { JWT_SECRET: "test", NODE_ENV: "test" } as CloudflareEnv;
  service = new ReservationService(testDb.db as any, env);
});

describe("ReservationService.updateReservation — real D1", () => {
  it("persists field updates via the real Drizzle update path", async () => {
    const id = "rsv-real-happy";
    await seedReservation(testDb, id, { partySize: 2 });

    const result = await service.updateReservation(id, {
      partySize: 5,
      specialRequests: "需要兒童座椅",
    });

    expect(result.partySize).toBe(5);
    expect(result.specialRequests).toBe("需要兒童座椅");

    const row = await testDb.db
      .prepare(
        `SELECT party_size, special_requests FROM reservations WHERE id = ?`,
      )
      .bind(id)
      .first<{ party_size: number; special_requests: string }>();
    expect(row?.party_size).toBe(5);
    expect(row?.special_requests).toBe("需要兒童座椅");
  });

  it("stores SQL-injection probes verbatim and does not execute them", async () => {
    const id = "rsv-real-injection";
    await seedReservation(testDb, id, { partySize: 2 });

    const malicious = `'); DROP TABLE reservations; --`;
    await service.updateReservation(id, { specialRequests: malicious });

    // Table must still exist — if the payload were interpolated as SQL the
    // DROP would have removed it and the next query would throw.
    const tableExists = await testDb.db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='reservations'`,
      )
      .first();
    expect(tableExists).toBeTruthy();

    const row = await testDb.db
      .prepare(`SELECT special_requests FROM reservations WHERE id = ?`)
      .bind(id)
      .first<{ special_requests: string }>();
    expect(row?.special_requests).toBe(malicious);
  });

  it("only updates fields present in the patch", async () => {
    const id = "rsv-real-partial";
    await seedReservation(testDb, id, {
      partySize: 2,
      specialRequests: "原備註",
    });

    await service.updateReservation(id, { partySize: 7 });

    const row = await testDb.db
      .prepare(
        `SELECT party_size, special_requests FROM reservations WHERE id = ?`,
      )
      .bind(id)
      .first<{ party_size: number; special_requests: string }>();
    expect(row?.party_size).toBe(7);
    expect(row?.special_requests).toBe("原備註");
  });

  it("throws when the reservation does not exist", async () => {
    await expect(
      service.updateReservation("does-not-exist", { partySize: 4 }),
    ).rejects.toThrow("訂位不存在");
  });
});

describe("ReservationService.listReservations — real D1", () => {
  it("filters by restaurantId and returns matching rows + total", async () => {
    await seedRestaurant(testDb, OTHER_RESTAURANT_ID);
    await seedReservation(testDb, "rsv-list-1", { partySize: 2 });
    await seedReservation(testDb, "rsv-list-2", { partySize: 3 });
    await seedReservation(testDb, "rsv-other", {
      restaurantId: OTHER_RESTAURANT_ID,
      partySize: 4,
    });

    const result = await service.listReservations({
      restaurantId: RESTAURANT_ID,
    });

    expect(result.total).toBe(2);
    expect(result.data.map((r) => r.id).sort()).toEqual([
      "rsv-list-1",
      "rsv-list-2",
    ]);
  });

  it("supports IN-list status filter", async () => {
    await seedReservation(testDb, "rsv-pending", { status: "pending" });
    await seedReservation(testDb, "rsv-confirmed", { status: "confirmed" });
    await seedReservation(testDb, "rsv-cancelled", { status: "cancelled" });

    const result = await service.listReservations({
      restaurantId: RESTAURANT_ID,
      status: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED],
    });

    expect(result.total).toBe(2);
    expect(new Set(result.data.map((r) => r.status))).toEqual(
      new Set(["pending", "confirmed"]),
    );
  });

  it("supports date range filter and pagination", async () => {
    await seedReservation(testDb, "rsv-d1", { reservationDate: "2026-05-01" });
    await seedReservation(testDb, "rsv-d2", { reservationDate: "2026-05-02" });
    await seedReservation(testDb, "rsv-d3", { reservationDate: "2026-05-10" });

    const result = await service.listReservations({
      restaurantId: RESTAURANT_ID,
      startDate: "2026-05-01",
      endDate: "2026-05-05",
      page: 1,
      limit: 10,
    });

    expect(result.total).toBe(2);
    expect(result.data.map((r) => r.id).sort()).toEqual(["rsv-d1", "rsv-d2"]);
  });

  it("stores SQL-injection probes verbatim in customerPhone filter", async () => {
    // Seed one reservation with the legitimate phone we'll search for and
    // one row with a benign phone to make sure the filter actually runs.
    await seedReservation(testDb, "rsv-good", { customerPhone: "0911000000" });

    const malicious = `' OR 1=1; DROP TABLE reservations; --`;
    const result = await service.listReservations({
      restaurantId: RESTAURANT_ID,
      customerPhone: malicious,
    });

    // Filter should match nothing, NOT bypass via OR-injection.
    expect(result.total).toBe(0);
    expect(result.data).toEqual([]);

    // Table must still exist after the malicious filter.
    const tableExists = await testDb.db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='reservations'`,
      )
      .first();
    expect(tableExists).toBeTruthy();
  });

  it("falls back to created_at when sortBy is unknown (allowlist defends identifier)", async () => {
    // Different created_at timestamps so DESC ordering is observable.
    await seedReservation(testDb, "rsv-old", { createdAt: 1000 });
    await seedReservation(testDb, "rsv-new", { createdAt: 2000 });

    const result = await service.listReservations({
      restaurantId: RESTAURANT_ID,
      // Bogus sort key that would have been interpolated literally by the
      // old `r.${sortBy}` code, breaking the query (or worse, opening
      // identifier injection). The allowlist drops it back to createdAt.
      sortBy: "evil; DROP TABLE reservations; --" as any,
    });

    expect(result.total).toBe(2);
    expect(result.data.map((r) => r.id)).toEqual(["rsv-new", "rsv-old"]);

    const tableExists = await testDb.db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='reservations'`,
      )
      .first();
    expect(tableExists).toBeTruthy();
  });
});

describe("ReservationService.getReservationStats — real D1", () => {
  it("aggregates per-status counts and party_size sum", async () => {
    await seedReservation(testDb, "rsv-stats-1", {
      status: "confirmed",
      partySize: 2,
    });
    await seedReservation(testDb, "rsv-stats-2", {
      status: "completed",
      partySize: 4,
    });
    await seedReservation(testDb, "rsv-stats-3", {
      status: "no_show",
      partySize: 3,
    });
    await seedReservation(testDb, "rsv-stats-4", {
      status: "cancelled",
      partySize: 1,
    });

    const stats = await service.getReservationStats(RESTAURANT_ID);

    expect(stats.totalReservations).toBe(4);
    expect(stats.confirmedCount).toBe(1);
    expect(stats.completedCount).toBe(1);
    expect(stats.noShowCount).toBe(1);
    expect(stats.cancelledCount).toBe(1);
    expect(stats.totalGuests).toBe(10);
    expect(stats.noShowRate).toBe(25);
    expect(stats.averagePartySize).toBe(2.5);
  });

  it("date filter only counts that day", async () => {
    await seedReservation(testDb, "rsv-day1", {
      reservationDate: "2026-05-01",
      partySize: 2,
    });
    await seedReservation(testDb, "rsv-day2-a", {
      reservationDate: "2026-05-02",
      partySize: 3,
    });
    await seedReservation(testDb, "rsv-day2-b", {
      reservationDate: "2026-05-02",
      partySize: 5,
    });

    const stats = await service.getReservationStats(
      RESTAURANT_ID,
      "2026-05-02",
    );

    expect(stats.totalReservations).toBe(2);
    expect(stats.totalGuests).toBe(8);
  });

  it("treats restaurantId as a parameter, not concatenated SQL", async () => {
    await seedReservation(testDb, "rsv-real-stats", { partySize: 2 });

    const malicious = `' OR 1=1; DROP TABLE reservations; --`;
    const stats = await service.getReservationStats(malicious);

    // No restaurant matches the malicious string → 0 rows aggregated.
    expect(stats.totalReservations).toBe(0);
    expect(stats.totalGuests).toBe(0);

    const tableExists = await testDb.db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='reservations'`,
      )
      .first();
    expect(tableExists).toBeTruthy();
  });
});

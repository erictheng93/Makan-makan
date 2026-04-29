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
import { ReservationService } from "../ReservationService";
import type { CloudflareEnv } from "../base";

// Undo the global vi.mock("drizzle-orm/d1") from setup.ts so this file
// uses the real Drizzle implementation, not the pass-through identity mock.
vi.unmock("drizzle-orm/d1");

const RESTAURANT_ID = "rest-real-1";

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

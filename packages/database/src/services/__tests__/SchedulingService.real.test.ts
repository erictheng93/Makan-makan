import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createTestDatabase,
  type TestDatabase,
} from "../../testing/create-test-database";
import { SchedulingService } from "../SchedulingService";

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase();
}, 240000);

afterAll(async () => {
  await testDb?.dispose();
});

beforeEach(async () => {
  await testDb.truncateAll();
  await testDb.db
    .prepare(
      `INSERT INTO restaurants
         (id, name, type, category, address, district, phone, created_at_ms, updated_at_ms)
       VALUES
         ('sched-rest', 'Schedule Test', 'street_food', 'snack', '1 Test Rd', 'West', '0900000000', 1735689600000, 1735689600000)`,
    )
    .run();
  await testDb.db
    .prepare(
      `INSERT INTO users
         (id, username, full_name, password_hash, role, restaurant_id, is_active, is_verified, total_orders, total_spent, token_version, created_at_ms, updated_at_ms)
       VALUES
         (1, 'sched-owner', 'Schedule Owner', 'test', 1, 'sched-rest', 1, 1, 0, 0, 1, 1735689600000, 1735689600000),
         (2, 'sched-employee', 'Schedule Employee', 'test', 3, 'sched-rest', 1, 1, 0, 0, 1, 1735689600000, 1735689600000)`,
    )
    .run();
});

describe("employee_schedules active slot uniqueness", () => {
  async function insertSchedule(status = "scheduled") {
    await testDb.db
      .prepare(
        `INSERT INTO employee_schedules
           (restaurant_id, employee_id, work_date, start_time, end_time,
            break_duration_minutes, scheduled_hours, status, created_by,
            created_at_ms, updated_at_ms)
         VALUES
           ('sched-rest', 2, '2026-06-05', '14:00', '18:00',
            0, 4, ?, 1, 1735689600000, 1735689600000)`,
      )
      .bind(status)
      .run();
  }

  it("rejects duplicate active schedules for the same employee, date, and time", async () => {
    await insertSchedule("scheduled");

    await expect(insertSchedule("scheduled")).rejects.toThrow(
      /duplicate active employee schedule slot/,
    );
  });

  it("allows reusing a slot after the prior schedule is cancelled", async () => {
    await insertSchedule("cancelled");

    await expect(insertSchedule("scheduled")).resolves.toBeUndefined();
  });
});

describe("SchedulingService.cancelSchedulesByDateRange", () => {
  it("cancels matching schedules without interactive D1 transactions", async () => {
    await testDb.db
      .prepare(
        `INSERT INTO employee_schedules
           (id, restaurant_id, employee_id, work_date, start_time, end_time,
            break_duration_minutes, scheduled_hours, status, created_by,
            created_at_ms, updated_at_ms)
         VALUES
           (10, 'sched-rest', 2, '2026-06-10', '09:00', '13:00',
            0, 4, 'scheduled', 1, 1735689600000, 1735689600000),
           (11, 'sched-rest', 2, '2026-06-11', '09:00', '13:00',
            0, 4, 'confirmed', 1, 1735689600000, 1735689600000),
           (12, 'sched-rest', 2, '2026-06-12', '09:00', '13:00',
            0, 4, 'cancelled', 1, 1735689600000, 1735689600000),
           (13, 'sched-rest', 1, '2026-06-10', '09:00', '13:00',
            0, 4, 'scheduled', 1, 1735689600000, 1735689600000)`,
      )
      .run();
    const service = new SchedulingService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });

    await expect(
      service.cancelSchedulesByDateRange({
        employeeId: 2,
        startDate: "2026-06-10",
        endDate: "2026-06-12",
        reason: "leave approved",
        cancelledBy: 1,
      }),
    ).resolves.toEqual({ cancelledCount: 2, scheduleIds: [10, 11] });

    const rows = await testDb.db
      .prepare(
        `SELECT id, status, manager_notes, updated_by
           FROM employee_schedules
          WHERE id IN (10, 11, 12, 13)
          ORDER BY id`,
      )
      .all<{
        id: number;
        status: string;
        manager_notes: string | null;
        updated_by: number | null;
      }>();

    expect(rows.results).toEqual([
      {
        id: 10,
        status: "cancelled",
        manager_notes: "leave approved",
        updated_by: 1,
      },
      {
        id: 11,
        status: "cancelled",
        manager_notes: "leave approved",
        updated_by: 1,
      },
      {
        id: 12,
        status: "cancelled",
        manager_notes: null,
        updated_by: null,
      },
      {
        id: 13,
        status: "scheduled",
        manager_notes: null,
        updated_by: null,
      },
    ]);
  });
});

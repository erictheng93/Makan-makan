import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  employeeLeaveBalances,
  leaveRequests,
  leaveTypes,
  restaurants,
  users,
} from "../schema";
import {
  createTestDatabase,
  type TestDatabase,
} from "../testing/create-test-database";
import { LeaveService } from "./LeaveService";

const restaurantId = "leave-race-restaurant";
const year = new Date().getFullYear();

describe("LeaveService balance concurrency", () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
  }, 180_000);

  afterAll(async () => {
    await testDb?.dispose();
  });

  beforeEach(async () => {
    await testDb.truncateAll();
  });

  it("applies concurrent leave request pending holds cumulatively", async () => {
    const service = new LeaveService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });
    const { employeeId, leaveTypeId, balanceId } = await seedLeaveFixtures(
      testDb,
      {
        pendingDays: 0,
        usedDays: 0,
      },
    );

    await Promise.all([
      service.createLeaveRequest({
        restaurantId,
        employeeId,
        leaveTypeId,
        startDate: "2026-06-10",
        endDate: "2026-06-11",
        startPeriod: "full",
        endPeriod: "full",
        totalDays: 2,
        reason: "vacation",
      }),
      service.createLeaveRequest({
        restaurantId,
        employeeId,
        leaveTypeId,
        startDate: "2026-06-12",
        endDate: "2026-06-13",
        startPeriod: "full",
        endPeriod: "full",
        totalDays: 2,
        reason: "vacation",
      }),
    ]);

    const [balance] = await testDb.drizzle
      .select()
      .from(employeeLeaveBalances)
      .where(eq(employeeLeaveBalances.id, balanceId));
    expect(balance.pendingDays).toBe(4);
    expect(balance.usedDays).toBe(0);
  });

  it("applies concurrent manual leave balance adjustments cumulatively", async () => {
    const service = new LeaveService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });
    const { employeeId, approverId, leaveTypeId, balanceId } =
      await seedLeaveFixtures(testDb, {
        pendingDays: 0,
        usedDays: 0,
      });

    await Promise.all([
      service.adjustLeaveBalance({
        employeeId,
        leaveTypeId,
        year,
        adjustment: 1,
        reason: "carryover",
        adjustedBy: approverId,
      }),
      service.adjustLeaveBalance({
        employeeId,
        leaveTypeId,
        year,
        adjustment: 2,
        reason: "correction",
        adjustedBy: approverId,
      }),
    ]);

    const [balance] = await testDb.drizzle
      .select()
      .from(employeeLeaveBalances)
      .where(eq(employeeLeaveBalances.id, balanceId));
    expect(balance.totalDays).toBe(13);
    expect(balance.manualAdjustment).toBe(3);
  });

  it("applies concurrent approvals to the same leave balance cumulatively", async () => {
    const service = new LeaveService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });
    const { employeeId, approverId, leaveTypeId, balanceId } =
      await seedLeaveFixtures(testDb, {
        pendingDays: 4,
        usedDays: 0,
      });
    const firstRequestId = await seedLeaveRequest(testDb, {
      employeeId,
      leaveTypeId,
      totalDays: 2,
    });
    const secondRequestId = await seedLeaveRequest(testDb, {
      employeeId,
      leaveTypeId,
      totalDays: 2,
    });

    await Promise.all([
      service.approveLeaveRequest(firstRequestId, approverId),
      service.approveLeaveRequest(secondRequestId, approverId),
    ]);

    const [balance] = await testDb.drizzle
      .select()
      .from(employeeLeaveBalances)
      .where(eq(employeeLeaveBalances.id, balanceId));
    expect(balance.pendingDays).toBe(0);
    expect(balance.usedDays).toBe(4);
  });

  it("applies concurrent rejections to the same leave balance cumulatively", async () => {
    const service = new LeaveService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });
    const { employeeId, approverId, leaveTypeId, balanceId } =
      await seedLeaveFixtures(testDb, {
        pendingDays: 4,
        usedDays: 0,
      });
    const firstRequestId = await seedLeaveRequest(testDb, {
      employeeId,
      leaveTypeId,
      totalDays: 2,
    });
    const secondRequestId = await seedLeaveRequest(testDb, {
      employeeId,
      leaveTypeId,
      totalDays: 2,
    });

    await Promise.all([
      service.rejectLeaveRequest(firstRequestId, approverId, "no coverage"),
      service.rejectLeaveRequest(secondRequestId, approverId, "no coverage"),
    ]);

    const [balance] = await testDb.drizzle
      .select()
      .from(employeeLeaveBalances)
      .where(eq(employeeLeaveBalances.id, balanceId));
    expect(balance.pendingDays).toBe(0);
    expect(balance.usedDays).toBe(0);
  });

  it("applies concurrent approved-leave cancellations cumulatively", async () => {
    const service = new LeaveService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });
    const { employeeId, approverId, leaveTypeId, balanceId } =
      await seedLeaveFixtures(testDb, {
        pendingDays: 0,
        usedDays: 4,
      });
    const firstRequestId = await seedLeaveRequest(testDb, {
      employeeId,
      leaveTypeId,
      totalDays: 2,
      status: "approved",
    });
    const secondRequestId = await seedLeaveRequest(testDb, {
      employeeId,
      leaveTypeId,
      totalDays: 2,
      status: "approved",
    });

    await Promise.all([
      service.cancelLeaveRequest(firstRequestId, approverId, "changed"),
      service.cancelLeaveRequest(secondRequestId, approverId, "changed"),
    ]);

    const [balance] = await testDb.drizzle
      .select()
      .from(employeeLeaveBalances)
      .where(eq(employeeLeaveBalances.id, balanceId));
    expect(balance.pendingDays).toBe(0);
    expect(balance.usedDays).toBe(0);
  });
});

async function seedLeaveFixtures(
  testDb: TestDatabase,
  balance: { pendingDays: number; usedDays: number },
) {
  const now = new Date("2026-06-07T12:00:00.000Z");
  await testDb.drizzle.insert(restaurants).values({
    id: restaurantId,
    name: "Leave Race Restaurant",
    type: "restaurant",
    category: "casual",
    address: "1 Leave St",
    district: "Central",
    city: "Taipei",
    phone: "0200000000",
    settings: {},
    isAvailable: true,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  } as never);

  const [employee] = await testDb.drizzle
    .insert(users)
    .values({
      username: "leave-employee",
      fullName: "Leave Employee",
      passwordHash: "hash",
      role: 3,
      restaurantId,
      isActive: true,
      isVerified: true,
      createdAt: now,
      updatedAt: now,
    } as never)
    .returning({ id: users.id });

  const [approver] = await testDb.drizzle
    .insert(users)
    .values({
      username: "leave-approver",
      fullName: "Leave Approver",
      passwordHash: "hash",
      role: 1,
      restaurantId,
      isActive: true,
      isVerified: true,
      createdAt: now,
      updatedAt: now,
    } as never)
    .returning({ id: users.id });

  const [leaveType] = await testDb.drizzle
    .insert(leaveTypes)
    .values({
      restaurantId,
      code: "AL",
      name: "Annual Leave",
      accrualType: "yearly",
      accrualAmount: 10,
      requiredApprovalLevels: 1,
      createdAt: now,
      updatedAt: now,
    } as never)
    .returning({ id: leaveTypes.id });

  const [leaveBalance] = await testDb.drizzle
    .insert(employeeLeaveBalances)
    .values({
      employeeId: employee.id,
      leaveTypeId: leaveType.id,
      restaurantId,
      year,
      totalDays: 10,
      pendingDays: balance.pendingDays,
      usedDays: balance.usedDays,
      createdAt: now,
      updatedAt: now,
    } as never)
    .returning({ id: employeeLeaveBalances.id });

  return {
    employeeId: employee.id,
    approverId: approver.id,
    leaveTypeId: leaveType.id,
    balanceId: leaveBalance.id,
  };
}

async function seedLeaveRequest(
  testDb: TestDatabase,
  input: {
    employeeId: string;
    leaveTypeId: number;
    totalDays: number;
    status?: "pending" | "approved";
  },
) {
  const now = new Date("2026-06-07T12:00:00.000Z");
  const [request] = await testDb.drizzle
    .insert(leaveRequests)
    .values({
      restaurantId,
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      startDate: "2026-06-10",
      endDate: "2026-06-11",
      startPeriod: "full",
      endPeriod: "full",
      totalDays: input.totalDays,
      reason: "vacation",
      status: input.status ?? "pending",
      approvalChain: "[]",
      currentApprovalLevel: input.status === "approved" ? 1 : 0,
      replacementNotified: false,
      createdAt: now,
      updatedAt: now,
      submittedAt: now,
      finalApprovedAt: input.status === "approved" ? now : null,
    } as never)
    .returning({ id: leaveRequests.id });
  return request.id;
}

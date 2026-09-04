// 假期日期是「營業日」（UTC+8），比較必須與執行機器的時區無關。把 TZ 釘在一個
// 明顯不是 +8 也不是 UTC 的時區，本地綠燈才不會在 UTC CI 上變成另一種結果。
process.env.TZ = "America/Los_Angeles";

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
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
  REAL_D1_SETUP_TIMEOUT_MS,
  type TestDatabase,
} from "../testing/create-test-database";
import { LeaveService } from "./LeaveService";

const restaurantId = "leave-race-restaurant";
const year = new Date().getFullYear();

describe("LeaveService balance concurrency", () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
  }, REAL_D1_SETUP_TIMEOUT_MS);

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
    // 日期必須在未來，否則會被「已開始的核准假不得取消」規則擋下來，
    // 這個案例要測的是併發退還的累加，不是取消窗口。
    const firstRequestId = await seedLeaveRequest(testDb, {
      employeeId,
      leaveTypeId,
      totalDays: 2,
      status: "approved",
      startDate: "2099-06-10",
      endDate: "2099-06-11",
    });
    const secondRequestId = await seedLeaveRequest(testDb, {
      employeeId,
      leaveTypeId,
      totalDays: 2,
      status: "approved",
      startDate: "2099-06-12",
      endDate: "2099-06-13",
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

describe("LeaveService approved-leave cancellation window", () => {
  let testDb: TestDatabase;

  // 凍結在 2026-09-04T17:30:00Z。此刻 UTC 日期是 09-04，釘住的 UTC-7 本地日期
  // 也是 09-04，但營業日（UTC+8）已經跨到 09-05。任何改用本地或 UTC 日期實作
  // 的比較，都會在下面的邊界案例上轉紅。
  const frozenNow = new Date("2026-09-04T17:30:00.000Z");
  const businessToday = "2026-09-05";
  const businessTomorrow = "2026-09-06";
  const alreadyPast = "2026-08-20";

  beforeAll(async () => {
    testDb = await createTestDatabase();
  }, REAL_D1_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await testDb?.dispose();
  });

  beforeEach(async () => {
    await testDb.truncateAll();
    // 只假造 Date，setTimeout 等仍走真實計時器，避免卡住 D1 的非同步work。
    vi.useFakeTimers({ toFake: ["Date"], shouldAdvanceTime: true });
    vi.setSystemTime(frozenNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refuses to cancel approved leave that has already been taken", async () => {
    const service = new LeaveService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });
    const { employeeId, leaveTypeId, balanceId } = await seedLeaveFixtures(
      testDb,
      { pendingDays: 0, usedDays: 2 },
    );
    const requestId = await seedLeaveRequest(testDb, {
      employeeId,
      leaveTypeId,
      totalDays: 2,
      status: "approved",
      startDate: alreadyPast,
      endDate: "2026-08-21",
    });

    await expect(
      service.cancelLeaveRequest(requestId, employeeId, "refund me"),
    ).rejects.toThrow(/cannot be cancelled once it has started/);

    // 額度沒有被退還，申請也維持 approved
    const [balance] = await testDb.drizzle
      .select()
      .from(employeeLeaveBalances)
      .where(eq(employeeLeaveBalances.id, balanceId));
    expect(balance.usedDays).toBe(2);

    const [request] = await testDb.drizzle
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.id, requestId));
    expect(request.status).toBe("approved");
  });

  it("refuses on the leave's own start date (business-day boundary)", async () => {
    const service = new LeaveService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });
    const { employeeId, leaveTypeId, balanceId } = await seedLeaveFixtures(
      testDb,
      { pendingDays: 0, usedDays: 2 },
    );
    const requestId = await seedLeaveRequest(testDb, {
      employeeId,
      leaveTypeId,
      totalDays: 2,
      status: "approved",
      startDate: businessToday,
      endDate: businessTomorrow,
    });

    await expect(
      service.cancelLeaveRequest(requestId, employeeId, "refund me"),
    ).rejects.toThrow(/cannot be cancelled once it has started/);

    const [balance] = await testDb.drizzle
      .select()
      .from(employeeLeaveBalances)
      .where(eq(employeeLeaveBalances.id, balanceId));
    expect(balance.usedDays).toBe(2);
  });

  it("still refunds approved leave that has not started yet", async () => {
    const service = new LeaveService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });
    const { employeeId, leaveTypeId, balanceId } = await seedLeaveFixtures(
      testDb,
      { pendingDays: 0, usedDays: 2 },
    );
    const requestId = await seedLeaveRequest(testDb, {
      employeeId,
      leaveTypeId,
      totalDays: 2,
      status: "approved",
      startDate: businessTomorrow,
      endDate: "2026-09-07",
    });

    await expect(
      service.cancelLeaveRequest(requestId, employeeId, "plans changed"),
    ).resolves.toMatchObject({ id: requestId, status: "cancelled" });

    const [balance] = await testDb.drizzle
      .select()
      .from(employeeLeaveBalances)
      .where(eq(employeeLeaveBalances.id, balanceId));
    expect(balance.usedDays).toBe(0);
  });

  it("still cancels a pending request whose dates are already past", async () => {
    const service = new LeaveService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });
    const { employeeId, leaveTypeId, balanceId } = await seedLeaveFixtures(
      testDb,
      { pendingDays: 2, usedDays: 0 },
    );
    const requestId = await seedLeaveRequest(testDb, {
      employeeId,
      leaveTypeId,
      totalDays: 2,
      status: "pending",
      startDate: alreadyPast,
      endDate: "2026-08-21",
    });

    await expect(
      service.cancelLeaveRequest(requestId, employeeId, "withdrawn"),
    ).resolves.toMatchObject({ id: requestId, status: "cancelled" });

    // pending 從來沒扣過 usedDays，只釋放 pendingDays
    const [balance] = await testDb.drizzle
      .select()
      .from(employeeLeaveBalances)
      .where(eq(employeeLeaveBalances.id, balanceId));
    expect(balance.pendingDays).toBe(0);
    expect(balance.usedDays).toBe(0);
  });
});

describe("LeaveService tenant scoping", () => {
  let testDb: TestDatabase;
  const otherRestaurantId = "leave-scope-other";

  beforeAll(async () => {
    testDb = await createTestDatabase();
  }, REAL_D1_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await testDb?.dispose();
  });

  beforeEach(async () => {
    await testDb.truncateAll();
  });

  async function seedOtherRestaurant() {
    const now = new Date("2026-06-07T12:00:00.000Z");
    await testDb.drizzle.insert(restaurants).values({
      id: otherRestaurantId,
      name: "Other Restaurant",
      type: "restaurant",
      category: "casual",
      address: "2 Leave St",
      district: "Central",
      city: "Taipei",
      phone: "0200000001",
      settings: {},
      isAvailable: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    } as never);
  }

  it("scopes leave type reads to the tenant plus system-wide types", async () => {
    const service = new LeaveService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });
    const { leaveTypeId } = await seedLeaveFixtures(testDb, {
      pendingDays: 0,
      usedDays: 0,
    });
    await seedOtherRestaurant();

    // Own tenant sees the type; another tenant reads it as missing
    await expect(
      service.getLeaveType(leaveTypeId, restaurantId),
    ).resolves.toMatchObject({ id: leaveTypeId });
    await expect(
      service.getLeaveType(leaveTypeId, otherRestaurantId),
    ).resolves.toBeNull();

    // System-wide types (restaurantId NULL) stay visible under any scope
    const now = new Date("2026-06-07T12:00:00.000Z");
    const [systemType] = await testDb.drizzle
      .insert(leaveTypes)
      .values({
        restaurantId: null,
        code: "SYS",
        name: "System Leave",
        accrualType: "none",
        accrualAmount: 0,
        isSystemDefined: true,
        createdAt: now,
        updatedAt: now,
      } as never)
      .returning({ id: leaveTypes.id });
    await expect(
      service.getLeaveType(systemType.id, otherRestaurantId),
    ).resolves.toMatchObject({ id: systemType.id });
  });

  it("blocks cross-tenant leave type mutation and re-tenanting", async () => {
    const service = new LeaveService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });
    const { leaveTypeId } = await seedLeaveFixtures(testDb, {
      pendingDays: 0,
      usedDays: 0,
    });
    await seedOtherRestaurant();

    await expect(
      service.updateLeaveType(
        leaveTypeId,
        { name: "Hijacked" },
        otherRestaurantId,
      ),
    ).rejects.toThrow("Leave type not found");

    await expect(
      service.deleteLeaveType(leaveTypeId, otherRestaurantId),
    ).resolves.toBe(false);

    const [untouched] = await testDb.drizzle
      .select()
      .from(leaveTypes)
      .where(eq(leaveTypes.id, leaveTypeId));
    expect(untouched.name).toBe("Annual Leave");
    expect(untouched.isActive).toBe(true);

    // restaurantId in the update payload is discarded — rows can't move tenant
    const updated = await service.updateLeaveType(
      leaveTypeId,
      { name: "Renamed", restaurantId: otherRestaurantId },
      restaurantId,
    );
    expect(updated.name).toBe("Renamed");
    expect(updated.restaurantId).toBe(restaurantId);
  });

  it("rejects balance adjustments using another restaurant's leave type", async () => {
    const service = new LeaveService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });
    const { employeeId, approverId } = await seedLeaveFixtures(testDb, {
      pendingDays: 0,
      usedDays: 0,
    });
    await seedOtherRestaurant();

    const [foreignLeaveType] = await testDb.drizzle
      .insert(leaveTypes)
      .values({
        restaurantId: otherRestaurantId,
        code: "OTHER",
        name: "Other Restaurant Leave",
        accrualType: "none",
        accrualAmount: 0,
        createdAt: new Date("2026-06-07T12:00:00.000Z"),
        updatedAt: new Date("2026-06-07T12:00:00.000Z"),
      } as never)
      .returning({ id: leaveTypes.id });

    await expect(
      service.adjustLeaveBalance({
        employeeId,
        leaveTypeId: foreignLeaveType.id,
        year,
        adjustment: 1,
        reason: "cross-tenant attempt",
        adjustedBy: approverId,
        restaurantId,
      }),
    ).rejects.toThrow("Leave type not found");

    const balances = await testDb.drizzle
      .select()
      .from(employeeLeaveBalances)
      .where(eq(employeeLeaveBalances.leaveTypeId, foreignLeaveType.id));
    expect(balances).toHaveLength(0);
  });

  it("rejects leave requests filed for another restaurant's employee", async () => {
    const service = new LeaveService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });
    const { leaveTypeId } = await seedLeaveFixtures(testDb, {
      pendingDays: 0,
      usedDays: 0,
    });
    await seedOtherRestaurant();

    const now = new Date("2026-06-07T12:00:00.000Z");
    const [outsider] = await testDb.drizzle
      .insert(users)
      .values({
        username: "outside-employee",
        fullName: "Outside Employee",
        passwordHash: "hash",
        role: 3,
        restaurantId: otherRestaurantId,
        isActive: true,
        isVerified: true,
        createdAt: now,
        updatedAt: now,
      } as never)
      .returning({ id: users.id });

    await expect(
      service.createLeaveRequest({
        restaurantId,
        employeeId: outsider.id,
        leaveTypeId,
        startDate: "2026-06-10",
        endDate: "2026-06-11",
        startPeriod: "full",
        endPeriod: "full",
        totalDays: 2,
        reason: "impersonation attempt",
      }),
    ).rejects.toThrow("Employee not found in restaurant");

    const requests = await testDb.drizzle.select().from(leaveRequests);
    expect(requests).toHaveLength(0);
  });

  it("scopes leave request reads and approvals to the tenant", async () => {
    const service = new LeaveService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });
    const { employeeId, approverId, leaveTypeId } = await seedLeaveFixtures(
      testDb,
      {
        pendingDays: 2,
        usedDays: 0,
      },
    );
    await seedOtherRestaurant();
    const requestId = await seedLeaveRequest(testDb, {
      employeeId,
      leaveTypeId,
      totalDays: 2,
    });

    await expect(
      service.getLeaveRequest(requestId, otherRestaurantId),
    ).resolves.toBeNull();
    await expect(
      service.getLeaveRequest(requestId, restaurantId),
    ).resolves.toMatchObject({ id: requestId });

    const foreignList = await service.getLeaveRequests({
      restaurantId: otherRestaurantId,
    });
    expect(foreignList.total).toBe(0);
    const ownList = await service.getLeaveRequests({ restaurantId });
    expect(ownList.total).toBe(1);

    await expect(
      service.approveLeaveRequest(
        requestId,
        approverId,
        undefined,
        otherRestaurantId,
      ),
    ).rejects.toThrow("Leave request not found");

    const [row] = await testDb.drizzle
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.id, requestId));
    expect(row.status).toBe("pending");
  });

  it("rejects approval and rejection from unauthorized approver ids", async () => {
    const service = new LeaveService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });
    const { employeeId, leaveTypeId } = await seedLeaveFixtures(testDb, {
      pendingDays: 2,
      usedDays: 0,
    });
    const requestId = await seedLeaveRequest(testDb, {
      employeeId,
      leaveTypeId,
      totalDays: 2,
    });

    await expect(
      service.approveLeaveRequest(requestId, employeeId, "spoof", restaurantId),
    ).rejects.toThrow(/Approver is not authorized/);
    await expect(
      service.rejectLeaveRequest(requestId, employeeId, "spoof", restaurantId),
    ).rejects.toThrow(/Approver is not authorized/);

    const [row] = await testDb.drizzle
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.id, requestId));
    expect(row.status).toBe("pending");
    expect(row.finalApproverId).toBeNull();
    expect(row.rejectedBy).toBeNull();
  });

  it("allows owners to approve and reject their own leave requests", async () => {
    const service = new LeaveService(testDb.bindings.DB, {
      JWT_SECRET: "test",
    });
    const { approverId, leaveTypeId } = await seedLeaveFixtures(testDb, {
      pendingDays: 0,
      usedDays: 0,
    });
    const approvalRequestId = await seedLeaveRequest(testDb, {
      employeeId: approverId,
      leaveTypeId,
      totalDays: 1,
    });
    const rejectionRequestId = await seedLeaveRequest(testDb, {
      employeeId: approverId,
      leaveTypeId,
      totalDays: 1,
    });

    const approved = await service.approveLeaveRequest(
      approvalRequestId,
      approverId,
      "self-approved",
      restaurantId,
    );
    const rejected = await service.rejectLeaveRequest(
      rejectionRequestId,
      approverId,
      "self-rejected",
      restaurantId,
    );

    expect(approved.status).toBe("approved");
    expect(approved.finalApproverId).toBe(approverId);
    expect(rejected.status).toBe("rejected");
    expect(rejected.rejectedBy).toBe(approverId);
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
    // 已核准的假只有在尚未開始時才能取消，所以取消相關的測試必須自己指定日期。
    startDate?: string;
    endDate?: string;
  },
) {
  const now = new Date("2026-06-07T12:00:00.000Z");
  const [request] = await testDb.drizzle
    .insert(leaveRequests)
    .values({
      restaurantId,
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      startDate: input.startDate ?? "2026-06-10",
      endDate: input.endDate ?? "2026-06-11",
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

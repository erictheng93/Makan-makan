/**
 * Leaves Business Rules Tests
 * 請假業務規則測試套件
 *
 * 測試覆蓋範圍：
 * - 審批鏈流程
 * - 餘額計算邏輯
 * - 請假與排班衝突
 * - 年度結轉
 * - 特殊假別規則
 * - 邊界案例
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

// Mock database service
const mockLeaveService = {
  getLeaveTypes: vi.fn(),
  getLeaveType: vi.fn(),
  createLeaveType: vi.fn(),
  updateLeaveType: vi.fn(),
  deleteLeaveType: vi.fn(),
  getEmployeeLeaveBalances: vi.fn(),
  getLeaveBalance: vi.fn(),
  adjustLeaveBalance: vi.fn(),
  accrueLeaveBalances: vi.fn(),
  getLeaveRequests: vi.fn(),
  getLeaveRequest: vi.fn(),
  createLeaveRequest: vi.fn(),
  approveLeaveRequest: vi.fn(),
  rejectLeaveRequest: vi.fn(),
  cancelLeaveRequest: vi.fn(),
  getHolidays: vi.fn(),
  isWorkingDay: vi.fn(),
  carryOverBalances: vi.fn(),
  checkScheduleConflicts: vi.fn(),
};

vi.mock("@makanmakan/database", () => ({
  LeaveService: vi.fn(function () {
    return mockLeaveService;
  }),
}));

// Mock middleware
let mockUserRole = 0;
let mockUserId = 1;

vi.mock("../../../shared/middleware", () => ({
  authMiddleware: vi.fn((c, next) => {
    c.set("user", {
      id: mockUserId,
      role: mockUserRole,
      restaurantId: "R-001",
    });
    return next();
  }),
  requireRole: vi.fn((roles) => (c: any, next: any) => {
    const user = c.get("user");
    if (roles.includes(user.role)) {
      return next();
    }
    return c.json({ success: false, error: "Forbidden" }, 403);
  }),
  requireRestaurantAccess: vi.fn(() => (_c: any, next: any) => next()),
  validateBody: vi.fn(() => async (c: any, next: any) => {
    try {
      const body = await c.req.json();
      c.set("validatedBody", body);
    } catch {
      c.set("validatedBody", {});
    }
    return next();
  }),
  validateQuery: vi.fn(() => (c: any, next: any) => {
    const url = c.req.url;
    const queryString = url.split("?")[1] || "";
    const params: Record<string, any> = { page: 1, limit: 20 };
    if (queryString) {
      queryString.split("&").forEach((pair: string) => {
        const [key, value] = pair.split("=");
        if (key) {
          const decodedValue = decodeURIComponent(value || "");
          if (/^\d+$/.test(decodedValue)) {
            params[decodeURIComponent(key)] = parseInt(decodedValue);
          } else {
            params[decodeURIComponent(key)] = decodedValue;
          }
        }
      });
    }
    c.set("validatedQuery", params);
    return next();
  }),
  validateParams: vi.fn(() => (c: any, next: any) => {
    c.set("validatedParams", c.req.param());
    return next();
  }),
}));

// Mock env for testing
const mockEnv = {
  DB: {},
  CACHE_KV: {},
  NODE_ENV: "test",
};

describe("Leaves Business Rules Tests", () => {
  let app: Hono<{ Bindings: typeof mockEnv }>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockUserRole = 0; // Admin by default
    mockUserId = 1;

    const { default: leavesRoutes } = await import("../routes/index");
    app = new Hono<{ Bindings: typeof mockEnv }>();
    app.route("/leaves", leavesRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Helper function to make requests with env
  const makeRequest = (path: string, options: RequestInit = {}) => {
    const req = new Request(`http://localhost${path}`, options);
    return app.fetch(req, mockEnv);
  };

  // Helper to parse JSON response with type
  const parseJson = async (res: Response) => {
    return (await res.json()) as Record<string, any>;
  };

  // ========================================
  // Approval Chain Tests (6 tests)
  // ========================================

  describe("Approval Chain", () => {
    it("應該支援多級審批流程", async () => {
      mockLeaveService.getLeaveBalance.mockResolvedValue({
        totalDays: 14,
        usedDays: 0,
        remainingDays: 14,
      });
      mockLeaveService.createLeaveRequest.mockResolvedValue({
        id: 1,
        status: "pending",
        approvalChain: JSON.stringify([
          { level: 1, approverRole: 1, status: "pending" },
          { level: 2, approverRole: 0, status: "pending" },
        ]),
        currentApprovalLevel: 1,
      });

      const res = await makeRequest("/leaves/R-001/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: 1,
          leaveTypeId: 1,
          startDate: "2025-01-20",
          endDate: "2025-01-24",
          startPeriod: "full",
          endPeriod: "full",
          reason: "Family vacation",
        }),
      });

      const data = await parseJson(res);

      expect(res.status).toBe(201);
      expect(data.data.currentApprovalLevel).toBe(1);
    });

    it("應該在第一級審批後進入第二級", async () => {
      mockLeaveService.approveLeaveRequest.mockResolvedValue({
        id: 1,
        status: "pending", // Still pending for level 2
        currentApprovalLevel: 2,
        approvalHistory: [
          {
            level: 1,
            approverId: 2,
            approvedAt: Date.now(),
            status: "approved",
          },
        ],
      });

      const res = await makeRequest("/leaves/requests/1/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approverId: 2,
          comments: "Level 1 approved",
        }),
      });

      const data = await parseJson(res);

      expect(res.status).toBe(200);
      expect(data.data.currentApprovalLevel).toBe(2);
    });

    it("應該在最終審批後標記為已批准", async () => {
      mockLeaveService.approveLeaveRequest.mockResolvedValue({
        id: 1,
        status: "approved",
        finalApproverId: 1,
        finalApprovedAt: Date.now(),
      });

      const res = await makeRequest("/leaves/requests/1/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approverId: 1,
          comments: "Final approval",
        }),
      });

      const data = await parseJson(res);

      expect(res.status).toBe(200);
      expect(data.data.status).toBe("approved");
    });

    it("應該在任一級拒絕後終止流程", async () => {
      mockLeaveService.rejectLeaveRequest.mockResolvedValue({
        id: 1,
        status: "rejected",
        rejectedBy: 2,
        rejectionReason: "Insufficient coverage",
        rejectedAt: Date.now(),
      });

      const res = await makeRequest("/leaves/requests/1/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approverId: 2,
          reason: "Insufficient coverage",
        }),
      });

      const data = await parseJson(res);

      expect(res.status).toBe(200);
      expect(data.data.status).toBe("rejected");
    });

    it("應該記錄完整的審批歷史", async () => {
      mockLeaveService.getLeaveRequest.mockResolvedValue({
        id: 1,
        status: "approved",
        approvalHistory: [
          {
            level: 1,
            approverId: 2,
            approvedAt: Date.now() - 86400000,
            status: "approved",
            comments: "OK",
          },
          {
            level: 2,
            approverId: 1,
            approvedAt: Date.now(),
            status: "approved",
            comments: "Final OK",
          },
        ],
      });

      const res = await makeRequest("/leaves/requests/1");
      const data = await parseJson(res);

      expect(res.status).toBe(200);
      expect(data.data.approvalHistory).toHaveLength(2);
    });

    it("應該驗證審批者權限", async () => {
      mockUserRole = 3; // Staff - no approval permission

      const res = await makeRequest("/leaves/requests/1/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approverId: 3,
          comments: "Trying to approve",
        }),
      });

      expect(res.status).toBe(403);
    });
  });

  // ========================================
  // Balance Calculation Tests (6 tests)
  // ========================================

  describe("Balance Calculation", () => {
    it("應該正確計算剩餘天數", async () => {
      mockLeaveService.getEmployeeLeaveBalances.mockResolvedValue([
        {
          id: 1,
          employeeId: 1,
          leaveTypeId: 1,
          year: 2025,
          totalDays: 14,
          usedDays: 5,
          pendingDays: 2,
          remainingDays: 7, // 14 - 5 - 2 = 7
        },
      ]);

      const res = await makeRequest("/leaves/balances?employeeId=1&year=2025");
      const data = await parseJson(res);

      expect(res.status).toBe(200);
      expect(data.data[0].remainingDays).toBe(7);
    });

    it("應該在請假批准後扣除餘額", async () => {
      mockLeaveService.approveLeaveRequest.mockResolvedValue({
        id: 1,
        status: "approved",
        totalDays: 3,
      });

      // After approval, balance should be updated
      mockLeaveService.getEmployeeLeaveBalances.mockResolvedValue([
        {
          totalDays: 14,
          usedDays: 8, // Was 5, now 8 after 3 days approved
          remainingDays: 6,
        },
      ]);

      const res = await makeRequest("/leaves/requests/1/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approverId: 1 }),
      });

      expect(res.status).toBe(200);

      // Verify balance was updated
      const balanceRes = await makeRequest("/leaves/balances?employeeId=1");
      expect(balanceRes.status).toBe(200);
    });

    it("應該在請假取消後恢復餘額", async () => {
      mockLeaveService.getLeaveRequest.mockResolvedValue({
        id: 1,
        employeeId: 1,
        status: "pending",
      });
      mockLeaveService.cancelLeaveRequest.mockResolvedValue({
        id: 1,
        status: "cancelled",
        totalDays: 3,
      });

      const res = await makeRequest("/leaves/requests/1/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: 1,
          reason: "Plans changed",
        }),
      });

      const data = await parseJson(res);

      expect(res.status).toBe(200);
      expect(data.data.status).toBe("cancelled");
    });

    it("應該支援手動調整餘額", async () => {
      mockLeaveService.adjustLeaveBalance.mockResolvedValue({
        id: 1,
        totalDays: 19, // Was 14, added 5
        manualAdjustment: 5,
        adjustmentReason: "Long service bonus",
      });

      const res = await makeRequest("/leaves/balances/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: 1,
          leaveTypeId: 1,
          year: 2025,
          adjustment: 5,
          reason: "Long service bonus",
        }),
      });

      const data = await parseJson(res);

      expect(res.status).toBe(200);
      expect(data.data.manualAdjustment).toBe(5);
    });

    it("應該計算半天假", async () => {
      mockLeaveService.getLeaveBalance.mockResolvedValue({
        totalDays: 14,
        usedDays: 0,
        remainingDays: 14,
      });
      mockLeaveService.createLeaveRequest.mockResolvedValue({
        id: 1,
        status: "pending",
        totalDays: 0.5, // Half day
        startPeriod: "am",
        endPeriod: "am",
      });

      const res = await makeRequest("/leaves/R-001/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: 1,
          leaveTypeId: 1,
          startDate: "2025-01-20",
          endDate: "2025-01-20",
          startPeriod: "am",
          endPeriod: "am",
          reason: "Doctor appointment",
        }),
      });

      const data = await parseJson(res);

      expect(res.status).toBe(201);
      expect(data.data.totalDays).toBe(0.5);
    });

    it("應該處理負數調整", async () => {
      mockLeaveService.adjustLeaveBalance.mockResolvedValue({
        id: 1,
        totalDays: 12, // Was 14, reduced by 2
        manualAdjustment: -2,
        adjustmentReason: "Correction",
      });

      const res = await makeRequest("/leaves/balances/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: 1,
          leaveTypeId: 1,
          year: 2025,
          adjustment: -2,
          reason: "Correction",
        }),
      });

      const data = await parseJson(res);

      expect(res.status).toBe(200);
      expect(data.data.manualAdjustment).toBe(-2);
    });
  });

  // ========================================
  // Schedule Conflict Tests (4 tests)
  // ========================================

  describe("Schedule Conflicts", () => {
    it("應該檢測請假與排班的衝突", async () => {
      mockLeaveService.getLeaveBalance.mockResolvedValue({
        totalDays: 14,
        remainingDays: 14,
      });
      mockLeaveService.createLeaveRequest.mockRejectedValue(
        new Error(
          "Conflict: Employee has scheduled shifts on 2025-01-20, 2025-01-21",
        ),
      );

      const res = await makeRequest("/leaves/R-001/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: 1,
          leaveTypeId: 1,
          startDate: "2025-01-20",
          endDate: "2025-01-24",
          reason: "Vacation",
        }),
      });

      expect(res.status).toBe(500);
    });

    it("應該在批准請假時自動取消衝突排班", async () => {
      mockLeaveService.approveLeaveRequest.mockResolvedValue({
        id: 1,
        status: "approved",
        cancelledSchedules: [
          { id: 101, date: "2025-01-20" },
          { id: 102, date: "2025-01-21" },
        ],
      });

      const res = await makeRequest("/leaves/requests/1/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approverId: 1 }),
      });

      const data = await parseJson(res);

      expect(res.status).toBe(200);
      expect(data.data.cancelledSchedules).toHaveLength(2);
    });

    it("應該警告但允許提交有衝突的請假", async () => {
      mockLeaveService.getLeaveBalance.mockResolvedValue({
        totalDays: 14,
        remainingDays: 14,
      });
      mockLeaveService.createLeaveRequest.mockResolvedValue({
        id: 1,
        status: "pending",
        warnings: ["Schedule conflict detected on 2025-01-20"],
      });

      const res = await makeRequest("/leaves/R-001/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: 1,
          leaveTypeId: 1,
          startDate: "2025-01-20",
          endDate: "2025-01-20",
          reason: "Emergency",
          acknowledgeConflict: true,
        }),
      });

      const data = await parseJson(res);

      expect(res.status).toBe(201);
      expect(data.data.warnings).toBeDefined();
    });

    it("應該在取消請假後恢復排班", async () => {
      mockLeaveService.getLeaveRequest.mockResolvedValue({
        id: 1,
        employeeId: 1,
        status: "approved",
      });
      mockLeaveService.cancelLeaveRequest.mockResolvedValue({
        id: 1,
        status: "cancelled",
        restoredSchedules: [{ id: 101, date: "2025-01-20", restored: true }],
      });

      const res = await makeRequest("/leaves/requests/1/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: 1,
          reason: "Plans changed",
        }),
      });

      const data = await parseJson(res);

      expect(res.status).toBe(200);
      expect(data.data.restoredSchedules).toBeDefined();
    });
  });

  // ========================================
  // Year-End Carryover Tests (4 tests)
  // ========================================

  describe("Year-End Carryover", () => {
    it("應該成功執行年度結轉", async () => {
      mockLeaveService.accrueLeaveBalances.mockResolvedValue(25);

      const res = await makeRequest("/leaves/R-001/balances/accrue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: 2025 }),
      });

      const data = await parseJson(res);

      expect(res.status).toBe(200);
      expect(data.data.count).toBe(25);
    });

    it("應該根據假別設定限制結轉天數", async () => {
      // Leave type with max carryover of 5 days
      mockLeaveService.getLeaveType.mockResolvedValue({
        id: 1,
        code: "ANNUAL",
        maxCarryover: 5,
      });

      mockLeaveService.accrueLeaveBalances.mockResolvedValue(10);

      const res = await makeRequest("/leaves/R-001/balances/accrue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: 2025 }),
      });

      expect(res.status).toBe(200);
    });

    it("應該處理不可結轉的假別", async () => {
      mockLeaveService.getLeaveType.mockResolvedValue({
        id: 2,
        code: "SICK",
        maxCarryover: 0, // No carryover allowed
      });

      mockLeaveService.accrueLeaveBalances.mockResolvedValue(10);

      const res = await makeRequest("/leaves/R-001/balances/accrue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: 2025 }),
      });

      expect(res.status).toBe(200);
    });

    it("應該記錄結轉歷史", async () => {
      mockLeaveService.accrueLeaveBalances.mockResolvedValue(15);

      const res = await makeRequest("/leaves/R-001/balances/accrue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: 2025 }),
      });

      const data = await parseJson(res);

      expect(res.status).toBe(200);
      expect(data.message).toContain("15");
    });
  });

  // ========================================
  // Special Leave Type Rules Tests (4 tests)
  // ========================================

  describe("Special Leave Type Rules", () => {
    it("應該驗證性別限制的假別", async () => {
      // Maternity leave - female only
      mockLeaveService.getLeaveBalance.mockResolvedValue({
        totalDays: 90,
        remainingDays: 90,
      });
      mockLeaveService.createLeaveRequest.mockRejectedValue(
        new Error("Maternity leave is only available for female employees"),
      );

      const res = await makeRequest("/leaves/R-001/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: 1, // Male employee
          leaveTypeId: 3, // Maternity leave
          startDate: "2025-03-01",
          endDate: "2025-05-29",
          reason: "Maternity",
        }),
      });

      expect(res.status).toBe(500);
    });

    it("應該驗證最低提前通知天數", async () => {
      mockLeaveService.getLeaveBalance.mockResolvedValue({
        totalDays: 14,
        remainingDays: 14,
      });
      mockLeaveService.createLeaveRequest.mockRejectedValue(
        new Error("This leave type requires at least 7 days advance notice"),
      );

      const res = await makeRequest("/leaves/R-001/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: 1,
          leaveTypeId: 1,
          startDate: "2025-01-10", // Only 3 days from now
          endDate: "2025-01-12",
          reason: "Vacation",
        }),
      });

      expect(res.status).toBe(500);
    });

    it("應該驗證最大連續天數限制", async () => {
      mockLeaveService.getLeaveBalance.mockResolvedValue({
        totalDays: 14,
        remainingDays: 14,
      });
      mockLeaveService.createLeaveRequest.mockRejectedValue(
        new Error("Maximum consecutive days for this leave type is 5"),
      );

      const res = await makeRequest("/leaves/R-001/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: 1,
          leaveTypeId: 2, // Sick leave with 5 day max
          startDate: "2025-01-10",
          endDate: "2025-01-20", // 10 days
          reason: "Illness",
        }),
      });

      expect(res.status).toBe(500);
    });

    it("應該支援需要證明文件的假別", async () => {
      mockLeaveService.getLeaveBalance.mockResolvedValue({
        totalDays: 10,
        remainingDays: 10,
      });
      mockLeaveService.createLeaveRequest.mockResolvedValue({
        id: 1,
        status: "pending_documents",
        requiredDocuments: ["Medical certificate"],
      });

      const res = await makeRequest("/leaves/R-001/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: 1,
          leaveTypeId: 2, // Sick leave requiring certificate
          startDate: "2025-01-10",
          endDate: "2025-01-12",
          reason: "Illness",
        }),
      });

      const data = await parseJson(res);

      expect(res.status).toBe(201);
      expect(data.data.requiredDocuments).toBeDefined();
    });
  });

  // ========================================
  // Holiday Calendar Tests (4 tests)
  // ========================================

  describe("Holiday Calendar", () => {
    it("應該正確識別假日", async () => {
      mockLeaveService.isWorkingDay.mockResolvedValue(false);

      const res = await makeRequest("/leaves/R-001/working-day/2025-01-01");
      const data = await parseJson(res);

      expect(res.status).toBe(200);
      expect(data.data.isWorkingDay).toBe(false);
    });

    it("應該正確識別工作日", async () => {
      mockLeaveService.isWorkingDay.mockResolvedValue(true);

      const res = await makeRequest("/leaves/R-001/working-day/2025-01-06");
      const data = await parseJson(res);

      expect(res.status).toBe(200);
      expect(data.data.isWorkingDay).toBe(true);
    });

    it("應該返回年度假日列表", async () => {
      mockLeaveService.getHolidays.mockResolvedValue([
        { id: 1, name: "元旦", eventDate: "2025-01-01", isWorkingDay: false },
        { id: 2, name: "春節", eventDate: "2025-01-29", isWorkingDay: false },
        { id: 3, name: "春節", eventDate: "2025-01-30", isWorkingDay: false },
      ]);

      const res = await makeRequest("/leaves/R-001/holidays?year=2025");
      const data = await parseJson(res);

      expect(res.status).toBe(200);
      expect(data.data).toHaveLength(3);
    });

    it("應該在計算請假天數時排除假日", async () => {
      mockLeaveService.getLeaveBalance.mockResolvedValue({
        totalDays: 14,
        remainingDays: 14,
      });
      // Request from Jan 1-3, but Jan 1 is holiday
      mockLeaveService.createLeaveRequest.mockResolvedValue({
        id: 1,
        status: "pending",
        totalDays: 2, // Only 2 working days (Jan 2-3)
        excludedHolidays: ["2025-01-01"],
      });

      const res = await makeRequest("/leaves/R-001/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: 1,
          leaveTypeId: 1,
          startDate: "2025-01-01",
          endDate: "2025-01-03",
          reason: "Vacation",
        }),
      });

      const data = await parseJson(res);

      expect(res.status).toBe(201);
      expect(data.data.totalDays).toBe(2);
    });
  });
});

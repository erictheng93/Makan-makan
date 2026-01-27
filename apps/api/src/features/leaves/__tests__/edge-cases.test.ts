/**
 * Leaves Edge Cases & Validation Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono, type Context, type Next } from "hono";

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
};

vi.mock("@makanmakan/database", () => ({
  LeaveService: vi.fn(function () {
    return mockLeaveService;
  }),
}));

let mockUserRole = 0;
let mockUserId = 1;

vi.mock("../../../shared/middleware", () => ({
  authMiddleware: vi.fn((c: Context, next: Next) => {
    c.set("user", {
      id: mockUserId,
      role: mockUserRole,
      restaurantId: '1',
      username: "testuser",
    });
    return next();
  }),
  requireRole: vi.fn((roles: number[]) => (c: Context, next: Next) => {
    const user = c.get("user");
    if (roles.includes(user.role)) {
      return next();
    }
    return c.json({ success: false, error: "Forbidden" }, 403);
  }),
  requireRestaurantAccess: vi.fn(() => (_c: Context, next: Next) => next()),
  validateBody: vi.fn(() => async (c: Context, next: Next) => {
    try {
      const body = await c.req.json();
      c.set("validatedBody", body);
    } catch {
      c.set("validatedBody", {});
    }
    return next();
  }),
  validateQuery: vi.fn(() => (c: Context, next: Next) => {
    c.set("validatedQuery", { page: 1, limit: 20 });
    return next();
  }),
  validateParams: vi.fn(() => (c: Context, next: Next) => {
    c.set("validatedParams", c.req.param());
    return next();
  }),
}));

describe("Leaves Edge Cases Tests", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockUserRole = 0;
    mockUserId = 1;
    const { default: leavesRoutes } = await import("../routes/index");
    app = new Hono();
    app.route("/leaves", leavesRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Schema Validation", () => {
    it("should reject invalid leave type code format", async () => {
      const { createLeaveTypeSchema } = await import("../schemas/validation");
      const result = createLeaveTypeSchema.safeParse({
        code: "invalid-code",
        name: "Test",
        accrualType: "yearly",
        accrualAmount: 10,
      });
      expect(result.success).toBe(false);
    });

    it("should accept valid leave type code format", async () => {
      const { createLeaveTypeSchema } = await import("../schemas/validation");
      const result = createLeaveTypeSchema.safeParse({
        code: "ANNUAL_LEAVE",
        name: "Annual Leave",
        accrualType: "yearly",
        accrualAmount: 14,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("Leave Request Schema Validation", () => {
    it("should reject end date before start date", async () => {
      const { createLeaveRequestSchema } =
        await import("../schemas/validation");
      const result = createLeaveRequestSchema.safeParse({
        restaurantId: '1',
        employeeId: 1,
        leaveTypeId: 1,
        startDate: "2025-01-20",
        endDate: "2025-01-15",
        reason: "Test",
      });
      expect(result.success).toBe(false);
    });

    it("should accept same start and end date", async () => {
      const { createLeaveRequestSchema } =
        await import("../schemas/validation");
      const result = createLeaveRequestSchema.safeParse({
        restaurantId: '1',
        employeeId: 1,
        leaveTypeId: 1,
        startDate: "2025-01-20",
        endDate: "2025-01-20",
        reason: "Single day leave",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid date format", async () => {
      const { createLeaveRequestSchema } =
        await import("../schemas/validation");
      const result = createLeaveRequestSchema.safeParse({
        restaurantId: '1',
        employeeId: 1,
        leaveTypeId: 1,
        startDate: "20-01-2025",
        endDate: "2025-01-20",
        reason: "Test",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty reason", async () => {
      const { createLeaveRequestSchema } =
        await import("../schemas/validation");
      const result = createLeaveRequestSchema.safeParse({
        restaurantId: '1',
        employeeId: 1,
        leaveTypeId: 1,
        startDate: "2025-01-20",
        endDate: "2025-01-20",
        reason: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("Balance Adjustment Schema Validation", () => {
    it("should reject adjustment exceeding range", async () => {
      const { adjustLeaveBalanceSchema } =
        await import("../schemas/validation");
      const result = adjustLeaveBalanceSchema.safeParse({
        employeeId: 1,
        leaveTypeId: 1,
        year: 2025,
        adjustment: 400,
        reason: "Test",
        adjustedBy: 1,
      });
      expect(result.success).toBe(false);
    });

    it("should accept negative adjustment", async () => {
      const { adjustLeaveBalanceSchema } =
        await import("../schemas/validation");
      const result = adjustLeaveBalanceSchema.safeParse({
        employeeId: 1,
        leaveTypeId: 1,
        year: 2025,
        adjustment: -10,
        reason: "Correction",
        adjustedBy: 1,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("Helper Functions", () => {
    it("should calculate single day leave correctly", async () => {
      const { calculateLeaveDays } = await import("../schemas/validation");
      const days = calculateLeaveDays(
        "2025-01-20",
        "2025-01-20",
        "full",
        "full",
      );
      expect(days).toBe(1);
    });

    it("should calculate multi-day leave correctly", async () => {
      const { calculateLeaveDays } = await import("../schemas/validation");
      const days = calculateLeaveDays(
        "2025-01-20",
        "2025-01-24",
        "full",
        "full",
      );
      expect(days).toBe(5);
    });

    it("should calculate half-day leave correctly", async () => {
      const { calculateLeaveDays } = await import("../schemas/validation");
      const days = calculateLeaveDays("2025-01-20", "2025-01-21", "pm", "full");
      expect(days).toBe(1.5);
    });

    it("should handle cross-year leave", async () => {
      const { calculateLeaveDays } = await import("../schemas/validation");
      const days = calculateLeaveDays(
        "2024-12-30",
        "2025-01-02",
        "full",
        "full",
      );
      expect(days).toBe(4);
    });

    it("should handle leap year correctly", async () => {
      const { calculateLeaveDays } = await import("../schemas/validation");
      const days = calculateLeaveDays(
        "2024-02-28",
        "2024-03-01",
        "full",
        "full",
      );
      expect(days).toBe(3);
    });

    it("should throw error for invalid date range", async () => {
      const { validateLeaveRequestDates } =
        await import("../schemas/validation");
      expect(() => {
        validateLeaveRequestDates("2025-01-20", "2025-01-15", 0);
      }).toThrow("End date must be equal to or after start date");
    });

    it("should throw error for insufficient balance", async () => {
      const { validateLeaveBalance } = await import("../schemas/validation");
      expect(() => {
        validateLeaveBalance(10, 5);
      }).toThrow("Insufficient leave balance");
    });

    it("should throw error for exceeding consecutive days", async () => {
      const { validateConsecutiveDays } = await import("../schemas/validation");
      expect(() => {
        validateConsecutiveDays(10, 5);
      }).toThrow("Cannot request more than 5 consecutive days");
    });
  });

  describe("API Edge Cases", () => {
    it("should handle special characters in reason", async () => {
      mockLeaveService.getLeaveBalance.mockResolvedValue({
        totalDays: 14,
        remainingDays: 14,
      });
      mockLeaveService.createLeaveRequest.mockResolvedValue({
        id: 1,
        status: "pending",
      });

      const req = new Request("http://localhost/leaves/R-001/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: 1,
          leaveTypeId: 1,
          startDate: "2025-01-20",
          endDate: "2025-01-20",
          reason: 'Family reason <script>alert("xss")</script>',
        }),
      });

      const res = await app.fetch(req, { DB: {} });
      expect([200, 201]).toContain(res.status);
    });

    it("should handle non-existent employee ID", async () => {
      mockLeaveService.getEmployeeLeaveBalances.mockResolvedValue([]);

      const req = new Request(
        "http://localhost/leaves/balances?employeeId=99999&year=2025",
      );
      const res = await app.fetch(req, { DB: {} });

      expect(res.status).toBe(200);
      const data = (await res.json()) as { data: unknown[] };
      expect(data.data).toHaveLength(0);
    });

    it("should handle zero balance", async () => {
      mockLeaveService.getLeaveBalance.mockResolvedValue({
        totalDays: 14,
        usedDays: 14,
        remainingDays: 0,
      });

      const req = new Request("http://localhost/leaves/R-001/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: 1,
          leaveTypeId: 1,
          startDate: "2025-01-20",
          endDate: "2025-01-20",
          reason: "No balance left",
        }),
      });

      const res = await app.fetch(req, { DB: {} });
      expect(res.status).toBe(400);
    });

    it("should handle database errors", async () => {
      mockLeaveService.getLeaveTypes.mockRejectedValue(
        new Error("Database error"),
      );

      const req = new Request("http://localhost/leaves/R-001/types");
      const res = await app.fetch(req, { DB: {} });

      expect(res.status).toBe(500);
      const data = (await res.json()) as { success: boolean };
      expect(data.success).toBe(false);
    });

    it("should handle concurrent requests", async () => {
      mockLeaveService.getLeaveBalance.mockResolvedValue({
        totalDays: 14,
        remainingDays: 14,
      });

      let requestCount = 0;
      mockLeaveService.createLeaveRequest.mockImplementation(() => {
        requestCount++;
        return Promise.resolve({ id: requestCount, status: "pending" });
      });

      const requests = Array(3)
        .fill(null)
        .map((_, i) =>
          app.fetch(
            new Request("http://localhost/leaves/R-001/requests", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                employeeId: 1,
                leaveTypeId: 1,
                startDate: `2025-0${i + 1}-20`,
                endDate: `2025-0${i + 1}-20`,
                reason: `Request ${i + 1}`,
              }),
            }),
            { DB: {} },
          ),
        );

      const responses = await Promise.all(requests);
      const successCount = responses.filter((r) => r.status === 201).length;
      expect(successCount).toBeGreaterThan(0);
    });
  });
});

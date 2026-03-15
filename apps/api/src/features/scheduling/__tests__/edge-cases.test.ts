/**
 * Scheduling Edge Cases Tests
 * 排班功能邊界案例測試
 *
 * 測試覆蓋範圍：
 * - 時間衝突檢測
 * - 重複排班防護
 * - 權限控制
 * - 批量操作
 * - 統計端點
 * - 業務規則驗證
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { ApiError } from "../../../shared/utils/api-error";

// Mock database service
const mockSchedulingService = {
  getShiftTemplates: vi.fn(),
  getShiftTemplate: vi.fn(),
  createShiftTemplate: vi.fn(),
  updateShiftTemplate: vi.fn(),
  deleteShiftTemplate: vi.fn(),
  getSchedules: vi.fn(),
  getSchedule: vi.fn(),
  createSchedule: vi.fn(),
  bulkCreateSchedules: vi.fn(),
  updateSchedule: vi.fn(),
  deleteSchedule: vi.fn(),
  getSwapRequests: vi.fn(),
  createSwapRequest: vi.fn(),
  acceptSwapRequest: vi.fn(),
  approveSwapRequest: vi.fn(),
  rejectSwapRequest: vi.fn(),
  cancelSwapRequest: vi.fn(),
  clockIn: vi.fn(),
  clockOut: vi.fn(),
  getAvailableEmployees: vi.fn(),
  getConflicts: vi.fn(),
  getConflict: vi.fn(),
  resolveConflict: vi.fn(),
  getDailyStats: vi.fn(),
  getWeeklySummary: vi.fn(),
};

vi.mock("@makanmakan/database", () => ({
  SchedulingService: vi.fn(function () {
    return mockSchedulingService;
  }),
}));

// Mock middleware with role control
let mockUserRole = 0;
let mockUserId = "user_123";
let mockRestaurantId = 1;

vi.mock("../../../shared/middleware", () => ({
  authMiddleware: vi.fn((c, next) => {
    c.set("user", {
      id: mockUserId,
      role: mockUserRole,
      restaurantId: mockRestaurantId,
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
  requireRestaurantAccess: vi.fn(() => (c: any, next: any) => next()),
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

describe("Scheduling Edge Cases Tests", () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockUserRole = 0; // Admin by default
    mockUserId = "user_123";
    mockRestaurantId = 1;

    const { default: schedulingRoutes } = await import("../routes/index");
    app = new Hono();
    app.route("/scheduling", schedulingRoutes);
    app.onError((err, c) => {
      if (err instanceof ApiError) {
        return c.json(
          { success: false, error: { code: err.code, message: err.message } },
          err.status as any,
        );
      }
      return c.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        },
        500,
      );
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // Time Conflict Detection Tests (5 tests)
  // ========================================

  describe("Time Conflict Detection", () => {
    it("應該檢測同一員工同一天的重疊班次", async () => {
      mockSchedulingService.createSchedule.mockRejectedValue(
        new Error(
          "Schedule conflict: Employee already has a shift during this time",
        ),
      );

      const req = new Request("http://localhost/scheduling/1/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: "emp_1",
          templateId: 1,
          date: "2024-01-15",
          startTime: "10:00",
          endTime: "14:00", // Overlaps with existing 08:00-16:00
        }),
      });

      const res = await app.fetch(req, { DB: {} });

      expect(res.status).toBe(500);
    });

    it("應該允許不重疊的班次", async () => {
      mockSchedulingService.createSchedule.mockResolvedValue({
        id: 2,
        employeeId: "emp_1",
        date: "2024-01-15",
        startTime: "18:00",
        endTime: "22:00",
        status: "scheduled",
      });

      const req = new Request("http://localhost/scheduling/1/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: "emp_1",
          templateId: 2,
          date: "2024-01-15",
          startTime: "18:00",
          endTime: "22:00",
        }),
      });

      const res = await app.fetch(req, { DB: {} });
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
    });

    it("應該檢測跨日班次的衝突", async () => {
      mockSchedulingService.createSchedule.mockRejectedValue(
        new Error(
          "Schedule conflict: Overnight shift overlaps with next day schedule",
        ),
      );

      const req = new Request("http://localhost/scheduling/1/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: "emp_1",
          date: "2024-01-15",
          startTime: "22:00",
          endTime: "06:00", // Overnight shift
        }),
      });

      const res = await app.fetch(req, { DB: {} });

      expect(res.status).toBe(500);
    });

    it("應該檢測與請假的衝突", async () => {
      mockSchedulingService.createSchedule.mockRejectedValue(
        new Error("Schedule conflict: Employee is on approved leave"),
      );

      const req = new Request("http://localhost/scheduling/1/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: "emp_1",
          date: "2024-01-20", // Employee on leave
          startTime: "08:00",
          endTime: "16:00",
        }),
      });

      const res = await app.fetch(req, { DB: {} });

      expect(res.status).toBe(500);
    });

    it("應該返回衝突詳情", async () => {
      const mockConflicts = {
        items: [
          {
            id: 1,
            type: "overlap",
            employeeId: "emp_1",
            schedule1Id: 1,
            schedule2Id: 2,
            conflictDate: "2024-01-15",
            description: "08:00-16:00 與 10:00-18:00 重疊",
            status: "unresolved",
          },
        ],
        total: 1,
      };

      mockSchedulingService.getConflicts.mockResolvedValue(mockConflicts);

      const req = new Request(
        "http://localhost/scheduling/1/conflicts?page=1&limit=20",
      );
      const res = await app.fetch(req, { DB: {} });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data[0].type).toBe("overlap");
    });
  });

  // ========================================
  // Bulk Operations Tests (4 tests)
  // ========================================

  describe("Bulk Operations", () => {
    it("應該成功批量創建排班", async () => {
      mockSchedulingService.bulkCreateSchedules.mockResolvedValue(5);

      const req = new Request("http://localhost/scheduling/1/schedules/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedules: [
            { employeeId: "emp_1", templateId: 1, date: "2024-01-15" },
            { employeeId: "emp_2", templateId: 1, date: "2024-01-15" },
            { employeeId: "emp_3", templateId: 1, date: "2024-01-15" },
            { employeeId: "emp_1", templateId: 2, date: "2024-01-16" },
            { employeeId: "emp_2", templateId: 2, date: "2024-01-16" },
          ],
        }),
      });

      const res = await app.fetch(req, { DB: {} });
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.count).toBe(5);
    });

    it("應該處理批量創建中的部分失敗", async () => {
      mockSchedulingService.bulkCreateSchedules.mockRejectedValue(
        new Error(
          "Partial failure: 3 of 5 schedules created, 2 conflicts detected",
        ),
      );

      const req = new Request("http://localhost/scheduling/1/schedules/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedules: [
            { employeeId: "emp_1", templateId: 1, date: "2024-01-15" },
            { employeeId: "emp_1", templateId: 1, date: "2024-01-15" }, // Duplicate
          ],
        }),
      });

      const res = await app.fetch(req, { DB: {} });

      expect(res.status).toBe(500);
    });

    it("應該驗證批量操作的數量限制", async () => {
      mockSchedulingService.bulkCreateSchedules.mockRejectedValue(
        new Error(
          "Bulk operation limit exceeded: maximum 100 schedules per request",
        ),
      );

      const schedules = Array(150)
        .fill(null)
        .map((_, i) => ({
          employeeId: `emp_${i}`,
          templateId: 1,
          date: "2024-01-15",
        }));

      const req = new Request("http://localhost/scheduling/1/schedules/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedules }),
      });

      const res = await app.fetch(req, { DB: {} });

      expect(res.status).toBe(500);
    });

    it("應該在批量操作中檢測所有衝突", async () => {
      mockSchedulingService.bulkCreateSchedules.mockRejectedValue(
        new Error(
          "Conflicts detected: emp_1 on 2024-01-15, emp_2 on 2024-01-16",
        ),
      );

      const req = new Request("http://localhost/scheduling/1/schedules/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedules: [
            { employeeId: "emp_1", templateId: 1, date: "2024-01-15" },
            { employeeId: "emp_2", templateId: 1, date: "2024-01-16" },
          ],
        }),
      });

      const res = await app.fetch(req, { DB: {} });

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // Permission Control Tests (5 tests)
  // ========================================

  describe("Permission Control", () => {
    it("應該允許管理員查看所有員工排班", async () => {
      mockUserRole = 0; // Admin
      mockSchedulingService.getSchedules.mockResolvedValue({
        items: [
          { id: 1, employeeId: "emp_1" },
          { id: 2, employeeId: "emp_2" },
        ],
        total: 2,
      });

      const req = new Request(
        "http://localhost/scheduling/1/schedules?page=1&limit=20",
      );
      const res = await app.fetch(req, { DB: {} });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data).toHaveLength(2);
    });

    it("應該限制員工只能查看自己的排班", async () => {
      mockUserRole = 3; // Staff
      mockUserId = "emp_1";
      mockSchedulingService.getSchedules.mockResolvedValue({
        items: [{ id: 1, employeeId: "emp_1" }],
        total: 1,
      });

      const req = new Request(
        "http://localhost/scheduling/1/schedules?page=1&limit=20",
      );
      const res = await app.fetch(req, { DB: {} });
      await res.json();

      expect(res.status).toBe(200);
      // Service should filter by employeeId
      expect(mockSchedulingService.getSchedules).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: "emp_1" }),
      );
    });

    it("應該拒絕員工創建排班", async () => {
      mockUserRole = 3; // Staff

      const req = new Request("http://localhost/scheduling/1/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: "emp_1",
          templateId: 1,
          date: "2024-01-15",
        }),
      });

      const res = await app.fetch(req, { DB: {} });

      expect(res.status).toBe(403);
    });

    it("應該允許員工為自己打卡", async () => {
      mockUserRole = 3; // Staff
      mockUserId = "emp_1";
      mockSchedulingService.clockIn.mockResolvedValue({
        id: 1,
        employeeId: "emp_1",
        clockInTime: new Date().toISOString(),
      });

      const req = new Request(
        "http://localhost/scheduling/schedules/1/clock-in",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId: "emp_1" }),
        },
      );

      const res = await app.fetch(req, { DB: {} });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("應該拒絕員工為他人打卡", async () => {
      mockUserRole = 3; // Staff
      mockUserId = "emp_1";

      const req = new Request(
        "http://localhost/scheduling/schedules/1/clock-in",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId: "emp_2" }), // Different employee
        },
      );

      const res = await app.fetch(req, { DB: {} });

      expect(res.status).toBe(403);
    });
  });

  // ========================================
  // Statistics Endpoints Tests (4 tests)
  // ========================================

  describe("Statistics Endpoints", () => {
    it("應該成功獲取每日統計", async () => {
      mockSchedulingService.getDailyStats.mockResolvedValue({
        date: "2024-01-15",
        totalSchedules: 10,
        totalEmployees: 8,
        totalHours: 80,
        shiftsBreakdown: {
          morning: 4,
          afternoon: 3,
          evening: 3,
        },
      });

      const req = new Request(
        "http://localhost/scheduling/1/stats/daily?date=2024-01-15",
      );
      const res = await app.fetch(req, { DB: {} });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.totalSchedules).toBe(10);
    });

    it("應該成功獲取每週摘要", async () => {
      mockSchedulingService.getWeeklySummary.mockResolvedValue({
        weekStartDate: "2024-01-15",
        weekEndDate: "2024-01-21",
        totalSchedules: 50,
        totalHours: 400,
        employeeCoverage: 95,
        dailyBreakdown: [
          { date: "2024-01-15", schedules: 8 },
          { date: "2024-01-16", schedules: 7 },
        ],
      });

      const req = new Request(
        "http://localhost/scheduling/1/stats/weekly?weekStartDate=2024-01-15",
      );
      const res = await app.fetch(req, { DB: {} });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.totalSchedules).toBe(50);
    });

    it("應該處理無數據的統計請求", async () => {
      mockSchedulingService.getDailyStats.mockResolvedValue({
        date: "2024-01-15",
        totalSchedules: 0,
        totalEmployees: 0,
        totalHours: 0,
      });

      const req = new Request(
        "http://localhost/scheduling/1/stats/daily?date=2024-01-15",
      );
      const res = await app.fetch(req, { DB: {} });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.totalSchedules).toBe(0);
    });

    it("應該處理統計查詢錯誤", async () => {
      mockSchedulingService.getDailyStats.mockRejectedValue(
        new Error("Database error"),
      );

      const req = new Request(
        "http://localhost/scheduling/1/stats/daily?date=2024-01-15",
      );
      const res = await app.fetch(req, { DB: {} });

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // Conflict Resolution Tests (4 tests)
  // ========================================

  describe("Conflict Resolution", () => {
    it("應該成功獲取單一衝突詳情", async () => {
      mockSchedulingService.getConflict.mockResolvedValue({
        id: 1,
        type: "overlap",
        employeeId: "emp_1",
        employeeName: "張三",
        schedule1: {
          id: 1,
          date: "2024-01-15",
          startTime: "08:00",
          endTime: "16:00",
        },
        schedule2: {
          id: 2,
          date: "2024-01-15",
          startTime: "14:00",
          endTime: "22:00",
        },
        status: "unresolved",
      });

      const req = new Request("http://localhost/scheduling/conflicts/1");
      const res = await app.fetch(req, { DB: {} });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.type).toBe("overlap");
    });

    it("應該成功解決衝突", async () => {
      mockSchedulingService.resolveConflict.mockResolvedValue({
        id: 1,
        status: "resolved",
        resolvedBy: "user_123",
        resolvedAt: new Date().toISOString(),
        resolutionNotes: "刪除重疊班次",
      });

      const req = new Request(
        "http://localhost/scheduling/conflicts/1/resolve",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: "user_123",
            resolutionNotes: "刪除重疊班次",
          }),
        },
      );

      const res = await app.fetch(req, { DB: {} });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.status).toBe("resolved");
    });

    it("應該處理不存在的衝突", async () => {
      mockSchedulingService.getConflict.mockResolvedValue(null);

      const req = new Request("http://localhost/scheduling/conflicts/999");
      const res = await app.fetch(req, { DB: {} });

      expect(res.status).toBe(404);
    });

    it("應該支援按類型過濾衝突", async () => {
      mockSchedulingService.getConflicts.mockResolvedValue({
        items: [{ id: 1, type: "leave_conflict", status: "unresolved" }],
        total: 1,
      });

      const req = new Request(
        "http://localhost/scheduling/1/conflicts?type=leave_conflict&page=1&limit=20",
      );
      const res = await app.fetch(req, { DB: {} });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data[0].type).toBe("leave_conflict");
    });
  });

  // ========================================
  // Swap Request Edge Cases (4 tests)
  // ========================================

  describe("Swap Request Edge Cases", () => {
    it("應該拒絕自己與自己換班", async () => {
      mockSchedulingService.createSwapRequest.mockRejectedValue(
        new Error("Cannot swap with yourself"),
      );

      const req = new Request("http://localhost/scheduling/1/swap-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterEmployeeId: "emp_1",
          targetEmployeeId: "emp_1", // Same employee
          sourceScheduleId: 1,
          targetScheduleId: 2,
          reason: "測試",
        }),
      });

      const res = await app.fetch(req, { DB: {} });

      expect(res.status).toBe(500);
    });

    it("應該拒絕已過期班次的換班請求", async () => {
      mockSchedulingService.createSwapRequest.mockRejectedValue(
        new Error("Cannot swap past schedules"),
      );

      const req = new Request("http://localhost/scheduling/1/swap-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterEmployeeId: "emp_1",
          targetEmployeeId: "emp_2",
          sourceScheduleId: 1, // Past schedule
          reason: "測試",
        }),
      });

      const res = await app.fetch(req, { DB: {} });

      expect(res.status).toBe(500);
    });

    it("應該處理換班請求的取消", async () => {
      mockSchedulingService.cancelSwapRequest.mockResolvedValue({
        id: 1,
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
      });

      const req = new Request(
        "http://localhost/scheduling/swap-requests/1/cancel",
        {
          method: "POST",
        },
      );

      const res = await app.fetch(req, { DB: {} });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.status).toBe("cancelled");
    });

    it("應該拒絕取消已處理的換班請求", async () => {
      mockSchedulingService.cancelSwapRequest.mockRejectedValue(
        new Error("Cannot cancel approved/rejected swap request"),
      );

      const req = new Request(
        "http://localhost/scheduling/swap-requests/1/cancel",
        {
          method: "POST",
        },
      );

      const res = await app.fetch(req, { DB: {} });

      expect(res.status).toBe(500);
    });
  });
});

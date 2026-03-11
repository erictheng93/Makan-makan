/**
 * Scheduling Feature Tests
 * 員工排班功能測試套件
 *
 * 測試覆蓋範圍：
 * - Shift Template 管理
 * - Employee Schedule 管理
 * - Swap Request 處理
 * - Clock In/Out 功能
 * - Availability 管理
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

// Mock database service
const mockSchedulingService = {
  // Shift Templates
  getShiftTemplates: vi.fn(),
  getShiftTemplate: vi.fn(),
  createShiftTemplate: vi.fn(),
  updateShiftTemplate: vi.fn(),
  deleteShiftTemplate: vi.fn(),
  // Schedules
  getSchedules: vi.fn(),
  getSchedule: vi.fn(),
  createSchedule: vi.fn(),
  updateSchedule: vi.fn(),
  deleteSchedule: vi.fn(),
  // Swap Requests
  getSwapRequests: vi.fn(),
  createSwapRequest: vi.fn(),
  acceptSwapRequest: vi.fn(),
  approveSwapRequest: vi.fn(),
  rejectSwapRequest: vi.fn(),
  cancelSwapRequest: vi.fn(),
  // Clock In/Out
  clockIn: vi.fn(),
  clockOut: vi.fn(),
  getTimeRecords: vi.fn(),
  // Availability
  getEmployeeAvailability: vi.fn(),
  setEmployeeAvailability: vi.fn(),
  getAvailableEmployees: vi.fn(),
  // Conflicts
  getConflicts: vi.fn(),
  getConflict: vi.fn(),
  resolveConflict: vi.fn(),
};

vi.mock("@makanmakan/database", () => ({
  SchedulingService: vi.fn(function () {
    return mockSchedulingService;
  }),
}));

// Mock middleware with proper query parameter handling
vi.mock("../../../shared/middleware", () => ({
  authMiddleware: vi.fn((c, next) => {
    c.set("user", { id: "user_123", role: 0, restaurantId: 1 });
    return next();
  }),
  requireRole: vi.fn(() => (c: any, next: any) => next()),
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
    // Parse query parameters from URL
    const url = c.req.url;
    const queryString = url.split("?")[1] || "";
    const params: Record<string, any> = {
      page: 1,
      limit: 20,
    };
    if (queryString) {
      queryString.split("&").forEach((pair: string) => {
        const [key, value] = pair.split("=");
        if (key) {
          const decodedValue = decodeURIComponent(value || "");
          // Convert numeric values
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

describe("Scheduling Feature", () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // 動態導入路由（在 mock 設置後）
    const { default: schedulingRoutes } = await import("../routes/index");
    app = new Hono();
    app.route("/scheduling", schedulingRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // Shift Template Tests
  // ========================================

  describe("Shift Templates", () => {
    describe("GET /:restaurantId/templates", () => {
      it("應該成功獲取班表範本列表", async () => {
        const mockTemplates = [
          {
            id: 1,
            restaurantId: 1,
            name: "早班",
            startTime: "08:00",
            endTime: "16:00",
            daysOfWeek: [1, 2, 3, 4, 5],
            isActive: true,
          },
          {
            id: 2,
            restaurantId: 1,
            name: "晚班",
            startTime: "16:00",
            endTime: "00:00",
            daysOfWeek: [1, 2, 3, 4, 5],
            isActive: true,
          },
        ];

        mockSchedulingService.getShiftTemplates.mockResolvedValue(
          mockTemplates,
        );

        const req = new Request("http://localhost/scheduling/1/templates", {
          method: "GET",
        });

        const res = await app.fetch(req, { DB: {} });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(2);
        expect(data.data[0].name).toBe("早班");
      });

      it("應該處理資料庫錯誤", async () => {
        mockSchedulingService.getShiftTemplates.mockRejectedValue(
          new Error("Database error"),
        );

        const req = new Request("http://localhost/scheduling/1/templates", {
          method: "GET",
        });

        const res = await app.fetch(req, { DB: {} });

        expect(res.status).toBe(500);
      });
    });

    describe("GET /templates/:id", () => {
      it("應該成功獲取單一班表範本", async () => {
        const mockTemplate = {
          id: 1,
          restaurantId: 1,
          name: "早班",
          startTime: "08:00",
          endTime: "16:00",
          daysOfWeek: [1, 2, 3, 4, 5],
          isActive: true,
        };

        mockSchedulingService.getShiftTemplate.mockResolvedValue(mockTemplate);

        const req = new Request("http://localhost/scheduling/templates/1", {
          method: "GET",
        });

        const res = await app.fetch(req, { DB: {} });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.name).toBe("早班");
      });

      it("範本不存在時應返回 404", async () => {
        mockSchedulingService.getShiftTemplate.mockResolvedValue(null);

        const req = new Request("http://localhost/scheduling/templates/999", {
          method: "GET",
        });

        const res = await app.fetch(req, { DB: {} });

        expect(res.status).toBe(404);
      });
    });

    describe("POST /:restaurantId/templates", () => {
      it("應該成功創建班表範本", async () => {
        const newTemplate = {
          name: "中班",
          startTime: "12:00",
          endTime: "20:00",
          daysOfWeek: [1, 2, 3, 4, 5],
        };

        const createdTemplate = {
          id: 3,
          restaurantId: 1,
          ...newTemplate,
          isActive: true,
          createdAt: new Date().toISOString(),
        };

        mockSchedulingService.createShiftTemplate.mockResolvedValue(
          createdTemplate,
        );

        const req = new Request("http://localhost/scheduling/1/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newTemplate),
        });

        const res = await app.fetch(req, { DB: {} });
        const data = await res.json();

        expect(res.status).toBe(201);
        expect(data.success).toBe(true);
        expect(data.data.name).toBe("中班");
      });
    });
  });

  // ========================================
  // Employee Schedule Tests
  // ========================================

  describe("Employee Schedules", () => {
    describe("GET /:restaurantId/schedules", () => {
      it("應該成功獲取員工班表列表", async () => {
        const mockSchedulesResult = {
          items: [
            {
              id: 1,
              employeeId: "emp_1",
              employeeName: "張三",
              templateId: 1,
              date: "2024-01-15",
              startTime: "08:00",
              endTime: "16:00",
              status: "scheduled",
            },
            {
              id: 2,
              employeeId: "emp_2",
              employeeName: "李四",
              templateId: 1,
              date: "2024-01-15",
              startTime: "08:00",
              endTime: "16:00",
              status: "scheduled",
            },
          ],
          total: 2,
        };

        mockSchedulingService.getSchedules.mockResolvedValue(
          mockSchedulesResult,
        );

        const req = new Request(
          "http://localhost/scheduling/1/schedules?page=1&limit=20",
          {
            method: "GET",
          },
        );

        const res = await app.fetch(req, { DB: {} });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(2);
        expect(data.pagination).toBeDefined();
        expect(data.pagination.total).toBe(2);
        expect(mockSchedulingService.getSchedules).toHaveBeenCalled();
      });

      it("應該根據日期範圍過濾班表", async () => {
        const mockSchedulesResult = {
          items: [
            {
              id: 1,
              employeeId: "emp_1",
              employeeName: "張三",
              date: "2024-01-15",
              startTime: "08:00",
              endTime: "16:00",
              status: "scheduled",
            },
          ],
          total: 1,
        };

        mockSchedulingService.getSchedules.mockResolvedValue(
          mockSchedulesResult,
        );

        const req = new Request(
          "http://localhost/scheduling/1/schedules?startDate=2024-01-15&endDate=2024-01-20&page=1&limit=20",
          { method: "GET" },
        );

        const res = await app.fetch(req, { DB: {} });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(mockSchedulingService.getSchedules).toHaveBeenCalledWith(
          expect.objectContaining({
            restaurantId: "1",
            startDate: "2024-01-15",
            endDate: "2024-01-20",
          }),
        );
      });

      it("應該根據員工ID過濾班表", async () => {
        const mockSchedulesResult = {
          items: [],
          total: 0,
        };

        mockSchedulingService.getSchedules.mockResolvedValue(
          mockSchedulesResult,
        );

        const req = new Request(
          "http://localhost/scheduling/1/schedules?employeeId=emp_1&page=1&limit=20",
          { method: "GET" },
        );

        const res = await app.fetch(req, { DB: {} });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(mockSchedulingService.getSchedules).toHaveBeenCalled();
      });

      it("應該處理資料庫錯誤", async () => {
        mockSchedulingService.getSchedules.mockRejectedValue(
          new Error("Database error"),
        );

        const req = new Request("http://localhost/scheduling/1/schedules", {
          method: "GET",
        });

        const res = await app.fetch(req, { DB: {} });

        expect(res.status).toBe(500);
      });
    });

    describe("POST /:restaurantId/schedules", () => {
      it("應該成功創建員工班表", async () => {
        const newSchedule = {
          employeeId: "emp_1",
          templateId: 1,
          date: "2024-01-20",
          startTime: "08:00",
          endTime: "16:00",
        };

        const createdSchedule = {
          id: 2,
          restaurantId: 1,
          ...newSchedule,
          status: "scheduled",
          createdAt: new Date().toISOString(),
        };

        mockSchedulingService.createSchedule.mockResolvedValue(createdSchedule);

        const req = new Request("http://localhost/scheduling/1/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newSchedule),
        });

        const res = await app.fetch(req, { DB: {} });
        const data = await res.json();

        expect(res.status).toBe(201);
        expect(data.success).toBe(true);
        expect(data.data.status).toBe("scheduled");
      });
    });
  });

  // ========================================
  // Swap Request Tests
  // ========================================

  describe("Swap Requests", () => {
    describe("GET /:restaurantId/swap-requests", () => {
      it("應該成功獲取換班請求列表", async () => {
        const mockSwapRequestsResult = {
          items: [
            {
              id: 1,
              requesterId: "emp_1",
              requesterName: "張三",
              targetEmployeeId: "emp_2",
              targetEmployeeName: "李四",
              sourceScheduleId: 1,
              targetScheduleId: 2,
              status: "pending",
              reason: "有事需要換班",
              createdAt: "2024-01-10T08:00:00Z",
            },
            {
              id: 2,
              requesterId: "emp_3",
              requesterName: "王五",
              targetEmployeeId: "emp_1",
              targetEmployeeName: "張三",
              sourceScheduleId: 3,
              targetScheduleId: 4,
              status: "approved",
              reason: "家庭原因",
              createdAt: "2024-01-09T10:00:00Z",
            },
          ],
          total: 2,
        };

        mockSchedulingService.getSwapRequests.mockResolvedValue(
          mockSwapRequestsResult,
        );

        const req = new Request(
          "http://localhost/scheduling/1/swap-requests?page=1&limit=20",
          {
            method: "GET",
          },
        );

        const res = await app.fetch(req, { DB: {} });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(2);
        expect(data.pagination).toBeDefined();
        expect(data.pagination.total).toBe(2);
        expect(mockSchedulingService.getSwapRequests).toHaveBeenCalled();
      });

      it("應該根據狀態過濾換班請求", async () => {
        const mockSwapRequestsResult = {
          items: [
            {
              id: 1,
              requesterId: "emp_1",
              requesterName: "張三",
              targetEmployeeId: "emp_2",
              targetEmployeeName: "李四",
              status: "pending",
              reason: "有事需要換班",
            },
          ],
          total: 1,
        };

        mockSchedulingService.getSwapRequests.mockResolvedValue(
          mockSwapRequestsResult,
        );

        const req = new Request(
          "http://localhost/scheduling/1/swap-requests?status=pending&page=1&limit=20",
          { method: "GET" },
        );

        const res = await app.fetch(req, { DB: {} });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(1);
        expect(data.data[0].status).toBe("pending");
      });

      it("應該處理空結果", async () => {
        const mockSwapRequestsResult = {
          items: [],
          total: 0,
        };

        mockSchedulingService.getSwapRequests.mockResolvedValue(
          mockSwapRequestsResult,
        );

        const req = new Request("http://localhost/scheduling/1/swap-requests", {
          method: "GET",
        });

        const res = await app.fetch(req, { DB: {} });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(0);
        expect(data.pagination.total).toBe(0);
      });

      it("應該處理資料庫錯誤", async () => {
        mockSchedulingService.getSwapRequests.mockRejectedValue(
          new Error("Database error"),
        );

        const req = new Request("http://localhost/scheduling/1/swap-requests", {
          method: "GET",
        });

        const res = await app.fetch(req, { DB: {} });

        expect(res.status).toBe(500);
      });
    });

    describe("POST /:restaurantId/swap-requests", () => {
      it("應該成功創建換班請求", async () => {
        const newSwapRequest = {
          targetEmployeeId: "emp_2",
          sourceScheduleId: 1,
          targetScheduleId: 2,
          reason: "有事需要換班",
        };

        const createdSwapRequest = {
          id: 2,
          requesterId: "user_123",
          ...newSwapRequest,
          status: "pending",
          createdAt: new Date().toISOString(),
        };

        mockSchedulingService.createSwapRequest.mockResolvedValue(
          createdSwapRequest,
        );

        const req = new Request("http://localhost/scheduling/1/swap-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newSwapRequest),
        });

        const res = await app.fetch(req, { DB: {} });
        const data = await res.json();

        expect(res.status).toBe(201);
        expect(data.success).toBe(true);
        expect(data.data.status).toBe("pending");
      });
    });

    describe("POST /swap-requests/:id/approve", () => {
      it("應該成功批准換班請求", async () => {
        const approvedSwapRequest = {
          id: 1,
          status: "approved",
          approvedBy: "user_123",
          approvedAt: new Date().toISOString(),
        };

        mockSchedulingService.approveSwapRequest.mockResolvedValue(
          approvedSwapRequest,
        );

        const req = new Request(
          "http://localhost/scheduling/swap-requests/1/approve",
          {
            method: "POST",
          },
        );

        const res = await app.fetch(req, { DB: {} });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.status).toBe("approved");
      });
    });

    describe("POST /swap-requests/:id/reject", () => {
      it("應該成功拒絕換班請求", async () => {
        const rejectedSwapRequest = {
          id: 1,
          status: "rejected",
          rejectedBy: "user_123",
          rejectedAt: new Date().toISOString(),
          rejectionReason: "時間衝突",
        };

        mockSchedulingService.rejectSwapRequest.mockResolvedValue(
          rejectedSwapRequest,
        );

        const req = new Request(
          "http://localhost/scheduling/swap-requests/1/reject",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: "時間衝突" }),
          },
        );

        const res = await app.fetch(req, { DB: {} });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.status).toBe("rejected");
      });
    });
  });

  // ========================================
  // Clock In/Out Tests
  // ========================================

  describe("Clock In/Out", () => {
    describe("POST /schedules/:id/clock-in", () => {
      it("應該成功打卡上班", async () => {
        const clockInRecord = {
          id: 1,
          employeeId: "user_123",
          scheduleId: 1,
          clockInTime: new Date().toISOString(),
          clockInLocation: { lat: 25.033, lng: 121.5654 },
        };

        mockSchedulingService.clockIn.mockResolvedValue(clockInRecord);

        const req = new Request(
          "http://localhost/scheduling/schedules/1/clock-in",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: { lat: 25.033, lng: 121.5654 },
            }),
          },
        );

        const res = await app.fetch(req, { DB: {} });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.clockInTime).toBeDefined();
      });
    });

    describe("POST /schedules/:id/clock-out", () => {
      it("應該成功打卡下班", async () => {
        const clockOutRecord = {
          id: 1,
          employeeId: "user_123",
          scheduleId: 1,
          clockInTime: "2024-01-15T08:00:00Z",
          clockOutTime: new Date().toISOString(),
          totalHours: 8.0,
        };

        mockSchedulingService.clockOut.mockResolvedValue(clockOutRecord);

        const req = new Request(
          "http://localhost/scheduling/schedules/1/clock-out",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: { lat: 25.033, lng: 121.5654 },
            }),
          },
        );

        const res = await app.fetch(req, { DB: {} });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.clockOutTime).toBeDefined();
        expect(data.data.totalHours).toBeDefined();
      });
    });
  });

  // ========================================
  // Available Employees Tests
  // ========================================

  describe("Available Employees", () => {
    describe("GET /:restaurantId/available-employees", () => {
      it("應該成功獲取可用員工列表", async () => {
        const mockAvailableEmployees = [
          {
            id: "emp_1",
            name: "張三",
            email: "zhang@example.com",
            role: 2,
            isAvailable: true,
            conflictReason: null,
          },
          {
            id: "emp_2",
            name: "李四",
            email: "li@example.com",
            role: 2,
            isAvailable: true,
            conflictReason: null,
          },
        ];

        mockSchedulingService.getAvailableEmployees.mockResolvedValue(
          mockAvailableEmployees,
        );

        const req = new Request(
          "http://localhost/scheduling/1/available-employees?date=2024-01-15&shiftTemplateId=1",
          { method: "GET" },
        );

        const res = await app.fetch(req, { DB: {} });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(2);
        expect(data.data[0].isAvailable).toBe(true);
        expect(
          mockSchedulingService.getAvailableEmployees,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            restaurantId: "1",
            date: "2024-01-15",
            shiftTemplateId: 1,
          }),
        );
      });

      it("應該過濾請假中的員工", async () => {
        const mockAvailableEmployees = [
          {
            id: "emp_1",
            name: "張三",
            isAvailable: true,
            conflictReason: null,
          },
          // emp_2 is on leave and not returned
        ];

        mockSchedulingService.getAvailableEmployees.mockResolvedValue(
          mockAvailableEmployees,
        );

        const req = new Request(
          "http://localhost/scheduling/1/available-employees?date=2024-01-15",
          { method: "GET" },
        );

        const res = await app.fetch(req, { DB: {} });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(1);
      });

      it("應該處理無可用員工的情況", async () => {
        mockSchedulingService.getAvailableEmployees.mockResolvedValue([]);

        const req = new Request(
          "http://localhost/scheduling/1/available-employees?date=2024-01-15",
          { method: "GET" },
        );

        const res = await app.fetch(req, { DB: {} });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(0);
        expect(data.message).toContain("0 available employees");
      });

      it("應該處理資料庫錯誤", async () => {
        mockSchedulingService.getAvailableEmployees.mockRejectedValue(
          new Error("Database error"),
        );

        const req = new Request(
          "http://localhost/scheduling/1/available-employees?date=2024-01-15",
          { method: "GET" },
        );

        const res = await app.fetch(req, { DB: {} });

        expect(res.status).toBe(500);
      });
    });
  });

  // ========================================
  // Conflict Detection Tests
  // ========================================

  describe("Schedule Conflicts", () => {
    describe("GET /:restaurantId/conflicts", () => {
      it("應該成功獲取排班衝突列表", async () => {
        const mockConflictsResult = {
          items: [
            {
              id: 1,
              type: "overlap",
              employeeId: "emp_1",
              employeeName: "張三",
              schedule1Id: 1,
              schedule2Id: 2,
              conflictDate: "2024-01-15",
              description: "同一天有兩個重疊的班次",
              status: "unresolved",
              createdAt: "2024-01-14T08:00:00Z",
            },
            {
              id: 2,
              type: "leave_conflict",
              employeeId: "emp_2",
              employeeName: "李四",
              scheduleId: 3,
              leaveRequestId: 5,
              conflictDate: "2024-01-16",
              description: "班次與已批准的請假衝突",
              status: "unresolved",
              createdAt: "2024-01-14T09:00:00Z",
            },
          ],
          total: 2,
        };

        mockSchedulingService.getConflicts.mockResolvedValue(
          mockConflictsResult,
        );

        const req = new Request(
          "http://localhost/scheduling/1/conflicts?page=1&limit=20",
          {
            method: "GET",
          },
        );

        const res = await app.fetch(req, { DB: {} });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(2);
        expect(data.pagination).toBeDefined();
        expect(data.pagination.total).toBe(2);
        expect(mockSchedulingService.getConflicts).toHaveBeenCalled();
      });

      it("應該根據類型過濾衝突", async () => {
        const mockConflictsResult = {
          items: [
            {
              id: 1,
              type: "overlap",
              employeeId: "emp_1",
              employeeName: "張三",
              status: "unresolved",
            },
          ],
          total: 1,
        };

        mockSchedulingService.getConflicts.mockResolvedValue(
          mockConflictsResult,
        );

        const req = new Request(
          "http://localhost/scheduling/1/conflicts?type=overlap&page=1&limit=20",
          { method: "GET" },
        );

        const res = await app.fetch(req, { DB: {} });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data[0].type).toBe("overlap");
      });

      it("應該根據狀態過濾衝突", async () => {
        const mockConflictsResult = {
          items: [
            {
              id: 1,
              type: "overlap",
              status: "resolved",
              resolvedBy: "admin_1",
              resolvedAt: "2024-01-14T10:00:00Z",
            },
          ],
          total: 1,
        };

        mockSchedulingService.getConflicts.mockResolvedValue(
          mockConflictsResult,
        );

        const req = new Request(
          "http://localhost/scheduling/1/conflicts?status=resolved&page=1&limit=20",
          { method: "GET" },
        );

        const res = await app.fetch(req, { DB: {} });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data[0].status).toBe("resolved");
      });

      it("應該處理無衝突的情況", async () => {
        const mockConflictsResult = {
          items: [],
          total: 0,
        };

        mockSchedulingService.getConflicts.mockResolvedValue(
          mockConflictsResult,
        );

        const req = new Request("http://localhost/scheduling/1/conflicts", {
          method: "GET",
        });

        const res = await app.fetch(req, { DB: {} });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(0);
      });

      it("應該處理資料庫錯誤", async () => {
        mockSchedulingService.getConflicts.mockRejectedValue(
          new Error("Database error"),
        );

        const req = new Request("http://localhost/scheduling/1/conflicts", {
          method: "GET",
        });

        const res = await app.fetch(req, { DB: {} });

        expect(res.status).toBe(500);
      });
    });
  });
});

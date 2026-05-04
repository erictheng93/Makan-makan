/**
 * Notifications Feature Tests
 * 通知功能測試套件
 *
 * 測試覆蓋範圍：
 * - 測試通知發送
 * - 通知模板獲取
 * - 手動發送通知
 * - 錯誤處理
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

// Mock notification service
const mockNotificationService = {
  sendTestNotification: vi.fn(),
  sendNotification: vi.fn(),
};

const mockAuthUser = vi.hoisted(() => ({
  value: { id: 1, role: 0, restaurantId: 1 as string | number },
}));

vi.mock("@makanmasak/database", () => ({
  NotificationService: vi.fn(function () {
    return mockNotificationService;
  }),
}));

// Mock middleware
vi.mock("../../../shared/middleware", () => ({
  authMiddleware: vi.fn((c, next) => {
    c.set("user", mockAuthUser.value);
    return next();
  }),
  requireRole: vi.fn(() => (c: any, next: any) => next()),
  validateBody: vi.fn(() => async (c: any, next: any) => {
    try {
      const body = await c.req.json();
      c.set("validatedBody", body);
    } catch {
      c.set("validatedBody", {});
    }
    return next();
  }),
}));

describe("Notifications Feature Tests", () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockAuthUser.value = { id: 1, role: 0, restaurantId: 1 };

    const { default: notificationsRoutes } = await import("../routes/index");
    app = new Hono();
    app.route("/notifications", notificationsRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // Test Notification Tests (4 tests)
  // ========================================

  describe("POST /test", () => {
    it("應該成功發送測試通知", async () => {
      mockNotificationService.sendTestNotification.mockResolvedValue({
        success: true,
        messageId: "msg_123",
      });

      const req = new Request("http://localhost/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: "test@example.com",
          category: "leave_request_submitted",
          type: "email",
        }),
      });

      const res = await app.fetch(req, { DB: {}, RESEND_API_KEY: "test-key" });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.message).toContain("successfully");
      expect(
        mockNotificationService.sendTestNotification,
      ).toHaveBeenCalledOnce();
    });

    it("應該處理發送失敗", async () => {
      mockNotificationService.sendTestNotification.mockResolvedValue({
        success: false,
        error: "Invalid email address",
      });

      const req = new Request("http://localhost/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: "invalid-email",
          category: "leave_request_submitted",
          type: "email",
        }),
      });

      const res = await app.fetch(req, { DB: {} });

      expect(res.status).toBe(500);
    });

    it("應該支援 SMS 類型", async () => {
      mockNotificationService.sendTestNotification.mockResolvedValue({
        success: true,
        messageId: "sms_123",
      });

      const req = new Request("http://localhost/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: "test@example.com",
          category: "shift_reminder",
          type: "sms",
        }),
      });

      const res = await app.fetch(req, {
        DB: {},
        TWILIO_ACCOUNT_SID: "test",
        TWILIO_AUTH_TOKEN: "test",
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("應該處理服務異常", async () => {
      mockNotificationService.sendTestNotification.mockRejectedValue(
        new Error("Service unavailable"),
      );

      const req = new Request("http://localhost/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: "test@example.com",
          category: "leave_request_submitted",
          type: "email",
        }),
      });

      const res = await app.fetch(req, { DB: {} });

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // Templates Tests (4 tests)
  // ========================================

  describe("GET /templates", () => {
    it("應該成功獲取通知模板列表", async () => {
      const req = new Request("http://localhost/notifications/templates", {
        method: "GET",
      });

      const res = await app.fetch(req, { DB: {}, RESEND_API_KEY: "test-key" });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.templates).toBeDefined();
      expect(Array.isArray(data.data.templates)).toBe(true);
    });

    it("應該返回所有通知類別", async () => {
      const req = new Request("http://localhost/notifications/templates", {
        method: "GET",
      });

      const res = await app.fetch(req, { DB: {} });
      const data = await res.json();

      const categories = data.data.templates.map((t: any) => t.category);
      expect(categories).toContain("leave_request_submitted");
      expect(categories).toContain("leave_request_approved");
      expect(categories).toContain("schedule_created");
      expect(categories).toContain("shift_reminder");
    });

    it("應該返回支援的通道資訊", async () => {
      const req = new Request("http://localhost/notifications/templates", {
        method: "GET",
      });

      const res = await app.fetch(req, { DB: {} });
      const data = await res.json();

      expect(data.data.supportedChannels).toContain("email");
      expect(data.data.supportedChannels).toContain("sms");
    });

    it("應該返回已配置的提供者狀態", async () => {
      const req = new Request("http://localhost/notifications/templates", {
        method: "GET",
      });

      const res = await app.fetch(req, { DB: {}, RESEND_API_KEY: "test-key" });
      const data = await res.json();

      expect(data.data.configuredProviders).toBeDefined();
      expect(data.data.configuredProviders.email).toBe(true);
    });
  });

  // ========================================
  // Send Notification Tests (5 tests)
  // ========================================

  describe("POST /send", () => {
    it("應該成功發送通知", async () => {
      mockNotificationService.sendNotification.mockResolvedValue({
        success: true,
        errors: [],
      });

      const req = new Request("http://localhost/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: 1,
          recipientEmail: "employee@example.com",
          category: "leave_request_approved",
          type: "email",
          data: {
            employeeName: "張三",
            leaveType: "年假",
            startDate: "2024-12-20",
            endDate: "2024-12-24",
            totalDays: 5,
            approverName: "李經理",
          },
          priority: "normal",
        }),
      });

      const res = await app.fetch(req, { DB: {} });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.message).toContain("successfully");
      expect(mockNotificationService.sendNotification).toHaveBeenCalledOnce();
    });

    it("應該處理發送失敗", async () => {
      mockNotificationService.sendNotification.mockResolvedValue({
        success: false,
        errors: ["Email delivery failed"],
      });

      const req = new Request("http://localhost/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: 1,
          recipientEmail: "test@example.com",
          category: "leave_request_approved",
          type: "email",
          data: {},
          priority: "normal",
        }),
      });

      const res = await app.fetch(req, { DB: {} });

      expect(res.status).toBe(500);
    });

    it("應該支援高優先級通知", async () => {
      mockNotificationService.sendNotification.mockResolvedValue({
        success: true,
        errors: [],
      });

      const req = new Request("http://localhost/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: 1,
          recipientEmail: "urgent@example.com",
          category: "schedule_cancelled",
          type: "email",
          data: {
            employeeName: "王五",
            shiftName: "早班",
            scheduleDate: "2024-12-15",
            cancellationReason: "緊急情況",
          },
          priority: "high",
        }),
      });

      const res = await app.fetch(req, { DB: {} });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("應該支援 SMS 通知", async () => {
      mockNotificationService.sendNotification.mockResolvedValue({
        success: true,
        errors: [],
      });

      const req = new Request("http://localhost/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: 1,
          recipientEmail: "test@example.com",
          recipientPhone: "+886912345678",
          category: "shift_reminder",
          type: "sms",
          data: {
            employeeName: "張三",
            shiftName: "早班",
            scheduleDate: "2024-12-15",
            startTime: "08:00",
            hoursUntil: 2,
          },
          priority: "high",
        }),
      });

      const res = await app.fetch(req, { DB: {} });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("應該處理服務異常", async () => {
      mockNotificationService.sendNotification.mockRejectedValue(
        new Error("Service error"),
      );

      const req = new Request("http://localhost/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: 1,
          recipientEmail: "test@example.com",
          category: "leave_request_approved",
          type: "email",
          data: {},
          priority: "normal",
        }),
      });

      const res = await app.fetch(req, { DB: {} });

      expect(res.status).toBe(500);
    });

    it("應該拒絕店主發送通知給其他餐廳使用者", async () => {
      mockAuthUser.value = { id: 2, role: 1, restaurantId: "rest-1" };
      const first = vi.fn().mockResolvedValue({
        restaurant_id: "rest-2",
        email: "employee@example.com",
      });
      const bind = vi.fn(() => ({ first }));
      const prepare = vi.fn(() => ({ bind }));

      const req = new Request("http://localhost/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: 9,
          recipientEmail: "employee@example.com",
          category: "leave_request_approved",
          type: "email",
          data: {},
          priority: "normal",
        }),
      });

      const res = await app.fetch(req, { DB: { prepare } });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.success).toBe(false);
      expect(prepare).toHaveBeenCalledWith(
        "SELECT restaurant_id, email FROM users WHERE id = ?",
      );
      expect(bind).toHaveBeenCalledWith(9);
      expect(mockNotificationService.sendNotification).not.toHaveBeenCalled();
    });

    it("應該拒絕收件 email 與使用者資料不一致的通知", async () => {
      mockAuthUser.value = { id: 2, role: 1, restaurantId: "rest-1" };
      const first = vi.fn().mockResolvedValue({
        restaurant_id: "rest-1",
        email: "employee@example.com",
      });
      const bind = vi.fn(() => ({ first }));
      const prepare = vi.fn(() => ({ bind }));

      const req = new Request("http://localhost/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: 9,
          recipientEmail: "attacker@example.com",
          category: "leave_request_approved",
          type: "email",
          data: {},
          priority: "normal",
        }),
      });

      const res = await app.fetch(req, { DB: { prepare } });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(mockNotificationService.sendNotification).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // Notification Categories Tests (3 tests)
  // ========================================

  describe("Notification Categories", () => {
    it("應該支援請假相關通知", async () => {
      mockNotificationService.sendNotification.mockResolvedValue({
        success: true,
        errors: [],
      });

      const leaveCategories = [
        "leave_request_submitted",
        "leave_request_approved",
        "leave_request_rejected",
        "leave_request_cancelled",
      ];

      for (const category of leaveCategories) {
        const req = new Request("http://localhost/notifications/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientId: 1,
            recipientEmail: "test@example.com",
            category,
            type: "email",
            data: {},
            priority: "normal",
          }),
        });

        const res = await app.fetch(req, { DB: {} });
        expect(res.status).toBe(200);
      }
    });

    it("應該支援排班相關通知", async () => {
      mockNotificationService.sendNotification.mockResolvedValue({
        success: true,
        errors: [],
      });

      const scheduleCategories = [
        "schedule_created",
        "schedule_updated",
        "schedule_cancelled",
      ];

      for (const category of scheduleCategories) {
        const req = new Request("http://localhost/notifications/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientId: 1,
            recipientEmail: "test@example.com",
            category,
            type: "email",
            data: {},
            priority: "normal",
          }),
        });

        const res = await app.fetch(req, { DB: {} });
        expect(res.status).toBe(200);
      }
    });

    it("應該支援換班相關通知", async () => {
      mockNotificationService.sendNotification.mockResolvedValue({
        success: true,
        errors: [],
      });

      const swapCategories = [
        "swap_request_created",
        "swap_request_approved",
        "swap_request_rejected",
      ];

      for (const category of swapCategories) {
        const req = new Request("http://localhost/notifications/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientId: 1,
            recipientEmail: "test@example.com",
            category,
            type: "email",
            data: {},
            priority: "normal",
          }),
        });

        const res = await app.fetch(req, { DB: {} });
        expect(res.status).toBe(200);
      }
    });
  });
});

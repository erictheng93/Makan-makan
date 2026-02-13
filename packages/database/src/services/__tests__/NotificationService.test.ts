/**
 * NotificationService Tests
 * Comprehensive test suite for notification service
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  NotificationService,
  ResendEmailProvider,
  TwilioSMSProvider,
  notificationTemplates,
  type NotificationPayload,
  type EmailProvider,
  type SMSProvider,
} from "../NotificationService";
import type { CloudflareEnv } from "../base";

// ========================================
// Mock Providers
// ========================================

class MockEmailProvider implements EmailProvider {
  public sentEmails: Array<{
    to: string;
    subject: string;
    html: string;
    text?: string;
  }> = [];
  public shouldFail = false;
  public failureMessage = "Mock email failure";

  async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }) {
    if (this.shouldFail) {
      return { success: false, error: this.failureMessage };
    }
    this.sentEmails.push(params);
    return { success: true, messageId: "mock-email-id-" + Date.now() };
  }

  reset() {
    this.sentEmails = [];
    this.shouldFail = false;
  }
}

class MockSMSProvider implements SMSProvider {
  public sentSMS: Array<{ to: string; body: string }> = [];
  public shouldFail = false;
  public failureMessage = "Mock SMS failure";

  async sendSMS(params: { to: string; body: string }) {
    if (this.shouldFail) {
      return { success: false, error: this.failureMessage };
    }
    this.sentSMS.push(params);
    return { success: true, messageId: "mock-sms-id-" + Date.now() };
  }

  reset() {
    this.sentSMS = [];
    this.shouldFail = false;
  }
}

// ========================================
// Mock Database
// ========================================

const createMockDB = (): any => {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          get: async () => null,
          all: async () => [],
        }),
      }),
    }),
    insert: () => ({
      values: async () => ({ success: true }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          run: async () => ({ success: true }),
        }),
      }),
    }),
  };
};

// ========================================
// Setup
// ========================================

describe("NotificationService", () => {
  let service: NotificationService;
  let mockDB: any;
  let mockEmailProvider: MockEmailProvider;
  let mockSMSProvider: MockSMSProvider;
  let mockEnv: CloudflareEnv;

  beforeEach(() => {
    mockDB = createMockDB();
    mockEmailProvider = new MockEmailProvider();
    mockSMSProvider = new MockSMSProvider();

    mockEnv = {
      RESEND_API_KEY: "test-resend-key",
      TWILIO_ACCOUNT_SID: "test-twilio-sid",
      TWILIO_AUTH_TOKEN: "test-twilio-token",
      TWILIO_PHONE_NUMBER: "+1234567890",
      NOTIFICATION_FROM_EMAIL: "test@makanmakan.com",
      JWT_SECRET: "test-secret",
    } as CloudflareEnv;

    service = new NotificationService(mockDB, mockEnv);
    // Replace providers with mocks
    (service as any).emailProvider = mockEmailProvider;
    (service as any).smsProvider = mockSMSProvider;
  });

  // ========================================
  // 1. Email Notification Tests
  // ========================================

  describe("Email Notifications", () => {
    it("應該成功發送 email 通知", async () => {
      const payload: NotificationPayload = {
        recipientId: 1,
        recipientEmail: "employee@test.com",
        category: "leave_request_approved",
        type: "email",
        data: {
          employeeName: "John Doe",
          leaveType: "Annual Leave",
          startDate: "2025-01-15",
          endDate: "2025-01-20",
          totalDays: "5",
          approverName: "Manager Smith",
        },
      };

      const result = await service.sendNotification(payload);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(mockEmailProvider.sentEmails).toHaveLength(1);
      expect(mockEmailProvider.sentEmails[0].to).toBe("employee@test.com");
      expect(mockEmailProvider.sentEmails[0].subject).toContain("Annual Leave");
      expect(mockEmailProvider.sentEmails[0].html).toContain("John Doe");
    });

    it("應該在 email 提供者未配置時返回錯誤", async () => {
      (service as any).emailProvider = null;

      const payload: NotificationPayload = {
        recipientId: 1,
        recipientEmail: "employee@test.com",
        category: "leave_request_submitted",
        type: "email",
        data: {
          employeeName: "John Doe",
          leaveType: "Sick Leave",
          startDate: "2025-01-10",
          endDate: "2025-01-12",
          totalDays: "2",
        },
      };

      const result = await service.sendNotification(payload);

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Email provider not configured");
    });

    it("應該處理 email 發送失敗", async () => {
      mockEmailProvider.shouldFail = true;
      mockEmailProvider.failureMessage = "SMTP connection failed";

      const payload: NotificationPayload = {
        recipientId: 1,
        recipientEmail: "employee@test.com",
        category: "shift_reminder",
        type: "email",
        data: {
          employeeName: "Jane Smith",
          scheduleDate: "2025-01-15",
          shiftName: "Morning Shift",
          startTime: "08:00",
          endTime: "16:00",
        },
      };

      const result = await service.sendNotification(payload);

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Email failed: SMTP connection failed");
    });

    it("應該正確渲染 email 模板變數", async () => {
      const payload: NotificationPayload = {
        recipientId: 1,
        recipientEmail: "employee@test.com",
        category: "schedule_created",
        type: "email",
        data: {
          employeeName: "Alice Chen",
          scheduleDate: "2025-02-01",
          shiftName: "Evening Shift",
          startTime: "14:00",
          endTime: "22:00",
          notes: "Please bring your uniform",
        },
      };

      await service.sendNotification(payload);

      const sentEmail = mockEmailProvider.sentEmails[0];
      expect(sentEmail.html).toContain("Alice Chen");
      expect(sentEmail.html).toContain("2025-02-01");
      expect(sentEmail.html).toContain("Evening Shift");
      expect(sentEmail.html).toContain("14:00");
      expect(sentEmail.html).toContain("22:00");
      expect(sentEmail.html).toContain("Please bring your uniform");
    });

    it("應該處理條件內容 (if 語句)", async () => {
      // Test with notes
      const payloadWithNotes: NotificationPayload = {
        recipientId: 1,
        recipientEmail: "employee@test.com",
        category: "leave_request_approved",
        type: "email",
        data: {
          employeeName: "Bob Wilson",
          leaveType: "Vacation",
          startDate: "2025-03-01",
          endDate: "2025-03-07",
          totalDays: "7",
          approverName: "Manager Jane",
          approverNotes: "Have a great vacation!",
        },
      };

      await service.sendNotification(payloadWithNotes);
      let sentEmail = mockEmailProvider.sentEmails[0];
      expect(sentEmail.html).toContain("Have a great vacation!");

      mockEmailProvider.reset();

      // Test without notes
      const payloadWithoutNotes: NotificationPayload = {
        recipientId: 1,
        recipientEmail: "employee@test.com",
        category: "leave_request_approved",
        type: "email",
        data: {
          employeeName: "Bob Wilson",
          leaveType: "Vacation",
          startDate: "2025-03-01",
          endDate: "2025-03-07",
          totalDays: "7",
          approverName: "Manager Jane",
        },
      };

      await service.sendNotification(payloadWithoutNotes);
      sentEmail = mockEmailProvider.sentEmails[0];
      expect(sentEmail.html).not.toContain("Notes:");
    });

    it("應該成功發送測試 email", async () => {
      const result = await service.sendTestNotification(
        "email",
        "test@example.com",
      );

      expect(result.success).toBe(true);
      expect(mockEmailProvider.sentEmails).toHaveLength(1);
      expect(mockEmailProvider.sentEmails[0].to).toBe("test@example.com");
      expect(mockEmailProvider.sentEmails[0].subject).toContain(
        "Test Notification",
      );
    });
  });

  // ========================================
  // 2. SMS Notification Tests
  // ========================================

  describe("SMS Notifications", () => {
    it("應該成功發送 SMS 通知", async () => {
      const payload: NotificationPayload = {
        recipientId: 1,
        recipientPhone: "+886912345678",
        category: "shift_reminder",
        type: "sms",
        data: {
          employeeName: "David Lee",
          scheduleDate: "2025-01-20",
          shiftName: "Night Shift",
          startTime: "22:00",
          endTime: "06:00",
        },
      };

      const result = await service.sendNotification(payload);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(mockSMSProvider.sentSMS).toHaveLength(1);
      expect(mockSMSProvider.sentSMS[0].to).toBe("+886912345678");
      expect(mockSMSProvider.sentSMS[0].body).toContain("David Lee");
    });

    it("應該在 SMS 提供者未配置時返回錯誤", async () => {
      (service as any).smsProvider = null;

      const payload: NotificationPayload = {
        recipientId: 1,
        recipientPhone: "+886912345678",
        category: "leave_request_approved",
        type: "sms",
        data: {
          employeeName: "Emma Wang",
          leaveType: "Sick Leave",
          startDate: "2025-01-15",
          endDate: "2025-01-16",
          totalDays: "1",
          approverName: "Manager Chen",
        },
      };

      const result = await service.sendNotification(payload);

      expect(result.success).toBe(false);
      expect(result.errors).toContain("SMS provider not configured");
    });

    it("應該處理 SMS 發送失敗", async () => {
      mockSMSProvider.shouldFail = true;
      mockSMSProvider.failureMessage = "Invalid phone number";

      const payload: NotificationPayload = {
        recipientId: 1,
        recipientPhone: "invalid-number",
        category: "swap_request_created",
        type: "sms",
        data: {
          employeeName: "Frank Liu",
          requesterName: "Grace Chen",
          scheduleDate: "2025-01-25",
          shiftName: "Morning Shift",
          reason: "Personal emergency",
        },
      };

      const result = await service.sendNotification(payload);

      expect(result.success).toBe(false);
      expect(result.errors).toContain("SMS failed: Invalid phone number");
    });

    it("應該從 HTML 內容中剝離標籤", async () => {
      const payload: NotificationPayload = {
        recipientId: 1,
        recipientPhone: "+886912345678",
        category: "schedule_cancelled",
        type: "sms",
        data: {
          employeeName: "Helen Wu",
          scheduleDate: "2025-01-22",
          shiftName: "Afternoon Shift",
          reason: "Restaurant closed for maintenance",
        },
      };

      await service.sendNotification(payload);

      const sentSMS = mockSMSProvider.sentSMS[0];
      expect(sentSMS.body).not.toContain("<h2>");
      expect(sentSMS.body).not.toContain("<p>");
      expect(sentSMS.body).not.toContain("<ul>");
      expect(sentSMS.body).not.toContain("<li>");
      expect(sentSMS.body).toContain("Helen Wu");
    });

    it("應該成功發送測試 SMS", async () => {
      const result = await service.sendTestNotification("sms", "+886912345678");

      expect(result.success).toBe(true);
      expect(mockSMSProvider.sentSMS).toHaveLength(1);
      expect(mockSMSProvider.sentSMS[0].to).toBe("+886912345678");
      expect(mockSMSProvider.sentSMS[0].body).toContain("Test SMS");
    });
  });

  // ========================================
  // 3. Template Rendering Tests
  // ========================================

  describe("Template Rendering", () => {
    it("應該替換所有模板變數", () => {
      const template =
        "Hello {{name}}, your order {{orderId}} is ready at {{time}}.";
      const data = { name: "Alice", orderId: "12345", time: "14:30" };

      const result = (service as any).renderTemplate(template, data);

      expect(result).toBe("Hello Alice, your order 12345 is ready at 14:30.");
    });

    it("應該處理條件判斷 (if 語句)", () => {
      const template =
        "Order {{orderId}}{{#if notes}} - Note: {{notes}}{{/if}}";

      // With notes
      let data = { orderId: "123", notes: "Extra spicy" };
      let result = (service as any).renderTemplate(template, data);
      expect(result).toBe("Order 123 - Note: Extra spicy");

      // Without notes
      data = { orderId: "123", notes: "" };
      result = (service as any).renderTemplate(template, data);
      expect(result).toBe("Order 123");
    });

    it("應該處理多個變數和重複變數", () => {
      const template =
        "{{name}} ordered {{item}} and {{item}} again. Total: {{total}}";
      const data = { name: "Bob", item: "Coffee", total: "$10" };

      const result = (service as any).renderTemplate(template, data);

      expect(result).toBe("Bob ordered Coffee and Coffee again. Total: $10");
    });

    it("應該處理缺失變數為空字串", () => {
      const template = "Name: {{name}}, Age: {{age}}, City: {{city}}";
      const data = { name: "Charlie", age: 25 };

      const result = (service as any).renderTemplate(template, data);

      expect(result).toBe("Name: Charlie, Age: 25, City:");
    });

    it("應該處理包含特殊字符的變數", () => {
      const template = "Message: {{message}}";
      const data = { message: "Order #123 @ $50.00 (20% off)" };

      const result = (service as any).renderTemplate(template, data);

      expect(result).toBe("Message: Order #123 @ $50.00 (20% off)");
    });
  });

  // ========================================
  // 4. Bulk Notification Tests
  // ========================================

  describe("Bulk Notifications", () => {
    it("應該成功發送批量通知", async () => {
      const payloads: NotificationPayload[] = [
        {
          recipientId: 1,
          recipientEmail: "employee1@test.com",
          category: "shift_reminder",
          type: "email",
          data: {
            employeeName: "Alice",
            scheduleDate: "2025-01-20",
            shiftName: "Morning",
            startTime: "08:00",
            endTime: "16:00",
          },
        },
        {
          recipientId: 2,
          recipientEmail: "employee2@test.com",
          category: "shift_reminder",
          type: "email",
          data: {
            employeeName: "Bob",
            scheduleDate: "2025-01-20",
            shiftName: "Evening",
            startTime: "14:00",
            endTime: "22:00",
          },
        },
        {
          recipientId: 3,
          recipientEmail: "employee3@test.com",
          category: "shift_reminder",
          type: "email",
          data: {
            employeeName: "Charlie",
            scheduleDate: "2025-01-20",
            shiftName: "Night",
            startTime: "22:00",
            endTime: "06:00",
          },
        },
      ];

      const result = await service.sendBulkNotifications(payloads);

      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockEmailProvider.sentEmails).toHaveLength(3);
    });

    it("應該處理部分失敗情況", async () => {
      const payloads: NotificationPayload[] = [
        {
          recipientId: 1,
          recipientEmail: "valid@test.com",
          category: "leave_request_approved",
          type: "email",
          data: {
            employeeName: "David",
            leaveType: "Annual",
            startDate: "2025-01-20",
            endDate: "2025-01-25",
            totalDays: "5",
            approverName: "Manager",
          },
        },
        {
          recipientId: 2,
          recipientEmail: "invalid@test.com",
          category: "leave_request_approved",
          type: "email",
          data: {
            employeeName: "Emma",
            leaveType: "Sick",
            startDate: "2025-01-21",
            endDate: "2025-01-22",
            totalDays: "1",
            approverName: "Manager",
          },
        },
      ];

      // Make second email fail
      let emailCount = 0;
      mockEmailProvider.sendEmail = async (params) => {
        emailCount++;
        if (emailCount === 2) {
          return { success: false, error: "Invalid email address" };
        }
        mockEmailProvider.sentEmails.push(params);
        return { success: true, messageId: "mock-id" };
      };

      const result = await service.sendBulkNotifications(payloads);

      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].errors).toContain(
        "Email failed: Invalid email address",
      );
    });

    it("應該處理空列表", async () => {
      const result = await service.sendBulkNotifications([]);

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("應該處理大批量通知", async () => {
      const payloads: NotificationPayload[] = [];
      for (let i = 1; i <= 100; i++) {
        payloads.push({
          recipientId: i,
          recipientEmail: `employee${i}@test.com`,
          category: "shift_reminder",
          type: "email",
          data: {
            employeeName: `Employee ${i}`,
            scheduleDate: "2025-01-20",
            shiftName: "Morning",
            startTime: "08:00",
            endTime: "16:00",
          },
        });
      }

      const result = await service.sendBulkNotifications(payloads);

      expect(result.successCount).toBe(100);
      expect(result.failureCount).toBe(0);
      expect(mockEmailProvider.sentEmails).toHaveLength(100);
    });
  });

  // ========================================
  // 5. Notification Category Tests
  // ========================================

  describe("Notification Categories", () => {
    it("應該正確處理請假提交通知", async () => {
      const payload: NotificationPayload = {
        recipientId: 1,
        recipientEmail: "employee@test.com",
        category: "leave_request_submitted",
        type: "email",
        data: {
          employeeName: "Isabella Martinez",
          leaveType: "Annual Leave",
          startDate: "2025-02-01",
          endDate: "2025-02-10",
          totalDays: "10",
        },
      };

      const result = await service.sendNotification(payload);

      expect(result.success).toBe(true);
      const sentEmail = mockEmailProvider.sentEmails[0];
      expect(sentEmail.subject).toContain("Leave Request Submitted");
      expect(sentEmail.html).toContain("Pending Approval");
    });

    it("應該正確處理請假批准通知", async () => {
      const payload: NotificationPayload = {
        recipientId: 1,
        recipientEmail: "employee@test.com",
        category: "leave_request_approved",
        type: "email",
        data: {
          employeeName: "Jack Thompson",
          leaveType: "Sick Leave",
          startDate: "2025-01-25",
          endDate: "2025-01-26",
          totalDays: "2",
          approverName: "Manager Sarah",
          approverNotes: "Get well soon!",
        },
      };

      const result = await service.sendNotification(payload);

      expect(result.success).toBe(true);
      const sentEmail = mockEmailProvider.sentEmails[0];
      expect(sentEmail.subject).toContain("Leave Request Approved");
      expect(sentEmail.html).toContain("✅");
      expect(sentEmail.html).toContain("Get well soon!");
    });

    it("應該正確處理請假拒絕通知", async () => {
      const payload: NotificationPayload = {
        recipientId: 1,
        recipientEmail: "employee@test.com",
        category: "leave_request_rejected",
        type: "email",
        data: {
          employeeName: "Karen Davis",
          leaveType: "Vacation",
          startDate: "2025-03-01",
          endDate: "2025-03-07",
          rejectionReason: "Peak season - insufficient staff coverage",
        },
      };

      const result = await service.sendNotification(payload);

      expect(result.success).toBe(true);
      const sentEmail = mockEmailProvider.sentEmails[0];
      expect(sentEmail.subject).toContain("Not Approved");
      expect(sentEmail.html).toContain("Peak season");
    });

    it("應該正確處理排班創建通知", async () => {
      const payload: NotificationPayload = {
        recipientId: 1,
        recipientEmail: "employee@test.com",
        category: "schedule_created",
        type: "email",
        data: {
          employeeName: "Larry Johnson",
          scheduleDate: "2025-01-30",
          shiftName: "Breakfast Shift",
          startTime: "06:00",
          endTime: "14:00",
          notes: "Training new staff member",
        },
      };

      const result = await service.sendNotification(payload);

      expect(result.success).toBe(true);
      const sentEmail = mockEmailProvider.sentEmails[0];
      expect(sentEmail.subject).toContain("New Schedule Assignment");
      expect(sentEmail.html).toContain("Training new staff member");
    });

    it("應該正確處理排班更新通知", async () => {
      const payload: NotificationPayload = {
        recipientId: 1,
        recipientEmail: "employee@test.com",
        category: "schedule_updated",
        type: "email",
        data: {
          employeeName: "Monica Kim",
          scheduleDate: "2025-02-05",
          shiftName: "Lunch Shift",
          startTime: "11:00",
          endTime: "15:00",
        },
      };

      const result = await service.sendNotification(payload);

      expect(result.success).toBe(true);
      const sentEmail = mockEmailProvider.sentEmails[0];
      expect(sentEmail.subject).toContain("Schedule Updated");
      expect(sentEmail.html).toContain("updated");
    });

    it("應該正確處理交班請求通知", async () => {
      const payload: NotificationPayload = {
        recipientId: 1,
        recipientEmail: "employee@test.com",
        category: "swap_request_created",
        type: "email",
        data: {
          employeeName: "Nathan Park",
          requesterName: "Olivia Brown",
          scheduleDate: "2025-02-10",
          shiftName: "Dinner Shift",
          reason: "Family emergency",
        },
      };

      const result = await service.sendNotification(payload);

      expect(result.success).toBe(true);
      const sentEmail = mockEmailProvider.sentEmails[0];
      expect(sentEmail.subject).toContain("Swap Request");
      expect(sentEmail.html).toContain("Olivia Brown");
      expect(sentEmail.html).toContain("Family emergency");
    });
  });

  // ========================================
  // 6. Error Handling Tests
  // ========================================

  describe("Error Handling", () => {
    it("應該處理無效的通知類別", async () => {
      const payload: NotificationPayload = {
        recipientId: 1,
        recipientEmail: "employee@test.com",
        category: "invalid_category" as any,
        type: "email",
        data: {},
      };

      const result = await service.sendNotification(payload);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("Template not found");
    });

    it("應該處理缺少收件人信息", async () => {
      const payload: NotificationPayload = {
        recipientId: 1,
        // Missing recipientEmail
        category: "shift_reminder",
        type: "email",
        data: {
          employeeName: "Test User",
          scheduleDate: "2025-01-20",
          shiftName: "Morning",
          startTime: "08:00",
          endTime: "16:00",
        },
      };

      const result = await service.sendNotification(payload);

      // Should succeed but skip sending (no email address provided)
      expect(result.success).toBe(true);
      expect(mockEmailProvider.sentEmails).toHaveLength(0);
    });

    it("應該處理異常情況", async () => {
      // Mock provider to throw error
      mockEmailProvider.sendEmail = async () => {
        throw new Error("Network timeout");
      };

      const payload: NotificationPayload = {
        recipientId: 1,
        recipientEmail: "employee@test.com",
        category: "leave_request_submitted",
        type: "email",
        data: {
          employeeName: "Peter Wilson",
          leaveType: "Annual",
          startDate: "2025-01-20",
          endDate: "2025-01-25",
          totalDays: "5",
        },
      };

      const result = await service.sendNotification(payload);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("應該處理無效的測試通知類型", async () => {
      const result = await service.sendTestNotification(
        "invalid" as any,
        "test@test.com",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid notification type");
    });
  });

  // ========================================
  // 7. Provider Tests
  // ========================================

  describe("Provider Configuration", () => {
    it("應該正確初始化 email 提供者", () => {
      const provider = new ResendEmailProvider(
        "test-api-key",
        "test@example.com",
      );
      expect(provider).toBeDefined();
    });

    it("應該正確初始化 SMS 提供者", () => {
      const provider = new TwilioSMSProvider(
        "test-sid",
        "test-token",
        "+1234567890",
      );
      expect(provider).toBeDefined();
    });

    it("應該在沒有配置時不初始化提供者", () => {
      const emptyEnv = {
        JWT_SECRET: "test",
        USE_MAILCHANNELS: "false",
      } as CloudflareEnv;
      const serviceWithoutProviders = new NotificationService(mockDB, emptyEnv);

      expect((serviceWithoutProviders as any).emailProvider).toBeNull();
      expect((serviceWithoutProviders as any).smsProvider).toBeNull();
    });
  });

  // ========================================
  // 8. Template Validation Tests
  // ========================================

  describe("Template Validation", () => {
    it("應該包含所有必需的通知類別模板", () => {
      const requiredCategories = [
        "leave_request_submitted",
        "leave_request_approved",
        "leave_request_rejected",
        "leave_request_cancelled",
        "schedule_created",
        "schedule_updated",
        "schedule_cancelled",
        "swap_request_created",
        "swap_request_accepted",
        "swap_request_approved",
        "swap_request_rejected",
        "shift_reminder",
      ];

      for (const category of requiredCategories) {
        expect(
          notificationTemplates[category as keyof typeof notificationTemplates],
        ).toBeDefined();
      }
    });

    it("每個模板都應該有必需的屬性", () => {
      for (const [category, template] of Object.entries(
        notificationTemplates,
      )) {
        expect(template.body).toBeDefined();
        expect(template.variables).toBeDefined();
        expect(Array.isArray(template.variables)).toBe(true);
      }
    });
  });
});

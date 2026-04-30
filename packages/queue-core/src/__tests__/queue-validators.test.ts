/**
 * Queue Validators Unit Tests
 *
 * Tests for queue validation functions and schemas
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  validateJoinQueue,
  validateCallNext,
  joinQueueSchema,
  callNextSchema,
  updateQueueSettingsSchema,
  apiResponseSchema,
  JoinQueueRequest,
  CallNextRequest,
  QueueType,
  NotificationType,
} from "../validators/queue-validators";

describe("Queue Validators", () => {
  describe("Join Queue Validation", () => {
    it("should validate valid join queue data", () => {
      const validData: JoinQueueRequest = {
        restaurantId: 1,
        customerName: "測試顧客",
        customerPhone: "012-3456789",
        customerEmail: "test@example.com",
        partySize: 4,
        specialRequests: "需要兒童座椅",
        queueType: QueueType.ONLINE,
        tablePreferences: [1, 2],
        notificationMethods: [NotificationType.SMS],
      };

      expect(() => validateJoinQueue(validData)).not.toThrow();

      const result = validateJoinQueue(validData);
      expect(result.restaurantId).toBe(1);
      expect(result.customerName).toBe("測試顧客");
      expect(result.partySize).toBe(4);
      expect(result.queueType).toBe(QueueType.ONLINE);
    });

    it("should validate minimal valid data", () => {
      const minimalData: JoinQueueRequest = {
        restaurantId: 1,
        customerName: "顧客",
        partySize: 2,
        queueType: QueueType.ONLINE,
        tablePreferences: [],
        notificationMethods: [NotificationType.SMS],
      };

      expect(() => validateJoinQueue(minimalData)).not.toThrow();

      const result = validateJoinQueue(minimalData);
      expect(result.restaurantId).toBe(1);
      expect(result.customerName).toBe("顧客");
      expect(result.partySize).toBe(2);
    });

    it("should reject invalid restaurant ID", () => {
      const invalidData = {
        restaurantId: "invalid",
        customerName: "測試顧客",
        partySize: 2,
      };

      expect(() => validateJoinQueue(invalidData as never)).toThrow();
    });

    it("should reject invalid party size", () => {
      const invalidData: JoinQueueRequest = {
        restaurantId: 1,
        customerName: "測試顧客",
        partySize: 0, // Invalid: must be positive
        queueType: QueueType.ONLINE,
        tablePreferences: [],
        notificationMethods: [NotificationType.SMS],
      };

      expect(() => validateJoinQueue(invalidData)).toThrow();
    });

    it("should reject excessively large party size", () => {
      const invalidData: JoinQueueRequest = {
        restaurantId: 1,
        customerName: "測試顧客",
        partySize: 25, // Too large
        queueType: QueueType.ONLINE,
        tablePreferences: [],
        notificationMethods: [NotificationType.SMS],
      };

      expect(() => validateJoinQueue(invalidData)).toThrow();
    });

    it("should reject empty customer name", () => {
      const invalidData: JoinQueueRequest = {
        restaurantId: 1,
        customerName: "",
        partySize: 2,
        queueType: QueueType.ONLINE,
        tablePreferences: [],
        notificationMethods: [NotificationType.SMS],
      };

      expect(() => validateJoinQueue(invalidData)).toThrow();
    });

    it("should reject excessively long customer name", () => {
      const invalidData: JoinQueueRequest = {
        restaurantId: 1,
        customerName: "a".repeat(101), // Too long
        partySize: 2,
        queueType: QueueType.ONLINE,
        tablePreferences: [],
        notificationMethods: [NotificationType.SMS],
      };

      expect(() => validateJoinQueue(invalidData)).toThrow();
    });

    it("should validate email format", () => {
      const invalidData: JoinQueueRequest = {
        restaurantId: 1,
        customerName: "測試顧客",
        customerEmail: "invalid-email",
        partySize: 2,
        queueType: QueueType.ONLINE,
        tablePreferences: [],
        notificationMethods: [NotificationType.SMS],
      };

      expect(() => validateJoinQueue(invalidData)).toThrow();
    });

    it("should validate phone number length", () => {
      const invalidData: JoinQueueRequest = {
        restaurantId: 1,
        customerName: "測試顧客",
        customerPhone: "0".repeat(25), // Too long
        partySize: 2,
        queueType: QueueType.ONLINE,
        tablePreferences: [],
        notificationMethods: [NotificationType.SMS],
      };

      expect(() => validateJoinQueue(invalidData)).toThrow();
    });

    it("should validate special requests length", () => {
      const invalidData: JoinQueueRequest = {
        restaurantId: 1,
        customerName: "測試顧客",
        partySize: 2,
        specialRequests: "a".repeat(501), // Too long
        queueType: QueueType.ONLINE,
        tablePreferences: [],
        notificationMethods: [NotificationType.SMS],
      };

      expect(() => validateJoinQueue(invalidData)).toThrow();
    });

    it("should validate table preferences array", () => {
      const invalidData: JoinQueueRequest = {
        restaurantId: 1,
        customerName: "測試顧客",
        partySize: 2,
        tablePreferences: [-1, 0], // Invalid: must be positive
        queueType: QueueType.ONLINE,
        notificationMethods: [NotificationType.SMS],
      };

      expect(() => validateJoinQueue(invalidData)).toThrow();
    });
  });

  describe("Call Next Validation", () => {
    it("should validate valid call next data", () => {
      const validData: CallNextRequest = {
        restaurantId: 1,
        tableId: 5,
      };

      expect(() => validateCallNext(validData)).not.toThrow();

      const result = validateCallNext(validData);
      expect(result.restaurantId).toBe(1);
      expect(result.tableId).toBe(5);
    });

    it("should validate minimal call next data", () => {
      const minimalData: CallNextRequest = {
        restaurantId: 1,
      };

      expect(() => validateCallNext(minimalData)).not.toThrow();

      const result = validateCallNext(minimalData);
      expect(result.restaurantId).toBe(1);
    });

    it("should reject invalid restaurant ID", () => {
      const invalidData = {
        restaurantId: "invalid",
      };

      expect(() => validateCallNext(invalidData as never)).toThrow();
    });

    it("should reject invalid table ID", () => {
      const invalidData = {
        restaurantId: 1,
        tableId: "invalid",
      };

      expect(() => validateCallNext(invalidData as never)).toThrow();
    });
  });

  describe("Update Queue Settings Validation", () => {
    it("should validate settings updates", () => {
      const validUpdates = {
        isEnabled: true,
        maxQueueSize: 50,
        avgServiceTime: 30,
      };

      expect(() => updateQueueSettingsSchema.parse(validUpdates)).not.toThrow();

      const result = updateQueueSettingsSchema.parse(validUpdates);
      expect(result.isEnabled).toBe(true);
      expect(result.maxQueueSize).toBe(50);
      expect(result.avgServiceTime).toBe(30);
    });

    it("should reject invalid settings", () => {
      const invalidData = {
        maxQueueSize: 0, // Invalid
      };

      expect(() => updateQueueSettingsSchema.parse(invalidData)).toThrow();
    });
  });

  describe("API Response Validation", () => {
    it("should validate success response", () => {
      const successResponse = {
        success: true,
        data: { queueId: "queue_123", queueNumber: 1 },
      };

      const dataSchema = z.object({
        queueId: z.string(),
        queueNumber: z.number(),
      });
      expect(() =>
        apiResponseSchema(dataSchema).parse(successResponse),
      ).not.toThrow();
    });

    it("should validate error response", () => {
      const errorResponse = {
        success: false,
        error: "Something went wrong",
      };

      const dataSchema = z.object({
        queueId: z.string(),
        queueNumber: z.number(),
      });
      expect(() =>
        apiResponseSchema(dataSchema).parse(errorResponse),
      ).not.toThrow();
    });

    it("should reject invalid response structure", () => {
      const invalidResponse = {
        success: "not_boolean",
      };

      const dataSchema = z.object({
        queueId: z.string(),
        queueNumber: z.number(),
      });
      expect(() =>
        apiResponseSchema(dataSchema).parse(invalidResponse),
      ).toThrow();
    });

    it("should validate response with timestamp", () => {
      const responseWithTimestamp = {
        success: true,
        data: { test: "data" },
        timestamp: new Date().toISOString(),
      };

      const dataSchema = z.object({ test: z.string() });
      expect(() =>
        apiResponseSchema(dataSchema).parse(responseWithTimestamp),
      ).not.toThrow();
    });
  });

  describe("Schema Integration", () => {
    it("should work with join queue schema directly", () => {
      const validData = {
        restaurantId: 1,
        customerName: "測試顧客",
        customerPhone: "012-3456789",
        partySize: 4,
        queueType: QueueType.ONLINE,
        tablePreferences: [],
        notificationMethods: [NotificationType.SMS],
      };

      expect(() => joinQueueSchema.parse(validData)).not.toThrow();

      const result = joinQueueSchema.parse(validData);
      expect(result.restaurantId).toBe(1);
      expect(result.customerName).toBe("測試顧客");
      expect(result.partySize).toBe(4);
    });

    it("should work with call next schema directly", () => {
      const validData = {
        restaurantId: 1,
        tableId: 5,
      };

      expect(() => callNextSchema.parse(validData)).not.toThrow();

      const result = callNextSchema.parse(validData);
      expect(result.restaurantId).toBe(1);
      expect(result.tableId).toBe(5);
    });

    it("should apply default values correctly", () => {
      const minimalData = {
        restaurantId: 1,
        customerName: "測試顧客",
        partySize: 2,
      };

      const result = joinQueueSchema.parse(minimalData);

      // Check defaults are applied
      expect(result.queueType).toBe(QueueType.ONLINE);
      expect(result.tablePreferences).toEqual([]);
      expect(result.notificationMethods).toEqual([NotificationType.SMS]);
    });
  });
});

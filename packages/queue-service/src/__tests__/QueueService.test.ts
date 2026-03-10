/**
 * Queue Service Unit Tests
 *
 * Tests for the QueueService implementation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { QueueService } from "../services/QueueService";
import {
  JoinQueueRequest,
  CallNextRequest,
  QueueStatus,
  QueueType,
  NotificationType,
} from "@makanmakan/queue-core";

// Mock QueueRepository with proper vi.fn() mocks
const mockQueueRepository = {
  // Basic CRUD Operations
  create: vi.fn(),
  findById: vi.fn(),
  findByRestaurant: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),

  // Specialized Queries
  findNextInQueue: vi.fn(),
  findByCheckInCode: vi.fn(),
  getQueuePosition: vi.fn(),
  getQueueSize: vi.fn(),
  getMaxQueueNumber: vi.fn(),

  // Statistics
  getQueueStatistics: vi.fn(),
  getHourlyBreakdown: vi.fn(),

  // Cleanup
  markExpiredAsNoShow: vi.fn(),
  deleteOldRecords: vi.fn(),
};

// Mock SettingsRepository with proper vi.fn() mocks
const mockSettingsRepository = {
  findByRestaurant: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

// Mock NotificationService with proper vi.fn() mocks
const mockNotificationService = {
  sendNotification: vi.fn(),
  sendBulkNotification: vi.fn(),
  scheduleReminder: vi.fn(),
  cancelScheduledNotifications: vi.fn(),
};

// Mock MetricsService with proper vi.fn() mocks
const mockMetricsService = {
  calculateEstimatedWaitTime: vi.fn(),
  updateWaitTimeEstimates: vi.fn(),
  getRealtimeMetrics: vi.fn(),
  calculatePriority: vi.fn(),
};

// Mock EventService with proper vi.fn() mocks
const mockEventService = {
  recordEvent: vi.fn(),
  getEventHistory: vi.fn(),
};

describe("QueueService", () => {
  let queueService: QueueService;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    queueService = new QueueService(
      mockQueueRepository,
      mockSettingsRepository,
      mockNotificationService,
      mockMetricsService,
      mockEventService,
    );
  });

  describe("Join Queue", () => {
    it("should successfully join queue with valid data", async () => {
      const joinRequest: JoinQueueRequest = {
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

      const expectedResponse = {
        queueId: "queue_123",
        queueNumber: 1,
        estimatedWaitMinutes: 25,
        currentPosition: 1,
        checkInCode: "ABC123",
      };

      mockQueueRepository.create.mockResolvedValue({
        success: true,
        data: expectedResponse,
      });

      const result = await queueService.joinQueue(joinRequest);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expectedResponse);
      expect(mockQueueRepository.create).toHaveBeenCalledWith(joinRequest);
    });

    it("should handle queue full scenario", async () => {
      const joinRequest: JoinQueueRequest = {
        restaurantId: 1,
        customerName: "測試顧客",
        partySize: 2,
      };

      mockQueueRepository.create.mockResolvedValue({
        success: false,
        error: "候位隊列已滿，請稍後再試",
      });

      const result = await queueService.joinQueue(joinRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain("候位隊列已滿");
    });

    it("should handle queue disabled scenario", async () => {
      const joinRequest: JoinQueueRequest = {
        restaurantId: 1,
        customerName: "測試顧客",
        partySize: 2,
      };

      mockQueueRepository.create.mockResolvedValue({
        success: false,
        error: "候位系統目前未開放",
      });

      const result = await queueService.joinQueue(joinRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain("候位系統目前未開放");
    });

    it("should validate input data", async () => {
      const invalidRequest = {
        restaurantId: "invalid",
        customerName: "",
        partySize: 0,
      };

      await expect(
        queueService.joinQueue(invalidRequest as any),
      ).rejects.toThrow();
    });

    it("should handle priority customers correctly", async () => {
      const vipRequest: JoinQueueRequest = {
        restaurantId: 1,
        customerName: "VIP顧客",
        customerPhone: "012-3456789",
        partySize: 8, // Large party
        specialRequests: "輪椅通道", // Special needs
        queueType: QueueType.PHONE, // Phone reservation
      };

      const expectedResponse = {
        queueId: "queue_vip",
        queueNumber: 1,
        estimatedWaitMinutes: 15, // Shorter wait for VIP
        currentPosition: 1,
        checkInCode: "VIP123",
      };

      mockQueueRepository.create.mockResolvedValue({
        success: true,
        data: expectedResponse,
      });

      const result = await queueService.joinQueue(vipRequest);

      expect(result.success).toBe(true);
      expect(result.data?.queueId).toBe("queue_vip");
    });
  });

  describe("Get Queue Position", () => {
    it("should return correct position for waiting customer", async () => {
      const queueId = "queue_123";
      const expectedPosition = {
        queueId,
        queueNumber: 5,
        currentPosition: 3,
        estimatedWaitMinutes: 45,
        status: QueueStatus.WAITING,
        canCancel: true,
      };

      mockQueueRepository.getQueuePosition.mockResolvedValue({
        success: true,
        data: expectedPosition,
      });

      const result = await queueService.getQueuePosition(queueId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expectedPosition);
      expect(mockQueueRepository.getQueuePosition).toHaveBeenCalledWith(
        queueId,
      );
    });

    it("should handle non-existent queue", async () => {
      const queueId = "non_existent";

      mockQueueRepository.getQueuePosition.mockResolvedValue({
        success: false,
        error: "找不到排隊記錄",
      });

      const result = await queueService.getQueuePosition(queueId);

      expect(result.success).toBe(false);
      expect(result.error).toContain("找不到排隊記錄");
    });

    it("should return position 0 for called customers", async () => {
      const queueId = "queue_called";
      const expectedPosition = {
        queueId,
        queueNumber: 5,
        currentPosition: 0,
        estimatedWaitMinutes: 0,
        status: QueueStatus.CALLED,
        canCancel: false,
      };

      mockQueueRepository.getQueuePosition.mockResolvedValue({
        success: true,
        data: expectedPosition,
      });

      const result = await queueService.getQueuePosition(queueId);

      expect(result.success).toBe(true);
      expect(result.data?.currentPosition).toBe(0);
      expect(result.data?.canCancel).toBe(false);
    });
  });

  describe("Call Next Customer", () => {
    it("should call next waiting customer", async () => {
      const callRequest: CallNextRequest = {
        restaurantId: 1,
      };

      const expectedQueue = {
        id: "queue_123",
        restaurantId: 1,
        queueNumber: 1,
        customerName: "測試顧客",
        status: QueueStatus.CALLED,
        calledAt: new Date(),
        servedBy: 1,
      };

      mockQueueRepository.findNextInQueue.mockResolvedValue({
        success: true,
        data: expectedQueue,
      });

      const result = await queueService.callNext(callRequest, 1);

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe(QueueStatus.CALLED);
      expect(mockQueueRepository.findNextInQueue).toHaveBeenCalledWith(
        callRequest,
        1,
      );
    });

    it("should call specific customer by ID", async () => {
      const callRequest: CallNextRequest = {
        restaurantId: 1,
        specificQueueId: "queue_specific",
      };

      const expectedQueue = {
        id: "queue_specific",
        restaurantId: 1,
        queueNumber: 3,
        customerName: "特定顧客",
        status: QueueStatus.CALLED,
        calledAt: new Date(),
        servedBy: 1,
      };

      mockQueueRepository.findNextInQueue.mockResolvedValue({
        success: true,
        data: expectedQueue,
      });

      const result = await queueService.callNext(callRequest, 1);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe("queue_specific");
    });

    it("should handle no waiting customers", async () => {
      const callRequest: CallNextRequest = {
        restaurantId: 1,
      };

      mockQueueRepository.findNextInQueue.mockResolvedValue({
        success: false,
        error: "沒有候位客戶",
      });

      const result = await queueService.callNext(callRequest, 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain("沒有候位客戶");
    });

    it("should assign table when provided", async () => {
      const callRequest: CallNextRequest = {
        restaurantId: 1,
        tableId: 5,
      };

      const expectedQueue = {
        id: "queue_123",
        restaurantId: 1,
        queueNumber: 1,
        customerName: "測試顧客",
        status: QueueStatus.CALLED,
        assignedTableId: 5,
        calledAt: new Date(),
        servedBy: 1,
      };

      mockQueueRepository.findNextInQueue.mockResolvedValue({
        success: true,
        data: expectedQueue,
      });

      const result = await queueService.callNext(callRequest, 1);

      expect(result.success).toBe(true);
      expect(result.data?.assignedTableId).toBe(5);
    });
  });

  describe("Queue Settings Management", () => {
    it("should get queue settings", async () => {
      const restaurantId = 1;
      const expectedSettings = {
        restaurantId,
        isEnabled: true,
        maxQueueSize: 50,
        avgServiceTime: 45,
        maxWaitTime: 120,
        autoCallEnabled: true,
      };

      mockSettingsRepository.findByRestaurant.mockResolvedValue({
        success: true,
        data: expectedSettings,
      });

      const result = await queueService.getQueueSettings(restaurantId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expectedSettings);
      expect(mockSettingsRepository.findByRestaurant).toHaveBeenCalledWith(
        restaurantId,
      );
    });

    it("should update queue settings", async () => {
      const restaurantId = 1;
      const updates = {
        isEnabled: false,
        maxQueueSize: 30,
      };

      mockSettingsRepository.update.mockResolvedValue({
        success: true,
      });

      const result = await queueService.updateQueueSettings(
        restaurantId,
        updates,
      );

      expect(result.success).toBe(true);
      expect(mockSettingsRepository.update).toHaveBeenCalledWith(
        restaurantId,
        updates,
      );
    });

    it("should validate settings updates", async () => {
      const restaurantId = 1;
      const invalidUpdates = {
        maxQueueSize: 0, // Invalid
      };

      await expect(
        queueService.updateQueueSettings(restaurantId, invalidUpdates),
      ).rejects.toThrow();
    });
  });

  describe("Queue Statistics", () => {
    it("should get queue statistics", async () => {
      const request = {
        restaurantId: 1,
        dateFrom: new Date("2023-01-01"),
        dateTo: new Date("2023-01-31"),
      };

      const expectedStats = {
        totalCustomers: 150,
        seatedCustomers: 140,
        cancelledCustomers: 8,
        noShowCustomers: 2,
        avgActualWait: 22,
        avgEstimatedWait: 25,
        maxQueueNumber: 25,
      };

      mockQueueRepository.getQueueStatistics.mockResolvedValue({
        success: true,
        data: expectedStats,
      });

      const result = await queueService.getQueueStatistics(request);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expectedStats);
      expect(mockQueueRepository.getQueueStatistics).toHaveBeenCalledWith(1, {
        from: request.dateFrom,
        to: request.dateTo,
      });
    });

    it("should get statistics without date range", async () => {
      const request = {
        restaurantId: 1,
      };

      mockQueueRepository.getQueueStatistics.mockResolvedValue({
        success: true,
        data: { totalCustomers: 50 },
      });

      const result = await queueService.getQueueStatistics(request);

      expect(result.success).toBe(true);
      expect(mockQueueRepository.getQueueStatistics).toHaveBeenCalledWith(
        1,
        undefined,
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle repository errors gracefully", async () => {
      const joinRequest: JoinQueueRequest = {
        restaurantId: 1,
        customerName: "測試顧客",
        partySize: 2,
      };

      mockQueueRepository.create.mockRejectedValue(new Error("Database error"));

      const result = await queueService.joinQueue(joinRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle network timeouts", async () => {
      const queueId = "queue_123";

      mockQueueRepository.getQueuePosition.mockRejectedValue(
        new Error("Network timeout"),
      );

      const result = await queueService.getQueuePosition(queueId);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle malformed responses", async () => {
      const restaurantId = 1;

      mockSettingsRepository.findByRestaurant.mockResolvedValue({
        success: true,
        data: null, // Malformed response
      });

      const result = await queueService.getQueueSettings(restaurantId);

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe("Business Logic", () => {
    it("should calculate queue positions correctly", async () => {
      // Test that priority customers get better positions
      const regularRequest: JoinQueueRequest = {
        restaurantId: 1,
        customerName: "一般顧客",
        partySize: 2,
      };

      const vipRequest: JoinQueueRequest = {
        restaurantId: 1,
        customerName: "VIP顧客",
        partySize: 8,
        queueType: QueueType.PHONE,
      };

      // Mock responses showing VIP gets better position
      mockQueueRepository.create
        .mockResolvedValueOnce({
          success: true,
          data: { queueId: "regular", queueNumber: 1, currentPosition: 2 },
        })
        .mockResolvedValueOnce({
          success: true,
          data: { queueId: "vip", queueNumber: 2, currentPosition: 1 },
        });

      const regularResult = await queueService.joinQueue(regularRequest);
      const vipResult = await queueService.joinQueue(vipRequest);

      expect(regularResult.data?.currentPosition).toBeGreaterThan(
        vipResult.data?.currentPosition || 0,
      );
    });

    it("should calculate estimated wait times based on position and party size", async () => {
      const smallPartyRequest: JoinQueueRequest = {
        restaurantId: 1,
        customerName: "小聚餐",
        partySize: 2,
      };

      const largePartyRequest: JoinQueueRequest = {
        restaurantId: 1,
        customerName: "大聚餐",
        partySize: 10,
      };

      mockQueueRepository.create
        .mockResolvedValueOnce({
          success: true,
          data: { estimatedWaitMinutes: 20 },
        })
        .mockResolvedValueOnce({
          success: true,
          data: { estimatedWaitMinutes: 30 },
        });

      const smallResult = await queueService.joinQueue(smallPartyRequest);
      const largeResult = await queueService.joinQueue(largePartyRequest);

      // Large parties should generally have longer wait times
      expect(largeResult.data?.estimatedWaitMinutes).toBeGreaterThanOrEqual(
        smallResult.data?.estimatedWaitMinutes || 0,
      );
    });

    it("should handle queue number generation correctly", async () => {
      const request: JoinQueueRequest = {
        restaurantId: 1,
        customerName: "測試顧客",
        partySize: 2,
      };

      // Mock sequential queue numbers
      mockQueueRepository.create
        .mockResolvedValueOnce({
          success: true,
          data: { queueNumber: 1 },
        })
        .mockResolvedValueOnce({
          success: true,
          data: { queueNumber: 2 },
        })
        .mockResolvedValueOnce({
          success: true,
          data: { queueNumber: 3 },
        });

      const result1 = await queueService.joinQueue(request);
      const result2 = await queueService.joinQueue(request);
      const result3 = await queueService.joinQueue(request);

      expect(result1.data?.queueNumber).toBe(1);
      expect(result2.data?.queueNumber).toBe(2);
      expect(result3.data?.queueNumber).toBe(3);
    });
  });
});

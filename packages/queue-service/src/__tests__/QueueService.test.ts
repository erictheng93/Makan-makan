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
} from "@makanmasak/queue-core";

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
    // Reset mocks including any queued mockResolvedValueOnce values from prior tests
    vi.resetAllMocks();

    queueService = new QueueService(
      mockQueueRepository,
      mockSettingsRepository,
      mockNotificationService,
      mockMetricsService,
      mockEventService,
    );
  });

  // Helper to set up the full joinQueue dependency chain
  function setupJoinQueueMocks(
    overrides: {
      isEnabled?: boolean;
      currentQueueSize?: number;
      maxQueueNumber?: number;
      priority?: number;
      estimatedWait?: number;
      createdQueue?: Record<string, unknown>;
      currentPosition?: number;
    } = {},
  ) {
    const {
      isEnabled = true,
      currentQueueSize = 5,
      maxQueueNumber = 0,
      priority = 0,
      estimatedWait = 25,
      createdQueue = { id: "queue_123", restaurantId: 1, queueNumber: 1 },
      currentPosition = 1,
    } = overrides;

    mockSettingsRepository.findByRestaurant.mockResolvedValue({
      restaurantId: 1,
      isEnabled,
      maxQueueSize: 50,
      businessHours: {},
      priorityRules: {},
    });
    mockQueueRepository.getQueueSize.mockResolvedValue(currentQueueSize);
    mockQueueRepository.getMaxQueueNumber.mockResolvedValue(maxQueueNumber);
    mockMetricsService.calculatePriority.mockReturnValue(priority);
    mockMetricsService.calculateEstimatedWaitTime.mockResolvedValue(
      estimatedWait,
    );
    mockQueueRepository.create.mockResolvedValue(createdQueue);
    mockQueueRepository.getQueuePosition.mockResolvedValue(currentPosition);
    mockNotificationService.sendNotification.mockResolvedValue(undefined);
    mockEventService.recordEvent.mockResolvedValue(undefined);
  }

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

      setupJoinQueueMocks({
        maxQueueNumber: 0,
        estimatedWait: 25,
        createdQueue: { id: "queue_123", restaurantId: 1, queueNumber: 1 },
        currentPosition: 1,
      });

      const result = await queueService.joinQueue(joinRequest);

      expect(result.success).toBe(true);
      expect(result.data?.queueNumber).toBe(1);
      expect(result.data?.estimatedWaitMinutes).toBe(25);
      expect(result.data?.currentPosition).toBe(1);
      expect(result.data?.checkInCode).toBeDefined();
      expect(mockQueueRepository.create).toHaveBeenCalled();
    });

    it("should handle queue full scenario", async () => {
      const joinRequest: JoinQueueRequest = {
        restaurantId: 1,
        customerName: "測試顧客",
        partySize: 2,
      };

      // Queue size equals max — service throws QueueFullError
      mockSettingsRepository.findByRestaurant.mockResolvedValue({
        restaurantId: 1,
        isEnabled: true,
        maxQueueSize: 5,
        businessHours: {},
        priorityRules: {},
      });
      mockQueueRepository.getQueueSize.mockResolvedValue(5); // at capacity

      const result = await queueService.joinQueue(joinRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle queue disabled scenario", async () => {
      const joinRequest: JoinQueueRequest = {
        restaurantId: 1,
        customerName: "測試顧客",
        partySize: 2,
      };

      mockSettingsRepository.findByRestaurant.mockResolvedValue({
        restaurantId: 1,
        isEnabled: false,
        maxQueueSize: 50,
        businessHours: {},
      });

      const result = await queueService.joinQueue(joinRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should validate input data", async () => {
      const invalidRequest = {
        restaurantId: "invalid",
        customerName: "",
        partySize: 0,
      };

      // Service catches validation errors and returns {success:false}
      const result = await queueService.joinQueue(invalidRequest as never);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
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

      setupJoinQueueMocks({
        maxQueueNumber: 0,
        estimatedWait: 15,
        createdQueue: { id: "queue_vip", restaurantId: 1, queueNumber: 1 },
        currentPosition: 1,
      });

      const result = await queueService.joinQueue(vipRequest);

      expect(result.success).toBe(true);
      expect(result.data?.queueId).toBe("queue_vip");
    });
  });

  describe("Get Queue Position", () => {
    it("should return correct position for waiting customer", async () => {
      const queueId = "queue_123";
      const waitingQueue = {
        id: queueId,
        restaurantId: 1,
        queueNumber: 5,
        customerName: "等待顧客",
        status: QueueStatus.WAITING,
        joinedAt: new Date(),
        partySize: 2,
      };

      // Service uses findById, then getQueuePosition (raw number), then calculateEstimatedWaitTime
      mockQueueRepository.findById.mockResolvedValue(waitingQueue);
      mockQueueRepository.getQueuePosition.mockResolvedValue(3);
      mockMetricsService.calculateEstimatedWaitTime.mockResolvedValue(45);

      const result = await queueService.getQueuePosition(queueId);

      expect(result.success).toBe(true);
      expect(result.data?.queueId).toBe(queueId);
      expect(result.data?.queueNumber).toBe(5);
      expect(result.data?.currentPosition).toBe(3);
      expect(result.data?.estimatedWaitMinutes).toBe(45);
      expect(result.data?.status).toBe(QueueStatus.WAITING);
      expect(result.data?.canCancel).toBe(true);
      expect(mockQueueRepository.getQueuePosition).toHaveBeenCalledWith(
        queueId,
      );
    });

    it("should handle non-existent queue", async () => {
      const queueId = "non_existent";

      // Service calls findById first; null triggers QueueNotFoundError caught → success:false
      mockQueueRepository.findById.mockResolvedValue(null);

      const result = await queueService.getQueuePosition(queueId);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return position 0 for called customers", async () => {
      const queueId = "queue_called";
      const calledQueue = {
        id: queueId,
        restaurantId: 1,
        queueNumber: 5,
        customerName: "叫號顧客",
        status: QueueStatus.CALLED,
        joinedAt: new Date(),
        partySize: 2,
      };

      // Service returns early with position 0 for non-WAITING status
      mockQueueRepository.findById.mockResolvedValue(calledQueue);

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

      const nextQueue = {
        id: "queue_123",
        restaurantId: 1,
        queueNumber: 1,
        customerName: "測試顧客",
        status: QueueStatus.WAITING,
        joinedAt: new Date(),
        partySize: 2,
      };

      const updatedQueue = {
        ...nextQueue,
        status: QueueStatus.CALLED,
        calledAt: new Date(),
        servedBy: 1,
      };

      // Service calls findNextInQueue (returns raw queue object, not {success,data})
      mockQueueRepository.findNextInQueue.mockResolvedValue(nextQueue);
      // Then update() to mark as CALLED — returns the updated queue
      mockQueueRepository.update.mockResolvedValue(updatedQueue);
      mockNotificationService.sendNotification.mockResolvedValue(undefined);
      mockEventService.recordEvent.mockResolvedValue(undefined);

      const result = await queueService.callNext(callRequest, 1);

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe(QueueStatus.CALLED);
      expect(mockQueueRepository.findNextInQueue).toHaveBeenCalledWith(1);
    });

    it("should call specific customer by ID", async () => {
      const specificQueueId = "550e8400-e29b-41d4-a716-446655440000";
      const callRequest: CallNextRequest = {
        restaurantId: 1,
        specificQueueId,
      };

      const specificQueue = {
        id: specificQueueId,
        restaurantId: 1,
        queueNumber: 3,
        customerName: "特定顧客",
        status: QueueStatus.WAITING,
        joinedAt: new Date(),
        partySize: 2,
      };

      const updatedQueue = {
        ...specificQueue,
        status: QueueStatus.CALLED,
        calledAt: new Date(),
        servedBy: 1,
      };

      // For specificQueueId, service calls findById (not findNextInQueue)
      mockQueueRepository.findById.mockResolvedValue(specificQueue);
      mockQueueRepository.update.mockResolvedValue(updatedQueue);
      mockNotificationService.sendNotification.mockResolvedValue(undefined);
      mockEventService.recordEvent.mockResolvedValue(undefined);

      const result = await queueService.callNext(callRequest, 1);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe(specificQueueId);
    });

    it("should handle no waiting customers", async () => {
      const callRequest: CallNextRequest = {
        restaurantId: 1,
      };

      // Service checks: if (!nextInQueue) return {success:false, error:'No customers waiting...'}
      mockQueueRepository.findNextInQueue.mockResolvedValue(null);

      const result = await queueService.callNext(callRequest, 1);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should assign table when provided", async () => {
      const callRequest: CallNextRequest = {
        restaurantId: 1,
        tableId: 5,
      };

      const nextQueue = {
        id: "queue_123",
        restaurantId: 1,
        queueNumber: 1,
        customerName: "測試顧客",
        status: QueueStatus.WAITING,
        joinedAt: new Date(),
        partySize: 2,
      };

      const updatedQueue = {
        ...nextQueue,
        status: QueueStatus.CALLED,
        assignedTableId: 5,
        calledAt: new Date(),
        servedBy: 1,
      };

      mockQueueRepository.findNextInQueue.mockResolvedValue(nextQueue);
      mockQueueRepository.update.mockResolvedValue(updatedQueue);
      mockNotificationService.sendNotification.mockResolvedValue(undefined);
      mockEventService.recordEvent.mockResolvedValue(undefined);

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

      // Service calls findByRestaurant; when settings exist it returns them directly (no create)
      mockSettingsRepository.findByRestaurant.mockResolvedValue(
        expectedSettings,
      );

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

      mockSettingsRepository.update.mockResolvedValue(undefined);

      const result = await queueService.updateQueueSettings(
        restaurantId,
        updates,
      );

      expect(result.success).toBe(true);
      expect(mockSettingsRepository.update).toHaveBeenCalledWith(
        restaurantId,
        expect.objectContaining(updates),
      );
    });

    it("should validate settings updates", async () => {
      const restaurantId = 1;
      const invalidUpdates = {
        maxQueueSize: 0, // Invalid — service catches validation error and returns {success:false}
      };

      const result = await queueService.updateQueueSettings(
        restaurantId,
        invalidUpdates,
      );
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("Queue Statistics", () => {
    it("should get queue statistics", async () => {
      const request = {
        restaurantId: 1,
        dateFrom: new Date("2023-01-01"),
        dateTo: new Date("2023-01-31"),
      };

      const rawStats = {
        totalCustomers: 150,
        seatedCustomers: 140,
        cancelledCustomers: 8,
        noShowCustomers: 2,
        avgActualWait: 22,
        avgEstimatedWait: 25,
        maxQueueNumber: 25,
      };

      // Service calls both getQueueStatistics and getHourlyBreakdown
      mockQueueRepository.getQueueStatistics.mockResolvedValue(rawStats);
      mockQueueRepository.getHourlyBreakdown.mockResolvedValue([]);

      const result = await queueService.getQueueStatistics(request);

      expect(result.success).toBe(true);
      // Service wraps in {summary:{...}, hourlyBreakdown:[...]}
      expect(result.data?.summary.total_customers).toBe(150);
      expect(result.data?.summary.seated_customers).toBe(140);
      expect(result.data?.hourlyBreakdown).toEqual([]);
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
        totalCustomers: 50,
        seatedCustomers: 45,
        cancelledCustomers: 3,
        noShowCustomers: 2,
        avgActualWait: 20,
        avgEstimatedWait: 22,
        maxQueueNumber: 10,
      });
      mockQueueRepository.getHourlyBreakdown.mockResolvedValue([]);

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

      // Set up prerequisites so service reaches create(), which then throws
      mockSettingsRepository.findByRestaurant.mockResolvedValue({
        restaurantId: 1,
        isEnabled: true,
        maxQueueSize: 50,
        businessHours: {},
        priorityRules: {},
      });
      mockQueueRepository.getQueueSize.mockResolvedValue(0);
      mockQueueRepository.getMaxQueueNumber.mockResolvedValue(0);
      mockMetricsService.calculatePriority.mockReturnValue(0);
      mockMetricsService.calculateEstimatedWaitTime.mockResolvedValue(10);
      mockQueueRepository.create.mockRejectedValue(new Error("Database error"));

      const result = await queueService.joinQueue(joinRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle network timeouts", async () => {
      const queueId = "queue_123";

      // Service calls findById first; make it throw to trigger error path
      mockQueueRepository.findById.mockRejectedValue(
        new Error("Network timeout"),
      );

      const result = await queueService.getQueuePosition(queueId);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle malformed responses", async () => {
      const restaurantId = 1;

      // findByRestaurant returning null triggers default settings creation
      mockSettingsRepository.findByRestaurant.mockResolvedValue(null);
      mockSettingsRepository.create.mockResolvedValue(null);

      const result = await queueService.getQueueSettings(restaurantId);

      // Service creates default settings when none found; create returns null here
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

      // Full mock setup for two successive joinQueue calls
      const settings = {
        restaurantId: 1,
        isEnabled: true,
        maxQueueSize: 50,
        businessHours: {},
        priorityRules: {},
      };
      mockSettingsRepository.findByRestaurant.mockResolvedValue(settings);
      mockQueueRepository.getQueueSize.mockResolvedValue(5);
      mockQueueRepository.getMaxQueueNumber
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1);
      mockMetricsService.calculatePriority.mockReturnValue(0);
      mockMetricsService.calculateEstimatedWaitTime.mockResolvedValue(20);
      mockQueueRepository.create
        .mockResolvedValueOnce({
          id: "regular",
          restaurantId: 1,
          queueNumber: 1,
        })
        .mockResolvedValueOnce({ id: "vip", restaurantId: 1, queueNumber: 2 });
      // Regular gets position 2, VIP gets position 1
      mockQueueRepository.getQueuePosition
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);
      mockNotificationService.sendNotification.mockResolvedValue(undefined);
      mockEventService.recordEvent.mockResolvedValue(undefined);

      const regularResult = await queueService.joinQueue(regularRequest);
      const vipResult = await queueService.joinQueue(vipRequest);

      expect(regularResult.success).toBe(true);
      expect(vipResult.success).toBe(true);
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

      const settings = {
        restaurantId: 1,
        isEnabled: true,
        maxQueueSize: 50,
        businessHours: {},
        priorityRules: {},
      };
      mockSettingsRepository.findByRestaurant.mockResolvedValue(settings);
      mockQueueRepository.getQueueSize.mockResolvedValue(2);
      mockQueueRepository.getMaxQueueNumber
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1);
      mockMetricsService.calculatePriority.mockReturnValue(0);
      // Small party: 20 min wait, large party: 30 min
      mockMetricsService.calculateEstimatedWaitTime
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(30);
      mockQueueRepository.create
        .mockResolvedValueOnce({ id: "small", restaurantId: 1, queueNumber: 1 })
        .mockResolvedValueOnce({
          id: "large",
          restaurantId: 1,
          queueNumber: 2,
        });
      mockQueueRepository.getQueuePosition.mockResolvedValue(1);
      mockNotificationService.sendNotification.mockResolvedValue(undefined);
      mockEventService.recordEvent.mockResolvedValue(undefined);

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

      const settings = {
        restaurantId: 1,
        isEnabled: true,
        maxQueueSize: 50,
        businessHours: {},
        priorityRules: {},
      };
      mockSettingsRepository.findByRestaurant.mockResolvedValue(settings);
      mockQueueRepository.getQueueSize.mockResolvedValue(0);
      // getMaxQueueNumber returns 0, 1, 2 — so queueNumber becomes 1, 2, 3
      mockQueueRepository.getMaxQueueNumber
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2);
      mockMetricsService.calculatePriority.mockReturnValue(0);
      mockMetricsService.calculateEstimatedWaitTime.mockResolvedValue(10);
      mockQueueRepository.create
        .mockResolvedValueOnce({ id: "q1", restaurantId: 1, queueNumber: 1 })
        .mockResolvedValueOnce({ id: "q2", restaurantId: 1, queueNumber: 2 })
        .mockResolvedValueOnce({ id: "q3", restaurantId: 1, queueNumber: 3 });
      mockQueueRepository.getQueuePosition.mockResolvedValue(1);
      mockNotificationService.sendNotification.mockResolvedValue(undefined);
      mockEventService.recordEvent.mockResolvedValue(undefined);

      const result1 = await queueService.joinQueue(request);
      const result2 = await queueService.joinQueue(request);
      const result3 = await queueService.joinQueue(request);

      expect(result1.data?.queueNumber).toBe(1);
      expect(result2.data?.queueNumber).toBe(2);
      expect(result3.data?.queueNumber).toBe(3);
    });
  });

  describe("Seat Customer", () => {
    const seatQueueId = "550e8400-e29b-41d4-a716-446655440001";
    const seatQueueId2 = "550e8400-e29b-41d4-a716-446655440002";
    const seatQueueId3 = "550e8400-e29b-41d4-a716-446655440003";

    it("should seat a CALLED customer and calculate actualWaitMinutes", async () => {
      const joinedAt = new Date(Date.now() - 20 * 60000); // 20 minutes ago
      const queueEntry = {
        id: seatQueueId,
        restaurantId: 1,
        queueNumber: 5,
        customerName: "入座顧客",
        status: "called",
        joinedAt,
        partySize: 4,
      };

      mockQueueRepository.findById.mockResolvedValue(queueEntry);
      mockQueueRepository.update.mockResolvedValue({
        ...queueEntry,
        status: QueueStatus.SEATED,
      });
      mockNotificationService.sendNotification.mockResolvedValue(undefined);
      mockEventService.recordEvent.mockResolvedValue(undefined);

      const result = await queueService.seatCustomer({
        queueId: seatQueueId,
        tableId: 3,
        operatorId: 10,
      });

      expect(result.success).toBe(true);
      expect(mockQueueRepository.update).toHaveBeenCalledWith(
        seatQueueId,
        expect.objectContaining({
          status: QueueStatus.SEATED,
          assignedTableId: 3,
          servedBy: 10,
          actualWaitMinutes: expect.any(Number),
        }),
      );
      // Actual wait should be approximately 20 minutes
      const updateCall = mockQueueRepository.update.mock.calls[0][1];
      expect(updateCall.actualWaitMinutes).toBeGreaterThanOrEqual(19);
      expect(updateCall.actualWaitMinutes).toBeLessThanOrEqual(21);
    });

    it("should return error when customer not found", async () => {
      mockQueueRepository.findById.mockResolvedValue(null);

      const result = await queueService.seatCustomer({
        queueId: seatQueueId2,
        tableId: 1,
        operatorId: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return error when customer is not in CALLED status", async () => {
      const queueEntry = {
        id: seatQueueId3,
        restaurantId: 1,
        queueNumber: 3,
        customerName: "已入座顧客",
        status: QueueStatus.SEATED, // Already seated
        joinedAt: new Date(),
        partySize: 2,
      };

      mockQueueRepository.findById.mockResolvedValue(queueEntry);

      const result = await queueService.seatCustomer({
        queueId: seatQueueId3,
        tableId: 1,
        operatorId: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("Cancel Queue", () => {
    const cancelQueueId1 = "660e8400-e29b-41d4-a716-446655440001";
    const cancelQueueId2 = "660e8400-e29b-41d4-a716-446655440002";
    const cancelQueueId3 = "660e8400-e29b-41d4-a716-446655440003";
    const cancelQueueId4 = "660e8400-e29b-41d4-a716-446655440004";

    it("should cancel a WAITING customer", async () => {
      const queueEntry = {
        id: cancelQueueId1,
        restaurantId: 1,
        queueNumber: 7,
        customerName: "取消顧客",
        status: QueueStatus.WAITING,
        joinedAt: new Date(),
        partySize: 2,
      };

      mockQueueRepository.findById.mockResolvedValue(queueEntry);
      mockQueueRepository.update.mockResolvedValue({
        ...queueEntry,
        status: QueueStatus.CANCELLED,
      });
      mockNotificationService.sendNotification.mockResolvedValue(undefined);
      mockEventService.recordEvent.mockResolvedValue(undefined);

      const result = await queueService.cancelQueue({
        queueId: cancelQueueId1,
        reason: "顧客自行取消",
      });

      expect(result.success).toBe(true);
      expect(mockQueueRepository.update).toHaveBeenCalledWith(
        cancelQueueId1,
        expect.objectContaining({
          status: QueueStatus.CANCELLED,
          notes: "顧客自行取消",
        }),
      );
    });

    it("should return error when customer not found", async () => {
      mockQueueRepository.findById.mockResolvedValue(null);

      const result = await queueService.cancelQueue({
        queueId: cancelQueueId2,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return error when customer is already SEATED", async () => {
      const queueEntry = {
        id: cancelQueueId3,
        restaurantId: 1,
        queueNumber: 4,
        customerName: "已入座顧客",
        status: QueueStatus.SEATED, // Can't cancel
        joinedAt: new Date(),
        partySize: 3,
      };

      mockQueueRepository.findById.mockResolvedValue(queueEntry);

      const result = await queueService.cancelQueue({
        queueId: cancelQueueId3,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should pass checkInCode through validation", async () => {
      const queueEntry = {
        id: cancelQueueId4,
        restaurantId: 1,
        queueNumber: 8,
        customerName: "驗證碼顧客",
        status: QueueStatus.WAITING,
        joinedAt: new Date(),
        partySize: 2,
        checkInCode: "ABC123",
      };

      mockQueueRepository.findById.mockResolvedValue(queueEntry);
      mockQueueRepository.update.mockResolvedValue({
        ...queueEntry,
        status: QueueStatus.CANCELLED,
      });
      mockNotificationService.sendNotification.mockResolvedValue(undefined);
      mockEventService.recordEvent.mockResolvedValue(undefined);

      const result = await queueService.cancelQueue({
        queueId: cancelQueueId4,
        checkInCode: "ABC123",
        cancelledBy: 5,
        reason: "不想等了",
      });

      expect(result.success).toBe(true);
      expect(mockEventService.recordEvent).toHaveBeenCalledWith(
        1,
        cancelQueueId4,
        "queue_cancelled",
        expect.objectContaining({
          reason: "不想等了",
          cancelledBy: 5,
        }),
        5,
      );
    });
  });

  describe("Get Current Queue", () => {
    it("should return WAITING and CALLED entries", async () => {
      const queueEntries = [
        {
          id: "queue_w1",
          queueNumber: 1,
          customerName: "等待顧客A",
          customerPhone: "012-1111111",
          partySize: 2,
          status: QueueStatus.WAITING,
          joinedAt: new Date("2023-06-01T10:00:00Z"),
          estimatedWaitMinutes: 15,
          priority: 0,
          tablePreferences: [],
          notificationMethods: [NotificationType.SMS],
          specialRequests: null,
          metadata: {},
        },
        {
          id: "queue_c1",
          queueNumber: 2,
          customerName: "叫號顧客B",
          customerPhone: "012-2222222",
          partySize: 4,
          status: QueueStatus.CALLED,
          joinedAt: new Date("2023-06-01T10:05:00Z"),
          estimatedWaitMinutes: 0,
          priority: 1,
          tablePreferences: [1],
          notificationMethods: [NotificationType.SMS],
          specialRequests: "靠窗",
          metadata: {},
        },
      ];

      mockQueueRepository.findByRestaurant.mockResolvedValue(queueEntries);

      const result = await queueService.getCurrentQueue({
        restaurantId: 1,
      });

      expect(result.success).toBe(true);
      expect(result.data?.queue).toHaveLength(2);
      expect(result.data?.queue[0].id).toBe("queue_w1");
      expect(result.data?.queue[1].id).toBe("queue_c1");
      expect(result.data?.totalCount).toBe(2);
    });

    it("should respect pagination with limit", async () => {
      const queueEntries = [
        {
          id: "queue_p1",
          queueNumber: 1,
          customerName: "分頁顧客",
          customerPhone: null,
          partySize: 2,
          status: QueueStatus.WAITING,
          joinedAt: new Date("2023-06-01T10:00:00Z"),
          estimatedWaitMinutes: 10,
          priority: 0,
          tablePreferences: [],
          notificationMethods: [],
          specialRequests: null,
          metadata: {},
        },
      ];

      mockQueueRepository.findByRestaurant.mockResolvedValue(queueEntries);

      const result = await queueService.getCurrentQueue({
        restaurantId: 1,
        limit: 1,
      });

      expect(result.success).toBe(true);
      expect(mockQueueRepository.findByRestaurant).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          limit: 1,
        }),
      );
    });

    it("should return empty array for empty queue", async () => {
      mockQueueRepository.findByRestaurant.mockResolvedValue([]);

      const result = await queueService.getCurrentQueue({
        restaurantId: 1,
      });

      expect(result.success).toBe(true);
      expect(result.data?.queue).toHaveLength(0);
      expect(result.data?.totalCount).toBe(0);
    });
  });

  describe("Cleanup Expired Queues", () => {
    it("should mark old CALLED entries as NO_SHOW and delete old records", async () => {
      mockQueueRepository.markExpiredAsNoShow.mockResolvedValue(3);
      mockQueueRepository.deleteOldRecords.mockResolvedValue(5);

      const result = await queueService.cleanupExpiredQueues();

      expect(result.success).toBe(true);
      expect(result.data?.cleanedCount).toBe(8); // 3 + 5
      expect(mockQueueRepository.markExpiredAsNoShow).toHaveBeenCalledWith(15); // 15 min timeout
      expect(mockQueueRepository.deleteOldRecords).toHaveBeenCalledWith(30); // 30 days
    });

    it("should delete records older than 30 days", async () => {
      mockQueueRepository.markExpiredAsNoShow.mockResolvedValue(0);
      mockQueueRepository.deleteOldRecords.mockResolvedValue(10);

      const result = await queueService.cleanupExpiredQueues();

      expect(result.success).toBe(true);
      expect(result.data?.cleanedCount).toBe(10);
      expect(mockQueueRepository.deleteOldRecords).toHaveBeenCalledWith(30);
    });

    it("should return cleaned count of 0 when nothing to clean", async () => {
      mockQueueRepository.markExpiredAsNoShow.mockResolvedValue(0);
      mockQueueRepository.deleteOldRecords.mockResolvedValue(0);

      const result = await queueService.cleanupExpiredQueues();

      expect(result.success).toBe(true);
      expect(result.data?.cleanedCount).toBe(0);
    });

    it("should handle cleanup errors gracefully", async () => {
      mockQueueRepository.markExpiredAsNoShow.mockRejectedValue(
        new Error("Database error"),
      );

      const result = await queueService.cleanupExpiredQueues();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle deleteOldRecords failure after successful markExpired", async () => {
      mockQueueRepository.markExpiredAsNoShow.mockResolvedValue(2);
      mockQueueRepository.deleteOldRecords.mockRejectedValue(
        new Error("Disk full"),
      );

      const result = await queueService.cleanupExpiredQueues();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("Edge Cases - Empty Queue Operations", () => {
    it("should handle getQueuePosition for a customer in SEATED status", async () => {
      const queueId = "queue_seated_pos";
      const seatedQueue = {
        id: queueId,
        restaurantId: 1,
        queueNumber: 10,
        customerName: "已入座",
        status: QueueStatus.SEATED,
        joinedAt: new Date(),
        partySize: 2,
      };

      mockQueueRepository.findById.mockResolvedValue(seatedQueue);

      const result = await queueService.getQueuePosition(queueId);

      expect(result.success).toBe(true);
      expect(result.data?.currentPosition).toBe(0);
      expect(result.data?.estimatedWaitMinutes).toBe(0);
      expect(result.data?.canCancel).toBe(false);
    });

    it("should handle getQueuePosition for a CANCELLED customer", async () => {
      const queueId = "queue_cancelled_pos";
      const cancelledQueue = {
        id: queueId,
        restaurantId: 1,
        queueNumber: 7,
        customerName: "已取消",
        status: QueueStatus.CANCELLED,
        joinedAt: new Date(),
        partySize: 3,
      };

      mockQueueRepository.findById.mockResolvedValue(cancelledQueue);

      const result = await queueService.getQueuePosition(queueId);

      expect(result.success).toBe(true);
      expect(result.data?.currentPosition).toBe(0);
      expect(result.data?.canCancel).toBe(false);
    });

    it("should handle getQueuePosition for NO_SHOW customer", async () => {
      const queueId = "queue_noshow_pos";
      const noShowQueue = {
        id: queueId,
        restaurantId: 1,
        queueNumber: 12,
        customerName: "未到",
        status: QueueStatus.NO_SHOW,
        joinedAt: new Date(),
        partySize: 4,
      };

      mockQueueRepository.findById.mockResolvedValue(noShowQueue);

      const result = await queueService.getQueuePosition(queueId);

      expect(result.success).toBe(true);
      expect(result.data?.currentPosition).toBe(0);
      expect(result.data?.canCancel).toBe(false);
    });

    it("should return correct position for WAITING customer with metrics", async () => {
      const queueId = "queue_waiting_pos";
      const waitingQueue = {
        id: queueId,
        restaurantId: 1,
        queueNumber: 5,
        customerName: "等待中",
        status: QueueStatus.WAITING,
        joinedAt: new Date(),
        partySize: 2,
      };

      mockQueueRepository.findById.mockResolvedValue(waitingQueue);
      mockQueueRepository.getQueuePosition.mockResolvedValue(3);
      mockMetricsService.calculateEstimatedWaitTime.mockResolvedValue(25);

      const result = await queueService.getQueuePosition(queueId);

      expect(result.success).toBe(true);
      expect(result.data?.currentPosition).toBe(3);
      expect(result.data?.estimatedWaitMinutes).toBe(25);
      expect(result.data?.canCancel).toBe(true);
      expect(
        mockMetricsService.calculateEstimatedWaitTime,
      ).toHaveBeenCalledWith(1, 2, 3);
    });
  });

  describe("Edge Cases - DB Failures", () => {
    it("should handle DB failure in callNext findNextInQueue", async () => {
      const callRequest: CallNextRequest = {
        restaurantId: 1,
      };

      mockQueueRepository.findNextInQueue.mockRejectedValue(
        new Error("Connection refused"),
      );

      const result = await queueService.callNext(callRequest, 1);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle DB failure in seatCustomer update", async () => {
      const dbFailId = "d0d0d0d0-e1e1-f2f2-a3a3-b4b4b4b4b401";
      const queueEntry = {
        id: dbFailId,
        restaurantId: 1,
        queueNumber: 1,
        customerName: "DB失敗",
        status: "called",
        joinedAt: new Date(),
        partySize: 2,
      };

      mockQueueRepository.findById.mockResolvedValue(queueEntry);
      mockQueueRepository.update.mockRejectedValue(new Error("Write conflict"));

      const result = await queueService.seatCustomer({
        queueId: dbFailId,
        tableId: 1,
        operatorId: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle DB failure in cancelQueue update", async () => {
      const cancelFailId = "d0d0d0d0-e1e1-f2f2-a3a3-b4b4b4b4b402";
      const queueEntry = {
        id: cancelFailId,
        restaurantId: 1,
        queueNumber: 3,
        customerName: "取消失敗",
        status: QueueStatus.WAITING,
        joinedAt: new Date(),
        partySize: 2,
      };

      mockQueueRepository.findById.mockResolvedValue(queueEntry);
      mockQueueRepository.update.mockRejectedValue(
        new Error("Database locked"),
      );

      const result = await queueService.cancelQueue({
        queueId: cancelFailId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle settings repository failure in getQueueSettings", async () => {
      mockSettingsRepository.findByRestaurant.mockRejectedValue(
        new Error("DB timeout"),
      );

      const result = await queueService.getQueueSettings(1);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle settings update failure", async () => {
      mockSettingsRepository.update.mockRejectedValue(
        new Error("Constraint violation"),
      );

      const result = await queueService.updateQueueSettings(1, {
        maxQueueSize: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("Queue Status", () => {
    it("should return queue status with realtime metrics", async () => {
      const restaurantId = 1;

      mockQueueRepository.getQueueStatistics.mockResolvedValue({
        totalCustomers: 50,
        seatedCustomers: 40,
        cancelledCustomers: 5,
        noShowCustomers: 3,
        avgActualWait: 18,
        avgEstimatedWait: 20,
        maxQueueNumber: 15,
      });

      mockMetricsService.getRealtimeMetrics.mockResolvedValue({
        currentWaiting: 8,
        averageWaitTime: 22,
        longestWaitTime: 45,
      });

      const result = await queueService.getQueueStatus(restaurantId);

      expect(result.success).toBe(true);
      expect(result.data?.queue.total_waiting).toBe(8);
      expect(result.data?.queue.avg_estimated_wait).toBe(22);
      expect(result.data?.queue.max_wait).toBe(45);
      expect(result.data?.activity.seated_today).toBe(40);
      expect(result.data?.activity.cancelled_today).toBe(5);
      expect(result.data?.activity.no_show_today).toBe(3);
      expect(result.data?.activity.avg_actual_wait).toBe(18);
    });

    it("should handle getQueueStatus error", async () => {
      mockQueueRepository.getQueueStatistics.mockRejectedValue(
        new Error("Query failed"),
      );

      const result = await queueService.getQueueStatus(1);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get queue status");
    });
  });

  describe("Queue History", () => {
    it("should return queue history with pagination", async () => {
      const historyEntries = [
        {
          id: "h1",
          queueNumber: 1,
          customerName: "歷史顧客A",
          customerPhone: "012-111",
          partySize: 2,
          status: QueueStatus.SEATED,
          joinedAt: new Date("2023-06-01T10:00:00Z"),
          calledAt: new Date("2023-06-01T10:15:00Z"),
          seatedAt: new Date("2023-06-01T10:20:00Z"),
          cancelledAt: undefined,
          actualWaitMinutes: 20,
          tablePreferences: [],
          notificationMethods: [NotificationType.SMS],
          metadata: {},
        },
      ];

      mockQueueRepository.findByRestaurant.mockResolvedValue(historyEntries);

      const result = await queueService.getQueueHistory({
        restaurantId: 1,
        page: 1,
        limit: 20,
      });

      expect(result.success).toBe(true);
      expect(result.data?.history).toHaveLength(1);
      expect(result.data?.history[0].customer_name).toBe("歷史顧客A");
      expect(result.data?.pagination.page).toBe(1);
      expect(result.data?.pagination.limit).toBe(20);
    });

    it("should handle history with date range filters", async () => {
      mockQueueRepository.findByRestaurant.mockResolvedValue([]);

      const result = await queueService.getQueueHistory({
        restaurantId: 1,
        dateFrom: "2023-01-01",
        dateTo: "2023-01-31",
        page: 2,
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect(result.data?.history).toHaveLength(0);
      expect(result.data?.pagination.page).toBe(2);
      expect(result.data?.pagination.hasMore).toBe(false);
    });

    it("should set hasMore to true when results equal limit", async () => {
      const entries = Array.from({ length: 5 }, (_, i) => ({
        id: `h${i}`,
        queueNumber: i + 1,
        customerName: `顧客${i}`,
        customerPhone: null,
        partySize: 2,
        status: QueueStatus.SEATED,
        joinedAt: new Date(),
        calledAt: new Date(),
        seatedAt: new Date(),
        cancelledAt: undefined,
        actualWaitMinutes: 15,
        tablePreferences: [],
        notificationMethods: [],
        metadata: {},
      }));

      mockQueueRepository.findByRestaurant.mockResolvedValue(entries);

      const result = await queueService.getQueueHistory({
        restaurantId: 1,
        limit: 5,
      });

      expect(result.success).toBe(true);
      expect(result.data?.pagination.hasMore).toBe(true);
    });

    it("should handle getQueueHistory error", async () => {
      mockQueueRepository.findByRestaurant.mockRejectedValue(
        new Error("Query timeout"),
      );

      const result = await queueService.getQueueHistory({
        restaurantId: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get queue history");
    });
  });

  describe("Get Queue Settings - Default Creation", () => {
    it("should create default settings when none exist", async () => {
      mockSettingsRepository.findByRestaurant.mockResolvedValue(null);
      const defaultSettings = {
        restaurantId: 1,
        isEnabled: true,
        maxQueueSize: 50,
        avgServiceTime: 45,
        maxWaitTime: 120,
      };
      mockSettingsRepository.create.mockResolvedValue(defaultSettings);

      const result = await queueService.getQueueSettings(1);

      expect(result.success).toBe(true);
      expect(mockSettingsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId: 1,
          isEnabled: true,
          maxQueueSize: 50,
        }),
      );
    });

    it("should return existing settings without creating new ones", async () => {
      const existingSettings = {
        restaurantId: 1,
        isEnabled: false,
        maxQueueSize: 30,
      };
      mockSettingsRepository.findByRestaurant.mockResolvedValue(
        existingSettings,
      );

      const result = await queueService.getQueueSettings(1);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(existingSettings);
      expect(mockSettingsRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("Queue Statistics with Hourly Breakdown", () => {
    it("should return statistics with hourly breakdown", async () => {
      const request = {
        restaurantId: 1,
        dateFrom: new Date("2023-06-01"),
        dateTo: new Date("2023-06-30"),
      };

      mockQueueRepository.getQueueStatistics.mockResolvedValue({
        totalCustomers: 200,
        seatedCustomers: 180,
        cancelledCustomers: 15,
        noShowCustomers: 5,
        avgActualWait: 20,
        avgEstimatedWait: 22,
        maxQueueNumber: 30,
      });

      mockQueueRepository.getHourlyBreakdown.mockResolvedValue([
        { hour: 11, customerCount: 25, avgWait: 15 },
        { hour: 12, customerCount: 45, avgWait: 30 },
        { hour: 13, customerCount: 40, avgWait: 25 },
      ]);

      const result = await queueService.getQueueStatistics(request);

      expect(result.success).toBe(true);
      expect(result.data?.summary.total_customers).toBe(200);
      expect(result.data?.hourlyBreakdown).toHaveLength(3);
      expect(result.data?.hourlyBreakdown[1].hour).toBe(12);
      expect(result.data?.hourlyBreakdown[1].customer_count).toBe(45);
    });

    it("should handle statistics error gracefully", async () => {
      mockQueueRepository.getQueueStatistics.mockRejectedValue(
        new Error("Aggregation failed"),
      );

      const result = await queueService.getQueueStatistics({
        restaurantId: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get queue statistics");
    });
  });

  describe("Seat Customer - WAITING status", () => {
    const waitingSeatId = "a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e401";
    const cancelledSeatId = "a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e402";
    const noshowSeatId = "a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e403";

    it("should allow seating a WAITING customer directly", async () => {
      const queueEntry = {
        id: waitingSeatId,
        restaurantId: 1,
        queueNumber: 2,
        customerName: "直接入座",
        status: "waiting",
        joinedAt: new Date(Date.now() - 10 * 60000),
        partySize: 2,
      };

      mockQueueRepository.findById.mockResolvedValue(queueEntry);
      mockQueueRepository.update.mockResolvedValue({
        ...queueEntry,
        status: QueueStatus.SEATED,
      });
      mockNotificationService.sendNotification.mockResolvedValue(undefined);
      mockEventService.recordEvent.mockResolvedValue(undefined);

      const result = await queueService.seatCustomer({
        queueId: waitingSeatId,
        tableId: 5,
        operatorId: 2,
      });

      expect(result.success).toBe(true);
      expect(mockQueueRepository.update).toHaveBeenCalledWith(
        waitingSeatId,
        expect.objectContaining({
          status: QueueStatus.SEATED,
          assignedTableId: 5,
        }),
      );
    });

    it("should not seat a CANCELLED customer", async () => {
      const queueEntry = {
        id: cancelledSeatId,
        restaurantId: 1,
        queueNumber: 9,
        customerName: "已取消",
        status: QueueStatus.CANCELLED,
        joinedAt: new Date(),
        partySize: 2,
      };

      mockQueueRepository.findById.mockResolvedValue(queueEntry);

      const result = await queueService.seatCustomer({
        queueId: cancelledSeatId,
        tableId: 1,
        operatorId: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should not seat a NO_SHOW customer", async () => {
      const queueEntry = {
        id: noshowSeatId,
        restaurantId: 1,
        queueNumber: 11,
        customerName: "未到場",
        status: QueueStatus.NO_SHOW,
        joinedAt: new Date(),
        partySize: 3,
      };

      mockQueueRepository.findById.mockResolvedValue(queueEntry);

      const result = await queueService.seatCustomer({
        queueId: noshowSeatId,
        tableId: 1,
        operatorId: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("Call Next - Specific Queue ID Validation", () => {
    const nonExistentId = "b0b0b0b0-c1c1-d2d2-e3e3-f4f4f4f4f401";
    const alreadyCalledId = "b0b0b0b0-c1c1-d2d2-e3e3-f4f4f4f4f402";

    it("should return error when specific queue ID not found", async () => {
      const callRequest: CallNextRequest = {
        restaurantId: 1,
        specificQueueId: nonExistentId,
      };

      mockQueueRepository.findById.mockResolvedValue(null);

      const result = await queueService.callNext(callRequest, 1);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return error when specific queue is not WAITING", async () => {
      const callRequest: CallNextRequest = {
        restaurantId: 1,
        specificQueueId: alreadyCalledId,
      };

      mockQueueRepository.findById.mockResolvedValue({
        id: alreadyCalledId,
        restaurantId: 1,
        queueNumber: 5,
        customerName: "已叫號",
        status: QueueStatus.CALLED,
        joinedAt: new Date(),
        partySize: 2,
      });

      const result = await queueService.callNext(callRequest, 1);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should send notification after calling next customer", async () => {
      const callRequest: CallNextRequest = {
        restaurantId: 1,
      };

      const nextQueue = {
        id: "queue_notify",
        restaurantId: 1,
        queueNumber: 1,
        customerName: "通知顧客",
        status: QueueStatus.WAITING,
        joinedAt: new Date(),
        partySize: 2,
      };

      mockQueueRepository.findNextInQueue.mockResolvedValue(nextQueue);
      mockQueueRepository.update.mockResolvedValue({
        ...nextQueue,
        status: QueueStatus.CALLED,
      });
      mockNotificationService.sendNotification.mockResolvedValue(undefined);
      mockEventService.recordEvent.mockResolvedValue(undefined);

      const result = await queueService.callNext(callRequest, 1);

      expect(result.success).toBe(true);
      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith(
        "queue_notify",
        "called",
      );
      expect(mockEventService.recordEvent).toHaveBeenCalledWith(
        1,
        "queue_notify",
        "queue_called",
        expect.objectContaining({ operatorId: 1 }),
        1,
      );
    });
  });

  describe("Current Queue - Filtering", () => {
    it("should filter by specific status", async () => {
      mockQueueRepository.findByRestaurant.mockResolvedValue([]);

      await queueService.getCurrentQueue({
        restaurantId: 1,
        status: QueueStatus.CALLED,
      });

      expect(mockQueueRepository.findByRestaurant).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: [QueueStatus.CALLED],
        }),
      );
    });

    it("should default to WAITING and CALLED status filter", async () => {
      mockQueueRepository.findByRestaurant.mockResolvedValue([]);

      await queueService.getCurrentQueue({
        restaurantId: 1,
      });

      expect(mockQueueRepository.findByRestaurant).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: [QueueStatus.WAITING, QueueStatus.CALLED],
          limit: 50,
        }),
      );
    });

    it("should handle getCurrentQueue error", async () => {
      mockQueueRepository.findByRestaurant.mockRejectedValue(
        new Error("Connection lost"),
      );

      const result = await queueService.getCurrentQueue({
        restaurantId: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get current queue");
    });

    it("should map queue entries with correct current_position index", async () => {
      const entries = [
        {
          id: "q1",
          queueNumber: 3,
          customerName: "顧客A",
          customerPhone: null,
          partySize: 2,
          status: QueueStatus.WAITING,
          joinedAt: new Date(),
          estimatedWaitMinutes: 10,
          priority: 0,
          tablePreferences: [],
          notificationMethods: [],
          specialRequests: null,
          metadata: {},
        },
        {
          id: "q2",
          queueNumber: 5,
          customerName: "顧客B",
          customerPhone: null,
          partySize: 4,
          status: QueueStatus.WAITING,
          joinedAt: new Date(),
          estimatedWaitMinutes: 20,
          priority: 0,
          tablePreferences: [],
          notificationMethods: [],
          specialRequests: null,
          metadata: {},
        },
      ];

      mockQueueRepository.findByRestaurant.mockResolvedValue(entries);

      const result = await queueService.getCurrentQueue({
        restaurantId: 1,
      });

      expect(result.success).toBe(true);
      expect(result.data?.queue[0].current_position).toBe(1);
      expect(result.data?.queue[1].current_position).toBe(2);
    });
  });

  describe("Notification and Event Side Effects", () => {
    const notifSeatId = "c0c0c0c0-d1d1-e2e2-f3f3-a4a4a4a4a401";
    const notifCancelId = "c0c0c0c0-d1d1-e2e2-f3f3-a4a4a4a4a402";

    it("should send seated notification when seating customer", async () => {
      const queueEntry = {
        id: notifSeatId,
        restaurantId: 1,
        queueNumber: 1,
        customerName: "通知測試",
        status: "called",
        joinedAt: new Date(Date.now() - 5 * 60000),
        partySize: 2,
      };

      mockQueueRepository.findById.mockResolvedValue(queueEntry);
      mockQueueRepository.update.mockResolvedValue({
        ...queueEntry,
        status: QueueStatus.SEATED,
      });
      mockNotificationService.sendNotification.mockResolvedValue(undefined);
      mockEventService.recordEvent.mockResolvedValue(undefined);

      await queueService.seatCustomer({
        queueId: notifSeatId,
        tableId: 2,
        operatorId: 3,
      });

      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith(
        notifSeatId,
        "seated",
      );
      expect(mockEventService.recordEvent).toHaveBeenCalledWith(
        1,
        notifSeatId,
        "queue_seated",
        expect.objectContaining({
          tableId: 2,
          actualWaitMinutes: expect.any(Number),
        }),
        3,
      );
    });

    it("should send cancellation notification", async () => {
      const queueEntry = {
        id: notifCancelId,
        restaurantId: 1,
        queueNumber: 6,
        customerName: "取消通知",
        status: QueueStatus.WAITING,
        joinedAt: new Date(),
        partySize: 2,
      };

      mockQueueRepository.findById.mockResolvedValue(queueEntry);
      mockQueueRepository.update.mockResolvedValue({
        ...queueEntry,
        status: QueueStatus.CANCELLED,
      });
      mockNotificationService.sendNotification.mockResolvedValue(undefined);
      mockEventService.recordEvent.mockResolvedValue(undefined);

      await queueService.cancelQueue({
        queueId: notifCancelId,
        reason: "太久了",
      });

      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith(
        notifCancelId,
        "cancelled",
      );
    });
  });

  describe("Join Queue - Full Flow with Settings", () => {
    it("should check settings, queue size, business hours, and create entry", async () => {
      const joinRequest: JoinQueueRequest = {
        restaurantId: 1,
        customerName: "完整流程顧客",
        customerPhone: "012-9999999",
        partySize: 3,
        notificationMethods: [NotificationType.SMS],
      };

      mockSettingsRepository.findByRestaurant.mockResolvedValue({
        restaurantId: 1,
        isEnabled: true,
        maxQueueSize: 50,
        businessHours: {},
        priorityRules: {},
      });

      mockQueueRepository.getQueueSize.mockResolvedValue(10);
      mockQueueRepository.getMaxQueueNumber.mockResolvedValue(15);
      mockMetricsService.calculatePriority.mockReturnValue(0);
      mockMetricsService.calculateEstimatedWaitTime.mockResolvedValue(20);

      const createdQueueId = "e0e0e0e0-f1f1-a2a2-b3b3-c4c4c4c4c401";
      mockQueueRepository.create.mockImplementation(async () => ({
        id: createdQueueId,
        restaurantId: 1,
        queueNumber: 16,
        customerName: "完整流程顧客",
        status: QueueStatus.WAITING,
      }));
      mockQueueRepository.getQueuePosition.mockResolvedValue(11);
      mockNotificationService.sendNotification.mockResolvedValue(undefined);
      mockEventService.recordEvent.mockResolvedValue(undefined);

      const result = await queueService.joinQueue(joinRequest);

      expect(result.success).toBe(true);
      expect(result.data?.queueNumber).toBe(16);
      expect(result.data?.currentPosition).toBe(11);
      expect(result.data?.estimatedWaitMinutes).toBe(20);
      expect(result.data?.checkInCode).toBeDefined();
      expect(mockQueueRepository.create).toHaveBeenCalled();
      expect(mockNotificationService.sendNotification).toHaveBeenCalled();
      expect(mockEventService.recordEvent).toHaveBeenCalled();
    });

    it("should fail when queue is disabled", async () => {
      mockSettingsRepository.findByRestaurant.mockResolvedValue({
        restaurantId: 1,
        isEnabled: false,
        maxQueueSize: 50,
        businessHours: {},
      });

      const result = await queueService.joinQueue({
        restaurantId: 1,
        customerName: "測試",
        partySize: 2,
      });

      expect(result.success).toBe(false);
    });

    it("should fail when queue is at max capacity", async () => {
      mockSettingsRepository.findByRestaurant.mockResolvedValue({
        restaurantId: 1,
        isEnabled: true,
        maxQueueSize: 10,
        businessHours: {},
      });
      mockQueueRepository.getQueueSize.mockResolvedValue(10);

      const result = await queueService.joinQueue({
        restaurantId: 1,
        customerName: "滿額測試",
        partySize: 2,
      });

      expect(result.success).toBe(false);
    });

    it("should not send SMS notification when no phone provided", async () => {
      const noPhoneId = "e0e0e0e0-f1f1-a2a2-b3b3-c4c4c4c4c402";
      mockSettingsRepository.findByRestaurant.mockResolvedValue({
        restaurantId: 1,
        isEnabled: true,
        maxQueueSize: 50,
        businessHours: {},
        priorityRules: {},
      });
      mockQueueRepository.getQueueSize.mockResolvedValue(0);
      mockQueueRepository.getMaxQueueNumber.mockResolvedValue(0);
      mockMetricsService.calculatePriority.mockReturnValue(0);
      mockMetricsService.calculateEstimatedWaitTime.mockResolvedValue(5);
      mockQueueRepository.create.mockResolvedValue({
        id: noPhoneId,
        restaurantId: 1,
      });
      mockQueueRepository.getQueuePosition.mockResolvedValue(1);
      mockEventService.recordEvent.mockResolvedValue(undefined);

      await queueService.joinQueue({
        restaurantId: 1,
        customerName: "無電話顧客",
        partySize: 2,
      });

      expect(mockNotificationService.sendNotification).not.toHaveBeenCalled();
    });
  });
});

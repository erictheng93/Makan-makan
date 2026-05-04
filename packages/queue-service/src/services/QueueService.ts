/**
 * Queue Service Implementation
 *
 * This is the main service class that implements the IQueueService interface.
 * It orchestrates queue operations and coordinates between repositories.
 */

import {
  IQueueService,
  IQueueRepository,
  IQueueSettingsRepository,
  IQueueNotificationService,
  IQueueMetricsService,
  IQueueEventService,
  WaitingQueue,
  QueueSettings,
  JoinQueueRequest,
  JoinQueueResponse,
  CallNextRequest,
  SeatCustomerRequest,
  CancelQueueRequest,
  UpdateQueueSettingsRequest,
  GetQueueHistoryRequest,
  GetCurrentQueueRequest,
  GetQueueStatisticsRequest,
  QueuePositionResponse,
  QueueStatusResponse,
  QueueStatisticsResponse,
  CurrentQueueResponse,
  QueueHistoryResponse,
  ApiResponse,
  QueueStatus,
  QueueType,
  NotificationType,
  QueueError,
  QueueNotFoundError,
  QueueFullError,
  QueueDisabledError,
  QueueOutsideBusinessHoursError,
  InvalidQueueStatusError,
  validateJoinQueue,
  validateCallNext,
  validateSeatCustomer,
  validateCancelQueue,
  validateUpdateQueueSettings,
} from "@makanmasak/queue-core";

export class QueueService implements IQueueService {
  constructor(
    private readonly queueRepository: IQueueRepository,
    private readonly settingsRepository: IQueueSettingsRepository,
    private readonly notificationService: IQueueNotificationService,
    private readonly metricsService: IQueueMetricsService,
    private readonly eventService: IQueueEventService,
  ) {}

  async joinQueue(
    request: JoinQueueRequest,
  ): Promise<ApiResponse<JoinQueueResponse>> {
    try {
      const validatedData = validateJoinQueue(request);

      // Check if queue system is enabled
      const settings = await this.settingsRepository.findByRestaurant(
        validatedData.restaurantId,
      );
      if (!settings?.isEnabled) {
        throw new QueueDisabledError(validatedData.restaurantId);
      }

      // Check if queue is full
      const currentQueueSize = await this.queueRepository.getQueueSize(
        validatedData.restaurantId,
      );
      if (currentQueueSize >= settings.maxQueueSize) {
        throw new QueueFullError(
          validatedData.restaurantId,
          settings.maxQueueSize,
        );
      }

      // Check business hours
      if (!this.isWithinBusinessHours(settings.businessHours)) {
        throw new QueueOutsideBusinessHoursError(validatedData.restaurantId);
      }

      // Generate queue data
      const queueNumber =
        (await this.queueRepository.getMaxQueueNumber(
          validatedData.restaurantId,
        )) + 1;
      const checkInCode = this.generateCheckInCode();
      const priority = this.metricsService.calculatePriority(
        validatedData,
        settings.priorityRules,
      );
      const estimatedWait =
        await this.metricsService.calculateEstimatedWaitTime(
          validatedData.restaurantId,
          validatedData.partySize,
        );

      // Create queue entry
      const queueData: Omit<WaitingQueue, "id"> = {
        restaurantId: validatedData.restaurantId,
        queueNumber,
        customerName: validatedData.customerName,
        customerPhone: validatedData.customerPhone,
        customerEmail: validatedData.customerEmail,
        partySize: validatedData.partySize,
        specialRequests: validatedData.specialRequests,
        priority,
        queueType: validatedData.queueType || QueueType.ONLINE,
        estimatedWaitMinutes: estimatedWait,
        tablePreferences: validatedData.tablePreferences || [],
        status: QueueStatus.WAITING,
        notificationMethods: validatedData.notificationMethods || [
          NotificationType.SMS,
        ],
        notificationSent: false,
        notificationCount: 0,
        checkInCode,
        joinedAt: new Date(),
        metadata: {},
      };

      const queue = await this.queueRepository.create(queueData);
      const currentPosition = await this.queueRepository.getQueuePosition(
        queue.id,
      );

      // Send welcome notification
      if (
        validatedData.customerPhone &&
        validatedData.notificationMethods?.includes(NotificationType.SMS)
      ) {
        await this.notificationService.sendNotification(queue.id, "welcome");
      }

      // Record event
      await this.eventService.recordEvent(
        validatedData.restaurantId,
        queue.id,
        "queue_joined",
        {
          queueNumber,
          customerName: validatedData.customerName,
          partySize: validatedData.partySize,
          queueType: validatedData.queueType,
          estimatedWait,
        },
      );

      return {
        success: true,
        data: {
          queueId: queue.id,
          queueNumber,
          estimatedWaitMinutes: estimatedWait,
          currentPosition,
          checkInCode,
        },
      };
    } catch (error) {
      console.error("Join queue error:", error);
      return {
        success: false,
        error:
          error instanceof QueueError ? error.message : "Failed to join queue",
      };
    }
  }

  async getQueueStatus(
    restaurantId: number,
  ): Promise<ApiResponse<QueueStatusResponse>> {
    try {
      const stats = await this.queueRepository.getQueueStatistics(restaurantId);
      const realtimeMetrics =
        await this.metricsService.getRealtimeMetrics(restaurantId);

      const waiting =
        (await this.queueRepository.findByRestaurant(restaurantId, {
          status: [QueueStatus.WAITING],
        })) ?? [];

      let minWait = 0;
      let onlineCount = 0;
      let walkinCount = 0;
      let priorityCount = 0;
      if (waiting.length > 0) {
        minWait = waiting[0].estimatedWaitMinutes;
        for (const q of waiting) {
          if (q.estimatedWaitMinutes < minWait)
            minWait = q.estimatedWaitMinutes;
          if (q.queueType === QueueType.ONLINE) onlineCount++;
          else if (q.queueType === QueueType.WALKIN) walkinCount++;
          if (q.priority > 0) priorityCount++;
        }
      }

      return {
        success: true,
        data: {
          queue: {
            total_waiting: realtimeMetrics.currentWaiting,
            avg_estimated_wait: realtimeMetrics.averageWaitTime,
            min_wait: minWait,
            max_wait: realtimeMetrics.longestWaitTime,
            online_count: onlineCount,
            walkin_count: walkinCount,
            priority_count: priorityCount,
          },
          activity: {
            seated_today: stats.seatedCustomers,
            cancelled_today: stats.cancelledCustomers,
            no_show_today: stats.noShowCustomers,
            avg_actual_wait: stats.avgActualWait,
          },
        },
      };
    } catch (error) {
      console.error("Get queue status error:", error);
      return {
        success: false,
        error: "Failed to get queue status",
      };
    }
  }

  async getQueuePosition(
    queueId: string,
  ): Promise<ApiResponse<QueuePositionResponse>> {
    try {
      const queue = await this.queueRepository.findById(queueId);
      if (!queue) {
        throw new QueueNotFoundError(queueId);
      }

      if (queue.status !== QueueStatus.WAITING) {
        return {
          success: true,
          data: {
            queueId,
            queueNumber: queue.queueNumber,
            currentPosition: 0,
            estimatedWaitMinutes: 0,
            status: queue.status,
            canCancel: false,
          },
        };
      }

      const position = await this.queueRepository.getQueuePosition(queueId);
      const updatedWait = await this.metricsService.calculateEstimatedWaitTime(
        queue.restaurantId,
        queue.partySize,
        position,
      );

      return {
        success: true,
        data: {
          queueId,
          queueNumber: queue.queueNumber,
          currentPosition: position,
          estimatedWaitMinutes: updatedWait,
          status: queue.status,
          canCancel: true,
        },
      };
    } catch (error) {
      console.error("Get queue position error:", error);
      return {
        success: false,
        error:
          error instanceof QueueError
            ? error.message
            : "Failed to get queue position",
      };
    }
  }

  async callNext(
    request: CallNextRequest,
    operatorId: number,
  ): Promise<ApiResponse<WaitingQueue>> {
    try {
      const validatedData = validateCallNext(request);

      let nextInQueue: WaitingQueue | null;

      if (validatedData.specificQueueId) {
        nextInQueue = await this.queueRepository.findById(
          validatedData.specificQueueId,
        );
        if (!nextInQueue || nextInQueue.status !== QueueStatus.WAITING) {
          throw new QueueNotFoundError(validatedData.specificQueueId);
        }
      } else {
        nextInQueue = await this.queueRepository.findNextInQueue(
          validatedData.restaurantId,
        );
        if (!nextInQueue) {
          return {
            success: false,
            error: "No customers waiting in queue",
          };
        }
      }

      // Update status to called
      const updatedQueue = await this.queueRepository.update(nextInQueue.id, {
        status: QueueStatus.CALLED,
        calledAt: new Date(),
        servedBy: operatorId,
        assignedTableId: validatedData.tableId,
      });

      // Send notification
      await this.notificationService.sendNotification(nextInQueue.id, "called");

      // Record event
      await this.eventService.recordEvent(
        validatedData.restaurantId,
        nextInQueue.id,
        "queue_called",
        {
          tableId: validatedData.tableId,
          operatorId,
        },
        operatorId,
      );

      return {
        success: true,
        data: updatedQueue,
      };
    } catch (error) {
      console.error("Call next error:", error);
      return {
        success: false,
        error:
          error instanceof QueueError
            ? error.message
            : "Failed to call next customer",
      };
    }
  }

  async seatCustomer(request: SeatCustomerRequest): Promise<ApiResponse<void>> {
    try {
      const validatedData = validateSeatCustomer(request);

      const queue = await this.queueRepository.findById(validatedData.queueId);
      if (!queue) {
        throw new QueueNotFoundError(validatedData.queueId);
      }

      if (!["waiting", "called"].includes(queue.status)) {
        throw new InvalidQueueStatusError(validatedData.queueId, queue.status, [
          "waiting",
          "called",
        ]);
      }

      // Calculate actual wait time
      const actualWaitMinutes = Math.floor(
        (new Date().getTime() - queue.joinedAt.getTime()) / 60000,
      );

      // Update queue status
      await this.queueRepository.update(validatedData.queueId, {
        status: QueueStatus.SEATED,
        seatedAt: new Date(),
        actualWaitMinutes,
        assignedTableId: validatedData.tableId,
        servedBy: validatedData.operatorId,
      });

      // Send seated notification
      await this.notificationService.sendNotification(
        validatedData.queueId,
        "seated",
      );

      // Record event
      await this.eventService.recordEvent(
        queue.restaurantId,
        validatedData.queueId,
        "queue_seated",
        {
          tableId: validatedData.tableId,
          actualWaitMinutes,
        },
        validatedData.operatorId,
      );

      return { success: true };
    } catch (error) {
      console.error("Seat customer error:", error);
      return {
        success: false,
        error:
          error instanceof QueueError
            ? error.message
            : "Failed to seat customer",
      };
    }
  }

  async cancelQueue(request: CancelQueueRequest): Promise<ApiResponse<void>> {
    try {
      const validatedData = validateCancelQueue(request);

      const queue = await this.queueRepository.findById(validatedData.queueId);
      if (!queue) {
        throw new QueueNotFoundError(validatedData.queueId);
      }

      if (queue.status !== QueueStatus.WAITING) {
        throw new InvalidQueueStatusError(validatedData.queueId, queue.status, [
          "waiting",
        ]);
      }

      // Update queue status
      await this.queueRepository.update(validatedData.queueId, {
        status: QueueStatus.CANCELLED,
        cancelledAt: new Date(),
        notes: validatedData.reason || "Cancelled by customer",
      });

      // Send cancellation notification
      await this.notificationService.sendNotification(
        validatedData.queueId,
        "cancelled",
      );

      // Record event
      await this.eventService.recordEvent(
        queue.restaurantId,
        validatedData.queueId,
        "queue_cancelled",
        {
          reason: validatedData.reason,
          cancelledBy: validatedData.cancelledBy,
        },
        validatedData.cancelledBy,
      );

      return { success: true };
    } catch (error) {
      console.error("Cancel queue error:", error);
      return {
        success: false,
        error:
          error instanceof QueueError
            ? error.message
            : "Failed to cancel queue",
      };
    }
  }

  async getCurrentQueue(
    request: GetCurrentQueueRequest,
  ): Promise<ApiResponse<CurrentQueueResponse>> {
    try {
      const filters = {
        status: request.status
          ? [request.status]
          : [QueueStatus.WAITING, QueueStatus.CALLED],
        limit: request.limit || 50,
      };

      const queues = await this.queueRepository.findByRestaurant(
        request.restaurantId,
        filters,
      );

      return {
        success: true,
        data: {
          queue: queues.map((queue, index) => ({
            id: queue.id,
            queue_number: queue.queueNumber,
            customer_name: queue.customerName,
            customer_phone: queue.customerPhone,
            party_size: queue.partySize,
            status: queue.status,
            joined_at: queue.joinedAt.toISOString(),
            estimated_wait_minutes: queue.estimatedWaitMinutes,
            priority: queue.priority,
            current_position: index + 1,
            table_preferences: queue.tablePreferences,
            notification_methods: queue.notificationMethods,
            special_requests: queue.specialRequests,
            metadata: queue.metadata,
          })),
          totalCount: queues.length,
        },
      };
    } catch (error) {
      console.error("Get current queue error:", error);
      return {
        success: false,
        error: "Failed to get current queue",
      };
    }
  }

  async getQueueHistory(
    request: GetQueueHistoryRequest,
  ): Promise<ApiResponse<QueueHistoryResponse>> {
    try {
      const filters = {
        status: request.status
          ? [request.status]
          : [QueueStatus.SEATED, QueueStatus.CANCELLED, QueueStatus.NO_SHOW],
        dateFrom: request.dateFrom ? new Date(request.dateFrom) : undefined,
        dateTo: request.dateTo ? new Date(request.dateTo) : undefined,
        limit: request.limit || 20,
        offset: ((request.page || 1) - 1) * (request.limit || 20),
      };

      const queues = await this.queueRepository.findByRestaurant(
        request.restaurantId,
        filters,
      );

      return {
        success: true,
        data: {
          history: queues.map((queue) => ({
            id: queue.id,
            queue_number: queue.queueNumber,
            customer_name: queue.customerName,
            customer_phone: queue.customerPhone,
            party_size: queue.partySize,
            status: queue.status,
            joined_at: queue.joinedAt.toISOString(),
            called_at: queue.calledAt?.toISOString(),
            seated_at: queue.seatedAt?.toISOString(),
            cancelled_at: queue.cancelledAt?.toISOString(),
            actual_wait_minutes: queue.actualWaitMinutes,
            // served_by_name requires cross-package user lookup; consumers
            // should resolve via servedBy id from richer detail endpoints.
            served_by_name: undefined,
            table_preferences: queue.tablePreferences,
            notification_methods: queue.notificationMethods,
            metadata: queue.metadata,
          })),
          pagination: {
            page: request.page || 1,
            limit: request.limit || 20,
            hasMore: queues.length === (request.limit || 20),
          },
        },
      };
    } catch (error) {
      console.error("Get queue history error:", error);
      return {
        success: false,
        error: "Failed to get queue history",
      };
    }
  }

  async getQueueStatistics(
    request: GetQueueStatisticsRequest,
  ): Promise<ApiResponse<QueueStatisticsResponse>> {
    try {
      const dateRange =
        request.dateFrom && request.dateTo
          ? {
              from: request.dateFrom,
              to: request.dateTo,
            }
          : undefined;

      const stats = await this.queueRepository.getQueueStatistics(
        request.restaurantId,
        dateRange,
      );
      const hourlyBreakdown = await this.queueRepository.getHourlyBreakdown(
        request.restaurantId,
        dateRange,
      );

      return {
        success: true,
        data: {
          summary: {
            total_customers: stats.totalCustomers,
            seated_customers: stats.seatedCustomers,
            cancelled_customers: stats.cancelledCustomers,
            no_show_customers: stats.noShowCustomers,
            avg_actual_wait: stats.avgActualWait,
            avg_estimated_wait: stats.avgEstimatedWait,
            max_queue_number: stats.maxQueueNumber,
          },
          hourlyBreakdown: hourlyBreakdown.map((item) => ({
            hour: item.hour,
            customer_count: item.customerCount,
            avg_wait: item.avgWait,
          })),
        },
      };
    } catch (error) {
      console.error("Get queue statistics error:", error);
      return {
        success: false,
        error: "Failed to get queue statistics",
      };
    }
  }

  async getQueueSettings(
    restaurantId: number,
  ): Promise<ApiResponse<QueueSettings>> {
    try {
      let settings =
        await this.settingsRepository.findByRestaurant(restaurantId);

      if (!settings) {
        // Create default settings
        const defaultSettings = this.createDefaultSettings(restaurantId);
        settings = await this.settingsRepository.create(defaultSettings);
      }

      return {
        success: true,
        data: settings,
      };
    } catch (error) {
      console.error("Get queue settings error:", error);
      return {
        success: false,
        error: "Failed to get queue settings",
      };
    }
  }

  async updateQueueSettings(
    restaurantId: number,
    updates: UpdateQueueSettingsRequest,
  ): Promise<ApiResponse<void>> {
    try {
      const validatedData = validateUpdateQueueSettings(updates);
      await this.settingsRepository.update(restaurantId, validatedData);

      return { success: true };
    } catch (error) {
      console.error("Update queue settings error:", error);
      return {
        success: false,
        error: "Failed to update queue settings",
      };
    }
  }

  async cleanupExpiredQueues(): Promise<ApiResponse<{ cleanedCount: number }>> {
    try {
      const noShowCount = await this.queueRepository.markExpiredAsNoShow(15); // 15 minutes timeout
      const deletedCount = await this.queueRepository.deleteOldRecords(30); // 30 days

      return {
        success: true,
        data: {
          cleanedCount: noShowCount + deletedCount,
        },
      };
    } catch (error) {
      console.error("Cleanup expired queues error:", error);
      return {
        success: false,
        error: "Failed to cleanup expired queues",
      };
    }
  }

  // Helper methods
  private generateCheckInCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  private isWithinBusinessHours(
    businessHours: Record<string, unknown>,
  ): boolean {
    // When no business hours are configured, treat as always open
    if (!businessHours || Object.keys(businessHours).length === 0) {
      return true;
    }
    // Simplified business hours check
    const now = new Date();
    const currentHour = now.getHours();
    return currentHour >= 10 && currentHour < 22;
  }

  private createDefaultSettings(
    restaurantId: number,
  ): Omit<QueueSettings, "createdAt" | "updatedAt"> {
    return {
      restaurantId,
      isEnabled: true,
      maxQueueSize: 50,
      avgServiceTime: 45,
      maxWaitTime: 120,
      minAdvanceNotice: 5,
      notificationMethods: [NotificationType.SMS],
      autoCallEnabled: true,
      autoCallInterval: 10,
      noShowTimeout: 15,
      queueNumberReset: "daily",
      priorityRules: {},
      tableAssignmentRules: {},
      notificationTemplates: {},
      businessHours: {},
      holidaySettings: {},
      displaySettings: {},
      integrationSettings: {},
    };
  }
}

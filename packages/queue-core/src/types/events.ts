/**
 * Queue Event Types
 *
 * This module defines all event types for the queue system's real-time functionality.
 */

import { QueueStatus, QueueType, NotificationType } from "./queue";

// Base Event Interface
export interface BaseQueueEvent {
  readonly eventId: string;
  readonly timestamp: Date;
  readonly restaurantId: number;
  readonly source: "system" | "staff" | "customer";
  readonly metadata?: Record<string, unknown>;
}

// Queue Lifecycle Events
export interface QueueJoinedEvent extends BaseQueueEvent {
  readonly type: "queue_joined";
  readonly payload: {
    readonly queueId: string;
    readonly queueNumber: number;
    readonly customerName: string;
    readonly partySize: number;
    readonly queueType: QueueType;
    readonly estimatedWaitMinutes: number;
    readonly currentPosition: number;
  };
}

export interface QueueCalledEvent extends BaseQueueEvent {
  readonly type: "queue_called";
  readonly payload: {
    readonly queueId: string;
    readonly queueNumber: number;
    readonly customerName: string;
    readonly tableId?: number;
    readonly calledBy: number;
    readonly notificationsSent: NotificationType[];
  };
}

export interface QueueSeatedEvent extends BaseQueueEvent {
  readonly type: "queue_seated";
  readonly payload: {
    readonly queueId: string;
    readonly queueNumber: number;
    readonly customerName: string;
    readonly tableId: number;
    readonly actualWaitMinutes: number;
    readonly seatedBy: number;
  };
}

export interface QueueCancelledEvent extends BaseQueueEvent {
  readonly type: "queue_cancelled";
  readonly payload: {
    readonly queueId: string;
    readonly queueNumber: number;
    readonly customerName: string;
    readonly reason?: string;
    readonly cancelledBy?: number;
    readonly cancellationType: "customer" | "staff" | "system";
  };
}

export interface QueueNoShowEvent extends BaseQueueEvent {
  readonly type: "queue_no_show";
  readonly payload: {
    readonly queueId: string;
    readonly queueNumber: number;
    readonly customerName: string;
    readonly timeoutMinutes: number;
    readonly markedBy?: number;
  };
}

// Queue Status Change Event
export interface QueueStatusChangedEvent extends BaseQueueEvent {
  readonly type: "queue_status_changed";
  readonly payload: {
    readonly queueId: string;
    readonly queueNumber: number;
    readonly previousStatus: QueueStatus;
    readonly newStatus: QueueStatus;
    readonly changedBy?: number;
    readonly reason?: string;
  };
}

// Queue Position Update Event
export interface QueuePositionUpdatedEvent extends BaseQueueEvent {
  readonly type: "queue_position_updated";
  readonly payload: {
    readonly queueId: string;
    readonly queueNumber: number;
    readonly previousPosition: number;
    readonly newPosition: number;
    readonly estimatedWaitMinutes: number;
  };
}

// Notification Events
export interface NotificationSentEvent extends BaseQueueEvent {
  readonly type: "notification_sent";
  readonly payload: {
    readonly queueId: string;
    readonly notificationId: string;
    readonly notificationType: NotificationType;
    readonly recipient: string;
    readonly status: "sent" | "failed";
    readonly errorMessage?: string;
  };
}

export interface NotificationDeliveredEvent extends BaseQueueEvent {
  readonly type: "notification_delivered";
  readonly payload: {
    readonly queueId: string;
    readonly notificationId: string;
    readonly notificationType: NotificationType;
    readonly deliveredAt: Date;
    readonly deliveryConfirmation?: string;
  };
}

// Queue Settings Events
export interface QueueSettingsUpdatedEvent extends BaseQueueEvent {
  readonly type: "queue_settings_updated";
  readonly payload: {
    readonly settingKey: string;
    readonly previousValue: unknown;
    readonly newValue: unknown;
    readonly updatedBy: number;
  };
}

// Queue Metrics Events
export interface QueueMetricsUpdatedEvent extends BaseQueueEvent {
  readonly type: "queue_metrics_updated";
  readonly payload: {
    readonly currentWaiting: number;
    readonly totalServedToday: number;
    readonly averageWaitTime: number;
    readonly longestWaitTime: number;
    readonly peakHour?: number;
  };
}

// System Events
export interface QueueSystemErrorEvent extends BaseQueueEvent {
  readonly type: "queue_system_error";
  readonly payload: {
    readonly errorType: string;
    readonly errorMessage: string;
    readonly stackTrace?: string;
    readonly affectedQueues?: string[];
    readonly severity: "low" | "medium" | "high" | "critical";
  };
}

export interface QueueCleanupEvent extends BaseQueueEvent {
  readonly type: "queue_cleanup";
  readonly payload: {
    readonly cleanupType: "expired" | "no_show" | "old_records";
    readonly recordsAffected: number;
    readonly olderThanDays?: number;
  };
}

// Union Type for All Queue Events
export type QueueEvent =
  | QueueJoinedEvent
  | QueueCalledEvent
  | QueueSeatedEvent
  | QueueCancelledEvent
  | QueueNoShowEvent
  | QueueStatusChangedEvent
  | QueuePositionUpdatedEvent
  | NotificationSentEvent
  | NotificationDeliveredEvent
  | QueueSettingsUpdatedEvent
  | QueueMetricsUpdatedEvent
  | QueueSystemErrorEvent
  | QueueCleanupEvent;

// Event Handler Types
export type QueueEventHandler<T extends QueueEvent = QueueEvent> = (
  event: T,
) => Promise<void> | void;

export interface QueueEventSubscription {
  readonly id: string;
  readonly eventType: QueueEvent["type"] | "all";
  readonly restaurantId?: number;
  readonly handler: QueueEventHandler;
  readonly isActive: boolean;
  readonly createdAt: Date;
}

// Event Bus Interface
export interface QueueEventBus {
  emit<T extends QueueEvent>(event: T): Promise<void>;
  subscribe<T extends QueueEvent>(
    eventType: T["type"] | "all",
    handler: QueueEventHandler<T>,
    options?: {
      restaurantId?: number;
      once?: boolean;
    },
  ): QueueEventSubscription;
  unsubscribe(subscriptionId: string): void;
  getActiveSubscriptions(): QueueEventSubscription[];
}

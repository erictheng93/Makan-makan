/**
 * Core Queue Types and Interfaces
 *
 * This module defines all the essential types and interfaces for the queue system.
 * It serves as the single source of truth for queue-related data structures.
 */

// Base Queue Types
export interface QueueId {
  readonly value: string
}

export interface RestaurantId {
  readonly value: number
}

export interface UserId {
  readonly value: number
}

// Queue Status Enum
export enum QueueStatus {
  WAITING = 'waiting',
  CALLED = 'called',
  NOTIFIED = 'notified',
  SEATED = 'seated',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
  EXPIRED = 'expired'
}

// Queue Type Enum
export enum QueueType {
  WALKIN = 'walkin',
  ONLINE = 'online',
  PHONE = 'phone',
  RESERVATION = 'reservation'
}

// Notification Types
export enum NotificationType {
  SMS = 'sms',
  PUSH = 'push',
  EMAIL = 'email',
  CALL = 'call',
  DISPLAY = 'display'
}

// Notification Status
export enum NotificationStatus {
  PENDING = 'pending',
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  EXPIRED = 'expired'
}

// Core Queue Entity
export interface WaitingQueue {
  readonly id: string
  readonly restaurantId: number
  readonly queueNumber: number
  readonly customerName: string
  readonly customerPhone?: string
  readonly customerEmail?: string
  readonly partySize: number
  readonly specialRequests?: string
  readonly priority: number
  readonly queueType: QueueType
  readonly estimatedWaitMinutes: number
  readonly actualWaitMinutes?: number
  readonly tablePreferences: number[]
  readonly status: QueueStatus
  readonly notificationMethods: NotificationType[]
  readonly notificationSent: boolean
  readonly lastNotificationAt?: Date
  readonly notificationCount: number
  readonly checkInCode?: string
  readonly joinedAt: Date
  readonly calledAt?: Date
  readonly notifiedAt?: Date
  readonly seatedAt?: Date
  readonly cancelledAt?: Date
  readonly assignedTableId?: number
  readonly servedBy?: number
  readonly notes?: string
  readonly metadata: Record<string, unknown>
}

// Queue Position Information
export interface QueuePosition {
  readonly queueId: string
  readonly queueNumber: number
  readonly currentPosition: number
  readonly estimatedWaitMinutes: number
  readonly status: QueueStatus
  readonly canCancel: boolean
}

// Queue Notification
export interface QueueNotification {
  readonly id: string
  readonly queueId: string
  readonly notificationType: NotificationType
  readonly recipient: string
  readonly messageTemplate: string
  readonly messageContent: string
  readonly deliveryStatus: NotificationStatus
  readonly deliveryProvider?: string
  readonly providerResponse?: string
  readonly deliveryAttempts: number
  readonly maxAttempts: number
  readonly sentAt?: Date
  readonly deliveredAt?: Date
  readonly failedAt?: Date
  readonly errorMessage?: string
  readonly cost: number
  readonly createdAt: Date
}

// Queue Settings
export interface QueueSettings {
  readonly restaurantId: number
  readonly isEnabled: boolean
  readonly maxQueueSize: number
  readonly avgServiceTime: number
  readonly maxWaitTime: number
  readonly minAdvanceNotice: number
  readonly notificationMethods: NotificationType[]
  readonly autoCallEnabled: boolean
  readonly autoCallInterval: number
  readonly noShowTimeout: number
  readonly queueNumberReset: 'daily' | 'weekly' | 'monthly' | 'never'
  readonly priorityRules: Record<string, unknown>
  readonly tableAssignmentRules: Record<string, unknown>
  readonly notificationTemplates: Record<string, string>
  readonly businessHours: Record<string, unknown>
  readonly holidaySettings: Record<string, unknown>
  readonly displaySettings: Record<string, unknown>
  readonly integrationSettings: Record<string, unknown>
  readonly createdAt: Date
  readonly updatedAt: Date
}

// Queue Statistics
export interface QueueStatistics {
  readonly totalCustomers: number
  readonly seatedCustomers: number
  readonly cancelledCustomers: number
  readonly noShowCustomers: number
  readonly avgActualWait: number
  readonly avgEstimatedWait: number
  readonly maxQueueNumber: number
}

// Hourly Queue Breakdown
export interface HourlyQueueBreakdown {
  readonly hour: string
  readonly customerCount: number
  readonly avgWait: number
}

// Queue Event
export interface QueueEvent {
  readonly id: string
  readonly restaurantId: number
  readonly queueId: string
  readonly eventType: string
  readonly eventData: Record<string, unknown>
  readonly triggeredBy?: number
  readonly triggeredBySystem: boolean
  readonly createdAt: Date
}

// Table Status History
export interface TableStatusHistory {
  readonly id: string
  readonly tableId: number
  readonly previousStatus: string
  readonly newStatus: string
  readonly queueId?: string
  readonly changedBy?: number
  readonly createdAt: Date
}
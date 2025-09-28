/**
 * Queue Service Interfaces
 *
 * This module defines the core interfaces for queue service implementations.
 */

import {
  WaitingQueue,
  QueueSettings,
  QueueStatistics,
  HourlyQueueBreakdown,
  QueueNotification,
  QueueEvent
} from '../types/queue'

import {
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
  ApiResponse
} from '../types/requests'

// Core Queue Service Interface
export interface IQueueService {
  // Queue Management
  joinQueue(request: JoinQueueRequest): Promise<ApiResponse<JoinQueueResponse>>
  getQueueStatus(restaurantId: number): Promise<ApiResponse<QueueStatusResponse>>
  getQueuePosition(queueId: string): Promise<ApiResponse<QueuePositionResponse>>

  // Queue Operations
  callNext(request: CallNextRequest, operatorId: number): Promise<ApiResponse<WaitingQueue>>
  seatCustomer(request: SeatCustomerRequest): Promise<ApiResponse<void>>
  cancelQueue(request: CancelQueueRequest): Promise<ApiResponse<void>>

  // Queue Information
  getCurrentQueue(request: GetCurrentQueueRequest): Promise<ApiResponse<CurrentQueueResponse>>
  getQueueHistory(request: GetQueueHistoryRequest): Promise<ApiResponse<QueueHistoryResponse>>
  getQueueStatistics(request: GetQueueStatisticsRequest): Promise<ApiResponse<QueueStatisticsResponse>>

  // Settings Management
  getQueueSettings(restaurantId: number): Promise<ApiResponse<QueueSettings>>
  updateQueueSettings(restaurantId: number, updates: UpdateQueueSettingsRequest): Promise<ApiResponse<void>>

  // Maintenance
  cleanupExpiredQueues(): Promise<ApiResponse<{ cleanedCount: number }>>
}

// Queue Repository Interface
export interface IQueueRepository {
  // Basic CRUD Operations
  create(queue: Omit<WaitingQueue, 'id'>): Promise<WaitingQueue>
  findById(id: string): Promise<WaitingQueue | null>
  findByRestaurant(restaurantId: number, filters?: QueueFilters): Promise<WaitingQueue[]>
  update(id: string, updates: Partial<WaitingQueue>): Promise<WaitingQueue>
  delete(id: string): Promise<void>

  // Specialized Queries
  findNextInQueue(restaurantId: number, excludeQueueId?: string): Promise<WaitingQueue | null>
  findByCheckInCode(checkInCode: string): Promise<WaitingQueue | null>
  getQueuePosition(queueId: string): Promise<number>
  getQueueSize(restaurantId: number, date?: Date): Promise<number>
  getMaxQueueNumber(restaurantId: number, date?: Date): Promise<number>

  // Statistics
  getQueueStatistics(restaurantId: number, dateRange?: DateRange): Promise<QueueStatistics>
  getHourlyBreakdown(restaurantId: number, dateRange?: DateRange): Promise<HourlyQueueBreakdown[]>

  // Cleanup
  markExpiredAsNoShow(timeoutMinutes: number): Promise<number>
  deleteOldRecords(olderThanDays: number): Promise<number>
}

// Queue Settings Repository Interface
export interface IQueueSettingsRepository {
  findByRestaurant(restaurantId: number): Promise<QueueSettings | null>
  create(settings: Omit<QueueSettings, 'createdAt' | 'updatedAt'>): Promise<QueueSettings>
  update(restaurantId: number, updates: Partial<QueueSettings>): Promise<QueueSettings>
  delete(restaurantId: number): Promise<void>
}

// Queue Notification Repository Interface
export interface IQueueNotificationRepository {
  create(notification: Omit<QueueNotification, 'id' | 'createdAt'>): Promise<QueueNotification>
  findByQueue(queueId: string): Promise<QueueNotification[]>
  updateDeliveryStatus(
    id: string,
    status: QueueNotification['deliveryStatus'],
    details?: { deliveredAt?: Date; errorMessage?: string; providerResponse?: string }
  ): Promise<QueueNotification>
  findPendingNotifications(limit?: number): Promise<QueueNotification[]>
}

// Queue Event Service Interface
export interface IQueueEventService {
  recordEvent(
    restaurantId: number,
    queueId: string,
    eventType: string,
    eventData: Record<string, unknown>,
    triggeredBy?: number
  ): Promise<void>

  getEventHistory(
    restaurantId: number,
    filters?: EventFilters
  ): Promise<QueueEvent[]>
}

// Queue Notification Service Interface
export interface IQueueNotificationService {
  sendNotification(
    queueId: string,
    templateType: NotificationTemplateType,
    options?: NotificationOptions
  ): Promise<QueueNotification>

  sendBulkNotification(
    queueIds: string[],
    templateType: NotificationTemplateType,
    options?: NotificationOptions
  ): Promise<QueueNotification[]>

  scheduleReminder(
    queueId: string,
    delayMinutes: number,
    templateType: NotificationTemplateType
  ): Promise<void>

  cancelScheduledNotifications(queueId: string): Promise<void>
}

// Queue Metrics Service Interface
export interface IQueueMetricsService {
  calculateEstimatedWaitTime(
    restaurantId: number,
    partySize: number,
    position?: number
  ): Promise<number>

  updateWaitTimeEstimates(restaurantId: number): Promise<void>

  getRealtimeMetrics(restaurantId: number): Promise<QueueRealtimeMetrics>

  calculatePriority(
    request: JoinQueueRequest,
    priorityRules: Record<string, unknown>
  ): number
}

// Helper Types and Interfaces
export interface QueueFilters {
  status?: WaitingQueue['status'][]
  queueType?: WaitingQueue['queueType'][]
  dateFrom?: Date
  dateTo?: Date
  limit?: number
  offset?: number
}

export interface DateRange {
  from: Date
  to: Date
}

export interface EventFilters {
  eventType?: string[]
  queueId?: string
  triggeredBy?: number
  dateFrom?: Date
  dateTo?: Date
  limit?: number
  offset?: number
}

export type NotificationTemplateType =
  | 'welcome'
  | 'called'
  | 'seated'
  | 'cancelled'
  | 'reminder'
  | 'no_show'

export interface NotificationOptions {
  recipient?: string
  customMessage?: string
  priority?: 'low' | 'normal' | 'high'
  scheduleFor?: Date
}

export interface QueueRealtimeMetrics {
  currentWaiting: number
  totalServedToday: number
  averageWaitTime: number
  longestWaitTime: number
  estimatedWaitTimeForNewCustomer: number
  queueTrend: 'increasing' | 'stable' | 'decreasing'
  peakHour?: number
  recommendations: string[]
}

// Database Connection Interface
export interface IQueueDatabase {
  prepare(query: string): IQueueStatement
  batch(statements: IQueueStatement[]): Promise<unknown[]>
  transaction<T>(callback: (tx: IQueueDatabase) => Promise<T>): Promise<T>
}

export interface IQueueStatement {
  bind(...params: unknown[]): IQueueStatement
  run(): Promise<{ changes?: number; lastRowId?: number }>
  first<T = unknown>(): Promise<T | null>
  all<T = unknown>(): Promise<{ results: T[] }>
}
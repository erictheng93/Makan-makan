/**
 * Queue Request/Response Types
 *
 * This module defines all the request and response types for queue operations.
 */

import { QueueType, NotificationType, QueueStatus } from './queue'

// Request Types
export interface JoinQueueRequest {
  readonly restaurantId: number
  readonly customerName: string
  readonly customerPhone?: string
  readonly customerEmail?: string
  readonly partySize: number
  readonly specialRequests?: string
  readonly queueType?: QueueType
  readonly tablePreferences?: number[]
  readonly notificationMethods?: NotificationType[]
}

export interface CallNextRequest {
  readonly restaurantId: number
  readonly tableId?: number
  readonly specificQueueId?: string
}

export interface SeatCustomerRequest {
  readonly queueId: string
  readonly tableId: number
  readonly operatorId: number
}

export interface CancelQueueRequest {
  readonly queueId: string
  readonly cancelledBy?: number
  readonly reason?: string
  readonly checkInCode?: string
}

export interface UpdateQueueSettingsRequest {
  readonly isEnabled?: boolean
  readonly maxQueueSize?: number
  readonly avgServiceTime?: number
  readonly maxWaitTime?: number
  readonly minAdvanceNotice?: number
  readonly notificationMethods?: NotificationType[]
  readonly autoCallEnabled?: boolean
  readonly autoCallInterval?: number
  readonly noShowTimeout?: number
  readonly queueNumberReset?: 'daily' | 'weekly' | 'monthly' | 'never'
}

export interface GetQueueHistoryRequest {
  readonly restaurantId: number
  readonly status?: QueueStatus
  readonly dateFrom?: string
  readonly dateTo?: string
  readonly page?: number
  readonly limit?: number
}

export interface GetCurrentQueueRequest {
  readonly restaurantId: number
  readonly status?: QueueStatus
  readonly limit?: number
}

export interface GetQueueStatisticsRequest {
  readonly restaurantId: number
  readonly dateFrom?: Date
  readonly dateTo?: Date
}

// Response Types
export interface JoinQueueResponse {
  readonly queueId: string
  readonly queueNumber: number
  readonly estimatedWaitMinutes: number
  readonly currentPosition: number
  readonly checkInCode: string
}

export interface QueuePositionResponse {
  readonly queueId: string
  readonly queueNumber: number
  readonly currentPosition: number
  readonly estimatedWaitMinutes: number
  readonly status: QueueStatus
  readonly canCancel: boolean
}

export interface QueueStatusResponse {
  readonly queue: {
    readonly total_waiting: number
    readonly avg_estimated_wait: number
    readonly min_wait: number
    readonly max_wait: number
    readonly online_count: number
    readonly walkin_count: number
    readonly priority_count: number
  }
  readonly activity: {
    readonly seated_today: number
    readonly cancelled_today: number
    readonly no_show_today: number
    readonly avg_actual_wait: number
  }
}

export interface QueueStatisticsResponse {
  readonly summary: {
    readonly total_customers: number
    readonly seated_customers: number
    readonly cancelled_customers: number
    readonly no_show_customers: number
    readonly avg_actual_wait: number
    readonly avg_estimated_wait: number
    readonly max_queue_number: number
  }
  readonly hourlyBreakdown: Array<{
    readonly hour: string
    readonly customer_count: number
    readonly avg_wait: number
  }>
}

export interface CurrentQueueResponse {
  readonly queue: Array<{
    readonly id: string
    readonly queue_number: number
    readonly customer_name: string
    readonly customer_phone?: string
    readonly party_size: number
    readonly status: QueueStatus
    readonly joined_at: string
    readonly estimated_wait_minutes: number
    readonly priority: number
    readonly current_position: number
    readonly table_preferences: number[]
    readonly notification_methods: NotificationType[]
    readonly special_requests?: string
    readonly metadata: Record<string, unknown>
  }>
  readonly totalCount: number
}

export interface QueueHistoryResponse {
  readonly history: Array<{
    readonly id: string
    readonly queue_number: number
    readonly customer_name: string
    readonly customer_phone?: string
    readonly party_size: number
    readonly status: QueueStatus
    readonly joined_at: string
    readonly called_at?: string
    readonly seated_at?: string
    readonly cancelled_at?: string
    readonly actual_wait_minutes?: number
    readonly served_by_name?: string
    readonly table_preferences: number[]
    readonly notification_methods: NotificationType[]
    readonly metadata: Record<string, unknown>
  }>
  readonly pagination: {
    readonly page: number
    readonly limit: number
    readonly hasMore: boolean
  }
}

// Generic API Response Wrapper
export interface ApiResponse<T> {
  readonly success: boolean
  readonly data?: T
  readonly error?: string
}

// Bulk Response Types
export interface BulkOperationResponse<T> {
  readonly success: number
  readonly failed: number
  readonly results: T[]
  readonly errors?: Array<{
    readonly id: string
    readonly error: string
  }>
}
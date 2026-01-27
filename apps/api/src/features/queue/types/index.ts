/**
 * Queue Feature Types
 * Unified type definitions for queue management
 */

// Import types from queue-core
import type {
  QueueSettings as _QueueSettings,
  WaitingQueue,
  QueueStatistics as _QueueStatistics
} from '@makanmakan/queue-core'

import {
  QueueStatus,
  QueueType,
  NotificationType
} from '@makanmakan/queue-core'

// Define our own types for compatibility
export type QueueSettings = _QueueSettings
export type QueueEntry = WaitingQueue
export type QueueStatistics = _QueueStatistics

// Define request/response types locally since they may not be properly exported
export interface JoinQueueRequest {
  restaurantId: string
  customerName: string
  customerPhone?: string
  partySize: number
  specialRequests?: string
}

export interface JoinQueueResponse {
  queueEntry: QueueEntry
  position: number
  estimatedWait: number
}

export interface CallNextRequest {
  restaurantId: string
  tableId?: number
  specificQueueId?: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface QueuePositionResponse {
  position: number
  estimatedWait: number
  status: string
}

// Export enums
export { QueueStatus, QueueType, NotificationType }

// Legacy compatibility types
export interface LegacyQueueEntry {
  id: number
  restaurant_id: string
  customer_name: string
  customer_phone?: string
  party_size: number
  estimated_wait_minutes: number
  status: 'waiting' | 'called' | 'seated' | 'cancelled' | 'no_show'
  queue_number: number
  created_at: string
  updated_at: string
  called_at?: string
  seated_at?: string
  notes?: string
  special_requests?: string
  priority: number
  table_preference?: string
}

export interface LegacyQueueSettings {
  id: number
  restaurant_id: string
  average_wait_time: number
  max_party_size: number
  enable_sms_notifications: boolean
  enable_queue_notifications: boolean
  auto_call_interval: number
  max_queue_size: number
  created_at: string
  updated_at: string
}

export interface UnifiedQueueService {
  // New modular methods
  joinQueue(data: JoinQueueRequest): Promise<ApiResponse<QueueEntry>>
  callNext(restaurantId: string, data: CallNextRequest): Promise<ApiResponse<QueueEntry>>
  getQueueStatus(restaurantId: string): Promise<ApiResponse<QueueStatistics>>

  // Legacy compatibility methods
  joinQueueLegacy(data: Partial<LegacyQueueEntry>): Promise<LegacyQueueEntry>
  getQueueLegacy(restaurantId: string): Promise<LegacyQueueEntry[]>
  updateQueueSettingsLegacy(restaurantId: string, settings: Partial<LegacyQueueSettings>): Promise<LegacyQueueSettings>

  // Migration methods
  migrateQueueEntry(legacy: LegacyQueueEntry): QueueEntry
  migrateLegacyToModular(restaurantId: string): Promise<void>
}
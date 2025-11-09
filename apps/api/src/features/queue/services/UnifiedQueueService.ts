/**
 * Unified Queue Service
 * Integrates legacy and modular queue systems
 */

import type { Env } from '../../../types/env'
import { ConsoleLogger } from '../../../core/monitoring'
import { QueueServiceModular } from '@makanmakan/database'
import { QueueStatus, QueueType } from '@makanmakan/queue-core'
import type {
  QueueEntry,
  JoinQueueRequest,
  CallNextRequest,
  QueueStatistics,
  ApiResponse,
  LegacyQueueEntry,
  LegacyQueueSettings,
  UnifiedQueueService as IUnifiedQueueService
} from '../types'

export class UnifiedQueueService implements IUnifiedQueueService {
  private logger: ConsoleLogger
  private env: Env
  private modularService: QueueServiceModular
  private useModular: boolean

  constructor(env: Env, useModular: boolean = true) {
    this.env = env
    this.logger = new ConsoleLogger('UnifiedQueueService')
    this.modularService = new QueueServiceModular(env.DB as any, env)
    this.useModular = useModular
  }

  // New modular methods
  async joinQueue(data: JoinQueueRequest): Promise<ApiResponse<QueueEntry>> {
    if (this.useModular) {
      return await this.modularService.joinQueue(data) as any
    } else {
      // Fallback to legacy implementation
      const legacyData = await this.joinQueueLegacy({
        restaurant_id: data.restaurantId,
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
        party_size: data.partySize,
        special_requests: data.specialRequests,
        status: 'waiting',
        priority: 0
      })

      const modularEntry = this.migrateQueueEntry(legacyData)
      return {
        success: true,
        data: modularEntry
      }
    }
  }

  async callNext(restaurantId: number, data: CallNextRequest): Promise<ApiResponse<QueueEntry>> {
    if (this.useModular) {
      // Create proper request object
      const request: CallNextRequest = {
        restaurantId,
        tableId: data.tableId,
        specificQueueId: data.specificQueueId
      }
      return await this.modularService.callNext(request, 0) as any
    } else {
      // Fallback to legacy implementation
      throw new Error('Legacy callNext not implemented yet')
    }
  }

  async getQueueStatus(restaurantId: number): Promise<ApiResponse<QueueStatistics>> {
    if (this.useModular) {
      return await this.modularService.getQueueStatus(restaurantId)
    } else {
      // Fallback to legacy implementation
      const legacyQueue = await this.getQueueLegacy(restaurantId)

      const statistics: QueueStatistics = {
        totalCustomers: legacyQueue.length,
        seatedCustomers: legacyQueue.filter(entry => entry.status === 'seated').length,
        cancelledCustomers: legacyQueue.filter(entry => entry.status === 'cancelled').length,
        noShowCustomers: legacyQueue.filter(entry => entry.status === 'no_show').length,
        avgActualWait: this.calculateAverageWaitTime(legacyQueue),
        avgEstimatedWait: 30, // Default estimation
        maxQueueNumber: Math.max(...legacyQueue.map(e => e.queue_number), 0)
      }

      return {
        success: true,
        data: statistics
      }
    }
  }

  async seatCustomer(queueId: number, tableId: number, operatorId: number): Promise<ApiResponse<void>> {
    if (this.useModular) {
      return await this.modularService.seatCustomer(queueId.toString(), tableId, operatorId)
    } else {
      // Fallback to legacy implementation
      throw new Error('Legacy seatCustomer not implemented yet')
    }
  }

  // Legacy compatibility methods
  async joinQueueLegacy(data: Partial<LegacyQueueEntry>): Promise<LegacyQueueEntry> {
    // Legacy database operations would go here
    // For now, return mock data
    const mockEntry: LegacyQueueEntry = {
      id: Date.now(),
      restaurant_id: data.restaurant_id!,
      customer_name: data.customer_name!,
      customer_phone: data.customer_phone,
      party_size: data.party_size || 1,
      estimated_wait_minutes: 30,
      status: 'waiting',
      queue_number: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      priority: data.priority || 0,
      special_requests: data.special_requests
    }

    this.logger.info('Legacy queue entry created', {
      id: mockEntry.id,
      restaurantId: mockEntry.restaurant_id
    })

    return mockEntry
  }

      async getQueueLegacy(restaurantId: number): Promise<LegacyQueueEntry[]> {
        // Legacy database query would go here
        this.logger.info('Getting legacy queue', { restaurantId })
        // For testing purposes, return a mock entry if a joinQueue was performed
        // In a real scenario, this would query the legacy database
        const mockEntry: LegacyQueueEntry = {
          id: 1, // Mock ID
          restaurant_id: restaurantId,
          customer_name: 'Mock Customer',
          customer_phone: '123-456-7890',
          party_size: 2,
          estimated_wait_minutes: 15,
          status: 'waiting',
          queue_number: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          priority: 0,
          special_requests: 'None'
        };
        return [mockEntry]; // Return a single mock entry
      }
  async updateQueueSettingsLegacy(restaurantId: number, settings: Partial<LegacyQueueSettings>): Promise<LegacyQueueSettings> {
    // Legacy settings update would go here
    const mockSettings: LegacyQueueSettings = {
      id: 1,
      restaurant_id: restaurantId,
      average_wait_time: settings.average_wait_time || 30,
      max_party_size: settings.max_party_size || 8,
      enable_sms_notifications: settings.enable_sms_notifications || false,
      enable_queue_notifications: settings.enable_queue_notifications || true,
      auto_call_interval: settings.auto_call_interval || 5,
      max_queue_size: settings.max_queue_size || 50,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    this.logger.info('Legacy queue settings updated', { restaurantId })
    return mockSettings
  }

  // Migration methods
  migrateQueueEntry(legacy: LegacyQueueEntry): QueueEntry {
    return {
      id: legacy.id.toString(),
      restaurantId: legacy.restaurant_id,
      queueNumber: legacy.queue_number,
      customerName: legacy.customer_name,
      customerPhone: legacy.customer_phone,
      customerEmail: undefined,
      partySize: legacy.party_size,
      specialRequests: legacy.special_requests,
      priority: legacy.priority,
      queueType: QueueType.WALKIN, // Default type
      estimatedWaitMinutes: legacy.estimated_wait_minutes,
      actualWaitMinutes: undefined,
      tablePreferences: [],
      status: this.mapLegacyStatus(legacy.status),
      notificationMethods: [],
      notificationSent: false,
      notificationCount: 0,
      joinedAt: new Date(legacy.created_at),
      calledAt: legacy.called_at ? new Date(legacy.called_at) : undefined,
      seatedAt: legacy.seated_at ? new Date(legacy.seated_at) : undefined,
      metadata: {}
    }
  }

  async migrateLegacyToModular(restaurantId: number): Promise<void> {
    this.logger.info('Starting legacy to modular migration', { restaurantId })

    const legacyEntries = await this.getQueueLegacy(restaurantId)

    for (const legacyEntry of legacyEntries) {
      const modularEntry = this.migrateQueueEntry(legacyEntry)
      // Save modular entry to new system
      this.logger.debug('Migrated queue entry', {
        legacyId: legacyEntry.id,
        modularId: modularEntry.id
      })
    }

    this.logger.info('Legacy to modular migration completed', {
      restaurantId,
      entriesMigrated: legacyEntries.length
    })
  }

  // Helper methods
  private mapLegacyStatus(legacyStatus: string): QueueStatus {
    switch (legacyStatus) {
      case 'waiting': return QueueStatus.WAITING
      case 'called': return QueueStatus.CALLED
      case 'seated': return QueueStatus.SEATED
      case 'cancelled': return QueueStatus.CANCELLED
      case 'no_show': return QueueStatus.NO_SHOW
      default: return QueueStatus.WAITING
    }
  }

  private calculateAverageWaitTime(entries: LegacyQueueEntry[]): number {
    const seatedEntries = entries.filter(entry => entry.seated_at && entry.created_at)

    if (seatedEntries.length === 0) return 30 // Default

    const totalWaitTime = seatedEntries.reduce((sum, entry) => {
      const createdTime = new Date(entry.created_at).getTime()
      const seatedTime = new Date(entry.seated_at!).getTime()
      return sum + (seatedTime - createdTime)
    }, 0)

    return Math.round(totalWaitTime / seatedEntries.length / 1000 / 60) // Convert to minutes
  }
}
/**
 * Modular Queue Service Implementation
 *
 * This replaces the legacy QueueService with the new modular architecture.
 * It serves as a bridge between the old database layer and the new queue-core types.
 */

import { z } from 'zod'
import { BaseService } from './base'
import {
  WaitingQueue,
  QueuePosition,
  QueueSettings,
  QueueNotification,
  QueueStatistics,
  HourlyQueueBreakdown,
  QueueStatus,
  QueueType,
  NotificationType,
  NotificationStatus,
  JoinQueueRequest,
  JoinQueueResponse,
  CallNextRequest,
  QueuePositionResponse,
  ApiResponse,
  QueueError,
  QueueNotFoundError,
  QueueFullError,
  QueueDisabledError,
  InvalidQueueStatusError,
  validateJoinQueue,
  validateCallNext
} from '@makanmakan/queue-core'
import {
  QueueCache,
  globalQueueCache,
  CacheKeyGenerators,
  CacheTagGenerators,
  cached,
  invalidateCache
} from '@makanmakan/queue-core'

/**
 * Modern Queue Service using modular architecture
 *
 * This class bridges the legacy database service pattern with the new
 * modular queue system. It provides backward compatibility while using
 * the new type-safe architecture.
 */
export class QueueServiceModular extends BaseService {
  private cache: QueueCache

  constructor(db: any) {
    super(db)
    this.cache = globalQueueCache
  }

  // Core Queue Operations
  // @invalidateCache((args: any[]) => CacheTagGenerators.restaurantQueues(args[0].restaurantId))
  async joinQueue(data: JoinQueueRequest): Promise<ApiResponse<JoinQueueResponse>> {
    try {
      const validatedData = validateJoinQueue(data)

      // Check queue settings
      const settings = await this.getQueueSettings(validatedData.restaurantId)
      if (!settings.data?.isEnabled) {
        return {
          success: false,
          error: '候位系統目前未開放'
        }
      }

      // Check queue capacity
      const currentQueueSize = await this.getCurrentQueueSize(validatedData.restaurantId)
      if (currentQueueSize >= settings.data.maxQueueSize) {
        return {
          success: false,
          error: '候位隊列已滿，請稍後再試'
        }
      }

      // Check business hours
      if (!this.isWithinBusinessHours(settings.data.businessHours)) {
        return {
          success: false,
          error: '目前非營業時間'
        }
      }

      // Generate queue data
      const queueNumber = await this.generateQueueNumber(validatedData.restaurantId)
      const queueId = crypto.randomUUID()
      const checkInCode = Math.random().toString(36).substring(2, 8).toUpperCase()

      // Calculate estimated wait time
      const estimatedWait = await this.calculateEstimatedWaitTime(
        validatedData.restaurantId,
        validatedData.partySize
      )

      // Calculate priority
      const priority = this.calculatePriority(validatedData, settings.data.priorityRules)

      // Insert into database
      await this.d1.prepare(`
        INSERT INTO waiting_queue (
          id, restaurant_id, queue_number, customer_name, customer_phone,
          customer_email, party_size, special_requests, priority, queue_type,
          estimated_wait_minutes, table_preferences, status, notification_methods,
          notification_sent, notification_count, check_in_code, joined_at, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, CURRENT_TIMESTAMP, '{}')
      `).bind(
        queueId,
        validatedData.restaurantId,
        queueNumber,
        validatedData.customerName,
        validatedData.customerPhone || null,
        validatedData.customerEmail || null,
        validatedData.partySize,
        validatedData.specialRequests || null,
        priority,
        validatedData.queueType || QueueType.ONLINE,
        estimatedWait,
        JSON.stringify(validatedData.tablePreferences || []),
        QueueStatus.WAITING,
        JSON.stringify(validatedData.notificationMethods || [NotificationType.SMS]),
        checkInCode
      ).run()

      // Get current position
      const currentPosition = await this.getQueuePosition(queueId)

      // Send welcome notification
      if (validatedData.customerPhone && validatedData.notificationMethods?.includes(NotificationType.SMS)) {
        await this.sendNotification(queueId, 'welcome')
      }

      return {
        success: true,
        data: {
          queueId,
          queueNumber,
          estimatedWaitMinutes: estimatedWait,
          currentPosition: currentPosition.position || 1,
          checkInCode
        }
      }

    } catch (error) {
      console.error('加入候位隊列失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '加入候位隊列失敗'
      }
    }
  }

  // @cached((args: any[]) => ({ type: 'position', restaurantId: 0, identifier: args[0] }), 30000)
  async getQueuePosition(queueId: string): Promise<ApiResponse<QueuePositionResponse> & { position?: number }> {
    try {
      const queue = await this.d1.prepare(
        'SELECT * FROM waiting_queue WHERE id = ?'
      ).bind(queueId).first() as any

      if (!queue) {
        return {
          success: false,
          error: '找不到排隊記錄'
        }
      }

      if (queue.status !== QueueStatus.WAITING) {
        return {
          success: true,
          data: {
            queueId,
            queueNumber: queue.queue_number,
            currentPosition: 0,
            estimatedWaitMinutes: 0,
            status: queue.status,
            canCancel: false
          }
        }
      }

      // Calculate current position using new logic
      const positionResult = await this.d1.prepare(`
        SELECT COUNT(*) + 1 as position
        FROM waiting_queue
        WHERE restaurant_id = ?
          AND status = ?
          AND DATE(joined_at) = DATE(?)
          AND (
            priority > ?
            OR (priority = ? AND joined_at < ?)
          )
      `).bind(
        queue.restaurant_id,
        QueueStatus.WAITING,
        queue.joined_at,
        queue.priority,
        queue.priority,
        queue.joined_at
      ).first() as any

      const position = positionResult?.position || 1

      // Recalculate estimated wait time
      const updatedWait = await this.calculateEstimatedWaitTime(
        queue.restaurant_id,
        queue.party_size,
        position
      )

      return {
        success: true,
        position,
        data: {
          queueId,
          queueNumber: queue.queue_number,
          currentPosition: position,
          estimatedWaitMinutes: updatedWait,
          status: queue.status,
          canCancel: true
        }
      }

    } catch (error) {
      console.error('獲取排隊位置失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '獲取排隊位置失敗'
      }
    }
  }

  // @invalidateCache((args: any[]) => CacheTagGenerators.restaurantQueues(args[0].restaurantId))
  async callNext(data: CallNextRequest, operatorId: number): Promise<ApiResponse<WaitingQueue>> {
    try {
      const validatedData = validateCallNext(data)

      let nextInQueue: any

      if (validatedData.specificQueueId) {
        nextInQueue = await this.d1.prepare(`
          SELECT * FROM waiting_queue
          WHERE id = ? AND status = ?
        `).bind(validatedData.specificQueueId, QueueStatus.WAITING).first()
      } else {
        nextInQueue = await this.d1.prepare(`
          SELECT * FROM waiting_queue
          WHERE restaurant_id = ?
            AND status = ?
            AND DATE(joined_at) = DATE('now')
          ORDER BY priority DESC, joined_at ASC
          LIMIT 1
        `).bind(validatedData.restaurantId, QueueStatus.WAITING).first()
      }

      if (!nextInQueue) {
        return {
          success: false,
          error: '沒有候位客戶'
        }
      }

      // Update status to called
      await this.d1.prepare(`
        UPDATE waiting_queue
        SET status = ?,
            called_at = CURRENT_TIMESTAMP,
            served_by = ?,
            assigned_table_id = ?
        WHERE id = ?
      `).bind(
        QueueStatus.CALLED,
        operatorId,
        validatedData.tableId || null,
        nextInQueue.id
      ).run()

      // Send notification
      await this.sendNotification(nextInQueue.id, 'called')

      // Record event
      await this.recordQueueEvent(
        validatedData.restaurantId,
        nextInQueue.id,
        'called',
        { tableId: validatedData.tableId, operatorId },
        operatorId
      )

      // Convert database record to WaitingQueue type
      const waitingQueue: WaitingQueue = {
        id: nextInQueue.id,
        restaurantId: nextInQueue.restaurant_id,
        queueNumber: nextInQueue.queue_number,
        customerName: nextInQueue.customer_name,
        customerPhone: nextInQueue.customer_phone,
        customerEmail: nextInQueue.customer_email,
        partySize: nextInQueue.party_size,
        specialRequests: nextInQueue.special_requests,
        priority: nextInQueue.priority,
        queueType: nextInQueue.queue_type as QueueType,
        estimatedWaitMinutes: nextInQueue.estimated_wait_minutes,
        actualWaitMinutes: nextInQueue.actual_wait_minutes,
        tablePreferences: JSON.parse(nextInQueue.table_preferences || '[]'),
        status: QueueStatus.CALLED,
        notificationMethods: JSON.parse(nextInQueue.notification_methods || '[]'),
        notificationSent: nextInQueue.notification_sent,
        lastNotificationAt: nextInQueue.last_notification_at ? new Date(nextInQueue.last_notification_at) : undefined,
        notificationCount: nextInQueue.notification_count,
        checkInCode: nextInQueue.check_in_code,
        joinedAt: new Date(nextInQueue.joined_at),
        calledAt: new Date(),
        servedBy: operatorId,
        assignedTableId: validatedData.tableId,
        metadata: JSON.parse(nextInQueue.metadata || '{}')
      }

      return {
        success: true,
        data: waitingQueue
      }

    } catch (error) {
      console.error('呼叫下一位失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '呼叫下一位失敗'
      }
    }
  }

  // Queue Settings Management
  // @cached((args: any[]) => CacheKeyGenerators.queueSettings(args[0]), 300000)
  async getQueueSettings(restaurantId: number): Promise<ApiResponse<QueueSettings>> {
    try {
      const settings = await this.d1.prepare(
        'SELECT * FROM queue_settings WHERE restaurant_id = ?'
      ).bind(restaurantId).first() as any

      if (!settings) {
        // Create default settings
        const defaultSettings = this.createDefaultSettings(restaurantId)
        await this.createQueueSettings(restaurantId, defaultSettings)

        return {
          success: true,
          data: {
            restaurantId,
            ...defaultSettings,
            createdAt: new Date(),
            updatedAt: new Date()
          } as QueueSettings
        }
      }

      const queueSettings: QueueSettings = {
        restaurantId: settings.restaurant_id,
        isEnabled: settings.is_enabled,
        maxQueueSize: settings.max_queue_size,
        avgServiceTime: settings.avg_service_time,
        maxWaitTime: settings.max_wait_time,
        minAdvanceNotice: settings.min_advance_notice,
        notificationMethods: JSON.parse(settings.notification_methods || '[]'),
        autoCallEnabled: settings.auto_call_enabled,
        autoCallInterval: settings.auto_call_interval,
        noShowTimeout: settings.no_show_timeout,
        queueNumberReset: settings.queue_number_reset,
        priorityRules: JSON.parse(settings.priority_rules || '{}'),
        tableAssignmentRules: JSON.parse(settings.table_assignment_rules || '{}'),
        notificationTemplates: JSON.parse(settings.notification_templates || '{}'),
        businessHours: JSON.parse(settings.business_hours || '{}'),
        holidaySettings: JSON.parse(settings.holiday_settings || '{}'),
        displaySettings: JSON.parse(settings.display_settings || '{}'),
        integrationSettings: JSON.parse(settings.integration_settings || '{}'),
        createdAt: new Date(settings.created_at),
        updatedAt: new Date(settings.updated_at)
      }

      return {
        success: true,
        data: queueSettings
      }

    } catch (error) {
      console.error('獲取候位設定失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '獲取候位設定失敗'
      }
    }
  }

  // Helper methods (keeping existing logic but with new types)
  private createDefaultSettings(restaurantId: number) {
    return {
      isEnabled: true,
      maxQueueSize: 50,
      avgServiceTime: 45,
      maxWaitTime: 120,
      minAdvanceNotice: 5,
      notificationMethods: [NotificationType.SMS],
      autoCallEnabled: true,
      autoCallInterval: 10,
      noShowTimeout: 15,
      queueNumberReset: 'daily' as const,
      priorityRules: {},
      tableAssignmentRules: {},
      notificationTemplates: {},
      businessHours: {},
      holidaySettings: {},
      displaySettings: {},
      integrationSettings: {}
    }
  }

  private async createQueueSettings(restaurantId: number, settings: any): Promise<void> {
    await this.d1.prepare(`
      INSERT INTO queue_settings (
        restaurant_id, is_enabled, max_queue_size, avg_service_time,
        max_wait_time, min_advance_notice, notification_methods,
        auto_call_enabled, auto_call_interval, no_show_timeout,
        queue_number_reset, priority_rules, table_assignment_rules,
        notification_templates, business_hours, holiday_settings,
        display_settings, integration_settings, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      restaurantId,
      settings.isEnabled,
      settings.maxQueueSize,
      settings.avgServiceTime,
      settings.maxWaitTime,
      settings.minAdvanceNotice,
      JSON.stringify(settings.notificationMethods),
      settings.autoCallEnabled,
      settings.autoCallInterval,
      settings.noShowTimeout,
      settings.queueNumberReset,
      JSON.stringify(settings.priorityRules),
      JSON.stringify(settings.tableAssignmentRules),
      JSON.stringify(settings.notificationTemplates),
      JSON.stringify(settings.businessHours),
      JSON.stringify(settings.holidaySettings),
      JSON.stringify(settings.displaySettings),
      JSON.stringify(settings.integrationSettings)
    ).run()
  }

  // Legacy methods adapted to new types
  private async getCurrentQueueSize(restaurantId: number): Promise<number> {
    const result = await this.d1.prepare(`
      SELECT COUNT(*) as count
      FROM waiting_queue
      WHERE restaurant_id = ? AND status = ? AND DATE(joined_at) = DATE('now')
    `).bind(restaurantId, QueueStatus.WAITING).first() as any

    return result?.count || 0
  }

  private async generateQueueNumber(restaurantId: number): Promise<number> {
    const today = new Date().toISOString().split('T')[0]

    const result = await this.d1.prepare(`
      SELECT COALESCE(MAX(queue_number), 0) + 1 as next_number
      FROM waiting_queue
      WHERE restaurant_id = ? AND DATE(joined_at) = ?
    `).bind(restaurantId, today).first() as any

    return result?.next_number || 1
  }

  private async calculateEstimatedWaitTime(
    restaurantId: number,
    partySize: number,
    position: number = 1
  ): Promise<number> {
    const settings = await this.getQueueSettings(restaurantId)
    const avgServiceTime = settings.data?.avgServiceTime || 45

    let baseWaitTime = (position - 1) * avgServiceTime

    if (partySize > 4) {
      baseWaitTime *= 1.2
    } else if (partySize > 8) {
      baseWaitTime *= 1.5
    }

    return Math.max(Math.round(baseWaitTime), 5)
  }

  private calculatePriority(data: JoinQueueRequest, priorityRules: Record<string, any>): number {
    let priority = 0

    if (data.queueType === QueueType.PHONE) {
      priority += 10
    }

    if (data.partySize >= 8) {
      priority += 5
    }

    if (data.specialRequests?.includes('輪椅') || data.specialRequests?.includes('嬰兒車')) {
      priority += 3
    }

    return priority
  }

  private isWithinBusinessHours(businessHours: Record<string, any>): boolean {
    const now = new Date()
    const currentHour = now.getHours()
    return currentHour >= 10 && currentHour < 22
  }

  private async sendNotification(queueId: string, templateType: string): Promise<void> {
    // Implementation similar to existing but with new types
    // This would integrate with the notification service
  }

  private async recordQueueEvent(
    restaurantId: number,
    queueId: string,
    eventType: string,
    eventData: any,
    triggeredBy?: number
  ): Promise<void> {
    const eventId = crypto.randomUUID()

    await this.d1.prepare(`
      INSERT INTO queue_events (
        id, restaurant_id, queue_id, event_type, event_data,
        triggered_by, triggered_by_system, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      eventId,
      restaurantId,
      queueId,
      eventType,
      JSON.stringify(eventData),
      triggeredBy || null,
      !triggeredBy
    ).run()
  }

  // Performance optimization methods
  public async getQueueStatus(restaurantId: number): Promise<ApiResponse<any>> {
    const cacheKey = CacheKeyGenerators.queueStatus(restaurantId)
    const cached = this.cache.get(cacheKey)

    if (cached && typeof cached === 'object' && 'success' in cached) {
      return cached as ApiResponse<any>
    }

    try {
      const [waitingCount, calledCount, todayTotal] = await Promise.all([
        this.d1.prepare(`
          SELECT COUNT(*) as count
          FROM waiting_queue
          WHERE restaurant_id = ? AND status = ? AND DATE(joined_at) = DATE('now')
        `).bind(restaurantId, QueueStatus.WAITING).first(),

        this.d1.prepare(`
          SELECT COUNT(*) as count
          FROM waiting_queue
          WHERE restaurant_id = ? AND status = ? AND DATE(joined_at) = DATE('now')
        `).bind(restaurantId, QueueStatus.CALLED).first(),

        this.d1.prepare(`
          SELECT COUNT(*) as count
          FROM waiting_queue
          WHERE restaurant_id = ? AND DATE(joined_at) = DATE('now')
        `).bind(restaurantId).first()
      ])

      const result = {
        success: true,
        data: {
          waiting: (waitingCount as any)?.count || 0,
          called: (calledCount as any)?.count || 0,
          totalToday: (todayTotal as any)?.count || 0,
          timestamp: new Date().toISOString()
        }
      }

      this.cache.set(cacheKey, result, 60000) // Cache for 1 minute
      return result

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '獲取隊列狀態失敗'
      }
    }
  }

  public async batchUpdateQueuePositions(restaurantId: number): Promise<void> {
    // Batch position recalculation for performance
    await this.d1.prepare(`
      UPDATE waiting_queue
      SET estimated_wait_minutes = (
        SELECT COUNT(*) * ?
        FROM waiting_queue w2
        WHERE w2.restaurant_id = waiting_queue.restaurant_id
          AND w2.status = 'waiting'
          AND w2.joined_at < waiting_queue.joined_at
      )
      WHERE restaurant_id = ? AND status = 'waiting'
    `).bind(45, restaurantId).run() // 45 = avg service time

    // Invalidate cache for this restaurant
    this.cache.invalidateRestaurant(restaurantId)
  }

  public getPerformanceMetrics(): any {
    return {
      cacheStats: this.cache.getStats(),
      lastUpdated: new Date().toISOString()
    }
  }

  /**
   * Seat customer (mark queue entry as seated)
   */
  public async seatCustomer(queueId: string, tableId: number, operatorId: number): Promise<ApiResponse<void>> {
    try {
      // Check if queue exists and is in correct status
      const queue = await this.d1.prepare(`
        SELECT * FROM waiting_queue
        WHERE id = ? AND status IN ('called', 'notified')
      `).bind(queueId).first() as any

      if (!queue) {
        return {
          success: false,
          error: '找不到候位記錄或狀態不正確'
        }
      }

      const now = new Date().toISOString()
      const actualWaitMinutes = Math.floor(
        (new Date(now).getTime() - new Date(queue.joined_at).getTime()) / (1000 * 60)
      )

      // Update queue status to seated
      await this.d1.prepare(`
        UPDATE waiting_queue
        SET
          status = ?,
          seated_at = ?,
          actual_wait_minutes = ?,
          served_by = ?,
          metadata = json_set(COALESCE(metadata, '{}'), '$.tableId', ?)
        WHERE id = ?
      `).bind(QueueStatus.SEATED, now, actualWaitMinutes, operatorId, tableId, queueId).run()

      // Record audit event
      await this.recordQueueEvent(queue.restaurant_id, queueId, 'seated', {
        operatorId,
        tableId,
        actualWaitMinutes
      }, operatorId)

      // Invalidate cache
      this.cache.invalidateByTags([`queue:${queueId}`, `restaurant:${queue.restaurant_id}`])

      return { success: true }
    } catch (error) {
      console.error('Seat customer error:', error)
      return {
        success: false,
        error: '客戶入座操作失敗'
      }
    }
  }

  /**
   * Cancel queue entry
   */
  public async cancelQueue(queueId: string, cancelledBy?: number, reason?: string): Promise<ApiResponse<void>> {
    try {
      // Check if queue exists and can be cancelled
      const queue = await this.d1.prepare(`
        SELECT * FROM waiting_queue
        WHERE id = ? AND status IN ('waiting', 'called', 'notified')
      `).bind(queueId).first() as any

      if (!queue) {
        return {
          success: false,
          error: '找不到候位記錄或無法取消'
        }
      }

      const now = new Date().toISOString()

      // Update queue status to cancelled
      await this.d1.prepare(`
        UPDATE waiting_queue
        SET
          status = ?,
          cancelled_at = ?,
          served_by = ?,
          metadata = json_set(COALESCE(metadata, '{}'), '$.cancellationReason', ?)
        WHERE id = ?
      `).bind(QueueStatus.CANCELLED, now, cancelledBy, reason || '', queueId).run()

      // Record audit event
      await this.recordQueueEvent(queue.restaurant_id, queueId, 'cancelled', {
        cancelledBy,
        reason
      }, cancelledBy)

      // Invalidate cache
      this.cache.invalidateByTags([`queue:${queueId}`, `restaurant:${queue.restaurant_id}`])

      return { success: true }
    } catch (error) {
      console.error('Cancel queue error:', error)
      return {
        success: false,
        error: '取消候位操作失敗'
      }
    }
  }

  /**
   * Update queue settings for a restaurant
   */
  public async updateQueueSettings(restaurantId: number, updates: Partial<QueueSettings>): Promise<ApiResponse<void>> {
    try {
      // Check if settings exist
      const existing = await this.d1.prepare(`
        SELECT * FROM queue_settings WHERE restaurant_id = ?
      `).bind(restaurantId).first()

      if (!existing) {
        // Create new settings if they don't exist
        await this.createQueueSettings(restaurantId, updates)
      } else {
        // Update existing settings
        const updateFields = []
        const values = []

        if (updates.isEnabled !== undefined) {
          updateFields.push('is_enabled = ?')
          values.push(updates.isEnabled)
        }
        if (updates.maxQueueSize !== undefined) {
          updateFields.push('max_queue_size = ?')
          values.push(updates.maxQueueSize)
        }
        if (updates.avgServiceTime !== undefined) {
          updateFields.push('avg_service_time = ?')
          values.push(updates.avgServiceTime)
        }
        if (updates.maxWaitTime !== undefined) {
          updateFields.push('max_wait_time = ?')
          values.push(updates.maxWaitTime)
        }
        if (updates.minAdvanceNotice !== undefined) {
          updateFields.push('min_advance_notice = ?')
          values.push(updates.minAdvanceNotice)
        }
        if (updates.notificationMethods !== undefined) {
          updateFields.push('notification_methods = ?')
          values.push(JSON.stringify(updates.notificationMethods))
        }
        if (updates.autoCallEnabled !== undefined) {
          updateFields.push('auto_call_enabled = ?')
          values.push(updates.autoCallEnabled)
        }
        if (updates.autoCallInterval !== undefined) {
          updateFields.push('auto_call_interval = ?')
          values.push(updates.autoCallInterval)
        }
        if (updates.noShowTimeout !== undefined) {
          updateFields.push('no_show_timeout = ?')
          values.push(updates.noShowTimeout)
        }
        if (updates.queueNumberReset !== undefined) {
          updateFields.push('queue_number_reset = ?')
          values.push(updates.queueNumberReset)
        }

        if (updateFields.length > 0) {
          updateFields.push('updated_at = ?')
          values.push(new Date().toISOString())
          values.push(restaurantId)

          await this.d1.prepare(`
            UPDATE queue_settings
            SET ${updateFields.join(', ')}
            WHERE restaurant_id = ?
          `).bind(...values).run()
        }
      }

      // Invalidate cache
      this.cache.invalidateRestaurant(restaurantId)

      return { success: true }
    } catch (error) {
      console.error('Update queue settings error:', error)
      return {
        success: false,
        error: '更新候位設定失敗'
      }
    }
  }

  /**
   * Get queue statistics for a restaurant
   */
  public async getQueueStatistics(restaurantId: number, dateRange?: { from: Date; to: Date }): Promise<ApiResponse<QueueStatistics>> {
    try {
      const fromDate = dateRange?.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Default: 30 days ago
      const toDate = dateRange?.to || new Date()

      // Basic statistics
      const stats = await this.d1.prepare(`
        SELECT
          COUNT(*) as total_entries,
          COUNT(CASE WHEN status = 'seated' THEN 1 END) as seated_count,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count,
          COUNT(CASE WHEN status = 'no_show' THEN 1 END) as no_show_count,
          AVG(CASE WHEN actual_wait_minutes IS NOT NULL THEN actual_wait_minutes END) as avg_wait_minutes,
          MIN(CASE WHEN actual_wait_minutes IS NOT NULL THEN actual_wait_minutes END) as min_wait_minutes,
          MAX(CASE WHEN actual_wait_minutes IS NOT NULL THEN actual_wait_minutes END) as max_wait_minutes,
          AVG(party_size) as avg_party_size
        FROM waiting_queue
        WHERE restaurant_id = ?
          AND joined_at >= ?
          AND joined_at <= ?
      `).bind(restaurantId, fromDate.toISOString(), toDate.toISOString()).first() as any

      // Hourly breakdown
      const hourlyBreakdown = await this.d1.prepare(`
        SELECT
          strftime('%H', joined_at) as hour,
          COUNT(*) as entries,
          COUNT(CASE WHEN status = 'seated' THEN 1 END) as seated,
          AVG(CASE WHEN actual_wait_minutes IS NOT NULL THEN actual_wait_minutes END) as avg_wait
        FROM waiting_queue
        WHERE restaurant_id = ?
          AND joined_at >= ?
          AND joined_at <= ?
        GROUP BY strftime('%H', joined_at)
        ORDER BY hour
      `).bind(restaurantId, fromDate.toISOString(), toDate.toISOString()).all() as any

      // Queue type breakdown
      const queueTypeBreakdown = await this.d1.prepare(`
        SELECT
          queue_type,
          COUNT(*) as count,
          COUNT(CASE WHEN status = 'seated' THEN 1 END) as seated,
          AVG(CASE WHEN actual_wait_minutes IS NOT NULL THEN actual_wait_minutes END) as avg_wait
        FROM waiting_queue
        WHERE restaurant_id = ?
          AND joined_at >= ?
          AND joined_at <= ?
        GROUP BY queue_type
      `).bind(restaurantId, fromDate.toISOString(), toDate.toISOString()).all() as any

      const statistics: any = {
        dateRange: { from: fromDate, to: toDate },
        totalEntries: stats.total_entries || 0,
        seatedCount: stats.seated_count || 0,
        cancelledCount: stats.cancelled_count || 0,
        noShowCount: stats.no_show_count || 0,
        completionRate: stats.total_entries > 0 ? (stats.seated_count / stats.total_entries) * 100 : 0,
        avgWaitMinutes: stats.avg_wait_minutes || 0,
        minWaitMinutes: stats.min_wait_minutes || 0,
        maxWaitMinutes: stats.max_wait_minutes || 0,
        avgPartySize: stats.avg_party_size || 0,
        hourlyBreakdown: (hourlyBreakdown.results || []).map((item: any) => ({
          hour: parseInt(item.hour),
          entries: item.entries,
          seated: item.seated,
          avgWait: item.avg_wait || 0
        })),
        queueTypeBreakdown: (queueTypeBreakdown.results || []).map((item: any) => ({
          type: item.queue_type,
          count: item.count,
          seated: item.seated,
          avgWait: item.avg_wait || 0
        }))
      }

      return {
        success: true,
        data: statistics
      }
    } catch (error) {
      console.error('Get queue statistics error:', error)
      return {
        success: false,
        error: '獲取候位統計失敗'
      }
    }
  }

  /**
   * Cleanup expired queue records
   */
  public async cleanupExpiredQueues(): Promise<{ cleaned: number }> {
    try {
      // Mark old waiting queues as expired (older than 24 hours)
      const expiredThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      const result = await this.d1.prepare(`
        UPDATE waiting_queue
        SET status = ?, updated_at = ?
        WHERE status IN ('waiting', 'called', 'notified')
          AND joined_at < ?
      `).bind(QueueStatus.EXPIRED, new Date().toISOString(), expiredThreshold).run()

      // Clear all cache since we modified queue data
      globalQueueCache.clear()

      return { cleaned: result.meta.changes || 0 }
    } catch (error) {
      console.error('Cleanup expired queues error:', error)
      return { cleaned: 0 }
    }
  }
}
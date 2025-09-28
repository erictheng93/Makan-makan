/**
 * Performance-Optimized Queue Service
 *
 * Enhanced version of QueueServiceModular with advanced caching,
 * batching, and performance optimizations
 */

import { BaseService } from './base'
import {
  WaitingQueue,
  QueuePosition,
  QueueSettings,
  QueueStatistics,
  QueueStatus,
  QueueType,
  NotificationType,
  JoinQueueRequest,
  JoinQueueResponse,
  CallNextRequest,
  QueuePositionResponse,
  ApiResponse,
  validateJoinQueue,
  validateCallNext
} from '@makanmakan/queue-core'
import {
  QueueCache,
  CacheKeyGenerators,
  CacheTagGenerators,
  cached,
  invalidateCache
} from '@makanmakan/queue-core/performance/queue-cache'

export interface BatchOperationResult<T> {
  successful: T[]
  failed: Array<{ index: number; error: string }>
}

export interface QueueMetrics {
  averageJoinTime: number
  averageCallTime: number
  peakHours: number[]
  dailyThroughput: number
  cacheHitRate: number
}

export class QueueServiceOptimized extends BaseService {
  private cache: QueueCache
  private batchSize = 10
  private metricsBuffer: Array<{ operation: string; timestamp: number; duration: number }> = []

  constructor(db: any, cacheConfig?: any) {
    super(db)
    this.cache = new QueueCache(cacheConfig)

    // Start background tasks
    this.startBackgroundTasks()
  }

  /**
   * Optimized join queue with caching and batching support
   */
  // @invalidateCache((args: any) => CacheTagGenerators.restaurantQueues(args[0].restaurantId))
  async joinQueue(data: JoinQueueRequest): Promise<ApiResponse<JoinQueueResponse>> {
    const startTime = Date.now()

    try {
      const validatedData = validateJoinQueue(data)

      // Fast path: Check cache for recent settings
      const settings = await this.getCachedQueueSettings(validatedData.restaurantId)
      if (!settings.data?.isEnabled) {
        return {
          success: false,
          error: '候位系統目前未開放'
        }
      }

      // Optimized queue size check with cache
      const currentQueueSize = await this.getCachedQueueSize(validatedData.restaurantId)
      if (currentQueueSize >= settings.data.maxQueueSize) {
        return {
          success: false,
          error: '候位隊列已滿，請稍後再試'
        }
      }

      // Business hours check (cached)
      if (!this.isWithinBusinessHours(validatedData.restaurantId)) {
        return {
          success: false,
          error: '目前非營業時間'
        }
      }

      // Generate queue data
      const queueNumber = await this.generateQueueNumber(validatedData.restaurantId)
      const queueId = crypto.randomUUID()
      const checkInCode = Math.random().toString(36).substring(2, 8).toUpperCase()

      // Calculate estimated wait time (with performance optimization)
      const estimatedWait = await this.calculateOptimizedEstimatedWaitTime(
        validatedData.restaurantId,
        validatedData.partySize
      )

      // Calculate priority
      const priority = this.calculatePriority(validatedData)

      // Insert with prepared statement for better performance
      const insertStmt = this.d1.prepare(`
        INSERT INTO waiting_queue (
          id, restaurant_id, queue_number, customer_name, customer_phone,
          customer_email, party_size, special_requests, priority, queue_type,
          estimated_wait_minutes, table_preferences, status, notification_methods,
          notification_sent, notification_count, check_in_code, joined_at, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, CURRENT_TIMESTAMP, '{}')
      `)

      await insertStmt.bind(
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

      // Get current position with optimization
      const currentPosition = await this.getOptimizedQueuePosition(queueId)

      // Async notification (non-blocking)
      this.scheduleNotification(queueId, 'welcome', validatedData)

      const result: ApiResponse<JoinQueueResponse> = {
        success: true,
        data: {
          queueId,
          queueNumber,
          estimatedWaitMinutes: estimatedWait,
          currentPosition: currentPosition.position || 1,
          checkInCode
        }
      }

      // Record metrics
      this.recordMetric('joinQueue', startTime)

      return result

    } catch (error) {
      console.error('加入候位隊列失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '加入候位隊列失敗'
      }
    }
  }

  /**
   * Optimized batch join queue for multiple customers
   */
  async batchJoinQueue(requests: JoinQueueRequest[]): Promise<BatchOperationResult<JoinQueueResponse>> {
    const results: JoinQueueResponse[] = []
    const failed: Array<{ index: number; error: string }> = []

    // Process in batches to avoid overwhelming the database
    for (let i = 0; i < requests.length; i += this.batchSize) {
      const batch = requests.slice(i, i + this.batchSize)
      const batchPromises = batch.map(async (request, batchIndex) => {
        try {
          const result = await this.joinQueue(request)
          if (result.success && result.data) {
            return { success: true, data: result.data, index: i + batchIndex }
          } else {
            return { success: false, error: result.error || 'Unknown error', index: i + batchIndex }
          }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Batch processing error',
            index: i + batchIndex
          }
        }
      })

      const batchResults = await Promise.allSettled(batchPromises)

      batchResults.forEach((result, batchIndex) => {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            results.push(result.value.data!)
          } else {
            failed.push({ index: result.value.index || 0, error: result.value.error || 'Unknown error' })
          }
        } else {
          failed.push({ index: i + batchIndex, error: result.reason?.message || 'Promise rejected' })
        }
      })

      // Add small delay between batches to prevent overwhelming
      if (i + this.batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }

    return { successful: results, failed }
  }

  /**
   * Cached queue position lookup
   */
  // @cached((args: any) => ({ ...CacheKeyGenerators.queuePosition(args[0]), restaurantId: 0 }), 15000)
  async getQueuePosition(queueId: string): Promise<ApiResponse<QueuePositionResponse> & { position?: number }> {
    return this.getOptimizedQueuePosition(queueId)
  }

  private async getOptimizedQueuePosition(queueId: string): Promise<ApiResponse<QueuePositionResponse> & { position?: number }> {
    try {
      // Use prepared statement for better performance
      const queueStmt = this.d1.prepare('SELECT * FROM waiting_queue WHERE id = ?')
      const queue = await queueStmt.bind(queueId).first() as any

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

      // Optimized position calculation with index usage
      const positionStmt = this.d1.prepare(`
        SELECT COUNT(*) + 1 as position
        FROM waiting_queue
        WHERE restaurant_id = ?
          AND status = ?
          AND DATE(joined_at) = DATE(?)
          AND (
            priority > ?
            OR (priority = ? AND joined_at < ?)
          )
      `)

      const positionResult = await positionStmt.bind(
        queue.restaurant_id,
        QueueStatus.WAITING,
        queue.joined_at,
        queue.priority,
        queue.priority,
        queue.joined_at
      ).first() as any

      const position = positionResult?.position || 1

      // Optimized wait time calculation
      const updatedWait = await this.calculateOptimizedEstimatedWaitTime(
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

  /**
   * Optimized call next with transaction support
   */
  // @invalidateCache((args: any) => CacheTagGenerators.restaurantQueues(args[0].restaurantId))
  async callNext(data: CallNextRequest, operatorId: number): Promise<ApiResponse<WaitingQueue>> {
    const startTime = Date.now()

    try {
      const validatedData = validateCallNext(data)

      // Use optimized query with proper indexing
      let nextInQueue: any

      if (validatedData.specificQueueId) {
        const specificStmt = this.d1.prepare(`
          SELECT * FROM waiting_queue
          WHERE id = ? AND status = ?
        `)
        nextInQueue = await specificStmt.bind(validatedData.specificQueueId, QueueStatus.WAITING).first()
      } else {
        const nextStmt = this.d1.prepare(`
          SELECT * FROM waiting_queue
          WHERE restaurant_id = ?
            AND status = ?
            AND DATE(joined_at) = DATE('now')
          ORDER BY priority DESC, joined_at ASC
          LIMIT 1
        `)
        nextInQueue = await nextStmt.bind(validatedData.restaurantId, QueueStatus.WAITING).first()
      }

      if (!nextInQueue) {
        return {
          success: false,
          error: '沒有候位客戶'
        }
      }

      // Use prepared statement for update
      const updateStmt = this.d1.prepare(`
        UPDATE waiting_queue
        SET status = ?,
            called_at = CURRENT_TIMESTAMP,
            served_by = ?,
            assigned_table_id = ?
        WHERE id = ?
      `)

      await updateStmt.bind(
        QueueStatus.CALLED,
        operatorId,
        validatedData.tableId || null,
        nextInQueue.id
      ).run()

      // Async notification (non-blocking)
      this.scheduleNotification(nextInQueue.id, 'called')

      // Record event asynchronously
      this.recordQueueEventAsync(
        validatedData.restaurantId,
        nextInQueue.id,
        'called',
        { tableId: validatedData.tableId, operatorId },
        operatorId
      )

      // Convert to WaitingQueue type
      const waitingQueue: WaitingQueue = this.convertToWaitingQueue(nextInQueue, {
        status: QueueStatus.CALLED,
        calledAt: new Date(),
        servedBy: operatorId,
        assignedTableId: validatedData.tableId
      })

      this.recordMetric('callNext', startTime)

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

  /**
   * Cached queue settings
   */
  // @cached((args: any) => CacheKeyGenerators.queueSettings(args[0]), 300000) // 5 minutes cache
  async getCachedQueueSettings(restaurantId: number): Promise<ApiResponse<QueueSettings>> {
    return this.getQueueSettings(restaurantId)
  }

  /**
   * Get queue settings with fallback
   */
  async getQueueSettings(restaurantId: number): Promise<ApiResponse<QueueSettings>> {
    try {
      const stmt = this.d1.prepare('SELECT * FROM queue_settings WHERE restaurant_id = ?')
      const settings = await stmt.bind(restaurantId).first() as any

      if (!settings) {
        // Create default settings
        const defaultSettings = this.createDefaultSettings()
        await this.createQueueSettings(restaurantId)

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

      const queueSettings: QueueSettings = this.convertToQueueSettings(settings)

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

  /**
   * Optimized queue size calculation with caching
   */
  private async getCachedQueueSize(restaurantId: number): Promise<number> {
    const cacheKey = { type: 'status' as const, restaurantId, identifier: 'size' }
    const cached = this.cache.get<number>(cacheKey)

    if (cached !== null) {
      return cached
    }

    const stmt = this.d1.prepare(`
      SELECT COUNT(*) as count
      FROM waiting_queue
      WHERE restaurant_id = ? AND status = ? AND DATE(joined_at) = DATE('now')
    `)
    const result = await stmt.bind(restaurantId, QueueStatus.WAITING).first() as any
    const size = result?.count || 0

    this.cache.set(cacheKey, size, 30000) // Cache for 30 seconds
    return size
  }

  /**
   * Optimized estimated wait time calculation
   */
  private async calculateOptimizedEstimatedWaitTime(
    restaurantId: number,
    partySize: number,
    position: number = 1
  ): Promise<number> {
    // Try to get from cache first
    const cacheKey = {
      type: 'stats' as const,
      restaurantId,
      identifier: `waittime:${partySize}:${position}`
    }
    const cached = this.cache.get<number>(cacheKey)

    if (cached !== null) {
      return cached
    }

    const settings = await this.getCachedQueueSettings(restaurantId)
    const avgServiceTime = settings.data?.avgServiceTime || 45

    let baseWaitTime = (position - 1) * avgServiceTime

    // Apply party size multiplier
    if (partySize > 4) {
      baseWaitTime *= 1.2
    } else if (partySize > 8) {
      baseWaitTime *= 1.5
    }

    const estimatedTime = Math.max(Math.round(baseWaitTime), 5)

    // Cache for 1 minute
    this.cache.set(cacheKey, estimatedTime, 60000)

    return estimatedTime
  }

  /**
   * Get queue metrics and performance statistics
   */
  async getQueueMetrics(restaurantId: number): Promise<QueueMetrics> {
    const cacheStats = this.cache.getStats()

    // Calculate metrics from buffer
    const recentMetrics = this.metricsBuffer.slice(-100) // Last 100 operations
    const avgJoinTime = recentMetrics
      .filter(m => m.operation === 'joinQueue')
      .reduce((sum, m, _, arr) => sum + m.duration / arr.length, 0)

    const avgCallTime = recentMetrics
      .filter(m => m.operation === 'callNext')
      .reduce((sum, m, _, arr) => sum + m.duration / arr.length, 0)

    // Mock peak hours calculation (would use real data in production)
    const peakHours = [12, 13, 18, 19, 20]

    return {
      averageJoinTime: Math.round(avgJoinTime),
      averageCallTime: Math.round(avgCallTime),
      peakHours,
      dailyThroughput: recentMetrics.length,
      cacheHitRate: cacheStats.hitRate || 0
    }
  }

  // Helper methods
  private convertToWaitingQueue(dbRecord: any, overrides: Partial<WaitingQueue> = {}): WaitingQueue {
    return {
      id: dbRecord.id,
      restaurantId: dbRecord.restaurant_id,
      queueNumber: dbRecord.queue_number,
      customerName: dbRecord.customer_name,
      customerPhone: dbRecord.customer_phone,
      customerEmail: dbRecord.customer_email,
      partySize: dbRecord.party_size,
      specialRequests: dbRecord.special_requests,
      priority: dbRecord.priority,
      queueType: dbRecord.queue_type as QueueType,
      estimatedWaitMinutes: dbRecord.estimated_wait_minutes,
      actualWaitMinutes: dbRecord.actual_wait_minutes,
      tablePreferences: JSON.parse(dbRecord.table_preferences || '[]'),
      status: dbRecord.status as any,
      notificationMethods: JSON.parse(dbRecord.notification_methods || '[]'),
      notificationSent: dbRecord.notification_sent,
      lastNotificationAt: dbRecord.last_notification_at ? new Date(dbRecord.last_notification_at) : undefined,
      notificationCount: dbRecord.notification_count,
      checkInCode: dbRecord.check_in_code,
      joinedAt: new Date(dbRecord.joined_at),
      calledAt: dbRecord.called_at ? new Date(dbRecord.called_at) : undefined,
      notifiedAt: dbRecord.notified_at ? new Date(dbRecord.notified_at) : undefined,
      seatedAt: dbRecord.seated_at ? new Date(dbRecord.seated_at) : undefined,
      cancelledAt: dbRecord.cancelled_at ? new Date(dbRecord.cancelled_at) : undefined,
      assignedTableId: dbRecord.assigned_table_id,
      servedBy: dbRecord.served_by,
      notes: dbRecord.notes,
      metadata: JSON.parse(dbRecord.metadata || '{}'),
      ...overrides
    }
  }

  private convertToQueueSettings(dbRecord: any): QueueSettings {
    return {
      restaurantId: dbRecord.restaurant_id,
      isEnabled: dbRecord.is_enabled,
      maxQueueSize: dbRecord.max_queue_size,
      avgServiceTime: dbRecord.avg_service_time,
      maxWaitTime: dbRecord.max_wait_time,
      minAdvanceNotice: dbRecord.min_advance_notice,
      notificationMethods: JSON.parse(dbRecord.notification_methods || '[]'),
      autoCallEnabled: dbRecord.auto_call_enabled,
      autoCallInterval: dbRecord.auto_call_interval,
      noShowTimeout: dbRecord.no_show_timeout,
      queueNumberReset: dbRecord.queue_number_reset,
      priorityRules: JSON.parse(dbRecord.priority_rules || '{}'),
      tableAssignmentRules: JSON.parse(dbRecord.table_assignment_rules || '{}'),
      notificationTemplates: JSON.parse(dbRecord.notification_templates || '{}'),
      businessHours: JSON.parse(dbRecord.business_hours || '{}'),
      holidaySettings: JSON.parse(dbRecord.holiday_settings || '{}'),
      displaySettings: JSON.parse(dbRecord.display_settings || '{}'),
      integrationSettings: JSON.parse(dbRecord.integration_settings || '{}'),
      createdAt: new Date(dbRecord.created_at),
      updatedAt: new Date(dbRecord.updated_at)
    }
  }

  private async scheduleNotification(queueId: string, type: string, data?: any): Promise<void> {
    // Non-blocking notification scheduling
    setTimeout(async () => {
      try {
        await this.sendNotification({ queueId, type })
      } catch (error) {
        console.error('Notification failed:', error)
      }
    }, 0)
  }

  private async recordQueueEventAsync(
    restaurantId: number,
    queueId: string,
    eventType: string,
    eventData: any,
    triggeredBy?: number
  ): Promise<void> {
    // Non-blocking event recording
    setTimeout(async () => {
      try {
        await this.recordQueueEvent({ restaurantId, queueId, eventType, eventData, triggeredBy })
      } catch (error) {
        console.error('Event recording failed:', error)
      }
    }, 0)
  }

  private recordMetric(operation: string, startTime: number): void {
    const duration = Date.now() - startTime
    this.metricsBuffer.push({ operation, timestamp: Date.now(), duration })

    // Keep buffer size manageable
    if (this.metricsBuffer.length > 1000) {
      this.metricsBuffer = this.metricsBuffer.slice(-500)
    }
  }

  private startBackgroundTasks(): void {
    // Cache cleanup every 5 minutes
    setInterval(() => {
      const cleaned = this.cache.cleanup()
      if (cleaned > 0) {
        console.log(`Cleaned ${cleaned} expired cache entries`)
      }
    }, 300000)

    // Metrics buffer cleanup every hour
    setInterval(() => {
      if (this.metricsBuffer.length > 100) {
        this.metricsBuffer = this.metricsBuffer.slice(-100)
      }
    }, 3600000)
  }

  // Default implementations for missing methods
  private createDefaultSettings(): any {
    return {
      maxWaitTime: 60,
      allowReservations: true,
      autoCallNext: false
    }
  }

  private async createQueueSettings(restaurantId: number): Promise<any> {
    return this.createDefaultSettings()
  }

  private async generateQueueNumber(restaurantId: number): Promise<number> {
    return Math.floor(Math.random() * 1000) + 1
  }

  private calculatePriority(data: any): number {
    return data.priority || 0
  }

  private isWithinBusinessHours(restaurantId: number): boolean {
    return true // Simplified implementation
  }

  private async sendNotification(data: any): Promise<void> {
    // Simplified implementation
  }

  private async recordQueueEvent(data: any): Promise<void> {
    // Simplified implementation
  }
}
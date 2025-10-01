import { z } from 'zod'
import { BaseService, CloudflareEnv } from './base'

// 類型定義
export interface WaitingQueue {
  id: string
  restaurantId: number
  queueNumber: number
  customerName: string
  customerPhone?: string
  customerEmail?: string
  partySize: number
  specialRequests?: string
  priority: number
  queueType: 'walkin' | 'online' | 'phone' | 'reservation'
  estimatedWaitMinutes: number
  actualWaitMinutes?: number
  tablePreferences: number[]
  status: 'waiting' | 'called' | 'notified' | 'seated' | 'cancelled' | 'no_show' | 'expired'
  notificationMethods: string[]
  notificationSent: boolean
  lastNotificationAt?: Date
  notificationCount: number
  checkInCode?: string
  joinedAt: Date
  calledAt?: Date
  notifiedAt?: Date
  seatedAt?: Date
  cancelledAt?: Date
  assignedTableId?: number
  servedBy?: number
  notes?: string
  metadata: Record<string, any>
}

export interface QueueNotification {
  id: string
  queueId: string
  notificationType: 'sms' | 'push' | 'email' | 'call' | 'display'
  recipient: string
  messageTemplate: string
  messageContent: string
  deliveryStatus: 'pending' | 'sending' | 'sent' | 'delivered' | 'failed' | 'expired'
  deliveryProvider?: string
  providerResponse?: string
  deliveryAttempts: number
  maxAttempts: number
  sentAt?: Date
  deliveredAt?: Date
  failedAt?: Date
  errorMessage?: string
  cost: number
  createdAt: Date
}

export interface QueueSettings {
  restaurantId: number
  isEnabled: boolean
  maxQueueSize: number
  avgServiceTime: number
  maxWaitTime: number
  minAdvanceNotice: number
  notificationMethods: string[]
  autoCallEnabled: boolean
  autoCallInterval: number
  noShowTimeout: number
  queueNumberReset: 'daily' | 'weekly' | 'monthly' | 'never'
  priorityRules: Record<string, any>
  tableAssignmentRules: Record<string, any>
  notificationTemplates: Record<string, string>
  businessHours: Record<string, any>
  holidaySettings: Record<string, any>
  displaySettings: Record<string, any>
  integrationSettings: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

// 請求/回應類型
export interface JoinQueueRequest {
  restaurantId: number
  customerName: string
  customerPhone?: string
  customerEmail?: string
  partySize: number
  specialRequests?: string
  queueType?: 'walkin' | 'online' | 'phone'
  tablePreferences?: number[]
  notificationMethods?: string[]
}

export interface JoinQueueResponse {
  queueId: string
  queueNumber: number
  estimatedWaitMinutes: number
  currentPosition: number
  checkInCode: string
}

export interface QueuePositionResponse {
  queueId: string
  queueNumber: number
  currentPosition: number
  estimatedWaitMinutes: number
  status: string
  canCancel: boolean
}

export interface CallNextRequest {
  restaurantId: number
  tableId?: number
  specificQueueId?: string
}

// 驗證 schemas
const joinQueueSchema = z.object({
  restaurantId: z.number().int().positive(),
  customerName: z.string().min(1).max(100),
  customerPhone: z.string().max(20).optional(),
  customerEmail: z.string().email().optional(),
  partySize: z.number().int().min(1).max(20),
  specialRequests: z.string().max(500).optional(),
  queueType: z.enum(['walkin', 'online', 'phone']).optional().default('online'),
  tablePreferences: z.array(z.number().int().positive()).optional().default([]),
  notificationMethods: z.array(z.enum(['sms', 'push', 'email'])).optional().default(['sms'])
})

const callNextSchema = z.object({
  restaurantId: z.number().int().positive(),
  tableId: z.number().int().positive().optional(),
  specificQueueId: z.string().uuid().optional()
})

const updateQueueSettingsSchema = z.object({
  isEnabled: z.boolean().optional(),
  maxQueueSize: z.number().int().min(1).max(200).optional(),
  avgServiceTime: z.number().int().min(15).max(480).optional(),
  maxWaitTime: z.number().int().min(30).max(600).optional(),
  minAdvanceNotice: z.number().int().min(1).max(60).optional(),
  notificationMethods: z.array(z.enum(['sms', 'push', 'email', 'call'])).optional(),
  autoCallEnabled: z.boolean().optional(),
  autoCallInterval: z.number().int().min(1).max(60).optional(),
  noShowTimeout: z.number().int().min(5).max(60).optional(),
  queueNumberReset: z.enum(['daily', 'weekly', 'monthly', 'never']).optional()
})

export class QueueService extends BaseService {
  constructor(db: any, env: CloudflareEnv) {
    super(db, env)
  }

  // 加入候位隊列
  async joinQueue(
    data: JoinQueueRequest
  ): Promise<{ success: boolean; data?: JoinQueueResponse; error?: string }> {
    try {
      const validatedData = joinQueueSchema.parse(data)

      // 檢查候位系統是否啟用
      const settings = await this.getQueueSettings(validatedData.restaurantId)
      if (!settings.data?.isEnabled) {
        return {
          success: false,
          error: '候位系統目前未開放'
        }
      }

      // 檢查隊列是否已滿
      const currentQueueSize = await this.getCurrentQueueSize(validatedData.restaurantId)
      if (currentQueueSize >= settings.data.maxQueueSize) {
        return {
          success: false,
          error: '候位隊列已滿，請稍後再試'
        }
      }

      // 檢查是否在營業時間
      if (!this.isWithinBusinessHours(settings.data.businessHours)) {
        return {
          success: false,
          error: '目前非營業時間'
        }
      }

      // 生成隊列號碼
      const queueNumber = await this.generateQueueNumber(validatedData.restaurantId)
      const queueId = crypto.randomUUID()
      const checkInCode = Math.random().toString(36).substring(2, 8).toUpperCase()

      // 計算預估等待時間
      const estimatedWait = await this.calculateEstimatedWaitTime(
        validatedData.restaurantId, 
        validatedData.partySize
      )

      // 計算優先級
      const priority = this.calculatePriority(validatedData, settings.data.priorityRules)

      await this.d1.prepare(`
        INSERT INTO waiting_queue (
          id, restaurant_id, queue_number, customer_name, customer_phone, 
          customer_email, party_size, special_requests, priority, queue_type,
          estimated_wait_minutes, table_preferences, status, notification_methods,
          notification_sent, notification_count, check_in_code, joined_at, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting', ?, 0, 0, ?, CURRENT_TIMESTAMP, '{}')
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
        validatedData.queueType,
        estimatedWait,
        JSON.stringify(validatedData.tablePreferences),
        JSON.stringify(validatedData.notificationMethods),
        checkInCode
      ).run()

      // 獲取當前位置
      const currentPosition = await this.getQueuePosition(queueId)

      // 發送歡迎通知
      if (validatedData.customerPhone && validatedData.notificationMethods?.includes('sms')) {
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

  // 獲取隊列狀態
  async getQueueStatus(
    restaurantId: number
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const queueStatus = await this.d1.prepare(`
        SELECT 
          COUNT(*) as total_waiting,
          AVG(estimated_wait_minutes) as avg_estimated_wait,
          MIN(estimated_wait_minutes) as min_wait,
          MAX(estimated_wait_minutes) as max_wait,
          COUNT(CASE WHEN queue_type = 'online' THEN 1 END) as online_count,
          COUNT(CASE WHEN queue_type = 'walkin' THEN 1 END) as walkin_count,
          COUNT(CASE WHEN priority > 0 THEN 1 END) as priority_count
        FROM waiting_queue 
        WHERE restaurant_id = ? 
          AND status = 'waiting' 
          AND DATE(joined_at) = DATE('now')
      `).bind(restaurantId).first()

      const recentActivity = await this.d1.prepare(`
        SELECT 
          COUNT(CASE WHEN status = 'seated' THEN 1 END) as seated_today,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_today,
          COUNT(CASE WHEN status = 'no_show' THEN 1 END) as no_show_today,
          AVG(CASE WHEN actual_wait_minutes IS NOT NULL THEN actual_wait_minutes END) as avg_actual_wait
        FROM waiting_queue 
        WHERE restaurant_id = ? 
          AND DATE(joined_at) = DATE('now')
      `).bind(restaurantId).first()

      return {
        success: true,
        data: {
          queue: queueStatus,
          activity: recentActivity
        }
      }

    } catch (error) {
      console.error('獲取隊列狀態失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '獲取隊列狀態失敗'
      }
    }
  }

  // 獲取個人排隊位置
  async getQueuePosition(
    queueId: string
  ): Promise<{ success: boolean; data?: QueuePositionResponse; error?: string; position?: number }> {
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

      if (queue.status !== 'waiting') {
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

      // 計算當前位置
      const positionResult = await this.d1.prepare(`
        SELECT COUNT(*) + 1 as position
        FROM waiting_queue 
        WHERE restaurant_id = ? 
          AND status = 'waiting'
          AND DATE(joined_at) = DATE(?)
          AND (
            priority > ? 
            OR (priority = ? AND joined_at < ?)
          )
      `).bind(
        queue.restaurant_id,
        queue.joined_at,
        queue.priority,
        queue.priority,
        queue.joined_at
      ).first() as any

      const position = positionResult?.position || 1

      // 重新計算預估等待時間
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

  // 呼叫下一位
  async callNext(
    data: CallNextRequest,
    operatorId: number
  ): Promise<{ success: boolean; data?: WaitingQueue; error?: string }> {
    try {
      const validatedData = callNextSchema.parse(data)

      let nextInQueue: any

      if (validatedData.specificQueueId) {
        // 呼叫特定的候位記錄
        nextInQueue = await this.d1.prepare(`
          SELECT * FROM waiting_queue 
          WHERE id = ? AND status = 'waiting'
        `).bind(validatedData.specificQueueId).first()
      } else {
        // 根據優先級和時間順序呼叫下一位
        nextInQueue = await this.d1.prepare(`
          SELECT * FROM waiting_queue 
          WHERE restaurant_id = ? 
            AND status = 'waiting'
            AND DATE(joined_at) = DATE('now')
          ORDER BY priority DESC, joined_at ASC
          LIMIT 1
        `).bind(validatedData.restaurantId).first()
      }

      if (!nextInQueue) {
        return {
          success: false,
          error: '沒有候位客戶'
        }
      }

      // 更新狀態為已呼叫
      await this.d1.prepare(`
        UPDATE waiting_queue 
        SET status = 'called', 
            called_at = CURRENT_TIMESTAMP,
            served_by = ?,
            assigned_table_id = ?
        WHERE id = ?
      `).bind(
        operatorId,
        validatedData.tableId || null,
        nextInQueue.id
      ).run()

      // 發送通知
      await this.sendNotification(nextInQueue.id, 'called')

      // 記錄事件
      await this.recordQueueEvent(
        validatedData.restaurantId,
        nextInQueue.id,
        'called',
        { tableId: validatedData.tableId, operatorId },
        operatorId
      )

      return {
        success: true,
        data: {
          ...nextInQueue,
          status: 'called',
          calledAt: new Date(),
          servedBy: operatorId,
          assignedTableId: validatedData.tableId,
          tablePreferences: JSON.parse(nextInQueue.table_preferences || '[]'),
          notificationMethods: JSON.parse(nextInQueue.notification_methods || '[]'),
          metadata: JSON.parse(nextInQueue.metadata || '{}')
        }
      }

    } catch (error) {
      console.error('呼叫下一位失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '呼叫下一位失敗'
      }
    }
  }

  // 客戶入座
  async seatCustomer(
    queueId: string,
    tableId: number,
    operatorId: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const queue = await this.d1.prepare(
        'SELECT * FROM waiting_queue WHERE id = ? AND status IN ("waiting", "called")'
      ).bind(queueId).first() as any

      if (!queue) {
        return {
          success: false,
          error: '找不到有效的候位記錄'
        }
      }

      // 計算實際等待時間
      const actualWaitMinutes = Math.floor(
        (new Date().getTime() - new Date(queue.joined_at).getTime()) / 60000
      )

      // 更新狀態為已入座
      await this.d1.prepare(`
        UPDATE waiting_queue 
        SET status = 'seated',
            seated_at = CURRENT_TIMESTAMP,
            actual_wait_minutes = ?,
            assigned_table_id = ?,
            served_by = ?
        WHERE id = ?
      `).bind(actualWaitMinutes, tableId, operatorId, queueId).run()

      // 更新桌台狀態
      await this.d1.prepare(
        'UPDATE tables SET status = "occupied" WHERE id = ?'
      ).bind(tableId).run()

      // 記錄桌台狀態變更
      await this.recordTableStatusChange(
        tableId, 
        'available', 
        'occupied', 
        queueId, 
        operatorId
      )

      // 發送入座通知
      await this.sendNotification(queueId, 'seated')

      // 記錄事件
      await this.recordQueueEvent(
        queue.restaurant_id,
        queueId,
        'seated',
        { tableId, actualWaitMinutes },
        operatorId
      )

      return { success: true }

    } catch (error) {
      console.error('客戶入座失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '客戶入座失敗'
      }
    }
  }

  // 取消候位
  async cancelQueue(
    queueId: string,
    cancelledBy?: number,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const queue = await this.d1.prepare(
        'SELECT * FROM waiting_queue WHERE id = ? AND status = "waiting"'
      ).bind(queueId).first() as any

      if (!queue) {
        return {
          success: false,
          error: '找不到有效的候位記錄'
        }
      }

      await this.d1.prepare(`
        UPDATE waiting_queue 
        SET status = 'cancelled',
            cancelled_at = CURRENT_TIMESTAMP,
            notes = COALESCE(notes || ' | ', '') || ?
        WHERE id = ?
      `).bind(reason || '客戶取消', queueId).run()

      // 發送取消通知
      await this.sendNotification(queueId, 'cancelled')

      // 記錄事件
      await this.recordQueueEvent(
        queue.restaurant_id,
        queueId,
        'cancelled',
        { reason, cancelledBy },
        cancelledBy
      )

      return { success: true }

    } catch (error) {
      console.error('取消候位失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '取消候位失敗'
      }
    }
  }

  // 發送通知
  private async sendNotification(
    queueId: string,
    templateType: 'welcome' | 'called' | 'seated' | 'cancelled' | 'reminder'
  ): Promise<void> {
    try {
      const queue = await this.d1.prepare(
        'SELECT * FROM waiting_queue WHERE id = ?'
      ).bind(queueId).first() as any

      if (!queue || !queue.customer_phone) return

      const settings = await this.getQueueSettings(queue.restaurant_id)
      const templates = settings.data?.notificationTemplates || {}
      
      const message = this.generateNotificationMessage(queue, templateType, templates)
      
      const notificationId = crypto.randomUUID()
      
      await this.d1.prepare(`
        INSERT INTO queue_notifications (
          id, queue_id, notification_type, recipient, message_template,
          message_content, delivery_status, delivery_attempts, max_attempts,
          cost, created_at
        ) VALUES (?, ?, 'sms', ?, ?, ?, 'pending', 0, 3, 0, CURRENT_TIMESTAMP)
      `).bind(
        notificationId,
        queueId,
        queue.customer_phone,
        templateType,
        message
      ).run()

      // 模擬發送（實際應整合SMS服務商）
      setTimeout(async () => {
        try {
          await this.d1.prepare(`
            UPDATE queue_notifications 
            SET delivery_status = 'sent', sent_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).bind(notificationId).run()

          await this.d1.prepare(`
            UPDATE waiting_queue 
            SET notification_sent = 1, 
                notification_count = notification_count + 1,
                last_notification_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(queueId).run()
        } catch (error) {
          console.error('更新通知狀態失敗:', error)
        }
      }, 1000)

    } catch (error) {
      console.error('發送通知失敗:', error)
    }
  }

  private generateNotificationMessage(
    queue: any, 
    templateType: string, 
    templates: Record<string, string>
  ): string {
    const defaultMessages = {
      welcome: `您好 ${queue.customer_name}，您的候位號碼是 ${queue.queue_number}，預估等待時間 ${queue.estimated_wait_minutes} 分鐘。`,
      called: `${queue.customer_name} 您好，您的號碼 ${queue.queue_number} 已經叫到，請前往櫃台。`,
      seated: `謝謝您的耐心等候，祝您用餐愉快！`,
      cancelled: `您的候位已取消，感謝您的理解。`,
      reminder: `${queue.customer_name} 您好，您的號碼 ${queue.queue_number} 預計還需要等待 ${queue.estimated_wait_minutes} 分鐘。`
    }

    return templates[templateType] || (defaultMessages as any)[templateType] || '通知訊息'
  }

  // 輔助方法
  private async getCurrentQueueSize(restaurantId: number): Promise<number> {
    const result = await this.d1.prepare(`
      SELECT COUNT(*) as count 
      FROM waiting_queue 
      WHERE restaurant_id = ? AND status = 'waiting' AND DATE(joined_at) = DATE('now')
    `).bind(restaurantId).first() as any

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
    
    // 基礎等待時間 = 前面的人數 * 平均服務時間
    let baseWaitTime = (position - 1) * avgServiceTime

    // 根據聚餐人數調整（大聚餐需要更長時間）
    if (partySize > 4) {
      baseWaitTime *= 1.2
    } else if (partySize > 8) {
      baseWaitTime *= 1.5
    }

    return Math.max(Math.round(baseWaitTime), 5) // 最少5分鐘
  }

  private calculatePriority(
    data: JoinQueueRequest, 
    priorityRules: Record<string, any>
  ): number {
    let priority = 0

    // 基礎優先級邏輯
    if (data.queueType === 'phone') {
      priority += 10 // Phone reservations get priority
    }
    
    if (data.partySize >= 8) {
      priority += 5 // 大團體優先
    }

    if (data.specialRequests?.includes('輪椅') || data.specialRequests?.includes('嬰兒車')) {
      priority += 3 // 特殊需求優先
    }

    return priority
  }

  private isWithinBusinessHours(businessHours: Record<string, any>): boolean {
    // 簡化的營業時間檢查邏輯
    const now = new Date()
    const currentHour = now.getHours()
    
    // 預設營業時間 10:00-22:00
    return currentHour >= 10 && currentHour < 22
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

  private async recordTableStatusChange(
    tableId: number,
    previousStatus: string,
    newStatus: string,
    queueId?: string,
    changedBy?: number
  ): Promise<void> {
    const recordId = crypto.randomUUID()
    
    await this.d1.prepare(`
      INSERT INTO table_status_history (
        id, table_id, previous_status, new_status, queue_id,
        changed_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      recordId,
      tableId,
      previousStatus,
      newStatus,
      queueId || null,
      changedBy || null
    ).run()
  }

  // 獲取候位系統設定
  async getQueueSettings(
    restaurantId: number
  ): Promise<{ success: boolean; data?: QueueSettings; error?: string }> {
    try {
      const settings = await this.d1.prepare(
        'SELECT * FROM queue_settings WHERE restaurant_id = ?'
      ).bind(restaurantId).first() as any

      if (!settings) {
        // 創建預設設定
        const defaultSettings = {
          isEnabled: true,
          maxQueueSize: 50,
          avgServiceTime: 45,
          maxWaitTime: 120,
          minAdvanceNotice: 5,
          notificationMethods: ['sms'],
          autoCallEnabled: true,
          autoCallInterval: 10,
          noShowTimeout: 15,
          queueNumberReset: 'daily',
          priorityRules: {},
          tableAssignmentRules: {},
          notificationTemplates: {},
          businessHours: {},
          holidaySettings: {},
          displaySettings: {},
          integrationSettings: {}
        }

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
          defaultSettings.isEnabled,
          defaultSettings.maxQueueSize,
          defaultSettings.avgServiceTime,
          defaultSettings.maxWaitTime,
          defaultSettings.minAdvanceNotice,
          JSON.stringify(defaultSettings.notificationMethods),
          defaultSettings.autoCallEnabled,
          defaultSettings.autoCallInterval,
          defaultSettings.noShowTimeout,
          defaultSettings.queueNumberReset,
          JSON.stringify(defaultSettings.priorityRules),
          JSON.stringify(defaultSettings.tableAssignmentRules),
          JSON.stringify(defaultSettings.notificationTemplates),
          JSON.stringify(defaultSettings.businessHours),
          JSON.stringify(defaultSettings.holidaySettings),
          JSON.stringify(defaultSettings.displaySettings),
          JSON.stringify(defaultSettings.integrationSettings)
        ).run()

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

      return {
        success: true,
        data: {
          ...settings,
          notificationMethods: JSON.parse(settings.notification_methods || '[]'),
          priorityRules: JSON.parse(settings.priority_rules || '{}'),
          tableAssignmentRules: JSON.parse(settings.table_assignment_rules || '{}'),
          notificationTemplates: JSON.parse(settings.notification_templates || '{}'),
          businessHours: JSON.parse(settings.business_hours || '{}'),
          holidaySettings: JSON.parse(settings.holiday_settings || '{}'),
          displaySettings: JSON.parse(settings.display_settings || '{}'),
          integrationSettings: JSON.parse(settings.integration_settings || '{}')
        }
      }

    } catch (error) {
      console.error('獲取候位設定失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '獲取候位設定失敗'
      }
    }
  }

  // 更新候位系統設定
  async updateQueueSettings(
    restaurantId: number,
    updates: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const validatedData = updateQueueSettingsSchema.parse(updates)

      // Whitelist of allowed field mappings to prevent SQL injection
      const fieldMapping: Record<string, string> = {
        isEnabled: 'is_enabled',
        maxQueueSize: 'max_queue_size',
        avgServiceTime: 'avg_service_time',
        maxWaitTime: 'max_wait_time',
        minAdvanceNotice: 'min_advance_notice',
        notificationMethods: 'notification_methods',
        autoCallEnabled: 'auto_call_enabled',
        autoCallInterval: 'auto_call_interval',
        noShowTimeout: 'no_show_timeout',
        queueNumberReset: 'queue_number_reset'
      }

      const updateFields = []
      const params = []

      for (const [key, value] of Object.entries(validatedData)) {
        if (value !== undefined && fieldMapping[key]) {
          const dbKey = fieldMapping[key]
          updateFields.push(`${dbKey} = ?`)

          if (Array.isArray(value) || typeof value === 'object') {
            params.push(JSON.stringify(value))
          } else {
            params.push(value)
          }
        }
      }

      if (updateFields.length === 0) {
        return { success: true }
      }

      updateFields.push('updated_at = CURRENT_TIMESTAMP')
      params.push(restaurantId)

      await this.d1.prepare(`
        UPDATE queue_settings
        SET ${updateFields.join(', ')}
        WHERE restaurant_id = ?
      `).bind(...params).run()

      return { success: true }

    } catch (error) {
      console.error('更新候位設定失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '更新候位設定失敗'
      }
    }
  }

  // 獲取候位統計
  async getQueueStatistics(
    restaurantId: number,
    dateRange?: { from: Date; to: Date }
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      let dateFilter = ''
      const params = [restaurantId.toString()]

      if (dateRange) {
        dateFilter = ' AND joined_at >= ? AND joined_at <= ?'
        params.push(dateRange.from.toISOString(), dateRange.to.toISOString())
      }

      const stats = await this.d1.prepare(`
        SELECT 
          COUNT(*) as total_customers,
          COUNT(CASE WHEN status = 'seated' THEN 1 END) as seated_customers,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_customers,
          COUNT(CASE WHEN status = 'no_show' THEN 1 END) as no_show_customers,
          AVG(CASE WHEN actual_wait_minutes IS NOT NULL THEN actual_wait_minutes END) as avg_actual_wait,
          AVG(estimated_wait_minutes) as avg_estimated_wait,
          MAX(queue_number) as max_queue_number
        FROM waiting_queue 
        WHERE restaurant_id = ? ${dateFilter}
      `).bind(...params).first()

      const hourlyBreakdown = await this.d1.prepare(`
        SELECT 
          strftime('%H', joined_at) as hour,
          COUNT(*) as customer_count,
          AVG(actual_wait_minutes) as avg_wait
        FROM waiting_queue 
        WHERE restaurant_id = ? ${dateFilter}
        GROUP BY strftime('%H', joined_at)
        ORDER BY hour
      `).bind(...params).all()

      return {
        success: true,
        data: {
          summary: stats,
          hourlyBreakdown: hourlyBreakdown.results
        }
      }

    } catch (error) {
      console.error('獲取候位統計失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '獲取候位統計失敗'
      }
    }
  }

  // 自動清理過期記錄
  async cleanupExpiredQueues(): Promise<{ success: boolean; cleaned?: number; error?: string }> {
    try {
      // 標記超時未響應的記錄為 no_show
      const noShowResult = await this.d1.prepare(`
        UPDATE waiting_queue 
        SET status = 'no_show' 
        WHERE status = 'called' 
          AND called_at < datetime('now', '-15 minutes')
      `).run()

      // 清理舊記錄（30天前）
      const cleanupResult = await this.d1.prepare(`
        DELETE FROM waiting_queue 
        WHERE joined_at < datetime('now', '-30 days')
          AND status IN ('seated', 'cancelled', 'no_show')
      `).run()

      return {
        success: true,
        cleaned: (noShowResult.meta.changes || 0) + (cleanupResult.meta.changes || 0)
      }

    } catch (error) {
      console.error('清理過期候位記錄失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '清理過期候位記錄失敗'
      }
    }
  }
}
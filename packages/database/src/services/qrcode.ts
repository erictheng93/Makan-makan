import { eq, desc, count, and, sql } from 'drizzle-orm'
import { BaseService } from './base'
import { 
  qrCodes, 
  qrTemplates, 
  qrDownloads, 
  qrBatches,
  auditLogs,
  type NewQRCode,
  type NewQRTemplate,
  type NewQRDownload,
  type NewQRBatch,
  type QRCode,
  type QRTemplate
} from '../schema'

export interface QRStyleData {
  backgroundColor?: string
  foregroundColor?: string
  size?: number
  errorCorrection?: 'L' | 'M' | 'Q' | 'H'
  cornerStyle?: 'square' | 'rounded' | 'circle'
  dotStyle?: 'square' | 'rounded' | 'circle'
  gradientType?: 'none' | 'linear' | 'radial'
  gradientColors?: {
    start: string
    end: string
    direction?: number
  }
  logo?: {
    url: string
    size: number
    borderRadius: number
    margin: number
  }
  border?: {
    width: number
    color: string
    style: 'solid' | 'dashed' | 'dotted'
  }
  shadow?: {
    enabled: boolean
    color: string
    blur: number
    offsetX: number
    offsetY: number
  }
}

export interface CreateQRCodeData {
  content: string
  format?: 'png' | 'svg' | 'pdf' | 'jpeg'
  style?: QRStyleData
  metadata?: {
    title?: string
    description?: string
    [key: string]: any
  }
}

export interface CreateQRTemplateData {
  name: string
  description?: string
  style: QRStyleData
  isDefault?: boolean
  createdBy: number
}

export interface QRCodeStats {
  totalCodes: number
  todayCodes: number
  totalDownloads: number
  popularTemplates: Array<{
    id: number
    name: string
    usageCount: number
  }>
}

export class QRCodeService extends BaseService {
  /**
   * 生成QR碼
   */
  async generateQRCode(data: CreateQRCodeData): Promise<QRCode> {
    const qrCodeData: NewQRCode = {
      content: data.content,
      format: data.format || 'png',
      styleJson: data.style ? JSON.stringify(data.style) : null,
      metadataJson: data.metadata ? JSON.stringify(data.metadata) : null,
      url: null // Will be set after actual QR generation
    }

    const result = await this.db.insert(qrCodes).values(qrCodeData).returning()
    return result[0]
  }

  /**
   * 批量生成QR碼
   */
  async generateBulkQRCodes(restaurantId: number, tableIds: number[], userId: number): Promise<{ batchId: string; totalCodes: number }> {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // 創建批次記錄
    const batchData: NewQRBatch = {
      batchId,
      restaurantId,
      totalCodes: tableIds.length,
      createdBy: userId,
      status: 'processing'
    }

    await this.db.insert(qrBatches).values(batchData)

    // 記錄審計日誌
    await this.createAuditLog({
      userId,
      action: 'bulk_generate_qr_codes',
      resource: 'qr_codes',
      description: JSON.stringify({ 
        batchId, 
        restaurantId, 
        tableCount: tableIds.length 
      })
    })

    return { batchId, totalCodes: tableIds.length }
  }

  /**
   * 獲取QR碼詳情
   */
  async getQRCode(id: string): Promise<QRCode | null> {
    const result = await this.db.select().from(qrCodes).where(eq(qrCodes.id, id)).limit(1)
    return result[0] || null
  }

  /**
   * 記錄QR碼下載
   */
  async recordDownload(qrCodeId: string, format: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const downloadData: NewQRDownload = {
      qrCodeId,
      format,
      ipAddress,
      userAgent
    }

    await this.db.insert(qrDownloads).values(downloadData)
  }

  /**
   * 創建QR碼模板
   */
  async createTemplate(data: CreateQRTemplateData): Promise<QRTemplate> {
    const templateData: NewQRTemplate = {
      name: data.name,
      description: data.description,
      styleJson: JSON.stringify(data.style),
      isDefault: data.isDefault || false,
      createdBy: data.createdBy
    }

    const result = await this.db.insert(qrTemplates).values(templateData).returning()
    const template = result[0]

    // 記錄審計日誌
    await this.createAuditLog({
      userId: data.createdBy,
      action: 'create_qr_template',
      resource: 'qr_templates',
      description: JSON.stringify({ templateId: template.id, name: data.name })
    })

    return template
  }

  /**
   * 獲取QR碼模板
   */
  async getTemplate(id: number): Promise<QRTemplate | null> {
    const result = await this.db.select().from(qrTemplates).where(eq(qrTemplates.id, id)).limit(1)
    return result[0] || null
  }

  /**
   * 更新QR碼模板
   */
  async updateTemplate(id: number, data: Partial<CreateQRTemplateData>, userId: number): Promise<QRTemplate> {
    const updateData: Partial<NewQRTemplate> = {
      updatedAt: new Date().toISOString()
    }

    if (data.name) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.style) updateData.styleJson = JSON.stringify(data.style)
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault

    await this.db.update(qrTemplates).set(updateData).where(eq(qrTemplates.id, id))

    const template = await this.getTemplate(id)
    if (!template) {
      throw new Error('Template not found after update')
    }

    // 記錄審計日誌
    await this.createAuditLog({
      userId,
      action: 'update_qr_template',
      resource: 'qr_templates',
      description: JSON.stringify({ templateId: id, changes: Object.keys(updateData) })
    })

    return template
  }

  /**
   * 軟刪除QR碼模板
   */
  async deleteTemplate(id: number, userId: number): Promise<void> {
    await this.db.update(qrTemplates)
      .set({ 
        isActive: false, 
        updatedAt: new Date().toISOString() 
      })
      .where(eq(qrTemplates.id, id))

    // 記錄審計日誌
    await this.createAuditLog({
      userId,
      action: 'delete_qr_template',
      resource: 'qr_templates',
      description: JSON.stringify({ templateId: id })
    })
  }

  /**
   * 獲取所有活躍模板
   */
  async getActiveTemplates(): Promise<QRTemplate[]> {
    return this.db.select()
      .from(qrTemplates)
      .where(eq(qrTemplates.isActive, true))
      .orderBy(desc(qrTemplates.createdAt))
  }

  /**
   * 獲取批次狀態
   */
  async getBatchStatus(batchId: string): Promise<any> {
    const result = await this.db.select().from(qrBatches).where(eq(qrBatches.batchId, batchId)).limit(1)
    return result[0] || null
  }

  /**
   * 獲取QR碼統計
   */
  async getQRCodeStats(): Promise<QRCodeStats> {
    // 總QR碼數
    const totalCodesResult = await this.db.select({ count: count() }).from(qrCodes)
    const totalCodes = totalCodesResult[0]?.count || 0

    // 今日QR碼數
    const todayCodesResult = await this.db.select({ count: count() })
      .from(qrCodes)
      .where(sql`DATE(${qrCodes.createdAt}) = DATE('now')`)
    const todayCodes = todayCodesResult[0]?.count || 0

    // 總下載數
    const totalDownloadsResult = await this.db.select({ count: count() }).from(qrDownloads)
    const totalDownloads = totalDownloadsResult[0]?.count || 0

    // 熱門模板 (這需要複雜查詢，暫時返回空數組)
    const popularTemplates: Array<{ id: number; name: string; usageCount: number }> = []

    return {
      totalCodes,
      todayCodes,
      totalDownloads,
      popularTemplates
    }
  }

  /**
   * 創建審計日誌
   */
  async createAuditLog(data: { userId: number; action: string; resource: string; description: string }): Promise<void> {
    await this.db.insert(auditLogs).values({
      userId: data.userId,
      action: data.action,
      resource: data.resource,
      description: data.description
    })
  }
}

// 導出類型定義
export type { QRCode, QRTemplate, NewQRCode, NewQRTemplate }
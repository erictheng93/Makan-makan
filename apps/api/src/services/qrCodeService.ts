// QR Code Generation Service with Custom Styling Support
import type { Env } from '../types/env'

export interface QRCodeStyle {
  // 基本樣式
  backgroundColor: string
  foregroundColor: string
  size: number
  errorCorrection: 'L' | 'M' | 'Q' | 'H'
  
  // Logo配置
  logo?: {
    url: string
    size: number // 0-30, percentage of QR code size
    borderRadius: number // 0-50, percentage
    margin: number // 0-20, percentage
  }
  
  // 進階樣式
  cornerStyle: 'square' | 'rounded' | 'circle'
  dotStyle: 'square' | 'rounded' | 'circle'
  gradientType?: 'none' | 'linear' | 'radial'
  gradientColors?: {
    start: string
    end: string
    direction?: number // 0-360 degrees for linear gradient
  }
  
  // 邊框和陰影
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

export interface QRCodeOptions {
  content: string
  format: 'png' | 'svg' | 'pdf' | 'jpeg'
  style?: Partial<QRCodeStyle>
  metadata?: {
    title?: string
    description?: string
    createdBy?: string
    version?: string
  }
}

export interface BulkQROptions {
  tables: Array<{
    id: number
    name: string
    content: string
    customStyle?: Partial<QRCodeStyle>
  }>
  defaultStyle: Partial<QRCodeStyle>
  format: 'png' | 'svg' | 'pdf' | 'zip'
  includeMetadata: boolean
  pdfSettings?: {
    layout: 'grid' | 'list'
    itemsPerPage: number
    pageSize: 'A4' | 'A3' | 'Letter'
    includeTableInfo: boolean
  }
}

export interface QRTemplate {
  id: string
  name: string
  description: string
  style: QRCodeStyle
  category: 'modern' | 'classic' | 'colorful' | 'minimalist' | 'branded'
  previewUrl?: string
  createdAt: string
  updatedAt: string
}

export class QRCodeService {
  private env: Env
  
  constructor(env: Env) {
    this.env = env
  }

  // 預設樣式模板
  private getDefaultTemplates(): QRTemplate[] {
    return [
      {
        id: 'classic-black',
        name: '經典黑白',
        description: '簡潔的黑白設計，適合所有場景',
        category: 'classic',
        style: {
          backgroundColor: '#FFFFFF',
          foregroundColor: '#000000',
          size: 300,
          errorCorrection: 'M',
          cornerStyle: 'square',
          dotStyle: 'square'
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'modern-blue',
        name: '現代藍調',
        description: '現代感十足的藍色主題',
        category: 'modern',
        style: {
          backgroundColor: '#F8FAFC',
          foregroundColor: '#1E40AF',
          size: 300,
          errorCorrection: 'M',
          cornerStyle: 'rounded',
          dotStyle: 'rounded',
          gradientType: 'linear',
          gradientColors: {
            start: '#3B82F6',
            end: '#1E40AF',
            direction: 45
          },
          border: {
            width: 2,
            color: '#E5E7EB',
            style: 'solid'
          }
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'restaurant-branded',
        name: '餐廳品牌',
        description: '適合餐廳使用的溫暖色調',
        category: 'branded',
        style: {
          backgroundColor: '#FEF7ED',
          foregroundColor: '#EA580C',
          size: 300,
          errorCorrection: 'H', // Higher error correction for logo
          cornerStyle: 'rounded',
          dotStyle: 'circle',
          logo: {
            url: '/images/restaurant-logo.png',
            size: 20,
            borderRadius: 50,
            margin: 5
          },
          shadow: {
            enabled: true,
            color: '#00000020',
            blur: 8,
            offsetX: 2,
            offsetY: 4
          }
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'colorful-gradient',
        name: '彩色漸層',
        description: '吸引眼球的彩色漸層設計',
        category: 'colorful',
        style: {
          backgroundColor: '#FFFFFF',
          foregroundColor: '#8B5CF6',
          size: 300,
          errorCorrection: 'M',
          cornerStyle: 'circle',
          dotStyle: 'rounded',
          gradientType: 'radial',
          gradientColors: {
            start: '#8B5CF6',
            end: '#EC4899'
          },
          border: {
            width: 3,
            color: '#F3E8FF',
            style: 'solid'
          }
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'minimalist-clean',
        name: '極簡清潔',
        description: '極簡風格，強調簡潔性',
        category: 'minimalist',
        style: {
          backgroundColor: '#FAFAFA',
          foregroundColor: '#374151',
          size: 250,
          errorCorrection: 'L',
          cornerStyle: 'rounded',
          dotStyle: 'square'
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]
  }

  /**
   * 生成單個QR碼
   */
  async generateQRCode(options: QRCodeOptions): Promise<{
    success: boolean
    data?: {
      id: string
      url: string
      downloadUrl: string
      metadata: any
    }
    error?: string
  }> {
    try {
      const style = this.mergeWithDefaultStyle(options.style)
      const qrId = this.generateQRId()
      
      // 構建QR碼生成URL（使用第三方服務或內部生成）
      const qrUrl = this.buildQRCodeUrl(options.content, style, options.format)
      
      // 如果需要自訂樣式，使用高級生成服務
      let finalUrl = qrUrl
      if (this.needsAdvancedGeneration(style)) {
        finalUrl = await this.generateAdvancedQRCode(options.content, style, options.format, qrId)
      }
      
      // 儲存QR碼記錄到資料庫
      await this.saveQRCodeRecord({
        id: qrId,
        content: options.content,
        style,
        format: options.format,
        url: finalUrl,
        metadata: options.metadata
      })
      
      return {
        success: true,
        data: {
          id: qrId,
          url: finalUrl,
          downloadUrl: `${this.getBaseUrl()}/api/v1/qr/${qrId}/download`,
          metadata: {
            size: style.size,
            format: options.format,
            errorCorrection: style.errorCorrection,
            hasLogo: !!style.logo,
            hasCustomStyling: this.needsAdvancedGeneration(style),
            generatedAt: new Date().toISOString(),
            ...options.metadata
          }
        }
      }
      
    } catch (error) {
      console.error('QR Code generation error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate QR code'
      }
    }
  }

  /**
   * 批量生成QR碼
   */
  async generateBulkQRCodes(options: BulkQROptions): Promise<{
    success: boolean
    data?: {
      batchId: string
      generated: number
      qrCodes: Array<{
        tableId: number
        tableName: string
        qrId: string
        url: string
        downloadUrl: string
      }>
      bulkDownloadUrl?: string
      metadata: any
    }
    error?: string
  }> {
    try {
      const batchId = this.generateBatchId()
      const qrCodes = []
      
      for (const table of options.tables) {
        const tableStyle = this.mergeWithDefaultStyle({
          ...options.defaultStyle,
          ...table.customStyle
        })
        
        const qrId = this.generateQRId()
        let qrUrl: string
        
        if (this.needsAdvancedGeneration(tableStyle)) {
          qrUrl = await this.generateAdvancedQRCode(
            table.content, 
            tableStyle, 
            options.format === 'zip' ? 'png' : options.format,
            qrId
          )
        } else {
          qrUrl = this.buildQRCodeUrl(
            table.content, 
            tableStyle, 
            options.format === 'zip' ? 'png' : options.format
          )
        }
        
        // 儲存單個QR碼記錄
        await this.saveQRCodeRecord({
          id: qrId,
          content: table.content,
          style: tableStyle,
          format: options.format === 'zip' ? 'png' : options.format,
          url: qrUrl,
          metadata: {
            tableId: table.id,
            tableName: table.name,
            batchId
          }
        })
        
        qrCodes.push({
          tableId: table.id,
          tableName: table.name,
          qrId,
          url: qrUrl,
          downloadUrl: `${this.getBaseUrl()}/api/v1/qr/${qrId}/download`
        })
      }
      
      // 批量下載URL（ZIP格式或PDF）
      let bulkDownloadUrl: string | undefined
      if (options.format === 'zip' || options.format === 'pdf') {
        bulkDownloadUrl = `${this.getBaseUrl()}/api/v1/qr/batch/${batchId}/download?format=${options.format}`
      }
      
      // 儲存批量生成記錄
      await this.saveBatchRecord({
        batchId,
        qrCodeIds: qrCodes.map(qr => qr.qrId),
        options,
        generatedCount: qrCodes.length
      })
      
      return {
        success: true,
        data: {
          batchId,
          generated: qrCodes.length,
          qrCodes,
          bulkDownloadUrl,
          metadata: {
            format: options.format,
            defaultStyle: options.defaultStyle,
            includeMetadata: options.includeMetadata,
            generatedAt: new Date().toISOString(),
            totalTables: options.tables.length
          }
        }
      }
      
    } catch (error) {
      console.error('Bulk QR Code generation error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate bulk QR codes'
      }
    }
  }

  /**
   * 獲取可用的QR碼模板
   */
  async getTemplates(): Promise<QRTemplate[]> {
    try {
      // 從資料庫獲取自訂模板
      const customTemplates = await this.env.DB.prepare(`
        SELECT * FROM qr_templates 
        WHERE is_active = 1 
        ORDER BY created_at DESC
      `).all()
      
      const templates = this.getDefaultTemplates()
      
      // 合併預設模板和自訂模板
      if (customTemplates.results?.length) {
        const custom = customTemplates.results.map((template: any) => ({
          id: template.id,
          name: template.name,
          description: template.description,
          category: template.category,
          style: JSON.parse(template.style_json),
          previewUrl: template.preview_url,
          createdAt: template.created_at,
          updatedAt: template.updated_at
        }))
        
        templates.push(...custom)
      }
      
      return templates
      
    } catch (error) {
      console.error('Get templates error:', error)
      return this.getDefaultTemplates()
    }
  }

  /**
   * 創建自訂模板
   */
  async createTemplate(template: Omit<QRTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<{
    success: boolean
    data?: QRTemplate
    error?: string
  }> {
    try {
      const templateId = this.generateTemplateId()
      const now = new Date().toISOString()
      
      const newTemplate: QRTemplate = {
        id: templateId,
        createdAt: now,
        updatedAt: now,
        ...template
      }
      
      // 生成預覽圖
      const previewUrl = await this.generateTemplatePreview(newTemplate.style)
      newTemplate.previewUrl = previewUrl
      
      // 儲存到資料庫
      await this.env.DB.prepare(`
        INSERT INTO qr_templates (
          id, name, description, category, style_json, 
          preview_url, is_active, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).bind(
        templateId,
        template.name,
        template.description,
        template.category,
        JSON.stringify(template.style),
        previewUrl,
        now,
        now
      ).run()
      
      return {
        success: true,
        data: newTemplate
      }
      
    } catch (error) {
      console.error('Create template error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create template'
      }
    }
  }

  // 私有方法

  private mergeWithDefaultStyle(customStyle?: Partial<QRCodeStyle>): QRCodeStyle {
    const defaultStyle: QRCodeStyle = {
      backgroundColor: '#FFFFFF',
      foregroundColor: '#000000',
      size: 300,
      errorCorrection: 'M',
      cornerStyle: 'square',
      dotStyle: 'square'
    }
    
    return { ...defaultStyle, ...customStyle }
  }

  private needsAdvancedGeneration(style: QRCodeStyle): boolean {
    return !!(
      style.logo ||
      style.gradientType !== 'none' ||
      style.border ||
      style.shadow?.enabled ||
      style.cornerStyle !== 'square' ||
      style.dotStyle !== 'square'
    )
  }

  private buildQRCodeUrl(content: string, style: QRCodeStyle, format: string): string {
    const params = new URLSearchParams({
      data: content,
      size: `${style.size}x${style.size}`,
      bgcolor: style.backgroundColor.replace('#', ''),
      color: style.foregroundColor.replace('#', ''),
      ecc: style.errorCorrection,
      format: format
    })
    
    return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`
  }

  private async generateAdvancedQRCode(
    content: string, 
    style: QRCodeStyle, 
    format: string,
    qrId: string
  ): Promise<string> {
    // 這裡會使用更高級的QR碼生成服務
    // 可以整合 QuickChart.io, QR-Code-Styling 或自建服務
    
    const advancedParams = {
      text: content,
      width: style.size,
      height: style.size,
      format: format,
      backgroundColor: style.backgroundColor,
      foregroundColor: style.foregroundColor,
      errorCorrection: style.errorCorrection,
      cornerStyle: style.cornerStyle,
      dotStyle: style.dotStyle,
      ...style.logo && { logo: style.logo },
      ...style.gradientType !== 'none' && { 
        gradient: {
          type: style.gradientType,
          colors: style.gradientColors
        }
      },
      ...style.border && { border: style.border },
      ...style.shadow?.enabled && { shadow: style.shadow }
    }
    
    // 使用 QuickChart.io 作為示例
    const chartUrl = `https://quickchart.io/qr?text=${encodeURIComponent(content)}&size=${style.size}&format=${format}`
    
    // 在實際實現中，這裡會調用更複雜的API或使用Canvas生成
    return chartUrl
  }

  private async generateTemplatePreview(style: QRCodeStyle): Promise<string> {
    const previewContent = 'https://example.com/preview'
    return this.buildQRCodeUrl(previewContent, { ...style, size: 150 }, 'png')
  }

  private async saveQRCodeRecord(record: any): Promise<void> {
    await this.env.DB.prepare(`
      INSERT INTO qr_codes (
        id, content, style_json, format, url, metadata_json, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      record.id,
      record.content,
      JSON.stringify(record.style),
      record.format,
      record.url,
      JSON.stringify(record.metadata || {})
    ).run()
  }

  private async saveBatchRecord(record: any): Promise<void> {
    await this.env.DB.prepare(`
      INSERT INTO qr_batches (
        batch_id, qr_code_ids, options_json, generated_count, created_at
      )
      VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(
      record.batchId,
      JSON.stringify(record.qrCodeIds),
      JSON.stringify(record.options),
      record.generatedCount
    ).run()
  }

  private generateQRId(): string {
    return `qr_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
  }

  private generateTemplateId(): string {
    return `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
  }

  private getBaseUrl(): string {
    return process.env.API_BASE_URL || 'https://api.makanmakan.com'
  }
}

export default QRCodeService
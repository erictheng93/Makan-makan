// QR Code Generation Service with Custom Styling Support
import type { Env } from '../types/env'
import { QRCodeService as DatabaseQRCodeService, type CreateQRCodeData, type QRStyleData } from '@makanmakan/database'

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
  category: 'modern' | 'classic' | 'colorful' | 'minimalist' | 'branded' | 'custom'
  previewUrl?: string
  createdAt: string
  updatedAt: string
}

export class QRCodeService {
  private env: Env
  private dbService: DatabaseQRCodeService
  
  constructor(env: Env) {
    this.env = env
    this.dbService = new DatabaseQRCodeService(env.DB as any)
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
      const qrCodeData: CreateQRCodeData = {
        content: options.content,
        format: options.format,
        style: style as QRStyleData,
        metadata: options.metadata
      }
      const savedQRCode = await this.dbService.generateQRCode(qrCodeData)
      
      // 更新URL（實際場景中URL會在生成後設定）
      if (finalUrl !== qrUrl) {
        // 這裡需要更新URL，但目前的服務沒有update方法，先跳過
      }
      
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
        const qrCodeData: CreateQRCodeData = {
          content: table.content,
          format: (options.format === 'zip' ? 'png' : options.format) as 'png' | 'svg' | 'pdf' | 'jpeg',
          style: tableStyle as QRStyleData,
          metadata: {
            tableId: table.id,
            tableName: table.name,
            batchId
          }
        }
        await this.dbService.generateQRCode(qrCodeData)
        
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
      
      // 儲存批量生成記錄 - 需要添加餐廳ID和用戶ID參數
      // 當前的generateBulkQRCodes方法需要這些參數，暫時使用默認值
      const restaurantId = 1 // TODO: 從options或context獲取實際的餐廳ID
      const userId = 1 // TODO: 從context獲取實際的用戶ID
      await this.dbService.generateBulkQRCodes(
        restaurantId,
        qrCodes.map(qr => qr.tableId),
        userId
      )
      
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
      const customTemplatesDb = await this.dbService.getActiveTemplates()
      
      const templates = this.getDefaultTemplates()
      
      // 合併預設模板和自訂模板
      if (customTemplatesDb.length) {
        const custom = customTemplatesDb.map((template: any) => ({
          id: template.id.toString(),
          name: template.name,
          description: template.description || '',
          category: 'custom' as const, // 資料庫模板沒有category欄位，設為custom
          style: JSON.parse(template.styleJson),
          previewUrl: undefined,
          createdAt: template.createdAt,
          updatedAt: template.updatedAt
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
      // 生成預覽圖
      const previewUrl = await this.generateTemplatePreview(template.style)
      
      // 使用資料庫服務創建模板
      const createdTemplate = await this.dbService.createTemplate({
        name: template.name,
        description: template.description,
        style: template.style as QRStyleData,
        createdBy: 1 // TODO: 從context獲取實際的用戶ID
      })
      
      const newTemplate: QRTemplate = {
        id: createdTemplate.id.toString(),
        name: createdTemplate.name,
        description: createdTemplate.description || '',
        category: template.category,
        style: JSON.parse(createdTemplate.styleJson),
        previewUrl,
        createdAt: createdTemplate.createdAt,
        updatedAt: createdTemplate.updatedAt
      }
      
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

  // 已移除 - 現在使用 DatabaseQRCodeService.generateQRCode()

  // 已移除 - 現在使用 DatabaseQRCodeService.generateBulkQRCodes()

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
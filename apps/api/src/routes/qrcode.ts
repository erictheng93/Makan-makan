import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, requireRole } from '../middleware/auth'
import { validateBody, validateQuery, validateParams } from '../middleware/validation'
import QRCodeService from '../services/qrCodeService'
import type { Env } from '../types/env'

const app = new Hono<{ Bindings: Env }>()

// 驗證 schemas
const qrStyleSchema = z.object({
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  foregroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  size: z.number().int().min(100).max(1000).optional(),
  errorCorrection: z.enum(['L', 'M', 'Q', 'H']).optional(),
  cornerStyle: z.enum(['square', 'rounded', 'circle']).optional(),
  dotStyle: z.enum(['square', 'rounded', 'circle']).optional(),
  gradientType: z.enum(['none', 'linear', 'radial']).optional(),
  gradientColors: z.object({
    start: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    end: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    direction: z.number().min(0).max(360).optional()
  }).optional(),
  logo: z.object({
    url: z.string().url(),
    size: z.number().min(0).max(30),
    borderRadius: z.number().min(0).max(50),
    margin: z.number().min(0).max(20)
  }).optional(),
  border: z.object({
    width: z.number().min(0).max(20),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    style: z.enum(['solid', 'dashed', 'dotted'])
  }).optional(),
  shadow: z.object({
    enabled: z.boolean(),
    color: z.string().regex(/^#[0-9A-Fa-f]{8}$/),
    blur: z.number().min(0).max(50),
    offsetX: z.number().min(-50).max(50),
    offsetY: z.number().min(-50).max(50)
  }).optional()
})

const generateQRSchema = z.object({
  content: z.string().min(1).max(2000),
  format: z.enum(['png', 'svg', 'pdf', 'jpeg']).default('png'),
  style: qrStyleSchema.optional(),
  metadata: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    createdBy: z.string().optional(),
    version: z.string().optional()
  }).optional()
})

const bulkQRSchema = z.object({
  tables: z.array(z.object({
    id: z.number().int().positive(),
    name: z.string().min(1).max(100),
    content: z.string().min(1).max(2000),
    customStyle: qrStyleSchema.optional()
  })).min(1).max(100),
  defaultStyle: qrStyleSchema.optional(),
  format: z.enum(['png', 'svg', 'pdf', 'zip']).default('zip'),
  includeMetadata: z.boolean().default(true),
  pdfSettings: z.object({
    layout: z.enum(['grid', 'list']).default('grid'),
    itemsPerPage: z.number().int().min(1).max(50).default(12),
    pageSize: z.enum(['A4', 'A3', 'Letter']).default('A4'),
    includeTableInfo: z.boolean().default(true)
  }).optional()
})

const templateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  category: z.enum(['modern', 'classic', 'colorful', 'minimalist', 'branded']),
  style: qrStyleSchema.required()
})

const updateTemplateSchema = templateSchema.partial()

/**
 * 生成單個QR碼
 * POST /api/v1/qr/generate
 */
app.post('/generate',
  authMiddleware,
  requireRole([0, 1, 2, 3, 4]),
  validateBody(generateQRSchema),
  async (c) => {
    try {
      const data = c.get('validatedBody')
      const user = c.get('user')
      const qrService = new QRCodeService(c.env)
      
      // 添加創建者信息
      if (!data.metadata) {
        data.metadata = {}
      }
      data.metadata.createdBy = user.username
      
      const result = await qrService.generateQRCode(data)
      
      if (result.success) {
        // 記錄審計日誌
        await c.env.DB.prepare(`
          INSERT INTO audit_logs (user_id, action, resource, details, created_at)
          VALUES (?, ?, ?, ?, datetime('now'))
        `).bind(
          user.id,
          'generate_qr_code',
          'qr_codes',
          JSON.stringify({ 
            qrId: result.data?.id,
            format: data.format,
            hasCustomStyle: !!data.style 
          })
        ).run()
        
        return c.json(result)
      }
      
      return c.json(result, 500)
      
    } catch (error) {
      console.error('Generate QR code error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate QR code'
      }, 500)
    }
  }
)

/**
 * 批量生成QR碼
 * POST /api/v1/qr/bulk
 */
app.post('/bulk',
  authMiddleware,
  requireRole([0, 1]), // 僅管理員和店主
  validateBody(bulkQRSchema),
  async (c) => {
    try {
      const data = c.get('validatedBody')
      const user = c.get('user')
      const qrService = new QRCodeService(c.env)
      
      const result = await qrService.generateBulkQRCodes(data)
      
      if (result.success) {
        // 記錄審計日誌
        await c.env.DB.prepare(`
          INSERT INTO audit_logs (user_id, action, resource, details, created_at)
          VALUES (?, ?, ?, ?, datetime('now'))
        `).bind(
          user.id,
          'bulk_generate_qr_codes',
          'qr_codes',
          JSON.stringify({ 
            batchId: result.data?.batchId,
            generatedCount: result.data?.generated,
            format: data.format,
            tablesCount: data.tables.length
          })
        ).run()
        
        return c.json(result)
      }
      
      return c.json(result, 500)
      
    } catch (error) {
      console.error('Bulk generate QR codes error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate bulk QR codes'
      }, 500)
    }
  }
)

/**
 * 獲取QR碼模板列表
 * GET /api/v1/qr/templates
 */
app.get('/templates',
  authMiddleware,
  requireRole([0, 1, 2, 3, 4]),
  async (c) => {
    try {
      const qrService = new QRCodeService(c.env)
      const templates = await qrService.getTemplates()
      
      return c.json({
        success: true,
        data: templates
      })
      
    } catch (error) {
      console.error('Get QR templates error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch templates'
      }, 500)
    }
  }
)

/**
 * 創建自訂QR碼模板
 * POST /api/v1/qr/templates
 */
app.post('/templates',
  authMiddleware,
  requireRole([0, 1]), // 僅管理員和店主
  validateBody(templateSchema),
  async (c) => {
    try {
      const data = c.get('validatedBody')
      const user = c.get('user')
      const qrService = new QRCodeService(c.env)
      
      const result = await qrService.createTemplate(data)
      
      if (result.success) {
        // 記錄審計日誌
        await c.env.DB.prepare(`
          INSERT INTO audit_logs (user_id, action, resource, details, created_at)
          VALUES (?, ?, ?, ?, datetime('now'))
        `).bind(
          user.id,
          'create_qr_template',
          'qr_templates',
          JSON.stringify({ 
            templateId: result.data?.id,
            templateName: data.name,
            category: data.category 
          })
        ).run()
        
        return c.json(result)
      }
      
      return c.json(result, 500)
      
    } catch (error) {
      console.error('Create QR template error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create template'
      }, 500)
    }
  }
)

/**
 * 更新QR碼模板
 * PUT /api/v1/qr/templates/:id
 */
app.put('/templates/:id',
  authMiddleware,
  requireRole([0, 1]),
  validateParams(z.object({ id: z.string().min(1) })),
  validateBody(updateTemplateSchema),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const data = c.get('validatedBody')
      const user = c.get('user')
      
      // 檢查模板是否存在
      const template = await c.env.DB.prepare(`
        SELECT * FROM qr_templates WHERE id = ?
      `).bind(id).first()
      
      if (!template) {
        return c.json({
          success: false,
          error: 'Template not found'
        }, 404)
      }
      
      // 構建更新語句
      const updateFields = []
      const updateValues = []
      
      if (data.name) {
        updateFields.push('name = ?')
        updateValues.push(data.name)
      }
      
      if (data.description) {
        updateFields.push('description = ?')
        updateValues.push(data.description)
      }
      
      if (data.category) {
        updateFields.push('category = ?')
        updateValues.push(data.category)
      }
      
      if (data.style) {
        const currentStyle = JSON.parse(template.style_json as string)
        const newStyle = { ...currentStyle, ...data.style }
        updateFields.push('style_json = ?')
        updateValues.push(JSON.stringify(newStyle))
      }
      
      if (updateFields.length === 0) {
        return c.json({
          success: false,
          error: 'No fields to update'
        }, 400)
      }
      
      updateFields.push('updated_at = datetime("now")')
      updateValues.push(id)
      
      await c.env.DB.prepare(`
        UPDATE qr_templates 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `).bind(...updateValues).run()
      
      // 獲取更新後的模板
      const updatedTemplate = await c.env.DB.prepare(`
        SELECT * FROM qr_templates WHERE id = ?
      `).bind(id).first()
      
      // 記錄審計日誌
      await c.env.DB.prepare(`
        INSERT INTO audit_logs (user_id, action, resource, details, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).bind(
        user.id,
        'update_qr_template',
        'qr_templates',
        JSON.stringify({ 
          templateId: id,
          updatedFields: Object.keys(data)
        })
      ).run()
      
      return c.json({
        success: true,
        data: {
          id: updatedTemplate?.id,
          name: updatedTemplate?.name,
          description: updatedTemplate?.description,
          category: updatedTemplate?.category,
          style: JSON.parse(updatedTemplate?.style_json as string),
          previewUrl: updatedTemplate?.preview_url,
          createdAt: updatedTemplate?.created_at,
          updatedAt: updatedTemplate?.updated_at
        }
      })
      
    } catch (error) {
      console.error('Update QR template error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update template'
      }, 500)
    }
  }
)

/**
 * 刪除QR碼模板
 * DELETE /api/v1/qr/templates/:id
 */
app.delete('/templates/:id',
  authMiddleware,
  requireRole([0, 1]),
  validateParams(z.object({ id: z.string().min(1) })),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const user = c.get('user')
      
      // 檢查模板是否存在
      const template = await c.env.DB.prepare(`
        SELECT * FROM qr_templates WHERE id = ?
      `).bind(id).first()
      
      if (!template) {
        return c.json({
          success: false,
          error: 'Template not found'
        }, 404)
      }
      
      // 軟刪除（設為非活躍）
      await c.env.DB.prepare(`
        UPDATE qr_templates 
        SET is_active = 0, updated_at = datetime('now')
        WHERE id = ?
      `).bind(id).run()
      
      // 記錄審計日誌
      await c.env.DB.prepare(`
        INSERT INTO audit_logs (user_id, action, resource, details, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).bind(
        user.id,
        'delete_qr_template',
        'qr_templates',
        JSON.stringify({ 
          templateId: id,
          templateName: template.name
        })
      ).run()
      
      return c.json({
        success: true,
        message: 'Template deleted successfully'
      })
      
    } catch (error) {
      console.error('Delete QR template error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete template'
      }, 500)
    }
  }
)

/**
 * 下載QR碼
 * GET /api/v1/qr/:id/download
 */
app.get('/:id/download',
  validateParams(z.object({ id: z.string().min(1) })),
  validateQuery(z.object({
    format: z.enum(['png', 'svg', 'pdf', 'jpeg']).optional()
  })),
  async (c) => {
    try {
      const { id } = c.get('validatedParams')
      const query = c.get('validatedQuery')
      
      // 獲取QR碼記錄
      const qrRecord = await c.env.DB.prepare(`
        SELECT * FROM qr_codes WHERE id = ?
      `).bind(id).first()
      
      if (!qrRecord) {
        return c.json({
          success: false,
          error: 'QR code not found'
        }, 404)
      }
      
      const downloadFormat = query.format || qrRecord.format
      
      // 記錄下載統計
      await c.env.DB.prepare(`
        INSERT INTO qr_downloads (qr_code_id, format, ip_address, user_agent, downloaded_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).bind(
        id,
        downloadFormat,
        c.req.header('CF-Connecting-IP') || 'unknown',
        c.req.header('User-Agent') || 'unknown'
      ).run()
      
      // 重定向到實際的QR碼圖片URL
      return c.redirect(qrRecord.url as string)
      
    } catch (error) {
      console.error('Download QR code error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to download QR code'
      }, 500)
    }
  }
)

/**
 * 批量下載QR碼
 * GET /api/v1/qr/batch/:batchId/download
 */
app.get('/batch/:batchId/download',
  authMiddleware,
  requireRole([0, 1]),
  validateParams(z.object({ batchId: z.string().min(1) })),
  validateQuery(z.object({
    format: z.enum(['zip', 'pdf']).default('zip')
  })),
  async (c) => {
    try {
      const { batchId } = c.get('validatedParams')
      const query = c.get('validatedQuery')
      
      // 獲取批次記錄
      const batchRecord = await c.env.DB.prepare(`
        SELECT * FROM qr_batches WHERE batch_id = ?
      `).bind(batchId).first()
      
      if (!batchRecord) {
        return c.json({
          success: false,
          error: 'Batch not found'
        }, 404)
      }
      
      // 這裡需要實現ZIP或PDF打包邏輯
      // 暫時返回批次信息
      return c.json({
        success: true,
        message: 'Bulk download will be implemented with file packaging service',
        data: {
          batchId,
          format: query.format,
          generatedCount: batchRecord.generated_count,
          createdAt: batchRecord.created_at
        }
      })
      
    } catch (error) {
      console.error('Bulk download QR codes error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to download bulk QR codes'
      }, 500)
    }
  }
)

/**
 * 獲取QR碼統計信息
 * GET /api/v1/qr/stats
 */
app.get('/stats',
  authMiddleware,
  requireRole([0, 1]),
  async (c) => {
    try {
      // 總生成數量
      const totalGenerated = await c.env.DB.prepare(`
        SELECT COUNT(*) as count FROM qr_codes
      `).first()
      
      // 本月生成數量
      const monthlyGenerated = await c.env.DB.prepare(`
        SELECT COUNT(*) as count FROM qr_codes 
        WHERE created_at >= datetime('now', 'start of month')
      `).first()
      
      // 按格式分布
      const formatDistribution = await c.env.DB.prepare(`
        SELECT format, COUNT(*) as count 
        FROM qr_codes 
        GROUP BY format
      `).all()
      
      // 下載統計
      const totalDownloads = await c.env.DB.prepare(`
        SELECT COUNT(*) as count FROM qr_downloads
      `).first()
      
      // 熱門模板
      const popularTemplates = await c.env.DB.prepare(`
        SELECT t.name, COUNT(q.id) as usage_count
        FROM qr_templates t
        LEFT JOIN qr_codes q ON JSON_EXTRACT(q.style_json, '$.templateId') = t.id
        WHERE t.is_active = 1
        GROUP BY t.id, t.name
        ORDER BY usage_count DESC
        LIMIT 5
      `).all()
      
      return c.json({
        success: true,
        data: {
          totalGenerated: totalGenerated?.count || 0,
          monthlyGenerated: monthlyGenerated?.count || 0,
          totalDownloads: totalDownloads?.count || 0,
          formatDistribution: formatDistribution.results || [],
          popularTemplates: popularTemplates.results || []
        }
      })
      
    } catch (error) {
      console.error('Get QR stats error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch QR statistics'
      }, 500)
    }
  }
)

export default app
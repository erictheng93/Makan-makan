/**
 * QR Codes Routes
 * All HTTP routes for the QR codes feature
 */

import { Hono } from 'hono'
import { authMiddleware, requireRole } from '../../../shared/middleware'
import { validateBody, validateQuery, validateParams } from '../../../shared/middleware'
import type { Env } from '../../../shared/types'
import { HTTP_STATUS, USER_ROLES } from '../../../shared/constants'
import { createSuccessResponse, createErrorResponse } from '../../../shared/utils'

// Import schemas
import { qrCodeSchemas } from '../schemas/validation'

// Import services
import { QrCodesService } from '../services/QrCodesService'

const app = new Hono<{ Bindings: Env }>()

// POST /generate - Generate single QR code
app.post('/generate',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER, USER_ROLES.CHEF, USER_ROLES.SERVICE_CREW, USER_ROLES.CASHIER]),
  validateBody(qrCodeSchemas.generate),
  async (c) => {
    try {
      const data = c.req.valid('json' as never) as any
      const user = c.get('user')
      const service = new QrCodesService(c.env)

      const qrCode = await service.generateQR(data, user?.id, user?.restaurantId)

      return c.json(
        createSuccessResponse(qrCode, 'QR code generated successfully'),
        HTTP_STATUS.CREATED
      )
    } catch (error) {
      console.error('QR code generation error:', error)
      return c.json(
        createErrorResponse('Failed to generate QR code'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// POST /bulk - Generate bulk QR codes
app.post('/bulk',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateBody(qrCodeSchemas.bulk),
  async (c) => {
    try {
      const data = c.req.valid('json' as never) as any
      const user = c.get('user')
      const service = new QrCodesService(c.env)

      const batch = await service.generateBulkQR(data, user?.id, user?.restaurantId)

      return c.json(
        createSuccessResponse(batch, 'Bulk QR codes generated successfully'),
        HTTP_STATUS.CREATED
      )
    } catch (error) {
      console.error('Bulk QR code generation error:', error)
      return c.json(
        createErrorResponse('Failed to generate bulk QR codes'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// GET /:id/download - Download QR code
app.get('/:id/download',
  authMiddleware,
  validateParams(qrCodeSchemas.params),
  async (c) => {
    try {
      const { id } = c.req.valid('param' as never) as any
      const service = new QrCodesService(c.env)

      const result = await service.downloadQR(id)

      if (!result) {
        return c.json(
          createErrorResponse('QR code not found'),
          HTTP_STATUS.NOT_FOUND
        )
      }

      return new Response(result.data, {
        headers: {
          'Content-Type': result.contentType,
          'Content-Disposition': `attachment; filename="${result.filename}"`
        }
      })
    } catch (error) {
      console.error('QR code download error:', error)
      return c.json(
        createErrorResponse('Failed to download QR code'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// GET /batch/:batchId/download - Download batch QR codes
app.get('/batch/:batchId/download',
  authMiddleware,
  validateParams(qrCodeSchemas.batchParams),
  async (c) => {
    try {
      const { batchId } = c.req.valid('param' as never) as any
      const service = new QrCodesService(c.env)

      const result = await service.downloadBatch(batchId)

      if (!result) {
        return c.json(
          createErrorResponse('Batch not found'),
          HTTP_STATUS.NOT_FOUND
        )
      }

      return new Response(result.data, {
        headers: {
          'Content-Type': result.contentType,
          'Content-Disposition': `attachment; filename="${result.filename}"`
        }
      })
    } catch (error) {
      console.error('Batch download error:', error)
      return c.json(
        createErrorResponse('Failed to download batch'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// GET /stats - Get QR code statistics
app.get('/stats',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateQuery(qrCodeSchemas.stats),
  async (c) => {
    try {
      const query = c.req.valid('query' as never) as any
      const user = c.get('user')
      const service = new QrCodesService(c.env)

      // Use restaurant ID from query or user context
      const restaurantId = query.restaurantId || user?.restaurantId

      const stats = await service.getStatistics(restaurantId)

      return c.json(createSuccessResponse(stats), HTTP_STATUS.OK)
    } catch (error) {
      console.error('QR code statistics error:', error)
      return c.json(
        createErrorResponse('Failed to fetch QR code statistics'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// Template management routes

// GET /templates - List QR code templates
app.get('/templates',
  authMiddleware,
  validateQuery(qrCodeSchemas.listTemplates),
  async (c) => {
    try {
      const query = c.req.valid('query' as never) as any
      const service = new QrCodesService(c.env)

      const templates = await service.listTemplates(query.category)

      return c.json(createSuccessResponse(templates), HTTP_STATUS.OK)
    } catch (error) {
      console.error('Template list error:', error)
      return c.json(
        createErrorResponse('Failed to fetch templates'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// GET /templates/:id - Get single template
app.get('/templates/:id',
  authMiddleware,
  validateParams(qrCodeSchemas.params),
  async (c) => {
    try {
      const { id } = c.req.valid('param' as never) as any
      const service = new QrCodesService(c.env)

      const template = await service.getTemplate(id)

      if (!template) {
        return c.json(
          createErrorResponse('Template not found'),
          HTTP_STATUS.NOT_FOUND
        )
      }

      return c.json(createSuccessResponse(template), HTTP_STATUS.OK)
    } catch (error) {
      console.error('Template get error:', error)
      return c.json(
        createErrorResponse('Failed to fetch template'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// POST /templates - Create new template
app.post('/templates',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateBody(qrCodeSchemas.createTemplate),
  async (c) => {
    try {
      const data = c.req.valid('json' as never) as any
      const service = new QrCodesService(c.env)

      const template = await service.createTemplate(data)

      return c.json(
        createSuccessResponse(template, 'Template created successfully'),
        HTTP_STATUS.CREATED
      )
    } catch (error) {
      console.error('Template creation error:', error)
      return c.json(
        createErrorResponse('Failed to create template'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// PUT /templates/:id - Update template
app.put('/templates/:id',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(qrCodeSchemas.params),
  validateBody(qrCodeSchemas.updateTemplate),
  async (c) => {
    try {
      const { id } = c.req.valid('param' as never) as any
      const data = c.req.valid('json' as never) as any
      const service = new QrCodesService(c.env)

      const template = await service.updateTemplate(id, data)

      if (!template) {
        return c.json(
          createErrorResponse('Template not found'),
          HTTP_STATUS.NOT_FOUND
        )
      }

      return c.json(
        createSuccessResponse(template, 'Template updated successfully'),
        HTTP_STATUS.OK
      )
    } catch (error) {
      console.error('Template update error:', error)
      return c.json(
        createErrorResponse('Failed to update template'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// DELETE /templates/:id - Delete template
app.delete('/templates/:id',
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  validateParams(qrCodeSchemas.params),
  async (c) => {
    try {
      const { id } = c.req.valid('param' as never) as any
      const service = new QrCodesService(c.env)

      const deleted = await service.deleteTemplate(id)

      if (!deleted) {
        return c.json(
          createErrorResponse('Template not found'),
          HTTP_STATUS.NOT_FOUND
        )
      }

      return c.json(
        createSuccessResponse(null, 'Template deleted successfully'),
        HTTP_STATUS.OK
      )
    } catch (error) {
      console.error('Template deletion error:', error)
      return c.json(
        createErrorResponse('Failed to delete template'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

// ==================== Shop QR Code Verification ====================

/**
 * GET /verify/shop/:qrCode - Verify shop-level QR code (PUBLIC)
 * This endpoint is public and does not require authentication
 * Used by customers scanning shop QR codes
 */
app.get('/verify/shop/:qrCode',
  validateParams(qrCodeSchemas.shopQrCode),
  async (c) => {
    try {
      const { qrCode } = c.req.valid('param' as never) as any

      // Import RestaurantsService dynamically to avoid circular dependencies
      const { RestaurantsService } = await import('../../restaurants/services/RestaurantsService')
      const restaurantsService = new RestaurantsService(c.env.DB, c.env, c.env.CACHE_KV)

      const result = await restaurantsService.verifyShopQrCode(qrCode)

      if (!result.valid) {
        return c.json(
          createErrorResponse('Invalid or expired QR code'),
          HTTP_STATUS.NOT_FOUND
        )
      }

      return c.json(
        createSuccessResponse({
          valid: true,
          restaurantId: result.restaurantId,
          restaurant: result.restaurant
        }, 'QR code verified successfully'),
        HTTP_STATUS.OK
      )
    } catch (error) {
      console.error('Shop QR code verification error:', error)
      return c.json(
        createErrorResponse('Failed to verify QR code'),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

export default app
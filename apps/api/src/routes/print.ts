import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { validateBody, validateParams } from '../middleware/validation'
// import { PrinterService } from '@makanmakan/database' // Temporarily disabled

// Temporary mock PrinterService
class PrinterService {
  constructor(_config: any) {
    console.warn('Using mock PrinterService - print functionality disabled')
  }
}
import type { Env } from '../types/env'

const app = new Hono<{ Bindings: Env }>()

// Validation schemas
const printReceiptSchema = z.object({
  type: z.enum(['customer_receipt', 'kitchen_receipt', 'order_summary']),
  priority: z.enum(['urgent', 'high', 'normal', 'low']).optional().default('normal'),
  data: z.object({
    restaurantInfo: z.object({
      name: z.string(),
      address: z.string().optional(),
      phone: z.string().optional(),
      tax_id: z.string().optional()
    }),
    orderId: z.string(),
    tableId: z.number().optional(),
    customerName: z.string().optional(),
    items: z.array(z.object({
      menuItemName: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
      totalPrice: z.number(),
      customizations: z.record(z.any()).optional(),
      specialInstructions: z.string().optional()
    })),
    subtotal: z.number(),
    tax: z.number(),
    total: z.number(),
    paymentMethod: z.string(),
    transactionId: z.string().optional(),
    timestamp: z.date(),
    orderType: z.enum(['regular', 'group']).optional()
  }),
  options: z.object({
    copies: z.number().min(1).max(5).optional().default(1),
    cutPaper: z.boolean().optional().default(true),
    openDrawer: z.boolean().optional().default(false),
    buzzer: z.boolean().optional().default(false),
    feedLines: z.number().min(0).max(10).optional().default(3)
  }).optional().default({})
})

const printKitchenOrderSchema = z.object({
  type: z.enum(['kitchen_order', 'kitchen_summary']),
  priority: z.enum(['urgent', 'high', 'normal', 'low']).optional().default('high'),
  data: z.object({
    restaurantInfo: z.object({
      name: z.string()
    }),
    orderId: z.string(),
    tableId: z.number().optional(),
    customerName: z.string(),
    items: z.array(z.object({
      name: z.string(),
      quantity: z.number(),
      customizations: z.record(z.any()).optional(),
      specialInstructions: z.string().optional()
    })),
    orderType: z.enum(['regular', 'group']),
    priority: z.enum(['urgent', 'high', 'normal', 'low']),
    estimatedPrepTime: z.number(),
    createdAt: z.string()
  }),
  options: z.object({
    copies: z.number().min(1).max(3).optional().default(1),
    cutPaper: z.boolean().optional().default(true),
    buzzer: z.boolean().optional().default(true),
    feedLines: z.number().min(0).max(5).optional().default(2)
  }).optional().default({})
})

// Printer service instance
let printerService: PrinterService

// Initialize printer service
app.use('*', async (c, next) => {
  if (!printerService) {
    const config = {
      queue: {
        maxSize: 100,
        maxRetries: 3,
        retryDelay: 5000
      },
      defaultDevice: c.env.DEFAULT_PRINTER_ID || null
    }
    printerService = new PrinterService(config)
  }
  await next()
})

/**
 * Print customer receipt
 * POST /api/v1/print/receipt
 */
app.post('/receipt',
  validateBody(printReceiptSchema),
  async (c) => {
    try {
      const printRequest = c.get('validatedBody')
      
      const result = await printerService.createPrintJob({
        type: printRequest.type,
        priority: printRequest.priority,
        data: printRequest.data,
        options: printRequest.options
      })

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      return c.json({
        success: true,
        data: {
          jobId: result.jobId,
          message: result.message,
          estimatedTime: result.estimatedTime
        }
      })

    } catch (error) {
      console.error('Print receipt error:', error)
      return c.json({
        success: false,
        error: 'Failed to print receipt'
      }, 500)
    }
  }
)

/**
 * Print kitchen order
 * POST /api/v1/print/kitchen-order
 */
app.post('/kitchen-order',
  validateBody(printKitchenOrderSchema),
  async (c) => {
    try {
      const printRequest = c.get('validatedBody')
      
      const result = await printerService.createPrintJob({
        type: printRequest.type,
        priority: printRequest.priority,
        data: printRequest.data,
        options: printRequest.options
      })

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error
        }, 400)
      }

      return c.json({
        success: true,
        data: {
          jobId: result.jobId,
          message: result.message,
          estimatedTime: result.estimatedTime
        }
      })

    } catch (error) {
      console.error('Print kitchen order error:', error)
      return c.json({
        success: false,
        error: 'Failed to print kitchen order'
      }, 500)
    }
  }
)

/**
 * Get print job status
 * GET /api/v1/print/job/{jobId}/status
 */
app.get('/job/:jobId/status',
  authMiddleware,
  validateParams(z.object({ jobId: z.string() })),
  async (c) => {
    try {
      const { jobId } = c.get('validatedParams')
      
      const job = printerService.getJobStatus(jobId)
      
      if (!job) {
        return c.json({
          success: false,
          error: 'Print job not found'
        }, 404)
      }

      return c.json({
        success: true,
        data: {
          id: job.id,
          type: job.type,
          status: job.status,
          deviceId: job.deviceId,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
          completedAt: job.completedAt,
          error: job.error
        }
      })

    } catch (error) {
      console.error('Get print job status error:', error)
      return c.json({
        success: false,
        error: 'Failed to get job status'
      }, 500)
    }
  }
)

/**
 * Cancel print job
 * DELETE /api/v1/print/job/{jobId}
 */
app.delete('/job/:jobId',
  authMiddleware,
  validateParams(z.object({ jobId: z.string() })),
  async (c) => {
    try {
      const { jobId } = c.get('validatedParams')
      
      const cancelled = printerService.cancelJob(jobId)
      
      if (!cancelled) {
        return c.json({
          success: false,
          error: 'Job cannot be cancelled or not found'
        }, 400)
      }

      return c.json({
        success: true,
        message: 'Print job cancelled successfully'
      })

    } catch (error) {
      console.error('Cancel print job error:', error)
      return c.json({
        success: false,
        error: 'Failed to cancel job'
      }, 500)
    }
  }
)

/**
 * Get printer devices
 * GET /api/v1/print/devices
 */
app.get('/devices',
  authMiddleware,
  async (c) => {
    try {
      const devices = printerService.getDevices()
      
      return c.json({
        success: true,
        data: {
          devices: devices.map(device => ({
            id: device.id,
            name: device.name,
            type: device.type,
            brand: device.brand,
            model: device.model,
            status: device.status,
            capabilities: device.capabilities,
            lastSeen: device.lastSeen
          })),
          defaultDevice: printerService.getDefaultDevice()?.id || null
        }
      })

    } catch (error) {
      console.error('Get printer devices error:', error)
      return c.json({
        success: false,
        error: 'Failed to get printer devices'
      }, 500)
    }
  }
)

/**
 * Get printer statistics
 * GET /api/v1/print/statistics
 */
app.get('/statistics',
  authMiddleware,
  async (c) => {
    try {
      const stats = printerService.getStatistics()
      
      return c.json({
        success: true,
        data: stats
      })

    } catch (error) {
      console.error('Get printer statistics error:', error)
      return c.json({
        success: false,
        error: 'Failed to get statistics'
      }, 500)
    }
  }
)

/**
 * Printer health check
 * GET /api/v1/print/health
 */
app.get('/health', async (c) => {
  try {
    const health = await printerService.healthCheck()
    
    return c.json({
      status: health.service,
      timestamp: new Date().toISOString(),
      devices: health.devices,
      queue: health.queue
    })

  } catch (error) {
    console.error('Printer health check error:', error)
    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: String(error)
    }, 500)
  }
})

export default app
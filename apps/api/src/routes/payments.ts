import { Hono } from 'hono'
import { PaymentService } from '../services/PaymentService'
import { OrderCompletionService } from '../services/OrderCompletionService'
import { 
  PaymentRequest, 
  RefundRequest, 
  CountryCode,
  PaymentMethod
} from '@makanmakan/shared-types'

// 假設這些來自中間件或環境
interface Env {
  DB: any
  // 其他環境變數
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Context {
  env: Env
  // 其他上下文
}

const payments = new Hono<{ Bindings: Env }>()

// 支付服務實例（通常會通過依賴注入）
let paymentService: PaymentService
let orderCompletionService: OrderCompletionService

// 初始化支付服務
payments.use('*', async (c, next) => {
  if (!paymentService) {
    paymentService = new PaymentService({
      database: c.env.DB
    })
    await paymentService.initialize()
  }
  if (!orderCompletionService) {
    orderCompletionService = new OrderCompletionService(c.env)
  }
  await next()
})

// =============================================
// 支付處理 API
// =============================================

// 創建支付
payments.post('/create', async (c) => {
  try {
    const body = await c.req.json()
    
    // 驗證必要欄位
    const required = ['orderId', 'restaurantId', 'country', 'currency', 'amount', 'method']
    for (const field of required) {
      if (!body[field]) {
        return c.json({ 
          success: false, 
          error: `Missing required field: ${field}` 
        }, 400)
      }
    }

    const paymentRequest: PaymentRequest = {
      orderId: body.orderId,
      restaurantId: parseInt(body.restaurantId),
      country: body.country as CountryCode,
      currency: body.currency,
      amount: parseFloat(body.amount),
      method: body.method as PaymentMethod,
      customerInfo: body.customerInfo,
      metadata: body.metadata,
      returnUrl: body.returnUrl,
      cancelUrl: body.cancelUrl
    }

    const result = await paymentService.createPayment(paymentRequest)

    return c.json({
      success: result.success,
      data: result.success ? {
        transactionId: result.transactionId,
        status: result.status,
        clientSecret: result.clientSecret,
        redirectUrl: result.redirectUrl,
        qrCodeData: result.qrCodeData,
        metadata: result.metadata
      } : undefined,
      error: result.error
    })

  } catch (error) {
    console.error('Payment creation error:', error)
    return c.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error'
      }
    }, 500)
  }
})

// 查詢支付狀態
payments.get('/status/:transactionId', async (c) => {
  try {
    const transactionId = c.req.param('transactionId')
    
    if (!transactionId) {
      return c.json({ 
        success: false, 
        error: 'Transaction ID is required' 
      }, 400)
    }

    const status = await paymentService.getPaymentStatus(transactionId)

    return c.json({
      success: true,
      data: {
        transactionId,
        status
      }
    })

  } catch (error) {
    console.error('Payment status query error:', error)
    return c.json({
      success: false,
      error: {
        code: 'STATUS_ERROR',
        message: 'Failed to get payment status'
      }
    }, 500)
  }
})

// 退款處理
payments.post('/refund', async (c) => {
  try {
    const body = await c.req.json()
    
    if (!body.transactionId) {
      return c.json({ 
        success: false, 
        error: 'Transaction ID is required' 
      }, 400)
    }

    const refundRequest: RefundRequest & { transactionId: string } = {
      transactionId: body.transactionId,
      amount: body.amount ? parseFloat(body.amount) : undefined,
      reason: body.reason,
      metadata: body.metadata
    }

    const result = await paymentService.refundPayment(refundRequest)

    return c.json({
      success: result.success,
      data: result.success ? {
        refundId: result.refundId,
        amount: result.amount,
        status: result.status
      } : undefined,
      error: result.error
    })

  } catch (error) {
    console.error('Refund error:', error)
    return c.json({
      success: false,
      error: {
        code: 'REFUND_ERROR',
        message: 'Refund processing failed'
      }
    }, 500)
  }
})

// =============================================
// Webhook 處理
// =============================================

// 通用 webhook 端點
payments.post('/webhook/:providerId', async (c) => {
  try {
    const providerId = c.req.param('providerId')
    const signature = c.req.header('stripe-signature') || 
                     c.req.header('x-signature') ||
                     c.req.header('authorization')
    
    const payload = await c.req.text()
    let parsedPayload
    
    try {
      parsedPayload = JSON.parse(payload)
    } catch {
      parsedPayload = payload
    }

    const result = await paymentService.handleWebhook(providerId, parsedPayload, signature)

    // If payment was successful, trigger order completion flow
    if (result.processed && result.paymentData && result.paymentData.status === 'completed') {
      try {
        await processPaymentCompletion(c, result.paymentData)
      } catch (completionError) {
        console.error('Order completion processing error:', completionError)
        // Don't fail the webhook - payment was processed successfully
      }
    }

    return c.json({
      processed: result.processed,
      error: result.error
    }, result.processed ? 200 : 400)

  } catch (error) {
    console.error('Webhook processing error:', error)
    return c.json({
      processed: false,
      error: 'Webhook processing failed'
    }, 500)
  }
})

// Helper function to process payment completion
async function processPaymentCompletion(c: any, paymentData: any) {
  const db = c.env.DB
  
  // Get order details based on payment data
  const order = await db.prepare(
    'SELECT * FROM orders WHERE transaction_id = ? OR id = ?'
  ).bind(paymentData.transactionId, paymentData.orderId).first()

  if (!order) {
    console.warn('Order not found for payment:', paymentData.transactionId)
    return
  }

  // Get order items
  const items = await db.prepare(
    'SELECT oi.*, mi.name as menu_item_name FROM order_items oi JOIN menu_items mi ON oi.menu_item_id = mi.id WHERE oi.order_id = ?'
  ).bind(order.id).all()

  // Check if this is a group order
  const groupMember = await db.prepare(
    'SELECT * FROM group_members WHERE transaction_id = ?'
  ).bind(paymentData.transactionId).first()

  const orderCompletionData = {
    orderId: order.id,
    restaurantId: order.restaurant_id,
    tableId: order.table_id,
    customerId: order.customer_id,
    customerName: order.customer_name,
    items: items.results.map((item: any) => ({
      id: item.id,
      menuItemId: item.menu_item_id,
      menuItemName: item.menu_item_name,
      quantity: item.quantity,
      unitPrice: parseFloat(item.unit_price),
      totalPrice: parseFloat(item.total_price),
      customizations: item.customizations ? JSON.parse(item.customizations) : undefined,
      specialInstructions: item.special_instructions
    })),
    totalAmount: parseFloat(paymentData.amount),
    paymentMethod: paymentData.method,
    transactionId: paymentData.transactionId,
    orderType: groupMember ? 'group' : 'regular',
    groupOrderId: groupMember?.group_order_id,
    memberId: groupMember?.id
  }

  // Process completion
  const result = await orderCompletionService.processCompletedPayment(orderCompletionData)
  
  console.log('Order completion result:', result)
}

// =============================================
// 配置管理 API (管理員專用)
// =============================================

// 獲取國家支援的支付方式
payments.get('/methods/:countryCode', async (c) => {
  try {
    const countryCode = c.req.param('countryCode') as CountryCode
    const configManager = paymentService.getConfigManager()
    
    const methods = await configManager.getSupportedPaymentMethods(countryCode)
    
    return c.json({
      success: true,
      data: {
        country: countryCode,
        supportedMethods: methods
      }
    })

  } catch (error) {
    console.error('Payment methods query error:', error)
    return c.json({
      success: false,
      error: 'Failed to get supported payment methods'
    }, 500)
  }
})

// 獲取可用的支付提供商
payments.get('/providers/:countryCode', async (c) => {
  try {
    const countryCode = c.req.param('countryCode') as CountryCode
    const paymentMethod = c.req.query('method') as PaymentMethod | undefined
    
    const configManager = paymentService.getConfigManager()
    const providers = await configManager.getAvailableProviders(countryCode, paymentMethod)
    
    return c.json({
      success: true,
      data: {
        country: countryCode,
        method: paymentMethod,
        providers: providers.map(p => ({
          name: p.name,
          displayName: p.displayName,
          supportedMethods: p.supportedMethods
        }))
      }
    })

  } catch (error) {
    console.error('Payment providers query error:', error)
    return c.json({
      success: false,
      error: 'Failed to get available providers'
    }, 500)
  }
})

// 獲取支付統計 (管理員專用)
payments.get('/statistics', async (c) => {
  try {
    const startDate = c.req.query('startDate')
    const endDate = c.req.query('endDate')
    const countryCode = c.req.query('country') as CountryCode | undefined
    
    if (!startDate || !endDate) {
      return c.json({
        success: false,
        error: 'Start date and end date are required'
      }, 400)
    }

    const statistics = await paymentService.getPaymentStatistics(
      new Date(startDate),
      new Date(endDate),
      countryCode
    )
    
    return c.json({
      success: true,
      data: statistics
    })

  } catch (error) {
    console.error('Payment statistics error:', error)
    return c.json({
      success: false,
      error: 'Failed to get payment statistics'
    }, 500)
  }
})

// =============================================
// 健康檢查
// =============================================

payments.get('/health', async (c) => {
  try {
    const configManager = paymentService.getConfigManager()
    const validation = await configManager.validateConfiguration()
    
    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      configuration: validation
    })

  } catch (error) {
    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: (error as Error).message
    }, 500)
  }
})

export { payments }
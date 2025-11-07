/**
 * Realtime Routes
 * HTTP routes for realtime authentication
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../../../shared/types'
import { HTTP_STATUS } from '../../../shared/constants'
import { ErrorSanitizer, createSafeErrorResponse } from '../../../utils/errorSanitizer'
import { ConsoleLogger } from '../../../core/monitoring'

// Import service and validation schemas
import { RealtimeAuthService } from '../services/RealtimeAuthService'
import { realtimeSchemas } from '../schemas/validation'

// Create feature logger
const logger = new ConsoleLogger('realtime-routes')

// Create router
const realtimeRoutes = new Hono<{ Bindings: Env }>()

/**
 * 請求 WebSocket 授權 Token
 * POST /auth/token
 *
 * 此端點用於取得 WebSocket 連線所需的授權 token
 */
realtimeRoutes.post('/auth/token',
  zValidator('json', realtimeSchemas.webSocketTokenRequest),
  async (c) => {
    try {
      const requestData = c.req.valid('json')

      // 初始化認證服務
      const authService = new RealtimeAuthService(c.env)

      // 生成 WebSocket token
      const result = await authService.generateWebSocketToken(requestData)

      // 檢查是否有錯誤
      if ('error' in result) {
        logger.warn('Failed to generate WebSocket token', {
          error: result.error,
          request: requestData
        })

        return c.json({
          success: false,
          error: result.error
        }, HTTP_STATUS.BAD_REQUEST)
      }

      logger.info('WebSocket token generated successfully', {
        roomType: requestData.roomType,
        roomId: requestData.roomId,
        restaurantId: requestData.restaurantId
      })

      return c.json({
        success: true,
        data: result
      }, HTTP_STATUS.OK)

    } catch (error) {
      ErrorSanitizer.logAndSanitize(error, 'REALTIME_TOKEN_GENERATION')
      return c.json(
        createSafeErrorResponse(error, HTTP_STATUS.INTERNAL_SERVER_ERROR),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

/**
 * 驗證 WebSocket Token (用於測試)
 * POST /auth/verify
 */
realtimeRoutes.post('/auth/verify',
  zValidator('json', z.object({
    token: z.string().min(1, 'Token is required')
  })),
  async (c) => {
    try {
      const { token } = c.req.valid('json')

      const authService = new RealtimeAuthService(c.env)
      const verification = await authService.verifyWebSocketToken(token)

      if (!verification.valid) {
        return c.json({
          success: false,
          error: verification.error || 'Invalid token'
        }, HTTP_STATUS.UNAUTHORIZED)
      }

      return c.json({
        success: true,
        data: {
          valid: true,
          payload: verification.payload
        }
      }, HTTP_STATUS.OK)

    } catch (error) {
      ErrorSanitizer.logAndSanitize(error, 'REALTIME_TOKEN_VERIFICATION')
      return c.json(
        createSafeErrorResponse(error, HTTP_STATUS.INTERNAL_SERVER_ERROR),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    }
  }
)

export default realtimeRoutes

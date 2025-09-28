/**
 * Comprehensive Error Handler
 * Unified error handling for all feature modules
 */

import type { Context } from 'hono'
import type { Env } from '../../types/env'

export interface ErrorContext {
  feature?: string
  operation?: string
  userId?: number
  restaurantId?: number
  requestId?: string
}

export interface ErrorDetails {
  code: string
  message: string
  details?: any
  stack?: string
  context?: ErrorContext
  timestamp: string
}

export class FeatureErrorHandler {
  private feature: string
  private env: Env

  constructor(feature: string, env: Env) {
    this.feature = feature
    this.env = env
  }

  /**
   * Handle and format errors consistently across features
   */
  handleError(error: Error | unknown, context: ErrorContext = {}): ErrorDetails {
    const errorDetails: ErrorDetails = {
      code: this.getErrorCode(error),
      message: this.getErrorMessage(error),
      context: {
        feature: this.feature,
        ...context
      },
      timestamp: new Date().toISOString()
    }

    // Add stack trace in development
    if (this.env.NODE_ENV === 'development' && error instanceof Error) {
      errorDetails.stack = error.stack
    }

    // Log error for monitoring
    this.logError(errorDetails)

    return errorDetails
  }

  /**
   * Create standardized error response for HTTP endpoints
   */
  createErrorResponse(error: Error | unknown, statusCode: number = 500, context: ErrorContext = {}) {
    const errorDetails = this.handleError(error, context)

    return {
      response: {
        success: false,
        error: {
          code: errorDetails.code,
          message: errorDetails.message,
          timestamp: errorDetails.timestamp,
          ...(this.env.NODE_ENV === 'development' && { details: errorDetails.details })
        }
      },
      status: statusCode
    }
  }

  /**
   * Async error wrapper for route handlers
   */
  asyncHandler<T>(
    handler: (c: Context<{ Bindings: Env }>) => Promise<T>
  ) {
    return async (c: Context<{ Bindings: Env }>) => {
      try {
        return await handler(c)
      } catch (error) {
        const { response, status } = this.createErrorResponse(error, 500, {
          operation: c.req.path,
          userId: c.get('user')?.id,
          restaurantId: c.get('user')?.restaurantId,
          requestId: c.get('requestId')
        })
        return c.json(response, status as any)
      }
    }
  }

  private getErrorCode(error: Error | unknown): string {
    if (error instanceof Error) {
      // Map common errors to codes
      if (error.message.includes('not found')) return 'NOT_FOUND'
      if (error.message.includes('unauthorized')) return 'UNAUTHORIZED'
      if (error.message.includes('forbidden')) return 'FORBIDDEN'
      if (error.message.includes('validation')) return 'VALIDATION_ERROR'
      if (error.message.includes('duplicate')) return 'DUPLICATE_ENTRY'
      if (error.message.includes('database')) return 'DATABASE_ERROR'
      return 'INTERNAL_ERROR'
    }
    return 'UNKNOWN_ERROR'
  }

  private getErrorMessage(error: Error | unknown): string {
    if (error instanceof Error) {
      return error.message
    }
    return 'An unexpected error occurred'
  }

  private logError(errorDetails: ErrorDetails): void {
    const logLevel = this.getLogLevel(errorDetails.code)

    console[logLevel](`[${this.feature}] ERROR:`, {
      code: errorDetails.code,
      message: errorDetails.message,
      context: errorDetails.context,
      timestamp: errorDetails.timestamp
    })

    // Send to external monitoring in production
    if (this.env.NODE_ENV === 'production' && this.shouldAlertOnError(errorDetails.code)) {
      this.sendErrorAlert(errorDetails).catch(console.error)
    }
  }

  private getLogLevel(code: string): 'error' | 'warn' | 'info' {
    if (['INTERNAL_ERROR', 'DATABASE_ERROR', 'UNKNOWN_ERROR'].includes(code)) {
      return 'error'
    }
    if (['UNAUTHORIZED', 'FORBIDDEN'].includes(code)) {
      return 'warn'
    }
    return 'info'
  }

  private shouldAlertOnError(code: string): boolean {
    return ['INTERNAL_ERROR', 'DATABASE_ERROR', 'UNKNOWN_ERROR'].includes(code)
  }

  private async sendErrorAlert(errorDetails: ErrorDetails): Promise<void> {
    if (!this.env.SLACK_WEBHOOK_URL) return

    try {
      await fetch(this.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: `🚨 Error in ${this.feature}`,
          attachments: [
            {
              color: 'danger',
              fields: [
                {
                  title: 'Error Code',
                  value: errorDetails.code,
                  short: true
                },
                {
                  title: 'Message',
                  value: errorDetails.message,
                  short: false
                },
                {
                  title: 'Feature',
                  value: this.feature,
                  short: true
                },
                {
                  title: 'Timestamp',
                  value: errorDetails.timestamp,
                  short: true
                }
              ]
            }
          ]
        })
      })
    } catch (alertError) {
      console.error('Failed to send error alert:', alertError)
    }
  }
}
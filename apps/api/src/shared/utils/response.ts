/**
 * Response Utilities
 * Standardized response helpers for API responses
 */

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
  timestamp: string
  meta?: {
    pagination?: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
    [key: string]: any
  }
}

export interface ErrorResponse {
  success: false
  error: string
  details?: any
  timestamp: string
  code?: number
}

export function createSuccessResponse<T>(
  data: T,
  message?: string,
  meta?: ApiResponse<T>['meta']
): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
    ...(meta && { meta })
  }
}

export function createErrorResponse(
  error: string,
  code?: number,
  details?: any
): ErrorResponse {
  return {
    success: false,
    error,
    timestamp: new Date().toISOString(),
    ...(code && { code }),
    ...(details && { details })
  }
}

export function createPaginatedResponse<T>(
  data: T[],
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  },
  message?: string
): ApiResponse<T[]> {
  return createSuccessResponse(data, message, { pagination })
}
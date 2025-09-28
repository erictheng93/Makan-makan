/**
 * Queue Error Classes
 *
 * This module defines custom error classes for the queue system.
 */

// Base Queue Error
export class QueueError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly details?: Record<string, unknown>

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'QueueError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}

// Validation Errors
export class QueueValidationError extends QueueError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'QUEUE_VALIDATION_ERROR', 400, details)
    this.name = 'QueueValidationError'
  }
}

// Business Logic Errors
export class QueueNotFoundError extends QueueError {
  constructor(queueId: string) {
    super(
      `Queue with ID ${queueId} not found`,
      'QUEUE_NOT_FOUND',
      404,
      { queueId }
    )
    this.name = 'QueueNotFoundError'
  }
}

export class QueueFullError extends QueueError {
  constructor(restaurantId: number, maxSize: number) {
    super(
      'Queue is full and cannot accept new customers',
      'QUEUE_FULL',
      400,
      { restaurantId, maxSize }
    )
    this.name = 'QueueFullError'
  }
}

export class QueueDisabledError extends QueueError {
  constructor(restaurantId: number) {
    super(
      'Queue system is currently disabled for this restaurant',
      'QUEUE_DISABLED',
      400,
      { restaurantId }
    )
    this.name = 'QueueDisabledError'
  }
}

export class QueueOutsideBusinessHoursError extends QueueError {
  constructor(restaurantId: number) {
    super(
      'Queue is not available outside business hours',
      'QUEUE_OUTSIDE_BUSINESS_HOURS',
      400,
      { restaurantId }
    )
    this.name = 'QueueOutsideBusinessHoursError'
  }
}

export class InvalidQueueStatusError extends QueueError {
  constructor(queueId: string, currentStatus: string, requiredStatus: string[]) {
    super(
      `Queue ${queueId} has status '${currentStatus}' but requires one of: ${requiredStatus.join(', ')}`,
      'INVALID_QUEUE_STATUS',
      400,
      { queueId, currentStatus, requiredStatus }
    )
    this.name = 'InvalidQueueStatusError'
  }
}

export class QueueAlreadyProcessedError extends QueueError {
  constructor(queueId: string, status: string) {
    super(
      `Queue ${queueId} has already been processed with status: ${status}`,
      'QUEUE_ALREADY_PROCESSED',
      400,
      { queueId, status }
    )
    this.name = 'QueueAlreadyProcessedError'
  }
}

// Authorization Errors
export class QueueUnauthorizedError extends QueueError {
  constructor(message: string = 'Unauthorized to perform this queue operation') {
    super(message, 'QUEUE_UNAUTHORIZED', 403)
    this.name = 'QueueUnauthorizedError'
  }
}

export class InvalidCheckInCodeError extends QueueError {
  constructor(queueId: string) {
    super(
      'Invalid check-in code provided',
      'INVALID_CHECK_IN_CODE',
      401,
      { queueId }
    )
    this.name = 'InvalidCheckInCodeError'
  }
}

// Table Management Errors
export class TableNotAvailableError extends QueueError {
  constructor(tableId: number) {
    super(
      `Table ${tableId} is not available for seating`,
      'TABLE_NOT_AVAILABLE',
      400,
      { tableId }
    )
    this.name = 'TableNotAvailableError'
  }
}

export class TableNotFoundError extends QueueError {
  constructor(tableId: number) {
    super(
      `Table with ID ${tableId} not found`,
      'TABLE_NOT_FOUND',
      404,
      { tableId }
    )
    this.name = 'TableNotFoundError'
  }
}

// Notification Errors
export class NotificationFailedError extends QueueError {
  constructor(queueId: string, notificationType: string, reason: string) {
    super(
      `Failed to send ${notificationType} notification for queue ${queueId}: ${reason}`,
      'NOTIFICATION_FAILED',
      500,
      { queueId, notificationType, reason }
    )
    this.name = 'NotificationFailedError'
  }
}

export class NotificationProviderError extends QueueError {
  constructor(provider: string, error: string) {
    super(
      `Notification provider ${provider} error: ${error}`,
      'NOTIFICATION_PROVIDER_ERROR',
      500,
      { provider, error }
    )
    this.name = 'NotificationProviderError'
  }
}

// Database Errors
export class QueueDatabaseError extends QueueError {
  constructor(operation: string, error: string) {
    super(
      `Database error during ${operation}: ${error}`,
      'QUEUE_DATABASE_ERROR',
      500,
      { operation, originalError: error }
    )
    this.name = 'QueueDatabaseError'
  }
}

// Configuration Errors
export class QueueConfigurationError extends QueueError {
  constructor(setting: string, value: unknown) {
    super(
      `Invalid queue configuration for '${setting}': ${value}`,
      'QUEUE_CONFIGURATION_ERROR',
      500,
      { setting, value }
    )
    this.name = 'QueueConfigurationError'
  }
}

// Rate Limiting Errors
export class QueueRateLimitError extends QueueError {
  constructor(operation: string, limit: number, window: string) {
    super(
      `Rate limit exceeded for ${operation}: ${limit} requests per ${window}`,
      'QUEUE_RATE_LIMIT_ERROR',
      429,
      { operation, limit, window }
    )
    this.name = 'QueueRateLimitError'
  }
}

// Export error type union
export type AnyQueueError =
  | QueueError
  | QueueValidationError
  | QueueNotFoundError
  | QueueFullError
  | QueueDisabledError
  | QueueOutsideBusinessHoursError
  | InvalidQueueStatusError
  | QueueAlreadyProcessedError
  | QueueUnauthorizedError
  | InvalidCheckInCodeError
  | TableNotAvailableError
  | TableNotFoundError
  | NotificationFailedError
  | NotificationProviderError
  | QueueDatabaseError
  | QueueConfigurationError
  | QueueRateLimitError

// Error helper functions
export function isQueueError(error: unknown): error is AnyQueueError {
  return error instanceof QueueError
}

export function getErrorCode(error: unknown): string {
  if (isQueueError(error)) {
    return error.code
  }
  return 'UNKNOWN_ERROR'
}

export function getErrorStatusCode(error: unknown): number {
  if (isQueueError(error)) {
    return error.statusCode
  }
  return 500
}

export function formatErrorResponse(error: unknown) {
  if (isQueueError(error)) {
    return {
      success: false,
      error: error.message,
      code: error.code,
      details: error.details
    }
  }

  return {
    success: false,
    error: error instanceof Error ? error.message : 'An unknown error occurred',
    code: 'UNKNOWN_ERROR'
  }
}
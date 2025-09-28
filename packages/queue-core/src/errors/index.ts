/**
 * Queue Errors - Main Export File
 */

export * from './queue-errors'

// Re-export commonly used error classes
export {
  QueueError,
  QueueValidationError,
  QueueNotFoundError,
  QueueFullError,
  QueueDisabledError,
  InvalidQueueStatusError,
  QueueUnauthorizedError,
  InvalidCheckInCodeError,
  isQueueError,
  getErrorCode,
  getErrorStatusCode,
  formatErrorResponse
} from './queue-errors'
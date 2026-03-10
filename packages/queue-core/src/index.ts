/**
 * Queue Core - Main Export File
 *
 * This is the main entry point for the @makanmakan/queue-core package.
 * It exports all types, interfaces, validators, and error classes.
 */

// Core Types
export * from "./types";

// Validators
export * from "./validators";

// Interfaces
export * from "./interfaces";

// Errors
export * from "./errors";

// Performance
export * from "./performance";

// Package Info
export const QUEUE_CORE_VERSION = "1.0.0";

// Commonly used re-exports for convenience
export type {
  // Core entities
  WaitingQueue,
  QueuePosition,
  QueueNotification,
  QueueSettings,
  QueueStatistics,

  // Request/Response types
  JoinQueueRequest,
  JoinQueueResponse,
  CallNextRequest,
  QueuePositionResponse,
  ApiResponse,
} from "./types";

export type {
  // Event types
  QueueEvent,
  QueueEventHandler,
  QueueEventBus,
} from "./types";

export type {
  // Service interfaces
  IQueueService,
  IQueueRepository,
  IQueueNotificationService,
  QueueRealtimeMetrics,
} from "./interfaces";

export type {
  // Validation types
  JoinQueueData,
  CallNextData,
  UpdateQueueSettingsData,
} from "./validators";

export {
  // Enums
  QueueStatus,
  QueueType,
  NotificationType,
  NotificationStatus,
} from "./types";

export {
  // Validators
  joinQueueSchema,
  callNextSchema,
  validateJoinQueue,
  validateCallNext,
  apiResponseSchema,
} from "./validators";

export {
  // Errors
  QueueError,
  QueueNotFoundError,
  QueueFullError,
  QueueValidationError,
  isQueueError,
  formatErrorResponse,
} from "./errors";

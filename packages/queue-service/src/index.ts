/**
 * Queue Service - Main Export File
 *
 * This is the main entry point for the @makanmakan/queue-service package.
 */

// Services
export * from './services'

// Re-export core types for convenience
export * from '@makanmakan/queue-core'

// Main service class
export { QueueService } from './services/QueueService'
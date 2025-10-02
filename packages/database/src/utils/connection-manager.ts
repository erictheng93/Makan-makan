/**
 * D1 Connection Management and Query Optimization
 *
 * Cloudflare D1 handles connection pooling automatically, but we can optimize:
 * 1. Query batching for multiple operations
 * 2. Connection timeout handling
 * 3. Retry logic for transient failures
 * 4. Query queue management
 */

import type { D1Database } from '@cloudflare/workers-types'

export interface QueryBatchItem {
  id: string
  query: () => Promise<any>
  priority: number
  timeout: number
  retryCount: number
  maxRetries: number
}

export interface ConnectionManagerConfig {
  maxConcurrentQueries: number
  defaultTimeout: number
  maxRetries: number
  retryDelay: number
  batchSize: number
  batchWindow: number // ms to wait before executing batch
}

const DEFAULT_CONFIG: ConnectionManagerConfig = {
  maxConcurrentQueries: 10,
  defaultTimeout: 10000, // 10 seconds
  maxRetries: 3,
  retryDelay: 100, // 100ms exponential backoff base
  batchSize: 10, // Max queries per batch
  batchWindow: 50 // 50ms batch window
}

export class ConnectionManager {
  private config: ConnectionManagerConfig
  private queryQueue: QueryBatchItem[] = []
  private activeQueries = 0
  private batchTimer: NodeJS.Timeout | null = null
  private metrics = {
    totalQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
    retriedQueries: 0,
    batchedQueries: 0,
    averageQueryTime: 0,
    totalQueryTime: 0
  }

  constructor(config: Partial<ConnectionManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Execute a query with connection management
   */
  async executeQuery<T>(
    queryFn: () => Promise<T>,
    options: {
      priority?: number
      timeout?: number
      maxRetries?: number
      batchable?: boolean
    } = {}
  ): Promise<T> {
    const {
      priority = 5,
      timeout = this.config.defaultTimeout,
      maxRetries = this.config.maxRetries,
      batchable = false
    } = options

    const queryItem: QueryBatchItem = {
      id: crypto.randomUUID(),
      query: queryFn,
      priority,
      timeout,
      retryCount: 0,
      maxRetries
    }

    // If query is batchable and we're below concurrent limit, add to batch queue
    if (batchable && this.activeQueries < this.config.maxConcurrentQueries) {
      return this.addToBatch(queryItem)
    }

    // Otherwise execute immediately with connection management
    return this.executeWithRetry(queryItem)
  }

  /**
   * Add query to batch for optimized execution
   */
  private async addToBatch<T>(queryItem: QueryBatchItem): Promise<T> {
    this.queryQueue.push(queryItem)
    this.metrics.batchedQueries++

    // Start batch timer if not already running
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.executeBatch()
      }, this.config.batchWindow)
    }

    // Wait for batch execution or queue limit
    if (this.queryQueue.length >= this.config.batchSize) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
      await this.executeBatch()
    }

    // Return promise that resolves when query completes
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(async () => {
        const completed = !this.queryQueue.find(q => q.id === queryItem.id)
        if (completed) {
          clearInterval(checkInterval)
          try {
            const result = await queryItem.query()
            resolve(result as T)
          } catch (error) {
            reject(error)
          }
        }
      }, 10)
    })
  }

  /**
   * Execute batched queries
   */
  private async executeBatch(): Promise<void> {
    if (this.queryQueue.length === 0) return

    // Sort by priority (higher priority first)
    const batch = this.queryQueue
      .sort((a, b) => b.priority - a.priority)
      .splice(0, this.config.batchSize)

    // Execute batch concurrently
    await Promise.allSettled(
      batch.map(item => this.executeWithRetry(item))
    )
  }

  /**
   * Execute query with retry logic
   */
  private async executeWithRetry<T>(queryItem: QueryBatchItem): Promise<T> {
    this.activeQueries++
    this.metrics.totalQueries++
    const startTime = Date.now()

    try {
      const result = await this.executeWithTimeout(
        queryItem.query,
        queryItem.timeout
      )

      this.metrics.successfulQueries++
      this.updateQueryTime(Date.now() - startTime)
      return result as T
    } catch (error) {
      // Retry on transient errors
      if (this.isRetryableError(error) && queryItem.retryCount < queryItem.maxRetries) {
        queryItem.retryCount++
        this.metrics.retriedQueries++

        // Exponential backoff
        const delay = this.config.retryDelay * Math.pow(2, queryItem.retryCount)
        await this.sleep(delay)

        return this.executeWithRetry(queryItem)
      }

      this.metrics.failedQueries++
      throw error
    } finally {
      this.activeQueries--
    }
  }

  /**
   * Execute query with timeout
   */
  private async executeWithTimeout<T>(
    queryFn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      queryFn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), timeout)
      )
    ])
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (!error) return false

    const retryableErrors = [
      'SQLITE_BUSY',
      'SQLITE_LOCKED',
      'SQLITE_INTERRUPT',
      'timeout',
      'connection',
      'network'
    ]

    const errorMessage = error.message?.toLowerCase() || ''
    return retryableErrors.some(err => errorMessage.includes(err))
  }

  /**
   * Update query time metrics
   */
  private updateQueryTime(duration: number): void {
    this.metrics.totalQueryTime += duration
    this.metrics.averageQueryTime =
      this.metrics.totalQueryTime / this.metrics.successfulQueries
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get connection metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeQueries: this.activeQueries,
      queuedQueries: this.queryQueue.length,
      successRate:
        this.metrics.totalQueries > 0
          ? (this.metrics.successfulQueries / this.metrics.totalQueries) * 100
          : 0
    }
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      retriedQueries: 0,
      batchedQueries: 0,
      averageQueryTime: 0,
      totalQueryTime: 0
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
    this.queryQueue = []
  }
}

/**
 * Global connection manager instance
 */
let globalConnectionManager: ConnectionManager | null = null

export function getConnectionManager(config?: Partial<ConnectionManagerConfig>): ConnectionManager {
  if (!globalConnectionManager) {
    globalConnectionManager = new ConnectionManager(config)
  }
  return globalConnectionManager
}

export function resetConnectionManager(): void {
  if (globalConnectionManager) {
    globalConnectionManager.destroy()
    globalConnectionManager = null
  }
}

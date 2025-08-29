interface SSEConnectionOptions {
  url: string
  headers?: Record<string, string>
  withCredentials?: boolean
  retry?: {
    maxAttempts?: number
    baseDelay?: number
    maxDelay?: number
    exponentialBackoff?: boolean
  }
  heartbeat?: {
    enabled?: boolean
    interval?: number
    timeoutAfter?: number
  }
  autoReconnect?: boolean
  events?: string[]
}

interface SSEConnection {
  id: string
  url: string
  eventSource: EventSource | null
  status: 'connecting' | 'connected' | 'reconnecting' | 'closed' | 'error'
  options: SSEConnectionOptions
  listeners: Map<string, Set<EventListener>>
  reconnectAttempts: number
  lastActivity: number
  heartbeatInterval?: NodeJS.Timeout
  connectionTime?: number
  statistics: {
    messagesReceived: number
    reconnectCount: number
    totalDowntime: number
    lastError?: string
  }
}

interface ConnectionPoolStats {
  totalConnections: number
  activeConnections: number
  failedConnections: number
  totalMessagesReceived: number
  averageLatency: number
  uptime: number
}

/**
 * SSE Connection Pool Manager
 * Efficiently manages multiple Server-Sent Events connections with automatic reconnection,
 * connection pooling, and health monitoring
 */
export class SSEConnectionPool {
  private connections = new Map<string, SSEConnection>()
  private eventBus = new EventTarget()
  private poolStats: ConnectionPoolStats = {
    totalConnections: 0,
    activeConnections: 0,
    failedConnections: 0,
    totalMessagesReceived: 0,
    averageLatency: 0,
    uptime: Date.now()
  }
  private healthCheckInterval?: NodeJS.Timeout
  private connectionCleanupInterval?: NodeJS.Timeout
  private maxConnections: number
  private defaultOptions: Partial<SSEConnectionOptions>

  constructor(
    maxConnections = 10,
    defaultOptions: Partial<SSEConnectionOptions> = {}
  ) {
    this.maxConnections = maxConnections
    this.defaultOptions = {
      retry: {
        maxAttempts: 5,
        baseDelay: 1000,
        maxDelay: 30000,
        exponentialBackoff: true
      },
      heartbeat: {
        enabled: true,
        interval: 30000, // 30 seconds
        timeoutAfter: 60000 // 60 seconds
      },
      autoReconnect: true,
      withCredentials: false,
      ...defaultOptions
    }

    this.startHealthCheck()
    this.startConnectionCleanup()
    
    // Handle page visibility changes
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this))
    }
    
    // Handle network status changes
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      window.addEventListener('online', this.handleNetworkOnline.bind(this))
      window.addEventListener('offline', this.handleNetworkOffline.bind(this))
    }
  }

  /**
   * Create a new SSE connection
   */
  async connect(
    id: string,
    options: SSEConnectionOptions
  ): Promise<SSEConnection> {
    if (this.connections.has(id)) {
      throw new Error(`Connection with id "${id}" already exists`)
    }

    if (this.connections.size >= this.maxConnections) {
      throw new Error(`Maximum connections limit (${this.maxConnections}) reached`)
    }

    const finalOptions = { ...this.defaultOptions, ...options }
    const connection: SSEConnection = {
      id,
      url: options.url,
      eventSource: null,
      status: 'connecting',
      options: finalOptions,
      listeners: new Map(),
      reconnectAttempts: 0,
      lastActivity: Date.now(),
      statistics: {
        messagesReceived: 0,
        reconnectCount: 0,
        totalDowntime: 0
      }
    }

    this.connections.set(id, connection)
    this.poolStats.totalConnections++

    try {
      await this.establishConnection(connection)
      return connection
    } catch (error) {
      this.connections.delete(id)
      this.poolStats.totalConnections--
      throw error
    }
  }

  /**
   * Establish EventSource connection
   */
  private async establishConnection(connection: SSEConnection): Promise<void> {
    const { options } = connection
    
    return new Promise((resolve, reject) => {
      try {
        // Create EventSource with options
        const eventSourceInit: EventSourceInit = {
          withCredentials: options.withCredentials || false
        }
        
        const url = this.buildUrl(options.url, options.headers)
        connection.eventSource = new EventSource(url, eventSourceInit)
        connection.connectionTime = Date.now()
        
        const eventSource = connection.eventSource

        // Connection opened
        eventSource.onopen = () => {
          connection.status = 'connected'
          connection.reconnectAttempts = 0
          connection.lastActivity = Date.now()
          this.poolStats.activeConnections++
          
          this.setupHeartbeat(connection)
          this.notifyConnectionEvent(connection, 'connected')
          resolve()
        }

        // Handle errors
        eventSource.onerror = (event) => {
          const wasConnected = connection.status === 'connected'
          connection.status = 'error'
          connection.statistics.lastError = 'Connection error'
          
          if (wasConnected) {
            this.poolStats.activeConnections--
          }
          this.poolStats.failedConnections++
          
          this.notifyConnectionEvent(connection, 'error', { error: event })
          
          // Auto-reconnect if enabled
          if (options.autoReconnect && connection.reconnectAttempts < (options.retry?.maxAttempts || 5)) {
            this.scheduleReconnection(connection)
          } else {
            this.cleanupConnection(connection)
            reject(new Error(`Failed to establish SSE connection to ${connection.url}`))
          }
        }

        // Handle messages
        eventSource.onmessage = (event) => {
          this.handleMessage(connection, 'message', event)
        }

        // Setup custom event listeners
        if (options.events) {
          options.events.forEach(eventType => {
            eventSource.addEventListener(eventType, (event) => {
              this.handleMessage(connection, eventType, event as MessageEvent)
            })
          })
        }
        
      } catch (error) {
        connection.status = 'error'
        connection.statistics.lastError = error instanceof Error ? error.message : String(error)
        reject(error)
      }
    })
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(connection: SSEConnection, eventType: string, event: MessageEvent) {
    connection.lastActivity = Date.now()
    connection.statistics.messagesReceived++
    this.poolStats.totalMessagesReceived++

    // Parse message data
    let data: any
    try {
      data = JSON.parse(event.data)
    } catch {
      data = event.data
    }

    // Notify local listeners
    const listeners = connection.listeners.get(eventType)
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener({ ...event, parsedData: data } as any)
        } catch (error) {
          console.error('Error in SSE listener:', error)
        }
      })
    }

    // Notify global event bus
    this.eventBus.dispatchEvent(new CustomEvent('message', {
      detail: {
        connectionId: connection.id,
        eventType,
        data,
        timestamp: Date.now()
      }
    }))

    // Handle special messages
    if (eventType === 'heartbeat' || (data && data.type === 'heartbeat')) {
      this.handleHeartbeat(connection, data)
    }
  }

  /**
   * Add event listener to connection
   */
  addEventListener(
    connectionId: string,
    eventType: string,
    listener: EventListener
  ): void {
    const connection = this.connections.get(connectionId)
    if (!connection) {
      throw new Error(`Connection "${connectionId}" not found`)
    }

    if (!connection.listeners.has(eventType)) {
      connection.listeners.set(eventType, new Set())
    }

    connection.listeners.get(eventType)!.add(listener)
  }

  /**
   * Remove event listener from connection
   */
  removeEventListener(
    connectionId: string,
    eventType: string,
    listener: EventListener
  ): void {
    const connection = this.connections.get(connectionId)
    if (!connection) return

    const listeners = connection.listeners.get(eventType)
    if (listeners) {
      listeners.delete(listener)
      if (listeners.size === 0) {
        connection.listeners.delete(eventType)
      }
    }
  }

  /**
   * Disconnect and remove connection
   */
  disconnect(connectionId: string): void {
    const connection = this.connections.get(connectionId)
    if (!connection) return

    this.cleanupConnection(connection)
    this.connections.delete(connectionId)
    this.poolStats.totalConnections--

    if (connection.status === 'connected') {
      this.poolStats.activeConnections--
    }

    this.notifyConnectionEvent(connection, 'disconnected')
  }

  /**
   * Disconnect all connections
   */
  disconnectAll(): void {
    const connectionIds = Array.from(this.connections.keys())
    connectionIds.forEach(id => this.disconnect(id))
  }

  /**
   * Get connection status
   */
  getConnection(connectionId: string): SSEConnection | null {
    return this.connections.get(connectionId) || null
  }

  /**
   * Get all connections
   */
  getAllConnections(): SSEConnection[] {
    return Array.from(this.connections.values())
  }

  /**
   * Get connection pool statistics
   */
  getStats(): ConnectionPoolStats {
    const uptime = Date.now() - this.poolStats.uptime
    const activeConnections = Array.from(this.connections.values())
      .filter(conn => conn.status === 'connected').length

    return {
      ...this.poolStats,
      activeConnections,
      uptime
    }
  }

  /**
   * Listen to connection pool events
   */
  on(event: string, listener: EventListener): void {
    this.eventBus.addEventListener(event, listener)
  }

  /**
   * Remove connection pool event listener
   */
  off(event: string, listener: EventListener): void {
    this.eventBus.removeEventListener(event, listener)
  }

  /**
   * Build URL with authentication headers if needed
   */
  private buildUrl(baseUrl: string, headers?: Record<string, string>): string {
    const url = new URL(baseUrl)
    
    // Add headers as query parameters if needed (for auth tokens, etc.)
    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        if (key.toLowerCase() === 'authorization') {
          // Handle auth token in URL for SSE
          url.searchParams.set('token', value.replace('Bearer ', ''))
        }
      })
    }
    
    return url.toString()
  }

  /**
   * Setup heartbeat monitoring
   */
  private setupHeartbeat(connection: SSEConnection): void {
    const { heartbeat } = connection.options
    if (!heartbeat?.enabled) return

    this.clearHeartbeat(connection)
    
    connection.heartbeatInterval = setInterval(() => {
      const timeSinceLastActivity = Date.now() - connection.lastActivity
      
      if (timeSinceLastActivity > (heartbeat.timeoutAfter || 60000)) {
        console.warn(`Connection ${connection.id} heartbeat timeout, reconnecting...`)
        this.reconnectConnection(connection)
      }
    }, heartbeat.interval || 30000)
  }

  /**
   * Handle heartbeat message
   */
  private handleHeartbeat(connection: SSEConnection, data: any): void {
    connection.lastActivity = Date.now()
    
    // Respond to server heartbeat if needed
    if (data?.requiresResponse) {
      // Send heartbeat response (implementation depends on your backend)
      console.log(`Heartbeat received from ${connection.id}`)
    }
  }

  /**
   * Clear heartbeat interval
   */
  private clearHeartbeat(connection: SSEConnection): void {
    if (connection.heartbeatInterval) {
      clearInterval(connection.heartbeatInterval)
      connection.heartbeatInterval = undefined
    }
  }

  /**
   * Schedule connection reconnection with backoff
   */
  private scheduleReconnection(connection: SSEConnection): void {
    const { retry } = connection.options
    if (!retry) return

    connection.status = 'reconnecting'
    connection.reconnectAttempts++
    connection.statistics.reconnectCount++

    let delay = retry.baseDelay || 1000

    if (retry.exponentialBackoff) {
      delay = Math.min(
        delay * Math.pow(2, connection.reconnectAttempts - 1),
        retry.maxDelay || 30000
      )
    }

    console.log(`Reconnecting ${connection.id} in ${delay}ms (attempt ${connection.reconnectAttempts})`)

    setTimeout(() => {
      this.reconnectConnection(connection)
    }, delay)
  }

  /**
   * Reconnect connection
   */
  private async reconnectConnection(connection: SSEConnection): Promise<void> {
    this.cleanupConnection(connection, false)
    
    try {
      await this.establishConnection(connection)
    } catch (error) {
      if (connection.reconnectAttempts < (connection.options.retry?.maxAttempts || 5)) {
        this.scheduleReconnection(connection)
      } else {
        connection.status = 'error'
        connection.statistics.lastError = 'Max reconnection attempts reached'
        this.notifyConnectionEvent(connection, 'failed', { error })
      }
    }
  }

  /**
   * Cleanup connection resources
   */
  private cleanupConnection(connection: SSEConnection, removeListeners = true): void {
    if (connection.eventSource) {
      connection.eventSource.close()
      connection.eventSource = null
    }

    this.clearHeartbeat(connection)

    if (removeListeners) {
      connection.listeners.clear()
    }

    connection.status = 'closed'
  }

  /**
   * Notify connection event
   */
  private notifyConnectionEvent(
    connection: SSEConnection,
    eventType: string,
    data?: any
  ): void {
    this.eventBus.dispatchEvent(new CustomEvent('connection', {
      detail: {
        connectionId: connection.id,
        eventType,
        status: connection.status,
        url: connection.url,
        data,
        timestamp: Date.now()
      }
    }))
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck()
    }, 60000) // Check every minute
  }

  /**
   * Perform health check on all connections
   */
  private performHealthCheck(): void {
    const now = Date.now()
    
    this.connections.forEach(connection => {
      if (connection.status === 'connected') {
        const timeSinceActivity = now - connection.lastActivity
        const timeout = connection.options.heartbeat?.timeoutAfter || 120000 // 2 minutes default
        
        if (timeSinceActivity > timeout) {
          console.warn(`Connection ${connection.id} appears stale, checking...`)
          // Trigger a soft reconnect
          this.reconnectConnection(connection)
        }
      }
    })
  }

  /**
   * Start connection cleanup monitoring
   */
  private startConnectionCleanup(): void {
    this.connectionCleanupInterval = setInterval(() => {
      this.cleanupStaleConnections()
    }, 300000) // Clean every 5 minutes
  }

  /**
   * Clean up stale connections
   */
  private cleanupStaleConnections(): void {
    const now = Date.now()
    const staleThreshold = 600000 // 10 minutes
    
    const staleConnections = Array.from(this.connections.values())
      .filter(conn => 
        (conn.status === 'error' || conn.status === 'closed') &&
        (now - conn.lastActivity) > staleThreshold
      )
    
    staleConnections.forEach(conn => {
      console.log(`Cleaning up stale connection: ${conn.id}`)
      this.disconnect(conn.id)
    })
  }

  /**
   * Handle page visibility changes
   */
  private handleVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      // Page became visible, check and reconnect if needed
      this.connections.forEach(connection => {
        if (connection.status === 'error' && connection.options.autoReconnect) {
          this.reconnectConnection(connection)
        }
      })
    }
  }

  /**
   * Handle network online event
   */
  private handleNetworkOnline(): void {
    console.log('Network came back online, reconnecting SSE connections...')
    this.connections.forEach(connection => {
      if (connection.status !== 'connected' && connection.options.autoReconnect) {
        connection.reconnectAttempts = 0 // Reset attempts on network recovery
        this.reconnectConnection(connection)
      }
    })
  }

  /**
   * Handle network offline event
   */
  private handleNetworkOffline(): void {
    console.log('Network went offline, pausing SSE connections...')
    this.connections.forEach(connection => {
      if (connection.status === 'connected') {
        connection.status = 'reconnecting'
        this.cleanupConnection(connection, false)
      }
    })
  }

  /**
   * Dispose of connection pool
   */
  dispose(): void {
    this.disconnectAll()
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }
    
    if (this.connectionCleanupInterval) {
      clearInterval(this.connectionCleanupInterval)
    }

    // Remove global event listeners
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this))
    }
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleNetworkOnline.bind(this))
      window.removeEventListener('offline', this.handleNetworkOffline.bind(this))
    }
  }
}

// Create singleton instance
export const sseConnectionPool = new SSEConnectionPool()

export default sseConnectionPool
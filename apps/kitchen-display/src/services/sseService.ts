import type { KitchenSSEEvent, ConnectionStatus } from '@/types'

export interface SSEOptions {
  restaurantId: number
  onMessage?: (event: KitchenSSEEvent) => void
  onConnectionChange?: (status: ConnectionStatus) => void
  onError?: (error: Event) => void
  maxReconnectAttempts?: number
  reconnectInterval?: number
}

export class KitchenSSEService {
  private eventSource: EventSource | null = null
  private options: Required<SSEOptions>
  private reconnectAttempts = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private lastHeartbeat = 0
  private isManualClose = false

  constructor(options: SSEOptions) {
    this.options = {
      maxReconnectAttempts: 5,
      reconnectInterval: 3000,
      onMessage: () => {},
      onConnectionChange: () => {},
      onError: () => {},
      ...options
    }
  }

  /**
   * 建立 SSE 連接
   */
  connect(): void {
    if (this.eventSource && this.eventSource.readyState !== EventSource.CLOSED) {
      console.warn('SSE connection already exists')
      return
    }

    this.isManualClose = false
    this.options.onConnectionChange('connecting')

    try {
      const token = localStorage.getItem('kitchen_auth_token')
      if (!token) {
        throw new Error('No authentication token found')
      }

      const url = `/api/v1/kitchen/${this.options.restaurantId}/events`
      console.log(`Connecting to SSE endpoint: ${url}`)

      // 創建 EventSource 實例
      this.eventSource = new EventSource(url, {
        withCredentials: true
      })

      this.setupEventListeners()
      this.startHeartbeatMonitor()

    } catch (error) {
      console.error('Failed to create SSE connection:', error)
      this.options.onError(error as Event)
      this.scheduleReconnect()
    }
  }

  /**
   * 手動關閉連接
   */
  disconnect(): void {
    this.isManualClose = true
    this.cleanup()
    this.options.onConnectionChange('disconnected')
  }

  /**
   * 獲取當前連接狀態
   */
  getConnectionStatus(): ConnectionStatus {
    if (!this.eventSource) return 'disconnected'
    
    switch (this.eventSource.readyState) {
      case EventSource.CONNECTING:
        return 'connecting'
      case EventSource.OPEN:
        return 'connected'
      case EventSource.CLOSED:
        return 'disconnected'
      default:
        return 'error'
    }
  }

  /**
   * 設置事件監聽器
   */
  private setupEventListeners(): void {
    if (!this.eventSource) return

    // 連接成功
    this.eventSource.onopen = (event) => {
      console.log('SSE connection opened')
      this.reconnectAttempts = 0
      this.lastHeartbeat = Date.now()
      this.options.onConnectionChange('connected')
    }

    // 接收消息
    this.eventSource.onmessage = (event) => {
      this.handleMessage(event)
    }

    // 連接錯誤
    this.eventSource.onerror = (event) => {
      console.error('SSE connection error:', event)
      this.options.onError(event)
      
      if (!this.isManualClose) {
        this.options.onConnectionChange('error')
        this.scheduleReconnect()
      }
    }

    // 監聽特定事件類型
    this.eventSource.addEventListener('connected', (event) => {
      console.log('Kitchen display connected:', event.data)
      this.lastHeartbeat = Date.now()
    })

    this.eventSource.addEventListener('heartbeat', (event) => {
      const data = JSON.parse(event.data)
      console.log('Heartbeat received:', data)
      this.lastHeartbeat = Date.now()
    })

    this.eventSource.addEventListener('order-update', (event) => {
      const data = JSON.parse(event.data)
      console.log('Order update received:', data)
      this.options.onMessage(data)
    })

    this.eventSource.addEventListener('test-event', (event) => {
      const data = JSON.parse(event.data)
      console.log('Test event received:', data)
      this.options.onMessage(data)
    })
  }

  /**
   * 處理接收到的消息
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data: KitchenSSEEvent = JSON.parse(event.data)
      console.log('SSE message received:', data)
      
      this.lastHeartbeat = Date.now()
      
      // 處理心跳消息
      if (data.type === 'HEARTBEAT') {
        return // 心跳消息不需要傳遞給業務邏輯
      }
      
      this.options.onMessage(data)
    } catch (error) {
      console.error('Failed to parse SSE message:', event.data, error)
    }
  }

  /**
   * 開始心跳監控
   */
  private startHeartbeatMonitor(): void {
    this.stopHeartbeatMonitor()
    
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now()
      const timeSinceLastHeartbeat = now - this.lastHeartbeat
      
      // 如果超過 90 秒沒有收到心跳，認為連接異常
      if (timeSinceLastHeartbeat > 90000) {
        console.warn('Heartbeat timeout, reconnecting...')
        this.scheduleReconnect()
      }
    }, 30000) // 每30秒檢查一次
  }

  /**
   * 停止心跳監控
   */
  private stopHeartbeatMonitor(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  /**
   * 計劃重連
   */
  private scheduleReconnect(): void {
    if (this.isManualClose || this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
        console.error(`Max reconnect attempts (${this.options.maxReconnectAttempts}) reached`)
        this.options.onConnectionChange('error')
      }
      return
    }

    this.cleanup()
    this.reconnectAttempts++

    const delay = Math.min(
      this.options.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000 // 最大延遲 30 秒
    )

    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`)
    this.options.onConnectionChange('connecting')

    this.reconnectTimer = setTimeout(() => {
      this.connect()
    }, delay)
  }

  /**
   * 清理資源
   */
  private cleanup(): void {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.stopHeartbeatMonitor()
  }

  /**
   * 獲取連接統計信息
   */
  getConnectionStats() {
    return {
      reconnectAttempts: this.reconnectAttempts,
      lastHeartbeat: this.lastHeartbeat,
      isConnected: this.getConnectionStatus() === 'connected',
      timeSinceLastHeartbeat: Date.now() - this.lastHeartbeat
    }
  }
}

/**
 * 創建 SSE 服務實例的工廠函數
 */
export function createKitchenSSE(options: SSEOptions): KitchenSSEService {
  return new KitchenSSEService(options)
}
import { ElMessage, ElNotification } from 'element-plus'

// 錯誤類型定義
export enum ErrorType {
  NETWORK = 'network',
  API = 'api',
  SSE = 'sse',
  VALIDATION = 'validation',
  PERMISSION = 'permission',
  UNKNOWN = 'unknown'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorDetails {
  type: ErrorType
  severity: ErrorSeverity
  code?: string | number
  message: string
  originalError?: any
  context?: Record<string, any>
  timestamp: Date
  userAgent?: string
  url?: string
  userId?: number | string
  restaurantId?: number | string
}

// 離線狀態管理
class OfflineManager {
  private isOnline = navigator.onLine
  private callbacks: Array<(isOnline: boolean) => void> = []
  private pendingRequests: Array<() => Promise<any>> = []

  constructor() {
    this.setupEventListeners()
  }

  private setupEventListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true
      this.notifyCallbacks()
      this.processPendingRequests()
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
      this.notifyCallbacks()
    })
  }

  private notifyCallbacks() {
    this.callbacks.forEach(callback => callback(this.isOnline))
  }

  private async processPendingRequests() {
    const requests = [...this.pendingRequests]
    this.pendingRequests = []

    for (const request of requests) {
      try {
        await request()
      } catch (error) {
        console.error('Failed to process pending request:', error)
        // 重新加入失敗的請求
        this.pendingRequests.push(request)
      }
    }
  }

  onStatusChange(callback: (isOnline: boolean) => void) {
    this.callbacks.push(callback)
    callback(this.isOnline) // 立即回調當前狀態
  }

  addPendingRequest(request: () => Promise<any>) {
    this.pendingRequests.push(request)
  }

  getStatus() {
    return this.isOnline
  }
}

// 錯誤上報服務
class ErrorReportingService {
  private readonly REPORT_ENDPOINT = '/api/v1/system/error-report'
  private reportQueue: ErrorDetails[] = []
  private isReporting = false

  async reportError(error: ErrorDetails) {
    // 添加到報告隊列
    this.reportQueue.push({
      ...error,
      userAgent: navigator.userAgent,
      url: window.location.href
    })

    // 如果當前沒有在報告中，開始報告
    if (!this.isReporting) {
      this.processReportQueue()
    }
  }

  private async processReportQueue() {
    if (this.reportQueue.length === 0) {
      this.isReporting = false
      return
    }

    this.isReporting = true

    try {
      const errors = [...this.reportQueue]
      this.reportQueue = []

      const response = await fetch(this.REPORT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ errors })
      })

      if (!response.ok) {
        // 如果報告失敗，重新加入隊列
        this.reportQueue.unshift(...errors)
        throw new Error(`Report failed: ${response.status}`)
      }

      console.log(`Successfully reported ${errors.length} errors`)
    } catch (error) {
      console.error('Error reporting failed:', error)
      // 延遲重試
      setTimeout(() => this.processReportQueue(), 30000)
    }

    this.isReporting = false
  }
}

// 主要錯誤處理器
export class ErrorHandler {
  private static instance: ErrorHandler
  private offlineManager = new OfflineManager()
  private reportingService = new ErrorReportingService()
  private userNotificationEnabled = true

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }

  // 處理一般錯誤
  handleError(error: any, context?: Record<string, any>): ErrorDetails {
    const errorDetails = this.parseError(error, context)
    
    // 記錄錯誤
    console.error('Error handled:', errorDetails)
    
    // 上報錯誤（高嚴重性）
    if (errorDetails.severity === ErrorSeverity.HIGH || 
        errorDetails.severity === ErrorSeverity.CRITICAL) {
      this.reportingService.reportError(errorDetails)
    }
    
    // 顯示用戶提示
    if (this.userNotificationEnabled) {
      this.showUserNotification(errorDetails)
    }
    
    return errorDetails
  }

  // 解析錯誤
  private parseError(error: any, context?: Record<string, any>): ErrorDetails {
    let type = ErrorType.UNKNOWN
    let severity = ErrorSeverity.MEDIUM
    let message = '發生了未知錯誤'
    let code: string | number | undefined

    // 根據錯誤類型進行分類
    if (error instanceof TypeError || error instanceof ReferenceError) {
      type = ErrorType.VALIDATION
      severity = ErrorSeverity.LOW
      message = '輸入驗證錯誤'
    } else if (error?.name === 'NetworkError' || error?.code === 'NETWORK_ERROR') {
      type = ErrorType.NETWORK
      severity = ErrorSeverity.HIGH
      message = '網絡連接錯誤，請檢查您的網絡連接'
    } else if (error?.response) {
      // API 錯誤
      type = ErrorType.API
      code = error.response.status
      message = error.response.data?.error?.message || '服務器錯誤'
      
      if (code >= 500) {
        severity = ErrorSeverity.HIGH
      } else if (code === 403 || code === 401) {
        type = ErrorType.PERMISSION
        severity = ErrorSeverity.MEDIUM
        message = '權限不足或登入已過期'
      }
    } else if (error?.message) {
      message = error.message
    }

    return {
      type,
      severity,
      code,
      message,
      originalError: error,
      context,
      timestamp: new Date()
    }
  }

  // 顯示用戶提示
  private showUserNotification(error: ErrorDetails) {
    const duration = error.severity === ErrorSeverity.HIGH ? 8000 : 4000

    if (error.severity === ErrorSeverity.CRITICAL) {
      ElNotification({
        title: '嚴重錯誤',
        message: error.message,
        type: 'error',
        duration: 0, // 不自動關閉
        position: 'top-right'
      })
    } else if (error.severity === ErrorSeverity.HIGH) {
      ElNotification({
        title: '系統錯誤',
        message: error.message,
        type: 'error',
        duration,
        position: 'top-right'
      })
    } else {
      ElMessage({
        message: error.message,
        type: error.severity === ErrorSeverity.LOW ? 'warning' : 'error',
        duration,
        showClose: true
      })
    }
  }

  // 設置用戶通知狀態
  setUserNotificationEnabled(enabled: boolean) {
    this.userNotificationEnabled = enabled
  }

  // 獲取離線管理器
  getOfflineManager() {
    return this.offlineManager
  }
}

// 廚房專用錯誤處理器
export class KitchenErrorHandler extends ErrorHandler {
  private sseReconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000 // 1秒
  private sseEventSource: EventSource | null = null

  static handleSSEError(error: Event, eventSource?: EventSource) {
    const handler = ErrorHandler.getInstance() as KitchenErrorHandler
    return handler.handleSSEConnectionError(error, eventSource)
  }

  static handleAPIError(error: any, context?: Record<string, any>) {
    const handler = ErrorHandler.getInstance()
    return handler.handleAPIRequest(error, context)
  }

  // 處理 SSE 連接錯誤
  handleSSEConnectionError(error: Event, eventSource?: EventSource): void {
    const errorDetails: ErrorDetails = {
      type: ErrorType.SSE,
      severity: ErrorSeverity.HIGH,
      message: 'SSE 連接中斷',
      originalError: error,
      context: { 
        readyState: eventSource?.readyState,
        url: eventSource?.url,
        reconnectAttempts: this.sseReconnectAttempts
      },
      timestamp: new Date()
    }

    console.error('SSE Connection Error:', errorDetails)
    
    // 上報錯誤
    this.reportingService.reportError(errorDetails)

    // 顯示連接狀態
    if (this.userNotificationEnabled) {
      ElMessage({
        message: '實時連接中斷，正在嘗試重新連接...',
        type: 'warning',
        duration: 3000
      })
    }

    // 自動重連
    this.attemptSSEReconnect(eventSource)
  }

  // SSE 自動重連
  private attemptSSEReconnect(eventSource?: EventSource) {
    if (this.sseReconnectAttempts >= this.maxReconnectAttempts) {
      ElNotification({
        title: '連接失敗',
        message: '無法重新建立實時連接，請刷新頁面',
        type: 'error',
        duration: 0,
        position: 'top-right'
      })
      return
    }

    this.sseReconnectAttempts++
    
    // 指數退避重連策略
    const delay = this.reconnectDelay * Math.pow(2, this.sseReconnectAttempts - 1)
    
    setTimeout(() => {
      try {
        console.log(`Attempting SSE reconnection ${this.sseReconnectAttempts}/${this.maxReconnectAttempts}`)
        
        // 重新建立 SSE 連接的邏輯應該由呼叫方提供
        // 這裡觸發一個自定義事件，讓元件處理重連
        window.dispatchEvent(new CustomEvent('sse-reconnect-attempt', {
          detail: { 
            attempt: this.sseReconnectAttempts,
            maxAttempts: this.maxReconnectAttempts
          }
        }))
        
      } catch (error) {
        console.error('SSE reconnection failed:', error)
        this.attemptSSEReconnect(eventSource)
      }
    }, delay)
  }

  // 重置 SSE 重連計數
  resetSSEReconnectAttempts() {
    this.sseReconnectAttempts = 0
  }

  // 設置 SSE 連接成功
  setSSEConnected(eventSource: EventSource) {
    this.sseEventSource = eventSource
    this.resetSSEReconnectAttempts()
    
    if (this.sseReconnectAttempts > 0) {
      ElMessage({
        message: '實時連接已恢復',
        type: 'success',
        duration: 2000
      })
    }
  }

  // 處理 API 請求錯誤
  handleAPIRequest(error: any, context?: Record<string, any>): Promise<any> {
    const errorDetails = this.handleError(error, context)

    // 如果是網絡錯誤且處於離線狀態
    if (errorDetails.type === ErrorType.NETWORK && !this.offlineManager.getStatus()) {
      return this.handleOfflineRequest(error, context)
    }

    // 如果是權限錯誤，嘗試刷新 token
    if (errorDetails.type === ErrorType.PERMISSION && errorDetails.code === 401) {
      return this.handleTokenRefresh(error, context)
    }

    return Promise.reject(errorDetails)
  }

  // 處理離線請求
  private handleOfflineRequest(originalError: any, context?: Record<string, any>): Promise<any> {
    ElMessage({
      message: '當前網絡不可用，請求將在網絡恢復後重新嘗試',
      type: 'warning',
      duration: 5000
    })

    return new Promise((resolve, reject) => {
      // 創建重試請求函數
      const retryRequest = async () => {
        try {
          // 這裡應該重新執行原始請求
          // 實際實現需要根據具體的 API 客戶端來決定
          console.log('Retrying request after network recovery:', context)
          // resolve(retriedResult)
          reject(new Error('Request retry not implemented'))
        } catch (error) {
          reject(error)
        }
      }

      // 添加到離線隊列
      this.offlineManager.addPendingRequest(retryRequest)
    })
  }

  // 處理 Token 刷新
  private async handleTokenRefresh(originalError: any, context?: Record<string, any>): Promise<any> {
    try {
      // 嘗試刷新 token
      const authStore = await import('@/stores/auth').then(m => m.useAuthStore())
      const success = await authStore().refreshToken()
      
      if (success) {
        ElMessage({
          message: '登入狀態已更新，請重新嘗試',
          type: 'info',
          duration: 3000
        })
        // 這裡應該重新執行原始請求
        return Promise.reject(new Error('Please retry the request'))
      } else {
        // Token 刷新失敗，跳轉到登入頁
        ElMessage({
          message: '登入已過期，請重新登入',
          type: 'error',
          duration: 5000
        })
        window.location.href = '/login'
        return Promise.reject(originalError)
      }
    } catch (error) {
      console.error('Token refresh failed:', error)
      return Promise.reject(originalError)
    }
  }
}

// 導出單例實例
export const errorHandler = ErrorHandler.getInstance()
export const kitchenErrorHandler = KitchenErrorHandler.getInstance() as KitchenErrorHandler

// 全局錯誤處理器
export function setupGlobalErrorHandler() {
  // 處理未捕獲的 Promise 錯誤
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason)
    errorHandler.handleError(event.reason, { type: 'unhandledRejection' })
    event.preventDefault() // 防止錯誤在控制台顯示
  })

  // 處理未捕獲的 JavaScript 錯誤
  window.addEventListener('error', (event) => {
    console.error('Unhandled error:', event.error)
    errorHandler.handleError(event.error, { 
      type: 'globalError',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    })
  })

  // 監聽網絡狀態變化
  errorHandler.getOfflineManager().onStatusChange((isOnline) => {
    if (isOnline) {
      ElMessage({
        message: '網絡連接已恢復',
        type: 'success',
        duration: 2000
      })
    } else {
      ElMessage({
        message: '網絡連接已斷開，將在離線模式下運行',
        type: 'warning',
        duration: 0,
        showClose: true
      })
    }
  })
}

export default ErrorHandler
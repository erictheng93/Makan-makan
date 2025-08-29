// Composable for error handling throughout the application
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useToast } from 'vue-toastification'
import { errorReportingService, type ErrorReport } from '@/services/errorReportingService'
import { performanceService } from '@/services/performanceService'

export interface ErrorHandlingOptions {
  showToast?: boolean
  reportError?: boolean
  component?: string
  retryable?: boolean
  critical?: boolean
}

export interface ErrorState {
  hasError: boolean
  error: Error | null
  errorId: string | null
  isRetrying: boolean
  retryCount: number
  maxRetries: number
}

export function useErrorHandling(options: ErrorHandlingOptions = {}) {
  const {
    showToast = true,
    reportError = true,
    component = 'unknown',
    retryable = false,
    critical = false
  } = options

  const toast = useToast()

  // Error state
  const errorState = ref<ErrorState>({
    hasError: false,
    error: null,
    errorId: null,
    isRetrying: false,
    retryCount: 0,
    maxRetries: 3
  })

  // Recent errors for debugging
  const recentErrors = ref<ErrorReport[]>([])
  
  // Error statistics
  const errorStats = computed(() => errorReportingService.getErrorStats())

  // Handle error with configurable behavior
  const handleError = (error: Error | string, context: Record<string, any> = {}) => {
    const errorObj = typeof error === 'string' ? new Error(error) : error
    
    // Update error state
    errorState.value = {
      hasError: true,
      error: errorObj,
      errorId: null,
      isRetrying: false,
      retryCount: errorState.value.retryCount,
      maxRetries: errorState.value.maxRetries
    }

    // Report error if enabled
    if (reportError) {
      const errorId = errorReportingService.reportError(errorObj, {
        component,
        ...context
      })
      errorState.value.errorId = errorId
    }

    // Show toast notification if enabled
    if (showToast && !critical) {
      const message = getErrorMessage(errorObj)
      toast.error(message)
    }

    // Log performance impact
    const startTime = performance.now()
    performanceService.recordMetric(
      'error_handling_time',
      performance.now() - startTime,
      'ms',
      'system'
    )

    // For critical errors, could trigger additional actions
    if (critical) {
      console.error(`CRITICAL ERROR in ${component}:`, errorObj)
    }
  }

  // Async error handler with proper error boundaries
  const handleAsyncError = async <T>(
    asyncFn: () => Promise<T>,
    context: Record<string, any> = {}
  ): Promise<T | null> => {
    try {
      const startTime = performance.now()
      const result = await asyncFn()
      
      // Record successful async operation
      performanceService.recordMetric(
        'async_operation_time',
        performance.now() - startTime,
        'ms',
        'system'
      )
      
      return result
    } catch (error) {
      handleError(error as Error, {
        operation: 'async',
        ...context
      })
      return null
    }
  }

  // Retry mechanism for failed operations
  const retryOperation = async <T>(
    operation: () => Promise<T>,
    context: Record<string, any> = {}
  ): Promise<T | null> => {
    if (!retryable) {
      throw new Error('Operation is not retryable')
    }

    errorState.value.isRetrying = true
    
    try {
      const result = await operation()
      
      // Reset error state on success
      clearError()
      toast.success('操作重試成功')
      
      return result
    } catch (error) {
      errorState.value.retryCount++
      
      if (errorState.value.retryCount >= errorState.value.maxRetries) {
        toast.error('重試次數已達上限')
        handleError(error as Error, {
          retryAttempt: errorState.value.retryCount,
          ...context
        })
      } else {
        toast.warning(`操作失敗，正在重試 (${errorState.value.retryCount}/${errorState.value.maxRetries})`)
        
        // Exponential backoff
        const delay = Math.pow(2, errorState.value.retryCount) * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
        
        return retryOperation(operation, context)
      }
      
      return null
    } finally {
      errorState.value.isRetrying = false
    }
  }

  // Clear error state
  const clearError = () => {
    errorState.value = {
      hasError: false,
      error: null,
      errorId: null,
      isRetrying: false,
      retryCount: 0,
      maxRetries: 3
    }
  }

  // Resolve error in reporting service
  const resolveError = () => {
    if (errorState.value.errorId) {
      errorReportingService.resolveError(errorState.value.errorId)
    }
    clearError()
  }

  // Get user-friendly error message
  const getErrorMessage = (error: Error): string => {
    const errorMessages: Record<string, string> = {
      'NetworkError': '網路連線錯誤，請檢查網路狀態',
      'TimeoutError': '操作超時，請重試',
      'ValidationError': '數據驗證失敗，請檢查輸入',
      'AuthenticationError': '認證失敗，請重新登入',
      'PermissionError': '權限不足，請聯繫管理員',
      'NotFoundError': '找不到指定的資源',
      'ServerError': '服務器錯誤，請稍後重試',
      'ChunkLoadError': '資源載入失敗，請重新載入頁面',
      'QuotaExceededError': '存儲空間不足，請清理數據'
    }

    return errorMessages[error.name] || error.message || '發生未知錯誤'
  }

  // Error boundary for components
  const withErrorBoundary = <T extends (...args: any[]) => any>(fn: T): T => {
    return ((...args: Parameters<T>) => {
      try {
        const result = fn(...args)
        
        // Handle promise-returning functions
        if (result instanceof Promise) {
          return result.catch((error: Error) => {
            handleError(error, { function: fn.name })
            throw error
          })
        }
        
        return result
      } catch (error) {
        handleError(error as Error, { function: fn.name })
        throw error
      }
    }) as T
  }

  // Network error handler
  const handleNetworkError = (error: Error) => {
    if (error.message.includes('fetch') || error.name === 'NetworkError') {
      handleError(error, {
        type: 'network',
        online: navigator.onLine
      })
    } else {
      handleError(error)
    }
  }

  // API error handler with status code handling
  const handleApiError = (error: any, endpoint?: string) => {
    let message = '網路請求失敗'
    
    if (error.response) {
      const status = error.response.status
      switch (status) {
        case 400:
          message = '請求參數錯誤'
          break
        case 401:
          message = '未授權，請重新登入'
          break
        case 403:
          message = '權限不足'
          break
        case 404:
          message = '找不到請求的資源'
          break
        case 500:
          message = '服務器內部錯誤'
          break
        case 502:
        case 503:
        case 504:
          message = '服務暫時不可用'
          break
        default:
          message = `HTTP ${status} 錯誤`
      }
    }

    handleError(new Error(message), {
      type: 'api',
      endpoint,
      status: error.response?.status,
      statusText: error.response?.statusText
    })
  }

  // Validation error helper
  const handleValidationError = (field: string, message: string) => {
    const error = new Error(message)
    error.name = 'ValidationError'
    
    handleError(error, {
      type: 'validation',
      field
    })
  }

  // Performance monitoring for error impact
  const monitorErrorImpact = () => {
    const metrics = errorStats.value
    
    if (metrics.errorRate > 5) { // More than 5 errors per hour
      console.warn('High error rate detected:', metrics.errorRate)
      
      // Could trigger additional monitoring or alerts
      performanceService.recordMetric(
        'high_error_rate_alert',
        metrics.errorRate,
        'count',
        'system',
        'warning'
      )
    }
  }

  // Update recent errors list
  const updateRecentErrors = () => {
    recentErrors.value = errorStats.value.recentErrors
  }

  // Setup monitoring
  onMounted(() => {
    updateRecentErrors()
    
    // Monitor error impact periodically
    const monitoringInterval = setInterval(monitorErrorImpact, 60000) // Every minute
    
    onUnmounted(() => {
      clearInterval(monitoringInterval)
    })
  })

  return {
    // State
    errorState: computed(() => errorState.value),
    recentErrors: computed(() => recentErrors.value),
    errorStats,
    
    // Methods
    handleError,
    handleAsyncError,
    handleNetworkError,
    handleApiError,
    handleValidationError,
    retryOperation,
    clearError,
    resolveError,
    withErrorBoundary,
    
    // Utilities
    getErrorMessage,
    monitorErrorImpact
  }
}

// Global error handler hook for the entire application
export function useGlobalErrorHandler() {
  const errorHandler = useErrorHandling({
    component: 'global',
    reportError: true,
    showToast: false, // Global handler doesn't show toasts directly
    critical: true
  })

  const setupGlobalHandlers = () => {
    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      errorHandler.handleError(
        new Error(event.reason || 'Unhandled promise rejection'),
        {
          type: 'unhandledPromise',
          reason: event.reason
        }
      )
    })

    // General JavaScript errors
    window.addEventListener('error', (event) => {
      errorHandler.handleError(event.error || new Error(event.message), {
        type: 'globalError',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      })
    })

    // Resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target && event.target !== window) {
        const target = event.target as HTMLElement
        errorHandler.handleError(
          new Error(`Failed to load resource: ${target.tagName}`),
          {
            type: 'resourceError',
            tagName: target.tagName,
            src: (target as any).src || (target as any).href
          }
        )
      }
    }, true)
  }

  return {
    setupGlobalHandlers,
    ...errorHandler
  }
}
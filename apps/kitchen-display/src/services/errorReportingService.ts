// Comprehensive error reporting and handling service
import { ref, computed } from 'vue'
import { performanceService } from './performanceService'

export interface ErrorReport {
  id: string
  timestamp: string
  error: {
    name: string
    message: string
    stack?: string
  }
  context: {
    component?: string
    action?: string
    user?: string
    url: string
    userAgent: string
  }
  systemInfo: {
    appVersion: string
    networkStatus: string
    memoryUsage?: number
    storageAvailable: boolean
  }
  severity: 'low' | 'medium' | 'high' | 'critical'
  resolved: boolean
  tags: string[]
}

export interface ErrorStats {
  totalErrors: number
  errorsByType: Record<string, number>
  errorsBySeverity: Record<string, number>
  recentErrors: ErrorReport[]
  errorRate: number
}

class ErrorReportingService {
  private readonly MAX_STORED_ERRORS = 100
  private readonly ERROR_REPORT_ENDPOINT = '/api/errors'
  
  // Reactive state
  public errorReports = ref<ErrorReport[]>([])
  public isEnabled = ref(true)
  public reportingMode = ref<'immediate' | 'batch' | 'offline'>('batch')
  
  // Error categories and handling rules
  private errorCategories: Record<string, { severity: ErrorReport['severity']; tags: string[] }> = {
    'ChunkLoadError': { severity: 'high', tags: ['deployment', 'build'] },
    'TypeError': { severity: 'medium', tags: ['code', 'runtime'] },
    'ReferenceError': { severity: 'high', tags: ['code', 'runtime'] },
    'NetworkError': { severity: 'medium', tags: ['network', 'api'] },
    'QuotaExceededError': { severity: 'low', tags: ['storage', 'limit'] },
    'SecurityError': { severity: 'critical', tags: ['security', 'permissions'] },
    'SyntaxError': { severity: 'high', tags: ['code', 'syntax'] },
    'TimeoutError': { severity: 'medium', tags: ['performance', 'network'] }
  }

  // Batch processing
  private batchQueue: ErrorReport[] = []
  private batchTimer: NodeJS.Timeout | null = null
  private readonly BATCH_SIZE = 10
  private readonly BATCH_INTERVAL = 30000 // 30 seconds

  constructor() {
    this.loadStoredErrors()
    this.setupBatchProcessing()
    this.setupGlobalHandlers()
  }

  // Public methods
  public reportError(error: Error | string, context: Partial<ErrorReport['context']> = {}): string {
    const errorObj = typeof error === 'string' ? new Error(error) : error
    
    const report: ErrorReport = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      error: {
        name: errorObj.name,
        message: errorObj.message,
        stack: errorObj.stack
      },
      context: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        ...context
      },
      systemInfo: this.collectSystemInfo(),
      severity: this.determineSeverity(errorObj),
      resolved: false,
      tags: this.generateTags(errorObj)
    }

    this.processError(report)
    
    // Record performance impact
    performanceService.recordMetric('error_occurrence', 1, 'count', 'system')
    
    return report.id
  }

  public async submitErrorReport(customReport: any): Promise<boolean> {
    try {
      const response = await fetch(this.ERROR_REPORT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customReport)
      })

      return response.ok
    } catch (error) {
      console.error('Failed to submit error report:', error)
      return false
    }
  }

  public getErrorStats(): ErrorStats {
    const reports = this.errorReports.value
    const now = Date.now()
    const oneHourAgo = now - 60 * 60 * 1000

    const recentErrors = reports.filter(r => 
      new Date(r.timestamp).getTime() > oneHourAgo
    )

    const errorsByType = reports.reduce((acc, report) => {
      acc[report.error.name] = (acc[report.error.name] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const errorsBySeverity = reports.reduce((acc, report) => {
      acc[report.severity] = (acc[report.severity] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      totalErrors: reports.length,
      errorsByType,
      errorsBySeverity,
      recentErrors: recentErrors.slice(-10),
      errorRate: recentErrors.length // errors per hour
    }
  }

  public resolveError(errorId: string): void {
    const error = this.errorReports.value.find(e => e.id === errorId)
    if (error) {
      error.resolved = true
      this.saveErrors()
    }
  }

  public clearErrors(): void {
    this.errorReports.value = []
    this.saveErrors()
  }

  public exportErrors(): string {
    return JSON.stringify(this.errorReports.value, null, 2)
  }

  public async importErrors(data: string): Promise<boolean> {
    try {
      const imported = JSON.parse(data) as ErrorReport[]
      
      // Validate imported data
      if (!Array.isArray(imported)) {
        throw new Error('Invalid data format')
      }

      this.errorReports.value = imported
      this.saveErrors()
      return true
    } catch (error) {
      console.error('Failed to import errors:', error)
      return false
    }
  }

  // Error analysis and insights
  public getErrorInsights(): {
    topErrorTypes: Array<{ type: string; count: number; percentage: number }>
    errorTrends: Array<{ date: string; count: number }>
    criticalErrors: ErrorReport[]
    recommendations: string[]
  } {
    const stats = this.getErrorStats()
    const total = stats.totalErrors

    // Top error types
    const topErrorTypes = Object.entries(stats.errorsByType)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({
        type,
        count,
        percentage: Math.round((count / total) * 100)
      }))

    // Error trends (last 7 days)
    const errorTrends = this.calculateErrorTrends()

    // Critical errors
    const criticalErrors = this.errorReports.value
      .filter(e => e.severity === 'critical' && !e.resolved)
      .slice(-5)

    // Recommendations
    const recommendations = this.generateRecommendations(stats)

    return {
      topErrorTypes,
      errorTrends,
      criticalErrors,
      recommendations
    }
  }

  // Private methods
  private processError(report: ErrorReport): void {
    this.errorReports.value.unshift(report)
    
    // Limit stored errors
    if (this.errorReports.value.length > this.MAX_STORED_ERRORS) {
      this.errorReports.value = this.errorReports.value.slice(0, this.MAX_STORED_ERRORS)
    }

    // Handle based on reporting mode
    switch (this.reportingMode.value) {
      case 'immediate':
        this.sendErrorReport(report)
        break
      case 'batch':
        this.addToBatch(report)
        break
      case 'offline':
        // Store for later when online
        break
    }

    this.saveErrors()
    this.handleCriticalError(report)
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private determineSeverity(error: Error): ErrorReport['severity'] {
    const category = this.errorCategories[error.name]
    if (category) {
      return category.severity
    }

    // Default severity based on error patterns
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return 'medium'
    }
    
    if (error.message.includes('permission') || error.message.includes('unauthorized')) {
      return 'critical'
    }

    return 'low'
  }

  private generateTags(error: Error): string[] {
    const category = this.errorCategories[error.name]
    const tags = category ? [...category.tags] : ['general']

    // Add contextual tags based on error message
    if (error.message.includes('order')) tags.push('order-management')
    if (error.message.includes('audio')) tags.push('audio-system')
    if (error.message.includes('offline')) tags.push('offline-mode')
    if (error.stack?.includes('vue-router')) tags.push('routing')
    if (error.stack?.includes('pinia')) tags.push('state-management')

    return [...new Set(tags)] // Remove duplicates
  }

  private collectSystemInfo(): ErrorReport['systemInfo'] {
    return {
      appVersion: __APP_VERSION__ || '1.0.0',
      networkStatus: navigator.onLine ? 'online' : 'offline',
      memoryUsage: (performance as any).memory?.usedJSHeapSize,
      storageAvailable: this.checkStorageAvailability()
    }
  }

  private checkStorageAvailability(): boolean {
    try {
      localStorage.setItem('__test__', 'test')
      localStorage.removeItem('__test__')
      return true
    } catch {
      return false
    }
  }

  private setupBatchProcessing(): void {
    this.batchTimer = setInterval(() => {
      if (this.batchQueue.length > 0) {
        this.processBatch()
      }
    }, this.BATCH_INTERVAL)
  }

  private addToBatch(report: ErrorReport): void {
    this.batchQueue.push(report)
    
    if (this.batchQueue.length >= this.BATCH_SIZE) {
      this.processBatch()
    }
  }

  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return

    const batch = [...this.batchQueue]
    this.batchQueue = []

    try {
      await this.sendBatchReports(batch)
    } catch (error) {
      console.error('Failed to send batch reports:', error)
      // Add back to queue for retry
      this.batchQueue.unshift(...batch)
    }
  }

  private async sendErrorReport(report: ErrorReport): Promise<void> {
    try {
      const response = await fetch(this.ERROR_REPORT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(report)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (error) {
      console.error('Failed to send error report:', error)
    }
  }

  private async sendBatchReports(reports: ErrorReport[]): Promise<void> {
    try {
      const response = await fetch(`${this.ERROR_REPORT_ENDPOINT}/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ errors: reports })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (error) {
      console.error('Failed to send batch reports:', error)
      throw error
    }
  }

  private handleCriticalError(report: ErrorReport): void {
    if (report.severity === 'critical') {
      // Immediate notification for critical errors
      this.sendErrorReport(report)
      
      // Could also trigger alerts, notifications, etc.
      console.error('CRITICAL ERROR DETECTED:', report)
    }
  }

  private calculateErrorTrends(): Array<{ date: string; count: number }> {
    const trends: Record<string, number> = {}
    const now = new Date()
    
    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const dateStr = date.toISOString().split('T')[0]
      trends[dateStr] = 0
    }

    // Count errors by date
    this.errorReports.value.forEach(report => {
      const date = report.timestamp.split('T')[0]
      if (trends[date] !== undefined) {
        trends[date]++
      }
    })

    return Object.entries(trends).map(([date, count]) => ({ date, count }))
  }

  private generateRecommendations(stats: ErrorStats): string[] {
    const recommendations: string[] = []

    // Network-related recommendations
    if (stats.errorsByType['NetworkError'] > 0) {
      recommendations.push('檢查網路連線穩定性，考慮增加重試機制')
    }

    // Performance recommendations
    if (stats.errorsByType['TimeoutError'] > 0) {
      recommendations.push('優化API響應時間，增加請求超時時間')
    }

    // Code quality recommendations
    if (stats.errorsByType['TypeError'] > 0) {
      recommendations.push('加強類型檢查和數據驗證')
    }

    // Build/deployment recommendations
    if (stats.errorsByType['ChunkLoadError'] > 0) {
      recommendations.push('檢查部署配置和緩存策略')
    }

    // Storage recommendations
    if (stats.errorsByType['QuotaExceededError'] > 0) {
      recommendations.push('實施數據清理機制，優化存儲使用')
    }

    // General recommendations
    if (stats.errorRate > 10) {
      recommendations.push('錯誤率偏高，建議進行全面系統檢查')
    }

    if (recommendations.length === 0) {
      recommendations.push('系統運行良好，持續監控即可')
    }

    return recommendations
  }

  private setupGlobalHandlers(): void {
    // Handle console errors for development
    if (import.meta.env.DEV) {
      const originalError = console.error
      console.error = (...args: any[]) => {
        if (args[0] instanceof Error) {
          this.reportError(args[0], { component: 'console' })
        }
        originalError.apply(console, args)
      }
    }
  }

  private loadStoredErrors(): void {
    try {
      const stored = localStorage.getItem('kitchen-error-reports')
      if (stored) {
        const errors = JSON.parse(stored) as ErrorReport[]
        this.errorReports.value = errors.slice(0, this.MAX_STORED_ERRORS)
      }
    } catch (error) {
      console.error('Failed to load stored errors:', error)
    }
  }

  private saveErrors(): void {
    try {
      localStorage.setItem('kitchen-error-reports', JSON.stringify(this.errorReports.value))
    } catch (error) {
      console.error('Failed to save errors:', error)
    }
  }

  public cleanup(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer)
      this.batchTimer = null
    }
    
    // Process remaining batch
    if (this.batchQueue.length > 0) {
      this.processBatch()
    }
  }
}

// Create and export singleton instance
export const errorReportingService = new ErrorReportingService()
export default errorReportingService
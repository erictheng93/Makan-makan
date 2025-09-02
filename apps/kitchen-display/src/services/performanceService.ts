import { ref } from 'vue'

// Performance metric types
export interface PerformanceMetric {
  name: string
  value: number
  unit: string
  timestamp: number
  category: 'system' | 'network' | 'user' | 'business'
  severity: 'info' | 'warning' | 'error'
}

export interface PerformanceAlert {
  id: string
  type: 'performance' | 'error' | 'threshold'
  title: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp: number
  resolved: boolean
  metric?: string
  value?: number
  threshold?: number
}

export interface PerformanceConfig {
  enabled: boolean
  collectInterval: number
  maxMetrics: number
  thresholds: {
    [key: string]: {
      warning: number
      critical: number
    }
  }
  alerts: {
    enabled: boolean
    maxAlerts: number
    autoResolve: boolean
    autoResolveTime: number
  }
}

export interface SystemInfo {
  userAgent: string
  platform: string
  language: string
  cookieEnabled: boolean
  onLine: boolean
  hardwareConcurrency: number
  memory?: {
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  }
  connection?: {
    effectiveType: string
    downlink: number
    rtt: number
  }
}

class PerformanceService {
  private readonly STORAGE_KEY = 'kitchen-performance-data'
  private readonly MAX_METRICS = 1000
  private readonly COLLECT_INTERVAL = 5000 // 5 seconds

  // Reactive state
  public metrics = ref<PerformanceMetric[]>([])
  public alerts = ref<PerformanceAlert[]>([])
  public config = ref<PerformanceConfig>(this.getDefaultConfig())
  public isCollecting = ref(false)
  public systemInfo = ref<SystemInfo>(this.collectSystemInfo())

  private collectInterval: NodeJS.Timeout | null = null
  private observer: PerformanceObserver | null = null
  private startTime = Date.now()

  constructor() {
    this.loadStoredData()
    this.initializeCollection()
  }

  private getDefaultConfig(): PerformanceConfig {
    return {
      enabled: true,
      collectInterval: this.COLLECT_INTERVAL,
      maxMetrics: this.MAX_METRICS,
      thresholds: {
        'page-load-time': { warning: 3000, critical: 5000 },
        'api-response-time': { warning: 1000, critical: 3000 },
        'memory-usage': { warning: 50, critical: 80 },
        'render-time': { warning: 16, critical: 33 }, // 60fps = 16.67ms, 30fps = 33ms
        'sse-connection-time': { warning: 5000, critical: 10000 },
        'error-rate': { warning: 0.05, critical: 0.1 }
      },
      alerts: {
        enabled: true,
        maxAlerts: 100,
        autoResolve: true,
        autoResolveTime: 300000 // 5 minutes
      }
    }
  }

  private collectSystemInfo(): SystemInfo {
    const nav = navigator as any
    
    return {
      userAgent: nav.userAgent,
      platform: nav.platform,
      language: nav.language,
      cookieEnabled: nav.cookieEnabled,
      onLine: nav.onLine,
      hardwareConcurrency: nav.hardwareConcurrency || 1,
      memory: nav.memory ? {
        usedJSHeapSize: nav.memory.usedJSHeapSize,
        totalJSHeapSize: nav.memory.totalJSHeapSize,
        jsHeapSizeLimit: nav.memory.jsHeapSizeLimit
      } : undefined,
      connection: nav.connection ? {
        effectiveType: nav.connection.effectiveType,
        downlink: nav.connection.downlink,
        rtt: nav.connection.rtt
      } : undefined
    }
  }

  // Metric collection
  private initializeCollection() {
    if (!this.config.value.enabled) return

    // Set up automatic collection
    this.startCollection()

    // Set up performance observer for navigation and resource timing
    if ('PerformanceObserver' in window) {
      try {
        this.observer = new PerformanceObserver((list) => {
          this.processPerformanceEntries(list.getEntries())
        })

        this.observer.observe({ entryTypes: ['navigation', 'resource', 'measure', 'paint'] })
      } catch (error) {
        console.warn('Failed to initialize PerformanceObserver:', error)
      }
    }

    // Listen for visibility changes to pause/resume collection
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this))

    // Listen for page lifecycle events
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this))
  }

  private processPerformanceEntries(entries: PerformanceEntry[]) {
    entries.forEach(entry => {
      if (entry.entryType === 'navigation') {
        this.collectNavigationMetrics(entry as PerformanceNavigationTiming)
      } else if (entry.entryType === 'resource') {
        this.collectResourceMetrics(entry as PerformanceResourceTiming)
      } else if (entry.entryType === 'measure') {
        this.collectMeasureMetrics(entry as PerformanceMeasure)
      } else if (entry.entryType === 'paint') {
        this.collectPaintMetrics(entry as PerformancePaintTiming)
      }
    })
  }

  private collectNavigationMetrics(entry: PerformanceNavigationTiming) {
    this.recordMetric('page-load-time', entry.loadEventEnd - entry.startTime, 'ms', 'system')
    this.recordMetric('dom-content-loaded', entry.domContentLoadedEventEnd - entry.startTime, 'ms', 'system')
    this.recordMetric('first-byte', entry.responseStart - entry.startTime, 'ms', 'network')
  }

  private collectResourceMetrics(entry: PerformanceResourceTiming) {
    if (entry.name.includes('/api/')) {
      const responseTime = entry.responseEnd - entry.requestStart
      this.recordMetric('api-response-time', responseTime, 'ms', 'network')
    }
  }

  private collectMeasureMetrics(entry: PerformanceMeasure) {
    this.recordMetric(entry.name, entry.duration, 'ms', 'user')
  }

  private collectPaintMetrics(entry: PerformancePaintTiming) {
    if (entry.name === 'first-contentful-paint') {
      this.recordMetric('first-contentful-paint', entry.startTime, 'ms', 'system')
    }
  }

  public startCollection() {
    if (this.collectInterval) return

    this.isCollecting.value = true
    this.collectInterval = setInterval(() => {
      this.collectSystemMetrics()
      this.checkThresholds()
      this.cleanupOldData()
    }, this.config.value.collectInterval)
  }

  public stopCollection() {
    if (this.collectInterval) {
      clearInterval(this.collectInterval)
      this.collectInterval = null
    }
    this.isCollecting.value = false
  }

  private collectSystemMetrics() {
    // Memory usage
    const nav = navigator as any
    if (nav.memory) {
      const memoryUsage = (nav.memory.usedJSHeapSize / nav.memory.jsHeapSizeLimit) * 100
      this.recordMetric('memory-usage', memoryUsage, '%', 'system')
    }

    // Connection info
    if (nav.connection) {
      this.recordMetric('connection-rtt', nav.connection.rtt, 'ms', 'network')
      this.recordMetric('connection-downlink', nav.connection.downlink, 'Mbps', 'network')
    }

    // Frame rate (approximate)
    this.measureFrameRate()

    // Update system info
    this.systemInfo.value = this.collectSystemInfo()
  }

  private measureFrameRate() {
    const lastTime = performance.now()
    let frameCount = 0
    const targetFrames = 10

    const countFrame = (currentTime: number) => {
      frameCount++
      
      if (frameCount >= targetFrames) {
        const totalTime = currentTime - lastTime
        const fps = (frameCount / totalTime) * 1000
        this.recordMetric('frame-rate', fps, 'fps', 'system')
      } else {
        requestAnimationFrame(countFrame)
      }
    }

    requestAnimationFrame(countFrame)
  }

  // Custom metrics
  public recordMetric(
    name: string,
    value: number,
    unit: string,
    category: PerformanceMetric['category'],
    severity: PerformanceMetric['severity'] = 'info'
  ) {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      category,
      severity
    }

    this.metrics.value.push(metric)

    // Keep only recent metrics
    if (this.metrics.value.length > this.config.value.maxMetrics) {
      this.metrics.value = this.metrics.value.slice(-this.config.value.maxMetrics)
    }

    this.saveStoredData()
  }

  // Custom measurements
  public startMeasure(name: string) {
    performance.mark(`${name}-start`)
  }

  public endMeasure(name: string, _category: PerformanceMetric['category'] = 'user') {
    const endMark = `${name}-end`
    performance.mark(endMark)
    performance.measure(name, `${name}-start`, endMark)
    
    // The measure will be automatically captured by the observer
  }

  public measureAsyncOperation<T>(
    name: string,
    operation: () => Promise<T>,
    category: PerformanceMetric['category'] = 'user'
  ): Promise<T> {
    this.startMeasure(name)
    const startTime = performance.now()
    
    return operation().then(
      result => {
        const duration = performance.now() - startTime
        this.recordMetric(name, duration, 'ms', category)
        this.endMeasure(name, category)
        return result
      },
      error => {
        const duration = performance.now() - startTime
        this.recordMetric(name, duration, 'ms', category, 'error')
        this.recordMetric(`${name}-error`, 1, 'count', category, 'error')
        this.endMeasure(name, category)
        throw error
      }
    )
  }

  // Threshold monitoring
  private checkThresholds() {
    Object.entries(this.config.value.thresholds).forEach(([metricName, thresholds]) => {
      const recentMetrics = this.metrics.value
        .filter(m => m.name === metricName)
        .slice(-10) // Check last 10 measurements

      if (recentMetrics.length === 0) return

      const latestValue = recentMetrics[recentMetrics.length - 1].value

      if (latestValue >= thresholds.critical) {
        this.createAlert(
          'threshold',
          `${metricName} 超過臨界值`,
          `當前值: ${latestValue.toFixed(2)}, 臨界值: ${thresholds.critical}`,
          'critical',
          metricName,
          latestValue,
          thresholds.critical
        )
      } else if (latestValue >= thresholds.warning) {
        this.createAlert(
          'threshold',
          `${metricName} 超過警告值`,
          `當前值: ${latestValue.toFixed(2)}, 警告值: ${thresholds.warning}`,
          'medium',
          metricName,
          latestValue,
          thresholds.warning
        )
      }
    })
  }

  // Alert management
  private createAlert(
    type: PerformanceAlert['type'],
    title: string,
    message: string,
    severity: PerformanceAlert['severity'],
    metric?: string,
    value?: number,
    threshold?: number
  ) {
    // Check if similar alert already exists
    const existingAlert = this.alerts.value.find(a => 
      a.type === type && a.metric === metric && !a.resolved
    )

    if (existingAlert) return // Don't create duplicate alerts

    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      message,
      severity,
      timestamp: Date.now(),
      resolved: false,
      metric,
      value,
      threshold
    }

    this.alerts.value.push(alert)

    // Keep only recent alerts
    if (this.alerts.value.length > this.config.value.alerts.maxAlerts) {
      this.alerts.value = this.alerts.value.slice(-this.config.value.alerts.maxAlerts)
    }

    // Auto-resolve if enabled
    if (this.config.value.alerts.autoResolve) {
      setTimeout(() => {
        this.resolveAlert(alert.id)
      }, this.config.value.alerts.autoResolveTime)
    }

    this.saveStoredData()
  }

  public resolveAlert(alertId: string) {
    const alert = this.alerts.value.find(a => a.id === alertId)
    if (alert) {
      alert.resolved = true
      this.saveStoredData()
    }
  }

  public clearAlerts() {
    this.alerts.value = []
    this.saveStoredData()
  }

  // Analytics and insights
  public getMetricSummary(metricName: string, timeWindow = 3600000): {
    count: number
    min: number
    max: number
    avg: number
    p95: number
    p99: number
  } {
    const cutoff = Date.now() - timeWindow
    const recentMetrics = this.metrics.value
      .filter(m => m.name === metricName && m.timestamp >= cutoff)
      .map(m => m.value)
      .sort((a, b) => a - b)

    if (recentMetrics.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, p95: 0, p99: 0 }
    }

    const count = recentMetrics.length
    const min = recentMetrics[0]
    const max = recentMetrics[count - 1]
    const avg = recentMetrics.reduce((sum, v) => sum + v, 0) / count
    const p95 = recentMetrics[Math.floor(count * 0.95)] || max
    const p99 = recentMetrics[Math.floor(count * 0.99)] || max

    return { count, min, max, avg, p95, p99 }
  }

  public getMetricTrend(metricName: string, buckets = 12): Array<{
    timestamp: number
    value: number
    count: number
  }> {
    const timeWindow = 3600000 // 1 hour
    const bucketSize = timeWindow / buckets
    const cutoff = Date.now() - timeWindow
    
    const relevantMetrics = this.metrics.value.filter(m => 
      m.name === metricName && m.timestamp >= cutoff
    )

    const bucketData = Array(buckets).fill(null).map((_, i) => ({
      timestamp: cutoff + (i * bucketSize),
      values: [] as number[],
      count: 0
    }))

    relevantMetrics.forEach(metric => {
      const bucketIndex = Math.min(
        Math.floor((metric.timestamp - cutoff) / bucketSize),
        buckets - 1
      )
      bucketData[bucketIndex].values.push(metric.value)
      bucketData[bucketIndex].count++
    })

    return bucketData.map(bucket => ({
      timestamp: bucket.timestamp,
      value: bucket.values.length > 0 
        ? bucket.values.reduce((sum, v) => sum + v, 0) / bucket.values.length 
        : 0,
      count: bucket.count
    }))
  }

  public getErrorRate(timeWindow = 3600000): number {
    const cutoff = Date.now() - timeWindow
    const recentMetrics = this.metrics.value.filter(m => m.timestamp >= cutoff)
    const errorMetrics = recentMetrics.filter(m => m.severity === 'error')
    
    return recentMetrics.length > 0 ? errorMetrics.length / recentMetrics.length : 0
  }

  // Report generation
  public generateReport(): {
    summary: any
    metrics: any
    alerts: any
    system: SystemInfo
    recommendations: string[]
  } {
    const summary = {
      totalMetrics: this.metrics.value.length,
      activeAlerts: this.alerts.value.filter(a => !a.resolved).length,
      uptime: Date.now() - this.startTime,
      errorRate: this.getErrorRate(),
      collectionEnabled: this.config.value.enabled,
      lastCollection: this.metrics.value.length > 0 
        ? this.metrics.value[this.metrics.value.length - 1].timestamp 
        : null
    }

    const keyMetrics = [
      'page-load-time',
      'api-response-time',
      'memory-usage',
      'frame-rate'
    ].reduce((acc, metricName) => {
      acc[metricName] = this.getMetricSummary(metricName)
      return acc
    }, {} as any)

    const recommendations: string[] = []

    // Generate recommendations based on metrics
    if (keyMetrics['memory-usage']?.avg > 60) {
      recommendations.push('記憶體使用率偏高，建議檢查內存洩漏')
    }
    
    if (keyMetrics['api-response-time']?.avg > 1000) {
      recommendations.push('API 響應時間較慢，建議優化網路連線或伺服器性能')
    }
    
    if (keyMetrics['frame-rate']?.avg < 50) {
      recommendations.push('畫面更新率較低，建議優化渲染性能')
    }

    return {
      summary,
      metrics: keyMetrics,
      alerts: {
        total: this.alerts.value.length,
        active: this.alerts.value.filter(a => !a.resolved).length,
        byType: this.alerts.value.reduce((acc, alert) => {
          acc[alert.type] = (acc[alert.type] || 0) + 1
          return acc
        }, {} as Record<string, number>)
      },
      system: this.systemInfo.value,
      recommendations
    }
  }

  // Event handlers
  private handleVisibilityChange() {
    if (document.hidden) {
      this.stopCollection()
    } else {
      this.startCollection()
    }
  }

  private handleBeforeUnload() {
    this.saveStoredData()
    this.recordMetric('session-duration', Date.now() - this.startTime, 'ms', 'business')
  }

  // Storage
  private saveStoredData() {
    try {
      const data = {
        metrics: this.metrics.value.slice(-500), // Keep last 500 metrics
        alerts: this.alerts.value.slice(-50), // Keep last 50 alerts
        config: this.config.value,
        systemInfo: this.systemInfo.value,
        savedAt: Date.now()
      }
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.warn('Failed to save performance data:', error)
    }
  }

  private loadStoredData() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY)
      if (data) {
        const parsed = JSON.parse(data)
        
        if (parsed.metrics) this.metrics.value = parsed.metrics
        if (parsed.alerts) this.alerts.value = parsed.alerts
        if (parsed.config) this.config.value = { ...this.config.value, ...parsed.config }
        if (parsed.systemInfo) this.systemInfo.value = parsed.systemInfo
      }
    } catch (error) {
      console.warn('Failed to load performance data:', error)
    }
  }

  private cleanupOldData() {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000 // 24 hours
    
    this.metrics.value = this.metrics.value.filter(m => m.timestamp >= cutoff)
    this.alerts.value = this.alerts.value.filter(a => a.timestamp >= cutoff)
  }

  // Configuration
  public updateConfig(newConfig: Partial<PerformanceConfig>) {
    this.config.value = { ...this.config.value, ...newConfig }
    this.saveStoredData()

    // Restart collection with new settings
    if (this.config.value.enabled && !this.isCollecting.value) {
      this.startCollection()
    } else if (!this.config.value.enabled && this.isCollecting.value) {
      this.stopCollection()
    }
  }

  // Cleanup
  public destroy() {
    this.stopCollection()
    
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }

    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    window.removeEventListener('beforeunload', this.handleBeforeUnload)
  }
}

// Create and export singleton instance
export const performanceService = new PerformanceService()
export default performanceService
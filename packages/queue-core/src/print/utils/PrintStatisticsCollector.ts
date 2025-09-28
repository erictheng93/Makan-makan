/**
 * Print Statistics Collector
 * Collects and manages printing statistics
 */

export interface PrintStatistics {
  totalJobs: number
  successfulJobs: number
  failedJobs: number
  averagePrintTime: number
  totalPaperUsed: number
  errorRate: number
}

export interface PrintMetric {
  timestamp: Date
  deviceId: string
  jobId: string
  duration: number
  status: 'success' | 'failed'
  paperUsed?: number
}

export class PrintStatisticsCollector {
  private metrics: PrintMetric[] = []
  private statistics = new Map<string, PrintStatistics>()

  /**
   * Record a print job metric
   */
  recordMetric(metric: PrintMetric): void {
    this.metrics.push(metric)
    this.updateStatistics(metric.deviceId)
  }

  /**
   * Record job started event
   */
  recordJobStarted(data: { deviceId: string; jobId: string }): void {
    this.recordMetric({
      timestamp: new Date(),
      deviceId: data.deviceId,
      jobId: data.jobId,
      duration: 0,
      status: 'success'
    })
  }

  /**
   * Record job completed event
   */
  recordJobCompleted(data: { deviceId: string; jobId: string; duration: number }): void {
    this.recordMetric({
      timestamp: new Date(),
      deviceId: data.deviceId,
      jobId: data.jobId,
      duration: data.duration,
      status: 'success'
    })
  }

  /**
   * Record job failed event
   */
  recordJobFailed(data: { deviceId: string; jobId: string; duration: number; error?: string }): void {
    this.recordMetric({
      timestamp: new Date(),
      deviceId: data.deviceId,
      jobId: data.jobId,
      duration: data.duration,
      status: 'failed'
    })
  }

  /**
   * Record job retried event
   */
  recordJobRetried(data: { deviceId: string; jobId: string }): void {
    this.recordMetric({
      timestamp: new Date(),
      deviceId: data.deviceId,
      jobId: data.jobId,
      duration: 0,
      status: 'failed'
    })
  }

  /**
   * Get statistics for a specific device
   */
  getStatistics(deviceId: string): PrintStatistics {
    return this.statistics.get(deviceId) || this.getEmptyStatistics()
  }

  /**
   * Get overall statistics
   */
  getOverallStatistics(): PrintStatistics {
    const deviceStats = Array.from(this.statistics.values())
    if (deviceStats.length === 0) return this.getEmptyStatistics()

    return deviceStats.reduce((overall, deviceStat) => ({
      totalJobs: overall.totalJobs + deviceStat.totalJobs,
      successfulJobs: overall.successfulJobs + deviceStat.successfulJobs,
      failedJobs: overall.failedJobs + deviceStat.failedJobs,
      averagePrintTime: (overall.averagePrintTime + deviceStat.averagePrintTime) / 2,
      totalPaperUsed: overall.totalPaperUsed + deviceStat.totalPaperUsed,
      errorRate: (overall.errorRate + deviceStat.errorRate) / 2
    }))
  }

  /**
   * Record job created event
   */
  recordJobCreated(data: { deviceId: string; jobId: string }): void {
    this.recordMetric({
      timestamp: new Date(),
      deviceId: data.deviceId,
      jobId: data.jobId,
      duration: 0,
      status: 'success'
    })
  }

  /**
   * Initialize the statistics collector
   */
  async initialize(): Promise<void> {
    // Initialize any resources if needed
  }

  /**
   * Shutdown the statistics collector
   */
  async shutdown(): Promise<void> {
    // Clean up any resources if needed
    this.metrics.length = 0
    this.statistics.clear()
  }

  private updateStatistics(deviceId: string): void {
    const deviceMetrics = this.metrics.filter(m => m.deviceId === deviceId)

    if (deviceMetrics.length === 0) return

    const totalJobs = deviceMetrics.length
    const successfulJobs = deviceMetrics.filter(m => m.status === 'success').length
    const failedJobs = totalJobs - successfulJobs
    const averagePrintTime = deviceMetrics.reduce((sum, m) => sum + m.duration, 0) / totalJobs
    const totalPaperUsed = deviceMetrics.reduce((sum, m) => sum + (m.paperUsed || 0), 0)
    const errorRate = failedJobs / totalJobs

    this.statistics.set(deviceId, {
      totalJobs,
      successfulJobs,
      failedJobs,
      averagePrintTime,
      totalPaperUsed,
      errorRate
    })
  }

  private getEmptyStatistics(): PrintStatistics {
    return {
      totalJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      averagePrintTime: 0,
      totalPaperUsed: 0,
      errorRate: 0
    }
  }
}
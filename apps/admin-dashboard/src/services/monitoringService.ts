/**
 * Monitoring Service
 * Frontend service layer for system monitoring and alerting
 */

import { api } from './api'
import type {
  HealthStatus,
  SystemMetrics,
  MonitoringOverview,
  PerformanceReport,
  AlertRule,
  CreateAlertRuleRequest,
  UpdateAlertRuleRequest,
  RecordErrorRequest,
  TestAlertRequest,
  MetricsQueryParams,
  PerformanceReportParams,
  AlertRulesPagination,
  PaginatedAlertRulesResponse,
} from '@/types/monitoring'

/**
 * Monitoring Service Class
 * Handles all monitoring and alerting related API calls
 */
class MonitoringService {
  private readonly baseUrl = '/monitoring'

  // ============================================================================
  // Health & Status
  // ============================================================================

  /**
   * Get system health status
   * @returns Health status of all system components
   */
  async getHealthStatus(): Promise<HealthStatus> {
    try {
      const response = await api.get<HealthStatus>(`${this.baseUrl}/health`)
      return response.data.data!
    } catch (error) {
      console.error('Failed to get health status:', error)
      throw error
    }
  }

  /**
   * Get monitoring overview
   * @returns Comprehensive monitoring overview with key metrics
   */
  async getOverview(): Promise<MonitoringOverview> {
    try {
      const response = await api.get<MonitoringOverview>(`${this.baseUrl}/overview`)
      return response.data.data!
    } catch (error) {
      console.error('Failed to get monitoring overview:', error)
      throw error
    }
  }

  // ============================================================================
  // Metrics
  // ============================================================================

  /**
   * Get system metrics
   * @param params Query parameters for metrics
   * @returns System metrics including API, database, cache, and error metrics
   */
  async getMetrics(params?: MetricsQueryParams): Promise<SystemMetrics> {
    try {
      const response = await api.get<{ query: any; summary: any } & SystemMetrics>(
        `${this.baseUrl}/metrics`,
        params,
      )
      return response.data.data!
    } catch (error) {
      console.error('Failed to get metrics:', error)
      throw error
    }
  }

  /**
   * Reset system metrics
   * @returns Success confirmation
   */
  async resetMetrics(): Promise<{ message: string; timestamp: number }> {
    try {
      const response = await api.delete<{ message: string; timestamp: number }>(
        `${this.baseUrl}/metrics`,
      )
      return response.data.data!
    } catch (error) {
      console.error('Failed to reset metrics:', error)
      throw error
    }
  }

  // ============================================================================
  // Alert Rules
  // ============================================================================

  /**
   * Get all alert rules with pagination
   * @param params Pagination parameters
   * @returns Paginated list of alert rules
   */
  async getAlertRules(params?: AlertRulesPagination): Promise<PaginatedAlertRulesResponse> {
    try {
      const response = await api.get<PaginatedAlertRulesResponse>(
        `${this.baseUrl}/alerts/rules`,
        params || { page: 1, limit: 20 },
      )
      return response.data.data!
    } catch (error) {
      console.error('Failed to get alert rules:', error)
      throw error
    }
  }

  /**
   * Create a new alert rule
   * @param rule Alert rule configuration
   * @returns Created alert rule with ID
   */
  async createAlertRule(rule: CreateAlertRuleRequest): Promise<AlertRule> {
    try {
      const response = await api.post<AlertRule & { created: number }>(
        `${this.baseUrl}/alerts/rules`,
        rule,
      )
      return response.data.data! as AlertRule
    } catch (error) {
      console.error('Failed to create alert rule:', error)
      throw error
    }
  }

  /**
   * Update an existing alert rule
   * @param id Alert rule ID
   * @param updates Partial alert rule updates
   * @returns Updated confirmation
   */
  async updateAlertRule(
    id: string,
    updates: UpdateAlertRuleRequest,
  ): Promise<{ id: string; updated: number }> {
    try {
      const response = await api.put<{ id: string; updated: number }>(
        `${this.baseUrl}/alerts/rules/${id}`,
        updates,
      )
      return response.data.data!
    } catch (error) {
      console.error('Failed to update alert rule:', error)
      throw error
    }
  }

  /**
   * Delete an alert rule
   * @param id Alert rule ID
   * @returns Success confirmation
   */
  async deleteAlertRule(id: string): Promise<{ message: string }> {
    try {
      const response = await api.delete<{ message: string }>(
        `${this.baseUrl}/alerts/rules/${id}`,
      )
      return response.data.data!
    } catch (error) {
      console.error('Failed to delete alert rule:', error)
      throw error
    }
  }

  /**
   * Get default alert rules
   * @returns List of default alert rules
   */
  async getDefaultAlertRules(): Promise<{
    rules: readonly any[]
    count: number
    description: string
  }> {
    try {
      const response = await api.get<{
        rules: readonly any[]
        count: number
        description: string
      }>(`${this.baseUrl}/alerts/defaults`)
      return response.data.data!
    } catch (error) {
      console.error('Failed to get default alert rules:', error)
      throw error
    }
  }

  /**
   * Test alert system
   * @param request Test alert configuration
   * @returns Test result confirmation
   */
  async testAlert(request: TestAlertRequest): Promise<{
    message: string
    type: string
    severity: string
    timestamp: number
  }> {
    try {
      const response = await api.post<{
        message: string
        type: string
        severity: string
        timestamp: number
      }>(`${this.baseUrl}/alerts/test`, request)
      return response.data.data!
    } catch (error) {
      console.error('Failed to test alert:', error)
      throw error
    }
  }

  // ============================================================================
  // Error Recording
  // ============================================================================

  /**
   * Record an error manually
   * @param error Error details
   * @returns Recorded error confirmation
   */
  async recordError(error: RecordErrorRequest): Promise<RecordErrorRequest & { timestamp: number }> {
    try {
      const response = await api.post<RecordErrorRequest & { timestamp: number }>(
        `${this.baseUrl}/errors`,
        error,
      )
      return response.data.data!
    } catch (err) {
      console.error('Failed to record error:', err)
      throw err
    }
  }

  // ============================================================================
  // Reports
  // ============================================================================

  /**
   * Get performance report
   * @param params Report parameters (e.g., time period)
   * @returns Comprehensive performance report
   */
  async getPerformanceReport(params?: PerformanceReportParams): Promise<PerformanceReport> {
    try {
      const response = await api.get<PerformanceReport>(
        `${this.baseUrl}/reports/performance`,
        params || { days: 7 },
      )
      return response.data.data!
    } catch (error) {
      console.error('Failed to get performance report:', error)
      throw error
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Check if a component is healthy
   * @param status Component health status
   * @returns True if component is healthy
   */
  isComponentHealthy(status: HealthStatus['overall']): boolean {
    return status === 'healthy'
  }

  /**
   * Get health status color for UI
   * @param status Health status
   * @returns Tailwind color class
   */
  getHealthStatusColor(status: HealthStatus['overall']): string {
    const colorMap: Record<HealthStatus['overall'], string> = {
      healthy: 'green',
      warning: 'yellow',
      critical: 'red',
      down: 'gray',
    }
    return colorMap[status] || 'gray'
  }

  /**
   * Get alert severity color for UI
   * @param severity Alert severity level
   * @returns Tailwind color class
   */
  getAlertSeverityColor(
    severity: 'info' | 'warning' | 'critical' | 'fatal',
  ): string {
    const colorMap = {
      info: 'blue',
      warning: 'yellow',
      critical: 'red',
      fatal: 'purple',
    }
    return colorMap[severity] || 'gray'
  }

  /**
   * Format uptime to human-readable string
   * @param seconds Uptime in seconds
   * @returns Formatted uptime string
   */
  formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    if (days > 0) {
      return `${days}天 ${hours}小時`
    } else if (hours > 0) {
      return `${hours}小時 ${minutes}分鐘`
    } else {
      return `${minutes}分鐘`
    }
  }

  /**
   * Format timestamp to relative time
   * @param timestamp Unix timestamp
   * @returns Relative time string (e.g., "5分鐘前")
   */
  formatRelativeTime(timestamp: number): string {
    const now = Date.now()
    const diff = now - timestamp

    if (diff < 60000) {
      return '剛才'
    } else if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}分鐘前`
    } else if (diff < 86400000) {
      return `${Math.floor(diff / 3600000)}小時前`
    } else {
      return `${Math.floor(diff / 86400000)}天前`
    }
  }

  /**
   * Calculate health score from metrics
   * @param metrics System metrics
   * @returns Health score (0-100)
   */
  calculateHealthScore(metrics: SystemMetrics): number {
    let score = 100

    // API performance impact (max -30 points)
    if (metrics.apiMetrics.averageResponseTime > 1000) {
      score -= 30
    } else if (metrics.apiMetrics.averageResponseTime > 500) {
      score -= 15
    }

    // Error rate impact (max -25 points)
    if (metrics.apiMetrics.errorRate > 0.1) {
      score -= 25
    } else if (metrics.apiMetrics.errorRate > 0.05) {
      score -= 15
    }

    // Database performance impact (max -20 points)
    if (metrics.databaseMetrics.averageQueryTime > 500) {
      score -= 20
    } else if (metrics.databaseMetrics.averageQueryTime > 100) {
      score -= 10
    }

    // Cache performance impact (max -15 points)
    if (metrics.cacheMetrics.hitRate < 0.3) {
      score -= 15
    } else if (metrics.cacheMetrics.hitRate < 0.6) {
      score -= 8
    }

    // Critical errors impact (max -10 points)
    if (metrics.errorMetrics.criticalErrors > 0) {
      score -= Math.min(10, metrics.errorMetrics.criticalErrors * 2)
    }

    return Math.max(0, Math.min(100, score))
  }

  /**
   * Check if metrics exceed thresholds
   * @param metrics System metrics
   * @returns List of threshold violations
   */
  checkThresholds(metrics: SystemMetrics): string[] {
    const violations: string[] = []

    if (metrics.apiMetrics.averageResponseTime > 1000) {
      violations.push('API響應時間超過臨界值')
    }

    if (metrics.apiMetrics.errorRate > 0.1) {
      violations.push('API錯誤率過高')
    }

    if (metrics.databaseMetrics.averageQueryTime > 500) {
      violations.push('資料庫查詢時間過長')
    }

    if (metrics.cacheMetrics.hitRate < 0.3) {
      violations.push('快取命中率過低')
    }

    if (metrics.errorMetrics.criticalErrors > 0) {
      violations.push(`存在${metrics.errorMetrics.criticalErrors}個嚴重錯誤`)
    }

    return violations
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService()

// Export class for testing
export default MonitoringService

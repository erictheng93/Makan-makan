import { Context, Next } from 'hono'
import type { Env } from '../types/env'

// Custom AnalyticsEngine interface since it's not exported by @cloudflare/workers-types
interface AnalyticsEngine {
  writeDataPoint(data: {
    blobs?: Array<string | ArrayBuffer>;
    doubles?: Array<number>;
    indexes?: Array<string>;
  }): void;
}

// Mock Analytics Engine for local development
class MockAnalyticsEngine implements AnalyticsEngine {
  writeDataPoint(_data: { blobs?: Array<string | ArrayBuffer>; doubles?: Array<number>; indexes?: Array<string> }): void {
    // No-op for local development - silently ignore
    // Optionally log for debugging: console.debug('[Mock Analytics]', _data.blobs?.[0])
  }
}

/**
 * Advanced Workers Analytics Integration
 * Provides comprehensive business intelligence and performance monitoring
 * at the edge with zero-latency impact on requests
 */

export interface AnalyticsDataPoint {
  event: string
  restaurant_id?: number | string
  user_id?: number | string
  dimensions: Record<string, string>
  metrics: Record<string, number>
  timestamp?: number
}

export interface BusinessMetrics {
  revenue: number
  orders_count: number
  average_order_value: number
  customer_satisfaction: number
  peak_hours: Array<{ hour: number; orders: number }>
  popular_items: Array<{ item_id: number; orders: number }>
}

export class AdvancedAnalyticsService {
  constructor(
    private analyticsEngine: AnalyticsEngine,
    private context: ExecutionContext,
    private env: Env
  ) {}

  /**
   * Record high-performance analytics events with zero request latency impact
   */
  async recordEvent(dataPoint: AnalyticsDataPoint): Promise<void> {
    try {
      // Use waitUntil to ensure zero impact on request performance
      this.context.waitUntil(
        Promise.resolve(this.analyticsEngine.writeDataPoint({
          // String dimensions (blobs) - up to 20
          blobs: [
            dataPoint.event,
            dataPoint.restaurant_id?.toString() || '0',
            dataPoint.user_id?.toString() || '0',
            dataPoint.dimensions.country || 'unknown',
            dataPoint.dimensions.city || 'unknown',
            dataPoint.dimensions.device_type || 'unknown',
            dataPoint.dimensions.browser || 'unknown',
            dataPoint.dimensions.endpoint || 'unknown',
            dataPoint.dimensions.method || 'GET',
            dataPoint.dimensions.status_code || '200',
            dataPoint.dimensions.user_role || 'guest',
            dataPoint.dimensions.order_type || 'unknown',
            dataPoint.dimensions.payment_method || 'unknown',
            dataPoint.dimensions.campaign_source || 'direct',
            dataPoint.dimensions.ab_test_variant || 'control'
          ],
          
          // Numeric metrics (doubles) - up to 20
          doubles: [
            dataPoint.timestamp || Date.now(),
            dataPoint.metrics.response_time || 0,
            dataPoint.metrics.cpu_time || 0,
            dataPoint.metrics.memory_used || 0,
            dataPoint.metrics.cache_hit_rate || 0,
            dataPoint.metrics.error_rate || 0,
            dataPoint.metrics.conversion_rate || 0,
            dataPoint.metrics.order_value || 0,
            dataPoint.metrics.customer_wait_time || 0,
            dataPoint.metrics.kitchen_prep_time || 0,
            dataPoint.metrics.delivery_time || 0,
            dataPoint.metrics.user_session_duration || 0,
            dataPoint.metrics.page_load_time || 0,
            dataPoint.metrics.api_calls_count || 0,
            dataPoint.metrics.database_query_time || 0,
            dataPoint.metrics.threat_score || 0,
            dataPoint.metrics.customer_rating || 0,
            dataPoint.metrics.items_in_cart || 0,
            dataPoint.metrics.discount_amount || 0,
            dataPoint.metrics.tip_amount || 0
          ],
          
          // Indexed fields for fast queries - up to 20
          indexes: [
            dataPoint.restaurant_id?.toString() || '0',
            dataPoint.user_id?.toString() || '0',
            this.getHourOfDay(dataPoint.timestamp || Date.now()).toString(),
            this.getDayOfWeek(dataPoint.timestamp || Date.now()).toString(),
            this.getWeekOfYear(dataPoint.timestamp || Date.now()).toString(),
            Math.floor((dataPoint.timestamp || Date.now()) / 1000).toString(), // Unix timestamp
            dataPoint.dimensions.status_code || '200',
            this.hashString(dataPoint.dimensions.endpoint || '').toString(),
            this.hashString(dataPoint.dimensions.user_agent || '').toString(),
            dataPoint.metrics.response_time?.toString() || '0',
            dataPoint.metrics.order_value?.toString() || '0',
            this.categorizeResponseTime(dataPoint.metrics.response_time || 0).toString(),
            this.categorizeOrderValue(dataPoint.metrics.order_value || 0).toString(),
            this.categorizeUserEngagement(dataPoint.metrics.user_session_duration || 0).toString(),
            (dataPoint.dimensions.ab_test_variant?.charCodeAt(0) || 0).toString(),
            '0', '0', '0', '0', '0' // Reserved for future use
          ]
        }))
      )
    } catch (error) {
      console.error('Analytics recording failed:', error)
      // Don't throw - analytics failures should never impact user experience
    }
  }

  /**
   * Record comprehensive business metrics
   */
  async recordBusinessMetrics(restaurantId: number, metrics: BusinessMetrics): Promise<void> {
    await this.recordEvent({
      event: 'business_metrics_snapshot',
      restaurant_id: restaurantId,
      dimensions: {
        metric_type: 'business_snapshot',
        period: 'hourly',
        source: 'automated'
      },
      metrics: {
        revenue: metrics.revenue,
        orders_count: metrics.orders_count,
        average_order_value: metrics.average_order_value,
        customer_satisfaction: metrics.customer_satisfaction
      }
    })

    // Record peak hours data
    for (const peak of metrics.peak_hours) {
      await this.recordEvent({
        event: 'peak_hour_analysis',
        restaurant_id: restaurantId,
        dimensions: {
          hour: peak.hour.toString(),
          analysis_type: 'peak_detection'
        },
        metrics: {
          orders_count: peak.orders,
          hour_of_day: peak.hour
        }
      })
    }

    // Record popular items
    for (const item of metrics.popular_items) {
      await this.recordEvent({
        event: 'item_popularity',
        restaurant_id: restaurantId,
        dimensions: {
          item_id: item.item_id.toString(),
          analysis_type: 'popularity_ranking'
        },
        metrics: {
          orders_count: item.orders,
          popularity_score: item.orders / metrics.orders_count
        }
      })
    }
  }

  /**
   * Record user journey analytics
   */
  async recordUserJourney(
    userId: string,
    restaurantId: number,
    journey: {
      event: string
      page: string
      action: string
      duration_ms: number
      conversion_step: number
      funnel_position: number
    }
  ): Promise<void> {
    await this.recordEvent({
      event: 'user_journey',
      user_id: userId,
      restaurant_id: restaurantId,
      dimensions: {
        page: journey.page,
        action: journey.action,
        conversion_step: journey.conversion_step.toString(),
        funnel_position: journey.funnel_position.toString(),
        journey_type: 'user_flow'
      },
      metrics: {
        duration_ms: journey.duration_ms,
        conversion_step: journey.conversion_step,
        funnel_position: journey.funnel_position
      }
    })
  }

  /**
   * Record performance metrics with automatic alerting
   */
  async recordPerformanceMetrics(
    endpoint: string,
    metrics: {
      response_time: number
      cpu_time: number
      memory_used: number
      cache_hit_rate: number
      error_rate: number
      concurrent_requests: number
    }
  ): Promise<void> {
    await this.recordEvent({
      event: 'performance_metrics',
      dimensions: {
        endpoint,
        performance_category: this.categorizePerformance(metrics.response_time),
        alerting_level: this.determineAlertingLevel(metrics)
      },
      metrics
    })

    // Automatic alerting for performance issues
    if (this.shouldAlert(metrics)) {
      this.context.waitUntil(this.triggerPerformanceAlert(endpoint, metrics))
    }
  }

  /**
   * Record security events and threat intelligence
   */
  async recordSecurityEvent(
    event: string,
    details: {
      ip_address: string
      user_agent: string
      country: string
      threat_score: number
      action_taken: string
      endpoint: string
      blocked: boolean
    }
  ): Promise<void> {
    await this.recordEvent({
      event: 'security_event',
      dimensions: {
        security_event: event,
        country: details.country,
        action_taken: details.action_taken,
        endpoint: details.endpoint,
        blocked: details.blocked.toString(),
        threat_level: this.categorizeThreatLevel(details.threat_score)
      },
      metrics: {
        threat_score: details.threat_score,
        blocked_request: details.blocked ? 1 : 0
      }
    })

    // Automatic threat response
    if (details.threat_score > 80) {
      this.context.waitUntil(this.triggerSecurityAlert(event, details))
    }
  }

  /**
   * Query analytics data for real-time insights
   */
  async queryAnalytics(query: {
    event?: string
    restaurant_id?: number
    time_range: '1h' | '24h' | '7d' | '30d'
    metrics: string[]
    group_by?: string[]
    filters?: Record<string, any>
  }): Promise<any[]> {
    try {
      // This would typically use the Analytics Engine SQL API
      // For now, we'll structure the query parameters
      const timeRange = this.getTimeRangeMillis(query.time_range)
      const startTime = Date.now() - timeRange
      
      // Build SQL query for Analytics Engine
      const sql = this.buildAnalyticsQuery(query, startTime)
      
      // Execute query (would need Analytics Engine SQL API)
      console.log('Analytics Query:', sql)
      
      return [] // Placeholder - would return actual results
    } catch (error) {
      console.error('Analytics query failed:', error)
      return []
    }
  }

  // Private helper methods
  private getHourOfDay(timestamp: number): number {
    return new Date(timestamp).getHours()
  }

  private getDayOfWeek(timestamp: number): number {
    return new Date(timestamp).getDay()
  }

  private getWeekOfYear(timestamp: number): number {
    const date = new Date(timestamp)
    const firstDay = new Date(date.getFullYear(), 0, 1)
    return Math.ceil(((date.getTime() - firstDay.getTime()) / 86400000 + firstDay.getDay() + 1) / 7)
  }

  private hashString(str: string): number {
    let hash = 0
    if (str.length === 0) return hash
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  private categorizeResponseTime(responseTime: number): number {
    if (responseTime < 100) return 1 // Fast
    if (responseTime < 300) return 2 // Good
    if (responseTime < 1000) return 3 // Acceptable
    if (responseTime < 3000) return 4 // Slow
    return 5 // Critical
  }

  private categorizeOrderValue(orderValue: number): number {
    if (orderValue < 10) return 1 // Small
    if (orderValue < 25) return 2 // Medium
    if (orderValue < 50) return 3 // Large
    if (orderValue < 100) return 4 // Premium
    return 5 // Enterprise
  }

  private categorizeUserEngagement(sessionDuration: number): number {
    const minutes = sessionDuration / 60000
    if (minutes < 1) return 1 // Bounce
    if (minutes < 5) return 2 // Brief
    if (minutes < 15) return 3 // Engaged
    if (minutes < 30) return 4 // Highly engaged
    return 5 // Power user
  }

  private categorizePerformance(responseTime: number): string {
    if (responseTime < 100) return 'excellent'
    if (responseTime < 300) return 'good'
    if (responseTime < 1000) return 'acceptable'
    return 'poor'
  }

  private categorizeThreatLevel(threatScore: number): string {
    if (threatScore < 20) return 'low'
    if (threatScore < 50) return 'medium'
    if (threatScore < 80) return 'high'
    return 'critical'
  }

  private determineAlertingLevel(metrics: any): string {
    if (metrics.error_rate > 0.05 || metrics.response_time > 5000) return 'critical'
    if (metrics.error_rate > 0.02 || metrics.response_time > 2000) return 'warning'
    return 'normal'
  }

  private shouldAlert(metrics: any): boolean {
    return metrics.error_rate > 0.05 || 
           metrics.response_time > 5000 || 
           metrics.cpu_time > 800 ||
           metrics.memory_used > 100
  }

  private async triggerPerformanceAlert(endpoint: string, metrics: any): Promise<void> {
    try {
      // Send to alerting system (Slack, PagerDuty, etc.)
      if (this.env.SLACK_WEBHOOK_URL) {
        await fetch(this.env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 Performance Alert: ${endpoint}`,
            attachments: [{
              color: 'danger',
              fields: [
                { title: 'Response Time', value: `${metrics.response_time}ms`, short: true },
                { title: 'Error Rate', value: `${(metrics.error_rate * 100).toFixed(2)}%`, short: true },
                { title: 'CPU Time', value: `${metrics.cpu_time}ms`, short: true },
                { title: 'Memory', value: `${metrics.memory_used}MB`, short: true }
              ]
            }]
          })
        })
      }
    } catch (error) {
      console.error('Failed to send performance alert:', error)
    }
  }

  private async triggerSecurityAlert(event: string, details: any): Promise<void> {
    try {
      if (this.env.SLACK_WEBHOOK_URL) {
        await fetch(this.env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🔒 Security Alert: ${event}`,
            attachments: [{
              color: 'warning',
              fields: [
                { title: 'IP Address', value: details.ip_address, short: true },
                { title: 'Country', value: details.country, short: true },
                { title: 'Threat Score', value: details.threat_score.toString(), short: true },
                { title: 'Action', value: details.action_taken, short: true }
              ]
            }]
          })
        })
      }
    } catch (error) {
      console.error('Failed to send security alert:', error)
    }
  }

  private getTimeRangeMillis(range: string): number {
    switch (range) {
      case '1h': return 60 * 60 * 1000
      case '24h': return 24 * 60 * 60 * 1000
      case '7d': return 7 * 24 * 60 * 60 * 1000
      case '30d': return 30 * 24 * 60 * 60 * 1000
      default: return 60 * 60 * 1000
    }
  }

  private buildAnalyticsQuery(query: any, startTime: number): string {
    // Build SQL query for Analytics Engine
    let sql = `SELECT ${query.metrics.join(', ')} FROM analytics WHERE timestamp >= ${startTime}`
    
    if (query.event) {
      sql += ` AND blob1 = '${query.event}'`
    }
    
    if (query.restaurant_id) {
      sql += ` AND blob2 = '${query.restaurant_id}'`
    }
    
    if (query.group_by?.length) {
      sql += ` GROUP BY ${query.group_by.join(', ')}`
    }
    
    sql += ` ORDER BY timestamp DESC LIMIT 1000`
    
    return sql
  }
}

/**
 * Advanced Analytics Middleware
 */
export function advancedAnalyticsMiddleware() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const startTime = Date.now()
    const requestId = c.get('requestId') || crypto.randomUUID()

    // Initialize analytics service with mock for local development
    const analyticsEngine = c.env.ANALYTICS_ENGINE || new MockAnalyticsEngine()
    // Create a mock execution context if not available (for testing)
    const executionCtx = c.executionCtx || { waitUntil: (p: Promise<any>) => p }
    const analytics = new AdvancedAnalyticsService(
      analyticsEngine,
      executionCtx as ExecutionContext,
      c.env
    )

    // Store analytics service in context
    ;(c as any).set('analytics', analytics)

    // Extract request metadata
    const metadata = {
      endpoint: c.req.path,
      method: c.req.method,
      user_agent: c.req.header('User-Agent') || 'unknown',
      country: c.req.header('CF-IPCountry') || 'unknown',
      city: c.req.header('CF-IPCity') || 'unknown',
      device_type: 'unknown', // detectDeviceType(c.req.header('User-Agent') || ''),
      browser: 'unknown', // detectBrowser(c.req.header('User-Agent') || ''),
      ip_address: c.req.header('CF-Connecting-IP') || 'unknown',
      threat_score: parseInt(c.req.header('CF-Threat-Score') || '0')
    }

    await next()

    // Calculate response metrics
    const responseTime = Date.now() - startTime
    const statusCode = c.res.status
    const user = c.get('user')
    const restaurantId = user?.restaurantId || parseInt(c.req.param('restaurantId') || '0')

    // Record comprehensive analytics
    analytics.recordEvent({
      event: 'api_request',
      restaurant_id: restaurantId,
      user_id: user?.id,
      dimensions: {
        status_code: statusCode.toString(),
        user_role: user?.role?.toString() || 'guest',
        request_id: requestId,
        endpoint: metadata.endpoint,
        method: metadata.method,
        user_agent: metadata.user_agent,
        country: metadata.country,
        city: metadata.city,
        device_type: metadata.device_type,
        browser: metadata.browser,
        ip_address: metadata.ip_address,
        threat_score: metadata.threat_score.toString()
      },
      metrics: {
        response_time: responseTime,
        status_code: statusCode,
        threat_score: metadata.threat_score,
        request_size: parseInt(c.req.header('Content-Length') || '0'),
        user_session_duration: 0 // Would be calculated from session data
      }
    })

    // Record performance metrics if slow
    if (responseTime > 1000 || statusCode >= 500) {
      analytics.recordPerformanceMetrics(metadata.endpoint, {
        response_time: responseTime,
        cpu_time: 0, // Would be measured
        memory_used: 0, // Would be measured
        cache_hit_rate: c.res.headers.get('X-Cache') === 'HIT' ? 1 : 0,
        error_rate: statusCode >= 400 ? 1 : 0,
        concurrent_requests: 0 // Would be tracked
      })
    }

    // Record security events for suspicious activity
    if (metadata.threat_score > 50 || statusCode === 401 || statusCode === 403) {
      analytics.recordSecurityEvent('suspicious_request', {
        ip_address: metadata.ip_address,
        user_agent: metadata.user_agent,
        country: metadata.country,
        threat_score: metadata.threat_score,
        action_taken: statusCode >= 400 ? 'blocked' : 'allowed',
        endpoint: metadata.endpoint,
        blocked: statusCode >= 400
      })
    }
  }

  // Helper functions for device/browser detection
  function _detectDeviceType(userAgent: string): string {
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) return 'mobile'
    if (/Tablet/.test(userAgent)) return 'tablet'
    return 'desktop'
  }

  function _detectBrowser(userAgent: string): string {
    if (/Chrome/.test(userAgent)) return 'chrome'
    if (/Firefox/.test(userAgent)) return 'firefox'
    if (/Safari/.test(userAgent)) return 'safari'
    if (/Edge/.test(userAgent)) return 'edge'
    return 'other'
  }
}

declare module 'hono' {
  interface ContextVariableMap {
    analytics: AdvancedAnalyticsService
  }
}
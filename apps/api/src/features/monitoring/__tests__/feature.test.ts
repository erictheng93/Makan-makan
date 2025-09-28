/**
 * Monitoring Feature Tests
 * Unit tests for monitoring functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MonitoringService, createMonitoringService } from '../services/MonitoringService'

// Mock KV namespace
const mockKV = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  list: vi.fn()
}

describe('Monitoring Feature', () => {
  let monitoringService: MonitoringService

  beforeEach(() => {
    vi.clearAllMocks()
    monitoringService = createMonitoringService(mockKV as any)
  })

  describe('MonitoringService', () => {
    it('should create monitoring service instance', () => {
      expect(monitoringService).toBeInstanceOf(MonitoringService)
    })

    it('should record API request metrics', async () => {
      mockKV.put.mockResolvedValue(undefined)

      await monitoringService.recordApiRequest(250, 200, '/api/test')

      expect(mockKV.put).toHaveBeenCalled()
    })

    it('should record database query metrics', async () => {
      mockKV.put.mockResolvedValue(undefined)

      await monitoringService.recordDatabaseQuery(50, true, 'SELECT')

      expect(mockKV.put).toHaveBeenCalled()
    })

    it('should record cache metrics', async () => {
      mockKV.put.mockResolvedValue(undefined)

      await monitoringService.recordCacheMetrics(0.8, 100, 1024)

      expect(mockKV.put).toHaveBeenCalled()
    })

    it('should record errors with appropriate severity', async () => {
      mockKV.put.mockResolvedValue(undefined)

      await monitoringService.recordError('test_error', 'Test error message', 'critical')

      expect(mockKV.put).toHaveBeenCalled()
    })

    it('should get system metrics', async () => {
      const mockMetrics = {
        timestamp: Date.now(),
        apiMetrics: {
          totalRequests: 100,
          errorRate: 0.02,
          averageResponseTime: 250,
          p95ResponseTime: 500,
          p99ResponseTime: 800,
          slowRequestCount: 5,
          requestsPerSecond: 10
        },
        databaseMetrics: {
          queryCount: 200,
          averageQueryTime: 25,
          slowQueryCount: 2,
          connectionPoolUsage: 0.7,
          errorCount: 1
        },
        cacheMetrics: {
          hitRate: 0.85,
          totalKeys: 50,
          totalSize: 2048,
          expiringKeysCount: 5,
          invalidationCount: 2
        },
        resourceMetrics: {
          memoryUsage: 0.6,
          cpuUsage: 0.3,
          activeConnections: 25,
          queueLength: 0
        },
        errorMetrics: {
          totalErrors: 3,
          criticalErrors: 1,
          warningCount: 2,
          errorsByType: {
            'api_error': 1,
            'database_error': 1,
            'test_error': 1
          }
        }
      }

      mockKV.get.mockResolvedValue(JSON.stringify(mockMetrics))

      const metrics = await monitoringService.getMetrics()

      expect(metrics).toEqual(mockMetrics)
      expect(mockKV.get).toHaveBeenCalledWith('_system_metrics')
    })

    it('should get health status', async () => {
      mockKV.put.mockResolvedValue(undefined)

      const healthStatus = await monitoringService.getHealthStatus()

      expect(healthStatus).toHaveProperty('overall')
      expect(healthStatus).toHaveProperty('components')
      expect(healthStatus).toHaveProperty('uptime')
      expect(healthStatus).toHaveProperty('version')
      expect(healthStatus).toHaveProperty('timestamp')
      expect(healthStatus.components).toHaveProperty('api')
      expect(healthStatus.components).toHaveProperty('database')
      expect(healthStatus.components).toHaveProperty('cache')
      expect(healthStatus.components).toHaveProperty('external')
    })

    it('should create alert rule', async () => {
      mockKV.put.mockResolvedValue(undefined)

      const ruleData = {
        name: 'Test Alert',
        condition: 'test condition',
        metric: 'apiMetrics.errorRate',
        operator: '>' as const,
        threshold: 0.05,
        duration: 300,
        config: {
          type: 'slack' as const,
          severity: 'warning' as const,
          enabled: true,
          interval: 30
        }
      }

      const ruleId = await monitoringService.createAlertRule(ruleData)

      expect(ruleId).toMatch(/^alert_/)
      expect(mockKV.put).toHaveBeenCalled()
    })

    it('should get alert rules', async () => {
      const mockRules = [
        {
          id: 'alert_123',
          name: 'Test Alert',
          condition: 'test condition',
          metric: 'apiMetrics.errorRate',
          operator: '>',
          threshold: 0.05,
          duration: 300,
          config: {
            type: 'slack',
            severity: 'warning',
            enabled: true,
            interval: 30
          },
          triggerCount: 0,
          isActive: true
        }
      ]

      mockKV.get.mockResolvedValue(JSON.stringify(mockRules))

      const rules = await monitoringService.getAlertRules()

      expect(rules).toEqual(mockRules)
      expect(mockKV.get).toHaveBeenCalledWith('_alert_rules')
    })

    it('should reset metrics', async () => {
      mockKV.put.mockResolvedValue(undefined)

      await monitoringService.resetMetrics()

      expect(mockKV.put).toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      mockKV.put.mockRejectedValue(new Error('KV error'))

      // Should not throw
      await expect(monitoringService.recordApiRequest(250, 200, '/api/test')).resolves.toBeUndefined()
    })
  })

  describe('Service Factory', () => {
    it('should return singleton instance', () => {
      const instance1 = createMonitoringService(mockKV as any)
      const instance2 = createMonitoringService(mockKV as any)

      expect(instance1).toBe(instance2)
    })
  })

  describe('Alert Rules', () => {
    it('should update existing alert rule', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify([{
        id: 'test_rule',
        name: 'Test Rule',
        condition: 'test',
        metric: 'apiMetrics.errorRate',
        operator: '>',
        threshold: 0.05,
        duration: 300,
        config: {
          type: 'slack',
          severity: 'warning',
          enabled: true
        },
        triggerCount: 0,
        isActive: true
      }]))
      mockKV.put.mockResolvedValue(undefined)

      const success = await monitoringService.updateAlertRule('test_rule', {
        threshold: 0.1,
        config: {
          type: 'slack',
          severity: 'critical',
          enabled: true
        }
      })

      expect(success).toBe(true)
      expect(mockKV.put).toHaveBeenCalled()
    })

    it('should delete alert rule', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify([{
        id: 'test_rule',
        name: 'Test Rule',
        condition: 'test',
        metric: 'apiMetrics.errorRate',
        operator: '>',
        threshold: 0.05,
        duration: 300,
        config: {
          type: 'slack',
          severity: 'warning',
          enabled: true
        },
        triggerCount: 0,
        isActive: true
      }]))
      mockKV.put.mockResolvedValue(undefined)

      const success = await monitoringService.deleteAlertRule('test_rule')

      expect(success).toBe(true)
      expect(mockKV.put).toHaveBeenCalled()
    })

    it('should return false when updating non-existent rule', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify([]))

      const success = await monitoringService.updateAlertRule('non_existent', {
        threshold: 0.1
      })

      expect(success).toBe(false)
    })

    it('should return false when deleting non-existent rule', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify([]))

      const success = await monitoringService.deleteAlertRule('non_existent')

      expect(success).toBe(false)
    })
  })
})
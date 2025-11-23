/**
 * Monitoring Dashboard - Advanced Filtering & Search Types
 * 監控儀表板 - 高級過濾與搜索類型定義
 */

export type TimeRange =
  | 'last15minutes'
  | 'last1hour'
  | 'last6hours'
  | 'last24hours'
  | 'last7days'
  | 'last30days'
  | 'custom'

export type ComponentType =
  | 'all'
  | 'api'
  | 'database'
  | 'cache'
  | 'storage'
  | 'websocket'
  | 'queue'
  | 'external'

export type SeverityLevel =
  | 'all'
  | 'info'
  | 'warning'
  | 'critical'
  | 'fatal'

export type AlertStatus =
  | 'all'
  | 'active'
  | 'acknowledged'
  | 'resolved'
  | 'muted'

export interface DateRangeFilter {
  start: Date
  end: Date
}

export interface MonitoringFilter {
  // 時間範圍
  timeRange: TimeRange
  customDateRange?: DateRangeFilter

  // 組件與狀態
  components: ComponentType[]
  severity: SeverityLevel[]
  status: AlertStatus[]

  // 搜索
  searchKeyword: string
  searchFields: ('message' | 'component' | 'alertId')[]

  // 性能閾值
  minResponseTime?: number
  maxResponseTime?: number
  minErrorRate?: number
  maxErrorRate?: number

  // 高級選項
  includeResolved: boolean
  includeMuted: boolean
  groupByComponent: boolean
}

export interface SavedFilter {
  id: string
  name: string
  description?: string
  filter: MonitoringFilter
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
}

export interface FilterPreset {
  id: string
  name: string
  icon: string
  filter: Partial<MonitoringFilter>
}

// 預設篩選器
export const DEFAULT_FILTER: MonitoringFilter = {
  timeRange: 'last24hours',
  components: ['all'],
  severity: ['all'],
  status: ['all'],
  searchKeyword: '',
  searchFields: ['message', 'component', 'alertId'],
  includeResolved: false,
  includeMuted: false,
  groupByComponent: false,
}

// 快速篩選器預設
export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'critical-alerts',
    name: '嚴重警報',
    icon: 'ExclamationCircleIcon',
    filter: {
      severity: ['critical', 'fatal'],
      status: ['active'],
      includeResolved: false,
    },
  },
  {
    id: 'api-issues',
    name: 'API 問題',
    icon: 'CloudIcon',
    filter: {
      components: ['api'],
      severity: ['warning', 'critical', 'fatal'],
      status: ['active', 'acknowledged'],
    },
  },
  {
    id: 'database-performance',
    name: '數據庫性能',
    icon: 'CircleStackIcon',
    filter: {
      components: ['database'],
      timeRange: 'last1hour',
    },
  },
  {
    id: 'recent-errors',
    name: '近期錯誤',
    icon: 'ExclamationTriangleIcon',
    filter: {
      timeRange: 'last15minutes',
      severity: ['warning', 'critical', 'fatal'],
      includeResolved: false,
    },
  },
]

// 篩選器驗證
export function validateFilter(filter: Partial<MonitoringFilter>): boolean {
  if (filter.timeRange === 'custom' && !filter.customDateRange) {
    return false
  }

  if (filter.customDateRange) {
    const { start, end } = filter.customDateRange
    if (start >= end) {
      return false
    }
  }

  if (filter.minResponseTime !== undefined && filter.maxResponseTime !== undefined) {
    if (filter.minResponseTime > filter.maxResponseTime) {
      return false
    }
  }

  return true
}

// 篩選器序列化（用於保存到 localStorage）
export function serializeFilter(filter: MonitoringFilter): string {
  return JSON.stringify({
    ...filter,
    customDateRange: filter.customDateRange ? {
      start: filter.customDateRange.start.toISOString(),
      end: filter.customDateRange.end.toISOString(),
    } : undefined,
  })
}

// 篩選器反序列化
export function deserializeFilter(json: string): MonitoringFilter {
  const parsed = JSON.parse(json)
  return {
    ...parsed,
    customDateRange: parsed.customDateRange ? {
      start: new Date(parsed.customDateRange.start),
      end: new Date(parsed.customDateRange.end),
    } : undefined,
  }
}

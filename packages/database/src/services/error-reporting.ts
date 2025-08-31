import { eq, and, desc, asc, gte, lte, count, sql, isNull, isNotNull } from 'drizzle-orm'
import { BaseService } from './base'
import { errorReports, systemAlerts, users, restaurants } from '../schema'
import type { ErrorReport, NewErrorReport, SystemAlert, NewSystemAlert } from '../schema/error-reports'

export interface CreateErrorReportData {
  userId: number
  restaurantId?: number
  errorType: 'network' | 'api' | 'sse' | 'validation' | 'permission' | 'unknown'
  severity: 'low' | 'medium' | 'high' | 'critical'
  errorCode?: string
  errorMessage: string
  errorContext?: Record<string, any>
  originalError?: any
  userAgent?: string
  url?: string
  timestamp: string
}

export interface ErrorReportFilters {
  userId?: number
  restaurantId?: number
  errorType?: string
  severity?: string
  dateRange?: [Date, Date]
  resolved?: boolean
}

export interface ErrorStats {
  totalErrors: number
  uniqueUsers: number
  errorsByType: Record<string, number>
  errorsBySeverity: Record<string, number>
  errorTrend: Array<{ date: string; count: number }>
}

export class ErrorReportingService extends BaseService {
  
  // 創建錯誤報告
  async createErrorReport(data: CreateErrorReportData): Promise<ErrorReport> {
    try {
      const [report] = await this.db
        .insert(errorReports)
        .values({
          userId: data.userId,
          restaurantId: data.restaurantId,
          errorType: data.errorType,
          severity: data.severity,
          errorCode: data.errorCode,
          errorMessage: data.errorMessage,
          errorContext: data.errorContext ? JSON.stringify(data.errorContext) : null,
          originalError: data.originalError ? JSON.stringify(data.originalError) : null,
          userAgent: data.userAgent,
          url: data.url,
          timestamp: data.timestamp,
          createdAt: new Date().toISOString()
        })
        .returning()

      return report
    } catch (error) {
      this.handleError(error, 'createErrorReport')
    }
  }

  // 批量創建錯誤報告
  async createBulkErrorReports(reports: CreateErrorReportData[]): Promise<ErrorReport[]> {
    try {
      const newReports = reports.map(data => ({
        userId: data.userId,
        restaurantId: data.restaurantId,
        errorType: data.errorType,
        severity: data.severity,
        errorCode: data.errorCode,
        errorMessage: data.errorMessage,
        errorContext: data.errorContext ? JSON.stringify(data.errorContext) : null,
        originalError: data.originalError ? JSON.stringify(data.originalError) : null,
        userAgent: data.userAgent,
        url: data.url,
        timestamp: data.timestamp,
        createdAt: new Date().toISOString()
      }))

      return await this.db
        .insert(errorReports)
        .values(newReports)
        .returning()
    } catch (error) {
      this.handleError(error, 'createBulkErrorReports')
    }
  }

  // 獲取錯誤報告列表
  async getErrorReports(
    filters: ErrorReportFilters = {},
    page: number = 1,
    limit: number = 20
  ) {
    try {
      const { offset } = this.createPagination(page, limit)
      const conditions = []

      if (filters.userId) {
        conditions.push(eq(errorReports.userId, filters.userId))
      }

      if (filters.restaurantId) {
        conditions.push(eq(errorReports.restaurantId, filters.restaurantId))
      }

      if (filters.errorType) {
        conditions.push(eq(errorReports.errorType, filters.errorType as any))
      }

      if (filters.severity) {
        conditions.push(eq(errorReports.severity, filters.severity as any))
      }

      if (filters.dateRange) {
        const [startDate, endDate] = filters.dateRange
        conditions.push(
          and(
            gte(errorReports.createdAt, startDate.toISOString()),
            lte(errorReports.createdAt, endDate.toISOString())
          )
        )
      }

      if (filters.resolved !== undefined) {
        if (filters.resolved) {
          conditions.push(isNotNull(errorReports.resolvedAt))
        } else {
          conditions.push(isNull(errorReports.resolvedAt))
        }
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined

      const reports = await this.db
        .select()
        .from(errorReports)
        .leftJoin(users, eq(errorReports.userId, users.id))
        .leftJoin(restaurants, eq(errorReports.restaurantId, restaurants.id))
        .where(whereClause)
        .orderBy(desc(errorReports.createdAt))
        .limit(limit)
        .offset(offset)

      const [{ totalCount }] = await this.db
        .select({ totalCount: count() })
        .from(errorReports)
        .where(whereClause)

      return {
        reports: reports.map(report => ({
          ...report.error_reports,
          user: report.users,
          restaurant: report.restaurants,
          errorContext: report.error_reports.errorContext ? JSON.parse(report.error_reports.errorContext) : null,
          originalError: report.error_reports.originalError ? JSON.parse(report.error_reports.originalError) : null
        })),
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      }
    } catch (error) {
      this.handleError(error, 'getErrorReports')
    }
  }

  // 解決錯誤報告
  async resolveErrorReport(
    reportId: number, 
    resolvedBy: number, 
    resolutionNotes?: string
  ): Promise<ErrorReport> {
    try {
      const [report] = await this.db
        .update(errorReports)
        .set({
          resolvedAt: new Date().toISOString(),
          resolvedBy,
          resolutionNotes
        })
        .where(eq(errorReports.id, reportId))
        .returning()

      if (!report) {
        throw new Error('Error report not found')
      }

      return report
    } catch (error) {
      this.handleError(error, 'resolveErrorReport')
    }
  }

  // 獲取錯誤統計
  async getErrorStats(
    restaurantId?: number,
    dateRange?: [Date, Date]
  ): Promise<ErrorStats> {
    try {
      const conditions = []
      
      if (restaurantId) {
        conditions.push(eq(errorReports.restaurantId, restaurantId))
      }

      if (dateRange) {
        const [startDate, endDate] = dateRange
        conditions.push(
          and(
            gte(errorReports.createdAt, startDate.toISOString()),
            lte(errorReports.createdAt, endDate.toISOString())
          )
        )
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined

      // 獲取基本統計
      const [basicStats] = await this.db
        .select({
          totalErrors: count(),
          uniqueUsers: sql<number>`COUNT(DISTINCT ${errorReports.userId})`
        })
        .from(errorReports)
        .where(whereClause)

      // 按類型統計
      const typeStats = await this.db
        .select({
          errorType: errorReports.errorType,
          count: count()
        })
        .from(errorReports)
        .where(whereClause)
        .groupBy(errorReports.errorType)

      // 按嚴重程度統計
      const severityStats = await this.db
        .select({
          severity: errorReports.severity,
          count: count()
        })
        .from(errorReports)
        .where(whereClause)
        .groupBy(errorReports.severity)

      // 錯誤趨勢（過去30天）
      const trendStats = await this.db
        .select({
          date: sql<string>`DATE(${errorReports.createdAt})`,
          count: count()
        })
        .from(errorReports)
        .where(whereClause)
        .groupBy(sql`DATE(${errorReports.createdAt})`)
        .orderBy(sql`DATE(${errorReports.createdAt})`)

      const errorsByType = typeStats.reduce((acc, item) => {
        acc[item.errorType] = item.count
        return acc
      }, {} as Record<string, number>)

      const errorsBySeverity = severityStats.reduce((acc, item) => {
        acc[item.severity] = item.count
        return acc
      }, {} as Record<string, number>)

      const errorTrend = trendStats.map(item => ({
        date: item.date,
        count: item.count
      }))

      return {
        totalErrors: basicStats?.totalErrors || 0,
        uniqueUsers: basicStats?.uniqueUsers || 0,
        errorsByType,
        errorsBySeverity,
        errorTrend
      }
    } catch (error) {
      this.handleError(error, 'getErrorStats')
    }
  }

  // 獲取最常見的錯誤
  async getCommonErrors(
    restaurantId?: number,
    limit: number = 10
  ) {
    try {
      const conditions = []
      
      if (restaurantId) {
        conditions.push(eq(errorReports.restaurantId, restaurantId))
      }

      // 只查看最近7天的錯誤
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      conditions.push(gte(errorReports.createdAt, sevenDaysAgo.toISOString()))

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined

      return await this.db
        .select({
          errorMessage: errorReports.errorMessage,
          errorType: errorReports.errorType,
          severity: errorReports.severity,
          count: count(),
          latestOccurrence: sql<string>`MAX(${errorReports.createdAt})`
        })
        .from(errorReports)
        .where(whereClause)
        .groupBy(errorReports.errorMessage, errorReports.errorType, errorReports.severity)
        .having(sql`COUNT(*) >= 3`) // 至少出現3次才算常見錯誤
        .orderBy(desc(count()))
        .limit(limit)
    } catch (error) {
      this.handleError(error, 'getCommonErrors')
    }
  }

  // 清理舊的錯誤報告
  async cleanupOldErrorReports(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

      const result = await this.db
        .delete(errorReports)
        .where(
          and(
            lte(errorReports.createdAt, cutoffDate.toISOString()),
            // 不刪除 critical 和 high 級別的錯誤
            sql`${errorReports.severity} NOT IN ('critical', 'high')`
          )
        )

      return 0 // TODO: Drizzle ORM doesn't return changes count directly
    } catch (error) {
      this.handleError(error, 'cleanupOldErrorReports')
    }
  }

  // 創建系統警報
  async createSystemAlert(data: {
    title: string
    description: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    alertType: string
    restaurantId?: number
    affectedComponent?: string
  }): Promise<SystemAlert> {
    try {
      const [alert] = await this.db
        .insert(systemAlerts)
        .values({
          ...data,
          createdAt: new Date().toISOString()
        })
        .returning()

      return alert
    } catch (error) {
      this.handleError(error, 'createSystemAlert')
    }
  }

  // 獲取未解決的系統警報
  async getUnresolvedAlerts(restaurantId?: number) {
    try {
      const conditions = [isNull(systemAlerts.resolvedAt)]
      
      if (restaurantId) {
        conditions.push(eq(systemAlerts.restaurantId, restaurantId))
      }

      return await this.db
        .select()
        .from(systemAlerts)
        .where(and(...conditions))
        .leftJoin(restaurants, eq(systemAlerts.restaurantId, restaurants.id))
        .orderBy(desc(systemAlerts.severity), desc(systemAlerts.createdAt))
    } catch (error) {
      this.handleError(error, 'getUnresolvedAlerts')
    }
  }
}
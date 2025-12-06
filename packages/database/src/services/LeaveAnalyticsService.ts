/**
 * Leave Analytics Service
 * Provides comprehensive analytics and insights for leave management
 */

import type { D1Database } from '@cloudflare/workers-types'

// ========================================
// Types
// ========================================

export interface LeaveUsageStats {
  totalRequests: number
  approvedRequests: number
  rejectedRequests: number
  pendingRequests: number
  cancelledRequests: number
  approvalRate: number
  rejectionRate: number
  averageDaysPerRequest: number
  totalDaysUsed: number
}

export interface LeaveTypeSummary {
  leaveTypeId: number
  leaveTypeName: string
  leaveTypeCode: string
  totalRequests: number
  totalDays: number
  approvedRequests: number
  rejectedRequests: number
  pendingRequests: number
  averageDaysPerRequest: number
  mostCommonMonth?: string
}

export interface EmployeeLeaveStats {
  employeeId: number
  employeeName: string
  email: string
  role: string
  totalRequests: number
  totalDaysUsed: number
  remainingDays: number
  mostUsedLeaveType: string
  lastLeaveDate?: string
}

export interface LeaveTrend {
  period: string // YYYY-MM or YYYY-Wxx
  totalRequests: number
  totalDays: number
  approvedRequests: number
  rejectedRequests: number
}

export interface LeaveDistribution {
  leaveType: string
  count: number
  percentage: number
  totalDays: number
}

export interface DepartmentLeaveStats {
  department: string
  totalEmployees: number
  totalRequests: number
  averageRequestsPerEmployee: number
  totalDaysUsed: number
  averageDaysPerEmployee: number
  mostCommonLeaveType: string
}

export interface PeakLeaveAnalysis {
  month: string
  weekOfYear: string
  dayOfWeek: string
  totalRequests: number
  averageRequestsPerDay: number
  highestDemandDays: Array<{
    date: string
    requestCount: number
    employeesOnLeave: number
  }>
}

export interface LeaveBalanceAnalytics {
  averageBalance: number
  medianBalance: number
  employeesWithLowBalance: number
  employeesWithZeroBalance: number
  totalUnusedDays: number
  expiringDays: number
  carryoverDays: number
}

// ========================================
// Service Class
// ========================================

export class LeaveAnalyticsService {
  constructor(private db: D1Database) {}

  /**
   * Get overall leave usage statistics
   */
  async getLeaveUsageStats(
    restaurantId: string,
    startDate: string,
    endDate: string
  ): Promise<LeaveUsageStats> {
    const result = await this.db
      .prepare(`
        SELECT
          COUNT(*) as total_requests,
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_requests,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_requests,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_requests,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_requests,
          AVG(total_days) as avg_days_per_request,
          SUM(CASE WHEN status = 'approved' THEN total_days ELSE 0 END) as total_days_used
        FROM leave_requests
        WHERE restaurant_id = ?
          AND start_date >= ?
          AND end_date <= ?
      `)
      .bind(restaurantId, startDate, endDate)
      .first<any>()

    if (!result) {
      return this.getEmptyUsageStats()
    }

    const totalRequests = result.total_requests || 0
    const approvedRequests = result.approved_requests || 0
    const rejectedRequests = result.rejected_requests || 0

    return {
      totalRequests,
      approvedRequests,
      rejectedRequests,
      pendingRequests: result.pending_requests || 0,
      cancelledRequests: result.cancelled_requests || 0,
      approvalRate: totalRequests > 0 ? (approvedRequests / totalRequests) * 100 : 0,
      rejectionRate: totalRequests > 0 ? (rejectedRequests / totalRequests) * 100 : 0,
      averageDaysPerRequest: result.avg_days_per_request || 0,
      totalDaysUsed: result.total_days_used || 0
    }
  }

  /**
   * Get leave type summary
   */
  async getLeaveTypeSummary(
    restaurantId: string,
    startDate: string,
    endDate: string
  ): Promise<LeaveTypeSummary[]> {
    const results = await this.db
      .prepare(`
        SELECT
          lt.id as leave_type_id,
          lt.name as leave_type_name,
          lt.code as leave_type_code,
          COUNT(lr.id) as total_requests,
          SUM(lr.total_days) as total_days,
          SUM(CASE WHEN lr.status = 'approved' THEN 1 ELSE 0 END) as approved_requests,
          SUM(CASE WHEN lr.status = 'rejected' THEN 1 ELSE 0 END) as rejected_requests,
          SUM(CASE WHEN lr.status = 'pending' THEN 1 ELSE 0 END) as pending_requests,
          AVG(lr.total_days) as avg_days_per_request
        FROM leave_types lt
        LEFT JOIN leave_requests lr ON lt.id = lr.leave_type_id
          AND lr.restaurant_id = ?
          AND lr.start_date >= ?
          AND lr.end_date <= ?
        WHERE lt.restaurant_id = ? OR lt.restaurant_id IS NULL
        GROUP BY lt.id, lt.name, lt.code
        ORDER BY total_requests DESC
      `)
      .bind(restaurantId, startDate, endDate, restaurantId)
      .all<any>()

    return (results.results || []).map(row => ({
      leaveTypeId: row.leave_type_id,
      leaveTypeName: row.leave_type_name,
      leaveTypeCode: row.leave_type_code,
      totalRequests: row.total_requests || 0,
      totalDays: row.total_days || 0,
      approvedRequests: row.approved_requests || 0,
      rejectedRequests: row.rejected_requests || 0,
      pendingRequests: row.pending_requests || 0,
      averageDaysPerRequest: row.avg_days_per_request || 0
    }))
  }

  /**
   * Get employee leave statistics
   */
  async getEmployeeLeaveStats(
    restaurantId: string,
    year: number,
    limit: number = 50
  ): Promise<EmployeeLeaveStats[]> {
    const results = await this.db
      .prepare(`
        SELECT
          u.id as employee_id,
          u.full_name as employee_name,
          u.email,
          u.role,
          COUNT(lr.id) as total_requests,
          SUM(CASE WHEN lr.status = 'approved' THEN lr.total_days ELSE 0 END) as total_days_used,
          SUM(lb.remaining_days) as remaining_days,
          MAX(lr.end_date) as last_leave_date
        FROM users u
        LEFT JOIN leave_requests lr ON u.id = lr.employee_id
          AND strftime('%Y', lr.start_date) = ?
        LEFT JOIN employee_leave_balances lb ON u.id = lb.employee_id
          AND lb.year = ?
        WHERE u.restaurant_id = ?
        GROUP BY u.id, u.full_name, u.email, u.role
        ORDER BY total_days_used DESC
        LIMIT ?
      `)
      .bind(String(year), year, restaurantId, limit)
      .all<any>()

    return (results.results || []).map(row => ({
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      email: row.email,
      role: row.role,
      totalRequests: row.total_requests || 0,
      totalDaysUsed: row.total_days_used || 0,
      remainingDays: row.remaining_days || 0,
      mostUsedLeaveType: 'N/A', // TODO: Add subquery
      lastLeaveDate: row.last_leave_date
    }))
  }

  /**
   * Get leave trends over time
   */
  async getLeaveTrends(
    restaurantId: string,
    startDate: string,
    endDate: string,
    groupBy: 'month' | 'week' = 'month'
  ): Promise<LeaveTrend[]> {
    const dateFormat = groupBy === 'month' ? '%Y-%m' : '%Y-W%W'

    const results = await this.db
      .prepare(`
        SELECT
          strftime('${dateFormat}', start_date) as period,
          COUNT(*) as total_requests,
          SUM(total_days) as total_days,
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_requests,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_requests
        FROM leave_requests
        WHERE restaurant_id = ?
          AND start_date >= ?
          AND end_date <= ?
        GROUP BY period
        ORDER BY period ASC
      `)
      .bind(restaurantId, startDate, endDate)
      .all<any>()

    return (results.results || []).map(row => ({
      period: row.period,
      totalRequests: row.total_requests || 0,
      totalDays: row.total_days || 0,
      approvedRequests: row.approved_requests || 0,
      rejectedRequests: row.rejected_requests || 0
    }))
  }

  /**
   * Get leave distribution by type
   */
  async getLeaveDistribution(
    restaurantId: string,
    startDate: string,
    endDate: string
  ): Promise<LeaveDistribution[]> {
    const results = await this.db
      .prepare(`
        SELECT
          lt.name as leave_type,
          COUNT(lr.id) as count,
          SUM(lr.total_days) as total_days
        FROM leave_types lt
        LEFT JOIN leave_requests lr ON lt.id = lr.leave_type_id
          AND lr.restaurant_id = ?
          AND lr.start_date >= ?
          AND lr.end_date <= ?
          AND lr.status = 'approved'
        WHERE lt.restaurant_id = ? OR lt.restaurant_id IS NULL
        GROUP BY lt.id, lt.name
        ORDER BY count DESC
      `)
      .bind(restaurantId, startDate, endDate, restaurantId)
      .all<any>()

    const total = (results.results || []).reduce((sum, row) => sum + (row.count || 0), 0)

    return (results.results || []).map(row => ({
      leaveType: row.leave_type,
      count: row.count || 0,
      percentage: total > 0 ? ((row.count || 0) / total) * 100 : 0,
      totalDays: row.total_days || 0
    }))
  }

  /**
   * Get peak leave periods
   */
  async getPeakLeaveAnalysis(
    restaurantId: string,
    year: number
  ): Promise<PeakLeaveAnalysis> {
    // Get most common month
    const monthResult = await this.db
      .prepare(`
        SELECT strftime('%Y-%m', start_date) as month, COUNT(*) as count
        FROM leave_requests
        WHERE restaurant_id = ? AND strftime('%Y', start_date) = ?
        GROUP BY month
        ORDER BY count DESC
        LIMIT 1
      `)
      .bind(restaurantId, String(year))
      .first<any>()

    // Get most common week
    const weekResult = await this.db
      .prepare(`
        SELECT strftime('%Y-W%W', start_date) as week, COUNT(*) as count
        FROM leave_requests
        WHERE restaurant_id = ? AND strftime('%Y', start_date) = ?
        GROUP BY week
        ORDER BY count DESC
        LIMIT 1
      `)
      .bind(restaurantId, String(year))
      .first<any>()

    // Get most common day of week
    const dayResult = await this.db
      .prepare(`
        SELECT
          CASE strftime('%w', start_date)
            WHEN '0' THEN 'Sunday'
            WHEN '1' THEN 'Monday'
            WHEN '2' THEN 'Tuesday'
            WHEN '3' THEN 'Wednesday'
            WHEN '4' THEN 'Thursday'
            WHEN '5' THEN 'Friday'
            WHEN '6' THEN 'Saturday'
          END as day_of_week,
          COUNT(*) as count
        FROM leave_requests
        WHERE restaurant_id = ? AND strftime('%Y', start_date) = ?
        GROUP BY day_of_week
        ORDER BY count DESC
        LIMIT 1
      `)
      .bind(restaurantId, String(year))
      .first<any>()

    return {
      month: monthResult?.month || 'N/A',
      weekOfYear: weekResult?.week || 'N/A',
      dayOfWeek: dayResult?.day_of_week || 'N/A',
      totalRequests: monthResult?.count || 0,
      averageRequestsPerDay: 0, // TODO: Calculate
      highestDemandDays: [] // TODO: Get top 5 days
    }
  }

  /**
   * Get leave balance analytics
   */
  async getLeaveBalanceAnalytics(
    restaurantId: string,
    year: number
  ): Promise<LeaveBalanceAnalytics> {
    const result = await this.db
      .prepare(`
        SELECT
          AVG(lb.remaining_days) as avg_balance,
          SUM(lb.remaining_days) as total_unused,
          SUM(lb.carryover_days) as total_carryover,
          SUM(CASE WHEN lb.remaining_days < 3 THEN 1 ELSE 0 END) as low_balance_count,
          SUM(CASE WHEN lb.remaining_days = 0 THEN 1 ELSE 0 END) as zero_balance_count
        FROM employee_leave_balances lb
        JOIN users u ON lb.employee_id = u.id
        WHERE u.restaurant_id = ? AND lb.year = ?
      `)
      .bind(restaurantId, year)
      .first<any>()

    if (!result) {
      return {
        averageBalance: 0,
        medianBalance: 0,
        employeesWithLowBalance: 0,
        employeesWithZeroBalance: 0,
        totalUnusedDays: 0,
        expiringDays: 0,
        carryoverDays: 0
      }
    }

    return {
      averageBalance: result.avg_balance || 0,
      medianBalance: 0, // TODO: Calculate median
      employeesWithLowBalance: result.low_balance_count || 0,
      employeesWithZeroBalance: result.zero_balance_count || 0,
      totalUnusedDays: result.total_unused || 0,
      expiringDays: 0, // TODO: Calculate expiring
      carryoverDays: result.total_carryover || 0
    }
  }

  /**
   * Get comprehensive dashboard data
   */
  async getDashboardData(
    restaurantId: string,
    year: number
  ): Promise<{
    usageStats: LeaveUsageStats
    leaveTypeSummary: LeaveTypeSummary[]
    trends: LeaveTrend[]
    distribution: LeaveDistribution[]
    balanceAnalytics: LeaveBalanceAnalytics
    peakAnalysis: PeakLeaveAnalysis
  }> {
    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`

    const [
      usageStats,
      leaveTypeSummary,
      trends,
      distribution,
      balanceAnalytics,
      peakAnalysis
    ] = await Promise.all([
      this.getLeaveUsageStats(restaurantId, startDate, endDate),
      this.getLeaveTypeSummary(restaurantId, startDate, endDate),
      this.getLeaveTrends(restaurantId, startDate, endDate, 'month'),
      this.getLeaveDistribution(restaurantId, startDate, endDate),
      this.getLeaveBalanceAnalytics(restaurantId, year),
      this.getPeakLeaveAnalysis(restaurantId, year)
    ])

    return {
      usageStats,
      leaveTypeSummary,
      trends,
      distribution,
      balanceAnalytics,
      peakAnalysis
    }
  }

  /**
   * Helper: Get empty usage stats
   */
  private getEmptyUsageStats(): LeaveUsageStats {
    return {
      totalRequests: 0,
      approvedRequests: 0,
      rejectedRequests: 0,
      pendingRequests: 0,
      cancelledRequests: 0,
      approvalRate: 0,
      rejectionRate: 0,
      averageDaysPerRequest: 0,
      totalDaysUsed: 0
    }
  }
}

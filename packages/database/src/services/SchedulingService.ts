/**
 * Employee Scheduling Service
 * Business logic for employee work scheduling management
 */

import { eq, and, gte, lte, between, sql, desc, asc, or, inArray } from 'drizzle-orm'
import type { D1Database } from '@cloudflare/workers-types'
import { BaseService, type CloudflareEnv } from './base'
import {
  shiftTemplates,
  employeeSchedules,
  schedulingRules,
  schedulingConflicts,
  scheduleSwapRequests,
  employeeAvailability,
  users,
  leaveRequests,
} from '../schema'

// ========================================
// Types
// ========================================

export interface ShiftTemplate {
  id: number
  restaurantId: number
  name: string
  description: string | null
  shiftType: 'regular' | 'split' | 'overnight'
  startTime: string
  endTime: string
  durationMinutes: number
  isSplitShift: boolean
  breakStartTime: string | null
  breakEndTime: string | null
  breakDurationMinutes: number
  applicableDays: string
  minEmployees: number
  maxEmployees: number
  hourlyRate: number | null
  overtimeMultiplier: number
  colorCode: string
  icon: string | null
  sortOrder: number
  isActive: boolean
  createdBy: number | null
  updatedBy: number | null
  createdAt: Date
  updatedAt: Date
}

export interface EmployeeSchedule {
  id: number
  restaurantId: number
  employeeId: number
  shiftTemplateId: number | null
  workDate: string
  startTime: string
  endTime: string
  breakDurationMinutes: number
  clockInTime: Date | null
  clockOutTime: Date | null
  scheduledHours: number
  actualHours: number
  overtimeHours: number
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
  notes: string | null
  managerNotes: string | null
  confirmedBy: number | null
  confirmedAt: Date | null
  createdBy: number
  updatedBy: number | null
  createdAt: Date
  updatedAt: Date
}

export interface SchedulingConflict {
  id: number
  restaurantId: number
  conflictType: 'overlapping_shifts' | 'insufficient_rest' | 'max_hours_exceeded' | 'consecutive_days_exceeded' | 'skill_mismatch' | 'leave_conflict' | 'availability_conflict'
  severity: 'error' | 'warning' | 'info'
  scheduleIds: string
  employeeIds: string
  ruleId: number | null
  message: string
  details: string | null
  status: 'unresolved' | 'acknowledged' | 'resolved' | 'ignored'
  resolvedBy: number | null
  resolvedAt: Date | null
  resolutionNotes: string | null
  detectedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface ScheduleSwapRequest {
  id: number
  restaurantId: number
  requesterEmployeeId: number
  requesterScheduleId: number
  targetEmployeeId: number | null
  targetScheduleId: number | null
  requestType: 'swap' | 'cover' | 'drop'
  reason: string
  urgency: 'low' | 'normal' | 'high' | 'urgent'
  isOpenRequest: boolean
  status: 'pending' | 'accepted' | 'approved' | 'rejected' | 'cancelled' | 'expired'
  acceptedBy: number | null
  acceptedAt: Date | null
  approvedBy: number | null
  approvedAt: Date | null
  rejectedBy: number | null
  rejectedAt: Date | null
  rejectionReason: string | null
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface ConflictCheckResult {
  hasConflicts: boolean
  conflicts: SchedulingConflict[]
  warnings: SchedulingConflict[]
  info: SchedulingConflict[]
}

export interface ScheduleFilters {
  restaurantId?: number
  employeeId?: number
  shiftTemplateId?: number
  startDate?: string
  endDate?: string
  status?: EmployeeSchedule['status']
  page?: number
  limit?: number
}

export interface BulkScheduleData {
  restaurantId: number
  shiftTemplateId: number
  employeeIds: number[]
  dateRange: { startDate: string; endDate: string }
  daysOfWeek: number[]
  createdBy: number
}

export interface ClockInData {
  scheduleId: number
  employeeId: number
  clockInTime: Date
  notes?: string
}

export interface ClockOutData {
  scheduleId: number
  employeeId: number
  clockOutTime: Date
  notes?: string
}

// ========================================
// Scheduling Service
// ========================================

export class SchedulingService extends BaseService {
  constructor(d1: D1Database, env: CloudflareEnv) {
    super(d1, env)
  }

  // ========================================
  // Shift Template Management
  // ========================================

  async getShiftTemplates(restaurantId: number): Promise<ShiftTemplate[]> {
    const templates = await this.db
      .select()
      .from(shiftTemplates)
      .where(eq(shiftTemplates.restaurantId, restaurantId))
      .orderBy(asc(shiftTemplates.sortOrder), asc(shiftTemplates.name))

    return templates as ShiftTemplate[]
  }

  async getShiftTemplate(id: number): Promise<ShiftTemplate | null> {
    const [template] = await this.db
      .select()
      .from(shiftTemplates)
      .where(eq(shiftTemplates.id, id))
      .limit(1)

    return (template as ShiftTemplate) || null
  }

  async createShiftTemplate(data: any): Promise<ShiftTemplate> {
    const [newTemplate] = await this.db
      .insert(shiftTemplates)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    return newTemplate as ShiftTemplate
  }

  async updateShiftTemplate(id: number, data: any): Promise<ShiftTemplate> {
    const [updated] = await this.db
      .update(shiftTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(shiftTemplates.id, id))
      .returning()

    if (!updated) {
      throw new Error('Shift template not found')
    }

    return updated as ShiftTemplate
  }

  async deleteShiftTemplate(id: number): Promise<boolean> {
    const [deleted] = await this.db
      .update(shiftTemplates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(shiftTemplates.id, id))
      .returning()

    return !!deleted
  }

  // ========================================
  // Employee Schedule Management
  // ========================================

  async getSchedules(filters: ScheduleFilters): Promise<{ items: any[]; total: number }> {
    const { page = 1, limit = 20, ...restFilters } = filters
    const { limit: pgLimit, offset } = this.createPagination(page, limit)

    const conditions = []
    if (restFilters.restaurantId) {
      conditions.push(eq(employeeSchedules.restaurantId, restFilters.restaurantId))
    }
    if (restFilters.employeeId) {
      conditions.push(eq(employeeSchedules.employeeId, restFilters.employeeId))
    }
    if (restFilters.shiftTemplateId) {
      conditions.push(eq(employeeSchedules.shiftTemplateId, restFilters.shiftTemplateId))
    }
    if (restFilters.status) {
      conditions.push(eq(employeeSchedules.status, restFilters.status))
    }
    if (restFilters.startDate && restFilters.endDate) {
      conditions.push(
        between(employeeSchedules.workDate, restFilters.startDate, restFilters.endDate)
      )
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(employeeSchedules)
      .where(whereClause)

    const total = Number(countResult.count)

    const schedules = await this.db
      .select({
        schedule: employeeSchedules,
        employee: {
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        },
        shiftTemplate: shiftTemplates,
      })
      .from(employeeSchedules)
      .leftJoin(users, eq(employeeSchedules.employeeId, users.id))
      .leftJoin(shiftTemplates, eq(employeeSchedules.shiftTemplateId, shiftTemplates.id))
      .where(whereClause)
      .orderBy(desc(employeeSchedules.workDate), asc(employeeSchedules.startTime))
      .limit(pgLimit)
      .offset(offset)

    const items = schedules.map((row) => ({
      ...row.schedule,
      employee: row.employee,
      shiftTemplate: row.shiftTemplate,
    }))

    return { items, total }
  }

  async getSchedule(id: number): Promise<any> {
    const [result] = await this.db
      .select({
        schedule: employeeSchedules,
        employee: { id: users.id, fullName: users.fullName, role: users.role },
        shiftTemplate: shiftTemplates,
      })
      .from(employeeSchedules)
      .leftJoin(users, eq(employeeSchedules.employeeId, users.id))
      .leftJoin(shiftTemplates, eq(employeeSchedules.shiftTemplateId, shiftTemplates.id))
      .where(eq(employeeSchedules.id, id))
      .limit(1)

    if (!result) return null

    return {
      ...result.schedule,
      employee: result.employee,
      shiftTemplate: result.shiftTemplate,
    }
  }

  async createSchedule(data: any): Promise<EmployeeSchedule> {
    // Check for conflicts
    const conflicts = await this.checkScheduleConflicts(data)

    if (conflicts.conflicts.length > 0) {
      // Store conflicts but allow creation with warnings
      for (const conflict of conflicts.conflicts) {
        await this.createConflictRecord(conflict)
      }
    }

    const [newSchedule] = await this.db
      .insert(employeeSchedules)
      .values({
        ...data,
        status: 'scheduled',
        actualHours: 0,
        overtimeHours: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    return newSchedule as EmployeeSchedule
  }

  async updateSchedule(id: number, data: any): Promise<EmployeeSchedule> {
    const [updated] = await this.db
      .update(employeeSchedules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(employeeSchedules.id, id))
      .returning()

    if (!updated) {
      throw new Error('Schedule not found')
    }

    return updated as EmployeeSchedule
  }

  async deleteSchedule(id: number): Promise<boolean> {
    const [deleted] = await this.db
      .update(employeeSchedules)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(employeeSchedules.id, id))
      .returning()

    return !!deleted
  }

  async bulkCreateSchedules(data: BulkScheduleData): Promise<number> {
    let count = 0
    const startDate = new Date(data.dateRange.startDate)
    const endDate = new Date(data.dateRange.endDate)

    const template = await this.getShiftTemplate(data.shiftTemplateId)
    if (!template) {
      throw new Error('Shift template not found')
    }

    const currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay()

      if (data.daysOfWeek.includes(dayOfWeek)) {
        for (const employeeId of data.employeeIds) {
          try {
            await this.createSchedule({
              restaurantId: data.restaurantId,
              employeeId,
              shiftTemplateId: data.shiftTemplateId,
              workDate: currentDate.toISOString().split('T')[0],
              startTime: template.startTime,
              endTime: template.endTime,
              breakDurationMinutes: template.breakDurationMinutes,
              scheduledHours: template.durationMinutes / 60,
              createdBy: data.createdBy,
            })
            count++
          } catch (error) {
            console.error(`Failed to create schedule for employee ${employeeId}:`, error)
          }
        }
      }

      currentDate.setDate(currentDate.getDate() + 1)
    }

    return count
  }

  // ========================================
  // Clock In/Out
  // ========================================

  async clockIn(data: ClockInData): Promise<EmployeeSchedule> {
    const schedule = await this.getSchedule(data.scheduleId)
    if (!schedule) {
      throw new Error('Schedule not found')
    }

    if (schedule.employeeId !== data.employeeId) {
      throw new Error('Unauthorized')
    }

    if (schedule.clockInTime) {
      throw new Error('Already clocked in')
    }

    const [updated] = await this.db
      .update(employeeSchedules)
      .set({
        clockInTime: data.clockInTime,
        status: 'confirmed',
        notes: data.notes || schedule.notes,
        updatedAt: new Date(),
      })
      .where(eq(employeeSchedules.id, data.scheduleId))
      .returning()

    return updated as EmployeeSchedule
  }

  async clockOut(data: ClockOutData): Promise<EmployeeSchedule> {
    const schedule = await this.getSchedule(data.scheduleId)
    if (!schedule) {
      throw new Error('Schedule not found')
    }

    if (schedule.employeeId !== data.employeeId) {
      throw new Error('Unauthorized')
    }

    if (!schedule.clockInTime) {
      throw new Error('Must clock in first')
    }

    if (schedule.clockOutTime) {
      throw new Error('Already clocked out')
    }

    const clockInTime = schedule.clockInTime!
    const actualHours = (data.clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60)
    const overtimeHours = Math.max(0, actualHours - schedule.scheduledHours)

    const [updated] = await this.db
      .update(employeeSchedules)
      .set({
        clockOutTime: data.clockOutTime,
        actualHours,
        overtimeHours,
        status: 'completed',
        notes: data.notes || schedule.notes,
        updatedAt: new Date(),
      })
      .where(eq(employeeSchedules.id, data.scheduleId))
      .returning()

    return updated as EmployeeSchedule
  }

  // ========================================
  // Conflict Detection Engine
  // ========================================

  async checkScheduleConflicts(scheduleData: any): Promise<ConflictCheckResult> {
    const conflicts: any[] = []
    const warnings: any[] = []
    const info: any[] = []

    // Check overlapping shifts
    const overlapping = await this.checkOverlappingShifts(
      scheduleData.employeeId,
      scheduleData.workDate,
      scheduleData.startTime,
      scheduleData.endTime
    )
    conflicts.push(...overlapping)

    // Check rest period (11 hours)
    const restViolations = await this.checkRestPeriod(
      scheduleData.employeeId,
      scheduleData.workDate,
      scheduleData.startTime
    )
    conflicts.push(...restViolations)

    // Check daily hours (max 12 hours)
    const dailyHours = await this.checkDailyHours(
      scheduleData.employeeId,
      scheduleData.workDate,
      scheduleData.scheduledHours
    )
    if (dailyHours) warnings.push(dailyHours)

    // Check weekly hours (max 46 hours)
    const weeklyHours = await this.checkWeeklyHours(
      scheduleData.employeeId,
      scheduleData.workDate,
      scheduleData.scheduledHours
    )
    if (weeklyHours) warnings.push(weeklyHours)

    // Check consecutive days (max 6 days)
    const consecutiveDays = await this.checkConsecutiveDays(
      scheduleData.employeeId,
      scheduleData.workDate
    )
    if (consecutiveDays) warnings.push(consecutiveDays)

    // Check leave conflicts
    const leaveConflict = await this.checkLeaveConflict(
      scheduleData.employeeId,
      scheduleData.workDate
    )
    if (leaveConflict) conflicts.push(leaveConflict)

    return {
      hasConflicts: conflicts.length > 0 || warnings.length > 0,
      conflicts,
      warnings,
      info,
    }
  }

  private async checkOverlappingShifts(
    employeeId: number,
    workDate: string,
    startTime: string,
    endTime: string
  ): Promise<any[]> {
    const existingSchedules = await this.db
      .select()
      .from(employeeSchedules)
      .where(
        and(
          eq(employeeSchedules.employeeId, employeeId),
          eq(employeeSchedules.workDate, workDate),
          sql`${employeeSchedules.status} != 'cancelled'`
        )
      )

    const conflicts = []
    for (const schedule of existingSchedules) {
      if (this.timesOverlap(startTime, endTime, schedule.startTime, schedule.endTime)) {
        conflicts.push({
          conflictType: 'overlapping_shifts',
          severity: 'error',
          message: `Overlapping shift detected: ${schedule.startTime}-${schedule.endTime}`,
          scheduleIds: JSON.stringify([schedule.id]),
          employeeIds: JSON.stringify([employeeId]),
        })
      }
    }

    return conflicts
  }

  private async checkRestPeriod(
    employeeId: number,
    workDate: string,
    startTime: string
  ): Promise<any[]> {
    const yesterday = new Date(workDate)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    const previousSchedules = await this.db
      .select()
      .from(employeeSchedules)
      .where(
        and(
          eq(employeeSchedules.employeeId, employeeId),
          eq(employeeSchedules.workDate, yesterdayStr),
          sql`${employeeSchedules.status} != 'cancelled'`
        )
      )

    const conflicts = []
    for (const prevSchedule of previousSchedules) {
      const restHours = this.calculateRestHours(prevSchedule.endTime, startTime)
      if (restHours < 11) {
        conflicts.push({
          conflictType: 'insufficient_rest',
          severity: 'error',
          message: `Insufficient rest period: ${restHours.toFixed(1)} hours (minimum 11 hours required)`,
          scheduleIds: JSON.stringify([prevSchedule.id]),
          employeeIds: JSON.stringify([employeeId]),
        })
      }
    }

    return conflicts
  }

  private async checkDailyHours(
    employeeId: number,
    workDate: string,
    additionalHours: number
  ): Promise<any | null> {
    const [result] = await this.db
      .select({ totalHours: sql<number>`SUM(${employeeSchedules.scheduledHours})` })
      .from(employeeSchedules)
      .where(
        and(
          eq(employeeSchedules.employeeId, employeeId),
          eq(employeeSchedules.workDate, workDate),
          sql`${employeeSchedules.status} != 'cancelled'`
        )
      )

    const currentHours = Number(result?.totalHours || 0)
    const newTotal = currentHours + additionalHours

    if (newTotal > 12) {
      return {
        conflictType: 'max_hours_exceeded',
        severity: 'warning',
        message: `Daily hours exceeded: ${newTotal} hours (maximum 12 hours)`,
        employeeIds: JSON.stringify([employeeId]),
      }
    }

    return null
  }

  private async checkWeeklyHours(
    employeeId: number,
    workDate: string,
    additionalHours: number
  ): Promise<any | null> {
    const date = new Date(workDate)
    const weekStart = new Date(date)
    weekStart.setDate(date.getDate() - date.getDay())
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)

    const [result] = await this.db
      .select({ totalHours: sql<number>`SUM(${employeeSchedules.scheduledHours})` })
      .from(employeeSchedules)
      .where(
        and(
          eq(employeeSchedules.employeeId, employeeId),
          between(
            employeeSchedules.workDate,
            weekStart.toISOString().split('T')[0],
            weekEnd.toISOString().split('T')[0]
          ),
          sql`${employeeSchedules.status} != 'cancelled'`
        )
      )

    const currentHours = Number(result?.totalHours || 0)
    const newTotal = currentHours + additionalHours

    if (newTotal > 46) {
      return {
        conflictType: 'max_hours_exceeded',
        severity: 'warning',
        message: `Weekly hours exceeded: ${newTotal} hours (maximum 46 hours)`,
        employeeIds: JSON.stringify([employeeId]),
      }
    }

    return null
  }

  private async checkConsecutiveDays(
    employeeId: number,
    workDate: string
  ): Promise<any | null> {
    const date = new Date(workDate)
    let consecutiveDays = 1

    // Check backwards
    for (let i = 1; i <= 7; i++) {
      const checkDate = new Date(date)
      checkDate.setDate(date.getDate() - i)

      const [schedule] = await this.db
        .select()
        .from(employeeSchedules)
        .where(
          and(
            eq(employeeSchedules.employeeId, employeeId),
            eq(employeeSchedules.workDate, checkDate.toISOString().split('T')[0]),
            sql`${employeeSchedules.status} != 'cancelled'`
          )
        )
        .limit(1)

      if (schedule) {
        consecutiveDays++
      } else {
        break
      }
    }

    if (consecutiveDays > 6) {
      return {
        conflictType: 'consecutive_days_exceeded',
        severity: 'warning',
        message: `Consecutive work days exceeded: ${consecutiveDays} days (maximum 6 days)`,
        employeeIds: JSON.stringify([employeeId]),
      }
    }

    return null
  }

  private async checkLeaveConflict(
    employeeId: number,
    workDate: string
  ): Promise<any | null> {
    const [leave] = await this.db
      .select()
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.employeeId, employeeId),
          eq(leaveRequests.status, 'approved'),
          lte(leaveRequests.startDate, workDate),
          gte(leaveRequests.endDate, workDate)
        )
      )
      .limit(1)

    if (leave) {
      return {
        conflictType: 'leave_conflict',
        severity: 'error',
        message: `Employee has approved leave on this date`,
        employeeIds: JSON.stringify([employeeId]),
        details: JSON.stringify({ leaveRequestId: leave.id }),
      }
    }

    return null
  }

  private async createConflictRecord(conflictData: any): Promise<void> {
    await this.db.insert(schedulingConflicts).values({
      ...conflictData,
      restaurantId: conflictData.restaurantId || 0,
      scheduleIds: conflictData.scheduleIds || '[]',
      employeeIds: conflictData.employeeIds || '[]',
      status: 'unresolved',
      detectedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  // ========================================
  // Helper Methods
  // ========================================

  private timesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
    const [s1h, s1m] = start1.split(':').map(Number)
    const [e1h, e1m] = end1.split(':').map(Number)
    const [s2h, s2m] = start2.split(':').map(Number)
    const [e2h, e2m] = end2.split(':').map(Number)

    const start1Min = s1h * 60 + s1m
    let end1Min = e1h * 60 + e1m
    const start2Min = s2h * 60 + s2m
    let end2Min = e2h * 60 + e2m

    if (end1Min <= start1Min) end1Min += 24 * 60
    if (end2Min <= start2Min) end2Min += 24 * 60

    return start1Min < end2Min && end1Min > start2Min
  }

  private calculateRestHours(endTime: string, startTime: string): number {
    const [eh, em] = endTime.split(':').map(Number)
    const [sh, sm] = startTime.split(':').map(Number)

    let endMin = eh * 60 + em
    let startMin = sh * 60 + sm

    if (startMin <= endMin) {
      startMin += 24 * 60
    }

    return (startMin - endMin) / 60
  }

  // ========================================
  // Swap Requests (simplified)
  // ========================================

  async createSwapRequest(data: any): Promise<ScheduleSwapRequest> {
    const [request] = await this.db
      .insert(scheduleSwapRequests)
      .values({
        ...data,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    return request as ScheduleSwapRequest
  }

  async approveSwapRequest(requestId: number, managerId: number): Promise<ScheduleSwapRequest> {
    const [updated] = await this.db
      .update(scheduleSwapRequests)
      .set({
        status: 'approved',
        approvedBy: managerId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(scheduleSwapRequests.id, requestId))
      .returning()

    if (!updated) {
      throw new Error('Swap request not found')
    }

    return updated as ScheduleSwapRequest
  }

  // ========================================
  // Leave-Schedule Integration
  // ========================================

  /**
   * Cancel all schedules for an employee within a date range
   * Used when leave is approved to automatically cancel scheduled shifts
   */
  async cancelSchedulesByDateRange(params: {
    employeeId: number
    startDate: string
    endDate: string
    reason: string
    cancelledBy: number
  }): Promise<{ cancelledCount: number; scheduleIds: number[] }> {
    try {
      // Find all non-cancelled schedules in the date range
      const schedulesToCancel = await this.db
        .select()
        .from(employeeSchedules)
        .where(
          and(
            eq(employeeSchedules.employeeId, params.employeeId),
            between(employeeSchedules.workDate, params.startDate, params.endDate),
            sql`${employeeSchedules.status} != 'cancelled'`
          )
        )

      if (schedulesToCancel.length === 0) {
        return { cancelledCount: 0, scheduleIds: [] }
      }

      const scheduleIds = schedulesToCancel.map(s => s.id)

      // Cancel all schedules
      await this.db
        .update(employeeSchedules)
        .set({
          status: 'cancelled',
          managerNotes: params.reason,
          updatedBy: params.cancelledBy,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(employeeSchedules.employeeId, params.employeeId),
            between(employeeSchedules.workDate, params.startDate, params.endDate),
            sql`${employeeSchedules.status} != 'cancelled'`
          )
        )

      return {
        cancelledCount: schedulesToCancel.length,
        scheduleIds,
      }
    } catch (error) {
      console.error('Error cancelling schedules by date range:', error)
      throw error
    }
  }

  /**
   * Get available employees for scheduling
   * Filters out employees on leave and already scheduled
   */
  async getAvailableEmployees(params: {
    restaurantId: number
    date: string
    shiftTemplateId?: number
  }): Promise<any[]> {
    try {
      // Get all active employees in the restaurant
      const allEmployees = await this.db
        .select({
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        })
        .from(users)
        .where(
          and(
            eq(users.restaurantId, params.restaurantId),
            eq(users.isActive, true)
          )
        )

      // Get employees on approved leave for this date
      const employeesOnLeave = await this.db
        .select({ employeeId: leaveRequests.employeeId })
        .from(leaveRequests)
        .where(
          and(
            eq(leaveRequests.status, 'approved'),
            lte(leaveRequests.startDate, params.date),
            gte(leaveRequests.endDate, params.date)
          )
        )

      const onLeaveIds = new Set(employeesOnLeave.map(r => r.employeeId))

      // Get employees already scheduled for this date
      const alreadyScheduled = await this.db
        .select({ employeeId: employeeSchedules.employeeId })
        .from(employeeSchedules)
        .where(
          and(
            eq(employeeSchedules.workDate, params.date),
            sql`${employeeSchedules.status} != 'cancelled'`
          )
        )

      const scheduledIds = new Set(alreadyScheduled.map(s => s.employeeId))

      // Filter available employees
      const availableEmployees = allEmployees
        .filter(emp => !onLeaveIds.has(emp.id) && !scheduledIds.has(emp.id))
        .map(emp => ({
          ...emp,
          availability: 'available',
          reason: 'Available for scheduling',
        }))

      return availableEmployees
    } catch (error) {
      console.error('Error getting available employees:', error)
      throw error
    }
  }
}

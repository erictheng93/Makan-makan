/**
 * Leave Management Service
 * Business logic for employee leave/time-off management
 */

import { eq, and, gte, lte, between, sql, desc, asc, or, inArray } from 'drizzle-orm'
import type { D1Database } from '@cloudflare/workers-types'
import { BaseService, type CloudflareEnv } from './base'
import {
  leaveTypes,
  employeeLeaveBalances,
  leaveRequests,
  leaveApprovalRules,
  leaveCalendarEvents,
  users,
} from '../schema'
import { SchedulingService } from './SchedulingService'
import { NotificationService } from './NotificationService'

// ========================================
// Types
// ========================================

export interface LeaveType {
  id: number
  restaurantId: number | null
  code: string
  name: string
  description: string | null
  accrualType: 'yearly' | 'monthly' | 'none'
  accrualAmount: number
  accrualBasedOnSeniority: boolean
  requiresApproval: boolean
  requiredApprovalLevels: number
  minNoticeDays: number
  maxConsecutiveDays: number | null
  canCarryover: boolean
  carryoverMaxDays: number | null
  carryoverExpiryMonths: number | null
  requiresDocumentation: boolean
  documentationRequiredAfterDays: number | null
  isPaid: boolean
  paymentRate: number
  allowHalfDay: boolean
  gender: 'any' | 'male' | 'female' | null
  applicableToRoles: string | null
  maxUsagePerYear: number | null
  isSystemDefined: boolean
  isActive: boolean
  sortOrder: number
  color: string | null
  icon: string | null
  createdAt: Date
  updatedAt: Date
  createdBy: number | null
  updatedBy: number | null
}

export interface LeaveBalance {
  id: number
  employeeId: number
  leaveTypeId: number
  restaurantId: number
  year: number
  totalDays: number
  usedDays: number
  pendingDays: number
  remainingDays: number // Calculated
  carryoverFromPrevious: number
  carryoverToNext: number
  carryoverExpiresAt: number | null
  manualAdjustment: number
  adjustmentReason: string | null
  adjustedBy: number | null
  adjustedAt: number | null
  createdAt: Date
  updatedAt: Date
  lastUpdatedBy: number | null
}

export interface LeaveRequest {
  id: number
  restaurantId: number
  employeeId: number
  leaveTypeId: number
  startDate: string
  endDate: string
  startPeriod: 'full' | 'am' | 'pm'
  endPeriod: 'full' | 'am' | 'pm'
  totalDays: number
  reason: string
  attachmentUrl: string | null
  emergencyContact: string | null
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'withdrawn'
  approvalChain: string
  currentApprovalLevel: number
  finalApproverId: number | null
  finalApprovedAt: number | null
  rejectedBy: number | null
  rejectedAt: number | null
  rejectionReason: string | null
  cancelledBy: number | null
  cancelledAt: number | null
  cancellationReason: string | null
  affectedScheduleIds: string | null
  replacementNotified: boolean
  createdAt: Date
  updatedAt: Date
  submittedAt: number | null
}

export interface LeaveRequestWithRelations extends LeaveRequest {
  employee: {
    id: number
    fullName: string
    email: string | null
    role: number
  }
  leaveType: {
    id: number
    code: string
    name: string
    isPaid: boolean
    color: string | null
  }
}

export interface LeaveBalanceWithType extends LeaveBalance {
  leaveType: {
    id: number
    code: string
    name: string
    accrualType: string
    isPaid: boolean
    color: string | null
    icon: string | null
  }
}

export interface CreateLeaveTypeData extends Omit<LeaveType, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'> {}

export interface UpdateLeaveTypeData extends Partial<Omit<LeaveType, 'id' | 'createdAt' | 'updatedAt'>> {}

export interface CreateLeaveRequestData extends Omit<
  LeaveRequest,
  'id' | 'status' | 'approvalChain' | 'currentApprovalLevel' | 'finalApproverId' | 'finalApprovedAt' |
  'rejectedBy' | 'rejectedAt' | 'rejectionReason' | 'cancelledBy' | 'cancelledAt' | 'cancellationReason' |
  'affectedScheduleIds' | 'replacementNotified' | 'createdAt' | 'updatedAt' | 'submittedAt'
> {}

export interface LeaveRequestFilters {
  employeeId?: number
  leaveTypeId?: number
  status?: LeaveRequest['status']
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}

export interface LeaveBalanceAdjustment {
  employeeId: number
  leaveTypeId: number
  year: number
  adjustment: number
  reason: string
  adjustedBy: number
}

// ========================================
// Leave Service
// ========================================

export class LeaveService extends BaseService {
  private notificationService: NotificationService

  constructor(d1: D1Database, env: CloudflareEnv) {
    super(d1, env)
    this.notificationService = new NotificationService(d1, env)
  }

  // ========================================
  // Leave Types Management
  // ========================================

  /**
   * Get all leave types for a restaurant (including system-level types)
   */
  async getLeaveTypes(restaurantId: number): Promise<LeaveType[]> {
    const types = await this.db
      .select()
      .from(leaveTypes)
      .where(
        or(
          eq(leaveTypes.restaurantId, restaurantId),
          sql`${leaveTypes.restaurantId} IS NULL` // System-level types
        )
      )
      .orderBy(asc(leaveTypes.sortOrder), asc(leaveTypes.name))

    return types as LeaveType[]
  }

  /**
   * Get a specific leave type
   */
  async getLeaveType(id: number): Promise<LeaveType | null> {
    const [type] = await this.db
      .select()
      .from(leaveTypes)
      .where(eq(leaveTypes.id, id))
      .limit(1)

    return (type as LeaveType) || null
  }

  /**
   * Create a new leave type
   */
  async createLeaveType(data: CreateLeaveTypeData): Promise<LeaveType> {
    try {
      const [newType] = await this.db
        .insert(leaveTypes)
        .values({
          ...data,
          isSystemDefined: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()

      return newType as LeaveType
    } catch (error) {
      return this.handleError(error, 'createLeaveType')
    }
  }

  /**
   * Update a leave type
   */
  async updateLeaveType(id: number, data: UpdateLeaveTypeData): Promise<LeaveType> {
    try {
      const [updated] = await this.db
        .update(leaveTypes)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(leaveTypes.id, id))
        .returning()

      if (!updated) {
        throw new Error('Leave type not found')
      }

      return updated as LeaveType
    } catch (error) {
      return this.handleError(error, 'updateLeaveType')
    }
  }

  /**
   * Delete a leave type (soft delete by marking inactive)
   */
  async deleteLeaveType(id: number): Promise<boolean> {
    try {
      // Check if it's a system-defined type
      const [type] = await this.db
        .select()
        .from(leaveTypes)
        .where(eq(leaveTypes.id, id))
        .limit(1)

      if (!type) {
        return false
      }

      if (type.isSystemDefined) {
        throw new Error('Cannot delete system-defined leave type')
      }

      // Soft delete
      await this.db
        .update(leaveTypes)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(leaveTypes.id, id))

      return true
    } catch (error) {
      return this.handleError(error, 'deleteLeaveType')
    }
  }

  // ========================================
  // Leave Balance Management
  // ========================================

  /**
   * Get employee leave balances for a specific year
   */
  async getEmployeeLeaveBalances(employeeId: number, year: number): Promise<LeaveBalanceWithType[]> {
    const balances = await this.db
      .select({
        balance: employeeLeaveBalances,
        leaveType: {
          id: leaveTypes.id,
          code: leaveTypes.code,
          name: leaveTypes.name,
          accrualType: leaveTypes.accrualType,
          isPaid: leaveTypes.isPaid,
          color: leaveTypes.color,
          icon: leaveTypes.icon,
        },
      })
      .from(employeeLeaveBalances)
      .innerJoin(leaveTypes, eq(employeeLeaveBalances.leaveTypeId, leaveTypes.id))
      .where(
        and(
          eq(employeeLeaveBalances.employeeId, employeeId),
          eq(employeeLeaveBalances.year, year)
        )
      )

    return balances.map((row) => ({
      ...row.balance,
      remainingDays: row.balance.totalDays - row.balance.usedDays - row.balance.pendingDays,
      leaveType: {
        ...row.leaveType,
        accrualType: row.leaveType.accrualType as string,
      },
    })) as LeaveBalanceWithType[]
  }

  /**
   * Get a specific leave balance
   */
  async getLeaveBalance(
    employeeId: number,
    leaveTypeId: number,
    year: number
  ): Promise<LeaveBalance | null> {
    const [balance] = await this.db
      .select()
      .from(employeeLeaveBalances)
      .where(
        and(
          eq(employeeLeaveBalances.employeeId, employeeId),
          eq(employeeLeaveBalances.leaveTypeId, leaveTypeId),
          eq(employeeLeaveBalances.year, year)
        )
      )
      .limit(1)

    if (!balance) {
      return null
    }

    return {
      ...balance,
      remainingDays: balance.totalDays - balance.usedDays - balance.pendingDays,
    } as LeaveBalance
  }

  /**
   * Adjust leave balance (manual adjustment)
   */
  async adjustLeaveBalance(adjustment: LeaveBalanceAdjustment): Promise<LeaveBalance> {
    try {
      // Get or create balance record
      let balance = await this.getLeaveBalance(
        adjustment.employeeId,
        adjustment.leaveTypeId,
        adjustment.year
      )

      const now = new Date()

      if (!balance) {
        // Create new balance record
        const [user] = await this.db
          .select({ restaurantId: users.restaurantId })
          .from(users)
          .where(eq(users.id, adjustment.employeeId))
          .limit(1)

        if (!user || !user.restaurantId) {
          throw new Error('Employee restaurant not found')
        }

        const [newBalance] = await this.db
          .insert(employeeLeaveBalances)
          .values({
            employeeId: adjustment.employeeId,
            leaveTypeId: adjustment.leaveTypeId,
            restaurantId: user.restaurantId,
            year: adjustment.year,
            totalDays: adjustment.adjustment,
            usedDays: 0,
            pendingDays: 0,
            carryoverFromPrevious: 0,
            carryoverToNext: 0,
            manualAdjustment: adjustment.adjustment,
            adjustmentReason: adjustment.reason,
            adjustedBy: adjustment.adjustedBy,
            adjustedAt: now,
            createdAt: now,
            updatedAt: now,
            lastUpdatedBy: adjustment.adjustedBy,
          })
          .returning()

        balance = {
          ...newBalance,
          remainingDays: newBalance.totalDays - newBalance.usedDays - newBalance.pendingDays,
        } as LeaveBalance
      } else {
        // Update existing balance
        const newTotalDays = balance.totalDays + adjustment.adjustment
        const newAdjustment = balance.manualAdjustment + adjustment.adjustment

        const [updated] = await this.db
          .update(employeeLeaveBalances)
          .set({
            totalDays: newTotalDays,
            manualAdjustment: newAdjustment,
            adjustmentReason: adjustment.reason,
            adjustedBy: adjustment.adjustedBy,
            adjustedAt: now,
            updatedAt: now,
            lastUpdatedBy: adjustment.adjustedBy,
          })
          .where(eq(employeeLeaveBalances.id, balance.id))
          .returning()

        balance = {
          ...updated,
          remainingDays: updated.totalDays - updated.usedDays - updated.pendingDays,
        } as LeaveBalance
      }

      return balance
    } catch (error) {
      return this.handleError(error, 'adjustLeaveBalance')
    }
  }

  /**
   * Accrue leave balances for all employees in a restaurant for a specific year
   */
  async accrueLeaveBalances(restaurantId: number, year: number): Promise<number> {
    try {
      let count = 0

      // Get all active leave types with accrual
      const types = await this.db
        .select()
        .from(leaveTypes)
        .where(
          and(
            or(
              eq(leaveTypes.restaurantId, restaurantId),
              sql`${leaveTypes.restaurantId} IS NULL`
            ),
            eq(leaveTypes.isActive, true),
            sql`${leaveTypes.accrualType} != 'none'`
          )
        )

      // Get all employees in restaurant
      const employees = await this.db
        .select()
        .from(users)
        .where(
          and(
            eq(users.restaurantId, restaurantId),
            eq(users.isActive, true)
          )
        )

      // Create/update balances for each employee and leave type
      for (const employee of employees) {
        for (const type of types) {
          const existingBalance = await this.getLeaveBalance(employee.id, type.id, year)

          if (!existingBalance) {
            // Create new balance
            await this.db.insert(employeeLeaveBalances).values({
              employeeId: employee.id,
              leaveTypeId: type.id,
              restaurantId,
              year,
              totalDays: type.accrualAmount,
              usedDays: 0,
              pendingDays: 0,
              carryoverFromPrevious: 0,
              carryoverToNext: 0,
              manualAdjustment: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            count++
          }
        }
      }

      return count
    } catch (error) {
      return this.handleError(error, 'accrueLeaveBalances')
    }
  }

  // ========================================
  // Leave Request Management
  // ========================================

  /**
   * Get leave requests with filters
   */
  async getLeaveRequests(
    filters: LeaveRequestFilters
  ): Promise<{ items: LeaveRequestWithRelations[]; total: number }> {
    try {
      const { page = 1, limit = 20, ...restFilters } = filters
      const { limit: pgLimit, offset } = this.createPagination(page, limit)

      // Build where conditions
      const conditions = []
      if (restFilters.employeeId) {
        conditions.push(eq(leaveRequests.employeeId, restFilters.employeeId))
      }
      if (restFilters.leaveTypeId) {
        conditions.push(eq(leaveRequests.leaveTypeId, restFilters.leaveTypeId))
      }
      if (restFilters.status) {
        conditions.push(eq(leaveRequests.status, restFilters.status))
      }
      if (restFilters.startDate && restFilters.endDate) {
        // Find requests that overlap with the date range
        conditions.push(
          and(
            lte(leaveRequests.startDate, restFilters.endDate),
            gte(leaveRequests.endDate, restFilters.startDate)
          )
        )
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined

      // Get total count
      const [countResult] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(leaveRequests)
        .where(whereClause)

      const total = Number(countResult.count)

      // Get paginated results with relations
      const requests = await this.db
        .select({
          request: leaveRequests,
          employee: {
            id: users.id,
            fullName: users.fullName,
            email: users.email,
            role: users.role,
          },
          leaveType: {
            id: leaveTypes.id,
            code: leaveTypes.code,
            name: leaveTypes.name,
            isPaid: leaveTypes.isPaid,
            color: leaveTypes.color,
          },
        })
        .from(leaveRequests)
        .innerJoin(users, eq(leaveRequests.employeeId, users.id))
        .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
        .where(whereClause)
        .orderBy(desc(leaveRequests.createdAt))
        .limit(pgLimit)
        .offset(offset)

      const items = requests.map((row) => ({
        ...row.request,
        employee: row.employee,
        leaveType: row.leaveType,
      })) as LeaveRequestWithRelations[]

      return { items, total }
    } catch (error) {
      return this.handleError(error, 'getLeaveRequests')
    }
  }

  /**
   * Get a specific leave request with relations
   */
  async getLeaveRequest(id: number): Promise<LeaveRequestWithRelations | null> {
    const [result] = await this.db
      .select({
        request: leaveRequests,
        employee: {
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          role: users.role,
        },
        leaveType: {
          id: leaveTypes.id,
          code: leaveTypes.code,
          name: leaveTypes.name,
          isPaid: leaveTypes.isPaid,
          color: leaveTypes.color,
        },
      })
      .from(leaveRequests)
      .innerJoin(users, eq(leaveRequests.employeeId, users.id))
      .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .where(eq(leaveRequests.id, id))
      .limit(1)

    if (!result) {
      return null
    }

    return {
      ...result.request,
      employee: result.employee,
      leaveType: result.leaveType,
    } as LeaveRequestWithRelations
  }

  /**
   * Create a new leave request
   */
  async createLeaveRequest(data: CreateLeaveRequestData): Promise<LeaveRequest> {
    try {
      // Get leave type to determine approval requirements
      const type = await this.getLeaveType(data.leaveTypeId)
      if (!type) {
        throw new Error('Leave type not found')
      }

      // Build approval chain
      const approvalChain = this.buildApprovalChain(data.restaurantId, data.leaveTypeId, type.requiredApprovalLevels)

      const [newRequest] = await this.db
        .insert(leaveRequests)
        .values({
          ...data,
          status: 'pending',
          approvalChain: JSON.stringify(approvalChain),
          currentApprovalLevel: 0,
          replacementNotified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          submittedAt: new Date(),
        })
        .returning()

      // Update leave balance pending days
      await this.updateBalancePendingDays(data.employeeId, data.leaveTypeId, data.totalDays, 'add')

      // Send notification to employee
      try {
        const employee = await this.db
          .select()
          .from(users)
          .where(eq(users.id, data.employeeId))
          .limit(1)

        if (employee[0]?.email) {
          await this.notificationService.sendNotification({
            recipientId: data.employeeId,
            recipientEmail: employee[0].email,
            category: 'leave_request_submitted',
            type: 'email',
            data: {
              employeeName: employee[0].fullName || employee[0].username,
              leaveType: type.name,
              startDate: data.startDate,
              endDate: data.endDate,
              totalDays: data.totalDays.toString(),
            },
            priority: 'normal',
          })
        }
      } catch (notifError) {
        console.error('Failed to send leave request notification:', notifError)
        // Don't fail the request if notification fails
      }

      return newRequest as LeaveRequest
    } catch (error) {
      return this.handleError(error, 'createLeaveRequest')
    }
  }

  /**
   * Approve a leave request
   */
  async approveLeaveRequest(
    requestId: number,
    approverId: number,
    comments?: string
  ): Promise<LeaveRequest> {
    try {
      const request = await this.getLeaveRequest(requestId)
      if (!request) {
        throw new Error('Leave request not found')
      }

      if (request.status !== 'pending') {
        throw new Error('Leave request is not in pending status')
      }

      const type = await this.getLeaveType(request.leaveTypeId)
      if (!type) {
        throw new Error('Leave type not found')
      }

      const now = new Date()
      const nextLevel = request.currentApprovalLevel + 1

      // Check if this is the final approval level
      if (nextLevel >= type.requiredApprovalLevels) {
        // Final approval
        const [updated] = await this.db
          .update(leaveRequests)
          .set({
            status: 'approved',
            currentApprovalLevel: nextLevel,
            finalApproverId: approverId,
            finalApprovedAt: now,
            updatedAt: now,
          })
          .where(eq(leaveRequests.id, requestId))
          .returning()

        // Update leave balance: move from pending to used
        await this.updateBalancePendingDays(request.employeeId, request.leaveTypeId, request.totalDays, 'remove')
        await this.updateBalanceUsedDays(request.employeeId, request.leaveTypeId, request.totalDays, 'add')

        // 🔄 LEAVE-SCHEDULE INTEGRATION: Auto-cancel affected schedules
        try {
          const schedulingService = new SchedulingService(this.d1, this.env)
          const cancelResult = await schedulingService.cancelSchedulesByDateRange({
            employeeId: request.employeeId,
            startDate: request.startDate,
            endDate: request.endDate,
            reason: `請假核准: ${type.name} (${request.startDate} ~ ${request.endDate})`,
            cancelledBy: approverId,
          })

          // Store affected schedule IDs in leave request for audit trail
          if (cancelResult.cancelledCount > 0) {
            await this.db
              .update(leaveRequests)
              .set({
                affectedScheduleIds: JSON.stringify(cancelResult.scheduleIds),
                updatedAt: new Date(),
              })
              .where(eq(leaveRequests.id, requestId))

            console.log(`Leave approved - Auto-cancelled ${cancelResult.cancelledCount} schedules`, {
              leaveRequestId: requestId,
              employeeId: request.employeeId,
              scheduleIds: cancelResult.scheduleIds,
            })
          }
        } catch (scheduleError) {
          // Log error but don't fail leave approval
          console.error('Failed to auto-cancel schedules after leave approval', scheduleError, {
            leaveRequestId: requestId,
            employeeId: request.employeeId,
          })
        }

        // Send approval notification to employee
        try {
          const employee = await this.db
            .select()
            .from(users)
            .where(eq(users.id, request.employeeId))
            .limit(1)

          const approver = await this.db
            .select()
            .from(users)
            .where(eq(users.id, approverId))
            .limit(1)

          if (employee[0]?.email) {
            await this.notificationService.sendNotification({
              recipientId: request.employeeId,
              recipientEmail: employee[0].email,
              category: 'leave_request_approved',
              type: 'email',
              data: {
                employeeName: employee[0].fullName || employee[0].username,
                leaveType: type.name,
                startDate: request.startDate,
                endDate: request.endDate,
                totalDays: request.totalDays.toString(),
                approverName: approver[0]?.fullName || approver[0]?.username || 'Manager',
                approverNotes: comments || '',
              },
              priority: 'high',
            })
          }
        } catch (notifError) {
          console.error('Failed to send leave approval notification:', notifError)
          // Don't fail the approval if notification fails
        }

        return updated as LeaveRequest
      } else {
        // Move to next approval level
        const [updated] = await this.db
          .update(leaveRequests)
          .set({
            currentApprovalLevel: nextLevel,
            updatedAt: now,
          })
          .where(eq(leaveRequests.id, requestId))
          .returning()

        return updated as LeaveRequest
      }
    } catch (error) {
      return this.handleError(error, 'approveLeaveRequest')
    }
  }

  /**
   * Reject a leave request
   */
  async rejectLeaveRequest(
    requestId: number,
    approverId: number,
    reason: string
  ): Promise<LeaveRequest> {
    try {
      const request = await this.getLeaveRequest(requestId)
      if (!request) {
        throw new Error('Leave request not found')
      }

      if (request.status !== 'pending') {
        throw new Error('Leave request is not in pending status')
      }

      const now = new Date()
      const [updated] = await this.db
        .update(leaveRequests)
        .set({
          status: 'rejected',
          rejectedBy: approverId,
          rejectedAt: now,
          rejectionReason: reason,
          updatedAt: now,
        })
        .where(eq(leaveRequests.id, requestId))
        .returning()

      // Update leave balance: remove from pending
      await this.updateBalancePendingDays(request.employeeId, request.leaveTypeId, request.totalDays, 'remove')

      // Send rejection notification to employee
      try {
        const employee = await this.db
          .select()
          .from(users)
          .where(eq(users.id, request.employeeId))
          .limit(1)

        const type = await this.getLeaveType(request.leaveTypeId)

        if (employee[0]?.email && type) {
          await this.notificationService.sendNotification({
            recipientId: request.employeeId,
            recipientEmail: employee[0].email,
            category: 'leave_request_rejected',
            type: 'email',
            data: {
              employeeName: employee[0].fullName || employee[0].username,
              leaveType: type.name,
              startDate: request.startDate,
              endDate: request.endDate,
              rejectionReason: reason,
            },
            priority: 'high',
          })
        }
      } catch (notifError) {
        console.error('Failed to send leave rejection notification:', notifError)
        // Don't fail the rejection if notification fails
      }

      return updated as LeaveRequest
    } catch (error) {
      return this.handleError(error, 'rejectLeaveRequest')
    }
  }

  /**
   * Cancel a leave request
   */
  async cancelLeaveRequest(
    requestId: number,
    userId: number,
    reason: string
  ): Promise<LeaveRequest> {
    try {
      const request = await this.getLeaveRequest(requestId)
      if (!request) {
        throw new Error('Leave request not found')
      }

      if (request.status !== 'pending' && request.status !== 'approved') {
        throw new Error('Leave request cannot be cancelled')
      }

      const now = new Date()
      const [updated] = await this.db
        .update(leaveRequests)
        .set({
          status: 'cancelled',
          cancelledBy: userId,
          cancelledAt: now,
          cancellationReason: reason,
          updatedAt: now,
        })
        .where(eq(leaveRequests.id, requestId))
        .returning()

      // Update leave balance
      if (request.status === 'pending') {
        await this.updateBalancePendingDays(request.employeeId, request.leaveTypeId, request.totalDays, 'remove')
      } else if (request.status === 'approved') {
        await this.updateBalanceUsedDays(request.employeeId, request.leaveTypeId, request.totalDays, 'remove')
      }

      // Send cancellation notification to employee
      try {
        const employee = await this.db
          .select()
          .from(users)
          .where(eq(users.id, request.employeeId))
          .limit(1)

        const type = await this.getLeaveType(request.leaveTypeId)

        if (employee[0]?.email && type) {
          await this.notificationService.sendNotification({
            recipientId: request.employeeId,
            recipientEmail: employee[0].email,
            category: 'leave_request_cancelled',
            type: 'email',
            data: {
              employeeName: employee[0].fullName || employee[0].username,
              leaveType: type.name,
              startDate: request.startDate,
              endDate: request.endDate,
            },
            priority: 'normal',
          })
        }
      } catch (notifError) {
        console.error('Failed to send leave cancellation notification:', notifError)
        // Don't fail the cancellation if notification fails
      }

      return updated as LeaveRequest
    } catch (error) {
      return this.handleError(error, 'cancelLeaveRequest')
    }
  }

  // ========================================
  // Helper Methods
  // ========================================

  private buildApprovalChain(restaurantId: number, leaveTypeId: number, levels: number): any[] {
    // Simplified approval chain - can be enhanced with actual approval rules
    const chain = []
    for (let i = 1; i <= levels; i++) {
      chain.push({
        level: i,
        approverRole: i === 1 ? 1 : 0, // 1 = Owner, 0 = Admin
        required: true,
      })
    }
    return chain
  }

  private async updateBalancePendingDays(
    employeeId: number,
    leaveTypeId: number,
    days: number,
    operation: 'add' | 'remove'
  ): Promise<void> {
    const year = new Date().getFullYear()
    const balance = await this.getLeaveBalance(employeeId, leaveTypeId, year)

    if (balance) {
      const newPending = operation === 'add' ? balance.pendingDays + days : balance.pendingDays - days

      await this.db
        .update(employeeLeaveBalances)
        .set({
          pendingDays: Math.max(0, newPending),
          updatedAt: new Date(),
        })
        .where(eq(employeeLeaveBalances.id, balance.id))
    }
  }

  private async updateBalanceUsedDays(
    employeeId: number,
    leaveTypeId: number,
    days: number,
    operation: 'add' | 'remove'
  ): Promise<void> {
    const year = new Date().getFullYear()
    const balance = await this.getLeaveBalance(employeeId, leaveTypeId, year)

    if (balance) {
      const newUsed = operation === 'add' ? balance.usedDays + days : balance.usedDays - days

      await this.db
        .update(employeeLeaveBalances)
        .set({
          usedDays: Math.max(0, newUsed),
          updatedAt: new Date(),
        })
        .where(eq(employeeLeaveBalances.id, balance.id))
    }
  }

  // ========================================
  // Holiday Calendar
  // ========================================

  /**
   * Get holidays for a specific year
   */
  async getHolidays(restaurantId: number | null, year: number): Promise<any[]> {
    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`

    const holidays = await this.db
      .select()
      .from(leaveCalendarEvents)
      .where(
        and(
          or(
            eq(leaveCalendarEvents.restaurantId, restaurantId || 0),
            sql`${leaveCalendarEvents.restaurantId} IS NULL`
          ),
          between(leaveCalendarEvents.eventDate, startDate, endDate)
        )
      )
      .orderBy(asc(leaveCalendarEvents.eventDate))

    return holidays
  }

  /**
   * Check if a date is a working day
   */
  async isWorkingDay(restaurantId: number, date: string): Promise<boolean> {
    const [holiday] = await this.db
      .select()
      .from(leaveCalendarEvents)
      .where(
        and(
          or(
            eq(leaveCalendarEvents.restaurantId, restaurantId),
            sql`${leaveCalendarEvents.restaurantId} IS NULL`
          ),
          eq(leaveCalendarEvents.eventDate, date)
        )
      )
      .limit(1)

    // If no holiday found, it's a working day
    // If holiday found, check isWorkingDay flag (compensatory work days)
    return holiday ? holiday.isWorkingDay : true
  }
}

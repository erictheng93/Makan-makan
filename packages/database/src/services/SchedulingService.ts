/**
 * Employee Scheduling Service
 * Business logic for employee work scheduling management
 */

import {
  eq,
  and,
  gte,
  lte,
  between,
  sql,
  desc,
  asc,
  or,
  inArray,
} from "drizzle-orm";
import type { D1Database } from "@cloudflare/workers-types";
import { BaseService, type CloudflareEnv } from "./base";
import {
  shiftTemplates,
  employeeSchedules,
  schedulingRules,
  schedulingConflicts,
  scheduleSwapRequests,
  employeeAvailability,
  users,
  leaveRequests,
} from "../schema";
import { NotificationService } from "./NotificationService";

// ========================================
// Types
// ========================================

export interface ShiftTemplate {
  id: number;
  restaurantId: string;
  name: string;
  description: string | null;
  shiftType: "regular" | "split" | "overnight";
  startTime: string;
  endTime: string;
  durationMinutes: number;
  isSplitShift: boolean;
  breakStartTime: string | null;
  breakEndTime: string | null;
  breakDurationMinutes: number;
  applicableDays: string;
  minEmployees: number;
  maxEmployees: number;
  hourlyRate: number | null;
  overtimeMultiplier: number;
  colorCode: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeeSchedule {
  id: number;
  restaurantId: string;
  employeeId: number;
  shiftTemplateId: number | null;
  workDate: string;
  startTime: string;
  endTime: string;
  breakDurationMinutes: number;
  clockInTime: Date | null;
  clockOutTime: Date | null;
  scheduledHours: number;
  actualHours: number;
  overtimeHours: number;
  status: "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";
  notes: string | null;
  managerNotes: string | null;
  confirmedBy: number | null;
  confirmedAt: Date | null;
  createdBy: number;
  updatedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SchedulingConflict {
  id: number;
  restaurantId: string;
  conflictType:
    | "overlapping_shifts"
    | "insufficient_rest"
    | "max_hours_exceeded"
    | "consecutive_days_exceeded"
    | "skill_mismatch"
    | "leave_conflict"
    | "availability_conflict";
  severity: "error" | "warning" | "info";
  scheduleIds: string;
  employeeIds: string;
  ruleId: number | null;
  message: string;
  details: string | null;
  status: "unresolved" | "acknowledged" | "resolved" | "ignored";
  resolvedBy: number | null;
  resolvedAt: Date | null;
  resolutionNotes: string | null;
  detectedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduleSwapRequest {
  id: number;
  restaurantId: string;
  requesterEmployeeId: number;
  requesterScheduleId: number;
  targetEmployeeId: number | null;
  targetScheduleId: number | null;
  requestType: "swap" | "cover" | "drop";
  reason: string;
  urgency: "low" | "normal" | "high" | "urgent";
  isOpenRequest: boolean;
  status:
    | "pending"
    | "accepted"
    | "approved"
    | "rejected"
    | "cancelled"
    | "expired";
  acceptedBy: number | null;
  acceptedAt: Date | null;
  approvedBy: number | null;
  approvedAt: Date | null;
  rejectedBy: number | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConflictCheckResult {
  hasConflicts: boolean;
  conflicts: SchedulingConflict[];
  warnings: SchedulingConflict[];
  info: SchedulingConflict[];
}

export interface ScheduleFilters {
  restaurantId?: string;
  employeeId?: number;
  shiftTemplateId?: number;
  startDate?: string;
  endDate?: string;
  status?: EmployeeSchedule["status"];
  page?: number;
  limit?: number;
}

export interface BulkScheduleData {
  restaurantId: string;
  shiftTemplateId: number;
  employeeIds: number[];
  dateRange: { startDate: string; endDate: string };
  daysOfWeek: number[];
  createdBy: number;
}

export interface ClockInData {
  scheduleId: number;
  employeeId: number;
  clockInTime: Date;
  notes?: string;
}

export interface ClockOutData {
  scheduleId: number;
  employeeId: number;
  clockOutTime: Date;
  notes?: string;
}

// ========================================
// Scheduling Service
// ========================================

export class SchedulingService extends BaseService {
  private notificationService: NotificationService;

  constructor(d1: D1Database, env: CloudflareEnv) {
    super(d1, env);
    this.notificationService = new NotificationService(d1, env);
  }

  // ========================================
  // Shift Template Management
  // ========================================

  async getShiftTemplates(restaurantId: string): Promise<ShiftTemplate[]> {
    const templates = await this.db
      .select()
      .from(shiftTemplates)
      .where(eq(shiftTemplates.restaurantId, restaurantId))
      .orderBy(asc(shiftTemplates.sortOrder), asc(shiftTemplates.name));

    return templates as ShiftTemplate[];
  }

  async getShiftTemplate(id: number): Promise<ShiftTemplate | null> {
    const [template] = await this.db
      .select()
      .from(shiftTemplates)
      .where(eq(shiftTemplates.id, id))
      .limit(1);

    return (template as ShiftTemplate) || null;
  }

  async createShiftTemplate(data: any): Promise<ShiftTemplate> {
    const [newTemplate] = await this.db
      .insert(shiftTemplates)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return newTemplate as ShiftTemplate;
  }

  async updateShiftTemplate(id: number, data: any): Promise<ShiftTemplate> {
    const [updated] = await this.db
      .update(shiftTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(shiftTemplates.id, id))
      .returning();

    if (!updated) {
      throw new Error("Shift template not found");
    }

    return updated as ShiftTemplate;
  }

  async deleteShiftTemplate(id: number): Promise<boolean> {
    const [deleted] = await this.db
      .update(shiftTemplates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(shiftTemplates.id, id))
      .returning();

    return !!deleted;
  }

  // ========================================
  // Employee Schedule Management
  // ========================================

  async getSchedules(
    filters: ScheduleFilters,
  ): Promise<{ items: any[]; total: number }> {
    const { page = 1, limit = 20, ...restFilters } = filters;
    const { limit: pgLimit, offset } = this.createPagination(page, limit);

    const conditions = [];
    if (restFilters.restaurantId) {
      conditions.push(
        eq(employeeSchedules.restaurantId, restFilters.restaurantId),
      );
    }
    if (restFilters.employeeId) {
      conditions.push(eq(employeeSchedules.employeeId, restFilters.employeeId));
    }
    if (restFilters.shiftTemplateId) {
      conditions.push(
        eq(employeeSchedules.shiftTemplateId, restFilters.shiftTemplateId),
      );
    }
    if (restFilters.status) {
      conditions.push(eq(employeeSchedules.status, restFilters.status));
    }
    if (restFilters.startDate && restFilters.endDate) {
      conditions.push(
        between(
          employeeSchedules.workDate,
          restFilters.startDate,
          restFilters.endDate,
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(employeeSchedules)
      .where(whereClause);

    const total = Number(countResult.count);

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
      .leftJoin(
        shiftTemplates,
        eq(employeeSchedules.shiftTemplateId, shiftTemplates.id),
      )
      .where(whereClause)
      .orderBy(
        desc(employeeSchedules.workDate),
        asc(employeeSchedules.startTime),
      )
      .limit(pgLimit)
      .offset(offset);

    const items = schedules.map((row) => ({
      ...row.schedule,
      employee: row.employee,
      shiftTemplate: row.shiftTemplate,
    }));

    return { items, total };
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
      .leftJoin(
        shiftTemplates,
        eq(employeeSchedules.shiftTemplateId, shiftTemplates.id),
      )
      .where(eq(employeeSchedules.id, id))
      .limit(1);

    if (!result) return null;

    return {
      ...result.schedule,
      employee: result.employee,
      shiftTemplate: result.shiftTemplate,
    };
  }

  async createSchedule(data: any, existingTx?: any): Promise<EmployeeSchedule> {
    // Check for conflicts (read operation — outside transaction)
    const conflicts = await this.checkScheduleConflicts(data);

    // Wrap conflict inserts + schedule insert in a transaction
    const executeWrites = async (tx: any) => {
      if (conflicts.conflicts.length > 0) {
        // Store conflicts but allow creation with warnings
        for (const conflict of conflicts.conflicts) {
          await tx.insert(schedulingConflicts).values({
            ...conflict,
            restaurantId: conflict.restaurantId || 0,
            scheduleIds: conflict.scheduleIds || "[]",
            employeeIds: conflict.employeeIds || "[]",
            status: "unresolved",
            detectedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }

      const [newSchedule] = await tx
        .insert(employeeSchedules)
        .values({
          ...data,
          status: "scheduled",
          actualHours: 0,
          overtimeHours: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return newSchedule;
    };

    // Use the passed-in transaction (from bulkCreateSchedules) or create a new one
    const newSchedule = existingTx
      ? await executeWrites(existingTx)
      : await this.db.transaction(async (tx) => executeWrites(tx));

    // Send notification to employee (outside transaction — non-critical side effect)
    try {
      const employee = await this.db
        .select()
        .from(users)
        .where(eq(users.id, data.employeeId))
        .limit(1);

      let shiftTemplate = null;
      if (data.shiftTemplateId) {
        shiftTemplate = await this.getShiftTemplate(data.shiftTemplateId);
      }

      if (employee[0]?.email) {
        await this.notificationService.sendNotification({
          recipientId: data.employeeId,
          recipientEmail: employee[0].email,
          category: "schedule_created",
          type: "email",
          data: {
            employeeName: employee[0].fullName || employee[0].username,
            shiftName: shiftTemplate?.name || "Custom Shift",
            scheduleDate: data.workDate,
            startTime: data.startTime,
            endTime: data.endTime,
            scheduledHours: data.scheduledHours.toString(),
            notes: data.notes || "",
          },
          priority: "normal",
        });
      }
    } catch (notifError) {
      console.error(
        "Failed to send schedule creation notification:",
        notifError,
      );
      // Don't fail the operation if notification fails
    }

    return newSchedule as EmployeeSchedule;
  }

  async updateSchedule(id: number, data: any): Promise<EmployeeSchedule> {
    const [updated] = await this.db
      .update(employeeSchedules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(employeeSchedules.id, id))
      .returning();

    if (!updated) {
      throw new Error("Schedule not found");
    }

    // Send notification to employee about schedule update
    try {
      const employee = await this.db
        .select()
        .from(users)
        .where(eq(users.id, updated.employeeId))
        .limit(1);

      let shiftTemplate = null;
      if (updated.shiftTemplateId) {
        shiftTemplate = await this.getShiftTemplate(updated.shiftTemplateId);
      }

      if (employee[0]?.email) {
        await this.notificationService.sendNotification({
          recipientId: updated.employeeId,
          recipientEmail: employee[0].email,
          category: "schedule_updated",
          type: "email",
          data: {
            employeeName: employee[0].fullName || employee[0].username,
            shiftName: shiftTemplate?.name || "Custom Shift",
            scheduleDate: updated.workDate,
            startTime: updated.startTime,
            endTime: updated.endTime,
            scheduledHours: updated.scheduledHours.toString(),
            notes: updated.notes || "",
          },
          priority: "high",
        });
      }
    } catch (notifError) {
      console.error("Failed to send schedule update notification:", notifError);
      // Don't fail the operation if notification fails
    }

    return updated as EmployeeSchedule;
  }

  async deleteSchedule(id: number): Promise<boolean> {
    const [deleted] = await this.db
      .update(employeeSchedules)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(employeeSchedules.id, id))
      .returning();

    // Send notification to employee about schedule cancellation
    if (deleted) {
      try {
        const employee = await this.db
          .select()
          .from(users)
          .where(eq(users.id, deleted.employeeId))
          .limit(1);

        let shiftTemplate = null;
        if (deleted.shiftTemplateId) {
          shiftTemplate = await this.getShiftTemplate(deleted.shiftTemplateId);
        }

        if (employee[0]?.email) {
          await this.notificationService.sendNotification({
            recipientId: deleted.employeeId,
            recipientEmail: employee[0].email,
            category: "schedule_cancelled",
            type: "email",
            data: {
              employeeName: employee[0].fullName || employee[0].username,
              shiftName: shiftTemplate?.name || "Custom Shift",
              scheduleDate: deleted.workDate,
              startTime: deleted.startTime,
              endTime: deleted.endTime,
              cancellationReason: deleted.managerNotes || "Schedule cancelled",
            },
            priority: "high",
          });
        }
      } catch (notifError) {
        console.error(
          "Failed to send schedule cancellation notification:",
          notifError,
        );
        // Don't fail the operation if notification fails
      }
    }

    return !!deleted;
  }

  async bulkCreateSchedules(data: BulkScheduleData): Promise<number> {
    const startDate = new Date(data.dateRange.startDate);
    const endDate = new Date(data.dateRange.endDate);

    // Read operation — outside transaction
    const template = await this.getShiftTemplate(data.shiftTemplateId);
    if (!template) {
      throw new Error("Shift template not found");
    }

    // Collect all schedule data to create
    const schedulesToCreate: any[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();

      if (data.daysOfWeek.includes(dayOfWeek)) {
        for (const employeeId of data.employeeIds) {
          schedulesToCreate.push({
            restaurantId: data.restaurantId,
            employeeId,
            shiftTemplateId: data.shiftTemplateId,
            workDate: currentDate.toISOString().split("T")[0],
            startTime: template.startTime,
            endTime: template.endTime,
            breakDurationMinutes: template.breakDurationMinutes,
            scheduledHours: template.durationMinutes / 60,
            createdBy: data.createdBy,
          });
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Wrap all schedule creations in a single transaction — all succeed or none do
    const count = await this.db.transaction(async (tx) => {
      let created = 0;
      for (const scheduleData of schedulesToCreate) {
        await this.createSchedule(scheduleData, tx);
        created++;
      }
      return created;
    });

    return count;
  }

  // ========================================
  // Clock In/Out
  // ========================================

  async clockIn(data: ClockInData): Promise<EmployeeSchedule> {
    const schedule = await this.getSchedule(data.scheduleId);
    if (!schedule) {
      throw new Error("Schedule not found");
    }

    if (schedule.employeeId !== data.employeeId) {
      throw new Error("Unauthorized");
    }

    if (schedule.clockInTime) {
      throw new Error("Already clocked in");
    }

    const [updated] = await this.db
      .update(employeeSchedules)
      .set({
        clockInTime: data.clockInTime,
        status: "confirmed",
        notes: data.notes || schedule.notes,
        updatedAt: new Date(),
      })
      .where(eq(employeeSchedules.id, data.scheduleId))
      .returning();

    return updated as EmployeeSchedule;
  }

  async clockOut(data: ClockOutData): Promise<EmployeeSchedule> {
    const schedule = await this.getSchedule(data.scheduleId);
    if (!schedule) {
      throw new Error("Schedule not found");
    }

    if (schedule.employeeId !== data.employeeId) {
      throw new Error("Unauthorized");
    }

    if (!schedule.clockInTime) {
      throw new Error("Must clock in first");
    }

    if (schedule.clockOutTime) {
      throw new Error("Already clocked out");
    }

    const clockInTime = schedule.clockInTime!;
    const actualHours =
      (data.clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
    const overtimeHours = Math.max(0, actualHours - schedule.scheduledHours);

    const [updated] = await this.db
      .update(employeeSchedules)
      .set({
        clockOutTime: data.clockOutTime,
        actualHours,
        overtimeHours,
        status: "completed",
        notes: data.notes || schedule.notes,
        updatedAt: new Date(),
      })
      .where(eq(employeeSchedules.id, data.scheduleId))
      .returning();

    return updated as EmployeeSchedule;
  }

  // ========================================
  // Conflict Detection Engine
  // ========================================

  async checkScheduleConflicts(
    scheduleData: any,
  ): Promise<ConflictCheckResult> {
    const conflicts: any[] = [];
    const warnings: any[] = [];
    const info: any[] = [];

    // Check overlapping shifts
    const overlapping = await this.checkOverlappingShifts(
      scheduleData.employeeId,
      scheduleData.workDate,
      scheduleData.startTime,
      scheduleData.endTime,
    );
    conflicts.push(...overlapping);

    // Check rest period (11 hours)
    const restViolations = await this.checkRestPeriod(
      scheduleData.employeeId,
      scheduleData.workDate,
      scheduleData.startTime,
    );
    conflicts.push(...restViolations);

    // Check daily hours (max 12 hours)
    const dailyHours = await this.checkDailyHours(
      scheduleData.employeeId,
      scheduleData.workDate,
      scheduleData.scheduledHours,
    );
    if (dailyHours) warnings.push(dailyHours);

    // Check weekly hours (max 46 hours)
    const weeklyHours = await this.checkWeeklyHours(
      scheduleData.employeeId,
      scheduleData.workDate,
      scheduleData.scheduledHours,
    );
    if (weeklyHours) warnings.push(weeklyHours);

    // Check consecutive days (max 6 days)
    const consecutiveDays = await this.checkConsecutiveDays(
      scheduleData.employeeId,
      scheduleData.workDate,
    );
    if (consecutiveDays) warnings.push(consecutiveDays);

    // Check leave conflicts
    const leaveConflict = await this.checkLeaveConflict(
      scheduleData.employeeId,
      scheduleData.workDate,
    );
    if (leaveConflict) conflicts.push(leaveConflict);

    return {
      hasConflicts: conflicts.length > 0 || warnings.length > 0,
      conflicts,
      warnings,
      info,
    };
  }

  private async checkOverlappingShifts(
    employeeId: number,
    workDate: string,
    startTime: string,
    endTime: string,
  ): Promise<any[]> {
    const existingSchedules = await this.db
      .select()
      .from(employeeSchedules)
      .where(
        and(
          eq(employeeSchedules.employeeId, employeeId),
          eq(employeeSchedules.workDate, workDate),
          sql`${employeeSchedules.status} != 'cancelled'`,
        ),
      );

    const conflicts = [];
    for (const schedule of existingSchedules) {
      if (
        this.timesOverlap(
          startTime,
          endTime,
          schedule.startTime,
          schedule.endTime,
        )
      ) {
        conflicts.push({
          conflictType: "overlapping_shifts",
          severity: "error",
          message: `Overlapping shift detected: ${schedule.startTime}-${schedule.endTime}`,
          scheduleIds: JSON.stringify([schedule.id]),
          employeeIds: JSON.stringify([employeeId]),
        });
      }
    }

    return conflicts;
  }

  private async checkRestPeriod(
    employeeId: number,
    workDate: string,
    startTime: string,
  ): Promise<any[]> {
    const yesterday = new Date(workDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const previousSchedules = await this.db
      .select()
      .from(employeeSchedules)
      .where(
        and(
          eq(employeeSchedules.employeeId, employeeId),
          eq(employeeSchedules.workDate, yesterdayStr),
          sql`${employeeSchedules.status} != 'cancelled'`,
        ),
      );

    const conflicts = [];
    for (const prevSchedule of previousSchedules) {
      const restHours = this.calculateRestHours(
        prevSchedule.endTime,
        startTime,
      );
      if (restHours < 11) {
        conflicts.push({
          conflictType: "insufficient_rest",
          severity: "error",
          message: `Insufficient rest period: ${restHours.toFixed(1)} hours (minimum 11 hours required)`,
          scheduleIds: JSON.stringify([prevSchedule.id]),
          employeeIds: JSON.stringify([employeeId]),
        });
      }
    }

    return conflicts;
  }

  private async checkDailyHours(
    employeeId: number,
    workDate: string,
    additionalHours: number,
  ): Promise<any | null> {
    const [result] = await this.db
      .select({
        totalHours: sql<number>`SUM(${employeeSchedules.scheduledHours})`,
      })
      .from(employeeSchedules)
      .where(
        and(
          eq(employeeSchedules.employeeId, employeeId),
          eq(employeeSchedules.workDate, workDate),
          sql`${employeeSchedules.status} != 'cancelled'`,
        ),
      );

    const currentHours = Number(result?.totalHours || 0);
    const newTotal = currentHours + additionalHours;

    if (newTotal > 12) {
      return {
        conflictType: "max_hours_exceeded",
        severity: "warning",
        message: `Daily hours exceeded: ${newTotal} hours (maximum 12 hours)`,
        employeeIds: JSON.stringify([employeeId]),
      };
    }

    return null;
  }

  private async checkWeeklyHours(
    employeeId: number,
    workDate: string,
    additionalHours: number,
  ): Promise<any | null> {
    const date = new Date(workDate);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const [result] = await this.db
      .select({
        totalHours: sql<number>`SUM(${employeeSchedules.scheduledHours})`,
      })
      .from(employeeSchedules)
      .where(
        and(
          eq(employeeSchedules.employeeId, employeeId),
          between(
            employeeSchedules.workDate,
            weekStart.toISOString().split("T")[0],
            weekEnd.toISOString().split("T")[0],
          ),
          sql`${employeeSchedules.status} != 'cancelled'`,
        ),
      );

    const currentHours = Number(result?.totalHours || 0);
    const newTotal = currentHours + additionalHours;

    if (newTotal > 46) {
      return {
        conflictType: "max_hours_exceeded",
        severity: "warning",
        message: `Weekly hours exceeded: ${newTotal} hours (maximum 46 hours)`,
        employeeIds: JSON.stringify([employeeId]),
      };
    }

    return null;
  }

  private async checkConsecutiveDays(
    employeeId: number,
    workDate: string,
  ): Promise<any | null> {
    const date = new Date(workDate);
    let consecutiveDays = 1;

    // Check backwards
    for (let i = 1; i <= 7; i++) {
      const checkDate = new Date(date);
      checkDate.setDate(date.getDate() - i);

      const [schedule] = await this.db
        .select()
        .from(employeeSchedules)
        .where(
          and(
            eq(employeeSchedules.employeeId, employeeId),
            eq(
              employeeSchedules.workDate,
              checkDate.toISOString().split("T")[0],
            ),
            sql`${employeeSchedules.status} != 'cancelled'`,
          ),
        )
        .limit(1);

      if (schedule) {
        consecutiveDays++;
      } else {
        break;
      }
    }

    if (consecutiveDays > 6) {
      return {
        conflictType: "consecutive_days_exceeded",
        severity: "warning",
        message: `Consecutive work days exceeded: ${consecutiveDays} days (maximum 6 days)`,
        employeeIds: JSON.stringify([employeeId]),
      };
    }

    return null;
  }

  private async checkLeaveConflict(
    employeeId: number,
    workDate: string,
  ): Promise<any | null> {
    const [leave] = await this.db
      .select()
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.employeeId, employeeId),
          eq(leaveRequests.status, "approved"),
          lte(leaveRequests.startDate, workDate),
          gte(leaveRequests.endDate, workDate),
        ),
      )
      .limit(1);

    if (leave) {
      return {
        conflictType: "leave_conflict",
        severity: "error",
        message: `Employee has approved leave on this date`,
        employeeIds: JSON.stringify([employeeId]),
        details: JSON.stringify({ leaveRequestId: leave.id }),
      };
    }

    return null;
  }

  private async createConflictRecord(conflictData: any): Promise<void> {
    await this.db.insert(schedulingConflicts).values({
      ...conflictData,
      restaurantId: conflictData.restaurantId || 0,
      scheduleIds: conflictData.scheduleIds || "[]",
      employeeIds: conflictData.employeeIds || "[]",
      status: "unresolved",
      detectedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // ========================================
  // Helper Methods
  // ========================================

  private timesOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string,
  ): boolean {
    const [s1h, s1m] = start1.split(":").map(Number);
    const [e1h, e1m] = end1.split(":").map(Number);
    const [s2h, s2m] = start2.split(":").map(Number);
    const [e2h, e2m] = end2.split(":").map(Number);

    const start1Min = s1h * 60 + s1m;
    let end1Min = e1h * 60 + e1m;
    const start2Min = s2h * 60 + s2m;
    let end2Min = e2h * 60 + e2m;

    if (end1Min <= start1Min) end1Min += 24 * 60;
    if (end2Min <= start2Min) end2Min += 24 * 60;

    return start1Min < end2Min && end1Min > start2Min;
  }

  private calculateRestHours(endTime: string, startTime: string): number {
    const [eh, em] = endTime.split(":").map(Number);
    const [sh, sm] = startTime.split(":").map(Number);

    const endMin = eh * 60 + em;
    let startMin = sh * 60 + sm;

    if (startMin <= endMin) {
      startMin += 24 * 60;
    }

    return (startMin - endMin) / 60;
  }

  /**
   * Calculate scheduled hours from start time, end time, and break duration
   * Handles overnight shifts correctly
   */
  private calculateScheduledHours(
    startTime: string,
    endTime: string,
    breakMinutes: number,
  ): number {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);

    const startMin = sh * 60 + sm;
    let endMin = eh * 60 + em;

    // Handle overnight shifts (e.g., 22:00 to 06:00)
    if (endMin <= startMin) {
      endMin += 24 * 60;
    }

    // Calculate total minutes and subtract break
    const totalMinutes = endMin - startMin - breakMinutes;

    // Convert to hours
    return totalMinutes / 60;
  }

  // ========================================
  // Swap Requests (simplified)
  // ========================================

  async createSwapRequest(data: any): Promise<ScheduleSwapRequest> {
    const [request] = await this.db
      .insert(scheduleSwapRequests)
      .values({
        ...data,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Send notification to target employee (if specified) or managers
    try {
      const requester = await this.db
        .select()
        .from(users)
        .where(eq(users.id, data.requesterEmployeeId))
        .limit(1);

      const requesterSchedule = await this.getSchedule(
        data.requesterScheduleId,
      );

      // If there's a specific target employee, notify them
      if (data.targetEmployeeId) {
        const target = await this.db
          .select()
          .from(users)
          .where(eq(users.id, data.targetEmployeeId))
          .limit(1);

        if (target[0]?.email) {
          await this.notificationService.sendNotification({
            recipientId: data.targetEmployeeId,
            recipientEmail: target[0].email,
            category: "swap_request_created",
            type: "email",
            data: {
              requesterName:
                requester[0]?.fullName || requester[0]?.username || "Employee",
              targetName: target[0].fullName || target[0].username,
              scheduleDate: requesterSchedule?.workDate || "",
              startTime: requesterSchedule?.startTime || "",
              endTime: requesterSchedule?.endTime || "",
              requestType: data.requestType,
              reason: data.reason,
              urgency: data.urgency,
            },
            priority:
              data.urgency === "urgent" || data.urgency === "high"
                ? "high"
                : "normal",
          });
        }
      }
    } catch (notifError) {
      console.error("Failed to send swap request notification:", notifError);
      // Don't fail the operation if notification fails
    }

    return request as ScheduleSwapRequest;
  }

  async approveSwapRequest(
    requestId: number,
    managerId: number,
  ): Promise<ScheduleSwapRequest> {
    // Wrap swap request update and any related schedule updates in a transaction
    const updated = await this.db.transaction(async (tx) => {
      const [result] = await tx
        .update(scheduleSwapRequests)
        .set({
          status: "approved",
          approvedBy: managerId,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(scheduleSwapRequests.id, requestId))
        .returning();

      if (!result) {
        throw new Error("Swap request not found");
      }

      return result;
    });

    // Send notifications outside the transaction (non-critical side effects)
    try {
      const requester = await this.db
        .select()
        .from(users)
        .where(eq(users.id, updated.requesterEmployeeId))
        .limit(1);

      const manager = await this.db
        .select()
        .from(users)
        .where(eq(users.id, managerId))
        .limit(1);

      const requesterSchedule = await this.getSchedule(
        updated.requesterScheduleId,
      );

      if (requester[0]?.email) {
        await this.notificationService.sendNotification({
          recipientId: updated.requesterEmployeeId,
          recipientEmail: requester[0].email,
          category: "swap_request_approved",
          type: "email",
          data: {
            requesterName: requester[0].fullName || requester[0].username,
            managerName:
              manager[0]?.fullName || manager[0]?.username || "Manager",
            scheduleDate: requesterSchedule?.workDate || "",
            startTime: requesterSchedule?.startTime || "",
            endTime: requesterSchedule?.endTime || "",
            requestType: updated.requestType,
          },
          priority: "high",
        });
      }

      // Also notify target employee if specified
      if (updated.targetEmployeeId) {
        const target = await this.db
          .select()
          .from(users)
          .where(eq(users.id, updated.targetEmployeeId))
          .limit(1);

        if (target[0]?.email) {
          await this.notificationService.sendNotification({
            recipientId: updated.targetEmployeeId,
            recipientEmail: target[0].email,
            category: "swap_request_approved",
            type: "email",
            data: {
              requesterName:
                requester[0]?.fullName || requester[0]?.username || "Employee",
              targetName: target[0].fullName || target[0].username,
              managerName:
                manager[0]?.fullName || manager[0]?.username || "Manager",
              scheduleDate: requesterSchedule?.workDate || "",
              startTime: requesterSchedule?.startTime || "",
              endTime: requesterSchedule?.endTime || "",
              requestType: updated.requestType,
            },
            priority: "high",
          });
        }
      }
    } catch (notifError) {
      console.error(
        "Failed to send swap request approval notification:",
        notifError,
      );
      // Don't fail the operation if notification fails
    }

    return updated as ScheduleSwapRequest;
  }

  async acceptSwapRequest(
    requestId: number,
    employeeId: number,
  ): Promise<ScheduleSwapRequest> {
    // First check if the request exists and is pending
    const [request] = await this.db
      .select()
      .from(scheduleSwapRequests)
      .where(eq(scheduleSwapRequests.id, requestId))
      .limit(1);

    if (!request) {
      throw new Error("Swap request not found");
    }

    if (request.status !== "pending") {
      throw new Error("Swap request is not in pending status");
    }

    // Update the request to accepted status
    const [updated] = await this.db
      .update(scheduleSwapRequests)
      .set({
        status: "accepted",
        acceptedBy: employeeId,
        acceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(scheduleSwapRequests.id, requestId))
      .returning();

    if (!updated) {
      throw new Error("Failed to accept swap request");
    }

    return updated as ScheduleSwapRequest;
  }

  async rejectSwapRequest(
    requestId: number,
    managerId: number,
    reason: string,
  ): Promise<ScheduleSwapRequest> {
    // First check if the request exists
    const [request] = await this.db
      .select()
      .from(scheduleSwapRequests)
      .where(eq(scheduleSwapRequests.id, requestId))
      .limit(1);

    if (!request) {
      throw new Error("Swap request not found");
    }

    if (request.status === "rejected" || request.status === "cancelled") {
      throw new Error("Swap request is already rejected or cancelled");
    }

    // Update the request to rejected status
    const [updated] = await this.db
      .update(scheduleSwapRequests)
      .set({
        status: "rejected",
        rejectedBy: managerId,
        rejectedAt: new Date(),
        rejectionReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(scheduleSwapRequests.id, requestId))
      .returning();

    if (!updated) {
      throw new Error("Failed to reject swap request");
    }

    // Send notification to requester about rejection
    try {
      const requester = await this.db
        .select()
        .from(users)
        .where(eq(users.id, updated.requesterEmployeeId))
        .limit(1);

      const manager = await this.db
        .select()
        .from(users)
        .where(eq(users.id, managerId))
        .limit(1);

      const requesterSchedule = await this.getSchedule(
        updated.requesterScheduleId,
      );

      if (requester[0]?.email) {
        await this.notificationService.sendNotification({
          recipientId: updated.requesterEmployeeId,
          recipientEmail: requester[0].email,
          category: "swap_request_rejected",
          type: "email",
          data: {
            requesterName: requester[0].fullName || requester[0].username,
            managerName:
              manager[0]?.fullName || manager[0]?.username || "Manager",
            scheduleDate: requesterSchedule?.workDate || "",
            startTime: requesterSchedule?.startTime || "",
            endTime: requesterSchedule?.endTime || "",
            requestType: updated.requestType,
            rejectionReason: reason,
          },
          priority: "high",
        });
      }
    } catch (notifError) {
      console.error(
        "Failed to send swap request rejection notification:",
        notifError,
      );
      // Don't fail the operation if notification fails
    }

    return updated as ScheduleSwapRequest;
  }

  async cancelSwapRequest(
    requestId: number,
    employeeId: number,
  ): Promise<ScheduleSwapRequest> {
    // First check if the request exists and belongs to the employee
    const [request] = await this.db
      .select()
      .from(scheduleSwapRequests)
      .where(eq(scheduleSwapRequests.id, requestId))
      .limit(1);

    if (!request) {
      throw new Error("Swap request not found");
    }

    if (request.requesterEmployeeId !== employeeId) {
      throw new Error("Only the requester can cancel this swap request");
    }

    if (request.status !== "pending" && request.status !== "accepted") {
      throw new Error("Cannot cancel swap request in current status");
    }

    // Update the request to cancelled status
    const [updated] = await this.db
      .update(scheduleSwapRequests)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(scheduleSwapRequests.id, requestId))
      .returning();

    if (!updated) {
      throw new Error("Failed to cancel swap request");
    }

    return updated as ScheduleSwapRequest;
  }

  async getSwapRequests(
    filters: any,
  ): Promise<{ items: ScheduleSwapRequest[]; total: number }> {
    try {
      const { page = 1, limit = 20, ...restFilters } = filters;
      const { limit: pgLimit, offset } = this.createPagination(page, limit);

      const conditions = [];
      if (restFilters.restaurantId) {
        conditions.push(
          eq(scheduleSwapRequests.restaurantId, restFilters.restaurantId),
        );
      }
      if (restFilters.requesterEmployeeId) {
        conditions.push(
          eq(
            scheduleSwapRequests.requesterEmployeeId,
            restFilters.requesterEmployeeId,
          ),
        );
      }
      if (restFilters.targetEmployeeId) {
        conditions.push(
          eq(
            scheduleSwapRequests.targetEmployeeId,
            restFilters.targetEmployeeId,
          ),
        );
      }
      if (restFilters.status) {
        conditions.push(eq(scheduleSwapRequests.status, restFilters.status));
      }
      if (restFilters.requestType) {
        conditions.push(
          eq(scheduleSwapRequests.requestType, restFilters.requestType),
        );
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const [countResult] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(scheduleSwapRequests)
        .where(whereClause);

      const total = Number(countResult.count);

      const requests = await this.db
        .select()
        .from(scheduleSwapRequests)
        .where(whereClause)
        .orderBy(desc(scheduleSwapRequests.createdAt))
        .limit(pgLimit)
        .offset(offset);

      return { items: requests as ScheduleSwapRequest[], total };
    } catch (error) {
      console.error("Error getting swap requests:", error);
      throw error;
    }
  }

  // ========================================
  // Leave-Schedule Integration
  // ========================================

  /**
   * Cancel all schedules for an employee within a date range
   * Used when leave is approved to automatically cancel scheduled shifts
   */
  async cancelSchedulesByDateRange(params: {
    employeeId: number;
    startDate: string;
    endDate: string;
    reason: string;
    cancelledBy: number;
  }): Promise<{ cancelledCount: number; scheduleIds: number[] }> {
    try {
      // Wrap query + batch update in a transaction to prevent race conditions
      const result = await this.db.transaction(async (tx) => {
        // Find all non-cancelled schedules in the date range
        const schedulesToCancel = await tx
          .select()
          .from(employeeSchedules)
          .where(
            and(
              eq(employeeSchedules.employeeId, params.employeeId),
              between(
                employeeSchedules.workDate,
                params.startDate,
                params.endDate,
              ),
              sql`${employeeSchedules.status} != 'cancelled'`,
            ),
          );

        if (schedulesToCancel.length === 0) {
          return { cancelledCount: 0, scheduleIds: [] as number[] };
        }

        const scheduleIds = schedulesToCancel.map((s) => s.id);

        // Cancel all schedules
        await tx
          .update(employeeSchedules)
          .set({
            status: "cancelled",
            managerNotes: params.reason,
            updatedBy: params.cancelledBy,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(employeeSchedules.employeeId, params.employeeId),
              between(
                employeeSchedules.workDate,
                params.startDate,
                params.endDate,
              ),
              sql`${employeeSchedules.status} != 'cancelled'`,
            ),
          );

        return {
          cancelledCount: schedulesToCancel.length,
          scheduleIds,
        };
      });

      return result;
    } catch (error) {
      console.error("Error cancelling schedules by date range:", error);
      throw error;
    }
  }

  /**
   * Get available employees for scheduling
   * Filters out employees on leave and already scheduled
   */
  async getAvailableEmployees(params: {
    restaurantId: string;
    date: string;
    shiftTemplateId?: number;
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
            eq(users.isActive, true),
          ),
        );

      // Get employees on approved leave for this date
      const employeesOnLeave = await this.db
        .select({ employeeId: leaveRequests.employeeId })
        .from(leaveRequests)
        .where(
          and(
            eq(leaveRequests.status, "approved"),
            lte(leaveRequests.startDate, params.date),
            gte(leaveRequests.endDate, params.date),
          ),
        );

      const onLeaveIds = new Set(employeesOnLeave.map((r) => r.employeeId));

      // Get employees already scheduled for this date
      const alreadyScheduled = await this.db
        .select({ employeeId: employeeSchedules.employeeId })
        .from(employeeSchedules)
        .where(
          and(
            eq(employeeSchedules.workDate, params.date),
            sql`${employeeSchedules.status} != 'cancelled'`,
          ),
        );

      const scheduledIds = new Set(alreadyScheduled.map((s) => s.employeeId));

      // Filter available employees
      const availableEmployees = allEmployees
        .filter((emp) => !onLeaveIds.has(emp.id) && !scheduledIds.has(emp.id))
        .map((emp) => ({
          ...emp,
          availability: "available",
          reason: "Available for scheduling",
        }));

      return availableEmployees;
    } catch (error) {
      console.error("Error getting available employees:", error);
      throw error;
    }
  }

  /**
   * Get scheduling conflicts with filters
   */
  async getConflicts(
    filters: any,
  ): Promise<{ items: SchedulingConflict[]; total: number }> {
    try {
      const { page = 1, limit = 20, ...restFilters } = filters;
      const { limit: pgLimit, offset } = this.createPagination(page, limit);

      const conditions = [];
      if (restFilters.restaurantId) {
        conditions.push(
          eq(schedulingConflicts.restaurantId, restFilters.restaurantId),
        );
      }
      if (restFilters.conflictType) {
        conditions.push(
          eq(schedulingConflicts.conflictType, restFilters.conflictType),
        );
      }
      if (restFilters.severity) {
        conditions.push(eq(schedulingConflicts.severity, restFilters.severity));
      }
      if (restFilters.status) {
        conditions.push(eq(schedulingConflicts.status, restFilters.status));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const [countResult] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(schedulingConflicts)
        .where(whereClause);

      const total = Number(countResult.count);

      const conflicts = await this.db
        .select()
        .from(schedulingConflicts)
        .where(whereClause)
        .orderBy(desc(schedulingConflicts.detectedAt))
        .limit(pgLimit)
        .offset(offset);

      return { items: conflicts as SchedulingConflict[], total };
    } catch (error) {
      console.error("Error getting conflicts:", error);
      throw error;
    }
  }

  /**
   * Get a specific conflict by ID
   */
  async getConflict(id: number): Promise<SchedulingConflict | null> {
    try {
      const [conflict] = await this.db
        .select()
        .from(schedulingConflicts)
        .where(eq(schedulingConflicts.id, id))
        .limit(1);

      return (conflict as SchedulingConflict) || null;
    } catch (error) {
      console.error("Error getting conflict:", error);
      throw error;
    }
  }

  /**
   * Resolve a scheduling conflict
   */
  async resolveConflict(
    id: number,
    userId: number,
    resolutionNotes: string,
  ): Promise<SchedulingConflict> {
    try {
      const [resolved] = await this.db
        .update(schedulingConflicts)
        .set({
          status: "resolved",
          resolvedBy: userId,
          resolvedAt: new Date(),
          resolutionNotes,
          updatedAt: new Date(),
        })
        .where(eq(schedulingConflicts.id, id))
        .returning();

      if (!resolved) {
        throw new Error("Conflict not found");
      }

      return resolved as SchedulingConflict;
    } catch (error) {
      console.error("Error resolving conflict:", error);
      throw error;
    }
  }

  /**
   * Get daily scheduling statistics
   */
  async getDailyStats(restaurantId: string, date: string): Promise<any> {
    try {
      // Get total schedules for the day
      const [scheduleStats] = await this.db
        .select({
          totalSchedules: sql<number>`COUNT(*)`,
          totalEmployees: sql<number>`COUNT(DISTINCT ${employeeSchedules.employeeId})`,
          totalHours: sql<number>`SUM(${employeeSchedules.scheduledHours})`,
          scheduled: sql<number>`SUM(CASE WHEN ${employeeSchedules.status} = 'scheduled' THEN 1 ELSE 0 END)`,
          confirmed: sql<number>`SUM(CASE WHEN ${employeeSchedules.status} = 'confirmed' THEN 1 ELSE 0 END)`,
          completed: sql<number>`SUM(CASE WHEN ${employeeSchedules.status} = 'completed' THEN 1 ELSE 0 END)`,
          cancelled: sql<number>`SUM(CASE WHEN ${employeeSchedules.status} = 'cancelled' THEN 1 ELSE 0 END)`,
          noShow: sql<number>`SUM(CASE WHEN ${employeeSchedules.status} = 'no_show' THEN 1 ELSE 0 END)`,
        })
        .from(employeeSchedules)
        .where(
          and(
            eq(employeeSchedules.restaurantId, restaurantId),
            eq(employeeSchedules.workDate, date),
          ),
        );

      // Get shift type breakdown
      const shiftBreakdown = await this.db
        .select({
          shiftType: shiftTemplates.shiftType,
          count: sql<number>`COUNT(*)`,
        })
        .from(employeeSchedules)
        .leftJoin(
          shiftTemplates,
          eq(employeeSchedules.shiftTemplateId, shiftTemplates.id),
        )
        .where(
          and(
            eq(employeeSchedules.restaurantId, restaurantId),
            eq(employeeSchedules.workDate, date),
          ),
        )
        .groupBy(shiftTemplates.shiftType);

      return {
        date,
        totalSchedules: Number(scheduleStats.totalSchedules),
        totalEmployees: Number(scheduleStats.totalEmployees),
        totalHours: Number(scheduleStats.totalHours),
        statusBreakdown: {
          scheduled: Number(scheduleStats.scheduled),
          confirmed: Number(scheduleStats.confirmed),
          completed: Number(scheduleStats.completed),
          cancelled: Number(scheduleStats.cancelled),
          noShow: Number(scheduleStats.noShow),
        },
        shiftTypeBreakdown: shiftBreakdown.reduce(
          (acc, item) => {
            if (item.shiftType) {
              acc[item.shiftType] = Number(item.count);
            }
            return acc;
          },
          {} as Record<string, number>,
        ),
      };
    } catch (error) {
      console.error("Error getting daily stats:", error);
      throw error;
    }
  }

  /**
   * Get weekly schedule summary
   */
  async getWeeklySummary(
    restaurantId: string,
    weekStartDate: string,
  ): Promise<any> {
    try {
      // Calculate week end date
      const startDate = new Date(weekStartDate);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      const weekEndDate = endDate.toISOString().split("T")[0];

      // Get weekly aggregated data
      const [weeklyStats] = await this.db
        .select({
          totalSchedules: sql<number>`COUNT(*)`,
          totalEmployees: sql<number>`COUNT(DISTINCT ${employeeSchedules.employeeId})`,
          totalHours: sql<number>`SUM(${employeeSchedules.scheduledHours})`,
          totalOvertimeHours: sql<number>`SUM(${employeeSchedules.overtimeHours})`,
          confirmed: sql<number>`SUM(CASE WHEN ${employeeSchedules.status} = 'confirmed' THEN 1 ELSE 0 END)`,
          completed: sql<number>`SUM(CASE WHEN ${employeeSchedules.status} = 'completed' THEN 1 ELSE 0 END)`,
          cancelled: sql<number>`SUM(CASE WHEN ${employeeSchedules.status} = 'cancelled' THEN 1 ELSE 0 END)`,
        })
        .from(employeeSchedules)
        .where(
          and(
            eq(employeeSchedules.restaurantId, restaurantId),
            between(employeeSchedules.workDate, weekStartDate, weekEndDate),
          ),
        );

      // Get daily breakdown
      const dailyBreakdown = await this.db
        .select({
          workDate: employeeSchedules.workDate,
          scheduleCount: sql<number>`COUNT(*)`,
          employeeCount: sql<number>`COUNT(DISTINCT ${employeeSchedules.employeeId})`,
          totalHours: sql<number>`SUM(${employeeSchedules.scheduledHours})`,
        })
        .from(employeeSchedules)
        .where(
          and(
            eq(employeeSchedules.restaurantId, restaurantId),
            between(employeeSchedules.workDate, weekStartDate, weekEndDate),
            sql`${employeeSchedules.status} != 'cancelled'`,
          ),
        )
        .groupBy(employeeSchedules.workDate)
        .orderBy(asc(employeeSchedules.workDate));

      return {
        weekStartDate,
        weekEndDate,
        totalSchedules: Number(weeklyStats.totalSchedules),
        totalEmployees: Number(weeklyStats.totalEmployees),
        totalHours: Number(weeklyStats.totalHours),
        totalOvertimeHours: Number(weeklyStats.totalOvertimeHours),
        confirmedSchedules: Number(weeklyStats.confirmed),
        completedSchedules: Number(weeklyStats.completed),
        cancelledSchedules: Number(weeklyStats.cancelled),
        dailyBreakdown: dailyBreakdown.map((day) => ({
          date: day.workDate,
          scheduleCount: Number(day.scheduleCount),
          employeeCount: Number(day.employeeCount),
          totalHours: Number(day.totalHours),
        })),
      };
    } catch (error) {
      console.error("Error getting weekly summary:", error);
      throw error;
    }
  }
}

import { describe, expect, it } from "vitest";
import {
  acceptSwapRequestSchema,
  adminClockSchema,
  approveSwapRequestSchema,
  attendanceReportQuerySchema,
  availableEmployeesQuerySchema,
  bulkCreateSchedulesSchema,
  calculateScheduledHours,
  clockInSchema,
  conflictFiltersSchema,
  conflictIdParamSchema,
  createAvailabilitySchema,
  createEmployeeScheduleSchema,
  createSchedulingRuleSchema,
  createShiftTemplateSchema,
  createSwapRequestSchema,
  employeeIdParamSchema,
  rejectSwapRequestSchema,
  resolveConflictSchema,
  restaurantIdParamSchema,
  scheduleFiltersSchema,
  scheduleIdParamSchema,
  schedulingSchemas,
  shiftTemplateIdParamSchema,
  statsQuerySchema,
  swapRequestFiltersSchema,
  swapRequestIdParamSchema,
  updateEmployeeScheduleSchema,
  updateSchedulingRuleSchema,
  updateShiftTemplateSchema,
  validateTaiwanLaborLaw,
  weeklySummaryQuerySchema,
} from "./validation";

describe("scheduling validation", () => {
  it("applies shift template defaults and empty-string preprocessing", () => {
    const template = createShiftTemplateSchema.parse({
      name: "Dinner",
      description: "",
      startTime: "17:00",
      endTime: "22:00",
      durationMinutes: 300,
      breakStartTime: "",
      breakEndTime: "",
      icon: "",
    });

    expect(template).toMatchObject({
      name: "Dinner",
      description: null,
      shiftType: "regular",
      isSplitShift: false,
      breakStartTime: null,
      breakEndTime: null,
      breakDurationMinutes: 0,
      applicableDays: "[]",
      minEmployees: 1,
      maxEmployees: 10,
      overtimeMultiplier: 1.5,
      colorCode: "#3B82F6",
      icon: null,
      sortOrder: 0,
      isActive: true,
    });

    expect(
      updateShiftTemplateSchema.parse({
        description: "",
        breakStartTime: "",
        breakEndTime: "",
        icon: "",
      }),
    ).toEqual({
      description: null,
      breakStartTime: null,
      breakEndTime: null,
      icon: null,
    });
  });

  it("validates schedule creation, updates, and bulk date ranges", () => {
    expect(
      createEmployeeScheduleSchema.parse({
        employeeId: 42,
        workDate: "2026-06-10",
        startTime: "09:00",
        endTime: "17:00",
        scheduledHours: 8,
      }),
    ).toMatchObject({
      employeeId: "42",
      breakDurationMinutes: 0,
      scheduledHours: 8,
    });

    expect(
      updateEmployeeScheduleSchema.parse({
        shiftTemplateId: null,
        status: "confirmed",
        scheduledHours: 7.5,
      }),
    ).toMatchObject({ shiftTemplateId: null, status: "confirmed" });

    expect(
      bulkCreateSchedulesSchema.parse({
        shiftTemplateId: 1,
        employeeIds: [42, 43],
        dateRange: { startDate: "2026-06-10", endDate: "2026-06-12" },
        daysOfWeek: [3, 4],
      }),
    ).toMatchObject({ employeeIds: ["42", "43"] });

    expect(
      bulkCreateSchedulesSchema.safeParse({
        shiftTemplateId: 1,
        employeeIds: [42],
        dateRange: { startDate: "2026-06-12", endDate: "2026-06-10" },
        daysOfWeek: [3],
      }).success,
    ).toBe(false);
  });

  it("validates clock, rules, conflict, and swap request bodies", () => {
    expect(clockInSchema.parse({ scheduleId: 1, employeeId: 42 })).toEqual({
      scheduleId: 1,
      employeeId: "42",
    });

    // employeeId is optional — non-managers are clocked as themselves.
    expect(clockInSchema.parse({ scheduleId: 1 })).toEqual({
      scheduleId: 1,
    });

    expect(
      createSchedulingRuleSchema.parse({
        name: "Max daily hours",
        ruleType: "max_hours_per_day",
        ruleConfig: "{}",
      }),
    ).toMatchObject({
      priority: 0,
      severity: "warning",
      isSystemRule: false,
      isActive: true,
    });

    expect(
      updateSchedulingRuleSchema.parse({
        severity: "error",
        isActive: false,
      }),
    ).toEqual({ severity: "error", isActive: false });

    // The resolver identity comes from the session — a body userId is
    // stripped, never parsed into the payload.
    expect(
      resolveConflictSchema.parse({
        userId: 7,
        resolutionNotes: "Adjusted shift",
      }),
    ).toEqual({ resolutionNotes: "Adjusted shift" });

    // The requester comes from the session — a body requesterEmployeeId is
    // not a schema field and is dropped, never parsed into the payload.
    expect(
      createSwapRequestSchema.parse({
        requesterEmployeeId: 42,
        requesterScheduleId: 10,
        requestType: "cover",
        reason: "Appointment",
      }),
    ).toEqual({
      requesterScheduleId: 10,
      requestType: "cover",
      reason: "Appointment",
      urgency: "normal",
      isOpenRequest: false,
    });

    expect(acceptSwapRequestSchema.parse({ employeeId: 42 })).toEqual({
      employeeId: "42",
    });
    // The approver is now taken from the authenticated caller, so a
    // managerId in the body is not a field the schema knows — it is
    // dropped rather than trusted. Approval carries no body fields at all.
    expect(approveSwapRequestSchema.parse({ managerId: 7 })).toEqual({});
    // Same for rejection, which carries only the reason.
    expect(
      rejectSwapRequestSchema.parse({ managerId: 7, reason: "No coverage" }),
    ).toEqual({ reason: "No coverage" });
  });

  it("refines availability requirements by availability type", () => {
    expect(
      createAvailabilitySchema.parse({
        employeeId: 42,
        availabilityType: "recurring",
        dayOfWeek: 2,
        startTime: "09:00",
        endTime: "17:00",
        preferenceType: "available",
      }),
    ).toMatchObject({ priority: 0, isActive: true });

    expect(
      createAvailabilitySchema.safeParse({
        employeeId: 42,
        availabilityType: "recurring",
        preferenceType: "available",
      }).success,
    ).toBe(false);

    expect(
      createAvailabilitySchema.safeParse({
        employeeId: 42,
        availabilityType: "specific_date",
        startDate: "2026-06-10",
        endDate: "2026-06-11",
        preferenceType: "unavailable",
      }).success,
    ).toBe(true);

    expect(
      createAvailabilitySchema.safeParse({
        employeeId: 42,
        availabilityType: "specific_date",
        preferenceType: "unavailable",
      }).success,
    ).toBe(false);
  });

  it("normalizes query filters and route params", () => {
    expect(
      attendanceReportQuerySchema.parse({
        startDate: "2026-06-10",
        endDate: "2026-06-11",
        employeeId: "42",
      }),
    ).toMatchObject({ employeeId: "42" });

    expect(adminClockSchema.parse({ notes: "manual" })).toEqual({
      notes: "manual",
    });

    expect(
      scheduleFiltersSchema.parse({
        restaurantId: "1",
        employeeId: "42",
        shiftTemplateId: "5",
      }),
    ).toMatchObject({
      restaurantId: 1,
      employeeId: "42",
      shiftTemplateId: 5,
      page: 1,
      limit: 20,
    });

    expect(
      conflictFiltersSchema.parse({
        conflictType: "overlapping_shifts",
        severity: "warning",
        status: "unresolved",
        employeeId: "42",
        page: "2",
        limit: "5",
      }),
    ).toMatchObject({ employeeId: "42", page: 2, limit: 5 });

    expect(
      swapRequestFiltersSchema.parse({
        requesterEmployeeId: "42",
        targetEmployeeId: "43",
        status: "pending",
        requestType: "swap",
      }),
    ).toMatchObject({
      requesterEmployeeId: "42",
      targetEmployeeId: "43",
      page: 1,
      limit: 20,
    });

    expect(statsQuerySchema.parse({ date: "2026-06-10" })).toEqual({
      date: "2026-06-10",
    });
    expect(
      weeklySummaryQuerySchema.parse({ weekStartDate: "2026-06-08" }),
    ).toEqual({ weekStartDate: "2026-06-08" });
    expect(
      availableEmployeesQuerySchema.parse({
        date: "2026-06-10",
        shiftTemplateId: "3",
      }),
    ).toEqual({ date: "2026-06-10", shiftTemplateId: 3 });

    expect(restaurantIdParamSchema.parse({ restaurantId: "rest-1" })).toEqual({
      restaurantId: "rest-1",
    });
    expect(shiftTemplateIdParamSchema.parse({ id: "5" })).toEqual({ id: 5 });
    expect(scheduleIdParamSchema.parse({ id: "6" })).toEqual({ id: 6 });
    expect(conflictIdParamSchema.parse({ id: "7" })).toEqual({ id: 7 });
    expect(swapRequestIdParamSchema.parse({ id: "8" })).toEqual({ id: 8 });
    expect(employeeIdParamSchema.parse({ employeeId: "42" })).toEqual({
      employeeId: "42",
    });
  });

  it("calculates scheduled hours and exposes schema registry constants", () => {
    expect(calculateScheduledHours("09:00", "17:00")).toBe(8);
    expect(calculateScheduledHours("22:00", "06:00", 30)).toBe(7.5);

    expect(validateTaiwanLaborLaw).toMatchObject({
      maxDailyHours: 12,
      maxWeeklyHours: 46,
      minRestPeriod: 11,
      maxConsecutiveDays: 6,
    });
    expect(schedulingSchemas.createShiftTemplate).toBe(
      createShiftTemplateSchema,
    );
    expect(schedulingSchemas.availableEmployeesQuery).toBe(
      availableEmployeesQuerySchema,
    );
  });
});

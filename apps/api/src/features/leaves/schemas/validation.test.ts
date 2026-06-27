import { describe, expect, it } from "vitest";
import {
  approveLeaveRequestSchema,
  calculateLeaveDays,
  createLeaveApprovalRuleSchema,
  createLeaveRequestSchema,
  createLeaveTypeSchema,
  leaveRequestFiltersSchema,
  validateCompleteLeaveRequest,
  validateConsecutiveDays,
  validateLeaveBalance,
} from "./validation";

const restaurantId = "018ffb9a-7b8a-7c3d-9f23-123456789abc";

describe("leave validation schemas", () => {
  it("applies leave type defaults and validates code format", () => {
    const parsed = createLeaveTypeSchema.parse({
      restaurantId,
      code: "ANNUAL_LEAVE",
      name: "Annual Leave",
      accrualType: "yearly",
      accrualAmount: 14,
    });

    expect(parsed).toMatchObject({
      accrualBasedOnSeniority: false,
      requiresApproval: true,
      requiredApprovalLevels: 1,
      minNoticeDays: 0,
      isPaid: true,
      paymentRate: 1,
      allowHalfDay: true,
      isActive: true,
      sortOrder: 0,
    });

    expect(() =>
      createLeaveTypeSchema.parse({
        code: "annual",
        name: "Annual Leave",
        accrualType: "yearly",
        accrualAmount: 14,
      }),
    ).toThrow("Code must be uppercase letters and underscores");
  });

  it("validates leave request date order and default periods", () => {
    expect(
      createLeaveRequestSchema.parse({
        leaveTypeId: 1,
        startDate: "2026-06-08",
        endDate: "2026-06-09",
        reason: "Family event",
        attachmentUrl: null,
      }),
    ).toMatchObject({
      startPeriod: "full",
      endPeriod: "full",
    });

    expect(() =>
      createLeaveRequestSchema.parse({
        leaveTypeId: 1,
        startDate: "2026-06-09",
        endDate: "2026-06-08",
        reason: "Family event",
      }),
    ).toThrow("End date must be equal to or after start date");
  });

  it("requires approver IDs based on approval rule type", () => {
    expect(
      createLeaveApprovalRuleSchema.parse({
        restaurantId,
        name: "Manager approval",
        approvalLevel: 1,
        approverType: "role",
        approverRoleIds: "[1]",
      }),
    ).toMatchObject({
      approverType: "role",
      priority: 0,
      isActive: true,
    });

    expect(() =>
      createLeaveApprovalRuleSchema.parse({
        restaurantId,
        name: "Missing approver",
        approvalLevel: 1,
        approverType: "specific_user",
      }),
    ).toThrow("Approver IDs must be provided based on approver type");
  });

  it("transforms filter params and validates approval bodies", () => {
    expect(
      leaveRequestFiltersSchema.parse({
        employeeId: "10",
        leaveTypeId: "2",
        status: "approved",
      }),
    ).toEqual({
      employeeId: "10",
      leaveTypeId: 2,
      status: "approved",
      page: 1,
      limit: 20,
    });

    expect(approveLeaveRequestSchema.parse({ approverId: "3" })).toEqual({
      approverId: "3",
    });
  });

  it("calculates and validates leave helper behavior", () => {
    expect(calculateLeaveDays("2026-06-08", "2026-06-10", "pm", "am")).toBe(2);
    expect(validateLeaveBalance(2, 3)).toBe(true);
    expect(validateConsecutiveDays(2, 3)).toBe(true);
    expect(
      validateCompleteLeaveRequest.parse({
        leaveTypeId: 1,
        startDate: "2026-06-08",
        endDate: "2026-06-08",
        startPeriod: "am",
        endPeriod: "pm",
        reason: "Family event",
      }),
    ).toMatchObject({
      startPeriod: "am",
      endPeriod: "pm",
    });

    expect(() =>
      validateCompleteLeaveRequest.parse({
        leaveTypeId: 1,
        startDate: "2026-06-08",
        endDate: "2026-06-08",
        startPeriod: "pm",
        endPeriod: "am",
        reason: "Family event",
      }),
    ).toThrow("Invalid date range or period configuration");
    expect(() => validateLeaveBalance(4, 3)).toThrow(
      "Insufficient leave balance",
    );
    expect(() => validateConsecutiveDays(4, 3)).toThrow(
      "Cannot request more than 3 consecutive days",
    );
  });
});

// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import LeaveDecisionCard from "./LeaveDecisionCard.vue";
import type { LeaveBalance, LeaveRequest } from "@makanmasak/shared-types";

vi.mock("@/i18n", () => ({
  t: (key: string) => key,
  useI18n: () => ({ t: (key: string) => key }),
}));

function buildRequest(overrides: Partial<LeaveRequest> = {}): LeaveRequest {
  return {
    id: 7,
    restaurantId: "11111111-1111-7111-8111-111111111111",
    employeeId: "22222222-2222-7222-8222-222222222222",
    leaveTypeId: 1,
    startDate: "2026-06-08",
    endDate: "2026-06-09",
    startPeriod: "full",
    endPeriod: "full",
    totalDays: 2,
    reason: "Family event",
    attachmentUrl: null,
    emergencyContact: null,
    status: "pending",
    approvalChain: "[]",
    currentApprovalLevel: 0,
    finalApproverId: null,
    finalApprovedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    cancelledBy: null,
    cancelledAt: null,
    cancellationReason: null,
    affectedScheduleIds: null,
    replacementNotified: false,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    submittedAt: "2026-06-01T00:00:00.000Z",
    deletedAt: null,
    employee: {
      id: "22222222-2222-7222-8222-222222222222",
      fullName: "Shop Owner",
      email: null,
      role: 1,
    },
    leaveType: {
      id: 1,
      code: "ANNUAL",
      name: "Annual Leave",
      isPaid: true,
      color: null,
    },
    ...overrides,
  };
}

function mountCard(balance: LeaveBalance | null = null) {
  return mount(LeaveDecisionCard, {
    props: { request: buildRequest(), balance, teamLeaves: [] },
  });
}

// rejectLeaveRequestSchema requires a non-empty reason. The field used to be
// labelled 可選 and emitted `undefined` when blank, so JSON dropped the key and
// the reject came back 400 with the card just saying it failed.
describe("LeaveDecisionCard reject", () => {
  it("keeps the confirm button disabled until a reason is typed", async () => {
    const wrapper = mountCard();

    await wrapper.get('[data-testid="leave-reject-open"]').trigger("click");
    const confirm = wrapper.get('[data-testid="leave-reject-confirm"]');
    expect(confirm.attributes("disabled")).toBeDefined();

    await wrapper.get('[data-testid="leave-reject-reason"]').setValue("   ");
    expect(confirm.attributes("disabled")).toBeDefined();

    await wrapper
      .get('[data-testid="leave-reject-reason"]')
      .setValue("Not enough cover");
    expect(confirm.attributes("disabled")).toBeUndefined();
  });

  it("emits the trimmed reason, never undefined", async () => {
    const wrapper = mountCard();

    await wrapper.get('[data-testid="leave-reject-open"]').trigger("click");
    await wrapper
      .get('[data-testid="leave-reject-reason"]')
      .setValue("  Not enough cover  ");
    await wrapper.get('[data-testid="leave-reject-confirm"]').trigger("click");

    expect(wrapper.emitted("reject")).toBeTruthy();
    expect(wrapper.emitted("reject")![0]).toEqual([7, "Not enough cover"]);
  });
});

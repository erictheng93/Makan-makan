// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import LeaveApprovalList from "./LeaveApprovalList.vue";
import type { LeaveRequest } from "@makanmasak/shared-types";

// locale is not decoration here: this component formats dates through
// useDateFormatter, which reads locale.value. A mock returning only `t` makes
// that read throw.
vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: ref("zh-TW"),
  }),
}));

// A whole leave_requests row plus the two relations the endpoint joins in.
// This used to be a partial object behind `as unknown as LeaveRequest`, which
// is how it came to assert against an `attachments` array the table has never
// had (#330). Typed properly, a column rename now breaks this file too.
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

function attachmentHrefs(attachmentUrl: string | null) {
  const wrapper = mount(LeaveApprovalList, {
    props: { requests: [buildRequest({ attachmentUrl })] },
  });

  return wrapper
    .findAll("[data-testid='leave-attachment-link']")
    .map((link) => link.attributes("href"));
}

describe("LeaveApprovalList", () => {
  it.each([
    ["https://cdn.example.test/proof.png"],
    ["http://cdn.example.test/notes.txt"],
  ])("renders an attachment link for %s", (url) => {
    expect(attachmentHrefs(url)).toEqual([url]);
  });

  it.each([
    ["javascript:alert(document.domain)"],
    ["data:text/html,<script>alert(1)</script>"],
  ])("renders no link for %s", (url) => {
    expect(attachmentHrefs(url)).toEqual([]);
  });

  it("renders no link when the request has no attachment", () => {
    expect(attachmentHrefs(null)).toEqual([]);
  });

  it("names the employee from the joined user row", () => {
    const wrapper = mount(LeaveApprovalList, {
      props: { requests: [buildRequest()] },
    });

    expect(wrapper.text()).toContain("Shop Owner");
  });
});

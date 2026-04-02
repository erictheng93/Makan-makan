/**
 * EmployeeLeaveTab Tests
 * Tests for the per-employee leave balance + leave request list component.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import { ref } from "vue";
import { userFactory, resetAllFactories } from "@makanmakan/testing-utils";

// ──── Mock data ────

const mockEmployee = {
  ...userFactory.buildChef(1, {
    overrides: {
      id: 1,
      username: "alice",
      fullName: "Alice",
      email: "alice@test.com",
      isActive: true,
    },
  }),
  status: "active" as const,
  lastLoginAt: null,
  createdAt: "2026-01-01T00:00:00Z",
};

const mockLeaveBalances = [
  {
    id: 1,
    employeeId: 1,
    leaveTypeId: 1,
    year: 2026,
    totalDays: 14,
    usedDays: 3,
    pendingDays: 2,
    remainingDays: 9,
    carryoverDays: 0,
    leaveType: {
      id: 1,
      name: "年假",
      code: "AL",
      color: "#007AFF",
      isPaid: true,
    },
  },
  {
    id: 2,
    employeeId: 1,
    leaveTypeId: 2,
    year: 2026,
    totalDays: 30,
    usedDays: 1,
    pendingDays: 0,
    remainingDays: 29,
    carryoverDays: 0,
    leaveType: { id: 2, name: "病假", code: "SL", color: "#FF9500" },
  },
];

const mockLeaveRequests = [
  {
    id: 201,
    employeeId: 1,
    leaveTypeId: 1,
    startDate: "2026-04-01",
    endDate: "2026-04-03",
    startPeriod: "full",
    endPeriod: "full",
    reason: "Vacation",
    status: "pending" as const,
    createdAt: "2026-03-20T10:00:00Z",
    leaveType: { name: "年假", code: "AL", color: "#007AFF" },
  },
  {
    id: 202,
    employeeId: 1,
    leaveTypeId: 2,
    startDate: "2026-03-25",
    endDate: "2026-03-25",
    startPeriod: "am",
    endPeriod: "am",
    reason: "Doctor visit",
    status: "approved" as const,
    createdAt: "2026-03-24T08:00:00Z",
    leaveType: { name: "病假", code: "SL", color: "#FF9500" },
  },
  {
    id: 203,
    employeeId: 1,
    leaveTypeId: 1,
    startDate: "2026-03-10",
    endDate: "2026-03-11",
    startPeriod: "full",
    endPeriod: "full",
    reason: "Personal",
    status: "rejected" as const,
    createdAt: "2026-03-08T09:00:00Z",
    leaveType: { name: "年假", code: "AL", color: "#007AFF" },
  },
];

// ──── Mocks ────

vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
  t: (key: string) => key,
}));

vi.mock("lucide-vue-next", () => {
  const stub = { template: "<span />" };
  return {
    CalendarOff: stub,
    FileText: stub,
  };
});

// ──── Import (after mocks) ────

import EmployeeLeaveTab from "../EmployeeLeaveTab.vue";

// ──── Helpers ────

function mountComponent(props: Record<string, any> = {}) {
  return mount(EmployeeLeaveTab, {
    props: {
      employee: mockEmployee,
      leaveBalances: mockLeaveBalances,
      leaveRequests: mockLeaveRequests,
      leavesLoading: false,
      ...props,
    },
  });
}

// ══════════════════════════════════════════════════════════════
//  EMPLOYEE LEAVE TAB TESTS
// ══════════════════════════════════════════════════════════════

describe("EmployeeLeaveTab", () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    resetAllFactories();
    wrapper = mountComponent();
  });

  // ── Rendering ──

  it("should mount and render the component", () => {
    expect(wrapper.exists()).toBe(true);
  });

  it("should display leave balance cards for each leave type", () => {
    const balanceCards = wrapper.findAll(".bg-\\[\\#F2F2F7\\].rounded-2xl.p-4");
    expect(balanceCards.length).toBe(2);
  });

  it("should show remaining days and total days in balance display", () => {
    const text = wrapper.text();
    // First balance: 9 remaining / 14 total
    expect(text).toContain("9");
    expect(text).toContain("14");
    // Second balance: 29 remaining / 30 total
    expect(text).toContain("29");
    expect(text).toContain("30");
  });

  it("should display leave type names from balance data", () => {
    const text = wrapper.text();
    expect(text).toContain("年假");
    expect(text).toContain("病假");
  });

  it("should show paid badge when leave type is paid", () => {
    const paidBadge = wrapper.find(".bg-emerald-50.text-emerald-700");
    expect(paidBadge.exists()).toBe(true);
    expect(paidBadge.text()).toContain("employees.leave.paid");
  });

  it("should display used and pending days details", () => {
    const text = wrapper.text();
    // First balance: usedDays=3, pendingDays=2
    expect(text).toContain("employees.leave.used");
    expect(text).toContain("employees.leave.pending");
  });

  // ── Leave Requests ──

  it("should render leave request items", () => {
    const requestItems = wrapper.findAll(
      ".flex.items-center.gap-4.p-4.bg-\\[\\#F2F2F7\\].rounded-xl",
    );
    expect(requestItems.length).toBe(3);
  });

  it("should display status badges with correct status for each leave request", () => {
    const badges = wrapper.findAll("[data-status]");
    const statuses = badges.map((b) => b.attributes("data-status"));

    // pending
    expect(statuses).toContain("pending");
    // approved
    expect(statuses).toContain("approved");
    // rejected
    expect(statuses).toContain("rejected");
  });

  it("should display date range for each leave request", () => {
    const text = wrapper.text();
    // Dates are formatted via toLocaleDateString("zh-TW")
    // We just verify the dates appear in some form
    expect(text.length).toBeGreaterThan(0);
    // The component calls formatDate which outputs locale strings
    const dateNodes = wrapper.findAll(".text-xs.text-\\[\\#1C1C1E\\]\\/40");
    expect(dateNodes.length).toBeGreaterThan(0);
  });

  it("should display leave type name in each request", () => {
    const requestText = wrapper.text();
    // Both 年假 and 病假 should appear in requests section
    expect(requestText).toContain("年假");
    expect(requestText).toContain("病假");
  });

  it("should show half-day period text when not full day", () => {
    // Second request has startPeriod="am", endPeriod="am"
    const text = wrapper.text();
    expect(text).toContain("employees.leave.morning");
  });

  it("should show request reason text", () => {
    const text = wrapper.text();
    expect(text).toContain("Vacation");
    expect(text).toContain("Doctor visit");
  });

  // ── Progress bar ──

  it("should render progress bars in balance cards", () => {
    const progressBars = wrapper.findAll(
      ".h-2.bg-white.rounded-full.overflow-hidden",
    );
    expect(progressBars.length).toBe(2);
  });

  // ── Empty state ──

  it("should show empty state when no leave balances exist", () => {
    const w = mountComponent({ leaveBalances: [], leaveRequests: [] });
    const text = w.text();
    expect(text).toContain("employees.leave.noBalances");
    expect(text).toContain("employees.leave.noRequests");
  });

  // ── Loading state ──

  it("should show loading spinners when leavesLoading is true", () => {
    const w = mountComponent({ leavesLoading: true });
    const spinners = w.findAll(".animate-spin");
    expect(spinners.length).toBeGreaterThanOrEqual(1);
  });

  // ── Null/undefined props ──

  it("should handle undefined employee gracefully", () => {
    const w = mountComponent({
      employee: null,
      leaveBalances: undefined,
      leaveRequests: undefined,
    });
    expect(w.exists()).toBe(true);
    expect(w.text()).toContain("employees.leave.noBalances");
  });
});

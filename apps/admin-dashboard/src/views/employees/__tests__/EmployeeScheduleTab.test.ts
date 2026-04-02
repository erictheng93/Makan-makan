/**
 * EmployeeScheduleTab Tests
 * Tests for the per-employee schedule list component.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
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

const mockSchedules = [
  {
    id: 101,
    restaurantId: "r1",
    employeeId: 1,
    shiftTemplateId: 1,
    workDate: "2026-03-23",
    startTime: "08:00",
    endTime: "16:00",
    breakDurationMinutes: 60,
    scheduledHours: 8,
    clockInTime: "2026-03-23T08:05:00Z",
    clockOutTime: "2026-03-23T16:10:00Z",
    actualStartTime: null,
    actualEndTime: null,
    actualHours: 8.1,
    overtimeHours: 0.1,
    status: "completed" as const,
    notes: null,
    managerNotes: null,
    createdAt: "2026-03-20T00:00:00Z",
    updatedAt: "2026-03-23T16:10:00Z",
    createdBy: 10,
    updatedBy: null,
  },
  {
    id: 102,
    restaurantId: "r1",
    employeeId: 1,
    shiftTemplateId: 2,
    workDate: "2026-04-01",
    startTime: "16:00",
    endTime: "00:00",
    breakDurationMinutes: 30,
    scheduledHours: 8,
    clockInTime: null,
    clockOutTime: null,
    actualStartTime: null,
    actualEndTime: null,
    actualHours: null,
    overtimeHours: null,
    status: "scheduled" as const,
    notes: null,
    managerNotes: null,
    createdAt: "2026-03-20T00:00:00Z",
    updatedAt: "2026-03-20T00:00:00Z",
    createdBy: 10,
    updatedBy: null,
  },
  {
    id: 103,
    restaurantId: "r1",
    employeeId: 1,
    shiftTemplateId: 1,
    workDate: "2026-03-22",
    startTime: "08:00",
    endTime: "16:00",
    breakDurationMinutes: 60,
    scheduledHours: 8,
    clockInTime: null,
    clockOutTime: null,
    actualStartTime: null,
    actualEndTime: null,
    actualHours: null,
    overtimeHours: null,
    status: "cancelled" as const,
    notes: null,
    managerNotes: null,
    createdAt: "2026-03-18T00:00:00Z",
    updatedAt: "2026-03-19T00:00:00Z",
    createdBy: 10,
    updatedBy: null,
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
    Calendar: stub,
    Clock: stub,
    Timer: stub,
  };
});

// ──── Import (after mocks) ────

import EmployeeScheduleTab from "../EmployeeScheduleTab.vue";

// ──── Helpers ────

function mountComponent(props: Record<string, any> = {}) {
  return mount(EmployeeScheduleTab, {
    props: {
      employee: mockEmployee,
      schedules: mockSchedules,
      schedulesLoading: false,
      ...props,
    },
  });
}

// ══════════════════════════════════════════════════════════════
//  EMPLOYEE SCHEDULE TAB TESTS
// ══════════════════════════════════════════════════════════════

describe("EmployeeScheduleTab", () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    resetAllFactories();
    wrapper = mountComponent();
  });

  // ── Summary stats ──

  it("should mount and render the component", () => {
    expect(wrapper.exists()).toBe(true);
  });

  it("should display total hours stat", () => {
    const text = wrapper.text();
    // schedule 1: actualHours=8.1, schedule 2: scheduledHours=8, schedule 3: scheduledHours=8
    // total = 8.1 + 8 + 8 = 24.1
    expect(text).toContain("24.1");
    expect(text).toContain("employees.schedule.totalHours");
  });

  it("should display overtime hours stat", () => {
    const text = wrapper.text();
    // Only schedule 1 has overtimeHours=0.1
    expect(text).toContain("0.1");
    expect(text).toContain("employees.schedule.overtime");
  });

  it("should display completed count stat", () => {
    const text = wrapper.text();
    // 1 completed schedule
    expect(text).toContain("employees.schedule.completed");
    // The count "1" appears in the bold stat
    const completedStat = wrapper.findAll(
      ".text-xl.font-bold.text-emerald-600",
    );
    expect(completedStat.length).toBe(1);
    expect(completedStat[0].text()).toBe("1");
  });

  it("should display upcoming count stat", () => {
    const text = wrapper.text();
    expect(text).toContain("employees.schedule.upcoming");
  });

  // ── Schedule list ──

  it("should render schedule shift items", () => {
    const shiftItems = wrapper.findAll(
      ".flex.items-center.gap-4.p-4.bg-\\[\\#F2F2F7\\].rounded-xl",
    );
    expect(shiftItems.length).toBe(3);
  });

  it("should display shift time range for each schedule", () => {
    const text = wrapper.text();
    expect(text).toContain("08:00");
    expect(text).toContain("16:00");
    expect(text).toContain("00:00");
  });

  it("should sort schedules by date descending (newest first)", () => {
    const shiftItems = wrapper.findAll(
      ".flex.items-center.gap-4.p-4.bg-\\[\\#F2F2F7\\].rounded-xl",
    );
    // Newest first: 2026-04-01 (id=102), 2026-03-23 (id=101), 2026-03-22 (id=103)
    const firstItemText = shiftItems[0].text();
    // April 1 should appear first
    expect(firstItemText).toContain("16:00");
    expect(firstItemText).toContain("00:00");
  });

  it("should show actual hours worked when available", () => {
    const text = wrapper.text();
    // Schedule 1 has actualHours=8.1
    expect(text).toContain("employees.schedule.worked");
    expect(text).toContain("8.1");
  });

  it("should show overtime indicator when overtime hours exist", () => {
    const text = wrapper.text();
    // Schedule 1 has overtimeHours=0.1
    expect(text).toContain("+0.1");
    expect(text).toContain("OT");
  });

  it("should display status badges with correct status", () => {
    const badges = wrapper.findAll("[data-status]");
    const statuses = badges.map((b) => b.attributes("data-status"));

    // completed
    expect(statuses).toContain("completed");
    // scheduled
    expect(statuses).toContain("scheduled");
    // cancelled
    expect(statuses).toContain("cancelled");
  });

  it("should display weekday, day, and month for each shift", () => {
    // Each shift item has date elements
    const dayElements = wrapper.findAll(
      ".text-lg.font-bold.text-\\[\\#1C1C1E\\]",
    );
    expect(dayElements.length).toBe(3);
  });

  // ── Empty state ──

  it("should show empty state when no schedules exist", () => {
    const w = mountComponent({ schedules: [] });
    const text = w.text();
    expect(text).toContain("employees.schedule.noShifts");
  });

  // ── Loading state ──

  it("should show loading spinner when schedulesLoading is true", () => {
    const w = mountComponent({ schedulesLoading: true });
    const spinner = w.find(".animate-spin");
    expect(spinner.exists()).toBe(true);
  });

  // ── Null props ──

  it("should handle undefined schedules gracefully", () => {
    const w = mountComponent({ schedules: undefined });
    expect(w.exists()).toBe(true);
    expect(w.text()).toContain("employees.schedule.noShifts");
  });
});

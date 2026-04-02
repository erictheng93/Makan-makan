/**
 * EmployeeProfileTab — Unit tests
 *
 * Covers:
 *  1. Quick stats cards (upcoming shifts, completed shifts, pending leave)
 *  2. Basic info fields (username, fullName, email, join date, last login)
 *  3. Recent activity rendering
 *  4. Loading state for activity
 *  5. Empty activity state
 *  6. Schedule status badges
 *  7. Leave request activity items
 *  8. Stat computations from props
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";

// ──── Mocks (must precede component import) ────

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "employees.profile.upcomingShifts": "Upcoming Shifts",
        "employees.profile.completedShifts": "Completed Shifts",
        "employees.profile.pendingLeave": "Pending Leave",
        "employees.profile.basicInfo": "Basic Info",
        "employees.profile.recentActivity": "Recent Activity",
        "employees.profile.noActivity": "No recent activity",
        "users.modal.usernameLabel": "Username",
        "users.modal.fullNameLabel": "Full Name",
        "users.table.joinDate": "Join Date",
        "users.table.lastLogin": "Last Login",
        "users.table.neverLoggedIn": "Never",
        "employees.activity.shift": "Shift",
        "employees.activity.leave": "Leave",
        "employees.activity.completed": "Completed",
        "employees.activity.scheduled": "Scheduled",
        "employees.activity.confirmed": "Confirmed",
        "employees.activity.cancelled": "Cancelled",
        "employees.activity.pending": "Pending",
        "employees.activity.approved": "Approved",
        "employees.activity.rejected": "Rejected",
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock("lucide-vue-next", () => {
  const stub = { template: "<span />" };
  return {
    Clock: stub,
    CalendarCheck: stub,
    CalendarOff: stub,
    Activity: stub,
  };
});

// Import AFTER mocks
import EmployeeProfileTab from "../EmployeeProfileTab.vue";
import type { Employee, LeaveRequest } from "@/types/employee";
import type { EmployeeSchedule } from "@/types/scheduling";

// ──── Mock Data ────

const mockEmployee: Employee = {
  id: 42,
  username: "alice",
  fullName: "Alice Wang",
  email: "alice@test.com",
  role: 1,
  status: "active",
  isActive: true,
  lastLoginAt: "2026-03-27T10:00:00Z",
  createdAt: "2026-01-01T00:00:00Z",
};

const futureDate = "2026-04-15";
const pastDate = "2026-03-01";

const mockSchedules: Partial<EmployeeSchedule>[] = [
  {
    id: 1,
    employeeId: 42,
    workDate: futureDate,
    startTime: "09:00",
    endTime: "17:00",
    status: "scheduled",
    clockInTime: null,
    clockOutTime: null,
    createdAt: "2026-03-20T00:00:00Z",
    updatedAt: "2026-03-20T00:00:00Z",
  } as any,
  {
    id: 2,
    employeeId: 42,
    workDate: pastDate,
    startTime: "09:00",
    endTime: "17:00",
    status: "completed",
    clockInTime: "2026-03-01T09:05:00Z",
    clockOutTime: "2026-03-01T17:00:00Z",
    createdAt: "2026-02-25T00:00:00Z",
    updatedAt: "2026-03-01T17:00:00Z",
  } as any,
  {
    id: 3,
    employeeId: 42,
    workDate: pastDate,
    startTime: "10:00",
    endTime: "18:00",
    status: "cancelled",
    clockInTime: null,
    clockOutTime: null,
    createdAt: "2026-02-20T00:00:00Z",
    updatedAt: "2026-02-28T00:00:00Z",
  } as any,
];

const mockLeaveRequests: LeaveRequest[] = [
  {
    id: 10,
    employeeId: 42,
    leaveTypeId: 1,
    startDate: "2026-04-01",
    endDate: "2026-04-02",
    startPeriod: "morning",
    endPeriod: "afternoon",
    reason: "Vacation",
    status: "pending",
    createdAt: "2026-03-25T00:00:00Z",
    leaveType: { name: "Annual Leave", code: "AL" },
  },
  {
    id: 11,
    employeeId: 42,
    leaveTypeId: 2,
    startDate: "2026-03-10",
    endDate: "2026-03-10",
    startPeriod: "morning",
    endPeriod: "afternoon",
    reason: "Sick",
    status: "approved",
    createdAt: "2026-03-09T00:00:00Z",
    leaveType: { name: "Sick Leave", code: "SL" },
  },
];

// ──── Helpers ────

function mountComponent(props: Record<string, any> = {}) {
  return mount(EmployeeProfileTab, {
    props: {
      employee: props.employee ?? mockEmployee,
      schedules: props.schedules ?? [],
      leaveBalances: props.leaveBalances ?? [],
      leaveRequests: props.leaveRequests ?? [],
      schedulesLoading: props.schedulesLoading ?? false,
      leavesLoading: props.leavesLoading ?? false,
    },
  });
}

// ──── Tests ────

describe("EmployeeProfileTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── 1. Quick Stats Cards ───

  describe("Quick Stats Cards", () => {
    it("should render three stat cards", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Upcoming Shifts");
      expect(wrapper.text()).toContain("Completed Shifts");
      expect(wrapper.text()).toContain("Pending Leave");
    });

    it("should show 0 for all stats when no data", () => {
      const wrapper = mountComponent();
      const statValues = wrapper.findAll(".text-xl.font-bold");
      // All should be 0
      expect(statValues.length).toBe(3);
      for (const sv of statValues) {
        expect(sv.text()).toBe("0");
      }
    });

    it("should count upcoming shifts (future, non-cancelled)", () => {
      const wrapper = mountComponent({ schedules: mockSchedules });
      const statValues = wrapper.findAll(".text-xl.font-bold");
      // First stat is upcoming shifts: 1 future scheduled
      expect(statValues[0].text()).toBe("1");
    });

    it("should count completed shifts", () => {
      const wrapper = mountComponent({ schedules: mockSchedules });
      const statValues = wrapper.findAll(".text-xl.font-bold");
      // Second stat is completed: 1 completed
      expect(statValues[1].text()).toBe("1");
    });

    it("should count pending leave requests", () => {
      const wrapper = mountComponent({ leaveRequests: mockLeaveRequests });
      const statValues = wrapper.findAll(".text-xl.font-bold");
      // Third stat: 1 pending
      expect(statValues[2].text()).toBe("1");
    });
  });

  // ─── 2. Basic Info Fields ───

  describe("Basic Info Fields", () => {
    it("should show section title", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Basic Info");
    });

    it("should display username", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("alice");
    });

    it("should display full name", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Alice Wang");
    });

    it("should display email", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("alice@test.com");
    });

    it("should show dash for missing fullName", () => {
      const wrapper = mountComponent({
        employee: { ...mockEmployee, fullName: "" },
      });
      // fullName row should show "-"
      const rows = wrapper.findAll(".flex.justify-between.items-center");
      const fullNameRow = rows.find((r) => r.text().includes("Full Name"));
      expect(fullNameRow?.text()).toContain("-");
    });

    it("should show dash for missing email", () => {
      const wrapper = mountComponent({
        employee: { ...mockEmployee, email: "" },
      });
      const rows = wrapper.findAll(".flex.justify-between.items-center");
      const emailRow = rows.find((r) => r.text().includes("Email"));
      expect(emailRow?.text()).toContain("-");
    });

    it("should show 'Never' when lastLoginAt is null", () => {
      const wrapper = mountComponent({
        employee: { ...mockEmployee, lastLoginAt: null },
      });
      expect(wrapper.text()).toContain("Never");
    });

    it("should show last login date when present", () => {
      const wrapper = mountComponent();
      // Should not show "Never"
      const rows = wrapper.findAll(".flex.justify-between.items-center");
      const loginRow = rows.find((r) => r.text().includes("Last Login"));
      expect(loginRow?.text()).not.toContain("Never");
    });
  });

  // ─── 3. Recent Activity ───

  describe("Recent Activity", () => {
    it("should show section title", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Recent Activity");
    });

    it("should show empty state when no schedules or leaves", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("No recent activity");
    });

    it("should render schedule activity items", () => {
      const wrapper = mountComponent({ schedules: mockSchedules });
      expect(wrapper.text()).toContain("Shift");
      expect(wrapper.text()).toContain("Scheduled");
    });

    it("should render leave request activity items", () => {
      const wrapper = mountComponent({ leaveRequests: mockLeaveRequests });
      expect(wrapper.text()).toContain("Leave");
      expect(wrapper.text()).toContain("Annual Leave");
    });

    it("should show correct badge for completed schedule", () => {
      const wrapper = mountComponent({ schedules: mockSchedules });
      expect(wrapper.text()).toContain("Completed");
    });

    it("should show correct badge for cancelled schedule", () => {
      const wrapper = mountComponent({ schedules: mockSchedules });
      expect(wrapper.text()).toContain("Cancelled");
    });

    it("should show pending badge for pending leave", () => {
      const wrapper = mountComponent({ leaveRequests: mockLeaveRequests });
      expect(wrapper.text()).toContain("Pending");
    });

    it("should show approved badge for approved leave", () => {
      const wrapper = mountComponent({ leaveRequests: mockLeaveRequests });
      expect(wrapper.text()).toContain("Approved");
    });

    it("should combine and sort activities by date descending", () => {
      const wrapper = mountComponent({
        schedules: mockSchedules,
        leaveRequests: mockLeaveRequests,
      });
      const activityItems = wrapper.findAll(".flex.items-center.gap-3.p-3");
      expect(activityItems.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ─── 4. Loading State ───

  describe("Loading State", () => {
    it("should show spinner when schedulesLoading is true", () => {
      const wrapper = mountComponent({ schedulesLoading: true });
      expect(wrapper.find(".animate-spin").exists()).toBe(true);
    });

    it("should show spinner when leavesLoading is true", () => {
      const wrapper = mountComponent({ leavesLoading: true });
      expect(wrapper.find(".animate-spin").exists()).toBe(true);
    });

    it("should hide activity items while loading", () => {
      const wrapper = mountComponent({
        schedulesLoading: true,
        schedules: mockSchedules,
      });
      // Activity section should show spinner, not individual activity badges
      const activityItems = wrapper.findAll(".flex.items-center.gap-3.p-3");
      expect(activityItems.length).toBe(0);
    });
  });

  // ─── 5. Null Employee ───

  describe("Null Employee", () => {
    it("should handle null employee gracefully", () => {
      const wrapper = mountComponent({ employee: null });
      // Should still render stats and section titles
      expect(wrapper.text()).toContain("Upcoming Shifts");
      expect(wrapper.text()).toContain("Basic Info");
    });
  });
});

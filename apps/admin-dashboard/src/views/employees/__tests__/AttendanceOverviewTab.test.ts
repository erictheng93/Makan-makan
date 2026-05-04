/**
 * AttendanceOverviewTab — Unit tests
 *
 * Covers:
 *  1. Attendance stats cards (total active, present, on leave, absent, rate)
 *  2. Currently working section
 *  3. On leave section
 *  4. Loading states
 *  5. Empty states
 *  6. Employee initials display
 *  7. Navigation to employee detail
 *  8. Clock-in time formatting
 *  9. onMounted API calls
 * 10. Stats computation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { ref, computed } from "vue";
import { userFactory, resetAllFactories } from "@makanmasak/testing-utils";

// ──── Mocks (must precede component import) ────

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "employees.attendance.totalActive": "Total Active",
        "employees.attendance.present": "Present",
        "employees.attendance.onLeave": "On Leave",
        "employees.attendance.absent": "Absent",
        "employees.attendance.rate": "Attendance Rate",
        "employees.attendance.working": "Currently Working",
        "employees.attendance.noOneWorking": "No one is currently working",
        "employees.attendance.noOneOnLeave": "No one is on leave today",
      };
      return map[key] ?? key;
    },
  }),
}));

const mockPush = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("lucide-vue-next", () => {
  const stub = { template: "<span />" };
  return {
    Clock: stub,
    CalendarOff: stub,
  };
});

const mockFetchClockedIn = vi.fn();
const mockFetchTodayLeaves = vi.fn();

// Shared reactive state for the mock composable
const mockUsers = ref<any[]>([]);
const mockClockedInList = ref<any[]>([]);
const mockClockedInLoading = ref(false);
const mockLeaveLoading = ref(false);
const mockStats = ref({ currentlyWorking: 0, onLeaveToday: 0 });
const mockUsersWithStatus = ref<any[]>([]);

vi.mock("@/composables/useEmployeeList", () => ({
  useEmployeeList: () => ({
    users: mockUsers,
    clockedInList: mockClockedInList,
    clockedInLoading: mockClockedInLoading,
    leaveLoading: mockLeaveLoading,
    stats: mockStats,
    usersWithStatus: mockUsersWithStatus,
    fetchClockedIn: mockFetchClockedIn,
    fetchTodayLeaves: mockFetchTodayLeaves,
  }),
}));

vi.mock("@/composables/useEmployeeDisplay", () => ({
  getInitials: (name: string) => {
    if (!name) return "";
    return name.slice(0, 2).toUpperCase();
  },
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ restaurantId: "rest-1" }),
}));

// Import AFTER mocks
import AttendanceOverviewTab from "../AttendanceOverviewTab.vue";

// ──── Helpers ────

function mountComponent(props: Record<string, any> = {}) {
  return mount(AttendanceOverviewTab, {
    props: {
      usersWithStatus: props.usersWithStatus ?? [],
      isLoading: props.isLoading ?? false,
    },
  });
}

function setupActiveEmployees() {
  mockUsers.value = [
    {
      ...userFactory.buildShopOwner(1, {
        overrides: {
          id: 1,
          username: "alice",
          fullName: "Alice Wang",
          isActive: true,
        },
      }),
      status: "active",
    },
    {
      ...userFactory.buildChef(1, {
        overrides: {
          id: 2,
          username: "bob",
          fullName: "Bob Chen",
          isActive: true,
        },
      }),
      status: "active",
    },
    {
      ...userFactory.buildServiceCrew(1, {
        overrides: {
          id: 3,
          username: "carol",
          fullName: "Carol Li",
          isActive: true,
        },
      }),
      status: "active",
    },
    {
      ...userFactory.buildCashier(1, {
        overrides: {
          id: 4,
          username: "dave",
          fullName: "Dave Tan",
          isActive: false,
        },
      }),
      status: "inactive",
    },
  ];
}

function setupClockedIn() {
  mockClockedInList.value = [
    {
      id: 100,
      employeeId: 1,
      employeeName: "Alice Wang",
      clockInTime: "2026-03-28T08:00:00Z",
      startTime: "08:00",
      endTime: "16:00",
      workDate: "2026-03-28",
      status: "confirmed",
    },
    {
      id: 101,
      employeeId: 2,
      employeeName: "Bob Chen",
      clockInTime: "2026-03-28T09:00:00Z",
      startTime: "09:00",
      endTime: "17:00",
      workDate: "2026-03-28",
      status: "confirmed",
    },
  ];
  mockStats.value = { currentlyWorking: 2, onLeaveToday: 0 };
}

function setupOnLeave() {
  mockUsersWithStatus.value = [
    {
      id: 3,
      username: "carol",
      fullName: "Carol Li",
      isActive: true,
      leaveStatus: { isOnLeave: true, leaveType: "Sick Leave" },
    },
  ];
  mockStats.value = { ...mockStats.value, onLeaveToday: 1 };
}

// ──── Tests ────

describe("AttendanceOverviewTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllFactories();
    mockUsers.value = [];
    mockClockedInList.value = [];
    mockClockedInLoading.value = false;
    mockLeaveLoading.value = false;
    mockStats.value = { currentlyWorking: 0, onLeaveToday: 0 };
    mockUsersWithStatus.value = [];
  });

  // ─── 1. Stats Cards ───

  describe("Attendance Stats Cards", () => {
    it("should render five stat cards", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Total Active");
      expect(wrapper.text()).toContain("Present");
      expect(wrapper.text()).toContain("On Leave");
      expect(wrapper.text()).toContain("Absent");
      expect(wrapper.text()).toContain("Attendance Rate");
    });

    it("should show 0 for all stats when no employees", () => {
      const wrapper = mountComponent();
      const statValues = wrapper.findAll(".text-2xl.font-bold");
      expect(statValues.length).toBe(5);
      expect(statValues[0].text()).toBe("0"); // total active
      expect(statValues[1].text()).toBe("0"); // present
      expect(statValues[4].text()).toBe("0%"); // rate
    });

    it("should compute correct stats with active employees and clocked-in", () => {
      setupActiveEmployees();
      setupClockedIn();
      const wrapper = mountComponent();
      const statValues = wrapper.findAll(".text-2xl.font-bold");
      expect(statValues[0].text()).toBe("3"); // 3 active employees
      expect(statValues[1].text()).toBe("2"); // 2 working
      expect(statValues[2].text()).toBe("0"); // 0 on leave
      expect(statValues[3].text()).toBe("1"); // 3 - 2 - 0 = 1 absent
    });

    it("should compute attendance rate correctly", () => {
      setupActiveEmployees();
      setupClockedIn();
      const wrapper = mountComponent();
      const statValues = wrapper.findAll(".text-2xl.font-bold");
      // rate = round(2/3 * 100) = 67%
      expect(statValues[4].text()).toBe("67%");
    });

    it("should show on leave count in stats", () => {
      setupActiveEmployees();
      mockStats.value = { currentlyWorking: 1, onLeaveToday: 1 };
      const wrapper = mountComponent();
      const statValues = wrapper.findAll(".text-2xl.font-bold");
      expect(statValues[2].text()).toBe("1"); // on leave
    });
  });

  // ─── 2. Currently Working Section ───

  describe("Currently Working", () => {
    it("should show section heading", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Currently Working");
    });

    it("should show empty state when no one is working", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("No one is currently working");
    });

    it("should render clocked-in employee cards", () => {
      setupClockedIn();
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Alice Wang");
      expect(wrapper.text()).toContain("Bob Chen");
    });

    it("should show count of working employees", () => {
      setupClockedIn();
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("(2)");
    });

    it("should show employee initials", () => {
      setupClockedIn();
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("AL");
      expect(wrapper.text()).toContain("BO");
    });

    it("should show shift times", () => {
      setupClockedIn();
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("(08:00 - 16:00)");
      expect(wrapper.text()).toContain("(09:00 - 17:00)");
    });

    it("should show fallback name when employeeName is missing", () => {
      mockClockedInList.value = [
        {
          id: 200,
          employeeId: 99,
          employeeName: null,
          clockInTime: "2026-03-28T10:00:00Z",
          workDate: "2026-03-28",
          status: "confirmed",
        },
      ];
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Employee #99");
    });

    it("should navigate to detail on employee card click", async () => {
      setupClockedIn();
      const wrapper = mountComponent();
      const cards = wrapper.findAll(".cursor-pointer");
      expect(cards.length).toBeGreaterThanOrEqual(1);
      await cards[0].trigger("click");
      expect(mockPush).toHaveBeenCalledWith("/dashboard/employees/1");
    });
  });

  // ─── 3. On Leave Section ───

  describe("On Leave Section", () => {
    it("should show on leave heading", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("On Leave");
    });

    it("should show empty state when no one on leave", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("No one is on leave today");
    });

    it("should render on-leave employee cards", () => {
      setupActiveEmployees();
      setupOnLeave();
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Carol Li");
      expect(wrapper.text()).toContain("Sick Leave");
    });

    it("should show leave count", () => {
      setupActiveEmployees();
      setupOnLeave();
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("(1)");
    });

    it("should show fallback name for unknown employee on leave", () => {
      mockUsersWithStatus.value = [
        {
          id: 999,
          username: "",
          fullName: "",
          isActive: true,
          leaveStatus: { isOnLeave: true, leaveType: "Vacation" },
        },
      ];
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Employee #999");
    });
  });

  // ─── 4. Loading States ───

  describe("Loading States", () => {
    it("should show spinner for clocked-in loading", () => {
      mockClockedInLoading.value = true;
      const wrapper = mountComponent();
      expect(wrapper.findAll(".animate-spin").length).toBeGreaterThanOrEqual(1);
    });

    it("should show spinner for leave loading", () => {
      mockLeaveLoading.value = true;
      const wrapper = mountComponent();
      expect(wrapper.findAll(".animate-spin").length).toBeGreaterThanOrEqual(1);
    });

    it("should hide employee cards while loading", () => {
      mockClockedInLoading.value = true;
      setupClockedIn();
      const wrapper = mountComponent();
      // Should not show employee names in working section while loading
      expect(wrapper.text()).not.toContain("Alice Wang");
    });
  });

  // ─── 5. onMounted API Calls ───

  describe("API Calls on Mount", () => {
    it("should call fetchClockedIn on mount", () => {
      mountComponent();
      expect(mockFetchClockedIn).toHaveBeenCalledTimes(1);
    });

    it("should call fetchTodayLeaves on mount", () => {
      mountComponent();
      expect(mockFetchTodayLeaves).toHaveBeenCalledTimes(1);
    });
  });
});

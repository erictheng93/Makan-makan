/**
 * EmployeeDetailView — Unit tests
 *
 * Covers:
 *  1. Layout: employee name, role badge, status indicator
 *  2. Profile info display (username, email, created date)
 *  3. Tab navigation (profile, schedule, leave)
 *  4. Back navigation button
 *  5. Avatar / initials display
 *  6. Loading state
 *  7. Employee data from route params
 *  8. Role-specific info display
 *  9. Last login display
 * 10. Active tab highlighting
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { ref, computed } from "vue";
import { userFactory, resetAllFactories } from "@makanmakan/testing-utils";

// ──── Mocks (must precede component import) ────

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "employees.detail.back": "Back to employees",
        "employees.detail.joined": "Joined",
        "employees.detail.lastLogin": "Last login",
        "employees.detail.tabs.profile": "Profile",
        "employees.detail.tabs.schedule": "Schedule",
        "employees.detail.tabs.leave": "Leave",
      };
      return map[key] ?? key;
    },
  }),
}));

const mockPush = vi.fn();
const mockRoute = ref({
  params: { id: "42" },
  path: "/dashboard/employees/42",
  query: {},
});

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => mockRoute.value,
  RouterLink: {
    name: "RouterLink",
    props: ["to"],
    template: '<a :href="to" :class="$attrs.class"><slot /></a>',
  },
  RouterView: {
    name: "RouterView",
    template: "<div data-testid='router-view' />",
  },
}));

const mockEmployeeData = {
  employee: ref<any>(null),
  schedules: ref<any[]>([]),
  leaveBalances: ref<any[]>([]),
  leaveRequests: ref<any[]>([]),
  employeeLoading: ref(false),
  schedulesLoading: ref(false),
  leavesLoading: ref(false),
};

vi.mock("@/composables/useEmployeeData", () => ({
  useEmployeeData: () => mockEmployeeData,
}));

vi.mock("@/composables/useEmployeeDisplay", () => ({
  useEmployeeDisplay: () => ({
    roleText: (role: number) => {
      const map: Record<number, string> = {
        1: "Owner",
        2: "Chef",
        3: "Service",
        4: "Cashier",
      };
      return map[role] ?? "Unknown";
    },
    statusText: (status: string) => {
      const map: Record<string, string> = {
        active: "Active",
        inactive: "Inactive",
        suspended: "Suspended",
      };
      return map[status] ?? status;
    },
  }),
  getInitials: (emp: any) => {
    if (typeof emp === "string") return emp.slice(0, 2).toUpperCase();
    return (emp?.fullName || emp?.username || "").slice(0, 2).toUpperCase();
  },
  avatarClass: () => "bg-blue-100 text-blue-800",
  roleIcon: () => ({ template: "<span />" }),
  roleBadgeClass: () => "bg-purple-100 text-purple-800",
  statusBadgeClass: (status: string) => {
    const map: Record<string, string> = {
      active: "bg-green-100 text-green-800",
      inactive: "bg-gray-100 text-gray-800",
      suspended: "bg-red-100 text-red-800",
    };
    return map[status] ?? "bg-gray-100 text-gray-800";
  },
}));

vi.mock("lucide-vue-next", () => {
  const stub = { template: "<span />" };
  return {
    ChevronLeft: stub,
    User: stub,
    Calendar: stub,
    CalendarDays: stub,
    CalendarOff: stub,
    Clock: stub,
    Mail: stub,
  };
});

// Import AFTER mocks
import EmployeeDetailView from "../EmployeeDetailView.vue";

// ──── Mock Data ────

const mockEmployee = {
  ...userFactory.buildShopOwner(1, {
    overrides: {
      id: 42,
      username: "alice",
      fullName: "Alice Wang",
      email: "alice@test.com",
      isActive: true,
    },
  }),
  status: "active" as const,
  lastLoginAt: "2026-03-27T10:00:00Z",
  createdAt: "2026-01-01T00:00:00Z",
};

const mockChef = {
  ...userFactory.buildChef(1, {
    overrides: {
      id: 99,
      username: "bob",
      fullName: "Bob Chen",
      email: "bob@test.com",
      isActive: false,
    },
  }),
  status: "inactive" as const,
  lastLoginAt: null,
  createdAt: "2026-02-15T00:00:00Z",
};

// ──── Helpers ────

function mountComponent() {
  return mount(EmployeeDetailView, {
    global: {
      stubs: {
        RouterLink: {
          props: ["to"],
          template: '<a :href="to" :class="$attrs.class"><slot /></a>',
        },
        RouterView: { template: "<div data-testid='router-view' />" },
      },
    },
  });
}

// ──── Tests ────

describe("EmployeeDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllFactories();
    mockEmployeeData.employee.value = null;
    mockEmployeeData.employeeLoading.value = false;
    mockEmployeeData.schedules.value = [];
    mockEmployeeData.leaveBalances.value = [];
    mockEmployeeData.leaveRequests.value = [];
    mockEmployeeData.schedulesLoading.value = false;
    mockEmployeeData.leavesLoading.value = false;
    mockRoute.value = {
      params: { id: "42" },
      path: "/dashboard/employees/42",
      query: {},
    };
  });

  // ─── 1. Layout: employee name, role badge, status ───

  describe("Employee Header", () => {
    it("should render employee full name", () => {
      mockEmployeeData.employee.value = mockEmployee;
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Alice Wang");
    });

    it("should render username", () => {
      mockEmployeeData.employee.value = mockEmployee;
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("@alice");
    });

    it("should show role badge", () => {
      mockEmployeeData.employee.value = mockEmployee;
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Owner");
    });

    it("should show status indicator", () => {
      mockEmployeeData.employee.value = mockEmployee;
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Active");
    });

    it("should show username as fallback when fullName is empty", () => {
      mockEmployeeData.employee.value = { ...mockEmployee, fullName: "" };
      const wrapper = mountComponent();
      const h1 = wrapper.find("h1");
      expect(h1.text()).toBe("alice");
    });

    it("should render avatar initials", () => {
      mockEmployeeData.employee.value = mockEmployee;
      const wrapper = mountComponent();
      // getInitials returns first 2 chars of fullName uppercased
      expect(wrapper.text()).toContain("AL");
    });
  });

  // ─── 2. Profile Info Display ───

  describe("Profile Info", () => {
    it("should show email when present", () => {
      mockEmployeeData.employee.value = mockEmployee;
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("alice@test.com");
    });

    it("should hide email row when email is absent", () => {
      mockEmployeeData.employee.value = { ...mockEmployee, email: "" };
      const wrapper = mountComponent();
      expect(wrapper.text()).not.toContain("alice@test.com");
    });

    it("should show joined date", () => {
      mockEmployeeData.employee.value = mockEmployee;
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Joined");
    });

    it("should show last login when present", () => {
      mockEmployeeData.employee.value = mockEmployee;
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Last login");
    });

    it("should hide last login when not present", () => {
      mockEmployeeData.employee.value = mockChef;
      const wrapper = mountComponent();
      expect(wrapper.text()).not.toContain("Last login");
    });
  });

  // ─── 3. Tab Navigation ───

  describe("Tab Navigation", () => {
    it("should render three sub-tabs", () => {
      mockEmployeeData.employee.value = mockEmployee;
      const wrapper = mountComponent();
      const links = wrapper.findAll("a");
      // back button + 3 tabs
      const tabLabels = ["Profile", "Schedule", "Leave"];
      for (const label of tabLabels) {
        expect(wrapper.text()).toContain(label);
      }
    });

    it("should build tab paths using route param id", () => {
      mockEmployeeData.employee.value = mockEmployee;
      const wrapper = mountComponent();
      const links = wrapper.findAll("a");
      const hrefs = links.map((l) => l.attributes("href")).filter(Boolean);
      expect(hrefs).toContain("/dashboard/employees/42");
      expect(hrefs).toContain("/dashboard/employees/42/schedule");
      expect(hrefs).toContain("/dashboard/employees/42/leave");
    });

    it("should highlight active profile tab", () => {
      mockRoute.value = { ...mockRoute.value, path: "/dashboard/employees/42" };
      mockEmployeeData.employee.value = mockEmployee;
      const wrapper = mountComponent();
      const activeLink = wrapper
        .findAll("a")
        .find(
          (a) =>
            a.attributes("href") === "/dashboard/employees/42" &&
            a.text().includes("Profile"),
        );
      expect(activeLink?.attributes("data-active")).toBe("true");
    });

    it("should highlight schedule tab when on schedule path", () => {
      mockRoute.value = {
        ...mockRoute.value,
        path: "/dashboard/employees/42/schedule",
      };
      mockEmployeeData.employee.value = mockEmployee;
      const wrapper = mountComponent();
      const scheduleLink = wrapper
        .findAll("a")
        .find(
          (a) => a.attributes("href") === "/dashboard/employees/42/schedule",
        );
      expect(scheduleLink?.attributes("data-active")).toBe("true");
    });
  });

  // ─── 4. Back Navigation ───

  describe("Back Navigation", () => {
    it("should render back button", () => {
      mockEmployeeData.employee.value = mockEmployee;
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Back to employees");
    });

    it("should navigate back to employees list on click", async () => {
      mockEmployeeData.employee.value = mockEmployee;
      const wrapper = mountComponent();
      const backButton = wrapper.find("button");
      await backButton.trigger("click");
      expect(mockPush).toHaveBeenCalledWith("/dashboard/employees");
    });
  });

  // ─── 5. Loading State ───

  describe("Loading State", () => {
    it("should show spinner when loading", () => {
      mockEmployeeData.employeeLoading.value = true;
      const wrapper = mountComponent();
      expect(wrapper.find(".animate-spin").exists()).toBe(true);
    });

    it("should not show employee info when loading", () => {
      mockEmployeeData.employeeLoading.value = true;
      const wrapper = mountComponent();
      expect(wrapper.text()).not.toContain("Alice Wang");
    });

    it("should hide spinner when loaded", () => {
      mockEmployeeData.employee.value = mockEmployee;
      mockEmployeeData.employeeLoading.value = false;
      const wrapper = mountComponent();
      // The header card should not have a spinner
      const headerCard = wrapper.find(".bg-white.rounded-2xl");
      expect(headerCard.find(".animate-spin").exists()).toBe(false);
    });
  });

  // ─── 6. Role-specific Display ───

  describe("Role-specific Display", () => {
    it("should display Chef role for chef employee", () => {
      mockEmployeeData.employee.value = mockChef;
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Chef");
    });

    it("should display Inactive status for inactive employee", () => {
      mockEmployeeData.employee.value = mockChef;
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Inactive");
    });

    it("should display Suspended status", () => {
      mockEmployeeData.employee.value = {
        ...mockEmployee,
        status: "suspended",
      };
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Suspended");
    });
  });

  // ─── 7. Router View (child content) ───

  describe("Router View", () => {
    it("should render router-view for sub-tab content", () => {
      mockEmployeeData.employee.value = mockEmployee;
      const wrapper = mountComponent();
      expect(wrapper.find("[data-testid='router-view']").exists()).toBe(true);
    });
  });
});

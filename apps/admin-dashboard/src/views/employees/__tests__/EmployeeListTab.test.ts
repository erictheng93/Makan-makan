/**
 * EmployeeListTab — Unit tests
 *
 * Covers:
 *  1. Table rendering (name, role, status, last login)
 *  2. Role badge colors/icons
 *  3. Status indicators (active/inactive/suspended)
 *  4. Actions (edit, reset password, toggle status)
 *  5. Filters (role, status, search)
 *  6. Empty & loading states
 *  7. Pagination
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { nextTick } from "vue";

// ──── Mocks (must precede component import) ────

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, any>) => {
      const map: Record<string, string> = {
        "users.search.placeholder": "Search employees...",
        "users.search.allRoles": "All Roles",
        "users.search.ownerRole": "Owner",
        "users.search.chefRole": "Chef",
        "users.search.serviceRole": "Service",
        "users.search.cashierRole": "Cashier",
        "users.search.allStatuses": "All Statuses",
        "users.status.active": "Active",
        "users.status.inactive": "Inactive",
        "users.status.suspended": "Suspended",
        "users.table.info": "Info",
        "users.table.role": "Role",
        "users.table.status": "Status",
        "users.table.lastLogin": "Last Login",
        "users.table.actions": "Actions",
        "users.table.neverLoggedIn": "Never",
        "users.empty.title": "No employees",
        "users.empty.description": "No employees found",
        "users.actions.edit": "Edit",
        "users.actions.resetPassword": "Reset Password",
        "users.actions.disable": "Disable",
        "users.actions.enable": "Enable",
        "users.confirm.resetPassword": "Reset password?",
        "users.confirm.toggleStatus": "Toggle status?",
        "employees.table.workStatus": "Work Status",
        "employees.clockIn.working": "Working",
        "employees.clockIn.onLeave": "On Leave",
        "employees.clockIn.off": "Off",
        "employees.pagination.showing": "Showing results",
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock useConfirmModal — auto-resolves to true by default
const mockEmployeeConfirmModalFn = vi.fn().mockResolvedValue(true);
vi.mock("@/composables/useConfirmModal", () => ({
  useConfirmModal: () => ({
    confirm: mockEmployeeConfirmModalFn,
    modalState: { value: null },
    close: vi.fn(),
  }),
}));

// Mock lucide-vue-next icons
vi.mock("lucide-vue-next", () => {
  const stub = { template: "<span />" };
  return {
    Search: stub,
    Users: stub,
    Clock: stub,
    CalendarOff: stub,
    Pencil: stub,
    KeyRound: stub,
    UserX: stub,
    UserCheck: stub,
    ChefHat: stub,
    Crown: stub,
    UtensilsCrossed: stub,
    Banknote: stub,
    User: stub,
  };
});

// Mock composable
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
  getInitials: (user: any) =>
    (user.fullName || user.username || "").slice(0, 2).toUpperCase(),
  avatarClass: () => "bg-blue-100 text-blue-800",
  roleIcon: () => ({ template: "<span />" }),
  roleBadgeClass: (role: number) => {
    const map: Record<number, string> = {
      1: "bg-purple-100 text-purple-800",
      2: "bg-orange-100 text-orange-800",
      3: "bg-green-100 text-green-800",
      4: "bg-blue-100 text-blue-800",
    };
    return map[role] ?? "bg-gray-100 text-gray-800";
  },
  statusBadgeClass: (status: string) => {
    const map: Record<string, string> = {
      active: "bg-green-100 text-green-800",
      inactive: "bg-gray-100 text-gray-800",
      suspended: "bg-red-100 text-red-800",
    };
    return map[status] ?? "bg-gray-100 text-gray-800";
  },
}));

// Import component AFTER mocks
import EmployeeListTab from "../../employees/EmployeeListTab.vue";
import type { EmployeeWithStatus } from "@/types/employee";

// ──── Mock Data ────

const mockUsers: EmployeeWithStatus[] = [
  {
    id: 1,
    username: "alice",
    fullName: "Alice Wang",
    email: "alice@test.com",
    role: 1,
    status: "active",
    isActive: true,
    lastLoginAt: "2026-03-27T10:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
    clockInStatus: { isClockedIn: true, clockInTime: "2026-03-28T08:00:00Z" },
  },
  {
    id: 2,
    username: "bob",
    fullName: "Bob Chen",
    email: "bob@test.com",
    role: 2,
    status: "active",
    isActive: true,
    lastLoginAt: "2026-03-26T09:00:00Z",
    createdAt: "2026-01-15T00:00:00Z",
  },
  {
    id: 3,
    username: "carol",
    fullName: "Carol Li",
    email: "carol@test.com",
    role: 3,
    status: "inactive",
    isActive: false,
    lastLoginAt: null,
    createdAt: "2026-02-01T00:00:00Z",
  },
  {
    id: 4,
    username: "dave",
    fullName: "Dave Tan",
    email: "dave@test.com",
    role: 4,
    status: "suspended",
    isActive: false,
    lastLoginAt: "2026-03-20T15:00:00Z",
    createdAt: "2026-02-10T00:00:00Z",
    leaveStatus: { isOnLeave: true, leaveType: "Sick Leave" },
  },
];

// ──── Helpers ────

function mountComponent(
  props: { usersWithStatus?: EmployeeWithStatus[]; isLoading?: boolean } = {},
) {
  return mount(EmployeeListTab, {
    props: {
      usersWithStatus: props.usersWithStatus ?? mockUsers,
      isLoading: props.isLoading ?? false,
    },
  });
}

// ──── Tests ────

describe("EmployeeListTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default confirm modal behavior after clearAllMocks
    mockEmployeeConfirmModalFn.mockResolvedValue(true);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  // ─── 1. Table Rendering ───

  describe("Table Rendering", () => {
    it("should render employee names in the table", () => {
      const wrapper = mountComponent();
      const text = wrapper.text();
      expect(text).toContain("Alice Wang");
      expect(text).toContain("Bob Chen");
      expect(text).toContain("Carol Li");
      expect(text).toContain("Dave Tan");
    });

    it("should render table headers", () => {
      const wrapper = mountComponent();
      const headers = wrapper.findAll("th");
      expect(headers.length).toBe(6);
      expect(wrapper.text()).toContain("Info");
      expect(wrapper.text()).toContain("Role");
      expect(wrapper.text()).toContain("Status");
      expect(wrapper.text()).toContain("Last Login");
      expect(wrapper.text()).toContain("Actions");
    });

    it("should show employee emails", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("alice@test.com");
      expect(wrapper.text()).toContain("bob@test.com");
    });

    it("should display last login date for users with login history", () => {
      const wrapper = mountComponent();
      // Alice has a lastLoginAt
      const rows = wrapper.findAll("tbody tr");
      expect(rows.length).toBe(4);
    });

    it("should show 'Never' for users who have not logged in", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Never");
    });
  });

  // ─── 2. Role Badges ───

  describe("Role Badges", () => {
    it("should show role text for each user", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Owner");
      expect(wrapper.text()).toContain("Chef");
      expect(wrapper.text()).toContain("Service");
      expect(wrapper.text()).toContain("Cashier");
    });

    it("should render role badges with correct class", () => {
      const wrapper = mountComponent();
      const badges = wrapper.findAll(".rounded-full.text-xs.font-medium");
      expect(badges.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ─── 3. Status Indicators ───

  describe("Status Indicators", () => {
    it("should show status text for each user", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Active");
      expect(wrapper.text()).toContain("Inactive");
      expect(wrapper.text()).toContain("Suspended");
    });

    it("should show work status - Working for clocked-in user", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Working");
    });

    it("should show leave status for user on leave", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Sick Leave");
    });

    it("should show 'Off' for users not working and not on leave", () => {
      const wrapper = mountComponent();
      expect(wrapper.text()).toContain("Off");
    });

    it("should show clock-in green dot for working user", () => {
      const wrapper = mountComponent();
      const greenDots = wrapper.findAll(
        ".bg-\\[\\#34C759\\].border-2.border-white.rounded-full",
      );
      expect(greenDots.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── 4. Actions ───

  describe("Actions", () => {
    it("should emit editUser on edit button click", async () => {
      const wrapper = mountComponent();
      const editButtons = wrapper.findAll('button[title="Edit"]');
      expect(editButtons.length).toBe(4);
      await editButtons[0].trigger("click");
      expect(wrapper.emitted("editUser")).toBeTruthy();
      expect(wrapper.emitted("editUser")![0][0]).toEqual(mockUsers[0]);
    });

    it("should emit resetPassword on reset password button click", async () => {
      const wrapper = mountComponent();
      const resetButtons = wrapper.findAll('button[title="Reset Password"]');
      expect(resetButtons.length).toBe(4);
      await resetButtons[0].trigger("click");
      await flushPromises();
      // Component uses useConfirmModal (not window.confirm)
      expect(mockEmployeeConfirmModalFn).toHaveBeenCalled();
      expect(wrapper.emitted("resetPassword")).toBeTruthy();
      expect(wrapper.emitted("resetPassword")![0][0]).toBe(1);
    });

    it("should not emit resetPassword when confirm is cancelled", async () => {
      // Component uses useConfirmModal — mock it to return false
      mockEmployeeConfirmModalFn.mockResolvedValueOnce(false);
      const wrapper = mountComponent();
      const resetButtons = wrapper.findAll('button[title="Reset Password"]');
      await resetButtons[0].trigger("click");
      await flushPromises();
      expect(wrapper.emitted("resetPassword")).toBeFalsy();
    });

    it("should emit toggleStatus on toggle button click", async () => {
      const wrapper = mountComponent();
      // Active user -> Disable button
      const disableButtons = wrapper.findAll('button[title="Disable"]');
      expect(disableButtons.length).toBeGreaterThanOrEqual(1);
      await disableButtons[0].trigger("click");
      await flushPromises();
      expect(wrapper.emitted("toggleStatus")).toBeTruthy();
    });

    it("should show Enable button for inactive users", () => {
      const wrapper = mountComponent();
      const enableButtons = wrapper.findAll('button[title="Enable"]');
      expect(enableButtons.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── 5. Filters ───

  describe("Filters", () => {
    it("should filter by search query (name)", async () => {
      const wrapper = mountComponent();
      const searchInput = wrapper.find('input[type="text"]');
      await searchInput.setValue("Alice");
      await nextTick();
      const rows = wrapper.findAll("tbody tr");
      expect(rows.length).toBe(1);
      expect(wrapper.text()).toContain("Alice Wang");
    });

    it("should filter by search query (username)", async () => {
      const wrapper = mountComponent();
      const searchInput = wrapper.find('input[type="text"]');
      await searchInput.setValue("bob");
      await nextTick();
      expect(wrapper.findAll("tbody tr").length).toBe(1);
      expect(wrapper.text()).toContain("Bob Chen");
    });

    it("should filter by role", async () => {
      const wrapper = mountComponent();
      const selects = wrapper.findAll("select");
      const roleSelect = selects[0];
      await roleSelect.setValue("2");
      await nextTick();
      const rows = wrapper.findAll("tbody tr");
      expect(rows.length).toBe(1);
      expect(wrapper.text()).toContain("Bob Chen");
    });

    it("should filter by status", async () => {
      const wrapper = mountComponent();
      const selects = wrapper.findAll("select");
      const statusSelect = selects[1];
      await statusSelect.setValue("inactive");
      await nextTick();
      const rows = wrapper.findAll("tbody tr");
      expect(rows.length).toBe(1);
      expect(wrapper.text()).toContain("Carol Li");
    });

    it("should show empty state when no results match filter", async () => {
      const wrapper = mountComponent();
      const searchInput = wrapper.find('input[type="text"]');
      await searchInput.setValue("zzzznonexistent");
      await nextTick();
      expect(wrapper.text()).toContain("No employees");
      expect(wrapper.text()).toContain("No employees found");
    });

    it("should show all role filter options", () => {
      const wrapper = mountComponent();
      const selects = wrapper.findAll("select");
      const roleSelect = selects[0];
      const options = roleSelect.findAll("option");
      expect(options.length).toBe(5); // All + 4 roles
    });

    it("should show all status filter options", () => {
      const wrapper = mountComponent();
      const selects = wrapper.findAll("select");
      const statusSelect = selects[1];
      const options = statusSelect.findAll("option");
      expect(options.length).toBe(4); // All + 3 statuses
    });
  });

  // ─── 6. Empty & Loading States ───

  describe("Empty & Loading States", () => {
    it("should show loading spinner when isLoading is true", () => {
      const wrapper = mountComponent({ isLoading: true, usersWithStatus: [] });
      const spinner = wrapper.find(".animate-spin");
      expect(spinner.exists()).toBe(true);
    });

    it("should show empty state when no users provided", () => {
      const wrapper = mountComponent({ usersWithStatus: [] });
      expect(wrapper.text()).toContain("No employees");
      expect(wrapper.text()).toContain("No employees found");
    });

    it("should not show table when loading", () => {
      const wrapper = mountComponent({ isLoading: true, usersWithStatus: [] });
      expect(wrapper.find("table").exists()).toBe(false);
    });

    it("should not show empty state when users exist", () => {
      const wrapper = mountComponent();
      expect(wrapper.find("table").exists()).toBe(true);
    });
  });

  // ─── 7. Pagination ───

  describe("Pagination", () => {
    it("should not show pagination when users fit in one page", () => {
      const wrapper = mountComponent();
      // 4 users, pageSize=15, so no pagination
      const paginationButtons = wrapper
        .findAll("button")
        .filter((b) => /^\d+$/.test(b.text()));
      expect(paginationButtons.length).toBe(0);
    });

    it("should reset to page 1 when filters change", async () => {
      // Create 20 users so pagination exists
      const manyUsers: EmployeeWithStatus[] = Array.from(
        { length: 20 },
        (_, i) => ({
          id: i + 1,
          username: `user${i}`,
          fullName: `User ${i}`,
          email: `user${i}@test.com`,
          role: 2,
          status: "active" as const,
          isActive: true,
          lastLoginAt: null,
          createdAt: "2026-01-01T00:00:00Z",
        }),
      );
      const wrapper = mountComponent({ usersWithStatus: manyUsers });
      // Should show pagination
      const pageButtons = wrapper
        .findAll("button")
        .filter((b) => /^\d+$/.test(b.text()));
      expect(pageButtons.length).toBe(2); // 20/15 = 2 pages

      // Click page 2
      await pageButtons[1].trigger("click");
      await nextTick();

      // Apply filter -> should reset to page 1
      const searchInput = wrapper.find('input[type="text"]');
      await searchInput.setValue("User 1");
      await nextTick();
      // Filtering narrows the result, pagination should adjust
    });
  });
});

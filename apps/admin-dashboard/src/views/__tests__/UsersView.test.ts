/**
 * UsersView Component Tests
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { ref, computed } from "vue";
import { setActivePinia, createPinia } from "pinia";
import { userFactory, resetAllFactories } from "@makanmasak/testing-utils";
import { useAuthStore } from "@/stores/auth";

// Mock i18n
vi.mock("@/i18n", () => ({
  t: (key: string) => key,
  useI18n: () => ({ t: (key: string) => key }),
}));

// Mock useConfirmModal — auto-resolves to true by default
const mockUsersConfirmModalFn = vi.fn().mockResolvedValue(true);
vi.mock("@/composables/useConfirmModal", () => ({
  useConfirmModal: () => ({
    confirm: mockUsersConfirmModalFn,
    modalState: { value: null },
    close: vi.fn(),
  }),
}));

// Mock vue-toastification
const mockUsersToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));
vi.mock("vue-toastification", () => ({
  useToast: () => mockUsersToast,
}));

// Mock API
vi.mock("@/services/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
  authClient: {
    instance: {
      post: vi.fn(),
    },
    tokens: {
      clearAll: vi.fn(),
      scheduleProactiveRefresh: vi.fn(),
      setTokens: vi.fn(),
      setUser: vi.fn(),
    },
  },
}));

// Mock heroicons
vi.mock("@heroicons/vue/24/outline", () => {
  const stub = { template: "<span />" };
  return {
    PlusIcon: stub,
    MagnifyingGlassIcon: stub,
    UserIcon: stub,
    UserGroupIcon: stub,
    StarIcon: stub,
    ListBulletIcon: stub,
    CurrencyDollarIcon: stub,
    TruckIcon: stub,
  };
});

// Mock useVirtualScroll
vi.mock("@/composables/useVirtualScroll", () => ({
  useVirtualScroll: (items: any) => ({
    containerRef: ref(null),
    visibleItems: computed(() =>
      (items.value || []).map((item: any, i: number) => ({ item, index: i })),
    ),
    totalHeight: computed(() => (items.value || []).length * 80),
    offsetY: ref(0),
    handleScroll: vi.fn(),
  }),
}));

import UsersView from "../UsersView.vue";
import { api } from "@/services/api";

const mockUsers = [
  {
    ...userFactory.buildShopOwner(1, {
      overrides: {
        id: 1,
        username: "owner1",
        fullName: "Shop Owner",
        email: "owner@test.com",
        isActive: true,
      },
    }),
    lastLoginAt: "2024-01-15T10:00:00Z",
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    ...userFactory.buildChef(1, {
      overrides: {
        id: 2,
        username: "chef1",
        fullName: "Head Chef",
        email: "chef@test.com",
        isActive: true,
      },
    }),
    lastLoginAt: null,
    createdAt: "2024-02-01T00:00:00Z",
  },
  {
    ...userFactory.buildServiceCrew(1, {
      overrides: {
        id: 3,
        username: "server1",
        fullName: "Server One",
        email: "server@test.com",
        isActive: false,
      },
    }),
    lastLoginAt: "2024-03-01T10:00:00Z",
    createdAt: "2024-03-01T00:00:00Z",
  },
  {
    ...userFactory.buildCashier(1, {
      overrides: {
        id: 4,
        username: "cashier1",
        fullName: "Cashier One",
        email: "",
        isActive: true,
      },
    }),
    lastLoginAt: null,
    createdAt: "2024-04-01T00:00:00Z",
  },
];

function mockApiGetSuccess() {
  (api.get as Mock).mockResolvedValue({
    data: { success: true, data: mockUsers },
  });
}

function mockApiGetEmpty() {
  (api.get as Mock).mockResolvedValue({
    data: { success: true, data: [] },
  });
}

async function mountView() {
  const wrapper = mount(UsersView);
  await flushPromises();
  return wrapper;
}

function setAuthRestaurantId(id: string | null) {
  const authStore = useAuthStore();
  Object.defineProperty(authStore, "restaurantId", {
    value: id,
    configurable: true,
  });
}

describe("UsersView Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllFactories();
    setActivePinia(createPinia());
    // Restore default confirm modal behavior after clearAllMocks
    mockUsersConfirmModalFn.mockResolvedValue(true);
    mockApiGetSuccess();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  // ── 1. Component Mounting ──

  describe("Component Mounting", () => {
    it("should mount successfully", async () => {
      const wrapper = await mountView();
      expect(wrapper.exists()).toBe(true);
    });

    it("should display page title (users.title)", async () => {
      const wrapper = await mountView();
      expect(wrapper.text()).toContain("users.title");
    });

    it("should display add employee button", async () => {
      const wrapper = await mountView();
      const buttons = wrapper.findAll("button");
      const addButton = buttons.find((b) =>
        b.text().includes("users.addEmployee"),
      );
      expect(addButton).toBeDefined();
    });
  });

  // ── 2. Stats Cards ──

  describe("Stats Cards", () => {
    it("should display 5 role stat cards", async () => {
      const wrapper = await mountView();
      // Stats section has 5 cards in the grid
      const statsGrid = wrapper.find(
        ".grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-5",
      );
      expect(statsGrid.exists()).toBe(true);
      const cards = statsGrid.findAll(".bg-white");
      expect(cards).toHaveLength(5);
    });

    it("should compute correct counts per role from user data", async () => {
      const wrapper = await mountView();
      const text = wrapper.text();
      // owner: 1, chef: 1, service: 1, cashier: 1, total: 4
      // The stats section should contain these counts
      expect(text).toContain("users.stats.owner");
      expect(text).toContain("users.stats.chef");
      expect(text).toContain("users.stats.service");
      expect(text).toContain("users.stats.cashier");
      expect(text).toContain("users.stats.total");

      // Verify individual stat values by checking the stat card paragraphs
      const statsGrid = wrapper.find(
        ".grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-5",
      );
      const statValues = statsGrid.findAll("p");
      const values = statValues.map((p) => p.text().trim());
      expect(values).toContain("1"); // owner count
      expect(values).toContain("4"); // total count
    });
  });

  // ── 3. Search and Filter ──

  describe("Search and Filter", () => {
    it("should render search input", async () => {
      const wrapper = await mountView();
      const searchInput = wrapper.find('input[type="text"]');
      expect(searchInput.exists()).toBe(true);
    });

    it("should render role filter select", async () => {
      const wrapper = await mountView();
      const selects = wrapper.findAll("select");
      // First select in the filter bar is role filter
      expect(selects.length).toBeGreaterThanOrEqual(2);
      const roleSelect = selects[0];
      expect(roleSelect.text()).toContain("users.search.allRoles");
    });

    it("should render status filter select", async () => {
      const wrapper = await mountView();
      const selects = wrapper.findAll("select");
      const statusSelect = selects[1];
      expect(statusSelect.text()).toContain("users.search.allStatuses");
    });

    it("should filter users by search query (username/fullName/email)", async () => {
      const wrapper = await mountView();

      const searchInput = wrapper.find('input[type="text"]');
      await searchInput.setValue("chef");
      await flushPromises();

      // Only chef1 should remain
      const rows = wrapper.findAll("tbody tr");
      expect(rows).toHaveLength(1);
      expect(wrapper.text()).toContain("Head Chef");
    });

    it("should filter users by role", async () => {
      const wrapper = await mountView();

      const selects = wrapper.findAll("select");
      const roleSelect = selects[0];
      await roleSelect.setValue("1");
      await flushPromises();

      const rows = wrapper.findAll("tbody tr");
      expect(rows).toHaveLength(1);
      expect(wrapper.text()).toContain("Shop Owner");
    });

    it("should filter users by status", async () => {
      const wrapper = await mountView();

      const selects = wrapper.findAll("select");
      const statusSelect = selects[1];
      await statusSelect.setValue("inactive");
      await flushPromises();

      // Only server1 is inactive (isActive: false)
      const rows = wrapper.findAll("tbody tr");
      expect(rows).toHaveLength(1);
      expect(wrapper.text()).toContain("Server One");
    });
  });

  // ── 4. User List Display ──

  describe("User List Display", () => {
    it("should display user rows when data loaded", async () => {
      const wrapper = await mountView();
      const rows = wrapper.findAll("tbody tr");
      expect(rows).toHaveLength(4);
    });

    it("should show user fullName and email", async () => {
      const wrapper = await mountView();
      expect(wrapper.text()).toContain("Shop Owner");
      expect(wrapper.text()).toContain("owner@test.com");
      expect(wrapper.text()).toContain("Head Chef");
      expect(wrapper.text()).toContain("chef@test.com");
    });

    it("should show role badges", async () => {
      const wrapper = await mountView();
      expect(wrapper.text()).toContain("users.roles.owner");
      expect(wrapper.text()).toContain("users.roles.chef");
      expect(wrapper.text()).toContain("users.roles.service");
      expect(wrapper.text()).toContain("users.roles.cashier");
    });

    it("should show status badges", async () => {
      const wrapper = await mountView();
      // Active and inactive statuses should render
      expect(wrapper.text()).toContain("users.status.active");
      expect(wrapper.text()).toContain("users.status.inactive");
    });

    it("should show formatted dates", async () => {
      const wrapper = await mountView();
      // createdAt for each user should appear as formatted date
      const date = new Date("2024-01-01T00:00:00Z").toLocaleDateString("zh-TW");
      expect(wrapper.text()).toContain(date);
    });

    it('should show "users.table.neverLoggedIn" for null lastLoginAt', async () => {
      const wrapper = await mountView();
      expect(wrapper.text()).toContain("users.table.neverLoggedIn");
    });

    it('should show "users.table.noEmail" for empty email', async () => {
      const wrapper = await mountView();
      expect(wrapper.text()).toContain("users.table.noEmail");
    });
  });

  // ── 5. Add User Modal ──

  describe("Add User Modal", () => {
    it("should open modal when add button clicked", async () => {
      const wrapper = await mountView();

      // Modal should not be visible initially
      expect(wrapper.find("form").exists()).toBe(false);

      const addButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("users.addEmployee"));
      await addButton!.trigger("click");
      await flushPromises();

      expect(wrapper.find("form").exists()).toBe(true);
      expect(wrapper.text()).toContain("users.modal.addTitle");
    });

    it("should display form fields (username, password, fullName, email, role)", async () => {
      const wrapper = await mountView();

      const addButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("users.addEmployee"));
      await addButton!.trigger("click");
      await flushPromises();

      expect(wrapper.text()).toContain("users.modal.usernameLabel");
      expect(wrapper.text()).toContain("users.modal.passwordLabel");
      expect(wrapper.text()).toContain("users.modal.fullNameLabel");
      expect(wrapper.text()).toContain("Email");
      expect(wrapper.text()).toContain("users.modal.roleLabel");
    });

    it("should close modal and reset form on cancel", async () => {
      const wrapper = await mountView();

      // Open modal
      const addButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("users.addEmployee"));
      await addButton!.trigger("click");
      await flushPromises();

      // Set some form values
      const inputs = wrapper.findAll("form input");
      await inputs[0].setValue("testuser");

      // Click cancel
      const cancelButton = wrapper
        .findAll("form button")
        .find((b) => b.text().includes("users.modal.cancel"));
      await cancelButton!.trigger("click");
      await flushPromises();

      // Modal should be closed
      expect(wrapper.find("form").exists()).toBe(false);
    });

    it("should call api.post with form data on submit (new user)", async () => {
      (api.post as Mock).mockResolvedValue({
        data: { success: true, data: {} },
      });

      const wrapper = await mountView();

      // Open modal
      const addButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("users.addEmployee"));
      await addButton!.trigger("click");
      await flushPromises();

      // Fill form
      const inputs = wrapper.findAll("form input");
      await inputs[0].setValue("newuser"); // username
      await inputs[1].setValue("Password123!"); // password
      await inputs[2].setValue("New User"); // fullName
      await inputs[3].setValue("new@test.com"); // email

      const roleSelect = wrapper.find("form select");
      await roleSelect.setValue(2);

      // Submit
      const form = wrapper.find("form");
      await form.trigger("submit");
      await flushPromises();

      expect(api.post).toHaveBeenCalledOnce();
      expect(api.post).toHaveBeenCalledWith(
        "/users",
        expect.objectContaining({
          username: "newuser",
          password: "Password123!",
          fullName: "New User",
          email: "new@test.com",
        }),
      );
    });

    it("should refetch users after save", async () => {
      (api.post as Mock).mockResolvedValue({
        data: { success: true, data: {} },
      });

      const wrapper = await mountView();

      // Initial fetch
      expect(api.get).toHaveBeenCalledTimes(1);

      // Open modal and submit
      const addButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("users.addEmployee"));
      await addButton!.trigger("click");
      await flushPromises();

      const inputs = wrapper.findAll("form input");
      await inputs[0].setValue("newuser");
      await inputs[1].setValue("Pass123!");
      await inputs[2].setValue("Test");

      const form = wrapper.find("form");
      await form.trigger("submit");
      await flushPromises();

      // Should have fetched again after save
      expect(api.get).toHaveBeenCalledTimes(2);
    });
  });

  // ── 6. Edit User Modal ──

  describe("Edit User Modal", () => {
    it("should populate form with user data when edit clicked", async () => {
      const wrapper = await mountView();

      const editButton = wrapper
        .findAll("button")
        .find((b) => b.text() === "users.actions.edit");
      await editButton!.trigger("click");
      await flushPromises();

      expect(wrapper.text()).toContain("users.modal.editTitle");

      // Username input should be populated
      const usernameInput = wrapper.find(
        "form input[type='text']",
      ) as ReturnType<typeof wrapper.find>;
      expect((usernameInput.element as HTMLInputElement).value).toBe("owner1");
    });

    it("should disable username field when editing", async () => {
      const wrapper = await mountView();

      const editButton = wrapper
        .findAll("button")
        .find((b) => b.text() === "users.actions.edit");
      await editButton!.trigger("click");
      await flushPromises();

      const usernameInput = wrapper.find("form input[type='text']");
      expect((usernameInput.element as HTMLInputElement).disabled).toBe(true);
    });

    it("should hide password field when editing", async () => {
      const wrapper = await mountView();

      const editButton = wrapper
        .findAll("button")
        .find((b) => b.text() === "users.actions.edit");
      await editButton!.trigger("click");
      await flushPromises();

      const passwordInput = wrapper.find("form input[type='password']");
      expect(passwordInput.exists()).toBe(false);
    });

    it("should show status select when editing", async () => {
      const wrapper = await mountView();

      const editButton = wrapper
        .findAll("button")
        .find((b) => b.text() === "users.actions.edit");
      await editButton!.trigger("click");
      await flushPromises();

      expect(wrapper.text()).toContain("users.modal.statusLabel");
    });

    it("should call api.put on submit (existing user)", async () => {
      (api.put as Mock).mockResolvedValue({
        data: { success: true, data: {} },
      });

      const wrapper = await mountView();

      const editButton = wrapper
        .findAll("button")
        .find((b) => b.text() === "users.actions.edit");
      await editButton!.trigger("click");
      await flushPromises();

      const form = wrapper.find("form");
      await form.trigger("submit");
      await flushPromises();

      expect(api.put).toHaveBeenCalledOnce();
      expect(api.put).toHaveBeenCalledWith(
        "/users/1",
        expect.objectContaining({
          fullName: expect.any(String),
          email: expect.any(String),
          role: expect.any(Number),
        }),
      );
    });
  });

  // ── 7. User Actions ──

  describe("User Actions", () => {
    it("should call reset password API when reset password clicked (with confirm)", async () => {
      (api.post as Mock).mockResolvedValue({
        data: { success: true },
      });

      const wrapper = await mountView();

      const resetButton = wrapper
        .findAll("button")
        .find((b) => b.text() === "users.actions.resetPassword");
      await resetButton!.trigger("click");
      await flushPromises();

      // Component uses useConfirmModal (not window.confirm)
      expect(mockUsersConfirmModalFn).toHaveBeenCalledOnce();
      expect(api.post).toHaveBeenCalledOnce();
      expect(api.post).toHaveBeenCalledWith(
        expect.stringContaining("/reset-password"),
        expect.objectContaining({
          newPassword: expect.any(String),
          confirmPassword: expect.any(String),
        }),
      );
    });

    it("should call toggle status API when disable/enable clicked (with confirm)", async () => {
      (api.patch as Mock).mockResolvedValue({
        data: { success: true },
      });

      const wrapper = await mountView();

      // First user (owner1) is active, so the button says "disable"
      const disableButton = wrapper
        .findAll("button")
        .find((b) => b.text() === "users.actions.disable");
      await disableButton!.trigger("click");
      await flushPromises();

      // Component uses useConfirmModal (not window.confirm)
      expect(mockUsersConfirmModalFn).toHaveBeenCalledOnce();
      expect(api.patch).toHaveBeenCalledOnce();
      expect(api.patch).toHaveBeenCalledWith(
        expect.stringContaining("/status"),
        expect.objectContaining({
          isActive: false,
        }),
      );
    });

    it("should show enable button for inactive users", async () => {
      const wrapper = await mountView();

      // server1 is inactive - find its row and check for enable button
      const enableButtons = wrapper
        .findAll("button")
        .filter((b) => b.text() === "users.actions.enable");
      expect(enableButtons.length).toBeGreaterThanOrEqual(1);
    });

    it("should show disable button for active users", async () => {
      const wrapper = await mountView();

      const disableButtons = wrapper
        .findAll("button")
        .filter((b) => b.text() === "users.actions.disable");
      // 3 active users (owner1, chef1, cashier1)
      expect(disableButtons.length).toBe(3);
    });
  });

  // ── 8. Empty State ──

  describe("Empty State", () => {
    it("should show empty state when no users", async () => {
      mockApiGetEmpty();
      const wrapper = await mountView();

      expect(wrapper.text()).toContain("users.empty.title");
      expect(wrapper.text()).toContain("users.empty.description");
    });

    it("should show add employee button in empty state", async () => {
      mockApiGetEmpty();
      const wrapper = await mountView();

      // Should still have the add button
      const addButtons = wrapper
        .findAll("button")
        .filter((b) => b.text().includes("users.addEmployee"));
      // Page header button + empty state button
      expect(addButtons.length).toBe(2);
    });
  });

  // ── 9. API Integration ──

  describe("API Integration", () => {
    it("should fetch users on mount", async () => {
      await mountView();

      expect(api.get).toHaveBeenCalledOnce();
      expect(api.get).toHaveBeenCalledWith("/users");
    });

    it("should scope user list to the selected restaurant", async () => {
      setAuthRestaurantId("rest-1");

      await mountView();

      expect(api.get).toHaveBeenCalledWith("/users?restaurantId=rest-1");
    });

    it("should handle fetch error gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      (api.get as Mock).mockRejectedValue(new Error("Network error"));

      const wrapper = await mountView();

      expect(wrapper.exists()).toBe(true);
      expect(consoleSpy).toHaveBeenCalledOnce();
      consoleSpy.mockRestore();
    });
  });
});

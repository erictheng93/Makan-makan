/**
 * AccountManagementView — Unit tests for the Admin account management page
 *
 * Covers:
 *  1. Layout & heading
 *  2. Tab navigation (owners / admins)
 *  3. Owner registration form
 *  4. Admin registration form
 *  5. Existing owners table
 *  6. Existing admins table
 *  7. Restaurant binding (select / create new)
 *  8. Form validation
 *  9. Submission & API calls
 * 10. Loading / empty states
 * 11. API calls on mount
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { nextTick } from "vue";
import {
  userFactory,
  restaurantFactory,
  resetAllFactories,
} from "@makanmakan/testing-utils";

// ──── Mocks ────

vi.mock("lucide-vue-next", () => {
  const stub = { template: "<span />" };
  return {
    UserPlus: stub,
    Building2: stub,
    Shield: stub,
    ChevronDown: stub,
    Loader2: stub,
  };
});

const mockPush = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ params: {}, query: {} }),
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("vue-toastification", () => ({
  useToast: () => ({ success: mockToastSuccess, error: mockToastError }),
}));

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();

vi.mock("@/services/api", () => ({
  api: {
    get: (...args: any[]) => mockApiGet(...args),
    post: (...args: any[]) => mockApiPost(...args),
  },
}));

// ──── Component import ────
import AccountManagementView from "../AccountManagementView.vue";

// ──── Test data ────

const restaurant1 = restaurantFactory.build({
  overrides: { id: 1, name: "麵屋一號" },
});
const restaurant2 = restaurantFactory.build({
  overrides: { id: 2, name: "壽司之神" },
});
const sampleRestaurants = [
  { id: restaurant1.id, name: restaurant1.name },
  { id: restaurant2.id, name: restaurant2.name },
];

const owner1 = userFactory.buildShopOwner(1, {
  overrides: {
    id: 10,
    username: "owner1",
    fullName: "王老闆",
    email: "owner1@test.com",
  },
});
const owner2 = userFactory.buildShopOwner(2, {
  overrides: {
    id: 11,
    username: "owner2",
    fullName: "李老闆",
    email: "owner2@test.com",
  },
});
const sampleOwners = [
  {
    id: owner1.id,
    username: owner1.username,
    fullName: owner1.fullName,
    email: owner1.email,
    restaurantId: "1",
    status: "active",
    createdAt: "2025-01-15T00:00:00Z",
  },
  {
    id: owner2.id,
    username: owner2.username,
    fullName: owner2.fullName,
    email: owner2.email,
    restaurantId: "2",
    status: "inactive",
    createdAt: "2025-02-20T00:00:00Z",
  },
];

const admin1 = userFactory.buildAdmin({
  overrides: {
    id: 20,
    username: "admin1",
    fullName: "系統管理員",
    email: "admin@test.com",
  },
});
const sampleAdmins = [
  {
    id: admin1.id,
    username: admin1.username,
    fullName: admin1.fullName,
    email: admin1.email,
    status: "active",
    createdAt: "2025-01-01T00:00:00Z",
  },
];

// ──── Helpers ────

function defaultApiMocks() {
  mockApiGet.mockImplementation((url: string, opts?: any) => {
    if (url === "/restaurants") {
      return Promise.resolve({
        data: { success: true, data: sampleRestaurants },
      });
    }
    if (url === "/users") {
      if (opts?.params?.role === 1) {
        return Promise.resolve({ data: { success: true, data: sampleOwners } });
      }
      if (opts?.params?.role === 0) {
        return Promise.resolve({ data: { success: true, data: sampleAdmins } });
      }
    }
    return Promise.resolve({ data: { success: true, data: [] } });
  });

  mockApiPost.mockResolvedValue({ data: { success: true, data: { id: 99 } } });
}

function emptyApiMocks() {
  mockApiGet.mockImplementation((url: string, opts?: any) => {
    if (url === "/restaurants") {
      return Promise.resolve({ data: { success: true, data: [] } });
    }
    if (url === "/users") {
      return Promise.resolve({ data: { success: true, data: [] } });
    }
    return Promise.resolve({ data: { success: true, data: [] } });
  });
}

function createWrapper() {
  return mount(AccountManagementView, {
    global: {
      stubs: {
        "router-link": { template: "<a><slot /></a>" },
      },
    },
  });
}

// ──── Tests ────

describe("AccountManagementView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    resetAllFactories();
    defaultApiMocks();
  });

  describe("Layout & Heading", () => {
    it("should render the page title", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("accountManagement.title");
    });
  });

  describe("Tab Navigation", () => {
    it("should render owners and admins tabs", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("accountManagement.tabOwners");
      expect(wrapper.text()).toContain("accountManagement.tabAdmins");
    });

    it("should show owners tab as active by default", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const tabs = wrapper.findAll("nav button");
      expect(tabs[0].attributes("data-active")).toBe("true");
    });

    it("should switch to admins tab when clicked", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const tabs = wrapper.findAll("nav button");
      await tabs[1].trigger("click");
      await nextTick();
      expect(tabs[1].attributes("data-active")).toBe("true");
    });

    it("should show admin form when admins tab is active", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const tabs = wrapper.findAll("nav button");
      await tabs[1].trigger("click");
      await nextTick();
      expect(wrapper.text()).toContain("accountManagement.submitAdmin");
    });

    it("should show owner form when owners tab is active", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("accountManagement.submitOwner");
    });
  });

  describe("Owner Registration Form", () => {
    it("should render account info section", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("accountManagement.accountInfo");
    });

    it("should render username field", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("accountManagement.username");
    });

    it("should render password field", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("accountManagement.password");
    });

    it("should render fullName field", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("accountManagement.fullName");
    });

    it("should render email field", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("accountManagement.email");
    });

    it("should render restaurant binding section", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("accountManagement.restaurantBinding");
    });

    it("should render permission confirmation section", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("accountManagement.permissionConfirm");
    });

    it("should render owner permissions list", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain(
        "accountManagement.ownerPermissions.manageMenu",
      );
      expect(wrapper.text()).toContain(
        "accountManagement.ownerPermissions.manageOrders",
      );
      expect(wrapper.text()).toContain(
        "accountManagement.ownerPermissions.manageEmployees",
      );
    });
  });

  describe("Restaurant Binding", () => {
    it("should render restaurant select with options from API", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const select = wrapper.find("select");
      expect(select.exists()).toBe(true);
      const options = select.findAll("option");
      // disabled placeholder + 2 restaurants + "create new" option
      expect(options.length).toBe(4);
    });

    it("should show create new restaurant option", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("accountManagement.createNewRestaurant");
    });

    it("should show new restaurant fields when create new is selected", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const select = wrapper.find("select");
      // Trigger the change event to select "__new__"
      await select.setValue("__new__");
      await select.trigger("change");
      await nextTick();
      expect(wrapper.text()).toContain("accountManagement.restaurantName");
    });
  });

  describe("Existing Owners Table", () => {
    it("should render existing owners section", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("accountManagement.existingOwners");
    });

    it("should render owner names in table", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("王老闆");
      expect(wrapper.text()).toContain("李老闆");
    });

    it("should render owner usernames", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("@owner1");
      expect(wrapper.text()).toContain("@owner2");
    });

    it("should show active badge for active owners", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("accountManagement.statusActive");
    });

    it("should show inactive badge for inactive owners", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("accountManagement.statusInactive");
    });

    it("should show empty state when no owners", async () => {
      emptyApiMocks();
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("accountManagement.noOwners");
    });
  });

  describe("Existing Admins Table", () => {
    it("should render existing admins section when tab is switched", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const tabs = wrapper.findAll("nav button");
      await tabs[1].trigger("click");
      await nextTick();
      expect(wrapper.text()).toContain("accountManagement.existingAdmins");
    });

    it("should render admin names in table", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const tabs = wrapper.findAll("nav button");
      await tabs[1].trigger("click");
      await nextTick();
      expect(wrapper.text()).toContain("系統管理員");
    });

    it("should render admin email in table", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const tabs = wrapper.findAll("nav button");
      await tabs[1].trigger("click");
      await nextTick();
      expect(wrapper.text()).toContain("admin@test.com");
    });

    it("should show empty state when no admins", async () => {
      emptyApiMocks();
      const wrapper = createWrapper();
      await flushPromises();
      const tabs = wrapper.findAll("nav button");
      await tabs[1].trigger("click");
      await nextTick();
      expect(wrapper.text()).toContain("accountManagement.noAdmins");
    });
  });

  describe("API Calls on Mount", () => {
    it("should fetch restaurants on mount", async () => {
      createWrapper();
      await flushPromises();
      expect(mockApiGet).toHaveBeenCalledWith("/restaurants");
    });

    it("should fetch owners on mount", async () => {
      createWrapper();
      await flushPromises();
      expect(mockApiGet).toHaveBeenCalledWith("/users", {
        params: { role: 1 },
      });
    });

    it("should fetch admins on mount", async () => {
      createWrapper();
      await flushPromises();
      expect(mockApiGet).toHaveBeenCalledWith("/users", {
        params: { role: 0 },
      });
    });

    it("should handle API error gracefully", async () => {
      mockApiGet.mockRejectedValue(new Error("Network error"));
      const wrapper = createWrapper();
      await flushPromises();
      // Should not crash, shows empty tables
      expect(wrapper.text()).toContain("accountManagement.noOwners");
    });
  });

  describe("Form Validation", () => {
    it("should show validation errors when submitting empty owner form", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const form = wrapper.find("form");
      await form.trigger("submit");
      await nextTick();
      expect(wrapper.text()).toContain("accountManagement.usernameRequired");
      expect(wrapper.text()).toContain("accountManagement.passwordRequired");
      expect(wrapper.text()).toContain("accountManagement.fullNameRequired");
      expect(wrapper.text()).toContain("accountManagement.emailRequired");
    });

    it("should show validation errors when submitting empty admin form", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      // Switch to admins tab
      const tabs = wrapper.findAll("nav button");
      await tabs[1].trigger("click");
      await nextTick();
      const form = wrapper.find("form");
      await form.trigger("submit");
      await nextTick();
      expect(wrapper.text()).toContain("accountManagement.usernameRequired");
    });
  });
});

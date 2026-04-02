/**
 * PlatformOverview — Unit tests for the Admin platform overview page
 *
 * Covers:
 *  1. Layout & heading
 *  2. Stats cards (Total, Active, Inactive)
 *  3. Restaurant list rendering
 *  4. "管理" (Manage) button per restaurant
 *  5. Restaurant selection / context switch
 *  6. Loading state
 *  7. Empty state
 *  8. API calls on mount
 *  9. Active/Inactive badge display
 * 10. Address display
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

// ──── Mocks ────

vi.mock("lucide-vue-next", () => {
  const stub = { template: "<span />" };
  return { Store: stub };
});

const mockPush = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ params: {}, query: {} }),
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const mockApiGet = vi.fn();

vi.mock("@/services/api", () => ({
  api: {
    get: (...args: any[]) => mockApiGet(...args),
  },
}));

const mockSelectRestaurant = vi.fn();
vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    selectRestaurant: mockSelectRestaurant,
  }),
}));

// ──── Component import ────
import PlatformOverview from "../PlatformOverview.vue";

// ──── Test data ────

const sampleRestaurants = [
  { id: 1, name: "麵屋一號", address: "台北市中山區", isActive: true },
  { id: 2, name: "壽司之神", address: "台北市大安區", isActive: true },
  { id: 3, name: "休息中餐廳", address: "台北市信義區", isActive: false },
];

// ──── Helpers ────

function defaultApiMocks() {
  mockApiGet.mockResolvedValue({
    data: {
      success: true,
      data: sampleRestaurants,
    },
  });
}

function emptyApiMocks() {
  mockApiGet.mockResolvedValue({
    data: { success: true, data: [] },
  });
}

function createWrapper() {
  return mount(PlatformOverview, {
    global: {
      stubs: {
        "router-link": { template: "<a><slot /></a>" },
      },
    },
  });
}

// ──── Tests ────

describe("PlatformOverview", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    defaultApiMocks();
  });

  describe("Layout & Heading", () => {
    it("should render the page title", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("platform.title");
    });

    it("should render the page description", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("platform.description");
    });
  });

  describe("Stats Cards", () => {
    it("should render 3 stats cards", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      // Grid with 3 cards
      const statCards = wrapper.findAll(
        ".grid.grid-cols-1.sm\\:grid-cols-3 > div",
      );
      expect(statCards.length).toBe(3);
    });

    it("should display total restaurants count", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("platform.totalRestaurants");
      expect(wrapper.text()).toContain("3");
    });

    it("should display active restaurants count", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("platform.active");
      // 2 active restaurants
      const greenText = wrapper.find(".text-green-600");
      expect(greenText.text()).toBe("2");
    });

    it("should display inactive restaurants count", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("platform.inactive");
      // 1 inactive restaurant
      const grayText = wrapper.find(".text-gray-400");
      expect(grayText.text()).toBe("1");
    });
  });

  describe("Restaurant List Rendering", () => {
    it("should render restaurant cards for each restaurant", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("麵屋一號");
      expect(wrapper.text()).toContain("壽司之神");
      expect(wrapper.text()).toContain("休息中餐廳");
    });

    it("should render restaurant addresses", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("台北市中山區");
      expect(wrapper.text()).toContain("台北市大安區");
      expect(wrapper.text()).toContain("台北市信義區");
    });

    it("should show active badge for active restaurants", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const activeBadges = wrapper.findAll(".bg-green-100.text-green-700");
      expect(activeBadges.length).toBe(2);
    });

    it("should show inactive badge for inactive restaurants", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const inactiveBadges = wrapper.findAll(".bg-gray-100.text-gray-500");
      expect(inactiveBadges.length).toBe(1);
    });
  });

  describe("Manage Button", () => {
    it("should render manage button for each restaurant", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const manageButtons = wrapper
        .findAll("button")
        .filter((b) => b.text().includes("platform.manage"));
      expect(manageButtons.length).toBe(3);
    });

    it("should call selectRestaurant and navigate on manage click", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const manageButtons = wrapper
        .findAll("button")
        .filter((b) => b.text().includes("platform.manage"));
      await manageButtons[0].trigger("click");
      expect(mockSelectRestaurant).toHaveBeenCalledWith("1", "麵屋一號");
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });

    it("should pass correct restaurant id for second restaurant", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const manageButtons = wrapper
        .findAll("button")
        .filter((b) => b.text().includes("platform.manage"));
      await manageButtons[1].trigger("click");
      expect(mockSelectRestaurant).toHaveBeenCalledWith("2", "壽司之神");
    });
  });

  describe("Loading State", () => {
    it("should show loading spinner while fetching", async () => {
      // Make API never resolve
      mockApiGet.mockReturnValue(new Promise(() => {}));
      const wrapper = createWrapper();
      await flushPromises();
      const spinner = wrapper.find(".animate-spin");
      expect(spinner.exists()).toBe(true);
    });

    it("should hide loading spinner after data loads", async () => {
      const wrapper = createWrapper();
      await flushPromises();
      const spinner = wrapper.find(".animate-spin");
      expect(spinner.exists()).toBe(false);
    });
  });

  describe("Empty State", () => {
    it("should show empty state when no restaurants", async () => {
      emptyApiMocks();
      const wrapper = createWrapper();
      await flushPromises();
      expect(wrapper.text()).toContain("platform.noRestaurants");
      expect(wrapper.text()).toContain("platform.noRestaurantsDesc");
    });

    it("should not show restaurant grid when empty", async () => {
      emptyApiMocks();
      const wrapper = createWrapper();
      await flushPromises();
      const grid = wrapper.find(
        ".grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3",
      );
      expect(grid.exists()).toBe(false);
    });
  });

  describe("API Calls on Mount", () => {
    it("should call api.get /restaurants on mount", async () => {
      createWrapper();
      await flushPromises();
      expect(mockApiGet).toHaveBeenCalledWith("/restaurants");
    });

    it("should call api.get exactly once", async () => {
      createWrapper();
      await flushPromises();
      expect(mockApiGet).toHaveBeenCalledTimes(1);
    });

    it("should handle API error gracefully", async () => {
      mockApiGet.mockRejectedValue(new Error("Network error"));
      const wrapper = createWrapper();
      await flushPromises();
      // Should show empty state (no crash)
      expect(wrapper.text()).toContain("platform.noRestaurants");
    });
  });
});

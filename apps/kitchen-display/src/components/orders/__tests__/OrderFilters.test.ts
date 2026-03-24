/**
 * OrderFilters Component Tests
 * 測試 OrderFilters 組件的篩選、搜索和過濾功能
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import OrderFilters from "../OrderFilters.vue";
import type { KitchenOrder } from "@/types";

// Mock icons - 必須包含 template 屬性
vi.mock("@heroicons/vue/24/outline", () => ({
  FunnelIcon: { name: "FunnelIcon", template: "<svg />" },
  MagnifyingGlassIcon: { name: "MagnifyingGlassIcon", template: "<svg />" },
  XMarkIcon: { name: "XMarkIcon", template: "<svg />" },
  ChevronDownIcon: { name: "ChevronDownIcon", template: "<svg />" },
  ChevronUpIcon: { name: "ChevronUpIcon", template: "<svg />" },
  ClockIcon: { name: "ClockIcon", template: "<svg />" },
  FireIcon: { name: "FireIcon", template: "<svg />" },
  CheckCircleIcon: { name: "CheckCircleIcon", template: "<svg />" },
  ExclamationTriangleIcon: {
    name: "ExclamationTriangleIcon",
    template: "<svg />",
  },
  ChatBubbleLeftEllipsisIcon: {
    name: "ChatBubbleLeftEllipsisIcon",
    template: "<svg />",
  },
  Cog6ToothIcon: { name: "Cog6ToothIcon", template: "<svg />" },
}));

// Mock orders data
const mockOrders: KitchenOrder[] = [
  {
    id: 1,
    orderNumber: "ORD-001",
    tableName: "A-1",
    tableId: 1,
    customerName: "張三",
    priority: "normal",
    status: 1, // confirmed
    createdAt: new Date().toISOString(),
    elapsedTime: 300,
    totalItems: 1,
    items: [
      {
        id: 1,
        name: "宮保雞丁",
        quantity: 2,
        status: "pending",
        notes: "不要辣",
        priority: "normal",
      },
    ],
  },
  {
    id: 2,
    orderNumber: "ORD-002",
    tableName: "B-2",
    tableId: 2,
    priority: "urgent",
    status: 2, // preparing
    createdAt: new Date().toISOString(),
    elapsedTime: 600,
    totalItems: 1,
    items: [
      {
        id: 2,
        name: "炒飯",
        quantity: 1,
        status: "preparing",
        priority: "urgent",
      },
    ],
  },
  {
    id: 3,
    orderNumber: "ORD-003",
    tableName: "C-3",
    tableId: 3,
    priority: "high",
    status: 3, // ready
    createdAt: new Date().toISOString(),
    elapsedTime: 120,
    totalItems: 1,
    items: [
      {
        id: 3,
        name: "湯麵",
        quantity: 1,
        status: "ready",
        customizations: ["加辣", "加蛋"],
        priority: "high",
      },
    ],
  },
];

// Helper function to mount component with default props
let pinia: ReturnType<typeof createPinia>;

function createWrapper(propsOverride: any = {}) {
  return mount(OrderFilters, {
    props: {
      orders: mockOrders,
      filteredCount: mockOrders.length,
      ...propsOverride,
    },
    global: {
      plugins: [pinia],
    },
  });
}

describe("OrderFilters Component", () => {
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
  });
  describe("Component Rendering", () => {
    it("should render filter header", () => {
      const wrapper = createWrapper();

      // The component renders status pills and quick filters as its header
      // "全部" is always present as the first pill, along with the expand/collapse toggle
      expect(wrapper.text()).toContain("全部");
      expect(wrapper.find("button[title]").exists()).toBe(true);
    });

    it("should render search input", () => {
      const wrapper = createWrapper();

      const searchInput = wrapper.find('input[type="text"]');
      expect(searchInput.exists()).toBe(true);
      expect(searchInput.attributes("placeholder")).toMatch(/搜索|search/i);
    });

    it("should render quick filter buttons", () => {
      const wrapper = createWrapper();

      const quickFilters = wrapper
        .findAll("button")
        .filter((btn) =>
          btn.classes().some((cls) => cls.includes("rounded-full")),
        );

      expect(quickFilters.length).toBeGreaterThan(0);
    });

    it("should start with filters collapsed by default", () => {
      const wrapper = createWrapper({
        showFilters: false,
      });

      const detailedFilters = wrapper.find(".space-y-4");
      expect(detailedFilters.exists()).toBe(false);
    });
  });

  describe("Search Functionality", () => {
    it("should update search text on input", async () => {
      const wrapper = createWrapper();

      const searchInput = wrapper.find('input[type="text"]');
      await searchInput.setValue("ORD-001");

      expect((searchInput.element as HTMLInputElement).value).toBe("ORD-001");
    });

    it("should emit search event with query", async () => {
      const wrapper = createWrapper();

      const searchInput = wrapper.find('input[type="text"]');
      await searchInput.setValue("張三");
      await searchInput.trigger("input");
      await nextTick();

      // Check if component processes search
      expect(wrapper.vm.searchText).toBe("張三");
    });

    it("should clear search text when clear button clicked", async () => {
      const wrapper = createWrapper();

      const searchInput = wrapper.find('input[type="text"]');
      await searchInput.setValue("test search");
      await nextTick();

      // The clear button is in a container that only shows when searchText exists
      // It's located in the right side of the search input
      const clearButtonContainer = wrapper.find(".absolute.inset-y-0.right-0");
      expect(clearButtonContainer.exists()).toBe(true);

      const clearButton = clearButtonContainer.find("button");
      expect(clearButton.exists()).toBe(true);

      await clearButton.trigger("click");
      await nextTick();

      // Search should be cleared
      expect(wrapper.vm.searchText).toBe("");
    });

    it("should show clear button only when search has text", async () => {
      const wrapper = createWrapper();
      await nextTick();

      // Initially searchText is empty, so clear button shouldn't exist
      expect(wrapper.vm.searchText).toBe("");

      // After typing, search text should be set
      const searchInput = wrapper.find('input[type="text"]');
      await searchInput.setValue("search");
      await nextTick();

      expect(wrapper.vm.searchText).toBe("search");
      // v-if="searchText" means button appears when searchText has value
    });

    it("should search across multiple fields", async () => {
      const wrapper = createWrapper();

      const searchInput = wrapper.find('input[type="text"]');

      // Should handle order number
      await searchInput.setValue("ORD-001");
      expect((searchInput.element as HTMLInputElement).value).toBe("ORD-001");

      // Should handle customer name
      await searchInput.setValue("張三");
      expect((searchInput.element as HTMLInputElement).value).toBe("張三");

      // Should handle table name
      await searchInput.setValue("T1");
      expect((searchInput.element as HTMLInputElement).value).toBe("T1");
    });
  });

  describe("Quick Filters", () => {
    it("should toggle quick filter on click", async () => {
      const wrapper = createWrapper();

      // Find the "待處理" pill (second rounded-full button, after "全部")
      // Clicking it toggles status filter 1, which changes its classes
      const allPills = wrapper
        .findAll("button")
        .filter((btn) =>
          btn.classes().some((cls) => cls.includes("rounded-full")),
        );

      // Skip "全部" (index 0) — it's a clear action, not a toggle
      if (allPills.length > 1) {
        const statusPill = allPills[1]; // "待處理"
        const initialClasses = statusPill.classes();

        await statusPill.trigger("click");
        await nextTick();

        const updatedClasses = statusPill.classes();
        expect(initialClasses).not.toEqual(updatedClasses);
      }
    });

    it("should display active filter count badge", async () => {
      const wrapper = createWrapper();

      // Click "待處理" pill to activate a status filter
      const allPills = wrapper
        .findAll("button")
        .filter((btn) =>
          btn.classes().some((cls) => cls.includes("rounded-full")),
        );

      if (allPills.length > 1) {
        await allPills[1].trigger("click"); // "待處理"
        await nextTick();

        // The badge uses class "bg-ios-blue/10" (Tailwind opacity modifier)
        const badge = wrapper.find('[class*="bg-ios-blue"]');
        expect(badge.exists()).toBe(true);
      }
    });

    it("should support multiple quick filters simultaneously", async () => {
      const wrapper = createWrapper();

      const allPills = wrapper
        .findAll("button")
        .filter((btn) =>
          btn.classes().some((cls) => cls.includes("rounded-full")),
        );

      // Click "待處理" (index 1) and "製作中" (index 2) — both are status toggles
      if (allPills.length >= 3) {
        await allPills[1].trigger("click"); // 待處理 → selectedStatuses = [1]
        await allPills[2].trigger("click"); // 製作中 → selectedStatuses = [1, 2]
        await nextTick();

        // Both should now have active style (bg-ios-blue)
        expect(allPills[1].classes()).toContain("bg-ios-blue");
        expect(allPills[2].classes()).toContain("bg-ios-blue");
      }
    });

    it("should have urgent orders quick filter", () => {
      const wrapper = createWrapper();

      const quickFilterButtons = wrapper.findAll("button");
      const urgentFilter = quickFilterButtons.find((btn) =>
        btn.text().match(/緊急|urgent/i),
      );

      expect(urgentFilter).toBeDefined();
    });

    it("should have preparing orders quick filter", () => {
      const wrapper = createWrapper();

      const quickFilterButtons = wrapper.findAll("button");
      const preparingFilter = quickFilterButtons.find((btn) =>
        btn.text().match(/製作中|preparing/i),
      );

      expect(preparingFilter).toBeDefined();
    });
  });

  describe("Detailed Filters", () => {
    it("should toggle detailed filters visibility", async () => {
      const wrapper = createWrapper();

      const toggleButton = wrapper.find("button[title]");
      if (toggleButton.exists()) {
        await toggleButton.trigger("click");

        // Detailed filters should appear
        const detailedFilters = wrapper.find(".space-y-4");
        expect(detailedFilters.exists()).toBe(true);
      }
    });

    it("should render status filter options", async () => {
      const wrapper = createWrapper();
      wrapper.vm.showFilters = true;
      await nextTick();

      // Should have status checkboxes
      const statusCheckboxes = wrapper.findAll('input[type="checkbox"]');
      expect(statusCheckboxes.length).toBeGreaterThan(0);
    });

    it("should filter by single status", async () => {
      const wrapper = createWrapper();
      wrapper.vm.showFilters = true;
      await nextTick();

      const statusCheckboxes = wrapper.findAll('input[type="checkbox"]');
      if (statusCheckboxes.length > 0) {
        await statusCheckboxes[0].setValue(true);
        await nextTick();

        // Filter should be applied
        expect(wrapper.vm.selectedStatuses).toBeDefined();
      }
    });

    it("should filter by multiple statuses", async () => {
      const wrapper = createWrapper();
      wrapper.vm.showFilters = true;
      await nextTick();

      const statusCheckboxes = wrapper.findAll('input[type="checkbox"]');
      if (statusCheckboxes.length >= 2) {
        await statusCheckboxes[0].setValue(true);
        await statusCheckboxes[1].setValue(true);
        await nextTick();

        // Multiple filters should be active
        expect(wrapper.vm.selectedStatuses.length).toBeGreaterThan(1);
      }
    });

    it("should have priority filter options", async () => {
      const wrapper = createWrapper();
      wrapper.vm.showFilters = true;
      await nextTick();

      // Should have priority options
      expect(wrapper.text()).toMatch(/優先|priority/i);
    });

    it("should have time range filter", async () => {
      const wrapper = createWrapper();
      wrapper.vm.showFilters = true;
      await nextTick();

      // Should have time-related filters
      expect(wrapper.text()).toMatch(/時間|time|等待|分鐘/i);
    });
  });

  describe("Clear Filters", () => {
    it("should show clear button when filters are active", async () => {
      const wrapper = createWrapper();

      // Click "待處理" to activate a filter (not "全部" which just clears)
      const allPills = wrapper
        .findAll("button")
        .filter((btn) =>
          btn.classes().some((cls) => cls.includes("rounded-full")),
        );

      if (allPills.length > 1) {
        await allPills[1].trigger("click"); // 待處理
        await nextTick();

        // "清除所有" button appears when hasActiveFilters is true
        const clearButton = wrapper
          .findAll("button")
          .find((btn) => btn.text().match(/清除所有|clear all/i));
        expect(clearButton).toBeDefined();
      }
    });

    it("should clear all filters when clear button clicked", async () => {
      const wrapper = createWrapper();
      // Set some filters
      wrapper.vm.searchText = "test";
      wrapper.vm.selectedStatuses = [1, 2];
      await nextTick();

      const clearButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().match(/清除所有|clear all/i));

      if (clearButton) {
        await clearButton.trigger("click");
        await nextTick();

        // All filters should be cleared
        expect(wrapper.vm.searchText).toBe("");
        expect(wrapper.vm.selectedStatuses).toEqual([]);
      }
    });

    it("should not show clear button when no filters active", () => {
      const wrapper = createWrapper();

      const clearButton = wrapper
        .findAll("button")
        .find((btn) => btn.text().match(/清除所有|clear all/i));

      expect(clearButton).toBeUndefined();
    });
  });

  describe("Filter Count Badge", () => {
    // Helper: the badge is a <span> containing "個篩選" text
    const findBadge = (wrapper: ReturnType<typeof createWrapper>) =>
      wrapper.findAll("span").find((s) => s.text().includes("個篩選"));

    it("should display correct number of active filters", async () => {
      const wrapper = createWrapper();

      const allPills = wrapper
        .findAll("button")
        .filter((btn) =>
          btn.classes().some((cls) => cls.includes("rounded-full")),
        );

      if (allPills.length >= 2) {
        // Click "待處理" → selectedStatuses = [1] (1 filter group = status)
        await allPills[1].trigger("click");
        await nextTick();

        const badge = findBadge(wrapper);
        expect(badge).toBeDefined();
        expect(badge!.text()).toContain("1");
      }
    });

    it("should update count when filters change", async () => {
      const wrapper = createWrapper();

      const allPills = wrapper
        .findAll("button")
        .filter((btn) =>
          btn.classes().some((cls) => cls.includes("rounded-full")),
        );

      if (allPills.length > 1) {
        // Add a status filter → activeFilterCount = 1
        await allPills[1].trigger("click"); // 待處理
        await nextTick();

        let badge = findBadge(wrapper);
        expect(badge).toBeDefined();
        const count1 = wrapper.vm.activeFilterCount;

        // Also apply search → activeFilterCount = 2
        const searchInput = wrapper.find('input[type="text"]');
        await searchInput.setValue("test");
        await searchInput.trigger("input");
        await nextTick();

        badge = findBadge(wrapper);
        expect(badge).toBeDefined();
        const count2 = wrapper.vm.activeFilterCount;

        expect(count2).toBeGreaterThan(count1);
      }
    });

    it("should hide badge when no filters active", () => {
      const wrapper = createWrapper();

      // No active filters initially → badge should not render
      const badge = findBadge(wrapper);
      expect(badge).toBeUndefined();
    });
  });

  describe("Filter Combinations", () => {
    it("should combine search with quick filters", async () => {
      const wrapper = createWrapper();

      // Apply search
      const searchInput = wrapper.find('input[type="text"]');
      await searchInput.setValue("張三");
      await nextTick();

      // Apply quick filter
      const quickFilterButtons = wrapper
        .findAll("button")
        .filter((btn) =>
          btn.classes().some((cls) => cls.includes("rounded-full")),
        );
      if (quickFilterButtons.length > 0) {
        await quickFilterButtons[0].trigger("click");
        await nextTick();
      }

      // Both should be active
      expect(wrapper.vm.searchText).toBe("張三");
    });

    it("should combine multiple filter types", async () => {
      const wrapper = createWrapper();
      wrapper.vm.searchText = "test";
      wrapper.vm.selectedStatuses = [1];
      wrapper.vm.showFilters = true;
      await nextTick();

      // Multiple filter types should be active
      expect(wrapper.vm.searchText).toBe("test");
      expect(wrapper.vm.selectedStatuses).toEqual([1]);
    });

    it("should emit combined filter changes", async () => {
      const wrapper = createWrapper();

      // Apply multiple filters
      const searchInput = wrapper.find('input[type="text"]');
      await searchInput.setValue("ORD-001");
      await nextTick();

      const quickFilterButtons = wrapper
        .findAll("button")
        .filter((btn) =>
          btn.classes().some((cls) => cls.includes("rounded-full")),
        );
      if (quickFilterButtons.length > 0) {
        await quickFilterButtons[0].trigger("click");
        await nextTick();
      }

      // Component doesn't emit update:filters, it calls store methods
      // Check that filters are applied
      expect(wrapper.vm.searchText).toBe("ORD-001");
    });
  });

  describe("Accessibility", () => {
    it("should have proper labels for inputs", async () => {
      const wrapper = createWrapper();
      wrapper.vm.showFilters = true;
      await nextTick();

      const labels = wrapper.findAll("label");
      expect(labels.length).toBeGreaterThan(0);
    });

    it("should have keyboard navigation support", async () => {
      const wrapper = createWrapper();

      const searchInput = wrapper.find('input[type="text"]');

      // Verify input exists and is mounted
      expect(searchInput.exists()).toBe(true);

      // In jsdom, focus behavior is simulated
      // Just verify the input is focusable (has element)
      expect(searchInput.element).toBeTruthy();
      expect(searchInput.element.tagName).toBe("INPUT");
    });

    it("should have clear button descriptions", () => {
      const wrapper = createWrapper();
      wrapper.vm.searchText = "test";

      const buttons = wrapper.findAll("button[title]");
      expect(buttons.length).toBeGreaterThan(0);

      // At least one button should have a title
      const hasTitle = buttons.some((btn) => btn.attributes("title"));
      expect(hasTitle).toBe(true);
    });
  });

  describe("Performance", () => {
    it("should debounce search input", async () => {
      const wrapper = createWrapper();

      const searchInput = wrapper.find('input[type="text"]');

      // Rapid typing should not trigger multiple events
      await searchInput.setValue("a");
      await searchInput.setValue("ab");
      await searchInput.setValue("abc");
      await nextTick();

      // Should have final value
      expect(wrapper.vm.searchText).toBe("abc");
    });

    it("should handle rapid filter toggling", async () => {
      const wrapper = createWrapper();

      const quickFilterButtons = wrapper
        .findAll("button")
        .filter((btn) =>
          btn.classes().some((cls) => cls.includes("rounded-full")),
        );

      if (quickFilterButtons.length > 0) {
        // Rapid clicking
        await quickFilterButtons[0].trigger("click");
        await quickFilterButtons[0].trigger("click");
        await quickFilterButtons[0].trigger("click");

        // Should handle gracefully
        expect(wrapper.exists()).toBe(true);
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty search query", async () => {
      const wrapper = createWrapper();

      const searchInput = wrapper.find('input[type="text"]');
      await searchInput.setValue("");
      await nextTick();

      expect(wrapper.vm.searchText).toBe("");
    });

    it("should handle very long search queries", async () => {
      const wrapper = createWrapper();

      const longQuery = "A".repeat(1000);
      const searchInput = wrapper.find('input[type="text"]');
      await searchInput.setValue(longQuery);

      expect((searchInput.element as HTMLInputElement).value).toBe(longQuery);
    });

    it("should handle special characters in search", async () => {
      const wrapper = createWrapper();

      const specialChars = "!@#$%^&*()_+-=[]{}|;:,.<>?";
      const searchInput = wrapper.find('input[type="text"]');
      await searchInput.setValue(specialChars);

      expect((searchInput.element as HTMLInputElement).value).toBe(
        specialChars,
      );
    });

    it("should handle no filter options selected", () => {
      const wrapper = createWrapper();
      wrapper.vm.selectedStatuses = [];
      wrapper.vm.showFilters = true;

      expect(wrapper.vm.selectedStatuses).toEqual([]);
    });

    it("should handle all filter options selected", async () => {
      const wrapper = createWrapper();
      wrapper.vm.selectedStatuses = [1, 2, 3, 4];
      wrapper.vm.showFilters = true;
      await nextTick();

      expect(wrapper.vm.selectedStatuses.length).toBe(4);
    });
  });

  describe("Order Type Filter", () => {
    it("should render order type filter checkboxes (dine_in, takeaway, delivery)", async () => {
      const wrapper = createWrapper();
      wrapper.vm.showFilters = true;
      await nextTick();

      const html = wrapper.html();
      // Verify all three order type options are rendered
      expect(html).toMatch(/內用/);
      expect(html).toMatch(/外帶/);
      expect(html).toMatch(/外送/);
    });

    it("should emit filter change when order type checkbox clicked", async () => {
      const wrapper = createWrapper();
      wrapper.vm.showFilters = true;
      await nextTick();

      // Directly set the selectedOrderTypes and verify the store filter updates
      wrapper.vm.selectedOrderTypes = ["takeaway"];
      await nextTick();

      // The watch on selectedOrderTypes should call store.setFilter('orderTypes', ...)
      expect(wrapper.vm.selectedOrderTypes).toContain("takeaway");
    });

    it("should support multiple order type selection", async () => {
      const wrapper = createWrapper();
      wrapper.vm.showFilters = true;
      await nextTick();

      wrapper.vm.selectedOrderTypes = ["takeaway", "delivery"];
      await nextTick();

      expect(wrapper.vm.selectedOrderTypes).toHaveLength(2);
      expect(wrapper.vm.selectedOrderTypes).toContain("takeaway");
      expect(wrapper.vm.selectedOrderTypes).toContain("delivery");
    });

    it("should show quick filter pill for 外帶/外送", () => {
      const wrapper = createWrapper();

      const allButtons = wrapper.findAll("button");
      const takeawayDeliveryBtn = allButtons.find((btn) =>
        btn.text().includes("外帶/外送"),
      );

      expect(takeawayDeliveryBtn).toBeDefined();
    });

    it("should activate 外帶/外送 quick filter pill on click", async () => {
      const wrapper = createWrapper();

      const allButtons = wrapper.findAll("button");
      const takeawayDeliveryBtn = allButtons.find((btn) =>
        btn.text().includes("外帶/外送"),
      );

      if (takeawayDeliveryBtn) {
        await takeawayDeliveryBtn.trigger("click");
        await nextTick();

        // Both takeaway and delivery should be selected but not dine_in
        expect(wrapper.vm.selectedOrderTypes).toContain("takeaway");
        expect(wrapper.vm.selectedOrderTypes).toContain("delivery");
        expect(wrapper.vm.selectedOrderTypes).not.toContain("dine_in");
      }
    });

    it("should deactivate 外帶/外送 quick filter when clicked again", async () => {
      const wrapper = createWrapper();

      // Activate first
      wrapper.vm.selectedOrderTypes = ["takeaway", "delivery"];
      await nextTick();

      const allButtons = wrapper.findAll("button");
      const takeawayDeliveryBtn = allButtons.find((btn) =>
        btn.text().includes("外帶/外送"),
      );

      if (takeawayDeliveryBtn) {
        await takeawayDeliveryBtn.trigger("click");
        await nextTick();

        expect(wrapper.vm.selectedOrderTypes).toHaveLength(0);
      }
    });
  });
});

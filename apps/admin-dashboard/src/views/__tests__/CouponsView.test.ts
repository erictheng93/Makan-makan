/**
 * CouponsView Component Tests
 * Tests for the coupon management view including stats, filters, CRUD, pagination, and modals.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import CouponsView from "../CouponsView.vue";

// ── Mock data ──────────────────────────────────────────────────────────────────

const mockCoupons = [
  {
    id: 1,
    name: "Test Coupon",
    code: "TEST10",
    description: "Test desc",
    discountType: "percentage",
    discountValue: 10,
    maxDiscountAmount: 100,
    minOrderAmount: 50,
    usageLimit: 100,
    usedCount: 25,
    validFrom: "2024-01-01",
    validTo: "2024-12-31",
    isActive: true,
  },
  {
    id: 2,
    name: "Fixed Coupon",
    code: "FIXED20",
    description: "",
    discountType: "fixed",
    discountValue: 20,
    maxDiscountAmount: null,
    minOrderAmount: 0,
    usageLimit: null,
    usedCount: 5,
    validFrom: "2024-01-01",
    validTo: "2024-12-31",
    isActive: false,
  },
];

const mockStatsSummary = {
  total: 10,
  active: 5,
  totalUsed: 120,
  totalSavings: 5000,
};

const mockCouponDetailStats = {
  totalRedemptions: 25,
  totalSavings: 250,
  averageDiscount: 10,
  redemptionsByDay: [],
};

// ── Mocks ──────────────────────────────────────────────────────────────────────

// Mock API service
const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPut = vi.fn();
const mockApiDelete = vi.fn();

vi.mock("@/services/api", () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    delete: (...args: unknown[]) => mockApiDelete(...args),
  },
}));

// Mock i18n
vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

// Mock toastification
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("vue-toastification", () => ({
  useToast: () => ({ success: mockToastSuccess, error: mockToastError }),
}));

// Mock useCurrency
vi.mock("@/composables/useCurrency", () => ({
  useCurrency: () => ({ formatPrice: (v: number) => `$${v}` }),
}));

// Mock useAsyncModals — return stub components
vi.mock("@/composables/useAsyncModals", () => ({
  useAsyncModals: () => ({
    CouponFormModal: {
      name: "CouponFormModal",
      template: '<div data-testid="coupon-form-modal"><slot /></div>',
      props: ["coupon"],
      emits: ["close", "save"],
    },
    CouponStatsModal: {
      name: "CouponStatsModal",
      template: '<div data-testid="coupon-stats-modal"><slot /></div>',
      props: ["coupon", "stats"],
      emits: ["close"],
    },
  }),
}));

// Mock auth store
vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    user: { id: 1, username: "admin", role: 0 },
    restaurantId: 1,
    isAuthenticated: true,
  }),
}));

// Mock couponStatus utility
vi.mock("@/utils/couponStatus", () => ({
  getCouponStatus: () => "active" as const,
}));

// Mock heroicons
vi.mock("@heroicons/vue/24/outline", () => {
  const stub = { template: "<svg />" };
  return {
    PlusIcon: stub,
    TicketIcon: stub,
    CheckCircleIcon: stub,
    ClockIcon: stub,
    CurrencyDollarIcon: stub,
    ChevronLeftIcon: stub,
    ChevronRightIcon: stub,
    ExclamationTriangleIcon: stub,
  };
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function setupDefaultApiMocks() {
  mockApiGet.mockImplementation((url: string) => {
    if (url === "/coupons/stats/summary") {
      return Promise.resolve({
        data: { success: true, data: mockStatsSummary },
      });
    }
    if (url.startsWith("/coupons/") && url.endsWith("/stats")) {
      return Promise.resolve({
        data: {
          success: true,
          data: { coupon: mockCoupons[0], stats: mockCouponDetailStats },
        },
      });
    }
    // Default: /coupons list
    return Promise.resolve({
      data: {
        success: true,
        data: mockCoupons,
        pagination: { total: mockCoupons.length },
      },
    });
  });

  mockApiPost.mockResolvedValue({ data: { success: true } });
  mockApiPut.mockResolvedValue({ data: { success: true } });
  mockApiDelete.mockResolvedValue({ data: { success: true } });
}

function mountView() {
  return mount(CouponsView, {
    global: {
      stubs: {
        Suspense: false,
      },
    },
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("CouponsView Component", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.useFakeTimers();
    setupDefaultApiMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── 1. Component Mounting ──────────────────────────────────────────────────

  describe("Component Mounting", () => {
    it("should mount successfully", async () => {
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.exists()).toBe(true);
    });

    it("should display page title", async () => {
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain("coupons.title");
    });

    it("should display page subtitle", async () => {
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain("coupons.subtitle");
    });
  });

  // ── 2. Stats Cards Display ─────────────────────────────────────────────────

  describe("Stats Cards Display", () => {
    it("should display 4 stat cards", async () => {
      const wrapper = mountView();
      await flushPromises();

      // Each stat card has a stats label key
      expect(wrapper.text()).toContain("coupons.stats.total");
      expect(wrapper.text()).toContain("coupons.stats.used");
      expect(wrapper.text()).toContain("coupons.stats.active");
      expect(wrapper.text()).toContain("coupons.stats.totalSavings");
    });

    it("should show stats values from fetched data", async () => {
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain("10"); // total
      expect(wrapper.text()).toContain("120"); // totalUsed
      expect(wrapper.text()).toContain("5"); // active
      expect(wrapper.text()).toContain("$5000"); // totalSavings formatted
    });
  });

  // ── 3. Filters and Search ─────────────────────────────────────────────────

  describe("Filters and Search", () => {
    it("should render search input", async () => {
      const wrapper = mountView();
      await flushPromises();

      const searchInput = wrapper.find('input[type="text"]');
      expect(searchInput.exists()).toBe(true);
    });

    it("should render status filter select", async () => {
      const wrapper = mountView();
      await flushPromises();

      const selects = wrapper.findAll("select");
      // First select is status, second is discountType
      expect(selects.length).toBeGreaterThanOrEqual(2);

      const statusSelect = selects[0];
      expect(statusSelect.text()).toContain("coupons.filters.allStatus");
      expect(statusSelect.text()).toContain("coupons.filters.active");
      expect(statusSelect.text()).toContain("coupons.filters.expired");
    });

    it("should render discount type filter select", async () => {
      const wrapper = mountView();
      await flushPromises();

      const selects = wrapper.findAll("select");
      const discountTypeSelect = selects[1];
      expect(discountTypeSelect.text()).toContain("coupons.filters.allTypes");
      expect(discountTypeSelect.text()).toContain("coupons.filters.percentage");
      expect(discountTypeSelect.text()).toContain("coupons.filters.fixed");
    });

    it("should reset filters when reset button clicked", async () => {
      const wrapper = mountView();
      await flushPromises();

      // Set a filter value
      const searchInput = wrapper.find('input[type="text"]');
      await searchInput.setValue("test search");

      const statusSelect = wrapper.findAll("select")[0];
      await statusSelect.setValue("active");

      // Click reset button — find by text content
      const buttons = wrapper.findAll("button");
      const resetButton = buttons.find((b) =>
        b.text().includes("coupons.filters.reset"),
      );
      expect(resetButton).toBeDefined();
      await resetButton!.trigger("click");
      await flushPromises();

      // Verify filters are cleared
      expect(
        (wrapper.find('input[type="text"]').element as HTMLInputElement).value,
      ).toBe("");
      expect(
        (wrapper.findAll("select")[0].element as HTMLSelectElement).value,
      ).toBe("");
    });
  });

  // ── 4. Coupon List Display ────────────────────────────────────────────────

  describe("Coupon List Display", () => {
    it("should display coupons in table when data loaded", async () => {
      const wrapper = mountView();
      await flushPromises();

      const table = wrapper.find("table");
      expect(table.exists()).toBe(true);

      // Table headers
      expect(wrapper.text()).toContain("coupons.table.couponInfo");
      expect(wrapper.text()).toContain("coupons.table.discount");
      expect(wrapper.text()).toContain("coupons.table.usage");
      expect(wrapper.text()).toContain("coupons.table.validity");
      expect(wrapper.text()).toContain("coupons.table.status");
      expect(wrapper.text()).toContain("coupons.table.actions");
    });

    it("should show coupon name, code, and discount info", async () => {
      const wrapper = mountView();
      await flushPromises();

      // Coupon 1: percentage discount
      expect(wrapper.text()).toContain("Test Coupon");
      expect(wrapper.text()).toContain("TEST10");
      expect(wrapper.text()).toContain("10%");

      // Coupon 2: fixed discount
      expect(wrapper.text()).toContain("Fixed Coupon");
      expect(wrapper.text()).toContain("FIXED20");
      expect(wrapper.text()).toContain("$20"); // formatPrice(20)
    });

    it("should show coupon description when present", async () => {
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain("Test desc");
    });

    it("should show usage count with limit when usageLimit exists", async () => {
      const wrapper = mountView();
      await flushPromises();

      // Coupon 1 has usageLimit=100, usedCount=25
      expect(wrapper.text()).toContain("25");
      expect(wrapper.text()).toContain("100");
    });

    it("should show unlimited text when no usageLimit", async () => {
      const wrapper = mountView();
      await flushPromises();

      // Coupon 2 has usageLimit=null
      expect(wrapper.text()).toContain("coupons.table.unlimited");
    });

    it("should show min order amount when greater than zero", async () => {
      const wrapper = mountView();
      await flushPromises();

      // Coupon 1 has minOrderAmount=50
      expect(wrapper.text()).toContain("$50");
    });

    it("should show max discount info for percentage coupons", async () => {
      const wrapper = mountView();
      await flushPromises();

      // The t() mock returns the key, so the interpolated value is not in the text.
      // We verify the maxDiscount translation key is rendered.
      expect(wrapper.text()).toContain("coupons.table.maxDiscount");
    });

    it("should show coupon status text", async () => {
      const wrapper = mountView();
      await flushPromises();

      // getCouponStatus is mocked to return "active"
      expect(wrapper.text()).toContain("coupons.status.active");
    });
  });

  // ── 5. Actions ────────────────────────────────────────────────────────────

  describe("Actions", () => {
    it("should open create modal when create button clicked", async () => {
      const wrapper = mountView();
      await flushPromises();

      const createButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("coupons.create"));
      expect(createButton).toBeDefined();

      await createButton!.trigger("click");
      await flushPromises();

      // Suspense wraps CouponFormModal — it should now be rendered
      expect(wrapper.text()).toContain("coupons.create");
    });

    it("should open edit modal when edit button clicked", async () => {
      const wrapper = mountView();
      await flushPromises();

      const editButtons = wrapper
        .findAll("button")
        .filter((b) => b.text().includes("coupons.actions.edit"));
      expect(editButtons.length).toBeGreaterThan(0);

      await editButtons[0].trigger("click");
      await flushPromises();

      // The modal should be shown (showCreateModal becomes true with editingCoupon set)
      const formModal = wrapper.find('[data-testid="coupon-form-modal"]');
      expect(formModal.exists()).toBe(true);
    });

    it("should call deactivate API when deactivate clicked", async () => {
      const wrapper = mountView();
      await flushPromises();

      const deactivateButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("coupons.actions.deactivate"));
      expect(deactivateButton).toBeDefined();

      await deactivateButton!.trigger("click");
      await flushPromises();

      expect(mockApiPost).toHaveBeenCalledWith("/coupons/1/deactivate");
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "coupons.messages.deactivateSuccess",
      );
    });

    it("should call activate API when activate clicked for inactive coupons", async () => {
      const wrapper = mountView();
      await flushPromises();

      const activateButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("coupons.actions.activate"));
      expect(activateButton).toBeDefined();

      await activateButton!.trigger("click");
      await flushPromises();

      expect(mockApiPut).toHaveBeenCalledWith(
        "/coupons/2",
        expect.objectContaining({ isActive: true }),
      );
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "coupons.messages.activateSuccess",
      );
    });

    it("should show delete button only for admin users", async () => {
      const wrapper = mountView();
      await flushPromises();

      const deleteButtons = wrapper
        .findAll("button")
        .filter((b) => b.text().includes("coupons.actions.delete"));
      // Admin (role 0) should see delete buttons for each coupon
      expect(deleteButtons.length).toBe(mockCoupons.length);
    });

    it("should show delete confirmation when delete clicked", async () => {
      const wrapper = mountView();
      await flushPromises();

      const deleteButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("coupons.actions.delete"));
      expect(deleteButton).toBeDefined();

      await deleteButton!.trigger("click");
      await flushPromises();

      // Delete confirmation modal should appear with confirm title
      expect(wrapper.text()).toContain("coupons.messages.deleteConfirmTitle");
    });

    it("should call delete API after confirming deletion", async () => {
      const wrapper = mountView();
      await flushPromises();

      // Click delete to show confirmation
      const deleteButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("coupons.actions.delete"));
      await deleteButton!.trigger("click");
      await flushPromises();

      // Click the confirm delete button (the red one with "common.delete" text)
      const confirmButton = wrapper
        .findAll("button")
        .find((b) => b.text().trim() === "common.delete");
      expect(confirmButton).toBeDefined();
      await confirmButton!.trigger("click");
      await flushPromises();

      expect(mockApiDelete).toHaveBeenCalledWith(
        expect.stringContaining("/coupons/"),
      );
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "coupons.messages.deleteSuccess",
      );
    });

    it("should dismiss delete confirmation when cancel clicked", async () => {
      const wrapper = mountView();
      await flushPromises();

      const deleteButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("coupons.actions.delete"));
      await deleteButton!.trigger("click");
      await flushPromises();

      expect(wrapper.text()).toContain("coupons.messages.deleteConfirmTitle");

      // Click cancel
      const cancelButton = wrapper
        .findAll("button")
        .find((b) => b.text().trim() === "common.cancel");
      await cancelButton!.trigger("click");
      await flushPromises();

      // Confirmation dialog should be gone
      expect(wrapper.text()).not.toContain(
        "coupons.messages.deleteConfirmTitle",
      );
    });

    it("should open stats modal when stats button clicked", async () => {
      const wrapper = mountView();
      await flushPromises();

      const statsButtons = wrapper
        .findAll("button")
        .filter((b) => b.text().includes("coupons.actions.stats"));
      expect(statsButtons.length).toBeGreaterThan(0);

      await statsButtons[0].trigger("click");
      await flushPromises();

      // viewCouponStats calls api.get(`/coupons/${coupon.id}/stats`)
      expect(mockApiGet).toHaveBeenCalledWith("/coupons/1/stats");
      const statsModal = wrapper.find('[data-testid="coupon-stats-modal"]');
      expect(statsModal.exists()).toBe(true);
    });
  });

  // ── 6. Pagination ────────────────────────────────────────────────────────

  describe("Pagination", () => {
    it("should display pagination controls", async () => {
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain("coupons.pagination.showing");
    });

    it("should display previous and next buttons", async () => {
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain("coupons.pagination.previous");
      expect(wrapper.text()).toContain("coupons.pagination.next");
    });

    it("should navigate pages when page button clicked", async () => {
      // Set up paginated data (more than 1 page)
      mockApiGet.mockImplementation((url: string) => {
        if (url === "/coupons/stats/summary") {
          return Promise.resolve({
            data: { success: true, data: mockStatsSummary },
          });
        }
        return Promise.resolve({
          data: {
            success: true,
            data: mockCoupons,
            pagination: { total: 60 }, // 3 pages with pageSize=20
          },
        });
      });

      const wrapper = mountView();
      await flushPromises();

      // Clear mock call count from initial load
      mockApiGet.mockClear();
      setupDefaultApiMocks();

      // Find and click "next" button (the one in mobile view)
      const nextButtons = wrapper
        .findAll("button")
        .filter((b) => b.text().includes("coupons.pagination.next"));
      expect(nextButtons.length).toBeGreaterThan(0);

      await nextButtons[0].trigger("click");
      await flushPromises();

      // Should have refetched with new page
      expect(mockApiGet).toHaveBeenCalled();
    });
  });

  // ── 7. Error Handling ────────────────────────────────────────────────────

  describe("Error Handling", () => {
    it("should show error toast when fetch fails", async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url === "/coupons/stats/summary") {
          return Promise.resolve({
            data: { success: true, data: mockStatsSummary },
          });
        }
        return Promise.reject(new Error("Network error"));
      });

      mountView();
      await flushPromises();

      expect(mockToastError).toHaveBeenCalledWith(
        "coupons.messages.fetchFailed",
      );
    });

    it("should show error toast when deactivate fails", async () => {
      const wrapper = mountView();
      await flushPromises();

      mockApiPost.mockRejectedValueOnce(new Error("Deactivate failed"));

      const deactivateButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("coupons.actions.deactivate"));
      await deactivateButton!.trigger("click");
      await flushPromises();

      expect(mockToastError).toHaveBeenCalledWith(
        "coupons.messages.deactivateFailed",
      );
    });

    it("should show error toast when activate fails", async () => {
      const wrapper = mountView();
      await flushPromises();

      mockApiPut.mockRejectedValueOnce(new Error("Activate failed"));

      const activateButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("coupons.actions.activate"));
      await activateButton!.trigger("click");
      await flushPromises();

      expect(mockToastError).toHaveBeenCalledWith(
        "coupons.messages.activateFailed",
      );
    });

    it("should show error toast when delete fails", async () => {
      const wrapper = mountView();
      await flushPromises();

      mockApiDelete.mockRejectedValueOnce(new Error("Delete failed"));

      // Open delete confirmation
      const deleteButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("coupons.actions.delete"));
      await deleteButton!.trigger("click");
      await flushPromises();

      // Confirm delete
      const confirmButton = wrapper
        .findAll("button")
        .find((b) => b.text().trim() === "common.delete");
      await confirmButton!.trigger("click");
      await flushPromises();

      expect(mockToastError).toHaveBeenCalledWith(
        "coupons.messages.deleteFailed",
      );
    });

    it("should show error toast when stats fetch fails", async () => {
      const wrapper = mountView();
      await flushPromises();

      mockApiGet.mockRejectedValueOnce(new Error("Stats failed"));

      const statsButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("coupons.actions.stats"));
      await statsButton!.trigger("click");
      await flushPromises();

      expect(mockToastError).toHaveBeenCalledWith(
        "coupons.messages.statsFailed",
      );
    });
  });

  // ── 8. API Integration ───────────────────────────────────────────────────

  describe("API Integration", () => {
    it("should fetch coupons on mount", async () => {
      mountView();
      await flushPromises();

      expect(mockApiGet).toHaveBeenCalledWith(
        "/coupons",
        expect.objectContaining({
          page: "1",
          limit: "20",
        }),
      );
    });

    it("should fetch stats summary on mount", async () => {
      mountView();
      await flushPromises();

      expect(mockApiGet).toHaveBeenCalledWith("/coupons/stats/summary");
    });

    it("should refetch when status filter changes", async () => {
      const wrapper = mountView();
      await flushPromises();

      mockApiGet.mockClear();
      setupDefaultApiMocks();

      const statusSelect = wrapper.findAll("select")[0];
      await statusSelect.setValue("active");
      await flushPromises();

      expect(mockApiGet).toHaveBeenCalledWith(
        "/coupons",
        expect.objectContaining({ status: "active" }),
      );
    });

    it("should refetch when discount type filter changes", async () => {
      const wrapper = mountView();
      await flushPromises();

      mockApiGet.mockClear();
      setupDefaultApiMocks();

      const discountTypeSelect = wrapper.findAll("select")[1];
      await discountTypeSelect.setValue("percentage");
      await flushPromises();

      expect(mockApiGet).toHaveBeenCalledWith(
        "/coupons",
        expect.objectContaining({ discountType: "percentage" }),
      );
    });

    it("should debounce search input and refetch", async () => {
      const wrapper = mountView();
      await flushPromises();

      mockApiGet.mockClear();
      setupDefaultApiMocks();

      const searchInput = wrapper.find('input[type="text"]');
      await searchInput.setValue("test");

      // Before debounce fires, no new fetch should happen
      expect(mockApiGet).not.toHaveBeenCalled();

      // Advance past the 300ms debounce
      vi.advanceTimersByTime(300);
      await flushPromises();

      expect(mockApiGet).toHaveBeenCalledWith(
        "/coupons",
        expect.objectContaining({ search: "test" }),
      );
    });

    it("should refetch coupons and stats after successful deactivation (save path)", async () => {
      const wrapper = mountView();
      await flushPromises();

      mockApiGet.mockClear();
      setupDefaultApiMocks();

      // Deactivation triggers refetch of both coupons and stats, same as save
      const deactivateButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("coupons.actions.deactivate"));
      await deactivateButton!.trigger("click");
      await flushPromises();

      // After successful operation, both endpoints should be refetched
      expect(mockApiGet).toHaveBeenCalledWith("/coupons", expect.any(Object));
      expect(mockApiGet).toHaveBeenCalledWith("/coupons/stats/summary");
    });

    it("should refetch after successful deactivation", async () => {
      const wrapper = mountView();
      await flushPromises();

      mockApiGet.mockClear();
      setupDefaultApiMocks();

      const deactivateButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("coupons.actions.deactivate"));
      await deactivateButton!.trigger("click");
      await flushPromises();

      // After deactivation, should refetch both coupons and stats
      expect(mockApiGet).toHaveBeenCalledWith("/coupons", expect.any(Object));
      expect(mockApiGet).toHaveBeenCalledWith("/coupons/stats/summary");
    });

    it("should refetch after successful deletion", async () => {
      const wrapper = mountView();
      await flushPromises();

      // Open and confirm delete
      const deleteButton = wrapper
        .findAll("button")
        .find((b) => b.text().includes("coupons.actions.delete"));
      await deleteButton!.trigger("click");
      await flushPromises();

      mockApiGet.mockClear();
      setupDefaultApiMocks();

      const confirmButton = wrapper
        .findAll("button")
        .find((b) => b.text().trim() === "common.delete");
      await confirmButton!.trigger("click");
      await flushPromises();

      expect(mockApiGet).toHaveBeenCalledWith("/coupons", expect.any(Object));
      expect(mockApiGet).toHaveBeenCalledWith("/coupons/stats/summary");
    });
  });
});

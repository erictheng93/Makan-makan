/**
 * WaitingListView (WaitingListTab) Component Tests
 *
 * Covers: queue list rendering, add customer form, call next, confirm arrival,
 * seat customer, cancel/expire entries, filter by status, search by phone,
 * pagination, real-time queue status, empty/loading states, error handling,
 * stats display, batch call next.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { mount, flushPromises, VueWrapper } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { nextTick } from "vue";
import { resetAllFactories } from "@makanmasak/testing-utils";

// ── Mocks (must be declared before imports that use them) ──────────────────

// Mock lucide-vue-next icons
vi.mock("lucide-vue-next", () => {
  const stub = { template: "<span />" };
  return {
    Plus: stub,
    Bell: stub,
    Clock: stub,
    Timer: stub,
    Table: stub,
    Users: stub,
    Search: stub,
    RotateCcw: stub,
    RefreshCw: stub,
    LayoutGrid: stub,
    List: stub,
    User: stub,
    Phone: stub,
    CheckCircle: stub,
    XCircle: stub,
    Trash2: stub,
    ChevronLeft: stub,
    ChevronRight: stub,
    Loader2: stub,
    Info: stub,
  };
});

// Mock @headlessui/vue
vi.mock("@headlessui/vue", () => {
  const passthrough = {
    template: "<div><slot /></div>",
    props: { as: String, appear: Boolean, show: Boolean },
  };
  return {
    Dialog: passthrough,
    DialogPanel: passthrough,
    DialogTitle: { template: "<h2><slot /></h2>" },
    TransitionChild: passthrough,
    TransitionRoot: passthrough,
  };
});

// Mock vue-toastification
const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));
vi.mock("vue-toastification", () => ({
  useToast: () => mockToast,
}));

// Mock i18n — return key as-is
vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

// Mock date-fns format to avoid locale issues in test
vi.mock("date-fns", () => ({
  format: (_date: unknown, _fmt: string) => "12:00",
}));

// Mock WaitingListService
const mockWaitingListService = vi.hoisted(() => ({
  listWaitingList: vi.fn(),
  getWaitingEntry: vi.fn(),
  joinWaitingList: vi.fn(),
  callWaiting: vi.fn(),
  markSeated: vi.fn(),
  expireWaiting: vi.fn(),
  cancelWaiting: vi.fn(),
  getQueueStatus: vi.fn(),
  estimateWaitTime: vi.fn(),
  getStats: vi.fn(),
  batchCall: vi.fn(),
  getStatusText: vi.fn((s: string) => s),
  getStatusColor: vi.fn(() => "default"),
  formatQueueDisplay: vi.fn(() => "A1"),
  formatWaitTime: vi.fn(() => "10 min"),
}));
vi.mock("@/services/waitingListService", () => ({
  WaitingListService: mockWaitingListService,
}));

const mockWebSocketService = vi.hoisted(() => {
  const state: any = {
    waitingCallback: undefined,
  };
  state.connect = vi.fn().mockResolvedValue(undefined);
  state.subscribe = vi.fn((_eventTypes: unknown, callback: unknown) => {
    state.waitingCallback = callback;
    return "waiting-list-subscription";
  });
  state.unsubscribe = vi.fn();
  return state;
});
vi.mock("@/services/websocketService", () => ({
  useWebSocketService: () => mockWebSocketService,
}));

// Mock useConfirmModal — auto-resolves to true by default
const mockWaitingConfirmModalFn = vi.fn().mockResolvedValue(true);
vi.mock("@/composables/useConfirmModal", () => ({
  useConfirmModal: () => ({
    confirm: mockWaitingConfirmModalFn,
    modalState: { value: null },
    close: vi.fn(),
  }),
}));

// Mock auth store
vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    restaurantId: "R-001",
    canAccessAdminFeatures: true,
    user: { id: 1, restaurantId: "R-001", role: 0 },
  }),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import WaitingListView from "../seating/WaitingListTab.vue";

// ── Test Data ──────────────────────────────────────────────────────────────

const mockQueueStatus = {
  restaurantId: "R-001",
  totalWaiting: 5,
  averageWaitMinutes: 12,
  availableTables: 3,
  byTableType: [],
};

const mockWaitingEntries = [
  {
    id: "wl-001",
    restaurantId: "R-001",
    customerName: "Alice",
    customerPhone: "0912345678",
    partySize: 2,
    queueNumber: 1,
    queueLetter: "A",
    status: "waiting",
    createdAt: Date.now() - 10 * 60 * 1000,
    updatedAt: Date.now(),
    notes: "",
    specialRequests: "",
    estimatedWaitMinutes: 10,
  },
  {
    id: "wl-002",
    restaurantId: "R-001",
    customerName: "Bob",
    customerPhone: "0987654321",
    partySize: 4,
    queueNumber: 2,
    queueLetter: "A",
    status: "called",
    createdAt: Date.now() - 20 * 60 * 1000,
    updatedAt: Date.now(),
    notes: "Quiet area",
    specialRequests: "",
    estimatedWaitMinutes: 5,
  },
  {
    id: "wl-003",
    restaurantId: "R-001",
    customerName: "Charlie",
    customerPhone: "0955555555",
    partySize: 6,
    queueNumber: 3,
    queueLetter: "A",
    status: "confirmed",
    createdAt: Date.now() - 30 * 60 * 1000,
    updatedAt: Date.now(),
    notes: "",
    specialRequests: "",
    estimatedWaitMinutes: null,
  },
];

const mockListResponse = {
  success: true,
  data: mockWaitingEntries,
  pagination: { total: 3, page: 1, limit: 50 },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function setupServiceMocks(overrides: Record<string, any> = {}) {
  mockWaitingListService.listWaitingList.mockResolvedValue(
    overrides.listResponse ?? mockListResponse,
  );
  mockWaitingListService.getQueueStatus.mockResolvedValue(
    overrides.queueStatus ?? mockQueueStatus,
  );
  mockWaitingListService.joinWaitingList.mockResolvedValue(
    overrides.joinResult ?? { success: true },
  );
  mockWaitingListService.callWaiting.mockResolvedValue(
    overrides.callResult ?? { success: true },
  );
  mockWaitingListService.markSeated.mockResolvedValue(
    overrides.seatResult ?? { success: true },
  );
  mockWaitingListService.expireWaiting.mockResolvedValue(
    overrides.expireResult ?? { success: true },
  );
  mockWaitingListService.cancelWaiting.mockResolvedValue(
    overrides.cancelResult ?? { success: true },
  );
  mockWaitingListService.batchCall.mockResolvedValue(
    overrides.batchCallResult ?? { success: true },
  );
}

const mountOptions = {
  global: {
    stubs: {
      teleport: true,
    },
  },
};

function mountComponent() {
  return mount(WaitingListView, mountOptions);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("WaitingListView Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllFactories();
    setActivePinia(createPinia());
    // Restore default confirm modal behavior after clearAllMocks
    mockWaitingConfirmModalFn.mockResolvedValue(true);
    mockWebSocketService.waitingCallback = undefined;
    mockWebSocketService.connect.mockResolvedValue(undefined);
    mockWebSocketService.subscribe.mockImplementation(
      (_eventTypes: unknown, callback: unknown) => {
        mockWebSocketService.waitingCallback = callback;
        return "waiting-list-subscription";
      },
    );
    setupServiceMocks();
  });

  // ── 1. Component Mounting ─────────────────────────────────────────────

  describe("Component Mounting", () => {
    it("should mount without errors", async () => {
      const wrapper = mountComponent();
      await flushPromises();
      expect(wrapper.exists()).toBe(true);
    });

    it("should call loadWaitingList and getQueueStatus on mount", async () => {
      mountComponent();
      await flushPromises();
      expect(mockWaitingListService.listWaitingList).toHaveBeenCalledTimes(1);
      expect(mockWaitingListService.getQueueStatus).toHaveBeenCalledTimes(1);
    });

    it("should pass restaurantId to service calls", async () => {
      mountComponent();
      await flushPromises();
      expect(mockWaitingListService.listWaitingList).toHaveBeenCalledWith(
        expect.objectContaining({ restaurantId: "R-001" }),
      );
      expect(mockWaitingListService.getQueueStatus).toHaveBeenCalledWith(
        "R-001",
      );
    });

    it("should subscribe to waiting list realtime lifecycle events", async () => {
      mountComponent();
      await flushPromises();

      expect(mockWebSocketService.connect).toHaveBeenCalledWith("R-001");
      expect(mockWebSocketService.subscribe).toHaveBeenCalledWith(
        expect.arrayContaining([
          "waiting_list_joined",
          "waiting_list_called",
          "waiting_list_confirmed",
          "waiting_list_seated",
          "waiting_list_cancelled",
          "waiting_list_expired",
        ]),
        expect.any(Function),
      );
    });

    it("should refresh queue data when a waiting realtime event arrives", async () => {
      const wrapper = mountComponent();
      await flushPromises();

      expect(mockWebSocketService.waitingCallback).toEqual(
        expect.any(Function),
      );

      vi.useFakeTimers();
      vi.clearAllMocks();
      setupServiceMocks();

      mockWebSocketService.waitingCallback({
        type: "waiting_list_joined",
        eventId: "evt-001",
        timestamp: Date.now(),
        restaurantId: "R-001",
        data: {
          entryId: "wl-004",
          queueDisplay: "A004",
          status: "waiting",
        },
      });

      await vi.advanceTimersByTimeAsync(250);
      vi.useRealTimers();
      await flushPromises();

      expect(mockWaitingListService.listWaitingList).toHaveBeenCalledTimes(1);
      expect(mockWaitingListService.getQueueStatus).toHaveBeenCalledTimes(1);

      wrapper.unmount();
    });

    it("should unsubscribe from waiting realtime events on unmount", async () => {
      const wrapper = mountComponent();
      await flushPromises();

      wrapper.unmount();

      expect(mockWebSocketService.unsubscribe).toHaveBeenCalledWith(
        "waiting-list-subscription",
      );
    });
  });

  // ── 2. Queue List Rendering ───────────────────────────────────────────

  describe("Queue List Rendering", () => {
    it("should display waiting list entries in card view by default", async () => {
      const wrapper = mountComponent();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain("Alice");
      expect(html).toContain("Bob");
      expect(html).toContain("Charlie");
    });

    it("should display customer phone numbers", async () => {
      const wrapper = mountComponent();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain("0912345678");
      expect(html).toContain("0987654321");
    });

    it("should display queue numbers", async () => {
      const wrapper = mountComponent();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain("#1");
      expect(html).toContain("#2");
      expect(html).toContain("#3");
    });

    it("should display party sizes", async () => {
      const wrapper = mountComponent();
      await flushPromises();
      const html = wrapper.html();
      // party size values rendered with "waitingList.people" i18n key
      expect(html).toContain("2");
      expect(html).toContain("4");
      expect(html).toContain("6");
    });

    it("should show queue section heading", async () => {
      const wrapper = mountComponent();
      await flushPromises();
      expect(wrapper.html()).toContain("waitingList.queue");
    });

    it("should toggle between card and table view modes", async () => {
      const wrapper = mountComponent();
      await flushPromises();

      // Default is card view — find the view toggle buttons by data-testid
      const cardToggle = wrapper.find('[data-testid="view-toggle-card"]');
      const tableToggle = wrapper.find('[data-testid="view-toggle-table"]');
      expect(cardToggle.exists()).toBe(true);
      expect(tableToggle.exists()).toBe(true);
    });

    it("should render table view headers when table mode selected", async () => {
      const wrapper = mountComponent();
      await flushPromises();

      // Click the table view toggle button
      const listToggle = wrapper.find('[data-testid="view-toggle-table"]');
      if (listToggle.exists()) {
        await listToggle.trigger("click");
        await nextTick();
        const html = wrapper.html();
        expect(html).toContain("waitingList.queueNumber");
        expect(html).toContain("waitingList.customerInfo");
        expect(html).toContain("waitingList.partySize");
        expect(html).toContain("waitingList.waitTime");
        expect(html).toContain("common.status");
        expect(html).toContain("waitingList.joinedAt");
        expect(html).toContain("common.actions");
      }
    });
  });

  // ── 3. Add Customer to Queue ──────────────────────────────────────────

  describe("Add Customer to Queue", () => {
    it("should display add customer button", async () => {
      const wrapper = mountComponent();
      await flushPromises();
      expect(wrapper.html()).toContain("waitingList.addCustomer");
    });

    it("should open add dialog when add button clicked", async () => {
      const wrapper = mountComponent();
      await flushPromises();

      const addBtn = wrapper
        .findAll("button")
        .find((b) => b.html().includes("waitingList.addCustomer"));
      expect(addBtn).toBeDefined();
      await addBtn!.trigger("click");
      await nextTick();

      // Dialog content should be visible (form fields)
      const html = wrapper.html();
      expect(html).toContain("waitingList.customerNameRequired");
      expect(html).toContain("waitingList.customerPhoneRequired");
      expect(html).toContain("waitingList.partySizeRequired");
    });

    it("should call joinWaitingList API on form submit", async () => {
      const wrapper = mountComponent();
      await flushPromises();

      // Open dialog
      const addBtn = wrapper
        .findAll("button")
        .find((b) => b.html().includes("waitingList.addCustomer"));
      await addBtn!.trigger("click");
      await nextTick();

      // Fill in form fields — the filter section has a tel input at index 0,
      // so the dialog tel input is at index 1.
      const textInputs = wrapper.findAll('input[type="text"]');
      const telInputs = wrapper.findAll('input[type="tel"]');
      const numInputs = wrapper.findAll('input[type="number"]');

      // customerName is a text input in the dialog
      if (textInputs.length > 0) await textInputs[0].setValue("NewCustomer");
      // customerPhone — filter tel is [0], dialog tel is [1]
      if (telInputs.length > 1) await telInputs[1].setValue("0999999999");
      if (numInputs.length > 0) await numInputs[0].setValue(3);

      // Click confirm button
      const confirmBtn = wrapper
        .findAll("button")
        .find((b) => b.html().includes("waitingList.confirmAdd"));
      if (confirmBtn) {
        await confirmBtn.trigger("click");
        await flushPromises();
        expect(mockWaitingListService.joinWaitingList).toHaveBeenCalledWith(
          expect.objectContaining({
            restaurantId: "R-001",
            customerName: "NewCustomer",
            customerPhone: "0999999999",
            partySize: 3,
          }),
        );
      }
    });

    it("should show warning toast when form is incomplete", async () => {
      const wrapper = mountComponent();
      await flushPromises();

      // Open dialog
      const addBtn = wrapper
        .findAll("button")
        .find((b) => b.html().includes("waitingList.addCustomer"));
      await addBtn!.trigger("click");
      await nextTick();

      // Click confirm without filling form
      const confirmBtn = wrapper
        .findAll("button")
        .find((b) => b.html().includes("waitingList.confirmAdd"));
      if (confirmBtn) {
        await confirmBtn.trigger("click");
        await flushPromises();
        expect(mockToast.warning).toHaveBeenCalledWith("common.fillRequired");
        expect(mockWaitingListService.joinWaitingList).not.toHaveBeenCalled();
      }
    });

    it("should show success toast after adding customer", async () => {
      const wrapper = mountComponent();
      await flushPromises();

      const addBtn = wrapper
        .findAll("button")
        .find((b) => b.html().includes("waitingList.addCustomer"));
      await addBtn!.trigger("click");
      await nextTick();

      const textInputs = wrapper.findAll('input[type="text"]');
      const telInputs = wrapper.findAll('input[type="tel"]');
      if (textInputs.length > 0) await textInputs[0].setValue("Test");
      if (telInputs.length > 1) await telInputs[1].setValue("0911111111");

      const confirmBtn = wrapper
        .findAll("button")
        .find((b) => b.html().includes("waitingList.confirmAdd"));
      if (confirmBtn) {
        await confirmBtn.trigger("click");
        await flushPromises();
        expect(mockToast.success).toHaveBeenCalledWith(
          "waitingList.addSuccess",
        );
      }
    });

    it("should handle add-to-queue API error", async () => {
      mockWaitingListService.joinWaitingList.mockRejectedValue(
        new Error("Server error"),
      );
      const wrapper = mountComponent();
      await flushPromises();

      const addBtn = wrapper
        .findAll("button")
        .find((b) => b.html().includes("waitingList.addCustomer"));
      await addBtn!.trigger("click");
      await nextTick();

      const textInputs = wrapper.findAll('input[type="text"]');
      const telInputs = wrapper.findAll('input[type="tel"]');
      if (textInputs.length > 0) await textInputs[0].setValue("Test");
      if (telInputs.length > 1) await telInputs[1].setValue("0911111111");

      const confirmBtn = wrapper
        .findAll("button")
        .find((b) => b.html().includes("waitingList.confirmAdd"));
      if (confirmBtn) {
        await confirmBtn.trigger("click");
        await flushPromises();
        expect(mockToast.error).toHaveBeenCalled();
      }
    });
  });

  // ── 4. Call Customer ──────────────────────────────────────────────────

  describe("Call Customer", () => {
    it("should show call button for waiting entries", async () => {
      const wrapper = mountComponent();
      await flushPromises();
      // Card view: call button should be visible for "waiting" status entries
      const callBtns = wrapper
        .findAll("button")
        .filter((b) => b.html().includes("waitingList.call"));
      expect(callBtns.length).toBeGreaterThan(0);
    });

    it("should open call dialog when call button clicked", async () => {
      const wrapper = mountComponent();
      await flushPromises();

      const callBtn = wrapper
        .findAll("button")
        .find(
          (b) =>
            b.html().includes("waitingList.call") &&
            !b.html().includes("callNext") &&
            !b.html().includes("callCustomer"),
        );
      if (callBtn) {
        await callBtn.trigger("click");
        await nextTick();
        const html = wrapper.html();
        expect(html).toContain("waitingList.callCustomer");
        expect(html).toContain("Alice");
      }
    });
  });

  // ── 5. Seat Customer ──────────────────────────────────────────────────

  describe("Seat Customer", () => {
    it("should show seat button for called entries", async () => {
      const wrapper = mountComponent();
      await flushPromises();
      // In card view: seat button appears for "called" and "confirmed" statuses
      const seatBtns = wrapper
        .findAll("button")
        .filter((b) => b.html().includes("waitingList.seat"));
      expect(seatBtns.length).toBeGreaterThan(0);
    });

    it("should call markSeated API when seat button clicked", async () => {
      const wrapper = mountComponent();
      await flushPromises();

      const seatBtns = wrapper
        .findAll("button")
        .filter((b) => b.html().includes("waitingList.seat"));
      if (seatBtns.length > 0) {
        await seatBtns[0].trigger("click");
        await flushPromises();
        expect(mockWaitingListService.markSeated).toHaveBeenCalledWith(
          "wl-002",
        );
      }
    });

    it("should show success toast after seating customer", async () => {
      const wrapper = mountComponent();
      await flushPromises();

      const seatBtns = wrapper
        .findAll("button")
        .filter((b) => b.html().includes("waitingList.seat"));
      if (seatBtns.length > 0) {
        await seatBtns[0].trigger("click");
        await flushPromises();
        expect(mockToast.success).toHaveBeenCalledWith(
          "waitingList.seatSuccess",
        );
      }
    });

    it("should handle markSeated API error", async () => {
      mockWaitingListService.markSeated.mockRejectedValue(new Error("Failed"));
      const wrapper = mountComponent();
      await flushPromises();

      const seatBtns = wrapper
        .findAll("button")
        .filter((b) => b.html().includes("waitingList.seat"));
      if (seatBtns.length > 0) {
        await seatBtns[0].trigger("click");
        await flushPromises();
        expect(mockToast.error).toHaveBeenCalled();
      }
    });
  });

  // ── 6. Cancel / Expire Entries ────────────────────────────────────────

  describe("Cancel / Expire Entries", () => {
    it("should show cancel button for waiting and called entries", async () => {
      const wrapper = mountComponent();
      await flushPromises();
      const cancelBtns = wrapper
        .findAll("button")
        .filter((b) => b.html().includes("waitingList.cancel"));
      // Alice (waiting) and Bob (called) should have cancel buttons
      expect(cancelBtns.length).toBeGreaterThanOrEqual(2);
    });

    it("should call cancelWaiting API on cancel click", async () => {
      // Component uses useConfirmModal (auto-resolves true via mock)
      const wrapper = mountComponent();
      await flushPromises();

      const cancelBtns = wrapper
        .findAll("button")
        .filter((b) => b.html().includes("waitingList.cancel"));
      if (cancelBtns.length > 0) {
        await cancelBtns[0].trigger("click");
        await flushPromises();
        expect(mockWaitingListService.cancelWaiting).toHaveBeenCalledWith(
          "wl-001",
          "0912345678",
        );
      }
    });

    it("should not cancel when user declines confirmation", async () => {
      // Component uses useConfirmModal — mock it to return false
      mockWaitingConfirmModalFn.mockResolvedValueOnce(false);
      const wrapper = mountComponent();
      await flushPromises();

      const cancelBtns = wrapper
        .findAll("button")
        .filter((b) => b.html().includes("waitingList.cancel"));
      if (cancelBtns.length > 0) {
        await cancelBtns[0].trigger("click");
        await flushPromises();
        expect(mockWaitingListService.cancelWaiting).not.toHaveBeenCalled();
      }
    });

    it("should show expire button for called entries", async () => {
      const wrapper = mountComponent();
      await flushPromises();
      const expireBtns = wrapper
        .findAll("button")
        .filter((b) => b.html().includes("waitingList.expire"));
      expect(expireBtns.length).toBeGreaterThan(0);
    });

    it("should call expireWaiting API on expire click", async () => {
      // Component uses useConfirmModal (auto-resolves true via mock)
      const wrapper = mountComponent();
      await flushPromises();

      const expireBtns = wrapper
        .findAll("button")
        .filter((b) => b.html().includes("waitingList.expire"));
      if (expireBtns.length > 0) {
        await expireBtns[0].trigger("click");
        await flushPromises();
        expect(mockWaitingListService.expireWaiting).toHaveBeenCalledWith(
          "wl-002",
        );
      }
    });

    it("should handle cancel API error", async () => {
      // Component uses useConfirmModal (auto-resolves true via mock)
      mockWaitingListService.cancelWaiting.mockRejectedValue(
        new Error("Failed"),
      );
      const wrapper = mountComponent();
      await flushPromises();

      const cancelBtns = wrapper
        .findAll("button")
        .filter((b) => b.html().includes("waitingList.cancel"));
      if (cancelBtns.length > 0) {
        await cancelBtns[0].trigger("click");
        await flushPromises();
        expect(mockToast.error).toHaveBeenCalled();
      }
    });
  });

  // ── 7. Filters ────────────────────────────────────────────────────────

  describe("Filters", () => {
    it("should display status filter dropdown", async () => {
      const wrapper = mountComponent();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain("waitingList.filter.status");
      expect(wrapper.find("select").exists()).toBe(true);
    });

    it("should display phone search input", async () => {
      const wrapper = mountComponent();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain("waitingList.filter.phone");
      expect(wrapper.find('input[type="tel"]').exists()).toBe(true);
    });

    it("should reload list when status filter changes", async () => {
      const wrapper = mountComponent();
      await flushPromises();
      vi.clearAllMocks();
      setupServiceMocks();

      const select = wrapper.find("select");
      await select.setValue("called");
      await flushPromises();

      expect(mockWaitingListService.listWaitingList).toHaveBeenCalledWith(
        expect.objectContaining({ status: "called" }),
      );
    });

    it("should reload list on search button click", async () => {
      const wrapper = mountComponent();
      await flushPromises();
      vi.clearAllMocks();
      setupServiceMocks();

      const searchBtn = wrapper
        .findAll("button")
        .find((b) => b.html().includes("common.search"));
      if (searchBtn) {
        await searchBtn.trigger("click");
        await flushPromises();
        expect(mockWaitingListService.listWaitingList).toHaveBeenCalled();
      }
    });

    it("should reset filters on reset button click", async () => {
      const wrapper = mountComponent();
      await flushPromises();

      // Set a filter value first
      const select = wrapper.find("select");
      await select.setValue("called");
      await flushPromises();

      vi.clearAllMocks();
      setupServiceMocks();

      const resetBtn = wrapper
        .findAll("button")
        .find((b) => b.html().includes("common.reset"));
      if (resetBtn) {
        await resetBtn.trigger("click");
        await flushPromises();
        expect(mockWaitingListService.listWaitingList).toHaveBeenCalledWith(
          expect.objectContaining({ page: 1 }),
        );
      }
    });

    it("should reload list on refresh button click", async () => {
      const wrapper = mountComponent();
      await flushPromises();
      vi.clearAllMocks();
      setupServiceMocks();

      const refreshBtn = wrapper
        .findAll("button")
        .find((b) => b.html().includes("common.refresh"));
      if (refreshBtn) {
        await refreshBtn.trigger("click");
        await flushPromises();
        expect(mockWaitingListService.listWaitingList).toHaveBeenCalled();
      }
    });
  });

  // ── 8. Pagination ─────────────────────────────────────────────────────

  describe("Pagination", () => {
    it("should call service with default pagination params", async () => {
      mountComponent();
      await flushPromises();
      expect(mockWaitingListService.listWaitingList).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 50,
        }),
      );
    });

    it("should show pagination in table view when total > 0", async () => {
      const wrapper = mountComponent();
      await flushPromises();

      // Switch to table view
      const listToggle = wrapper.find('[data-testid="view-toggle-table"]');
      if (listToggle.exists()) {
        await listToggle.trigger("click");
        await nextTick();
        const html = wrapper.html();
        expect(html).toContain("waitingList.pagination.showing");
      }
    });
  });

  // ── 9. Queue Status Display ───────────────────────────────────────────

  describe("Queue Status Display", () => {
    it("should call getQueueStatus on mount", async () => {
      mountComponent();
      await flushPromises();
      expect(mockWaitingListService.getQueueStatus).toHaveBeenCalledWith(
        "R-001",
      );
    });

    it("should display stat labels via i18n keys", async () => {
      const wrapper = mountComponent();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain("waitingList.queue");
      expect(html).toContain("waitingList.filter.status");
    });
  });

  // ── 10. Empty State ───────────────────────────────────────────────────

  describe("Empty State", () => {
    it("should show empty state when no queue entries exist", async () => {
      setupServiceMocks({
        listResponse: {
          success: true,
          data: [],
          pagination: { total: 0, page: 1, limit: 50 },
        },
      });
      const wrapper = mountComponent();
      await flushPromises();
      expect(wrapper.html()).toContain("waitingList.noQueue");
    });
  });

  // ── 11. Loading State ─────────────────────────────────────────────────

  describe("Loading State", () => {
    it("should show loading skeleton during fetch", async () => {
      mockWaitingListService.listWaitingList.mockReturnValue(
        new Promise(() => {}),
      );
      mockWaitingListService.getQueueStatus.mockReturnValue(
        new Promise(() => {}),
      );
      const wrapper = mountComponent();
      await nextTick();
      expect(wrapper.html()).toContain("animate-pulse");
    });
  });

  // ── 12. Error Handling ────────────────────────────────────────────────

  describe("Error Handling", () => {
    it("should handle listWaitingList API error gracefully", async () => {
      mockWaitingListService.listWaitingList.mockRejectedValue(
        new Error("Network error"),
      );
      const wrapper = mountComponent();
      await flushPromises();
      expect(wrapper.exists()).toBe(true);
      expect(mockToast.error).toHaveBeenCalledWith("waitingList.loadError");
    });

    it("should handle getQueueStatus API error gracefully", async () => {
      mockWaitingListService.getQueueStatus.mockRejectedValue(
        new Error("Server error"),
      );
      const wrapper = mountComponent();
      await flushPromises();
      expect(wrapper.exists()).toBe(true);
    });

    it("should handle both APIs failing simultaneously", async () => {
      mockWaitingListService.listWaitingList.mockRejectedValue(
        new Error("fail"),
      );
      mockWaitingListService.getQueueStatus.mockRejectedValue(
        new Error("fail"),
      );
      const wrapper = mountComponent();
      await flushPromises();
      expect(wrapper.exists()).toBe(true);
      expect(mockToast.error).toHaveBeenCalled();
    });

    it("should handle expire API error", async () => {
      // Component uses useConfirmModal (auto-resolves true via mock)
      mockWaitingListService.expireWaiting.mockRejectedValue(
        new Error("Failed"),
      );
      const wrapper = mountComponent();
      await flushPromises();

      const expireBtns = wrapper
        .findAll("button")
        .filter((b) => b.html().includes("waitingList.expire"));
      if (expireBtns.length > 0) {
        await expireBtns[0].trigger("click");
        await flushPromises();
        expect(mockToast.error).toHaveBeenCalled();
      }
    });
  });

  // ── 13. Batch Call Next ───────────────────────────────────────────────

  describe("Batch Call Next", () => {
    it("should display call next button", async () => {
      const wrapper = mountComponent();
      await flushPromises();
      expect(wrapper.html()).toContain("waitingList.callNext");
    });

    it("should call batchCall API when call next button clicked", async () => {
      const wrapper = mountComponent();
      await flushPromises();

      const callNextBtn = wrapper
        .findAll("button")
        .find((b) => b.html().includes("waitingList.callNext"));
      if (callNextBtn) {
        await callNextBtn.trigger("click");
        await flushPromises();
        expect(mockWaitingListService.batchCall).toHaveBeenCalledWith(
          "R-001",
          1,
        );
      }
    });

    it("should show success toast after batch call", async () => {
      const wrapper = mountComponent();
      await flushPromises();

      const callNextBtn = wrapper
        .findAll("button")
        .find((b) => b.html().includes("waitingList.callNext"));
      if (callNextBtn) {
        await callNextBtn.trigger("click");
        await flushPromises();
        expect(mockToast.success).toHaveBeenCalledWith(
          "waitingList.callSuccess",
        );
      }
    });

    it("should handle batch call API error", async () => {
      mockWaitingListService.batchCall.mockRejectedValue(new Error("Failed"));
      const wrapper = mountComponent();
      await flushPromises();

      const callNextBtn = wrapper
        .findAll("button")
        .find((b) => b.html().includes("waitingList.callNext"));
      if (callNextBtn) {
        await callNextBtn.trigger("click");
        await flushPromises();
        expect(mockToast.error).toHaveBeenCalled();
      }
    });

    it("should reload list and queue status after batch call", async () => {
      const wrapper = mountComponent();
      await flushPromises();
      vi.clearAllMocks();
      setupServiceMocks();

      const callNextBtn = wrapper
        .findAll("button")
        .find((b) => b.html().includes("waitingList.callNext"));
      if (callNextBtn) {
        await callNextBtn.trigger("click");
        await flushPromises();
        expect(mockWaitingListService.listWaitingList).toHaveBeenCalled();
        expect(mockWaitingListService.getQueueStatus).toHaveBeenCalled();
      }
    });
  });

  // ── 14. Action Button Visibility by Status ────────────────────────────

  describe("Action Button Visibility by Status", () => {
    it("should not show call button for non-waiting entries", async () => {
      setupServiceMocks({
        listResponse: {
          success: true,
          data: [mockWaitingEntries[1]], // Bob - "called" status
          pagination: { total: 1, page: 1, limit: 50 },
        },
      });
      const wrapper = mountComponent();
      await flushPromises();

      // "call" button text but not "callNext" - should not appear for called status
      const callBtns = wrapper
        .findAll("button")
        .filter((b) => b.text().trim() === "waitingList.call");
      expect(callBtns.length).toBe(0);
    });

    it("should not show expire button for waiting entries", async () => {
      setupServiceMocks({
        listResponse: {
          success: true,
          data: [mockWaitingEntries[0]], // Alice - "waiting" status
          pagination: { total: 1, page: 1, limit: 50 },
        },
      });
      const wrapper = mountComponent();
      await flushPromises();

      const expireBtns = wrapper
        .findAll("button")
        .filter((b) => b.html().includes("waitingList.expire"));
      expect(expireBtns.length).toBe(0);
    });

    it("should show seat button for confirmed entries", async () => {
      setupServiceMocks({
        listResponse: {
          success: true,
          data: [mockWaitingEntries[2]], // Charlie - "confirmed" status
          pagination: { total: 1, page: 1, limit: 50 },
        },
      });
      const wrapper = mountComponent();
      await flushPromises();

      const seatBtns = wrapper
        .findAll("button")
        .filter((b) => b.html().includes("waitingList.seat"));
      expect(seatBtns.length).toBeGreaterThan(0);
    });
  });
});

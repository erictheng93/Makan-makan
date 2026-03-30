/**
 * WaitingListView Component Tests
 * First-pass coverage for the waiting list management view.
 *
 * Focuses on: mounting, data loading, queue status display, error handling.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

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

// Mock @headlessui/vue — Dialog components used by add/call dialogs
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

// Mock vue-toastification — use vi.hoisted so the object is available
// when vi.mock factory runs (vi.mock calls are hoisted above all other code).
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
  format: (_date: unknown, fmt: string) => fmt,
}));

// Mock WaitingListService
vi.mock("@/services/waitingListService", () => ({
  WaitingListService: {
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
  },
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import WaitingListView from "../seating/WaitingListTab.vue";
import { useAuthStore } from "@/stores/auth";
import { WaitingListService } from "@/services/waitingListService";

// ── Helpers ────────────────────────────────────────────────────────────────

const mockQueueStatus = {
  restaurantId: "R-001",
  totalWaiting: 5,
  averageWaitMinutes: 12,
  availableTables: 3,
  byTableType: [],
};

const mockListResponse = {
  success: true,
  data: [
    {
      id: "wl-001",
      restaurantId: "R-001",
      customerName: "Alice",
      customerPhone: "0912345678",
      partySize: 2,
      queueNumber: 1,
      queueLetter: "A",
      status: "waiting",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ],
  pagination: { total: 1, page: 1, limit: 50 },
};

function setupServiceMocks() {
  (WaitingListService.listWaitingList as Mock).mockResolvedValue(
    mockListResponse,
  );
  (WaitingListService.getQueueStatus as Mock).mockResolvedValue(
    mockQueueStatus,
  );
}

/** Seed localStorage so the auth store hydrates with a valid user + token. */
function seedAuth() {
  const fakeUser = {
    id: 1,
    username: "testuser",
    email: "test@test.com",
    role: 1, // OWNER
    restaurantId: "R-001",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };
  localStorage.setItem("auth_user", JSON.stringify(fakeUser));
  localStorage.setItem("auth_token", "fake-jwt-token");
}

const mountOptions = {
  global: {
    stubs: {
      // Stub Teleport to avoid portal issues in jsdom
      teleport: true,
    },
  },
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe("WaitingListView Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Seed localStorage BEFORE creating the Pinia store, because the auth
    // store hydrates user/token from localStorage in its setup function.
    seedAuth();
    setActivePinia(createPinia());
    setupServiceMocks();
  });

  // ── Component Mounting ─────────────────────────────────────────────────

  describe("Component Mounting", () => {
    it("should mount without errors", async () => {
      const wrapper = mount(WaitingListView, mountOptions);
      await flushPromises();

      expect(wrapper.exists()).toBe(true);
    });

    it("should call loadWaitingList and getQueueStatus on mount", async () => {
      mount(WaitingListView, mountOptions);
      await flushPromises();

      expect(WaitingListService.listWaitingList).toHaveBeenCalledTimes(1);
      expect(WaitingListService.getQueueStatus).toHaveBeenCalledTimes(1);
    });

    it("should pass restaurantId to service calls", async () => {
      mount(WaitingListView, mountOptions);
      await flushPromises();

      expect(WaitingListService.listWaitingList).toHaveBeenCalledWith(
        expect.objectContaining({ restaurantId: "R-001" }),
      );
      expect(WaitingListService.getQueueStatus).toHaveBeenCalledWith("R-001");
    });
  });

  // ── Queue Status Display ───────────────────────────────────────────────

  describe("Queue Status Display", () => {
    it("should display queue statistics when data loads", async () => {
      const wrapper = mount(WaitingListView, mountOptions);
      await flushPromises();

      const html = wrapper.html();
      // The stats cards should show the values from mockQueueStatus
      expect(html).toContain("5"); // totalWaiting
      expect(html).toContain("12"); // averageWaitMinutes
      expect(html).toContain("3"); // availableTables
    });

    it("should display stat labels via i18n keys", async () => {
      const wrapper = mount(WaitingListView, mountOptions);
      await flushPromises();

      const html = wrapper.html();
      // WaitingListTab uses waitingList.queue and filter keys (not a stats section)
      expect(html).toContain("waitingList.queue");
      expect(html).toContain("waitingList.filter.status");
    });
  });

  // ── Error Handling ─────────────────────────────────────────────────────

  describe("Error Handling", () => {
    it("should handle listWaitingList API error gracefully", async () => {
      (WaitingListService.listWaitingList as Mock).mockRejectedValue(
        new Error("Network error"),
      );

      const wrapper = mount(WaitingListView, mountOptions);
      await flushPromises();

      // Component should still mount
      expect(wrapper.exists()).toBe(true);
      // Toast error should be called
      expect(mockToast.error).toHaveBeenCalledWith("waitingList.loadError");
    });

    it("should handle getQueueStatus API error gracefully", async () => {
      (WaitingListService.getQueueStatus as Mock).mockRejectedValue(
        new Error("Server error"),
      );

      const wrapper = mount(WaitingListView, mountOptions);
      await flushPromises();

      // Component should still mount — queue status section just won't show
      expect(wrapper.exists()).toBe(true);
    });

    it("should handle both APIs failing simultaneously", async () => {
      (WaitingListService.listWaitingList as Mock).mockRejectedValue(
        new Error("fail"),
      );
      (WaitingListService.getQueueStatus as Mock).mockRejectedValue(
        new Error("fail"),
      );

      const wrapper = mount(WaitingListView, mountOptions);
      await flushPromises();

      expect(wrapper.exists()).toBe(true);
      expect(mockToast.error).toHaveBeenCalled();
    });
  });

  // ── Service Calls ──────────────────────────────────────────────────────

  describe("Service Calls", () => {
    it("should call listWaitingList with default pagination", async () => {
      mount(WaitingListView, mountOptions);
      await flushPromises();

      expect(WaitingListService.listWaitingList).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId: "R-001",
          page: 1,
          limit: 50,
        }),
      );
    });

    it("should call getQueueStatus with restaurantId", async () => {
      mount(WaitingListView, mountOptions);
      await flushPromises();

      expect(WaitingListService.getQueueStatus).toHaveBeenCalledWith("R-001");
    });
  });
});

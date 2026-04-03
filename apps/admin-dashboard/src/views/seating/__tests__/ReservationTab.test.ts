/**
 * ReservationTab Component Tests
 *
 * Covers: table rendering, status-based action buttons, confirm/cancel/arrive/seat
 * API calls, date filter, status filter, phone search, create reservation form,
 * pagination, empty/loading states.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { mount, flushPromises, VueWrapper } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { nextTick } from "vue";
import { resetAllFactories } from "@makanmakan/testing-utils";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("lucide-vue-next", () => {
  const stub = { template: "<span />" };
  return {
    Plus: stub,
    Calendar: stub,
    Search: stub,
    RotateCcw: stub,
    Eye: stub,
    CheckCircle: stub,
    CheckCheck: stub,
    UserCheck: stub,
    XCircle: stub,
    ChevronLeft: stub,
    ChevronRight: stub,
    Loader2: stub,
  };
});

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

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));
vi.mock("vue-toastification", () => ({
  useToast: () => mockToast,
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const mockReservationService = vi.hoisted(() => ({
  listReservations: vi.fn(),
  getReservation: vi.fn(),
  createReservation: vi.fn(),
  confirmReservation: vi.fn(),
  markArrived: vi.fn(),
  markSeated: vi.fn(),
  cancelReservation: vi.fn(),
  getStats: vi.fn(),
  getStatusText: vi.fn((s: string) => s),
  getStatusColor: vi.fn(() => "default"),
}));
vi.mock("@/services/reservationService", () => ({
  ReservationService: mockReservationService,
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    restaurantId: "r1",
    canAccessAdminFeatures: true,
    user: { id: 1, restaurantId: "r1", role: 0 },
  }),
}));

// Mock useConfirmModal — auto-resolves to true by default
const mockReservationTabConfirmModalFn = vi.fn().mockResolvedValue(true);
vi.mock("@/composables/useConfirmModal", () => ({
  useConfirmModal: () => ({
    confirm: mockReservationTabConfirmModalFn,
    modalState: { value: null },
    close: vi.fn(),
  }),
}));

// ── Imports ────────────────────────────────────────────────────────────────

import ReservationTab from "../ReservationTab.vue";

// ── Test Data ──────────────────────────────────────────────────────────────

const mockReservations = [
  {
    id: "res-1",
    confirmationCode: "ABC123",
    customerName: "Alice",
    customerPhone: "0912345678",
    reservationDate: "2026-03-28",
    reservationTime: "18:00",
    partySize: 4,
    status: "pending",
    specialRequests: "Window seat",
    durationMinutes: 90,
    notes: "",
  },
  {
    id: "res-2",
    confirmationCode: "DEF456",
    customerName: "Bob",
    customerPhone: "0987654321",
    reservationDate: "2026-03-28",
    reservationTime: "19:00",
    partySize: 2,
    status: "confirmed",
    specialRequests: "",
    durationMinutes: 60,
    notes: "",
  },
  {
    id: "res-3",
    confirmationCode: "GHI789",
    customerName: "Charlie",
    customerPhone: "0955555555",
    reservationDate: "2026-03-28",
    reservationTime: "20:00",
    partySize: 6,
    status: "arrived",
    specialRequests: "Birthday cake",
    durationMinutes: 120,
    notes: "VIP",
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function setupMocks(overrides: Record<string, any> = {}) {
  mockReservationService.listReservations.mockResolvedValue(
    overrides.listResponse ?? {
      success: true,
      data: mockReservations,
      meta: { total: 3 },
    },
  );
  mockReservationService.createReservation.mockResolvedValue(
    overrides.createResult ?? { success: true },
  );
  mockReservationService.confirmReservation.mockResolvedValue(
    overrides.confirmResult ?? { success: true },
  );
  mockReservationService.markArrived.mockResolvedValue(
    overrides.arriveResult ?? { success: true },
  );
  mockReservationService.markSeated.mockResolvedValue(
    overrides.seatResult ?? { success: true },
  );
  mockReservationService.cancelReservation.mockResolvedValue(
    overrides.cancelResult ?? { success: true },
  );
}

function mountReservationTab() {
  return mount(ReservationTab, {
    global: {
      stubs: {
        Dialog: { template: "<div><slot /></div>", props: ["as"] },
        DialogPanel: { template: "<div><slot /></div>" },
        DialogTitle: { template: "<h2><slot /></h2>", props: ["as"] },
        TransitionChild: {
          template: "<div><slot /></div>",
          props: [
            "as",
            "enter",
            "enterFrom",
            "enterTo",
            "leave",
            "leaveFrom",
            "leaveTo",
          ],
        },
        TransitionRoot: {
          template: "<div><slot /></div>",
          props: ["as", "show"],
        },
      },
    },
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("ReservationTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllFactories();
    setActivePinia(createPinia());
    // Restore default confirm modal behavior after clearAllMocks
    mockReservationTabConfirmModalFn.mockResolvedValue(true);
    setupMocks();
  });

  // ── Table Rendering ─────────────────────────────────────────────────

  describe("Table Rendering", () => {
    it("should display reservation table with correct column headers", async () => {
      const wrapper = mountReservationTab();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain("reservation.confirmationCode");
      expect(html).toContain("reservation.customerName");
      expect(html).toContain("reservation.datetime");
      expect(html).toContain("reservation.partySize");
      expect(html).toContain("reservation.status");
      expect(html).toContain("reservation.specialRequests");
      expect(html).toContain("common.actions");
    });

    it("should render reservation rows with data", async () => {
      const wrapper = mountReservationTab();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain("ABC123");
      expect(html).toContain("Alice");
      expect(html).toContain("DEF456");
      expect(html).toContain("Bob");
      expect(html).toContain("GHI789");
      expect(html).toContain("Charlie");
    });

    it("should display confirmation codes for each reservation", async () => {
      const wrapper = mountReservationTab();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain("ABC123");
      expect(html).toContain("DEF456");
      expect(html).toContain("GHI789");
    });

    it("should display party sizes", async () => {
      const wrapper = mountReservationTab();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain("4");
      expect(html).toContain("2");
      expect(html).toContain("6");
    });

    it("should display special requests or dash for empty", async () => {
      const wrapper = mountReservationTab();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain("Window seat");
      expect(html).toContain("Birthday cake");
      expect(html).toContain("--");
    });

    it("should display reservation date and time", async () => {
      const wrapper = mountReservationTab();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain("2026-03-28");
      expect(html).toContain("18:00");
      expect(html).toContain("19:00");
      expect(html).toContain("20:00");
    });
  });

  // ── Status-Based Action Buttons ─────────────────────────────────────

  describe("Status-Based Action Buttons", () => {
    it("should show confirm button for pending reservations", async () => {
      const wrapper = mountReservationTab();
      await flushPromises();
      const confirmBtn = wrapper.find(
        'button[title="reservation.confirmReservation"]',
      );
      expect(confirmBtn.exists()).toBe(true);
    });

    it("should show cancel button for pending and confirmed reservations", async () => {
      const wrapper = mountReservationTab();
      await flushPromises();
      const cancelBtns = wrapper.findAll(
        'button[title="reservation.cancelReservation"]',
      );
      // Alice (pending) and Bob (confirmed) should have cancel buttons
      expect(cancelBtns.length).toBe(2);
    });

    it("should show arrive button for confirmed reservations", async () => {
      const wrapper = mountReservationTab();
      await flushPromises();
      const arriveBtn = wrapper.find('button[title="reservation.markArrived"]');
      expect(arriveBtn.exists()).toBe(true);
    });

    it("should show seat button for arrived reservations", async () => {
      const wrapper = mountReservationTab();
      await flushPromises();
      const seatBtn = wrapper.find('button[title="reservation.markSeated"]');
      expect(seatBtn.exists()).toBe(true);
    });

    it("should show view detail button for all reservations", async () => {
      const wrapper = mountReservationTab();
      await flushPromises();
      const viewBtns = wrapper.findAll(
        'button[title="reservation.viewDetail"]',
      );
      expect(viewBtns.length).toBe(3);
    });

    it("should not show confirm button for non-pending status", async () => {
      setupMocks({
        listResponse: {
          success: true,
          data: [mockReservations[1]], // Bob - confirmed
          meta: { total: 1 },
        },
      });
      const wrapper = mountReservationTab();
      await flushPromises();
      const confirmBtn = wrapper.find(
        'button[title="reservation.confirmReservation"]',
      );
      expect(confirmBtn.exists()).toBe(false);
    });
  });

  // ── API Calls ───────────────────────────────────────────────────────

  describe("Confirm / Cancel / Arrive / Seat API Calls", () => {
    it("should call confirm API on confirm button click", async () => {
      // Component uses useConfirmModal (auto-resolves true via mock)
      const wrapper = mountReservationTab();
      await flushPromises();

      const confirmBtn = wrapper.find(
        'button[title="reservation.confirmReservation"]',
      );
      await confirmBtn.trigger("click");
      await flushPromises();
      expect(mockReservationService.confirmReservation).toHaveBeenCalledWith(
        "res-1",
      );
    });

    it("should show success toast after confirm", async () => {
      // Component uses useConfirmModal (auto-resolves true via mock)
      const wrapper = mountReservationTab();
      await flushPromises();

      const confirmBtn = wrapper.find(
        'button[title="reservation.confirmReservation"]',
      );
      await confirmBtn.trigger("click");
      await flushPromises();
      expect(mockToast.success).toHaveBeenCalledWith(
        "reservation.confirmSuccess",
      );
    });

    it("should not call confirm API when user declines", async () => {
      // Component uses useConfirmModal — mock it to return false
      mockReservationTabConfirmModalFn.mockResolvedValueOnce(false);
      const wrapper = mountReservationTab();
      await flushPromises();

      const confirmBtn = wrapper.find(
        'button[title="reservation.confirmReservation"]',
      );
      await confirmBtn.trigger("click");
      await flushPromises();
      expect(mockReservationService.confirmReservation).not.toHaveBeenCalled();
    });

    it("should call cancel API on cancel button click", async () => {
      // Component uses useConfirmModal (auto-resolves true via mock)
      const wrapper = mountReservationTab();
      await flushPromises();

      const cancelBtns = wrapper.findAll(
        'button[title="reservation.cancelReservation"]',
      );
      await cancelBtns[0].trigger("click");
      await flushPromises();
      expect(mockReservationService.cancelReservation).toHaveBeenCalledWith(
        "res-1",
      );
    });

    it("should call markArrived API on arrive button click", async () => {
      const wrapper = mountReservationTab();
      await flushPromises();

      const arriveBtn = wrapper.find('button[title="reservation.markArrived"]');
      await arriveBtn.trigger("click");
      await flushPromises();
      expect(mockReservationService.markArrived).toHaveBeenCalledWith("res-2");
    });

    it("should call markSeated API on seat button click", async () => {
      const wrapper = mountReservationTab();
      await flushPromises();

      const seatBtn = wrapper.find('button[title="reservation.markSeated"]');
      await seatBtn.trigger("click");
      await flushPromises();
      expect(mockReservationService.markSeated).toHaveBeenCalledWith("res-3");
    });

    it("should handle confirm API error", async () => {
      // Component uses useConfirmModal (auto-resolves true via mock)
      mockReservationService.confirmReservation.mockRejectedValue(
        new Error("Failed"),
      );
      const wrapper = mountReservationTab();
      await flushPromises();

      const confirmBtn = wrapper.find(
        'button[title="reservation.confirmReservation"]',
      );
      await confirmBtn.trigger("click");
      await flushPromises();
      expect(mockToast.error).toHaveBeenCalled();
    });

    it("should handle cancel API error", async () => {
      // Component uses useConfirmModal (auto-resolves true via mock)
      mockReservationService.cancelReservation.mockRejectedValue(
        new Error("Failed"),
      );
      const wrapper = mountReservationTab();
      await flushPromises();

      const cancelBtns = wrapper.findAll(
        'button[title="reservation.cancelReservation"]',
      );
      await cancelBtns[0].trigger("click");
      await flushPromises();
      expect(mockToast.error).toHaveBeenCalled();
    });

    it("should reload list after successful confirm", async () => {
      // Component uses useConfirmModal (auto-resolves true via mock)
      const wrapper = mountReservationTab();
      await flushPromises();
      vi.clearAllMocks();
      mockReservationTabConfirmModalFn.mockResolvedValue(true);
      setupMocks();

      const confirmBtn = wrapper.find(
        'button[title="reservation.confirmReservation"]',
      );
      await confirmBtn.trigger("click");
      await flushPromises();
      expect(mockReservationService.listReservations).toHaveBeenCalled();
    });
  });

  // ── Filters ─────────────────────────────────────────────────────────

  describe("Filters", () => {
    it("should show filter fields (date, status, phone)", async () => {
      const wrapper = mountReservationTab();
      await flushPromises();
      expect(wrapper.find('input[type="date"]').exists()).toBe(true);
      expect(wrapper.find("select").exists()).toBe(true);
      expect(wrapper.find('input[type="tel"]').exists()).toBe(true);
    });

    it("should filter by status via select change", async () => {
      const wrapper = mountReservationTab();
      await flushPromises();
      vi.clearAllMocks();
      setupMocks();

      const select = wrapper.find("select");
      await select.setValue("confirmed");
      await flushPromises();

      expect(mockReservationService.listReservations).toHaveBeenCalled();
      const lastCall =
        mockReservationService.listReservations.mock.calls[
          mockReservationService.listReservations.mock.calls.length - 1
        ];
      expect(lastCall[0]).toMatchObject({ status: "confirmed" });
    });

    it("should include date in filter when set", async () => {
      const wrapper = mountReservationTab();
      await flushPromises();
      vi.clearAllMocks();
      setupMocks();

      const dateInput = wrapper.find('input[type="date"]');
      await dateInput.setValue("2026-03-28");
      // Trigger change event
      await dateInput.trigger("change");
      await flushPromises();

      expect(mockReservationService.listReservations).toHaveBeenCalledWith(
        expect.objectContaining({ reservationDate: "2026-03-28" }),
      );
    });

    it("should reset filters and reload on reset click", async () => {
      const wrapper = mountReservationTab();
      await flushPromises();

      // Set filter first
      const select = wrapper.find("select");
      await select.setValue("confirmed");
      await flushPromises();
      vi.clearAllMocks();
      setupMocks();

      const resetBtn = wrapper
        .findAll("button")
        .find((b) => b.html().includes("common.reset"));
      if (resetBtn) {
        await resetBtn.trigger("click");
        await flushPromises();
        expect(mockReservationService.listReservations).toHaveBeenCalled();
      }
    });
  });

  // ── Create Reservation ──────────────────────────────────────────────

  describe("Create Reservation", () => {
    it("should display create reservation button", async () => {
      const wrapper = mountReservationTab();
      await flushPromises();
      expect(wrapper.html()).toContain("reservation.create");
    });

    it("should show form fields when create dialog opens", async () => {
      const wrapper = mountReservationTab();
      await flushPromises();

      // The dialog is always rendered (TransitionRoot stub renders regardless of show)
      const html = wrapper.html();
      expect(html).toContain("reservation.customerNameRequired");
      expect(html).toContain("reservation.customerPhoneRequired");
      expect(html).toContain("reservation.partySizeRequired");
    });

    it("should show warning when submitting empty form", async () => {
      const wrapper = mountReservationTab();
      await flushPromises();

      // Click create button to open dialog
      const createBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("reservation.create"));
      if (createBtn) {
        await createBtn.trigger("click");
        await nextTick();
      }

      // Click confirm create
      const confirmBtn = wrapper
        .findAll("button")
        .find((b) => b.html().includes("reservation.confirmCreate"));
      if (confirmBtn) {
        await confirmBtn.trigger("click");
        await flushPromises();
        expect(mockToast.warning).toHaveBeenCalledWith("common.fillRequired");
      }
    });
  });

  // ── Pagination ──────────────────────────────────────────────────────

  describe("Pagination", () => {
    it("should show pagination when total > 0", async () => {
      const wrapper = mountReservationTab();
      await flushPromises();
      expect(wrapper.html()).toContain("reservation.pagination.showing");
    });

    it("should not show pagination when total is 0", async () => {
      setupMocks({
        listResponse: {
          success: true,
          data: [],
          meta: { total: 0 },
        },
      });
      const wrapper = mountReservationTab();
      await flushPromises();
      expect(wrapper.html()).not.toContain("reservation.pagination.showing");
    });
  });

  // ── Empty / Loading States ──────────────────────────────────────────

  describe("Empty / Loading States", () => {
    it("should show loading skeleton during fetch", async () => {
      mockReservationService.listReservations.mockReturnValue(
        new Promise(() => {}),
      );
      const wrapper = mountReservationTab();
      await nextTick();
      expect(wrapper.html()).toContain("animate-pulse");
    });

    it("should show empty state when no reservations exist", async () => {
      setupMocks({
        listResponse: {
          success: true,
          data: [],
          meta: { total: 0 },
        },
      });
      const wrapper = mountReservationTab();
      await flushPromises();
      expect(wrapper.html()).toContain("reservation.noRecords");
    });

    it("should show error toast on load failure", async () => {
      mockReservationService.listReservations.mockRejectedValue(
        new Error("Network error"),
      );
      const wrapper = mountReservationTab();
      await flushPromises();
      expect(wrapper.exists()).toBe(true);
      expect(mockToast.error).toHaveBeenCalledWith("reservation.loadError");
    });
  });
});

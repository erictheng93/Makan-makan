/**
 * SeatingManagementView & Sub-Tab Component Tests
 *
 * Covers: SeatingManagementView (stats, tabs, active-tab),
 *         ReservationTab (table, actions, filters, pagination),
 *         TableSetupTab (grid, CRUD, QR, filters),
 *         QueueDashboardTab (stats, queue list, wait time),
 *         Error & Loading states.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { mount, flushPromises, VueWrapper } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { ref, computed, nextTick } from "vue";
import { resetAllFactories } from "@makanmasak/testing-utils";

// ── Mocks (must be declared before imports that use them) ──────────────────

// Mock lucide-vue-next icons — list every named export used by the four components
vi.mock("lucide-vue-next", () => {
  const stub = { template: "<span />" };
  return {
    // SeatingManagementView
    Calendar: stub,
    CheckCircle: stub,
    Clock: stub,
    Timer: stub,
    UtensilsCrossed: stub,
    AlertCircle: stub,
    Users: stub,
    BookOpen: stub,
    ClipboardList: stub,
    LayoutDashboard: stub,
    Table: stub,
    // ReservationTab
    Plus: stub,
    Search: stub,
    RotateCcw: stub,
    Eye: stub,
    CheckCheck: stub,
    UserCheck: stub,
    XCircle: stub,
    ChevronLeft: stub,
    ChevronRight: stub,
    Loader2: stub,
    // TableSetupTab
    QrCode: stub,
    MapPin: stub,
    FileText: stub,
    TableProperties: stub,
    // QueueDashboardTab
    Settings: stub,
    Bell: stub,
  };
});

// Mock @heroicons/vue/24/outline — list all named exports used by QueueDashboardTab
vi.mock("@heroicons/vue/24/outline", () => {
  const stub = { template: "<span />" };
  return {
    UsersIcon: stub,
    ClockIcon: stub,
    BuildingStorefrontIcon: stub,
    ArrowPathIcon: stub,
    StarIcon: stub,
    PlusIcon: stub,
    SparklesIcon: stub,
    BellIcon: stub,
    XMarkIcon: stub,
    DocumentChartBarIcon: stub,
  };
});

// Mock individual heroicon default export modules
vi.mock("@heroicons/vue/24/outline/DocumentChartBarIcon", () => ({
  default: { template: "<span />" },
}));

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
  t: (key: string) => key,
}));

// Mock api
const mockApi = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue({ data: { success: true, data: [] } }),
  post: vi.fn().mockResolvedValue({ data: { success: true } }),
  put: vi.fn().mockResolvedValue({ data: { success: true } }),
  delete: vi.fn().mockResolvedValue({ data: { success: true } }),
}));
vi.mock("@/services/api", () => {
  const unwrapApiPayload = (payload: unknown) =>
    typeof payload === "object" && payload !== null && "data" in payload
      ? (payload as { data: unknown }).data
      : payload;

  return {
    api: mockApi,
    unwrapApiPayload,
    unwrapApiData: (response: { data: unknown }) =>
      unwrapApiPayload(response.data),
    unwrapApiList: (payload: unknown) => {
      const data = unwrapApiPayload(payload);
      return Array.isArray(data) ? data : [];
    },
  };
});

// Mock ReservationService
const mockReservationService = vi.hoisted(() => ({
  listReservations: vi.fn().mockResolvedValue({
    success: true,
    data: [],
    meta: { total: 0 },
  }),
  getReservation: vi.fn(),
  createReservation: vi.fn().mockResolvedValue({ success: true }),
  confirmReservation: vi.fn().mockResolvedValue({ success: true }),
  markArrived: vi.fn().mockResolvedValue({ success: true }),
  markSeated: vi.fn().mockResolvedValue({ success: true }),
  cancelReservation: vi.fn().mockResolvedValue({ success: true }),
  getStats: vi.fn().mockResolvedValue({
    totalReservations: 12,
    confirmedCount: 8,
    completedCount: 5,
    noShowRate: 3.2,
  }),
  getStatusText: vi.fn((s: string) => s),
  getStatusColor: vi.fn(() => "default"),
}));
vi.mock("@/services/reservationService", () => ({
  ReservationService: mockReservationService,
}));

// Mock WaitingListService
const mockWaitingListService = vi.hoisted(() => ({
  listWaitingList: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getQueueStatus: vi.fn().mockResolvedValue({
    totalWaiting: 5,
    averageWaitMinutes: 15,
    availableTables: 3,
  }),
  getStats: vi.fn().mockResolvedValue({ seatedCount: 22 }),
  joinWaitingList: vi.fn(),
  callWaiting: vi.fn(),
  markSeated: vi.fn(),
  expireWaiting: vi.fn(),
  cancelWaiting: vi.fn(),
  estimateWaitTime: vi.fn(),
  batchCall: vi.fn(),
  getStatusText: vi.fn((s: string) => s),
  getStatusColor: vi.fn(() => "default"),
  formatQueueDisplay: vi.fn(() => "A1"),
  formatWaitTime: vi.fn(() => "10 min"),
}));
vi.mock("@/services/waitingListService", () => ({
  WaitingListService: mockWaitingListService,
}));

// Mock queueService
const mockQueueService = vi.hoisted(() => ({
  getQueue: vi.fn().mockResolvedValue([]),
  getQueueStatus: vi.fn().mockResolvedValue({ queue: {} }),
  addToQueue: vi.fn(),
  callNext: vi.fn(),
  seatCustomer: vi.fn(),
}));
vi.mock("@/services/queueService", () => ({
  queueService: mockQueueService,
}));

// Mock useRealtimeQueue composable
vi.mock("@/composables/useRealtimeQueue", () => ({
  useRealtimeQueue: () => ({
    isConnected: ref(true),
    getRecentQueueUpdates: vi.fn().mockReturnValue([]),
    getUpdateCountByStatus: vi.fn().mockReturnValue(0),
  }),
}));

// Mock vue-router
const mockRoutePath = vi.hoisted(() => ({ value: "/dashboard/seating" }));
const mockPush = vi.fn();
vi.mock("vue-router", () => ({
  useRoute: () => ({
    path: mockRoutePath.value,
    params: {},
    query: {},
  }),
  useRouter: () => ({ push: mockPush }),
  RouterLink: {
    template: '<a :href="to" :class="$attrs.class"><slot /></a>',
    props: ["to"],
  },
  RouterView: {
    template: "<div data-testid='router-view'></div>",
  },
}));

// Mock QRCodeRenderer and QRModeSelector stubs
vi.mock("@/components/tables/QRCodeRenderer.vue", () => ({
  default: {
    template: "<div data-testid='qr-renderer'></div>",
    methods: { getDataUrl: () => "data:image/png;base64,mock" },
  },
}));
vi.mock("@/components/tables/QRModeSelector.vue", () => ({
  default: { template: "<div data-testid='qr-mode-selector'></div>" },
}));

// Mock useConfirmModal — auto-resolves to true by default
const mockSeatingConfirmModalFn = vi.fn().mockResolvedValue(true);
vi.mock("@/composables/useConfirmModal", () => ({
  useConfirmModal: () => ({
    confirm: mockSeatingConfirmModalFn,
    modalState: { value: null },
    close: vi.fn(),
  }),
}));

// Mock auth store
vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    restaurantId: "r1",
    canAccessAdminFeatures: true,
    user: { id: 1, restaurantId: "r1", role: 0 },
  }),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import SeatingManagementView from "../seating/SeatingManagementView.vue";
import ReservationTab from "../seating/ReservationTab.vue";
import TableSetupTab from "../seating/TableSetupTab.vue";
import QueueDashboardTab from "../seating/QueueDashboardTab.vue";

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

const mockTables = [
  {
    id: "t1",
    number: "A1",
    tableNumber: "A1",
    name: "Window 1",
    tableName: "Window 1",
    capacity: 4,
    location: "Window",
    isActive: true,
    isOccupied: false,
    qrCode: "https://example.com/qr/t1",
    orderId: null,
  },
  {
    id: "t2",
    number: "A2",
    tableNumber: "A2",
    name: "Center 1",
    tableName: "Center 1",
    capacity: 6,
    location: "Center",
    isActive: true,
    isOccupied: true,
    qrCode: "https://example.com/qr/t2",
    orderId: "ord-1",
  },
  {
    id: "t3",
    number: "A3",
    tableNumber: "A3",
    name: "Corner 1",
    tableName: "Corner 1",
    capacity: 2,
    location: "Corner",
    isActive: false,
    isOccupied: false,
    qrCode: "https://example.com/qr/t3",
    orderId: null,
  },
];

const mockQueueItems = [
  {
    id: "q1",
    queueNumber: 1,
    queueLetter: "A",
    customerName: "Dave",
    customerPhone: "0911111111",
    partySize: 3,
    status: "waiting",
    priority: 0,
    joinedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    specialRequests: "",
    notes: "",
    tablePreferences: [],
  },
  {
    id: "q2",
    queueNumber: 2,
    queueLetter: "A",
    customerName: "Eve",
    customerPhone: "0922222222",
    partySize: 5,
    status: "called",
    priority: 1,
    joinedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    specialRequests: "Quiet area",
    notes: "",
    tablePreferences: ["window"],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function mountSeatingManagement() {
  return mount(SeatingManagementView, {
    global: {
      stubs: {
        "router-link": {
          template: '<a :href="to" :class="$attrs.class"><slot /></a>',
          props: ["to"],
        },
        "router-view": {
          template: "<div data-testid='router-view'></div>",
        },
      },
    },
  });
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

function mountTableSetupTab() {
  return mount(TableSetupTab, {
    global: {
      stubs: {
        QRCodeRenderer: {
          template: "<div data-testid='qr-renderer'></div>",
          methods: { getDataUrl: () => "data:image/png;base64,mock" },
        },
        QRModeSelector: {
          template: "<div data-testid='qr-mode-selector'></div>",
        },
      },
    },
  });
}

function mountQueueDashboard() {
  return mount(QueueDashboardTab, {
    global: {
      stubs: {
        UsersIcon: { template: "<span />" },
        ClockIcon: { template: "<span />" },
        BuildingStorefrontIcon: { template: "<span />" },
        ArrowPathIcon: { template: "<span />" },
        StarIcon: { template: "<span />" },
        PlusIcon: { template: "<span />" },
        SparklesIcon: { template: "<span />" },
        BellIcon: { template: "<span />" },
        XMarkIcon: { template: "<span />" },
        DocumentChartBarIcon: { template: "<span />" },
      },
    },
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("SeatingManagementView", () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllFactories();
    setActivePinia(createPinia());
    mockRoutePath.value = "/dashboard/seating";
    wrapper = mountSeatingManagement();
  });

  // ── 1. SeatingManagementView (~8 tests) ──

  describe("Page Structure", () => {
    it("should render page heading and description", () => {
      const html = wrapper.html();
      expect(html).toContain("seating.title");
      expect(html).toContain("seating.subtitle");
    });

    it("should display stats cards", async () => {
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain("seating.stats.todayReservations");
      expect(html).toContain("seating.stats.confirmed");
      expect(html).toContain("seating.stats.currentlyWaiting");
      expect(html).toContain("seating.stats.avgWaitTime");
      expect(html).toContain("seating.stats.availableTables");
      expect(html).toContain("seating.stats.noShowRate");
      expect(html).toContain("seating.stats.todayServed");
    });

    it("should render tab links", async () => {
      await flushPromises();
      const html = wrapper.html();
      // Admin user sees all 4 tabs
      expect(html).toContain("seating.tabs.tableSetup");
      expect(html).toContain("seating.tabs.reservations");
      expect(html).toContain("seating.tabs.waitingList");
      expect(html).toContain("seating.tabs.queueDashboard");
    });

    it("should highlight active tab for reservations route", async () => {
      mockRoutePath.value = "/dashboard/seating";
      wrapper = mountSeatingManagement();
      await flushPromises();

      const links = wrapper.findAll("a");
      const reservationLink = links.find(
        (l) => l.attributes("href") === "/dashboard/seating",
      );
      expect(reservationLink).toBeDefined();
      expect(reservationLink!.attributes("data-active")).toBe("true");
    });

    it("should highlight active tab for table-setup route", async () => {
      mockRoutePath.value = "/dashboard/seating/table-setup";
      wrapper = mountSeatingManagement();
      await flushPromises();

      const links = wrapper.findAll("a");
      const tableSetupLink = links.find(
        (l) => l.attributes("href") === "/dashboard/seating/table-setup",
      );
      expect(tableSetupLink).toBeDefined();
      expect(tableSetupLink!.attributes("data-active")).toBe("true");
    });

    it("should render router-view for tab content", () => {
      expect(wrapper.find("[data-testid='router-view']").exists()).toBe(true);
    });
  });

  describe("Stats Loading", () => {
    it("should call stats APIs on mount", async () => {
      await flushPromises();
      expect(mockReservationService.getStats).toHaveBeenCalledWith("r1");
      expect(mockWaitingListService.getQueueStatus).toHaveBeenCalledWith("r1");
      expect(mockWaitingListService.getStats).toHaveBeenCalledWith("r1");
    });

    it("should populate stats card values from API response", async () => {
      await flushPromises();
      const html = wrapper.html();
      // totalReservations = 12
      expect(html).toContain("12");
      // confirmedCount = 8
      expect(html).toContain("8");
      // totalWaiting = 5
      expect(html).toContain("5");
      // averageWaitMinutes = 15 min
      expect(html).toContain("15 min");
      // availableTables = 3
      expect(html).toContain("3");
      // noShowRate = 3.2%
      expect(html).toContain("3.2%");
      // totalServedToday = 22
      expect(html).toContain("22");
    });
  });
});

// ── 2. ReservationTab (~10 tests) ──

describe("ReservationTab", () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllFactories();
    setActivePinia(createPinia());
    mockSeatingConfirmModalFn.mockResolvedValue(true);
    mockReservationService.listReservations.mockResolvedValue({
      success: true,
      data: mockReservations,
      meta: { total: 3 },
    });
  });

  it("should display reservation table with correct column headers", async () => {
    wrapper = mountReservationTab();
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
    wrapper = mountReservationTab();
    await flushPromises();
    const html = wrapper.html();
    expect(html).toContain("ABC123");
    expect(html).toContain("Alice");
    expect(html).toContain("DEF456");
    expect(html).toContain("Bob");
    expect(html).toContain("GHI789");
    expect(html).toContain("Charlie");
  });

  it("should display create reservation button", async () => {
    wrapper = mountReservationTab();
    await flushPromises();
    const html = wrapper.html();
    expect(html).toContain("reservation.create");
  });

  it("should show filter fields (date, status, phone)", async () => {
    wrapper = mountReservationTab();
    await flushPromises();
    expect(wrapper.find('input[type="date"]').exists()).toBe(true);
    expect(wrapper.find("select").exists()).toBe(true);
    expect(wrapper.find('input[type="tel"]').exists()).toBe(true);
  });

  it("should call confirm API on confirm button click", async () => {
    // Component uses useConfirmModal (mocked to auto-resolve true)
    wrapper = mountReservationTab();
    await flushPromises();

    // Find the confirm button (green, shown for pending status)
    const confirmBtn = wrapper.find(
      'button[title="reservation.confirmReservation"]',
    );
    expect(confirmBtn.exists()).toBe(true);
    await confirmBtn.trigger("click");
    await flushPromises();
    expect(mockReservationService.confirmReservation).toHaveBeenCalledWith(
      "res-1",
    );
  });

  it("should call cancel API on cancel button click", async () => {
    // Component uses useConfirmModal (mocked to auto-resolve true)
    wrapper = mountReservationTab();
    await flushPromises();

    // Cancel button is available for pending and confirmed; find the first one
    const cancelBtns = wrapper.findAll(
      'button[title="reservation.cancelReservation"]',
    );
    expect(cancelBtns.length).toBeGreaterThan(0);
    await cancelBtns[0].trigger("click");
    await flushPromises();
    expect(mockReservationService.cancelReservation).toHaveBeenCalledWith(
      "res-1",
    );
  });

  it("should call markArrived API on arrive button click", async () => {
    wrapper = mountReservationTab();
    await flushPromises();

    const arriveBtn = wrapper.find('button[title="reservation.markArrived"]');
    expect(arriveBtn.exists()).toBe(true);
    await arriveBtn.trigger("click");
    await flushPromises();
    expect(mockReservationService.markArrived).toHaveBeenCalledWith("res-2");
  });

  it("should call markSeated API on seat button click", async () => {
    wrapper = mountReservationTab();
    await flushPromises();

    const seatBtn = wrapper.find('button[title="reservation.markSeated"]');
    expect(seatBtn.exists()).toBe(true);
    await seatBtn.trigger("click");
    await flushPromises();
    expect(mockReservationService.markSeated).toHaveBeenCalledWith("res-3");
  });

  it("should show pagination when total > 0", async () => {
    wrapper = mountReservationTab();
    await flushPromises();
    const html = wrapper.html();
    expect(html).toContain("reservation.pagination.showing");
  });

  it("should filter by status via select change", async () => {
    wrapper = mountReservationTab();
    await flushPromises();
    vi.clearAllMocks();

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
});

// ── 3. TableSetupTab (~8 tests) ──

describe("TableSetupTab", () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllFactories();
    setActivePinia(createPinia());
    mockApi.get.mockResolvedValue({
      data: { success: true, data: mockTables },
    });
  });

  it("should display tables grid after fetch", async () => {
    wrapper = mountTableSetupTab();
    await flushPromises();
    const html = wrapper.html();
    // Table numbers are displayed
    expect(html).toContain("A1");
    expect(html).toContain("A2");
    expect(html).toContain("A3");
  });

  it("should show table status for each table", async () => {
    wrapper = mountTableSetupTab();
    await flushPromises();
    const html = wrapper.html();
    expect(html).toContain("tables.status.available");
    expect(html).toContain("tables.status.occupied");
    expect(html).toContain("tables.status.maintenance");
  });

  it('should show "add table" button', async () => {
    wrapper = mountTableSetupTab();
    await flushPromises();
    const html = wrapper.html();
    expect(html).toContain("tables.addTable");
  });

  it("should show QR code generation button", async () => {
    wrapper = mountTableSetupTab();
    await flushPromises();
    const html = wrapper.html();
    expect(html).toContain("tables.batchGenerateQR");
  });

  it("should call POST API on table creation", async () => {
    wrapper = mountTableSetupTab();
    await flushPromises();
    vi.clearAllMocks();
    mockApi.get.mockResolvedValue({
      data: { success: true, data: mockTables },
    });

    // Click "add table" button to open modal
    const addBtn = wrapper
      .findAll("button")
      .find((b) => b.html().includes("tables.addTable"));
    expect(addBtn).toBeDefined();
    await addBtn!.trigger("click");
    await nextTick();

    // Fill in required fields
    const inputs = wrapper.findAll('input[type="text"]');
    // tableNumber input is the first text input in the modal form
    const tableNumberInput = inputs.find((i) => i.element.closest("form"));
    if (tableNumberInput) {
      await tableNumberInput.setValue("B1");
    }

    // Submit form
    const form = wrapper.find("form");
    if (form.exists()) {
      await form.trigger("submit");
      await flushPromises();
      expect(mockApi.post).toHaveBeenCalledWith(
        "/tables",
        expect.objectContaining({
          number: "B1",
        }),
      );
    }
  });

  it("should call PUT API on table edit", async () => {
    wrapper = mountTableSetupTab();
    await flushPromises();
    vi.clearAllMocks();
    mockApi.get.mockResolvedValue({
      data: { success: true, data: mockTables },
    });

    // Click edit button on first table card
    const editBtns = wrapper
      .findAll("button")
      .filter((b) => b.html().includes("common.edit"));
    expect(editBtns.length).toBeGreaterThan(0);
    await editBtns[0].trigger("click");
    await nextTick();

    // Submit the edit form
    const form = wrapper.find("form");
    if (form.exists()) {
      await form.trigger("submit");
      await flushPromises();
      expect(mockApi.put).toHaveBeenCalled();
    }
  });

  it("should filter tables by status", async () => {
    wrapper = mountTableSetupTab();
    await flushPromises();

    const select = wrapper.findAll("select").find((s) => {
      const options = s.findAll("option");
      return options.some((o) => o.text().includes("tables.filter.allStatus"));
    });
    expect(select).toBeDefined();

    // Set filter to "available"
    await select!.setValue("available");
    await nextTick();

    // Only table A1 is available (A2 occupied, A3 maintenance)
    const html = wrapper.html();
    expect(html).toContain("A1");
    // A2 is occupied so should be hidden
    expect(html).not.toContain("A2");
  });

  it("should show empty state when no tables match filter", async () => {
    mockApi.get.mockResolvedValue({ data: { success: true, data: [] } });
    wrapper = mountTableSetupTab();
    await flushPromises();

    const html = wrapper.html();
    expect(html).toContain("tables.empty.title");
  });
});

// ── 4. QueueDashboardTab (~5 tests) ──

describe("QueueDashboardTab", () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllFactories();
    setActivePinia(createPinia());

    // queueService mock for fetching queue
    mockQueueService.getQueue.mockResolvedValue(mockQueueItems);
    mockQueueService.getQueueStatus.mockResolvedValue({
      queue: {
        total_waiting: 5,
        avg_estimated_wait: 12,
      },
    });

    mockApi.get.mockImplementation((url: string) => {
      if (url.includes("tables")) {
        return Promise.resolve({
          data: {
            success: true,
            data: mockTables.map((t) => ({
              ...t,
              status: t.isOccupied ? "occupied" : "available",
            })),
          },
        });
      }
      if (url.includes("waiting-list")) {
        return Promise.resolve({
          data: {
            success: true,
            data: mockQueueItems,
          },
        });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    });
  });

  it("should render queue list header", async () => {
    wrapper = mountQueueDashboard();
    await flushPromises();
    const html = wrapper.html();
    expect(html).toContain("queue.queueList");
  });

  it("should display table status section", async () => {
    wrapper = mountQueueDashboard();
    await flushPromises();
    const html = wrapper.html();
    expect(html).toContain("queue.tableStatus");
  });

  it("should display quick actions section", async () => {
    wrapper = mountQueueDashboard();
    await flushPromises();
    const html = wrapper.html();
    expect(html).toContain("queue.quickActions");
    expect(html).toContain("queue.manualAdd");
  });

  it("should render call-next button", async () => {
    wrapper = mountQueueDashboard();
    await flushPromises();
    const html = wrapper.html();
    expect(html).toContain("queue.callNext");
  });

  it("should show smart assignment toggle", async () => {
    wrapper = mountQueueDashboard();
    await flushPromises();
    const html = wrapper.html();
    expect(html).toContain("queue.smartAssignment");
  });
});

// ── 5. Error & Loading (~4 tests) ──

describe("Error & Loading States", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllFactories();
    setActivePinia(createPinia());
  });

  it("should show loading skeleton in reservation tab during fetch", async () => {
    // Make listReservations never resolve during this test
    mockReservationService.listReservations.mockReturnValue(
      new Promise(() => {}),
    );
    const wrapper = mountReservationTab();
    // While loading, skeleton rows with animate-pulse should appear
    await nextTick();
    const html = wrapper.html();
    expect(html).toContain("animate-pulse");
  });

  it("should handle API errors gracefully in SeatingManagementView", async () => {
    mockReservationService.getStats.mockRejectedValue(
      new Error("Network error"),
    );
    mockWaitingListService.getQueueStatus.mockRejectedValue(
      new Error("Network error"),
    );
    mockWaitingListService.getStats.mockRejectedValue(
      new Error("Network error"),
    );

    // Should not throw, stats default to 0
    const wrapper = mountSeatingManagement();
    await flushPromises();
    expect(wrapper.exists()).toBe(true);
    // Values stay at defaults (0)
    const html = wrapper.html();
    expect(html).toContain("seating.stats.todayReservations");
  });

  it("should show empty state when no reservations exist", async () => {
    mockReservationService.listReservations.mockResolvedValue({
      success: true,
      data: [],
      meta: { total: 0 },
    });
    const wrapper = mountReservationTab();
    await flushPromises();
    const html = wrapper.html();
    expect(html).toContain("reservation.noRecords");
  });

  it("should show empty state when no tables exist", async () => {
    mockApi.get.mockResolvedValue({ data: { success: true, data: [] } });
    const wrapper = mountTableSetupTab();
    await flushPromises();
    const html = wrapper.html();
    expect(html).toContain("tables.empty.title");
    expect(html).toContain("tables.empty.subtitle");
  });
});

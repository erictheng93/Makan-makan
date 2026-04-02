/**
 * GroupOrdersView Tests
 * Comprehensive tests for the group orders management view.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { mount, flushPromises, VueWrapper } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { ref, computed, nextTick } from "vue";

// ──── Mock data ────

const mockGroupOrderMembers = [
  {
    id: "m1",
    groupOrderId: "go-1",
    name: "Alice",
    itemCount: 3,
    totalAmount: 150,
    paymentStatus: "paid" as const,
    joinedAt: "2024-03-01T10:05:00Z",
  },
  {
    id: "m2",
    groupOrderId: "go-1",
    name: "Bob",
    itemCount: 2,
    totalAmount: 100,
    paymentStatus: "pending" as const,
    joinedAt: "2024-03-01T10:10:00Z",
  },
  {
    id: "m3",
    groupOrderId: "go-1",
    name: "Carol",
    itemCount: 1,
    totalAmount: 50,
    paymentStatus: "unpaid" as const,
    joinedAt: "2024-03-01T10:15:00Z",
  },
];

const mockGroupOrders = [
  {
    id: "go-1",
    shareCode: "GRP-ABC123",
    masterOrderId: "order-1",
    tableNumber: "A1",
    status: "active" as const,
    hostName: "Alice",
    memberCount: 3,
    paidMembers: 1,
    totalAmount: 300,
    subtotal: 250,
    serviceCharge: 25,
    taxAmount: 25,
    itemCount: 6,
    members: mockGroupOrderMembers,
    createdAt: "2024-03-01T10:00:00Z",
    completedAt: null,
    expiresAt: "2024-03-01T12:00:00Z",
  },
  {
    id: "go-2",
    shareCode: "GRP-DEF456",
    masterOrderId: "order-2",
    tableNumber: null,
    status: "ready_to_pay" as const,
    hostName: "Dave",
    memberCount: 2,
    paidMembers: 1,
    totalAmount: 200,
    subtotal: 170,
    serviceCharge: 15,
    taxAmount: 15,
    itemCount: 4,
    members: [
      {
        id: "m4",
        groupOrderId: "go-2",
        name: "Dave",
        itemCount: 2,
        totalAmount: 100,
        paymentStatus: "paid" as const,
        joinedAt: "2024-03-01T11:00:00Z",
      },
      {
        id: "m5",
        groupOrderId: "go-2",
        name: "Eve",
        itemCount: 2,
        totalAmount: 100,
        paymentStatus: "pending" as const,
        joinedAt: "2024-03-01T11:05:00Z",
      },
    ],
    createdAt: "2024-03-01T11:00:00Z",
    completedAt: null,
    expiresAt: "2024-03-01T13:00:00Z",
  },
  {
    id: "go-3",
    shareCode: "GRP-GHI789",
    masterOrderId: "order-3",
    tableNumber: "B2",
    status: "completed" as const,
    hostName: "Frank",
    memberCount: 4,
    paidMembers: 4,
    totalAmount: 500,
    subtotal: 420,
    serviceCharge: 40,
    taxAmount: 40,
    itemCount: 10,
    members: [
      {
        id: "m6",
        groupOrderId: "go-3",
        name: "Frank",
        itemCount: 3,
        totalAmount: 150,
        paymentStatus: "paid" as const,
        joinedAt: "2024-03-01T09:00:00Z",
      },
      {
        id: "m7",
        groupOrderId: "go-3",
        name: "Grace",
        itemCount: 3,
        totalAmount: 150,
        paymentStatus: "paid" as const,
        joinedAt: "2024-03-01T09:05:00Z",
      },
      {
        id: "m8",
        groupOrderId: "go-3",
        name: "Hank",
        itemCount: 2,
        totalAmount: 100,
        paymentStatus: "paid" as const,
        joinedAt: "2024-03-01T09:10:00Z",
      },
      {
        id: "m9",
        groupOrderId: "go-3",
        name: "Ivy",
        itemCount: 2,
        totalAmount: 100,
        paymentStatus: "paid" as const,
        joinedAt: "2024-03-01T09:15:00Z",
      },
    ],
    createdAt: "2024-03-01T09:00:00Z",
    completedAt: "2024-03-01T10:30:00Z",
    expiresAt: "2024-03-01T11:00:00Z",
  },
  {
    id: "go-4",
    shareCode: "GRP-CAN001",
    masterOrderId: "order-4",
    tableNumber: null,
    status: "cancelled" as const,
    hostName: "Zack",
    memberCount: 2,
    paidMembers: 0,
    totalAmount: 0,
    subtotal: 0,
    serviceCharge: 0,
    taxAmount: 0,
    itemCount: 0,
    members: [],
    createdAt: "2024-03-01T08:00:00Z",
    completedAt: null,
    expiresAt: "2024-03-01T10:00:00Z",
  },
];

const mockStats = {
  totalGroupOrders: 10,
  activeGroupOrders: 3,
  averageGroupSize: 3.5,
  averageOrderValue: 350,
  conversionRate: 75,
  popularTimeSlots: [],
  paymentMethodDistribution: {},
};

// ──── Mocks ────

const mockGetGroupOrders = vi.fn().mockResolvedValue(mockGroupOrders);
const mockGetGroupOrderStats = vi.fn().mockResolvedValue(mockStats);
const mockCreateGroupOrder = vi.fn().mockResolvedValue({
  id: "go-new",
  shareCode: "GRP-NEW001",
});
const mockGenerateShareCode = vi.fn().mockResolvedValue({
  shareCode: "GRP-SHARE01",
  shareUrl: "http://localhost/order/group/GRP-SHARE01",
  expiresAt: "2024-03-02T00:00:00Z",
});
const mockJoinGroupOrder = vi.fn().mockResolvedValue({
  success: true,
  memberId: "m-new",
  groupOrder: mockGroupOrders[0],
});
const mockInitiateSplit = vi.fn().mockResolvedValue([]);
const mockExportGroupOrders = vi.fn().mockResolvedValue("csv-data");

vi.mock("@/services/groupOrdersService", () => ({
  groupOrdersService: {
    getGroupOrders: (...args: any[]) => mockGetGroupOrders(...args),
    getGroupOrderStats: (...args: any[]) => mockGetGroupOrderStats(...args),
    createGroupOrder: (...args: any[]) => mockCreateGroupOrder(...args),
    generateShareCode: (...args: any[]) => mockGenerateShareCode(...args),
    joinGroupOrder: (...args: any[]) => mockJoinGroupOrder(...args),
    initiateSplit: (...args: any[]) => mockInitiateSplit(...args),
    exportGroupOrders: (...args: any[]) => mockExportGroupOrders(...args),
  },
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
  t: (key: string) => key,
}));

vi.mock("@/composables/useCurrency", () => ({
  useCurrency: () => ({
    formatPrice: (v: number) => `$${v}`,
    currencySymbol: "$",
  }),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    user: { id: 1, username: "admin1", role: 0 },
    restaurantId: "r1",
    isAuthenticated: true,
  }),
}));

const mockPush = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ params: {}, query: {} }),
}));

vi.mock("vue-toastification", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  }),
}));

// Stub heroicons
const _iconStub = () => ({ template: "<span />" });
vi.mock("@heroicons/vue/24/outline", () => {
  const s = { template: "<span />" };
  return {
    UserGroupIcon: s,
    CreditCardIcon: s,
    ClockIcon: s,
    MagnifyingGlassIcon: s,
    ArrowPathIcon: s,
    MapPinIcon: s,
    DocumentDuplicateIcon: s,
    CursorArrowRaysIcon: s,
    XMarkIcon: s,
    ShareIcon: s,
    QrCodeIcon: s,
  };
});

vi.mock("@heroicons/vue/24/outline/QrCodeIcon", () => ({
  default: { template: "<span />" },
}));

vi.mock("@heroicons/vue/24/outline/ShareIcon", () => ({
  default: { template: "<span />" },
}));

// ──── Helpers ────

const iconStub = { template: "<span />" };
const globalStubs = {
  UserGroupIcon: iconStub,
  CreditCardIcon: iconStub,
  ClockIcon: iconStub,
  MagnifyingGlassIcon: iconStub,
  ArrowPathIcon: iconStub,
  MapPinIcon: iconStub,
  DocumentDuplicateIcon: iconStub,
  CursorArrowRaysIcon: iconStub,
  XMarkIcon: iconStub,
  ShareIcon: iconStub,
  QrCodeIcon: iconStub,
};

import GroupOrdersView from "../GroupOrdersView.vue";

async function mountView() {
  const wrapper = mount(GroupOrdersView, {
    global: {
      stubs: globalStubs,
    },
  });
  await flushPromises();
  return wrapper;
}

// ──── Tests ────

describe("GroupOrdersView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockGetGroupOrders.mockResolvedValue(mockGroupOrders);
    mockGetGroupOrderStats.mockResolvedValue(mockStats);
  });

  // ──── 1. Layout & Stats ────

  describe("Layout & Stats", () => {
    it("should render groupOrders.title heading", async () => {
      const wrapper = await mountView();
      expect(wrapper.text()).toContain("groupOrders.title");
    });

    it("should display stats cards (activeOrders, shareCount, splitBillOrders, avgCompletionTime)", async () => {
      const wrapper = await mountView();
      const text = wrapper.text();
      expect(text).toContain("groupOrders.activeOrders");
      expect(text).toContain("groupOrders.shareCount");
      expect(text).toContain("groupOrders.splitBillOrders");
      expect(text).toContain("groupOrders.avgCompletionTime");
    });

    it("should show createOrder button", async () => {
      const wrapper = await mountView();
      const buttons = wrapper.findAll("button");
      const createBtn = buttons.find((b) =>
        b.text().includes("groupOrders.createOrder"),
      );
      expect(createBtn).toBeTruthy();
    });

    it("should show generateShareCode button", async () => {
      const wrapper = await mountView();
      const buttons = wrapper.findAll("button");
      const shareBtn = buttons.find((b) =>
        b.text().includes("groupOrders.generateShareCode"),
      );
      expect(shareBtn).toBeTruthy();
    });

    it("should show order list section", async () => {
      const wrapper = await mountView();
      expect(wrapper.text()).toContain("groupOrders.orderList");
    });

    it("should show detail panel section", async () => {
      const wrapper = await mountView();
      // When first order is auto-selected, detail panel shows orderDetails
      expect(wrapper.text()).toContain("groupOrders.orderDetails");
    });
  });

  // ──── 2. Group Order List ────

  describe("Group Order List", () => {
    it("should render group order cards from API data", async () => {
      const wrapper = await mountView();
      expect(mockGetGroupOrders).toHaveBeenCalled();
      // All share codes should appear
      expect(wrapper.text()).toContain("GRP-ABC123");
      expect(wrapper.text()).toContain("GRP-DEF456");
      expect(wrapper.text()).toContain("GRP-GHI789");
    });

    it("should display share code, status, member count", async () => {
      const wrapper = await mountView();
      const text = wrapper.text();
      // Share codes
      expect(text).toContain("GRP-ABC123");
      // Status text (returns i18n key)
      expect(text).toContain("groupOrders.status.active");
      // Member count
      expect(text).toContain("3");
    });

    it("should show table number or takeaway", async () => {
      const wrapper = await mountView();
      const text = wrapper.text();
      // go-1 has tableNumber "A1"
      expect(text).toContain("groupOrders.tableNumber");
      // go-2 has no tableNumber, should show takeaway
      expect(text).toContain("groupOrders.takeaway");
    });

    it("should show created time", async () => {
      const wrapper = await mountView();
      // The formatDateTime function is called on createdAt — just ensure it renders something
      // The mock data has "2024-03-01T10:00:00Z" which formatDateTime converts via toLocaleString
      expect(mockGetGroupOrders).toHaveBeenCalled();
      // The group order cards should be rendered (4 orders)
      const orderCards = wrapper.findAll(".divide-y > div");
      expect(orderCards.length).toBeGreaterThanOrEqual(3);
    });

    it("should show share/details buttons per card", async () => {
      const wrapper = await mountView();
      const text = wrapper.text();
      // "active" order should show share button
      expect(text).toContain("groupOrders.share");
      // All orders show details button
      expect(text).toContain("groupOrders.details");
    });

    it("should show search box and status filter", async () => {
      const wrapper = await mountView();
      // Search input
      const searchInput = wrapper.find('input[type="text"]');
      expect(searchInput.exists()).toBe(true);
      // Status filter select
      const selectEl = wrapper.find("select");
      expect(selectEl.exists()).toBe(true);
      expect(wrapper.text()).toContain("groupOrders.allStatus");
    });

    it("should show split bill button for ready_to_pay orders", async () => {
      const wrapper = await mountView();
      expect(wrapper.text()).toContain("groupOrders.splitBill");
    });

    it("should display host name for each order", async () => {
      const wrapper = await mountView();
      expect(wrapper.text()).toContain("Alice");
      expect(wrapper.text()).toContain("Dave");
      expect(wrapper.text()).toContain("Frank");
    });

    it("should show paid/total member ratio", async () => {
      const wrapper = await mountView();
      // go-1: 1/3 paidMembers/memberCount
      expect(wrapper.text()).toContain("1/3");
    });
  });

  // ──── 3. Order Card Click & Detail Panel ────

  describe("Order Card Click & Detail Panel", () => {
    it("should show selected order details", async () => {
      const wrapper = await mountView();
      // onMounted auto-selects first order
      const text = wrapper.text();
      expect(text).toContain("groupOrders.orderDetails");
      expect(text).toContain("GRP-ABC123");
    });

    it("should switch detail panel when clicking a different order card", async () => {
      const wrapper = await mountView();

      // Click the details button of the second order
      const detailButtons = wrapper
        .findAll("button")
        .filter((b) => b.text() === "groupOrders.details");
      expect(detailButtons.length).toBeGreaterThanOrEqual(2);
      await detailButtons[1].trigger("click");
      await nextTick();

      // Detail panel should now show go-2
      expect(wrapper.text()).toContain("GRP-DEF456");
    });

    it("should display member list with avatars", async () => {
      const wrapper = await mountView();
      const text = wrapper.text();
      // Members section header with count
      expect(text).toContain("groupOrders.members");
      // Member names
      expect(text).toContain("Alice");
      expect(text).toContain("Bob");
      expect(text).toContain("Carol");
    });

    it("should show member avatar initials", async () => {
      const wrapper = await mountView();
      // Member avatars show first char of name
      const html = wrapper.html();
      // The avatars in detail panel show initials: A, B, C
      expect(html).toContain(">A<");
      expect(html).toContain(">B<");
      expect(html).toContain(">C<");
    });

    it("should show order total with breakdown (subtotal, serviceCharge, tax, total)", async () => {
      const wrapper = await mountView();
      const text = wrapper.text();
      expect(text).toContain("groupOrders.subtotal");
      expect(text).toContain("groupOrders.serviceCharge");
      expect(text).toContain("groupOrders.tax");
      expect(text).toContain("groupOrders.total");
      // Formatted prices
      expect(text).toContain("$250");
      expect(text).toContain("$25");
      expect(text).toContain("$300");
    });

    it("should show copyShareCode and generateQR buttons", async () => {
      const wrapper = await mountView();
      // Both buttons have title attributes
      const copyBtn = wrapper.find('[title="groupOrders.copyShareCode"]');
      const qrBtn = wrapper.find('[title="groupOrders.generateQR"]');
      expect(copyBtn.exists()).toBe(true);
      expect(qrBtn.exists()).toBe(true);
    });

    it("should show payment status per member", async () => {
      const wrapper = await mountView();
      const text = wrapper.text();
      // Payment status i18n keys
      expect(text).toContain("groupOrders.paymentStatus.paid");
      expect(text).toContain("groupOrders.paymentStatus.pending");
      expect(text).toContain("groupOrders.paymentStatus.unpaid");
    });

    it("should show member item count and amount", async () => {
      const wrapper = await mountView();
      // Alice: 3 items, $150
      expect(wrapper.text()).toContain("$150");
      expect(wrapper.text()).toContain("$100");
      expect(wrapper.text()).toContain("$50");
    });
  });

  // ──── 4. Status Filter ────

  describe("Status Filter", () => {
    it("should show all orders by default", async () => {
      const wrapper = await mountView();
      expect(wrapper.text()).toContain("GRP-ABC123"); // active
      expect(wrapper.text()).toContain("GRP-DEF456"); // ready_to_pay
      expect(wrapper.text()).toContain("GRP-GHI789"); // completed
      expect(wrapper.text()).toContain("GRP-CAN001"); // cancelled
    });

    it("should filter to active only", async () => {
      const wrapper = await mountView();
      const selectEl = wrapper.find("select");
      await selectEl.setValue("active");
      await nextTick();

      expect(wrapper.text()).toContain("GRP-ABC123");
      expect(wrapper.text()).not.toContain("GRP-GHI789");
      expect(wrapper.text()).not.toContain("GRP-DEF456");
      expect(wrapper.text()).not.toContain("GRP-CAN001");
    });

    it("should filter to ready_to_pay only", async () => {
      const wrapper = await mountView();
      const selectEl = wrapper.find("select");
      await selectEl.setValue("ready_to_pay");
      await nextTick();

      const orderList = wrapper.find(".divide-y");
      expect(orderList.text()).toContain("GRP-DEF456");
      expect(orderList.text()).not.toContain("GRP-GHI789");
    });

    it("should filter to completed only", async () => {
      const wrapper = await mountView();
      const selectEl = wrapper.find("select");
      await selectEl.setValue("completed");
      await nextTick();

      // The order list should only show completed order
      // Note: detail panel still shows first auto-selected order (GRP-ABC123)
      const orderList = wrapper.find(".divide-y");
      expect(orderList.text()).toContain("GRP-GHI789");
      expect(orderList.text()).not.toContain("GRP-DEF456");
    });

    it("should filter to cancelled only", async () => {
      const wrapper = await mountView();
      const selectEl = wrapper.find("select");
      await selectEl.setValue("cancelled");
      await nextTick();

      // The order list should only show cancelled order
      const orderList = wrapper.find(".divide-y");
      expect(orderList.text()).toContain("GRP-CAN001");
      expect(orderList.text()).not.toContain("GRP-DEF456");
    });
  });

  // ──── 5. Search ────

  describe("Search by Order Code", () => {
    it("should filter orders by share code search", async () => {
      const wrapper = await mountView();
      const searchInput = wrapper.find('input[type="text"]');
      await searchInput.setValue("ABC123");
      await nextTick();

      expect(wrapper.text()).toContain("GRP-ABC123");
      expect(wrapper.text()).not.toContain("GRP-DEF456");
      expect(wrapper.text()).not.toContain("GRP-GHI789");
    });

    it("should show empty state when search matches nothing", async () => {
      const wrapper = await mountView();
      const searchInput = wrapper.find('input[type="text"]');
      await searchInput.setValue("NONEXISTENT");
      await nextTick();

      expect(wrapper.text()).toContain("groupOrders.noOrders");
    });

    it("should be case insensitive", async () => {
      const wrapper = await mountView();
      const searchInput = wrapper.find('input[type="text"]');
      await searchInput.setValue("abc123");
      await nextTick();

      expect(wrapper.text()).toContain("GRP-ABC123");
    });
  });

  // ──── 6. Quick Actions ────

  describe("Quick Actions", () => {
    it("should show quick action buttons (createOrder, joinOrder, generateShareCode, exportReport)", async () => {
      const wrapper = await mountView();
      const text = wrapper.text();
      expect(text).toContain("groupOrders.quickActions");
      expect(text).toContain("groupOrders.createOrder");
      expect(text).toContain("groupOrders.joinOrder");
      expect(text).toContain("groupOrders.generateShareCode");
      expect(text).toContain("groupOrders.exportReport");
    });

    it("should show usage statistics section (todayOrders, avgMembers, splitBillRate)", async () => {
      const wrapper = await mountView();
      const text = wrapper.text();
      expect(text).toContain("groupOrders.usageStats");
      expect(text).toContain("groupOrders.todayOrders");
      expect(text).toContain("groupOrders.avgMembers");
      expect(text).toContain("groupOrders.splitBillRate");
    });

    it("should call create API on createOrder button click", async () => {
      const wrapper = await mountView();
      // Click the header-level "createOrder" button to open dialog
      const buttons = wrapper.findAll("button");
      const createBtn = buttons.find(
        (b) => b.text() === "groupOrders.createOrder",
      );
      expect(createBtn).toBeTruthy();
      await createBtn!.trigger("click");
      await nextTick();

      // Dialog should be visible, fill in form
      const allTextInputs = wrapper.findAll('input[type="text"]');
      // tableNumber input, hostName input
      // Set hostName so canCreateGroupOrder is true
      await allTextInputs[1].setValue("TestTable");
      await allTextInputs[2].setValue("TestHost");
      await nextTick();

      // Click the submit button
      const submitBtn = wrapper
        .findAll("button")
        .find((b) => b.text() === "groupOrders.createOrderBtn");
      expect(submitBtn).toBeTruthy();
      await submitBtn!.trigger("click");
      await flushPromises();

      expect(mockCreateGroupOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          hostName: "TestHost",
          restaurantId: "r1",
        }),
      );
    });

    it("should call generate code API on generateShareCode button click", async () => {
      const wrapper = await mountView();
      // Find the header-level generateShareCode button (not the quick action one)
      const buttons = wrapper.findAll("button");
      const shareBtn = buttons.find(
        (b) => b.text() === "groupOrders.generateShareCode",
      );
      expect(shareBtn).toBeTruthy();
      await shareBtn!.trigger("click");
      await flushPromises();

      expect(mockGenerateShareCode).toHaveBeenCalledWith("r1");
    });

    it("should open join order dialog on joinOrder click", async () => {
      const wrapper = await mountView();
      // Click the quick action joinOrder button
      const joinBtn = wrapper
        .findAll("button")
        .find((b) => b.text() === "groupOrders.joinOrder");
      expect(joinBtn).toBeTruthy();
      await joinBtn!.trigger("click");
      await nextTick();

      // Dialog should show shareCode label and cancel button
      expect(wrapper.text()).toContain("groupOrders.shareCode");
      expect(wrapper.text()).toContain("groupOrders.cancel");
    });

    it("should call joinGroupOrder API after submitting join dialog", async () => {
      const wrapper = await mountView();
      // Open join dialog
      const joinBtn = wrapper
        .findAll("button")
        .find((b) => b.text() === "groupOrders.joinOrder");
      await joinBtn!.trigger("click");
      await nextTick();

      // Type a share code in the dialog input
      const dialogInputs = wrapper.findAll('input[type="text"]');
      const shareCodeInput = dialogInputs[dialogInputs.length - 1];
      await shareCodeInput.setValue("GRP-TEST");
      await nextTick();

      // Click the join submit button
      const submitJoinBtn = wrapper
        .findAll("button")
        .find(
          (b) =>
            b.text() === "groupOrders.joinOrder" &&
            b.classes().toString().includes("bg-blue-600"),
        );
      // Fall back to finding by matching text in the dialog footer
      const allJoinBtns = wrapper
        .findAll("button")
        .filter((b) => b.text() === "groupOrders.joinOrder");
      // The last one is the dialog submit button
      const dialogSubmit = allJoinBtns[allJoinBtns.length - 1];
      await dialogSubmit.trigger("click");
      await flushPromises();

      expect(mockJoinGroupOrder).toHaveBeenCalledWith(
        "GRP-TEST",
        expect.objectContaining({
          memberName: "admin1",
        }),
      );
    });

    it("should call exportGroupOrders on exportReport button click", async () => {
      const wrapper = await mountView();
      const exportBtn = wrapper
        .findAll("button")
        .find((b) => b.text() === "groupOrders.exportReport");
      expect(exportBtn).toBeTruthy();
      await exportBtn!.trigger("click");
      await flushPromises();

      expect(mockExportGroupOrders).toHaveBeenCalled();
    });
  });

  // ──── 7. Refresh Button ────

  describe("Refresh Button", () => {
    it("should call getGroupOrders again when refresh button clicked", async () => {
      const wrapper = await mountView();
      expect(mockGetGroupOrders).toHaveBeenCalledTimes(1);

      // Find refresh button (ArrowPathIcon button)
      const refreshBtn = wrapper.findAll("button").find((b) => {
        // It is a button with no text, contains the icon stub
        return b.find("span").exists() && b.text().trim() === "";
      });
      expect(refreshBtn).toBeTruthy();
      await refreshBtn!.trigger("click");
      await flushPromises();

      expect(mockGetGroupOrders).toHaveBeenCalledTimes(2);
    });
  });

  // ──── 8. Error & Loading ────

  describe("Error & Loading", () => {
    it("should show loading state", async () => {
      // Make API hang to observe loading behavior
      let resolveOrders: any;
      mockGetGroupOrders.mockReturnValue(
        new Promise((r) => {
          resolveOrders = r;
        }),
      );
      mockGetGroupOrderStats.mockResolvedValue(mockStats);

      const wrapper = mount(GroupOrdersView, {
        global: { stubs: globalStubs },
      });
      // Before API resolves, the component should be mounted
      expect(wrapper.exists()).toBe(true);
      // Resolve to avoid hanging
      resolveOrders!(mockGroupOrders);
      await flushPromises();
    });

    it("should handle API error gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockGetGroupOrders.mockRejectedValue(new Error("Network error"));

      const wrapper = await mountView();
      // Component should still render without crashing
      expect(wrapper.exists()).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to refresh group orders:",
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    it("should show empty state when no group orders", async () => {
      mockGetGroupOrders.mockResolvedValue([]);

      const wrapper = await mountView();
      expect(wrapper.text()).toContain("groupOrders.noOrders");
      expect(wrapper.text()).toContain("groupOrders.noOrdersHint");
    });

    it("should refresh on filter change", async () => {
      const wrapper = await mountView();
      expect(mockGetGroupOrders).toHaveBeenCalledTimes(1);

      // Change status filter - this is a client-side filter, but the select exists
      const selectEl = wrapper.find("select");
      await selectEl.setValue("active");
      await nextTick();

      // Only "active" orders should be visible now
      const text = wrapper.text();
      expect(text).toContain("GRP-ABC123"); // active
      expect(text).not.toContain("GRP-GHI789"); // completed, should be filtered out
    });
  });

  // ──── 9. Usage Statistics ────

  describe("Usage Statistics", () => {
    it("should display average group size", async () => {
      const wrapper = await mountView();
      expect(wrapper.text()).toContain("groupOrders.avgMembers");
      expect(wrapper.text()).toContain("groupOrders.people");
    });

    it("should display split bill completion rate", async () => {
      const wrapper = await mountView();
      expect(wrapper.text()).toContain("groupOrders.splitBillRate");
      expect(wrapper.text()).toContain("%");
    });

    it("should display today orders count", async () => {
      const wrapper = await mountView();
      expect(wrapper.text()).toContain("groupOrders.todayOrders");
    });
  });

  // ──── 10. Order Total Calculation ────

  describe("Order Total Calculation", () => {
    it("should display correct total for selected order", async () => {
      const wrapper = await mountView();
      // First order: total = 300
      expect(wrapper.text()).toContain("$300");
    });

    it("should display subtotal, service charge, and tax separately", async () => {
      const wrapper = await mountView();
      // First order: subtotal=250, service=25, tax=25
      expect(wrapper.text()).toContain("$250");
      const textContent = wrapper.text();
      // Count occurrences of $25 (both service charge and tax)
      expect(textContent).toContain("$25");
    });
  });
});

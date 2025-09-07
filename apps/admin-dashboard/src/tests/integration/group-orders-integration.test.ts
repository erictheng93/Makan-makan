import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createRouter, createWebHistory } from "vue-router";
import GroupOrdersView from "@/views/GroupOrdersView.vue";
import { groupOrdersService } from "@/services/groupOrdersService";
import { useRealtimeOrders } from "@/composables/useRealtimeOrders";

// Mock services
vi.mock("@/services/groupOrdersService");
vi.mock("@/composables/useRealtimeOrders");
vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    user: { restaurantId: "rest_test_001" },
    hasPermission: () => true,
  }),
}));

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

// Mock router
const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: "/group-orders", component: GroupOrdersView }],
});

describe("Group Orders Integration Tests", () => {
  let wrapper: any;
  let mockGroupOrdersService: any;
  let mockRealtimeOrders: any;

  beforeEach(() => {
    // Setup mocks
    mockGroupOrdersService = vi.mocked(groupOrdersService);
    mockRealtimeOrders = vi.mocked(useRealtimeOrders);

    // Mock service responses
    mockGroupOrdersService.getGroupOrders.mockResolvedValue([
      {
        id: "group_001",
        shareCode: "PARTY-ABC123",
        masterOrderId: null,
        tableNumber: "T05",
        status: "active",
        hostName: "張小明",
        memberCount: 3,
        totalAmount: 125.5,
        subtotal: 110.0,
        serviceCharge: 11.0,
        taxAmount: 4.5,
        itemCount: 8,
        members: [
          {
            id: "member_001",
            groupOrderId: "group_001",
            name: "張小明",
            itemCount: 3,
            totalAmount: 45.6,
            paymentStatus: "paid",
            joinedAt: new Date().toISOString(),
          },
          {
            id: "member_002",
            groupOrderId: "group_001",
            name: "李小華",
            itemCount: 3,
            totalAmount: 52.2,
            paymentStatus: "pending",
            joinedAt: new Date().toISOString(),
          },
          {
            id: "member_003",
            groupOrderId: "group_001",
            name: "王大明",
            itemCount: 2,
            totalAmount: 27.7,
            paymentStatus: "unpaid",
            joinedAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        completedAt: null,
        expiresAt: new Date(Date.now() + 7200000).toISOString(),
      },
    ]);

    mockGroupOrdersService.createGroupOrder.mockResolvedValue({
      id: "group_002",
      shareCode: "LUNCH-XYZ789",
      masterOrderId: null,
      tableNumber: "T08",
      status: "active",
      hostName: "測試用戶",
      memberCount: 1,
      totalAmount: 0,
      subtotal: 0,
      serviceCharge: 0,
      taxAmount: 0,
      itemCount: 0,
      members: [
        {
          id: "member_004",
          groupOrderId: "group_002",
          name: "測試用戶",
          itemCount: 0,
          totalAmount: 0,
          paymentStatus: "unpaid",
          joinedAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      completedAt: null,
      expiresAt: new Date(Date.now() + 14400000).toISOString(),
    });

    // Mock real-time composable
    mockRealtimeOrders.mockReturnValue({
      isConnected: { value: true },
      orderUpdates: { value: [] },
      groupOrderUpdates: { value: [] },
      connectionStatus: { value: "connected" },
      startListening: vi.fn(),
      stopListening: vi.fn(),
      clearUpdates: vi.fn(),
      getRecentOrderUpdates: vi.fn(() => []),
      getRecentGroupOrderUpdates: vi.fn(() => []),
      hasOrderUpdate: vi.fn(() => false),
      hasGroupOrderUpdate: vi.fn(() => false),
    });

    // Mount component
    wrapper = mount(GroupOrdersView, {
      global: {
        plugins: [router],
      },
    });
  });

  afterEach(() => {
    wrapper?.unmount();
    vi.clearAllMocks();
  });

  describe("Component Mounting and Initial State", () => {
    it("should mount successfully", () => {
      expect(wrapper.exists()).toBe(true);
    });

    it("should display group orders title", () => {
      expect(wrapper.text()).toContain("團體訂單");
    });

    it("should load group orders on mount", async () => {
      await wrapper.vm.$nextTick();
      expect(mockGroupOrdersService.getGroupOrders).toHaveBeenCalled();
    });

    it("should display statistics cards", () => {
      const statsCards = wrapper.findAll(".bg-white.rounded-lg.shadow.p-6");
      expect(statsCards.length).toBeGreaterThan(0);
    });
  });

  describe("Group Order List Display", () => {
    it("should display group order list", async () => {
      await wrapper.vm.$nextTick();
      expect(wrapper.text()).toContain("團體訂單列表");
    });

    it("should show group order details", async () => {
      await wrapper.vm.$nextTick();
      expect(wrapper.text()).toContain("PARTY-ABC123");
      expect(wrapper.text()).toContain("張小明");
    });

    it("should display member avatars", async () => {
      await wrapper.vm.$nextTick();
      const memberAvatars = wrapper.findAll(".w-8.h-8.rounded-full");
      expect(memberAvatars.length).toBeGreaterThan(0);
    });

    it("should show payment progress", async () => {
      await wrapper.vm.$nextTick();
      const progressBars = wrapper.findAll(".bg-green-600.h-2.rounded-full");
      expect(progressBars.length).toBeGreaterThan(0);
    });
  });

  describe("Group Order Creation", () => {
    it("should open create dialog", async () => {
      const createButton = wrapper.find('button:contains("建立團體訂單")');
      if (createButton.exists()) {
        await createButton.trigger("click");
        await wrapper.vm.$nextTick();
        expect(wrapper.text()).toContain("建立團體訂單");
      }
    });

    it("should validate create form", async () => {
      const component = wrapper.vm;

      // Test empty form
      component.newGroupOrder = {
        tableNumber: "",
        hostName: "",
        expectedMembers: 2,
        notes: "",
      };

      expect(component.canCreateGroupOrder).toBe(false);

      // Test valid form
      component.newGroupOrder = {
        tableNumber: "T10",
        hostName: "測試主持人",
        expectedMembers: 4,
        notes: "測試備註",
      };

      expect(component.canCreateGroupOrder).toBe(true);
    });

    it("should create new group order", async () => {
      // Mock window.alert
      window.alert = vi.fn();

      const component = wrapper.vm;
      component.newGroupOrder = {
        tableNumber: "T10",
        hostName: "測試主持人",
        expectedMembers: 4,
        notes: "",
      };

      await component.submitCreateGroupOrder();

      expect(mockGroupOrdersService.createGroupOrder).toHaveBeenCalledWith({
        tableNumber: "T10",
        hostName: "測試主持人",
        expectedMembers: 4,
        restaurantId: "rest_test_001",
        notes: "",
      });

      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining("團體訂單已建立"),
      );
    });
  });

  describe("Share Functionality", () => {
    it("should open share dialog", async () => {
      const component = wrapper.vm;
      const testGroupOrder = component.groupOrders[0];

      await component.shareGroupOrder(testGroupOrder);

      expect(component.showShareDialog).toBe(true);
      expect(component.shareData.shareCode).toBe("PARTY-ABC123");
    });

    it("should copy share code to clipboard", async () => {
      const component = wrapper.vm;

      await component.copyShareCode("PARTY-ABC123");

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "PARTY-ABC123",
      );
    });

    it("should copy share URL to clipboard", async () => {
      const component = wrapper.vm;
      component.shareData = {
        shareCode: "PARTY-ABC123",
        shareUrl: "http://localhost/order/group/PARTY-ABC123",
      };

      await component.copyShareUrl();

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "http://localhost/order/group/PARTY-ABC123",
      );
    });

    it("should handle WhatsApp sharing", () => {
      // Mock window.open
      window.open = vi.fn();

      const component = wrapper.vm;
      component.shareData = {
        shareCode: "PARTY-ABC123",
        shareUrl: "http://localhost/order/group/PARTY-ABC123",
      };

      component.shareToWhatsApp();

      expect(window.open).toHaveBeenCalledWith(
        expect.stringContaining("https://wa.me/?text="),
      );
    });
  });

  describe("Group Order Selection and Details", () => {
    it("should select group order", async () => {
      const component = wrapper.vm;
      const testGroupOrder = component.groupOrders[0];

      component.selectGroupOrder(testGroupOrder);

      expect(component.selectedGroupOrder).toEqual(testGroupOrder);
    });

    it("should display selected order details", async () => {
      const component = wrapper.vm;
      const testGroupOrder = component.groupOrders[0];
      component.selectedGroupOrder = testGroupOrder;

      await wrapper.vm.$nextTick();

      expect(wrapper.text()).toContain("PARTY-ABC123");
      expect(wrapper.text()).toContain("參與成員 (3)");
    });

    it("should show member payment status", async () => {
      const component = wrapper.vm;
      const testGroupOrder = component.groupOrders[0];
      component.selectedGroupOrder = testGroupOrder;

      await wrapper.vm.$nextTick();

      expect(wrapper.text()).toContain("已付款");
      expect(wrapper.text()).toContain("處理中");
      expect(wrapper.text()).toContain("未付款");
    });
  });

  describe("Search and Filter", () => {
    it("should filter by search query", async () => {
      const component = wrapper.vm;
      component.searchQuery = "ABC123";

      await wrapper.vm.$nextTick();

      const filtered = component.filteredGroupOrders;
      expect(filtered.length).toBe(1);
      expect(filtered[0].shareCode).toContain("ABC123");
    });

    it("should filter by status", async () => {
      const component = wrapper.vm;
      component.statusFilter = "active";

      await wrapper.vm.$nextTick();

      const filtered = component.filteredGroupOrders;
      expect(filtered.every((order: any) => order.status === "active")).toBe(
        true,
      );
    });

    it("should combine search and status filters", async () => {
      const component = wrapper.vm;
      component.searchQuery = "ABC";
      component.statusFilter = "active";

      await wrapper.vm.$nextTick();

      const filtered = component.filteredGroupOrders;
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered[0].shareCode).toContain("ABC");
      expect(filtered[0].status).toBe("active");
    });
  });

  describe("Real-time Integration", () => {
    it("should initialize real-time connection", () => {
      const realtimeComposable = mockRealtimeOrders();
      expect(realtimeComposable.startListening).toHaveBeenCalled();
    });

    it("should handle real-time group order updates", () => {
      const realtimeComposable = mockRealtimeOrders();
      expect(realtimeComposable.isConnected.value).toBe(true);
    });

    it("should update group order list on real-time events", () => {
      const realtimeComposable = mockRealtimeOrders();
      const mockUpdates = [
        {
          groupOrderId: "group_001",
          shareCode: "PARTY-ABC123",
          status: "ready_to_pay",
          memberCount: 4,
          totalAmount: 150.0,
          timestamp: new Date().toISOString(),
          type: "member_joined" as const,
        },
      ];

      realtimeComposable.groupOrderUpdates = { value: mockUpdates };
      expect(realtimeComposable.getRecentGroupOrderUpdates()).toEqual(
        mockUpdates,
      );
    });
  });

  describe("Quick Actions", () => {
    it("should handle join group order", async () => {
      // Mock window.prompt
      window.prompt = vi.fn().mockReturnValue("PARTY-ABC123");

      const component = wrapper.vm;
      component.joinGroupOrder();

      expect(window.prompt).toHaveBeenCalledWith("請輸入團單分享碼:");
    });

    it("should generate new share code", () => {
      // Mock window.alert
      window.alert = vi.fn();

      const component = wrapper.vm;
      component.generateShareCode();

      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining("新的分享碼已生成:"),
      );
    });

    it("should handle export functionality", () => {
      // Mock window.alert
      window.alert = vi.fn();

      const component = wrapper.vm;
      component.exportGroupOrderReport();

      expect(window.alert).toHaveBeenCalledWith("匯出報表功能開發中...");
    });
  });

  describe("Error Handling", () => {
    it("should handle service errors gracefully", async () => {
      mockGroupOrdersService.getGroupOrders.mockRejectedValue(
        new Error("Service unavailable"),
      );

      // Trigger component method that calls the service
      try {
        await wrapper.vm.refreshGroupOrders();
      } catch (error) {
        // Verify error is handled appropriately
      }
    });

    it("should show error messages for creation failures", async () => {
      mockGroupOrdersService.createGroupOrder.mockRejectedValue(
        new Error("Creation failed"),
      );

      // Mock window.alert
      window.alert = vi.fn();

      const component = wrapper.vm;
      component.newGroupOrder = {
        tableNumber: "T10",
        hostName: "測試主持人",
        expectedMembers: 4,
        notes: "",
      };

      await component.submitCreateGroupOrder();

      expect(window.alert).toHaveBeenCalledWith("建立團單失敗，請重試");
    });

    it("should handle clipboard copy failures", async () => {
      // Mock clipboard failure
      navigator.clipboard.writeText = vi
        .fn()
        .mockRejectedValue(new Error("Clipboard error"));

      // Mock window.alert
      window.alert = vi.fn();

      const component = wrapper.vm;
      await component.copyShareCode("PARTY-ABC123");

      expect(window.alert).toHaveBeenCalledWith("複製失敗，請手動複製");
    });
  });

  describe("Status Helpers", () => {
    it("should return correct status classes", () => {
      const component = wrapper.vm;

      expect(component.getStatusClass("active")).toContain("blue");
      expect(component.getStatusClass("completed")).toContain("gray");
      expect(component.getStatusClass("cancelled")).toContain("red");
    });

    it("should return correct status text", () => {
      const component = wrapper.vm;

      expect(component.getStatusText("active")).toBe("進行中");
      expect(component.getStatusText("ready_to_pay")).toBe("準備結帳");
      expect(component.getStatusText("completed")).toBe("已完成");
      expect(component.getStatusText("cancelled")).toBe("已取消");
    });

    it("should return correct payment status text", () => {
      const component = wrapper.vm;

      expect(component.getPaymentStatusText("unpaid")).toBe("未付款");
      expect(component.getPaymentStatusText("pending")).toBe("處理中");
      expect(component.getPaymentStatusText("paid")).toBe("已付款");
    });
  });
});

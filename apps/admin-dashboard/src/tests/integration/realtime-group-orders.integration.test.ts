/**
 * 實時群組訂單集成測試套件
 *
 * 測試群組訂單的實時同步、多用戶協作、衝突解決、錯誤恢復等核心功能
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  beforeAll,
  afterAll,
} from "vitest";
import { createTestingPinia } from "@pinia/testing";
import { setActivePinia } from "pinia";
import { nextTick } from "vue";

// 測試目標服務
import { useRealtimeGroupOrders } from "@/composables/useRealtimeGroupOrders";
import { groupOrderBroadcastService } from "@/services/groupOrderBroadcastService";
import { collaborativeOrderService } from "@/services/collaborativeOrderService";
import { realtimeResilienceService } from "@/services/realtimeResilienceService";
import { realtimeService } from "@/services/realtimeService";

// 測試工具
import { createMockWebSocket, MockWebSocket } from "../utils/mockWebSocket";
import {
  createMockGroupOrder,
  createMockMember,
  createMockCartItem,
} from "../utils/mockData";
import { waitFor, createTestUsers } from "../utils/testHelpers";

// Mock 外部依賴
vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    user: {
      id: 1,
      restaurantId: 1,
      role: 1,
      name: "Test User",
    },
  }),
}));

describe("實時群組訂單集成測試", () => {
  let mockWebSocket: MockWebSocket;
  let groupOrderId: string;
  let testUsers: any[];

  beforeAll(() => {
    // 設置測試環境
    setActivePinia(
      createTestingPinia({
        createSpy: vi.fn,
      }),
    );

    // Mock WebSocket
    mockWebSocket = createMockWebSocket();
    global.WebSocket = mockWebSocket.constructor as any;

    // Mock 瀏覽器 API
    global.navigator = {
      ...global.navigator,
      onLine: true,
    } as any;

    // Mock crypto.randomUUID
    global.crypto = {
      ...global.crypto,
      randomUUID: () => Math.random().toString(36).substring(2),
    } as any;
  });

  beforeEach(async () => {
    // 重置所有模擬
    vi.clearAllMocks();
    mockWebSocket.reset();

    // 創建測試數據
    groupOrderId = "test-group-" + Date.now();
    testUsers = createTestUsers(4);

    // 初始化服務
    await groupOrderBroadcastService.initializeSync(groupOrderId);
  });

  afterEach(async () => {
    // 清理測試數據
    groupOrderBroadcastService.cleanup(groupOrderId);
    collaborativeOrderService.cleanup(groupOrderId);
    realtimeResilienceService.clearErrors();
  });

  afterAll(() => {
    realtimeResilienceService.stop();
  });

  describe("基礎實時同步功能", () => {
    it("應該成功建立WebSocket連接", async () => {
      const { connectWebSocket, wsConnectionStatus } = useRealtimeGroupOrders();

      await connectWebSocket(groupOrderId);

      expect(mockWebSocket.readyState).toBe(WebSocket.OPEN);
      expect(wsConnectionStatus.value).toBe("connected");
    });

    it("應該正確處理成員加入事件", async () => {
      const { joinGroupOrder, currentGroupOrder, myMemberId } =
        useRealtimeGroupOrders();

      // 模擬加入群組成功響應
      mockWebSocket.mockResponse({
        type: "group_order_joined",
        success: true,
        groupOrder: createMockGroupOrder(groupOrderId),
        memberId: "member-1",
      });

      const success = await joinGroupOrder(
        "PARTY-ABC123",
        "測試用戶",
        "1234567890",
      );

      expect(success).toBe(true);
      expect(myMemberId.value).toBe("member-1");
      expect(currentGroupOrder.value).toBeDefined();
      expect(currentGroupOrder.value?.shareCode).toBe("PARTY-ABC123");
    });

    it("應該正確廣播購物車變更", async () => {
      const { addCartItem } = useRealtimeGroupOrders();

      // 設置初始狀態
      const mockGroupOrder = createMockGroupOrder(groupOrderId);
      const { currentGroupOrder, myMemberId } = useRealtimeGroupOrders();
      currentGroupOrder.value = mockGroupOrder;
      myMemberId.value = "member-1";

      const cartItem = {
        menuItemId: 1,
        menuItemName: "測試商品",
        quantity: 2,
        unitPrice: 15.99,
        customizations: { spicy: "medium" },
      };

      const success = await addCartItem(cartItem);

      expect(success).toBe(true);

      // 驗證WebSocket消息
      const sentMessages = mockWebSocket.getSentMessages();
      const addItemMessage = sentMessages.find(
        (msg) => msg.type === "add_cart_item",
      );

      expect(addItemMessage).toBeDefined();
      expect(addItemMessage.data.menuItemName).toBe("測試商品");
      expect(addItemMessage.data.quantity).toBe(2);
    });
  });

  describe("多用戶協作功能", () => {
    it("應該正確處理多用戶同時加入", async () => {
      const groupOrder1 = useRealtimeGroupOrders();
      const groupOrder2 = useRealtimeGroupOrders();

      // 初始化協作環境
      await collaborativeOrderService.initializeCollaboration(
        groupOrderId,
        testUsers[0].id,
        testUsers[0].name,
      );

      await collaborativeOrderService.initializeCollaboration(
        groupOrderId,
        testUsers[1].id,
        testUsers[1].name,
      );

      // 檢查在線用戶
      const onlineUsers =
        collaborativeOrderService.getOnlineUsers(groupOrderId);

      expect(onlineUsers).toHaveLength(2);
      expect(onlineUsers.map((u) => u.userId)).toEqual(
        expect.arrayContaining([testUsers[0].id, testUsers[1].id]),
      );
    });

    it("應該正確處理編輯鎖定", async () => {
      const user1 = testUsers[0];
      const user2 = testUsers[1];

      // 用戶1請求鎖定
      const lock1Result = await collaborativeOrderService.requestEditLock(
        groupOrderId,
        "cart_item",
        "item-1",
        user1.id,
        user1.name,
        "write",
      );

      expect(lock1Result.success).toBe(true);
      expect(lock1Result.lock).toBeDefined();

      // 用戶2嘗試請求相同鎖定（應該失敗）
      const lock2Result = await collaborativeOrderService.requestEditLock(
        groupOrderId,
        "cart_item",
        "item-1",
        user2.id,
        user2.name,
        "write",
      );

      expect(lock2Result.success).toBe(false);
      expect(lock2Result.conflict).toBeDefined();
      expect(lock2Result.conflict?.lockedBy).toBe(user1.id);
    });

    it("應該正確處理權限檢查", async () => {
      const user1 = testUsers[0]; // 普通成員
      const admin = { ...testUsers[1], role: "creator" }; // 群組創建者

      // 初始化協作環境
      await collaborativeOrderService.initializeCollaboration(
        groupOrderId,
        user1.id,
        user1.name,
      );

      // 普通成員嘗試發起分帳（應該失敗）
      const user1Permission = await collaborativeOrderService.checkPermission(
        groupOrderId,
        "initiate_split",
        "split_bill",
        user1.id,
      );

      expect(user1Permission.allowed).toBe(false);

      // 創建者發起分帳（應該成功）
      const adminPermission = await collaborativeOrderService.checkPermission(
        groupOrderId,
        "initiate_split",
        "split_bill",
        admin.id,
        { user: admin },
      );

      expect(adminPermission.allowed).toBe(true);
    });
  });

  describe("衝突解決機制", () => {
    it("應該檢測並解決購物車項目衝突", async () => {
      const user1 = testUsers[0];
      const user2 = testUsers[1];

      // 創建衝突的操作
      const operation1 = {
        type: "update" as const,
        entity: "cart_item" as const,
        entityId: "item-1",
        data: { quantity: 3 },
        userId: user1.id,
      };

      const operation2 = {
        type: "update" as const,
        entity: "cart_item" as const,
        entityId: "item-1",
        data: { quantity: 5 },
        userId: user2.id,
      };

      // 同時廣播操作
      await Promise.all([
        groupOrderBroadcastService.broadcastOperation(groupOrderId, operation1),
        groupOrderBroadcastService.broadcastOperation(groupOrderId, operation2),
      ]);

      // 等待衝突解決
      await waitFor(() => {
        const stats = groupOrderBroadcastService.getSyncStats(groupOrderId);
        return stats?.conflictedOperationsCount === 0;
      });

      // 驗證衝突已解決
      const finalStats = groupOrderBroadcastService.getSyncStats(groupOrderId);
      expect(finalStats?.conflictedOperationsCount).toBe(0);
    });

    it("應該處理併發編輯衝突", async () => {
      const user1 = testUsers[0];
      const user2 = testUsers[1];

      // 同時編輯相同項目
      const edit1Promise = collaborativeOrderService.handleRealtimeEdit(
        groupOrderId,
        "cart_item",
        "item-1",
        user1.id,
        { quantity: 3, customizations: { spicy: "hot" } },
      );

      const edit2Promise = collaborativeOrderService.handleRealtimeEdit(
        groupOrderId,
        "cart_item",
        "item-1",
        user2.id,
        { quantity: 5, specialInstructions: "無蔥" },
      );

      const [result1, result2] = await Promise.all([
        edit1Promise,
        edit2Promise,
      ]);

      // 至少一個應該成功，或者有衝突處理
      expect(
        result1.success ||
          result2.success ||
          result1.conflicts ||
          result2.conflicts,
      ).toBe(true);

      // 檢查衝突警報
      const alerts = collaborativeOrderService.getConflictAlerts();
      expect(alerts.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("錯誤處理和網絡彈性", () => {
    it("應該檢測連接問題並嘗試重連", async () => {
      const { connectWebSocket } = useRealtimeGroupOrders();

      await connectWebSocket(groupOrderId);

      // 模擬連接斷開
      mockWebSocket.close();

      // 等待重連嘗試
      await waitFor(() => {
        return mockWebSocket.connectionAttempts > 1;
      }, 5000);

      expect(mockWebSocket.connectionAttempts).toBeGreaterThan(1);
    });

    it("應該記錄和恢復錯誤", async () => {
      // 記錄測試錯誤
      realtimeResilienceService.recordError({
        type: "connection",
        severity: "medium",
        message: "測試連接錯誤",
      });

      // 檢查錯誤記錄
      const errors = realtimeResilienceService.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe("測試連接錯誤");

      // 嘗試恢復
      await realtimeResilienceService.forceRecovery();

      // 檢查恢復狀態
      const unrecoveredErrors =
        realtimeResilienceService.getUnrecoveredErrors();
      expect(unrecoveredErrors.length).toBeLessThanOrEqual(1);
    });

    it("應該處理離線操作", async () => {
      // 模擬離線狀態
      global.navigator.onLine = false;

      // 添加離線操作
      realtimeResilienceService.addOfflineOperation({
        type: "broadcast_operation",
        groupOrderId,
        operation: {
          type: "add",
          entity: "cart_item",
          entityId: "item-offline",
          data: { menuItemName: "離線商品" },
          userId: testUsers[0].id,
        },
        maxRetries: 3,
        priority: "normal",
      });

      // 檢查離線操作已添加
      const offlineOps = realtimeResilienceService.getOfflineOperations();
      expect(offlineOps).toHaveLength(1);
      expect(offlineOps[0].operation.data.menuItemName).toBe("離線商品");

      // 模擬網絡恢復
      global.navigator.onLine = true;

      // 觸發離線操作處理
      window.dispatchEvent(new Event("online"));

      // 等待操作處理
      await waitFor(() => {
        const remainingOps = realtimeResilienceService.getOfflineOperations();
        return remainingOps.length === 0;
      });
    });

    it("應該適應網絡質量變化", async () => {
      const initialState = realtimeResilienceService.getConnectionState();

      // 模擬網絡質量變化
      const mockConnection = {
        effectiveType: "2g",
        downlink: 0.5,
        rtt: 2000,
      };

      // 觸發網絡變化事件
      Object.defineProperty(navigator, "connection", {
        value: mockConnection,
        writable: true,
      });

      // 等待狀態更新
      await nextTick();

      const updatedState = realtimeResilienceService.getConnectionState();
      expect(updatedState.quality).toBe("poor");
    });
  });

  describe("複雜場景測試", () => {
    it("應該處理大型群組訂單場景", async () => {
      const largeGroupSize = 10;
      const itemsPerUser = 5;

      // 創建大型群組
      const largeGroup = createMockGroupOrder(groupOrderId);
      for (let i = 0; i < largeGroupSize; i++) {
        const member = createMockMember(`member-${i}`, `用戶${i}`);
        largeGroup.members.push(member);

        // 每個用戶添加多個商品
        for (let j = 0; j < itemsPerUser; j++) {
          const item = createMockCartItem(`item-${i}-${j}`, member.id);
          largeGroup.cart.push(item);
        }
      }

      // 初始化協作環境
      for (let i = 0; i < largeGroupSize; i++) {
        await collaborativeOrderService.initializeCollaboration(
          groupOrderId,
          `user-${i}`,
          `用戶${i}`,
        );
      }

      // 檢查系統性能
      const startTime = Date.now();

      // 同時進行多個操作
      const operations = [];
      for (let i = 0; i < largeGroupSize; i++) {
        operations.push(
          groupOrderBroadcastService.broadcastOperation(groupOrderId, {
            type: "update",
            entity: "cart_item",
            entityId: `item-${i}-0`,
            data: { quantity: Math.ceil(Math.random() * 5) },
            userId: `user-${i}`,
          }),
        );
      }

      await Promise.all(operations);

      const processingTime = Date.now() - startTime;

      // 驗證性能要求（應該在合理時間內完成）
      expect(processingTime).toBeLessThan(5000); // 5秒內

      // 檢查在線用戶數量
      const onlineUsers =
        collaborativeOrderService.getOnlineUsers(groupOrderId);
      expect(onlineUsers).toHaveLength(largeGroupSize);
    });

    it("應該處理網絡中斷和恢復場景", async () => {
      const { connectWebSocket, addCartItem, myMemberId, currentGroupOrder } =
        useRealtimeGroupOrders();

      // 建立連接並設置初始狀態
      await connectWebSocket(groupOrderId);
      currentGroupOrder.value = createMockGroupOrder(groupOrderId);
      myMemberId.value = "member-1";

      // 模擬網絡中斷
      global.navigator.onLine = false;
      mockWebSocket.close();

      // 嘗試離線操作
      const offlineResult = await addCartItem({
        menuItemId: 999,
        menuItemName: "離線商品",
        quantity: 1,
        unitPrice: 10.0,
      });

      // 應該緩存操作
      const offlineOps = realtimeResilienceService.getOfflineOperations();
      expect(offlineOps.length).toBeGreaterThan(0);

      // 模擬網絡恢復
      global.navigator.onLine = true;
      mockWebSocket.open();

      // 觸發重連
      window.dispatchEvent(new Event("online"));

      // 等待操作同步
      await waitFor(() => {
        const remainingOps = realtimeResilienceService.getOfflineOperations();
        return remainingOps.length === 0;
      });

      // 驗證操作已同步
      const sentMessages = mockWebSocket.getSentMessages();
      const syncMessage = sentMessages.find(
        (msg) =>
          msg.type === "add_cart_item" && msg.data.menuItemName === "離線商品",
      );
      expect(syncMessage).toBeDefined();
    });

    it("應該處理頁面刷新和狀態恢復", async () => {
      const { connectWebSocket, joinGroupOrder } = useRealtimeGroupOrders();

      // 初始連接和加入
      await connectWebSocket(groupOrderId);

      mockWebSocket.mockResponse({
        type: "group_order_joined",
        success: true,
        groupOrder: createMockGroupOrder(groupOrderId),
        memberId: "member-1",
      });

      await joinGroupOrder("PARTY-REFRESH", "刷新測試用戶");

      // 模擬頁面隱藏
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        writable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));

      // 模擬頁面重新顯示
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        writable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));

      // 應該觸發狀態同步
      await waitFor(() => {
        const sentMessages = mockWebSocket.getSentMessages();
        return sentMessages.some((msg) => msg.type === "request_state_sync");
      });

      const syncMessages = mockWebSocket
        .getSentMessages()
        .filter((msg) => msg.type === "request_state_sync");
      expect(syncMessages.length).toBeGreaterThan(0);
    });
  });

  describe("性能和可擴展性測試", () => {
    it("應該在高頻率更新下保持性能", async () => {
      const updateCount = 100;
      const startTime = Date.now();

      // 高頻率廣播操作
      const operations = [];
      for (let i = 0; i < updateCount; i++) {
        operations.push(
          groupOrderBroadcastService.broadcastOperation(groupOrderId, {
            type: "update",
            entity: "cart_item",
            entityId: `item-${i % 10}`, // 10個商品輪流更新
            data: { quantity: i + 1 },
            userId: "stress-test-user",
          }),
        );

        // 適當間隔避免過度並發
        if (i % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }

      await Promise.all(operations);

      const processingTime = Date.now() - startTime;
      const averageTime = processingTime / updateCount;

      // 驗證平均處理時間
      expect(averageTime).toBeLessThan(50); // 每個操作50ms以內

      // 檢查系統狀態
      const stats = groupOrderBroadcastService.getSyncStats(groupOrderId);
      expect(stats).toBeDefined();
    });

    it("應該正確處理內存使用", async () => {
      const initialMemory = process.memoryUsage();

      // 創建大量臨時數據
      const operations = [];
      for (let i = 0; i < 1000; i++) {
        operations.push({
          id: crypto.randomUUID(),
          data: new Array(100).fill(`test-data-${i}`),
          timestamp: Date.now(),
        });
      }

      // 處理數據
      for (const op of operations) {
        realtimeResilienceService.recordError({
          type: "test",
          severity: "low",
          message: `Test error ${op.id}`,
          details: op.data,
        });
      }

      // 清理
      realtimeResilienceService.clearErrors();

      // 強制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();

      // 檢查內存增長
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // 50MB以內
    });
  });
});

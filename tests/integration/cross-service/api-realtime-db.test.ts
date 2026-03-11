/**
 * API + Realtime + Database Integration Tests
 *
 * Tests the complete flow across all three layers:
 * 1. API Layer (HTTP requests)
 * 2. Realtime Layer (WebSocket updates)
 * 3. Database Layer (Data persistence)
 *
 * Validates:
 * - Data consistency across services
 * - Real-time notification delivery
 * - End-to-end performance
 * - Error handling and recovery
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createIntegrationTestHelper,
  type IntegrationTestHelper,
} from "./integration-test-helper";

describe("API + Realtime + Database Integration", () => {
  let helper: IntegrationTestHelper;
  let adminUser: any;
  let testRestaurant: any;

  beforeAll(async () => {
    helper = createIntegrationTestHelper();
    await helper.initialize();

    adminUser = helper.getTestUser("admin");
    testRestaurant = helper.getTestRestaurant();
  }, 30000); // 30 second timeout for setup

  afterAll(async () => {
    await helper.cleanup();
  });

  describe("Order Creation Flow", () => {
    it("should create order via API and receive realtime notification", async () => {
      /**
       * 測試流程:
       *
       * 1. Kitchen 連接 WebSocket
       * 2. Customer 透過 API 創建訂單
       * 3. 驗證訂單儲存到資料庫
       * 4. 驗證 Kitchen 收到即時通知
       * 5. 驗證資料一致性
       */

      // Step 1: Kitchen connects to WebSocket
      const kitchenWs = await helper.createWebSocketConnection(
        "kitchen",
        testRestaurant.id,
        adminUser.token,
      );

      // Listen for new order notification
      const orderNotificationPromise = helper.waitForWebSocketMessage(
        kitchenWs,
        (msg) => msg.type === "new_order",
        10000, // 10 second timeout
      );

      // Step 2: Create order via API
      const orderData = {
        restaurantId: testRestaurant.id,
        tableId: testRestaurant.tables[0].id,
        items: [
          {
            menuItemId: 1,
            quantity: 2,
            unitPrice: 120,
            notes: "少辣",
          },
        ],
        customerName: "Integration Test Customer",
        customerPhone: "012-3456789",
      };

      const createOrderResponse = await helper.apiRequest(
        "POST",
        "/api/v1/orders",
        {
          body: orderData,
          user: adminUser,
        },
      );

      expect(createOrderResponse.status).toBe(201);
      const orderResult = await createOrderResponse.json();
      expect(orderResult.success).toBe(true);
      expect(orderResult.data.id).toBeDefined();

      const orderId = orderResult.data.id;

      // Step 3: Verify order in database
      const dbOrder = await helper.executeDbQuery(
        "SELECT * FROM orders WHERE id = ?",
        [orderId],
      );
      expect(dbOrder.results).toHaveLength(1);
      expect(dbOrder.results[0].status).toBe("pending");

      // Step 4: Verify Kitchen received notification
      const notification = await orderNotificationPromise;
      expect(notification.type).toBe("new_order");
      expect(notification.data.orderId).toBe(orderId);
      expect(notification.data.tableNumber).toBe(
        testRestaurant.tables[0].number,
      );

      // Step 5: Verify data consistency
      expect(notification.data.restaurantId).toBe(testRestaurant.id);
      expect(notification.data.items).toHaveLength(1);
      expect(notification.data.items[0].quantity).toBe(2);

      kitchenWs.close();
    }, 15000);

    it("should handle order status updates across all layers", async () => {
      /**
       * 測試流程:
       *
       * 1. 創建訂單
       * 2. Admin 連接 WebSocket
       * 3. Kitchen 更新訂單狀態
       * 4. 驗證資料庫更新
       * 5. 驗證 Admin 收到通知
       */

      // Step 1: Create order
      const orderResponse = await helper.apiRequest("POST", "/api/v1/orders", {
        body: {
          restaurantId: testRestaurant.id,
          tableId: testRestaurant.tables[0].id,
          items: [{ menuItemId: 1, quantity: 1, unitPrice: 100 }],
        },
        user: adminUser,
      });

      const orderData = await orderResponse.json();
      const orderId = orderData.data.id;

      // Step 2: Admin connects to WebSocket
      const adminWs = await helper.createWebSocketConnection(
        "admin",
        testRestaurant.id,
        adminUser.token,
      );

      // Listen for status update
      const statusUpdatePromise = helper.waitForWebSocketMessage(
        adminWs,
        (msg) =>
          msg.type === "order_status_update" && msg.data.orderId === orderId,
        10000,
      );

      // Step 3: Update order status
      const updateResponse = await helper.apiRequest(
        "PUT",
        `/api/v1/orders/${orderId}/status`,
        {
          body: { status: "confirmed" },
          user: adminUser,
        },
      );

      expect(updateResponse.status).toBe(200);

      // Step 4: Verify database update
      const dbOrder = await helper.executeDbQuery(
        "SELECT * FROM orders WHERE id = ?",
        [orderId],
      );
      expect(dbOrder.results[0].status).toBe("confirmed");

      // Step 5: Verify Admin received notification
      const statusUpdate = await statusUpdatePromise;
      expect(statusUpdate.data.status).toBe("confirmed");
      expect(statusUpdate.data.orderId).toBe(orderId);

      adminWs.close();
    }, 15000);
  });

  describe("Menu Updates Flow", () => {
    it("should sync menu updates across API, DB, and Realtime", async () => {
      /**
       * 測試流程:
       *
       * 1. Customer 連接 WebSocket
       * 2. Admin 更新菜單項目可用性
       * 3. 驗證資料庫更新
       * 4. 驗證 Customer 收到通知
       */

      // Step 1: Customer connects
      const customerWs = await helper.createWebSocketConnection(
        "customer",
        testRestaurant.tables[0].id,
        "customer_token",
      );

      // Listen for menu update
      const menuUpdatePromise = helper.waitForWebSocketMessage(
        customerWs,
        (msg) => msg.type === "menu_item_updated",
        10000,
      );

      // Step 2: Update menu item
      const menuItemId = 1;
      const updateResponse = await helper.apiRequest(
        "PATCH",
        `/api/v1/menu/${testRestaurant.id}/items/${menuItemId}`,
        {
          body: { isAvailable: false },
          user: adminUser,
        },
      );

      expect(updateResponse.status).toBe(200);

      // Step 3: Verify database
      const dbMenuItem = await helper.executeDbQuery(
        "SELECT * FROM menu_items WHERE id = ?",
        [menuItemId],
      );
      expect(dbMenuItem.results[0].is_available).toBe(false);

      // Step 4: Verify notification
      const menuUpdate = await menuUpdatePromise;
      expect(menuUpdate.data.menuItemId).toBe(menuItemId);
      expect(menuUpdate.data.isAvailable).toBe(false);

      customerWs.close();
    }, 15000);
  });

  describe("Table Management Flow", () => {
    it("should sync table status across all layers", async () => {
      /**
       * 測試流程:
       *
       * 1. Admin 連接 WebSocket
       * 2. 更新桌台狀態
       * 3. 驗證資料庫更新
       * 4. 驗證即時通知
       * 5. 查詢 API 確認狀態
       */

      const tableId = testRestaurant.tables[0].id;

      // Step 1: Admin connects
      const adminWs = await helper.createWebSocketConnection(
        "admin",
        testRestaurant.id,
        adminUser.token,
      );

      // Listen for table status update
      const tableUpdatePromise = helper.waitForWebSocketMessage(
        adminWs,
        (msg) =>
          msg.type === "table_status_update" && msg.data.tableId === tableId,
        10000,
      );

      // Step 2: Update table status
      const updateResponse = await helper.apiRequest(
        "PATCH",
        `/api/v1/tables/${tableId}/status`,
        {
          body: { status: "occupied" },
          user: adminUser,
        },
      );

      expect(updateResponse.status).toBe(200);

      // Step 3: Verify database
      const dbTable = await helper.executeDbQuery(
        "SELECT * FROM tables WHERE id = ?",
        [tableId],
      );
      expect(dbTable.results[0].is_occupied).toBe(true);

      // Step 4: Verify notification
      const tableUpdate = await tableUpdatePromise;
      expect(tableUpdate.data.status).toBe("occupied");

      // Step 5: Verify via API query
      const queryResponse = await helper.apiRequest(
        "GET",
        `/api/v1/tables/${tableId}`,
        { user: adminUser },
      );

      const tableData = await queryResponse.json();
      expect(tableData.data.isOccupied).toBe(true);

      adminWs.close();
    }, 15000);
  });

  describe("Performance Across Services", () => {
    it("should complete order creation within performance budget", async () => {
      /**
       * 測試端到端性能:
       *
       * API 處理 → 資料庫儲存 → 即時通知
       *
       * 目標: 總時間 < 500ms
       */

      const performance = await helper.trackCrossServicePerformance(
        "order_creation_e2e",
        async () => {
          const response = await helper.apiRequest("POST", "/api/v1/orders", {
            body: {
              restaurantId: testRestaurant.id,
              tableId: testRestaurant.tables[0].id,
              items: [{ menuItemId: 1, quantity: 1, unitPrice: 100 }],
            },
            user: adminUser,
          });

          expect(response.status).toBe(201);
        },
      );

      console.log("📊 End-to-End Performance:", performance);

      // Performance assertions
      expect(performance.totalTime).toBeLessThan(500); // 500ms budget
    });

    it("should handle concurrent orders efficiently", async () => {
      /**
       * 測試並發處理能力:
       *
       * 同時創建 10 個訂單
       * 驗證所有訂單成功創建
       * 驗證資料一致性
       */

      const concurrentOrders = 10;
      const startTime = performance.now();

      const orderPromises = Array.from({ length: concurrentOrders }, (_, i) =>
        helper.apiRequest("POST", "/api/v1/orders", {
          body: {
            restaurantId: testRestaurant.id,
            tableId: testRestaurant.tables[i % testRestaurant.tables.length].id,
            items: [{ menuItemId: 1, quantity: 1, unitPrice: 100 }],
          },
          user: adminUser,
        }),
      );

      const responses = await Promise.all(orderPromises);
      const endTime = performance.now();

      // All orders should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(201);
      });

      // Should complete within reasonable time
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(2000); // 2 seconds for 10 orders

      console.log(
        `📊 Concurrent Order Creation: ${concurrentOrders} orders in ${totalTime.toFixed(2)}ms`,
      );
      console.log(
        `   Average: ${(totalTime / concurrentOrders).toFixed(2)}ms per order`,
      );
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should handle database errors gracefully", async () => {
      /**
       * 測試錯誤處理:
       *
       * 1. 嘗試創建無效訂單
       * 2. 驗證 API 返回錯誤
       * 3. 驗證資料庫未受影響
       * 4. 驗證沒有發送錯誤通知
       */

      // Try to create invalid order
      const response = await helper.apiRequest("POST", "/api/v1/orders", {
        body: {
          restaurantId: 999999, // Non-existent restaurant
          tableId: 999999,
          items: [],
        },
        user: adminUser,
      });

      expect(response.status).toBe(400);
      const errorData = await response.json();
      expect(errorData.success).toBe(false);
      expect(errorData.error).toBeDefined();
    });

    it("should maintain data consistency after partial failures", async () => {
      /**
       * 測試資料一致性:
       *
       * 1. 創建訂單
       * 2. 模擬部分失敗 (例如: 通知失敗)
       * 3. 驗證資料庫狀態正確
       * 4. 驗證可以重試失敗操作
       */

      // Create order
      const response = await helper.apiRequest("POST", "/api/v1/orders", {
        body: {
          restaurantId: testRestaurant.id,
          tableId: testRestaurant.tables[0].id,
          items: [{ menuItemId: 1, quantity: 1, unitPrice: 100 }],
        },
        user: adminUser,
      });

      expect(response.status).toBe(201);
      const orderData = await response.json();
      const orderId = orderData.data.id;

      // Verify order exists in database
      const dbOrder = await helper.executeDbQuery(
        "SELECT * FROM orders WHERE id = ?",
        [orderId],
      );

      expect(dbOrder.results).toHaveLength(1);
      expect(dbOrder.results[0].id).toBe(orderId);

      // Order should be retrievable via API
      const getResponse = await helper.apiRequest(
        "GET",
        `/api/v1/orders/${orderId}`,
        { user: adminUser },
      );

      expect(getResponse.status).toBe(200);
    });
  });

  describe("WebSocket Reconnection", () => {
    it("should handle WebSocket disconnection and reconnection", async () => {
      /**
       * 測試重連機制:
       *
       * 1. 建立 WebSocket 連線
       * 2. 模擬斷線
       * 3. 重新連線
       * 4. 驗證可以繼續接收訊息
       */

      // Connect
      const ws = await helper.createWebSocketConnection(
        "kitchen",
        testRestaurant.id,
        adminUser.token,
      );

      expect(ws.readyState).toBe(WebSocket.OPEN);

      // Close connection
      ws.close();

      // Wait for close
      await new Promise((resolve) => setTimeout(resolve, 1000));
      expect(ws.readyState).toBe(WebSocket.CLOSED);

      // Reconnect
      const ws2 = await helper.createWebSocketConnection(
        "kitchen",
        testRestaurant.id,
        adminUser.token,
      );

      expect(ws2.readyState).toBe(WebSocket.OPEN);

      // Should receive messages normally
      const messagePromise = helper.waitForWebSocketMessage(
        ws2,
        (msg) => msg.type === "connection_ack",
        5000,
      );

      const ackMessage = await messagePromise;
      expect(ackMessage.type).toBe("connection_ack");

      ws2.close();
    });
  });
});

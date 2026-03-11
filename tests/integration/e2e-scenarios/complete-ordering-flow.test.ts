/**
 * Complete Ordering Flow - End-to-End Test
 *
 * 模擬完整的訂餐流程,從顧客掃描 QR code 到訂單完成
 *
 * 流程階段:
 * 1. 顧客掃描 QR Code (Customer Scan)
 * 2. 瀏覽菜單 (Browse Menu)
 * 3. 加入購物車 (Add to Cart)
 * 4. 下單 (Place Order)
 * 5. 廚房接收 (Kitchen Receive)
 * 6. 廚房確認 (Kitchen Confirm)
 * 7. 廚房完成 (Kitchen Complete)
 * 8. 送餐 (Deliver)
 * 9. 結帳 (Payment)
 * 10. 訂單完成 (Order Complete)
 *
 * 驗證項目:
 * - 每個階段的資料一致性
 * - 即時通知的正確性
 * - 性能符合標準
 * - 錯誤處理機制
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createIntegrationTestHelper,
  type IntegrationTestHelper,
} from "../cross-service/integration-test-helper";

describe("Complete Ordering Flow - E2E Test", () => {
  let helper: IntegrationTestHelper;
  let testRestaurant: any;
  let testTable: any;
  let testMenu: any[];
  let customerWs: WebSocket;
  let kitchenWs: WebSocket;
  let adminWs: WebSocket;

  // 性能追蹤
  const performanceMetrics = {
    scanToMenu: 0,
    menuToOrder: 0,
    orderToKitchen: 0,
    kitchenToComplete: 0,
    completeToPayment: 0,
    totalTime: 0,
  };

  beforeAll(async () => {
    console.log("🚀 Starting Complete Ordering Flow E2E Test\\n");
    helper = createIntegrationTestHelper();
    await helper.initialize();

    // Get test data
    testRestaurant = helper.getTestRestaurant();
    testTable = testRestaurant.tables[0];

    // Prepare test menu
    testMenu = [
      {
        id: 1,
        name: "經典漢堡",
        nameEn: "Classic Burger",
        price: 120,
        categoryId: 1,
        isAvailable: true,
      },
      {
        id: 2,
        name: "薯條",
        nameEn: "French Fries",
        price: 60,
        categoryId: 2,
        isAvailable: true,
      },
      {
        id: 3,
        name: "可樂",
        nameEn: "Coke",
        price: 40,
        categoryId: 3,
        isAvailable: true,
      },
    ];

    console.log(`📍 Restaurant: ${testRestaurant.name}`);
    console.log(`🪑 Table: ${testTable.number}`);
    console.log(`📋 Menu Items: ${testMenu.length}`);
    console.log();
  }, 30000);

  afterAll(async () => {
    // Close all WebSocket connections
    customerWs?.close();
    kitchenWs?.close();
    adminWs?.close();

    await helper.cleanup();

    // Print performance summary
    console.log("\\n📊 End-to-End Performance Summary:");
    console.log(
      `   🔍 Scan to Menu: ${performanceMetrics.scanToMenu.toFixed(2)}ms`,
    );
    console.log(
      `   🛒 Menu to Order: ${performanceMetrics.menuToOrder.toFixed(2)}ms`,
    );
    console.log(
      `   🔔 Order to Kitchen: ${performanceMetrics.orderToKitchen.toFixed(2)}ms`,
    );
    console.log(
      `   👨‍🍳 Kitchen to Complete: ${performanceMetrics.kitchenToComplete.toFixed(2)}ms`,
    );
    console.log(
      `   💰 Complete to Payment: ${performanceMetrics.completeToPayment.toFixed(2)}ms`,
    );
    console.log(
      `   ⏱️  Total Time: ${performanceMetrics.totalTime.toFixed(2)}ms`,
    );
    console.log();
  });

  it("should complete full ordering flow from scan to payment", async () => {
    const flowStartTime = performance.now();

    /**
     * STAGE 1: 顧客掃描 QR Code
     * - 掃描桌台 QR code
     * - 建立 WebSocket 連線
     * - 接收歡迎訊息
     */
    console.log("📱 STAGE 1: Customer Scans QR Code");
    const scanStartTime = performance.now();

    // Scan QR code (simulated)
    const qrData = {
      type: "table",
      restaurantId: testRestaurant.id,
      tableId: testTable.id,
      tableNumber: testTable.number,
    };

    expect(qrData.type).toBe("table");
    expect(qrData.restaurantId).toBe(testRestaurant.id);

    // Customer establishes WebSocket connection
    customerWs = await helper.createWebSocketConnection(
      "customer",
      testTable.id,
      "customer_token",
    );

    expect(customerWs.readyState).toBe(WebSocket.OPEN);

    /**
     * STAGE 2: 瀏覽菜單
     * - 獲取餐廳菜單
     * - 檢查菜單項目可用性
     * - 查看價格和描述
     */
    console.log("📋 STAGE 2: Browse Menu");

    const menuResponse = await helper.apiRequest(
      "GET",
      `/api/v1/menu/${testRestaurant.id}/items`,
      {},
    );

    expect(menuResponse.status).toBe(200);
    const menuData = await menuResponse.json();
    expect(menuData.success).toBe(true);
    expect(menuData.data).toBeDefined();

    performanceMetrics.scanToMenu = performance.now() - scanStartTime;
    console.log(
      `   ✅ Menu loaded in ${performanceMetrics.scanToMenu.toFixed(2)}ms`,
    );

    /**
     * STAGE 3: 加入購物車並下單
     * - 選擇菜單項目
     * - 加入購物車
     * - 確認訂單
     */
    console.log("🛒 STAGE 3: Add to Cart & Place Order");
    const orderStartTime = performance.now();

    // Setup WebSocket listeners for kitchen
    kitchenWs = await helper.createWebSocketConnection(
      "kitchen",
      testRestaurant.id,
      "kitchen_token",
    );

    const kitchenNotificationPromise = helper.waitForWebSocketMessage(
      kitchenWs,
      (msg) => msg.type === "new_order",
      15000,
    );

    // Place order
    const orderData = {
      restaurantId: testRestaurant.id,
      tableId: testTable.id,
      items: [
        {
          menuItemId: testMenu[0].id,
          quantity: 2,
          unitPrice: testMenu[0].price,
          notes: "不要洋蔥",
        },
        {
          menuItemId: testMenu[1].id,
          quantity: 1,
          unitPrice: testMenu[1].price,
        },
        {
          menuItemId: testMenu[2].id,
          quantity: 2,
          unitPrice: testMenu[2].price,
        },
      ],
      customerName: "E2E Test Customer",
      customerPhone: "012-3456789",
      notes: "快一點",
    };

    const orderResponse = await helper.apiRequest("POST", "/api/v1/orders", {
      body: orderData,
    });

    expect(orderResponse.status).toBe(201);
    const orderResult = await orderResponse.json();
    expect(orderResult.success).toBe(true);
    expect(orderResult.data.id).toBeDefined();

    const orderId = orderResult.data.id;
    console.log(`   ✅ Order created: #${orderId}`);

    performanceMetrics.menuToOrder = performance.now() - orderStartTime;

    /**
     * STAGE 4: 廚房接收訂單
     * - 廚房收到即時通知
     * - 驗證訂單資料完整性
     * - 確認訂單狀態
     */
    console.log("🔔 STAGE 4: Kitchen Receives Order");
    const kitchenReceiveTime = performance.now();

    // Wait for kitchen notification
    const kitchenNotification = await kitchenNotificationPromise;

    expect(kitchenNotification.type).toBe("new_order");
    expect(kitchenNotification.data.orderId).toBe(orderId);
    expect(kitchenNotification.data.tableNumber).toBe(testTable.number);
    expect(kitchenNotification.data.items).toHaveLength(3);
    expect(kitchenNotification.data.items[0].notes).toBe("不要洋蔥");

    performanceMetrics.orderToKitchen = performance.now() - kitchenReceiveTime;
    console.log(
      `   ✅ Kitchen notified in ${performanceMetrics.orderToKitchen.toFixed(2)}ms`,
    );

    // Verify order in database
    const dbOrder = await helper.executeDbQuery(
      "SELECT * FROM orders WHERE id = ?",
      [orderId],
    );
    expect(dbOrder.results).toHaveLength(1);
    expect(dbOrder.results[0].status).toBe("pending");

    /**
     * STAGE 5: 廚房確認訂單
     * - 廚房確認可以製作
     * - 更新訂單狀態為 confirmed
     * - 通知顧客訂單已確認
     */
    console.log("👨‍🍳 STAGE 5: Kitchen Confirms Order");

    const customerNotificationPromise = helper.waitForWebSocketMessage(
      customerWs,
      (msg) =>
        msg.type === "order_status_update" && msg.data.status === "confirmed",
      10000,
    );

    const confirmResponse = await helper.apiRequest(
      "PUT",
      `/api/v1/orders/${orderId}/status`,
      {
        body: { status: "confirmed" },
      },
    );

    expect(confirmResponse.status).toBe(200);

    // Customer should receive notification
    const customerNotification = await customerNotificationPromise;
    expect(customerNotification.data.status).toBe("confirmed");
    console.log("   ✅ Order confirmed, customer notified");

    /**
     * STAGE 6: 廚房開始製作
     * - 更新訂單狀態為 preparing
     * - 追蹤製作進度
     */
    console.log("🔥 STAGE 6: Kitchen Starts Preparing");
    const preparingStartTime = performance.now();

    const preparingNotificationPromise = helper.waitForWebSocketMessage(
      customerWs,
      (msg) =>
        msg.type === "order_status_update" && msg.data.status === "preparing",
      10000,
    );

    await helper.apiRequest("PUT", `/api/v1/orders/${orderId}/status`, {
      body: { status: "preparing" },
    });

    await preparingNotificationPromise;
    console.log("   ✅ Order is being prepared");

    /**
     * STAGE 7: 廚房完成製作
     * - 更新訂單狀態為 ready
     * - 通知服務人員送餐
     * - 通知顧客餐點已備妥
     */
    console.log("✅ STAGE 7: Kitchen Completes Order");

    const readyNotificationPromise = helper.waitForWebSocketMessage(
      customerWs,
      (msg) =>
        msg.type === "order_status_update" && msg.data.status === "ready",
      10000,
    );

    await helper.apiRequest("PUT", `/api/v1/orders/${orderId}/status`, {
      body: { status: "ready" },
    });

    await readyNotificationPromise;
    performanceMetrics.kitchenToComplete =
      performance.now() - preparingStartTime;
    console.log(
      `   ✅ Order ready in ${performanceMetrics.kitchenToComplete.toFixed(2)}ms`,
    );

    /**
     * STAGE 8: 送餐
     * - 服務人員送餐到桌
     * - 更新訂單狀態為 delivered
     * - 顧客確認收到餐點
     */
    console.log("🚚 STAGE 8: Deliver to Table");

    const deliveredNotificationPromise = helper.waitForWebSocketMessage(
      customerWs,
      (msg) =>
        msg.type === "order_status_update" && msg.data.status === "delivered",
      10000,
    );

    await helper.apiRequest("PUT", `/api/v1/orders/${orderId}/status`, {
      body: { status: "delivered" },
    });

    await deliveredNotificationPromise;
    console.log("   ✅ Order delivered to table");

    /**
     * STAGE 9: 結帳
     * - 計算總金額
     * - 處理付款
     * - 更新訂單狀態為 completed
     */
    console.log("💰 STAGE 9: Payment");
    const paymentStartTime = performance.now();

    // Calculate total
    const expectedTotal =
      testMenu[0].price * 2 + testMenu[1].price * 1 + testMenu[2].price * 2;

    // Process payment
    const paymentResponse = await helper.apiRequest(
      "POST",
      `/api/v1/orders/${orderId}/payment`,
      {
        body: {
          amount: expectedTotal,
          method: "cash",
        },
      },
    );

    expect(paymentResponse.status).toBe(200);

    // Complete order
    const completeResponse = await helper.apiRequest(
      "PUT",
      `/api/v1/orders/${orderId}/status`,
      {
        body: { status: "completed" },
      },
    );

    expect(completeResponse.status).toBe(200);

    performanceMetrics.completeToPayment = performance.now() - paymentStartTime;
    console.log(
      `   ✅ Payment completed in ${performanceMetrics.completeToPayment.toFixed(2)}ms`,
    );

    /**
     * STAGE 10: 訂單完成
     * - 驗證最終訂單狀態
     * - 檢查資料一致性
     * - 清理 WebSocket 連線
     */
    console.log("🎉 STAGE 10: Order Complete");

    // Verify final order state
    const finalOrder = await helper.executeDbQuery(
      "SELECT * FROM orders WHERE id = ?",
      [orderId],
    );

    expect(finalOrder.results[0].status).toBe("completed");
    expect(finalOrder.results[0].id).toBe(orderId);

    // Verify via API
    const finalOrderResponse = await helper.apiRequest(
      "GET",
      `/api/v1/orders/${orderId}`,
      {},
    );

    expect(finalOrderResponse.status).toBe(200);
    const finalOrderData = await finalOrderResponse.json();
    expect(finalOrderData.data.status).toBe("completed");

    performanceMetrics.totalTime = performance.now() - flowStartTime;

    console.log("\\n✅ Complete ordering flow finished successfully!");
    console.log(`   Total time: ${performanceMetrics.totalTime.toFixed(2)}ms`);
  }, 60000); // 60 second timeout for complete flow

  /**
   * 測試並發訂單處理能力
   */
  it("should handle concurrent orders efficiently", async () => {
    console.log("\\n🔀 Testing Concurrent Order Processing\\n");

    const concurrentOrders = 5;
    const startTime = performance.now();

    // Create multiple orders concurrently
    const orderPromises = Array.from({ length: concurrentOrders }, (_, i) =>
      helper.apiRequest("POST", "/api/v1/orders", {
        body: {
          restaurantId: testRestaurant.id,
          tableId: testRestaurant.tables[i % testRestaurant.tables.length].id,
          items: [
            {
              menuItemId: testMenu[i % testMenu.length].id,
              quantity: 1,
              unitPrice: testMenu[i % testMenu.length].price,
            },
          ],
          customerName: `Concurrent Customer ${i + 1}`,
          customerPhone: `012-345678${i}`,
        },
      }),
    );

    const responses = await Promise.all(orderPromises);
    const endTime = performance.now();

    // Verify all orders succeeded
    responses.forEach((response, index) => {
      expect(response.status).toBe(201);
    });

    const totalTime = endTime - startTime;
    const avgTime = totalTime / concurrentOrders;

    console.log(`   ✅ ${concurrentOrders} concurrent orders completed`);
    console.log(`   Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`   Average: ${avgTime.toFixed(2)}ms per order`);

    // Performance assertion
    expect(avgTime).toBeLessThan(500); // Average should be under 500ms
  }, 30000);

  /**
   * 測試錯誤情境
   */
  it("should handle errors gracefully throughout the flow", async () => {
    console.log("\\n⚠️  Testing Error Scenarios\\n");

    /**
     * Scenario 1: 嘗試訂購不存在的菜單項目
     */
    console.log("   Testing: Invalid menu item");

    const invalidOrderResponse = await helper.apiRequest(
      "POST",
      "/api/v1/orders",
      {
        body: {
          restaurantId: testRestaurant.id,
          tableId: testTable.id,
          items: [
            {
              menuItemId: 999999, // Non-existent item
              quantity: 1,
              unitPrice: 100,
            },
          ],
        },
      },
    );

    expect(invalidOrderResponse.status).toBe(400);
    console.log("   ✅ Invalid menu item rejected");

    /**
     * Scenario 2: 嘗試更新不存在的訂單
     */
    console.log("   Testing: Update non-existent order");

    const invalidUpdateResponse = await helper.apiRequest(
      "PUT",
      "/api/v1/orders/999999/status",
      {
        body: { status: "confirmed" },
      },
    );

    expect(invalidUpdateResponse.status).toBe(404);
    console.log("   ✅ Non-existent order update rejected");

    /**
     * Scenario 3: 嘗試無效的狀態轉換
     */
    console.log("   Testing: Invalid status transition");

    // Create a valid order first
    const orderResponse = await helper.apiRequest("POST", "/api/v1/orders", {
      body: {
        restaurantId: testRestaurant.id,
        tableId: testTable.id,
        items: [
          {
            menuItemId: testMenu[0].id,
            quantity: 1,
            unitPrice: testMenu[0].price,
          },
        ],
      },
    });

    const orderData = await orderResponse.json();
    const orderId = orderData.data.id;

    // Try invalid transition (pending -> delivered, skipping preparing)
    const invalidTransitionResponse = await helper.apiRequest(
      "PUT",
      `/api/v1/orders/${orderId}/status`,
      {
        body: { status: "delivered" },
      },
    );

    expect(invalidTransitionResponse.status).toBe(400);
    console.log("   ✅ Invalid status transition rejected");

    console.log("\\n✅ All error scenarios handled correctly");
  }, 30000);

  /**
   * 測試 WebSocket 重連機制
   */
  it("should recover from WebSocket disconnection", async () => {
    console.log("\\n🔌 Testing WebSocket Reconnection\\n");

    // Establish connection
    const ws = await helper.createWebSocketConnection(
      "customer",
      testTable.id,
      "customer_token",
    );

    expect(ws.readyState).toBe(WebSocket.OPEN);
    console.log("   ✅ Initial connection established");

    // Close connection
    ws.close();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(ws.readyState).toBe(WebSocket.CLOSED);
    console.log("   ✅ Connection closed");

    // Reconnect
    const ws2 = await helper.createWebSocketConnection(
      "customer",
      testTable.id,
      "customer_token",
    );

    expect(ws2.readyState).toBe(WebSocket.OPEN);
    console.log("   ✅ Reconnection successful");

    // Verify can still receive messages
    const ackPromise = helper.waitForWebSocketMessage(
      ws2,
      (msg) => msg.type === "connection_ack",
      5000,
    );

    const ackMessage = await ackPromise;
    expect(ackMessage.type).toBe("connection_ack");
    console.log("   ✅ Messages received after reconnection");

    ws2.close();
  }, 30000);

  /**
   * 測試性能標準
   */
  it("should meet performance standards", async () => {
    console.log("\\n📊 Verifying Performance Standards\\n");

    /**
     * Performance Budget:
     * - Order creation: < 300ms
     * - Status update: < 200ms
     * - Menu fetch: < 150ms
     * - WebSocket notification: < 100ms
     */

    const performanceBudget = {
      orderCreation: 300,
      statusUpdate: 200,
      menuFetch: 150,
      wsNotification: 100,
    };

    // Test order creation time
    const orderStartTime = performance.now();
    const orderResponse = await helper.apiRequest("POST", "/api/v1/orders", {
      body: {
        restaurantId: testRestaurant.id,
        tableId: testTable.id,
        items: [
          {
            menuItemId: testMenu[0].id,
            quantity: 1,
            unitPrice: testMenu[0].price,
          },
        ],
      },
    });
    const orderTime = performance.now() - orderStartTime;

    expect(orderResponse.status).toBe(201);
    expect(orderTime).toBeLessThan(performanceBudget.orderCreation);
    console.log(
      `   ✅ Order creation: ${orderTime.toFixed(2)}ms (budget: ${performanceBudget.orderCreation}ms)`,
    );

    // Test menu fetch time
    const menuStartTime = performance.now();
    const menuResponse = await helper.apiRequest(
      "GET",
      `/api/v1/menu/${testRestaurant.id}/items`,
      {},
    );
    const menuTime = performance.now() - menuStartTime;

    expect(menuResponse.status).toBe(200);
    expect(menuTime).toBeLessThan(performanceBudget.menuFetch);
    console.log(
      `   ✅ Menu fetch: ${menuTime.toFixed(2)}ms (budget: ${performanceBudget.menuFetch}ms)`,
    );

    console.log("\\n✅ All performance standards met");
  }, 30000);
});

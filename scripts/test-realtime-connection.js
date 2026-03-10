/**
 * Realtime WebSocket Connection Test Script
 * 測試 WebSocket 連線和即時通訊功能
 */

const API_BASE_URL = process.env.API_URL || "http://localhost:8787";
const REALTIME_WS_URL = process.env.REALTIME_WS_URL || "ws://localhost:8788";

// ANSI 顏色碼
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log("\n" + "=".repeat(60));
  log(title, "bright");
  console.log("=".repeat(60));
}

function logSuccess(message) {
  log(`✅ ${message}`, "green");
}

function logError(message) {
  log(`❌ ${message}`, "red");
}

function logInfo(message) {
  log(`ℹ️  ${message}`, "cyan");
}

function logWarning(message) {
  log(`⚠️  ${message}`, "yellow");
}

/**
 * 測試 1: 請求 WebSocket Token
 */
async function testTokenGeneration() {
  logSection("測試 1: WebSocket Token 生成");

  const testCases = [
    {
      name: "顧客 Token",
      request: {
        roomType: "customer",
        roomId: "test_room_1",
        restaurantId: "1",
        tableId: "table_1",
      },
    },
    {
      name: "廚房 Token",
      request: {
        roomType: "kitchen",
        roomId: "kitchen_1",
        restaurantId: "1",
        sessionId: "test_session_kitchen",
      },
    },
    {
      name: "管理員 Token",
      request: {
        roomType: "admin",
        roomId: "admin_1",
        restaurantId: "1",
        sessionId: "test_session_admin",
      },
    },
  ];

  const results = [];

  for (const testCase of testCases) {
    logInfo(`測試: ${testCase.name}`);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/realtime/auth/token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(testCase.request),
        },
      );

      const data = await response.json();

      if (response.ok && data.success) {
        logSuccess(`${testCase.name} 生成成功`);
        console.log(`  Token: ${data.data.token.substring(0, 50)}...`);
        console.log(`  有效期: ${data.data.expiresIn}秒`);
        console.log(`  WS URL: ${data.data.wsUrl.substring(0, 80)}...`);

        results.push({
          ...testCase,
          success: true,
          token: data.data.token,
          wsUrl: data.data.wsUrl,
          expiresIn: data.data.expiresIn,
        });
      } else {
        logError(`${testCase.name} 生成失敗`);
        console.log(`  錯誤: ${data.error || "未知錯誤"}`);

        results.push({
          ...testCase,
          success: false,
          error: data.error,
        });
      }
    } catch (error) {
      logError(`${testCase.name} 請求異常`);
      console.log(`  異常: ${error.message}`);

      results.push({
        ...testCase,
        success: false,
        error: error.message,
      });
    }

    console.log("");
  }

  return results;
}

/**
 * 測試 2: 驗證 Token
 */
async function testTokenVerification(tokens) {
  logSection("測試 2: Token 驗證");

  for (const tokenData of tokens) {
    if (!tokenData.success || !tokenData.token) {
      logWarning(`跳過 ${tokenData.name} (無有效 token)`);
      continue;
    }

    logInfo(`驗證: ${tokenData.name}`);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/realtime/auth/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: tokenData.token,
          }),
        },
      );

      const data = await response.json();

      if (response.ok && data.success && data.data.valid) {
        logSuccess(`${tokenData.name} 驗證通過`);
        console.log(`  Room Type: ${data.data.payload.roomType}`);
        console.log(`  Room ID: ${data.data.payload.roomId}`);
        console.log(`  Restaurant ID: ${data.data.payload.restaurantId}`);
        console.log(`  Role: ${data.data.payload.role}`);
      } else {
        logError(`${tokenData.name} 驗證失敗`);
        console.log(`  錯誤: ${data.error || "未知錯誤"}`);
      }
    } catch (error) {
      logError(`${tokenData.name} 驗證異常`);
      console.log(`  異常: ${error.message}`);
    }

    console.log("");
  }
}

/**
 * 測試 3: WebSocket 連線測試
 * 注意: 此測試需要 WebSocket 客戶端，在 Node.js 環境中需要 ws 套件
 */
async function testWebSocketConnection(tokens) {
  logSection("測試 3: WebSocket 連線");

  logInfo("WebSocket 連線測試需要實際的 WebSocket 環境");
  logInfo("請參考測試文檔使用 wscat 或瀏覽器 DevTools 進行測試");

  console.log("\n使用 wscat 測試範例:");
  console.log("─".repeat(60));

  for (const tokenData of tokens) {
    if (!tokenData.success || !tokenData.token) continue;

    const wsUrl =
      tokenData.wsUrl ||
      `${REALTIME_WS_URL}/${tokenData.request.roomType}/${tokenData.request.roomId}?token=${tokenData.token}`;

    console.log(`\n# ${tokenData.name}`);
    console.log(`wscat -c "${wsUrl}"`);
  }

  console.log("\n" + "─".repeat(60));
}

/**
 * 測試 4: 訊息格式驗證
 */
async function testMessageFormats() {
  logSection("測試 4: 訊息格式驗證");

  const sampleMessages = {
    ping: {
      type: "ping",
    },
    subscribe: {
      type: "subscribe",
      data: {
        eventTypes: ["new_order", "order_status_update"],
      },
    },
  };

  logInfo("客戶端訊息格式範例:");
  console.log("\n1. Ping (心跳)");
  console.log(JSON.stringify(sampleMessages.ping, null, 2));

  console.log("\n2. Subscribe (訂閱事件)");
  console.log(JSON.stringify(sampleMessages.subscribe, null, 2));

  logInfo("\n預期收到的伺服器訊息範例:");

  const serverMessages = {
    connectionAck: {
      type: "connection_ack",
      eventId: "evt_...",
      timestamp: Date.now(),
      restaurantId: "1",
      data: {
        connectionId: "customer_test_room_1_...",
        roomType: "customer",
        roomId: "test_room_1",
        connectedAt: Date.now(),
        activeConnections: 1,
      },
    },
    heartbeat: {
      type: "heartbeat",
      eventId: "evt_...",
      timestamp: Date.now(),
      restaurantId: "1",
      data: {
        serverTime: Date.now(),
      },
    },
    newOrder: {
      type: "new_order",
      eventId: "evt_...",
      timestamp: Date.now(),
      restaurantId: "1",
      data: {
        orderId: 1,
        orderNumber: "#001",
        tableId: "10",
        items: [],
        totalAmount: 2000,
        orderType: "dine-in",
      },
    },
  };

  console.log("\n1. Connection Acknowledgment");
  console.log(JSON.stringify(serverMessages.connectionAck, null, 2));

  console.log("\n2. Heartbeat");
  console.log(JSON.stringify(serverMessages.heartbeat, null, 2));

  console.log("\n3. New Order Event");
  console.log(JSON.stringify(serverMessages.newOrder, null, 2));
}

/**
 * 主測試流程
 */
async function main() {
  console.clear();

  log("═".repeat(60), "bright");
  log("   即時通訊 WebSocket 連線測試", "bright");
  log("═".repeat(60), "bright");

  logInfo(`API URL: ${API_BASE_URL}`);
  logInfo(`Realtime WS URL: ${REALTIME_WS_URL}`);
  console.log("");

  try {
    // 測試 1: Token 生成
    const tokens = await testTokenGeneration();

    // 測試 2: Token 驗證
    await testTokenVerification(tokens);

    // 測試 3: WebSocket 連線說明
    await testWebSocketConnection(tokens);

    // 測試 4: 訊息格式
    await testMessageFormats();

    // 總結
    logSection("測試總結");

    const successCount = tokens.filter((t) => t.success).length;
    const totalCount = tokens.length;

    if (successCount === totalCount) {
      logSuccess(`所有測試通過 (${successCount}/${totalCount})`);
    } else {
      logWarning(`部分測試失敗 (${successCount}/${totalCount})`);
    }

    console.log("\n下一步:");
    console.log("1. 啟動 API 服務: cd apps/api && pnpm dev");
    console.log("2. 啟動 Realtime 服務: cd apps/realtime && pnpm dev");
    console.log("3. 使用 wscat 測試 WebSocket 連線");
    console.log("4. 測試訂單創建流程並觀察即時廣播");
  } catch (error) {
    logError(`測試執行異常: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// 執行測試
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testTokenGeneration,
  testTokenVerification,
  testWebSocketConnection,
  testMessageFormats,
};

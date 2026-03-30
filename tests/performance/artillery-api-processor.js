/**
 * Artillery API 性能測試處理器
 * 提供自定義函式用於認證、數據生成和測試邏輯
 */

const crypto = require("crypto");
const API_BASE_URL = process.env.API_URL || "http://localhost:8787";

/**
 * 認證用戶（一般用戶）
 */
async function authenticateUser(context, events) {
  const username = context.vars.testUsername || "testuser";
  const password = context.vars.testPassword || "testpass123";

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      context.vars.authToken = data.data.token;
      context.vars.restaurantId = data.data.user.restaurantId;
      context.vars.userId = data.data.user.id;

      events.emit("counter", "auth.user.success", 1);
    } else {
      events.emit("counter", "auth.user.failed", 1);
      console.error(
        "Failed to authenticate user:",
        data.error || response.statusText,
      );
    }
  } catch (error) {
    events.emit("counter", "auth.user.error", 1);
    console.error("Error authenticating user:", error.message);
  }
}

/**
 * 認證管理員
 */
async function authenticateAdmin(context, events) {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin123";

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      context.vars.authToken = data.data.token;
      context.vars.restaurantId = data.data.user.restaurantId;
      context.vars.userId = data.data.user.id;
      context.vars.userRole = data.data.user.role;

      events.emit("counter", "auth.admin.success", 1);
    } else {
      events.emit("counter", "auth.admin.failed", 1);
      console.error(
        "Failed to authenticate admin:",
        data.error || response.statusText,
      );
    }
  } catch (error) {
    events.emit("counter", "auth.admin.error", 1);
    console.error("Error authenticating admin:", error.message);
  }
}

/**
 * 認證廚師
 */
async function authenticateChef(context, events) {
  const username = process.env.CHEF_USERNAME || "chef1";
  const password = process.env.CHEF_PASSWORD || "chef123";

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      context.vars.authToken = data.data.token;
      context.vars.restaurantId = data.data.user.restaurantId;
      context.vars.userId = data.data.user.id;

      events.emit("counter", "auth.chef.success", 1);
    } else {
      events.emit("counter", "auth.chef.failed", 1);
    }
  } catch (error) {
    events.emit("counter", "auth.chef.error", 1);
    console.error("Error authenticating chef:", error.message);
  }
}

/**
 * 生成隨機訂單數據
 */
function generateOrderData(context, events) {
  const restaurantId = context.vars.restaurantId || "1";
  const tableId = Math.floor(Math.random() * 20) + 1;

  const menuItems = [
    {
      menuItemId: 1,
      quantity: Math.floor(Math.random() * 3) + 1,
      notes: "少辣",
    },
    { menuItemId: 2, quantity: Math.floor(Math.random() * 2) + 1, notes: "" },
    { menuItemId: 3, quantity: 1, notes: "不要香菜" },
  ];

  // 隨機選擇 1-3 個菜品
  const itemCount = Math.floor(Math.random() * 3) + 1;
  const selectedItems = menuItems.slice(0, itemCount);

  context.vars.orderData = {
    restaurantId,
    tableId,
    items: selectedItems,
  };

  events.emit("counter", "data.order.generated", 1);
}

/**
 * 生成隨機菜品數據
 */
function generateMenuItemData(context, events) {
  const random = Math.floor(Math.random() * 10000);

  context.vars.menuItemData = {
    name: `測試菜品 ${random}`,
    nameEn: `Test Item ${random}`,
    description: `這是測試菜品 ${random}`,
    categoryId: Math.floor(Math.random() * 5) + 1,
    price: (Math.random() * 100 + 50).toFixed(2),
    isAvailable: true,
    prepTime: Math.floor(Math.random() * 20) + 5,
    spicyLevel: Math.floor(Math.random() * 4),
  };

  events.emit("counter", "data.menu_item.generated", 1);
}

/**
 * 生成隨機用戶數據
 */
function generateUserData(context, events) {
  const timestamp = Date.now();
  const random = crypto.randomInt(10000);

  context.vars.userData = {
    username: `testuser_${timestamp}_${random}`,
    password: "testpass123",
    name: `測試用戶 ${random}`,
    email: `test_${timestamp}_${random}@example.com`,
    role: crypto.randomInt(3) + 2, // 角色 2-4
    restaurantId: context.vars.restaurantId || "1",
    isActive: true,
  };

  events.emit("counter", "data.user.generated", 1);
}

/**
 * 驗證回應時間
 */
function validateResponseTime(context, events) {
  const startTime = context.vars.requestStartTime;
  if (startTime) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // 記錄回應時間
    events.emit("histogram", "custom.response_time", responseTime);

    // 記錄慢請求
    if (responseTime > 1000) {
      events.emit("counter", "slow_requests", 1);
    }

    // 記錄超時請求
    if (responseTime > 10000) {
      events.emit("counter", "timeout_requests", 1);
    }
  }
}

/**
 * 記錄成功的請求
 */
function logSuccessRequest(context, events) {
  events.emit("counter", "requests.success", 1);
}

/**
 * 記錄失敗的請求
 */
function logFailedRequest(context, events) {
  events.emit("counter", "requests.failed", 1);
}

/**
 * 生成隨機數字
 */
function randomNumber() {
  return Math.floor(Math.random() * 100000);
}

/**
 * 生成隨機字串
 */
function randomString(length = 10) {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 設置請求開始時間
 */
function setRequestStartTime(context, events) {
  context.vars.requestStartTime = Date.now();
}

/**
 * 記錄 API 端點指標
 */
function logEndpointMetrics(endpoint) {
  return function (context, events) {
    const startTime = context.vars.requestStartTime;
    if (startTime) {
      const responseTime = Date.now() - startTime;
      events.emit(
        "histogram",
        `endpoint.${endpoint}.response_time`,
        responseTime,
      );
      events.emit("counter", `endpoint.${endpoint}.requests`, 1);
    }
  };
}

/**
 * 模擬思考時間（用戶行為模擬）
 */
function thinkTime(min = 1000, max = 3000) {
  return function (context, events) {
    return new Promise((resolve) => {
      const delay = Math.floor(Math.random() * (max - min + 1)) + min;
      setTimeout(() => {
        events.emit("counter", "think_time.executed", 1);
        resolve();
      }, delay);
    });
  };
}

/**
 * 驗證 JSON 回應格式
 */
function validateJsonResponse(context, events) {
  try {
    if (context.vars.$response && context.vars.$response.body) {
      const body = JSON.parse(context.vars.$response.body);

      // 驗證是否有 success 欄位
      if (typeof body.success !== "undefined") {
        events.emit("counter", "response.valid_format", 1);
      } else {
        events.emit("counter", "response.invalid_format", 1);
      }
    }
  } catch (error) {
    events.emit("counter", "response.parse_error", 1);
  }
}

/**
 * 清理測試數據
 */
async function cleanupTestData(context, events) {
  // 這裡可以添加清理邏輯，例如刪除測試創建的數據
  // 注意：需要管理員權限

  if (
    context.vars.createdResourceIds &&
    context.vars.createdResourceIds.length > 0
  ) {
    events.emit(
      "counter",
      "cleanup.resources_to_clean",
      context.vars.createdResourceIds.length,
    );
  }
}

/**
 * 記錄測試執行階段
 */
function logPhase(phaseName) {
  return function (context, events) {
    events.emit("counter", `phase.${phaseName}`, 1);
    console.log(`Entering phase: ${phaseName}`);
  };
}

// 導出函式供 Artillery 使用
module.exports = {
  // 認證相關
  authenticateUser,
  authenticateAdmin,
  authenticateChef,

  // 數據生成
  generateOrderData,
  generateMenuItemData,
  generateUserData,

  // 性能監控
  validateResponseTime,
  setRequestStartTime,
  logEndpointMetrics,

  // 請求記錄
  logSuccessRequest,
  logFailedRequest,

  // 工具函式
  randomNumber,
  randomString,
  thinkTime,
  validateJsonResponse,
  cleanupTestData,
  logPhase,
};

// 為模板字串提供工具函式
module.exports.$randomNumber = randomNumber;
module.exports.$randomString = randomString;

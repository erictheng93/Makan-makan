/**
 * Artillery API 性能測試處理器
 * 提供自定義函式用於認證、數據生成和測試邏輯
 */

const crypto = require("crypto");
const { execFileSync } = require("child_process");
const path = require("path");

const API_BASE_URL = process.env.API_URL || "http://localhost:8787";
const DEFAULT_RESTAURANT_ID =
  process.env.PERF_TEST_RESTAURANT_ID || "019469a0-0001-7000-8000-000000000001";
const DEFAULT_USERNAME = process.env.PERF_TEST_USERNAME || "perf_owner";
const DEFAULT_PASSWORD = process.env.PERF_TEST_PASSWORD || "password123";
const DEFAULT_ADMIN_USERNAME = process.env.ADMIN_USERNAME || DEFAULT_USERNAME;
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
const DEFAULT_CHEF_USERNAME = process.env.CHEF_USERNAME || "perf_chef";
const DEFAULT_CHEF_PASSWORD = process.env.CHEF_PASSWORD || "password123";
const PERF_USER_POOL_SIZE = Number(process.env.PERF_USER_POOL_SIZE || 50);

const tokenCache = new Map();
const tokenInflight = new Map();

function resolveVar(value, fallback) {
  if (
    value == null ||
    value === "" ||
    (typeof value === "string" && value.includes("$processEnvironment"))
  ) {
    return fallback;
  }

  return value;
}

function shouldSeedLocalFixtures() {
  if (process.env.PERF_SKIP_SEED === "1") return false;
  return (
    API_BASE_URL.includes("localhost") || API_BASE_URL.includes("127.0.0.1")
  );
}

function applyLocalMigrations(repoRoot, persistTo, events) {
  if (process.env.PERF_SKIP_MIGRATIONS === "1") return;

  execFileSync(
    "pnpm",
    [
      "exec",
      "wrangler",
      "d1",
      "migrations",
      "apply",
      "makanmakan-local",
      "--local",
      `--persist-to=${persistTo}`,
      "--config=./apps/api/wrangler.toml",
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: "pipe",
    },
  );
  events.emit("counter", "fixtures.local_migrations.success", 1);
}

function setDefaultVariables(context, events) {
  if (!context.vars.perfUserIndex) {
    context.vars.perfUserIndex = crypto.randomInt(PERF_USER_POOL_SIZE);
  }
  const pooledUsername = `perf_owner_${context.vars.perfUserIndex}`;

  context.vars.testUsername = resolveVar(
    context.vars.testUsername,
    process.env.PERF_TEST_USERNAME ? DEFAULT_USERNAME : pooledUsername,
  );
  context.vars.testPassword = resolveVar(
    context.vars.testPassword,
    DEFAULT_PASSWORD,
  );
  context.vars.restaurantId = resolveVar(
    context.vars.restaurantId,
    DEFAULT_RESTAURANT_ID,
  );
  context.vars.menuItemId = context.vars.menuItemId || 9101;
  context.vars.secondaryMenuItemId = context.vars.secondaryMenuItemId || 9102;
  context.vars.tableId = context.vars.tableId || 9101;
  events.emit("counter", "fixtures.defaults.applied", 1);
}

async function ensurePerformanceFixtures(_context, events) {
  if (!shouldSeedLocalFixtures()) return;

  const repoRoot = path.resolve(__dirname, "../..");
  const seedFile = path.join(__dirname, "performance-seed.sql");
  const persistTo =
    process.env.PERF_D1_PERSIST_TO || "./apps/api/.wrangler/state";

  try {
    applyLocalMigrations(repoRoot, persistTo, events);
    execFileSync(
      "pnpm",
      [
        "exec",
        "wrangler",
        "d1",
        "execute",
        "makanmakan-local",
        "--local",
        `--persist-to=${persistTo}`,
        "--config=./apps/api/wrangler.toml",
        `--file=${seedFile}`,
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: "pipe",
      },
    );
    events.emit("counter", "fixtures.performance_seed.success", 1);
  } catch (error) {
    events.emit("counter", "fixtures.performance_seed.failed", 1);
    const output = [error.stdout, error.stderr].filter(Boolean).join("\n");
    throw new Error(
      `Failed to seed local performance fixtures. Run local D1 migrations before the load gate.\n${output}`,
    );
  }
}

function applyAuthContext(context, auth) {
  context.vars.authToken = auth.token;
  context.vars.restaurantId = auth.restaurantId || DEFAULT_RESTAURANT_ID;
  context.vars.userId = auth.userId;
  context.vars.userRole = auth.userRole;
}

async function loginWithCache(kind, username, password, context, events) {
  // Admin and user scenarios intentionally share the same default fixture
  // account. Cache by username so concurrent scenario startup does not create
  // two same-second JWTs that collide on the sessions.token unique index.
  const cacheKey = username;
  const cached = tokenCache.get(cacheKey);

  if (cached && (!cached.expiresAt || cached.expiresAt - Date.now() > 60_000)) {
    applyAuthContext(context, cached);
    events.emit("counter", `auth.${kind}.cached`, 1);
    return;
  }

  if (tokenInflight.has(cacheKey)) {
    const auth = await tokenInflight.get(cacheKey);
    applyAuthContext(context, auth);
    events.emit("counter", `auth.${kind}.cached`, 1);
    return;
  }

  const loginPromise = login(kind, username, password, events);
  tokenInflight.set(cacheKey, loginPromise);

  try {
    const auth = await loginPromise;
    tokenCache.set(cacheKey, auth);
    applyAuthContext(context, auth);
  } finally {
    tokenInflight.delete(cacheKey);
  }
}

async function login(kind, username, password, events) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });
  clearTimeout(timeout);

  const data = await response.json();

  if (!response.ok || !data.success) {
    events.emit("counter", `auth.${kind}.failed`, 1);
    const error = data.error || response.statusText;
    console.error(`Failed to authenticate ${kind}:`, error);
    throw new Error(`Failed to authenticate ${kind}`);
  }

  events.emit("counter", `auth.${kind}.success`, 1);

  return {
    token: data.data.token,
    restaurantId: data.data.user.restaurantId || DEFAULT_RESTAURANT_ID,
    userId: data.data.user.id,
    userRole: data.data.user.role,
    expiresAt: data.data.expiresAt ? Date.parse(data.data.expiresAt) : null,
  };
}

/**
 * 認證用戶（一般用戶）
 */
async function authenticateUser(context, events) {
  try {
    setDefaultVariables(context, events);
    const username = context.vars.testUsername;
    const password = context.vars.testPassword;
    await loginWithCache("user", username, password, context, events);
  } catch (error) {
    events.emit("counter", "auth.user.error", 1);
    console.error("Error authenticating user:", error.message);
    throw error;
  }
}

/**
 * 認證管理員
 */
async function authenticateAdmin(context, events) {
  try {
    setDefaultVariables(context, events);
    await loginWithCache(
      "admin",
      process.env.ADMIN_USERNAME
        ? DEFAULT_ADMIN_USERNAME
        : context.vars.testUsername,
      DEFAULT_ADMIN_PASSWORD,
      context,
      events,
    );
  } catch (error) {
    events.emit("counter", "auth.admin.error", 1);
    console.error("Error authenticating admin:", error.message);
    throw error;
  }
}

/**
 * 認證廚師
 */
async function authenticateChef(context, events) {
  try {
    if (!context.vars.perfChefIndex) {
      context.vars.perfChefIndex = crypto.randomInt(PERF_USER_POOL_SIZE);
    }
    await loginWithCache(
      "chef",
      process.env.CHEF_USERNAME
        ? DEFAULT_CHEF_USERNAME
        : `perf_chef_${context.vars.perfChefIndex}`,
      DEFAULT_CHEF_PASSWORD,
      context,
      events,
    );
  } catch (error) {
    events.emit("counter", "auth.chef.error", 1);
    console.error("Error authenticating chef:", error.message);
    throw error;
  }
}

/**
 * 生成隨機訂單數據
 */
function generateOrderData(context, events) {
  const restaurantId = context.vars.restaurantId || DEFAULT_RESTAURANT_ID;
  const tableId = Number(context.vars.tableId || 9101);

  const menuItems = [
    {
      menuItemId: Number(context.vars.menuItemId || 9101),
      quantity: Math.floor(Math.random() * 3) + 1,
      notes: "少辣",
    },
    {
      menuItemId: Number(context.vars.secondaryMenuItemId || 9102),
      quantity: Math.floor(Math.random() * 2) + 1,
      notes: "",
    },
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

function callbackifyProcessor(fn) {
  return (context, events, done) => {
    Promise.resolve(fn(context, events))
      .then(() => done?.())
      .catch((error) => done?.(error));
  };
}

// 導出函式供 Artillery 使用
module.exports = {
  // fixture setup
  ensurePerformanceFixtures: callbackifyProcessor(ensurePerformanceFixtures),
  setDefaultVariables: callbackifyProcessor(setDefaultVariables),

  // 認證相關
  authenticateUser: callbackifyProcessor(authenticateUser),
  authenticateAdmin: callbackifyProcessor(authenticateAdmin),
  authenticateChef: callbackifyProcessor(authenticateChef),

  // 數據生成
  generateOrderData: callbackifyProcessor(generateOrderData),
  generateMenuItemData: callbackifyProcessor(generateMenuItemData),
  generateUserData: callbackifyProcessor(generateUserData),

  // 性能監控
  validateResponseTime: callbackifyProcessor(validateResponseTime),
  setRequestStartTime: callbackifyProcessor(setRequestStartTime),
  logEndpointMetrics,

  // 請求記錄
  logSuccessRequest: callbackifyProcessor(logSuccessRequest),
  logFailedRequest: callbackifyProcessor(logFailedRequest),

  // 工具函式
  randomNumber,
  randomString,
  thinkTime,
  validateJsonResponse: callbackifyProcessor(validateJsonResponse),
  cleanupTestData: callbackifyProcessor(cleanupTestData),
  logPhase,
};

// 為模板字串提供工具函式
module.exports.$randomNumber = randomNumber;
module.exports.$randomString = randomString;

# 🔧 MakanMakan 故障排除指南

> **Comprehensive Troubleshooting Guide for Common Issues**

本文檔提供 MakanMakan 系統常見問題的診斷步驟和解決方案，涵蓋部署、運行時、數據庫、網絡等各個方面。

---

## 📋 目錄

- [快速診斷](#快速診斷)
- [部署問題](#部署問題)
- [運行時錯誤](#運行時錯誤)
- [數據庫問題](#數據庫問題)
- [網絡與連接](#網絡與連接)
- [性能問題](#性能問題)
- [安全問題](#安全問題)
- [開發環境問題](#開發環境問題)
- [診斷工具](#診斷工具)

---

## 🚀 快速診斷

### 通用故障排除流程

```
┌─────────────────────────────────────────┐
│         問題發生                        │
└─────────────┬───────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  1. 確認問題範圍                        │
│     - 影響哪些用戶？                    │
│     - 影響哪些功能？                    │
│     - 何時開始出現？                    │
└─────────────┬───────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  2. 檢查系統狀態                        │
│     - Cloudflare Status                 │
│     - Worker 健康檢查                   │
│     - 數據庫連接                        │
└─────────────┬───────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  3. 查看日誌                            │
│     - Worker logs (wrangler tail)       │
│     - Browser console                   │
│     - Slack 錯誤通知                    │
└─────────────┬───────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  4. 複現問題                            │
│     - Staging 環境測試                  │
│     - 本地開發環境測試                  │
└─────────────┬───────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  5. 應用解決方案                        │
│     - 參考本文檔                        │
│     - 測試修復                          │
│     - 部署到生產                        │
└─────────────────────────────────────────┘
```

### 快速健康檢查

```bash
#!/bin/bash
# health-check.sh - 快速系統健康檢查腳本

echo "=== MakanMakan System Health Check ==="

# 1. API Service
echo -n "API Service: "
if curl -s -f https://api.makanmakan.com/info > /dev/null 2>&1; then
  echo "✅ OK"
else
  echo "❌ FAILED"
fi

# 2. Realtime Service
echo -n "Realtime Service: "
if curl -s -f https://realtime.makanmakan.com/health > /dev/null 2>&1; then
  echo "✅ OK"
else
  echo "❌ FAILED"
fi

# 3. Database
echo -n "Database: "
if wrangler d1 execute makanmakan-prod --command "SELECT 1" > /dev/null 2>&1; then
  echo "✅ OK"
else
  echo "❌ FAILED"
fi

# 4. Customer App
echo -n "Customer App: "
if curl -s -f https://makanmakan.com > /dev/null 2>&1; then
  echo "✅ OK"
else
  echo "❌ FAILED"
fi

# 5. Admin Dashboard
echo -n "Admin Dashboard: "
if curl -s -f https://admin.makanmakan.com > /dev/null 2>&1; then
  echo "✅ OK"
else
  echo "❌ FAILED"
fi

echo "=== Health Check Complete ==="
```

---

## 🚢 部署問題

### 問題 1: "Database not found" 錯誤

**症狀**:

```
Error: D1_ERROR: Database not found: database_id 'xxxxxxxx'
```

**原因**:

- `wrangler.toml` 中的 `database_id` 不正確
- 數據庫尚未創建
- 環境配置錯誤

**解決方案**:

```bash
# 1. 列出所有 D1 數據庫
wrangler d1 list

# 2. 如果數據庫不存在，創建它
wrangler d1 create makanmakan-prod

# 3. 複製輸出中的 database_id，更新 wrangler.toml
# apps/api/wrangler.toml
[[env.production.d1_databases]]
binding = "DB"
database_name = "makanmakan-prod"
database_id = "正確的-database-id-在這裡"

# 4. 重新部署
wrangler deploy --env production
```

---

### 問題 2: "JWT_SECRET not set" 錯誤

**症狀**:

```
Error: JWT_SECRET environment variable is required
```

**原因**:

- JWT secret 未設置
- Secret 名稱拼寫錯誤
- 環境配置錯誤

**解決方案**:

```bash
# 1. 生成安全的 JWT secret
openssl rand -hex 32

# 2. 設置 secret
wrangler secret put JWT_SECRET --env production
# 粘貼生成的 secret

# 3. 驗證 secret 已設置
wrangler secret list --env production
# 應該看到 JWT_SECRET 在列表中

# 4. 重新部署（secrets 更新後通常需要）
wrangler deploy --env production
```

**本地開發**:

創建 `.dev.vars` 文件：

```bash
# apps/api/.dev.vars
JWT_SECRET=your-local-development-secret-at-least-32-chars
```

---

### 問題 3: KV Namespace 錯誤

**症狀**:

```
Error: KV namespace not found: namespace_id 'xxxxxxxx'
```

**解決方案**:

```bash
# 1. 創建 KV namespace
wrangler kv:namespace create "CACHE_KV" --env production

# 2. 記錄輸出的 namespace ID
# ✅ Success!
# id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# 3. 更新 wrangler.toml
[[env.production.kv_namespaces]]
binding = "CACHE_KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# 4. 重新部署
wrangler deploy --env production
```

---

### 問題 4: 部署卡住或超時

**症狀**:

- 部署命令長時間無響應
- 超時錯誤

**解決方案**:

```bash
# 1. 檢查網絡連接
ping cloudflare.com

# 2. 檢查 Cloudflare API 狀態
curl -I https://api.cloudflare.com/client/v4/accounts

# 3. 清除本地緩存
rm -rf .wrangler/
rm -rf node_modules/.cache/

# 4. 重新認證
wrangler logout
wrangler login

# 5. 使用 verbose 模式部署以查看詳細信息
wrangler deploy --env production --verbose

# 6. 如果持續失敗，嘗試分步部署
cd apps/api && wrangler deploy --env production
cd apps/realtime && wrangler deploy --env production
```

---

### 問題 5: 遷移失敗

**症狀**:

```
Error: Migration failed: table 'users' already exists
```

**解決方案**:

```bash
# 1. 檢查數據庫當前狀態
wrangler d1 execute makanmakan-prod --command "SELECT name FROM sqlite_master WHERE type='table';"

# 2. 查看已應用的遷移
wrangler d1 migrations list makanmakan-prod

# 3. 如果需要，回滾到特定遷移
# ⚠️ 危險操作！僅在測試環境使用
wrangler d1 execute makanmakan-staging --command "DELETE FROM d1_migrations WHERE name='0002_add_new_table.sql';"

# 4. 創建修復遷移而不是直接修改舊遷移
wrangler d1 migrations create fix-table-issue

# 5. 重新應用遷移
wrangler d1 migrations apply makanmakan-prod
```

---

## 🔥 運行時錯誤

### 問題 6: 500 Internal Server Error

**症狀**:

- API 返回 500 錯誤
- 用戶無法完成操作

**診斷**:

```bash
# 1. 查看實時日誌
wrangler tail makanmakan-api-prod

# 2. 過濾錯誤日誌
wrangler tail makanmakan-api-prod --status error

# 3. 搜索特定端點的錯誤
wrangler tail makanmakan-api-prod | grep "/api/v1/orders"

# 4. 檢查 Slack 錯誤通知
# 查看 #errors 頻道
```

**常見原因與解決方案**:

#### 原因 1: 數據庫查詢錯誤

```javascript
// 錯誤：未處理的 Promise rejection
const user = await db.query("SELECT * FROM users WHERE id = ?", [userId]);

// 修復：添加錯誤處理
try {
  const user = await db.query("SELECT * FROM users WHERE id = ?", [userId]);
  if (!user) {
    throw new Error("User not found");
  }
} catch (error) {
  console.error("Database error:", error);
  return new Response(JSON.stringify({ error: "Database error" }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}
```

#### 原因 2: 未捕獲的異常

```javascript
// 在 Worker 中添加全局錯誤處理
export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env, ctx);
    } catch (error) {
      console.error("Unhandled error:", error);

      // 發送錯誤到 Slack
      await notifySlack(error, env.SLACK_WEBHOOK_URL);

      return new Response(
        JSON.stringify({
          error: "Internal server error",
          requestId: crypto.randomUUID(),
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  },
};
```

---

### 問題 7: 401 Unauthorized 錯誤

**症狀**:

- 用戶無法登入
- API 請求被拒絕

**診斷**:

```bash
# 測試登入端點
curl -v -X POST https://api.makanmakan.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test@example.com","password":"test123"}'

# 查看返回的錯誤信息
```

**常見原因與解決方案**:

#### 原因 1: JWT Secret 不匹配

```bash
# 1. 驗證 JWT_SECRET 是否設置
wrangler secret list --env production

# 2. 如果需要，重新設置
openssl rand -hex 32
wrangler secret put JWT_SECRET --env production

# 3. 重啟 Worker
wrangler deploy --env production
```

#### 原因 2: Token 過期

```javascript
// 檢查 token 過期時間配置
const TOKEN_EXPIRY = 24 * 60 * 60; // 24 小時

// 在 JWT payload 中添加過期時間
const payload = {
  userId: user.id,
  role: user.role,
  exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRY,
};
```

#### 原因 3: CORS 問題

```javascript
// 確保 CORS headers 正確設置
const corsHeaders = {
  "Access-Control-Allow-Origin": env.CORS_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

// OPTIONS 請求處理
if (request.method === "OPTIONS") {
  return new Response(null, { headers: corsHeaders });
}
```

---

### 問題 8: WebSocket 連接失敗

**症狀**:

- 無法建立 WebSocket 連接
- 連接立即斷開
- 實時更新不工作

**診斷**:

```javascript
// 在瀏覽器控制台測試
const ws = new WebSocket("wss://realtime.makanmakan.com/customer/table-123");

ws.onopen = () => console.log("✅ Connected");
ws.onerror = (error) => console.error("❌ Error:", error);
ws.onclose = (event) =>
  console.log("Connection closed:", event.code, event.reason);
```

**解決方案**:

#### 原因 1: Durable Object 未正確配置

```bash
# 1. 檢查 wrangler.toml 配置
cat apps/realtime/wrangler.toml | grep -A 5 "durable_objects"

# 2. 確保 migration 已應用
# apps/realtime/wrangler.toml 應該包含:
[[migrations]]
tag = "v1"
new_classes = ["RealtimeSession"]

# 3. 重新部署
cd apps/realtime
wrangler deploy --env production
```

#### 原因 2: WebSocket Upgrade 失敗

```javascript
// 在 Durable Object 中正確處理 WebSocket upgrade
async fetch(request) {
  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 });
  }

  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  this.handleSession(server, request);

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}
```

#### 原因 3: 認證失敗

```javascript
// 在 WebSocket 連接時驗證 token
const url = new URL(request.url);
const token = url.searchParams.get("token");

if (!token) {
  return new Response("Missing authentication token", { status: 401 });
}

try {
  const payload = await verifyJWT(token, env.JWT_SECRET);
  // 繼續處理連接
} catch (error) {
  return new Response("Invalid token", { status: 401 });
}
```

---

## 💾 數據庫問題

### 問題 9: "Database locked" 錯誤

**症狀**:

```
Error: SQLITE_BUSY: database is locked
```

**原因**:

- 同時有太多寫入操作
- 長時間運行的事務
- D1 並發限制

**解決方案**:

```javascript
// 1. 使用重試機制
async function queryWithRetry(db, sql, params, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await db
        .prepare(sql)
        .bind(...params)
        .all();
    } catch (error) {
      if (error.message.includes("SQLITE_BUSY") && i < maxRetries - 1) {
        // 指數退避
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, i) * 100),
        );
        continue;
      }
      throw error;
    }
  }
}

// 2. 使用批處理減少寫入次數
const batch = [
  db
    .prepare("INSERT INTO orders (id, restaurant_id) VALUES (?, ?)")
    .bind(1, 100),
  db
    .prepare("INSERT INTO order_items (order_id, item_id) VALUES (?, ?)")
    .bind(1, 200),
];
await db.batch(batch);

// 3. 優化事務使用
// 避免長時間持有事務
await db.prepare("BEGIN TRANSACTION").run();
try {
  // 快速執行操作
  await db.prepare("INSERT ...").run();
  await db.prepare("UPDATE ...").run();
  await db.prepare("COMMIT").run();
} catch (error) {
  await db.prepare("ROLLBACK").run();
  throw error;
}
```

---

### 問題 10: 查詢性能慢

**症狀**:

- 查詢耗時超過 1 秒
- 用戶體驗卡頓

**診斷**:

```bash
# 1. 查看查詢執行計劃
wrangler d1 execute makanmakan-prod --command "EXPLAIN QUERY PLAN SELECT * FROM orders WHERE restaurant_id = 1;"

# 2. 檢查是否使用索引
# 輸出應該顯示 "USING INDEX" 而不是 "SCAN TABLE"
```

**解決方案**:

```sql
-- 1. 添加適當的索引
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- 2. 使用複合索引
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status
ON orders(restaurant_id, status, created_at);

-- 3. 分析表統計信息
ANALYZE orders;
ANALYZE order_items;
```

```javascript
// 4. 使用分頁減少數據量
const PAGE_SIZE = 50;
const offset = (page - 1) * PAGE_SIZE;

const query = `
  SELECT * FROM orders
  WHERE restaurant_id = ?
  ORDER BY created_at DESC
  LIMIT ? OFFSET ?
`;
const result = await db
  .prepare(query)
  .bind(restaurantId, PAGE_SIZE, offset)
  .all();

// 5. 使用 KV 緩存頻繁查詢的數據
const cacheKey = `restaurant:${restaurantId}:menu`;
let menu = await env.CACHE_KV.get(cacheKey, "json");

if (!menu) {
  menu = await db
    .prepare("SELECT * FROM menu_items WHERE restaurant_id = ?")
    .bind(restaurantId)
    .all();
  await env.CACHE_KV.put(cacheKey, JSON.stringify(menu), {
    expirationTtl: 300,
  });
}
```

---

### 問題 11: 數據遺失或不一致

**症狀**:

- 訂單數據不完整
- 庫存不準確
- 數據出現重複

**診斷**:

```sql
-- 1. 檢查數據完整性
SELECT COUNT(*) FROM orders WHERE restaurant_id IS NULL;
SELECT COUNT(*) FROM order_items WHERE order_id NOT IN (SELECT id FROM orders);

-- 2. 檢查重複數據
SELECT id, COUNT(*) FROM orders GROUP BY id HAVING COUNT(*) > 1;

-- 3. 檢查外鍵約束
PRAGMA foreign_key_list(order_items);
```

**解決方案**:

```javascript
// 1. 使用事務確保原子性
async function createOrder(db, orderData) {
  try {
    await db.prepare("BEGIN TRANSACTION").run();

    // 插入訂單
    const orderResult = await db.prepare(
      "INSERT INTO orders (restaurant_id, table_id, total) VALUES (?, ?, ?)"
    ).bind(orderData.restaurantId, orderData.tableId, orderData.total).run();

    const orderId = orderResult.meta.last_row_id;

    // 插入訂單項目
    for (const item of orderData.items) {
      await db.prepare(
        "INSERT INTO order_items (order_id, menu_item_id, quantity, price) VALUES (?, ?, ?, ?)"
      ).bind(orderId, item.menuItemId, item.quantity, item.price).run();
    }

    // 更新庫存
    for (const item of orderData.items) {
      await db.prepare(
        "UPDATE menu_items SET stock = stock - ? WHERE id = ?"
      ).bind(item.quantity, item.menuItemId).run();
    }

    await db.prepare("COMMIT").run();
    return orderId;
  } catch (error) {
    await db.prepare("ROLLBACK").run();
    throw error;
  }
}

// 2. 使用唯一約束防止重複
// 在 schema 中定義
CREATE UNIQUE INDEX idx_unique_order_id ON orders(id);

// 3. 定期運行數據一致性檢查
async function checkDataIntegrity(db) {
  // 檢查孤立的訂單項目
  const orphanedItems = await db.prepare(`
    SELECT COUNT(*) as count FROM order_items
    WHERE order_id NOT IN (SELECT id FROM orders)
  `).first();

  if (orphanedItems.count > 0) {
    console.warn(`Found ${orphanedItems.count} orphaned order items`);
    // 發送警報
  }
}
```

---

## 🌐 網絡與連接

### 問題 12: CORS 錯誤

**症狀**:

```
Access to fetch at 'https://api.makanmakan.com' from origin 'https://makanmakan.com'
has been blocked by CORS policy
```

**解決方案**:

```javascript
// 1. 在 Worker 中正確配置 CORS
function handleCORS(request, response) {
  const origin = request.headers.get("Origin");
  const allowedOrigins = [
    "https://makanmakan.com",
    "https://admin.makanmakan.com",
    "https://kitchen.makanmakan.com",
  ];

  if (allowedOrigins.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }

  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );
  response.headers.set("Access-Control-Max-Age", "86400");

  return response;
}

// 2. 處理 OPTIONS preflight 請求
if (request.method === "OPTIONS") {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}
```

**Development 環境**:

```javascript
// 在開發環境允許所有來源
const corsHeaders =
  env.NODE_ENV === "development"
    ? { "Access-Control-Allow-Origin": "*" }
    : { "Access-Control-Allow-Origin": "https://makanmakan.com" };
```

---

### 問題 13: Rate Limiting 過於嚴格

**症狀**:

- 正常用戶被限流
- 返回 429 Too Many Requests

**診斷**:

```bash
# 查看 rate limit 配置
cat apps/api/wrangler.toml | grep RATE_LIMIT

# 測試 rate limit
for i in {1..110}; do
  echo -n "$i: "
  curl -s -o /dev/null -w "%{http_code}\n" https://api.makanmakan.com/info
done
```

**解決方案**:

```javascript
// 1. 調整 rate limit 策略
async function checkRateLimit(ip, env) {
  const key = `ratelimit:${ip}`;
  const limit = 100; // 每分鐘請求數
  const window = 60; // 秒

  const count = await env.RATE_LIMIT_KV.get(key);

  if (count && parseInt(count) >= limit) {
    return { allowed: false, remaining: 0 };
  }

  const newCount = count ? parseInt(count) + 1 : 1;
  await env.RATE_LIMIT_KV.put(key, newCount.toString(), {
    expirationTtl: window,
  });

  return { allowed: true, remaining: limit - newCount };
}

// 2. 為認證用戶提供更高限制
async function getRateLimit(request, env) {
  const token = request.headers.get("Authorization");

  if (token) {
    // 認證用戶：1000 requests/min
    return { limit: 1000, window: 60 };
  } else {
    // 未認證用戶：100 requests/min
    return { limit: 100, window: 60 };
  }
}

// 3. 白名單特定 IP
const WHITELIST_IPS = ["1.2.3.4", "5.6.7.8"];
if (WHITELIST_IPS.includes(clientIP)) {
  // 跳過 rate limiting
  return await handleRequest(request);
}
```

---

### 問題 14: 超時錯誤

**症狀**:

```
Error: The script took too much time
```

**原因**:

- Cloudflare Workers CPU 時間限制（10ms 免費版，50ms 付費版）
- 複雜計算或大量數據處理

**解決方案**:

```javascript
// 1. 使用 ctx.waitUntil() 進行後台處理
export default {
  async fetch(request, env, ctx) {
    const response = await handleRequest(request, env);

    // 不阻塞響應的後台任務
    ctx.waitUntil(sendAnalytics(request, env));

    return response;
  },
};

// 2. 將大任務分解為多個小任務
async function processLargeDataset(data, env) {
  const BATCH_SIZE = 100;

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    await processBatch(batch, env);

    // 給其他請求讓路
    if (i % 500 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
}

// 3. 使用 Durable Objects 處理長時間運行的任務
// 將複雜任務委託給 Durable Object
const id = env.TASK_PROCESSOR.idFromName("long-task");
const stub = env.TASK_PROCESSOR.get(id);
await stub.fetch(request);
```

---

## ⚡ 性能問題

### 問題 15: 響應時間過長

**症狀**:

- API 響應時間 > 1 秒
- 用戶體驗卡頓

**診斷**:

```bash
# 1. 使用 curl 測量響應時間
curl -w "\nTime: %{time_total}s\n" https://api.makanmakan.com/api/v1/menu/1

# 2. 查看 Cloudflare Analytics
# Dashboard → Workers & Pages → Analytics → Performance

# 3. 在代碼中添加性能追蹤
```

```javascript
// 性能追蹤中間件
async function trackPerformance(request, handler) {
  const start = Date.now();

  try {
    const response = await handler(request);
    const duration = Date.now() - start;

    // 記錄慢請求
    if (duration > 1000) {
      console.warn(`Slow request: ${request.url} took ${duration}ms`);
    }

    // 添加性能 header
    response.headers.set("X-Response-Time", `${duration}ms`);

    return response;
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`Failed request: ${request.url} took ${duration}ms`);
    throw error;
  }
}
```

**解決方案**:

```javascript
// 1. 實現多層緩存
async function getMenu(restaurantId, env) {
  // L1: 內存緩存 (Worker 實例級別)
  if (memoryCache.has(restaurantId)) {
    return memoryCache.get(restaurantId);
  }

  // L2: KV 緩存 (全局)
  const cacheKey = `menu:${restaurantId}`;
  const cached = await env.CACHE_KV.get(cacheKey, "json");
  if (cached) {
    memoryCache.set(restaurantId, cached);
    return cached;
  }

  // L3: 數據庫
  const menu = await db
    .prepare("SELECT * FROM menu_items WHERE restaurant_id = ?")
    .bind(restaurantId)
    .all();

  // 更新緩存
  await env.CACHE_KV.put(cacheKey, JSON.stringify(menu), {
    expirationTtl: 300,
  });
  memoryCache.set(restaurantId, menu);

  return menu;
}

// 2. 並行請求
async function getDashboardData(restaurantId, env, db) {
  const [orders, menu, stats] = await Promise.all([
    getOrders(restaurantId, db),
    getMenu(restaurantId, env, db),
    getStatistics(restaurantId, db),
  ]);

  return { orders, menu, stats };
}

// 3. 使用 SELECT 指定需要的列
// ❌ 不好：查詢所有列
const orders = await db.prepare("SELECT * FROM orders").all();

// ✅ 好：只查詢需要的列
const orders = await db
  .prepare("SELECT id, restaurant_id, total, created_at FROM orders")
  .all();
```

---

### 問題 16: 內存超限

**症狀**:

```
Error: Worker exceeded memory limit
```

**解決方案**:

```javascript
// 1. 使用流式處理大文件
async function handleLargeUpload(request) {
  const reader = request.body.getReader();
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // 處理 chunk
    await processChunk(value);
    // 不要存儲所有 chunks
  }
}

// 2. 分批處理數據
async function exportOrders(restaurantId, db) {
  const BATCH_SIZE = 1000;
  let offset = 0;

  while (true) {
    const batch = await db
      .prepare("SELECT * FROM orders WHERE restaurant_id = ? LIMIT ? OFFSET ?")
      .bind(restaurantId, BATCH_SIZE, offset)
      .all();

    if (batch.results.length === 0) break;

    // 處理並發送 batch
    await processBatch(batch.results);

    offset += BATCH_SIZE;
  }
}

// 3. 及時釋放大對象
let largeData = await fetchLargeData();
const processedData = processData(largeData);
largeData = null; // 幫助 GC 回收

return processedData;
```

---

## 🔒 安全問題

### 問題 17: SQL 注入風險

**症狀**:

- 用戶輸入未經過濾直接用於 SQL 查詢

**預防**:

```javascript
// ❌ 危險：SQL 注入風險
const userId = request.params.id;
const query = `SELECT * FROM users WHERE id = ${userId}`;
const user = await db.prepare(query).first();

// ✅ 安全：使用參數化查詢
const userId = request.params.id;
const user = await db
  .prepare("SELECT * FROM users WHERE id = ?")
  .bind(userId)
  .first();

// ✅ 安全：輸入驗證
function validateUserId(id) {
  if (typeof id !== "number" || id <= 0 || !Number.isInteger(id)) {
    throw new Error("Invalid user ID");
  }
  return id;
}

const userId = validateUserId(parseInt(request.params.id));
const user = await db
  .prepare("SELECT * FROM users WHERE id = ?")
  .bind(userId)
  .first();
```

---

### 問題 18: XSS 攻擊

**預防**:

```javascript
// 1. 淨化用戶輸入
import DOMPurify from "isomorphic-dompurify";

function sanitizeInput(input) {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ["b", "i", "em", "strong"],
    ALLOWED_ATTR: [],
  });
}

// 2. 設置安全 headers
const securityHeaders = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

// 3. 在前端 escaping
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
```

---

## 🛠️ 開發環境問題

### 問題 19: pnpm install 失敗

**症狀**:

```
ERR_PNPM_PEER_DEP_ISSUES  Unmet peer dependencies
```

**解決方案**:

```bash
# 1. 清除緩存
pnpm store prune

# 2. 刪除 node_modules 和 lock file
rm -rf node_modules pnpm-lock.yaml

# 3. 重新安裝
pnpm install

# 4. 如果使用 --shamefully-hoist
pnpm install --shamefully-hoist

# 5. 更新 pnpm
npm install -g pnpm@latest
```

---

### 問題 20: TypeScript 編譯錯誤

**症狀**:

```
error TS2307: Cannot find module '@makanmakan/shared-types'
```

**解決方案**:

```bash
# 1. 構建依賴的 packages
pnpm run build --filter @makanmakan/shared-types

# 2. 或構建所有 packages
pnpm run build

# 3. 清除 TypeScript 緩存
rm -rf apps/*/tsconfig.tsbuildinfo
rm -rf packages/*/tsconfig.tsbuildinfo

# 4. 重新編譯
pnpm run typecheck
```

---

### 問題 21: 本地開發端口衝突

**症狀**:

```
Error: listen EADDRINUSE: address already in use :::8787
```

**解決方案**:

```bash
# 1. 查找佔用端口的進程 (Linux/Mac)
lsof -i :8787

# 2. 查找佔用端口的進程 (Windows)
netstat -ano | findstr :8787

# 3. 終止進程 (Linux/Mac)
kill -9 <PID>

# 4. 終止進程 (Windows)
taskkill /PID <PID> /F

# 5. 或修改開發端口
# apps/api/wrangler.toml
[dev]
port = 8788  # 改為其他端口
```

---

## 🔍 診斷工具

### 工具 1: 日誌分析腳本

```bash
#!/bin/bash
# analyze-logs.sh - 分析 Worker 日誌

# 查看最近 100 條日誌
wrangler tail makanmakan-api-prod --format=pretty | head -n 100

# 只看錯誤
wrangler tail makanmakan-api-prod --status=error

# 統計錯誤類型
wrangler tail makanmakan-api-prod --status=error | \
  grep -oP '"message":"[^"]*"' | \
  sort | uniq -c | sort -rn

# 監控特定端點
wrangler tail makanmakan-api-prod | grep "/api/v1/orders"
```

---

### 工具 2: 數據庫健康檢查

```sql
-- db-health-check.sql

-- 1. 檢查表大小
SELECT
  name,
  (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=m.name) as exists,
  (SELECT COUNT(*) FROM (SELECT 1 FROM sqlite_master WHERE type='table' AND name=m.name LIMIT 1)) as has_rows
FROM sqlite_master m
WHERE type='table';

-- 2. 檢查索引使用
SELECT
  name,
  tbl_name,
  sql
FROM sqlite_master
WHERE type='index';

-- 3. 檢查數據完整性
PRAGMA integrity_check;

-- 4. 查看表統計
SELECT * FROM sqlite_stat1;
```

```bash
# 運行檢查
wrangler d1 execute makanmakan-prod --file=db-health-check.sql
```

---

### 工具 3: 性能基準測試

```bash
#!/bin/bash
# benchmark.sh - API 性能基準測試

API_URL="https://api.makanmakan.com"
ENDPOINTS=(
  "/info"
  "/api/v1/restaurants/1/menu"
  "/api/v1/orders?page=1&limit=20"
)

echo "=== API Performance Benchmark ==="
echo "Target: $API_URL"
echo ""

for endpoint in "${ENDPOINTS[@]}"; do
  echo "Testing: $endpoint"

  # 測試 10 次並計算平均值
  total=0
  for i in {1..10}; do
    time=$(curl -s -w "%{time_total}" -o /dev/null "$API_URL$endpoint")
    total=$(echo "$total + $time" | bc)
  done

  avg=$(echo "scale=3; $total / 10" | bc)
  echo "Average response time: ${avg}s"
  echo ""
done
```

---

### 工具 4: 自動化故障排除腳本

```bash
#!/bin/bash
# auto-troubleshoot.sh - 自動診斷常見問題

echo "=== MakanMakan Auto Troubleshoot ==="

# 1. 檢查 API 健康
echo -n "API Health: "
if curl -sf "$API_URL/info" > /dev/null; then
  echo "✅ OK"
else
  echo "❌ FAILED"
  echo "Checking logs..."
  wrangler tail makanmakan-api-prod --status=error | head -n 20
fi

# 2. 檢查數據庫連接
echo -n "Database: "
if wrangler d1 execute makanmakan-prod --command "SELECT 1" > /dev/null 2>&1; then
  echo "✅ OK"
else
  echo "❌ FAILED"
  echo "Check database configuration in wrangler.toml"
fi

# 3. 檢查 Secrets
echo "Checking secrets..."
wrangler secret list --env production

# 4. 檢查最近部署
echo "Recent deployments:"
wrangler deployments list --name makanmakan-api-prod | head -n 5

echo ""
echo "=== Troubleshooting Complete ==="
```

---

## 📞 獲取幫助

### 聯繫渠道

1. **內部文檔**:
   - [部署指南](./DEPLOYMENT_GUIDE.md)
   - [架構文檔](../architecture/technical-documentation.md)

2. **開發團隊**:
   - Slack: #makanmakan-support
   - Email: dev@makanmakan.com

3. **外部資源**:
   - Cloudflare Workers 文檔: https://developers.cloudflare.com/workers/
   - Cloudflare Community: https://community.cloudflare.com/
   - GitHub Issues: https://github.com/your-org/makanmakan/issues

### 報告問題模板

```markdown
## 問題描述

簡要描述遇到的問題

## 複現步驟

1.
2.
3.

## 預期行為

描述應該發生什麼

## 實際行為

描述實際發生什麼

## 環境信息

- Environment: Production / Staging / Development
- Browser (if applicable):
- Worker version:
- Time of occurrence:

## 日誌輸出
```

粘貼相關日誌

```

## 已嘗試的解決方案
列出已經嘗試過的故障排除步驟
```

---

**最後更新**: 2025-11-11
**維護者**: MakanMakan DevOps Team
**版本**: 2.0.0

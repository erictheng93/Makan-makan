# 測試補強與 API 文檔化完整實施計劃

**文檔版本**: 1.0
**創建日期**: 2025-11-13
**預計完成**: 2025-12-06 (3 週)
**負責團隊**: 開發團隊

---

## 📋 執行摘要

本文檔提供完整的實施計劃，用於：

1. ✅ 補充 45+ 個測試檔案（Realtime & Kitchen Display）
2. ✅ 建立 OpenAPI 3.x 規範文檔覆蓋所有 API
3. ✅ 配置測試覆蓋率門檻到 CI/CD

**目標**:

- 測試分布均衡度：30% → 85%
- API 文檔化程度：0% → 100%
- 測試覆蓋率：達到 85-90%

---

## 🎯 第一階段：基礎設施準備（已完成）

### ✅ 已完成項目

1. **OpenAPI 工具安裝**

   ```bash
   # 已安裝
   @hono/swagger-ui ^0.5.2
   @hono/zod-openapi ^1.1.4
   zod ^3.25.76
   ```

2. **目錄結構創建**
   ```
   apps/realtime/src/__tests__/unit/
   apps/kitchen-display/src/__tests__/unit/components/
   apps/api/docs/openapi/
   ```

---

## 🧪 第二階段：Realtime Services 測試補充（20 個測試）

### 目標結構

```
apps/realtime/src/__tests__/
├── unit/                          # 單元測試（15 個）
│   ├── connection/                # WebSocket 連接管理（5 個）
│   │   ├── connection-manager.test.ts
│   │   ├── heartbeat.test.ts
│   │   ├── reconnection-strategy.test.ts
│   │   ├── connection-pool.test.ts
│   │   └── connection-lifecycle.test.ts
│   │
│   ├── auth/                      # JWT 認證邏輯（5 個）
│   │   ├── jwt-validator.test.ts
│   │   ├── token-generation.test.ts
│   │   ├── token-refresh.test.ts
│   │   ├── auth-middleware.test.ts
│   │   └── auth-error-handling.test.ts
│   │
│   └── routing/                   # 訊息路由（5 個）
│       ├── message-router.test.ts
│       ├── room-management.test.ts
│       ├── broadcast-logic.test.ts
│       ├── role-based-routing.test.ts
│       └── event-filtering.test.ts
│
└── integration/                   # 整合測試（5 個）
    ├── offline-recovery.test.ts
    ├── connection-stress.test.ts
    ├── multi-client.test.ts
    ├── event-history.test.ts
    └── cross-room-communication.test.ts
```

### 範例測試模板

#### 1. WebSocket 連接管理測試範例

```typescript
// apps/realtime/src/__tests__/unit/connection/connection-manager.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConnectionManager } from "@/services/ConnectionManager";
import type { WebSocket } from "@cloudflare/workers-types";

describe("ConnectionManager", () => {
  let connectionManager: ConnectionManager;
  let mockWebSocket: WebSocket;

  beforeEach(() => {
    connectionManager = new ConnectionManager();
    mockWebSocket = {
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as WebSocket;
  });

  describe("addConnection", () => {
    it("應該成功添加新連接", () => {
      const clientId = "client-123";
      connectionManager.addConnection(clientId, mockWebSocket);

      expect(connectionManager.hasConnection(clientId)).toBe(true);
      expect(connectionManager.getConnectionCount()).toBe(1);
    });

    it("應該拒絕重複的 clientId", () => {
      const clientId = "client-123";
      connectionManager.addConnection(clientId, mockWebSocket);

      expect(() => {
        connectionManager.addConnection(clientId, mockWebSocket);
      }).toThrow("Connection already exists");
    });

    it("應該正確處理多個並發連接", () => {
      for (let i = 0; i < 100; i++) {
        connectionManager.addConnection(`client-${i}`, mockWebSocket);
      }

      expect(connectionManager.getConnectionCount()).toBe(100);
    });
  });

  describe("removeConnection", () => {
    it("應該成功移除存在的連接", () => {
      const clientId = "client-123";
      connectionManager.addConnection(clientId, mockWebSocket);
      connectionManager.removeConnection(clientId);

      expect(connectionManager.hasConnection(clientId)).toBe(false);
    });

    it("移除不存在的連接時不應拋出錯誤", () => {
      expect(() => {
        connectionManager.removeConnection("non-existent");
      }).not.toThrow();
    });
  });

  describe("broadcast", () => {
    it("應該向所有連接廣播訊息", () => {
      const clients = ["client-1", "client-2", "client-3"];
      const mockWs = {
        send: vi.fn(),
      } as unknown as WebSocket;

      clients.forEach((id) => {
        connectionManager.addConnection(id, mockWs);
      });

      const message = { type: "test", data: "hello" };
      connectionManager.broadcast(message);

      expect(mockWs.send).toHaveBeenCalledTimes(3);
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
  });
});
```

#### 2. JWT 認證測試範例

```typescript
// apps/realtime/src/__tests__/unit/auth/jwt-validator.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { JWTValidator } from "@/auth/JWTValidator";
import { sign } from "jsonwebtoken";

describe("JWTValidator", () => {
  let validator: JWTValidator;
  const SECRET = "test-secret";

  beforeEach(() => {
    validator = new JWTValidator(SECRET);
  });

  describe("validate", () => {
    it("應該驗證有效的 JWT token", async () => {
      const payload = {
        userId: "user-123",
        role: "admin",
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      const token = sign(payload, SECRET);

      const result = await validator.validate(token);

      expect(result.valid).toBe(true);
      expect(result.payload).toMatchObject({
        userId: "user-123",
        role: "admin",
      });
    });

    it("應該拒絕過期的 token", async () => {
      const payload = {
        userId: "user-123",
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 小時前過期
      };
      const token = sign(payload, SECRET);

      const result = await validator.validate(token);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Token expired");
    });

    it("應該拒絕簽名不正確的 token", async () => {
      const payload = { userId: "user-123" };
      const token = sign(payload, "wrong-secret");

      const result = await validator.validate(token);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid signature");
    });

    it("應該處理格式錯誤的 token", async () => {
      const invalidToken = "not.a.valid.jwt";

      const result = await validator.validate(invalidToken);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid token format");
    });
  });

  describe("refresh", () => {
    it("應該生成新的 token 並保留 userId", async () => {
      const originalPayload = {
        userId: "user-123",
        role: "user",
      };
      const originalToken = sign(originalPayload, SECRET);

      const newToken = await validator.refresh(originalToken);
      const validation = await validator.validate(newToken);

      expect(validation.valid).toBe(true);
      expect(validation.payload?.userId).toBe("user-123");
    });
  });
});
```

---

## 🍳 第三階段：Kitchen Display 測試補充（25 個測試）

### 目標結構

```
apps/kitchen-display/src/__tests__/
├── unit/                              # 單元測試（20 個）
│   ├── components/                    # Vue 組件測試（10 個）
│   │   ├── OrderCard.test.ts
│   │   ├── OrderQueue.test.ts
│   │   ├── OrderFilters.test.ts
│   │   ├── StatusBadge.test.ts
│   │   ├── TimerDisplay.test.ts
│   │   ├── ItemList.test.ts
│   │   ├── ActionButtons.test.ts
│   │   ├── AlertBanner.test.ts
│   │   ├── StatsPanel.test.ts
│   │   └── SettingsModal.test.ts
│   │
│   ├── stores/                        # Pinia Store 測試（5 個）
│   │   ├── ordersStore.test.ts
│   │   ├── settingsStore.test.ts
│   │   ├── audioStore.test.ts
│   │   ├── filtersStore.test.ts
│   │   └── statsStore.test.ts
│   │
│   └── services/                      # 服務邏輯測試（5 個）
│       ├── orderService.test.ts
│       ├── audioService.test.ts
│       ├── persistenceService.test.ts
│       ├── syncService.test.ts
│       └── notificationService.test.ts
│
└── e2e/                               # E2E 測試（5 個）
    ├── complete-order-flow.spec.ts
    ├── multi-order-handling.spec.ts
    ├── offline-mode.spec.ts
    ├── keyboard-shortcuts.spec.ts
    └── filters-and-sorting.spec.ts
```

### 範例測試模板

#### 1. Vue 組件測試範例

```typescript
// apps/kitchen-display/src/__tests__/unit/components/OrderCard.test.ts
import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import OrderCard from "@/components/OrderCard.vue";
import type { Order } from "@makanmasak/shared-types";

describe("OrderCard.vue", () => {
  const createWrapper = (order: Partial<Order> = {}) => {
    const mockOrder: Order = {
      id: 1,
      order_number: "ORD-001",
      table_number: "5",
      status: "pending",
      items: [
        { id: 1, name: "牛肉麵", quantity: 2, notes: "少辣" },
        { id: 2, name: "珍珠奶茶", quantity: 1, notes: "" },
      ],
      created_at: new Date("2025-11-13T10:00:00").toISOString(),
      ...order,
    };

    return mount(OrderCard, {
      props: { order: mockOrder },
      global: {
        plugins: [createPinia()],
      },
    });
  };

  describe("顯示訂單資訊", () => {
    it("應該顯示訂單編號", () => {
      const wrapper = createWrapper();

      expect(wrapper.find('[data-testid="order-number"]').text()).toBe(
        "ORD-001",
      );
    });

    it("應該顯示桌號", () => {
      const wrapper = createWrapper();

      expect(wrapper.find('[data-testid="table-number"]').text()).toContain(
        "5",
      );
    });

    it("應該顯示所有訂單項目", () => {
      const wrapper = createWrapper();
      const items = wrapper.findAll('[data-testid="order-item"]');

      expect(items).toHaveLength(2);
      expect(items[0].text()).toContain("牛肉麵");
      expect(items[0].text()).toContain("x2");
      expect(items[1].text()).toContain("珍珠奶茶");
    });

    it("應該顯示特殊備註", () => {
      const wrapper = createWrapper();

      expect(wrapper.find('[data-testid="order-notes"]').text()).toContain(
        "少辣",
      );
    });
  });

  describe("狀態管理", () => {
    it("pending 狀態應該顯示「待處理」樣式", () => {
      const wrapper = createWrapper({ status: "pending" });

      expect(wrapper.find('[data-testid="status-badge"]').classes()).toContain(
        "status-pending",
      );
    });

    it("preparing 狀態應該顯示「製作中」樣式", () => {
      const wrapper = createWrapper({ status: "preparing" });

      expect(wrapper.find('[data-testid="status-badge"]').classes()).toContain(
        "status-preparing",
      );
    });

    it("ready 狀態應該顯示「已完成」樣式", () => {
      const wrapper = createWrapper({ status: "ready" });

      expect(wrapper.find('[data-testid="status-badge"]').classes()).toContain(
        "status-ready",
      );
    });
  });

  describe("用戶互動", () => {
    it("點擊確認按鈕應該觸發 confirm 事件", async () => {
      const wrapper = createWrapper();

      await wrapper.find('[data-testid="confirm-btn"]').trigger("click");

      expect(wrapper.emitted("confirm")).toBeTruthy();
      expect(wrapper.emitted("confirm")?.[0]).toEqual([1]); // order id
    });

    it("點擊完成按鈕應該觸發 complete 事件", async () => {
      const wrapper = createWrapper({ status: "preparing" });

      await wrapper.find('[data-testid="complete-btn"]').trigger("click");

      expect(wrapper.emitted("complete")).toBeTruthy();
    });

    it("pending 狀態不應顯示完成按鈕", () => {
      const wrapper = createWrapper({ status: "pending" });

      expect(wrapper.find('[data-testid="complete-btn"]').exists()).toBe(false);
    });
  });

  describe("時間顯示", () => {
    it("應該顯示訂單經過時間", async () => {
      // 模擬 5 分鐘前的訂單
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const wrapper = createWrapper({ created_at: fiveMinutesAgo });

      expect(wrapper.find('[data-testid="elapsed-time"]').text()).toContain(
        "5",
      );
    });

    it("超過 15 分鐘應該顯示警告樣式", () => {
      const longAgo = new Date(Date.now() - 16 * 60 * 1000).toISOString();
      const wrapper = createWrapper({ created_at: longAgo });

      expect(wrapper.find('[data-testid="elapsed-time"]').classes()).toContain(
        "warning",
      );
    });
  });
});
```

#### 2. Pinia Store 測試範例

```typescript
// apps/kitchen-display/src/__tests__/unit/stores/ordersStore.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useOrdersStore } from "@/stores/orders";
import type { Order } from "@makanmasak/shared-types";

describe("Orders Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const mockOrder: Order = {
    id: 1,
    order_number: "ORD-001",
    table_number: "5",
    status: "pending",
    items: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  describe("初始狀態", () => {
    it("應該初始化為空訂單列表", () => {
      const store = useOrdersStore();

      expect(store.orders).toEqual([]);
      expect(store.pendingCount).toBe(0);
      expect(store.preparingCount).toBe(0);
    });
  });

  describe("addOrder", () => {
    it("應該成功添加新訂單", () => {
      const store = useOrdersStore();
      store.addOrder(mockOrder);

      expect(store.orders).toHaveLength(1);
      expect(store.orders[0]).toEqual(mockOrder);
      expect(store.pendingCount).toBe(1);
    });

    it("應該將新訂單添加到列表開頭", () => {
      const store = useOrdersStore();
      const order1 = { ...mockOrder, id: 1 };
      const order2 = { ...mockOrder, id: 2 };

      store.addOrder(order1);
      store.addOrder(order2);

      expect(store.orders[0].id).toBe(2);
      expect(store.orders[1].id).toBe(1);
    });
  });

  describe("updateOrderStatus", () => {
    it("應該成功更新訂單狀態", () => {
      const store = useOrdersStore();
      store.addOrder(mockOrder);

      store.updateOrderStatus(1, "preparing");

      expect(store.orders[0].status).toBe("preparing");
      expect(store.preparingCount).toBe(1);
      expect(store.pendingCount).toBe(0);
    });

    it("更新不存在的訂單時不應拋出錯誤", () => {
      const store = useOrdersStore();

      expect(() => {
        store.updateOrderStatus(999, "preparing");
      }).not.toThrow();
    });
  });

  describe("removeOrder", () => {
    it("應該成功移除訂單", () => {
      const store = useOrdersStore();
      store.addOrder(mockOrder);

      store.removeOrder(1);

      expect(store.orders).toHaveLength(0);
    });
  });

  describe("getters", () => {
    it("pendingOrders 應該只返回待處理訂單", () => {
      const store = useOrdersStore();
      store.addOrder({ ...mockOrder, id: 1, status: "pending" });
      store.addOrder({ ...mockOrder, id: 2, status: "preparing" });
      store.addOrder({ ...mockOrder, id: 3, status: "pending" });

      expect(store.pendingOrders).toHaveLength(2);
      expect(store.pendingOrders.every((o) => o.status === "pending")).toBe(
        true,
      );
    });

    it("preparingOrders 應該只返回製作中訂單", () => {
      const store = useOrdersStore();
      store.addOrder({ ...mockOrder, id: 1, status: "preparing" });
      store.addOrder({ ...mockOrder, id: 2, status: "ready" });

      expect(store.preparingOrders).toHaveLength(1);
      expect(store.preparingOrders[0].status).toBe("preparing");
    });

    it("urgentOrders 應該返回超過 15 分鐘的訂單", () => {
      const store = useOrdersStore();
      const oldOrder = {
        ...mockOrder,
        id: 1,
        created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      };
      const newOrder = {
        ...mockOrder,
        id: 2,
        created_at: new Date().toISOString(),
      };

      store.addOrder(oldOrder);
      store.addOrder(newOrder);

      expect(store.urgentOrders).toHaveLength(1);
      expect(store.urgentOrders[0].id).toBe(1);
    });
  });
});
```

---

## 📚 第四階段：OpenAPI 3.x 規範建立

### 1. 創建 OpenAPI 配置文件

```typescript
// apps/api/src/openapi/config.ts
import { OpenAPIHono } from "@hono/zod-openapi";

export const createOpenAPIApp = () => {
  const app = new OpenAPIHono();

  // OpenAPI 基礎配置
  app.doc("/openapi.json", {
    openapi: "3.1.0",
    info: {
      title: "MakanMakan API",
      version: "2.0.0",
      description:
        "Modern restaurant management system API built on Cloudflare Workers",
      contact: {
        name: "MakanMakan Team",
        url: "https://github.com/makanmakan/platform",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: "https://api.makanmakan.com",
        description: "Production",
      },
      {
        url: "https://api-staging.makanmakan.com",
        description: "Staging",
      },
      {
        url: "http://localhost:8787",
        description: "Local Development",
      },
    ],
    tags: [
      { name: "auth", description: "Authentication endpoints" },
      { name: "menu", description: "Menu management" },
      { name: "orders", description: "Order management" },
      { name: "tables", description: "Table management" },
      { name: "users", description: "User management" },
      { name: "realtime", description: "WebSocket real-time" },
      { name: "analytics", description: "Analytics & insights" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  });

  return app;
};
```

### 2. 核心 API 路由文檔化範例

```typescript
// apps/api/src/routes/auth.openapi.ts
import { createRoute, z } from "@hono/zod-openapi";

// Schema 定義
const LoginRequestSchema = z.object({
  email: z.string().email().openapi({ example: "user@example.com" }),
  password: z.string().min(6).openapi({ example: "password123" }),
});

const LoginResponseSchema = z.object({
  success: z.boolean(),
  token: z.string(),
  user: z.object({
    id: z.number(),
    email: z.string().email(),
    role: z.enum(["admin", "owner", "chef", "service", "cashier"]),
    name: z.string(),
  }),
});

const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

// 路由定義
export const loginRoute = createRoute({
  method: "post",
  path: "/auth/login",
  tags: ["auth"],
  summary: "User login",
  description: "Authenticate user and return JWT token",
  request: {
    body: {
      content: {
        "application/json": {
          schema: LoginRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Login successful",
      content: {
        "application/json": {
          schema: LoginResponseSchema,
        },
      },
    },
    401: {
      description: "Invalid credentials",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Server error",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

export const registerRoute = createRoute({
  method: "post",
  path: "/auth/register",
  tags: ["auth"],
  summary: "User registration",
  description: "Register a new customer account",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            email: z.string().email(),
            password: z.string().min(6),
            name: z.string(),
            phone: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Registration successful",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
            userId: z.number(),
          }),
        },
      },
    },
    400: {
      description: "Validation error",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});
```

### 3. Swagger UI 整合

```typescript
// apps/api/src/index.ts
import { swaggerUI } from "@hono/swagger-ui";
import { createOpenAPIApp } from "./openapi/config";

const app = createOpenAPIApp();

// Swagger UI
app.get("/docs", swaggerUI({ url: "/openapi.json" }));

// ReDoc (備選)
app.get("/redoc", (c) => {
  return c.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>MakanMakan API Documentation</title>
          <meta charset="utf-8"/>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
          <style>
            body { margin: 0; padding: 0; }
          </style>
        </head>
        <body>
          <redoc spec-url='/openapi.json'></redoc>
          <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"> </script>
        </body>
      </html>
    `);
});

export default app;
```

---

## 🔧 第五階段：測試覆蓋率配置

### 1. 更新 vitest.config.ts

```typescript
// vitest.config.ts (根目錄)
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],

      // 覆蓋率門檻
      thresholds: {
        global: {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
        // 關鍵模組要求更高覆蓋率
        "apps/api/src/features/**/*.ts": {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        "apps/realtime/src/**/*.ts": {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },

      // 排除不需要覆蓋的文件
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.d.ts",
        "**/*.config.ts",
        "**/tests/**",
        "**/__tests__/**",
        "**/coverage/**",
      ],

      // 包含的文件
      include: ["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"],
    },
  },
});
```

### 2. 更新 GitHub Actions CI/CD

```yaml
# .github/workflows/test.yml (部分更新)
jobs:
  unit-tests:
    name: 🧪 單元測試
    runs-on: ubuntu-latest

    steps:
      # ... 省略其他步驟 ...

      - name: 📊 產生覆蓋率報告
        run: pnpm run test:coverage

      - name: 🚫 強制執行覆蓋率門檻
        run: |
          pnpm run test:coverage -- --coverage.enabled=true --coverage.thresholds.global=true

      - name: 💬 PR 覆蓋率報告留言
        if: github.event_name == 'pull_request'
        uses: romeovs/lcov-reporter-action@v0.3.1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          lcov-file: ./coverage/lcov.info
          delete-old-comments: true
```

---

## 📅 實施時間表

### 週 1 (2025-11-13 - 11-19)

**目標**: 完成 Realtime Services 測試 + 配置覆蓋率

- [ ] Day 1-2: WebSocket 連接管理測試 (5 個)
- [ ] Day 3-4: JWT 認證邏輯測試 (5 個)
- [ ] Day 5: 訊息路由測試 (3 個)
- [ ] Day 6-7: 離線重連邊界測試 (5 個) + 整合測試 (2 個)

**交付物**:

- 20 個 Realtime 測試檔案
- 測試覆蓋率配置完成

---

### 週 2 (2025-11-20 - 11-26)

**目標**: 完成 Kitchen Display 測試

- [ ] Day 1-3: Vue 組件單元測試 (10 個)
- [ ] Day 4: Pinia Store 測試 (5 個)
- [ ] Day 5-6: WebSocket 整合測試 + 服務邏輯測試 (10 個)
- [ ] Day 7: E2E 工作流程測試 (5 個)

**交付物**:

- 25 個 Kitchen Display 測試檔案
- 測試通過率達 100%

---

### 週 3 (2025-11-27 - 12-06)

**目標**: 完成 OpenAPI 文檔化

- [ ] Day 1: OpenAPI 基礎架構建立
- [ ] Day 2-4: 核心 API 文檔化 (auth, menu, orders, tables, users)
- [ ] Day 5-7: 高級功能 API 文檔化 (realtime, ai-analytics, leaves, scheduling)
- [ ] Day 8-9: 部署 Swagger UI 並整合 CI/CD
- [ ] Day 10: 驗證、測試、文檔更新

**交付物**:

- 完整的 OpenAPI 3.x 規範
- Swagger UI 可訪問
- 更新的 CLAUDE.md

---

## ✅ 驗收標準

### 測試補充

- [ ] Realtime Services 至少 20 個測試檔案
- [ ] Kitchen Display 至少 25 個測試檔案
- [ ] 所有測試通過率 100%
- [ ] 測試覆蓋率達到 85%
- [ ] CI/CD 整合覆蓋率門檻

### API 文檔

- [ ] 所有 API 端點有 OpenAPI 規範
- [ ] Swagger UI 可正常訪問
- [ ] 每個端點包含：
  - 詳細描述
  - 請求範例
  - 回應範例
  - 錯誤處理
  - 認證要求

### 文檔更新

- [ ] CLAUDE.md 更新測試狀態
- [ ] README 添加 API 文檔連結
- [ ] 測試指南更新

---

## 🎯 快速開始指南

### 對於開發人員

1. **閱讀本文檔**
2. **選擇一個測試類別開始**（例如：Realtime - WebSocket 連接管理）
3. **複製範例測試模板**
4. **根據實際代碼調整測試**
5. **執行測試確保通過**
6. **提交 Pull Request**

### 對於團隊協作

建議分工：

- **開發者 A**: Realtime Services 單元測試 (15 個)
- **開發者 B**: Realtime Services 整合測試 (5 個)
- **開發者 C**: Kitchen Display 組件測試 (10 個)
- **開發者 D**: Kitchen Display Store + E2E 測試 (15 個)
- **開發者 E**: OpenAPI 核心 API (auth, menu, orders)
- **開發者 F**: OpenAPI 高級 API (realtime, ai-analytics)

---

## 📞 支援與協助

### 問題回報

遇到問題請在以下頻道尋求協助：

- GitHub Issues: 技術問題
- Team Slack: 即時討論

### 範例資源

- 測試範例：本文檔 Section 2-3
- OpenAPI 範例：本文檔 Section 4
- 最佳實踐：`docs/guides/testing-guide.md`

---

**文檔維護者**: Claude Code
**最後更新**: 2025-11-13
**下次審查**: 每週五

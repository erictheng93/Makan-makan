# MakanMakan 技術文件
## 基於 Cloudflare 生態系統的架構設計

**版本**: v1.0  
**最後更新**: 2025年8月  
**技術負責人**: 開發團隊  

---

## 🎯 技術需求概述

基於PRD分析，系統需要滿足以下核心技術需求：
- **高可用性**: >99.9% uptime
- **低延遲**: API響應時間 P99 < 300ms
- **全球部署**: 支援亞太地區用戶
- **即時性**: 訂單狀態即時同步
- **擴展性**: 支援1000+ QPS
- **安全性**: 企業級資料保護
- **成本效益**: 無伺服器架構，按需付費

---

## 🏗️ 系統架構設計

### 總體架構圖
```
                        ┌─────────────────────┐
                        │   Cloudflare CDN    │
                        │   + WAF + DDoS      │
                        └─────────────────────┘
                                   │
                ┌──────────────────┼──────────────────┐
                │                  │                  │
        ┌───────────────┐  ┌──────────────┐  ┌──────────────┐
        │ Customer App  │  │  Admin App   │  │   QR Code    │
        │ (Pages)       │  │  (Pages)     │  │  Generator   │
        │ Vue.js 3      │  │  Vue.js      │  │  (Workers)   │
        └───────────────┘  └──────────────┘  └──────────────┘
                                   │
                        ┌─────────────────────┐
                        │   API Gateway       │
                        │ (Cloudflare Workers)│
                        └─────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
┌──────────────┐        ┌─────────────────┐        ┌─────────────────┐
│   Database   │        │  Cache & State  │        │  File Storage   │
│ (Cloudflare  │        │ (KV + Durable   │        │ (R2 + Images)   │
│     D1)      │        │    Objects)     │        │                 │
└──────────────┘        └─────────────────┘        └─────────────────┘
        │                          │                          │
┌──────────────┐        ┌─────────────────┐        ┌─────────────────┐
│   Analytics  │        │  Message Queue  │        │   Monitoring    │
│ Analytics +  │        │ (Cloudflare     │        │ (Workers        │
│ Web Analytics│        │    Queues)      │        │  Analytics)     │
└──────────────┘        └─────────────────┘        └─────────────────┘
```

### Cloudflare服務映射表

| 功能需求 | Cloudflare服務 | 主要用途 |
|---------|---------------|----------|
| 前端應用部署 | **Cloudflare Pages** | SPA託管, 預覽環境, 自動部署 |
| 後端API服務 | **Cloudflare Workers** | 無伺服器計算, 邊緣處理 |
| 資料庫服務 | **Cloudflare D1** | 無伺服器SQL資料庫 |
| 快取系統 | **Cloudflare KV** | 菜單快取, 設定儲存 |
| 即時功能 | **Durable Objects** | WebSocket連接, 狀態管理 |
| 檔案儲存 | **Cloudflare R2** | 圖片原始檔案儲存 |
| 圖片處理 | **Cloudflare Images** | 自動優化, 多尺寸變形 |
| 任務佇列 | **Cloudflare Queues** | 非同步任務處理 |
| 安全防護 | **Cloudflare WAF** | DDoS, Bot防護, 存取控制 |
| 效能監控 | **Workers Analytics** | API效能, 錯誤追蹤 |
| 使用者分析 | **Web Analytics** | 用戶行為, 頁面效能 |

---

## 💾 資料庫設計 (Cloudflare D1)

### 資料庫Schema

#### 核心資料表設計

```sql
-- 用戶表（多角色支援）
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role INTEGER NOT NULL DEFAULT 1,
    -- 0: Admin, 1: Owner, 2: Chef, 3: Service, 4: Cashier
    restaurant_id INTEGER,
    status INTEGER DEFAULT 1, -- 1: Active, 0: Inactive
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
);

-- 餐廳表
CREATE TABLE restaurants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    business_hours TEXT, -- JSON格式儲存營業時間
    settings TEXT, -- JSON格式儲存餐廳設定
    status INTEGER DEFAULT 1, -- 1: Active, 0: Inactive
    plan_type INTEGER DEFAULT 0, -- 0: Free, 1: Basic, 2: Pro
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 桌台表
CREATE TABLE tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    table_number INTEGER NOT NULL,
    table_name TEXT,
    capacity INTEGER DEFAULT 4,
    qr_code TEXT UNIQUE, -- QR Code內容
    status INTEGER DEFAULT 0, -- 0: Available, 1: Occupied, 2: Reserved
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
    UNIQUE(restaurant_id, table_number)
);

-- 分類表
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    status INTEGER DEFAULT 1, -- 1: Active, 0: Inactive
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
);

-- 菜單項目表
CREATE TABLE menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image_url TEXT,
    image_variants TEXT, -- JSON格式儲存不同尺寸圖片URL
    options TEXT, -- JSON格式儲存客製化選項（甜度、冰塊等）
    sort_order INTEGER DEFAULT 0,
    is_available INTEGER DEFAULT 1,
    inventory_count INTEGER DEFAULT -1, -- -1表示不限量
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- 訂單表
CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    table_id INTEGER NOT NULL,
    order_number TEXT UNIQUE NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    total_amount DECIMAL(10,2) NOT NULL,
    status INTEGER DEFAULT 0,
    -- 0: Pending, 1: Confirmed, 2: Preparing, 3: Ready, 4: Delivered, 5: Paid, 6: Cancelled
    payment_status INTEGER DEFAULT 0, -- 0: Pending, 1: Paid, 2: Failed
    payment_method TEXT, -- cash, card, online
    notes TEXT,
    estimated_time INTEGER, -- 預估製作時間（分鐘）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
    FOREIGN KEY (table_id) REFERENCES tables(id)
);

-- 訂單項目表
CREATE TABLE order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    menu_item_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    customizations TEXT, -- JSON格式儲存客製化選項
    notes TEXT,
    status INTEGER DEFAULT 0, -- 0: Pending, 1: Preparing, 2: Ready, 3: Delivered
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
);

-- 會話表（可選，也可使用Cloudflare KV）
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER,
    restaurant_id INTEGER,
    data TEXT, -- JSON格式儲存會話資料
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
);

-- 操作日誌表（審計用途）
CREATE TABLE audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    restaurant_id INTEGER,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id INTEGER,
    old_values TEXT, -- JSON
    new_values TEXT, -- JSON
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
);
```

#### 索引設計

```sql
-- 效能關鍵索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_restaurant_role ON users(restaurant_id, role);
CREATE INDEX idx_tables_restaurant ON tables(restaurant_id);
CREATE INDEX idx_tables_qr_code ON tables(qr_code);
CREATE INDEX idx_categories_restaurant ON categories(restaurant_id);
CREATE INDEX idx_menu_items_restaurant_category ON menu_items(restaurant_id, category_id);
CREATE INDEX idx_menu_items_available ON menu_items(restaurant_id, is_available);
CREATE INDEX idx_orders_restaurant_status ON orders(restaurant_id, status);
CREATE INDEX idx_orders_table_status ON orders(table_id, status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_audit_logs_restaurant_created ON audit_logs(restaurant_id, created_at);
```

#### 資料庫初始化腳本

```sql
-- 預設管理員用戶
INSERT INTO users (email, password_hash, name, role) VALUES 
('admin@makanmakan.com', '$argon2id$v=19$m=65536,t=3,p=4$hash', 'System Admin', 0);

-- 示例餐廳資料
INSERT INTO restaurants (name, address, phone, business_hours) VALUES 
('示例餐廳', '台北市信義區信義路五段7號', '02-1234-5678', 
 '{"monday":"09:00-22:00","tuesday":"09:00-22:00","wednesday":"09:00-22:00","thursday":"09:00-22:00","friday":"09:00-22:00","saturday":"09:00-22:00","sunday":"09:00-22:00"}');

-- 示例桌台
INSERT INTO tables (restaurant_id, table_number, table_name, qr_code) VALUES 
(1, 1, 'A1', 'restaurant_1_table_1'),
(1, 2, 'A2', 'restaurant_1_table_2'),
(1, 3, 'B1', 'restaurant_1_table_3');

-- 示例分類
INSERT INTO categories (restaurant_id, name, sort_order) VALUES 
(1, '主餐', 1),
(1, '飲品', 2),
(1, '甜點', 3);
```

### 資料關聯圖

```
users (多對一) → restaurants
restaurants (一對多) → tables
restaurants (一對多) → categories
restaurants (一對多) → menu_items
menu_items (多對一) → categories
tables (一對多) → orders
orders (一對多) → order_items
menu_items (一對多) → order_items
users (一對多) → audit_logs
```

---

## 🚀 API 架構設計 (Cloudflare Workers)

### API 總體設計

#### 基礎架構
```typescript
// workers/api/src/index.ts
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const router = new Router();
    
    // 中介軟體
    router.use(corsMiddleware);
    router.use(authMiddleware);
    router.use(rateLimitMiddleware);
    router.use(validationMiddleware);
    
    // API路由
    router.get('/api/v1/health', healthCheck);
    router.all('/api/v1/auth/*', authRoutes);
    router.all('/api/v1/restaurants/*', restaurantRoutes);
    router.all('/api/v1/menu/*', menuRoutes);
    router.all('/api/v1/orders/*', orderRoutes);
    router.all('/api/v1/tables/*', tableRoutes);
    router.all('/api/v1/users/*', userRoutes);
    router.all('/api/v1/analytics/*', analyticsRoutes);
    
    return router.handle(request, env, ctx);
  }
};
```

### API 路由規劃

#### 認證相關 API
```
POST   /api/v1/auth/login              用戶登入
POST   /api/v1/auth/logout             用戶登出
POST   /api/v1/auth/refresh            刷新Token
GET    /api/v1/auth/me                 取得當前用戶資訊
POST   /api/v1/auth/register           餐廳註冊
POST   /api/v1/auth/forgot-password    忘記密碼
POST   /api/v1/auth/reset-password     重設密碼
```

#### 餐廳管理 API
```
GET    /api/v1/restaurants             取得餐廳列表（Admin用）
GET    /api/v1/restaurants/{id}        取得特定餐廳資訊
PUT    /api/v1/restaurants/{id}        更新餐廳資訊
DELETE /api/v1/restaurants/{id}        刪除餐廳（Admin用）
GET    /api/v1/restaurants/{id}/stats  取得餐廳統計資料
```

#### 菜單管理 API
```
GET    /api/v1/menu/{restaurant_id}                     取得菜單（消費者用）
GET    /api/v1/menu/{restaurant_id}/categories          取得分類列表
POST   /api/v1/menu/{restaurant_id}/categories          新增分類
PUT    /api/v1/menu/{restaurant_id}/categories/{id}     更新分類
DELETE /api/v1/menu/{restaurant_id}/categories/{id}     刪除分類

GET    /api/v1/menu/{restaurant_id}/items               取得菜品列表
POST   /api/v1/menu/{restaurant_id}/items               新增菜品
PUT    /api/v1/menu/{restaurant_id}/items/{id}          更新菜品
DELETE /api/v1/menu/{restaurant_id}/items/{id}          刪除菜品
POST   /api/v1/menu/{restaurant_id}/items/{id}/image    上傳菜品圖片
```

#### 訂單管理 API
```
GET    /api/v1/orders                                   取得訂單列表
POST   /api/v1/orders                                   建立新訂單
GET    /api/v1/orders/{id}                             取得訂單詳情
PUT    /api/v1/orders/{id}/status                      更新訂單狀態
DELETE /api/v1/orders/{id}                             取消訂單
GET    /api/v1/orders/{id}/items                       取得訂單項目
PUT    /api/v1/orders/{id}/items/{item_id}/status      更新項目狀態

GET    /api/v1/orders/restaurant/{restaurant_id}        取得餐廳訂單
GET    /api/v1/orders/table/{table_id}                 取得桌台訂單
GET    /api/v1/orders/realtime/{restaurant_id}         即時訂單流（SSE）
```

#### 桌台管理 API
```
GET    /api/v1/tables/{restaurant_id}                  取得桌台列表
POST   /api/v1/tables/{restaurant_id}                  新增桌台
PUT    /api/v1/tables/{restaurant_id}/{id}             更新桌台資訊
DELETE /api/v1/tables/{restaurant_id}/{id}             刪除桌台
GET    /api/v1/tables/{restaurant_id}/{id}/qr          取得QR Code
POST   /api/v1/tables/{restaurant_id}/bulk-qr          批量產生QR Code
PUT    /api/v1/tables/{restaurant_id}/{id}/status      更新桌台狀態
```

#### 用戶管理 API
```
GET    /api/v1/users/{restaurant_id}                   取得員工列表
POST   /api/v1/users/{restaurant_id}                   邀請新員工
PUT    /api/v1/users/{restaurant_id}/{id}              更新員工資訊
DELETE /api/v1/users/{restaurant_id}/{id}              停用員工帳號
PUT    /api/v1/users/{restaurant_id}/{id}/role         變更員工角色
```

#### 分析統計 API
```
GET    /api/v1/analytics/{restaurant_id}/dashboard     儀表板資料
GET    /api/v1/analytics/{restaurant_id}/revenue       營收分析
GET    /api/v1/analytics/{restaurant_id}/popular       熱門商品
GET    /api/v1/analytics/{restaurant_id}/orders        訂單統計
GET    /api/v1/analytics/{restaurant_id}/customers     客戶分析
```

### 請求/響應格式

#### 標準響應格式
```typescript
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
  meta?: {
    timestamp: string;
    request_id: string;
    version: string;
  };
}
```

#### 分頁請求參數
```typescript
interface PaginationParams {
  page?: number;      // 頁碼，預設 1
  limit?: number;     // 每頁筆數，預設 20，最大 100
  sort?: string;      // 排序欄位，預設 'created_at'
  order?: 'asc' | 'desc'; // 排序方向，預設 'desc'
}
```

### 認證與授權機制

#### JWT Token 結構
```typescript
interface JwtPayload {
  user_id: number;
  restaurant_id: number;
  role: number;         // 0: Admin, 1: Owner, 2: Chef, 3: Service, 4: Cashier
  email: string;
  iat: number;         // 發行時間
  exp: number;         // 過期時間
  jti: string;         // Token ID（用於撤銷）
}
```

#### 權限檢查中介軟體
```typescript
// 權限矩陣
const PERMISSIONS = {
  'menu:read': [0, 1, 2, 3, 4],          // 所有角色都可讀取菜單
  'menu:write': [0, 1],                   // 只有管理員和店主可編輯菜單
  'orders:read': [0, 1, 2, 3, 4],        // 所有角色都可查看訂單
  'orders:update': [0, 1, 2, 3, 4],      // 所有角色都可更新訂單狀態
  'users:manage': [0, 1],                 // 只有管理員和店主可管理用戶
  'analytics:read': [0, 1, 4],            // 管理員、店主、收銀員可查看分析
} as const;

const requirePermission = (permission: keyof typeof PERMISSIONS) => {
  return (req: AuthRequest, res: Response, next: Function) => {
    const userRole = req.user.role;
    if (!PERMISSIONS[permission].includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' }
      });
    }
    next();
  };
};
```

### 即時功能實作 (Durable Objects)

#### 訂單狀態即時更新
```typescript
// workers/realtime/src/OrderNotifier.ts
export class OrderNotifier {
  constructor(private state: DurableObjectState, private env: Env) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    switch (url.pathname) {
      case '/subscribe':
        return this.handleSubscribe(request);
      case '/notify':
        return this.handleNotify(request);
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  private async handleSubscribe(request: Request): Promise<Response> {
    const restaurantId = new URL(request.url).searchParams.get('restaurant_id');
    const role = new URL(request.url).searchParams.get('role');
    
    const { 0: client, 1: server } = new WebSocketPair();
    
    await this.state.acceptWebSocket(server);
    
    // 儲存連接資訊
    server.serializeAttachment({ restaurantId, role });
    
    return new Response(null, { status: 101, webSocket: client });
  }

  private async handleNotify(request: Request): Promise<Response> {
    const data = await request.json();
    const { restaurant_id, event_type, payload } = data;
    
    // 廣播給所有該餐廳的連接
    this.state.getWebSockets().forEach(ws => {
      const attachment = ws.deserializeAttachment();
      if (attachment?.restaurantId === restaurant_id) {
        ws.send(JSON.stringify({
          type: event_type,
          data: payload,
          timestamp: Date.now()
        }));
      }
    });
    
    return new Response('OK');
  }
}
```

### 錯誤處理機制

#### 標準錯誤碼
```typescript
export const ERROR_CODES = {
  // 通用錯誤
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  
  // 認證錯誤
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  
  // 業務邏輯錯誤
  RESTAURANT_NOT_FOUND: 'RESTAURANT_NOT_FOUND',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  MENU_ITEM_NOT_AVAILABLE: 'MENU_ITEM_NOT_AVAILABLE',
  TABLE_OCCUPIED: 'TABLE_OCCUPIED',
  DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
  
  // 速率限制
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
} as const;
```

#### 錯誤處理中介軟體
```typescript
const errorHandler = (error: Error, req: Request, res: Response, next: Function) => {
  console.error('API Error:', error);
  
  if (error instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: error.message,
        details: error.details
      }
    });
  }
  
  if (error instanceof AuthenticationError) {
    return res.status(401).json({
      success: false,
      error: {
        code: ERROR_CODES.UNAUTHORIZED,
        message: error.message
      }
    });
  }
  
  // 預設內部伺服器錯誤
  return res.status(500).json({
    success: false,
    error: {
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: 'Internal server error'
    }
  });
};
```

### 速率限制策略

#### 基於 Cloudflare KV 的速率限制
```typescript
const rateLimitMiddleware = async (req: Request, env: Env, ctx: ExecutionContext) => {
  const clientIP = req.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `rate_limit:${clientIP}`;
  
  // 取得當前計數
  const current = await env.RATE_LIMIT_KV.get(key);
  const count = current ? parseInt(current) : 0;
  
  // 檢查是否超過限制（每分鐘60次請求）
  if (count >= 60) {
    return new Response('Rate limit exceeded', { 
      status: 429,
      headers: {
        'Retry-After': '60',
        'X-RateLimit-Limit': '60',
        'X-RateLimit-Remaining': '0'
      }
    });
  }
  
  // 增加計數
  await env.RATE_LIMIT_KV.put(key, (count + 1).toString(), {
    expirationTtl: 60 // 60秒過期
  });
  
  return null; // 繼續處理請求
};
```

### 快取策略

#### 多層快取架構
```typescript
// 1. Cloudflare Cache API (邊緣快取)
// 2. Cloudflare KV (全球分散式快取)
// 3. 應用層記憶體快取

class CacheManager {
  constructor(private env: Env, private ctx: ExecutionContext) {}
  
  async get(key: string, options?: { ttl?: number }): Promise<any> {
    // 1. 嘗試從 KV 快取取得
    const cached = await this.env.CACHE_KV.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
    
    return null;
  }
  
  async set(key: string, value: any, ttl: number = 300): Promise<void> {
    // 儲存到 KV 快取
    await this.env.CACHE_KV.put(key, JSON.stringify(value), {
      expirationTtl: ttl
    });
  }
  
  async invalidate(pattern: string): Promise<void> {
    // 實作快取失效邏輯
    // 可以使用 KV 的 list() API 來找到相關的 keys
  }
}

// 快取裝飾器
const cached = (ttl: number = 300) => {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value;
    
    descriptor.value = async function(...args: any[]) {
      const cacheKey = `${propertyName}:${JSON.stringify(args)}`;
      
      let result = await this.cache.get(cacheKey);
      if (result) {
        return result;
      }
      
      result = await method.apply(this, args);
      await this.cache.set(cacheKey, result, ttl);
      
      return result;
    };
  };
};
```

---

## 📦 部署與 CI/CD 策略

### 專案結構設計
```
makanmakan/
├── apps/
│   ├── customer-app/          # 消費者前端 (Cloudflare Pages)
│   ├── admin-dashboard/       # 管理後台 (Cloudflare Pages)  
│   ├── api/                   # API服務 (Cloudflare Workers)
│   ├── realtime/              # 即時服務 (Durable Objects)
│   └── image-processor/       # 圖片處理 (Cloudflare Workers)
├── packages/
│   ├── shared-types/          # 共用型別定義
│   ├── database/              # 資料庫 schema & 遷移
│   └── utils/                 # 共用工具函式
├── infrastructure/
│   ├── terraform/             # 基礎設施代碼
│   └── scripts/               # 部署腳本
└── docs/                      # 文檔
```

### Cloudflare 服務配置

#### wrangler.toml 設定檔
```toml
# apps/api/wrangler.toml
name = "makanmakan-api"
main = "src/index.ts"
compatibility_date = "2024-10-01"
node_compat = true

[env.production]
name = "makanmakan-api-prod"
vars = { ENVIRONMENT = "production" }

[env.staging]
name = "makanmakan-api-staging"
vars = { ENVIRONMENT = "staging" }

[[env.production.d1_databases]]
binding = "DB"
database_name = "makanmakan-prod"
database_id = "xxx"

[[env.production.kv_namespaces]]
binding = "CACHE_KV"
id = "xxx"

[[env.production.r2_buckets]]
binding = "IMAGES"
bucket_name = "makanmakan-images-prod"

[env.production.durable_objects]
bindings = [
  { name = "ORDER_NOTIFIER", class_name = "OrderNotifier" }
]

[[env.production.queues.producers]]
binding = "TASK_QUEUE"
queue = "makanmakan-tasks-prod"

[env.production.vars]
JWT_SECRET = "xxx"
CLOUDFLARE_IMAGES_KEY = "xxx"
```

### GitHub Actions CI/CD Pipeline

#### 主要工作流程
```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm run test
      
      - name: Run linting
        run: npm run lint
      
      - name: Type check
        run: npm run typecheck
      
      - name: Run D1 migrations (staging)
        if: github.ref == 'refs/heads/develop'
        run: npx wrangler d1 migrations apply makanmakan-staging --env staging
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build applications
        run: npm run build
      
      - name: Deploy API to staging
        run: npx wrangler deploy --env staging
        working-directory: apps/api
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      
      - name: Deploy Customer App to staging
        run: npx wrangler pages deploy dist --project-name=makanmakan-customer-staging
        working-directory: apps/customer-app
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      
      - name: Deploy Admin Dashboard to staging
        run: npx wrangler pages deploy dist --project-name=makanmakan-admin-staging
        working-directory: apps/admin-dashboard
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

  deploy-production:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build applications
        run: npm run build
      
      - name: Run D1 migrations (production)
        run: npx wrangler d1 migrations apply makanmakan-prod --env production
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      
      - name: Deploy API to production
        run: npx wrangler deploy --env production
        working-directory: apps/api
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      
      - name: Deploy Customer App to production
        run: npx wrangler pages deploy dist --project-name=makanmakan-customer
        working-directory: apps/customer-app
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      
      - name: Deploy Admin Dashboard to production
        run: npx wrangler pages deploy dist --project-name=makanmakan-admin
        working-directory: apps/admin-dashboard
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      
      - name: Run smoke tests
        run: npm run test:e2e:prod
```

### 資料庫遷移策略

#### D1 遷移檔案結構
```
packages/database/
├── migrations/
│   ├── 0001_initial_schema.sql
│   ├── 0002_add_audit_logs.sql
│   ├── 0003_add_indexes.sql
│   └── 0004_menu_improvements.sql
├── seeds/
│   ├── development.sql
│   └── staging.sql
└── scripts/
    ├── migrate.ts
    └── seed.ts
```

#### 遷移執行腳本
```typescript
// packages/database/scripts/migrate.ts
import { execSync } from 'child_process';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(__dirname, '../migrations');

export async function runMigrations(environment: string) {
  console.log(`Running migrations for ${environment}...`);
  
  const migrationFiles = readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.sql'))
    .sort();
  
  for (const file of migrationFiles) {
    console.log(`Applying migration: ${file}`);
    
    const sqlContent = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
    const command = `echo "${sqlContent}" | npx wrangler d1 execute makanmakan-${environment} --env ${environment}`;
    
    try {
      execSync(command, { stdio: 'inherit' });
      console.log(`✅ Migration ${file} applied successfully`);
    } catch (error) {
      console.error(`❌ Migration ${file} failed:`, error);
      process.exit(1);
    }
  }
  
  console.log('All migrations completed successfully!');
}
```

---

## 📂 檔案儲存架構 (R2 + Images)

### 圖片處理工作流程
```
用戶上傳圖片 → Cloudflare Workers → 驗證 → R2 原始檔案 → Images API 處理 → CDN 快取
```

### 圖片上傳 Worker
```typescript
// apps/image-processor/src/index.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    
    const formData = await request.formData();
    const file = formData.get('image') as File;
    const restaurantId = formData.get('restaurant_id') as string;
    const type = formData.get('type') as string; // menu, avatar, etc.
    
    // 驗證檔案
    if (!file || !file.type.startsWith('image/')) {
      return new Response('Invalid file type', { status: 400 });
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      return new Response('File too large', { status: 413 });
    }
    
    // 產生唯一檔名
    const fileExtension = file.name.split('.').pop();
    const fileName = `${restaurantId}/${type}/${Date.now()}-${crypto.randomUUID()}.${fileExtension}`;
    
    // 上傳到 R2
    await env.IMAGES.put(fileName, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
      customMetadata: {
        restaurant_id: restaurantId,
        type: type,
        original_name: file.name,
      }
    });
    
    // 使用 Cloudflare Images API 處理
    const imageVariants = await createImageVariants(fileName, env);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        original_url: `https://images.example.com/${fileName}`,
        variants: imageVariants
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

async function createImageVariants(fileName: string, env: Env) {
  // 定義不同尺寸變體
  const variants = [
    { name: 'thumbnail', width: 150, height: 150 },
    { name: 'medium', width: 400, height: 300 },
    { name: 'large', width: 800, height: 600 }
  ];
  
  const result = {};
  
  for (const variant of variants) {
    const variantUrl = `https://imagedelivery.net/your-account/${fileName}/${variant.name}`;
    result[variant.name] = variantUrl;
  }
  
  return result;
}
```

### 圖片變體設定
```javascript
// Cloudflare Images 變體設定
const imageVariants = [
  {
    id: "thumbnail",
    options: {
      fit: "crop",
      width: 150,
      height: 150,
      quality: 85
    }
  },
  {
    id: "medium", 
    options: {
      fit: "scale-down",
      width: 400,
      height: 300,
      quality: 90
    }
  },
  {
    id: "large",
    options: {
      fit: "scale-down", 
      width: 800,
      height: 600,
      quality: 95
    }
  }
];
```

---

## 📊 監控與日誌架構

### Workers Analytics 整合
```typescript
// 自訂指標追蹤
export class MetricsCollector {
  constructor(private analytics: AnalyticsEngine) {}
  
  async trackApiCall(endpoint: string, method: string, statusCode: number, duration: number, userId?: number) {
    this.analytics.writeDataPoint({
      blobs: [endpoint, method, userId?.toString() || 'anonymous'],
      doubles: [duration, statusCode],
      indexes: [endpoint] // 用於快速查詢
    });
  }
  
  async trackOrderCreated(restaurantId: number, orderValue: number, tableId: number) {
    this.analytics.writeDataPoint({
      blobs: ['order_created', restaurantId.toString(), tableId.toString()],
      doubles: [orderValue],
      indexes: ['order_metrics']
    });
  }
  
  async trackUserAction(action: string, userId: number, restaurantId: number) {
    this.analytics.writeDataPoint({
      blobs: [action, userId.toString(), restaurantId.toString()],
      doubles: [Date.now()],
      indexes: ['user_actions']
    });
  }
}
```

### 錯誤日誌與告警
```typescript
// 錯誤追蹤與通知
export class ErrorLogger {
  constructor(private env: Env) {}
  
  async logError(error: Error, context: any) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      context,
      id: crypto.randomUUID()
    };
    
    // 儲存到 KV (短期)
    await this.env.ERROR_LOGS.put(
      `error:${errorLog.id}`,
      JSON.stringify(errorLog),
      { expirationTtl: 86400 * 7 } // 7天
    );
    
    // 嚴重錯誤發送通知
    if (this.isCriticalError(error)) {
      await this.sendAlert(errorLog);
    }
  }
  
  private isCriticalError(error: Error): boolean {
    const criticalPatterns = [
      /database/i,
      /timeout/i,
      /authentication/i,
      /payment/i
    ];
    
    return criticalPatterns.some(pattern => 
      pattern.test(error.message) || pattern.test(error.stack || '')
    );
  }
  
  private async sendAlert(errorLog: any) {
    // 發送到 Slack webhook 或其他通知服務
    const webhookUrl = this.env.SLACK_WEBHOOK_URL;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 Critical Error in MakanMakan API`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Error:* ${errorLog.message}\n*Time:* ${errorLog.timestamp}\n*ID:* ${errorLog.id}`
              }
            }
          ]
        })
      });
    }
  }
}
```

### 健康檢查端點
```typescript
// 系統健康狀況檢查
export async function healthCheck(request: Request, env: Env): Promise<Response> {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {
      database: false,
      cache: false,
      storage: false,
      queue: false
    },
    version: env.APP_VERSION || 'unknown'
  };
  
  try {
    // 檢查資料庫連接 - 使用 Drizzle ORM
    const db = drizzle(env.DB, { schema });
    const result = await db.select({ test: sql<number>`1` }).limit(1);
    checks.checks.database = result[0]?.test === 1;
  } catch (error) {
    console.error('Database health check failed:', error);
  }
  
  try {
    // 檢查 KV 快取
    await env.CACHE_KV.put('health_check', Date.now().toString(), { expirationTtl: 60 });
    await env.CACHE_KV.get('health_check');
    checks.checks.cache = true;
  } catch (error) {
    console.error('Cache health check failed:', error);
  }
  
  try {
    // 檢查 R2 儲存
    await env.IMAGES.head('health-check.txt');
    checks.checks.storage = true;
  } catch (error) {
    console.error('Storage health check failed:', error);
  }
  
  // 判斷整體狀態
  const allHealthy = Object.values(checks.checks).every(check => check);
  checks.status = allHealthy ? 'healthy' : 'degraded';
  
  return new Response(JSON.stringify(checks), {
    status: allHealthy ? 200 : 503,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

---

## ⚡ 效能最佳化策略

### 資料庫查詢最佳化
```sql
-- 建立複合索引優化常用查詢
CREATE INDEX idx_orders_restaurant_status_created ON orders(restaurant_id, status, created_at DESC);
CREATE INDEX idx_menu_items_restaurant_available ON menu_items(restaurant_id, is_available, sort_order);
CREATE INDEX idx_order_items_order_status ON order_items(order_id, status);

-- 使用 EXPLAIN QUERY PLAN 分析查詢效能
EXPLAIN QUERY PLAN 
SELECT o.*, oi.* 
FROM orders o 
LEFT JOIN order_items oi ON o.id = oi.order_id 
WHERE o.restaurant_id = ? AND o.status IN (0, 1, 2) 
ORDER BY o.created_at DESC 
LIMIT 20;
```

### 智能快取策略
```typescript
// 分層快取系統
export class SmartCache {
  constructor(private kv: KVNamespace, private ctx: ExecutionContext) {}
  
  // 菜單快取 (長期, 15分鐘)
  async getMenu(restaurantId: number): Promise<any> {
    const cacheKey = `menu:${restaurantId}`;
    const cached = await this.kv.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    // 從資料庫取得並快取
    const menu = await this.fetchMenuFromDB(restaurantId);
    await this.kv.put(cacheKey, JSON.stringify(menu), { expirationTtl: 900 });
    
    return menu;
  }
  
  // 訂單快取 (短期, 30秒)
  async getRecentOrders(restaurantId: number): Promise<any> {
    const cacheKey = `orders:recent:${restaurantId}`;
    const cached = await this.kv.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    const orders = await this.fetchRecentOrdersFromDB(restaurantId);
    await this.kv.put(cacheKey, JSON.stringify(orders), { expirationTtl: 30 });
    
    return orders;
  }
  
  // 快取失效
  async invalidateMenu(restaurantId: number) {
    await this.kv.delete(`menu:${restaurantId}`);
  }
  
  async invalidateOrders(restaurantId: number) {
    await this.kv.delete(`orders:recent:${restaurantId}`);
  }
}
```

### 請求批次處理
```typescript
// 批次處理多個資料庫查詢
export class BatchProcessor {
  private pendingQueries: Map<string, Promise<any>> = new Map();
  
  async batchQuery<T>(key: string, queryFn: () => Promise<T>): Promise<T> {
    // 如果相同查詢正在進行中，返回相同的 Promise
    if (this.pendingQueries.has(key)) {
      return this.pendingQueries.get(key);
    }
    
    const promise = queryFn();
    this.pendingQueries.set(key, promise);
    
    // 查詢完成後清理
    promise.finally(() => {
      this.pendingQueries.delete(key);
    });
    
    return promise;
  }
}

// 使用範例
const batchProcessor = new BatchProcessor();

// 多個請求同時請求相同餐廳的菜單時，只執行一次資料庫查詢
const menu = await batchProcessor.batchQuery(
  `menu:${restaurantId}`, 
  () => getMenuFromDatabase(restaurantId)
);
```

---

## 🔒 安全性架構

### WAF 規則配置
```javascript
// Cloudflare WAF 自訂規則
const wafRules = [
  {
    description: "阻擋SQL注入攻擊",
    expression: "http.request.uri.query contains \"union select\" or http.request.uri.query contains \"drop table\"",
    action: "block"
  },
  {
    description: "API速率限制",
    expression: "http.request.uri.path matches \"^/api/\" and ip.geoip.country ne \"TW\"",
    action: "challenge"
  },
  {
    description: "管理後台地區限制", 
    expression: "http.request.uri.path matches \"^/admin\" and ip.geoip.country ne \"TW\"",
    action: "block"
  }
];
```

### 資料加密與驗證
```typescript
// 敏感資料加密
export class DataEncryption {
  constructor(private secret: string) {}
  
  async encrypt(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.secret),
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(data)
    );
    
    return btoa(JSON.stringify({
      data: Array.from(new Uint8Array(encrypted)),
      iv: Array.from(iv)
    }));
  }
  
  async decrypt(encryptedData: string): Promise<string> {
    const { data, iv } = JSON.parse(atob(encryptedData));
    
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.secret),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      new Uint8Array(data)
    );
    
    return decoder.decode(decrypted);
  }
}

// 輸入驗證
export function validateInput(data: any, schema: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // 基本型別驗證
  for (const [key, rules] of Object.entries(schema)) {
    const value = data[key];
    
    if (rules.required && (value === undefined || value === null)) {
      errors.push(`${key} is required`);
      continue;
    }
    
    if (value !== undefined && rules.type && typeof value !== rules.type) {
      errors.push(`${key} must be of type ${rules.type}`);
    }
    
    if (rules.minLength && value.length < rules.minLength) {
      errors.push(`${key} must be at least ${rules.minLength} characters`);
    }
    
    if (rules.maxLength && value.length > rules.maxLength) {
      errors.push(`${key} must not exceed ${rules.maxLength} characters`);
    }
    
    if (rules.pattern && !rules.pattern.test(value)) {
      errors.push(`${key} format is invalid`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
```

---

## 🚧 開發優先順序與實作計劃

### Phase 1: MVP 基礎功能 (Week 1-8)

#### 🥇 **P0 - 最高優先級 (必須完成)**

**Week 1-2: 基礎設施搭建**
```
✅ 任務清單:
□ 設置 Cloudflare 帳戶與服務
  □ 建立 D1 資料庫 (staging/production)
  □ 設置 KV namespace 用於快取
  □ 建立 R2 bucket 用於圖片儲存
  □ 設置 Durable Objects 用於即時功能

□ 專案架構初始化
  □ 建立 monorepo 結構
  □ 設置 TypeScript 配置
  □ 安裝與配置開發工具 (ESLint, Prettier)
  □ 建立共用 types package

□ CI/CD 流水線
  □ 設置 GitHub Actions
  □ 配置 staging/production 環境
  □ 設置自動化測試流程
```

**Week 3-4: 核心 API 開發**
```
✅ 任務清單:
□ 資料庫 Schema 實作
  □ 執行 D1 資料庫遷移
  □ 建立初始資料與索引
  □ 設置資料庫連接與ORM

□ 認證系統
  □ JWT token 管理
  □ 用戶登入/註冊 API
  □ 權限檢查中介軟體
  □ 密碼雜湊與驗證

□ 餐廳管理 API
  □ 餐廳 CRUD 操作
  □ 餐廳設定管理
  □ 基本資料驗證
```

**Week 5-6: 菜單與訂單系統**
```
✅ 任務清單:
□ 菜單管理 API
  □ 分類 CRUD 操作
  □ 菜品 CRUD 操作
  □ 菜品狀態管理 (上架/下架)
  □ 圖片上傳與處理

□ 訂單系統 API
  □ 建立訂單功能
  □ 訂單狀態管理
  □ 訂單查詢與列表
  □ 訂單項目管理

□ 桌台管理 API
  □ 桌台 CRUD 操作
  □ QR Code 生成
  □ 桌台狀態管理
```

**Week 7-8: 前端應用開發**
```
✅ 任務清單:
□ 消費者點餐應用 (Vue.js)
  □ QR Code 掃描頁面
  □ 菜單瀏覽與搜索
  □ 購物車功能
  □ 訂單提交與追蹤

□ 管理後台 (Vue.js)
  □ 登入頁面
  □ 儀表板概覽
  □ 訂單管理介面
  □ 菜單管理介面
  □ 桌台管理介面

□ 響應式設計
  □ 手機端優化
  □ 平板端適配
  □ 桌面端支援
```

#### 🥈 **P1 - 高優先級 (重要功能)**

**Week 9-12: 多角色權限系統**
```
✅ 任務清單:
□ 用戶管理系統
  □ 員工邀請功能
  □ 角色權限矩陣
  □ 用戶狀態管理

□ 角色專屬介面
  □ 廚房顯示系統 (KDS)
  □ 服務員行動介面
  □ 收銀員終端
  □ 店主管理面板

□ 即時通知系統
  □ WebSocket 連接管理
  □ 訂單狀態即時推送
  □ 角色特定通知
```

### Phase 2: 進階功能開發 (Week 13-20)

#### 🥉 **P2 - 中等優先級 (提升體驗)**

**Week 13-16: 分析與報表**
```
✅ 任務清單:
□ 資料分析系統
  □ 營收統計 API
  □ 訂單趨勢分析
  □ 熱門商品統計
  □ 客戶行為分析

□ 報表生成
  □ 日報表自動生成
  □ 週報表與月報表
  □ 自訂時間範圍報表
  □ PDF 報表匯出

□ 分析儀表板
  □ 即時數據顯示
  □ 圖表與視覺化
  □ KPI 指標追蹤
```

**Week 17-20: 會員與行銷系統**
```
✅ 任務清單:
□ 會員系統
  □ 顧客註冊與登入
  □ 積分累積機制
  □ 積分兌換系統
  □ 會員等級制度

□ 行銷工具
  □ 優惠券系統
  □ 促銷活動管理
  □ 會員專屬優惠
  □ 推薦獎勵機制

□ 客戶關係管理
  □ 顧客資料管理
  □ 消費記錄追蹤
  □ 客戶標籤系統
```

### Phase 3: 優化與擴展 (Week 21-28)

#### 📊 **效能與品質優化**

**Week 21-24: 效能優化**
```
✅ 任務清單:
□ 資料庫優化
  □ 查詢效能分析與調優
  □ 索引策略優化
  □ 資料歸檔機制

□ 快取策略優化
  □ 智能快取預熱
  □ 快取失效策略
  □ CDN 配置優化

□ 前端效能優化
  □ 程式碼分割 (Code Splitting)
  □ 圖片懶加載
  □ 離線支援 (PWA)
```

**Week 25-28: 監控與維運**
```
✅ 任務清單:
□ 監控系統建置
  □ 錯誤追蹤與告警
  □ 效能監控儀表板
  □ 業務指標監控
  □ 用戶行為分析

□ 自動化運維
  □ 健康檢查機制
  □ 自動擴容策略
  □ 備份與還原流程

□ 安全性強化
  □ 安全稽核與滲透測試
  □ WAF 規則優化
  □ 資料安全合規
```

### 開發資源配置

#### 人力資源需求
```
角色                數量    主要負責模組
─────────────────────────────────────
產品經理             1      需求管理、進度協調
技術負責人           1      架構設計、技術決策
前端工程師           2      消費者App、管理後台
後端工程師           2      API開發、資料庫設計
DevOps工程師         1      CI/CD、監控部署
UI/UX設計師          1      界面設計、用戶體驗
QA測試工程師         1      功能測試、自動化測試
```

#### 技術風險評估

| 風險項目 | 可能性 | 影響程度 | 應對措施 |
|---------|-------|----------|----------|
| Cloudflare服務限制 | 中 | 高 | 提前驗證所有服務限制，準備備案 |
| D1資料庫效能瓶頸 | 中 | 中 | 設計讀寫分離，優化查詢 |
| 即時功能穩定性 | 高 | 中 | 充分測試Durable Objects |
| 前端相容性問題 | 中 | 低 | 建立完整測試矩陣 |
| 第三方依賴風險 | 低 | 中 | 最小化外部依賴，建立監控 |

### 測試策略

#### 測試金字塔
```
               ┌─────────────┐
               │   E2E測試   │  10%
               │  (Playwright) │
               └─────────────┘
              ┌─────────────────┐
              │    整合測試      │  20%
              │   (API測試)    │
              └─────────────────┘
        ┌─────────────────────────────┐
        │          單元測試            │  70%
        │     (Jest + Vitest)        │
        └─────────────────────────────┘
```

#### 測試覆蓋率目標
- **單元測試**: 80% 程式碼覆蓋率
- **整合測試**: 核心API 100%覆蓋
- **E2E測試**: 主要用戶流程 100%覆蓋

### 效能基準測試

#### API效能目標
```
端點類型              P50     P95     P99     可用性
─────────────────────────────────────────────────
菜單查詢API          <100ms  <200ms  <300ms  99.9%
訂單建立API          <150ms  <300ms  <500ms  99.9%
用戶認證API          <50ms   <100ms  <200ms  99.99%
圖片上傳API          <2s     <5s     <10s    99.5%
即時通知WebSocket    <50ms   <100ms  <200ms  99.5%
```

#### 前端效能目標
```
指標                  目標值
─────────────────────────────
首次內容繪製 (FCP)    <1.5s
最大內容繪製 (LCP)    <2.5s  
首次輸入延遲 (FID)    <100ms
累積版面偏移 (CLS)    <0.1
```

---

## 📋 實作檢查清單

### MVP 發佈前檢查清單

#### 🔧 **技術檢查**
- [ ] 所有核心API端點正常運作
- [ ] 資料庫遷移在所有環境成功執行  
- [ ] 前端應用在主流瀏覽器正常運作
- [ ] 圖片上傳與處理功能正常
- [ ] QR Code生成與掃描功能正常
- [ ] 即時通知功能正常
- [ ] CI/CD流水線正常運作
- [ ] 監控與告警系統運作正常

#### 🧪 **測試檢查**
- [ ] 單元測試覆蓋率 > 80%
- [ ] 整合測試全部通過
- [ ] E2E測試主要流程通過
- [ ] 壓力測試達到效能基準
- [ ] 安全性掃描無高危漏洞
- [ ] 相容性測試通過

#### 📚 **文件檢查**  
- [ ] API文件完整且準確
- [ ] 部署指南詳細可行
- [ ] 用戶操作手冊完成
- [ ] 故障排除指南準備
- [ ] 系統架構文件更新

#### 🚀 **部署檢查**
- [ ] 生產環境配置正確
- [ ] 環境變數設置完成
- [ ] SSL憑證配置正確
- [ ] DNS設定正確
- [ ] CDN配置最佳化
- [ ] 備份機制運作正常

---

## 📖 總結

本技術文件基於 **PRD需求**，設計了一套完整的 **Cloudflare生態系統解決方案**：

### 🎯 **核心優勢**
- **⚡ 極致效能**: 邊緣計算 + 全球CDN，P99響應時間 < 300ms
- **🌍 全球化部署**: Cloudflare全球節點，自動負載平衡
- **💰 成本效益**: 無伺服器架構，按需付費，大幅降低運營成本
- **🔒 企業級安全**: WAF + DDoS防護 + 零信任架構
- **📈 無限擴展**: 自動擴容，輕鬆應對流量高峰

### 🔧 **技術創新**
- **Durable Objects** 實現即時訂單通知
- **D1 無伺服器資料庫** 自動備份與複製
- **智能快取策略** 多層快取系統
- **微服務架構** 模組化開發，獨立部署

### 📊 **可量化成果預期**
- **開發週期**: 相較傳統架構縮短 40%
- **營運成本**: 較自建方案節省 60%+
- **系統可用性**: > 99.9%
- **全球延遲**: < 100ms (95%用戶)

### 🚀 **實作建議**
1. **優先實作MVP核心功能**，快速驗證市場需求
2. **建立完善的監控體系**，確保系統穩定性
3. **採用敏捷開發方法**，快速迭代優化
4. **重視用戶回饋**，持續改進產品體驗

這套架構設計不僅滿足當前需求，更為未來擴展奠定了堅實基礎。透過 Cloudflare 生態系統的強大能力，MakanMakan 將能夠快速成長為市場領導者。

---

**文檔版本**: v1.0  
**最後更新**: 2025年8月21日  
**下次審查**: 開發進度檢討時更新
<invoke name="TodoWrite">
<parameter name="todos">[{"id": "1", "content": "\u5206\u6790PRD\u6280\u8853\u9700\u6c42\u4e26\u6620\u5c04\u5230Cloudflare\u670d\u52d9", "status": "completed"}, {"id": "2", "content": "\u8a2d\u8a08\u57fa\u65bcCloudflare\u751f\u614b\u7684\u7cfb\u7d71\u67b6\u69cb", "status": "completed"}, {"id": "3", "content": "\u8a2d\u8a08\u8cc7\u6599\u5eabSchema (Cloudflare D1)", "status": "in_progress"}, {"id": "4", "content": "\u8a2d\u8a08API\u67b6\u69cb (Cloudflare Workers)", "status": "pending"}, {"id": "5", "content": "\u64b0\u5beb\u90e8\u7f72\u8207CI/CD\u7b56\u7565", "status": "pending"}, {"id": "6", "content": "\u5236\u5b9a\u958b\u767c\u512a\u5148\u9806\u5e8f\u8207\u5be6\u4f5c\u8a08\u5283", "status": "pending"}, {"id": "7", "content": "\u5275\u5efaTechnical Documentation", "status": "pending"}]
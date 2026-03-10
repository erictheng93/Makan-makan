# 🔄 MakanMakan 資料庫重構計劃

## 執行摘要

**當前狀態**: 46+ migrations,多處不一致,14個被禁用的文件
**目標狀態**: 16個模組化 migrations,清晰的依賴關係,完整的一致性
**預估時間**: 2-3 週
**風險等級**: 中等 (有完整的備份和回滾計劃)

---

## 一、問題分析

### 1.1 資料類型不一致

| 問題                            | 影響範圍 | 嚴重度      |
| ------------------------------- | -------- | ----------- |
| `restaurant_id` INTEGER vs TEXT | 全系統   | 🔴 Critical |
| Timestamp DATETIME vs INTEGER   | 20+ 表   | 🔴 Critical |
| 外鍵約束缺失/不一致             | 15+ 表   | 🟡 High     |

### 1.2 Migration 混亂

```
當前 Migrations 數量: 46+
├─ 已啟用: 27
├─ 已禁用: 14
├─ 重複/衝突: 5
└─ 修補性質: 12+
```

### 1.3 功能模組碎片化

- **員工管理**: 分散在 3 個 migrations
- **QR 系統**: 核心表 + 擴展表分離
- **支付系統**: 已移除但遺留表結構
- **AI 分析**: 與核心業務混雜

---

## 二、重構策略

### 2.1 核心原則

```
┌─────────────────────────────────────────┐
│ 🎯 設計原則                              │
├─────────────────────────────────────────┤
│ 1. 模組化優先                            │
│    - 每個功能一個獨立 migration         │
│    - 清晰的模組邊界                     │
│    - 明確的依賴關係                     │
│                                         │
│ 2. 資料一致性                            │
│    - 統一 ID 策略: TEXT (UUID)          │
│    - 統一時間戳: INTEGER (Unix ms)      │
│    - 完整外鍵約束                       │
│                                         │
│ 3. 擴展性設計                            │
│    - 支持多租戶                         │
│    - 預留擴展欄位 (metadata JSON)       │
│    - 版本控制支持                       │
│                                         │
│ 4. 效能優化                              │
│    - 合理的索引策略                     │
│    - 查詢優化視圖                       │
│    - 適當的反正規化                     │
│                                         │
└─────────────────────────────────────────┘
```

### 2.2 模組劃分

```
Layer 1: Foundation (基礎層)
═══════════════════════════════════════════
01_tenants_and_settings    餐廳和多租戶基礎
02_authentication          認證和授權
03_audit_system            審計和日誌

Layer 2: Core Business (核心業務)
═══════════════════════════════════════════
04_product_catalog         產品目錄
05_order_management        訂單管理
06_customer_management     顧客管理

Layer 3: Space Management (空間管理)
═══════════════════════════════════════════
07_table_and_seating       桌位管理
08_qr_code_system          QR 碼系統

Layer 4: Employee Management (員工管理)
═══════════════════════════════════════════
09_shift_scheduling        排班系統
10_leave_management        請假系統
11_attendance_tracking     考勤系統

Layer 5: Analytics (分析層)
═══════════════════════════════════════════
12_business_analytics      業務分析
13_ai_insights             AI 洞察

Layer 6: Advanced Features (進階功能)
═══════════════════════════════════════════
14_inventory_management    庫存管理
15_promotions_and_coupons  促銷優惠
16_loyalty_program         會員忠誠

依賴關係:
Layer 6 → Layer 5 → Layer 4 → Layer 3
          ↓                    ↓
        Layer 2 ──────────→ Layer 1
```

---

## 三、統一資料標準

### 3.1 ID 策略

```sql
-- 統一使用 TEXT 類型的 UUID
-- 格式: 使用 SQLite 的 lower(hex(randomblob(16)))

主鍵模式:
id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))))

外鍵模式:
restaurant_id TEXT NOT NULL
FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
```

### 3.2 時間戳策略

```sql
-- 統一使用 INTEGER 類型的 Unix timestamp (毫秒)

標準時間戳欄位:
created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)

可選時間戳:
deleted_at INTEGER NULL  -- 軟刪除
expired_at INTEGER NULL  -- 過期時間
```

### 3.3 通用欄位標準

```sql
-- 所有業務表的標準欄位

-- 基礎欄位
id TEXT PRIMARY KEY
restaurant_id TEXT NOT NULL
created_at INTEGER NOT NULL
updated_at INTEGER NOT NULL

-- 審計欄位 (可選)
created_by TEXT
updated_by TEXT
version INTEGER DEFAULT 1

-- 軟刪除 (可選)
is_deleted INTEGER DEFAULT 0
deleted_at INTEGER NULL
deleted_by TEXT NULL

-- 擴展欄位 (可選)
metadata TEXT  -- JSON,用於靈活擴展
```

### 3.4 布爾值標準

```sql
-- 統一使用 INTEGER (0/1)
-- 加 CHECK 約束確保值正確

is_active INTEGER NOT NULL DEFAULT 1
CHECK (is_active IN (0, 1))

is_deleted INTEGER NOT NULL DEFAULT 0
CHECK (is_deleted IN (0, 1))
```

### 3.5 JSON 欄位標準

```sql
-- 所有 JSON 欄位使用 TEXT 類型
-- 預設值為有效的 JSON

settings TEXT DEFAULT '{}'
preferences TEXT DEFAULT '{}'
metadata TEXT DEFAULT '{}'

-- 複雜 JSON 結構需要文檔說明
```

---

## 四、新架構設計

### 4.1 核心表設計標準

#### Layer 1: 基礎層

**01_tenants_and_settings.sql**

```sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 餐廳主表 (Tenants)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE restaurants (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

    -- 基本資訊
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,  -- URL-friendly identifier
    business_type TEXT NOT NULL,  -- restaurant, cafe, bar, etc.

    -- 聯絡資訊
    email TEXT,
    phone TEXT NOT NULL,
    website TEXT,

    -- 地址資訊
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city TEXT NOT NULL,
    state TEXT,
    postal_code TEXT,
    country TEXT NOT NULL DEFAULT 'TW',

    -- 地理位置
    latitude REAL,
    longitude REAL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Taipei',

    -- 營業資訊
    business_hours TEXT DEFAULT '{}',  -- JSON

    -- 品牌資訊
    logo_url TEXT,
    banner_url TEXT,
    brand_colors TEXT DEFAULT '{}',  -- JSON: {primary, secondary, accent}

    -- 訂閱和計費
    subscription_tier TEXT NOT NULL DEFAULT 'basic',  -- basic, pro, enterprise
    subscription_status TEXT NOT NULL DEFAULT 'active',  -- active, suspended, cancelled
    trial_ends_at INTEGER,
    subscription_ends_at INTEGER,

    -- 功能開關
    features TEXT DEFAULT '{}',  -- JSON: enabled features

    -- 設定
    settings TEXT DEFAULT '{}',  -- JSON: all restaurant settings

    -- 狀態
    status TEXT NOT NULL DEFAULT 'active',  -- active, inactive, suspended
    onboarding_completed INTEGER DEFAULT 0,

    -- 統計
    total_orders INTEGER DEFAULT 0,
    total_revenue REAL DEFAULT 0,

    -- 擴展
    metadata TEXT DEFAULT '{}',

    -- 審計
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),

    CHECK (subscription_tier IN ('basic', 'pro', 'enterprise')),
    CHECK (subscription_status IN ('active', 'trial', 'suspended', 'cancelled')),
    CHECK (status IN ('active', 'inactive', 'suspended'))
);

CREATE INDEX idx_restaurants_slug ON restaurants(slug);
CREATE INDEX idx_restaurants_status ON restaurants(status);
CREATE INDEX idx_restaurants_subscription ON restaurants(subscription_status);
```

**02_authentication.sql**

```sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 用戶表 (Users)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    restaurant_id TEXT NOT NULL,

    -- 基本資訊
    username TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    full_name TEXT NOT NULL,

    -- 認證
    password_hash TEXT NOT NULL,

    -- 角色
    role TEXT NOT NULL DEFAULT 'customer',
    -- admin, owner, manager, chef, server, cashier, customer
    permissions TEXT DEFAULT '[]',  -- JSON array of permission codes

    -- 個人資訊
    avatar_url TEXT,
    date_of_birth TEXT,  -- ISO date
    gender TEXT,  -- male, female, other, prefer_not_to_say

    -- 聯絡資訊
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    postal_code TEXT,

    -- 偏好設定
    language TEXT DEFAULT 'zh-TW',
    timezone TEXT DEFAULT 'Asia/Taipei',
    notification_preferences TEXT DEFAULT '{}',

    -- 狀態
    status TEXT NOT NULL DEFAULT 'active',  -- active, inactive, suspended
    is_email_verified INTEGER DEFAULT 0,
    is_phone_verified INTEGER DEFAULT 0,
    email_verified_at INTEGER,
    phone_verified_at INTEGER,

    -- 安全
    last_login_at INTEGER,
    last_login_ip TEXT,
    password_changed_at INTEGER,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until INTEGER,

    -- 2FA
    two_factor_enabled INTEGER DEFAULT 0,
    two_factor_secret TEXT,

    -- 統計 (for customers)
    total_orders INTEGER DEFAULT 0,
    total_spent REAL DEFAULT 0,
    loyalty_points INTEGER DEFAULT 0,

    -- 擴展
    metadata TEXT DEFAULT '{}',

    -- 審計
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    created_by TEXT,

    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,

    CHECK (role IN ('admin', 'owner', 'manager', 'chef', 'server', 'cashier', 'customer')),
    CHECK (status IN ('active', 'inactive', 'suspended')),
    CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say') OR gender IS NULL)
);

CREATE UNIQUE INDEX idx_users_username ON users(restaurant_id, username);
CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_users_role ON users(restaurant_id, role);
CREATE INDEX idx_users_status ON users(status);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 會話表 (Sessions)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,

    -- Token 資訊
    access_token_hash TEXT NOT NULL,
    refresh_token_hash TEXT,

    -- 裝置資訊
    device_type TEXT,  -- web, ios, android, desktop
    device_name TEXT,
    user_agent TEXT,
    ip_address TEXT,

    -- 地理位置
    country TEXT,
    city TEXT,
    latitude REAL,
    longitude REAL,

    -- 狀態
    is_active INTEGER DEFAULT 1,

    -- 時間
    last_accessed_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,

    -- 審計
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    CHECK (device_type IN ('web', 'ios', 'android', 'desktop') OR device_type IS NULL)
);

CREATE INDEX idx_sessions_user ON sessions(user_id, is_active);
CREATE INDEX idx_sessions_token ON sessions(access_token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
```

### 4.2 模組依賴圖

```
┌─────────────────────────────────────────────┐
│ 模組依賴關係詳細說明                         │
├─────────────────────────────────────────────┤
│                                             │
│  16_loyalty                                 │
│      ↓                                      │
│  15_promotions                              │
│      ↓                                      │
│  14_inventory                               │
│      ↓                                      │
│  ├─→ 13_ai_insights ←─┐                    │
│  │        ↓           │                    │
│  └─→ 12_analytics ←───┘                    │
│           ↓                                 │
│  ├─→ 11_attendance                          │
│  ├─→ 10_leaves                              │
│  └─→ 09_scheduling                          │
│           ↓                                 │
│  ├─→ 08_qr_system                           │
│  └─→ 07_tables                              │
│           ↓                                 │
│  ├─→ 06_customers                           │
│  ├─→ 05_orders                              │
│  └─→ 04_catalog                             │
│           ↓                                 │
│  ├─→ 03_audit                               │
│  ├─→ 02_auth                                │
│  └─→ 01_tenants                             │
│                                             │
│ 依賴規則:                                    │
│ - 只能依賴更底層的模組                       │
│ - 同層模組可相互依賴但需說明                 │
│ - 嚴禁循環依賴                               │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 五、實施計劃

### Phase 1: 準備階段 (2-3 天)

#### 1.1 資料備份

```bash
# 完整備份
npx wrangler d1 export makanmakan-staging --output backup_$(date +%Y%m%d).sql

# 驗證備份
sqlite3 backup_*.sql ".tables"
```

#### 1.2 創建新架構

```bash
# 創建新的 migrations 目錄
mkdir -p packages/database/migrations_v2

# 生成 16 個新 migration 文件
./scripts/generate-new-migrations.sh
```

#### 1.3 設定測試環境

```bash
# 創建測試資料庫
npx wrangler d1 create makanmakan-test-v2

# 更新 wrangler.toml
[[d1_databases]]
binding = "DB_V2"
database_name = "makanmakan-test-v2"
database_id = "xxx"
```

### Phase 2: 核心層重構 (3-4 天)

#### 2.1 Layer 1: 基礎層

```bash
# 按順序執行
01_tenants_and_settings.sql
02_authentication.sql
03_audit_system.sql

# 測試基礎功能
npm run test:migrations:layer1
```

#### 2.2 Layer 2: 核心業務層

```bash
04_product_catalog.sql
05_order_management.sql
06_customer_management.sql

# 測試業務邏輯
npm run test:migrations:layer2
```

### Phase 3: 功能層重構 (3-4 天)

#### 3.1 Layer 3 & 4

```bash
07_table_and_seating.sql
08_qr_code_system.sql
09_shift_scheduling.sql
10_leave_management.sql
11_attendance_tracking.sql

# 測試員工管理功能
npm run test:migrations:layer34
```

#### 3.2 Layer 5 & 6

```bash
12_business_analytics.sql
13_ai_insights.sql
14_inventory_management.sql
15_promotions_and_coupons.sql
16_loyalty_program.sql

# 測試進階功能
npm run test:migrations:layer56
```

### Phase 4: 資料遷移 (2-3 天)

#### 4.1 編寫遷移腳本

```typescript
// scripts/migrate-data-to-v2.ts

import { migrateRestaurants } from "./migrations/restaurants";
import { migrateUsers } from "./migrations/users";
import { migrateOrders } from "./migrations/orders";
// ... 其他遷移

async function main() {
  console.log("開始資料遷移...");

  // 按依賴順序遷移
  await migrateRestaurants();
  await migrateUsers();
  await migrateMenuItems();
  await migrateOrders();
  // ...

  console.log("資料遷移完成!");
}
```

#### 4.2 驗證資料完整性

```sql
-- 驗證記錄數
SELECT 'restaurants' as table_name, COUNT(*) as count FROM restaurants
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'orders', COUNT(*) FROM orders;

-- 驗證外鍵完整性
-- (執行完整性檢查腳本)
```

### Phase 5: 測試與驗證 (2-3 天)

#### 5.1 功能測試

```bash
# API 測試
npm run test:api

# 整合測試
npm run test:integration

# E2E 測試
npm run test:e2e
```

#### 5.2 效能測試

```bash
# 查詢效能測試
npm run test:performance

# 負載測試
npm run test:load
```

### Phase 6: 部署與切換 (1-2 天)

#### 6.1 Staging 部署

```bash
# 部署新架構到 staging
npm run deploy:staging:v2

# 運行煙霧測試
npm run test:smoke:staging
```

#### 6.2 Production 切換

```bash
# 維護模式
npm run maintenance:on

# 最終備份
npm run backup:final

# 部署 production
npm run deploy:production:v2

# 驗證
npm run verify:production

# 恢復服務
npm run maintenance:off
```

---

## 六、風險管理

### 6.1 風險識別

| 風險         | 可能性 | 影響 | 緩解措施          |
| ------------ | ------ | ---- | ----------------- |
| 資料遷移失敗 | 中     | 高   | 完整備份+回滾方案 |
| 停機時間過長 | 低     | 高   | 分階段遷移        |
| 外鍵約束錯誤 | 中     | 中   | 完整測試環境      |
| 效能下降     | 低     | 中   | 效能測試+索引優化 |

### 6.2 回滾計劃

```bash
# 如果需要回滾
./scripts/rollback-to-v1.sh

# 步驟:
# 1. 啟用維護模式
# 2. 還原備份
# 3. 切換到舊版本
# 4. 驗證功能
# 5. 關閉維護模式
```

---

## 七、成功指標

### 7.1 技術指標

```
✅ Migration 數量: 46+ → 16 (-65%)
✅ 資料一致性: 95% → 100%
✅ 外鍵完整性: 80% → 100%
✅ 查詢效能: P95 < 100ms
✅ 測試覆蓋率: > 80%
```

### 7.2 業務指標

```
✅ 部署時間: < 30 分鐘
✅ 停機時間: < 5 分鐘
✅ 資料遷移成功率: 100%
✅ 功能可用性: 100%
✅ Bug 數量: 0 critical bugs
```

---

## 八、後續優化

### 8.1 短期 (1-2 週)

- [ ] 建立完整的 API 文檔
- [ ] 補充所有單元測試
- [ ] 效能調優
- [ ] 監控告警設定

### 8.2 中期 (1-2 月)

- [ ] 實施快取策略
- [ ] 查詢優化
- [ ] 資料歸檔機制
- [ ] 自動化備份

### 8.3 長期 (3-6 月)

- [ ] 讀寫分離
- [ ] 分庫分表 (如需要)
- [ ] 資料倉庫建設
- [ ] 即時分析系統

---

## 附錄

### A. 完整 Migration 列表

詳見: `docs/migrations_v2/MIGRATION_INDEX.md`

### B. 資料遷移腳本

詳見: `scripts/data-migration/`

### C. 測試計劃

詳見: `docs/testing/MIGRATION_TEST_PLAN.md`

### D. API 變更清單

詳見: `docs/api/API_BREAKING_CHANGES.md`

---

**最後更新**: 2025-10-28
**版本**: 1.0
**負責人**: Development Team
**審核人**: Technical Lead

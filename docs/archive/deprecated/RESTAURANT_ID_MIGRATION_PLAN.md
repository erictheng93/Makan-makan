> ⚠️ **SUPERSEDED (2026-07-05)**：本文件規劃將 `restaurants.id` 從 `INTEGER` 改為 `S-YYYYMMDD-NNN` 格式的 TEXT，並透過 `public_id` 雙 ID 過渡（`0039_add_restaurant_public_id.sql` → `0041_finalize_restaurant_id.sql`）。實際採取的路徑不同：`restaurants.id` 現行直接是 `text("id").primaryKey().$defaultFn(() => uuidv7())`（見 `packages/database/src/schema/restaurants.ts:19-21`），純 UUID v7，沒有 `public_id`/`publicId` 欄位，也沒有經過此文件規劃的分段遷移。`packages/database/src/services/RestaurantIdGenerator.ts` 雖然存在，但實作的是 `uuidv7()`，並非本文件設計的 `S-YYYYMMDD-NNN` 格式，且目前程式碼庫中沒有任何地方呼叫它（已是死代碼）。本文件僅保留供歷史脈絡參考。

# Restaurant ID Migration Plan

## 從 INTEGER 改為 TEXT 格式的完整遷移計劃

**建立日期**: 2025-10-27
**預估執行時間**: 4-6 小時
**風險等級**: 🔴 高風險 (影響 45 張表)

---

## 📋 目標

將 `restaurants.id` 從 `INTEGER` 改為 `TEXT` 格式 `S-YYYYMMDD-NNN`，並同步更新所有相關表的 `restaurant_id` 欄位。

---

## 🎯 新 ID 格式設計

### 格式規範

```
S-YYYYMMDD-NNN
│  │       │
│  │       └─ 3位數序號 (001-999)
│  └───────── 8位數日期 (年月日)
└──────────── 1字元前綴 (S = Shop)
```

### 範例

- `S-20251027-001` - 2025年10月27日建立的第1間店
- `S-20251027-002` - 2025年10月27日建立的第2間店
- `S-20251128-001` - 2025年11月28日建立的第1間店

### 優點

- ✅ 業務可讀性強，一眼看出建立日期
- ✅ 自然排序友好
- ✅ 便於追蹤和管理
- ✅ 支援每日最多 999 間新店鋪

---

## 📊 影響範圍分析

### 受影響的表統計

| 類別            | 表數量 | 當前類型 | 目標類型        |
| --------------- | ------ | -------- | --------------- |
| **已使用 TEXT** | 9      | TEXT     | TEXT (無需改動) |
| **需要遷移**    | 36     | INTEGER  | TEXT            |
| **總計**        | **45** | -        | -               |

### 已使用 TEXT 的表 (9張)

這些表已經使用 TEXT 類型的 restaurant_id，無需修改結構，只需更新數據：

1. `ai_configurations`
2. `ai_insights_cache`
3. `ai_usage_logs`
4. `coupon_templates`
5. `coupons`
6. `daily_business_metrics`
7. `product_analytics`
8. `qr_batches` (可選)
9. `qr_codes` (可選)

### 需要遷移的表 (36張)

這些表需要修改 restaurant_id 欄位定義：

#### 核心業務表 (高優先級)

1. ⭐ `restaurants` - 主表
2. ⭐ `users` - 用戶/員工表
3. ⭐ `orders` - 訂單表
4. ⭐ `menu_items` - 菜單項目
5. ⭐ `categories` - 分類
6. ⭐ `tables` - 桌位

#### 排班與請假系統 (9張)

7. `employee_schedules`
8. `shift_templates`
9. `scheduling_rules`
10. `scheduling_conflicts`
11. `schedule_swap_requests`
12. `employee_availability`
13. `leave_requests`
14. `leave_approval_rules`
15. `employee_leave_balances`

#### 點餐與支付系統 (6張)

16. `group_orders`
17. `promotions`
18. `customer_reviews`
19. `table_reservations`
20. `inventory_items`
21. `cash_registers`

#### 排隊系統 (4張)

22. `waiting_queue`
23. `queue_settings`
24. `queue_displays`
25. `queue_events`
26. `queue_statistics`

#### 列印系統 (3張)

27. `printer_devices`
28. `printer_configurations`
29. `print_templates`

#### 其他系統表 (8張)

30. `restaurant_settings`
31. `restaurant_business_hours`
32. `restaurant_special_hours`
33. `leave_calendar_events`
34. `audit_logs`
35. `error_reports`
36. `system_alerts`

---

## 🚀 執行階段

### 階段 1：準備與驗證 (30分鐘)

#### 1.1 備份數據庫

```bash
# 匯出當前數據庫
npx wrangler d1 export makanmakan-local > backup_$(date +%Y%m%d_%H%M%S).sql
```

#### 1.2 查看現有餐廳數據

```sql
SELECT id, name, created_at FROM restaurants;
```

#### 1.3 建立 ID 生成服務

檔案：`packages/database/src/services/RestaurantIdGenerator.ts`

- ✅ 已存在，無需建立

---

### 階段 2：雙 ID 模式 (1小時)

#### 2.1 為 restaurants 表新增 public_id

```sql
-- Migration: 0039_add_restaurant_public_id.sql

-- 1. 新增 public_id 欄位
ALTER TABLE restaurants ADD COLUMN public_id TEXT UNIQUE;

-- 2. 為現有餐廳生成 public_id
-- 注意：這裡需要根據實際 created_at 生成
UPDATE restaurants
SET public_id = 'S-20251027-' || printf('%03d', id)
WHERE public_id IS NULL;

-- 3. 設為 NOT NULL
-- SQLite 不支援 ALTER COLUMN，需要重建表
-- 暫時保留為 NULLABLE，在後續階段處理

-- 4. 建立索引
CREATE INDEX idx_restaurants_public_id ON restaurants(public_id);
```

#### 2.2 驗證雙 ID 模式

```sql
SELECT id, public_id, name FROM restaurants;
```

---

### 階段 3：逐表遷移 (2-3小時)

由於 SQLite 不支援直接修改欄位類型，每張表需要：

1. 建立新表結構
2. 遷移數據
3. 刪除舊表
4. 重命名新表

#### 3.1 遷移 users 表（範例）

```sql
-- Migration: 0040_migrate_users_restaurant_id.sql

-- 1. 建立新表結構
CREATE TABLE users_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id TEXT NOT NULL,  -- 改為 TEXT
    -- ... 其他欄位保持不變 ...
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(public_id) ON DELETE CASCADE
);

-- 2. 遷移數據（將 INTEGER id 對應到 TEXT public_id）
INSERT INTO users_new
SELECT
    u.id,
    r.public_id as restaurant_id,  -- 使用 public_id
    -- ... 其他欄位 ...
FROM users u
JOIN restaurants r ON u.restaurant_id = r.id;

-- 3. 刪除舊表
DROP TABLE users;

-- 4. 重命名新表
ALTER TABLE users_new RENAME TO users;

-- 5. 重建索引
CREATE INDEX idx_users_restaurant_id ON users(restaurant_id);
-- ... 其他索引 ...
```

#### 3.2 批量遷移腳本

建立自動化腳本：`packages/database/migrations/0040_batch_migrate_tables.sql`

包含所有 36 張表的遷移 SQL。

---

### 階段 4：完成與清理 (30分鐘)

#### 4.1 驗證數據完整性

```sql
-- 檢查所有表的記錄數是否一致
SELECT
  'users' as table_name,
  COUNT(*) as count
FROM users
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
-- ... 其他表 ...
```

#### 4.2 移除舊 ID 並重命名

```sql
-- Migration: 0041_finalize_restaurant_id.sql

-- 1. 重建 restaurants 表，移除舊 id
CREATE TABLE restaurants_new (
    id TEXT PRIMARY KEY,  -- 直接使用 TEXT 作為主鍵
    name TEXT NOT NULL,
    -- ... 其他欄位 ...
);

-- 2. 遷移數據（使用 public_id 作為新的 id）
INSERT INTO restaurants_new
SELECT
    public_id as id,
    name,
    -- ... 其他欄位 ...
FROM restaurants;

-- 3. 刪除舊表並重命名
DROP TABLE restaurants;
ALTER TABLE restaurants_new RENAME TO restaurants;
```

#### 4.3 更新應用程式碼

**TypeScript 類型定義更新**：

- `packages/shared-types/src/restaurant.ts`
- `packages/shared-types/src/user.ts`
- `packages/shared-types/src/order.ts`
- ... 所有相關類型

```typescript
// 更新前
export interface Restaurant {
  id: number; // INTEGER
  // ...
}

// 更新後
export interface Restaurant {
  id: string; // TEXT (S-YYYYMMDD-NNN)
  // ...
}
```

**API 路由更新**：

- 所有接受 `restaurant_id` 參數的端點
- 驗證邏輯改為檢查 TEXT 格式
- 查詢參數解析

---

## ⚠️ 風險評估與緩解

### 高風險點

| 風險                 | 影響    | 緩解措施                         |
| -------------------- | ------- | -------------------------------- |
| 數據遷移失敗         | 🔴 嚴重 | 完整備份 + 分階段執行 + 回滾計劃 |
| FOREIGN KEY 約束衝突 | 🟡 中等 | 先禁用約束，遷移後重新啟用       |
| 應用程式碼不兼容     | 🟡 中等 | 完整的類型定義更新 + 測試        |
| 性能下降             | 🟢 低   | TEXT 索引略慢，但可接受          |

### 回滾計劃

如果遷移失敗：

1. 停止應用服務
2. 恢復備份數據庫
3. 回退程式碼到遷移前版本
4. 重啟服務

---

## ✅ 驗證檢查清單

- [ ] 數據庫完整備份
- [ ] 所有表結構已更新
- [ ] 所有數據已遷移
- [ ] FOREIGN KEY 約束正常
- [ ] 索引已重建
- [ ] TypeScript 類型定義已更新
- [ ] API 端點測試通過
- [ ] 前端功能正常
- [ ] 性能測試通過

---

## 📝 執行時間表

| 階段               | 預估時間    | 累計時間    |
| ------------------ | ----------- | ----------- |
| 階段 1：準備與驗證 | 30分鐘      | 0.5小時     |
| 階段 2：雙 ID 模式 | 1小時       | 1.5小時     |
| 階段 3：逐表遷移   | 2-3小時     | 3.5-4.5小時 |
| 階段 4：完成與清理 | 30分鐘      | 4-5小時     |
| **總計**           | **4-5小時** | -           |

---

## 🤔 建議

考慮到這是一個高風險、大規模的改造，建議：

### 方案 A：完整遷移（推薦給有充足時間的情況）

- 按照上述計劃完整執行
- 優點：徹底解決，未來無技術債
- 缺點：時間成本高，風險大

### 方案 B：混合模式（務實方案）

- 保持 INTEGER id 作為內部主鍵
- 新增 TEXT public_id 作為業務 ID
- 僅在 API 層面使用 public_id
- 優點：風險低，快速實施
- 缺點：保留技術債，數據庫層面仍用 INTEGER

### 方案 C：僅新數據使用 TEXT（最小改動）

- 現有數據保持 INTEGER
- 新建立的餐廳使用 TEXT ID
- 優點：零風險，不影響現有系統
- 缺點：數據不一致，長期維護困難

---

## 📌 下一步

請確認要採用哪個方案，我將開始執行相應的遷移計劃。

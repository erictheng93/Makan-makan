# 資料庫結構分析與優化建議

## 📊 現有MySQL資料庫結構分析

### 🔍 主要問題識別

#### 1. **資料表設計問題**

##### `employee` 表的問題：

```sql
-- ❌ 問題：混合了用戶和店主概念，欄位命名不一致
CREATE TABLE `employee` (
  `sol_sn` int NOT NULL COMMENT '序號',        -- ❌ 命名不清晰
  `sol_name` varchar(50),                      -- ❌ sol_前綴無意義
  `sol_pass` varchar(40),                      -- ❌ 密碼長度不足，無加鹽
  `sol_status` int NOT NULL DEFAULT '1',       -- ❌ 狀態含義不明
  `shop_ID` int NOT NULL,                      -- ❌ 缺乏外鍵約束
  `sol_adrress` varchar(100),                  -- ❌ 拼寫錯誤
  `sol_hp` varchar(15)                         -- ❌ hp含義不清
);
```

##### `shop_menu` 表的問題：

```sql
-- ❌ 問題：冗餘欄位過多，正規化不足
CREATE TABLE `shop_menu` (
  `menu_nonveg` tinyint(1),                    -- ❌ 多個布林值應整合
  `menu_wholeveg` tinyint(1),
  `menu_eggveg` tinyint(1),
  `menu_milkveg` tinyint(1),
  `menu_eggmilkveg` tinyint(1),
  `menu_nonspices` tinyint(1),                 -- ❌ 辣度級別應用ENUM
  `menu_spices` tinyint(1),
  `menu_spices1` tinyint(1),
  `menu_spices2` tinyint(1),
  `menu_spices3` tinyint(1)
);
```

##### `shop_order` 和 `shop_ordermenu` 表的問題：

```sql
-- ❌ 問題：訂單結構設計不良
CREATE TABLE `shop_order` (
  `shopOrderMenu_ID` varchar(20),              -- ❌ 手動生成ID，容易衝突
  `shop_ID` varchar(10),                       -- ❌ 型別不一致
  `shopOrder_table` varchar(3),               -- ❌ 應該是數字
  `shopOrder_price` float                      -- ❌ 不應該用float存儲金額
);
```

#### 2. **索引策略問題**

```sql
-- ❌ 缺乏複合索引
-- 常用查詢模式：
SELECT * FROM shop_menu WHERE shop_ID = ? AND menu_available = 1;
SELECT * FROM shop_order WHERE shop_ID = ? AND shopOrder_date = ?;

-- ❌ 沒有建立相應的複合索引
```

#### 3. **資料一致性問題**

- 缺乏外鍵約束
- 沒有適當的CHECK約束
- 價格使用FLOAT型別（精度問題）
- 狀態欄位沒有明確定義

## 🚀 優化後的D1資料庫設計

### ✅ 優化原則

1. **正規化設計** - 減少資料冗餘
2. **一致性命名** - 統一的欄位命名規範
3. **型別安全** - 使用適當的資料型別
4. **索引優化** - 基於查詢模式的索引設計
5. **約束完整** - 完整的約束和驗證

### 🎯 優化後的資料庫Schema

```sql
-- ✅ 餐廳表 - 清晰的主實體
CREATE TABLE restaurants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    business_hours TEXT,                        -- JSON格式存儲
    settings TEXT,                              -- JSON格式存儲配置
    logo_url TEXT,
    status INTEGER DEFAULT 1 CHECK(status IN (0, 1)), -- 0:停用, 1:啟用
    plan_type INTEGER DEFAULT 0 CHECK(plan_type IN (0, 1, 2)), -- 0:免費, 1:基礎, 2:專業
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ✅ 用戶表 - 統一的多角色用戶系統
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,               -- 使用Argon2雜湊，足夠長度
    name TEXT NOT NULL,
    role INTEGER NOT NULL DEFAULT 1 CHECK(role IN (0, 1, 2, 3, 4)),
    -- 0: Admin, 1: Owner, 2: Chef, 3: Service, 4: Cashier
    restaurant_id INTEGER,
    phone TEXT,
    address TEXT,
    status INTEGER DEFAULT 1 CHECK(status IN (0, 1)), -- 0:停用, 1:啟用
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

-- ✅ 桌台表 - 簡化且實用
CREATE TABLE tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    table_number INTEGER NOT NULL,
    table_name TEXT,
    capacity INTEGER DEFAULT 4 CHECK(capacity > 0),
    qr_code TEXT UNIQUE NOT NULL,              -- QR碼內容
    status INTEGER DEFAULT 0 CHECK(status IN (0, 1, 2)), -- 0:空桌, 1:佔用, 2:保留
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    UNIQUE(restaurant_id, table_number)
);

-- ✅ 分類表 - 支援階層結構
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    parent_id INTEGER,                         -- 支援子分類
    sort_order INTEGER DEFAULT 0,
    status INTEGER DEFAULT 1 CHECK(status IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- ✅ 菜單項目表 - 優化後的結構
CREATE TABLE menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL CHECK(price >= 0),  -- ✅ 使用分為單位避免浮點精度問題
    image_url TEXT,
    image_variants TEXT,                       -- JSON存儲不同尺寸
    dietary_info TEXT,                         -- ✅ JSON存儲飲食資訊 {"vegetarian": true, "vegan": false, "halal": true}
    spice_level INTEGER DEFAULT 0 CHECK(spice_level BETWEEN 0 AND 4), -- ✅ 0:不辣, 1:微辣, 2:小辣, 3:中辣, 4:大辣
    options TEXT,                              -- JSON存儲客製化選項
    sort_order INTEGER DEFAULT 0,
    is_available INTEGER DEFAULT 1 CHECK(is_available IN (0, 1)),
    is_featured INTEGER DEFAULT 0 CHECK(is_featured IN (0, 1)), -- ✅ 招牌菜
    inventory_count INTEGER DEFAULT -1,       -- -1表示無限量
    order_count INTEGER DEFAULT 0,           -- ✅ 追蹤被點次數
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- ✅ 訂單表 - 重新設計的清晰結構
CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    table_id INTEGER NOT NULL,
    order_number TEXT UNIQUE NOT NULL,        -- ✅ 格式: REST_TABLE_YYYYMMDD_SEQUENCE
    customer_name TEXT,
    customer_phone TEXT,
    total_amount INTEGER NOT NULL CHECK(total_amount >= 0), -- ✅ 分為單位
    status INTEGER DEFAULT 0 CHECK(status IN (0, 1, 2, 3, 4, 5, 6)),
    -- ✅ 0:待確認, 1:已確認, 2:製作中, 3:準備完成, 4:已送達, 5:已結帳, 6:已取消
    payment_status INTEGER DEFAULT 0 CHECK(payment_status IN (0, 1, 2)),
    -- 0:待付款, 1:已付款, 2:付款失敗
    payment_method TEXT,                      -- cash, card, online
    notes TEXT,
    estimated_time INTEGER,                   -- 預估製作時間(分鐘)
    confirmed_at DATETIME,
    prepared_at DATETIME,
    delivered_at DATETIME,
    paid_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE
);

-- ✅ 訂單項目表 - 優化結構
CREATE TABLE order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    menu_item_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
    unit_price INTEGER NOT NULL CHECK(unit_price >= 0), -- ✅ 記錄下單時的價格
    total_price INTEGER NOT NULL CHECK(total_price >= 0),
    customizations TEXT,                      -- JSON存儲客製化選項
    notes TEXT,
    status INTEGER DEFAULT 0 CHECK(status IN (0, 1, 2, 3)),
    -- 0:待製作, 1:製作中, 2:完成, 3:已送達
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE RESTRICT
);

-- ✅ 會話表 - 可選，也可用KV
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER,
    restaurant_id INTEGER,
    data TEXT,                                -- JSON格式
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

-- ✅ 審計日誌表 - 完整的操作追蹤
CREATE TABLE audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    restaurant_id INTEGER,
    action TEXT NOT NULL,                     -- CREATE, UPDATE, DELETE
    resource_type TEXT NOT NULL,             -- orders, menu_items, users
    resource_id INTEGER,
    old_values TEXT,                         -- JSON格式
    new_values TEXT,                         -- JSON格式
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);
```

### 📊 優化的索引策略

```sql
-- ✅ 基於查詢模式的高效索引
-- 用戶查詢索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_restaurant_role ON users(restaurant_id, role) WHERE status = 1;

-- 桌台查詢索引
CREATE INDEX idx_tables_restaurant ON tables(restaurant_id) WHERE status IN (0, 1);
CREATE INDEX idx_tables_qr_code ON tables(qr_code);

-- 分類查詢索引
CREATE INDEX idx_categories_restaurant_active ON categories(restaurant_id, status, sort_order);

-- 菜單查詢索引(最重要)
CREATE INDEX idx_menu_items_restaurant_category ON menu_items(restaurant_id, category_id) WHERE is_available = 1;
CREATE INDEX idx_menu_items_featured ON menu_items(restaurant_id, is_featured, sort_order) WHERE is_available = 1 AND is_featured = 1;
CREATE INDEX idx_menu_items_popular ON menu_items(restaurant_id, order_count DESC) WHERE is_available = 1;

-- 訂單查詢索引(高頻查詢)
CREATE INDEX idx_orders_restaurant_status ON orders(restaurant_id, status, created_at DESC);
CREATE INDEX idx_orders_table_active ON orders(table_id, status) WHERE status IN (0, 1, 2, 3, 4);
CREATE INDEX idx_orders_date_restaurant ON orders(restaurant_id, DATE(created_at));
CREATE INDEX idx_orders_number ON orders(order_number);

-- 訂單項目索引
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_status ON order_items(order_id, status);

-- 會話清理索引
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- 審計日誌查詢索引
CREATE INDEX idx_audit_logs_restaurant_date ON audit_logs(restaurant_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
```

## 📈 效能優化策略

### 1. **查詢優化**

```sql
-- ✅ 優化的常用查詢
-- 取得餐廳活躍菜單(使用覆蓋索引)
SELECT id, name, price, image_url, is_featured
FROM menu_items
WHERE restaurant_id = ? AND is_available = 1
ORDER BY sort_order, name;

-- ✅ 取得活躍訂單(使用複合索引)
SELECT id, order_number, table_id, total_amount, status, created_at
FROM orders
WHERE restaurant_id = ? AND status IN (0, 1, 2, 3)
ORDER BY created_at DESC
LIMIT 50;
```

### 2. **資料完整性**

```sql
-- ✅ 觸發器確保資料一致性
CREATE TRIGGER update_order_total
AFTER INSERT ON order_items
BEGIN
    UPDATE orders
    SET total_amount = (
        SELECT SUM(total_price)
        FROM order_items
        WHERE order_id = NEW.order_id
    ),
    updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.order_id;
END;

-- ✅ 自動更新時間戳
CREATE TRIGGER update_menu_items_timestamp
AFTER UPDATE ON menu_items
BEGIN
    UPDATE menu_items
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;
```

## 🔄 資料遷移策略

### 從MySQL到D1的轉換腳本

```typescript
// ✅ 資料轉換邏輯
interface MigrationScript {
  // 1. 餐廳資料轉換
  migrateRestaurants: () => {
    // shop_info -> restaurants
    return `
      INSERT INTO restaurants (id, name, address, phone, business_hours, status)
      SELECT shop_ID, shop_name, shop_adrress, shop_hp,
             '{"monday":"09:00-22:00",...}', shop_available
      FROM shop_info;
    `;
  },

  // 2. 用戶資料轉換
  migrateUsers: () => {
    // employee -> users (需要密碼重新雜湊)
    return `
      INSERT INTO users (name, role, restaurant_id, phone, address, status)
      SELECT sol_name, sol_status, shop_ID, sol_hp, sol_adrress, 1
      FROM employee;
    `;
  },

  // 3. 菜單資料轉換
  migrateMenuItems: () => {
    // shop_menu -> menu_items (整合多個布林欄位)
    return `
      INSERT INTO menu_items (restaurant_id, name, description, price, ...)
      SELECT shop_ID, menu_foodname, menu_describe,
             CAST(menu_price * 100 AS INTEGER), -- 轉為分
             CASE
               WHEN menu_nonveg = 1 THEN '{"vegetarian":false}'
               WHEN menu_wholeveg = 1 THEN '{"vegetarian":true,"vegan":true}'
               ELSE '{"vegetarian":true,"vegan":false}'
             END as dietary_info
      FROM shop_menu;
    `;
  }
}
```

---

**主要改進總結**：

1. ✅ **正規化資料結構** - 減少冗餘
2. ✅ **統一命名規範** - 提高可讀性
3. ✅ **型別安全** - 適當約束和驗證
4. ✅ **索引優化** - 基於查詢模式
5. ✅ **審計追蹤** - 完整的操作日誌
6. ✅ **擴展性設計** - 支援未來功能擴展

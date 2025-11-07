-- =====================================================
-- Migration: Reservation and Waiting List System
-- Version: 0046
-- Date: 2025-01-03
-- Description: 訂位與候位系統
--              包含訂位管理、候位排隊、時段容量管理
-- =====================================================

-- ==========================================
-- 1. Reservations Table - 訂位表
-- ==========================================
CREATE TABLE IF NOT EXISTS reservations (
    id TEXT PRIMARY KEY,                       -- UUID

    -- 餐廳和顧客資訊
    restaurant_id TEXT NOT NULL,
    customer_id INTEGER,                       -- 可選，關聯到 users 表
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,

    -- 訂位資訊
    party_size INTEGER NOT NULL,               -- 用餐人數
    reservation_date TEXT NOT NULL,            -- 預訂日期 (YYYY-MM-DD)
    reservation_time TEXT NOT NULL,            -- 預訂時間 (HH:MM)
    duration_minutes INTEGER DEFAULT 90,       -- 預計用餐時長

    -- 桌位分配
    table_id INTEGER,                          -- 分配的桌位 ID

    -- 特殊需求
    special_requests TEXT,                     -- 特殊需求（慶生、無障礙等）

    -- 狀態管理
    status TEXT NOT NULL DEFAULT 'pending',    -- pending, confirmed, arrived, seated, completed, cancelled, no_show
    confirmation_code TEXT UNIQUE NOT NULL,    -- 6位數確認碼

    -- 備註
    notes TEXT,                                -- 店家備註

    -- 時間戳記
    created_at INTEGER NOT NULL,               -- Unix timestamp
    confirmed_at INTEGER,                      -- 確認時間
    reminded_at INTEGER,                       -- 提醒發送時間
    arrived_at INTEGER,                        -- 到店時間
    seated_at INTEGER,                         -- 入座時間
    completed_at INTEGER,                      -- 完成時間
    cancelled_at INTEGER,                      -- 取消時間
    no_show_at INTEGER,                        -- 未到標記時間
    updated_at INTEGER NOT NULL,               -- 更新時間

    -- 外鍵約束
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE SET NULL
);

-- ==========================================
-- 2. Waiting List Table - 候位表
-- ==========================================
CREATE TABLE IF NOT EXISTS waiting_list (
    id TEXT PRIMARY KEY,                       -- UUID

    -- 餐廳和顧客資訊
    restaurant_id TEXT NOT NULL,
    customer_id INTEGER,                       -- 可選
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,

    -- 候位資訊
    party_size INTEGER NOT NULL,               -- 用餐人數
    preferred_table_type TEXT,                 -- 偏好桌型 (2-person, 4-person, 6-person+)

    -- 排隊管理
    queue_number INTEGER NOT NULL,             -- 排隊號碼 (每日重置)
    queue_letter TEXT,                         -- 號碼前綴 (A/B/C 根據桌型)
    priority INTEGER DEFAULT 0,                -- 優先級 (VIP 可加分)

    -- 等待預估
    estimated_wait_minutes INTEGER,            -- 預估等待時間

    -- 桌位分配
    table_id INTEGER,                          -- 分配的桌位 ID（叫號後）

    -- 狀態管理
    status TEXT NOT NULL DEFAULT 'waiting',    -- waiting, called, confirmed, seated, cancelled, expired, no_show

    -- 備註
    notes TEXT,                                -- 備註

    -- 時間戳記
    created_at INTEGER NOT NULL,               -- 登記時間
    called_at INTEGER,                         -- 叫號時間
    notified_at INTEGER,                       -- 通知發送時間
    confirmed_at INTEGER,                      -- 顧客確認時間
    seated_at INTEGER,                         -- 入座時間
    cancelled_at INTEGER,                      -- 取消時間
    expired_at INTEGER,                        -- 過號時間
    timeout_at INTEGER,                        -- 超時時間 (叫號後5分鐘)
    updated_at INTEGER NOT NULL,               -- 更新時間

    -- 外鍵約束
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE SET NULL
);

-- ==========================================
-- 3. Reservation Slots Table - 時段容量表
-- ==========================================
CREATE TABLE IF NOT EXISTS reservation_slots (
    id TEXT PRIMARY KEY,                       -- UUID

    -- 餐廳和時段
    restaurant_id TEXT NOT NULL,
    date TEXT NOT NULL,                        -- 日期 (YYYY-MM-DD)
    time_slot TEXT NOT NULL,                   -- 時段 (HH:MM)

    -- 容量設定
    max_capacity INTEGER NOT NULL,             -- 最大容納人數
    max_tables INTEGER NOT NULL,               -- 最大桌數
    current_reservations INTEGER DEFAULT 0,    -- 當前訂位數
    current_capacity INTEGER DEFAULT 0,        -- 當前人數

    -- 狀態
    is_available INTEGER DEFAULT 1,            -- 是否開放 (boolean)
    block_reason TEXT,                         -- 關閉原因

    -- 時間戳記
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    -- 複合唯一索引
    UNIQUE(restaurant_id, date, time_slot)
);

-- ==========================================
-- 4. 修改 Tables 表 - 新增欄位
-- ==========================================
-- Note: tables 表已有類似欄位（is_occupied, occupied_at, estimated_free_at, last_cleaned_at）
-- 只新增訂位/候位系統需要的關聯欄位

ALTER TABLE tables ADD COLUMN reservation_id TEXT;
-- 關聯的訂位 ID

ALTER TABLE tables ADD COLUMN waiting_list_id TEXT;
-- 關聯的候位 ID

-- 以下欄位已存在於 tables 表中，註解掉以避免衝突：
-- ALTER TABLE tables ADD COLUMN current_status TEXT DEFAULT 'available';  -- 使用現有的 is_occupied
-- ALTER TABLE tables ADD COLUMN occupied_since INTEGER;                   -- 使用現有的 occupied_at
-- ALTER TABLE tables ADD COLUMN estimated_turnover_at INTEGER;           -- 使用現有的 estimated_free_at
-- ALTER TABLE tables ADD COLUMN last_cleaned_at INTEGER;                 -- 已存在

-- ==========================================
-- 5. Indexes - 索引優化
-- ==========================================

-- Reservations 索引
CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_date
    ON reservations(restaurant_id, reservation_date);

CREATE INDEX IF NOT EXISTS idx_reservations_status
    ON reservations(status);

CREATE INDEX IF NOT EXISTS idx_reservations_confirmation
    ON reservations(confirmation_code);

CREATE INDEX IF NOT EXISTS idx_reservations_customer
    ON reservations(customer_id);

CREATE INDEX IF NOT EXISTS idx_reservations_table
    ON reservations(table_id);

CREATE INDEX IF NOT EXISTS idx_reservations_phone
    ON reservations(customer_phone);

-- Waiting List 索引
CREATE INDEX IF NOT EXISTS idx_waiting_restaurant_status
    ON waiting_list(restaurant_id, status);

CREATE INDEX IF NOT EXISTS idx_waiting_queue
    ON waiting_list(restaurant_id, queue_number);

CREATE INDEX IF NOT EXISTS idx_waiting_phone
    ON waiting_list(customer_phone);

CREATE INDEX IF NOT EXISTS idx_waiting_created
    ON waiting_list(created_at);

CREATE INDEX IF NOT EXISTS idx_waiting_table
    ON waiting_list(table_id);

-- Reservation Slots 索引
CREATE INDEX IF NOT EXISTS idx_slots_restaurant_date
    ON reservation_slots(restaurant_id, date);

CREATE INDEX IF NOT EXISTS idx_slots_available
    ON reservation_slots(is_available);

-- Tables 狀態索引 (使用現有的 is_occupied 欄位)
CREATE INDEX IF NOT EXISTS idx_tables_is_occupied_status
    ON tables(is_occupied);

CREATE INDEX IF NOT EXISTS idx_tables_reservation
    ON tables(reservation_id);

CREATE INDEX IF NOT EXISTS idx_tables_waiting
    ON tables(waiting_list_id);

-- ==========================================
-- 6. 初始化範例資料 (可選)
-- ==========================================

-- 建立未來7天的時段容量（範例：餐廳 ID = 1）
-- 這部分可以由管理介面手動設定，這裡只是示範

-- 午餐時段 (11:00 - 14:00)
-- INSERT INTO reservation_slots (id, restaurant_id, date, time_slot, max_capacity, max_tables, created_at, updated_at)
-- VALUES
--     ('slot_' || hex(randomblob(16)), '1', date('now', '+0 days'), '11:00', 40, 12, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
--     ('slot_' || hex(randomblob(16)), '1', date('now', '+0 days'), '11:30', 40, 12, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- ==========================================
-- 7. Views - 統計視圖
-- ==========================================

-- 訂位統計視圖
CREATE VIEW IF NOT EXISTS v_reservation_stats AS
SELECT
    r.restaurant_id,
    r.reservation_date,
    COUNT(*) as total_reservations,
    SUM(CASE WHEN r.status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count,
    SUM(CASE WHEN r.status = 'completed' THEN 1 ELSE 0 END) as completed_count,
    SUM(CASE WHEN r.status = 'no_show' THEN 1 ELSE 0 END) as no_show_count,
    SUM(CASE WHEN r.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
    SUM(r.party_size) as total_guests,
    ROUND(CAST(SUM(CASE WHEN r.status = 'no_show' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 2) as no_show_rate
FROM reservations r
GROUP BY r.restaurant_id, r.reservation_date;

-- 候位統計視圖
CREATE VIEW IF NOT EXISTS v_waiting_stats AS
SELECT
    w.restaurant_id,
    DATE(w.created_at / 1000, 'unixepoch', 'localtime') as date,
    COUNT(*) as total_waiting,
    SUM(CASE WHEN w.status = 'seated' THEN 1 ELSE 0 END) as seated_count,
    SUM(CASE WHEN w.status = 'expired' THEN 1 ELSE 0 END) as expired_count,
    SUM(CASE WHEN w.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
    AVG(CASE
        WHEN w.seated_at IS NOT NULL AND w.created_at IS NOT NULL
        THEN (w.seated_at - w.created_at) / 60000.0
        ELSE NULL
    END) as avg_wait_minutes,
    ROUND(CAST(SUM(CASE WHEN w.status = 'expired' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 2) as expire_rate
FROM waiting_list w
GROUP BY w.restaurant_id, date;

-- 桌位使用率視圖
-- 使用現有的 is_occupied、reservation_id、waiting_list_id 欄位
CREATE VIEW IF NOT EXISTS v_table_utilization AS
SELECT
    t.restaurant_id,
    COUNT(*) as total_tables,
    SUM(CASE WHEN t.is_occupied = 0 AND t.reservation_id IS NULL THEN 1 ELSE 0 END) as available_tables,
    SUM(CASE WHEN t.is_occupied = 1 THEN 1 ELSE 0 END) as occupied_tables,
    SUM(CASE WHEN t.reservation_id IS NOT NULL AND t.is_occupied = 0 THEN 1 ELSE 0 END) as reserved_tables,
    0 as cleaning_tables,  -- 清潔狀態可由應用層標記管理
    ROUND(CAST(SUM(CASE WHEN t.is_occupied = 1 OR t.reservation_id IS NOT NULL THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 2) as occupancy_rate
FROM tables t
WHERE t.is_active = 1
GROUP BY t.restaurant_id;

-- ==========================================
-- Migration Complete
-- ==========================================

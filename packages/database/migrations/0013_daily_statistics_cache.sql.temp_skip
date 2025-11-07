-- Daily Statistics Cache Migration
-- Created: 2025-09-03
-- Description: Creates caching tables for daily statistics and performance metrics

-- =================================================================
-- 1. 每日統計快取表
-- =================================================================

-- 每日餐廳統計快取表
CREATE TABLE IF NOT EXISTS daily_restaurant_statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    stat_date DATE NOT NULL,
    
    -- 訂單統計
    total_orders INTEGER DEFAULT 0,
    completed_orders INTEGER DEFAULT 0,
    cancelled_orders INTEGER DEFAULT 0,
    dine_in_orders INTEGER DEFAULT 0,
    takeaway_orders INTEGER DEFAULT 0,
    delivery_orders INTEGER DEFAULT 0,
    
    -- 收入統計
    total_revenue DECIMAL(10,2) DEFAULT 0.00,
    dine_in_revenue DECIMAL(10,2) DEFAULT 0.00,
    takeaway_revenue DECIMAL(10,2) DEFAULT 0.00,
    delivery_revenue DECIMAL(10,2) DEFAULT 0.00,
    avg_order_value DECIMAL(10,2) DEFAULT 0.00,
    
    -- 客戶統計
    total_customers INTEGER DEFAULT 0,
    new_customers INTEGER DEFAULT 0,
    returning_customers INTEGER DEFAULT 0,
    
    -- 桌台統計
    table_utilization_rate DECIMAL(5,2) DEFAULT 0.00,
    avg_dining_duration_minutes DECIMAL(8,2) DEFAULT 0.00,
    table_turnover_rate DECIMAL(5,2) DEFAULT 0.00,
    
    -- 效能統計
    avg_preparation_time_minutes DECIMAL(8,2) DEFAULT 0.00,
    on_time_orders INTEGER DEFAULT 0,
    delayed_orders INTEGER DEFAULT 0,
    on_time_rate DECIMAL(5,2) DEFAULT 0.00,
    
    -- 時段統計
    morning_orders INTEGER DEFAULT 0,    -- 06:00-11:59
    lunch_orders INTEGER DEFAULT 0,      -- 12:00-15:59
    afternoon_orders INTEGER DEFAULT 0,  -- 16:00-17:59
    dinner_orders INTEGER DEFAULT 0,     -- 18:00-22:59
    late_night_orders INTEGER DEFAULT 0, -- 23:00-05:59
    
    -- 營運指標
    food_cost_percentage DECIMAL(5,2) DEFAULT 0.00,
    labor_cost_percentage DECIMAL(5,2) DEFAULT 0.00,
    profit_margin DECIMAL(5,2) DEFAULT 0.00,
    
    -- 元數據
    calculation_completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    UNIQUE(restaurant_id, stat_date)
);

-- =================================================================
-- 2. 每日菜單項目統計快取表
-- =================================================================

CREATE TABLE IF NOT EXISTS daily_menu_item_statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_item_id INTEGER NOT NULL,
    restaurant_id INTEGER NOT NULL,
    stat_date DATE NOT NULL,
    
    -- 銷售統計
    order_count INTEGER DEFAULT 0,
    total_quantity_sold INTEGER DEFAULT 0,
    total_revenue DECIMAL(10,2) DEFAULT 0.00,
    avg_selling_price DECIMAL(8,2) DEFAULT 0.00,
    
    -- 時段銷售分佈
    morning_sales INTEGER DEFAULT 0,
    lunch_sales INTEGER DEFAULT 0,
    afternoon_sales INTEGER DEFAULT 0,
    dinner_sales INTEGER DEFAULT 0,
    late_night_sales INTEGER DEFAULT 0,
    
    -- 排名和熱度
    popularity_rank INTEGER,
    revenue_rank INTEGER,
    
    -- 客製化統計
    customization_rate DECIMAL(5,2) DEFAULT 0.00, -- 有客製化的訂單比例
    avg_customization_upcharge DECIMAL(8,2) DEFAULT 0.00,
    
    -- 評價統計（如果當天有評價）
    avg_rating DECIMAL(3,2),
    rating_count INTEGER DEFAULT 0,
    
    -- 元數據
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    UNIQUE(menu_item_id, stat_date)
);

-- =================================================================
-- 3. 每日庫存統計快取表
-- =================================================================

CREATE TABLE IF NOT EXISTS daily_inventory_statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_item_id INTEGER NOT NULL,
    restaurant_id INTEGER NOT NULL,
    stat_date DATE NOT NULL,
    
    -- 庫存異動統計
    opening_stock DECIMAL(10,2) DEFAULT 0.00,
    closing_stock DECIMAL(10,2) DEFAULT 0.00,
    stock_received DECIMAL(10,2) DEFAULT 0.00,
    stock_used DECIMAL(10,2) DEFAULT 0.00,
    stock_wasted DECIMAL(10,2) DEFAULT 0.00,
    stock_adjusted DECIMAL(10,2) DEFAULT 0.00,
    
    -- 成本統計
    opening_value DECIMAL(10,2) DEFAULT 0.00,
    closing_value DECIMAL(10,2) DEFAULT 0.00,
    cost_of_goods_used DECIMAL(10,2) DEFAULT 0.00,
    waste_cost DECIMAL(10,2) DEFAULT 0.00,
    
    -- 異動次數統計
    receiving_transactions INTEGER DEFAULT 0,
    usage_transactions INTEGER DEFAULT 0,
    waste_transactions INTEGER DEFAULT 0,
    adjustment_transactions INTEGER DEFAULT 0,
    
    -- 預警狀態
    was_out_of_stock BOOLEAN DEFAULT FALSE,
    was_low_stock BOOLEAN DEFAULT FALSE,
    was_overstocked BOOLEAN DEFAULT FALSE,
    
    -- 元數據
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    UNIQUE(inventory_item_id, stat_date)
);

-- =================================================================
-- 4. 每日員工績效統計快取表
-- =================================================================

CREATE TABLE IF NOT EXISTS daily_staff_performance_statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    restaurant_id INTEGER NOT NULL,
    stat_date DATE NOT NULL,
    
    -- 工作時數統計
    clock_in_time TIME,
    clock_out_time TIME,
    total_hours_worked DECIMAL(5,2) DEFAULT 0.00,
    break_time_minutes INTEGER DEFAULT 0,
    overtime_hours DECIMAL(5,2) DEFAULT 0.00,
    
    -- 績效統計（依角色而異）
    orders_processed INTEGER DEFAULT 0,        -- 收銀員/服務員
    orders_prepared INTEGER DEFAULT 0,         -- 廚師
    tables_served INTEGER DEFAULT 0,           -- 服務員
    revenue_generated DECIMAL(10,2) DEFAULT 0.00, -- 所有角色
    
    -- 服務品質指標
    customer_complaints INTEGER DEFAULT 0,
    order_errors INTEGER DEFAULT 0,
    avg_service_time_minutes DECIMAL(8,2) DEFAULT 0.00,
    customer_rating DECIMAL(3,2),
    
    -- 效率指標
    productivity_score DECIMAL(5,2) DEFAULT 0.00, -- 0-100 的績效分數
    attendance_status TEXT CHECK (attendance_status IN ('present', 'late', 'absent', 'sick_leave', 'vacation')),
    
    -- 元數據
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    UNIQUE(user_id, stat_date)
);

-- =================================================================
-- 5. 創建索引
-- =================================================================

-- 餐廳統計索引
CREATE INDEX IF NOT EXISTS idx_daily_restaurant_stats_restaurant_date 
ON daily_restaurant_statistics(restaurant_id, stat_date);

CREATE INDEX IF NOT EXISTS idx_daily_restaurant_stats_date 
ON daily_restaurant_statistics(stat_date);

CREATE INDEX IF NOT EXISTS idx_daily_restaurant_stats_revenue 
ON daily_restaurant_statistics(stat_date, total_revenue DESC);

-- 菜單項目統計索引
CREATE INDEX IF NOT EXISTS idx_daily_menu_stats_item_date 
ON daily_menu_item_statistics(menu_item_id, stat_date);

CREATE INDEX IF NOT EXISTS idx_daily_menu_stats_restaurant_date 
ON daily_menu_item_statistics(restaurant_id, stat_date);

CREATE INDEX IF NOT EXISTS idx_daily_menu_stats_popularity 
ON daily_menu_item_statistics(stat_date, popularity_rank);

-- 庫存統計索引
CREATE INDEX IF NOT EXISTS idx_daily_inventory_stats_item_date 
ON daily_inventory_statistics(inventory_item_id, stat_date);

CREATE INDEX IF NOT EXISTS idx_daily_inventory_stats_restaurant_date 
ON daily_inventory_statistics(restaurant_id, stat_date);

-- 員工績效統計索引
CREATE INDEX IF NOT EXISTS idx_daily_staff_stats_user_date 
ON daily_staff_performance_statistics(user_id, stat_date);

CREATE INDEX IF NOT EXISTS idx_daily_staff_stats_restaurant_date 
ON daily_staff_performance_statistics(restaurant_id, stat_date);

-- =================================================================
-- 6. 自動計算統計資料的觸發器和程序
-- =================================================================

-- 觸發器：當訂單完成時更新當日統計
CREATE TRIGGER IF NOT EXISTS update_daily_stats_on_order_complete
AFTER UPDATE ON orders
WHEN NEW.status IN ('completed', 'paid') AND OLD.status NOT IN ('completed', 'paid')
BEGIN
    -- 更新餐廳統計（使用 INSERT OR REPLACE 來處理初次插入或更新）
    INSERT OR REPLACE INTO daily_restaurant_statistics (
        restaurant_id, stat_date, total_orders, completed_orders, 
        total_revenue, avg_order_value, calculation_completed_at
    ) 
    SELECT 
        NEW.restaurant_id,
        DATE(NEW.created_at),
        (SELECT COUNT(*) FROM orders 
         WHERE restaurant_id = NEW.restaurant_id 
           AND DATE(created_at) = DATE(NEW.created_at)),
        (SELECT COUNT(*) FROM orders 
         WHERE restaurant_id = NEW.restaurant_id 
           AND DATE(created_at) = DATE(NEW.created_at)
           AND status IN ('completed', 'paid')),
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders 
         WHERE restaurant_id = NEW.restaurant_id 
           AND DATE(created_at) = DATE(NEW.created_at)
           AND status IN ('completed', 'paid')),
        (SELECT COALESCE(AVG(total_amount), 0) FROM orders 
         WHERE restaurant_id = NEW.restaurant_id 
           AND DATE(created_at) = DATE(NEW.created_at)
           AND status IN ('completed', 'paid')),
        datetime('now');
END;

-- 觸發器：更新菜單項目統計
CREATE TRIGGER IF NOT EXISTS update_menu_item_daily_stats
AFTER INSERT ON order_items
BEGIN
    INSERT OR REPLACE INTO daily_menu_item_statistics (
        menu_item_id, restaurant_id, stat_date, 
        order_count, total_quantity_sold, total_revenue
    )
    SELECT 
        NEW.menu_item_id,
        (SELECT restaurant_id FROM menu_items WHERE id = NEW.menu_item_id),
        DATE((SELECT created_at FROM orders WHERE id = NEW.order_id)),
        COUNT(DISTINCT oi.order_id),
        SUM(oi.quantity),
        SUM(oi.total_price)
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.menu_item_id = NEW.menu_item_id
      AND DATE(o.created_at) = DATE((SELECT created_at FROM orders WHERE id = NEW.order_id))
      AND o.status IN ('completed', 'paid');
END;

-- 觸發器：自動清理舊統計資料（保留1年）
CREATE TRIGGER IF NOT EXISTS cleanup_old_daily_statistics
AFTER INSERT ON daily_restaurant_statistics
WHEN (SELECT COUNT(*) FROM daily_restaurant_statistics) > 50000
BEGIN
    DELETE FROM daily_restaurant_statistics 
    WHERE stat_date < DATE('now', '-1 year');
    
    DELETE FROM daily_menu_item_statistics 
    WHERE stat_date < DATE('now', '-1 year');
    
    DELETE FROM daily_inventory_statistics 
    WHERE stat_date < DATE('now', '-1 year');
    
    DELETE FROM daily_staff_performance_statistics 
    WHERE stat_date < DATE('now', '-1 year');
END;

-- =================================================================
-- 7. 統計查詢視圖
-- =================================================================

-- 週統計匯總視圖
CREATE VIEW IF NOT EXISTS weekly_restaurant_summary AS
SELECT 
    restaurant_id,
    strftime('%Y-%W', stat_date) as week_year,
    MIN(stat_date) as week_start_date,
    MAX(stat_date) as week_end_date,
    
    -- 訂單統計
    SUM(total_orders) as weekly_orders,
    SUM(completed_orders) as weekly_completed_orders,
    ROUND(AVG(avg_order_value), 2) as avg_weekly_order_value,
    
    -- 收入統計
    SUM(total_revenue) as weekly_revenue,
    ROUND(AVG(total_revenue), 2) as avg_daily_revenue,
    
    -- 客戶統計
    SUM(total_customers) as weekly_customers,
    SUM(new_customers) as weekly_new_customers,
    
    -- 效能統計
    ROUND(AVG(avg_preparation_time_minutes), 2) as avg_prep_time,
    ROUND(AVG(on_time_rate), 2) as avg_on_time_rate,
    ROUND(AVG(table_utilization_rate), 2) as avg_table_utilization,
    
    COUNT(*) as days_with_data
FROM daily_restaurant_statistics 
WHERE stat_date >= DATE('now', '-12 weeks')
GROUP BY restaurant_id, strftime('%Y-%W', stat_date)
ORDER BY restaurant_id, week_year DESC;

-- 月統計匯總視圖
CREATE VIEW IF NOT EXISTS monthly_restaurant_summary AS
SELECT 
    restaurant_id,
    strftime('%Y-%m', stat_date) as month_year,
    
    -- 訂單統計
    SUM(total_orders) as monthly_orders,
    SUM(completed_orders) as monthly_completed_orders,
    ROUND(AVG(avg_order_value), 2) as avg_monthly_order_value,
    
    -- 收入統計
    SUM(total_revenue) as monthly_revenue,
    ROUND(SUM(total_revenue) / COUNT(*), 2) as avg_daily_revenue,
    
    -- 成長率計算
    LAG(SUM(total_revenue), 1) OVER (
        PARTITION BY restaurant_id 
        ORDER BY strftime('%Y-%m', stat_date)
    ) as previous_month_revenue,
    
    ROUND(
        (SUM(total_revenue) - LAG(SUM(total_revenue), 1) OVER (
            PARTITION BY restaurant_id 
            ORDER BY strftime('%Y-%m', stat_date)
        )) / NULLIF(LAG(SUM(total_revenue), 1) OVER (
            PARTITION BY restaurant_id 
            ORDER BY strftime('%Y-%m', stat_date)
        ), 0) * 100, 2
    ) as revenue_growth_rate,
    
    -- 營運指標
    ROUND(AVG(avg_preparation_time_minutes), 2) as avg_prep_time,
    ROUND(AVG(on_time_rate), 2) as avg_on_time_rate,
    ROUND(AVG(table_utilization_rate), 2) as avg_table_utilization,
    
    COUNT(*) as days_with_data
FROM daily_restaurant_statistics 
WHERE stat_date >= DATE('now', '-12 months')
GROUP BY restaurant_id, strftime('%Y-%m', stat_date)
ORDER BY restaurant_id, month_year DESC;

-- 熱門菜單項目趨勢視圖
CREATE VIEW IF NOT EXISTS menu_item_trend_analysis AS
SELECT 
    mi.id as menu_item_id,
    mi.name as menu_item_name,
    mi.restaurant_id,
    dmi.stat_date,
    dmi.order_count,
    dmi.total_revenue,
    dmi.popularity_rank,
    
    -- 趨勢計算
    LAG(dmi.order_count, 1) OVER (
        PARTITION BY mi.id 
        ORDER BY dmi.stat_date
    ) as previous_day_orders,
    
    LAG(dmi.total_revenue, 1) OVER (
        PARTITION BY mi.id 
        ORDER BY dmi.stat_date
    ) as previous_day_revenue,
    
    -- 7日移動平均
    ROUND(AVG(dmi.order_count) OVER (
        PARTITION BY mi.id 
        ORDER BY dmi.stat_date 
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ), 2) as orders_7day_avg,
    
    ROUND(AVG(dmi.total_revenue) OVER (
        PARTITION BY mi.id 
        ORDER BY dmi.stat_date 
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ), 2) as revenue_7day_avg
    
FROM daily_menu_item_statistics dmi
JOIN menu_items mi ON dmi.menu_item_id = mi.id
WHERE dmi.stat_date >= DATE('now', '-30 days')
  AND mi.status = 'active'
ORDER BY mi.restaurant_id, dmi.stat_date DESC, dmi.popularity_rank ASC;

-- =================================================================
-- 8. 更新統計的時間戳觸發器
-- =================================================================

CREATE TRIGGER IF NOT EXISTS update_daily_restaurant_stats_timestamp
AFTER UPDATE ON daily_restaurant_statistics
FOR EACH ROW
BEGIN
    UPDATE daily_restaurant_statistics 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_daily_menu_item_stats_timestamp
AFTER UPDATE ON daily_menu_item_statistics
FOR EACH ROW
BEGIN
    UPDATE daily_menu_item_statistics 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_daily_inventory_stats_timestamp
AFTER UPDATE ON daily_inventory_statistics
FOR EACH ROW
BEGIN
    UPDATE daily_inventory_statistics 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_daily_staff_stats_timestamp
AFTER UPDATE ON daily_staff_performance_statistics
FOR EACH ROW
BEGIN
    UPDATE daily_staff_performance_statistics 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

-- =================================================================
-- 完成
-- =================================================================

-- 每日統計快取系統創建完成
-- 
-- 主要功能：
-- 1. 每日餐廳營運統計快取
-- 2. 每日菜單項目銷售統計快取
-- 3. 每日庫存異動統計快取
-- 4. 每日員工績效統計快取
-- 5. 自動統計計算觸發器
-- 6. 週/月統計匯總視圖
-- 7. 趨勢分析視圖
-- 8. 自動清理機制
--
-- 注意：需要定期執行統計計算任務來填充這些快取表
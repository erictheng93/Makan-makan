-- Performance Optimization Views Migration
-- Created: 2025-09-03
-- Description: Creates optimized views for common dashboard and analytics queries

-- =================================================================
-- 1. 餐廳實時狀態儀表板視圖
-- =================================================================

-- 餐廳實時狀態總覽（最常用的儀表板查詢）
CREATE VIEW IF NOT EXISTS restaurant_dashboard_stats AS
SELECT 
    r.id as restaurant_id,
    r.name as restaurant_name,
    r.status as restaurant_status,
    -- 桌台統計
    COUNT(DISTINCT t.id) as total_tables,
    COUNT(DISTINCT CASE WHEN t.status = 'occupied' THEN t.id END) as occupied_tables,
    COUNT(DISTINCT CASE WHEN t.status = 'available' THEN t.id END) as available_tables,
    COUNT(DISTINCT CASE WHEN t.status = 'reserved' THEN t.id END) as reserved_tables,
    -- 計算桌台使用率
    ROUND(
        CAST(COUNT(DISTINCT CASE WHEN t.status = 'occupied' THEN t.id END) AS FLOAT) * 100.0 / 
        NULLIF(COUNT(DISTINCT t.id), 0), 2
    ) as table_utilization_rate,
    
    -- 訂單統計
    COUNT(DISTINCT CASE 
        WHEN o.status IN ('pending', 'confirmed', 'preparing', 'ready') 
        THEN o.id 
    END) as active_orders,
    COUNT(DISTINCT CASE 
        WHEN o.status IN ('pending', 'confirmed') 
        THEN o.id 
    END) as pending_orders,
    COUNT(DISTINCT CASE 
        WHEN o.status = 'preparing' 
        THEN o.id 
    END) as preparing_orders,
    COUNT(DISTINCT CASE 
        WHEN o.status = 'ready' 
        THEN o.id 
    END) as ready_orders,
    
    -- 今日業績
    SUM(CASE 
        WHEN DATE(o.created_at) = DATE('now') AND o.status IN ('completed', 'paid')
        THEN o.total_amount 
        ELSE 0 
    END) as today_revenue,
    COUNT(CASE 
        WHEN DATE(o.created_at) = DATE('now') 
        THEN 1 
    END) as today_orders,
    
    -- 平均訂單價值
    ROUND(
        SUM(CASE 
            WHEN DATE(o.created_at) = DATE('now') AND o.status IN ('completed', 'paid')
            THEN o.total_amount 
            ELSE 0 
        END) / NULLIF(COUNT(CASE 
            WHEN DATE(o.created_at) = DATE('now') 
            THEN 1 
        END), 0), 2
    ) as avg_order_value_today,
    
    -- 最後更新時間
    datetime('now') as last_updated
FROM restaurants r
LEFT JOIN tables t ON r.id = t.restaurant_id
LEFT JOIN orders o ON r.id = o.restaurant_id 
    AND o.created_at >= datetime('now', '-1 day')  -- 只看最近24小時的訂單
WHERE r.status = 'active'
GROUP BY r.id, r.name, r.status;

-- =================================================================
-- 2. 熱門菜單項目分析視圖
-- =================================================================

-- 熱門菜單項目（30天統計）
CREATE VIEW IF NOT EXISTS popular_menu_items_30d AS
SELECT 
    mi.id,
    mi.restaurant_id,
    mi.name,
    mi.price,
    mi.category_id,
    c.name as category_name,
    
    -- 銷售統計
    COUNT(oi.id) as order_count,
    SUM(oi.quantity) as total_quantity_sold,
    SUM(oi.total_price) as total_revenue,
    ROUND(AVG(oi.total_price / oi.quantity), 2) as avg_selling_price,
    
    -- 評分統計（如果有評價系統）
    ROUND(AVG(CAST(cr.rating AS FLOAT)), 2) as avg_rating,
    COUNT(cr.id) as review_count,
    
    -- 時間統計
    MIN(o.created_at) as first_order_date,
    MAX(o.created_at) as last_order_date,
    
    -- 受歡迎度分數（綜合銷量和評分）
    ROUND(
        (COUNT(oi.id) * 0.7 + COALESCE(AVG(CAST(cr.rating AS FLOAT)), 3) * 10 * 0.3), 2
    ) as popularity_score,
    
    -- 菜單項目狀態
    mi.is_available,
    mi.is_featured,
    mi.updated_at as menu_item_updated_at
    
FROM menu_items mi
LEFT JOIN categories c ON mi.category_id = c.id
LEFT JOIN order_items oi ON mi.id = oi.menu_item_id
LEFT JOIN orders o ON oi.order_id = o.id 
    AND o.created_at >= datetime('now', '-30 days')
    AND o.status IN ('completed', 'paid')
LEFT JOIN customer_reviews cr ON o.id = cr.order_id
WHERE mi.status = 'active'
GROUP BY mi.id, mi.restaurant_id, mi.name, mi.price, mi.category_id, c.name, 
         mi.is_available, mi.is_featured, mi.updated_at
ORDER BY popularity_score DESC;

-- =================================================================
-- 3. 訂單流量分析視圖
-- =================================================================

-- 每小時訂單流量分析（過去7天）
CREATE VIEW IF NOT EXISTS hourly_order_flow_7d AS
SELECT 
    restaurant_id,
    strftime('%H', created_at) as hour_of_day,
    DATE(created_at) as order_date,
    COUNT(*) as order_count,
    SUM(total_amount) as hourly_revenue,
    ROUND(AVG(total_amount), 2) as avg_order_value,
    
    -- 不同訂單類型統計
    COUNT(CASE WHEN order_type = 'dine_in' THEN 1 END) as dine_in_orders,
    COUNT(CASE WHEN order_type = 'takeaway' THEN 1 END) as takeaway_orders,
    COUNT(CASE WHEN order_type = 'delivery' THEN 1 END) as delivery_orders,
    
    -- 訂單狀態分佈
    COUNT(CASE WHEN status IN ('completed', 'paid') THEN 1 END) as completed_orders,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders
    
FROM orders 
WHERE created_at >= datetime('now', '-7 days')
GROUP BY restaurant_id, strftime('%H', created_at), DATE(created_at)
ORDER BY restaurant_id, order_date, hour_of_day;

-- =================================================================
-- 4. 客戶行為分析視圖
-- =================================================================

-- 客戶重複消費分析
CREATE VIEW IF NOT EXISTS customer_behavior_analysis AS
SELECT 
    restaurant_id,
    customer_phone,
    customer_name,
    
    -- 訂單統計
    COUNT(*) as total_orders,
    SUM(total_amount) as total_spent,
    ROUND(AVG(total_amount), 2) as avg_order_value,
    
    -- 時間分析
    MIN(created_at) as first_order_date,
    MAX(created_at) as last_order_date,
    ROUND(
        JULIANDAY(MAX(created_at)) - JULIANDAY(MIN(created_at))
    ) as customer_lifetime_days,
    
    -- 頻率分析
    CASE 
        WHEN COUNT(*) = 1 THEN 'new_customer'
        WHEN COUNT(*) BETWEEN 2 AND 5 THEN 'regular_customer'
        WHEN COUNT(*) BETWEEN 6 AND 15 THEN 'frequent_customer'
        ELSE 'vip_customer'
    END as customer_segment,
    
    -- 偏好分析
    GROUP_CONCAT(DISTINCT order_type) as preferred_order_types,
    
    -- 最近活動
    CASE 
        WHEN MAX(created_at) >= datetime('now', '-7 days') THEN 'active'
        WHEN MAX(created_at) >= datetime('now', '-30 days') THEN 'inactive_recent'
        WHEN MAX(created_at) >= datetime('now', '-90 days') THEN 'inactive_long'
        ELSE 'churned'
    END as activity_status
    
FROM orders 
WHERE customer_phone IS NOT NULL
GROUP BY restaurant_id, customer_phone, customer_name
HAVING COUNT(*) >= 1
ORDER BY total_spent DESC;

-- =================================================================
-- 5. 廚房效能分析視圖
-- =================================================================

-- 廚房準備時間分析
CREATE VIEW IF NOT EXISTS kitchen_performance_analysis AS
SELECT 
    o.restaurant_id,
    DATE(o.created_at) as preparation_date,
    
    -- 時間統計
    COUNT(o.id) as total_orders,
    ROUND(AVG(
        CASE 
            WHEN o.served_at IS NOT NULL AND o.created_at IS NOT NULL
            THEN (JULIANDAY(o.served_at) - JULIANDAY(o.created_at)) * 24 * 60
        END
    ), 2) as avg_prep_time_minutes,
    
    -- 效能指標
    COUNT(CASE 
        WHEN o.served_at IS NOT NULL 
         AND (JULIANDAY(o.served_at) - JULIANDAY(o.created_at)) * 24 * 60 <= 20
        THEN 1 
    END) as on_time_orders,
    
    COUNT(CASE 
        WHEN o.served_at IS NOT NULL 
         AND (JULIANDAY(o.served_at) - JULIANDAY(o.created_at)) * 24 * 60 > 20
        THEN 1 
    END) as delayed_orders,
    
    ROUND(
        CAST(COUNT(CASE 
            WHEN o.served_at IS NOT NULL 
             AND (JULIANDAY(o.served_at) - JULIANDAY(o.created_at)) * 24 * 60 <= 20
            THEN 1 
        END) AS FLOAT) * 100.0 / 
        NULLIF(COUNT(CASE WHEN o.served_at IS NOT NULL THEN 1 END), 0), 2
    ) as on_time_rate,
    
    -- 忙碌時段分析
    strftime('%H', o.created_at) as peak_hour,
    COUNT(CASE WHEN strftime('%H', o.created_at) BETWEEN '11' AND '14' THEN 1 END) as lunch_rush_orders,
    COUNT(CASE WHEN strftime('%H', o.created_at) BETWEEN '18' AND '21' THEN 1 END) as dinner_rush_orders
    
FROM orders o
WHERE o.created_at >= datetime('now', '-30 days')
  AND o.status IN ('completed', 'served', 'paid')
GROUP BY o.restaurant_id, DATE(o.created_at)
ORDER BY o.restaurant_id, preparation_date DESC;

-- =================================================================
-- 6. 收入趨勢分析視圖
-- =================================================================

-- 每日收入趨勢（過去30天）
CREATE VIEW IF NOT EXISTS daily_revenue_trend_30d AS
SELECT 
    restaurant_id,
    DATE(created_at) as revenue_date,
    strftime('%w', created_at) as day_of_week,
    CASE strftime('%w', created_at)
        WHEN '0' THEN 'Sunday'
        WHEN '1' THEN 'Monday'
        WHEN '2' THEN 'Tuesday' 
        WHEN '3' THEN 'Wednesday'
        WHEN '4' THEN 'Thursday'
        WHEN '5' THEN 'Friday'
        WHEN '6' THEN 'Saturday'
    END as day_name,
    
    -- 收入統計
    COUNT(*) as order_count,
    SUM(total_amount) as daily_revenue,
    ROUND(AVG(total_amount), 2) as avg_order_value,
    
    -- 訂單類型分析
    SUM(CASE WHEN order_type = 'dine_in' THEN total_amount ELSE 0 END) as dine_in_revenue,
    SUM(CASE WHEN order_type = 'takeaway' THEN total_amount ELSE 0 END) as takeaway_revenue,
    SUM(CASE WHEN order_type = 'delivery' THEN total_amount ELSE 0 END) as delivery_revenue,
    
    -- 與前一天比較
    LAG(SUM(total_amount), 1) OVER (
        PARTITION BY restaurant_id 
        ORDER BY DATE(created_at)
    ) as previous_day_revenue,
    
    ROUND(
        (SUM(total_amount) - LAG(SUM(total_amount), 1) OVER (
            PARTITION BY restaurant_id 
            ORDER BY DATE(created_at)
        )) / NULLIF(LAG(SUM(total_amount), 1) OVER (
            PARTITION BY restaurant_id 
            ORDER BY DATE(created_at)
        ), 0) * 100, 2
    ) as revenue_change_percent

FROM orders 
WHERE created_at >= datetime('now', '-30 days')
  AND status IN ('completed', 'paid')
GROUP BY restaurant_id, DATE(created_at), strftime('%w', created_at)
ORDER BY restaurant_id, revenue_date DESC;

-- =================================================================
-- 7. 庫存預警視圖
-- =================================================================

-- 庫存狀態總覽
CREATE VIEW IF NOT EXISTS inventory_alert_summary AS
SELECT 
    i.restaurant_id,
    r.name as restaurant_name,
    i.id as inventory_item_id,
    i.name as item_name,
    i.category,
    i.current_stock,
    i.min_stock_level,
    i.max_stock_level,
    i.unit,
    
    -- 庫存狀態計算
    CASE 
        WHEN i.current_stock <= 0 THEN 'out_of_stock'
        WHEN i.current_stock <= i.min_stock_level THEN 'low_stock'
        WHEN i.current_stock <= i.min_stock_level * 1.5 THEN 'warning'
        WHEN i.max_stock_level IS NOT NULL AND i.current_stock >= i.max_stock_level THEN 'overstocked'
        ELSE 'normal'
    END as stock_status,
    
    -- 庫存價值
    ROUND(i.current_stock * COALESCE(i.cost_per_unit, 0), 2) as current_value,
    
    -- 最後補貨時間
    i.last_restocked_at,
    ROUND(
        JULIANDAY('now') - JULIANDAY(COALESCE(i.last_restocked_at, i.created_at))
    ) as days_since_last_restock,
    
    -- 使用趨勢（過去30天）
    COALESCE(usage.total_used, 0) as usage_last_30d,
    ROUND(COALESCE(usage.total_used, 0) / 30.0, 2) as daily_usage_rate,
    
    -- 預估用完時間
    CASE 
        WHEN COALESCE(usage.total_used, 0) / 30.0 > 0
        THEN ROUND(i.current_stock / (COALESCE(usage.total_used, 0) / 30.0))
        ELSE NULL
    END as estimated_days_remaining

FROM inventory_items i
JOIN restaurants r ON i.restaurant_id = r.id
LEFT JOIN (
    SELECT 
        inventory_item_id,
        SUM(CASE WHEN movement_type = 'out' THEN quantity ELSE 0 END) as total_used
    FROM stock_movements
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY inventory_item_id
) usage ON i.id = usage.inventory_item_id
WHERE i.status = 'active'
ORDER BY 
    CASE 
        WHEN i.current_stock <= 0 THEN 1
        WHEN i.current_stock <= i.min_stock_level THEN 2
        WHEN i.current_stock <= i.min_stock_level * 1.5 THEN 3
        ELSE 4
    END,
    i.restaurant_id, i.name;

-- =================================================================
-- 8. 餐桌使用率分析視圖
-- =================================================================

-- 餐桌週轉率分析
CREATE VIEW IF NOT EXISTS table_utilization_analysis AS
SELECT 
    t.restaurant_id,
    t.id as table_id,
    t.table_number,
    t.capacity,
    
    -- 今日統計
    COUNT(CASE WHEN DATE(o.created_at) = DATE('now') THEN 1 END) as today_orders,
    SUM(CASE WHEN DATE(o.created_at) = DATE('now') THEN o.total_amount ELSE 0 END) as today_revenue,
    
    -- 週統計
    COUNT(CASE WHEN o.created_at >= datetime('now', '-7 days') THEN 1 END) as weekly_orders,
    SUM(CASE WHEN o.created_at >= datetime('now', '-7 days') THEN o.total_amount ELSE 0 END) as weekly_revenue,
    
    -- 平均使用時間（分鐘）
    ROUND(AVG(
        CASE 
            WHEN o.served_at IS NOT NULL AND o.created_at IS NOT NULL
            THEN (JULIANDAY(o.served_at) - JULIANDAY(o.created_at)) * 24 * 60
        END
    ), 2) as avg_dining_duration,
    
    -- 週轉率計算
    ROUND(
        COUNT(CASE WHEN DATE(o.created_at) = DATE('now') THEN 1 END) / 
        (24.0 * 60.0 / NULLIF(AVG(
            CASE 
                WHEN o.served_at IS NOT NULL AND o.created_at IS NOT NULL
                THEN (JULIANDAY(o.served_at) - JULIANDAY(o.created_at)) * 24 * 60
            END
        ), 0)), 2
    ) as daily_turnover_rate,
    
    -- 每個座位的收入
    ROUND(
        SUM(CASE WHEN DATE(o.created_at) = DATE('now') THEN o.total_amount ELSE 0 END) / 
        NULLIF(t.capacity, 0), 2
    ) as revenue_per_seat_today,
    
    -- 最後使用時間
    MAX(o.created_at) as last_used_at
    
FROM tables t
LEFT JOIN orders o ON t.id = o.table_id 
    AND o.created_at >= datetime('now', '-30 days')
    AND o.status IN ('completed', 'served', 'paid')
WHERE t.restaurant_id IS NOT NULL
GROUP BY t.restaurant_id, t.id, t.table_number, t.capacity
ORDER BY t.restaurant_id, today_revenue DESC;

-- =================================================================
-- 索引支持
-- =================================================================

-- 為視圖查詢創建額外的支持索引
CREATE INDEX IF NOT EXISTS idx_orders_dashboard_query 
ON orders(restaurant_id, status, created_at, total_amount);

CREATE INDEX IF NOT EXISTS idx_order_items_popularity_query 
ON order_items(menu_item_id, created_at, quantity, total_price);

CREATE INDEX IF NOT EXISTS idx_customer_behavior_query 
ON orders(customer_phone, restaurant_id, created_at, total_amount);

-- =================================================================
-- 完成
-- =================================================================

-- 性能優化視圖創建完成
-- 
-- 主要視圖：
-- 1. restaurant_dashboard_stats - 實時儀表板
-- 2. popular_menu_items_30d - 熱門菜單分析  
-- 3. hourly_order_flow_7d - 訂單流量分析
-- 4. customer_behavior_analysis - 客戶行為分析
-- 5. kitchen_performance_analysis - 廚房效能分析
-- 6. daily_revenue_trend_30d - 收入趨勢分析
-- 7. inventory_alert_summary - 庫存預警
-- 8. table_utilization_analysis - 桌台使用率分析
--
-- 這些視圖將大幅提升常用查詢的性能
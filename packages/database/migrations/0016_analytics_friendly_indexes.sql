-- Analytics Friendly Indexes Migration
-- Created: 2025-09-03
-- Description: Creates specialized indexes for business analytics and reporting queries

-- =================================================================
-- 1. 銷售分析索引
-- =================================================================

-- 按日期統計的銷售分析索引
CREATE INDEX IF NOT EXISTS idx_orders_daily_sales_analysis 
ON orders(restaurant_id, DATE(created_at), status, total_amount DESC);

-- 按月份統計的銷售分析索引
CREATE INDEX IF NOT EXISTS idx_orders_monthly_sales_analysis 
ON orders(restaurant_id, strftime('%Y-%m', created_at), status, total_amount);

-- 按小時統計的銷售分析索引（熱門時段分析）
CREATE INDEX IF NOT EXISTS idx_orders_hourly_sales_analysis 
ON orders(restaurant_id, strftime('%H', created_at), DATE(created_at), total_amount);

-- 按週統計的銷售分析索引
CREATE INDEX IF NOT EXISTS idx_orders_weekly_sales_analysis 
ON orders(restaurant_id, strftime('%Y-%W', created_at), status, total_amount);

-- 按星期幾統計的銷售分析索引
CREATE INDEX IF NOT EXISTS idx_orders_weekday_analysis 
ON orders(restaurant_id, strftime('%w', created_at), DATE(created_at), total_amount);

-- =================================================================
-- 2. 菜單項目銷售分析索引
-- =================================================================

-- 菜單項目銷售排行榜索引
CREATE INDEX IF NOT EXISTS idx_menu_items_sales_ranking 
ON order_items(menu_item_id, DATE(created_at), quantity DESC, total_price DESC);

-- 菜單項目按餐廳和時間的銷售分析
-- Note: Cannot use subqueries in index expressions in SQLite
-- This index is removed; queries should join with menu_items table instead
-- CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_time_sales
-- ON order_items(menu_item_id, DATE(created_at), quantity);

-- 菜單項目按分類的銷售分析
-- Note: Cannot use subqueries in index expressions in SQLite
-- This index is removed; queries should join with menu_items table instead
-- CREATE INDEX IF NOT EXISTS idx_menu_items_category_sales
-- ON order_items(DATE(created_at), total_price DESC);

-- 菜單項目季節性分析索引
CREATE INDEX IF NOT EXISTS idx_menu_items_seasonal_analysis 
ON order_items(
    menu_item_id, 
    strftime('%m', created_at), 
    strftime('%Y', created_at), 
    quantity
);

-- =================================================================
-- 3. 客戶行為分析索引
-- =================================================================

-- 客戶重複消費分析索引
CREATE INDEX IF NOT EXISTS idx_customer_repeat_purchase_analysis 
ON orders(customer_phone, restaurant_id, created_at, total_amount)
WHERE customer_phone IS NOT NULL;

-- 客戶首次/回頭客分析索引
CREATE INDEX IF NOT EXISTS idx_customer_acquisition_analysis 
ON orders(restaurant_id, customer_phone, DATE(created_at))
WHERE customer_phone IS NOT NULL;

-- 客戶消費金額分析索引（RFM分析）
CREATE INDEX IF NOT EXISTS idx_customer_rfm_analysis 
ON orders(customer_phone, created_at DESC, total_amount DESC, status)
WHERE customer_phone IS NOT NULL AND status IN ('completed', 'paid');

-- 客戶偏好分析索引（訂單類型）
CREATE INDEX IF NOT EXISTS idx_customer_preference_analysis 
ON orders(customer_phone, order_type, restaurant_id, created_at)
WHERE customer_phone IS NOT NULL;

-- =================================================================
-- 4. 營運效率分析索引
-- =================================================================

-- 準備時間分析索引
CREATE INDEX IF NOT EXISTS idx_kitchen_efficiency_analysis 
ON orders(restaurant_id, DATE(created_at), status, created_at, served_at)
WHERE served_at IS NOT NULL;

-- 桌台週轉率分析索引
CREATE INDEX IF NOT EXISTS idx_table_turnover_analysis 
ON orders(table_id, DATE(created_at), created_at, served_at, status)
WHERE table_id IS NOT NULL;

-- 員工績效分析索引
-- Note: Cannot use subqueries or COALESCE with subqueries in index expressions
-- This index is removed; queries should use simpler indexes
-- CREATE INDEX IF NOT EXISTS idx_staff_performance_analysis
-- ON orders(restaurant_id, created_by, DATE(created_at), total_amount, status);

-- 服務時間分析索引
-- Note: Cannot use JULIANDAY calculations in index expressions
-- This index simplified to basic columns
CREATE INDEX IF NOT EXISTS idx_service_time_analysis
ON orders(restaurant_id, order_type, DATE(created_at), created_at, served_at)
WHERE served_at IS NOT NULL;

-- =================================================================
-- 5. 庫存流轉分析索引
-- =================================================================

-- 庫存周轉率分析索引
CREATE INDEX IF NOT EXISTS idx_inventory_turnover_analysis 
ON stock_movements(inventory_item_id, DATE(created_at), movement_type, quantity);

-- 庫存成本分析索引
-- Note: Cannot use subqueries in index expressions
-- Simplified to allow joins with inventory_items table
CREATE INDEX IF NOT EXISTS idx_inventory_cost_analysis
ON stock_movements(inventory_item_id, DATE(created_at), movement_type, quantity);

-- 庫存浪費分析索引
CREATE INDEX IF NOT EXISTS idx_inventory_waste_analysis 
ON stock_movements(
    inventory_item_id, 
    DATE(created_at), 
    movement_type, 
    quantity
) WHERE movement_type = 'waste';

-- 供應商績效分析索引
-- Note: Cannot use subqueries in index expressions
-- Simplified index for basic movement tracking
CREATE INDEX IF NOT EXISTS idx_supplier_performance_analysis
ON stock_movements(inventory_item_id, DATE(created_at), movement_type, quantity)
WHERE movement_type = 'in';

-- =================================================================
-- 6. 收入成本分析索引
-- =================================================================

-- 毛利分析索引
-- Note: Cannot use subqueries in index expressions
-- Simplified for join-based queries
CREATE INDEX IF NOT EXISTS idx_gross_margin_analysis
ON order_items(menu_item_id, DATE(created_at), total_price, quantity);

-- 成本中心分析索引（按分類）
-- Note: Cannot use subqueries in index expressions
-- Simplified for join-based queries
CREATE INDEX IF NOT EXISTS idx_cost_center_analysis
ON order_items(menu_item_id, DATE(created_at), total_price, quantity);

-- 價格敏感度分析索引
-- Note: Cannot use subqueries in index expressions
-- Simplified for join-based queries
CREATE INDEX IF NOT EXISTS idx_price_sensitivity_analysis
ON order_items(menu_item_id, DATE(created_at), unit_price, quantity);

-- =================================================================
-- 7. 市場趨勢分析索引
-- =================================================================

-- 季節性趨勢分析索引
CREATE INDEX IF NOT EXISTS idx_seasonal_trends_analysis 
ON orders(
    restaurant_id,
    strftime('%m', created_at),
    strftime('%Y', created_at),
    total_amount,
    status
);

-- 節假日影響分析索引
CREATE INDEX IF NOT EXISTS idx_holiday_impact_analysis
ON orders(
    restaurant_id,
    DATE(created_at),
    strftime('%w', created_at),
    total_amount,
    status
);

-- 天氣影響分析索引（為未來天氣API整合預備）
-- Note: Cannot use aggregate functions in index expressions
-- Simplified for basic time-series queries
CREATE INDEX IF NOT EXISTS idx_weather_impact_analysis
ON orders(restaurant_id, DATE(created_at), order_type, total_amount, status);

-- =================================================================
-- 8. 競爭分析索引
-- =================================================================

-- 市場份額分析索引（在多餐廳環境中）
CREATE INDEX IF NOT EXISTS idx_market_share_analysis 
ON orders(
    DATE(created_at),
    restaurant_id,
    total_amount,
    status
) WHERE status IN ('completed', 'paid');

-- 定價策略分析索引
-- Note: Cannot use subqueries in index expressions
-- Simplified for join-based queries
CREATE INDEX IF NOT EXISTS idx_pricing_strategy_analysis
ON order_items(menu_item_id, unit_price, DATE(created_at), quantity);

-- =================================================================
-- 9. 預測分析索引
-- =================================================================

-- 需求預測分析索引
-- Note: Cannot use aggregate functions in index expressions
-- Simplified for time-series queries
CREATE INDEX IF NOT EXISTS idx_demand_forecasting_analysis
ON orders(restaurant_id, DATE(created_at), strftime('%w', created_at), strftime('%H', created_at), total_amount, status);

-- 庫存需求預測索引
-- Note: Cannot use aggregate functions or CASE in index expressions
-- Simplified for time-series analysis
CREATE INDEX IF NOT EXISTS idx_inventory_demand_forecasting
ON stock_movements(inventory_item_id, DATE(created_at), strftime('%w', created_at), movement_type, quantity);

-- 員工排班需求預測索引
-- Note: Cannot use aggregate functions in index expressions
-- Simplified for time-series queries
CREATE INDEX IF NOT EXISTS idx_staffing_demand_forecasting
ON orders(restaurant_id, DATE(created_at), strftime('%w', created_at), strftime('%H', created_at), status);

-- =================================================================
-- 10. 實時分析索引
-- =================================================================

-- 實時銷售儀表板索引
-- Note: Cannot use datetime('now') in WHERE clause as it's non-deterministic
-- Removed WHERE clause; application should filter by date
CREATE INDEX IF NOT EXISTS idx_realtime_sales_dashboard
ON orders(restaurant_id, status, DATE(created_at), strftime('%H', created_at), total_amount, created_at);

-- 實時庫存監控索引
-- Note: Cannot use calculated expressions in index
-- Simplified index
CREATE INDEX IF NOT EXISTS idx_realtime_inventory_monitoring
ON inventory_items(restaurant_id, status, current_stock, min_stock_level)
WHERE status = 'active';

-- 實時服務監控索引
-- Note: Cannot use datetime('now') in WHERE clause
-- Removed time-based WHERE; application should filter
CREATE INDEX IF NOT EXISTS idx_realtime_service_monitoring
ON orders(restaurant_id, status, created_at, estimated_ready_time)
WHERE status IN ('pending', 'confirmed', 'preparing', 'ready');

-- =================================================================
-- 11. 地理分析索引（為未來地理功能預備）
-- =================================================================

-- 地理分佈分析索引（基於IP或未來地址數據）
CREATE INDEX IF NOT EXISTS idx_geographic_analysis 
ON orders(
    restaurant_id,
    DATE(created_at),
    order_type,
    -- 為未來的地理數據預留
    customer_phone, -- 可以用於推斷地理位置
    total_amount
);

-- =================================================================
-- 12. 建立分析視圖的支持索引
-- =================================================================

-- 支持複雜分析查詢的覆蓋索引
CREATE INDEX IF NOT EXISTS idx_comprehensive_order_analysis 
ON orders(
    restaurant_id,
    DATE(created_at),
    status,
    order_type,
    customer_phone,
    total_amount,
    created_at,
    served_at
) WHERE status IN ('completed', 'paid');

-- 支持菜單項目完整分析的覆蓋索引
CREATE INDEX IF NOT EXISTS idx_comprehensive_menu_item_analysis 
ON order_items(
    menu_item_id,
    DATE(created_at),
    quantity,
    unit_price,
    total_price,
    status,
    created_at
);

-- 支持客戶分析的覆蓋索引
CREATE INDEX IF NOT EXISTS idx_comprehensive_customer_analysis 
ON orders(
    customer_phone,
    restaurant_id,
    DATE(created_at),
    order_type,
    total_amount,
    status,
    created_at
) WHERE customer_phone IS NOT NULL;

-- =================================================================
-- 13. 分析查詢執行計劃優化
-- =================================================================

-- 創建分析查詢統計表
CREATE TABLE IF NOT EXISTS analytics_query_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_type TEXT NOT NULL,
    execution_count INTEGER DEFAULT 1,
    avg_execution_time_ms DECIMAL(10,2) DEFAULT 0.00,
    last_executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    query_pattern TEXT,
    index_usage TEXT, -- JSON格式記錄使用的索引
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 分析索引使用情況視圖
CREATE VIEW IF NOT EXISTS analytics_index_usage AS
SELECT 
    name as index_name,
    tbl as table_name,
    CASE 
        WHEN name LIKE '%sales_analysis%' THEN 'sales_analytics'
        WHEN name LIKE '%customer%' THEN 'customer_analytics'
        WHEN name LIKE '%inventory%' THEN 'inventory_analytics'
        WHEN name LIKE '%menu_items%' THEN 'menu_analytics'
        WHEN name LIKE '%efficiency%' THEN 'operational_analytics'
        ELSE 'general_analytics'
    END as analytics_category,
    sql as index_definition
FROM sqlite_master 
WHERE type = 'index' 
  AND name LIKE 'idx_%analysis%'
ORDER BY analytics_category, table_name;

-- =================================================================
-- 14. 索引維護和監控
-- =================================================================

-- 創建索引維護日誌表
CREATE TABLE IF NOT EXISTS index_maintenance_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    maintenance_type TEXT NOT NULL, -- 'analyze', 'rebuild', 'cleanup'
    affected_indexes INTEGER DEFAULT 0,
    execution_time_ms INTEGER DEFAULT 0,
    before_size_mb DECIMAL(10,2) DEFAULT 0.00,
    after_size_mb DECIMAL(10,2) DEFAULT 0.00,
    performance_improvement DECIMAL(5,2) DEFAULT 0.00, -- 性能提升百分比
    status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'partial')),
    error_message TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

-- 索引效能監控視圖
CREATE VIEW IF NOT EXISTS index_performance_monitor AS
SELECT 
    ai.analytics_category,
    COUNT(*) as index_count,
    ROUND(AVG(aqs.avg_execution_time_ms), 2) as avg_query_time_ms,
    MAX(aqs.last_executed_at) as last_used,
    SUM(aqs.execution_count) as total_executions
FROM analytics_index_usage ai
LEFT JOIN analytics_query_stats aqs ON ai.analytics_category = aqs.query_type
GROUP BY ai.analytics_category
ORDER BY avg_query_time_ms DESC;

-- =================================================================
-- 完成
-- =================================================================

-- 分析友好的索引創建完成
-- 
-- 主要索引類別：
-- 1. 銷售分析索引 - 按日/月/週/小時統計
-- 2. 菜單項目銷售分析索引 - 排行榜和趨勢分析
-- 3. 客戶行為分析索引 - RFM分析和客戶細分
-- 4. 營運效率分析索引 - 廚房效率和桌台週轉
-- 5. 庫存流轉分析索引 - 周轉率和成本分析
-- 6. 收入成本分析索引 - 毛利和成本中心分析
-- 7. 市場趨勢分析索引 - 季節性和節假日分析
-- 8. 競爭分析索引 - 市場份額和定價策略
-- 9. 預測分析索引 - 需求預測和排班規劃
-- 10. 實時分析索引 - 即時監控和儀表板
-- 11. 地理分析索引 - 地理分佈分析
-- 12. 綜合分析覆蓋索引 - 支持複雜查詢
-- 13. 查詢執行優化 - 執行計劃和統計
-- 14. 索引維護和監控 - 性能監控和維護
--
-- 這些索引將大幅提升商業智慧分析的性能
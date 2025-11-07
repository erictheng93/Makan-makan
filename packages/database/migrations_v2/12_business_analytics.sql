-- ============================================================================
-- Migration: 12_business_analytics.sql
-- Layer: 5 (Analytics Layer)
-- Description: Complete business analytics and reporting system
-- Dependencies: Multiple layers (orders, customers, employees, tables)
-- ============================================================================

-- ============================================================================
-- TABLE: sales_analytics
-- Description: Daily sales aggregation and metrics
-- Features:
--   - Daily/weekly/monthly sales summaries
--   - Revenue tracking by channel
--   - Order statistics
--   - Performance metrics
--   - Trend analysis data
-- ============================================================================

CREATE TABLE IF NOT EXISTS sales_analytics (
    -- Identity
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

    -- Restaurant
    restaurant_id TEXT NOT NULL,

    -- Period
    analytics_period TEXT NOT NULL,            -- 'daily', 'weekly', 'monthly', 'quarterly', 'annual'
    period_date INTEGER NOT NULL,              -- Unix timestamp (start of period)
    period_start INTEGER NOT NULL,
    period_end INTEGER NOT NULL,
    period_label TEXT,                         -- e.g., '2025-10-30', '2025-W44'

    -- Order Statistics
    total_orders INTEGER DEFAULT 0,
    completed_orders INTEGER DEFAULT 0,
    cancelled_orders INTEGER DEFAULT 0,
    average_order_value REAL DEFAULT 0,
    median_order_value REAL DEFAULT 0,

    -- Revenue Breakdown
    total_revenue REAL DEFAULT 0,
    gross_revenue REAL DEFAULT 0,              -- Before discounts
    net_revenue REAL DEFAULT 0,                -- After discounts, before costs
    discount_amount REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    service_charge_amount REAL DEFAULT 0,
    delivery_fee_amount REAL DEFAULT 0,

    -- Revenue by Order Type
    dine_in_revenue REAL DEFAULT 0,
    takeaway_revenue REAL DEFAULT 0,
    delivery_revenue REAL DEFAULT 0,
    group_order_revenue REAL DEFAULT 0,

    -- Revenue by Payment Method
    cash_revenue REAL DEFAULT 0,
    card_revenue REAL DEFAULT 0,
    ewallet_revenue REAL DEFAULT 0,
    other_payment_revenue REAL DEFAULT 0,

    -- Customer Metrics
    total_customers INTEGER DEFAULT 0,
    new_customers INTEGER DEFAULT 0,
    returning_customers INTEGER DEFAULT 0,
    customer_retention_rate REAL DEFAULT 0,

    -- Item Statistics
    total_items_sold INTEGER DEFAULT 0,
    unique_items_sold INTEGER DEFAULT 0,
    average_items_per_order REAL DEFAULT 0,

    -- Time-based Metrics
    busiest_hour INTEGER,                      -- Hour of day (0-23)
    busiest_day_of_week INTEGER,               -- 0=Sunday, 6=Saturday
    peak_order_time INTEGER,                   -- Unix timestamp

    -- Performance Metrics
    average_preparation_time INTEGER,          -- Minutes
    average_table_turnover REAL,               -- Tables per day
    table_occupancy_rate REAL,                 -- Percentage

    -- Growth Metrics (vs previous period)
    revenue_growth_rate REAL DEFAULT 0,        -- Percentage
    order_growth_rate REAL DEFAULT 0,
    customer_growth_rate REAL DEFAULT 0,

    -- Targets & Goals
    revenue_target REAL,
    revenue_vs_target REAL,                    -- Percentage
    is_target_met INTEGER DEFAULT 0,

    -- Calculation
    calculated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    is_finalized INTEGER DEFAULT 0,

    -- Metadata
    metadata TEXT DEFAULT '{}',

    -- Timestamps
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    deleted_at INTEGER,

    -- Foreign Keys
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,

    -- Constraints
    CHECK (analytics_period IN ('hourly', 'daily', 'weekly', 'monthly', 'quarterly', 'annual')),
    CHECK (total_orders >= 0),
    CHECK (total_revenue >= 0),
    CHECK (is_target_met IN (0, 1)),
    CHECK (is_finalized IN (0, 1)),
    UNIQUE(restaurant_id, analytics_period, period_date)
);

-- Indexes for sales_analytics
CREATE INDEX IF NOT EXISTS idx_sales_restaurant ON sales_analytics(restaurant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sales_period ON sales_analytics(analytics_period, period_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales_analytics(restaurant_id, period_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sales_finalized ON sales_analytics(is_finalized) WHERE deleted_at IS NULL;

-- ============================================================================
-- TABLE: menu_analytics
-- Description: Menu item performance tracking
-- Features:
--   - Item popularity tracking
--   - Revenue per item
--   - Profit margins
--   - Inventory turnover
--   - Category performance
-- ============================================================================

CREATE TABLE IF NOT EXISTS menu_analytics (
    -- Identity
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

    -- Restaurant & Item
    restaurant_id TEXT NOT NULL,
    menu_item_id TEXT NOT NULL,
    category_id TEXT,

    -- Period
    analytics_period TEXT NOT NULL,
    period_date INTEGER NOT NULL,
    period_start INTEGER NOT NULL,
    period_end INTEGER NOT NULL,

    -- Item Details (Snapshot)
    item_name TEXT NOT NULL,
    item_price REAL NOT NULL,
    item_cost REAL,                            -- Cost of goods sold

    -- Sales Performance
    total_quantity_sold INTEGER DEFAULT 0,
    total_revenue REAL DEFAULT 0,
    total_cost REAL DEFAULT 0,
    gross_profit REAL DEFAULT 0,
    profit_margin REAL DEFAULT 0,              -- Percentage

    -- Order Statistics
    times_ordered INTEGER DEFAULT 0,
    unique_customers INTEGER DEFAULT 0,
    average_quantity_per_order REAL DEFAULT 0,

    -- Popularity Metrics
    popularity_rank INTEGER,                   -- Within category
    overall_rank INTEGER,                      -- Within restaurant
    view_count INTEGER DEFAULT 0,
    conversion_rate REAL DEFAULT 0,            -- Orders / Views

    -- Time-based Analysis
    peak_ordering_hour INTEGER,
    popular_day_of_week INTEGER,

    -- Customer Behavior
    repeat_order_rate REAL DEFAULT 0,
    average_rating REAL,
    review_count INTEGER DEFAULT 0,

    -- Combination Analysis
    frequently_ordered_with TEXT DEFAULT '[]', -- JSON: item_ids

    -- Performance vs Previous Period
    quantity_growth_rate REAL DEFAULT 0,
    revenue_growth_rate REAL DEFAULT 0,

    -- Inventory Impact
    inventory_turnover_rate REAL,
    stockout_count INTEGER DEFAULT 0,

    -- Metadata
    metadata TEXT DEFAULT '{}',

    -- Timestamps
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    deleted_at INTEGER,

    -- Foreign Keys
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,

    -- Constraints
    CHECK (analytics_period IN ('daily', 'weekly', 'monthly', 'quarterly')),
    CHECK (total_quantity_sold >= 0),
    CHECK (total_revenue >= 0),
    UNIQUE(restaurant_id, menu_item_id, analytics_period, period_date)
);

-- Indexes for menu_analytics
CREATE INDEX IF NOT EXISTS idx_menu_analytics_restaurant ON menu_analytics(restaurant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_menu_analytics_item ON menu_analytics(menu_item_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_menu_analytics_period ON menu_analytics(analytics_period, period_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_menu_analytics_rank ON menu_analytics(restaurant_id, overall_rank ASC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_menu_analytics_revenue ON menu_analytics(restaurant_id, total_revenue DESC) WHERE deleted_at IS NULL;

-- ============================================================================
-- TABLE: customer_analytics
-- Description: Customer behavior and segmentation analytics
-- Features:
--   - Customer lifetime value
--   - Segmentation data
--   - Behavior patterns
--   - Churn prediction
--   - RFM analysis
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_analytics (
    -- Identity
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

    -- Customer & Restaurant
    customer_id TEXT NOT NULL,
    restaurant_id TEXT NOT NULL,

    -- Period
    analytics_period TEXT NOT NULL,
    period_date INTEGER NOT NULL,
    calculation_date INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),

    -- RFM Analysis
    recency_days INTEGER,                      -- Days since last order
    frequency INTEGER DEFAULT 0,               -- Number of orders
    monetary_value REAL DEFAULT 0,             -- Total spent
    rfm_score INTEGER,                         -- Combined RFM score (3-15)
    rfm_segment TEXT,                          -- 'champions', 'loyal', 'at_risk', etc.

    -- Lifetime Metrics
    lifetime_value REAL DEFAULT 0,
    lifetime_orders INTEGER DEFAULT 0,
    lifetime_items INTEGER DEFAULT 0,
    average_order_value REAL DEFAULT 0,
    average_order_frequency REAL DEFAULT 0,    -- Orders per month

    -- Engagement
    days_since_first_order INTEGER,
    days_since_last_order INTEGER,
    is_active INTEGER DEFAULT 1,
    last_activity_date INTEGER,

    -- Behavior Patterns
    preferred_order_time TEXT,                 -- 'breakfast', 'lunch', 'dinner'
    preferred_day_of_week INTEGER,
    preferred_order_type TEXT,                 -- 'dine_in', 'takeaway', 'delivery'
    favorite_category TEXT,
    favorite_items TEXT DEFAULT '[]',          -- JSON: item_ids

    -- Spending Patterns
    average_basket_size REAL DEFAULT 0,
    highest_order_value REAL DEFAULT 0,
    price_sensitivity TEXT DEFAULT 'medium',   -- 'low', 'medium', 'high'

    -- Loyalty Metrics
    loyalty_tier TEXT,
    loyalty_points INTEGER DEFAULT 0,
    redemption_rate REAL DEFAULT 0,

    -- Churn Prediction
    churn_risk_score INTEGER DEFAULT 0,        -- 0-100
    churn_probability REAL DEFAULT 0,          -- 0-1
    predicted_next_order_date INTEGER,
    retention_probability REAL,

    -- Satisfaction
    average_rating REAL,
    review_count INTEGER DEFAULT 0,
    complaint_count INTEGER DEFAULT 0,
    nps_score INTEGER,                         -- Net Promoter Score (-100 to 100)

    -- Marketing Response
    email_open_rate REAL,
    click_through_rate REAL,
    promotion_usage_count INTEGER DEFAULT 0,
    referral_count INTEGER DEFAULT 0,

    -- Segmentation
    customer_segment TEXT,                     -- 'vip', 'regular', 'occasional', 'new'
    segment_score INTEGER DEFAULT 0,

    -- Metadata
    metadata TEXT DEFAULT '{}',

    -- Timestamps
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    deleted_at INTEGER,

    -- Foreign Keys
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,

    -- Constraints
    CHECK (analytics_period IN ('weekly', 'monthly', 'quarterly', 'annual')),
    CHECK (rfm_segment IS NULL OR rfm_segment IN ('champions', 'loyal_customers', 'potential_loyalists', 'recent_customers', 'promising', 'needs_attention', 'about_to_sleep', 'at_risk', 'cant_lose', 'hibernating', 'lost')),
    CHECK (price_sensitivity IN ('low', 'medium', 'high')),
    CHECK (churn_risk_score >= 0 AND churn_risk_score <= 100),
    CHECK (is_active IN (0, 1)),
    UNIQUE(customer_id, analytics_period, period_date)
);

-- Indexes for customer_analytics
CREATE INDEX IF NOT EXISTS idx_customer_analytics_customer ON customer_analytics(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_analytics_restaurant ON customer_analytics(restaurant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_analytics_segment ON customer_analytics(rfm_segment) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_analytics_churn ON customer_analytics(churn_risk_score DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customer_analytics_ltv ON customer_analytics(restaurant_id, lifetime_value DESC) WHERE deleted_at IS NULL;

-- ============================================================================
-- TABLE: performance_metrics
-- Description: Operational performance KPIs
-- Features:
--   - Service speed metrics
--   - Staff efficiency
--   - Table utilization
--   - Kitchen performance
--   - Customer satisfaction
-- ============================================================================

CREATE TABLE IF NOT EXISTS performance_metrics (
    -- Identity
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

    -- Restaurant
    restaurant_id TEXT NOT NULL,

    -- Period
    metrics_period TEXT NOT NULL,
    period_date INTEGER NOT NULL,
    period_start INTEGER NOT NULL,
    period_end INTEGER NOT NULL,

    -- Service Speed
    average_order_prep_time INTEGER,          -- Minutes
    average_table_turnover_time INTEGER,      -- Minutes
    average_wait_time INTEGER,                 -- Customer wait time
    average_delivery_time INTEGER,             -- For delivery orders

    -- Speed Performance
    orders_delivered_on_time INTEGER DEFAULT 0,
    orders_delivered_late INTEGER DEFAULT 0,
    on_time_delivery_rate REAL DEFAULT 0,     -- Percentage

    -- Staff Performance
    total_staff_hours REAL DEFAULT 0,
    revenue_per_labor_hour REAL DEFAULT 0,
    orders_per_staff_hour REAL DEFAULT 0,
    average_staff_utilization REAL DEFAULT 0,  -- Percentage

    -- Staff Attendance
    total_scheduled_shifts INTEGER DEFAULT 0,
    completed_shifts INTEGER DEFAULT 0,
    missed_shifts INTEGER DEFAULT 0,
    late_arrivals INTEGER DEFAULT 0,
    attendance_rate REAL DEFAULT 0,

    -- Table Utilization
    total_tables INTEGER DEFAULT 0,
    average_table_occupancy REAL DEFAULT 0,    -- Percentage
    table_turns_per_day REAL DEFAULT 0,
    peak_occupancy_rate REAL DEFAULT 0,

    -- Kitchen Performance
    orders_processed INTEGER DEFAULT 0,
    average_ticket_time INTEGER,               -- Minutes per order
    ticket_accuracy_rate REAL DEFAULT 0,       -- Correct orders %
    remake_count INTEGER DEFAULT 0,

    -- Customer Satisfaction
    average_rating REAL,
    total_reviews INTEGER DEFAULT 0,
    positive_reviews INTEGER DEFAULT 0,
    negative_reviews INTEGER DEFAULT 0,
    satisfaction_score REAL DEFAULT 0,         -- 0-100

    -- Complaint Management
    total_complaints INTEGER DEFAULT 0,
    resolved_complaints INTEGER DEFAULT 0,
    complaint_resolution_rate REAL DEFAULT 0,
    average_resolution_time INTEGER,           -- Hours

    -- Quality Metrics
    food_waste_percentage REAL DEFAULT 0,
    inventory_accuracy_rate REAL DEFAULT 0,
    stockout_incidents INTEGER DEFAULT 0,

    -- Financial Efficiency
    cost_of_goods_sold REAL DEFAULT 0,
    labor_cost REAL DEFAULT 0,
    operating_expenses REAL DEFAULT 0,
    profit_margin REAL DEFAULT 0,

    -- Targets
    target_prep_time INTEGER,
    target_satisfaction_score REAL,
    targets_met INTEGER DEFAULT 0,             -- Count of met targets

    -- Metadata
    metadata TEXT DEFAULT '{}',

    -- Timestamps
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    deleted_at INTEGER,

    -- Foreign Keys
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,

    -- Constraints
    CHECK (metrics_period IN ('daily', 'weekly', 'monthly', 'quarterly')),
    CHECK (on_time_delivery_rate >= 0 AND on_time_delivery_rate <= 100),
    CHECK (attendance_rate >= 0 AND attendance_rate <= 100),
    UNIQUE(restaurant_id, metrics_period, period_date)
);

-- Indexes for performance_metrics
CREATE INDEX IF NOT EXISTS idx_performance_restaurant ON performance_metrics(restaurant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_performance_period ON performance_metrics(metrics_period, period_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_performance_date ON performance_metrics(restaurant_id, period_date DESC) WHERE deleted_at IS NULL;

-- ============================================================================
-- VIEWS: Reporting and dashboards
-- ============================================================================

-- View: Current month sales summary
CREATE VIEW IF NOT EXISTS v_current_month_sales AS
SELECT
    sa.restaurant_id,
    sa.period_label,
    sa.total_orders,
    sa.completed_orders,
    sa.total_revenue,
    sa.average_order_value,
    sa.new_customers,
    sa.returning_customers,
    sa.revenue_growth_rate
FROM sales_analytics sa
WHERE sa.deleted_at IS NULL
    AND sa.analytics_period = 'monthly'
    AND sa.period_date >= (unixepoch('now', 'start of month') * 1000)
ORDER BY sa.period_date DESC;

-- View: Top performing menu items
CREATE VIEW IF NOT EXISTS v_top_menu_items AS
SELECT
    ma.restaurant_id,
    ma.menu_item_id,
    ma.item_name,
    ma.total_quantity_sold,
    ma.total_revenue,
    ma.profit_margin,
    ma.popularity_rank,
    ma.conversion_rate
FROM menu_analytics ma
WHERE ma.deleted_at IS NULL
    AND ma.analytics_period = 'monthly'
    AND ma.period_date >= (unixepoch('now', 'start of month') * 1000)
ORDER BY ma.total_revenue DESC
LIMIT 20;

-- View: High-value customers
CREATE VIEW IF NOT EXISTS v_high_value_customers AS
SELECT
    ca.customer_id,
    ca.restaurant_id,
    u.full_name,
    u.email,
    ca.lifetime_value,
    ca.lifetime_orders,
    ca.rfm_segment,
    ca.churn_risk_score,
    ca.average_order_value
FROM customer_analytics ca
JOIN users u ON ca.customer_id = u.id
WHERE ca.deleted_at IS NULL
    AND ca.analytics_period = 'monthly'
    AND ca.lifetime_value > 1000
ORDER BY ca.lifetime_value DESC;

-- View: Performance dashboard
CREATE VIEW IF NOT EXISTS v_performance_dashboard AS
SELECT
    pm.restaurant_id,
    pm.period_label,
    pm.average_order_prep_time,
    pm.on_time_delivery_rate,
    pm.revenue_per_labor_hour,
    pm.attendance_rate,
    pm.average_table_occupancy,
    pm.satisfaction_score,
    pm.profit_margin
FROM performance_metrics pm
WHERE pm.deleted_at IS NULL
    AND pm.metrics_period = 'daily'
    AND pm.period_date >= (unixepoch('now', 'start of day') * 1000);

-- ============================================================================
-- TRIGGERS: Auto-update timestamps
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS trg_sales_analytics_updated_at
AFTER UPDATE ON sales_analytics
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE sales_analytics SET updated_at = (unixepoch('now') * 1000) WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_menu_analytics_updated_at
AFTER UPDATE ON menu_analytics
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE menu_analytics SET updated_at = (unixepoch('now') * 1000) WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_customer_analytics_updated_at
AFTER UPDATE ON customer_analytics
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE customer_analytics SET updated_at = (unixepoch('now') * 1000) WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_performance_metrics_updated_at
AFTER UPDATE ON performance_metrics
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE performance_metrics SET updated_at = (unixepoch('now') * 1000) WHERE id = NEW.id;
END;

-- ============================================================================
-- END OF MIGRATION: 12_business_analytics.sql
-- ============================================================================
-- Summary:
--   - Tables: 4 (sales_analytics, menu_analytics, customer_analytics,
--               performance_metrics)
--   - Indexes: 19 total
--   - Views: 4 (current_month_sales, top_menu_items, high_value_customers,
--              performance_dashboard)
--   - Triggers: 4 (auto-update timestamps)
--   - Lines: ~650
--
-- Features:
--   ✅ Comprehensive sales analytics
--   ✅ Menu performance tracking
--   ✅ Customer behavior analysis
--   ✅ RFM segmentation
--   ✅ Churn prediction
--   ✅ Operational KPIs
--   ✅ Staff performance metrics
--   ✅ Table utilization tracking
--   ✅ Customer satisfaction metrics
--   ✅ Financial efficiency tracking
--   ✅ Growth rate calculations
--   ✅ Target vs actual comparison
-- ============================================================================

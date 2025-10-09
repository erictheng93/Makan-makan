-- Migration: AI Analytics System
-- Description: Add tables for AI-powered business analytics and insights
-- Created: 2025-10-06

-- ============================================
-- AI Provider Configuration
-- ============================================

-- Store AI/LLM provider configuration per restaurant
CREATE TABLE IF NOT EXISTS ai_configurations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  restaurant_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai', 'google', 'deepseek', 'custom')),
  api_key_encrypted TEXT NOT NULL,  -- Encrypted API key using AES-256
  model TEXT,                        -- Optional: specific model name
  custom_base_url TEXT,              -- For custom providers
  max_tokens INTEGER DEFAULT 4096,
  temperature REAL DEFAULT 0.7,
  enabled INTEGER DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(restaurant_id),  -- One configuration per restaurant
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

CREATE INDEX idx_ai_config_restaurant ON ai_configurations(restaurant_id);
CREATE INDEX idx_ai_config_enabled ON ai_configurations(enabled);

-- ============================================
-- AI Insights Cache
-- ============================================

-- Cache AI-generated insights to reduce API calls
CREATE TABLE IF NOT EXISTS ai_insights_cache (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  restaurant_id TEXT NOT NULL,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('trend', 'anomaly', 'recommendation', 'forecast', 'full_report')),
  time_range TEXT NOT NULL,          -- '7d', '30d', '90d', etc.
  data TEXT NOT NULL,                -- JSON string of insights
  confidence_score REAL,             -- 0-1, confidence in the analysis
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,      -- Cache expiration
  tokens_used INTEGER,               -- Track API usage
  latency_ms INTEGER,                -- Track performance
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  UNIQUE(restaurant_id, insight_type, time_range)
);

CREATE INDEX idx_insights_cache_restaurant ON ai_insights_cache(restaurant_id);
CREATE INDEX idx_insights_cache_expires ON ai_insights_cache(expires_at);
CREATE INDEX idx_insights_cache_type ON ai_insights_cache(insight_type);

-- ============================================
-- Product Analytics (Pre-computed Metrics)
-- ============================================

-- Store daily product performance metrics for fast querying
CREATE TABLE IF NOT EXISTS product_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id TEXT NOT NULL,
  menu_item_id TEXT NOT NULL,
  date DATE NOT NULL,

  -- Sales metrics
  order_count INTEGER DEFAULT 0,
  revenue REAL DEFAULT 0,
  avg_order_value REAL DEFAULT 0,

  -- Profit metrics (if cost data available)
  unit_cost REAL,
  unit_price REAL NOT NULL,
  profit_margin REAL,                -- (price - cost) / price
  total_profit REAL,                 -- (price - cost) * orders

  -- Traffic driver metrics
  first_item_count INTEGER DEFAULT 0,  -- Times this was first item in cart
  view_count INTEGER DEFAULT 0,         -- Page views
  cart_addition_count INTEGER DEFAULT 0,

  -- Ranking
  sales_rank INTEGER,
  revenue_rank INTEGER,
  profit_rank INTEGER,

  -- Trend analysis
  trend_score REAL DEFAULT 0,        -- -1 to 1, calculated daily
  growth_rate REAL DEFAULT 0,        -- % vs previous period

  -- Categories (JSON array)
  categories TEXT,                   -- ["traffic-driver", "bestseller", "profit-leader"]

  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  UNIQUE(restaurant_id, menu_item_id, date)
);

CREATE INDEX idx_product_analytics_restaurant ON product_analytics(restaurant_id, date);
CREATE INDEX idx_product_analytics_item ON product_analytics(menu_item_id, date);
CREATE INDEX idx_product_analytics_rank ON product_analytics(restaurant_id, sales_rank, date);

-- ============================================
-- Order Item Tracking (Enhanced)
-- ============================================

-- Track order item position for traffic driver analysis
CREATE TABLE IF NOT EXISTS order_item_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  menu_item_id TEXT NOT NULL,
  position_in_order INTEGER NOT NULL,  -- 1 = first item, 2 = second, etc.
  was_viewed_before_order INTEGER DEFAULT 0 CHECK (was_viewed_before_order IN (0, 1)),
  was_recommended INTEGER DEFAULT 0 CHECK (was_recommended IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

CREATE INDEX idx_order_item_analytics_order ON order_item_analytics(order_id);
CREATE INDEX idx_order_item_analytics_item ON order_item_analytics(menu_item_id);
CREATE INDEX idx_order_item_analytics_position ON order_item_analytics(position_in_order);

-- ============================================
-- Business Metrics Aggregation
-- ============================================

-- Daily aggregated metrics per restaurant for fast dashboard loading
CREATE TABLE IF NOT EXISTS daily_business_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id TEXT NOT NULL,
  date DATE NOT NULL,

  -- Revenue metrics
  total_revenue REAL DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  avg_order_value REAL DEFAULT 0,

  -- Profit metrics
  total_cost REAL,
  total_profit REAL,
  profit_margin REAL,

  -- Customer metrics
  unique_customers INTEGER DEFAULT 0,
  new_customers INTEGER DEFAULT 0,
  repeat_customers INTEGER DEFAULT 0,

  -- Operational metrics
  peak_hour INTEGER,                 -- Hour with most orders (0-23)
  peak_hour_orders INTEGER,
  avg_preparation_time_minutes REAL,

  -- Growth metrics (vs previous period)
  revenue_growth REAL,               -- % change
  order_growth REAL,                 -- % change

  calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  UNIQUE(restaurant_id, date)
);

CREATE INDEX idx_daily_metrics_restaurant ON daily_business_metrics(restaurant_id, date);

-- ============================================
-- AI Usage Tracking
-- ============================================

-- Track AI API usage for billing and analytics
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  operation TEXT NOT NULL,           -- 'insights', 'forecast', 'recommendation', etc.
  tokens_used INTEGER,
  latency_ms INTEGER,
  success INTEGER DEFAULT 1 CHECK (success IN (0, 1)),
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

CREATE INDEX idx_ai_usage_restaurant ON ai_usage_logs(restaurant_id, created_at);
CREATE INDEX idx_ai_usage_provider ON ai_usage_logs(provider, created_at);

-- ============================================
-- Menu Item Costs (for profit calculation)
-- ============================================

-- Store cost information for menu items
CREATE TABLE IF NOT EXISTS menu_item_costs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_item_id TEXT NOT NULL,
  ingredient_cost REAL DEFAULT 0,    -- Total ingredient cost
  labor_cost REAL DEFAULT 0,         -- Estimated labor cost
  overhead_cost REAL DEFAULT 0,      -- Allocated overhead
  total_cost REAL GENERATED ALWAYS AS (ingredient_cost + labor_cost + overhead_cost) STORED,
  effective_from DATE NOT NULL,      -- Cost can change over time
  effective_to DATE,                 -- NULL means current
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

CREATE INDEX idx_menu_costs_item ON menu_item_costs(menu_item_id);
CREATE INDEX idx_menu_costs_effective ON menu_item_costs(effective_from, effective_to);

-- ============================================
-- Triggers for Auto-updating
-- ============================================

-- Update ai_configurations.updated_at on changes
CREATE TRIGGER IF NOT EXISTS update_ai_config_timestamp
AFTER UPDATE ON ai_configurations
FOR EACH ROW
BEGIN
  UPDATE ai_configurations
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;

-- Update product_analytics.updated_at on changes
CREATE TRIGGER IF NOT EXISTS update_product_analytics_timestamp
AFTER UPDATE ON product_analytics
FOR EACH ROW
BEGIN
  UPDATE product_analytics
  SET updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.id;
END;

-- ============================================
-- Views for Common Queries
-- ============================================

-- View: Current menu item costs
CREATE VIEW IF NOT EXISTS v_current_menu_costs AS
SELECT
  mic.menu_item_id,
  mi.name AS menu_item_name,
  mi.price AS selling_price,
  mic.total_cost,
  (mi.price - mic.total_cost) AS unit_profit,
  CASE
    WHEN mi.price > 0 THEN ((mi.price - mic.total_cost) / mi.price * 100)
    ELSE 0
  END AS profit_margin_percent
FROM menu_item_costs mic
JOIN menu_items mi ON mic.menu_item_id = mi.id
WHERE mic.effective_to IS NULL
  AND mi.available = 1;

-- View: Product performance summary (last 30 days)
CREATE VIEW IF NOT EXISTS v_product_performance_30d AS
SELECT
  pa.restaurant_id,
  pa.menu_item_id,
  mi.name AS menu_item_name,
  mi.category,
  SUM(pa.order_count) AS total_orders,
  SUM(pa.revenue) AS total_revenue,
  AVG(pa.avg_order_value) AS avg_order_value,
  SUM(pa.total_profit) AS total_profit,
  AVG(pa.profit_margin) AS avg_profit_margin,
  SUM(pa.first_item_count) AS traffic_driver_count,
  AVG(pa.trend_score) AS avg_trend_score,
  pa.categories
FROM product_analytics pa
JOIN menu_items mi ON pa.menu_item_id = mi.id
WHERE pa.date >= DATE('now', '-30 days')
GROUP BY pa.restaurant_id, pa.menu_item_id, mi.name, mi.category, pa.categories;

-- ============================================
-- Sample Data / Initial Setup
-- ============================================

-- Note: Actual API keys will be added by restaurant owners through the admin interface
-- This migration only creates the schema structure

-- Migration complete
SELECT 'AI Analytics System schema created successfully' AS status;

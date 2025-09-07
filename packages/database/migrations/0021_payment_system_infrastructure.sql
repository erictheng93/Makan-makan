-- Payment System Infrastructure Migration
-- Version: 0021
-- Description: 建立完整的支付系統基礎架構，支援多國多提供商

-- =============================================
-- 1. 支付提供商表
-- =============================================
CREATE TABLE payment_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  supported_countries TEXT NOT NULL,  -- JSON: ["TW", "MY", "VN"]
  supported_methods TEXT NOT NULL,    -- JSON: ["credit_card", "bank_transfer"]
  test_mode BOOLEAN DEFAULT TRUE,
  webhook_endpoint TEXT,
  config_schema TEXT,                 -- JSON: 配置參數的 schema
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 支付提供商索引
CREATE INDEX idx_payment_providers_name ON payment_providers(name);
CREATE INDEX idx_payment_providers_active ON payment_providers(is_active);

-- =============================================
-- 2. 支付提供商配置表 (加密存儲敏感信息)
-- =============================================
CREATE TABLE payment_provider_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  country_code TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  is_test_mode BOOLEAN DEFAULT TRUE,
  config_data TEXT NOT NULL,          -- 加密的 JSON 配置
  config_hash TEXT NOT NULL,          -- 配置的 hash 用於驗證
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (provider_id) REFERENCES payment_providers(id) ON DELETE CASCADE,
  UNIQUE(provider_id, country_code)
);

-- 提供商配置索引
CREATE INDEX idx_provider_configs_country ON payment_provider_configs(country_code);
CREATE INDEX idx_provider_configs_primary ON payment_provider_configs(is_primary);

-- =============================================
-- 3. 國家支付配置表
-- =============================================
CREATE TABLE country_payment_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  country_code TEXT NOT NULL UNIQUE,
  currency_code TEXT NOT NULL,
  supported_methods TEXT NOT NULL,    -- JSON: 支援的支付方式
  primary_provider TEXT NOT NULL,
  fallback_providers TEXT,            -- JSON: 備用提供商列表
  minimum_amount REAL NOT NULL DEFAULT 0,
  maximum_amount REAL NOT NULL DEFAULT 999999,
  tax_rate REAL NOT NULL DEFAULT 0,
  processing_fee_rate REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 國家配置索引
CREATE INDEX idx_country_configs_code ON country_payment_configs(country_code);

-- =============================================
-- 4. 支付交易表
-- =============================================
CREATE TABLE payment_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id TEXT NOT NULL UNIQUE,  -- 內部交易 ID
  order_id INTEGER NOT NULL,
  restaurant_id INTEGER NOT NULL,
  provider_name TEXT NOT NULL,
  provider_transaction_id TEXT,          -- 提供商的交易 ID
  payment_method TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  country_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  is_fallback BOOLEAN DEFAULT FALSE,     -- 是否為備用提供商處理
  
  -- 客戶資訊
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  
  -- 時間戳
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processing_started_at TIMESTAMP,
  completed_at TIMESTAMP,
  failed_at TIMESTAMP,
  
  -- 額外資訊
  metadata TEXT,                         -- JSON: 額外的交易資訊
  error_code TEXT,
  error_message TEXT,
  provider_response TEXT,                -- JSON: 提供商回應
  
  -- 外鍵約束
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

-- 支付交易索引
CREATE INDEX idx_payment_transactions_order ON payment_transactions(order_id);
CREATE INDEX idx_payment_transactions_restaurant ON payment_transactions(restaurant_id);
CREATE INDEX idx_payment_transactions_provider ON payment_transactions(provider_name);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX idx_payment_transactions_created ON payment_transactions(created_at);
CREATE INDEX idx_payment_transactions_provider_id ON payment_transactions(provider_transaction_id);

-- =============================================
-- 5. 退款交易表
-- =============================================
CREATE TABLE refund_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  refund_id TEXT NOT NULL UNIQUE,
  payment_transaction_id INTEGER NOT NULL,
  provider_refund_id TEXT,               -- 提供商的退款 ID
  amount REAL NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- 時間戳
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  failed_at TIMESTAMP,
  
  -- 額外資訊
  metadata TEXT,                         -- JSON
  error_code TEXT,
  error_message TEXT,
  provider_response TEXT,                -- JSON
  
  FOREIGN KEY (payment_transaction_id) REFERENCES payment_transactions(id) ON DELETE CASCADE
);

-- 退款交易索引
CREATE INDEX idx_refund_transactions_payment ON refund_transactions(payment_transaction_id);
CREATE INDEX idx_refund_transactions_status ON refund_transactions(status);
CREATE INDEX idx_refund_transactions_created ON refund_transactions(created_at);

-- =============================================
-- 6. 支付日誌表 (用於監控和調試)
-- =============================================
CREATE TABLE payment_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id TEXT,
  provider_name TEXT NOT NULL,
  event_type TEXT NOT NULL,              -- 'request', 'response', 'webhook', 'error'
  level TEXT NOT NULL DEFAULT 'info',    -- 'debug', 'info', 'warn', 'error'
  message TEXT NOT NULL,
  data TEXT,                             -- JSON: 相關數據
  duration_ms INTEGER,                   -- 請求耗時
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- 關聯索引
  FOREIGN KEY (transaction_id) REFERENCES payment_transactions(transaction_id)
);

-- 支付日誌索引
CREATE INDEX idx_payment_logs_transaction ON payment_logs(transaction_id);
CREATE INDEX idx_payment_logs_provider ON payment_logs(provider_name);
CREATE INDEX idx_payment_logs_event_type ON payment_logs(event_type);
CREATE INDEX idx_payment_logs_level ON payment_logs(level);
CREATE INDEX idx_payment_logs_created ON payment_logs(created_at);

-- =============================================
-- 7. 支付統計表 (用於性能監控)
-- =============================================
CREATE TABLE payment_statistics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  date DATE NOT NULL,
  
  -- 統計數據
  total_attempts INTEGER DEFAULT 0,
  successful_attempts INTEGER DEFAULT 0,
  failed_attempts INTEGER DEFAULT 0,
  total_amount REAL DEFAULT 0,
  average_duration_ms INTEGER DEFAULT 0,
  
  -- 時間戳
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(provider_name, country_code, payment_method, date)
);

-- 支付統計索引
CREATE INDEX idx_payment_statistics_provider ON payment_statistics(provider_name);
CREATE INDEX idx_payment_statistics_country ON payment_statistics(country_code);
CREATE INDEX idx_payment_statistics_date ON payment_statistics(date);

-- =============================================
-- 8. Webhook 事件表
-- =============================================
CREATE TABLE webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_name TEXT NOT NULL,
  event_id TEXT,                         -- 提供商的事件 ID (如果有)
  event_type TEXT NOT NULL,
  transaction_id TEXT,
  payload TEXT NOT NULL,                 -- JSON: 完整的 webhook payload
  signature TEXT,                        -- webhook 簽名
  processed BOOLEAN DEFAULT FALSE,
  processing_attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(provider_name, event_id)
);

-- Webhook 事件索引
CREATE INDEX idx_webhook_events_provider ON webhook_events(provider_name);
CREATE INDEX idx_webhook_events_transaction ON webhook_events(transaction_id);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX idx_webhook_events_created ON webhook_events(created_at);

-- =============================================
-- 9. 初始化基礎數據
-- =============================================

-- 插入基本的支付提供商
INSERT INTO payment_providers (name, display_name, supported_countries, supported_methods, test_mode) VALUES
('stripe', 'Stripe', '["TW", "MY", "VN"]', '["credit_card", "debit_card"]', TRUE),
-- 台灣支付提供商
('ecpay', '綠界科技', '["TW"]', '["credit_card", "bank_transfer", "ecpay"]', TRUE),
('newebpay', '藍新金流', '["TW"]', '["credit_card", "bank_transfer", "digital_wallet", "newebpay"]', TRUE),
('linepay', 'LINE Pay', '["TW"]', '["line_pay"]', TRUE),
('unipay', '統一金流', '["TW"]', '["credit_card", "bank_transfer", "digital_wallet", "unipay"]', TRUE),
-- 馬來西亞支付提供商
('ipay88', 'iPay88', '["MY"]', '["fpx", "credit_card", "touch_n_go"]', TRUE),
('touchngo_direct', 'Touch \'n Go eWallet Direct', '["MY"]', '["touch_n_go_direct"]', TRUE),
-- 越南支付提供商
('vnpay', 'VNPay', '["VN"]', '["bank_transfer", "momo", "viet_qr", "vnpay"]', TRUE);

-- 插入國家支付配置
INSERT INTO country_payment_configs (
  country_code, currency_code, supported_methods, primary_provider, 
  fallback_providers, minimum_amount, maximum_amount, tax_rate
) VALUES
('TW', 'TWD', '["credit_card", "ecpay", "bank_transfer"]', 'stripe', '["ecpay"]', 1, 1000000, 0.05),
('MY', 'MYR', '["credit_card", "fpx", "touch_n_go", "touch_n_go_direct"]', 'stripe', '["ipay88", "touchngo_direct"]', 0.5, 50000, 0),
('VN', 'VND', '["credit_card", "bank_transfer", "momo", "viet_qr"]', 'stripe', '["vnpay"]', 10000, 50000000, 0.1);

-- =============================================
-- 10. 更新 orders 表以支援新的支付系統
-- =============================================

-- 新增支付交易關聯欄位 (如果不存在)
ALTER TABLE orders ADD COLUMN payment_transaction_id INTEGER REFERENCES payment_transactions(id);

-- 更新支付狀態欄位的可能值
-- 注意: SQLite 不支援 ALTER COLUMN，所以這是註解說明
-- payment_status 應包含: 'pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'partial_refunded'

-- 新增支付交易索引
CREATE INDEX idx_orders_payment_transaction ON orders(payment_transaction_id);
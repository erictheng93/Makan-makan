-- =====================================================
-- Migration: Authentication and Authorization (Layer 1)
-- Version: v2-002
-- Date: 2025-10-28
-- Description: 認證授權系統 - 用戶管理、會話管理、權限控制
--              支持多角色(Admin/Owner/Staff/Customer)
-- Dependencies: 01_tenants_and_settings.sql
-- =====================================================

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. USERS TABLE (用戶表)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Purpose: 統一的用戶表，支持員工和顧客
-- Design: UUID 主鍵，完整的認證資訊，角色權限管理
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS users (
    -- ═══════════════════════════════════════
    -- 主鍵 (UUID格式)
    -- ═══════════════════════════════════════
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    restaurant_id TEXT NOT NULL,

    -- ═══════════════════════════════════════
    -- 基本資訊
    -- ═══════════════════════════════════════
    username TEXT NOT NULL,                 -- 唯一用戶名
    email TEXT,                            -- 可選 (顧客可能只有電話)
    phone TEXT,                            -- 可選 (員工可能只有 email)
    full_name TEXT NOT NULL,

    -- ═══════════════════════════════════════
    -- 認證資訊
    -- ═══════════════════════════════════════
    password_hash TEXT NOT NULL,           -- bcrypt hash

    -- ═══════════════════════════════════════
    -- 角色和權限
    -- ═══════════════════════════════════════
    role TEXT NOT NULL DEFAULT 'customer',
    -- Roles: admin, owner, manager, chef, server, cashier, customer
    -- Format: ["users:read", "orders:write", "menu:admin"]
    permissions TEXT DEFAULT '[]',

    -- ═══════════════════════════════════════
    -- 個人資訊
    -- ═══════════════════════════════════════
    avatar_url TEXT,
    date_of_birth TEXT,                    -- ISO date: YYYY-MM-DD
    gender TEXT,                           -- male, female, other, prefer_not_to_say

    -- ═══════════════════════════════════════
    -- 聯絡資訊
    -- ═══════════════════════════════════════
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'TW',

    -- ═══════════════════════════════════════
    -- 偏好設定 (JSON格式)
    -- ═══════════════════════════════════════
    -- Format: {
    --   "language": "zh-TW",
    --   "timezone": "Asia/Taipei",
    --   "currency": "TWD",
    --   "notifications": {
    --     "email": true,
    --     "sms": false,
    --     "push": true
    --   },
    --   "dietary": ["vegetarian"]
    -- }
    preferences TEXT DEFAULT '{}',

    -- ═══════════════════════════════════════
    -- 狀態管理
    -- ═══════════════════════════════════════
    status TEXT NOT NULL DEFAULT 'active',     -- active, inactive, suspended, banned
    is_email_verified INTEGER DEFAULT 0,
    is_phone_verified INTEGER DEFAULT 0,
    email_verified_at INTEGER,
    phone_verified_at INTEGER,

    -- ═══════════════════════════════════════
    -- 安全資訊
    -- ═══════════════════════════════════════
    last_login_at INTEGER,
    last_login_ip TEXT,
    password_changed_at INTEGER,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until INTEGER,                      -- Account lock timestamp

    -- ═══════════════════════════════════════
    -- 兩步驗證 (2FA)
    -- ═══════════════════════════════════════
    two_factor_enabled INTEGER DEFAULT 0,
    two_factor_secret TEXT,                    -- Encrypted TOTP secret
    two_factor_backup_codes TEXT DEFAULT '[]', -- JSON array of encrypted backup codes

    -- ═══════════════════════════════════════
    -- 員工專屬欄位
    -- ═══════════════════════════════════════
    employee_id TEXT,                          -- 員工編號
    hire_date TEXT,                            -- ISO date
    department TEXT,                           -- kitchen, service, management, etc.
    hourly_rate REAL,                          -- 時薪 (用於排班計算)

    -- ═══════════════════════════════════════
    -- 顧客專屬欄位
    -- ═══════════════════════════════════════
    total_orders INTEGER DEFAULT 0,
    total_spent REAL DEFAULT 0,                -- 累計消費金額
    loyalty_points INTEGER DEFAULT 0,          -- 忠誠度積分
    customer_tier TEXT DEFAULT 'bronze',       -- bronze, silver, gold, platinum

    -- ═══════════════════════════════════════
    -- 擴展欄位
    -- ═══════════════════════════════════════
    metadata TEXT DEFAULT '{}',

    -- ═══════════════════════════════════════
    -- 審計欄位
    -- ═══════════════════════════════════════
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    deleted_at INTEGER,
    created_by TEXT,

    -- ═══════════════════════════════════════
    -- 外鍵和約束
    -- ═══════════════════════════════════════
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,

    UNIQUE(restaurant_id, username),
    UNIQUE(restaurant_id, employee_id) WHERE employee_id IS NOT NULL,

    CHECK (role IN ('admin', 'owner', 'manager', 'chef', 'server', 'cashier', 'customer')),
    CHECK (status IN ('active', 'inactive', 'suspended', 'banned')),
    CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say') OR gender IS NULL),
    CHECK (is_email_verified IN (0, 1)),
    CHECK (is_phone_verified IN (0, 1)),
    CHECK (two_factor_enabled IN (0, 1)),
    CHECK (failed_login_attempts >= 0),
    CHECK (total_orders >= 0),
    CHECK (total_spent >= 0),
    CHECK (loyalty_points >= 0),
    CHECK (customer_tier IN ('bronze', 'silver', 'gold', 'platinum')),
    CHECK (hourly_rate IS NULL OR hourly_rate >= 0),
    CHECK (email IS NOT NULL OR phone IS NOT NULL) -- 至少要有一種聯絡方式
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- INDEXES FOR USERS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 主要查詢索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_restaurant_username
    ON users(restaurant_id, username)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_email
    ON users(email)
    WHERE email IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_phone
    ON users(phone)
    WHERE phone IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_role
    ON users(restaurant_id, role, status)
    WHERE deleted_at IS NULL;

-- 員工查詢索引
CREATE INDEX IF NOT EXISTS idx_users_employee
    ON users(restaurant_id, employee_id)
    WHERE employee_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_department
    ON users(restaurant_id, department)
    WHERE department IS NOT NULL AND deleted_at IS NULL;

-- 顧客查詢索引
CREATE INDEX IF NOT EXISTS idx_users_customer_tier
    ON users(restaurant_id, customer_tier)
    WHERE role = 'customer' AND deleted_at IS NULL;

-- 狀態索引
CREATE INDEX IF NOT EXISTS idx_users_status
    ON users(status, role)
    WHERE deleted_at IS NULL;

-- 安全索引
CREATE INDEX IF NOT EXISTS idx_users_locked
    ON users(restaurant_id, locked_until)
    WHERE locked_until IS NOT NULL AND locked_until > unixepoch('now') * 1000;

-- 時間索引
CREATE INDEX IF NOT EXISTS idx_users_last_login
    ON users(last_login_at DESC)
    WHERE deleted_at IS NULL;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. SESSIONS TABLE (會話表)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Purpose: JWT 會話管理，支持多設備登入
-- Design: Token hash 存儲，完整的設備追蹤
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS sessions (
    -- ═══════════════════════════════════════
    -- 主鍵 (UUID格式)
    -- ═══════════════════════════════════════
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,

    -- ═══════════════════════════════════════
    -- Token 資訊 (存儲 hash 而非原始 token)
    -- ═══════════════════════════════════════
    access_token_hash TEXT NOT NULL UNIQUE,
    refresh_token_hash TEXT UNIQUE,

    -- ═══════════════════════════════════════
    -- 裝置資訊
    -- ═══════════════════════════════════════
    device_type TEXT,                      -- web, ios, android, desktop
    device_name TEXT,                      -- 用戶自定義設備名稱
    user_agent TEXT,
    ip_address TEXT,

    -- ═══════════════════════════════════════
    -- 地理位置 (JSON格式)
    -- ═══════════════════════════════════════
    -- Format: {
    --   "country": "Taiwan",
    --   "city": "Taichung",
    --   "latitude": 24.1477,
    --   "longitude": 120.6736
    -- }
    location TEXT DEFAULT '{}',

    -- ═══════════════════════════════════════
    -- 狀態管理
    -- ═══════════════════════════════════════
    is_active INTEGER DEFAULT 1,

    -- ═══════════════════════════════════════
    -- 時間資訊
    -- ═══════════════════════════════════════
    last_accessed_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    expires_at INTEGER NOT NULL,

    -- ═══════════════════════════════════════
    -- 審計欄位
    -- ═══════════════════════════════════════
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),

    -- ═══════════════════════════════════════
    -- 外鍵和約束
    -- ═══════════════════════════════════════
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    CHECK (device_type IN ('web', 'ios', 'android', 'desktop') OR device_type IS NULL),
    CHECK (is_active IN (0, 1))
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- INDEXES FOR SESSIONS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_access_token
    ON sessions(access_token_hash);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_refresh_token
    ON sessions(refresh_token_hash)
    WHERE refresh_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_user_active
    ON sessions(user_id, is_active, last_accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_expires
    ON sessions(expires_at)
    WHERE is_active = 1;

CREATE INDEX IF NOT EXISTS idx_sessions_device
    ON sessions(user_id, device_type)
    WHERE is_active = 1;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. PASSWORD_RESET_TOKENS TABLE (密碼重置令牌)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,

    -- ═══════════════════════════════════════
    -- Token 資訊
    -- ═══════════════════════════════════════
    token_hash TEXT NOT NULL UNIQUE,       -- SHA-256 hash of reset token

    -- ═══════════════════════════════════════
    -- 狀態和時間
    -- ═══════════════════════════════════════
    is_used INTEGER DEFAULT 0,
    used_at INTEGER,
    expires_at INTEGER NOT NULL,

    -- ═══════════════════════════════════════
    -- 審計欄位
    -- ═══════════════════════════════════════
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    ip_address TEXT,
    user_agent TEXT,

    -- ═══════════════════════════════════════
    -- 外鍵和約束
    -- ═══════════════════════════════════════
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    CHECK (is_used IN (0, 1))
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- INDEXES FOR PASSWORD_RESET_TOKENS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_token
    ON password_reset_tokens(token_hash);

CREATE INDEX IF NOT EXISTS idx_password_reset_user
    ON password_reset_tokens(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_password_reset_expires
    ON password_reset_tokens(expires_at)
    WHERE is_used = 0;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. EMAIL_VERIFICATION_TOKENS TABLE (Email 驗證令牌)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,

    -- ═══════════════════════════════════════
    -- Token 資訊
    -- ═══════════════════════════════════════
    token_hash TEXT NOT NULL UNIQUE,

    -- ═══════════════════════════════════════
    -- 狀態和時間
    -- ═══════════════════════════════════════
    is_used INTEGER DEFAULT 0,
    used_at INTEGER,
    expires_at INTEGER NOT NULL,

    -- ═══════════════════════════════════════
    -- 審計欄位
    -- ═══════════════════════════════════════
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),

    -- ═══════════════════════════════════════
    -- 外鍵和約束
    -- ═══════════════════════════════════════
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    CHECK (is_used IN (0, 1))
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- INDEXES FOR EMAIL_VERIFICATION_TOKENS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_verification_token
    ON email_verification_tokens(token_hash);

CREATE INDEX IF NOT EXISTS idx_email_verification_user
    ON email_verification_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_email_verification_expires
    ON email_verification_tokens(expires_at)
    WHERE is_used = 0;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TRIGGERS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Auto-update updated_at for users
CREATE TRIGGER IF NOT EXISTS users_updated_at
AFTER UPDATE ON users
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE users
    SET updated_at = unixepoch('now') * 1000
    WHERE id = NEW.id;
END;

-- Auto-update last_accessed_at for sessions
CREATE TRIGGER IF NOT EXISTS sessions_last_accessed
AFTER UPDATE ON sessions
FOR EACH ROW
WHEN NEW.last_accessed_at = OLD.last_accessed_at
BEGIN
    UPDATE sessions
    SET last_accessed_at = unixepoch('now') * 1000
    WHERE id = NEW.id;
END;

-- Reset failed login attempts on successful login
CREATE TRIGGER IF NOT EXISTS users_reset_failed_attempts
AFTER UPDATE OF last_login_at ON users
FOR EACH ROW
WHEN NEW.last_login_at != OLD.last_login_at AND OLD.failed_login_attempts > 0
BEGIN
    UPDATE users
    SET failed_login_attempts = 0,
        locked_until = NULL
    WHERE id = NEW.id;
END;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- VIEWS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Active employees view
CREATE VIEW IF NOT EXISTS v_active_employees AS
SELECT
    u.id,
    u.restaurant_id,
    u.username,
    u.full_name,
    u.email,
    u.phone,
    u.role,
    u.employee_id,
    u.department,
    u.hourly_rate,
    u.hire_date,
    u.last_login_at,
    u.status
FROM users u
WHERE u.role IN ('owner', 'manager', 'chef', 'server', 'cashier')
  AND u.status = 'active'
  AND u.deleted_at IS NULL;

-- Active customers view
CREATE VIEW IF NOT EXISTS v_active_customers AS
SELECT
    u.id,
    u.restaurant_id,
    u.full_name,
    u.email,
    u.phone,
    u.customer_tier,
    u.total_orders,
    u.total_spent,
    u.loyalty_points,
    u.last_login_at,
    u.created_at
FROM users u
WHERE u.role = 'customer'
  AND u.status = 'active'
  AND u.deleted_at IS NULL;

-- Active sessions summary
CREATE VIEW IF NOT EXISTS v_active_sessions_summary AS
SELECT
    s.user_id,
    u.username,
    u.role,
    COUNT(s.id) as active_sessions,
    MAX(s.last_accessed_at) as last_active,
    GROUP_CONCAT(DISTINCT s.device_type) as devices
FROM sessions s
JOIN users u ON s.user_id = u.id
WHERE s.is_active = 1
  AND s.expires_at > unixepoch('now') * 1000
GROUP BY s.user_id;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- MIGRATION COMPLETE
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Layer 1 - Authentication and Authorization
-- Tables Created: 4
-- Indexes Created: 20
-- Views Created: 3
-- Triggers Created: 3
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SELECT '✅ Migration 02_authentication completed successfully' as status;

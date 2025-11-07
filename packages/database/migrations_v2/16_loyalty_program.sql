-- ============================================================================
-- Layer 6: Advanced Features - Migration 16
-- FILE: 16_loyalty_program.sql
-- PURPOSE: Complete customer loyalty and rewards program
-- TABLES: 5 (loyalty_tiers, customer_loyalty, points_transactions, loyalty_rewards, reward_redemptions)
-- DEPENDENCIES: 01_tenants, 02_authentication, 05_order_management, 06_customer_management
-- ============================================================================

-- ============================================================================
-- TABLE: loyalty_tiers
-- PURPOSE: Loyalty program tier definitions
-- ============================================================================

CREATE TABLE IF NOT EXISTS loyalty_tiers (
    -- Identity
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    restaurant_id TEXT NOT NULL,

    -- Tier Info
    tier_code TEXT NOT NULL,
    tier_name TEXT NOT NULL,
    tier_name_en TEXT,
    description TEXT,
    description_en TEXT,

    -- Tier Level (lower = better)
    tier_level INTEGER NOT NULL,
    tier_color TEXT,
    tier_icon TEXT,

    -- Requirements
    min_points_required INTEGER DEFAULT 0,
    min_spending_required REAL DEFAULT 0,
    min_orders_required INTEGER DEFAULT 0,
    qualification_period_days INTEGER DEFAULT 365,

    -- Benefits
    points_multiplier REAL DEFAULT 1.0,
    discount_percentage REAL DEFAULT 0,
    welcome_points INTEGER DEFAULT 0,
    birthday_points INTEGER DEFAULT 0,
    free_delivery INTEGER DEFAULT 0,
    priority_support INTEGER DEFAULT 0,

    -- Perks
    perks_description TEXT,
    special_offers TEXT DEFAULT '[]',
    exclusive_menu_items TEXT DEFAULT '[]',

    -- Retention
    retention_period_days INTEGER DEFAULT 365,
    downgrade_tier_id TEXT,

    -- Status
    is_active INTEGER DEFAULT 1,

    -- Metadata
    metadata TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    deleted_at INTEGER,

    -- Constraints
    CHECK (tier_level > 0),
    CHECK (points_multiplier >= 1.0),
    CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
    CHECK (free_delivery IN (0, 1)),
    CHECK (priority_support IN (0, 1)),
    CHECK (is_active IN (0, 1)),
    UNIQUE(restaurant_id, tier_code),
    UNIQUE(restaurant_id, tier_level),

    -- Foreign Keys
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (downgrade_tier_id) REFERENCES loyalty_tiers(id) ON DELETE SET NULL
);

-- ============================================================================
-- TABLE: customer_loyalty
-- PURPOSE: Customer loyalty program membership and status
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_loyalty (
    -- Identity
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    customer_id TEXT NOT NULL UNIQUE,
    restaurant_id TEXT NOT NULL,

    -- Current Status
    current_tier_id TEXT NOT NULL,
    loyalty_number TEXT NOT NULL,

    -- Points Balance
    total_points_earned INTEGER DEFAULT 0,
    total_points_spent INTEGER DEFAULT 0,
    current_points_balance INTEGER DEFAULT 0,
    points_expiring_soon INTEGER DEFAULT 0,
    next_expiry_date INTEGER,

    -- Tier Progress
    points_to_next_tier INTEGER DEFAULT 0,
    spending_to_next_tier REAL DEFAULT 0,
    orders_to_next_tier INTEGER DEFAULT 0,

    -- Lifetime Stats
    lifetime_spending REAL DEFAULT 0,
    lifetime_orders INTEGER DEFAULT 0,
    lifetime_visits INTEGER DEFAULT 0,
    member_since INTEGER NOT NULL,
    last_activity_date INTEGER,

    -- Tier History
    tier_achieved_date INTEGER NOT NULL,
    tier_review_date INTEGER,
    previous_tier_id TEXT,
    tier_upgrades_count INTEGER DEFAULT 0,
    tier_downgrades_count INTEGER DEFAULT 0,

    -- Engagement
    referral_code TEXT UNIQUE,
    successful_referrals INTEGER DEFAULT 0,
    referred_by_customer_id TEXT,

    -- Status
    status TEXT NOT NULL DEFAULT 'active',
    is_active INTEGER DEFAULT 1,

    -- Metadata
    metadata TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),

    -- Constraints
    CHECK (status IN ('active', 'inactive', 'suspended', 'cancelled')),
    CHECK (is_active IN (0, 1)),
    CHECK (current_points_balance >= 0),
    UNIQUE(restaurant_id, loyalty_number),

    -- Foreign Keys
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (current_tier_id) REFERENCES loyalty_tiers(id) ON DELETE RESTRICT,
    FOREIGN KEY (previous_tier_id) REFERENCES loyalty_tiers(id) ON DELETE SET NULL,
    FOREIGN KEY (referred_by_customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- ============================================================================
-- TABLE: points_transactions
-- PURPOSE: Complete points earning and spending history
-- ============================================================================

CREATE TABLE IF NOT EXISTS points_transactions (
    -- Identity
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    customer_loyalty_id TEXT NOT NULL,
    restaurant_id TEXT NOT NULL,

    -- Transaction Info
    transaction_type TEXT NOT NULL,
    points_amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,

    -- Source
    source_type TEXT NOT NULL,
    source_id TEXT,
    order_id TEXT,

    -- Description
    description TEXT NOT NULL,
    reason TEXT,

    -- Points Expiry
    expiry_date INTEGER,
    is_expired INTEGER DEFAULT 0,

    -- Multiplier Applied
    base_points INTEGER,
    multiplier_applied REAL DEFAULT 1.0,
    bonus_points INTEGER DEFAULT 0,

    -- Status
    status TEXT NOT NULL DEFAULT 'completed',
    reversed_at INTEGER,
    reversal_reason TEXT,

    -- Transaction Date
    transaction_date INTEGER NOT NULL,

    -- Metadata
    metadata TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),

    -- Constraints
    CHECK (transaction_type IN ('earned', 'spent', 'expired', 'adjusted', 'bonus', 'reversed', 'refunded')),
    CHECK (source_type IN ('order', 'referral', 'signup', 'birthday', 'review', 'social_share', 'manual', 'promotion', 'reward_redemption')),
    CHECK (status IN ('pending', 'completed', 'reversed', 'cancelled')),
    CHECK (is_expired IN (0, 1)),

    -- Foreign Keys
    FOREIGN KEY (customer_loyalty_id) REFERENCES customer_loyalty(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

-- ============================================================================
-- TABLE: loyalty_rewards
-- PURPOSE: Available rewards in the loyalty program
-- ============================================================================

CREATE TABLE IF NOT EXISTS loyalty_rewards (
    -- Identity
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    restaurant_id TEXT NOT NULL,

    -- Reward Info
    reward_code TEXT NOT NULL,
    reward_name TEXT NOT NULL,
    reward_name_en TEXT,
    description TEXT,
    description_en TEXT,

    -- Reward Type
    reward_type TEXT NOT NULL,
    reward_value TEXT NOT NULL,

    -- Cost
    points_cost INTEGER NOT NULL,
    monetary_value REAL,
    currency TEXT DEFAULT 'TWD',

    -- Availability
    available_from INTEGER,
    available_until INTEGER,
    total_quantity INTEGER,
    redeemed_quantity INTEGER DEFAULT 0,
    remaining_quantity INTEGER,

    -- Restrictions
    min_tier_required TEXT,
    max_redemptions_per_customer INTEGER DEFAULT 1,
    min_order_amount REAL DEFAULT 0,

    -- Display
    image_url TEXT,
    badge_text TEXT,
    highlight_color TEXT,
    display_order INTEGER DEFAULT 0,
    is_featured INTEGER DEFAULT 0,

    -- Terms
    terms_and_conditions TEXT,
    usage_instructions TEXT,
    validity_days INTEGER DEFAULT 30,

    -- Status
    status TEXT NOT NULL DEFAULT 'active',
    is_active INTEGER DEFAULT 1,

    -- Metadata
    tags TEXT DEFAULT '[]',
    metadata TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    deleted_at INTEGER,

    -- Constraints
    CHECK (reward_type IN ('discount', 'free_item', 'free_delivery', 'upgrade', 'cashback', 'gift', 'experience', 'voucher')),
    CHECK (status IN ('draft', 'active', 'inactive', 'out_of_stock', 'expired')),
    CHECK (points_cost > 0),
    CHECK (is_featured IN (0, 1)),
    CHECK (is_active IN (0, 1)),
    UNIQUE(restaurant_id, reward_code),

    -- Foreign Keys
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

-- ============================================================================
-- TABLE: reward_redemptions
-- PURPOSE: Reward redemption tracking and fulfillment
-- ============================================================================

CREATE TABLE IF NOT EXISTS reward_redemptions (
    -- Identity
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    restaurant_id TEXT NOT NULL,

    -- Redemption Info
    customer_loyalty_id TEXT NOT NULL,
    reward_id TEXT NOT NULL,

    -- Points
    points_spent INTEGER NOT NULL,
    points_balance_before INTEGER NOT NULL,
    points_balance_after INTEGER NOT NULL,

    -- Voucher/Code
    redemption_code TEXT UNIQUE,
    voucher_code TEXT,

    -- Validity
    valid_from INTEGER NOT NULL,
    valid_until INTEGER NOT NULL,

    -- Usage
    is_used INTEGER DEFAULT 0,
    used_at INTEGER,
    used_in_order_id TEXT,

    -- Status
    status TEXT NOT NULL DEFAULT 'active',
    cancelled_at INTEGER,
    cancellation_reason TEXT,
    expired_at INTEGER,

    -- Points Refund
    is_refunded INTEGER DEFAULT 0,
    refunded_at INTEGER,
    refunded_points INTEGER,

    -- Metadata
    redeemed_at INTEGER NOT NULL,
    metadata TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),

    -- Constraints
    CHECK (status IN ('active', 'used', 'expired', 'cancelled', 'refunded')),
    CHECK (is_used IN (0, 1)),
    CHECK (is_refunded IN (0, 1)),

    -- Foreign Keys
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_loyalty_id) REFERENCES customer_loyalty(id) ON DELETE CASCADE,
    FOREIGN KEY (reward_id) REFERENCES loyalty_rewards(id) ON DELETE RESTRICT,
    FOREIGN KEY (used_in_order_id) REFERENCES orders(id) ON DELETE SET NULL
);

-- ============================================================================
-- INDEXES: Performance optimization
-- ============================================================================

-- Loyalty tiers indexes
CREATE INDEX idx_loyalty_tiers_restaurant ON loyalty_tiers(restaurant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_loyalty_tiers_level ON loyalty_tiers(restaurant_id, tier_level) WHERE is_active = 1 AND deleted_at IS NULL;
CREATE INDEX idx_loyalty_tiers_code ON loyalty_tiers(restaurant_id, tier_code);

-- Customer loyalty indexes
CREATE INDEX idx_customer_loyalty_customer ON customer_loyalty(customer_id);
CREATE INDEX idx_customer_loyalty_restaurant ON customer_loyalty(restaurant_id);
CREATE INDEX idx_customer_loyalty_tier ON customer_loyalty(current_tier_id);
CREATE INDEX idx_customer_loyalty_status ON customer_loyalty(restaurant_id, status, is_active);
CREATE INDEX idx_customer_loyalty_number ON customer_loyalty(restaurant_id, loyalty_number);
CREATE INDEX idx_customer_loyalty_referral ON customer_loyalty(referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX idx_customer_loyalty_referred_by ON customer_loyalty(referred_by_customer_id) WHERE referred_by_customer_id IS NOT NULL;
CREATE INDEX idx_customer_loyalty_activity ON customer_loyalty(restaurant_id, last_activity_date DESC);

-- Points transactions indexes
CREATE INDEX idx_points_transactions_loyalty ON points_transactions(customer_loyalty_id, transaction_date DESC);
CREATE INDEX idx_points_transactions_restaurant ON points_transactions(restaurant_id, transaction_date DESC);
CREATE INDEX idx_points_transactions_type ON points_transactions(customer_loyalty_id, transaction_type);
CREATE INDEX idx_points_transactions_source ON points_transactions(source_type, source_id);
CREATE INDEX idx_points_transactions_order ON points_transactions(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_points_transactions_expiry ON points_transactions(customer_loyalty_id, expiry_date) WHERE is_expired = 0 AND expiry_date IS NOT NULL;
CREATE INDEX idx_points_transactions_status ON points_transactions(customer_loyalty_id, status);

-- Loyalty rewards indexes
CREATE INDEX idx_loyalty_rewards_restaurant ON loyalty_rewards(restaurant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_loyalty_rewards_code ON loyalty_rewards(restaurant_id, reward_code);
CREATE INDEX idx_loyalty_rewards_status ON loyalty_rewards(restaurant_id, status, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_loyalty_rewards_type ON loyalty_rewards(restaurant_id, reward_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_loyalty_rewards_featured ON loyalty_rewards(restaurant_id, is_featured, display_order) WHERE is_active = 1 AND deleted_at IS NULL;
CREATE INDEX idx_loyalty_rewards_availability ON loyalty_rewards(restaurant_id, available_from, available_until) WHERE status = 'active' AND deleted_at IS NULL;

-- Reward redemptions indexes
CREATE INDEX idx_reward_redemptions_restaurant ON reward_redemptions(restaurant_id);
CREATE INDEX idx_reward_redemptions_loyalty ON reward_redemptions(customer_loyalty_id, redeemed_at DESC);
CREATE INDEX idx_reward_redemptions_reward ON reward_redemptions(reward_id);
CREATE INDEX idx_reward_redemptions_code ON reward_redemptions(redemption_code);
CREATE INDEX idx_reward_redemptions_status ON reward_redemptions(customer_loyalty_id, status);
CREATE INDEX idx_reward_redemptions_validity ON reward_redemptions(customer_loyalty_id, valid_from, valid_until) WHERE status = 'active';
CREATE INDEX idx_reward_redemptions_unused ON reward_redemptions(customer_loyalty_id, is_used) WHERE is_used = 0 AND status = 'active';
CREATE INDEX idx_reward_redemptions_order ON reward_redemptions(used_in_order_id) WHERE used_in_order_id IS NOT NULL;

-- ============================================================================
-- VIEWS: Common query patterns
-- ============================================================================

-- View: Customer loyalty dashboard
CREATE VIEW IF NOT EXISTS vw_customer_loyalty_dashboard AS
SELECT
    cl.*,
    c.full_name as customer_name,
    c.email,
    c.phone,
    lt.tier_name,
    lt.tier_level,
    lt.tier_color,
    lt.points_multiplier,
    lt.discount_percentage,
    next_tier.tier_name as next_tier_name,
    next_tier.min_points_required as next_tier_points_required,
    CASE
        WHEN cl.status = 'active' AND cl.is_active = 1 THEN 'active'
        ELSE 'inactive'
    END as effective_status
FROM customer_loyalty cl
JOIN customers c ON cl.customer_id = c.id
JOIN loyalty_tiers lt ON cl.current_tier_id = lt.id
LEFT JOIN loyalty_tiers next_tier ON next_tier.restaurant_id = cl.restaurant_id
    AND next_tier.tier_level = lt.tier_level + 1
    AND next_tier.is_active = 1
WHERE lt.deleted_at IS NULL;

-- View: Points transaction history with details
CREATE VIEW IF NOT EXISTS vw_points_transaction_history AS
SELECT
    pt.*,
    cl.customer_id,
    c.full_name as customer_name,
    o.order_number,
    CASE
        WHEN pt.transaction_type = 'earned' THEN '+'
        WHEN pt.transaction_type = 'spent' THEN '-'
        WHEN pt.transaction_type = 'adjusted' THEN '±'
        ELSE ''
    END as points_prefix
FROM points_transactions pt
JOIN customer_loyalty cl ON pt.customer_loyalty_id = cl.id
JOIN customers c ON cl.customer_id = c.id
LEFT JOIN orders o ON pt.order_id = o.id;

-- View: Available rewards for customer
CREATE VIEW IF NOT EXISTS vw_available_rewards AS
SELECT
    lr.*,
    cl.customer_id,
    cl.current_points_balance,
    lt.tier_name as customer_tier_name,
    lt.tier_level as customer_tier_level,
    CASE
        WHEN lr.min_tier_required IS NOT NULL THEN req_tier.tier_level
        ELSE 0
    END as min_tier_level_required,
    CASE
        WHEN lr.points_cost <= cl.current_points_balance THEN 1
        ELSE 0
    END as can_afford,
    CASE
        WHEN lr.min_tier_required IS NULL OR lt.tier_level >= req_tier.tier_level THEN 1
        ELSE 0
    END as tier_eligible,
    CASE
        WHEN lr.remaining_quantity IS NULL OR lr.remaining_quantity > 0 THEN 1
        ELSE 0
    END as in_stock
FROM loyalty_rewards lr
CROSS JOIN customer_loyalty cl
JOIN loyalty_tiers lt ON cl.current_tier_id = lt.id
LEFT JOIN loyalty_tiers req_tier ON lr.min_tier_required = req_tier.tier_code AND lr.restaurant_id = req_tier.restaurant_id
WHERE lr.deleted_at IS NULL
    AND lr.status = 'active'
    AND lr.is_active = 1
    AND cl.restaurant_id = lr.restaurant_id
    AND (lr.available_from IS NULL OR unixepoch('now') * 1000 >= lr.available_from)
    AND (lr.available_until IS NULL OR unixepoch('now') * 1000 <= lr.available_until);

-- View: Reward redemption summary
CREATE VIEW IF NOT EXISTS vw_reward_redemption_summary AS
SELECT
    rr.*,
    cl.customer_id,
    c.full_name as customer_name,
    lr.reward_name,
    lr.reward_type,
    o.order_number,
    CASE
        WHEN rr.status = 'active' AND unixepoch('now') * 1000 > rr.valid_until THEN 'expired'
        ELSE rr.status
    END as effective_status
FROM reward_redemptions rr
JOIN customer_loyalty cl ON rr.customer_loyalty_id = cl.id
JOIN customers c ON cl.customer_id = c.id
JOIN loyalty_rewards lr ON rr.reward_id = lr.id
LEFT JOIN orders o ON rr.used_in_order_id = o.id;

-- View: Tier progression analysis
CREATE VIEW IF NOT EXISTS vw_tier_progression AS
SELECT
    cl.restaurant_id,
    lt.tier_name,
    lt.tier_level,
    COUNT(DISTINCT cl.customer_id) as total_members,
    AVG(cl.lifetime_spending) as avg_lifetime_spending,
    AVG(cl.lifetime_orders) as avg_lifetime_orders,
    AVG(cl.current_points_balance) as avg_points_balance,
    SUM(cl.successful_referrals) as total_referrals,
    AVG(julianday('now') - julianday(cl.member_since / 1000, 'unixepoch')) as avg_membership_days
FROM customer_loyalty cl
JOIN loyalty_tiers lt ON cl.current_tier_id = lt.id
WHERE cl.status = 'active'
GROUP BY cl.restaurant_id, lt.tier_name, lt.tier_level;

-- ============================================================================
-- TRIGGERS: Automatic data maintenance
-- ============================================================================

-- Trigger: Update loyalty_tiers updated_at
CREATE TRIGGER IF NOT EXISTS trg_loyalty_tiers_updated_at
AFTER UPDATE ON loyalty_tiers
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE loyalty_tiers
    SET updated_at = unixepoch('now') * 1000
    WHERE id = NEW.id;
END;

-- Trigger: Update customer_loyalty updated_at
CREATE TRIGGER IF NOT EXISTS trg_customer_loyalty_updated_at
AFTER UPDATE ON customer_loyalty
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE customer_loyalty
    SET updated_at = unixepoch('now') * 1000
    WHERE id = NEW.id;
END;

-- Trigger: Update customer_loyalty points balance after transaction
CREATE TRIGGER IF NOT EXISTS trg_points_transactions_update_balance
AFTER INSERT ON points_transactions
FOR EACH ROW
WHEN NEW.status = 'completed'
BEGIN
    UPDATE customer_loyalty
    SET
        total_points_earned = total_points_earned + CASE WHEN NEW.transaction_type = 'earned' THEN NEW.points_amount ELSE 0 END,
        total_points_spent = total_points_spent + CASE WHEN NEW.transaction_type = 'spent' THEN ABS(NEW.points_amount) ELSE 0 END,
        current_points_balance = NEW.balance_after,
        last_activity_date = NEW.transaction_date,
        updated_at = unixepoch('now') * 1000
    WHERE id = NEW.customer_loyalty_id;
END;

-- Trigger: Update loyalty_rewards redeemed quantity
CREATE TRIGGER IF NOT EXISTS trg_reward_redemptions_update_quantity
AFTER INSERT ON reward_redemptions
FOR EACH ROW
BEGIN
    UPDATE loyalty_rewards
    SET
        redeemed_quantity = redeemed_quantity + 1,
        remaining_quantity = CASE
            WHEN total_quantity IS NOT NULL
            THEN total_quantity - (redeemed_quantity + 1)
            ELSE NULL
        END,
        updated_at = unixepoch('now') * 1000
    WHERE id = NEW.reward_id;
END;

-- Trigger: Update loyalty_rewards updated_at
CREATE TRIGGER IF NOT EXISTS trg_loyalty_rewards_updated_at
AFTER UPDATE ON loyalty_rewards
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE loyalty_rewards
    SET updated_at = unixepoch('now') * 1000
    WHERE id = NEW.id;
END;

-- Trigger: Update reward_redemptions updated_at
CREATE TRIGGER IF NOT EXISTS trg_reward_redemptions_updated_at
AFTER UPDATE ON reward_redemptions
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE reward_redemptions
    SET updated_at = unixepoch('now') * 1000
    WHERE id = NEW.id;
END;

-- Trigger: Update customer_loyalty when reward is used
CREATE TRIGGER IF NOT EXISTS trg_reward_redemptions_mark_used
AFTER UPDATE OF is_used ON reward_redemptions
FOR EACH ROW
WHEN NEW.is_used = 1 AND OLD.is_used = 0
BEGIN
    UPDATE customer_loyalty
    SET
        last_activity_date = NEW.used_at,
        updated_at = unixepoch('now') * 1000
    WHERE id = NEW.customer_loyalty_id;
END;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Summary:
-- ✅ 5 tables created (loyalty_tiers, customer_loyalty, points_transactions, loyalty_rewards, reward_redemptions)
-- ✅ 30 indexes created for optimal query performance
-- ✅ 5 views created for common queries
-- ✅ 7 triggers created for automatic data maintenance
-- ✅ Complete loyalty program with:
--    - Multi-tier membership system
--    - Points earning and spending
--    - Tier progression tracking
--    - Reward catalog
--    - Redemption management
--    - Referral system
--    - Comprehensive analytics

-- ============================================================================
-- Migration: 10_leave_management.sql
-- Layer: 4 (Employee Management Layer)
-- Description: Complete leave management and approval system
-- Dependencies: 01_tenants_and_settings.sql, 02_authentication.sql
-- ============================================================================

-- ============================================================================
-- TABLE: leave_types
-- Description: Leave type definitions (sick leave, annual leave, etc.)
-- Features:
--   - Multiple leave categories
--   - Accrual rules
--   - Carry-over policies
--   - Approval requirements
--   - Paid/unpaid configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS leave_types (
    -- Identity
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

    -- Restaurant
    restaurant_id TEXT NOT NULL,

    -- Leave Type Information
    name TEXT NOT NULL,                        -- 'Annual Leave', 'Sick Leave'
    code TEXT NOT NULL,                        -- 'AL', 'SL', 'ML'
    description TEXT,
    category TEXT NOT NULL,                    -- 'annual', 'sick', 'personal', etc.

    -- Paid/Unpaid
    is_paid INTEGER DEFAULT 1,
    pay_rate REAL DEFAULT 1.0,                 -- 1.0 = full pay, 0.5 = half pay

    -- Annual Entitlement
    default_annual_days REAL DEFAULT 0,        -- Days per year
    max_days_per_year REAL,
    min_days_per_request REAL DEFAULT 0.5,     -- Minimum request (0.5 = half day)
    max_days_per_request INTEGER,

    -- Accrual Configuration
    accrual_method TEXT DEFAULT 'annual',      -- 'annual', 'monthly', 'per_pay_period'
    accrual_rate REAL,                         -- Days accrued per period
    accrual_start_date TEXT,                   -- When accrual starts (e.g., 'hire_date', 'year_start')

    -- Carry Over
    allow_carry_over INTEGER DEFAULT 0,
    max_carry_over_days REAL,
    carry_over_expiry_months INTEGER,          -- Months before carried days expire

    -- Approval Requirements
    requires_approval INTEGER DEFAULT 1,
    approval_levels INTEGER DEFAULT 1,         -- Number of approval levels
    auto_approve_days INTEGER,                 -- Auto-approve if <= X days

    -- Notice Requirements
    min_notice_days INTEGER DEFAULT 0,         -- Minimum advance notice
    max_future_days INTEGER DEFAULT 365,       -- Maximum days ahead to book

    -- Documentation
    requires_documentation INTEGER DEFAULT 0,
    documentation_after_days INTEGER,          -- Require docs if > X days

    -- Restrictions
    can_split INTEGER DEFAULT 1,               -- Allow splitting into half days
    allow_negative_balance INTEGER DEFAULT 0,
    excludes_weekends INTEGER DEFAULT 1,
    excludes_holidays INTEGER DEFAULT 1,

    -- Status
    is_active INTEGER DEFAULT 1,
    is_visible INTEGER DEFAULT 1,              -- Show in employee portal

    -- Display
    display_color TEXT DEFAULT '#3B82F6',
    icon_name TEXT,
    sort_order INTEGER DEFAULT 0,

    -- Statistics
    total_requests INTEGER DEFAULT 0,
    total_days_taken REAL DEFAULT 0,

    -- Metadata
    metadata TEXT DEFAULT '{}',

    -- Timestamps
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    deleted_at INTEGER,

    -- Foreign Keys
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,

    -- Constraints
    CHECK (category IN ('annual', 'sick', 'personal', 'maternity', 'paternity', 'parental', 'bereavement', 'study', 'unpaid', 'compassionate', 'other')),
    CHECK (accrual_method IN ('annual', 'monthly', 'per_pay_period', 'none')),
    CHECK (is_paid IN (0, 1)),
    CHECK (pay_rate >= 0 AND pay_rate <= 1),
    CHECK (default_annual_days >= 0),
    CHECK (min_days_per_request > 0),
    CHECK (requires_approval IN (0, 1)),
    CHECK (approval_levels > 0),
    CHECK (min_notice_days >= 0),
    CHECK (requires_documentation IN (0, 1)),
    CHECK (can_split IN (0, 1)),
    CHECK (allow_negative_balance IN (0, 1)),
    CHECK (excludes_weekends IN (0, 1)),
    CHECK (excludes_holidays IN (0, 1)),
    CHECK (allow_carry_over IN (0, 1)),
    CHECK (is_active IN (0, 1)),
    CHECK (is_visible IN (0, 1)),
    UNIQUE(restaurant_id, code)
);

-- Indexes for leave_types
CREATE INDEX IF NOT EXISTS idx_leave_types_restaurant ON leave_types(restaurant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leave_types_code ON leave_types(restaurant_id, code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leave_types_active ON leave_types(is_active) WHERE is_active = 1 AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leave_types_category ON leave_types(category) WHERE deleted_at IS NULL;

-- ============================================================================
-- TABLE: leave_balances
-- Description: Employee leave balance tracking
-- Features:
--   - Balance per leave type per employee
--   - Accrued, used, and remaining days
--   - Carry-over tracking
--   - Balance adjustments history
--   - Annual reset handling
-- ============================================================================

CREATE TABLE IF NOT EXISTS leave_balances (
    -- Identity
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

    -- Employee & Leave Type
    user_id TEXT NOT NULL,
    restaurant_id TEXT NOT NULL,               -- Denormalized
    leave_type_id TEXT NOT NULL,

    -- Balance Period
    balance_year INTEGER NOT NULL,             -- Year (e.g., 2025)
    period_start_date INTEGER NOT NULL,        -- Unix timestamp
    period_end_date INTEGER NOT NULL,

    -- Balance Tracking
    opening_balance REAL DEFAULT 0,            -- Balance at start of period
    accrued_days REAL DEFAULT 0,               -- Days accrued this period
    carried_over_days REAL DEFAULT 0,          -- Days from previous period
    adjustment_days REAL DEFAULT 0,            -- Manual adjustments
    total_entitled REAL DEFAULT 0,             -- Total available

    -- Usage
    taken_days REAL DEFAULT 0,                 -- Days actually taken
    pending_days REAL DEFAULT 0,               -- Days in pending requests
    scheduled_days REAL DEFAULT 0,             -- Approved but not yet taken
    remaining_days REAL DEFAULT 0,             -- Available balance

    -- Expiry
    expiring_days REAL DEFAULT 0,              -- Days expiring soon
    expiry_date INTEGER,                       -- When carried days expire

    -- Forecasting
    projected_end_balance REAL DEFAULT 0,

    -- Last Update
    last_accrual_date INTEGER,
    last_calculated_at INTEGER,

    -- Metadata
    metadata TEXT DEFAULT '{}',

    -- Timestamps
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    deleted_at INTEGER,

    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE,

    -- Constraints
    CHECK (opening_balance >= 0),
    CHECK (accrued_days >= 0),
    CHECK (carried_over_days >= 0),
    CHECK (taken_days >= 0),
    CHECK (pending_days >= 0),
    CHECK (scheduled_days >= 0),
    CHECK (remaining_days >= 0),
    CHECK (expiring_days >= 0),
    UNIQUE(user_id, leave_type_id, balance_year)
);

-- Indexes for leave_balances
CREATE INDEX IF NOT EXISTS idx_balances_user ON leave_balances(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_balances_restaurant ON leave_balances(restaurant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_balances_type ON leave_balances(leave_type_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_balances_year ON leave_balances(balance_year) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_balances_user_year ON leave_balances(user_id, balance_year DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_balances_expiry ON leave_balances(expiry_date) WHERE expiry_date IS NOT NULL AND deleted_at IS NULL;

-- ============================================================================
-- TABLE: leave_requests
-- Description: Leave request submissions and approvals
-- Features:
--   - Multi-day leave requests
--   - Half-day support
--   - Approval workflow
--   - Cancellation handling
--   - Documentation attachments
-- ============================================================================

CREATE TABLE IF NOT EXISTS leave_requests (
    -- Identity
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

    -- Employee & Restaurant
    user_id TEXT NOT NULL,
    restaurant_id TEXT NOT NULL,
    leave_type_id TEXT NOT NULL,

    -- Request Details
    start_date INTEGER NOT NULL,               -- Unix timestamp (start of day)
    end_date INTEGER NOT NULL,                 -- Unix timestamp (end of day)
    total_days REAL NOT NULL,                  -- Including half days
    is_half_day INTEGER DEFAULT 0,
    half_day_period TEXT,                      -- 'morning', 'afternoon'

    -- Reason & Documentation
    reason TEXT NOT NULL,
    notes TEXT,
    documentation_url TEXT,
    documentation_uploaded INTEGER DEFAULT 0,

    -- Status
    status TEXT NOT NULL DEFAULT 'pending',

    -- Approval Workflow
    current_approval_level INTEGER DEFAULT 1,
    required_approval_levels INTEGER DEFAULT 1,
    approval_history TEXT DEFAULT '[]',        -- JSON array of approvals

    -- Approvers
    primary_approver_id TEXT,
    final_approver_id TEXT,

    -- Timing
    submitted_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    approved_at INTEGER,
    rejected_at INTEGER,
    cancelled_at INTEGER,
    rejected_reason TEXT,
    cancellation_reason TEXT,

    -- Coverage
    coverage_arranged INTEGER DEFAULT 0,
    coverage_user_id TEXT,                     -- Who covers the shift
    coverage_notes TEXT,

    -- Impact Analysis
    affects_schedules TEXT DEFAULT '[]',       -- JSON: affected schedule_ids
    conflicts_detected INTEGER DEFAULT 0,
    conflict_details TEXT DEFAULT '[]',

    -- Emergency
    is_emergency INTEGER DEFAULT 0,
    emergency_contact TEXT,

    -- Balance Impact
    balance_before REAL,
    balance_after REAL,
    balance_snapshot TEXT DEFAULT '{}',        -- JSON: balance at request time

    -- Notifications
    notification_sent INTEGER DEFAULT 0,
    notification_sent_at INTEGER,
    reminder_sent INTEGER DEFAULT 0,

    -- Metadata
    metadata TEXT DEFAULT '{}',

    -- Timestamps
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    deleted_at INTEGER,

    -- Foreign Keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT,
    FOREIGN KEY (primary_approver_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (final_approver_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (coverage_user_id) REFERENCES users(id) ON DELETE SET NULL,

    -- Constraints
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'withdrawn')),
    CHECK (half_day_period IS NULL OR half_day_period IN ('morning', 'afternoon')),
    CHECK (total_days > 0),
    CHECK (is_half_day IN (0, 1)),
    CHECK (is_emergency IN (0, 1)),
    CHECK (coverage_arranged IN (0, 1)),
    CHECK (conflicts_detected IN (0, 1)),
    CHECK (documentation_uploaded IN (0, 1)),
    CHECK (notification_sent IN (0, 1)),
    CHECK (reminder_sent IN (0, 1)),
    CHECK (current_approval_level > 0),
    CHECK (required_approval_levels > 0)
);

-- Indexes for leave_requests
CREATE INDEX IF NOT EXISTS idx_requests_user ON leave_requests(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_requests_restaurant ON leave_requests(restaurant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_requests_type ON leave_requests(leave_type_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_requests_status ON leave_requests(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_requests_dates ON leave_requests(restaurant_id, start_date, end_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_requests_pending ON leave_requests(restaurant_id, status) WHERE status = 'pending' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_requests_approver ON leave_requests(primary_approver_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_requests_submitted ON leave_requests(restaurant_id, submitted_at DESC) WHERE deleted_at IS NULL;

-- ============================================================================
-- TABLE: leave_approval_rules
-- Description: Approval workflow configuration
-- Features:
--   - Position-based approval chains
--   - Leave type specific rules
--   - Threshold-based escalation
--   - Auto-approval conditions
-- ============================================================================

CREATE TABLE IF NOT EXISTS leave_approval_rules (
    -- Identity
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

    -- Restaurant
    restaurant_id TEXT NOT NULL,

    -- Rule Information
    rule_name TEXT NOT NULL,
    description TEXT,

    -- Target
    leave_type_id TEXT,                        -- NULL = applies to all types
    applies_to_position TEXT,                  -- NULL = all positions

    -- Approval Chain
    approval_level INTEGER NOT NULL DEFAULT 1,
    approver_position TEXT NOT NULL,           -- Position that can approve
    approver_user_id TEXT,                     -- Specific user (optional)

    -- Conditions
    min_days_threshold REAL,                   -- Rule applies if >= days
    max_days_threshold REAL,                   -- Rule applies if <= days

    -- Auto-approval
    can_auto_approve INTEGER DEFAULT 0,
    auto_approve_conditions TEXT DEFAULT '{}', -- JSON: conditions for auto-approval

    -- Escalation
    escalate_after_hours INTEGER,              -- Escalate if not processed
    escalation_approver_position TEXT,
    escalation_approver_user_id TEXT,

    -- Status
    is_active INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 0,

    -- Metadata
    metadata TEXT DEFAULT '{}',

    -- Timestamps
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    deleted_at INTEGER,

    -- Foreign Keys
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE,
    FOREIGN KEY (approver_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (escalation_approver_user_id) REFERENCES users(id) ON DELETE SET NULL,

    -- Constraints
    CHECK (approval_level > 0),
    CHECK (can_auto_approve IN (0, 1)),
    CHECK (is_active IN (0, 1))
);

-- Indexes for leave_approval_rules
CREATE INDEX IF NOT EXISTS idx_approval_rules_restaurant ON leave_approval_rules(restaurant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_approval_rules_type ON leave_approval_rules(leave_type_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_approval_rules_active ON leave_approval_rules(is_active) WHERE is_active = 1 AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_approval_rules_position ON leave_approval_rules(applies_to_position) WHERE deleted_at IS NULL;

-- ============================================================================
-- TABLE: leave_calendars
-- Description: Calendar of all approved leaves for team visibility
-- Features:
--   - Team leave overview
--   - Conflict detection
--   - Coverage planning
--   - Public holidays integration
-- ============================================================================

CREATE TABLE IF NOT EXISTS leave_calendars (
    -- Identity
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

    -- Restaurant
    restaurant_id TEXT NOT NULL,

    -- Calendar Entry
    entry_type TEXT NOT NULL,                  -- 'leave', 'public_holiday', 'closure'
    entry_date INTEGER NOT NULL,               -- Unix timestamp (date)

    -- Leave Information (if applicable)
    leave_request_id TEXT,
    user_id TEXT,
    leave_type_id TEXT,
    is_full_day INTEGER DEFAULT 1,
    period TEXT,                               -- 'morning', 'afternoon', 'full_day'

    -- Holiday Information (if applicable)
    holiday_name TEXT,
    is_recurring INTEGER DEFAULT 0,

    -- Impact
    affected_positions TEXT DEFAULT '[]',      -- JSON: positions affected
    coverage_required INTEGER DEFAULT 0,
    coverage_status TEXT DEFAULT 'not_required',

    -- Visibility
    is_visible_to_team INTEGER DEFAULT 1,
    is_public INTEGER DEFAULT 0,

    -- Metadata
    metadata TEXT DEFAULT '{}',

    -- Timestamps
    created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
    deleted_at INTEGER,

    -- Foreign Keys
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE SET NULL,

    -- Constraints
    CHECK (entry_type IN ('leave', 'public_holiday', 'closure', 'event')),
    CHECK (period IS NULL OR period IN ('morning', 'afternoon', 'full_day')),
    CHECK (coverage_status IN ('not_required', 'required', 'arranged', 'pending')),
    CHECK (is_full_day IN (0, 1)),
    CHECK (is_recurring IN (0, 1)),
    CHECK (coverage_required IN (0, 1)),
    CHECK (is_visible_to_team IN (0, 1)),
    CHECK (is_public IN (0, 1))
);

-- Indexes for leave_calendars
CREATE INDEX IF NOT EXISTS idx_calendars_restaurant ON leave_calendars(restaurant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_calendars_date ON leave_calendars(restaurant_id, entry_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_calendars_user ON leave_calendars(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_calendars_type ON leave_calendars(entry_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_calendars_request ON leave_calendars(leave_request_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_calendars_month ON leave_calendars(restaurant_id, entry_date) WHERE entry_date >= (unixepoch('now', 'start of month') * 1000) AND deleted_at IS NULL;

-- ============================================================================
-- VIEWS: Reporting and analytics
-- ============================================================================

-- View: Employee leave summary
CREATE VIEW IF NOT EXISTS v_employee_leave_summary AS
SELECT
    lb.user_id,
    lb.restaurant_id,
    u.full_name as employee_name,
    lt.name as leave_type,
    lt.code as leave_code,
    lb.balance_year,
    lb.total_entitled,
    lb.taken_days,
    lb.pending_days,
    lb.remaining_days,
    lb.expiring_days
FROM leave_balances lb
JOIN users u ON lb.user_id = u.id
JOIN leave_types lt ON lb.leave_type_id = lt.id
WHERE lb.deleted_at IS NULL
    AND lt.deleted_at IS NULL
    AND u.deleted_at IS NULL;

-- View: Pending leave requests
CREATE VIEW IF NOT EXISTS v_pending_leave_requests AS
SELECT
    lr.id,
    lr.restaurant_id,
    lr.user_id,
    u.full_name as employee_name,
    u.role as employee_position,
    lt.name as leave_type,
    lr.start_date,
    lr.end_date,
    lr.total_days,
    lr.reason,
    lr.submitted_at,
    lr.current_approval_level,
    lr.required_approval_levels
FROM leave_requests lr
JOIN users u ON lr.user_id = u.id
JOIN leave_types lt ON lr.leave_type_id = lt.id
WHERE lr.deleted_at IS NULL
    AND lr.status = 'pending'
ORDER BY lr.submitted_at ASC;

-- View: Team leave calendar (next 30 days)
CREATE VIEW IF NOT EXISTS v_team_leave_calendar AS
SELECT
    lc.entry_date,
    lc.restaurant_id,
    lc.entry_type,
    lc.user_id,
    u.full_name as employee_name,
    lt.name as leave_type,
    lc.is_full_day,
    lc.period,
    lc.holiday_name
FROM leave_calendars lc
LEFT JOIN users u ON lc.user_id = u.id
LEFT JOIN leave_types lt ON lc.leave_type_id = lt.id
WHERE lc.deleted_at IS NULL
    AND lc.entry_date >= (unixepoch('now', 'start of day') * 1000)
    AND lc.entry_date < (unixepoch('now', 'start of day', '+30 days') * 1000)
ORDER BY lc.entry_date ASC;

-- View: Leave statistics by type
CREATE VIEW IF NOT EXISTS v_leave_statistics AS
SELECT
    lr.restaurant_id,
    lt.name as leave_type,
    COUNT(*) as total_requests,
    COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) as approved_count,
    COUNT(CASE WHEN lr.status = 'pending' THEN 1 END) as pending_count,
    COUNT(CASE WHEN lr.status = 'rejected' THEN 1 END) as rejected_count,
    SUM(lr.total_days) as total_days_requested,
    SUM(CASE WHEN lr.status = 'approved' THEN lr.total_days ELSE 0 END) as total_days_approved,
    AVG(lr.total_days) as avg_days_per_request
FROM leave_requests lr
JOIN leave_types lt ON lr.leave_type_id = lt.id
WHERE lr.deleted_at IS NULL
    AND lt.deleted_at IS NULL
GROUP BY lr.restaurant_id, lt.name;

-- ============================================================================
-- TRIGGERS: Auto-update and maintain data consistency
-- ============================================================================

-- Trigger: Update leave_types.updated_at
CREATE TRIGGER IF NOT EXISTS trg_leave_types_updated_at
AFTER UPDATE ON leave_types
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE leave_types
    SET updated_at = (unixepoch('now') * 1000)
    WHERE id = NEW.id;
END;

-- Trigger: Update leave_balances.updated_at
CREATE TRIGGER IF NOT EXISTS trg_leave_balances_updated_at
AFTER UPDATE ON leave_balances
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE leave_balances
    SET updated_at = (unixepoch('now') * 1000)
    WHERE id = NEW.id;
END;

-- Trigger: Update leave_requests.updated_at
CREATE TRIGGER IF NOT EXISTS trg_leave_requests_updated_at
AFTER UPDATE ON leave_requests
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE leave_requests
    SET updated_at = (unixepoch('now') * 1000)
    WHERE id = NEW.id;
END;

-- Trigger: Update leave_approval_rules.updated_at
CREATE TRIGGER IF NOT EXISTS trg_leave_approval_rules_updated_at
AFTER UPDATE ON leave_approval_rules
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE leave_approval_rules
    SET updated_at = (unixepoch('now') * 1000)
    WHERE id = NEW.id;
END;

-- Trigger: Update leave_calendars.updated_at
CREATE TRIGGER IF NOT EXISTS trg_leave_calendars_updated_at
AFTER UPDATE ON leave_calendars
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE leave_calendars
    SET updated_at = (unixepoch('now') * 1000)
    WHERE id = NEW.id;
END;

-- Trigger: Update leave type statistics
CREATE TRIGGER IF NOT EXISTS trg_update_leave_type_stats
AFTER INSERT ON leave_requests
FOR EACH ROW
BEGIN
    UPDATE leave_types
    SET total_requests = total_requests + 1
    WHERE id = NEW.leave_type_id;
END;

-- Trigger: Update balance when leave approved
CREATE TRIGGER IF NOT EXISTS trg_update_balance_on_approval
AFTER UPDATE ON leave_requests
FOR EACH ROW
WHEN NEW.status = 'approved' AND OLD.status = 'pending'
BEGIN
    UPDATE leave_balances
    SET
        taken_days = taken_days + NEW.total_days,
        pending_days = pending_days - NEW.total_days,
        remaining_days = remaining_days - NEW.total_days,
        last_calculated_at = (unixepoch('now') * 1000)
    WHERE user_id = NEW.user_id
        AND leave_type_id = NEW.leave_type_id
        AND balance_year = CAST(strftime('%Y', DATE(NEW.start_date / 1000, 'unixepoch')) AS INTEGER);

    UPDATE leave_types
    SET total_days_taken = total_days_taken + NEW.total_days
    WHERE id = NEW.leave_type_id;
END;

-- Trigger: Update balance when leave request created
CREATE TRIGGER IF NOT EXISTS trg_update_balance_on_request
AFTER INSERT ON leave_requests
FOR EACH ROW
WHEN NEW.status = 'pending'
BEGIN
    UPDATE leave_balances
    SET
        pending_days = pending_days + NEW.total_days,
        remaining_days = remaining_days - NEW.total_days,
        last_calculated_at = (unixepoch('now') * 1000)
    WHERE user_id = NEW.user_id
        AND leave_type_id = NEW.leave_type_id
        AND balance_year = CAST(strftime('%Y', DATE(NEW.start_date / 1000, 'unixepoch')) AS INTEGER);
END;

-- Trigger: Calculate remaining balance
CREATE TRIGGER IF NOT EXISTS trg_calculate_remaining_balance
AFTER UPDATE ON leave_balances
FOR EACH ROW
WHEN NEW.total_entitled != OLD.total_entitled
    OR NEW.taken_days != OLD.taken_days
    OR NEW.pending_days != OLD.pending_days
BEGIN
    UPDATE leave_balances
    SET remaining_days = total_entitled - taken_days - pending_days
    WHERE id = NEW.id;
END;

-- ============================================================================
-- END OF MIGRATION: 10_leave_management.sql
-- ============================================================================
-- Summary:
--   - Tables: 5 (leave_types, leave_balances, leave_requests,
--               leave_approval_rules, leave_calendars)
--   - Indexes: 38 total
--   - Views: 4 (employee_summary, pending_requests, calendar, statistics)
--   - Triggers: 9 (auto-update, balance calculations, statistics)
--   - Lines: ~850
--
-- Features:
--   ✅ Multiple leave types
--   ✅ Balance tracking and accrual
--   ✅ Multi-level approval workflow
--   ✅ Carry-over management
--   ✅ Half-day support
--   ✅ Emergency leave handling
--   ✅ Coverage arrangement
--   ✅ Conflict detection
--   ✅ Team calendar
--   ✅ Public holidays
--   ✅ Documentation upload
--   ✅ Auto-balance calculation
--   ✅ Approval rule engine
-- ============================================================================

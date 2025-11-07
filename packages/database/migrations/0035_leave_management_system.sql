-- =====================================================
-- Migration: Leave Management System
-- Version: 0035
-- Date: 2025-10-26
-- Description: Complete leave management system with Taiwan labor law compliance
-- =====================================================

-- =====================================================
-- 1. Leave Types Table
-- =====================================================
CREATE TABLE IF NOT EXISTS leave_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Basic information
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,

    -- Accrual rules
    default_days_per_year INTEGER NOT NULL DEFAULT 0,
    accrual_type TEXT NOT NULL DEFAULT 'yearly',
    max_carryover_days INTEGER DEFAULT 0,

    -- Usage rules
    requires_approval INTEGER NOT NULL DEFAULT 1,
    approval_levels INTEGER DEFAULT 1,
    min_notice_days INTEGER DEFAULT 0,
    max_days_per_request INTEGER,
    allow_half_day INTEGER NOT NULL DEFAULT 1,

    -- Payment and deduction
    is_paid INTEGER NOT NULL DEFAULT 1,
    affects_attendance INTEGER NOT NULL DEFAULT 0,
    allow_carryover INTEGER NOT NULL DEFAULT 0,
    requires_documentation INTEGER NOT NULL DEFAULT 0,

    -- Applicability
    applies_to_roles TEXT DEFAULT '[]',
    gender_restriction TEXT,

    -- Display settings
    color_code TEXT DEFAULT '#3B82F6',
    icon TEXT,
    sort_order INTEGER DEFAULT 0,

    -- Status
    is_active INTEGER NOT NULL DEFAULT 1,
    is_system_type INTEGER NOT NULL DEFAULT 0,

    -- Audit fields
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

    -- Constraints
    CHECK (accrual_type IN ('yearly', 'monthly', 'none')),
    CHECK (approval_levels > 0),
    CHECK (min_notice_days >= 0),
    CHECK (gender_restriction IS NULL OR gender_restriction IN ('male', 'female'))
);

CREATE INDEX IF NOT EXISTS leave_types_code_idx ON leave_types(code);
CREATE INDEX IF NOT EXISTS leave_types_is_active_idx ON leave_types(is_active);
CREATE INDEX IF NOT EXISTS leave_types_is_system_type_idx ON leave_types(is_system_type);

-- =====================================================
-- 2. Employee Leave Balances Table
-- =====================================================
CREATE TABLE IF NOT EXISTS employee_leave_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    leave_type_id INTEGER NOT NULL,
    restaurant_id INTEGER NOT NULL,

    -- Year information
    year INTEGER NOT NULL,

    -- Balance tracking (in days)
    total_days REAL NOT NULL DEFAULT 0,
    used_days REAL NOT NULL DEFAULT 0,
    pending_days REAL NOT NULL DEFAULT 0,
    remaining_days REAL GENERATED ALWAYS AS (total_days - used_days - pending_days) VIRTUAL,

    -- Carryover information
    carryover_from_previous REAL DEFAULT 0,
    carryover_to_next REAL DEFAULT 0,
    carryover_expires_at INTEGER,

    -- Manual adjustments
    manual_adjustment REAL DEFAULT 0,
    adjustment_reason TEXT,
    adjusted_by INTEGER,
    adjusted_at INTEGER,

    -- Audit fields
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    last_updated_by INTEGER,

    -- Foreign keys
    FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (adjusted_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (last_updated_by) REFERENCES users(id) ON DELETE SET NULL,

    -- Unique constraint
    UNIQUE(employee_id, leave_type_id, year),

    -- Check constraints
    CHECK (total_days >= 0),
    CHECK (used_days >= 0),
    CHECK (pending_days >= 0)
);

CREATE INDEX IF NOT EXISTS employee_leave_balances_employee_id_idx ON employee_leave_balances(employee_id);
CREATE INDEX IF NOT EXISTS employee_leave_balances_leave_type_id_idx ON employee_leave_balances(leave_type_id);
CREATE INDEX IF NOT EXISTS employee_leave_balances_restaurant_id_idx ON employee_leave_balances(restaurant_id);
CREATE INDEX IF NOT EXISTS employee_leave_balances_year_idx ON employee_leave_balances(year);
CREATE INDEX IF NOT EXISTS employee_leave_balances_employee_year_idx ON employee_leave_balances(employee_id, year);

-- =====================================================
-- 3. Leave Requests Table
-- =====================================================
CREATE TABLE IF NOT EXISTS leave_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    leave_type_id INTEGER NOT NULL,
    restaurant_id INTEGER NOT NULL,

    -- Leave dates
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    start_period TEXT NOT NULL DEFAULT 'full',
    end_period TEXT NOT NULL DEFAULT 'full',
    days_count REAL NOT NULL,

    -- Request content
    reason TEXT NOT NULL,
    attachments TEXT DEFAULT '[]',

    -- Status management
    status TEXT NOT NULL DEFAULT 'pending',

    -- Approval workflow (JSON)
    approval_chain TEXT DEFAULT '[]',
    current_approval_level INTEGER DEFAULT 0,
    required_approval_levels INTEGER NOT NULL DEFAULT 1,

    -- Approval results
    final_approver_id INTEGER,
    final_approved_at INTEGER,
    rejection_reason TEXT,

    -- Cancellation
    cancelled_by INTEGER,
    cancelled_at INTEGER,
    cancellation_reason TEXT,

    -- Schedule integration
    affects_schedules TEXT DEFAULT '[]',
    schedule_conflicts_resolved INTEGER DEFAULT 0,

    -- Notes
    notes TEXT,
    admin_notes TEXT,

    -- Audit fields
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    submitted_at INTEGER,

    -- Foreign keys
    FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (final_approver_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL,

    -- Check constraints
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'withdrawn')),
    CHECK (start_period IN ('full', 'am', 'pm')),
    CHECK (end_period IN ('full', 'am', 'pm')),
    CHECK (days_count > 0),
    CHECK (current_approval_level >= 0),
    CHECK (date(start_date) <= date(end_date))
);

CREATE INDEX IF NOT EXISTS leave_requests_employee_id_idx ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS leave_requests_leave_type_id_idx ON leave_requests(leave_type_id);
CREATE INDEX IF NOT EXISTS leave_requests_restaurant_id_idx ON leave_requests(restaurant_id);
CREATE INDEX IF NOT EXISTS leave_requests_status_idx ON leave_requests(status);
CREATE INDEX IF NOT EXISTS leave_requests_start_date_idx ON leave_requests(start_date);
CREATE INDEX IF NOT EXISTS leave_requests_end_date_idx ON leave_requests(end_date);
CREATE INDEX IF NOT EXISTS leave_requests_employee_status_idx ON leave_requests(employee_id, status);
CREATE INDEX IF NOT EXISTS leave_requests_restaurant_status_idx ON leave_requests(restaurant_id, status);

-- =====================================================
-- 4. Leave Approval Rules Table
-- =====================================================
CREATE TABLE IF NOT EXISTS leave_approval_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    leave_type_id INTEGER,

    -- Rule information
    rule_name TEXT NOT NULL,
    description TEXT,

    -- Approval level settings
    approval_level INTEGER NOT NULL,
    approver_role TEXT,
    approver_user_id INTEGER,

    -- Conditions (JSON)
    conditions TEXT DEFAULT '{}',

    -- Auto approval settings
    auto_approve_enabled INTEGER DEFAULT 0,
    auto_approve_conditions TEXT DEFAULT '{}',
    auto_escalate_hours INTEGER,

    -- Notification settings
    notify_on_submit INTEGER DEFAULT 1,
    notify_on_approve INTEGER DEFAULT 1,
    notify_on_reject INTEGER DEFAULT 1,

    -- Priority
    priority INTEGER DEFAULT 0,

    -- Status
    is_active INTEGER NOT NULL DEFAULT 1,

    -- Audit fields
    created_by INTEGER,
    updated_by INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

    -- Foreign keys
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE,
    FOREIGN KEY (approver_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,

    -- Check constraints
    CHECK (approval_level > 0),
    CHECK (priority >= 0)
);

CREATE INDEX IF NOT EXISTS leave_approval_rules_restaurant_id_idx ON leave_approval_rules(restaurant_id);
CREATE INDEX IF NOT EXISTS leave_approval_rules_leave_type_id_idx ON leave_approval_rules(leave_type_id);
CREATE INDEX IF NOT EXISTS leave_approval_rules_approval_level_idx ON leave_approval_rules(approval_level);
CREATE INDEX IF NOT EXISTS leave_approval_rules_is_active_idx ON leave_approval_rules(is_active);

-- =====================================================
-- 5. Leave Calendar Events Table
-- =====================================================
CREATE TABLE IF NOT EXISTS leave_calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Event information
    event_type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,

    -- Date information
    event_date TEXT NOT NULL,
    year INTEGER NOT NULL,
    is_recurring INTEGER NOT NULL DEFAULT 0,

    -- Applicability
    restaurant_id INTEGER,
    applies_to_all INTEGER NOT NULL DEFAULT 1,

    -- Compensatory information
    is_compensatory INTEGER NOT NULL DEFAULT 0,
    compensates_for_date TEXT,

    -- Status
    is_active INTEGER NOT NULL DEFAULT 1,

    -- Audit fields
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

    -- Foreign keys
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,

    -- Check constraints
    CHECK (event_type IN ('public_holiday', 'company_holiday', 'special'))
);

CREATE INDEX IF NOT EXISTS leave_calendar_events_event_date_idx ON leave_calendar_events(event_date);
CREATE INDEX IF NOT EXISTS leave_calendar_events_year_idx ON leave_calendar_events(year);
CREATE INDEX IF NOT EXISTS leave_calendar_events_restaurant_id_idx ON leave_calendar_events(restaurant_id);
CREATE INDEX IF NOT EXISTS leave_calendar_events_event_type_idx ON leave_calendar_events(event_type);
CREATE INDEX IF NOT EXISTS leave_calendar_events_is_active_idx ON leave_calendar_events(is_active);

-- =====================================================
-- TRIGGERS: Auto-update updated_at
-- =====================================================

CREATE TRIGGER IF NOT EXISTS leave_types_updated_at
AFTER UPDATE ON leave_types
FOR EACH ROW
BEGIN
    UPDATE leave_types SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS employee_leave_balances_updated_at
AFTER UPDATE ON employee_leave_balances
FOR EACH ROW
BEGIN
    UPDATE employee_leave_balances SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS leave_requests_updated_at
AFTER UPDATE ON leave_requests
FOR EACH ROW
BEGIN
    UPDATE leave_requests SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS leave_approval_rules_updated_at
AFTER UPDATE ON leave_approval_rules
FOR EACH ROW
BEGIN
    UPDATE leave_approval_rules SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS leave_calendar_events_updated_at
AFTER UPDATE ON leave_calendar_events
FOR EACH ROW
BEGIN
    UPDATE leave_calendar_events SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

-- =====================================================
-- VIEWS: Common queries
-- =====================================================

-- View 1: Current year leave balances
CREATE VIEW IF NOT EXISTS current_year_leave_balances AS
SELECT
    elb.employee_id,
    u.full_name AS employee_name,
    elb.restaurant_id,
    lt.code AS leave_type_code,
    lt.name AS leave_type_name,
    lt.color_code,
    elb.year,
    elb.total_days,
    elb.used_days,
    elb.pending_days,
    elb.remaining_days,
    lt.is_paid,
    lt.allow_carryover
FROM employee_leave_balances elb
JOIN leave_types lt ON elb.leave_type_id = lt.id
JOIN users u ON elb.employee_id = u.id
WHERE elb.year = strftime('%Y', 'now')
    AND lt.is_active = 1;

-- View 2: Pending leave requests
CREATE VIEW IF NOT EXISTS pending_leave_requests AS
SELECT
    lr.id,
    lr.employee_id,
    u.full_name AS employee_name,
    lr.restaurant_id,
    lt.code AS leave_type_code,
    lt.name AS leave_type_name,
    lr.start_date,
    lr.end_date,
    lr.days_count,
    lr.reason,
    lr.current_approval_level,
    lr.required_approval_levels,
    lr.created_at,
    CASE
        WHEN lr.current_approval_level = 0 THEN 'pending_initial'
        WHEN lr.current_approval_level < lr.required_approval_levels THEN 'pending_intermediate'
        WHEN lr.current_approval_level = lr.required_approval_levels THEN 'pending_final'
        ELSE 'unknown'
    END AS approval_stage
FROM leave_requests lr
JOIN leave_types lt ON lr.leave_type_id = lt.id
JOIN users u ON lr.employee_id = u.id
WHERE lr.status = 'pending';

-- View 3: Monthly leave statistics
CREATE VIEW IF NOT EXISTS monthly_leave_statistics AS
SELECT
    lr.restaurant_id,
    lr.leave_type_id,
    lt.name AS leave_type_name,
    strftime('%Y-%m', lr.start_date) AS month,
    COUNT(lr.id) AS total_requests,
    COUNT(CASE WHEN lr.status = 'approved' THEN 1 END) AS approved_requests,
    COUNT(CASE WHEN lr.status = 'rejected' THEN 1 END) AS rejected_requests,
    COUNT(CASE WHEN lr.status = 'pending' THEN 1 END) AS pending_requests,
    SUM(CASE WHEN lr.status = 'approved' THEN lr.days_count ELSE 0 END) AS total_approved_days,
    COUNT(DISTINCT lr.employee_id) AS unique_employees
FROM leave_requests lr
JOIN leave_types lt ON lr.leave_type_id = lt.id
WHERE lr.start_date >= date('now', 'start of month')
    AND lr.start_date < date('now', 'start of month', '+1 month')
GROUP BY lr.restaurant_id, lr.leave_type_id, strftime('%Y-%m', lr.start_date);

-- =====================================================
-- Default Leave Types (Taiwan Labor Law Compliant)
-- =====================================================

-- 1. Annual Leave
INSERT OR IGNORE INTO leave_types (
    code, name, description,
    default_days_per_year, accrual_type,
    requires_approval, approval_levels, min_notice_days,
    is_paid, allow_carryover, max_carryover_days,
    color_code, sort_order, is_active, is_system_type
) VALUES (
    'ANNUAL',
    'Annual Leave',
    'Taiwan Labor Standards Act Article 38: Annual leave based on years of service',
    7,
    'yearly',
    1, 1, 3,
    1, 1, 7,
    '#10B981',
    1, 1, 1
);

-- 2. Sick Leave
INSERT OR IGNORE INTO leave_types (
    code, name, description,
    default_days_per_year, accrual_type,
    requires_approval, approval_levels, min_notice_days,
    is_paid, requires_documentation,
    color_code, sort_order, is_active, is_system_type
) VALUES (
    'SICK',
    'Sick Leave',
    'Taiwan Labor Standards Act Article 43: Maximum 30 days per year',
    30,
    'yearly',
    1, 1, 0,
    1, 1,
    '#EF4444',
    2, 1, 1
);

-- 3. Personal Leave
INSERT OR IGNORE INTO leave_types (
    code, name, description,
    default_days_per_year, accrual_type,
    requires_approval, approval_levels, min_notice_days,
    is_paid, max_days_per_request,
    color_code, sort_order, is_active, is_system_type
) VALUES (
    'PERSONAL',
    'Personal Leave',
    'Taiwan Labor Standards Act Article 43: Maximum 14 days per year, unpaid',
    14,
    'yearly',
    1, 1, 1,
    0, 14,
    '#F59E0B',
    3, 1, 1
);

-- 4. Marriage Leave
INSERT OR IGNORE INTO leave_types (
    code, name, description,
    default_days_per_year, accrual_type,
    requires_approval, approval_levels, min_notice_days,
    is_paid, requires_documentation,
    color_code, sort_order, is_active, is_system_type
) VALUES (
    'MARRIAGE',
    'Marriage Leave',
    'Labor Leave Regulations Article 2: 8 days for marriage, paid',
    8,
    'none',
    1, 1, 7,
    1, 1,
    '#EC4899',
    4, 1, 1
);

-- 5. Bereavement Leave
INSERT OR IGNORE INTO leave_types (
    code, name, description,
    default_days_per_year, accrual_type,
    requires_approval, approval_levels, min_notice_days,
    is_paid, requires_documentation,
    color_code, sort_order, is_active, is_system_type
) VALUES (
    'BEREAVEMENT',
    'Bereavement Leave',
    'Labor Leave Regulations Article 3: Based on relationship, paid',
    1,
    'none',
    1, 1, 0,
    1, 1,
    '#6B7280',
    5, 1, 1
);

-- 6. Maternity Leave
INSERT OR IGNORE INTO leave_types (
    code, name, description,
    default_days_per_year, accrual_type,
    requires_approval, approval_levels, min_notice_days,
    is_paid, requires_documentation,
    gender_restriction,
    color_code, sort_order, is_active, is_system_type
) VALUES (
    'MATERNITY',
    'Maternity Leave',
    'Gender Equality Act Article 15: 8 weeks for childbirth, paid',
    56,
    'none',
    1, 1, 14,
    1, 1,
    'female',
    '#EC4899',
    6, 1, 1
);

-- 7. Paternity Leave
INSERT OR IGNORE INTO leave_types (
    code, name, description,
    default_days_per_year, accrual_type,
    requires_approval, approval_levels, min_notice_days,
    is_paid, requires_documentation,
    gender_restriction,
    color_code, sort_order, is_active, is_system_type
) VALUES (
    'PATERNITY',
    'Paternity Leave',
    'Gender Equality Act Article 15: 7 days for spouse childbirth, paid',
    7,
    'none',
    1, 1, 3,
    1, 1,
    'male',
    '#8B5CF6',
    7, 1, 1
);

-- 8. Family Care Leave
INSERT OR IGNORE INTO leave_types (
    code, name, description,
    default_days_per_year, accrual_type,
    requires_approval, approval_levels, min_notice_days,
    is_paid,
    color_code, sort_order, is_active, is_system_type
) VALUES (
    'FAMILY_CARE',
    'Family Care Leave',
    'Gender Equality Act Article 20: 7 days per year, unpaid',
    7,
    'yearly',
    1, 1, 1,
    0,
    '#14B8A6',
    8, 1, 1
);

-- 9. Official Leave
INSERT OR IGNORE INTO leave_types (
    code, name, description,
    default_days_per_year, accrual_type,
    requires_approval, approval_levels, min_notice_days,
    is_paid, requires_documentation,
    color_code, sort_order, is_active, is_system_type
) VALUES (
    'OFFICIAL',
    'Official Leave',
    'Labor Leave Regulations Article 8: For official duties, paid',
    1,
    'none',
    1, 1, 3,
    1, 1,
    '#0EA5E9',
    9, 1, 1
);

-- 10. Menstrual Leave
INSERT OR IGNORE INTO leave_types (
    code, name, description,
    default_days_per_year, accrual_type,
    requires_approval, approval_levels, min_notice_days,
    is_paid, allow_half_day,
    gender_restriction,
    color_code, sort_order, is_active, is_system_type
) VALUES (
    'MENSTRUAL',
    'Menstrual Leave',
    'Gender Equality Act Article 14: 1 day per month, first 3 days unpaid',
    12,
    'yearly',
    1, 1, 0,
    1, 1,
    'female',
    '#F472B6',
    10, 1, 1
);

-- =====================================================
-- 2025 Taiwan Public Holidays
-- =====================================================

-- New Year Day
INSERT OR IGNORE INTO leave_calendar_events (
    event_type, name, description, event_date, year, is_recurring, is_active
) VALUES (
    'public_holiday', 'New Year Day', 'January 1st', '2025-01-01', 2025, 1, 1
);

-- Lunar New Year (7 days)
INSERT OR IGNORE INTO leave_calendar_events (
    event_type, name, description, event_date, year, is_recurring, is_active
) VALUES
    ('public_holiday', 'Lunar New Year Eve', 'Chinese New Year Eve', '2025-01-28', 2025, 0, 1),
    ('public_holiday', 'Lunar New Year Day 1', 'First Day of Chinese New Year', '2025-01-29', 2025, 0, 1),
    ('public_holiday', 'Lunar New Year Day 2', 'Second Day of Chinese New Year', '2025-01-30', 2025, 0, 1),
    ('public_holiday', 'Lunar New Year Day 3', 'Third Day of Chinese New Year', '2025-01-31', 2025, 0, 1),
    ('public_holiday', 'Lunar New Year Holiday', 'Extended Holiday', '2025-02-01', 2025, 0, 1),
    ('public_holiday', 'Lunar New Year Holiday', 'Extended Holiday', '2025-02-02', 2025, 0, 1),
    ('public_holiday', 'Lunar New Year Holiday', 'Extended Holiday', '2025-02-03', 2025, 0, 1);

-- Peace Memorial Day
INSERT OR IGNORE INTO leave_calendar_events (
    event_type, name, description, event_date, year, is_recurring, is_active
) VALUES (
    'public_holiday', 'Peace Memorial Day', '228 Memorial Day', '2025-02-28', 2025, 1, 1
);

-- Tomb Sweeping Day (4 days)
INSERT OR IGNORE INTO leave_calendar_events (
    event_type, name, description, event_date, year, is_recurring, is_active
) VALUES
    ('public_holiday', 'Children Day', 'Children Day', '2025-04-04', 2025, 1, 1),
    ('public_holiday', 'Tomb Sweeping Day', 'Qingming Festival', '2025-04-05', 2025, 0, 1),
    ('public_holiday', 'Tomb Sweeping Holiday', 'Extended Holiday', '2025-04-06', 2025, 0, 1),
    ('public_holiday', 'Tomb Sweeping Holiday', 'Extended Holiday', '2025-04-07', 2025, 0, 1);

-- Labor Day
INSERT OR IGNORE INTO leave_calendar_events (
    event_type, name, description, event_date, year, is_recurring, is_active
) VALUES (
    'public_holiday', 'Labor Day', 'May 1st Labor Day', '2025-05-01', 2025, 1, 1
);

-- Dragon Boat Festival (3 days)
INSERT OR IGNORE INTO leave_calendar_events (
    event_type, name, description, event_date, year, is_recurring, is_active
) VALUES
    ('public_holiday', 'Dragon Boat Festival', 'Duanwu Festival', '2025-05-31', 2025, 0, 1),
    ('public_holiday', 'Dragon Boat Holiday', 'Extended Holiday', '2025-06-01', 2025, 0, 1),
    ('public_holiday', 'Dragon Boat Holiday', 'Extended Holiday', '2025-06-02', 2025, 0, 1);

-- Mid-Autumn Festival (3 days)
INSERT OR IGNORE INTO leave_calendar_events (
    event_type, name, description, event_date, year, is_recurring, is_active
) VALUES
    ('public_holiday', 'Mid-Autumn Festival', 'Moon Festival', '2025-10-06', 2025, 0, 1),
    ('public_holiday', 'Mid-Autumn Holiday', 'Extended Holiday', '2025-10-07', 2025, 0, 1),
    ('public_holiday', 'Mid-Autumn Holiday', 'Extended Holiday', '2025-10-08', 2025, 0, 1);

-- National Day (3 days)
INSERT OR IGNORE INTO leave_calendar_events (
    event_type, name, description, event_date, year, is_recurring, is_active
) VALUES
    ('public_holiday', 'National Day', 'Double Tenth Day', '2025-10-10', 2025, 1, 1),
    ('public_holiday', 'National Day Holiday', 'Extended Holiday', '2025-10-11', 2025, 0, 1),
    ('public_holiday', 'National Day Holiday', 'Extended Holiday', '2025-10-12', 2025, 0, 1);

-- =====================================================
-- Migration Complete
-- =====================================================
-- Leave Management System created successfully
-- Includes:
--   1. Leave Types Management (10 Taiwan labor law types)
--   2. Employee Leave Balance Tracking
--   3. Leave Request Workflow
--   4. Approval Rules Engine
--   5. Leave Calendar (2025 Taiwan public holidays)
--   6. Common Query Views (3)
--   7. Auto-update Triggers (5)
-- =====================================================

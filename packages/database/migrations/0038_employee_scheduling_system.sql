-- =====================================================
-- Migration: 員工排班系統
-- Version: 0034
-- Date: 2025-10-10
-- Description: 實現完整的員工排班管理系統，支持班別範本、排班規則、衝突檢測、換班申請等功能
-- =====================================================

-- 禁用外鍵約束
PRAGMA foreign_keys=OFF;

-- =====================================================
-- 1. 班別範本表 (Shift Templates)
-- =====================================================
CREATE TABLE IF NOT EXISTS shift_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,

    -- 班別基本資訊
    name TEXT NOT NULL,                          -- 班別名稱：早班、午班、晚班等
    description TEXT,                            -- 班別說明
    shift_type TEXT NOT NULL DEFAULT 'regular',  -- 班別類型：regular, split, overnight

    -- 時間設定
    start_time TEXT NOT NULL,                    -- 開始時間 (HH:MM)
    end_time TEXT NOT NULL,                      -- 結束時間 (HH:MM)
    duration_minutes INTEGER NOT NULL,           -- 時長（分鐘）

    -- 分段班次設定
    is_split_shift INTEGER NOT NULL DEFAULT 0,  -- 是否為分段班次
    break_start_time TEXT,                       -- 休息開始時間 (HH:MM)
    break_end_time TEXT,                         -- 休息結束時間 (HH:MM)
    break_duration_minutes INTEGER DEFAULT 0,    -- 休息時長（分鐘）

    -- 適用設定
    applicable_days TEXT DEFAULT '[]',           -- JSON陣列：[1,2,3,4,5] (週一到週五)
    min_employees INTEGER DEFAULT 1,             -- 最少員工數
    max_employees INTEGER DEFAULT 10,            -- 最多員工數

    -- 薪資設定
    hourly_rate REAL,                            -- 時薪
    overtime_multiplier REAL DEFAULT 1.5,        -- 加班倍率

    -- 顯示設定
    color_code TEXT DEFAULT '#3B82F6',           -- 顏色代碼（六位元HEX）
    icon TEXT,                                   -- 圖示代碼
    sort_order INTEGER DEFAULT 0,                -- 排序順序

    -- 狀態
    is_active INTEGER NOT NULL DEFAULT 1,        -- 是否啟用

    -- 審計欄位
    created_by TEXT,                          -- 建立者ID
    updated_by TEXT,                          -- 更新者ID
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

    -- 外鍵約束
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,

    -- 檢查約束
    CHECK (shift_type IN ('regular', 'split', 'overnight')),
    CHECK (duration_minutes > 0),
    CHECK (min_employees > 0),
    CHECK (max_employees >= min_employees),
    CHECK (overtime_multiplier >= 1.0)
);

-- 班別範本索引
CREATE INDEX IF NOT EXISTS shift_templates_restaurant_id_idx ON shift_templates(restaurant_id);
CREATE INDEX IF NOT EXISTS shift_templates_is_active_idx ON shift_templates(is_active);
CREATE INDEX IF NOT EXISTS shift_templates_shift_type_idx ON shift_templates(shift_type);
CREATE INDEX IF NOT EXISTS shift_templates_restaurant_active_idx ON shift_templates(restaurant_id, is_active);

-- =====================================================
-- 2. 員工排班表 (Employee Schedules)
-- =====================================================
CREATE TABLE IF NOT EXISTS employee_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    employee_id TEXT NOT NULL,
    shift_template_id INTEGER,

    -- 排班基本資訊
    work_date TEXT NOT NULL,                     -- 工作日期 (YYYY-MM-DD)
    actual_start_time TEXT,                      -- 實際開始時間 (HH:MM)
    actual_end_time TEXT,                        -- 實際結束時間 (HH:MM)

    -- 狀態管理
    status TEXT NOT NULL DEFAULT 'scheduled',    -- scheduled, confirmed, completed, cancelled, no_show

    -- 實際工時追蹤
    clock_in_time INTEGER,                       -- 打卡上班時間（Unix timestamp）
    clock_out_time INTEGER,                      -- 打卡下班時間（Unix timestamp）
    actual_work_minutes INTEGER,                 -- 實際工作時長（分鐘）
    break_minutes INTEGER DEFAULT 0,             -- 休息時間（分鐘）
    overtime_minutes INTEGER DEFAULT 0,          -- 加班時長（分鐘）

    -- 備註與附加資訊
    notes TEXT,                                  -- 備註
    position TEXT,                               -- 職位：chef, server, cashier等
    location TEXT,                               -- 工作地點（若有多個分店）

    -- 確認與審批
    confirmed_by TEXT,                        -- 確認者ID
    confirmed_at INTEGER,                        -- 確認時間

    -- 審計欄位
    created_by TEXT,                          -- 建立者ID
    updated_by TEXT,                          -- 更新者ID
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

    -- 外鍵約束
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (shift_template_id) REFERENCES shift_templates(id) ON DELETE SET NULL,
    FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,

    -- 檢查約束
    CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
    CHECK (actual_work_minutes >= 0 OR actual_work_minutes IS NULL),
    CHECK (break_minutes >= 0),
    CHECK (overtime_minutes >= 0)
);

-- 員工排班索引
CREATE INDEX IF NOT EXISTS employee_schedules_restaurant_id_idx ON employee_schedules(restaurant_id);
CREATE INDEX IF NOT EXISTS employee_schedules_employee_id_idx ON employee_schedules(employee_id);
CREATE INDEX IF NOT EXISTS employee_schedules_work_date_idx ON employee_schedules(work_date);
CREATE INDEX IF NOT EXISTS employee_schedules_status_idx ON employee_schedules(status);
CREATE INDEX IF NOT EXISTS employee_schedules_shift_template_id_idx ON employee_schedules(shift_template_id);
CREATE INDEX IF NOT EXISTS employee_schedules_restaurant_date_idx ON employee_schedules(restaurant_id, work_date);
CREATE INDEX IF NOT EXISTS employee_schedules_employee_date_idx ON employee_schedules(employee_id, work_date);

-- =====================================================
-- 3. 排班規則表 (Scheduling Rules)
-- =====================================================
CREATE TABLE IF NOT EXISTS scheduling_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,

    -- 規則基本資訊
    rule_name TEXT NOT NULL,                     -- 規則名稱
    rule_type TEXT NOT NULL,                     -- 規則類型
    description TEXT,                            -- 規則說明

    -- 規則設定（JSON格式）
    rule_config TEXT NOT NULL DEFAULT '{}',      -- 規則配置（JSON）

    -- 優先級與嚴重性
    priority INTEGER NOT NULL DEFAULT 0,         -- 優先級（數字越大越優先）
    severity TEXT NOT NULL DEFAULT 'warning',    -- error, warning, info

    -- 適用範圍
    applies_to_roles TEXT DEFAULT '[]',          -- JSON陣列：適用角色
    applies_to_employees TEXT DEFAULT '[]',      -- JSON陣列：適用員工ID

    -- 狀態
    is_active INTEGER NOT NULL DEFAULT 1,        -- 是否啟用
    is_system_rule INTEGER NOT NULL DEFAULT 0,   -- 是否為系統內建規則

    -- 審計欄位
    created_by TEXT,
    updated_by TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

    -- 外鍵約束
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,

    -- 檢查約束
    CHECK (rule_type IN ('max_hours_per_day', 'max_hours_per_week', 'min_rest_period',
                         'max_consecutive_days', 'skill_requirement', 'availability_check')),
    CHECK (severity IN ('error', 'warning', 'info')),
    CHECK (priority >= 0)
);

-- 排班規則索引
CREATE INDEX IF NOT EXISTS scheduling_rules_restaurant_id_idx ON scheduling_rules(restaurant_id);
CREATE INDEX IF NOT EXISTS scheduling_rules_rule_type_idx ON scheduling_rules(rule_type);
CREATE INDEX IF NOT EXISTS scheduling_rules_is_active_idx ON scheduling_rules(is_active);
CREATE INDEX IF NOT EXISTS scheduling_rules_restaurant_active_idx ON scheduling_rules(restaurant_id, is_active);

-- =====================================================
-- 4. 排班衝突表 (Scheduling Conflicts)
-- =====================================================
CREATE TABLE IF NOT EXISTS scheduling_conflicts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,

    -- 衝突基本資訊
    conflict_type TEXT NOT NULL,                 -- 衝突類型
    severity TEXT NOT NULL,                      -- error, warning, info
    conflict_message TEXT NOT NULL,              -- 衝突說明

    -- 關聯資訊
    schedule_ids TEXT NOT NULL,                  -- JSON陣列：相關排班ID
    employee_ids TEXT NOT NULL,                  -- JSON陣列：相關員工ID
    rule_id INTEGER,                             -- 觸發的規則ID

    -- 衝突詳細資訊（JSON格式）
    conflict_details TEXT DEFAULT '{}',          -- 衝突詳細資訊

    -- 解決狀態
    status TEXT NOT NULL DEFAULT 'unresolved',   -- unresolved, acknowledged, resolved, ignored
    resolved_by TEXT,                         -- 解決者ID
    resolved_at INTEGER,                         -- 解決時間
    resolution_notes TEXT,                       -- 解決備註

    -- 審計欄位
    detected_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

    -- 外鍵約束
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (rule_id) REFERENCES scheduling_rules(id) ON DELETE SET NULL,
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,

    -- 檢查約束
    CHECK (conflict_type IN ('overlapping_shifts', 'rest_period', 'max_hours',
                            'consecutive_days', 'skill_mismatch', 'leave_conflict')),
    CHECK (severity IN ('error', 'warning', 'info')),
    CHECK (status IN ('unresolved', 'acknowledged', 'resolved', 'ignored'))
);

-- 排班衝突索引
CREATE INDEX IF NOT EXISTS scheduling_conflicts_restaurant_id_idx ON scheduling_conflicts(restaurant_id);
CREATE INDEX IF NOT EXISTS scheduling_conflicts_status_idx ON scheduling_conflicts(status);
CREATE INDEX IF NOT EXISTS scheduling_conflicts_severity_idx ON scheduling_conflicts(severity);
CREATE INDEX IF NOT EXISTS scheduling_conflicts_conflict_type_idx ON scheduling_conflicts(conflict_type);
CREATE INDEX IF NOT EXISTS scheduling_conflicts_detected_at_idx ON scheduling_conflicts(detected_at);

-- =====================================================
-- 5. 換班申請表 (Schedule Swap Requests)
-- =====================================================
CREATE TABLE IF NOT EXISTS schedule_swap_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,

    -- 申請基本資訊
    requester_id INTEGER NOT NULL,               -- 申請人ID
    requester_schedule_id INTEGER NOT NULL,      -- 申請人排班ID

    -- 交換對象
    target_employee_id TEXT,                  -- 目標員工ID（可為空，表示徵求）
    target_schedule_id INTEGER,                  -- 目標排班ID（可為空）

    -- 申請內容
    reason TEXT NOT NULL,                        -- 換班原因
    request_type TEXT NOT NULL DEFAULT 'swap',   -- swap, cover, drop

    -- 審批流程
    status TEXT NOT NULL DEFAULT 'pending',      -- pending, accepted, rejected, cancelled, approved, completed
    target_response TEXT,                        -- 目標員工回應
    target_responded_at INTEGER,                 -- 目標員工回應時間

    -- 管理審批
    approved_by TEXT,                         -- 審批者ID
    approved_at INTEGER,                         -- 審批時間
    approval_notes TEXT,                         -- 審批備註

    -- 完成狀態
    completed_at INTEGER,                        -- 完成時間

    -- 審計欄位
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    expires_at INTEGER,                          -- 申請過期時間

    -- 外鍵約束
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (requester_schedule_id) REFERENCES employee_schedules(id) ON DELETE CASCADE,
    FOREIGN KEY (target_employee_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (target_schedule_id) REFERENCES employee_schedules(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,

    -- 檢查約束
    CHECK (request_type IN ('swap', 'cover', 'drop')),
    CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'approved', 'completed'))
);

-- 換班申請索引
CREATE INDEX IF NOT EXISTS schedule_swap_requests_restaurant_id_idx ON schedule_swap_requests(restaurant_id);
CREATE INDEX IF NOT EXISTS schedule_swap_requests_requester_id_idx ON schedule_swap_requests(requester_id);
CREATE INDEX IF NOT EXISTS schedule_swap_requests_target_employee_id_idx ON schedule_swap_requests(target_employee_id);
CREATE INDEX IF NOT EXISTS schedule_swap_requests_status_idx ON schedule_swap_requests(status);
CREATE INDEX IF NOT EXISTS schedule_swap_requests_created_at_idx ON schedule_swap_requests(created_at);

-- =====================================================
-- 6. 員工可用時段表 (Employee Availability)
-- =====================================================
CREATE TABLE IF NOT EXISTS employee_availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    employee_id TEXT NOT NULL,

    -- 可用性類型
    availability_type TEXT NOT NULL DEFAULT 'preferred',  -- preferred, unavailable, flexible

    -- 時間設定
    day_of_week INTEGER,                         -- 星期幾（0=週日, 1=週一, ..., 6=週六）
    start_date TEXT,                             -- 開始日期（YYYY-MM-DD，用於特定日期）
    end_date TEXT,                               -- 結束日期（YYYY-MM-DD）
    start_time TEXT,                             -- 開始時間（HH:MM）
    end_time TEXT,                               -- 結束時間（HH:MM）

    -- 是否為重複設定
    is_recurring INTEGER NOT NULL DEFAULT 1,     -- 是否重複（每週）

    -- 備註
    notes TEXT,                                  -- 備註說明

    -- 狀態
    is_active INTEGER NOT NULL DEFAULT 1,        -- 是否啟用

    -- 審計欄位
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

    -- 外鍵約束
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,

    -- 檢查約束
    CHECK (availability_type IN ('preferred', 'unavailable', 'flexible')),
    CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6))
);

-- 員工可用時段索引
CREATE INDEX IF NOT EXISTS employee_availability_restaurant_id_idx ON employee_availability(restaurant_id);
CREATE INDEX IF NOT EXISTS employee_availability_employee_id_idx ON employee_availability(employee_id);
CREATE INDEX IF NOT EXISTS employee_availability_day_of_week_idx ON employee_availability(day_of_week);
CREATE INDEX IF NOT EXISTS employee_availability_is_active_idx ON employee_availability(is_active);
CREATE INDEX IF NOT EXISTS employee_availability_employee_active_idx ON employee_availability(employee_id, is_active);

-- =====================================================
-- TRIGGERS: 自動更新 updated_at
-- =====================================================

-- Shift Templates
CREATE TRIGGER IF NOT EXISTS shift_templates_updated_at
AFTER UPDATE ON shift_templates
FOR EACH ROW
BEGIN
    UPDATE shift_templates SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

-- Employee Schedules
CREATE TRIGGER IF NOT EXISTS employee_schedules_updated_at
AFTER UPDATE ON employee_schedules
FOR EACH ROW
BEGIN
    UPDATE employee_schedules SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

-- Scheduling Rules
CREATE TRIGGER IF NOT EXISTS scheduling_rules_updated_at
AFTER UPDATE ON scheduling_rules
FOR EACH ROW
BEGIN
    UPDATE scheduling_rules SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

-- Scheduling Conflicts
CREATE TRIGGER IF NOT EXISTS scheduling_conflicts_updated_at
AFTER UPDATE ON scheduling_conflicts
FOR EACH ROW
BEGIN
    UPDATE scheduling_conflicts SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

-- Schedule Swap Requests
CREATE TRIGGER IF NOT EXISTS schedule_swap_requests_updated_at
AFTER UPDATE ON schedule_swap_requests
FOR EACH ROW
BEGIN
    UPDATE schedule_swap_requests SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

-- Employee Availability
CREATE TRIGGER IF NOT EXISTS employee_availability_updated_at
AFTER UPDATE ON employee_availability
FOR EACH ROW
BEGIN
    UPDATE employee_availability SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

-- =====================================================
-- VIEWS: 常用查詢視圖
-- =====================================================

-- 視圖1：每週排班摘要
CREATE VIEW IF NOT EXISTS weekly_schedule_summary AS
SELECT
    es.restaurant_id,
    es.work_date,
    strftime('%W', es.work_date) AS week_number,
    strftime('%Y', es.work_date) AS year,
    COUNT(DISTINCT es.employee_id) AS total_employees,
    COUNT(es.id) AS total_shifts,
    SUM(st.duration_minutes) AS total_scheduled_minutes,
    COUNT(CASE WHEN es.status = 'confirmed' THEN 1 END) AS confirmed_shifts,
    COUNT(CASE WHEN es.status = 'completed' THEN 1 END) AS completed_shifts,
    COUNT(CASE WHEN es.status = 'cancelled' THEN 1 END) AS cancelled_shifts
FROM employee_schedules es
LEFT JOIN shift_templates st ON es.shift_template_id = st.id
WHERE es.status != 'cancelled'
GROUP BY es.restaurant_id, strftime('%Y-%W', es.work_date);

-- 視圖2：每日人力配置
CREATE VIEW IF NOT EXISTS daily_staffing_coverage AS
SELECT
    es.restaurant_id,
    es.work_date,
    st.shift_type,
    st.name AS shift_name,
    COUNT(es.id) AS scheduled_count,
    st.min_employees,
    st.max_employees,
    CASE
        WHEN COUNT(es.id) < st.min_employees THEN 'understaffed'
        WHEN COUNT(es.id) > st.max_employees THEN 'overstaffed'
        ELSE 'optimal'
    END AS staffing_status
FROM employee_schedules es
JOIN shift_templates st ON es.shift_template_id = st.id
WHERE es.status IN ('scheduled', 'confirmed')
    AND st.is_active = 1
GROUP BY es.restaurant_id, es.work_date, st.id;

-- 視圖3：未解決衝突彙總
CREATE VIEW IF NOT EXISTS active_conflicts_view AS
SELECT
    sc.restaurant_id,
    sc.conflict_type,
    sc.severity,
    COUNT(sc.id) AS conflict_count,
    MIN(sc.detected_at) AS earliest_conflict,
    MAX(sc.detected_at) AS latest_conflict
FROM scheduling_conflicts sc
WHERE sc.status = 'unresolved'
GROUP BY sc.restaurant_id, sc.conflict_type, sc.severity;

-- 視圖4：員工工時統計（本週）
CREATE VIEW IF NOT EXISTS employee_weekly_hours AS
SELECT
    es.employee_id,
    es.restaurant_id,
    u.name AS employee_name,
    strftime('%Y-%W', es.work_date) AS year_week,
    COUNT(es.id) AS shifts_count,
    SUM(CASE WHEN es.actual_work_minutes IS NOT NULL
        THEN es.actual_work_minutes
        ELSE st.duration_minutes
    END) / 60.0 AS total_hours,
    SUM(es.overtime_minutes) / 60.0 AS overtime_hours,
    COUNT(CASE WHEN es.status = 'no_show' THEN 1 END) AS no_show_count
FROM employee_schedules es
LEFT JOIN shift_templates st ON es.shift_template_id = st.id
LEFT JOIN users u ON es.employee_id = u.id
WHERE es.status IN ('confirmed', 'completed', 'no_show')
GROUP BY es.employee_id, strftime('%Y-%W', es.work_date);

-- 視圖5：待處理換班申請
CREATE VIEW IF NOT EXISTS pending_swap_requests AS
SELECT
    ssr.id,
    ssr.restaurant_id,
    ssr.request_type,
    u1.name AS requester_name,
    u2.name AS target_name,
    es.work_date,
    st.name AS shift_name,
    ssr.reason,
    ssr.status,
    ssr.created_at,
    ssr.expires_at,
    CASE
        WHEN ssr.expires_at IS NOT NULL AND ssr.expires_at < strftime('%s', 'now')
        THEN 1 ELSE 0
    END AS is_expired
FROM schedule_swap_requests ssr
JOIN users u1 ON ssr.requester_id = u1.id
LEFT JOIN users u2 ON ssr.target_employee_id = u2.id
JOIN employee_schedules es ON ssr.requester_schedule_id = es.id
LEFT JOIN shift_templates st ON es.shift_template_id = st.id
WHERE ssr.status IN ('pending', 'accepted');

-- =====================================================
-- 預設系統規則
-- =====================================================

-- 規則1：每日最大工時（勞基法：一般工作日不得超過12小時）
INSERT OR IGNORE INTO scheduling_rules (
    restaurant_id, rule_name, rule_type, description,
    rule_config, priority, severity, is_system_rule, is_active
) VALUES (
    0,  -- 預設值，各餐廳可覆蓋
    '每日最大工時限制',
    'max_hours_per_day',
    '依據勞動基準法，每日正常工作時間加延長工時不得超過12小時',
    '{"max_hours": 12, "include_overtime": true}',
    100,
    'error',
    1,
    1
);

-- 規則2：每週最大工時（勞基法：每週工作總時數不得超過40小時，含延長工時不超過46小時）
INSERT OR IGNORE INTO scheduling_rules (
    restaurant_id, rule_name, rule_type, description,
    rule_config, priority, severity, is_system_rule, is_active
) VALUES (
    0,
    '每週最大工時限制',
    'max_hours_per_week',
    '依據勞動基準法，每週正常工作時間不得超過40小時',
    '{"max_hours": 40, "max_with_overtime": 46}',
    90,
    'error',
    1,
    1
);

-- 規則3：最短休息時間（勞基法：兩次工作之間至少應有連續11小時之休息時間）
INSERT OR IGNORE INTO scheduling_rules (
    restaurant_id, rule_name, rule_type, description,
    rule_config, priority, severity, is_system_rule, is_active
) VALUES (
    0,
    '最短休息時間',
    'min_rest_period',
    '依據勞動基準法，勞工繼續工作4小時，至少應有30分鐘之休息。兩次工作之間至少應有連續11小時之休息時間',
    '{"min_rest_hours": 11}',
    95,
    'error',
    1,
    1
);

-- 規則4：連續工作天數限制（勞基法：每7日中應有2日之休息，其中1日為例假，1日為休息日）
INSERT OR IGNORE INTO scheduling_rules (
    restaurant_id, rule_name, rule_type, description,
    rule_config, priority, severity, is_system_rule, is_active
) VALUES (
    0,
    '連續工作天數限制',
    'max_consecutive_days',
    '依據勞動基準法，勞工每7日中應有2日之休息',
    '{"max_consecutive_days": 6, "required_rest_days_per_week": 2}',
    85,
    'error',
    1,
    1
);

-- =====================================================
-- 預設班別範本（範例）
-- =====================================================

-- 早班範本
INSERT OR IGNORE INTO shift_templates (
    restaurant_id, name, description, shift_type,
    start_time, end_time, duration_minutes,
    applicable_days, min_employees, max_employees,
    color_code, sort_order, is_active
) VALUES (
    0,  -- 預設值，各餐廳可自行建立
    '早班',
    '早班：負責開店準備、早午市營運',
    'regular',
    '08:00', '16:00', 480,
    '[1,2,3,4,5,6,0]',  -- 每天
    2, 5,
    '#10B981',  -- 綠色
    1, 1
);

-- 午班範本
INSERT OR IGNORE INTO shift_templates (
    restaurant_id, name, description, shift_type,
    start_time, end_time, duration_minutes,
    applicable_days, min_employees, max_employees,
    color_code, sort_order, is_active
) VALUES (
    0,
    '午班',
    '午班：午市高峰時段',
    'regular',
    '11:00', '15:00', 240,
    '[1,2,3,4,5,6,0]',
    3, 6,
    '#F59E0B',  -- 橘色
    2, 1
);

-- 晚班範本
INSERT OR IGNORE INTO shift_templates (
    restaurant_id, name, description, shift_type,
    start_time, end_time, duration_minutes,
    applicable_days, min_employees, max_employees,
    color_code, sort_order, is_active
) VALUES (
    0,
    '晚班',
    '晚班：晚市營運、打烊清潔',
    'regular',
    '16:00', '22:00', 360,
    '[1,2,3,4,5,6,0]',
    2, 5,
    '#3B82F6',  -- 藍色
    3, 1
);

-- 全日班範本
INSERT OR IGNORE INTO shift_templates (
    restaurant_id, name, description, shift_type,
    start_time, end_time, duration_minutes,
    is_split_shift, break_start_time, break_end_time, break_duration_minutes,
    applicable_days, min_employees, max_employees,
    color_code, sort_order, is_active
) VALUES (
    0,
    '全日班',
    '全日班：含中間休息時段',
    'split',
    '09:00', '21:00', 660,  -- 11小時（扣除2小時休息=9小時實際工時）
    1, '14:00', '16:00', 120,  -- 14:00-16:00 休息2小時
    '[1,2,3,4,5,6,0]',
    1, 3,
    '#8B5CF6',  -- 紫色
    4, 1
);

-- =====================================================
-- Migration 完成
-- =====================================================
-- 員工排班系統已建立完成
-- 包含：
--   1. 班別範本管理（shift_templates）
--   2. 員工排班（employee_schedules）
--   3. 排班規則引擎（scheduling_rules）
--   4. 衝突檢測（scheduling_conflicts）
--   5. 換班申請流程（schedule_swap_requests）
--   6. 員工可用時段（employee_availability）
--   7. 常用查詢視圖（5個）
--   8. 自動更新觸發器（6個）
--   9. 預設系統規則（4個，符合台灣勞基法）
--  10. 預設班別範本（4個範例）
--
-- 下一步：
--   - 實作排班API服務
--   - 建立排班管理UI介面
--   - 整合排休系統（Migration 0035）
-- =====================================================

-- 重新啟用外鍵約束
PRAGMA foreign_keys=ON;

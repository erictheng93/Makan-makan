# Leave Management System Implementation Guide

**Version**: 1.0
**Date**: 2025-10-10
**Status**: 📋 Design Document

---

## Overview

The Leave Management System provides comprehensive time-off management for restaurant employees. This system handles leave requests, approval workflows, balance tracking, and integration with the scheduling system to ensure proper coverage.

### Key Features

- ✅ **Multiple Leave Types**: Annual leave, sick leave, personal leave, special leave, maternity/paternity leave
- ✅ **Leave Balance Tracking**: Automatic calculation of remaining leave days per employee
- ✅ **Approval Workflow**: Multi-level approval with configurable rules
- ✅ **Schedule Integration**: Automatic conflict detection with work schedules
- ✅ **Leave Calendar**: Visual overview of team availability
- ✅ **Automated Notifications**: Real-time updates for all stakeholders
- ✅ **Compliance Support**: Labor law compliance with audit trails
- ✅ **Mobile-Friendly**: Submit and approve requests on mobile devices

### Business Requirements

**From**: HR Management Requirements & Labor Law Compliance

**Stakeholders**:

- Employees (Submit requests, view balances)
- Managers (Approve/reject requests, view team calendar)
- HR/Owners (Configure leave policies, generate reports)

---

## Architecture

### Database Schema

#### Tables

##### `leave_types` - Leave Type Definitions

Defines different types of leave available in the system.

```sql
CREATE TABLE leave_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER,                  -- NULL for system-wide types

    -- Type Information
    code TEXT NOT NULL UNIQUE,              -- "ANNUAL", "SICK", "PERSONAL", etc.
    name TEXT NOT NULL,
    description TEXT,

    -- Allocation Rules
    default_days_per_year INTEGER NOT NULL DEFAULT 0,
    max_days_per_year INTEGER,
    min_service_months INTEGER DEFAULT 0,   -- Minimum employment duration

    -- Accrual Settings
    accrual_type TEXT NOT NULL DEFAULT 'yearly'
        CHECK (accrual_type IN ('yearly', 'monthly', 'per_service_year', 'manual')),
    accrual_rate REAL,                      -- For monthly accrual (e.g., 1.25 days/month)

    -- Usage Rules
    min_notice_days INTEGER DEFAULT 0,      -- Minimum advance notice required
    max_consecutive_days INTEGER,           -- Maximum consecutive days allowed
    requires_documentation INTEGER NOT NULL DEFAULT 0,
    can_be_negative INTEGER NOT NULL DEFAULT 0,  -- Allow negative balance

    -- Carry-over Rules
    allow_carryover INTEGER NOT NULL DEFAULT 0,
    max_carryover_days INTEGER DEFAULT 0,
    carryover_expires_months INTEGER,       -- Carryover days expire after N months

    -- Approval Settings
    requires_approval INTEGER NOT NULL DEFAULT 1,
    approval_levels INTEGER DEFAULT 1,      -- Number of approval levels
    auto_approve_threshold_days INTEGER,    -- Auto-approve if <= threshold

    -- Payment
    is_paid INTEGER NOT NULL DEFAULT 1,
    payment_percentage REAL DEFAULT 100.0,  -- Percentage of regular pay

    -- Display & Status
    color_code TEXT DEFAULT '#3B82F6',      -- Color for calendar display
    icon_name TEXT,                         -- Icon identifier
    display_order INTEGER DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_system_defined INTEGER NOT NULL DEFAULT 0,  -- Cannot be deleted

    -- Metadata
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
```

**Default Leave Types**:

```sql
-- Annual Leave (年假)
INSERT INTO leave_types (code, name, default_days_per_year, accrual_type, allow_carryover, max_carryover_days, color_code, is_system_defined)
VALUES ('ANNUAL', '年假 (Annual Leave)', 7, 'yearly', 1, 7, '#10B981', 1);

-- Sick Leave (病假)
INSERT INTO leave_types (code, name, default_days_per_year, requires_documentation, can_be_negative, color_code, is_system_defined)
VALUES ('SICK', '病假 (Sick Leave)', 30, 1, 1, '#EF4444', 1);

-- Personal Leave (事假)
INSERT INTO leave_types (code, name, default_days_per_year, is_paid, min_notice_days, color_code, is_system_defined)
VALUES ('PERSONAL', '事假 (Personal Leave)', 14, 0, 3, '#F59E0B', 1);

-- Maternity Leave (產假)
INSERT INTO leave_types (code, name, default_days_per_year, max_consecutive_days, requires_documentation, color_code, is_system_defined)
VALUES ('MATERNITY', '產假 (Maternity Leave)', 56, 56, 1, '#EC4899', 1);

-- Paternity Leave (陪產假)
INSERT INTO leave_types (code, name, default_days_per_year, max_consecutive_days, color_code, is_system_defined)
VALUES ('PATERNITY', '陪產假 (Paternity Leave)', 5, 5, '#8B5CF6', 1);

-- Special Leave (特休)
INSERT INTO leave_types (code, name, accrual_type, min_service_months, color_code, is_system_defined)
VALUES ('SPECIAL', '特休 (Special Leave)', 'per_service_year', 6, '#06B6D4', 1);
```

---

##### `employee_leave_balances` - Leave Balance Tracking

Tracks available leave days for each employee per year.

```sql
CREATE TABLE employee_leave_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    leave_type_id INTEGER NOT NULL,
    year INTEGER NOT NULL,

    -- Balance Tracking
    total_days REAL NOT NULL DEFAULT 0,         -- Total allocated days
    used_days REAL NOT NULL DEFAULT 0,          -- Used days (approved)
    pending_days REAL NOT NULL DEFAULT 0,       -- Days in pending requests
    remaining_days REAL GENERATED ALWAYS AS (total_days - used_days - pending_days) VIRTUAL,

    -- Carryover from Previous Year
    carryover_days REAL DEFAULT 0,
    carryover_expires_at INTEGER,               -- Timestamp when carryover expires

    -- Accrual Tracking (for monthly accrual)
    accrued_days REAL DEFAULT 0,                -- Days accrued so far this year
    last_accrual_date TEXT,                     -- Last accrual calculation date

    -- Manual Adjustments
    adjustment_days REAL DEFAULT 0,             -- Manual additions/deductions
    adjustment_reason TEXT,
    adjusted_by INTEGER,
    adjusted_at INTEGER,

    -- Metadata
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

    FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE,
    FOREIGN KEY (adjusted_by) REFERENCES users(id) ON DELETE SET NULL,

    UNIQUE(employee_id, leave_type_id, year)
);
```

---

##### `leave_requests` - Leave Request Records

Stores all leave requests submitted by employees.

```sql
CREATE TABLE leave_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    leave_type_id INTEGER NOT NULL,

    -- Request Details
    start_date TEXT NOT NULL,               -- "YYYY-MM-DD"
    end_date TEXT NOT NULL,                 -- "YYYY-MM-DD"
    days_count REAL NOT NULL,               -- Total days (can be 0.5 for half-day)
    half_day_type TEXT
        CHECK (half_day_type IN (NULL, 'morning', 'afternoon')),

    -- Reason & Documentation
    reason TEXT NOT NULL,
    description TEXT,
    attachment_urls TEXT,                   -- JSON array of document URLs

    -- Status & Workflow
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'cancelled', 'withdrawn')),

    current_approval_level INTEGER DEFAULT 1,
    required_approval_levels INTEGER DEFAULT 1,

    -- Approval Chain (JSON)
    approval_chain TEXT DEFAULT '[]',
    /*
    [
      {
        "level": 1,
        "approverId": 5,
        "approverName": "Manager Name",
        "status": "approved",
        "comment": "Approved",
        "timestamp": 1234567890
      }
    ]
    */

    -- Final Decision
    final_approved_by INTEGER,
    final_approved_at INTEGER,
    final_rejected_by INTEGER,
    final_rejected_at INTEGER,
    rejection_reason TEXT,

    -- Impact Analysis
    conflicts_with_schedules TEXT,          -- JSON array of schedule IDs
    replacement_assigned INTEGER,           -- Replacement employee ID
    coverage_status TEXT DEFAULT 'pending'
        CHECK (coverage_status IN ('pending', 'covered', 'not_required', 'uncovered')),

    -- Cancellation
    cancelled_by INTEGER,
    cancelled_at INTEGER,
    cancellation_reason TEXT,

    -- Emergency Leave
    is_emergency INTEGER NOT NULL DEFAULT 0,
    emergency_contact TEXT,

    -- Notifications
    employee_notified_at INTEGER,
    manager_notified_at INTEGER,

    -- Metadata
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    submitted_at INTEGER,

    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT,
    FOREIGN KEY (final_approved_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (final_rejected_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (replacement_assigned) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL
);
```

---

##### `leave_approval_rules` - Approval Workflow Configuration

Defines who can approve leave requests based on conditions.

```sql
CREATE TABLE leave_approval_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,

    -- Rule Configuration
    rule_name TEXT NOT NULL,
    description TEXT,

    -- Approval Hierarchy
    approval_level INTEGER NOT NULL DEFAULT 1,
    approver_role INTEGER,                  -- User role (1=Owner, etc.)
    approver_user_ids TEXT,                 -- JSON array of specific user IDs

    -- Conditions (all must match)
    leave_type_codes TEXT,                  -- JSON array: ["ANNUAL", "SICK"]
    min_days REAL,                          -- Min days to trigger this rule
    max_days REAL,                          -- Max days for this rule
    employee_roles TEXT,                    -- JSON array of employee roles

    -- Approval Settings
    requires_all_approvers INTEGER NOT NULL DEFAULT 0,  -- All listed or just one
    can_delegate INTEGER NOT NULL DEFAULT 1,
    max_approval_hours INTEGER DEFAULT 48,  -- Auto-escalate after N hours
    escalate_to_user_id INTEGER,

    -- Auto-Approval
    auto_approve_conditions TEXT,           -- JSON conditions for auto-approval

    -- Priority & Status
    priority INTEGER DEFAULT 0,             -- Higher = checked first
    is_active INTEGER NOT NULL DEFAULT 1,

    -- Metadata
    created_by INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (escalate_to_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
```

**Example Rules**:

```sql
-- Level 1: Direct Manager Approval (for 1-3 days)
INSERT INTO leave_approval_rules (restaurant_id, rule_name, approval_level, approver_role, max_days)
VALUES (1, 'Manager Approval - Short Leave', 1, 1, 3);

-- Level 2: Owner Approval (for 4+ days)
INSERT INTO leave_approval_rules (restaurant_id, rule_name, approval_level, approver_role, min_days)
VALUES (1, 'Owner Approval - Extended Leave', 2, 1, 4);

-- Auto-Approve: 1 day sick leave with documentation
INSERT INTO leave_approval_rules (
    restaurant_id, rule_name, leave_type_codes, max_days,
    auto_approve_conditions
)
VALUES (
    1, 'Auto-Approve Short Sick Leave', '["SICK"]', 1,
    '{"requires_documentation": true}'
);
```

---

##### `leave_calendar_events` - Public Holidays & Company Events

Tracks public holidays and company-wide events that affect leave planning.

```sql
CREATE TABLE leave_calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER,                  -- NULL for national holidays

    -- Event Details
    event_type TEXT NOT NULL DEFAULT 'public_holiday'
        CHECK (event_type IN ('public_holiday', 'company_holiday', 'busy_period', 'blackout_date')),

    name TEXT NOT NULL,
    description TEXT,

    -- Date Range
    event_date TEXT NOT NULL,               -- "YYYY-MM-DD"
    end_date TEXT,                          -- For multi-day events
    is_recurring INTEGER NOT NULL DEFAULT 0,
    recurrence_rule TEXT,                   -- JSON: {"frequency": "yearly", "month": 1, "day": 1}

    -- Impact on Leave
    blocks_leave_requests INTEGER NOT NULL DEFAULT 0,
    requires_premium_pay INTEGER NOT NULL DEFAULT 0,
    premium_pay_multiplier REAL DEFAULT 1.0,

    -- Settings
    is_active INTEGER NOT NULL DEFAULT 1,
    applies_to_roles TEXT,                  -- JSON array of roles or NULL for all

    -- Metadata
    created_by INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
```

**Taiwan Public Holidays (2025)**:

```sql
INSERT INTO leave_calendar_events (event_type, name, event_date, is_recurring)
VALUES
    ('public_holiday', '元旦 (New Year)', '2025-01-01', 1),
    ('public_holiday', '春節 (Chinese New Year)', '2025-01-28', 1),
    ('public_holiday', '和平紀念日 (Peace Memorial Day)', '2025-02-28', 1),
    ('public_holiday', '清明節 (Tomb Sweeping Day)', '2025-04-04', 1),
    ('public_holiday', '勞動節 (Labor Day)', '2025-05-01', 1),
    ('public_holiday', '端午節 (Dragon Boat Festival)', '2025-05-31', 1),
    ('public_holiday', '中秋節 (Mid-Autumn Festival)', '2025-10-06', 1),
    ('public_holiday', '國慶日 (National Day)', '2025-10-10', 1);
```

---

### Indexes & Triggers

#### Performance Indexes

```sql
-- Leave request lookups
CREATE INDEX idx_leave_requests_employee_date
    ON leave_requests(employee_id, start_date, end_date);

CREATE INDEX idx_leave_requests_status
    ON leave_requests(status);

CREATE INDEX idx_leave_requests_restaurant_date
    ON leave_requests(restaurant_id, start_date);

-- Balance lookups
CREATE INDEX idx_leave_balances_employee_year
    ON employee_leave_balances(employee_id, year);

CREATE INDEX idx_leave_balances_type_year
    ON employee_leave_balances(leave_type_id, year);

-- Calendar events
CREATE INDEX idx_calendar_events_date
    ON leave_calendar_events(event_date);

CREATE INDEX idx_calendar_events_restaurant_date
    ON leave_calendar_events(restaurant_id, event_date);
```

#### Automatic Triggers

```sql
-- Update balance when leave is approved
CREATE TRIGGER update_balance_on_approval
AFTER UPDATE OF status ON leave_requests
WHEN NEW.status = 'approved' AND OLD.status != 'approved'
BEGIN
    -- Add to used_days
    UPDATE employee_leave_balances
    SET used_days = used_days + NEW.days_count,
        pending_days = pending_days - NEW.days_count
    WHERE employee_id = NEW.employee_id
      AND leave_type_id = NEW.leave_type_id
      AND year = CAST(strftime('%Y', NEW.start_date) AS INTEGER);
END;

-- Update pending_days when request is submitted
CREATE TRIGGER update_pending_on_submit
AFTER INSERT ON leave_requests
WHEN NEW.status = 'pending'
BEGIN
    UPDATE employee_leave_balances
    SET pending_days = pending_days + NEW.days_count
    WHERE employee_id = NEW.employee_id
      AND leave_type_id = NEW.leave_type_id
      AND year = CAST(strftime('%Y', NEW.start_date) AS INTEGER);
END;

-- Restore pending_days when request is rejected/cancelled
CREATE TRIGGER restore_pending_on_rejection
AFTER UPDATE OF status ON leave_requests
WHEN NEW.status IN ('rejected', 'cancelled', 'withdrawn') AND OLD.status = 'pending'
BEGIN
    UPDATE employee_leave_balances
    SET pending_days = pending_days - NEW.days_count
    WHERE employee_id = NEW.employee_id
      AND leave_type_id = NEW.leave_type_id
      AND year = CAST(strftime('%Y', NEW.start_date) AS INTEGER);
END;

-- Update timestamp on modifications
CREATE TRIGGER update_leave_requests_timestamp
AFTER UPDATE ON leave_requests
BEGIN
    UPDATE leave_requests
    SET updated_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;
```

---

### Database Views

#### `employee_leave_summary` - Employee Leave Overview

```sql
CREATE VIEW employee_leave_summary AS
SELECT
    u.id AS employee_id,
    u.full_name AS employee_name,
    u.restaurant_id,
    lb.year,
    lt.name AS leave_type_name,
    lb.total_days,
    lb.used_days,
    lb.pending_days,
    lb.remaining_days,
    lb.carryover_days,
    CASE
        WHEN lb.remaining_days < 0 THEN 'negative'
        WHEN lb.remaining_days = 0 THEN 'depleted'
        WHEN lb.remaining_days <= 2 THEN 'low'
        ELSE 'normal'
    END AS balance_status
FROM employee_leave_balances lb
JOIN users u ON lb.employee_id = u.id
JOIN leave_types lt ON lb.leave_type_id = lt.id
WHERE u.is_active = 1 AND lt.is_active = 1;
```

#### `pending_leave_approvals` - Pending Approval Queue

```sql
CREATE VIEW pending_leave_approvals AS
SELECT
    lr.*,
    u.full_name AS employee_name,
    u.role AS employee_role,
    lt.name AS leave_type_name,
    lt.color_code,
    r.name AS restaurant_name,
    CASE
        WHEN lr.is_emergency = 1 THEN 'emergency'
        WHEN (strftime('%s', 'now') - lr.created_at) > 172800 THEN 'overdue'  -- 48 hours
        ELSE 'normal'
    END AS urgency_status
FROM leave_requests lr
JOIN users u ON lr.employee_id = u.id
JOIN leave_types lt ON lr.leave_type_id = lt.id
JOIN restaurants r ON lr.restaurant_id = r.id
WHERE lr.status = 'pending'
ORDER BY
    lr.is_emergency DESC,
    lr.created_at ASC;
```

#### `team_leave_calendar` - Team Availability Overview

```sql
CREATE VIEW team_leave_calendar AS
SELECT
    lr.restaurant_id,
    DATE(lr.start_date) AS leave_date,
    COUNT(DISTINCT lr.employee_id) AS employees_on_leave,
    GROUP_CONCAT(DISTINCT u.full_name, ', ') AS employee_names,
    GROUP_CONCAT(DISTINCT lt.name, ', ') AS leave_types,
    MAX(CASE WHEN u.role = 2 THEN 1 ELSE 0 END) AS chef_on_leave,
    MAX(CASE WHEN u.role = 3 THEN 1 ELSE 0 END) AS service_on_leave,
    MAX(CASE WHEN u.role = 4 THEN 1 ELSE 0 END) AS cashier_on_leave
FROM leave_requests lr
JOIN users u ON lr.employee_id = u.id
JOIN leave_types lt ON lr.leave_type_id = lt.id
WHERE lr.status = 'approved'
  AND DATE(lr.start_date) <= leave_date
  AND DATE(lr.end_date) >= leave_date
GROUP BY lr.restaurant_id, leave_date;
```

---

## API Reference

### Base URL

```
/api/v1/leave
```

### Authentication

All endpoints require JWT authentication. Permissions:

- **Employees**: Can view own leave data, submit requests
- **Managers/Owners**: Can approve requests, view team leave
- **Admin**: Full access

---

### Endpoints

#### 1. Get Employee Leave Balance

```http
GET /api/v1/leave/balance/:employeeId?year=2025

Query Parameters:
  - year: number (optional, defaults to current year)

Response:
{
  "success": true,
  "data": {
    "year": 2025,
    "balances": [
      {
        "leaveTypeId": 1,
        "leaveTypeName": "年假",
        "code": "ANNUAL",
        "totalDays": 7,
        "usedDays": 2,
        "pendingDays": 1,
        "remainingDays": 4,
        "carryoverDays": 0,
        "colorCode": "#10B981"
      }
    ],
    "summary": {
      "totalAvailableDays": 51,
      "totalUsedDays": 5,
      "utilizationRate": 0.098
    }
  }
}
```

#### 2. Submit Leave Request

```http
POST /api/v1/leave/request

Request Body:
{
  "employeeId": 42,
  "leaveTypeId": 1,
  "startDate": "2025-10-20",
  "endDate": "2025-10-22",
  "daysCount": 3,
  "reason": "Family vacation",
  "description": "Planned family trip to Kenting",
  "isEmergency": false
}

Response:
{
  "success": true,
  "data": {
    "requestId": 123,
    "status": "pending",
    "approvalRequired": true,
    "currentApprovalLevel": 1,
    "requiredLevels": 2,
    "conflicts": [
      {
        "type": "scheduled_shift",
        "date": "2025-10-20",
        "message": "You are scheduled to work on this date"
      }
    ],
    "estimatedApprovalTime": "48 hours"
  }
}
```

#### 3. Get Leave Requests (Employee View)

```http
GET /api/v1/leave/requests?employeeId=42&status=pending&year=2025

Query Parameters:
  - employeeId: number
  - status: string (optional: "pending", "approved", "rejected", "all")
  - year: number (optional)
  - from: date (optional)
  - to: date (optional)

Response:
{
  "success": true,
  "data": {
    "requests": [
      {
        "id": 123,
        "leaveType": "年假",
        "startDate": "2025-10-20",
        "endDate": "2025-10-22",
        "daysCount": 3,
        "status": "pending",
        "reason": "Family vacation",
        "submittedAt": "2025-10-10T10:00:00Z",
        "approvalProgress": {
          "current": 1,
          "total": 2,
          "percentage": 50
        }
      }
    ],
    "total": 5
  }
}
```

#### 4. Get Pending Approvals (Manager View)

```http
GET /api/v1/leave/approvals/pending?restaurantId=1

Response:
{
  "success": true,
  "data": {
    "pendingApprovals": [
      {
        "requestId": 123,
        "employeeId": 42,
        "employeeName": "John Doe",
        "leaveType": "年假",
        "startDate": "2025-10-20",
        "endDate": "2025-10-22",
        "daysCount": 3,
        "reason": "Family vacation",
        "submittedAt": "2025-10-10T10:00:00Z",
        "urgency": "normal",
        "isEmergency": false,
        "conflicts": ["scheduled_shift"],
        "replacementStatus": "not_assigned"
      }
    ],
    "statistics": {
      "total": 5,
      "emergency": 1,
      "overdue": 0
    }
  }
}
```

#### 5. Approve Leave Request

```http
POST /api/v1/leave/requests/:id/approve

Request Body:
{
  "comment": "Approved, enjoy your vacation",
  "assignReplacement": true,
  "replacementEmployeeId": 45
}

Response:
{
  "success": true,
  "message": "Leave request approved",
  "data": {
    "status": "approved",
    "approvedBy": "Manager Name",
    "approvedAt": "2025-10-10T14:30:00Z",
    "finalApproval": true,
    "balanceUpdated": true,
    "notificationSent": true
  }
}
```

#### 6. Reject Leave Request

```http
POST /api/v1/leave/requests/:id/reject

Request Body:
{
  "reason": "Insufficient staffing during requested period",
  "suggestAlternativeDates": ["2025-10-27", "2025-11-03"]
}

Response:
{
  "success": true,
  "message": "Leave request rejected",
  "data": {
    "status": "rejected",
    "rejectedBy": "Manager Name",
    "rejectedAt": "2025-10-10T14:35:00Z",
    "notificationSent": true
  }
}
```

#### 7. Cancel Leave Request

```http
POST /api/v1/leave/requests/:id/cancel

Request Body:
{
  "reason": "Plans changed"
}

Response:
{
  "success": true,
  "message": "Leave request cancelled",
  "data": {
    "status": "cancelled",
    "balanceRestored": true,
    "scheduleRestored": true
  }
}
```

#### 8. Get Team Leave Calendar

```http
GET /api/v1/leave/calendar?restaurantId=1&from=2025-10-01&to=2025-10-31

Response:
{
  "success": true,
  "data": {
    "calendar": [
      {
        "date": "2025-10-20",
        "employeesOnLeave": 2,
        "employees": [
          {
            "id": 42,
            "name": "John Doe",
            "role": "Chef",
            "leaveType": "年假",
            "colorCode": "#10B981"
          }
        ],
        "coverage": {
          "chefCovered": true,
          "serviceCovered": true,
          "cashierCovered": true
        }
      }
    ],
    "summary": {
      "totalLeaveDays": 15,
      "averageDaily": 0.5,
      "peakDate": "2025-10-20",
      "peakCount": 3
    }
  }
}
```

#### 9. Adjust Leave Balance (Manual)

```http
POST /api/v1/leave/balance/adjust

Request Body:
{
  "employeeId": 42,
  "leaveTypeId": 1,
  "year": 2025,
  "adjustmentDays": 2,
  "reason": "Compensation for overtime work"
}

Authorization: Admin or Owner only

Response:
{
  "success": true,
  "data": {
    "newBalance": {
      "totalDays": 9,
      "usedDays": 2,
      "remainingDays": 7
    },
    "adjustment": {
      "days": 2,
      "reason": "Compensation for overtime work",
      "adjustedBy": "Manager Name",
      "adjustedAt": "2025-10-10T15:00:00Z"
    }
  }
}
```

#### 10. Get Leave Statistics

```http
GET /api/v1/leave/stats?restaurantId=1&year=2025

Response:
{
  "success": true,
  "data": {
    "overview": {
      "totalRequests": 45,
      "approvedRequests": 38,
      "rejectedRequests": 5,
      "pendingRequests": 2,
      "approvalRate": 84.4
    },
    "byLeaveType": [
      {
        "leaveType": "年假",
        "totalRequests": 20,
        "totalDays": 65,
        "averageDaysPerRequest": 3.25
      }
    ],
    "byEmployee": [...],
    "trends": {
      "monthlyDistribution": {...},
      "peakMonths": ["June", "December"]
    }
  }
}
```

### Additional Endpoints

```http
GET    /api/v1/leave/types                      # List leave types
POST   /api/v1/leave/types                      # Create leave type (Admin)
PUT    /api/v1/leave/types/:id                  # Update leave type
DELETE /api/v1/leave/types/:id                  # Delete leave type

GET    /api/v1/leave/holidays                   # Get public holidays
POST   /api/v1/leave/holidays                   # Add holiday (Admin)

POST   /api/v1/leave/balance/initialize/:employeeId  # Initialize balances for new employee
POST   /api/v1/leave/balance/rollover                # Year-end rollover (Cron job)
```

---

## Frontend Integration

### Admin Dashboard Components

#### 1. **LeaveView.vue** - Main Leave Management Interface

```vue
<template>
  <div class="leave-view">
    <el-tabs v-model="activeTab">
      <!-- Employee View: My Leave -->
      <el-tab-pane label="我的假期" name="my-leave" v-if="isEmployee">
        <el-row :gutter="20">
          <!-- Leave Balance Cards -->
          <el-col
            :span="6"
            v-for="balance in myBalances"
            :key="balance.leaveTypeId"
          >
            <el-card class="balance-card">
              <template #header>
                <div class="balance-header">
                  <span :style="{ color: balance.colorCode }">
                    {{ balance.leaveTypeName }}
                  </span>
                </div>
              </template>
              <div class="balance-content">
                <div class="balance-stat">
                  <span class="label">剩餘天數</span>
                  <span class="value">{{ balance.remainingDays }} 天</span>
                </div>
                <el-progress
                  :percentage="calculateUsagePercentage(balance)"
                  :color="getProgressColor(balance)"
                />
                <div class="balance-details">
                  <span>已使用: {{ balance.usedDays }} 天</span>
                  <span>審核中: {{ balance.pendingDays }} 天</span>
                </div>
              </div>
            </el-card>
          </el-col>
        </el-row>

        <el-button
          type="primary"
          @click="showRequestDialog = true"
          style="margin-top: 20px"
        >
          申請請假
        </el-button>

        <!-- My Leave Requests -->
        <el-table :data="myRequests" style="margin-top: 20px">
          <el-table-column prop="leaveType" label="假期類型" />
          <el-table-column label="日期範圍">
            <template #default="{ row }">
              {{ row.startDate }} ~ {{ row.endDate }}
            </template>
          </el-table-column>
          <el-table-column prop="daysCount" label="天數" />
          <el-table-column label="狀態">
            <template #default="{ row }">
              <el-tag :type="getStatusTagType(row.status)">
                {{ getStatusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="審批進度">
            <template #default="{ row }">
              <el-progress
                :percentage="(row.currentLevel / row.requiredLevels) * 100"
                :format="() => `${row.currentLevel}/${row.requiredLevels}`"
              />
            </template>
          </el-table-column>
          <el-table-column label="操作">
            <template #default="{ row }">
              <el-button
                v-if="row.status === 'pending'"
                size="small"
                type="danger"
                @click="cancelRequest(row.id)"
              >
                取消
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- Manager View: Approvals -->
      <el-tab-pane label="待審批" name="approvals" v-if="isManager">
        <el-alert
          v-if="pendingCount > 0"
          :title="`您有 ${pendingCount} 個待審批的請假申請`"
          type="warning"
          show-icon
        />

        <el-table :data="pendingApprovals" style="margin-top: 20px">
          <el-table-column label="緊急" width="80">
            <template #default="{ row }">
              <el-icon v-if="row.isEmergency" color="red" size="20">
                <Warning />
              </el-icon>
            </template>
          </el-table-column>
          <el-table-column prop="employeeName" label="員工" />
          <el-table-column prop="leaveType" label="假期類型" />
          <el-table-column label="日期">
            <template #default="{ row }">
              {{ row.startDate }} ~ {{ row.endDate }}
              <el-tag size="small">{{ row.daysCount }} 天</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="reason" label="原因" show-overflow-tooltip />
          <el-table-column label="衝突" width="100">
            <template #default="{ row }">
              <el-badge
                v-if="row.conflicts && row.conflicts.length > 0"
                :value="row.conflicts.length"
                type="danger"
              >
                <el-button size="small" text @click="viewConflicts(row)">
                  查看
                </el-button>
              </el-badge>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200">
            <template #default="{ row }">
              <el-button
                type="success"
                size="small"
                @click="approveRequest(row.id)"
              >
                批准
              </el-button>
              <el-button
                type="danger"
                size="small"
                @click="rejectRequest(row.id)"
              >
                拒絕
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- Team Calendar -->
      <el-tab-pane label="團隊假期日曆" name="calendar">
        <LeaveCalendar
          :restaurant-id="restaurantId"
          :month="currentMonth"
          @date-click="showDayDetails"
        />
      </el-tab-pane>

      <!-- Statistics (Manager/Admin) -->
      <el-tab-pane label="統計報表" name="stats" v-if="isManager">
        <LeaveStatistics :restaurant-id="restaurantId" :year="currentYear" />
      </el-tab-pane>
    </el-tabs>

    <!-- Request Dialog -->
    <LeaveRequestDialog v-model="showRequestDialog" @submit="submitRequest" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useUserStore } from "@/stores/user";
import type { LeaveBalance, LeaveRequest } from "@makanmakan/shared-types";

const userStore = useUserStore();
const activeTab = ref("my-leave");

const isEmployee = computed(() => userStore.role >= 2);
const isManager = computed(() => userStore.role <= 1);

const myBalances = ref<LeaveBalance[]>([]);
const myRequests = ref<LeaveRequest[]>([]);
const pendingApprovals = ref<LeaveRequest[]>([]);
const pendingCount = computed(() => pendingApprovals.value.length);

const showRequestDialog = ref(false);
const restaurantId = computed(() => userStore.restaurantId);
const currentYear = ref(new Date().getFullYear());
const currentMonth = ref(new Date());

onMounted(async () => {
  await loadMyBalances();
  await loadMyRequests();
  if (isManager.value) {
    await loadPendingApprovals();
  }
});

async function loadMyBalances() {
  const response = await fetch(
    `/api/v1/leave/balance/${userStore.id}?year=${currentYear.value}`,
  );
  const result = await response.json();
  myBalances.value = result.data.balances;
}

async function loadMyRequests() {
  const response = await fetch(
    `/api/v1/leave/requests?employeeId=${userStore.id}&year=${currentYear.value}`,
  );
  const result = await response.json();
  myRequests.value = result.data.requests;
}

async function loadPendingApprovals() {
  const response = await fetch(
    `/api/v1/leave/approvals/pending?restaurantId=${restaurantId.value}`,
  );
  const result = await response.json();
  pendingApprovals.value = result.data.pendingApprovals;
}

function calculateUsagePercentage(balance: LeaveBalance): number {
  if (balance.totalDays === 0) return 0;
  return (balance.usedDays / balance.totalDays) * 100;
}

function getProgressColor(balance: LeaveBalance): string {
  const percentage = calculateUsagePercentage(balance);
  if (percentage >= 90) return "#F56C6C";
  if (percentage >= 70) return "#E6A23C";
  return "#67C23A";
}

async function approveRequest(requestId: number) {
  const confirmed = await ElMessageBox.confirm(
    "確定要批准此請假申請嗎？",
    "批准請假",
    { type: "info" },
  );

  if (confirmed) {
    const response = await fetch(
      `/api/v1/leave/requests/${requestId}/approve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: "已批准" }),
      },
    );

    if (response.ok) {
      ElMessage.success("請假申請已批准");
      await loadPendingApprovals();
    }
  }
}

async function rejectRequest(requestId: number) {
  const reason = await ElMessageBox.prompt("請輸入拒絕原因", "拒絕請假", {
    inputType: "textarea",
  });

  if (reason) {
    const response = await fetch(`/api/v1/leave/requests/${requestId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.value }),
    });

    if (response.ok) {
      ElMessage.success("請假申請已拒絕");
      await loadPendingApprovals();
    }
  }
}
</script>
```

#### 2. **LeaveRequestDialog.vue** - Leave Request Form

```vue
<template>
  <el-dialog v-model="visible" title="申請請假" width="600px">
    <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
      <el-form-item label="假期類型" prop="leaveTypeId">
        <el-select v-model="form.leaveTypeId" @change="onLeaveTypeChange">
          <el-option
            v-for="type in leaveTypes"
            :key="type.id"
            :label="`${type.name} (剩餘: ${getBalance(type.id)} 天)`"
            :value="type.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="日期範圍" prop="dateRange">
        <el-date-picker
          v-model="form.dateRange"
          type="daterange"
          format="YYYY-MM-DD"
          start-placeholder="開始日期"
          end-placeholder="結束日期"
          :disabled-date="disabledDate"
          @change="calculateDays"
        />
      </el-form-item>

      <el-form-item label="請假天數">
        <el-input-number
          v-model="form.daysCount"
          :min="0.5"
          :max="365"
          :step="0.5"
        />
        <span style="margin-left: 10px; color: #909399">
          (可使用半天 0.5)
        </span>
      </el-form-item>

      <el-form-item label="半天類型" v-if="form.daysCount === 0.5">
        <el-radio-group v-model="form.halfDayType">
          <el-radio label="morning">上午</el-radio>
          <el-radio label="afternoon">下午</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="請假原因" prop="reason">
        <el-input
          v-model="form.reason"
          type="textarea"
          :rows="3"
          placeholder="請說明請假原因"
        />
      </el-form-item>

      <el-form-item label="補充說明">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="2"
          placeholder="選填"
        />
      </el-form-item>

      <el-form-item label="證明文件" v-if="requiresDocumentation">
        <el-upload
          action="/api/v1/upload"
          :file-list="fileList"
          :on-success="handleUploadSuccess"
        >
          <el-button size="small" type="primary">上傳文件</el-button>
        </el-upload>
        <div style="color: #E6A23C; margin-top: 8px">
          此假期類型需要提供證明文件
        </div>
      </el-form-item>

      <el-form-item>
        <el-checkbox v-model="form.isEmergency">
          緊急請假（將優先處理）
        </el-checkbox>
      </el-form-item>

      <!-- Conflict Warnings -->
      <el-alert
        v-if="conflicts.length > 0"
        type="warning"
        title="檢測到衝突"
        :closable="false"
        style="margin-bottom: 16px"
      >
        <ul>
          <li v-for="conflict in conflicts" :key="conflict.type">
            {{ conflict.message }}
          </li>
        </ul>
      </el-alert>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="submit" :loading="submitting">
        提交申請
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { LeaveType } from "@makanmakan/shared-types";

const visible = defineModel<boolean>({ required: true });
const emit = defineEmits<{
  submit: [request: LeaveRequestForm];
}>();

interface LeaveRequestForm {
  leaveTypeId: number;
  dateRange: [Date, Date];
  daysCount: number;
  halfDayType?: "morning" | "afternoon";
  reason: string;
  description?: string;
  isEmergency: boolean;
  attachments?: string[];
}

const leaveTypes = ref<LeaveType[]>([]);
const balances = ref<Record<number, number>>({});
const conflicts = ref([]);
const submitting = ref(false);
const fileList = ref([]);

const form = ref<LeaveRequestForm>({
  leaveTypeId: 0,
  dateRange: [new Date(), new Date()],
  daysCount: 1,
  reason: "",
  isEmergency: false,
});

const rules = {
  leaveTypeId: [{ required: true, message: "請選擇假期類型" }],
  dateRange: [{ required: true, message: "請選擇日期範圍" }],
  reason: [{ required: true, message: "請輸入請假原因" }],
};

const requiresDocumentation = computed(() => {
  const type = leaveTypes.value.find((t) => t.id === form.value.leaveTypeId);
  return type?.requiresDocumentation || false;
});

function getBalance(leaveTypeId: number): number {
  return balances.value[leaveTypeId] || 0;
}

function calculateDays() {
  if (form.value.dateRange && form.value.dateRange.length === 2) {
    const [start, end] = form.value.dateRange;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    form.value.daysCount = diffDays;
  }
}

async function submit() {
  submitting.value = true;
  try {
    emit("submit", form.value);
    visible.value = false;
  } finally {
    submitting.value = false;
  }
}
</script>
```

#### 3. **LeaveCalendar.vue** - Team Leave Calendar

```vue
<template>
  <div class="leave-calendar">
    <el-calendar v-model="currentDate">
      <template #date-cell="{ data }">
        <div
          class="calendar-day"
          :class="{ 'has-leave': hasLeave(data.day) }"
          @click="$emit('date-click', data.day)"
        >
          <div class="day-number">{{ data.day.split("-")[2] }}</div>
          <div v-if="hasLeave(data.day)" class="leave-indicators">
            <el-tag
              v-for="leave in getLeavesByDate(data.day)"
              :key="leave.employeeId"
              :color="leave.colorCode"
              size="small"
              effect="plain"
            >
              {{ leave.employeeName }}
            </el-tag>
          </div>
        </div>
      </template>
    </el-calendar>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { LeaveCalendarEvent } from "@makanmakan/shared-types";

const props = defineProps<{
  restaurantId: number;
  month: Date;
}>();

const emit = defineEmits<{
  dateClick: [date: string];
}>();

const currentDate = ref(props.month);
const leaveData = ref<Record<string, LeaveCalendarEvent[]>>({});

onMounted(async () => {
  await loadLeaveCalendar();
});

async function loadLeaveCalendar() {
  const firstDay = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth(),
    1,
  );
  const lastDay = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() + 1,
    0,
  );

  const response = await fetch(
    `/api/v1/leave/calendar?restaurantId=${props.restaurantId}&from=${formatDate(firstDay)}&to=${formatDate(lastDay)}`,
  );
  const result = await response.json();

  // Group by date
  leaveData.value = result.data.calendar.reduce((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(...item.employees);
    return acc;
  }, {});
}

function hasLeave(date: string): boolean {
  return !!leaveData.value[date];
}

function getLeavesByDate(date: string): LeaveCalendarEvent[] {
  return leaveData.value[date] || [];
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}
</script>

<style scoped>
.calendar-day {
  min-height: 80px;
  padding: 4px;
  cursor: pointer;
}

.calendar-day:hover {
  background-color: #f5f7fa;
}

.calendar-day.has-leave {
  background-color: #fef0f0;
}

.day-number {
  font-size: 16px;
  font-weight: bold;
}

.leave-indicators {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
```

---

## Business Logic

### Approval Workflow Engine

```typescript
// services/LeaveApprovalService.ts
export class LeaveApprovalService {
  async processApproval(
    requestId: number,
    approverId: number,
    action: "approve" | "reject",
    comment?: string,
  ): Promise<ApprovalResult> {
    const request = await this.getLeaveRequest(requestId);
    const rules = await this.getApprovalRules(request.restaurantId, request);

    // Get current approval level
    const currentLevel = request.currentApprovalLevel;

    // Update approval chain
    const approvalChain = JSON.parse(request.approvalChain || "[]");
    approvalChain.push({
      level: currentLevel,
      approverId,
      approverName: await this.getUserName(approverId),
      status: action,
      comment,
      timestamp: Date.now(),
    });

    if (action === "approve") {
      // Check if more levels needed
      if (currentLevel < request.requiredApprovalLevels) {
        // Move to next level
        await this.updateRequest(requestId, {
          currentApprovalLevel: currentLevel + 1,
          approvalChain: JSON.stringify(approvalChain),
          status: "pending",
        });

        // Notify next approver
        await this.notifyNextApprover(request, currentLevel + 1);

        return {
          success: true,
          status: "pending_next_level",
          nextLevel: currentLevel + 1,
        };
      } else {
        // Final approval
        await this.finalizeApproval(requestId, approverId, approvalChain);
        return {
          success: true,
          status: "approved",
          final: true,
        };
      }
    } else {
      // Reject
      await this.finalizeRejection(
        requestId,
        approverId,
        comment,
        approvalChain,
      );
      return {
        success: true,
        status: "rejected",
        final: true,
      };
    }
  }

  private async finalizeApproval(
    requestId: number,
    approverId: number,
    approvalChain: any[],
  ): Promise<void> {
    const request = await this.getLeaveRequest(requestId);

    // Update request status
    await this.updateRequest(requestId, {
      status: "approved",
      finalApprovedBy: approverId,
      finalApprovedAt: Date.now(),
      approvalChain: JSON.stringify(approvalChain),
    });

    // Update leave balance
    await this.updateLeaveBalance(
      request.employeeId,
      request.leaveTypeId,
      request.year,
      request.daysCount,
    );

    // Handle schedule conflicts
    await this.handleScheduleConflicts(request);

    // Send notifications
    await this.notifyEmployee(request, "approved");
  }

  private async handleScheduleConflicts(request: LeaveRequest): Promise<void> {
    // Find conflicting schedules
    const conflicts = await this.findScheduleConflicts(
      request.employeeId,
      request.startDate,
      request.endDate,
    );

    if (conflicts.length > 0) {
      // Cancel schedules
      for (const schedule of conflicts) {
        await scheduleService.updateSchedule(schedule.id, {
          status: "cancelled",
          notes: `Cancelled due to approved leave request #${request.id}`,
        });
      }

      // Notify manager about replacement needed
      await notificationService.create({
        type: "replacement_needed",
        requestId: request.id,
        scheduleIds: conflicts.map((s) => s.id),
        message: `${request.employeeName} 的請假已批准，需要安排替代人員`,
      });
    }
  }
}
```

---

## Integration with Scheduling System

### Automatic Conflict Detection

```typescript
// When submitting leave request
async function validateLeaveRequest(
  request: LeaveRequestInput,
): Promise<ValidationResult> {
  // Check leave balance
  const balance = await getLeaveBalance(
    request.employeeId,
    request.leaveTypeId,
    new Date(request.startDate).getFullYear(),
  );

  if (balance.remainingDays < request.daysCount) {
    return {
      valid: false,
      error: "INSUFFICIENT_BALANCE",
      message: `假期餘額不足（剩餘 ${balance.remainingDays} 天）`,
    };
  }

  // Check for scheduled shifts
  const scheduleConflicts =
    await scheduleService.findSchedulesByEmployeeAndDate(
      request.employeeId,
      request.startDate,
      request.endDate,
    );

  // Check team coverage
  const teamLeave = await getTeamLeaveForPeriod(
    request.restaurantId,
    request.startDate,
    request.endDate,
  );

  const criticalRoleUncovered = checkCriticalRoleCoverage(
    teamLeave,
    request.employeeRole,
  );

  return {
    valid: true,
    warnings: [
      ...scheduleConflicts.map((s) => ({
        type: "schedule_conflict",
        message: `已排班於 ${s.workDate}`,
        scheduleId: s.id,
      })),
      ...(criticalRoleUncovered
        ? [
            {
              type: "coverage_issue",
              message: "此期間該角色人手不足",
            },
          ]
        : []),
    ],
  };
}
```

---

## Best Practices

### 1. Leave Balance Management

**Annual Rollover**:

```typescript
// Cron job: Run on January 1st
async function annualLeaveRollover() {
  const currentYear = new Date().getFullYear();

  // Get all employees
  const employees = await userService.getAllEmployees();

  for (const employee of employees) {
    // Get previous year balances
    const prevBalances = await getEmployeeBalances(
      employee.id,
      currentYear - 1,
    );

    for (const prevBalance of prevBalances) {
      const leaveType = await getLeaveType(prevBalance.leaveTypeId);

      // Calculate carryover
      let carryoverDays = 0;
      if (leaveType.allowCarryover) {
        carryoverDays = Math.min(
          prevBalance.remainingDays,
          leaveType.maxCarryoverDays,
        );
      }

      // Create new year balance
      await createLeaveBalance({
        employeeId: employee.id,
        leaveTypeId: prevBalance.leaveTypeId,
        year: currentYear,
        totalDays: leaveType.defaultDaysPerYear,
        carryoverDays,
        carryoverExpiresAt: leaveType.carryoverExpiresMonths
          ? addMonths(new Date(), leaveType.carryoverExpiresMonths)
          : null,
      });
    }
  }
}
```

### 2. Approval Escalation

**Auto-Escalate Stale Requests**:

```typescript
// Cron job: Run every 6 hours
async function escalateStaleApprovals() {
  const staleRequests = await db.query(`
    SELECT * FROM leave_requests
    WHERE status = 'pending'
      AND (strftime('%s', 'now') - submitted_at) > 172800  -- 48 hours
  `);

  for (const request of staleRequests) {
    const rule = await getApprovalRule(request, request.currentApprovalLevel);

    if (rule.escalateToUserId) {
      // Escalate to designated user
      await notificationService.create({
        type: "escalated_approval",
        userId: rule.escalateToUserId,
        requestId: request.id,
        message: `Leave request #${request.id} has been escalated to you`,
      });
    }
  }
}
```

### 3. Leave Balance Audit

**Monthly Reconciliation**:

```typescript
async function reconcileLeaveBalances(year: number, month: number) {
  const employees = await userService.getAllEmployees();

  for (const employee of employees) {
    const balances = await getEmployeeBalances(employee.id, year);

    for (const balance of balances) {
      // Recalculate from approved requests
      const approvedRequests = await db.query(
        `
        SELECT SUM(days_count) as total
        FROM leave_requests
        WHERE employee_id = ?
          AND leave_type_id = ?
          AND status = 'approved'
          AND strftime('%Y', start_date) = ?
      `,
        [employee.id, balance.leaveTypeId, year.toString()],
      );

      const actualUsedDays = approvedRequests[0].total || 0;

      if (actualUsedDays !== balance.usedDays) {
        // Discrepancy detected, log and fix
        await logBalanceDiscrepancy({
          employeeId: employee.id,
          leaveTypeId: balance.leaveTypeId,
          year,
          expected: actualUsedDays,
          actual: balance.usedDays,
          difference: actualUsedDays - balance.usedDays,
        });

        // Fix balance
        await updateLeaveBalance(balance.id, {
          usedDays: actualUsedDays,
        });
      }
    }
  }
}
```

---

## Testing Strategy

### Unit Tests

```typescript
describe("LeaveApprovalService", () => {
  it("should approve single-level request", async () => {
    const request = await createTestLeaveRequest({
      requiredApprovalLevels: 1,
    });

    const result = await approvalService.processApproval(
      request.id,
      managerId,
      "approve",
    );

    expect(result.status).toBe("approved");
    expect(result.final).toBe(true);
  });

  it("should move to next level for multi-level approval", async () => {
    const request = await createTestLeaveRequest({
      requiredApprovalLevels: 2,
    });

    const result = await approvalService.processApproval(
      request.id,
      managerId,
      "approve",
    );

    expect(result.status).toBe("pending_next_level");
    expect(result.nextLevel).toBe(2);
  });

  it("should deduct leave balance on approval", async () => {
    const balanceBefore = await getLeaveBalance(employeeId, leaveTypeId, 2025);

    await approvalService.processApproval(requestId, managerId, "approve");

    const balanceAfter = await getLeaveBalance(employeeId, leaveTypeId, 2025);

    expect(balanceAfter.usedDays).toBe(balanceBefore.usedDays + 3);
  });
});
```

---

## Migration Guide

See **0035_leave_management_system.sql** for database migration.

---

## Troubleshooting

### Issue: Leave balance shows negative

**Cause**: Balance not properly updated after approval

**Solution**: Run reconciliation script

---

## Performance Metrics

- **Request Submission**: < 300ms
- **Approval Processing**: < 500ms
- **Balance Calculation**: < 100ms
- **Calendar Load**: < 800ms for 50 employees

---

## Security Considerations

- Employees can only view own leave data
- Managers can only approve within their restaurant
- Approval actions are logged with full audit trail
- Balance adjustments require Admin/Owner role

---

## References

- **Migration File**: `packages/database/migrations/0035_leave_management_system.sql`
- **Schema**: `packages/database/src/schema/leave.ts`
- **Service**: `packages/database/src/services/leave.ts`
- **Types**: `packages/shared-types/src/leave.ts`
- **API Routes**: `apps/api/src/routes/leave.ts`
- **UI Components**: `apps/admin-dashboard/src/components/leave/`

---

**Document Version**: 1.0
**Last Updated**: 2025-10-10
**Status**: 📋 Design Document - Ready for Implementation

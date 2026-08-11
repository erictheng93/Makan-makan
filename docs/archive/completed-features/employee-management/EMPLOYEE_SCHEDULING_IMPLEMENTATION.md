# Employee Scheduling System Implementation Guide

**Version**: 1.0
**Date**: 2025-10-10
**Status**: 📋 Design Document

---

## Overview

The Employee Scheduling System enables restaurant owners and managers to create, manage, and optimize work schedules for their staff. This system provides flexible shift planning, conflict detection, workload balancing, and employee self-service features.

### Key Features

- ✅ **Flexible Shift Templates**: Create reusable shift patterns (morning, evening, split shifts)
- ✅ **Drag-and-Drop Scheduling**: Intuitive visual interface for schedule management
- ✅ **Conflict Detection**: Automatic detection of scheduling conflicts and rest period violations
- ✅ **Workload Balancing**: Track and balance employee working hours across weeks/months
- ✅ **Copy Previous Schedules**: Quick schedule creation by copying previous weeks
- ✅ **Employee Self-Service**: Staff can view their schedules and request changes
- ✅ **Multi-Restaurant Support**: Isolated scheduling per restaurant
- ✅ **Mobile-Friendly**: Responsive design for on-the-go schedule management

### Business Requirements

**From**: Product Requirements (User Story 3.1 - Multi-Role Permission System)

**Stakeholders**:

- Restaurant Owners (Manage all schedules)
- Store Managers (Create and modify schedules)
- Employees (View own schedule, request time-off)

---

## Architecture

### Database Schema

#### Tables

##### `shift_templates` - Reusable Shift Patterns

Defines common shift types that can be reused across schedules.

```sql
CREATE TABLE shift_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,

    -- Time Configuration
    start_time TEXT NOT NULL,           -- Format: "HH:MM" (24-hour)
    end_time TEXT NOT NULL,             -- Format: "HH:MM" (24-hour)
    duration_minutes INTEGER NOT NULL,  -- Calculated: end - start

    -- Split Shift Support (Optional)
    is_split_shift INTEGER NOT NULL DEFAULT 0,
    split_break_start TEXT,             -- Format: "HH:MM"
    split_break_end TEXT,               -- Format: "HH:MM"
    split_break_duration INTEGER,       -- Minutes

    -- Shift Type & Color
    shift_type TEXT NOT NULL DEFAULT 'regular'
        CHECK (shift_type IN ('regular', 'morning', 'evening', 'night', 'split', 'custom')),
    color_code TEXT DEFAULT '#3B82F6',  -- Hex color for UI display

    -- Constraints
    max_employees INTEGER,              -- Max staff for this shift
    min_employees INTEGER DEFAULT 1,    -- Min required staff
    requires_role TEXT,                 -- JSON: ["chef", "service", "cashier"]

    -- Settings
    is_active INTEGER NOT NULL DEFAULT 1,
    is_default INTEGER NOT NULL DEFAULT 0,

    -- Metadata
    created_by INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,

    UNIQUE(restaurant_id, name)
);
```

**Example Records**:

```sql
-- Morning Shift: 09:00 - 17:00
INSERT INTO shift_templates (restaurant_id, name, start_time, end_time, duration_minutes, shift_type, color_code)
VALUES (1, 'Morning Shift', '09:00', '17:00', 480, 'morning', '#10B981');

-- Evening Shift: 17:00 - 01:00
INSERT INTO shift_templates (restaurant_id, name, start_time, end_time, duration_minutes, shift_type, color_code)
VALUES (1, 'Evening Shift', '17:00', '01:00', 480, 'evening', '#F59E0B');

-- Split Shift: 11:00-14:00, 17:00-21:00
INSERT INTO shift_templates (restaurant_id, name, start_time, end_time, duration_minutes, is_split_shift, split_break_start, split_break_end, shift_type)
VALUES (1, 'Split Shift', '11:00', '21:00', 420, 1, '14:00', '17:00', 'split');
```

---

##### `employee_schedules` - Work Schedule Assignments

Records which employee works which shift on which date.

```sql
CREATE TABLE employee_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,

    -- Shift Information
    shift_template_id INTEGER,          -- NULL for custom shifts
    work_date TEXT NOT NULL,            -- Format: "YYYY-MM-DD"

    -- Time Override (for custom/adjusted shifts)
    actual_start_time TEXT,             -- Overrides template start
    actual_end_time TEXT,               -- Overrides template end
    actual_duration_minutes INTEGER,    -- Calculated or manual

    -- Break Information
    break_minutes INTEGER DEFAULT 0,    -- Paid/unpaid break
    unpaid_break_minutes INTEGER DEFAULT 0,

    -- Status & Type
    status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
    schedule_type TEXT NOT NULL DEFAULT 'regular'
        CHECK (schedule_type IN ('regular', 'overtime', 'holiday', 'training', 'on_call')),

    -- Assignment Details
    assigned_position TEXT,             -- "chef", "cashier", "service"
    assigned_section TEXT,              -- "kitchen", "front", "bar"

    -- Tracking
    is_swapped INTEGER NOT NULL DEFAULT 0,
    swapped_with_employee_id INTEGER,   -- Original employee if swapped
    swap_approved_by INTEGER,
    swap_approved_at INTEGER,

    -- Notes & Metadata
    notes TEXT,                         -- Manager notes
    employee_notes TEXT,                -- Employee notes/requests

    -- Notification
    notified_at INTEGER,                -- When employee was notified
    acknowledged_at INTEGER,            -- When employee acknowledged

    -- Audit
    created_by INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_by INTEGER,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (shift_template_id) REFERENCES shift_templates(id) ON DELETE SET NULL,
    FOREIGN KEY (swapped_with_employee_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (swap_approved_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,

    -- Prevent duplicate assignments
    UNIQUE(employee_id, work_date, actual_start_time)
);
```

---

##### `scheduling_rules` - Business Rules & Constraints

Defines scheduling rules and constraints for labor law compliance and business needs.

```sql
CREATE TABLE scheduling_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    rule_type TEXT NOT NULL
        CHECK (rule_type IN ('rest_period', 'max_hours', 'min_hours', 'consecutive_days', 'role_required', 'custom')),

    -- Rule Name & Description
    rule_name TEXT NOT NULL,
    description TEXT,

    -- Rule Parameters (JSON)
    rule_config TEXT NOT NULL,          -- JSON configuration
    /*
    Examples:
    {
      "min_rest_hours": 11,              // Minimum hours between shifts
      "max_weekly_hours": 48,            // Maximum weekly hours
      "max_consecutive_days": 6,         // Max days without break
      "required_roles": ["chef"],        // Must have this role on shift
      "min_staff_count": 2               // Minimum staff required
    }
    */

    -- Rule Severity
    severity TEXT NOT NULL DEFAULT 'warning'
        CHECK (severity IN ('info', 'warning', 'error', 'blocking')),

    -- Application Scope
    applies_to_roles TEXT,              -- JSON: ["chef", "service"] or null for all
    applies_to_days TEXT,               -- JSON: ["monday", "friday"] or null for all

    -- Settings
    is_active INTEGER NOT NULL DEFAULT 1,
    is_mandatory INTEGER NOT NULL DEFAULT 0,  -- Cannot be overridden
    priority INTEGER NOT NULL DEFAULT 0,      -- Higher = checked first

    -- Metadata
    created_by INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
```

**Example Rules**:

```sql
-- Minimum 11 hours rest between shifts (Labor Law)
INSERT INTO scheduling_rules (restaurant_id, rule_type, rule_name, rule_config, severity, is_mandatory)
VALUES (1, 'rest_period', 'Minimum Rest Period', '{"min_rest_hours": 11}', 'error', 1);

-- Maximum 48 hours per week
INSERT INTO scheduling_rules (restaurant_id, rule_type, rule_name, rule_config, severity)
VALUES (1, 'max_hours', 'Weekly Hours Cap', '{"max_weekly_hours": 48}', 'warning', 0);

-- Maximum 6 consecutive working days
INSERT INTO scheduling_rules (restaurant_id, rule_type, rule_name, rule_config, severity)
VALUES (1, 'consecutive_days', 'Rest Day Requirement', '{"max_consecutive_days": 6}', 'error', 1);

-- At least 1 chef on every shift
INSERT INTO scheduling_rules (restaurant_id, rule_type, rule_name, rule_config, severity, applies_to_roles)
VALUES (1, 'role_required', 'Chef Required', '{"required_roles": ["chef"], "min_count": 1}', 'blocking', '["chef"]');
```

---

##### `scheduling_conflicts` - Conflict Detection & Resolution

Logs detected scheduling conflicts for review and resolution.

```sql
CREATE TABLE scheduling_conflicts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,

    -- Conflict Details
    conflict_type TEXT NOT NULL
        CHECK (conflict_type IN ('overlap', 'rest_period', 'max_hours', 'double_booking', 'role_shortage', 'custom')),
    severity TEXT NOT NULL DEFAULT 'warning'
        CHECK (severity IN ('info', 'warning', 'error', 'critical')),

    -- Affected Entities
    schedule_ids TEXT NOT NULL,         -- JSON array of schedule IDs
    employee_ids TEXT NOT NULL,         -- JSON array of employee IDs
    work_dates TEXT NOT NULL,           -- JSON array of affected dates

    -- Conflict Description
    conflict_message TEXT NOT NULL,
    conflict_details TEXT,              -- JSON with detailed info
    rule_id INTEGER,                    -- Reference to violated rule

    -- Resolution
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'acknowledged', 'resolved', 'ignored', 'overridden')),
    resolution_notes TEXT,
    resolved_by INTEGER,
    resolved_at INTEGER,

    -- Override Permission
    can_override INTEGER NOT NULL DEFAULT 0,
    overridden_by INTEGER,
    override_reason TEXT,
    overridden_at INTEGER,

    -- Metadata
    detected_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (rule_id) REFERENCES scheduling_rules(id) ON DELETE SET NULL,
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (overridden_by) REFERENCES users(id) ON DELETE SET NULL
);
```

---

##### `schedule_swap_requests` - Shift Swap Requests

Employees can request to swap shifts with colleagues.

```sql
CREATE TABLE schedule_swap_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,

    -- Swap Details
    requester_schedule_id INTEGER NOT NULL,    -- Schedule to swap away
    target_schedule_id INTEGER NOT NULL,       -- Schedule to swap with
    requester_employee_id INTEGER NOT NULL,
    target_employee_id INTEGER NOT NULL,

    -- Status
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'target_accepted', 'target_declined', 'manager_approved', 'manager_rejected', 'completed', 'cancelled')),

    -- Reason & Notes
    reason TEXT,
    requester_notes TEXT,
    target_notes TEXT,
    manager_notes TEXT,

    -- Approval Flow
    target_responded_at INTEGER,
    manager_reviewed_by INTEGER,
    manager_reviewed_at INTEGER,
    completed_at INTEGER,

    -- Metadata
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (requester_schedule_id) REFERENCES employee_schedules(id) ON DELETE CASCADE,
    FOREIGN KEY (target_schedule_id) REFERENCES employee_schedules(id) ON DELETE CASCADE,
    FOREIGN KEY (requester_employee_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (target_employee_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (manager_reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);
```

---

##### `employee_availability` - Employee Availability Preferences

Employees can set their availability preferences and blackout dates.

```sql
CREATE TABLE employee_availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    restaurant_id INTEGER NOT NULL,

    -- Availability Type
    availability_type TEXT NOT NULL DEFAULT 'recurring'
        CHECK (availability_type IN ('recurring', 'specific_date', 'date_range', 'blackout')),

    -- Recurring Availability (for weekly patterns)
    day_of_week INTEGER,               -- 0=Sunday, 1=Monday, ..., 6=Saturday
    start_time TEXT,                   -- "HH:MM"
    end_time TEXT,                     -- "HH:MM"

    -- Specific Date/Range
    specific_date TEXT,                -- "YYYY-MM-DD"
    date_range_start TEXT,             -- "YYYY-MM-DD"
    date_range_end TEXT,               -- "YYYY-MM-DD"

    -- Preference Level
    preference TEXT NOT NULL DEFAULT 'available'
        CHECK (preference IN ('preferred', 'available', 'limited', 'unavailable')),

    -- Notes
    notes TEXT,

    -- Settings
    is_active INTEGER NOT NULL DEFAULT 1,

    -- Metadata
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

    FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);
```

---

### Indexes & Triggers

#### Performance Indexes

```sql
-- Schedule lookups by employee and date range
CREATE INDEX idx_employee_schedules_employee_date
    ON employee_schedules(employee_id, work_date);

-- Schedule lookups by restaurant and date
CREATE INDEX idx_employee_schedules_restaurant_date
    ON employee_schedules(restaurant_id, work_date);

-- Status filtering
CREATE INDEX idx_employee_schedules_status
    ON employee_schedules(status);

-- Template lookups
CREATE INDEX idx_shift_templates_restaurant_active
    ON shift_templates(restaurant_id, is_active);

-- Conflict detection
CREATE INDEX idx_scheduling_conflicts_status
    ON scheduling_conflicts(status);

-- Availability lookups
CREATE INDEX idx_employee_availability_employee_day
    ON employee_availability(employee_id, day_of_week);

-- Swap requests
CREATE INDEX idx_swap_requests_status
    ON schedule_swap_requests(status);
```

#### Automatic Triggers

```sql
-- Update schedule updated_at timestamp
CREATE TRIGGER update_employee_schedules_updated_at
AFTER UPDATE ON employee_schedules
BEGIN
    UPDATE employee_schedules
    SET updated_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

-- Calculate actual duration when time is set
CREATE TRIGGER calculate_schedule_duration
AFTER INSERT ON employee_schedules
WHEN NEW.actual_start_time IS NOT NULL AND NEW.actual_end_time IS NOT NULL
BEGIN
    UPDATE employee_schedules
    SET actual_duration_minutes = (
        -- Simple duration calculation (handles same-day shifts)
        (strftime('%s', '1970-01-01 ' || NEW.actual_end_time) -
         strftime('%s', '1970-01-01 ' || NEW.actual_start_time)) / 60
    )
    WHERE id = NEW.id AND actual_duration_minutes IS NULL;
END;

-- Update shift template timestamp
CREATE TRIGGER update_shift_templates_updated_at
AFTER UPDATE ON shift_templates
BEGIN
    UPDATE shift_templates
    SET updated_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;
```

---

### Database Views

#### `weekly_schedule_summary` - Weekly Schedule Overview

```sql
CREATE VIEW weekly_schedule_summary AS
SELECT
    es.restaurant_id,
    es.employee_id,
    u.full_name AS employee_name,
    u.role AS employee_role,
    strftime('%Y-%W', es.work_date) AS year_week,
    COUNT(*) AS total_shifts,
    SUM(COALESCE(es.actual_duration_minutes, st.duration_minutes, 0)) AS total_minutes,
    ROUND(SUM(COALESCE(es.actual_duration_minutes, st.duration_minutes, 0)) / 60.0, 2) AS total_hours,
    MIN(es.work_date) AS week_start_date,
    MAX(es.work_date) AS week_end_date
FROM employee_schedules es
LEFT JOIN shift_templates st ON es.shift_template_id = st.id
JOIN users u ON es.employee_id = u.id
WHERE es.status IN ('scheduled', 'confirmed', 'completed')
GROUP BY es.restaurant_id, es.employee_id, year_week;
```

#### `daily_staffing_coverage` - Daily Staff Coverage Report

```sql
CREATE VIEW daily_staffing_coverage AS
SELECT
    es.restaurant_id,
    es.work_date,
    st.shift_type,
    COUNT(DISTINCT es.employee_id) AS staff_count,
    GROUP_CONCAT(u.full_name, ', ') AS staff_names,
    st.min_employees AS required_minimum,
    CASE
        WHEN COUNT(DISTINCT es.employee_id) >= COALESCE(st.min_employees, 1)
        THEN 'adequate'
        ELSE 'understaffed'
    END AS coverage_status
FROM employee_schedules es
LEFT JOIN shift_templates st ON es.shift_template_id = st.id
JOIN users u ON es.employee_id = u.id
WHERE es.status IN ('scheduled', 'confirmed')
GROUP BY es.restaurant_id, es.work_date, st.shift_type;
```

#### `active_conflicts_view` - Unresolved Conflicts

```sql
CREATE VIEW active_conflicts_view AS
SELECT
    sc.*,
    r.name AS restaurant_name,
    sr.rule_name AS violated_rule_name
FROM scheduling_conflicts sc
JOIN restaurants r ON sc.restaurant_id = r.id
LEFT JOIN scheduling_rules sr ON sc.rule_id = sr.id
WHERE sc.status IN ('open', 'acknowledged')
ORDER BY
    CASE sc.severity
        WHEN 'critical' THEN 1
        WHEN 'error' THEN 2
        WHEN 'warning' THEN 3
        ELSE 4
    END,
    sc.detected_at DESC;
```

---

## API Reference

### Base URL

```
/api/v1/schedules
```

### Authentication

All endpoints require authentication via JWT token. Role-based permissions apply:

- **Admin (0)**: Full access to all restaurants
- **Owner (1)**: Full access to own restaurant
- **Employees (2-5)**: Read-only access to own schedules

---

### Endpoints

#### 1. Create Schedule Assignment

```http
POST /api/v1/schedules

Request Body:
{
  "restaurantId": 1,
  "employeeId": 42,
  "shiftTemplateId": 5,
  "workDate": "2025-10-15",
  "assignedPosition": "chef",
  "notes": "Training new menu items"
}

Response:
{
  "success": true,
  "data": {
    "id": 123,
    "employeeId": 42,
    "employeeName": "John Doe",
    "workDate": "2025-10-15",
    "startTime": "09:00",
    "endTime": "17:00",
    "status": "scheduled",
    "createdAt": "2025-10-10T10:00:00Z"
  }
}
```

#### 2. Batch Create Weekly Schedule

```http
POST /api/v1/schedules/batch

Request Body:
{
  "restaurantId": 1,
  "weekStartDate": "2025-10-14",  // Monday
  "assignments": [
    {
      "employeeId": 42,
      "shiftTemplateId": 5,
      "daysOfWeek": [1, 2, 3, 4, 5],  // Mon-Fri
      "position": "chef"
    },
    {
      "employeeId": 43,
      "shiftTemplateId": 6,
      "daysOfWeek": [0, 6],  // Sat-Sun
      "position": "service"
    }
  ]
}

Response:
{
  "success": true,
  "data": {
    "created": 7,
    "schedules": [...],
    "conflicts": [...]  // If any detected
  }
}
```

#### 3. Get Weekly Schedule

```http
GET /api/v1/schedules/week/:date?restaurantId=1

Parameters:
  - date: YYYY-MM-DD (any day in the week)
  - restaurantId: number
  - employeeId: number (optional, filter by employee)
  - status: string (optional, filter by status)

Response:
{
  "success": true,
  "data": {
    "weekStart": "2025-10-14",
    "weekEnd": "2025-10-20",
    "schedules": [
      {
        "id": 123,
        "employeeId": 42,
        "employeeName": "John Doe",
        "role": 2,
        "roleName": "Chef",
        "workDate": "2025-10-14",
        "shiftName": "Morning Shift",
        "startTime": "09:00",
        "endTime": "17:00",
        "status": "scheduled",
        "colorCode": "#10B981"
      }
    ],
    "summary": {
      "totalShifts": 35,
      "totalEmployees": 8,
      "totalHours": 280
    }
  }
}
```

#### 4. Get Employee Schedule

```http
GET /api/v1/schedules/employee/:employeeId?from=2025-10-01&to=2025-10-31

Parameters:
  - employeeId: number
  - from: YYYY-MM-DD (start date)
  - to: YYYY-MM-DD (end date)

Response:
{
  "success": true,
  "data": {
    "employee": {
      "id": 42,
      "name": "John Doe",
      "role": 2
    },
    "schedules": [...],
    "statistics": {
      "totalShifts": 20,
      "totalHours": 160,
      "weeklyAverage": 40
    }
  }
}
```

#### 5. Update Schedule

```http
PUT /api/v1/schedules/:id

Request Body:
{
  "actualStartTime": "09:30",
  "actualEndTime": "17:30",
  "status": "confirmed",
  "notes": "Confirmed availability"
}

Response:
{
  "success": true,
  "data": { ... }
}
```

#### 6. Delete Schedule

```http
DELETE /api/v1/schedules/:id

Query Parameters:
  - reason: string (required)

Response:
{
  "success": true,
  "message": "Schedule deleted successfully"
}
```

#### 7. Copy Previous Week Schedule

```http
POST /api/v1/schedules/copy-week

Request Body:
{
  "restaurantId": 1,
  "sourceWeekStart": "2025-10-07",
  "targetWeekStart": "2025-10-14",
  "copyOptions": {
    "excludeEmployees": [43],  // Optional
    "adjustTimes": false       // Optional
  }
}

Response:
{
  "success": true,
  "data": {
    "created": 35,
    "skipped": 2,
    "conflicts": []
  }
}
```

#### 8. Detect Scheduling Conflicts

```http
POST /api/v1/schedules/conflicts/detect

Request Body:
{
  "restaurantId": 1,
  "dateFrom": "2025-10-14",
  "dateTo": "2025-10-20",
  "checkTypes": ["overlap", "rest_period", "max_hours", "role_shortage"]
}

Response:
{
  "success": true,
  "conflicts": [
    {
      "id": 1,
      "type": "rest_period",
      "severity": "error",
      "message": "John Doe has only 8 hours rest between shifts",
      "affectedSchedules": [123, 124],
      "affectedDates": ["2025-10-14", "2025-10-15"],
      "canOverride": false
    }
  ]
}
```

#### 9. Get Scheduling Statistics

```http
GET /api/v1/schedules/stats?restaurantId=1&from=2025-10-01&to=2025-10-31

Response:
{
  "success": true,
  "data": {
    "totalShifts": 150,
    "totalHours": 1200,
    "employeeStats": [
      {
        "employeeId": 42,
        "employeeName": "John Doe",
        "shiftsScheduled": 20,
        "hoursScheduled": 160,
        "utilizationRate": 0.8
      }
    ],
    "weeklyDistribution": {...},
    "shiftTypeDistribution": {...}
  }
}
```

#### 10. Submit Shift Swap Request

```http
POST /api/v1/schedules/swap-request

Request Body:
{
  "requesterScheduleId": 123,
  "targetScheduleId": 124,
  "reason": "Personal appointment on that day"
}

Response:
{
  "success": true,
  "data": {
    "swapRequestId": 1,
    "status": "pending",
    "targetEmployee": "Jane Smith",
    "requiresManagerApproval": true
  }
}
```

### Shift Templates API

```http
GET    /api/v1/schedules/templates              # List templates
POST   /api/v1/schedules/templates              # Create template
PUT    /api/v1/schedules/templates/:id          # Update template
DELETE /api/v1/schedules/templates/:id          # Delete template
```

### Scheduling Rules API

```http
GET    /api/v1/schedules/rules                  # List rules
POST   /api/v1/schedules/rules                  # Create rule
PUT    /api/v1/schedules/rules/:id              # Update rule
DELETE /api/v1/schedules/rules/:id              # Delete rule
POST   /api/v1/schedules/rules/:id/test         # Test rule
```

### Employee Availability API

```http
GET    /api/v1/schedules/availability/:employeeId     # Get availability
POST   /api/v1/schedules/availability                 # Set availability
PUT    /api/v1/schedules/availability/:id             # Update availability
DELETE /api/v1/schedules/availability/:id             # Delete availability
```

---

## Frontend Integration

### Admin Dashboard Components

#### 1. **ScheduleView.vue** - Main Scheduling Interface

```vue
<template>
  <div class="schedule-view">
    <!-- Week Navigation -->
    <div class="week-navigation">
      <el-button icon="ArrowLeft" @click="previousWeek">上週</el-button>
      <el-date-picker
        v-model="currentWeek"
        type="week"
        format="YYYY 年 第 ww 週"
        @change="onWeekChange"
      />
      <el-button icon="ArrowRight" @click="nextWeek">下週</el-button>
      <el-button type="primary" @click="showCopyWeekDialog"
        >複製上週班表</el-button
      >
    </div>

    <!-- Schedule Grid -->
    <ScheduleCalendar
      :schedules="weekSchedules"
      :employees="employees"
      :week-start="weekStart"
      @schedule-click="editSchedule"
      @cell-drop="onScheduleDrop"
    />

    <!-- Statistics Summary -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-statistic title="本週排班數" :value="weekStats.totalShifts" />
      </el-col>
      <el-col :span="6">
        <el-statistic
          title="總工時"
          :value="weekStats.totalHours"
          suffix="小時"
        />
      </el-col>
      <el-col :span="6">
        <el-statistic
          title="排班員工"
          :value="weekStats.totalEmployees"
          suffix="人"
        />
      </el-col>
      <el-col :span="6">
        <el-badge :value="conflicts.length" type="danger">
          <el-statistic title="衝突警告" :value="conflicts.length" />
        </el-badge>
      </el-col>
    </el-row>

    <!-- Conflicts Panel -->
    <ConflictAlert
      v-if="conflicts.length > 0"
      :conflicts="conflicts"
      @resolve="resolveConflict"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useScheduleStore } from "@/stores/schedule";
import type { Schedule, Employee } from "@makanmasak/shared-types";

const scheduleStore = useScheduleStore();
const currentWeek = ref(new Date());

const weekStart = computed(() => {
  // Calculate Monday of current week
  const date = new Date(currentWeek.value);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
});

const weekSchedules = ref<Schedule[]>([]);
const employees = ref<Employee[]>([]);
const conflicts = ref([]);
const weekStats = computed(() => ({
  totalShifts: weekSchedules.value.length,
  totalHours: weekSchedules.value.reduce(
    (sum, s) => sum + s.durationMinutes / 60,
    0,
  ),
  totalEmployees: new Set(weekSchedules.value.map((s) => s.employeeId)).size,
}));

onMounted(async () => {
  await loadWeekSchedule();
  await loadEmployees();
});

async function loadWeekSchedule() {
  const response = await fetch(
    `/api/v1/schedules/week/${weekStart.value.toISOString().split("T")[0]}?restaurantId=${scheduleStore.restaurantId}`,
  );
  const result = await response.json();
  weekSchedules.value = result.data.schedules;

  // Check for conflicts
  await checkConflicts();
}

async function checkConflicts() {
  const response = await fetch("/api/v1/schedules/conflicts/detect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      restaurantId: scheduleStore.restaurantId,
      dateFrom: weekStart.value.toISOString().split("T")[0],
      dateTo: addDays(weekStart.value, 6).toISOString().split("T")[0],
    }),
  });
  const result = await response.json();
  conflicts.value = result.conflicts;
}

function previousWeek() {
  currentWeek.value = addDays(currentWeek.value, -7);
  loadWeekSchedule();
}

function nextWeek() {
  currentWeek.value = addDays(currentWeek.value, 7);
  loadWeekSchedule();
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
</script>
```

#### 2. **ScheduleCalendar.vue** - Weekly Grid Component

```vue
<template>
  <div class="schedule-calendar">
    <table class="schedule-table">
      <thead>
        <tr>
          <th>員工</th>
          <th v-for="day in 7" :key="day">
            {{ getDayLabel(day - 1) }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="employee in employees" :key="employee.id">
          <td class="employee-cell">
            <div class="employee-info">
              <span class="employee-name">{{ employee.fullName }}</span>
              <el-tag :type="getRoleTagType(employee.role)" size="small">
                {{ getRoleLabel(employee.role) }}
              </el-tag>
            </div>
          </td>
          <td
            v-for="day in 7"
            :key="`${employee.id}-${day}`"
            class="schedule-cell"
            @drop="onDrop($event, employee.id, day - 1)"
            @dragover.prevent
          >
            <ScheduleCard
              v-for="schedule in getSchedulesForEmployeeDay(
                employee.id,
                day - 1,
              )"
              :key="schedule.id"
              :schedule="schedule"
              draggable="true"
              @dragstart="onDragStart($event, schedule)"
              @click="$emit('schedule-click', schedule)"
            />
            <el-button
              v-if="!hasSchedule(employee.id, day - 1)"
              type="primary"
              text
              size="small"
              @click="addSchedule(employee.id, day - 1)"
            >
              + 新增排班
            </el-button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Schedule, Employee } from "@makanmasak/shared-types";

const props = defineProps<{
  schedules: Schedule[];
  employees: Employee[];
  weekStart: Date;
}>();

const emit = defineEmits<{
  scheduleClick: [schedule: Schedule];
  cellDrop: [employeeId: number, dayOffset: number, schedule: Schedule];
}>();

function getDayLabel(dayOffset: number): string {
  const days = ["週一", "週二", "週三", "週四", "週五", "週六", "週日"];
  const date = new Date(props.weekStart);
  date.setDate(date.getDate() + dayOffset);
  return `${days[dayOffset]} ${date.getMonth() + 1}/${date.getDate()}`;
}

function getSchedulesForEmployeeDay(
  employeeId: number,
  dayOffset: number,
): Schedule[] {
  const targetDate = new Date(props.weekStart);
  targetDate.setDate(targetDate.getDate() + dayOffset);
  const dateStr = targetDate.toISOString().split("T")[0];

  return props.schedules.filter(
    (s) => s.employeeId === employeeId && s.workDate === dateStr,
  );
}

let draggedSchedule: Schedule | null = null;

function onDragStart(event: DragEvent, schedule: Schedule) {
  draggedSchedule = schedule;
  event.dataTransfer!.effectAllowed = "move";
}

function onDrop(event: DragEvent, employeeId: number, dayOffset: number) {
  event.preventDefault();
  if (draggedSchedule) {
    emit("cellDrop", employeeId, dayOffset, draggedSchedule);
    draggedSchedule = null;
  }
}
</script>

<style scoped>
.schedule-table {
  width: 100%;
  border-collapse: collapse;
}

.schedule-table th,
.schedule-table td {
  border: 1px solid #e5e7eb;
  padding: 12px;
  text-align: center;
}

.schedule-cell {
  min-height: 80px;
  vertical-align: top;
  background-color: #f9fafb;
}

.schedule-cell:hover {
  background-color: #f3f4f6;
}
</style>
```

#### 3. **ShiftTemplateManager.vue** - Shift Template Management

```vue
<template>
  <el-dialog v-model="visible" title="班次模板管理" width="800px">
    <el-button type="primary" @click="showCreateDialog">新增班次模板</el-button>

    <el-table :data="templates" style="margin-top: 20px">
      <el-table-column prop="name" label="班次名稱" />
      <el-table-column prop="startTime" label="開始時間" />
      <el-table-column prop="endTime" label="結束時間" />
      <el-table-column label="時長">
        <template #default="{ row }">
          {{ (row.durationMinutes / 60).toFixed(1) }} 小時
        </template>
      </el-table-column>
      <el-table-column label="類型">
        <template #default="{ row }">
          <el-tag :color="row.colorCode">
            {{ getShiftTypeLabel(row.shiftType) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <el-button size="small" @click="editTemplate(row)">編輯</el-button>
          <el-button size="small" type="danger" @click="deleteTemplate(row.id)">
            刪除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- Create/Edit Dialog -->
    <el-dialog
      v-model="formVisible"
      :title="formMode === 'create' ? '新增班次' : '編輯班次'"
    >
      <el-form :model="form" label-width="120px">
        <el-form-item label="班次名稱">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="開始時間">
          <el-time-picker v-model="form.startTime" format="HH:mm" />
        </el-form-item>
        <el-form-item label="結束時間">
          <el-time-picker v-model="form.endTime" format="HH:mm" />
        </el-form-item>
        <el-form-item label="班次類型">
          <el-select v-model="form.shiftType">
            <el-option label="早班" value="morning" />
            <el-option label="晚班" value="evening" />
            <el-option label="夜班" value="night" />
            <el-option label="分段班" value="split" />
          </el-select>
        </el-form-item>
        <el-form-item label="顏色">
          <el-color-picker v-model="form.colorCode" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" @click="saveTemplate">保存</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { ShiftTemplate } from "@makanmasak/shared-types";

const visible = defineModel<boolean>({ required: true });
const templates = ref<ShiftTemplate[]>([]);
const formVisible = ref(false);
const formMode = ref<"create" | "edit">("create");
const form = ref({
  name: "",
  startTime: "",
  endTime: "",
  shiftType: "regular",
  colorCode: "#3B82F6",
});

onMounted(async () => {
  await loadTemplates();
});

async function loadTemplates() {
  const response = await fetch("/api/v1/schedules/templates?restaurantId=1");
  const result = await response.json();
  templates.value = result.data;
}

function showCreateDialog() {
  formMode.value = "create";
  form.value = {
    name: "",
    startTime: "",
    endTime: "",
    shiftType: "regular",
    colorCode: "#3B82F6",
  };
  formVisible.value = true;
}

async function saveTemplate() {
  const url =
    formMode.value === "create"
      ? "/api/v1/schedules/templates"
      : `/api/v1/schedules/templates/${form.value.id}`;

  const response = await fetch(url, {
    method: formMode.value === "create" ? "POST" : "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form.value),
  });

  if (response.ok) {
    ElMessage.success("保存成功");
    formVisible.value = false;
    await loadTemplates();
  }
}
</script>
```

#### 4. **ConflictAlert.vue** - Conflict Warning Component

```vue
<template>
  <el-alert
    v-for="conflict in conflicts"
    :key="conflict.id"
    :type="getAlertType(conflict.severity)"
    :title="conflict.message"
    :description="conflict.conflictDetails"
    show-icon
    :closable="conflict.canOverride"
    class="conflict-alert"
  >
    <template #default>
      <div class="conflict-actions">
        <el-button
          v-if="conflict.canOverride"
          size="small"
          type="warning"
          @click="$emit('override', conflict.id)"
        >
          強制執行
        </el-button>
        <el-button size="small" @click="viewDetails(conflict)">
          查看詳情
        </el-button>
        <el-button
          size="small"
          type="primary"
          @click="$emit('resolve', conflict.id)"
        >
          標記已解決
        </el-button>
      </div>
    </template>
  </el-alert>
</template>

<script setup lang="ts">
import type { SchedulingConflict } from "@makanmasak/shared-types";

defineProps<{
  conflicts: SchedulingConflict[];
}>();

defineEmits<{
  resolve: [conflictId: number];
  override: [conflictId: number];
}>();

function getAlertType(
  severity: string,
): "success" | "info" | "warning" | "error" {
  const map: Record<string, any> = {
    info: "info",
    warning: "warning",
    error: "error",
    critical: "error",
  };
  return map[severity] || "info";
}
</script>
```

---

## Business Logic

### Conflict Detection Engine

#### Conflict Types

1. **Shift Overlap**: Employee scheduled for overlapping time periods
2. **Insufficient Rest**: Less than minimum rest hours between shifts
3. **Excessive Hours**: Weekly hours exceed maximum limit
4. **Double Booking**: Employee scheduled multiple times on same day
5. **Role Shortage**: Required role not adequately covered
6. **Availability Conflict**: Scheduled during employee's unavailable time

#### Detection Algorithm

```typescript
// services/ConflictDetectionService.ts
export class ConflictDetectionService {
  async detectConflicts(
    restaurantId: number,
    dateFrom: string,
    dateTo: string,
  ): Promise<SchedulingConflict[]> {
    const conflicts: SchedulingConflict[] = [];

    // Get schedules for date range
    const schedules = await this.getSchedulesInRange(
      restaurantId,
      dateFrom,
      dateTo,
    );

    // Get active rules
    const rules = await this.getActiveRules(restaurantId);

    // Check each rule type
    for (const rule of rules) {
      switch (rule.ruleType) {
        case "rest_period":
          conflicts.push(...(await this.checkRestPeriod(schedules, rule)));
          break;
        case "max_hours":
          conflicts.push(...(await this.checkMaxHours(schedules, rule)));
          break;
        case "overlap":
          conflicts.push(...(await this.checkOverlap(schedules)));
          break;
        case "role_required":
          conflicts.push(...(await this.checkRoleRequirement(schedules, rule)));
          break;
      }
    }

    return conflicts;
  }

  private async checkRestPeriod(
    schedules: Schedule[],
    rule: SchedulingRule,
  ): Promise<SchedulingConflict[]> {
    const conflicts: SchedulingConflict[] = [];
    const minRestHours = rule.ruleConfig.min_rest_hours || 11;

    // Group by employee
    const byEmployee = schedules.reduce(
      (acc, s) => {
        if (!acc[s.employeeId]) acc[s.employeeId] = [];
        acc[s.employeeId].push(s);
        return acc;
      },
      {} as Record<number, Schedule[]>,
    );

    // Check consecutive shifts for each employee
    for (const [employeeId, empSchedules] of Object.entries(byEmployee)) {
      const sorted = empSchedules.sort(
        (a, b) =>
          new Date(a.workDate + " " + a.startTime).getTime() -
          new Date(b.workDate + " " + b.startTime).getTime(),
      );

      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];

        const endTime = new Date(current.workDate + " " + current.endTime);
        const startTime = new Date(next.workDate + " " + next.startTime);

        const restHours =
          (startTime.getTime() - endTime.getTime()) / (1000 * 60 * 60);

        if (restHours < minRestHours) {
          conflicts.push({
            conflictType: "rest_period",
            severity: "error",
            scheduleIds: [current.id, next.id],
            employeeIds: [employeeId],
            workDates: [current.workDate, next.workDate],
            message: `員工休息時間不足 (${restHours.toFixed(1)} 小時 < ${minRestHours} 小時)`,
            ruleId: rule.id,
            canOverride: !rule.isMandatory,
          });
        }
      }
    }

    return conflicts;
  }

  private async checkMaxHours(
    schedules: Schedule[],
    rule: SchedulingRule,
  ): Promise<SchedulingConflict[]> {
    const conflicts: SchedulingConflict[] = [];
    const maxWeeklyHours = rule.ruleConfig.max_weekly_hours || 48;

    // Group by employee and week
    const byEmployeeWeek = schedules.reduce(
      (acc, s) => {
        const weekKey = getWeekKey(s.workDate);
        const key = `${s.employeeId}-${weekKey}`;
        if (!acc[key])
          acc[key] = { employeeId: s.employeeId, schedules: [], week: weekKey };
        acc[key].schedules.push(s);
        return acc;
      },
      {} as Record<
        string,
        { employeeId: number; schedules: Schedule[]; week: string }
      >,
    );

    for (const [key, data] of Object.entries(byEmployeeWeek)) {
      const totalHours = data.schedules.reduce(
        (sum, s) => sum + (s.durationMinutes || 0) / 60,
        0,
      );

      if (totalHours > maxWeeklyHours) {
        conflicts.push({
          conflictType: "max_hours",
          severity: "warning",
          scheduleIds: data.schedules.map((s) => s.id),
          employeeIds: [data.employeeId],
          workDates: data.schedules.map((s) => s.workDate),
          message: `週工時超過上限 (${totalHours.toFixed(1)} 小時 > ${maxWeeklyHours} 小時)`,
          ruleId: rule.id,
          canOverride: !rule.isMandatory,
        });
      }
    }

    return conflicts;
  }
}

function getWeekKey(date: string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const week = getWeekNumber(d);
  return `${year}-W${week.toString().padStart(2, "0")}`;
}

function getWeekNumber(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
```

---

## Use Cases

### 1. Create Weekly Schedule from Template

**Scenario**: Restaurant manager wants to create next week's schedule based on standard patterns.

**Steps**:

1. Manager navigates to Schedule View
2. Selects next week
3. Clicks "Copy Previous Week"
4. System copies schedules and checks for conflicts
5. Manager reviews conflicts and makes adjustments
6. Saves schedule
7. System notifies employees

### 2. Handle Employee Time-Off Request

**Scenario**: Employee requests a day off that conflicts with scheduled shift.

**Integration with Leave Management**:

```typescript
// When leave request is approved
async function handleLeaveApproval(leaveRequest: LeaveRequest) {
  // Find conflicting schedules
  const conflicts = await scheduleService.findSchedulesByEmployeeAndDate(
    leaveRequest.employeeId,
    leaveRequest.startDate,
    leaveRequest.endDate,
  );

  if (conflicts.length > 0) {
    // Mark schedules as need replacement
    for (const schedule of conflicts) {
      await scheduleService.updateSchedule(schedule.id, {
        status: "cancelled",
        notes: `Cancelled due to approved leave request #${leaveRequest.id}`,
      });

      // Create notification for manager
      await notificationService.create({
        type: "schedule_gap",
        message: `${schedule.employeeName} 的排班因請假而取消，需要安排替代人員`,
        scheduleId: schedule.id,
        priority: "high",
      });
    }
  }
}
```

### 3. Shift Swap Between Employees

**Scenario**: Two employees want to swap their shifts.

**Workflow**:

```
Employee A (Requester)
    ↓ Creates swap request
System checks compatibility
    ↓ Notifies Employee B
Employee B responds
    ↓ Accepts
Manager reviews (if required)
    ↓ Approves
System executes swap
    ↓ Updates schedules
Both employees notified
```

### 4. Emergency Schedule Change

**Scenario**: Employee calls in sick, manager needs to find replacement.

**Steps**:

1. Manager marks schedule as "no show"
2. System suggests available employees based on:
   - Availability preferences
   - Not scheduled
   - Matching role/skills
   - No conflicts
3. Manager selects replacement
4. System checks for conflicts
5. If clear, assigns new employee
6. Notifies new employee

---

## Best Practices

### 1. Schedule Planning

**Recommended Timeline**:

- Create schedules **2 weeks in advance**
- Allow employees to submit availability **3 weeks ahead**
- Finalize schedules **1 week before** week starts
- Notify employees immediately after finalization

### 2. Conflict Prevention

**Proactive Measures**:

```typescript
// Before creating schedule, check conflicts
async function createScheduleWithValidation(data: CreateScheduleRequest) {
  // Pre-check conflicts
  const potentialConflicts = await conflictService.detectConflicts({
    restaurantId: data.restaurantId,
    dateFrom: data.workDate,
    dateTo: data.workDate,
    tentativeSchedule: data, // Check against tentative schedule
  });

  if (potentialConflicts.some((c) => c.severity === "error")) {
    throw new ValidationError(
      "Cannot create schedule due to blocking conflicts",
      {
        conflicts: potentialConflicts,
      },
    );
  }

  // Proceed with creation
  return await scheduleRepository.create(data);
}
```

### 3. Performance Optimization

**For large restaurants** (30+ employees):

```typescript
// Use pagination for weekly view
const PAGE_SIZE = 20;

// Cache employee list
const employees = await redis.get(`employees:${restaurantId}`);
if (!employees) {
  employees = await userService.getRestaurantEmployees(restaurantId);
  await redis.set(`employees:${restaurantId}`, employees, "EX", 3600);
}

// Load schedules in batches
const schedules = await scheduleService.getWeekSchedules(
  restaurantId,
  weekStart,
  {
    page: 1,
    limit: PAGE_SIZE,
  },
);
```

### 4. Mobile Responsiveness

**Employee Schedule View**:

- Use list view instead of grid on mobile
- Provide swipe gestures for week navigation
- Large touch targets for actions
- Simplified interface with essential info only

---

## Testing Strategy

### Unit Tests

```typescript
// __tests__/services/ScheduleService.test.ts
describe("ScheduleService", () => {
  describe("createSchedule", () => {
    it("should create schedule with valid data", async () => {
      const scheduleData = {
        restaurantId: 1,
        employeeId: 42,
        shiftTemplateId: 5,
        workDate: "2025-10-15",
      };

      const result = await scheduleService.createSchedule(scheduleData);

      expect(result.success).toBe(true);
      expect(result.data.workDate).toBe("2025-10-15");
    });

    it("should reject overlapping schedules", async () => {
      // Create first schedule
      await scheduleService.createSchedule({
        employeeId: 42,
        workDate: "2025-10-15",
        actualStartTime: "09:00",
        actualEndTime: "17:00",
      });

      // Attempt overlapping schedule
      await expect(
        scheduleService.createSchedule({
          employeeId: 42,
          workDate: "2025-10-15",
          actualStartTime: "14:00",
          actualEndTime: "22:00",
        }),
      ).rejects.toThrow("Overlapping schedule detected");
    });
  });

  describe("copyWeekSchedule", () => {
    it("should copy all schedules to new week", async () => {
      const result = await scheduleService.copyWeekSchedule({
        sourceWeekStart: "2025-10-07",
        targetWeekStart: "2025-10-14",
        restaurantId: 1,
      });

      expect(result.created).toBeGreaterThan(0);
      expect(result.conflicts).toEqual([]);
    });
  });
});
```

### Integration Tests

```typescript
// __tests__/integration/scheduling-workflow.test.ts
describe("Scheduling Workflow", () => {
  it("should complete full schedule creation workflow", async () => {
    // 1. Create shift template
    const template = await shiftTemplateService.create({
      restaurantId: 1,
      name: "Test Shift",
      startTime: "09:00",
      endTime: "17:00",
    });

    // 2. Create schedule using template
    const schedule = await scheduleService.create({
      restaurantId: 1,
      employeeId: 42,
      shiftTemplateId: template.id,
      workDate: "2025-10-15",
    });

    // 3. Verify schedule was created
    expect(schedule.id).toBeDefined();

    // 4. Check conflicts
    const conflicts = await conflictService.detect({
      restaurantId: 1,
      dateFrom: "2025-10-15",
      dateTo: "2025-10-15",
    });

    expect(conflicts).toEqual([]);

    // 5. Confirm schedule
    await scheduleService.update(schedule.id, { status: "confirmed" });

    // 6. Verify employee was notified
    const notifications = await notificationService.getForUser(42);
    expect(notifications.some((n) => n.type === "schedule_assigned")).toBe(
      true,
    );
  });
});
```

---

## Migration Guide

### Database Migration

**File**: `packages/database/migrations/0034_employee_scheduling_system.sql`

**Steps**:

1. Run migration in local environment first
2. Test all CRUD operations
3. Verify triggers and views work correctly
4. Deploy to staging
5. Test with real-world data patterns
6. Deploy to production during low-traffic period

### Data Migration from Legacy System

If migrating from existing scheduling system:

```typescript
// scripts/migrate-schedules.ts
async function migrateLegacySchedules() {
  const legacySchedules = await oldDb.query("SELECT * FROM old_schedules");

  for (const legacy of legacySchedules) {
    const newSchedule = {
      restaurantId: legacy.restaurant_id,
      employeeId: legacy.staff_id,
      workDate: legacy.work_date,
      actualStartTime: legacy.start_time,
      actualEndTime: legacy.end_time,
      status: mapOldStatus(legacy.status),
      notes: legacy.remarks,
    };

    try {
      await scheduleService.create(newSchedule);
      console.log(`Migrated schedule ${legacy.id}`);
    } catch (error) {
      console.error(`Failed to migrate schedule ${legacy.id}:`, error);
      // Log to migration errors table
      await logMigrationError(legacy.id, error);
    }
  }
}
```

---

## Troubleshooting

### Issue: Schedule creation fails with "Conflict detected"

**Cause**: Conflicting schedule or rule violation

**Solution**:

```typescript
// Get detailed conflict information
const conflicts = await conflictService.detect({
  restaurantId: 1,
  dateFrom: workDate,
  dateTo: workDate,
  employeeIds: [employeeId],
});

console.log("Conflicts:", conflicts);

// Check if can override
if (conflicts.every((c) => c.canOverride)) {
  // Create with override flag
  await scheduleService.create(data, { overrideConflicts: true });
}
```

### Issue: Week copy creates duplicate schedules

**Cause**: Target week already has schedules

**Solution**:

```typescript
// Check existing schedules first
const existing = await scheduleService.getWeekSchedules(
  restaurantId,
  targetWeekStart,
);
if (existing.length > 0) {
  // Prompt user
  const confirmed = await confirm(
    `目標週已有 ${existing.length} 個排班記錄，確定要覆蓋嗎？`,
  );
  if (confirmed) {
    await scheduleService.deleteWeekSchedules(restaurantId, targetWeekStart);
  } else {
    return;
  }
}
```

### Issue: Conflict detection is slow

**Cause**: Large number of schedules to check

**Solution**:

```typescript
// Optimize with indexes and selective checking
const conflicts = await conflictService.detect({
  restaurantId,
  dateFrom,
  dateTo,
  checkTypes: ["rest_period", "max_hours"], // Only check critical rules
  employeeIds: changedEmployeeIds, // Only check affected employees
});
```

---

## Performance Metrics

### Target Performance

- **Schedule Creation**: < 200ms
- **Weekly Schedule Load**: < 500ms for 50 employees
- **Conflict Detection**: < 1s for 200 schedules
- **Week Copy**: < 2s for full week

### Monitoring

```typescript
// Track scheduling operations
await metrics.track("schedule.created", {
  restaurantId,
  employeeId,
  duration: Date.now() - startTime,
});

await metrics.track("conflict.detected", {
  count: conflicts.length,
  severity: conflicts.map((c) => c.severity),
});
```

---

## Security Considerations

### Access Control

```typescript
// Middleware for schedule operations
export const scheduleAccessControl = async (req, res, next) => {
  const user = req.user;
  const { restaurantId, employeeId } = req.body;

  // Admin can access all
  if (user.role === 0) return next();

  // Owner can only access own restaurant
  if (user.role === 1 && user.restaurantId === restaurantId) {
    return next();
  }

  // Employee can only view own schedules
  if (employeeId === user.id && req.method === "GET") {
    return next();
  }

  return res.status(403).json({ error: "Access denied" });
};
```

### Data Privacy

- Employees can only view their own schedules
- Schedule swap requests are private between involved parties
- Manager notes are not visible to employees

---

## References

- **Migration File**: `packages/database/migrations/0034_employee_scheduling_system.sql`
- **Schema**: `packages/database/src/schema/schedules.ts`
- **Service**: `packages/database/src/services/schedule.ts`
- **Types**: `packages/shared-types/src/schedule.ts`
- **API Routes**: `apps/api/src/routes/schedules.ts`
- **UI Components**: `apps/admin-dashboard/src/components/schedule/`

---

**Document Version**: 1.0
**Last Updated**: 2025-10-10
**Status**: 📋 Design Document - Ready for Implementation

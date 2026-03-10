### 📅 Employee Scheduling System (Completed: 2025-10-10)

**Status**: ✅ Database Schema & Technical Design Complete | ⏸️ API Implementation Pending

Implemented comprehensive employee work scheduling system with **Taiwan Labor Standards Act** compliance.

#### Features Implemented:

**1. Shift Template Management**:

- Reusable shift templates (早班, 午班, 晚班, 全日班)
- Configurable shift times, durations, and break periods
- Support for split shifts and overnight shifts
- Applicable days configuration (weekdays, weekends, specific days)
- Color-coded visualization with custom icons

**2. Employee Schedule Assignment**:

- Weekly and monthly schedule planning
- Individual and batch schedule creation
- Clock in/out time tracking
- Actual work hours calculation with overtime tracking
- Schedule status management (scheduled, confirmed, completed, cancelled, no_show)

**3. Scheduling Rules Engine**:

- **Taiwan Labor Law Compliance**:
  - Max 12 hours per day (normal + overtime)
  - Max 40 hours per week (regular), 46 hours (with overtime)
  - Minimum 11-hour rest period between shifts
  - Max 6 consecutive work days, 2 rest days per week required
- Custom restaurant-specific rules
- Priority-based rule evaluation
- Configurable severity levels (error, warning, info)

**4. Conflict Detection & Resolution**:

- Real-time conflict detection during schedule creation
- Automatic conflict alerts with detailed explanations
- Multiple conflict types:
  - Overlapping shifts
  - Insufficient rest periods
  - Maximum work hours exceeded
  - Consecutive work days exceeded
  - Skill mismatches
  - Leave request conflicts
- Conflict resolution workflow with acknowledgment tracking

**5. Shift Swap Requests**:

- Employee-initiated shift swap requests
- Three request types: swap, cover, drop
- Target employee selection or open broadcast
- Manager approval workflow
- Request expiration handling
- Automatic schedule updates upon approval

**6. Employee Availability Management**:

- Preferred/unavailable time slots
- Recurring weekly availability patterns
- Specific date range restrictions
- Flexible scheduling preferences

#### Database Schema:

```sql
shift_templates:
  - Restaurant-specific shift definitions
  - Time settings (start, end, duration, breaks)
  - Applicable days and employee limits
  - Hourly rate and overtime multiplier

employee_schedules:
  - Work date and shift assignment
  - Clock in/out tracking
  - Actual vs scheduled hours
  - Status and confirmation workflow

scheduling_rules:
  - Rule type and configuration (JSON)
  - Applies to roles/employees
  - Priority and severity settings
  - Taiwan Labor Law system rules

scheduling_conflicts:
  - Conflict type and severity
  - Related schedules and employees
  - Resolution status and notes
  - Auto-detected timestamps

schedule_swap_requests:
  - Requester and target information
  - Swap type (swap/cover/drop)
  - Approval workflow tracking
  - Expiration management

employee_availability:
  - Day of week or date range
  - Time slot preferences
  - Recurring patterns
  - Active/inactive status

Views:
  - weekly_schedule_summary
  - daily_staffing_coverage
  - active_conflicts_view
  - employee_weekly_hours
  - pending_swap_requests
```

#### Taiwan Labor Law Rules (Built-in):

```
✅ 每日最大工時限制 (Max 12 hours per day)
✅ 每週最大工時限制 (Max 40-46 hours per week)
✅ 最短休息時間 (Min 11 hours rest between shifts)
✅ 連續工作天數限制 (Max 6 consecutive days, 2 rest days/week required)
```

#### Use Cases:

- **Restaurant Chains**: Centralized schedule management across multiple locations
- **Part-time Staff**: Flexible scheduling with availability constraints
- **Compliance**: Automatic labor law violation detection
- **Staff Communication**: Shift swap requests reduce manager workload
- **Analytics**: Staffing coverage analysis and optimization

**Files**:

- Migration: `packages/database/migrations/0034_employee_scheduling_system.sql`
- Documentation: `docs/EMPLOYEE_SCHEDULING_IMPLEMENTATION.md` (900+ lines)

**Next Steps**: API service layer implementation and Admin Dashboard UI

---

### 🏖️ Leave Management System (Completed: 2025-10-10)

**Status**: ✅ Database Schema & Technical Design Complete | ⏸️ API Implementation Pending

Implemented comprehensive employee leave (排休) management system with **Taiwan Labor Standards Act** compliance and 10 pre-configured leave types.

#### Features Implemented:

**1. Leave Type Management (10 Types Pre-configured)**:

- **年假 (Annual Leave)**: 3-30 days based on seniority, paid, carryover allowed
- **病假 (Sick Leave)**: 30 days/year, half-pay, requires documentation >2 days
- **事假 (Personal Leave)**: 14 days/year, unpaid
- **婚假 (Marriage Leave)**: 8 days, paid, one-time
- **喪假 (Bereavement Leave)**: 3-8 days based on relationship, paid
- **產假 (Maternity Leave)**: 56 days (8 weeks), paid, female only
- **陪產假 (Paternity Leave)**: 7 days, paid, male only
- **家庭照顧假 (Family Care Leave)**: 7 days/year, unpaid
- **公假 (Official Leave)**: Varies, paid, requires documentation
- **生理假 (Menstrual Leave)**: 12 days/year (3 days full-pay + 9 half-pay), female only

**2. Leave Balance Tracking**:

- Automatic annual leave accrual based on seniority
- Monthly or yearly accrual cycles
- Carryover management with expiration dates
- Manual adjustment capability with audit trail
- Real-time balance calculation (total - used - pending = remaining)
- Multi-year balance history

**3. Leave Request Workflow**:

- Full-day and half-day (AM/PM) support
- Reason and documentation attachment
- Multi-level approval chain configuration
- Auto-escalation after timeout
- Request status tracking (pending, approved, rejected, cancelled, withdrawn)
- Integration with work schedules for conflict detection

**4. Approval Rules Engine**:

- Configurable approval levels per leave type
- Role-based approvers (owner, admin) or specific users
- Conditional auto-approval rules
- Notification triggers for all workflow events
- Priority-based rule evaluation

**5. Public Holiday Calendar**:

- **2025 Taiwan Public Holidays** pre-loaded (19 holidays):
  - 開國紀念日, 春節 (7 days), 和平紀念日
  - 兒童節/清明節, 勞動節, 端午節
  - 中秋節, 國慶日
  - Including adjusted holidays and compensatory days
- Recurring annual holidays
- Company-specific holiday management

**6. Schedule Integration**:

- Automatic detection of leave-schedule conflicts
- Cancellation of conflicting work schedules upon approval
- Replacement staff notification workflow
- Leave calendar view (30-day upcoming)

#### Database Schema:

```sql
leave_types:
  - Code and name (10 types pre-configured)
  - Accrual rules (yearly/monthly/none)
  - Usage rules (approval levels, notice days, documentation)
  - Payment status and carryover settings
  - Gender restrictions (maternity, paternity, menstrual)

employee_leave_balances:
  - Employee-year-leavetype unique tracking
  - Total, used, pending, remaining days (auto-calculated)
  - Carryover from previous year with expiration
  - Manual adjustment with audit trail

leave_requests:
  - Date range with AM/PM periods
  - Days count calculation (supports 0.5 days)
  - Approval chain (JSON) with current level tracking
  - Final approver and timestamp
  - Cancellation workflow
  - Schedule conflict resolution tracking

leave_approval_rules:
  - Per leave type or global rules
  - Approval level configuration
  - Role or specific user approvers
  - Auto-approval conditions (JSON)
  - Auto-escalation timeout settings

leave_calendar_events:
  - Public/company/special holidays
  - Recurring annual events
  - Restaurant-specific or system-wide
  - Compensatory day mappings

Views:
  - current_year_leave_balances
  - pending_leave_requests
  - monthly_leave_statistics
  - expiring_leave_balances
  - upcoming_leave_calendar
```

#### Taiwan Labor Law Leave Types (Pre-configured):

```
✅ 年假 (Annual Leave): Based on seniority, 3-30 days
✅ 病假 (Sick Leave): 30 days/year, half-pay
✅ 事假 (Personal Leave): 14 days/year, unpaid
✅ 婚假 (Marriage Leave): 8 days, paid
✅ 喪假 (Bereavement Leave): 3-8 days, paid
✅ 產假 (Maternity Leave): 56 days (8 weeks), paid
✅ 陪產假 (Paternity Leave): 7 days, paid
✅ 家庭照顧假 (Family Care Leave): 7 days/year, unpaid
✅ 公假 (Official Leave): Varies, paid
✅ 生理假 (Menstrual Leave): 12 days/year, mixed pay
```

#### 2025 Taiwan Public Holidays (19 Days Pre-loaded):

```
🎉 開國紀念日 (1/1)
🧧 春節連假 (1/28-2/3, 7 days)
🕊️ 和平紀念日 (2/28)
🌸 兒童節/清明節 (4/4-4/7, 4 days)
⚒️ 勞動節 (5/1)
🚣 端午節 (5/31-6/2, 3 days)
🥮 中秋節 (10/6-10/8, 3 days)
🇹🇼 國慶日 (10/10-10/12, 3 days)
```

#### Use Cases:

- **Annual Leave Planning**: Automatic accrual based on employee seniority
- **Sick Leave Tracking**: Half-pay calculation and documentation requirements
- **Family Events**: Marriage, bereavement, maternity, paternity leaves
- **Compliance**: Taiwan Labor Standards Act full compliance
- **Multi-level Approval**: Flexible approval workflows for different leave types
- **Holiday Planning**: Public holiday calendar integration

**Files**:

- Migration: `packages/database/migrations/0035_leave_management_system.sql`
- Documentation: `docs/LEAVE_MANAGEMENT_IMPLEMENTATION.md` (800+ lines)

**Next Steps**: API service layer implementation and Admin Dashboard UI

---

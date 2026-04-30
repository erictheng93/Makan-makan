# Employee Management Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate scheduling and leave management into the unified employee management view with 4 tabs.

**Architecture:** Frontend-only change. Three sidebar items become one. Two standalone views become tab children of EmployeeManagementView. All new components follow Apple-Native Soft Minimalism design system. Backend API routes unchanged.

**Tech Stack:** Vue 3 + TypeScript, Vue Router, Tailwind CSS, Lucide Icons, vue-i18n

**Spec:** `docs/superpowers/specs/2026-03-26-employee-management-consolidation-design.md`

---

## File Structure

### Modified Files

| File                                                                  | Change                                         |
| --------------------------------------------------------------------- | ---------------------------------------------- |
| `apps/admin-dashboard/src/router/index.ts`                            | Add scheduling/leaves child routes + redirects |
| `apps/admin-dashboard/src/components/layout/Sidebar.vue`              | Remove scheduling + leaves sidebar items       |
| `apps/admin-dashboard/src/views/employees/EmployeeManagementView.vue` | Add scheduling + leaves tabs                   |
| `apps/admin-dashboard/src/i18n/locales/en-US.ts`                      | Add new tab i18n keys                          |
| `apps/admin-dashboard/src/i18n/locales/zh-TW.ts`                      | Add new tab i18n keys                          |

### New Files

| File                                                                        | Responsibility                                                  |
| --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `apps/admin-dashboard/src/services/leavesService.ts`                        | Leaves API client (extracted from LeaveView)                    |
| `apps/admin-dashboard/src/views/employees/SchedulingTab.vue`                | Scheduling tab container: week/month toggle, data orchestration |
| `apps/admin-dashboard/src/views/employees/LeavesTab.vue`                    | Leaves tab container: sub-tab switching                         |
| `apps/admin-dashboard/src/components/scheduling/SchedulingCalendarGrid.vue` | Week/month calendar grid with drop targets                      |
| `apps/admin-dashboard/src/components/scheduling/UnassignedSidebar.vue`      | Employee list with availability status + drag source            |
| `apps/admin-dashboard/src/components/scheduling/ShiftTemplateManager.vue`   | Template CRUD dialog                                            |
| `apps/admin-dashboard/src/components/scheduling/SchedulingConflictBar.vue`  | Bottom warning bar                                              |
| `apps/admin-dashboard/src/components/leaves/LeaveApprovalQueue.vue`         | Approval card list                                              |
| `apps/admin-dashboard/src/components/leaves/LeaveDecisionCard.vue`          | Single decision card with intelligence                          |
| `apps/admin-dashboard/src/components/leaves/LeaveTimelineStrip.vue`         | 7-day inline timeline                                           |
| `apps/admin-dashboard/src/components/leaves/LeaveBalanceOverview.vue`       | All-employee balance table                                      |
| `apps/admin-dashboard/src/components/leaves/LeaveHistoryList.vue`           | Filtered leave history                                          |

---

## Task 1: Routing, Sidebar, and Tab Navigation

Wire up the structural shell so the 4-tab layout works with empty placeholder content before building the actual tab UIs.

**Files:**

- Modify: `apps/admin-dashboard/src/router/index.ts:108-151,273-292`
- Modify: `apps/admin-dashboard/src/components/layout/Sidebar.vue:208-221`
- Modify: `apps/admin-dashboard/src/views/employees/EmployeeManagementView.vue:96-198`
- Modify: `apps/admin-dashboard/src/i18n/locales/en-US.ts` (employees.tabs section)
- Modify: `apps/admin-dashboard/src/i18n/locales/zh-TW.ts` (employees.tabs section)

- [ ] **Step 1: Add i18n keys for new tabs**

In both `en-US.ts` and `zh-TW.ts`, find the `employees.tabs` section and add keys:

```typescript
// en-US.ts — inside employees.tabs
scheduling: "Scheduling",
leaves: "Leave Management",

// zh-TW.ts — inside employees.tabs
scheduling: "排班總覽",
leaves: "請假管理",
```

- [ ] **Step 2: Add child routes for scheduling and leaves**

In `router/index.ts`, inside the `employees` children array (after the `attendance` route at ~line 124), add:

```typescript
{
  path: "scheduling",
  name: "EmployeeScheduling",
  component: () => import("@/views/employees/SchedulingTab.vue"),
},
{
  path: "leaves",
  name: "EmployeeLeaves",
  component: () => import("@/views/employees/LeavesTab.vue"),
},
```

These must be placed BEFORE the `:id` catch-all route.

- [ ] **Step 3: Convert standalone routes to redirects**

Replace the scheduling route (lines ~274-282) with:

```typescript
{
  path: "scheduling",
  redirect: { name: "EmployeeScheduling" },
},
```

Replace the leaves route (lines ~284-292) with:

```typescript
{
  path: "leaves",
  redirect: { name: "EmployeeLeaves" },
},
```

- [ ] **Step 4: Remove scheduling and leaves sidebar items**

In `Sidebar.vue`, remove the two objects at lines ~208-221:

```typescript
// DELETE this block:
{
  name: "scheduling",
  path: "/dashboard/scheduling",
  label: t("nav.scheduling"),
  icon: Calendar,
  visible: authStore.canAccessAdminFeatures,
},
// DELETE this block:
{
  name: "leaves",
  path: "/dashboard/leaves",
  label: t("nav.leaves"),
  icon: CalendarCheck,
  visible: authStore.canAccessAdminFeatures,
},
```

- [ ] **Step 5: Add new tabs to EmployeeManagementView**

In `EmployeeManagementView.vue`, update the `tabs` computed property to include 4 tabs. Add imports for `Calendar` and `CalendarCheck` from lucide-vue-next:

```typescript
import {
  Users,
  Plus,
  Clock,
  CalendarOff,
  Crown,
  ChefHat,
  Truck,
  CreditCard,
  ClipboardCheck,
  Calendar,
  CalendarCheck,
} from "lucide-vue-next";

const tabs = computed(() => [
  {
    name: "list",
    path: "/dashboard/employees",
    label: t("employees.tabs.list"),
    icon: Users,
    badge: undefined,
  },
  {
    name: "scheduling",
    path: "/dashboard/employees/scheduling",
    label: t("employees.tabs.scheduling"),
    icon: Calendar,
    badge: undefined,
  },
  {
    name: "leaves",
    path: "/dashboard/employees/leaves",
    label: t("employees.tabs.leaves"),
    icon: CalendarCheck,
    badge: undefined,
  },
  {
    name: "attendance",
    path: "/dashboard/employees/attendance",
    label: t("employees.tabs.attendance"),
    icon: ClipboardCheck,
    badge: undefined,
  },
]);
```

- [ ] **Step 6: Create placeholder SchedulingTab.vue**

Create `apps/admin-dashboard/src/views/employees/SchedulingTab.vue`:

```vue
<template>
  <div class="space-y-6">
    <div class="flex items-center justify-center h-64 text-[#1C1C1E]/40">
      <div class="text-center">
        <Calendar class="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p class="text-lg font-medium">{{ t("employees.tabs.scheduling") }}</p>
        <p class="text-sm">排班總覽功能開發中</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Calendar } from "lucide-vue-next";
import { useI18n } from "@/i18n";

const { t } = useI18n();
</script>
```

- [ ] **Step 7: Create placeholder LeavesTab.vue**

Create `apps/admin-dashboard/src/views/employees/LeavesTab.vue`:

```vue
<template>
  <div class="space-y-6">
    <div class="flex items-center justify-center h-64 text-[#1C1C1E]/40">
      <div class="text-center">
        <CalendarCheck class="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p class="text-lg font-medium">{{ t("employees.tabs.leaves") }}</p>
        <p class="text-sm">請假管理功能開發中</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CalendarCheck } from "lucide-vue-next";
import { useI18n } from "@/i18n";

const { t } = useI18n();
</script>
```

- [ ] **Step 8: Verify routing works**

Run the dev server and verify:

1. `/dashboard/employees` shows 4 tabs (員工列表, 排班總覽, 請假管理, 出勤紀錄)
2. Clicking each tab navigates to the correct child route and shows placeholder content
3. `/dashboard/scheduling` redirects to `/dashboard/employees/scheduling`
4. `/dashboard/leaves` redirects to `/dashboard/employees/leaves`
5. Sidebar only shows one "員工管理" item (no separate scheduling/leaves)
6. Employee detail routes (`:id`, `:id/schedule`, `:id/leave`) still work

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(employees): consolidate sidebar into unified 4-tab employee management

- Merge scheduling and leaves into employee management as child tabs
- Add routing redirects from old standalone paths
- Remove scheduling and leaves sidebar items
- Placeholder content for new tabs (implementation in follow-up commits)"
```

---

## Task 2: Leaves Service Extraction

Extract leave API calls from LeaveView.vue into a dedicated service for reuse across the new LeavesTab and its sub-components.

**Files:**

- Create: `apps/admin-dashboard/src/services/leavesService.ts`

- [ ] **Step 1: Create leavesService.ts**

Create `apps/admin-dashboard/src/services/leavesService.ts`. Extract the API patterns from `LeaveView.vue` lines 158-203 into a proper service matching the `schedulingService.ts` pattern:

```typescript
import { apiClient } from "./api";

export interface LeaveType {
  id: number;
  name: string;
  description?: string;
  maxDaysPerYear: number;
  requiresApproval: boolean;
  color?: string;
}

export interface LeaveBalance {
  id: number;
  employeeId: number;
  leaveTypeId: number;
  leaveTypeName: string;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  year: number;
  color?: string;
}

export interface LeaveRequest {
  id: number;
  employeeId: number;
  employeeName?: string;
  leaveTypeId: number;
  leaveTypeName?: string;
  startDate: string;
  endDate: string;
  period: "full" | "am" | "pm";
  days: number;
  reason?: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  approvedBy?: number;
  approverName?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt?: string;
}

export const leavesService = {
  async getLeaveTypes(restaurantId: string): Promise<LeaveType[]> {
    const response = await apiClient.get(`/leaves/${restaurantId}/types`);
    const body = response.data as { data?: LeaveType[] } | LeaveType[];
    return Array.isArray(body) ? body : body.data ?? [];
  },

  async getBalances(params: {
    restaurantId?: string;
    employeeId?: number;
    year?: number;
  }): Promise<LeaveBalance[]> {
    const response = await apiClient.get("/leaves/balances", params);
    const body = response.data as { data?: LeaveBalance[] } | LeaveBalance[];
    return Array.isArray(body) ? body : body.data ?? [];
  },

  async getRequests(
    restaurantId: string,
    params?: {
      employeeId?: number;
      status?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<LeaveRequest[]> {
    const response = await apiClient.get(
      `/leaves/${restaurantId}/requests`,
      params,
    );
    const body = response.data as { data?: LeaveRequest[] } | LeaveRequest[];
    return Array.isArray(body) ? body : body.data ?? [];
  },

  async createRequest(
    restaurantId: string,
    data: {
      leaveTypeId: number;
      startDate: string;
      endDate: string;
      period: string;
      reason?: string;
    },
  ): Promise<LeaveRequest> {
    const response = await apiClient.post(
      `/leaves/${restaurantId}/requests`,
      data,
    );
    const body = response.data as { data?: LeaveRequest } | LeaveRequest;
    return "data" in body && body.data ? body.data : body;
  },

  async approveRequest(requestId: number): Promise<void> {
    await apiClient.post(`/leaves/requests/${requestId}/approve`);
  },

  async rejectRequest(requestId: number, reason?: string): Promise<void> {
    await apiClient.post(`/leaves/requests/${requestId}/reject`, { reason });
  },

  async cancelRequest(requestId: number): Promise<void> {
    await apiClient.post(`/leaves/requests/${requestId}/cancel`);
  },
};

export default leavesService;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm --filter makanmakan-admin-dashboard typecheck`
Expected: No errors from the new service file.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/services/leavesService.ts
git commit -m "refactor(leaves): extract leaves API into dedicated service"
```

---

## Task 3: Scheduling Tab — Calendar Grid + Sidebar

Build the scheduling tab with the calendar grid and unassigned employees sidebar.

**Files:**

- Create: `apps/admin-dashboard/src/views/employees/SchedulingTab.vue`
- Create: `apps/admin-dashboard/src/components/scheduling/SchedulingCalendarGrid.vue`
- Create: `apps/admin-dashboard/src/components/scheduling/UnassignedSidebar.vue`
- Create: `apps/admin-dashboard/src/components/scheduling/SchedulingConflictBar.vue`
- Create: `apps/admin-dashboard/src/components/scheduling/ShiftTemplateManager.vue`

- [ ] **Step 1: Create SchedulingCalendarGrid.vue**

Create `apps/admin-dashboard/src/components/scheduling/SchedulingCalendarGrid.vue`.

This component renders a week or month grid with shift templates as rows and days as columns. Each cell shows assigned employees. Cells accept drag-and-drop.

Props:

- `schedules: EmployeeSchedule[]` — all schedules for the date range
- `shiftTemplates: ShiftTemplate[]` — row definitions
- `dateRange: { start: Date; end: Date }` — visible date range
- `viewMode: 'week' | 'month'`

Events:

- `@assign(templateId: number, date: string, employeeId: number)` — employee dropped on cell
- `@remove(scheduleId: number)` — remove assignment
- `@cell-click(templateId: number, date: string)` — empty cell clicked

The grid should:

- Render shift template names as row headers (left column)
- Render dates as column headers (top row)
- Show assigned employee name chips in cells (pill-shaped, colored by status)
- Empty cells show a dashed border placeholder
- Highlight today's column
- Handle `dragover` and `drop` events on cells
- Follow Apple-Native design: white bg, `rounded-2xl`, soft shadow

Implementation: Build as a full Vue SFC with `<template>`, `<script setup lang="ts">`, using Tailwind. Use `computed` to build a 2D grid data structure from schedules + templates + dateRange. Each cell is a `<div>` with `@dragover.prevent` and `@drop` handlers. Employee chips inside cells use `rounded-full` pill style with the employee's initials and a tooltip for full name.

- [ ] **Step 2: Create UnassignedSidebar.vue**

Create `apps/admin-dashboard/src/components/scheduling/UnassignedSidebar.vue`.

This sidebar shows all employees with their availability status for the currently selected day/slot. Employees are draggable.

Props:

- `employees: Array<{ id: number; name: string; role: string }>` — all restaurant employees
- `schedules: EmployeeSchedule[]` — current schedules (to compute who's already assigned)
- `leaveRequests: LeaveRequest[]` — approved leaves (to mark unavailable)
- `selectedDate: string | null` — currently focused date

Events:

- `@drag-start(employeeId: number)` — employee drag initiated

Status indicators:

- 🟢 Green dot: available (not scheduled, no leave)
- 🟡 Yellow dot: approaching 40h/week limit (compute from schedules)
- ⚫ Gray dot: has approved leave on selected date
- 🔴 Red dot: already scheduled for selected slot

Each employee row should be `draggable="true"` with `@dragstart` setting `dataTransfer` with the employee ID. Style follows Apple-Native: white card, rounded-xl items, soft dividers.

- [ ] **Step 3: Create SchedulingConflictBar.vue**

Create `apps/admin-dashboard/src/components/scheduling/SchedulingConflictBar.vue`.

A fixed bottom bar that appears when there are scheduling warnings.

Props:

- `conflicts: Array<{ type: string; message: string; severity: 'warning' | 'error' }>`

Renders as a horizontal bar at the bottom of the scheduling area. Each conflict shown as a pill with warning/error icon. Yellow background for warnings, red for errors. Dismissible.

- [ ] **Step 4: Create ShiftTemplateManager.vue**

Create `apps/admin-dashboard/src/components/scheduling/ShiftTemplateManager.vue`.

A dialog/modal for managing shift templates (CRUD).

Props:

- `isOpen: boolean`
- `templates: ShiftTemplate[]`
- `restaurantId: string`

Events:

- `@close`
- `@template-created(template: ShiftTemplate)`
- `@template-updated(template: ShiftTemplate)`
- `@template-deleted(templateId: number)`

UI: Modal with list of existing templates (name, time range, color). Each has edit/delete buttons. "Add template" form at top with name, start time, end time, color picker. Uses `schedulingService.createShiftTemplate()` etc. on submit.

- [ ] **Step 5: Build SchedulingTab.vue (replace placeholder)**

Replace the placeholder `apps/admin-dashboard/src/views/employees/SchedulingTab.vue` with the full implementation.

This is the orchestrator component that:

1. Loads data on mount: schedules, templates, employees, approved leaves
2. Manages the date range state (current week/month)
3. Passes data down to child components
4. Handles events from children (assign, remove, template changes)

Layout structure:

```
<div class="flex gap-6">
  <!-- Main area -->
  <div class="flex-1 space-y-4">
    <!-- Toolbar: date nav + week/month toggle + manage templates btn -->
    <div class="flex justify-between items-center">
      <div><!-- ◀ date range ▶ --></div>
      <div><!-- [週][月] [管理模板] --></div>
    </div>
    <!-- Calendar grid -->
    <SchedulingCalendarGrid ... />
    <!-- Conflict bar -->
    <SchedulingConflictBar ... />
  </div>
  <!-- Sidebar -->
  <UnassignedSidebar ... />
</div>
```

Data loading uses `schedulingService` methods:

- `schedulingService.getShiftTemplates(restaurantId)`
- `schedulingService.getSchedules({ restaurantId, startDate, endDate })`
- `schedulingService.getAvailableEmployees(restaurantId, date)`
- `leavesService.getRequests(restaurantId, { status: 'approved', startDate, endDate })`

Assignment handler: `schedulingService.createSchedule(restaurantId, { employeeId, shiftTemplateId, workDate })`

Removal handler: `schedulingService.deleteSchedule(scheduleId)`

- [ ] **Step 6: Verify scheduling tab renders**

Run dev server, navigate to `/dashboard/employees/scheduling`. Verify:

1. Calendar grid renders with shift template rows
2. Sidebar shows employees with status indicators
3. Date navigation (prev/next week) works
4. Week/month toggle switches view
5. "管理模板" opens template manager dialog

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(employees): add scheduling tab with calendar grid and employee sidebar

- SchedulingCalendarGrid: week/month view with drag-drop targets
- UnassignedSidebar: employee list with availability status
- ShiftTemplateManager: template CRUD dialog
- SchedulingConflictBar: understaffing and overtime warnings
- SchedulingTab: data orchestration and layout"
```

---

## Task 4: Leaves Tab — Approval Queue + Decision Cards

Build the leaves tab with the approval queue, decision cards, and sub-tabs.

**Files:**

- Create: `apps/admin-dashboard/src/views/employees/LeavesTab.vue`
- Create: `apps/admin-dashboard/src/components/leaves/LeaveApprovalQueue.vue`
- Create: `apps/admin-dashboard/src/components/leaves/LeaveDecisionCard.vue`
- Create: `apps/admin-dashboard/src/components/leaves/LeaveTimelineStrip.vue`
- Create: `apps/admin-dashboard/src/components/leaves/LeaveBalanceOverview.vue`
- Create: `apps/admin-dashboard/src/components/leaves/LeaveHistoryList.vue`

- [ ] **Step 1: Create LeaveTimelineStrip.vue**

Create `apps/admin-dashboard/src/components/leaves/LeaveTimelineStrip.vue`.

A compact 7-day horizontal strip showing team leave context.

Props:

- `centerDate: string` — the date to center the strip around
- `leaveRequests: LeaveRequest[]` — all approved/pending requests for the team
- `currentRequestId: number` — highlight this request's dates
- `scheduleCount?: Record<string, number>` — per-date staffing count (optional)
- `staffingThreshold?: number` — minimum staff needed (for red warning)

Renders 7 day boxes in a row. Each box shows:

- Day abbreviation (一/二/三...) and date number
- Red dot if a colleague has approved leave that day
- Orange highlight if this is the current request's date range
- Staffing count below (e.g., "3人") with red text if below threshold

Style: compact row of `rounded-lg` boxes, `gap-1`, `text-xs`.

- [ ] **Step 2: Create LeaveDecisionCard.vue**

Create `apps/admin-dashboard/src/components/leaves/LeaveDecisionCard.vue`.

A single leave request card with embedded decision intelligence.

Props:

- `request: LeaveRequest`
- `balance: LeaveBalance | null` — the employee's balance for this leave type
- `teamLeaves: LeaveRequest[]` — approved leaves for the same period
- `scheduleCount?: Record<string, number>` — staffing per day
- `staffingThreshold?: number`

Events:

- `@approve(requestId: number)`
- `@reject(requestId: number, reason?: string)`

Card layout (collapsed):

```
┌─ [urgency dot] Employee Name — Leave Type  Date Range ────┐
│  餘額: 特休剩 3天 (申請1天)                                 │
│  ⚠ 當天已有2人請假，低於人力門檻  /  ✅ 人力充足            │
│  [批准] [拒絕]                                   [展開 ▼]  │
└────────────────────────────────────────────────────────────┘
```

Card layout (expanded — accordion toggle via `ref(false)`):

```
┌─ ... same header ... ──────────────────────────────────────┐
│  ▼ expanded:                                                │
│  <LeaveTimelineStrip ... />                                 │
│  同日排班: 早班王大、午班李二 (僅2人，門檻3人)              │
└────────────────────────────────────────────────────────────┘
```

Urgency dot color:

- 🔴 Red: team will be understaffed if approved
- 🟡 Yellow: no conflict but review needed
- 🟢 Green: auto-approvable (staffing sufficient, balance OK)

Approve button calls `@approve`. Reject button shows a small inline text input for reason, then calls `@reject`.

Style: white card, `rounded-2xl`, soft shadow. Approve button green pill, reject button outlined red pill.

- [ ] **Step 3: Create LeaveApprovalQueue.vue**

Create `apps/admin-dashboard/src/components/leaves/LeaveApprovalQueue.vue`.

Renders a list of `LeaveDecisionCard` components.

Props:

- `requests: LeaveRequest[]` — pending requests
- `balances: LeaveBalance[]` — all employee balances
- `teamLeaves: LeaveRequest[]` — approved leaves for conflict checking
- `scheduleCount?: Record<string, number>`
- `staffingThreshold?: number`

Events:

- `@approve(requestId: number)`
- `@reject(requestId: number, reason?: string)`

Sorts requests by urgency (understaffed first, then by date). Shows empty state when no pending requests: checkmark icon + "目前沒有待審核的請假申請".

- [ ] **Step 4: Create LeaveBalanceOverview.vue**

Create `apps/admin-dashboard/src/components/leaves/LeaveBalanceOverview.vue`.

A table showing all employees' leave balances.

Props:

- `balances: LeaveBalance[]`
- `employees: Array<{ id: number; name: string }>`

Renders a table with columns: Employee Name, Leave Type, Total, Used, Pending, Remaining, Usage %. Progress bar in the usage column (green < 70%, orange 70-90%, red ≥ 90%). Grouped by employee.

Style: Apple-Native table — no hard borders, alternate row subtle bg, `rounded-2xl` container.

- [ ] **Step 5: Create LeaveHistoryList.vue**

Create `apps/admin-dashboard/src/components/leaves/LeaveHistoryList.vue`.

All leave requests with filters.

Props:

- `requests: LeaveRequest[]`
- `leaveTypes: LeaveType[]`

Provides filter controls: status dropdown (all/pending/approved/rejected/cancelled), leave type dropdown, date range. Renders filtered list with status badges (green=approved, red=rejected, yellow=pending, gray=cancelled).

- [ ] **Step 6: Build LeavesTab.vue (replace placeholder)**

Replace the placeholder `apps/admin-dashboard/src/views/employees/LeavesTab.vue` with the full implementation.

Orchestrator component with 3 sub-tabs (not router-based — use local `ref` for active sub-tab):

```vue
<template>
  <div class="space-y-4">
    <!-- Sub-tab navigation -->
    <div class="flex gap-2">
      <button
        v-for="tab in subTabs"
        :key="tab.value"
        class="px-4 py-2 rounded-full text-sm font-medium transition-colors"
        :class="
          activeSubTab === tab.value
            ? 'bg-[#007AFF] text-white'
            : 'bg-[#F2F2F7] text-[#1C1C1E]/60 hover:bg-[#E5E5EA]'
        "
        @click="activeSubTab = tab.value"
      >
        {{ tab.label }}
        <span
          v-if="tab.badge > 0"
          class="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#FF3B30] text-white"
        >
          {{ tab.badge }}
        </span>
      </button>
    </div>

    <!-- Sub-tab content -->
    <LeaveApprovalQueue v-if="activeSubTab === 'pending'" ... />
    <LeaveHistoryList v-else-if="activeSubTab === 'all'" ... />
    <LeaveBalanceOverview v-else-if="activeSubTab === 'balances'" ... />
  </div>
</template>
```

Data loading on mount uses `leavesService`:

- `leavesService.getRequests(restaurantId)` — all requests
- `leavesService.getRequests(restaurantId, { status: 'pending' })` — pending queue
- `leavesService.getBalances({ restaurantId })` — all balances
- `leavesService.getLeaveTypes(restaurantId)` — leave types
- `schedulingService.getSchedules({ restaurantId, startDate, endDate })` — for conflict checking

Approve/reject handlers:

- `leavesService.approveRequest(id)` then refresh data
- `leavesService.rejectRequest(id, reason)` then refresh data

- [ ] **Step 7: Verify leaves tab renders**

Run dev server, navigate to `/dashboard/employees/leaves`. Verify:

1. Three sub-tabs render (待我處理, 全部請假, 假期餘額)
2. Pending requests show as decision cards with balance + conflict info
3. Expand a card to see timeline strip
4. Approve/reject buttons work
5. "全部請假" shows filtered history
6. "假期餘額" shows balance table

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(employees): add leaves tab with approval queue and decision intelligence

- LeaveApprovalQueue: sorted pending requests with urgency
- LeaveDecisionCard: balance snapshot + conflict warning + quick actions
- LeaveTimelineStrip: 7-day inline team context
- LeaveBalanceOverview: all-employee balance table
- LeaveHistoryList: filtered leave history
- LeavesTab: sub-tab orchestration with data loading"
```

---

## Task 5: Integration, Polish, and Cleanup

Wire cross-tab data (leave data into scheduling sidebar, schedule data into leave cards), polish UI consistency, and clean up deprecated code.

**Files:**

- Modify: `apps/admin-dashboard/src/views/employees/SchedulingTab.vue`
- Modify: `apps/admin-dashboard/src/views/employees/LeavesTab.vue`
- Modify: `apps/admin-dashboard/src/views/employees/EmployeeManagementView.vue`

- [ ] **Step 1: Add leave badge to leaves tab**

In `EmployeeManagementView.vue`, fetch pending leave count on mount and display as badge on the leaves tab:

```typescript
const pendingLeaveCount = ref(0);

onMounted(async () => {
  // ... existing employee list fetch ...
  try {
    const restaurantId = authStore.restaurantId;
    if (restaurantId) {
      const pending = await leavesService.getRequests(restaurantId, {
        status: "pending",
      });
      pendingLeaveCount.value = Array.isArray(pending) ? pending.length : 0;
    }
  } catch {
    /* silently ignore */
  }
});
```

Update the leaves tab badge in the `tabs` computed:

```typescript
{
  name: "leaves",
  path: "/dashboard/employees/leaves",
  label: t("employees.tabs.leaves"),
  icon: CalendarCheck,
  badge: pendingLeaveCount.value,
},
```

Import `leavesService`:

```typescript
import { leavesService } from "@/services/leavesService";
```

- [ ] **Step 2: Ensure approved leaves show in scheduling sidebar**

In `SchedulingTab.vue`, verify the `UnassignedSidebar` receives `leaveRequests` prop with approved leaves for the current date range. This should already be wired in Task 3. Verify an employee with approved leave shows a gray dot.

- [ ] **Step 3: Ensure schedule data feeds into leave decision cards**

In `LeavesTab.vue`, verify the `LeaveApprovalQueue` receives `scheduleCount` computed from scheduling data. This enables conflict warnings like "僅2人，門檻3人". This should already be wired in Task 4. Verify a leave request that would cause understaffing shows a red urgency dot.

- [ ] **Step 4: Verify old routes redirect correctly**

Test in browser:

- `/dashboard/scheduling` → redirects to `/dashboard/employees/scheduling`
- `/dashboard/leaves` → redirects to `/dashboard/employees/leaves`
- Direct URL entry works for both
- Browser back button works after redirect

- [ ] **Step 5: Run typecheck**

Run: `pnpm --filter makanmakan-admin-dashboard typecheck`
Expected: No new TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(employees): integrate cross-tab data and add leave badge

- Pending leave count badge on leaves tab
- Approved leaves feed into scheduling availability
- Schedule staffing feeds into leave conflict warnings
- Verify routing redirects work correctly"
```

---

## Summary

| Task | Description                 | New Files      | Est. Effort |
| ---- | --------------------------- | -------------- | ----------- |
| 1    | Routing, sidebar, tab shell | 2 placeholders | Small       |
| 2    | Leaves service extraction   | 1 service      | Small       |
| 3    | Scheduling tab + components | 5 components   | Large       |
| 4    | Leaves tab + components     | 6 components   | Large       |
| 5    | Integration + polish        | 0              | Medium      |

Total new files: 13. Total modified files: 5. Backend changes: 0.

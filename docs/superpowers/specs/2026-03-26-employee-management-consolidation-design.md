# Employee Management Consolidation Design

**Date:** 2026-03-26
**Status:** Approved
**Scope:** Frontend restructuring — consolidate scheduling and leave management into the unified employee management view

## Problem

Three sidebar items (員工管理、員工排班、請假管理) point to three independent top-level routes for what is conceptually one domain. A restaurant owner with 5-20 employees thinks about "managing my staff", not three separate workflows. The UI also has style inconsistencies: SchedulingView uses non-design-system Tailwind, LeaveView uses raw CSS classes.

## Decision

Consolidate into a single "員工管理" entry with 4 tabs. Backend API routes (`/scheduling`, `/leaves`, `/users`) remain independent — this is a frontend-only change.

## Architecture

### Tab Structure

```
員工管理 (EmployeeManagementView)
  ├── 員工列表 tab       /dashboard/employees          (existing, unchanged)
  ├── 排班總覽 tab       /dashboard/employees/scheduling (new)
  ├── 請假管理 tab       /dashboard/employees/leaves     (new)
  └── 出勤紀錄 tab       /dashboard/employees/attendance (existing, unchanged)
```

### Routing Changes

- Add `/dashboard/employees/scheduling` and `/dashboard/employees/leaves` as child routes
- Add redirects: `/dashboard/scheduling` → `/dashboard/employees/scheduling`
- Add redirects: `/dashboard/leaves` → `/dashboard/employees/leaves`
- Remove standalone scheduling and leaves routes after redirects are in place

### Sidebar Changes

- Remove "員工排班" and "請假管理" sidebar items
- Keep single "員工管理" item

### Employee Detail Nesting (unchanged)

```
/dashboard/employees/:id            → EmployeeProfileTab
/dashboard/employees/:id/schedule   → EmployeeScheduleTab (per-employee view)
/dashboard/employees/:id/leave      → EmployeeLeaveTab (per-employee view)
```

---

## Scheduling Tab (排班總覽)

### Design Principles

- **Core UI:** Calendar view (week/month grid) — the visual center for "who works when"
- **Data model:** Shift templates as the underlying structure — enables future AI auto-scheduling
- **Key interaction:** Unassigned employees sidebar with drag-to-assign

### Layout

```
┌────────────────────────────────────────────┬──────────────┐
│  ◀ 3/24 - 3/30 ▶   [週][月]  [管理模板]   │  未分配員工   │
├────────────────────────────────────────────┤              │
│       週一   週二   週三   週四   週五 ...  │  🟢 小明      │
│ 早班  [王大] [李二] [王大]  ---   [李二]   │  🟡 小華(35h) │
│ 午班  [張三] [張三]  ---   [王大] [張三]   │  ⚫ 小美(請假) │
│ 晚班  [李二]  ---   [張三] [李二] [王大]   │              │
│                                            │  班次模板     │
│  ⚠ 週三晚班缺人                            │  早 08-14    │
│  ⚠ 李二本週已排 6 天                       │  午 14-20    │
│                                            │  晚 20-02    │
└────────────────────────────────────────────┴──────────────┘
```

### Components

| Component                    | Responsibility                                 | Est. Lines |
| ---------------------------- | ---------------------------------------------- | ---------- |
| `SchedulingTab.vue`          | Tab container, week/month toggle, data loading | ~150       |
| `SchedulingCalendarGrid.vue` | Calendar grid rendering, drop targets          | ~250       |
| `UnassignedSidebar.vue`      | Employee list with status indicators           | ~120       |
| `ShiftTemplateManager.vue`   | Template CRUD dialog                           | ~200       |
| `SchedulingConflictBar.vue`  | Bottom warning bar: understaffed, overtime     | ~60        |

### Employee Status in Sidebar

| Color     | Meaning                                   |
| --------- | ----------------------------------------- |
| 🟢 Green  | Available for this time slot              |
| 🟡 Yellow | Approaching weekly hour limit (labor law) |
| ⚫ Gray   | Has approved leave in this slot           |
| 🔴 Red    | Conflict with existing schedule           |

### Interactions

- Drag employee from sidebar → drop on calendar cell → `POST /api/v1/scheduling/schedules`
- Click assigned employee in cell → popover with remove/swap options
- "管理模板" button → opens ShiftTemplateManager dialog
- Week/month toggle → re-fetches schedules for the date range

### API Calls (existing endpoints, no backend changes)

- `GET /api/v1/scheduling/schedules?startDate=&endDate=&restaurantId=`
- `GET /api/v1/scheduling/templates?restaurantId=`
- `POST /api/v1/scheduling/schedules` (create assignment)
- `DELETE /api/v1/scheduling/schedules/:id` (remove assignment)
- `GET /api/v1/leaves/requests?status=approved&startDate=&endDate=` (for gray-out)

---

## Leaves Tab (請假管理)

### Design Principles

- **Core:** Approval queue — the manager's job is to clear pending decisions
- **Each card embeds decision intelligence:** conflict warnings + balance snapshot
- **Expanded view:** 7-day timeline strip (not a floating panel — inline accordion)

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [待我處理 (3)]    [全部請假]    [假期餘額]                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─ 🔴 小明 — 特休 3/28(五)                                │
│  │  餘額: 特休剩 3天 (申請1天)                              │
│  │  ⚠ 當天已有2人請假，低於人力門檻                          │
│  │  [批准] [拒絕]                                           │
│  └──────────────────────────────────────────────────────────│
│  ┌─ 🟡 小華 — 病假 3/29-3/30                               │
│  │  餘額: 病假剩 7天 (申請2天)                              │
│  │  ✅ 該時段人力充足                                       │
│  │  [批准] [拒絕]                                           │
│  └──────────────────────────────────────────────────────────│
├─ 展開卡片 ▼ ────────────────────────────────────────────────┤
│  7天: [一][二][三 🔴小美][四][五 🔴本申請][六][日]            │
│  同日排班: 早班王大、午班李二 (僅2人，門檻3人)               │
└─────────────────────────────────────────────────────────────┘
```

### Sub-tabs

| Sub-tab  | Content                                                            |
| -------- | ------------------------------------------------------------------ |
| 待我處理 | Pending approval cards with decision intelligence                  |
| 全部請假 | All leave requests with status filters (pending/approved/rejected) |
| 假期餘額 | All employees' leave balance summary table                         |

### Components

| Component                  | Responsibility                                                  | Est. Lines |
| -------------------------- | --------------------------------------------------------------- | ---------- |
| `LeavesTab.vue`            | Tab container, sub-tab switching                                | ~120       |
| `LeaveApprovalQueue.vue`   | Approval card list                                              | ~200       |
| `LeaveDecisionCard.vue`    | Single card: balance + conflict + actions + expandable timeline | ~180       |
| `LeaveTimelineStrip.vue`   | 7-day timeline with colleague leave markers                     | ~100       |
| `LeaveBalanceOverview.vue` | All-employee balance summary table                              | ~120       |
| `LeaveHistoryList.vue`     | All leave records with filters                                  | ~100       |

### Decision Card Intelligence

Each card shows:

1. **Who & what:** Employee name, leave type, date range
2. **Balance snapshot:** "特休剩 3 天 (申請 1 天)"
3. **Conflict warning:** Auto-checked against scheduling data
   - 🔴 "當天已有 2 人請假，低於人力門檻" (red alert)
   - ✅ "該時段人力充足" (green all-clear)
4. **Quick actions:** Approve / Reject buttons directly on card

### Expanded Timeline (accordion, not floating panel)

Click card to expand inline:

- 7-day strip centered on the leave request dates
- Red dots for other employees' approved leaves on same days
- Shift staffing count for each day

### Availability Override (on approval)

When a leave request is approved:

1. Deduct from leave balance (freeze → deduct transition)
2. Update employee availability for the scheduling calendar
3. Scheduling tab automatically shows the employee as unavailable (gray) for those slots

### API Calls (existing endpoints, no backend changes)

- `GET /api/v1/leaves/requests?restaurantId=&status=pending` (approval queue)
- `GET /api/v1/leaves/requests?restaurantId=` (all requests)
- `GET /api/v1/leaves/balances?restaurantId=` (balance overview)
- `PUT /api/v1/leaves/requests/:id/approve`
- `PUT /api/v1/leaves/requests/:id/reject`
- `GET /api/v1/scheduling/schedules?startDate=&endDate=` (for conflict check)

---

## Files Changed

### Modified

| File                         | Change                                                |
| ---------------------------- | ----------------------------------------------------- |
| `Sidebar.vue`                | Remove scheduling + leaves items, keep employees only |
| `router/index.ts`            | Add scheduling/leaves child routes, add redirects     |
| `EmployeeManagementView.vue` | Add 2 new tabs to tab navigation                      |

### New Files (scheduling tab)

| File                                               | Purpose                  |
| -------------------------------------------------- | ------------------------ |
| `views/employees/SchedulingTab.vue`                | Scheduling tab container |
| `components/scheduling/SchedulingCalendarGrid.vue` | Calendar grid            |
| `components/scheduling/UnassignedSidebar.vue`      | Draggable employee list  |
| `components/scheduling/ShiftTemplateManager.vue`   | Template CRUD dialog     |
| `components/scheduling/SchedulingConflictBar.vue`  | Warning bar              |

### New Files (leaves tab)

| File                                         | Purpose                         |
| -------------------------------------------- | ------------------------------- |
| `views/employees/LeavesTab.vue`              | Leaves tab container            |
| `components/leaves/LeaveApprovalQueue.vue`   | Approval card list              |
| `components/leaves/LeaveDecisionCard.vue`    | Decision card with intelligence |
| `components/leaves/LeaveTimelineStrip.vue`   | 7-day timeline strip            |
| `components/leaves/LeaveBalanceOverview.vue` | Balance summary table           |
| `components/leaves/LeaveHistoryList.vue`     | History with filters            |

### Deprecated (keep with redirects, remove in future)

| File                                  | Replacement                         |
| ------------------------------------- | ----------------------------------- |
| `views/scheduling/SchedulingView.vue` | `views/employees/SchedulingTab.vue` |
| `views/LeaveView.vue`                 | `views/employees/LeavesTab.vue`     |

## What This Design Does NOT Change

- Backend API routes (`/api/v1/scheduling`, `/api/v1/leaves`, `/api/v1/users`)
- Backend services and database schemas
- Per-employee schedule/leave tabs in EmployeeDetailView
- `SchedulingAnalyticsView.vue` (separate analytics page, out of scope)

## Design System

All new components follow the Apple-Native Soft Minimalism design system:

- Page background: `#F2F2F7`
- Cards: white + `rounded-2xl` + soft shadow (`opacity ≤ 8%`)
- Buttons/tags: pill-shaped (`rounded-full`)
- Text: `#1C1C1E` (never pure black)
- Colors: `#007AFF` primary, `#34C759` success, `#FF9500` warning, `#FF3B30` error
- Animations: 200-350ms, ease-out

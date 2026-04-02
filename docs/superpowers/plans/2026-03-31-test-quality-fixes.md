# Test Quality Fixes: Factory Migration + CSS Assertion Removal

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix CLAUDE.md test standard violations: migrate admin view tests to use `@makanmakan/testing-utils` factories, and replace all CSS class assertions with behavioral assertions.

**Architecture:** Two parallel workstreams - (1) add factory imports and replace hand-crafted mock data with factory output in 29 admin view test files, (2) replace 26 CSS `.classes()` assertions across 13 files with `data-testid`/`data-status` attributes (adding attributes to Vue components where needed). Both workstreams touch test files; CSS fixes also touch Vue source files.

**Tech Stack:** Vue 3, Vitest, @vue/test-utils, @makanmakan/testing-utils factories

---

## Workstream A: Factory Migration (29 files)

### Pattern to apply in EVERY file

**Before (hand-crafted):**

```typescript
const mockOrders = [
  { id: 1, status: 'pending', totalAmount: 100, ... },
  { id: 2, status: 'completed', totalAmount: 200, ... },
];
```

**After (factory):**

```typescript
import { orderFactory, resetAllFactories } from "@makanmakan/testing-utils";

beforeEach(() => {
  resetAllFactories();
});

const mockOrders = [
  orderFactory.buildPending({ overrides: { totalAmount: 100 } }),
  orderFactory.buildCompleted({ overrides: { totalAmount: 200 } }),
];
```

### Rules

1. Add `import { ...Factory, resetAllFactories } from '@makanmakan/testing-utils'` at the top
2. Add `resetAllFactories()` to the existing `beforeEach()` block
3. Replace hand-crafted data objects with factory calls WHERE the data shape matches a factory output
4. Keep hand-crafted data for UI-specific mocks (e.g., chart data, i18n messages) that have no factory
5. Use `overrides` for values the test specifically asserts on
6. Do NOT change any test assertions or test logic - only the data creation

### Available Factories

- `userFactory` — `.build()`, `.buildAdmin()`, `.buildShopOwner(restaurantId)`, `.buildChef(restaurantId)`, `.buildServiceCrew(restaurantId)`, `.buildCashier(restaurantId)`, `.buildCustomer()`
- `restaurantFactory` — `.build()`, `.buildWithShopMode()`, `.buildFastFood()`, `.buildFineDining()`
- `menuItemFactory` — `.build({ relations: { restaurantId, categoryId, categoryName } })`, `.buildPopular()`, `.buildOnSale()`
- `categoryFactory` — `.build({ relations: { restaurantId } })`, `.buildRestaurantCategories(restaurantId)`
- `orderFactory` — `.build()`, `.buildPending()`, `.buildInProgress()`, `.buildCompleted()`, `.buildTakeaway()`, `.buildDelivery()`
- `orderItemFactory` — `.build({ relations: { orderId, menuItemId } })`, `.buildForOrder(orderId, count)`
- `envFactory` — `.build()`, `.buildMinimal()`

### Task A1: Orders + Menu + Analytics tests (batch)

**Files:**

- `apps/admin-dashboard/src/views/__tests__/OrdersView.test.ts`
- `apps/admin-dashboard/src/views/__tests__/MenuView.test.ts`
- `apps/admin-dashboard/src/views/__tests__/AnalyticsView.test.ts`
- `apps/admin-dashboard/src/views/__tests__/CouponsView.test.ts`

- [ ] Read each file, identify hand-crafted mock data that matches factory shapes
- [ ] Add factory imports and resetAllFactories() to beforeEach
- [ ] Replace matching mock data with factory calls
- [ ] Run: `pnpm vitest run apps/admin-dashboard/src/views/__tests__/OrdersView.test.ts apps/admin-dashboard/src/views/__tests__/MenuView.test.ts apps/admin-dashboard/src/views/__tests__/AnalyticsView.test.ts apps/admin-dashboard/src/views/__tests__/CouponsView.test.ts`
- [ ] Verify all tests pass

### Task A2: POS + Cashier + Service tests (batch)

**Files:**

- `apps/admin-dashboard/src/views/__tests__/POSView.test.ts`
- `apps/admin-dashboard/src/views/__tests__/CashierView.test.ts`
- `apps/admin-dashboard/src/views/__tests__/ServiceView.test.ts`

- [ ] Read each file, identify hand-crafted mock data
- [ ] Add factory imports and resetAllFactories()
- [ ] Replace matching mock data with factory calls
- [ ] Run tests and verify pass

### Task A3: Seating + WaitingList + GroupOrders tests (batch)

**Files:**

- `apps/admin-dashboard/src/views/__tests__/SeatingManagementView.test.ts`
- `apps/admin-dashboard/src/views/__tests__/WaitingListView.test.ts`
- `apps/admin-dashboard/src/views/__tests__/GroupOrdersView.test.ts`

- [ ] Read, migrate, run, verify

### Task A4: Employee + Schedule tests (batch)

**Files:**

- `apps/admin-dashboard/src/views/__tests__/UsersView.test.ts`
- `apps/admin-dashboard/src/views/__tests__/EmployeeScheduleLeaves.test.ts`
- `apps/admin-dashboard/src/views/employees/__tests__/EmployeeDetailView.test.ts`
- `apps/admin-dashboard/src/views/employees/__tests__/EmployeeProfileTab.test.ts`
- `apps/admin-dashboard/src/views/employees/__tests__/AttendanceOverviewTab.test.ts`
- `apps/admin-dashboard/src/views/employees/__tests__/EmployeeLeaveTab.test.ts`
- `apps/admin-dashboard/src/views/employees/__tests__/EmployeeScheduleTab.test.ts`
- `apps/admin-dashboard/src/views/employees/__tests__/LeavesTab.test.ts`
- `apps/admin-dashboard/src/views/__tests__/LeaveView.test.ts`

- [ ] Read, migrate, run, verify

### Task A5: Settings + Monitoring + Owner + Dashboard tests (batch)

**Files:**

- `apps/admin-dashboard/src/views/__tests__/SettingsView.test.ts`
- `apps/admin-dashboard/src/views/__tests__/MonitoringView.test.ts`
- `apps/admin-dashboard/src/views/__tests__/OwnerView.test.ts`
- `apps/admin-dashboard/src/views/__tests__/DashboardView.test.ts`
- `apps/admin-dashboard/src/views/__tests__/AIAnalytics.test.ts`

- [ ] Read, migrate, run, verify

### Task A6: Remaining tests (batch)

**Files:**

- `apps/admin-dashboard/src/views/__tests__/AuthViews.test.ts`
- `apps/admin-dashboard/src/views/__tests__/ErrorPages.test.ts`
- `apps/admin-dashboard/src/views/__tests__/AccountManagementView.test.ts`
- `apps/admin-dashboard/src/views/__tests__/PlatformOverview.test.ts`
- `apps/admin-dashboard/src/views/__tests__/BackupViews.test.ts`
- `apps/admin-dashboard/src/views/__tests__/ForecastView.test.ts`
- `apps/admin-dashboard/src/views/__tests__/IngredientsView.test.ts`
- `apps/admin-dashboard/src/views/__tests__/SchedulingViews.test.ts`
- `apps/admin-dashboard/src/views/__tests__/TableDetailView.test.ts`
- `apps/admin-dashboard/src/views/seating/__tests__/ReservationTab.test.ts`
- `apps/admin-dashboard/src/views/seating/__tests__/TableSetupTab.test.ts`

- [ ] Read, migrate, run, verify

---

## Workstream B: CSS Class Assertion Fixes (13 files, 26 violations)

### Pattern: Replace CSS assertions with data attributes

**In Vue component:**

```html
<!-- Before -->
<button :class="{ 'border-blue-500': isActive }">Tab</button>

<!-- After — add data attribute alongside existing class binding -->
<button :class="{ 'border-blue-500': isActive }" :data-active="isActive">
  Tab
</button>
```

**In test:**

```typescript
// Before
expect(tab.classes()).toContain("border-blue-500");

// After
expect(tab.attributes("data-active")).toBe("true");
```

### Violation inventory by file

1. **SettingsView.test.ts** (10): Tab active state — check `data-active` attribute
2. **WaitingListView.test.ts** (4): View toggle buttons — use `aria-pressed` or `data-testid`
3. **EmployeeScheduleLeaves.test.ts** (3): Nav buttons + active tab — `data-active`
4. **BackupViews.test.ts** (3): Health status cards — `data-health-status`
5. **CashierView.test.ts** (2): Payment method selection — `aria-pressed` or `data-selected`
6. **AccountManagementView.test.ts** (2): Tab active state — `data-active`
7. **SeatingManagementView.test.ts** (2): Tab active state — `data-active`
8. **EmployeeDetailView.test.ts** (2): Tab active state — `data-active`
9. **MonitoringView.test.ts** (1): Auto-refresh button active — `data-active`
10. **GroupOrdersView.test.ts** (1): Join button — use `data-testid`
11. **POSView.test.ts** (1): Refresh button — use `data-testid`
12. **EmployeeLeaveTab.test.ts** (1): Status badges — `data-status`
13. **EmployeeScheduleTab.test.ts** (1): Shift badges — `data-status`

### Task B1-B4: Fix violations per batch (grouped by Vue component touched)

Each task: read Vue component, add data attribute, update test assertion, run tests, verify.

---

## Task C: Update TEST_PROGRESS.md

- [ ] Update file count and any notes about factory/CSS compliance
- [ ] Commit all changes

# Admin Restaurant Management — Design Spec

**Date:** 2026-03-11
**Status:** Approved
**Scope:** Admin dashboard — restaurant context switching, platform landing page, sidebar behavior

---

## Problem

The admin user (role 0) has `restaurantId: null` — they are not bound to any restaurant. The current admin dashboard assumes a restaurant context for all operational pages (orders, menu, tables, etc.), resulting in:

- SSE errors spamming `restaurant_id=undefined` (86+ console errors)
- Operational pages showing empty/broken data
- No way for admin to select which restaurant to manage
- No platform-level overview across all restaurants

## Solution Overview

A **hybrid approach** that adds:

1. A **platform landing page** with restaurant card grid (admin's home when no restaurant is selected)
2. A **restaurant context selector** that sets a session-scoped `restaurantId` for admin
3. An **amber context banner** showing which restaurant admin is currently managing
4. **Greyed-out sidebar items** for restaurant-scoped pages when no context is set
5. **SSE reactive lifecycle** to connect/disconnect based on restaurant context

## Design Decisions

| Decision             | Choice                                                              | Rationale                                                               |
| -------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Layout approach      | Hybrid — platform pages + restaurant-scoped pages in same dashboard | Admin keeps platform-level access while managing individual restaurants |
| Context indicator    | Top amber banner below header                                       | Always visible, impossible to miss, consistent location                 |
| Platform landing     | Restaurant card grid with per-restaurant stats                      | Visual, workspace-like, natural entry point to manage a restaurant      |
| Context persistence  | `sessionStorage` (not `localStorage`)                               | Tab-isolated — admin can manage different restaurants in different tabs |
| Sidebar behavior     | Grey out restaurant-scoped items (not hide)                         | Admin sees full capability, guided to select a restaurant first         |
| Store API            | Keep existing `restaurantId` computed, change internal logic        | Zero changes to 50+ consumer pages — backward compatible                |
| Aggregated stats API | Deferred to phase 2                                                 | Phase 1 uses existing `GET /api/v1/restaurants` endpoint only           |

## State Model

### Auth Store (`useAuthStore`) Changes

**New state:**

- `selectedRestaurantId: string | null` — admin's currently selected restaurant (sessionStorage-backed)
- `selectedRestaurantName: string | null` — display name for banner/UI

**Modified computed:**

- `restaurantId` (existing) — internal logic changes:
  - Admin (role 0): returns `selectedRestaurantId` (from selector) or `null`
  - All other roles: returns `user.restaurantId` from JWT (unchanged behavior)

**New computed:**

- `isAdminRole` — `user.role === UserRole.ADMIN` (use enum, not magic number)
- `hasRestaurantContext` — `restaurantId !== null`

**New actions:**

- `selectRestaurant(id: string, name: string)` — sets context, persists to sessionStorage
- `clearRestaurant()` — clears context, removes from sessionStorage

**Modified actions:**

- `logout()` — must also call `clearRestaurant()` to prevent stale context if another user logs in on the same tab

**Init behavior:**

- On app init, if admin and sessionStorage has a `selectedRestaurantId`, accept it optimistically
- If a restaurant-scoped API call returns 404 for that restaurant, clear the context silently and redirect to `/dashboard/platform`
- This avoids an extra API call on init just to validate the stored ID

### Two UI States

| State                  | Banner                             | Sidebar                                         | Main Content                 | Route                 |
| ---------------------- | ---------------------------------- | ----------------------------------------------- | ---------------------------- | --------------------- |
| No restaurant selected | Hidden                             | Restaurant-scoped items greyed out with tooltip | Platform landing (card grid) | `/dashboard/platform` |
| Restaurant selected    | Amber banner: name + Switch + Exit | All items active                                | Normal dashboard pages       | `/dashboard/*`        |

## Route Scoping Definition

Routes are classified as **platform-scoped** or **restaurant-scoped**:

**Platform-scoped** (always accessible to admin, no restaurant context needed):

- `/dashboard/platform` — Platform overview
- `/dashboard/monitoring` — System monitoring
- `/dashboard/settings` — System settings

**Restaurant-scoped** (require `hasRestaurantContext` for admin):

- `/dashboard` (DashboardHome — the default `""` child route)
- `/dashboard/orders`, `/dashboard/menu`, `/dashboard/tables`
- `/dashboard/users`, `/dashboard/scheduling`, `/dashboard/leaves`
- `/dashboard/analytics`, `/dashboard/ai-analytics/*`
- `/dashboard/coupons`, `/dashboard/pos`, `/dashboard/group-orders`
- `/dashboard/reservations`, `/dashboard/waiting-list`, `/dashboard/queue`

Non-admin roles are unaffected — they always have `restaurantId` from their JWT.

## New Components

### 1. `RestaurantContextBanner.vue`

**Location:** `apps/admin-dashboard/src/components/layout/RestaurantContextBanner.vue`

**Behavior:**

- Renders only when `authStore.isAdminRole && authStore.hasRestaurantContext`
- Shows: restaurant name, "Exit" button
- "Exit" calls `authStore.clearRestaurant()` and navigates to `/dashboard/platform`

**Visual:**

- Full-width amber (`bg-amber-500`) bar
- Positioned between header and `<router-view>` in `DefaultLayout.vue`
- Text: "Currently managing: {restaurant name}" with Exit button on right

**Note:** The banner does NOT include a "Switch" dropdown. Restaurant switching is handled by `RestaurantSelector` in the header (always visible for admin). This avoids UI redundancy.

### 2. `RestaurantSelector.vue`

**Location:** `apps/admin-dashboard/src/components/layout/RestaurantSelector.vue`

**Behavior:**

- Dropdown in the header bar, admin-only
- Always visible for admin (both when a restaurant is selected and when not)
- Searchable list of all restaurants
- Shows restaurant name + status badge (Active/Setup/Inactive)
- Selecting a restaurant calls `authStore.selectRestaurant()`
- When a restaurant is already selected, the dropdown shows the current restaurant name as placeholder

**Data source:** `GET /api/v1/restaurants` (existing endpoint), fetched once and cached in component state

### 3. `PlatformOverview.vue`

**Location:** `apps/admin-dashboard/src/views/PlatformOverview.vue`
**Route:** `/dashboard/platform`

**Sections:**

- **Header:** "Platform Overview" title
- **Stats row (Phase 1):** Restaurant count, active count, staff count (computed client-side from restaurant list)
- **Restaurant card grid:** Cards with restaurant name, status badge, "Manage" button
- **Each card shows:** Restaurant name, status (Active/Setup/Inactive), "Manage" CTA
- **"Manage" button:** Calls `authStore.selectRestaurant()` and navigates to `/dashboard`

**Phase 2 additions (not in scope):**

- Per-restaurant today's orders/revenue (requires new API endpoint)
- Aggregated platform KPIs (requires `GET /api/v1/restaurants/stats/overview`)
- "Add Restaurant" card

## Modified Components

### 4. `Sidebar.vue`

**Changes:**

- Add "Platform Overview" nav item (admin-only, always active, positioned at top of nav list)
- Restaurant-scoped items get conditional styling when `!authStore.hasRestaurantContext && authStore.isAdminRole`:
  - `opacity: 0.4`
  - `title` attribute: "Select a restaurant first"
  - `@click.prevent` handler to block navigation (CSS `pointer-events: none` is a UX hint only — keyboard nav can bypass it)
- The router guard (section 6) is the true enforcement; sidebar disabling is a UX convenience
- Platform items always remain active: Platform Overview, System Monitoring, System Settings
- The "always active" exemption only applies to the admin grey-out logic (condition includes `authStore.isAdminRole`), so owners are completely unaffected

### 5. `DefaultLayout.vue`

**Location:** `apps/admin-dashboard/src/layouts/DefaultLayout.vue`

**Changes:**

- Import and render `RestaurantContextBanner` between header and `<router-view>`
- Import and render `RestaurantSelector` in header area (admin-only)

### 6. Router Changes

**New route:**

- `/dashboard/platform` → `PlatformOverview.vue` (admin-only, `meta: { roles: [UserRole.ADMIN] }`)
  - Uses `roles` (not `requiredRoles`) to match existing router guard pattern at line 360

**Modified `getDefaultRoute()` in auth store:**

- Admin with `selectedRestaurantId` in sessionStorage → return `/dashboard`
- Admin without stored context → return `/dashboard/platform`
- All other roles → unchanged

**Modified `router.beforeEach()` — new guard logic:**

```
// After existing role-based access check
if (user.role === UserRole.ADMIN && !authStore.hasRestaurantContext) {
  const platformRoutes = ['platform-overview', 'monitoring', 'settings']
  const isRestaurantScoped = to.matched.some(
    r => r.path.startsWith('/dashboard') && !platformRoutes.includes(r.name)
  )
  if (isRestaurantScoped) {
    return { path: '/dashboard/platform' }
  }
}
```

This is separate from `canAccessRoute()` (which handles role permissions). The restaurant-context guard is a new concern added to `router.beforeEach()`.

### 7. SSE Reactive Lifecycle

**Files:** `useSSE.ts`, `useAdminRealtime.ts`

**Problem:** SSE connects unconditionally in `DefaultLayout.vue`'s `onMounted`, using `authStore.restaurantId` which is `undefined` for admin without context.

**Solution:** Make SSE connection reactive to `restaurantId` changes:

```typescript
// In useSSE.ts or where SSE is initialized
watch(
  () => authStore.restaurantId,
  (newId, oldId) => {
    if (oldId) disconnect(); // clean up old connection
    if (newId) connect(newId); // connect with new restaurant context
  },
  { immediate: true },
);
```

This handles:

- Admin with no context → no connection (no errors)
- Admin selects restaurant → connects
- Admin switches restaurant → disconnects old, connects new
- Admin exits restaurant → disconnects

Same pattern applies to `useAdminRealtime.ts`.

## API Changes

### Phase 1 (this spec)

**No new endpoints.** Uses existing:

- `GET /api/v1/restaurants` — Returns restaurant list for admin (already supports admin role)

### Phase 2 (future)

- `GET /api/v1/restaurants/stats/overview` — Aggregated platform stats (total orders, revenue, active staff)
- Per-restaurant daily stats in restaurant list response

## Out of Scope

- Restaurant CRUD (create/edit/delete) — exists in management-portal
- Cross-restaurant analytics dashboard — future feature
- Admin audit log for restaurant context switches — future feature
- Mobile responsive design for banner — follow existing responsive patterns

## Testing Strategy

- **Unit tests:** Auth store `selectRestaurant` / `clearRestaurant` actions, `restaurantId` computed behavior per role, `logout` clearing restaurant context
- **Component tests:** Banner render conditions, sidebar grey-out states, selector search/filter
- **Integration:** Full flow — login as admin → see platform overview → manage restaurant → verify orders page scoped → exit → return to platform
- **Edge cases:** Stale sessionStorage (deleted restaurant → 404 clears context), multiple tabs with different restaurants, logout clears context, keyboard nav blocked by click handler + router guard

## File Summary

| File                                                | Action     | Description                                                                                             |
| --------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| `src/components/layout/RestaurantContextBanner.vue` | **New**    | Amber context banner                                                                                    |
| `src/components/layout/RestaurantSelector.vue`      | **New**    | Header restaurant dropdown                                                                              |
| `src/views/PlatformOverview.vue`                    | **New**    | Admin landing page with card grid                                                                       |
| `src/stores/auth.ts`                                | **Modify** | Add selectedRestaurantId, selectRestaurant/clearRestaurant, modify restaurantId computed, modify logout |
| `src/components/layout/Sidebar.vue`                 | **Modify** | Grey-out logic with click handler, add Platform Overview item                                           |
| `src/layouts/DefaultLayout.vue`                     | **Modify** | Insert banner between header and router-view, add selector to header                                    |
| `src/router/index.ts`                               | **Modify** | Add platform route, adjust admin default route, add restaurant-context guard                            |
| `src/composables/useSSE.ts`                         | **Modify** | Reactive connect/disconnect based on restaurantId watch                                                 |
| `src/composables/useAdminRealtime.ts`               | **Modify** | Reactive connect/disconnect based on restaurantId watch                                                 |

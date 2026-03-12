# Account Management Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated Admin-only page at `/dashboard/account-management` with two tabs: Owner accounts (create + list with restaurant binding) and Admin accounts (create + list, simplified form).

**Architecture:** Single Vue component with tab state. Owner tab has 3-section form (account info, restaurant binding, permissions). Admin tab has simplified 1-section form. Both tabs share validation logic and table layout. Calls existing API endpoints — no backend changes.

**Tech Stack:** Vue 3 + TypeScript, Tailwind CSS, lucide-vue-next icons, vue-i18n, existing `ApiService`

**Spec:** `docs/superpowers/specs/2026-03-12-owner-management-design.md` (v2)

---

## File Structure

| Action | File                                                       | Responsibility                                                     |
| ------ | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| Create | `apps/admin-dashboard/src/views/AccountManagementView.vue` | Full page: tab nav + owner form/table + admin form/table           |
| Modify | `apps/admin-dashboard/src/router/index.ts`                 | Add `/dashboard/account-management` route, add to `platformRoutes` |
| Modify | `apps/admin-dashboard/src/components/layout/Sidebar.vue`   | Add "帳號管理" nav item (Admin-only), add to `platformItemNames`   |
| Modify | `apps/admin-dashboard/src/types/index.ts`                  | Add `CreateAccountRequest` and `PlatformUser` interfaces           |
| Modify | `apps/admin-dashboard/src/i18n/locales/zh-TW.ts`           | Add `accountManagement` i18n keys                                  |
| Modify | `apps/admin-dashboard/src/i18n/locales/en-US.ts`           | Add `accountManagement` i18n keys (English)                        |

---

## Task 1: Types, i18n, Route, Sidebar

### Step 1: Add types

Modify `apps/admin-dashboard/src/types/index.ts` — append:

```typescript
export interface CreateAccountRequest {
  username: string;
  password: string;
  fullName: string;
  email: string;
  phone?: string;
  role: UserRole;
  restaurantId?: number;
  newRestaurantName?: string;
  newRestaurantAddress?: string;
}

export interface PlatformUser {
  id: number;
  username: string;
  fullName?: string;
  email: string;
  role: UserRole;
  restaurantId: string | null;
  restaurantName?: string;
  status?: string;
  createdAt: string;
}
```

### Step 2: Add i18n keys

Add `accountManagement` section to both zh-TW.ts and en-US.ts. Also add `nav.accountManagement` and `pages.accountManagement`.

### Step 3: Add route

In router `children` array, add after `monitoring`:

```typescript
{
  path: "account-management",
  name: "AccountManagement",
  component: () => import("@/views/AccountManagementView.vue"),
  meta: {
    titleKey: "pages.accountManagement",
    roles: [UserRole.ADMIN],
  },
},
```

Add `"AccountManagement"` to `platformRoutes` array (line 370).

### Step 4: Add sidebar entry

In Sidebar.vue `navigationItems`, add before `monitoring`:

```typescript
{
  name: "account-management",
  path: "/dashboard/account-management",
  label: t("nav.accountManagement"),
  icon: UserPlus,
  visible: authStore.isAdminRole,
},
```

Add `"account-management"` to `platformItemNames` Set.
Import `UserPlus` from lucide-vue-next.

### Step 5: Commit

## Task 2: Create AccountManagementView.vue

Single file with:

- Tab state (`activeTab: 'owners' | 'admins'`)
- Owner tab: 3-section form + owners table
- Admin tab: simplified form + admins table
- Shared: validation, API calls, date formatting, restaurant name lookup

### Step 1: Create the component

### Step 2: Verify TypeScript

### Step 3: Visual verification

### Step 4: Commit

## Task 3: End-to-End Verification

- Test owner creation with existing restaurant
- Test owner creation with new restaurant
- Test admin creation
- Test validation errors
- Test access control (Owner role cannot access)

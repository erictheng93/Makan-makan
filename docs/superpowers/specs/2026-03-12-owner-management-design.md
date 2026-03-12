# Admin Dashboard — Account Management Page

**Date**: 2026-03-12
**Status**: Approved (v2 — expanded from Owner Management to include Admin accounts)

## Problem

Admin (role=0) needs to:

1. Create Shop Owner (role=1) accounts on behalf of restaurant owners
2. Create and manage other Admin (role=0) accounts
3. View all platform-level accounts (Admins + Owners) in one place

Currently, the admin-dashboard's UsersView only manages restaurant employees (roles 2-4) using mock data, and there is no interface for managing platform-level accounts.

## Design

### Route & Access

- **Route**: `/dashboard/account-management`
- **Access**: Admin only (role=0)
- **Sidebar**: New "帳號管理" item with `UserPlus` icon (Admin-only visibility)
- **Platform-level**: No restaurant context required

### Page Layout

A dedicated full-page view with tab navigation:

```
┌──────────────────────────────────────────────────┐
│  帳號管理                                         │
│  [店主帳號]  [管理員帳號]                          │
├──────────────────────────────────────────────────┤
│  (active tab's form + list)                       │
└──────────────────────────────────────────────────┘
```

#### Tab 1: 店主帳號

**Registration Form** — Three sections in a single form card:

**Section 1 — 帳號資訊**
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| 用戶名 | text | yes | 3-50 chars, unique |
| 密碼 | password | yes | 8+ chars, uppercase, lowercase, digit, special char |
| 全名 | text | yes | 1-100 chars |
| Email | email | yes | Valid email format |

**Section 2 — 餐廳綁定**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| 所屬餐廳 | select | yes | Fetched from `GET /api/v1/restaurants`, with "新增餐廳" option |
| 餐廳名稱 | text | conditional | Shown when "新增餐廳" selected |
| 餐廳地址 | text | conditional | Shown when "新增餐廳" selected |
| 聯絡電話 | tel | no | Owner's phone number |

**Section 3 — 權限確認**

- Amber info box listing permissions the owner account will have
- Read-only, informational only

**Submit**: "建立店主帳號" button

**Existing Owners Table:**
| Column | Source |
|--------|--------|
| 店主 (name + username) | user.fullName, user.username |
| 餐廳 | restaurant name from restaurantId |
| 狀態 | user.status badge |
| 建立日期 | user.createdAt |

#### Tab 2: 管理員帳號

**Registration Form** — Simplified (no restaurant binding, no permissions section):

**帳號資訊**
| Field | Type | Required | Validation |
|-------|------|----------|------------|
| 用戶名 | text | yes | 3-50 chars, unique |
| 密碼 | password | yes | 8+ chars, uppercase, lowercase, digit, special char |
| 全名 | text | yes | 1-100 chars |
| Email | email | yes | Valid email format |

**Submit**: "建立管理員帳號" button

**Existing Admins Table:**
| Column | Source |
|--------|--------|
| 管理員 (name + username) | user.fullName, user.username |
| Email | user.email |
| 狀態 | user.status badge |
| 建立日期 | user.createdAt |

### API Integration

All endpoints already exist. No backend changes needed.

| Action            | Method | Endpoint               | Notes                             |
| ----------------- | ------ | ---------------------- | --------------------------------- |
| Fetch restaurants | GET    | `/api/v1/restaurants`  | For restaurant dropdown           |
| Create restaurant | POST   | `/api/v1/restaurants`  | Only when "新增餐廳" is selected  |
| Create owner user | POST   | `/api/v1/users`        | With `role: 1` and `restaurantId` |
| Create admin user | POST   | `/api/v1/users`        | With `role: 0`                    |
| List owner users  | GET    | `/api/v1/users?role=1` | For the existing owners table     |
| List admin users  | GET    | `/api/v1/users?role=0` | For the existing admins table     |

### Frontend Files

| Action | File                                                                         |
| ------ | ---------------------------------------------------------------------------- |
| Create | `apps/admin-dashboard/src/views/AccountManagementView.vue`                   |
| Modify | `apps/admin-dashboard/src/router/index.ts` — add route with Admin-only guard |
| Modify | Sidebar component — add "帳號管理" menu item (Admin-only visibility)         |
| Modify | `apps/admin-dashboard/src/types/index.ts` — add interfaces                   |
| Modify | i18n locale files — add translation keys                                     |

### Error Handling

- Form validation errors shown inline beneath each field
- API errors (duplicate username, network failure) shown as a banner above the submit button
- Successful creation shows toast notification and resets the form

### Out of Scope

- No changes to existing UsersView (employee management stays as-is with mock data)
- No new backend API endpoints
- No multi-step wizard — single form with visual sections
- No edit/delete functionality in this iteration

# Admin Dashboard — Shop Owner Management Page

**Date**: 2026-03-12
**Status**: Approved

## Problem

Admin (role=0) needs to create Shop Owner (role=1) accounts on behalf of restaurant owners. Currently, the admin-dashboard's UsersView only manages internal restaurant employees (roles 2-4) using mock data, and there is no dedicated interface for creating owner accounts.

## Design

### Route & Access

- **Route**: `/dashboard/owner-management`
- **Access**: Admin only (role=0)
- **Sidebar**: New "店主管理" item after "用戶管理"

### Page Layout

A dedicated full-page view with two sections:

#### 1. Registration Form (Top)

Three logical sections within a single form card:

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

#### 2. Existing Owners List (Bottom)

A table showing all existing shop owners:
| Column | Source |
|--------|--------|
| 店主 (name + username) | user.fullName, user.username |
| 餐廳 | restaurant name from restaurantId |
| 狀態 | user.status badge |
| 建立日期 | user.createdAt |

### API Integration

All endpoints already exist. No backend changes needed.

| Action            | Method | Endpoint               | Notes                             |
| ----------------- | ------ | ---------------------- | --------------------------------- |
| Fetch restaurants | GET    | `/api/v1/restaurants`  | For restaurant dropdown           |
| Create restaurant | POST   | `/api/v1/restaurants`  | Only when "新增餐廳" is selected  |
| Create owner user | POST   | `/api/v1/users`        | With `role: 1` and `restaurantId` |
| List owner users  | GET    | `/api/v1/users?role=1` | For the existing owners table     |

### Frontend Files

| Action | File                                                                         |
| ------ | ---------------------------------------------------------------------------- |
| Create | `apps/admin-dashboard/src/views/OwnerManagementView.vue`                     |
| Modify | `apps/admin-dashboard/src/router/index.ts` — add route with Admin-only guard |
| Modify | Sidebar component — add "店主管理" menu item (Admin-only visibility)         |

### Error Handling

- Form validation errors shown inline beneath each field
- API errors (duplicate username, network failure) shown as a banner above the submit button
- Successful creation shows toast notification and resets the form

### Out of Scope

- No changes to existing UsersView (employee management stays as-is with mock data)
- No new backend API endpoints
- No multi-step wizard — single form with visual sections
- No edit/delete owner functionality in this iteration

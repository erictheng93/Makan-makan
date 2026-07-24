# 角色測試缺口矩陣（API / integration / 報告彙整）

更新時間：2026-05-27（部分項目於 2026-07-05 核實更新，見表格內 2026-07-05 標註）

## 1) 已確認角色定義

- **0**：Admin / 系統管理員（平台管理、跨店治理）
- **1**：Shop Owner / 店長（餐廳權限管理、營運）
- **2**：Chef / 廚師（廚房接單與出餐）
- **3**：Service Crew / 送菜員（服務流程）
- **4**：Cashier / 收銀員（收銀機、班次、交易）
- **5**：Customer / 顧客（客戶點餐與客戶資源）

> `ADMIN=0`, `OWNER=1`, `CHEF=2`, `SERVICE=3`, `CASHIER=4`, `CUSTOMER=5` 對齊 `apps/api/src/shared/constants/index.ts`。

## 2) 專案掃描結果（測試落點）

我已搜尋以下範圍：
- `apps/api/src/__tests__/integration`
- `apps/admin-dashboard/src/__tests__/integration`
- `apps/customer-app/src/__tests__`
- `apps/kitchen-display/src/__tests__/integration`
- `tests/e2e`
- `docs/testing`（手動 QA / 進度報表）

## 3) 角色 × 模組精細矩陣（有 / 部分 / 缺口）

註：
- `有`：有角色成功 + 角色邊界斷言（允許或拒絕至少一種）
- `部分`：只有成功或只有拒絕，未形成完整模組邊界
- `缺口`：目前未看到該角色該模組的 RBAC 斷言

| 模組 | 0 Admin | 1 Owner | 2 Chef | 3 Service Crew | 4 Cashier | 5 Customer | 主要證據 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Auth（`/auth/*`） | 有 | 部分 | 部分 | 缺口 | 缺口 | 部分 | `apps/api/src/__tests__/integration/auth.real.integration.test.ts` |
| Customer 身分 API（`/customer/*`） | 缺口 | 部分（`/customer/me` staff token 拒） | 缺口 | 缺口 | 缺口 | 有 | `apps/api/src/__tests__/integration/customer-identity.real.integration.test.ts` |
| Customer 訂單檢視（`/customers/me/orders`） | 缺口 | 缺口 | 缺口 | 缺口 | 缺口 | 有 | `apps/api/src/__tests__/integration/customer-orders.real.integration.test.ts`, `apps/api/src/__tests__/integration/pos-and-customer-roles.real.integration.test.ts` |
| 訂單管理（`/orders*`） | 有 | 部分 | 缺口 | 缺口 | 缺口 | 缺口 | `apps/api/src/__tests__/integration/orders.real.integration.test.ts`, `apps/customer-app/src/__tests__/integration/customer-app.real.integration.test.ts`, `apps/admin-dashboard/src/__tests__/integration/admin-dashboard.real.integration.test.ts` |
| 廚房（`/kitchen/*`） | 有（admin 讀取與跨店邊界） | 部分 | 有 | 有（僅 fetch） | 缺口 | 缺口 | `apps/kitchen-display/src/__tests__/integration/kitchen-display.real.integration.test.ts`, `apps/admin-dashboard/src/__tests__/integration/admin-dashboard.real.integration.test.ts`, `apps/api/src/__tests__/integration/auth.real.integration.test.ts` |
| POS（`/pos/*`） | 有 | 有 | 缺口 | 缺口 | 有（完整邊界） | 缺口 | `apps/api/src/__tests__/integration/pos-and-customer-roles.real.integration.test.ts` |
| 菜單查詢（公用 `/menu/*`、`/discovery/*`） | 有 | 有 | 有 | 有 | 有 | 有 | `apps/api/src/__tests__/integration/menu.real.integration.test.ts`, `apps/api/src/__tests__/integration/discovery.real.integration.test.ts` |
| 菜單管理（需管理權限） | 有（間接） | 部分 | 缺口 | 缺口 | 缺口 | 缺口 | `apps/api/src/__tests__/integration/menu.real.integration.test.ts`, `apps/api/src/__tests__/integration/discovery.real.integration.test.ts` |
| 服務項目（`/restaurants/:id/service-items`） | 缺口 | 有（含跨店拒絕） | 缺口 | 缺口 | 缺口 | 有（公用列表） | `apps/api/src/__tests__/integration/restaurant-services.real.integration.test.ts` |
| Coupon（`/coupons*`） | 有 | 有（2026-07-05 核實：owner 跨店拒絕 + analytics/deactivate 全邊界） | 缺口 | 缺口 | 缺口 | 缺口 | `apps/api/src/__tests__/integration/coupons.real.integration.test.ts` |
| 桌位（`/tables*`、`/seats*`） | 有 | 缺口 | 缺口 | 缺口 | 缺口 | 缺口 | `apps/api/src/__tests__/integration/tables.real.integration.test.ts` |
| 候位 / 留位（`/waiting-list/*`, `/reservations/*`） | 缺口 | 部分 | 缺口 | 缺口 | 缺口 | 部分（入列） | `apps/api/src/__tests__/integration/waiting-list-push.real.integration.test.ts` |
| 市場 / 合作（`/admin/markets*`, `/markets*`） | 有 | 部分 | 缺口 | 缺口 | 缺口 | 缺口 | `apps/api/src/__tests__/integration/markets.real.integration.test.ts` |
| Admin-only system（analytics / monitoring / system / users / feedback） | 有（2026-07-05 核實：`/auth/stats`、`/monitoring/metrics`、`/system/health/detailed` 全覆蓋） | 有（owner 拒絕已覆蓋） | 缺口 | 缺口 | 缺口 | 缺口 | `apps/api/src/__tests__/integration/role-gaps-05-admin-modules.real.integration.test.ts` |

## 4) 已補齊的缺口（明確 endpoint）

- `apps/api/src/__tests__/integration/pos-and-customer-roles.real.integration.test.ts`
  - 允許 `GET /api/v1/pos/registers/:registerId/status`
  - 允許 `GET /api/v1/pos/shifts/current/:registerId`
  - 允許 `POST /api/v1/pos/shifts/start`
  - 允許 `POST /api/v1/pos/shifts/:shiftId/end`
  - 允許 `GET /api/v1/pos/cash-movements/shifts/:shiftId/cash-movements`
  - 允許 `GET /api/v1/pos/refunds/registers/:registerId/refunds`
  - 允許 `GET /api/v1/pos/receipts/registers/:registerId/receipts`
  - 拒絕 `POST /api/v1/pos/registers`
  - 拒絕 `PUT /api/v1/pos/registers/:registerId`
  - 拒絕 `POST /api/v1/pos/registers/:registerId/activate`
  - 拒絕 `DELETE /api/v1/pos/registers/:registerId`
  - 拒絕 `POST /api/v1/pos/cash-movements/:movementId/approve`
  - 拒絕 `POST /api/v1/pos/cash-movements/:movementId/reject`
  - 拒絕 `POST /api/v1/pos/refunds/:refundId/approve`
  - 拒絕 `POST /api/v1/pos/refunds/:refundId/reject`
  - 拒絕 `POST /api/v1/pos/refunds/:refundId/cancel`
  - 拒絕 `GET /api/v1/pos/shifts/stats`
  - 拒絕 `GET /api/v1/pos/reports/daily`
  - 拒絕 `GET /api/v1/pos/reports/export`
- `apps/kitchen-display/src/__tests__/integration/kitchen-display.real.integration.test.ts`
  - role 2（chef）可抓 kitchen orders 並更新 item
  - role 2/3 皆經過餐廳邊界 `403`
  - role 3 可抓 kitchen orders（非 kitchen 之外仍有缺口）
- `apps/api/src/__tests__/integration/customer-identity.real.integration.test.ts`
  - 顧客 OTP 登入與 `/customer/me` 成功
  - staff JWT 在 `/customer/me` 拒絕
- `apps/api/src/__tests__/integration/customer-orders.real.integration.test.ts`
  - `/customers/me/orders` 角色 5 可看自己訂單，且 401 排除 role=1
- `apps/api/src/__tests__/integration/restaurant-services.real.integration.test.ts`
  - role 1 可管理 own service-items
  - role 1 跨店管理 service-items 被拒 `403`

## 5) 尚缺測試（優先補齊）

1. ~~補齊角色 1 / 0 對 `/api/v1/coupons*` 的完整 RBAC~~ —— 已於 2026-07-05 核實完成：`coupons.real.integration.test.ts` 已涵蓋 owner 跨店拒絕 + `/coupons/analytics/trends`、`/coupons/:id/deactivate` 全邊界。
2. 補齊 role 3 在非 kitchen 模組（候位/預約/訂位）與 role 2/3 的訂單流程拒絕矩陣。
3. 補齊 role 1 對 `/api/v1/tables*`、`/api/v1/seats*` 的角色邊界（成功 + 跨店拒絕）。
4. 補齊 role 5 對 `/api/v1/orders`（前台創單）與 CSRF/重複提交/幂等邏輯情境 —— **部分已解決（2026-07-05）**：CSRF 拒絕與前台創單邊界已由 `role-gaps-04-customer-orders.real.integration.test.ts` 覆蓋；幂等鍵仍是真實缺口（該測試檔本身標題即為「does not dedupe...when no idempotency key binding exists」）。
5. ~~補齊 admin-only 模組（analytics/monitoring/system/feedback/users）在 `/v1/auth/stats`、`/v1/monitoring`、`/v1/system/*`、`/v1/feedback` 的系統角色邊界~~ —— 已於 2026-07-05 核實完成：`role-gaps-05-admin-modules.real.integration.test.ts` 已涵蓋全部場景。

## 6) 非自動化使用情境證據（已存在）

- `docs/testing/TEST_PROGRESS.md`：RBAC 測試矩陣與 POS/Owner/Cashier / 菜單頁面統計。
- `docs/testing/reports/manual-qa-report-2026-04-02.md`：含 Admin / Owner / Chef / Cashier / Customer 手動 QA 場景、拒絕圖表與跨角色訂單可見性。

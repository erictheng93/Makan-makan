# API 角色缺口 Ticket（可追蹤執行版本）

更新時間：2026-05-28  
目標：每條 ticket 可直接對應實際 API 測試，不使用純 mock，僅做必要 fixture/seed 準備。

## 共通前置條件

- 測試入口：`apps/api` 之 integration test，走實際 HTTP 請求（`supertest`/真實 server）與測試 DB
- Token 取得（建議每 ticket 重用）：
  - `admin`（0）
  - `ownerA`（1，餐廳 A）
  - `ownerB`（1，餐廳 B）
  - `chef`（2）
  - `service`（3）
  - `cashier`（4）
  - `customer`（5）
- 每個 ticket 都要先建立：
  - 一組 `restaurantA`、`restaurantB`
  - 兩組 `owner` 分別綁定兩家餐廳
  - 相關實體（coupon / reservation / table / seat / order / feedback / system data）
- 成功回應可接受 `200` 或 `201`（依 endpoint 現行合約），拒絕回應明確 `401`（未認證）或 `403`（權限不足）

---

## Ticket 01（`P1`）：`coupons` 權限完整化

- **目標**：補齊 `/api/v1/coupons*` 對 `owner(1)` 與 `admin(0)` 的正向與跨店拒絕。
- **mock/seed 準備**
  - 建 `couponA`（屬於 `restaurantA`）
  - 建 `couponB`（屬於 `restaurantB`）
  - 使用 `admin/ownerA/ownerB` token
- **實打 API**
  1. `GET /api/v1/coupons/analytics/trends?restaurantId={restaurantA.id}` with `ownerA` → **預期 200**
  2. `GET /api/v1/coupons/analytics/trends?restaurantId={restaurantB.id}` with `ownerA` → **預期 403**
  3. `GET /api/v1/coupons/analytics/trends?restaurantId={restaurantB.id}` with `ownerB` → **預期 200**
  4. `POST /api/v1/coupons/{couponA.id}/deactivate` with `ownerA` → **預期 200/204**
  5. `POST /api/v1/coupons/{couponB.id}/deactivate` with `ownerA` → **預期 403**
  6. `POST /api/v1/coupons/{couponA.id}/deactivate` with `admin` → **預期 200/204**
  7. `POST /api/v1/coupons/{couponB.id}/deactivate` with `admin` → **預期 200/204**
  8. 無 `Authorization` 呼叫步驟 1 → **預期 401**
- **完成條件（勾選）**
  - [ ] 以上 8 項 API 狀態碼逐筆確認
  - [ ] owner 跨店拒絕與 admin 全域授權皆有紀錄

---

## Ticket 02（`P1`）：`reservations`/`orders` 角色 3 與角色 2-3 訂單流程拒絕矩陣
狀態：完成中（Ticket 02 已執行 pass，並更新為實際可得行為）

- **目標**：釐清 role 3（service）在候位/訂位的可視/不可視與 role 2/3 在訂單狀態更新上的權限邊界。
- **mock/seed 準備**
  - 建 `reservation`（餐廳 A，含可做 confirm/seat/no-show/arrive path 的狀態）
  - 建 `orderPlaced`、`orderConfirmed`（餐廳 A）
  - 同時建立 `service`（3）、`chef`（2）帳號
- **實打 API**
  - 候位/預約：
    1. `GET /api/v1/reservations` with `service` → **預期 403**（列表不可讀）
    2. `GET /api/v1/reservations/{reservation.id}` with `service` → **預期 200**
    3. `POST /api/v1/reservations/{reservation.id}/confirm` with `service` → **預期 403**
    4. `POST /api/v1/reservations/{reservation.id}/seat` with `service` → **預期 200**（若環境為此 route 允許）
    5. 若有 `reservationB`（餐廳 B）：
       - `GET /api/v1/reservations/{reservationB.id}` with `service` → **預期 403**
  - 訂單流程：
    6. `PUT /api/v1/orders/{orderPlaced.id}/status` with `service` + payload `{ "status": "confirmed" }` → **預期 403**（實測目前不允許，需保留現況）
    7. `PUT /api/v1/orders/{orderPlaced.id}/status` with `chef` + payload `{ "status": "confirmed" }` → **預期 403/400**（不應可做）
    8. `PUT /api/v1/orders/{orderPlaced.id}/status` with `chef` + payload `{ "status": "preparing" }` → **預期 200**（正向 chef 動作）
    9. `PUT /api/v1/orders/{orderPlaced.id}/status` with `service` + payload `{ "status": "ready" }` → **預期 200**（正向 service 動作）
    10. `PUT /api/v1/orders/{orderPlaced.id}/status` with `chef` + payload `{ "status": "delivered" }` → **預期 403**
- **完成條件（勾選）**
- [x] 已新增 real API 測試檔：`apps/api/src/__tests__/integration/role-gaps-02-orders-reservations.real.integration.test.ts`
- [x] 2 類模組（`reservations`/`orders`）各自都有「允許 + 拒絕」斷言
- [x] 角色 2/3 對錯誤狀態轉移回傳拒絕

---

## Ticket 03（`P0`）：`owner` 對 `/api/v1/tables*`、`/api/v1/seats*` 邊界
狀態：完成（已補齊測試並通過；同時修正 `/api/v1/seats*` ownership 檢查缺口）

- **目標**：確認 role 1 具備 own 餐廳管理能力，且不能跨店操作。
- **mock/seed 準備**
  - `tableA` / `tableB`（餐廳 A/B）
  - `seatA` / `seatB`（餐廳 A/B），其中 `seatB` 指向 `tableB`
  - `ownerA` token / `ownerB` token
- **實打 API**
  1. `GET /api/v1/tables?restaurantId={restaurantA.id}` with `ownerA` → **預期 200**
  2. `GET /api/v1/tables/{tableB.id}` with `ownerA` → **預期 403**
  3. `POST /api/v1/tables` with body 含 `restaurantId={restaurantB.id}` using `ownerA` → **預期 403**
  4. `PUT /api/v1/tables/{tableB.id}` with `ownerA` → **預期 403**
  5. `DELETE /api/v1/tables/{tableB.id}` with `ownerA`（若 route 可用）→ **預期 403**
  6. `GET /api/v1/seats?restaurantId={restaurantA.id}` with `ownerA` → **預期 200**
  7. `GET /api/v1/seats/{seatB.id}` with `ownerA` → **預期 403**
  8. `POST /api/v1/seats/batch-create` with `tableId={tableB.id}` and `ownerA` → **預期 403**
  9. `PUT /api/v1/seats/{seatB.id}` with `ownerA` → **預期 403**
  10. 同步確認 `ownerB` 操作同一資源（`tableB/seatB`）為**預期 200/204**
- **完成條件（勾選）**
- [x] 已新增 real API 測試檔：`apps/api/src/__tests__/integration/role-gaps-03-tables-seats.real.integration.test.ts`
- [x] owner 只能在 own 餐廳做成功寫入
- [x] 所有跨店操作明確回 `403`

---

## Ticket 04（`P1`）：`customer` 對前台下單與幂等/CSRF

- **目標**：補齊 role 5 在下單流程的真實 API 邏輯，包含 CSRF 驗證與重複提交處理。
- **狀態**：進行中（測試執行中）
- **mock/seed 準備**
  - 建立可下單的 `menuItem/restaurant/menu/price`（屬於餐廳 A）
  - 建立 customer token（`customer`）
  - 取得或建立 `csrf token`（依目前 app 的 CSRF 實作）
  - 準備固定 payload 與 `Idempotency-Key`（如 `X-Idempotency-Key`）
- **實打 API**
  1. `POST /api/v1/customer/orders`（未帶 CSRF）→ **預期 403**
  2. `POST /api/v1/customer/orders`（帶正確 CSRF）→ **預期 201**
  3. 再次送出同樣 payload + 同一 `Idempotency-Key` → **預期 200** 且不新增新訂單
  4. 初次成功後變更 payload 金額再用同一 key → **預期 409/400**（避免資料衝突，依實作）
  5. 未帶 token 的前台下單 → **預期 401**
  6. 使用 `owner` 或 `admin` token 嘗試同 endpoint（非角色路徑）→ **預期 403**
- **完成條件（勾選）**
- [ ] 已新增 real API 測試檔：`apps/api/src/__tests__/integration/role-gaps-04-customer-orders.real.integration.test.ts`
- [ ] 已覆蓋未帶 CSRF/未帶 token 的拒絕行為
- [ ] 已覆蓋 `/api/v1/orders` 客戶角色建立與權限邊界
- [ ] 已覆蓋重複提交行為（目前實作無幂等鍵綁定）
- [ ] 已覆蓋 `/api/v1/customers/me/orders` 與 canonical customer token 一致性

---

## Ticket 05（`P0`）：admin-only 模組邊界（`/v1/auth`, `/v1/monitoring`, `/v1/system`, `/v1/feedback`）

- **目標**：確保 admin(0) 專屬端點行為一致：`admin` 可用，非 admin 不可用（除公開 health）。
- **狀態**：進行中（測試執行中）
- **mock/seed 準備**
  - `admin`、`owner`、`chef`、`service`、`cashier`、`customer` token
  - 至少一筆 feedback record、system 錯誤紀錄（對應 `/system/error-stats`）
  - `restaurantA` / `restaurantB` 及 owner 綁定
- **實打 API**
  - `Auth`：
    1. `GET /api/v1/auth/stats` with admin → **預期 200**
    2. `GET /api/v1/auth/stats` with owner → **預期 403**
  - `Monitoring`：
    3. `GET /api/v1/monitoring/metrics` with admin → **預期 200**
    4. `GET /api/v1/monitoring/metrics` with non-admin 5 角色 → **預期 403**
  - `System`：
    5. `GET /api/v1/system/health` → **預期 200**（公開）
    6. `GET /api/v1/system/health/detailed` with admin → **預期 200**
    7. `GET /api/v1/system/health/detailed` with non-admin → **預期 403**
    8. `GET /api/v1/system/error-stats?restaurantId={restaurantA.id}` with ownerA → **預期 200**
    9. `GET /api/v1/system/error-stats?restaurantId={restaurantB.id}` with ownerA → **預期 403**
  - `Feedback`：
    10. `GET /api/v1/feedback` with owner → **預期 403**
    11. `GET /api/v1/feedback/stats` with admin → **預期 200**
    12. `GET /api/v1/feedback/stats` with owner → **預期 403**
- **完成條件（勾選）**
- [ ] 已新增 real API 測試檔：`apps/api/src/__tests__/integration/role-gaps-05-admin-modules.real.integration.test.ts`
- [ ] 已覆蓋 admin 與非 admin 對照（`/api/v1/auth/stats`、`/api/v1/monitoring/metrics`、`/api/v1/system/health/detailed`、`/api/v1/feedback/stats`）
- [ ] 已確認公開 endpoint 行為：`/api/v1/monitoring/health`、`/api/v1/system/health`
- [ ] 已確認 `/api/v1/feedback` 與 `/api/v1/system/error-stats` owner/admin 邏輯範圍

---

## 你勾選時的紀錄建議

每條 ticket 建議補上實際測試檔名，例如 `apps/api/src/__tests__/integration/<module>.roles-gap.real.integration.test.ts`，並在 CI 前完成以下註記：

- [ ] 測試可重複執行（seed 重建/清理完整）
- [ ] 驗證返回的狀態碼與文件一致
- [ ] 將結果更新回 `docs/testing/ROLE_TEST_GAP_MATRIX.md` 的「已補齊」與「尚缺測試」區塊

# API Documentation / API 文檔

MakanMasak REST API 文檔與使用指南。

## 文件夾結構

### Guides (`guides/`)

API 使用指南

- `API_PAGINATION_GUIDE.md` - 分頁指南

---

## API 概覽

### Base URL

```
Production:  https://api.makanmasak.com/v1
Staging:     https://staging-api.makanmasak.com/v1
Local:       http://localhost:8787/api/v1
```

### 認證

所有受保護的 API 端點需要 JWT Bearer Token:

```http
Authorization: Bearer <your_jwt_token>
```

部分公開端點（如菜單瀏覽、排隊加入）不需要認證。Guest 訂餐使用 Guest Token。

---

## API 端點總覽

### Authentication (`/auth`) — 18 routes

| Method | Path                        | Description       | Auth        |
| ------ | --------------------------- | ----------------- | ----------- |
| POST   | `/auth/login`               | 登入              | Public      |
| POST   | `/auth/register`            | 顧客註冊          | Public      |
| POST   | `/auth/register-staff`      | 員工註冊          | Admin/Owner |
| POST   | `/auth/refresh`             | 刷新令牌          | Public      |
| POST   | `/auth/logout`              | 登出              | Protected   |
| GET    | `/auth/me`                  | 取得當前用戶資料  | Protected   |
| GET    | `/auth/profile/:id`         | 取得用戶資料      | Protected   |
| PUT    | `/auth/profile/:id`         | 更新用戶資料      | Protected   |
| POST   | `/auth/change-password`     | 變更密碼          | Protected   |
| GET    | `/auth/sessions`            | 取得登入 sessions | Protected   |
| DELETE | `/auth/sessions/:sessionId` | 終止特定 session  | Protected   |
| DELETE | `/auth/sessions`            | 終止所有 sessions | Protected   |
| POST   | `/auth/forgot-password`     | 請求密碼重設      | Public      |
| POST   | `/auth/reset-password`      | 重設密碼          | Public      |
| POST   | `/auth/verify-email`        | 驗證 Email        | Public      |
| GET    | `/auth/stats`               | 認證統計          | Admin       |
| GET    | `/auth/security-events`     | 安全事件          | Admin       |
| POST   | `/auth/guest-token`         | 產生 Guest Token  | Public      |

### Verification (`/verification`) — 7 routes

| Method | Path                                  | Description     | Auth   |
| ------ | ------------------------------------- | --------------- | ------ |
| POST   | `/verification/forgot-password`       | 請求密碼重設    | Public |
| GET    | `/verification/reset-password/verify` | 驗證重設 Token  | Public |
| POST   | `/verification/reset-password`        | 重設密碼        | Public |
| POST   | `/verification/verify-email/send`     | 發送 Email 驗證 | Public |
| GET    | `/verification/verify-email`          | 驗證 Email      | Public |
| POST   | `/verification/verify-phone/send`     | 發送手機 OTP    | Public |
| POST   | `/verification/verify-phone`          | 驗證手機 OTP    | Public |

### Users (`/users`) — 10 routes

| Method | Path                        | Description    | Auth        |
| ------ | --------------------------- | -------------- | ----------- |
| GET    | `/users`                    | 員工列表       | Admin/Owner |
| GET    | `/users/:id`                | 取得員工資料   | Admin/Owner |
| POST   | `/users`                    | 新增員工       | Admin/Owner |
| PUT    | `/users/:id`                | 更新員工       | Admin/Owner |
| POST   | `/users/:id/password`       | 變更員工密碼   | Admin/Owner |
| PATCH  | `/users/:id/status`         | 更新員工狀態   | Admin/Owner |
| PATCH  | `/users/:id/verify`         | 驗證員工       | Admin/Owner |
| POST   | `/users/:id/reset-password` | 管理員重設密碼 | Admin/Owner |
| GET    | `/users/stats`              | 員工統計       | Admin/Owner |
| GET    | `/users/search`             | 搜尋員工       | Admin/Owner |

### Customers (`/customers`) — 2 routes

| Method | Path                   | Description  | Auth     |
| ------ | ---------------------- | ------------ | -------- |
| GET    | `/customers/me`        | 取得顧客資料 | Customer |
| GET    | `/customers/me/orders` | 取得顧客訂單 | Customer |

### Restaurants (`/restaurants`) — 13 routes

| Method | Path                                    | Description       | Auth        |
| ------ | --------------------------------------- | ----------------- | ----------- |
| GET    | `/restaurants`                          | 餐廳列表          | Public      |
| GET    | `/restaurants/popular`                  | 熱門餐廳          | Public      |
| GET    | `/restaurants/nearby/:district`         | 依區域搜尋        | Public      |
| POST   | `/restaurants`                          | 創建餐廳          | Admin       |
| GET    | `/restaurants/:id`                      | 餐廳詳情          | Public      |
| PUT    | `/restaurants/:id`                      | 更新餐廳          | Admin/Owner |
| DELETE | `/restaurants/:id`                      | 停用餐廳          | Admin       |
| GET    | `/restaurants/:id/stats`                | 餐廳統計          | Admin/Owner |
| POST   | `/restaurants/:id/qr/shop/generate`     | 產生店鋪 QR       | Admin/Owner |
| POST   | `/restaurants/:id/qr/shop/regenerate`   | 重新產生店鋪 QR   | Admin/Owner |
| GET    | `/restaurants/:id/qr/shop`              | 取得店鋪 QR 資訊  | Admin/Owner |
| POST   | `/restaurants/:id/qr/shop/upload-image` | 上傳 QR 圖片      | Admin/Owner |
| PUT    | `/restaurants/:id/shop-mode`            | 啟用/停用店鋪模式 | Admin/Owner |

### Menu (`/menu`) — 17 routes

| Method | Path                                     | Description      | Auth        |
| ------ | ---------------------------------------- | ---------------- | ----------- |
| GET    | `/menu/:restaurantId`                    | 取得完整菜單     | Public      |
| GET    | `/menu/:restaurantId/featured`           | 精選菜單項目     | Public      |
| GET    | `/menu/:restaurantId/popular`            | 熱門菜單項目     | Public      |
| GET    | `/menu/:restaurantId/search`             | 搜尋菜單         | Public      |
| GET    | `/menu/items/:id`                        | 菜單項目詳情     | Public      |
| POST   | `/menu/:restaurantId/items`              | 新增菜單項目     | Protected   |
| PUT    | `/menu/items/:id`                        | 更新菜單項目     | Protected   |
| DELETE | `/menu/items/:id`                        | 刪除菜單項目     | Protected   |
| PATCH  | `/menu/:restaurantId/items/availability` | 批量更新供應狀態 | Protected   |
| PATCH  | `/menu/:restaurantId/items/prices`       | 批量更新價格     | Protected   |
| PATCH  | `/menu/:restaurantId/items/categories`   | 批量移動分類     | Protected   |
| POST   | `/menu/:restaurantId/categories`         | 新增分類         | Protected   |
| PUT    | `/menu/categories/:id`                   | 更新分類         | Protected   |
| PATCH  | `/menu/:restaurantId/categories/reorder` | 分類排序         | Protected   |
| DELETE | `/menu/categories/:id`                   | 刪除分類         | Protected   |
| GET    | `/menu/:restaurantId/analytics`          | 菜單分析         | Admin/Owner |
| GET    | `/menu/:restaurantId/popularity`         | 人氣指標         | Admin/Owner |

### Orders (`/orders`) — 14 routes

| Method | Path                     | Description     | Auth        |
| ------ | ------------------------ | --------------- | ----------- |
| POST   | `/orders/guest`          | 建立 Guest 訂單 | Guest Token |
| GET    | `/orders/guest/:id`      | 查詢 Guest 訂單 | Guest Token |
| POST   | `/orders/preview-coupon` | 預覽優惠券效果  | Protected   |
| POST   | `/orders`                | 建立訂單        | Protected   |
| GET    | `/orders`                | 訂單列表        | Protected   |
| GET    | `/orders/:id`            | 訂單詳情        | Protected   |
| PUT    | `/orders/:id/status`     | 更新訂單狀態    | Protected   |
| DELETE | `/orders/:id`            | 取消訂單        | Protected   |
| GET    | `/orders/stats`          | 訂單統計        | Admin/Owner |
| GET    | `/orders/analytics`      | 訂單分析        | Admin/Owner |
| POST   | `/orders/bulk`           | 批量操作        | Admin/Owner |
| POST   | `/orders/export`         | 匯出訂單        | Admin/Owner |
| GET    | `/orders/:id/receipt`    | 產生收據        | Protected   |
| GET    | `/orders/active`         | 進行中訂單      | Protected   |

### Guest Orders (`/guest-orders`) — 4 routes

| Method | Path                       | Description     | Auth   |
| ------ | -------------------------- | --------------- | ------ |
| POST   | `/guest-orders`            | 建立 Guest 訂單 | Public |
| GET    | `/guest-orders/:id`        | 查詢 Guest 訂單 | Guest  |
| POST   | `/guest-orders/:id/items`  | 加入品項        | Guest  |
| POST   | `/guest-orders/:id/cancel` | 取消 Guest 訂單 | Guest  |

### Group Orders (`/group-orders`) — 15 routes

| Method | Path                                            | Description    | Auth      |
| ------ | ----------------------------------------------- | -------------- | --------- |
| GET    | `/group-orders`                                 | 團體訂單列表   | Protected |
| POST   | `/group-orders/generate-code`                   | 產生分享碼     | Protected |
| GET    | `/group-orders/export`                          | 匯出團體訂單   | Protected |
| POST   | `/group-orders/create`                          | 建立團體訂單   | Protected |
| POST   | `/group-orders/join/:shareCode`                 | 加入團體訂單   | Public    |
| GET    | `/group-orders/statistics`                      | 團體訂單統計   | Protected |
| GET    | `/group-orders/:groupOrderId`                   | 團體訂單詳情   | Public    |
| POST   | `/group-orders/:groupOrderId/cart`              | 加入購物車     | Protected |
| PUT    | `/group-orders/:groupOrderId/cart/:itemId`      | 更新購物車品項 | Protected |
| DELETE | `/group-orders/:groupOrderId/cart/:itemId`      | 移除購物車品項 | Protected |
| POST   | `/group-orders/:groupOrderId/split`             | 分帳           | Protected |
| POST   | `/group-orders/:groupOrderId/payment/:memberId` | 處理付款       | Protected |
| POST   | `/group-orders/:groupOrderId/leave/:memberId`   | 離開團體       | Protected |
| GET    | `/group-orders/:groupOrderId/activities`        | 活動紀錄       | Protected |
| POST   | `/group-orders/cleanup/expired`                 | 清理過期團體   | Admin     |

### Tables (`/tables`) — 13 routes

| Method | Path                        | Description    | Auth      |
| ------ | --------------------------- | -------------- | --------- |
| GET    | `/tables`                   | 桌位列表       | Protected |
| GET    | `/tables/:id`               | 桌位詳情       | Protected |
| POST   | `/tables`                   | 新增桌位       | Protected |
| PUT    | `/tables/:id`               | 更新桌位       | Protected |
| DELETE | `/tables/:id`               | 刪除桌位       | Protected |
| POST   | `/tables/:id/occupy`        | 佔用桌位       | Protected |
| POST   | `/tables/:id/release`       | 釋放桌位       | Protected |
| POST   | `/tables/:id/clean`         | 標記已清潔     | Protected |
| POST   | `/tables/:id/regenerate-qr` | 重新產生 QR    | Protected |
| POST   | `/tables/bulk-qr`           | 批量產生 QR    | Protected |
| GET    | `/tables/available`         | 可用桌位       | Protected |
| GET    | `/tables/stats`             | 桌位統計       | Protected |
| GET    | `/tables/qr/:qrCode`        | 依 QR 查詢桌位 | Public    |

### Seats (`/seats`) — 12 routes

| Method | Path                         | Description      | Auth      |
| ------ | ---------------------------- | ---------------- | --------- |
| GET    | `/seats`                     | 座位列表         | Protected |
| GET    | `/seats/stats`               | 座位統計         | Protected |
| GET    | `/seats/qr/:qrCode`          | 依 QR 查詢座位   | Public    |
| GET    | `/seats/:id`                 | 座位詳情         | Protected |
| POST   | `/seats/batch-create`        | 批量建立座位     | Protected |
| POST   | `/seats/batch-regenerate-qr` | 批量重新產生 QR  | Protected |
| PUT    | `/seats/:id`                 | 更新座位         | Protected |
| DELETE | `/seats/:id`                 | 刪除座位         | Protected |
| DELETE | `/seats/table/:tableId`      | 刪除桌位所有座位 | Protected |
| POST   | `/seats/:id/occupy`          | 佔用座位         | Protected |
| POST   | `/seats/:id/release`         | 釋放座位         | Protected |
| POST   | `/seats/:id/regenerate-qr`   | 重新產生 QR      | Protected |

### QR Codes (`/qr`) — 11 routes

| Method | Path                          | Description  | Auth      |
| ------ | ----------------------------- | ------------ | --------- |
| POST   | `/qr/generate`                | 產生 QR 碼   | Protected |
| POST   | `/qr/bulk`                    | 批量產生 QR  | Protected |
| GET    | `/qr/:id/download`            | 下載 QR 圖片 | Protected |
| GET    | `/qr/batch/:batchId/download` | 下載批量 QR  | Protected |
| GET    | `/qr/stats`                   | QR 統計      | Protected |
| GET    | `/qr/templates`               | QR 模板列表  | Protected |
| GET    | `/qr/templates/:id`           | 模板詳情     | Protected |
| POST   | `/qr/templates`               | 建立模板     | Protected |
| PUT    | `/qr/templates/:id`           | 更新模板     | Protected |
| DELETE | `/qr/templates/:id`           | 刪除模板     | Protected |
| GET    | `/qr/verify/shop/:qrCode`     | 驗證店鋪 QR  | Public    |

### Reservations (`/reservations`) — 15 routes

| Method | Path                                | Description  | Auth      |
| ------ | ----------------------------------- | ------------ | --------- |
| POST   | `/reservations`                     | 建立預約     | Public    |
| GET    | `/reservations/verify/:code`        | 依確認碼查詢 | Public    |
| GET    | `/reservations/availability`        | 查詢可用時段 | Public    |
| DELETE | `/reservations/:id/cancel`          | 取消預約     | Public    |
| GET    | `/reservations`                     | 預約列表     | Protected |
| GET    | `/reservations/:id`                 | 預約詳情     | Protected |
| PUT    | `/reservations/:id`                 | 更新預約     | Protected |
| POST   | `/reservations/:id/confirm`         | 確認預約     | Protected |
| POST   | `/reservations/:id/arrive`          | 標記到達     | Protected |
| POST   | `/reservations/:id/seat`            | 標記已入座   | Protected |
| POST   | `/reservations/:id/complete`        | 完成預約     | Protected |
| POST   | `/reservations/:id/no-show`         | 標記未到     | Protected |
| GET    | `/reservations/stats/:restaurantId` | 預約統計     | Protected |
| POST   | `/reservations/slots`               | 建立時段     | Protected |
| POST   | `/reservations/slots/batch`         | 批量建立時段 | Protected |

### Queue (`/queue`) — 7 routes

| Method | Path                              | Description      | Auth      |
| ------ | --------------------------------- | ---------------- | --------- |
| POST   | `/queue/join`                     | 加入排隊         | Public    |
| GET    | `/queue/:restaurantId/status`     | 排隊狀態         | Public    |
| POST   | `/queue/:restaurantId/call-next`  | 叫號             | Protected |
| POST   | `/queue/:queueId/seat`            | 帶位入座         | Protected |
| GET    | `/queue/restaurant/:restaurantId` | 排隊列表（舊版） | Protected |
| POST   | `/queue/:restaurantId/migrate`    | 遷移排隊資料     | Admin     |
| GET    | `/queue/health`                   | 排隊系統健康檢查 | Public    |

### Waiting List (`/waiting-list`) — 12 routes

| Method | Path                                        | Description  | Auth      |
| ------ | ------------------------------------------- | ------------ | --------- |
| POST   | `/waiting-list`                             | 加入候位     | Public    |
| GET    | `/waiting-list/:id`                         | 查詢候位     | Public    |
| GET    | `/waiting-list/queue-status/:restaurantId`  | 候位狀態     | Public    |
| GET    | `/waiting-list/estimate-wait/:restaurantId` | 預估等候時間 | Public    |
| DELETE | `/waiting-list/:id`                         | 取消候位     | Public    |
| POST   | `/waiting-list/:id/confirm`                 | 確認候位     | Public    |
| GET    | `/waiting-list`                             | 候位列表     | Protected |
| POST   | `/waiting-list/:id/call`                    | 叫號         | Protected |
| POST   | `/waiting-list/:id/seat`                    | 標記已入座   | Protected |
| POST   | `/waiting-list/:id/expire`                  | 標記過期     | Protected |
| GET    | `/waiting-list/stats/:restaurantId`         | 候位統計     | Protected |
| POST   | `/waiting-list/batch-call`                  | 批量叫號     | Protected |

### Coupons (`/coupons`) — 13 routes

| Method | Path                               | Description    | Auth      |
| ------ | ---------------------------------- | -------------- | --------- |
| POST   | `/coupons/validate`                | 驗證優惠碼     | Public    |
| GET    | `/coupons/available/:restaurantId` | 可用優惠券     | Public    |
| POST   | `/coupons`                         | 建立優惠券     | Protected |
| GET    | `/coupons`                         | 優惠券列表     | Protected |
| GET    | `/coupons/stats/summary`           | 優惠券統計摘要 | Protected |
| GET    | `/coupons/:id`                     | 優惠券詳情     | Protected |
| PUT    | `/coupons/:id`                     | 更新優惠券     | Protected |
| POST   | `/coupons/:id/deactivate`          | 停用優惠券     | Protected |
| DELETE | `/coupons/:id`                     | 刪除優惠券     | Admin     |
| GET    | `/coupons/:id/stats`               | 優惠券使用統計 | Protected |
| POST   | `/coupons/bulk`                    | 批量操作       | Protected |
| POST   | `/coupons/use`                     | 記錄使用       | Protected |
| GET    | `/coupons/analytics/trends`        | 使用趨勢       | Protected |

### Partnerships (`/partnerships`) — 22 routes

| Method | Path                                      | Description  | Auth      |
| ------ | ----------------------------------------- | ------------ | --------- |
| POST   | `/partnerships`                           | 建立合作夥伴 | Protected |
| GET    | `/partnerships`                           | 合作夥伴列表 | Protected |
| GET    | `/partnerships/:id`                       | 合作夥伴詳情 | Protected |
| GET    | `/partnerships/:id/statistics`            | 合作統計     | Protected |
| PUT    | `/partnerships/:id`                       | 更新合作夥伴 | Protected |
| DELETE | `/partnerships/:id`                       | 刪除合作夥伴 | Protected |
| POST   | `/partnerships/plans`                     | 建立方案     | Protected |
| GET    | `/partnerships/plans`                     | 方案列表     | Protected |
| GET    | `/partnerships/plans/:planId`             | 方案詳情     | Protected |
| POST   | `/partnerships/plans/validate`            | 驗證方案     | Protected |
| PUT    | `/partnerships/plans/:planId`             | 更新方案     | Protected |
| DELETE | `/partnerships/plans/:planId`             | 刪除方案     | Protected |
| POST   | `/partnerships/members/verify`            | 會員驗證     | Protected |
| GET    | `/partnerships/members`                   | 會員列表     | Protected |
| GET    | `/partnerships/members/:memberId`         | 會員詳情     | Protected |
| POST   | `/partnerships/members/:memberId/approve` | 核准會員     | Protected |
| POST   | `/partnerships/members/:memberId/reject`  | 拒絕會員     | Protected |
| PUT    | `/partnerships/members/:memberId`         | 更新會員     | Protected |
| POST   | `/partnerships/usage`                     | 記錄使用     | Protected |
| GET    | `/partnerships/usage`                     | 使用紀錄     | Protected |
| POST   | `/partnerships/usage/:id/cancel`          | 取消使用     | Protected |
| POST   | `/partnerships/usage/:id/refund`          | 退款         | Protected |

### POS (`/pos`) — 25 routes

**收銀機管理：**

| Method | Path                                    | Description | Auth      |
| ------ | --------------------------------------- | ----------- | --------- |
| POST   | `/pos/registers`                        | 建立收銀機  | Protected |
| GET    | `/pos/registers`                        | 收銀機列表  | Protected |
| GET    | `/pos/registers/:registerId/status`     | 收銀機狀態  | Protected |
| PUT    | `/pos/registers/:registerId`            | 更新收銀機  | Protected |
| POST   | `/pos/registers/:registerId/activate`   | 啟用收銀機  | Protected |
| POST   | `/pos/registers/:registerId/deactivate` | 停用收銀機  | Protected |
| DELETE | `/pos/registers/:registerId`            | 刪除收銀機  | Protected |

**班次管理：**

| Method | Path                              | Description | Auth      |
| ------ | --------------------------------- | ----------- | --------- |
| POST   | `/pos/shifts/start`               | 開始班次    | Protected |
| POST   | `/pos/shifts/:shiftId/end`        | 結束班次    | Protected |
| POST   | `/pos/shifts/:shiftId/suspend`    | 暫停班次    | Protected |
| POST   | `/pos/shifts/:shiftId/resume`     | 恢復班次    | Protected |
| GET    | `/pos/shifts/current/:registerId` | 當前班次    | Protected |
| GET    | `/pos/shifts/:shiftId/report`     | 班次報表    | Protected |
| GET    | `/pos/shifts/stats`               | 班次統計    | Protected |

**現金管理：**

| Method | Path                                      | Description  | Auth      |
| ------ | ----------------------------------------- | ------------ | --------- |
| POST   | `/pos/shifts/:shiftId/cash-movements`     | 記錄現金異動 | Protected |
| GET    | `/pos/shifts/:shiftId/cash-movements`     | 現金異動紀錄 | Protected |
| GET    | `/pos/registers/:registerId/cash-count`   | 現金盤點     | Protected |
| POST   | `/pos/cash-movements/:movementId/approve` | 核准異動     | Protected |
| POST   | `/pos/cash-movements/:movementId/reject`  | 拒絕異動     | Protected |

**收據：**

| Method | Path                                  | Description | Auth      |
| ------ | ------------------------------------- | ----------- | --------- |
| POST   | `/pos/receipts/print`                 | 列印收據    | Protected |
| POST   | `/pos/receipts/:receiptId/reprint`    | 重印收據    | Protected |
| POST   | `/pos/receipts/:receiptId/cancel`     | 作廢收據    | Protected |
| GET    | `/pos/registers/:registerId/receipts` | 收據列表    | Protected |
| GET    | `/pos/receipts/:receiptId`            | 收據詳情    | Protected |

### Kitchen (`/kitchen`) — 5 routes

| Method | Path                                                   | Description      | Auth      |
| ------ | ------------------------------------------------------ | ---------------- | --------- |
| GET    | `/kitchen/:restaurantId/events`                        | SSE 廚房即時事件 | Protected |
| GET    | `/kitchen/:restaurantId/orders`                        | 廚房訂單列表     | Protected |
| PUT    | `/kitchen/:restaurantId/orders/:orderId/items/:itemId` | 更新品項狀態     | Protected |
| POST   | `/kitchen/:restaurantId/broadcast-test`                | 測試廣播         | Dev       |
| GET    | `/kitchen/:restaurantId/connections`                   | 連線狀態         | Protected |

### Ingredients (`/ingredients`) — 12 routes

| Method | Path                                                      | Description    | Auth      |
| ------ | --------------------------------------------------------- | -------------- | --------- |
| GET    | `/ingredients/:restaurantId`                              | 食材列表       | Protected |
| POST   | `/ingredients/:restaurantId`                              | 新增食材       | Protected |
| POST   | `/ingredients/:restaurantId/bulk`                         | 批量匯入食材   | Protected |
| GET    | `/ingredients/:restaurantId/categories`                   | 食材分類       | Protected |
| GET    | `/ingredients/:restaurantId/recipes/missing`              | 缺少食譜的品項 | Protected |
| GET    | `/ingredients/:restaurantId/:id`                          | 食材詳情       | Protected |
| PUT    | `/ingredients/:restaurantId/:id`                          | 更新食材       | Protected |
| PATCH  | `/ingredients/:restaurantId/:id/stock`                    | 更新庫存       | Protected |
| DELETE | `/ingredients/:restaurantId/:id`                          | 刪除食材       | Protected |
| GET    | `/ingredients/:restaurantId/recipes/:menuItemId`          | 取得食譜       | Protected |
| PUT    | `/ingredients/:restaurantId/recipes/:menuItemId`          | 設定食譜       | Protected |
| POST   | `/ingredients/:restaurantId/recipes/:menuItemId/validate` | 驗證食譜       | Protected |

### Forecast (`/forecast`) — 5 routes

| Method | Path                                          | Description  | Auth      |
| ------ | --------------------------------------------- | ------------ | --------- |
| POST   | `/forecast/:restaurantId/generate`            | 產生預測     | Protected |
| GET    | `/forecast/:restaurantId`                     | 取得預測資料 | Protected |
| GET    | `/forecast/:restaurantId/accuracy`            | 預測準確度   | Protected |
| GET    | `/forecast/:restaurantId/ingredient-forecast` | 食材預測     | Protected |
| GET    | `/forecast/:restaurantId/alerts`              | 預測警告     | Protected |

### Discovery (`/discovery`) — 5 routes

| Method | Path                              | Description | Auth   |
| ------ | --------------------------------- | ----------- | ------ |
| GET    | `/discovery/search`               | 搜尋菜餚    | Public |
| GET    | `/discovery/restaurants`          | 瀏覽餐廳    | Public |
| GET    | `/discovery/restaurants/:id/menu` | 餐廳菜單    | Public |
| GET    | `/discovery/popular`              | 熱門品項    | Public |
| POST   | `/discovery/reindex`              | 重建索引    | Admin  |

### Analytics (`/analytics`) — 11 routes

| Method | Path                              | Description  | Auth      |
| ------ | --------------------------------- | ------------ | --------- |
| GET    | `/analytics/dashboard`            | 儀表板分析   | Protected |
| GET    | `/analytics/revenue`              | 營收分析     | Protected |
| GET    | `/analytics/products`             | 產品分析     | Protected |
| GET    | `/analytics/customers`            | 顧客分析     | Protected |
| GET    | `/analytics/performance`          | 績效分析     | Protected |
| GET    | `/analytics/export`               | 匯出分析資料 | Protected |
| GET    | `/analytics/realtime-dashboard`   | 即時儀表板   | Protected |
| GET    | `/analytics/detailed-performance` | 詳細績效     | Protected |
| GET    | `/analytics/owner-dashboard`      | 店主儀表板   | Protected |
| GET    | `/analytics/financial-report`     | 財務報表     | Protected |
| GET    | `/analytics/sse`                  | SSE 分析串流 | Protected |

### AI Analytics (`/ai-analytics`) — 10 routes

| Method | Path                                                   | Description      | Auth      |
| ------ | ------------------------------------------------------ | ---------------- | --------- |
| GET    | `/ai-analytics/config/:restaurantId`                   | 取得 AI 設定     | Protected |
| POST   | `/ai-analytics/config`                                 | 設定 AI Provider | Protected |
| POST   | `/ai-analytics/test-provider`                          | 測試 Provider    | Protected |
| GET    | `/ai-analytics/models/:provider`                       | 可用模型列表     | Protected |
| POST   | `/ai-analytics/generate`                               | 產生 AI 分析報告 | Protected |
| GET    | `/ai-analytics/products/traffic-drivers/:restaurantId` | 流量驅動品項     | Protected |
| GET    | `/ai-analytics/products/bestsellers/:restaurantId`     | 暢銷品項         | Protected |
| GET    | `/ai-analytics/products/profit-leaders/:restaurantId`  | 利潤領先品項     | Protected |
| GET    | `/ai-analytics/products/analysis/:restaurantId`        | 產品分析         | Protected |
| GET    | `/ai-analytics/usage/:restaurantId`                    | AI 使用統計      | Protected |

### Scheduling (`/scheduling`) — 30 routes

**班表模板：**

| Method | Path                                  | Description  | Auth      |
| ------ | ------------------------------------- | ------------ | --------- |
| GET    | `/scheduling/:restaurantId/templates` | 班表模板列表 | Protected |
| GET    | `/scheduling/templates/:id`           | 模板詳情     | Protected |
| POST   | `/scheduling/:restaurantId/templates` | 建立模板     | Protected |
| PUT    | `/scheduling/templates/:id`           | 更新模板     | Protected |
| DELETE | `/scheduling/templates/:id`           | 刪除模板     | Protected |

**排班：**

| Method | Path                                       | Description | Auth      |
| ------ | ------------------------------------------ | ----------- | --------- |
| GET    | `/scheduling/:restaurantId/schedules`      | 排班列表    | Protected |
| GET    | `/scheduling/schedules/:id`                | 排班詳情    | Protected |
| POST   | `/scheduling/:restaurantId/schedules`      | 建立排班    | Protected |
| POST   | `/scheduling/:restaurantId/schedules/bulk` | 批量排班    | Protected |
| PUT    | `/scheduling/schedules/:id`                | 更新排班    | Protected |
| DELETE | `/scheduling/schedules/:id`                | 刪除排班    | Protected |

**打卡：**

| Method | Path                                        | Description    | Auth        |
| ------ | ------------------------------------------- | -------------- | ----------- |
| POST   | `/scheduling/schedules/:id/clock-in`        | 上班打卡       | Protected   |
| POST   | `/scheduling/schedules/:id/clock-out`       | 下班打卡       | Protected   |
| GET    | `/scheduling/:restaurantId/clocked-in`      | 在班員工       | Protected   |
| POST   | `/scheduling/schedules/:id/admin-clock-in`  | 管理員代打上班 | Admin/Owner |
| POST   | `/scheduling/schedules/:id/admin-clock-out` | 管理員代打下班 | Admin/Owner |

**出勤報表：**

| Method | Path                                                 | Description        | Auth      |
| ------ | ---------------------------------------------------- | ------------------ | --------- |
| GET    | `/scheduling/:restaurantId/attendance-report`        | 出勤報表           | Protected |
| GET    | `/scheduling/:restaurantId/attendance-report/export` | 匯出出勤報表 (CSV) | Protected |

**換班：**

| Method | Path                                      | Description  | Auth        |
| ------ | ----------------------------------------- | ------------ | ----------- |
| POST   | `/scheduling/:restaurantId/swap-requests` | 建立換班申請 | Protected   |
| GET    | `/scheduling/:restaurantId/swap-requests` | 換班申請列表 | Protected   |
| POST   | `/scheduling/swap-requests/:id/accept`    | 接受換班     | Protected   |
| POST   | `/scheduling/swap-requests/:id/approve`   | 核准換班     | Admin/Owner |
| POST   | `/scheduling/swap-requests/:id/reject`    | 拒絕換班     | Protected   |
| POST   | `/scheduling/swap-requests/:id/cancel`    | 取消換班     | Protected   |

**統計與衝突：**

| Method | Path                                            | Description | Auth      |
| ------ | ----------------------------------------------- | ----------- | --------- |
| GET    | `/scheduling/:restaurantId/available-employees` | 可排班員工  | Protected |
| GET    | `/scheduling/:restaurantId/conflicts`           | 排班衝突    | Protected |
| GET    | `/scheduling/conflicts/:id`                     | 衝突詳情    | Protected |
| POST   | `/scheduling/conflicts/:id/resolve`             | 解決衝突    | Protected |
| GET    | `/scheduling/:restaurantId/stats/daily`         | 每日統計    | Protected |
| GET    | `/scheduling/:restaurantId/stats/weekly`        | 每週統計    | Protected |

### Leaves (`/leaves`) — 17 routes

| Method | Path                                      | Description  | Auth      |
| ------ | ----------------------------------------- | ------------ | --------- |
| GET    | `/leaves/:restaurantId/types`             | 假別列表     | Protected |
| GET    | `/leaves/types/:id`                       | 假別詳情     | Protected |
| POST   | `/leaves/:restaurantId/types`             | 建立假別     | Protected |
| PUT    | `/leaves/types/:id`                       | 更新假別     | Protected |
| DELETE | `/leaves/types/:id`                       | 刪除假別     | Protected |
| GET    | `/leaves/balances`                        | 員工假期餘額 | Protected |
| POST   | `/leaves/balances/adjust`                 | 調整假期餘額 | Protected |
| GET    | `/leaves/:restaurantId/balances`          | 餐廳假期餘額 | Protected |
| POST   | `/leaves/:restaurantId/balances/accrue`   | 累計假期     | Protected |
| GET    | `/leaves/:restaurantId/requests`          | 請假申請列表 | Protected |
| GET    | `/leaves/requests/:id`                    | 請假申請詳情 | Protected |
| POST   | `/leaves/:restaurantId/requests`          | 建立請假申請 | Protected |
| POST   | `/leaves/requests/:id/approve`            | 核准請假     | Protected |
| POST   | `/leaves/requests/:id/reject`             | 拒絕請假     | Protected |
| POST   | `/leaves/requests/:id/cancel`             | 取消請假     | Protected |
| GET    | `/leaves/:restaurantId/holidays`          | 假日列表     | Protected |
| GET    | `/leaves/:restaurantId/working-day/:date` | 查詢工作日   | Protected |

### Integrations (`/integrations`) — 10 routes

**管理端：**

| Method | Path                                              | Description  | Auth      |
| ------ | ------------------------------------------------- | ------------ | --------- |
| GET    | `/integrations/:restaurantId`                     | 整合列表     | Protected |
| GET    | `/integrations/:restaurantId/webhook-logs`        | Webhook 紀錄 | Protected |
| GET    | `/integrations/:restaurantId/:platform`           | 整合詳情     | Protected |
| POST   | `/integrations/:restaurantId/:platform/connect`   | 連接平台     | Protected |
| PUT    | `/integrations/:restaurantId/:platform`           | 更新設定     | Protected |
| DELETE | `/integrations/:restaurantId/:platform`           | 斷開連接     | Protected |
| POST   | `/integrations/:restaurantId/:platform/menu-sync` | 同步菜單     | Protected |
| GET    | `/integrations/:restaurantId/:platform/orders`    | 平台訂單     | Protected |

**Webhook 接收：**

| Method | Path                               | Description       | Auth |
| ------ | ---------------------------------- | ----------------- | ---- |
| POST   | `/integrations/webhooks/uber-eats` | Uber Eats Webhook | HMAC |
| POST   | `/integrations/webhooks/foodpanda` | Foodpanda Webhook | HMAC |

### Realtime (`/realtime`) — 8 routes

| Method | Path                                | Description          | Auth      |
| ------ | ----------------------------------- | -------------------- | --------- |
| POST   | `/realtime/auth/token`              | 產生 WebSocket Token | Protected |
| POST   | `/realtime/auth/verify`             | 驗證 Token           | Protected |
| POST   | `/realtime/auth/revoke`             | 撤銷 Token           | Protected |
| POST   | `/realtime/auth/revoke-user`        | 撤銷用戶所有 Token   | Protected |
| GET    | `/realtime/auth/blacklist/stats`    | 黑名單統計           | Protected |
| GET    | `/realtime/stats/:roomType/:roomId` | 房間統計             | Protected |
| GET    | `/realtime/stats/overview`          | 即時總覽             | Protected |
| GET    | `/realtime/health`                  | 即時系統健康檢查     | Protected |

### SSE (`/sse`) — 9 routes

| Method | Path                                 | Description    | Auth      |
| ------ | ------------------------------------ | -------------- | --------- |
| GET    | `/sse/events`                        | SSE 事件串流   | Protected |
| POST   | `/sse/test`                          | 測試廣播       | Protected |
| GET    | `/sse/connections`                   | 連線狀態       | Protected |
| POST   | `/sse/broadcast/order-update`        | 廣播訂單更新   | Protected |
| POST   | `/sse/broadcast/menu-update`         | 廣播菜單更新   | Protected |
| POST   | `/sse/broadcast/system-notification` | 廣播系統通知   | Protected |
| POST   | `/sse/broadcast/group-created`       | 廣播團體建立   | Protected |
| POST   | `/sse/broadcast/member-joined`       | 廣播成員加入   | Protected |
| POST   | `/sse/broadcast/cart-updated`        | 廣播購物車更新 | Protected |

### Notifications (`/notifications`) — 3 routes

| Method | Path                       | Description  | Auth      |
| ------ | -------------------------- | ------------ | --------- |
| POST   | `/notifications/test`      | 發送測試通知 | Protected |
| GET    | `/notifications/templates` | 通知模板列表 | Protected |
| POST   | `/notifications/send`      | 發送通知     | Protected |

### System (`/system`) — 8 routes

| Method | Path                            | Description  | Auth      |
| ------ | ------------------------------- | ------------ | --------- |
| POST   | `/system/error-report`          | 回報錯誤     | Protected |
| GET    | `/system/health`                | 健康檢查     | Public    |
| GET    | `/system/error-stats`           | 錯誤統計     | Admin     |
| DELETE | `/system/error-reports/cleanup` | 清理錯誤報告 | Admin     |
| GET    | `/system/health/detailed`       | 詳細健康檢查 | Admin     |
| GET    | `/system/health/metrics`        | 健康指標     | Admin     |
| GET    | `/system/health/ready`          | 就緒檢查     | Public    |
| GET    | `/system/health/live`           | 存活檢查     | Public    |

### Monitoring (`/monitoring`) — 13 routes

| Method | Path                              | Description  | Auth      |
| ------ | --------------------------------- | ------------ | --------- |
| GET    | `/monitoring/health`              | 健康檢查     | Public    |
| GET    | `/monitoring/metrics`             | 指標數據     | Protected |
| DELETE | `/monitoring/metrics`             | 重設指標     | Admin     |
| POST   | `/monitoring/errors`              | 記錄錯誤     | Admin     |
| GET    | `/monitoring/alerts/rules`        | 警報規則列表 | Protected |
| POST   | `/monitoring/alerts/rules`        | 建立警報規則 | Protected |
| PUT    | `/monitoring/alerts/rules/:id`    | 更新警報規則 | Protected |
| DELETE | `/monitoring/alerts/rules/:id`    | 刪除警報規則 | Protected |
| GET    | `/monitoring/alerts/recent`       | 近期警報     | Protected |
| GET    | `/monitoring/alerts/defaults`     | 預設規則     | Protected |
| POST   | `/monitoring/alerts/test`         | 測試警報     | Protected |
| GET    | `/monitoring/overview`            | 系統總覽     | Protected |
| GET    | `/monitoring/reports/performance` | 效能報表     | Protected |

### Backup (`/backup`) — 11 routes

| Method | Path                                         | Description   | Auth  |
| ------ | -------------------------------------------- | ------------- | ----- |
| POST   | `/backup/create`                             | 建立備份      | Admin |
| GET    | `/backup/list`                               | 備份列表      | Admin |
| GET    | `/backup/:id`                                | 備份詳情      | Admin |
| GET    | `/backup/:id/download`                       | 下載備份      | Admin |
| POST   | `/backup/:id/restore`                        | 還原備份      | Admin |
| DELETE | `/backup/:id`                                | 刪除備份      | Admin |
| GET    | `/backup/configurations/:restaurant_id`      | 備份設定      | Admin |
| POST   | `/backup/configurations`                     | 建立/更新設定 | Admin |
| GET    | `/backup/system/health`                      | 備份系統健康  | Admin |
| GET    | `/backup/restaurants/:restaurant_id/metrics` | 備份指標      | Admin |
| GET    | `/backup/alerts/:restaurant_id`              | 備份警報      | Admin |

### Cache (`/cache`) — 8 routes

| Method | Path                | Description  | Auth  |
| ------ | ------------------- | ------------ | ----- |
| GET    | `/cache/stats`      | 快取統計     | Admin |
| GET    | `/cache/health`     | 快取健康     | Admin |
| POST   | `/cache/invalidate` | 依標籤清除   | Admin |
| POST   | `/cache/cleanup`    | 清理過期快取 | Admin |
| POST   | `/cache/warmup`     | 預熱快取     | Admin |
| DELETE | `/cache/stats`      | 重設統計     | Admin |
| GET    | `/cache/config`     | 快取設定     | Admin |
| POST   | `/cache/test`       | 測試快取     | Admin |

---

## 回應格式

### 成功回應

```json
{
  "success": true,
  "data": {},
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### 錯誤回應

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

---

## 查詢參數

### 分頁

```
?page=1&per_page=20
```

詳見: `guides/API_PAGINATION_GUIDE.md`

### 過濾

```
?status=active&category=food
```

### 排序

```
?sort=created_at&order=desc
```

---

## 快速開始

### 使用 cURL

```bash
# 登入
curl -X POST http://localhost:8787/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# 取得菜單（公開）
curl http://localhost:8787/api/v1/menu/RESTAURANT_ID

# 建立訂單（需認證）
curl -X POST http://localhost:8787/api/v1/orders \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"restaurantId":"...","items":[...]}'
```

---

## 相關文檔

- **架構文檔**: `docs/architecture/`
- **功能文檔**: `docs/features/`
- **分頁指南**: `docs/api/guides/API_PAGINATION_GUIDE.md`

---

**最後更新**: 2026-04-30
**API 版本**: v1
**功能模組**: 41
**端點總數**: 300+

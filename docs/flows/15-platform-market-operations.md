# 平台營運流程

> **對應 master board**：平台管理 → 平台營運流程
> **主要角色**：平台管理者（role 0）
> **最後對照原始碼**：2026-08-21

## 1. 定位

平台側的市集經營：招商與審核、跨攤結帳的對帳、退款作業、各種報表匯出。
與 [14](./14-platform-tenants-and-licensing.md) 不同——**這些端點在主 API 上**，
用的是 staff JWT + `requireRole([0])`，不是 management-api 的管理權杖。

## 2. 市集管理

| 動作 | 端點 |
| --- | --- |
| 市集 CRUD | `POST/PUT/DELETE /api/v1/admin/markets[/:id]`、`POST /admin/markets/bulk` |
| 攤位管理 | `POST/PUT/DELETE /admin/markets/:id/vendors[/:restaurantId]` |
| 批次匯入攤位 | `POST /admin/markets/:id/vendor-imports` |
| 招商名單 | `GET /admin/markets/vendor-candidates` |
| 開站準備度 | `GET /admin/markets/readiness`、`/area-readiness` |
| 加入申請 | `GET /admin/markets/join-requests`、`POST /join-requests/:requestId/approve`、`/reject` |

店家端對應的是 `GET/POST /api/v1/restaurants/:id/market-join-requests`。
`market_join_requests` 有一個部分唯一索引限制同一家店對同一市集只能有一筆 `pending`。

## 3. 跨攤對帳

| 動作 | 端點 |
| --- | --- |
| 總覽 | `GET /api/v1/market-checkouts/admin/summary` |
| 清單／單筆 | `GET /market-checkouts/admin`、`/admin/:id` |
| 匯出 | `GET /market-checkouts/admin/export` |
| 攤位維度 | `GET /market-checkouts/admin/vendors`、`/admin/vendors/export` |
| 會計匯出 | `GET /market-checkouts/admin/accounting/export` |
| 金流商狀態 | `GET /market-checkouts/admin/provider-status`、`POST /admin/provider-status/check` |
| 單筆對帳 | `POST /market-checkouts/admin/:id/reconcile` |

**對帳只適用於 `provider_split` 模式**。對 `child_transactions` 的付款呼叫這些端點會被拒絕：
「Only provider split market checkout payments can be reconciled through the provider status endpoint」。

代幣側另有 `GET /api/v1/credits/accounting/export`。

## 4. 退款作業

| 動作 | 端點 | 角色 |
| --- | --- | --- |
| 市集整筆退款 | `POST /api/v1/market-checkouts/:id/refund` | **僅 role 0** |
| 單店訂單退款 | `POST /api/v1/payments/refund` | 0/1/4 |
| POS 退款 | `POST /api/v1/pos/refunds/create` + 審核 | 0/1/4 |

市集退款的前置檢查：

1. checkout 存在（先讀 KV，再讀 D1 持久化那份）
2. 有付款紀錄
3. `provider_split` 模式還需要有 `providerTransactionId`
4. 付款狀態必須是 `paid` 或 `partial_paid`

## 5. Edge cases 與失敗模式

| 情境 | 系統行為 | 風險 |
| --- | --- | --- |
| 對 `child_transactions` 付款做 provider 對帳 | 400，訊息明講只支援 provider split | 🟡 P2 |
| KV 內的 checkout 已過期（4 小時） | 退回讀 D1 的 `market_checkout_sessions` | 🟠 P1 |
| 沒有付款紀錄就退款 | 400「no paid child payments to refund」 | 🟠 P1 |
| provider split 沒有 `providerTransactionId` | 400 | 🟠 P1 |
| 付款狀態不是 paid／partial_paid | 400「not refundable」 | 🔴 P0（已防） |
| role 1 想做市集退款 | 403——這個端點是 role 0 專屬 | 🔴 P0 |
| 攤位重複送出加入申請 | 部分唯一索引擋下重複的 `pending` | 🟡 P2 |
| 匯出資料量過大 | 沒有分頁上限保護，靠查詢本身的 limit | 🟡 P2 |

## 6. 對應程式碼與測試

**程式碼**

- `apps/api/src/features/markets/routes/admin.ts` — 市集與攤位管理
- `apps/api/src/features/market-checkouts/routes/index.ts:1228` — 退款；`:1541` 之後是 admin 區塊
- `apps/api/src/features/market-checkouts/services/MarketCheckoutPaymentReconciliationService.ts:139` — 對帳
- `apps/api/src/features/credits/routes/index.ts` — 代幣會計匯出
- `apps/admin-dashboard/src/views/PlatformMarketsView.vue`、`PlatformMarketCheckoutsView.vue`

**測試**

- `apps/api/src/features/market-checkouts/services/MarketCheckoutPaymentReconciliationService.test.ts`
- `apps/admin-dashboard/src/views/PlatformMarketsView.test.ts`、`PlatformMarketCheckoutsView.test.ts`
- `apps/api/src/__tests__/integration/markets.real.integration.test.ts`

**相關文件**

- [runbooks/market-checkout-payment-readiness.md](../runbooks/market-checkout-payment-readiness.md)
- [runbooks/market-checkout-provider-adapter-handoff.md](../runbooks/market-checkout-provider-adapter-handoff.md)

## 7. 已知缺口

- **`child_transactions` 模式沒有對帳工具**。目前只有 provider split 有。
- **市集 checkout 的真相分散在 KV 與 D1 兩處**，退款與查詢都要先試 KV 再退回 D1。
- **退款沒有分攤位的部分退款**。市集退款是整筆處理。
- 匯出端點沒有非同步作業機制，大量資料會直接打在請求上。

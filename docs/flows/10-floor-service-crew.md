# 送菜流程

> **對應 master board**：現場作業 → 送菜流程（送菜員 role 3）
> **主要角色**：送菜員（role 3）；role 0/1 也能進同一個畫面
> **最後對照原始碼**：2026-08-21

## 1. 定位

把 `ready` 的餐點送到桌上，然後標記 `delivered`。
這是四條現場流程裡**最薄的一條**——沒有專屬的 API feature，整條流程只借用訂單端點。
也因此它是目前合約破損最明顯的一條，見 §5。

## 2. 觸發與前置條件

| 項目 | 內容 |
| --- | --- |
| 進入點 | Admin Dashboard 的 `/service` 路由（`ServiceLayout` + `ServiceView.vue`） |
| 角色 | role 0 / 1 / 3 |
| API | 沒有 `features/service-crew`；用的是 `GET /api/v1/orders` 與 `PUT /api/v1/orders/:id/status` |
| 權限 | `ROLE_STATUS_PERMISSIONS[3] = ["delivered"]`——送菜員**只能**設這一個狀態 |

## 3. 設計上的 Happy path

| # | 動作 | 端點 | 狀態變化 |
| --- | --- | --- | --- |
| 1 | 待送清單 | `GET /orders?status=ready&restaurantId=...` | — |
| 2 | 取餐核對 | 前端 | — |
| 3 | 送達桌位 | 前端 | — |
| 4 | 標記送達 | `PUT /orders/:id/status` → `delivered` | `orders.status = delivered`；有桌號則**釋放桌位** |

`delivered` 之後只能走 `paid` 或 `refunded`，不能再取消。

## 4. 實作上的 Happy path 與它的落差

`ServiceView.vue` 實際上做的是：

| 前端行為 | 後端合約 | 結果 |
| --- | --- | --- |
| `GET /orders?status=ready,delivering` | `orderFilterSchema.status` 逐項比對 `ORDER_STATUSES` | **400 VALIDATION_ERROR**，清單拉不到 |
| `PUT /orders/:id/status` body `{ status: "delivering" }` | `updateOrderStatusSchema.status = z.enum(ORDER_STATUSES)` | **400 VALIDATION_ERROR**，「開始配送」按不動 |

`delivering` 不是合法的訂單狀態。八個合法值是
`pending / confirmed / preparing / ready / delivered / paid / cancelled / refunded`
（`packages/shared-types/src/order.ts:120`）。

**兩條路可以修，但要先決定哪一條**：

1. 把 `delivering` 變成真正的狀態——要動 `ORDER_STATUSES`、轉移表、角色權限表、DB 欄位語意，
   影響顧客追蹤頁與所有既有查詢。
2. 把「配送中」留在前端當本地標記——`ServiceView` 自己記哪幾筆已被領走，不打 API，
   只有真的送達時才呼叫一次 `delivered`。

## 5. Edge cases 與失敗模式

| 情境 | 系統行為 | 錯誤碼 | 風險 |
| --- | --- | --- | --- |
| 前端送 `delivering` | 400，畫面上是「操作沒有反應」 | `VALIDATION_ERROR` | 🔴 P0 |
| 待送清單查詢帶 `delivering` | 400，整個清單空白 | `VALIDATION_ERROR` | 🔴 P0 |
| 送菜員想標 `paid` | 403 | `FORBIDDEN` | 🟠 P1 |
| 從 `preparing` 直接標 `delivered` | 409（必須先 `ready`） | `INVALID_STATUS_TRANSITION` | 🟠 P1 |
| 兩人同時標同一單送達 | 409 版本衝突 | `ORDER_VERSION_CONFLICT` | 🟡 P2 |
| 標記送達後桌位 | 自動 `isOccupied = false`、清空 `currentOrderId` | — | — |
| 外帶／外送單沒有桌號 | 不做桌位釋放，其餘相同 | — | — |
| 標記送達 | 同時解除該訂單的訪客活躍鎖 | — | — |

## 6. 對應程式碼與測試

**程式碼**

- `apps/admin-dashboard/src/views/ServiceView.vue` — 待送清單、開始配送、標記送達
- `apps/admin-dashboard/src/router/index.ts:455` — `/service` 路由與角色
- `apps/api/src/features/orders/types/index.ts:500` — 轉移表與 `ROLE_STATUS_PERMISSIONS[3]`
- `apps/api/src/features/orders/schemas/validation.ts:46`、`:194` — 狀態與篩選 schema
- `packages/database/src/services/order.ts:1273` — `delivered` 時釋放桌位

**測試**

- 目前**沒有**針對送菜流程的 API 或瀏覽器測試。
  `tests/e2e/integration/real-workflows.spec.ts` 涵蓋顧客、店家、廚房、管理與入駐，不含 `/service`。

## 7. 已知缺口

- **前後端狀態合約不一致**（見 §4）。這條流程目前在真實 API 上跑不通。
- **沒有任何自動化測試覆蓋**，所以上面那個不一致沒有被 CI 擋下來。
- **沒有指派機制**。`ServiceView` 有 `assignedTo` 的概念，但後端訂單沒有對應欄位，
  「誰負責這一單」無法跨裝置共享。
- **沒有送達失敗的處理路徑**。送錯桌、客人已離開這些情境只能靠取消或人工協調。

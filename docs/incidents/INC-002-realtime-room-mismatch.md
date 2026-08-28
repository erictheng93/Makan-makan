# INC-002: OrdersService / KitchenService 廣播 room name 與前端訂閱不對

|  |  |
| --- | --- |
| **發現日期** | 2026-05-01 |
| **發現於** | P1 候位系統 G1 spike (`docs/plans/2026-05-01-queue-backend-gaps-plan.md` §4) |
| **嚴重度** | High |
| **狀態** | Open（P1 不修；獨立 PR 處理） |
| **依賴** | INC-001 修好之後（加了 binding 才會「廣播到無人 room」可被驗證） |

## 摘要

後端 `RealtimeBroadcastService.broadcastNewOrder()`（`apps/api/src/services/RealtimeBroadcastService.ts:126`）廣播到 Durable Object room `restaurant:${restaurantId}`，但前端 admin-dashboard 連的是 `admin:${restaurantId}`（`apps/admin-dashboard/src/composables/useRealtimeOrderStatus.ts:45`）。

由於 `apps/realtime/src/index.ts:60-72` 對應的是 `idFromName('admin:${restaurantId}')` 與 `idFromName('restaurant:${restaurantId}')`——**兩個不同的 DO instance**。後端廣播到的 instance 永遠 0 connection。

## 影響

即使 INC-001 修好（DO binding 加了），admin-dashboard 仍然收不到訂單即時通知，因為 room 不對。這個問題會在 INC-001 修好後立刻浮現。

涉及的方法（全部需要重新指定 room）：

- `RealtimeBroadcastService.broadcastNewOrder()`：`restaurant` → `admin`
- `RealtimeBroadcastService.broadcastOrderStatusUpdate()`：`restaurant` → `admin`
- `RealtimeBroadcastService.broadcastOrderItemStatusUpdate()`：`restaurant` → `admin`（或 `kitchen`，依業務語意）
- `RealtimeBroadcastService.broadcastKitchenItemStatus()`：`restaurant` → `kitchen`
- `RealtimeBroadcastService.broadcastMenuAvailabilityUpdate()`：可能需要廣播到多個 room（admin + kitchen + customer）

## 根本原因

1. 廣播端與訂閱端的 room 命名沒有共識——可能是兩個人不同時間寫的
2. **沒有 integration test 驗證「真的廣播 → 真的接收」**——只 mock 了 `idFromName`，不驗 room 一致性
3. 既有的 `restaurant:${id}` 命名來自於早期把 DO 視為「餐廳級單一 room」的設計，後來拆成 `admin / kitchen / customer` 但廣播端沒同步改

## 建議修法

**Option A（Quick fix，建議）**：

- 修 `RealtimeBroadcastService` 各方法的 room 命名為對應角色（`admin` / `kitchen`）
- 部分事件（如 menu update）需要廣播到多個 room——拆成多次 `broadcastEvent` 呼叫

**Option B（Architectural fix）**：

- 讓 DO 跨 room 廣播（一次廣播打到多個 instance）
- 引入 pub/sub 層或 fan-out 機制
- 工量大，不建議現在做

## 立即動作

P1 範圍內**不修**。

P1 之後另開 PR 做 Option A。建議優先順序：

1. **訂單事件**（影響最大，admin-dashboard 即時看單依賴它）
2. **廚房事件**（kitchen-display 依賴）
3. **菜單可用性事件**（影響中，customer-app 即時下架）

## 為什麼 P1 不修

引用 `docs/plans/2026-05-01-queue-backend-gaps-plan.md` 風險登記簿 R-P1-6：

> 加 binding 後，OrdersService/KitchenService 廣播從「靜默 no-op」變成「廣播到無人 room（`restaurant:`）」。對使用者**無新影響**（一樣收不到），但會多消耗 DO 調用次數（成本可忽略）。

也就是說，加 binding 是安全的、不會把現狀變更糟；INC-002 修復可以獨立進行，不需要綁進 P1。

## 連結

- T0 spike 完整論述：`docs/plans/2026-05-01-queue-backend-gaps-plan.md` §4
- 相關 incident：INC-001（type / binding 對齊）
- 程式碼指向：`apps/api/src/services/RealtimeBroadcastService.ts:126`

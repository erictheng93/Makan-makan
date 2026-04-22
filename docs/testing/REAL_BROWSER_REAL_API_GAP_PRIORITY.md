# Real Browser + Real API 補測優先級清單

**日期**: 2026-04-20  
**狀態**: 已依程式碼與測試檔實際內容重新驗證  
**目的**: 盤點目前各功能模組的測試現況，並依照風險、業務影響、以及現有 coverage 缺口，排序最值得優先從 mock UI 測試升級成 `real browser + real API` 的模組。

---

## 1. 結論摘要

目前這個 repo 的測試體系是混合式，而且需要分清楚四種類型：

- **A. formal real browser + real API**  
  目前明確、正式存在的包含：
  - [tests/e2e/integration/customer-dine-in.spec.ts](/Users/eric/Documents/Code/Makan-makan/tests/e2e/integration/customer-dine-in.spec.ts)
  - [tests/e2e/integration/admin-order-management.real.spec.ts](/Users/eric/Documents/Code/Makan-makan/tests/e2e/integration/admin-order-management.real.spec.ts)
  - [tests/e2e/integration/kitchen-display.real.spec.ts](/Users/eric/Documents/Code/Makan-makan/tests/e2e/integration/kitchen-display.real.spec.ts)
- **B. formal browser + mock API**  
  大量 `tests/e2e/admin` 與 `tests/e2e/journeys` 會真實操作瀏覽器 UI，但 API 多半透過 `page.route()` 與 [mock-api.ts](/Users/eric/Documents/Code/Makan-makan/tests/e2e/helpers/mock-api.ts) 攔截。
- **C. formal real API integration / contract smoke**  
  `tests/e2e/integration` 內多數檔案是直接 `fetch("http://localhost:8787")` 的真 API 測試；另外 `apps/api`、`apps/customer-app`、`apps/admin-dashboard`、`apps/kitchen-display` 也各自有 Miniflare-based 的 real integration smoke。
- **D. mixed / 非正式 live-backend 行為**  
  少數 browser spec 並沒有攔截所有 API，而且三個前端 app 的 dev server 都會把 `/api` proxy 到 `localhost:8787`。這代表它們在某些 case 可能打到真 API，但這不是一套明確維護的 real-browser integration 設計，不應算進正式 coverage。

因此目前最大的缺口不是「完全沒測」，而是：

1. 很多關鍵流程只有 mock UI E2E，沒有真後端狀態驗證。
2. 一些高風險模組雖然有 real API integration 或 contract smoke，但沒有真實瀏覽器流程串起來。
3. 後台營運流程在 `admin-dashboard` / `kitchen-display` / `cashier` 端，仍高度依賴 mock。

---

## 2. 判定標準

本文件的結論只採計「有程式碼證據」的項目，不採計舊報告或舊規劃文中的敘述。

本文件使用以下三個維度判定補測優先級：

- **業務風險**: 失敗是否直接影響營收、出餐、庫存、桌況、候位、顧客體驗
- **系統耦合度**: 是否跨 UI、API、DB、SSE/WebSocket、多角色流程
- **現況缺口**: 是否目前只有 mock UI、只有 API integration、或兩者都不足

優先級定義：

- **P0 / 緊急**: 上線前最值得先補；缺口大且出錯成本高
- **P1 / 高**: 核心營運流程，應在 P0 後立即補
- **P2 / 中**: 有價值，但不是現在最危險的缺口
- **P3 / 低**: 可延後，通常是支援性、管理性或低頻流程

---

## 3. 現況盤點

### 3.1 驗證方法

本次重新驗證時，實際檢查了：

- Playwright project 設定：
  - [playwright.config.ts](/Users/eric/Documents/Code/Makan-makan/playwright.config.ts)
- 三個前端 app 的 Vite proxy 設定：
  - [apps/customer-app/vite.config.ts](/Users/eric/Documents/Code/Makan-makan/apps/customer-app/vite.config.ts)
  - [apps/admin-dashboard/vite.config.ts](/Users/eric/Documents/Code/Makan-makan/apps/admin-dashboard/vite.config.ts)
  - [apps/kitchen-display/vite.config.ts](/Users/eric/Documents/Code/Makan-makan/apps/kitchen-display/vite.config.ts)
- mock 與預登入 helper：
  - [tests/e2e/helpers/mock-api.ts](/Users/eric/Documents/Code/Makan-makan/tests/e2e/helpers/mock-api.ts)
  - [tests/e2e/helpers/assertions.ts](/Users/eric/Documents/Code/Makan-makan/tests/e2e/helpers/assertions.ts)
- 真 API / 真 DB 測試檔：
  - [tests/e2e/integration](/Users/eric/Documents/Code/Makan-makan/tests/e2e/integration)
  - [apps/api/src/__tests__/integration](/Users/eric/Documents/Code/Makan-makan/apps/api/src/__tests__/integration)
  - [apps/customer-app/src/__tests__/integration](/Users/eric/Documents/Code/Makan-makan/apps/customer-app/src/__tests__/integration)
  - [apps/admin-dashboard/src/__tests__/integration](/Users/eric/Documents/Code/Makan-makan/apps/admin-dashboard/src/__tests__/integration)
  - [apps/kitchen-display/src/__tests__/integration](/Users/eric/Documents/Code/Makan-makan/apps/kitchen-display/src/__tests__/integration)

### 3.2 已有 `formal real browser + real API`

- `customer-app` 堂食點餐主流程
- `admin-dashboard` 訂單管理基本流程
- `kitchen-display` 廚房看單 / 開始製作基本流程

主要證據：

- [tests/e2e/integration/customer-dine-in.spec.ts](/Users/eric/Documents/Code/Makan-makan/tests/e2e/integration/customer-dine-in.spec.ts)
- [tests/e2e/integration/admin-order-management.real.spec.ts](/Users/eric/Documents/Code/Makan-makan/tests/e2e/integration/admin-order-management.real.spec.ts)
- [tests/e2e/integration/kitchen-display.real.spec.ts](/Users/eric/Documents/Code/Makan-makan/tests/e2e/integration/kitchen-display.real.spec.ts)

補充判定依據：

- 這三檔都是 Playwright `integration` project 的 browser 測試
- 檔頭都明寫 `No API mocking`
- 都以 `page.goto(...)` 走真實前端 app，再透過 dev server proxy 打到 `localhost:8787`
- `admin-order-management.real.spec.ts` 與 `kitchen-display.real.spec.ts` 是本次新增的正式 coverage，目前已完成檔案載入驗證

### 3.3 已有 `formal real API integration`，但缺少 `real browser + real API`

- `auth`
- `menu`
- `orders`
- `guest-orders`
- `tables`
- `users`
- `coupons`
- `kitchen`
- `feedback`
- `qr-codes`
- `seats`
- `discovery`

主要證據：

- [tests/e2e/integration](/Users/eric/Documents/Code/Makan-makan/tests/e2e/integration)
- [apps/api/src/__tests__/integration](/Users/eric/Documents/Code/Makan-makan/apps/api/src/__tests__/integration)

補充：

- `tests/e2e/integration` 多數檔案是 API-level integration，不是 browser E2E
- `apps/api/src/__tests__/integration/*.real.integration.test.ts` 是 API 層的 Miniflare + real D1 integration

### 3.4 已有 `app-level real integration smoke / API contract`，但不是 browser E2E

- `customer-app`
  - [customer-app.real.integration.test.ts](/Users/eric/Documents/Code/Makan-makan/apps/customer-app/src/__tests__/integration/customer-app.real.integration.test.ts)
- `admin-dashboard`
  - [admin-dashboard.real.integration.test.ts](/Users/eric/Documents/Code/Makan-makan/apps/admin-dashboard/src/__tests__/integration/admin-dashboard.real.integration.test.ts)
- `kitchen-display`
  - [kitchen-display.real.integration.test.ts](/Users/eric/Documents/Code/Makan-makan/apps/kitchen-display/src/__tests__/integration/kitchen-display.real.integration.test.ts)

這三類測試的重要性很高，但它們驗證的是：

- service/API contract 是否成立
- endpoint response shape 是否符合前端預期
- 權限 / response envelope / round-trip 是否成立

它們**不是**：

- 真實瀏覽器操作
- 真實跨頁面 user journey
- 真實 SSE / 多角色 UI 同步驗證

### 3.5 目前多數仍以 `formal browser + mock API` 為主

- `admin-dashboard` 多數流程
- `kitchen-display`
- `cashier / pos`
- `queue`
- `reservations`
- `service-crew` 送餐流程
- 多角色協作流程

主要證據：

- [tests/e2e/helpers/mock-api.ts](/Users/eric/Documents/Code/Makan-makan/tests/e2e/helpers/mock-api.ts)
- [tests/e2e/admin](/Users/eric/Documents/Code/Makan-makan/tests/e2e/admin)
- [tests/e2e/journeys](/Users/eric/Documents/Code/Makan-makan/tests/e2e/journeys)

補充判定依據：

- `preAuthAdmin()` 會直接往 localStorage 預塞 fake JWT，而不是透過真登入流程
- `preAuthKitchen()` 也會直接預塞 auth state
- `mockAllAPIs()` 會一次攔截 auth / restaurant / menu / order / kitchen / pos / queue / sse / analytics

### 3.6 `mixed / 非正式 live-backend` 不列入正式 coverage

雖然三個前端 app 的 Vite dev server 都有 `/api` proxy 到 `localhost:8787`：

- customer app: 3000 -> 8787
- admin dashboard: 3001 -> 8787
- kitchen display: 3002 -> 8787

但少數 spec 即使沒有攔截某些 API，也不能因此直接算成正式 `real browser + real API`，原因是：

- 它不是該 spec 的明確設計目標
- 沒有穩定的測試前置條件
- 沒有對真實後端狀態做完整斷言
- 容易出現部分 mock、部分 live 的混合情況

例子：

- [tests/e2e/admin/login.spec.ts](/Users/eric/Documents/Code/Makan-makan/tests/e2e/admin/login.spec.ts)

### 3.7 舊 integration 不列入真整合

- [apps/api/src/__tests__/integration-legacy-mockdrizzle/README.md](/Users/eric/Documents/Code/Makan-makan/apps/api/src/__tests__/integration-legacy-mockdrizzle/README.md) 已明確標示這批不是 real integration

---

## 4. 優先補測清單

| 優先級 | 模組 / 流程 | 現況 | 為什麼要先補 |
| --- | --- | --- | --- |
| P0 | `orders` + `kitchen` + `pos` 跨角色訂單生命週期 | UI 多為 mock；API 與 app contract smoke 已存在；缺少完整真瀏覽器串接 | 直接影響接單、備餐、出餐、收款；是整個餐飲營運主幹 |
| P0 | `admin-dashboard` 訂單管理 / 狀態流轉 | 已補基本 real browser+API coverage，但大多數列表/篩選/詳情流程仍以 mock 為主 | 後台是日常操作主入口；真 API 下最容易出現權限、資料同步、狀態競爭問題 |
| P0 | `kitchen-display` 廚房接單 / 更新狀態 | 已補基本 real browser+API coverage，但完單 / SSE / 多單情境仍以 mock 為主 | 廚房端高度依賴真實訂單資料、狀態同步、角色權限與 SSE/刷新時機 |
| P1 | `queue` + `reservations` + `tables` 入座流程 | UI 多為 mock；tables 有 real integration | 候位、訂位、入座、桌況是現場高頻流程，跨多個模組且容易出現資料不同步 |
| P1 | `coupons` + checkout / payment 套用流程 | UI 為 mock；API 有 real integration | 折扣錯誤會直接影響金額、收款與顧客體驗；需要真實瀏覽器驗證金額顯示與 API 寫入一致 |
| P1 | `guest-orders` 外帶 / 外送 / 加點 / 取消 | 部分 customer 流程為 mock；API 有 real integration | 這是顧客最直接接觸的訂單路徑，真實前後端整合比純堂食更容易出現狀態與資料差異 |
| P2 | `users` / `auth` / RBAC 後台權限流程 | UI 多為 mock；API 有 real integration | 角色權限錯誤會導致操作越權，但業務時效通常低於出餐與收款 |
| P2 | `qr-codes` / `seats` / 掃碼進單流程 | QR API 有 real integration；UI 多為 mock | 真實環境下容易遇到 QR 失效、座位綁定、頁面跳轉與資料載入不一致 |
| P2 | `discovery` / 顧客找店流程 | discovery API 有 real integration；UI 為 mock | 影響進店轉化，但營運中斷風險低於訂單與付款主流程 |
| P2 | `feedback` 顧客回饋流程 | API 有 real integration；缺少真瀏覽器串接 | 商業重要但不是即時營運核心 |
| P3 | `analytics` / `monitoring` / `export` | UI 為 mock | 偏管理與報表用途，通常不阻斷營運主線 |
| P3 | `notifications` / `forecast` / `leaves` / `scheduling` | 缺少 real browser + real API | 屬於支援性功能，重要但可在核心營運補完後處理 |
| P3 | `partnerships` / `integrations` / `ingredients` / `backup` / `cache` / `system` | 測試證據不足或尚未見完整流程 | 目前資訊不足，且多數不是最高頻前台營運路徑 |

---

## 5. 詳細建議

### P0. `orders` + `kitchen` + `pos` 跨角色訂單生命週期

**建議先補**

- 顧客下單
- 後台接單 / 確認
- 廚房開始製作 / 完成
- 外場送達
- 收銀付款完成

**原因**

- 這是最核心的營收鏈路。
- 目前有：
  - 顧客堂食 `real browser + real API`
  - 訂單 API real integration
  - 廚房 API real integration
  - admin-dashboard / kitchen-display app-level contract smoke
- 但缺：
  - 同一筆真實訂單在多個真實前端 app 間流動的 browser-level 驗證

**優先補的真實驗證點**

- 狀態是否真的被不同角色 UI 看到
- 狀態更新後列表、詳情、badge 是否同步
- 付款成功後訂單是否從待付款移除
- 權限限制是否和實際 UI 一致

**建議測試檔方向**

- `tests/e2e/integration/order-lifecycle-real-ui.spec.ts`
- `tests/e2e/integration/kitchen-to-cashier-real-flow.spec.ts`

---

### P0. `admin-dashboard` 訂單管理 / 狀態流轉

**現況**

- [tests/e2e/admin/orders-management.spec.ts](/Users/eric/Documents/Code/Makan-makan/tests/e2e/admin/orders-management.spec.ts)
- [tests/e2e/admin/state-transitions.spec.ts](/Users/eric/Documents/Code/Makan-makan/tests/e2e/admin/state-transitions.spec.ts)
- [admin-dashboard.real.integration.test.ts](/Users/eric/Documents/Code/Makan-makan/apps/admin-dashboard/src/__tests__/integration/admin-dashboard.real.integration.test.ts)
- [tests/e2e/integration/admin-order-management.real.spec.ts](/Users/eric/Documents/Code/Makan-makan/tests/e2e/integration/admin-order-management.real.spec.ts)
- 目前已補上「真登入 + 真訂單列表 + 真狀態推進」基本 coverage，但主要 browser 測試仍多為 mock API

**原因**

- 後台是店家最常操作的界面。
- 真實 API 下容易出現：
  - query 參數與 UI 篩選不一致
  - optimistic UI 與 DB 實際狀態不一致
  - 分頁、排序、搜尋在真資料下行為改變
  - 角色權限與實際按鈕呈現不一致

**優先補的真實驗證點**

- 訂單列表載入、篩選、搜尋、切換狀態
- 待處理訂單數與列表一致
- 詳情頁操作後列表同步更新

---

### P0. `kitchen-display` 廚房接單 / 更新狀態

**現況**

- [tests/e2e/journeys/chef/kitchen-shift.spec.ts](/Users/eric/Documents/Code/Makan-makan/tests/e2e/journeys/chef/kitchen-shift.spec.ts) 為 mock UI
- [tests/e2e/integration/kitchen-api.spec.ts](/Users/eric/Documents/Code/Makan-makan/tests/e2e/integration/kitchen-api.spec.ts) 為 real API
- [kitchen-display.real.integration.test.ts](/Users/eric/Documents/Code/Makan-makan/apps/kitchen-display/src/__tests__/integration/kitchen-display.real.integration.test.ts) 為 app-level contract smoke
- [tests/e2e/integration/kitchen-display.real.spec.ts](/Users/eric/Documents/Code/Makan-makan/tests/e2e/integration/kitchen-display.real.spec.ts) 已補上真實 chef login、看單、開始製作的 browser 流程

**原因**

- 廚房端最需要確認真資料流，不只是 API status code 正確。
- 真環境常見問題：
  - 列表不刷新
  - 排序不符預期
  - 某些狀態在 UI 看不到
  - 真實資料 shape 與 mock 假設不同

**優先補的真實驗證點**

- 新訂單是否出現在廚房畫面
- 更新為 `preparing` / `ready` 後是否立刻反映
- 不同餐廳資料隔離是否正確

---

### P1. `queue` + `reservations` + `tables` 入座流程

**現況**

- [tests/e2e/journeys/cross-role/reservation-to-seated.spec.ts](/Users/eric/Documents/Code/Makan-makan/tests/e2e/journeys/cross-role/reservation-to-seated.spec.ts) 主要是 mock UI
- `tables` 有 real API integration，但 `queue` / `reservations` 未見同級真實整合

**原因**

- 這是現場高頻流程。
- 牽涉：
  - 候位
  - 訂位
  - 桌況
  - 入座
  - 後續點餐入口
- 很容易出現跨模組資料不同步。

**優先補的真實驗證點**

- 建立訂位後是否能在後台正確顯示
- 入座後桌況是否同步變更
- 同一桌是否被重複分配
- 候位 / 訂位轉入座後，點餐入口是否正確

---

### P1. `coupons` + checkout / payment 套用流程

**現況**

- [tests/e2e/journeys/customer/coupon-checkout.spec.ts](/Users/eric/Documents/Code/Makan-makan/tests/e2e/journeys/customer/coupon-checkout.spec.ts) 為 mock UI
- [tests/e2e/integration/coupon-api.spec.ts](/Users/eric/Documents/Code/Makan-makan/tests/e2e/integration/coupon-api.spec.ts) 為 real API

**原因**

- 金額邏輯最怕 UI 顯示和後端實算不一致。
- mock 環境很難抓到：
  - 滿額條件
  - 可用餐廳 / 範圍限制
  - 重複套用
  - 折扣後金額四捨五入 / 顯示格式

**優先補的真實驗證點**

- 套券前後金額變化
- 無效券 / 過期券 / 不符合條件時 UI 行為
- 訂單送出後實際金額是否一致

---

### P1. `guest-orders` 外帶 / 外送 / 加點 / 取消

**現況**

- 堂食 real browser + real API 已有
- 其他 customer journeys 多為 mock：
  - [guest-shop-takeaway.spec.ts](/Users/eric/Documents/Code/Makan-makan/tests/e2e/journeys/customer/guest-shop-takeaway.spec.ts)
  - [guest-shop-delivery.spec.ts](/Users/eric/Documents/Code/Makan-makan/tests/e2e/journeys/customer/guest-shop-delivery.spec.ts)
  - [append-order.spec.ts](/Users/eric/Documents/Code/Makan-makan/tests/e2e/journeys/customer/append-order.spec.ts)
  - [order-cancellation.spec.ts](/Users/eric/Documents/Code/Makan-makan/tests/e2e/journeys/customer/order-cancellation.spec.ts)

**原因**

- 顧客端多流量場景不能只驗堂食。
- 外帶 / 外送 / 加點 / 取消的資料路徑不同，風險不低。

**優先補的真實驗證點**

- 建立外帶 / 外送訂單
- 加點後訂單內容與總價更新
- 取消後追蹤頁與後台是否一致
- 真實 phone / token / guest session 流程是否正常

---

### P2. `users` / `auth` / RBAC 後台權限流程

**原因**

- 目前 API 層已有不錯的 real integration。
- 但 UI 仍需要驗證：
  - 不同角色是否真的看不到 / 不能按
  - 路由守衛是否和 API 權限一致
  - 被拒絕時是否顯示正確錯誤

**建議補法**

- 每個角色選 1 條最關鍵路徑
- 不要先做大量矩陣，先做 owner / chef / cashier / service 4 條最常用真流程

---

### P2. `qr-codes` / `seats` / 掃碼進單流程

**原因**

- QR 與座位綁定通常在真環境才會出現問題。
- 堂食入口雖已有 real flow，但 QR 批量生成、失效、重新綁定、掃描後跳轉仍缺完整 browser 驗證。

**優先補的真實驗證點**

- 後台產 QR 後，顧客掃碼進入正確頁面
- QR 失效或更換座位時，跳轉與錯誤訊息正確

---

### P2. `discovery` / `feedback`

**原因**

- 有 real API，但缺完整前台真實流程串接。
- 商業上重要，但低於接單、備餐、付款與入座。

---

### P3. `analytics` / `monitoring` / `export`

**原因**

- 這些流程偏管理與報表。
- 錯誤通常不會立即阻斷營運主線。
- 可以等核心交易與現場流程補完後再做。

---

### P3. 其他支援性模組

- `notifications`
- `forecast`
- `leaves`
- `scheduling`
- `partnerships`
- `integrations`
- `ingredients`
- `backup`
- `cache`
- `system`

**原因**

- 目前不是最核心的前線營運流程。
- 有些模組目前測試證據不足，建議先做需求盤點再補測。

---

## 6. 建議實作順序

建議以這個順序補：

1. `orders + kitchen + pos` 真實跨角色主流程
2. `admin-dashboard` 訂單管理與狀態流轉
3. `kitchen-display` 真實接單與完單流程
4. `queue + reservations + tables` 入座主流程
5. `coupons + checkout`
6. `guest-orders` 外帶 / 外送 / 加點 / 取消
7. `users/auth/RBAC`
8. `qr/seats`
9. `discovery/feedback`
10. `analytics/monitoring/export` 與其他支援模組

---

## 7. 建議新增的 real browser + real API 規格

### 第一批建議新增

- `tests/e2e/integration/order-cross-role-real-ui.spec.ts`
- `tests/e2e/integration/admin-order-management.real.spec.ts`
- `tests/e2e/integration/kitchen-display.real.spec.ts`
- `tests/e2e/integration/reservation-to-seated-real.spec.ts`
- `tests/e2e/integration/coupon-checkout-real.spec.ts`
- `tests/e2e/integration/guest-order-variants-real.spec.ts`

### 第二批建議新增

- `tests/e2e/integration/rbac-real.spec.ts`
- `tests/e2e/integration/qr-seat-entry-real.spec.ts`
- `tests/e2e/integration/discovery-real-ui.spec.ts`
- `tests/e2e/integration/feedback-real-ui.spec.ts`

---

## 8. 主要依據檔案

- Playwright / 前端 app routing / proxy：
  - [playwright.config.ts](/Users/eric/Documents/Code/Makan-makan/playwright.config.ts)
  - [apps/customer-app/vite.config.ts](/Users/eric/Documents/Code/Makan-makan/apps/customer-app/vite.config.ts)
  - [apps/admin-dashboard/vite.config.ts](/Users/eric/Documents/Code/Makan-makan/apps/admin-dashboard/vite.config.ts)
  - [apps/kitchen-display/vite.config.ts](/Users/eric/Documents/Code/Makan-makan/apps/kitchen-display/vite.config.ts)
- API 路由註冊：
  - [apps/api/src/app-factory.ts](/Users/eric/Documents/Code/Makan-makan/apps/api/src/app-factory.ts)
- mock UI E2E 基礎：
  - [tests/e2e/helpers/mock-api.ts](/Users/eric/Documents/Code/Makan-makan/tests/e2e/helpers/mock-api.ts)
  - [tests/e2e/helpers/assertions.ts](/Users/eric/Documents/Code/Makan-makan/tests/e2e/helpers/assertions.ts)
- 真實 browser + API 現有基礎：
  - [tests/e2e/integration/customer-dine-in.spec.ts](/Users/eric/Documents/Code/Makan-makan/tests/e2e/integration/customer-dine-in.spec.ts)
- 真實 API integration：
  - [tests/e2e/integration](/Users/eric/Documents/Code/Makan-makan/tests/e2e/integration)
  - [apps/api/src/__tests__/integration](/Users/eric/Documents/Code/Makan-makan/apps/api/src/__tests__/integration)
- app-level real integration smoke：
  - [customer-app.real.integration.test.ts](/Users/eric/Documents/Code/Makan-makan/apps/customer-app/src/__tests__/integration/customer-app.real.integration.test.ts)
  - [admin-dashboard.real.integration.test.ts](/Users/eric/Documents/Code/Makan-makan/apps/admin-dashboard/src/__tests__/integration/admin-dashboard.real.integration.test.ts)
  - [kitchen-display.real.integration.test.ts](/Users/eric/Documents/Code/Makan-makan/apps/kitchen-display/src/__tests__/integration/kitchen-display.real.integration.test.ts)
- 舊 mock-drizzle 說明：
  - [apps/api/src/__tests__/integration-legacy-mockdrizzle/README.md](/Users/eric/Documents/Code/Makan-makan/apps/api/src/__tests__/integration-legacy-mockdrizzle/README.md)

---

## 9. 最終建議

如果補測資源有限，請先把目標放在：

- **所有會直接影響接單、出餐、收款、入座的流程**
- **所有目前只有 mock UI、但實際上跨多角色 / 多模組的流程**
- **所有金額、狀態、權限、同步最容易在真環境出錯的流程**

這代表最先補的不是「測試最多的模組」，而是：

- `orders`
- `kitchen`
- `pos`
- `admin order management`
- `queue / reservations / tables`
- `coupons`
- `guest-orders`

這批補完後，整體風險會下降最多。

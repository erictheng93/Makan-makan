# Test Progress Tracker

> 最後更新: 2026-04-13 (OrderStatus 統一 + auth-client 抽離 + i18n 擴充)
> 測試總數: 308+ files / 8,496+ tests (2026-04-03 基準，之後經歷多次遷移尚未重新統計，執行 `pnpm test` 取得最新數字)
> Typecheck: PASS (21/21 tasks)
> Manual QA: 6 角色 70+ 頁面實測，12 bugs fixed，118 native dialogs replaced — [完整報告](reports/manual-qa-report-2026-04-02.md)
> 近期重大重構：Issue #9 OrderStatus string 化、`restaurantId` UUID 遷移、`@makanmakan/auth-client` 抽離

---

## 全局測試統計

| 類型                    | 檔案數     | 測試數        | 狀態                        |
| ----------------------- | ---------- | ------------- | --------------------------- |
| Unit (Vitest)           | 308        | 8,496         | ALL PASS                    |
| E2E (Playwright)        | 26 specs   | ~236          | 待驗證（需啟動 dev server） |
| **Manual QA (Browser)** | **6 角色** | **70+ 頁面**  | **PASS — 10 bugs fixed**    |
| Visual Regression       | 6 files    | ~90 baselines | 待驗證                      |
| Performance (Artillery) | 6 configs  | —             | 待執行                      |
| Security                | 4 files    | 361           | ALL PASS                    |
| Contract                | 23 modules | ~194 schemas  | ALL PASS                    |
| Integration             | 13 files   | ~105          | ALL PASS                    |

---

## 按 App 分佈

| App                    | 測試檔案 | 覆蓋評估                                                       |
| ---------------------- | -------- | -------------------------------------------------------------- |
| apps/api               | 154      | A — 路由、Service、Middleware、Security、Contract、Integration |
| apps/admin-dashboard   | 64       | A — 45/45 Vue 頁面 100% 覆蓋，15 E2E specs                     |
| apps/kitchen-display   | 35       | A — 組件、Store、Composable、Integration                       |
| apps/customer-app      | 21       | B — 組件、i18n、E2E user flows                                 |
| apps/realtime          | 23       | B — WebSocket、Durable Objects                                 |
| apps/management-api    | 15       | B                                                              |
| apps/management-portal | 13       | B                                                              |
| apps/onboarding-app    | 9        | A — views, store, API, router, integration flow                |
| apps/image-processor   | 7        | A — routes, services, middleware, compression                  |
| apps/print-agent       | 5        | A — LocalPrintService, PrintAgentService, config               |

| Package                | 測試檔案 | 覆蓋評估                            |
| ---------------------- | -------- | ----------------------------------- |
| packages/database      | 23       | A — GroupOrder services split files |
| packages/queue-core    | 7        | B                                   |
| packages/utils         | 5        | B                                   |
| packages/shared        | 5        | B                                   |
| packages/ai-analytics  | 4        | B                                   |
| packages/queue-service | 1        | A — 73 tests, full service coverage |
| packages/testing-utils | 1        | B — 此包本身是測試工具              |

---

## Admin Dashboard 逐頁覆蓋

### 評分標準

- **A（完善）**: E2E + Unit + Integration 皆有，核心操作全覆蓋
- **B（良好）**: Unit 測試到位，E2E 間接覆蓋
- **C（基礎）**: 只有 parent 測試涵蓋，或僅 mounting test
- **D（空白）**: 無測試

### 核心業務頁面

| 頁面                        | Unit Tests | E2E Coverage                    | 等級 | 備註                |
| --------------------------- | ---------- | ------------------------------- | ---- | ------------------- |
| Dashboard (`DashboardView`) | 7 it       | RBAC, RWD, SSE                  | A    |                     |
| 訂單管理 (`OrdersView`)     | 40 it      | CRUD, filter, modal, pagination | A    |                     |
| 菜單管理 (`MenuView`)       | 55 it      | filter, search, CRUD            | A    | 子組件 3 個空殼待填 |
| 優惠券管理 (`CouponsView`)  | 42 it      | CRUD, filter, form              | A    | Bug 已修復          |
| 數據分析 (`AnalyticsView`)  | 76 it      | export                          | A    |                     |

### 管理功能頁面

| 頁面                                 | Unit Tests                                            | E2E Coverage       | 等級 | 備註                                     |
| ------------------------------------ | ----------------------------------------------------- | ------------------ | ---- | ---------------------------------------- |
| 座位管理 (`SeatingManagementView`)   | 35 + ReservationTab 27 + TableSetupTab 23 = **85 it** | modal, transitions | A    | 子 tab 皆有獨立測試                      |
| 員工管理 (`UsersView`)               | 36 + EmployeeListTab 30 = **66 it**                   | filter, CRUD       | A    | 子組件獨立測試                           |
| 排班/請假 (`EmployeeScheduleLeaves`) | 43 it                                                 | —                  | A    | 排班+請假+出勤全覆蓋                     |
| POS 收銀 (`POSView` + `CashierView`) | 55 + 52 = **107 it**                                  | RBAC               | A    | CashierView 獨立測試                     |
| 店主總覽 (`OwnerView`)               | **71 it**                                             | RBAC               | A    | 含緊急警報、員工動態、熱門商品、自動刷新 |
| 系統設定 (`SettingsView`)            | **59 it** + 10 delivery = **69 it**                   | RWD                | A    | 全 6 tabs 覆蓋                           |
| 團體訂單 (`GroupOrdersView`)         | **48 it**                                             | RBAC               | A    | 含分享碼、加入、匯出、篩選               |
| 系統監控 (`MonitoringView`)          | **47 it**                                             | export             | A    | 含警報規則、效能報告、錯誤分析           |
| AI 洞察 (`AIAnalytics`)              | **38 it**                                             | —                  | A    | 含 Provider 設定、產品分析               |
| 候位管理 (`WaitingListView`)         | **38 it**                                             | —                  | A    | 含加入/叫號/入座/取消/篩選/批次          |

### 原 D 級頁面（已全部升至 A 級）

| 頁面                                   | 測試檔案                      | Tests | 完成日期   |
| -------------------------------------- | ----------------------------- | ----- | ---------- |
| ServiceView (送菜員)                   | ServiceView.test.ts           | 46    | 2026-04-02 |
| AccountManagementView                  | AccountManagementView.test.ts | 33    | 2026-04-02 |
| PlatformOverview                       | PlatformOverview.test.ts      | 20    | 2026-04-02 |
| BackupDashboard + Monitoring           | BackupViews.test.ts           | 23    | 2026-04-02 |
| ForecastView                           | ForecastView.test.ts          | 14    | 2026-04-02 |
| IngredientsView                        | IngredientsView.test.ts       | 14    | 2026-04-02 |
| Scheduling + Analytics                 | SchedulingViews.test.ts       | 23    | 2026-04-02 |
| Login + ForgotPassword + ResetPassword | AuthViews.test.ts             | 38    | 2026-03-31 |
| NotFoundView + UnauthorizedView        | ErrorPages.test.ts            | 19    | 2026-04-02 |
| TableDetailView                        | TableDetailView.test.ts       | 15    | 2026-04-02 |
| EmployeeDetailView                     | EmployeeDetailView.test.ts    | 24    | 2026-04-02 |
| EmployeeProfileTab                     | EmployeeProfileTab.test.ts    | 26    | 2026-04-02 |
| AttendanceOverviewTab                  | AttendanceOverviewTab.test.ts | 23    | 2026-04-02 |
| EmployeeLeaveTab                       | EmployeeLeaveTab.test.ts      | 16    | 2026-04-02 |
| EmployeeScheduleTab                    | EmployeeScheduleTab.test.ts   | 15    | 2026-04-02 |
| LeavesTab                              | LeavesTab.test.ts             | 22    | 2026-04-02 |
| LeaveView                              | LeaveView.test.ts             | 17    | 2026-04-02 |
| ProductAnalyticsView                   | AIAnalytics.test.ts (追加)    | 8     | 2026-04-02 |

### Menu 子組件測試（原標記為空殼，實際已有測試）

| 檔案                                       | Tests | 狀態 |
| ------------------------------------------ | ----- | ---- |
| `components/menu/CategoryPanel.test.ts`    | 7     | A    |
| `components/menu/CategoryEditForm.test.ts` | 10    | A    |
| `components/menu/MenuItemCard.test.ts`     | 11    | A    |
| `composables/useMenuManagement.test.ts`    | 51    | A    |

---

## E2E 測試覆蓋

### Admin E2E (`tests/e2e/admin/`) — 15 specs, 236 tests

| Spec                      | Tests | 覆蓋範圍                      |
| ------------------------- | ----- | ----------------------------- |
| rbac-permissions          | 47    | 5 角色權限邊界驗證            |
| filter-search             | 24    | 訂單/菜單/優惠券/員工篩選搜尋 |
| state-transitions         | 20    | 訂單/訂位狀態流轉             |
| rwd-responsive            | 18    | 手機/平板/桌面 3 breakpoints  |
| error-handling            | 18    | API 500/401/403/404/429       |
| kitchen-queue-pos         | 15    | 廚房/排隊/POS 基本流程        |
| tables-users-management   | 14    | 桌台/員工管理                 |
| modal-dialog-interactions | 14    | 訂單詳情/訂位/刪除確認        |
| menu-management           | 12    | 菜單 CRUD                     |
| form-validation           | 12    | 訂位/優惠券/菜單表單驗證      |
| orders-management         | 11    | 訂單列表/篩選/狀態更新        |
| pagination-scroll         | 8     | 分頁/大量數據/虛擬滾動        |
| export-functionality      | 8     | 匯出按鈕/格式/空數據          |
| crud-operations           | 8     | 跨頁面 CRUD                   |
| sse-realtime              | 7     | SSE 連線/訂單通知/心跳        |

### Journey E2E (`tests/e2e/journeys/`) — 8 specs, 76 tests

| Spec                  | Tests | 角色             | 裝置               |
| --------------------- | ----- | ---------------- | ------------------ |
| order-lifecycle       | 10    | All 5 roles      | Desktop + Mobile   |
| guest-dine-in         | 12    | Guest            | Mobile (iPhone 12) |
| guest-shop-takeaway   | 10    | Guest (shop)     | Mobile             |
| kitchen-shift         | 10    | Chef             | Tablet (iPad Pro)  |
| pos-shift             | 10    | Cashier          | Desktop            |
| daily-operations      | 10    | Owner            | Desktop            |
| delivery-shift        | 6     | Service Crew     | Mobile (Pixel 5)   |
| reservation-to-seated | 8     | Owner + Customer | Desktop + Mobile   |

---

## 測試基礎設施

| 組件                | 狀態 | 位置                                                  |
| ------------------- | ---- | ----------------------------------------------------- |
| Vitest 設定         | OK   | `vitest.config.ts` + 各 app config                    |
| Playwright 設定     | OK   | `playwright.config.ts` (6 browsers/devices)           |
| Visual 設定         | OK   | `playwright.visual.config.ts`                         |
| Factory Pattern     | OK   | `packages/testing-utils/` (12 factories)              |
| API Contract System | OK   | `apps/api/src/contracts/` (22 modules)                |
| Contract Snapshot   | OK   | `.api-contracts-snapshot.json`                        |
| Pre-commit Hook     | OK   | `scripts/check-factory-usage.cjs`                     |
| E2E Helpers         | OK   | `tests/e2e/helpers/` (mock-api, personas, assertions) |
| E2E Journey Helpers | OK   | `tests/e2e/support/test-helpers.ts`                   |
| Performance Tests   | OK   | `tests/performance/` (6 Artillery configs)            |
| Testing Standards   | OK   | `CLAUDE.md` Testing Standards section                 |

---

## Bug 追蹤（測試中發現）

| Bug            | 位置                                           | 狀態       | 描述                                                              |
| -------------- | ---------------------------------------------- | ---------- | ----------------------------------------------------------------- |
| 優惠券列表空白 | `CouponsView.vue:554`                          | **已修復** | `response.data.data` 雙重解構導致列表為空                         |
| ISSUE-001      | `AccountManagementView.vue`                    | **已修復** | useI18n 錯誤 import + toast plugin 未註冊                         |
| ISSUE-002      | 10 個子元件 (forecast/ingredients/monitoring)  | **已修復** | 同 001，vue-i18n 錯誤 import                                      |
| ISSUE-003      | `customer-app/useCurrency.ts`                  | **已修復** | 價格被 /100（DB 存元，formatPrice 假設分）                        |
| ISSUE-004      | `customer-app/MenuItemCard.vue`                | **已修復** | inventoryCount=0 誤判為售完                                       |
| ISSUE-005      | `customer-app/router/index.ts`                 | **已修復** | UUID restaurantId → Number() = NaN                                |
| ISSUE-006      | `customer-app/CartView.vue`                    | **已修復** | 內用匿名下單走錯 API endpoint                                     |
| ISSUE-007      | `ShopCartModal.vue` + seed data + schema       | **已修復** | 外帶 guest order 端點 + seed + validation                         |
| ISSUE-008      | `kitchen-display/EnhancedKitchenDashboard.vue` | **已修復** | 同 005，UUID → Number() = NaN                                     |
| ISSUE-009      | `guest-orders/routes/index.ts`                 | **已修復** | phoneLastDigits 3 位傳入 phone 欄位（要求 7-20 位）               |
| ISSUE-010      | `customer-app/services/api.ts`                 | **已修復** | handleAuthError 清除 guest_auth_token                             |
| ISSUE-011      | `admin-dashboard/useMenuManagement`            | **已修復** | 菜品刪除後 UI 未移除（soft delete + includeAll 帶回）             |
| ISSUE-012      | `guest-orders/routes` + `OrdersService` + DB   | **已修復** | 外帶 guest order 失敗 "Table is not available"（shop 不需 table） |

---

## 變更日誌

### 2026-04-12 ~ 2026-04-13 (auth-client 抽離 + kitchen-display auth gating)

- `refactor: extract shared auth + API client into @makanmakan/auth-client`
  - 新增 3 個 package 測試：`create-api-client.test.ts`、`create-token-manager.test.ts`、`storage.test.ts`
  - admin-dashboard auth store / AuthViews 測試同步遷移至共用 client
- `fix(kitchen-display)`：掛載前等待 auth 初始化，避免啟動競態；audio toggle 測試按鍵獨立化
- `fix(orders)`：`createOrder` 回應補上 `menuItem` relation — 對應 `tests/e2e/integration/customer-dine-in.spec.ts`

### 2026-04-10 ~ 2026-04-12 (Issue #9 — OrderStatus 統一 + restaurantId UUID 遷移)

- **Phase 0–5**：OrderStatus 從 numeric (0/1/2/3) 全面改為 string union (`pending | preparing | ready | delivered | paid | refunded | cancelled`)
  - `refactor: OrderStatus unification — Phase 0-2 (#17)`：API、admin-dashboard、kitchen-display、shared-types 全部改字串
  - `refactor(api): delete OrderPermissions dead code (Phase 0.5 Q6)`
  - `refactor(admin-dashboard): delete 4 local OrderStatus definitions, use shared-types`
  - `refactor(kitchen-display): full migration to string OrderStatus (Phase 5)`
  - `refactor: add refunded to Zod schemas, OpenAPI, factory + transitions`
  - i18n 鍵 `orderStatus.completed` 統一改名為 `delivered`，E2E spec 對應修正
- **restaurantId 字串化**：`bb4fe558 fix(ts): update tables tests to pass string restaurantId after UUID migration`
- **測試修復**：`81af9a6c fix: resolve 36 test failures from OrderStatus + restaurantId migration`
  - 涵蓋 admin-dashboard (CashierView, OrdersView, POSView)、api (core-modules, state-machine, tables/validation)、kitchen-display (persistenceService)、queue-service

### 2026-04-05 ~ 2026-04-10 (i18n 擴充 — 三個 app)

- `feat(i18n): add i18n support to kitchen-display` — 新增 OrderCard 測試
- `feat(i18n): add i18n support to onboarding-app`
- `feat(i18n): add i18n support to management-portal`

### 2026-04 視覺回歸

- `test(visual): regenerate baselines via workflow_dispatch` — 透過 GHA `workflow_dispatch` 重新產生 Linux baseline；新增 `workflow_dispatch` 入口以解決本地 macOS 與 CI 差異
- 影響 kitchen-display、management-portal、onboarding-app 的多個 snapshot

### 2026-04-03 (Manual QA — 6 roles, 12 bugs fixed + UX overhaul)

- 完成 6 角色全面瀏覽器手動 QA 測試（Chrome DevTools）
  - Admin, Owner, Chef, Service Crew, Cashier, Customer（匿名）
  - 70+ 頁面逐頁測試，RBAC 全方向驗證
- 發現並修復 12 個 bugs（ISSUE-001 ~ ISSUE-012）
  - 5 Critical: 空白頁、價格/100、售完、路由 NaN、Kitchen Display 無權限
  - 5 High: i18n imports、guest order 端點、phone 格式、token 清除、外帶 table error
  - 2 Medium: guest order schema、seed data
- E2E 場景測試：登入流程、菜單 CRUD、員工 CRUD、跨角色訂單、內用/外帶掃碼
- 驗證餐廳資料隔離（多租戶安全）— curl 實測跨餐廳存取被 403 阻擋
- 驗證內用 + 外帶掃碼免登入點餐完整 E2E 流程
- UX 大幅改善：
  - Chef 登入引導到 Kitchen Display
  - 全局 confirm() → 自訂 modal（33 處）
  - 全局 alert() → toast notification（85 處）
  - 零瀏覽器原生 dialog（118 處全部替換）
- 完整報告: [manual-qa-report-2026-04-02.md](reports/manual-qa-report-2026-04-02.md)

### 2026-04-02 (100% Vue coverage verified)

- 補齊最後 8 個遺漏 Vue 頁面 (+151 tests, +8 files)
  - EmployeeDetailView 24, EmployeeProfileTab 26, AttendanceOverviewTab 23
  - EmployeeLeaveTab 16, EmployeeScheduleTab 15, LeavesTab 22, LeaveView 17
  - ProductAnalyticsView 8 (追加至 AIAnalytics.test.ts)
- 修正文檔不準確：Menu 子組件非空殼（實際有 79 tests）
- 交叉驗證：45/45 Vue 頁面全部有測試覆蓋
- 全局統計: 308 files / 8,496 tests (from 301 / 8,345)

### 2026-04-02 (D→A upgrade)

- 全部 D 級頁面升至 A 級 (+212 tests, +9 new files)
  - Batch 1: ServiceView 46, PlatformOverview 20, AccountManagement 33
  - Batch 2: BackupViews 23, ForecastView 14, IngredientsView 14, SchedulingViews 23
  - Batch 3: ErrorPages 19, TableDetailView 15, Menu shells verified (already populated)
- Admin Dashboard 所有 Vue 頁面現在全部 A 級覆蓋
- 全局統計: 301 files / 8,345 tests (from 292 / 8,133)

### 2026-03-31 (C→A upgrade)

- 全部 C 級項目升至 A 級 (+306 tests, +11 new files)
  - Image Processor: analytics route 26 tests + compression depth 8 tests
  - Print Agent: LocalPrintService 28 tests + PrintAgentService 41 tests
  - Admin Auth Views: Login 15 + ForgotPassword 10 + ResetPassword 13 = 38 tests
  - Queue Service: deepened 37→73 tests (+36)
  - Onboarding: integration flow 35 tests
  - Fixed 28 pre-existing failures (onboarding 8 + queue-service 20)
- 全局統計: 292 files / 8,133 tests (from 281 / 7,827)

### 2026-03-31 (B→A upgrade)

- 全部 B 級頁面升至 A 級 (+323 tests, +4 new files)
  - Batch 1: WaitingList 10→38, 新增 ReservationTab 27, TableSetupTab 23
  - Batch 2: Owner 27→71, GroupOrders 26→48, 新增 CashierView 52
  - Batch 3: Settings 23→59, Monitoring 25→47, AI 20→38, 新增 EmployeeListTab 30
- 全局統計: 281 files / 7,827 tests (from 277 / 7,504)

### 2026-03-31

- 新增 9 個 Admin Dashboard view 單元測試檔案 (+300 tests)
  - P0: MenuView (55), SeatingManagement (35), POS (55)
  - P1: EmployeeScheduleLeaves (43), SettingsView (23), OwnerView (27)
  - P2: GroupOrders (26), Monitoring (25), AIAnalytics (20)
- 修復 CouponsView 優惠券列表空白 bug

### 2026-03-30

- 修復 49 個失敗測試檔案 (kitchen-display, customer-app, admin-dashboard)
- 修復 336 個 TypeScript 錯誤 (integration/security test `body` type)
- 修復 Vitest 4 maxWorkers/sequence.groupOrder 衝突
- 遷移 4 個 Security test 到 factory pattern
- 更新 contract snapshot (21 modules, 194 schemas)
- 移除 Artillery 硬編碼密碼 → 環境變數
- 建立 E2E 基礎設施 (mock-api, personas, assertions)
- 新增 8 個 E2E journey specs (+76 tests)
- 執行 Admin + Owner 角色 Playwright E2E 手動測試（14 個頁面通過）

### 2026-03-28

- 同步文檔：CLAUDE.md commands、API docs (300+ endpoints)、architecture docs

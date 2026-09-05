# 員工端換班入口（#320）

**狀態**：已實作
**日期**：2026-09-05
**相關**：#314（店長端進階排班，已關閉）、#99（申請綁定登入員工，已關閉）、#308（打卡入口，仍開啟）

---

## 1. Root cause

換班功能缺的是**前端入口**，不是後端能力。

`apps/api/src/features/scheduling/routes/index.ts` 的
`POST /:restaurantId/swap-requests` 只掛 `authMiddleware` +
`requireRestaurantAccess`，**沒有** `requireRole`，任何綁定該餐廳的員工都能呼叫；
而 handler 直接寫死

```ts
requesterEmployeeId: userIdString(user),
```

request body 根本沒有 requester 欄位可填。`SchedulingService.createSwapRequest`
再驗一次班次屬於該員工、屬於該餐廳。`accept` / `cancel` 同樣以 session 身分執行。
**#99 在後端已經完整落地。**

缺的是：`SwapRequests.vue` 只有店長端的核准／駁回介面，
`schedulingService.createSwapRequest()` 在整個 repo 沒有任何呼叫端。

第二個、比 issue 描述更嚴重的問題：**角色 2 被擋在 admin-dashboard 之外**。
`apps/admin-dashboard/src/views/LoginView.vue:207` 不只是導向，而是
`await authStore.logout()` 之後顯示「請改用 Kitchen Display」。所以只加在
admin-dashboard 的入口，廚師永遠碰不到。

---

## 2. 產品決策

### 決策一：採「員工自助」，不採「店長代辦」

| | 員工自助 | 店長代辦 |
| --- | --- | --- |
| 新增 API | 0 支 | 1 支（需接受 `requesterEmployeeId`） |
| 與 #99 的關係 | 沿用 | 直接推翻 |
| 稽核軌跡 | requester = session，不可偽造 | 需另設 `createdOnBehalfBy` 欄位 + migration |
| 員工端入口 | 有 | 仍然沒有 |

店長代辦看起來比較「小」，其實是**唯一需要動後端與資料庫**的選項，而且要重新開一個
前端可指定申請人的缺口——那正是 #99 關掉的東西。自助是同時較省又較安全的一邊。

### 決策二：只做「開放式申請」，不指定同事與目標班次

員工對**自己的**班次發起申請，`isOpenRequest: true`，不指定 `targetEmployeeId`
或 `targetScheduleId`，由店長在 #314 的進階排班頁核准／駁回。

理由：目前 `GET /:restaurantId/schedules` 對非管理者會強制覆寫
`employeeId` 為 session 使用者，`GET /:restaurantId/available-employees` 是
`requireRole([ADMIN, OWNER])`。也就是說「挑一位同事的班次」需要**新開一支讓員工
讀得到同事班表的端點**——那是隱私面的擴張，不是排版工作。開放式申請零新端點就能
把「我這天需要有人接手」這件事送到店長桌上，先把入口補起來。

若之後要做點名交換，需要另開 issue 處理：同事班表端點、對方同意流程
（`accepted` 狀態已在 schema 中預留）、以及 `GET swap-requests` 對非管理者
「只看得到自己送出的」這條限制的放寬。

### 決策三：授權邊界

| 動作 | 允許角色 | 由什麼保證 |
| --- | --- | --- |
| 發起申請 | 0/1/2/3/4（任何綁定該餐廳的員工） | route 無 `requireRole`；requester = session |
| 選擇哪些班次 | 僅自己的、僅本餐廳、僅未來且未取消／未完成 | 後端強制 employeeId + restaurantId；前端再濾掉過去與已取消 |
| 取消申請 | 申請人本人 | `cancelSwapRequest(id, sessionUserId)` |
| 核准／駁回 | 0/1 | `requireRole([ADMIN, OWNER])` |
| 整個功能 | 需啟用 `staff_management` 模組 | `apiV1.use("/scheduling/*", moduleGate("staff_management"))` |

---

## 3. 實作

後端 **0 檔案變更**。

| 檔案 | 內容 |
| --- | --- |
| `apps/admin-dashboard/src/views/MyShiftsView.vue` | 員工端「我的班表」（角色 1/3/4） |
| `apps/admin-dashboard/src/router/index.ts` | `/dashboard/my-shifts`，五個角色皆可 |
| `apps/admin-dashboard/src/stores/auth.ts` | `canAccessRoute` 明列 `MyShifts` |
| `apps/admin-dashboard/src/components/layout/Sidebar.vue` | 側欄入口，`visible: true` + `module: "staff_management"` |
| `apps/kitchen-display/src/views/MyShiftsView.vue` | 同一頁，給角色 2 |
| `apps/kitchen-display/src/services/schedulingApi.ts` | 廚房端需要的四支呼叫 |
| `apps/kitchen-display/src/router/index.ts` | `/my-shifts`，`requiredRole: 2` |
| `apps/kitchen-display/src/components/layout/KitchenHeader.vue` | 標題列入口按鈕 |
| i18n | admin 6 語系、kitchen 6 語系 |

兩支 view 都遵循 `docs/UIUX-design-system.md`：`bg-ios-bg` 底、白卡
`rounded-2xl` + `shadow-ios-card` / `shadow-card-sm`、pill 按鈕、無硬邊框。

### 為什麼是兩支 view 而不是一支共用元件

兩個 app 各有自己的 i18n 實例、auth store 與 axios client。抽成共用元件要注入這
三樣、再把 12 個語系檔合流，比兩支各自簡短的 view 複雜。等第三個 app 需要同一頁
時再抽。

---

## 4. 驗收條件對照

| AC | 落點 |
| --- | --- |
| 記錄產品決策 | 本文件 |
| 定義角色與授權邊界 | 第 2 節決策三 + `auth.ts` 的 `MyShifts` 項 |
| 在真正到得了的介面提供入口 | admin 側欄（1/3/4）+ kitchen 標題列（2）；兩支測試都從**路由表**取出元件，不是直接 import |
| 僅顯示符合資格的班次 | 後端 employeeId/restaurantId 強制 + 前端濾掉過去、已取消、已完成、已有待審申請的班次 |
| 成功／空狀態／無可換班次／API 錯誤 UI | `my-shifts-empty`、`my-requests-empty`、`my-shifts-error`、`swap-form-error`；錯誤走 `resolveUserFacingError`，403（模組未啟用）與 409（衝突）各有自己的文案 |
| 沿用 #99 binding | 送出 payload 不含 `requesterEmployeeId`，兩支測試都明確斷言這一點 |
| 整合測試 | `MyShiftsView.test.ts`（admin 8 例、kitchen 7 例），從路由解析走到送出成功 |

---

## 5. 已知邊界

- 申請卡片顯示的班次來自前端載入的 `[-30d, +60d]` 視窗；超出視窗的申請顯示
  `#<scheduleId>`。`GET /swap-requests` 回傳的是原始資料列，沒有 join 班次或姓名。
- 同一個原因，店長端 `SwapRequests.vue` 依賴的 `requesterName`、
  `originalShiftDate` 等欄位 API 從來沒有回傳過，那些位置一直是空的。屬於 #314
  的既有缺口，不在本次範圍。
- 員工看不到、也無法接受別人的開放式申請：`GET /:restaurantId/swap-requests`
  對非管理者會把 `requesterEmployeeId` 覆寫成自己。`POST /swap-requests/:id/accept`
  因此目前只有管理者到得了。要開放「同事互接」需一併處理，見決策二。

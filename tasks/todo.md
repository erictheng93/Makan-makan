# Todo: P1 — 候位後端缺口修復

對應計劃文件：`tasks/plan.md` 對應 spec：`docs/specs/queue-and-waiting-list.md`

> 一行一動作。完成的勾起來。每完成一個任務，提交一個小 commit；T7 後合併為 P1 PR。

---

## T0｜SSE 基礎設施 spike ✅ 完成（2026-05-01）

- [x] 讀 `apps/api/src/features/sse/services/SSEService.ts` 全檔
- [x] 讀 `apps/api/src/features/sse/controllers/SSEController.ts` 全檔
- [x] 讀 `apps/api/src/features/sse/routes/index.ts` 全檔
- [x] 讀 `apps/realtime/src/index.ts` + `RealtimeSession.ts` 廣播路徑
- [x] 讀 `apps/admin-dashboard/src/composables/useStatisticsSSE.ts`、`useRealtimeOrderStatus.ts`
- [x] 讀 `apps/api/wrangler.toml`（**發現缺 DO binding**）+ `apps/realtime/wrangler.toml`
- [x] 讀 `apps/api/src/services/RealtimeBroadcastService.ts`（**發現該 class 已存在但被 binding 缺失廢掉**）
- [x] grep 確認 `RealtimeBroadcastService` 唯一 caller 是 OrdersService + KitchenService
- [x] 結論：方案 A（接 realtime DO + 搬 RealtimeBroadcastService + 加 binding + 廣播 `admin:${id}` room）
- [x] 寫進 `tasks/plan.md` §4
- [x] **CP1 通過**：user 採方案 A + Q2(iii)（不修 OrdersService room）

---

## T1a｜搬 `RealtimeBroadcastService` 到 `packages/database` ✅ 完成（commit 80462b77）

- [x] 在 `packages/database/src/services/` 新增 `RealtimeBroadcastService.ts`，沿用 apps/api 既有實作
- [ ] 移除舊檔對 `apps/api/src/shared/types` 的 `Env` import，改為內部 `interface BroadcastEnv { REALTIME_SESSION?: DurableObjectNamespace }`
- [ ] 移除 `ConsoleLogger` import，改用 `console.warn` / `console.error`
- [ ] 修改 `packages/database/src/services/index.ts`：re-export `RealtimeBroadcastService`、`BroadcastResult`
- [ ] 確認 `packages/database/package.json` 有 `@makanmasak/shared-types` 依賴（應已有）
- [ ] 刪除 `apps/api/src/services/RealtimeBroadcastService.ts`
- [ ] 更新 import path：`apps/api/src/features/orders/services/OrdersService.ts`
- [ ] 更新 import path：`apps/api/src/features/kitchen/services/KitchenService.ts`
- [ ] 更新 import path：6 個 orders 測試檔（grep 找出來逐個改）
- [ ] 更新 import path：`apps/api/src/__tests__/security/business-logic-security.test.ts`
- [ ] 把 `apps/api/src/services/__tests__/RealtimeBroadcastService.test.ts` 搬到 `packages/database/src/services/__tests__/`
- [ ] 確認 `apps/api/src/services/__tests__/broadcast.test.ts` 仍可運作（可能引用 mock）
- [ ] 在 `@makanmasak/shared-types` 的 `RealtimeEvent` union 預留 `WaitingListEvent` 變體（也可拖到 T3）
- [ ] grep 驗證：`rg "services/RealtimeBroadcastService" apps/` 預期 0 命中
- [ ] `pnpm --filter @makanmasak/database typecheck` 全綠
- [ ] `pnpm --filter @makanmasak/api typecheck` 全綠
- [ ] `pnpm --filter @makanmasak/database test` 全綠
- [ ] `pnpm --filter @makanmasak/api test orders` 全綠（驗證搬遷不改行為）
- [ ] commit

---

## T1b｜建 `ticket-primitives/state-machine.ts` ✅ 完成（commit bd638f40）

- [x] `mkdir packages/database/src/services/ticket-primitives`
- [ ] 確認 `ApiError` 在 packages/database 是否有等價物，若無則 import 自 `@makanmasak/shared-types` 或重新定義
- [ ] 寫 `state-machine.ts`：`WAITING_TRANSITIONS` 含 `no_show: []` + `assertWaitingTransition()` 函式
- [ ] 寫 `index.ts` re-export
- [ ] 寫 `__tests__/state-machine.test.ts`：7 個 from-state（含 no_show）合法路徑 + 至少 5 個非法路徑
- [ ] 更新 `packages/database/src/services/index.ts` re-export
- [ ] `pnpm --filter @makanmasak/database typecheck` 全綠
- [ ] `pnpm --filter @makanmasak/database test ticket-primitives` 全綠
- [ ] commit

---

## T1c｜加 `apps/api/wrangler.toml` 的 DO binding ✅ 完成（commit 3d2ef592）

- [x] 在 `[env.development]`、`[env.staging]`、`[env.production]` 各加 `[[durable_objects.bindings]]` 指向對應 env 的 realtime worker（`script_name` 對照不同 env name）
- [ ] 確認 dev 區塊用 `makanmasak-realtime`（root），staging 用 `makanmasak-realtime-staging`，production 用 `makanmasak-realtime-prod`
- [ ] `pnpm wrangler deploy --dry-run --env development` 不報錯
- [ ] `pnpm wrangler deploy --dry-run --env staging` 不報錯
- [ ] 啟動兩個 worker 順序：`pnpm dev:realtime` → `pnpm dev:api`
- [ ] dev 體驗驗證：暫時加 `console.log(c.env.REALTIME_SESSION)` 看 binding 是否存在（驗完拿掉）
- [ ] **副作用驗證**：`pnpm --filter @makanmasak/api test orders` 全綠（mock 仍適用）
- [ ] 若 dev 體驗確實需要特殊順序，更新 `CLAUDE.md` 說明
- [ ] commit

---

## T2｜G6 狀態機守衛（依賴 T1b）

- [ ] grep `expireWaiting | cancelWaiting | callWaiting | confirmWaiting | markSeated` 看誰呼叫，列出 caller 清單
- [ ] 確認 caller 中沒有「對 terminal 票誤呼叫」的習慣（特別檢查 cron / batch job）
- [ ] 修 `WaitingListService.callWaiting`：方法入口 `assertWaitingTransition(entry.status, 'called')`
- [ ] 修 `WaitingListService.confirmWaiting`：方法入口 `assertWaitingTransition(entry.status, 'confirmed')`
- [ ] 修 `WaitingListService.markSeated`：方法入口 `assertWaitingTransition(entry.status, 'seated')`
- [ ] 修 `WaitingListService.cancelWaiting`：方法入口 `assertWaitingTransition(entry.status, 'cancelled')`
- [ ] 修 `WaitingListService.expireWaiting`：方法入口 `assertWaitingTransition(entry.status, 'expired')`
- [ ] 加測試：對 `seated` 票 call → 409
- [ ] 加測試：對 `cancelled` 票 任意動作 → 409
- [ ] 加測試：對 `waiting` 票 直接 seat → 409
- [ ] 加測試：完整合法路徑 `waiting → called → confirmed → seated`
- [ ] 加測試：合法捷徑 `waiting → cancelled`、`called → expired`
- [ ] 跑既有測試確認無 regression
- [ ] commit

---

## T3｜G1 廣播接 service 出口（依賴 T1a + T1c）

- [ ] 在 `@makanmasak/shared-types` 加 `WaitingListEvent` union 變體（若 T1a 未做）：`type: 'waiting_list_joined' | 'waiting_list_called' | ...`
- [ ] 修 `WaitingListService.joinWaitingList` 出口：`new RealtimeBroadcastService(env).broadcastEvent('admin', restaurantId, { type: 'waiting_list_joined', ... })`
- [ ] 修 `WaitingListService.callWaiting` 出口：`waiting_list_called`
- [ ] 修 `WaitingListService.confirmWaiting` 出口：`waiting_list_confirmed`
- [ ] 修 `WaitingListService.markSeated` 出口：`waiting_list_seated`
- [ ] 修 `WaitingListService.cancelWaiting` 出口：`waiting_list_cancelled`
- [ ] 修 `WaitingListService.expireWaiting` 出口：`waiting_list_expired`
- [ ] 確認 payload 形狀統一：`{ entryId, queueDisplay, status, partiesAhead?, tableId?, customerName? }`
- [ ] **room name 一律 `admin:${restaurantId}`**（不是 `restaurant:`）
- [ ] 加測試：每個動作呼叫 mock broadcaster 一次，room + 事件名正確
- [ ] 加測試：mock broadcaster 回 `success: false` → service 主流程仍 200，DB 仍寫入
- [ ] 加測試：mock broadcaster 拋例外 → service 主流程仍 200（catch 必須包住）
- [ ] grep 確認新增程式 0 命中 `${env.API_BASE_URL}/api/v1/sse/broadcast/`
- [ ] 確認 `apps/api/src/features/queue/routes/index.ts` 的 `broadcastQueueUpdate` 仍未動（P4b 才動）
- [ ] 手動：`pnpm dev:realtime` + `pnpm dev:api` + admin-dashboard 連 WS + curl join → 看板有事件
- [ ] commit

---

## T4｜G4 冪等 join

- [ ] 找 `WaitingListResponse` 介面定義位置（`packages/shared-types/src/...`）
- [ ] 加 optional `alreadyJoined?: boolean` 欄位
- [ ] 修 `WaitingListService.joinWaitingList:153-163`：existingEntry 改回傳 entry + `alreadyJoined: true`，不 throw
- [ ] 處理 race condition：existingEntry id 但 `getWaitingListEntryById` 找不到 → 視為新票繼續流程
- [ ] 加測試：同手機同餐廳當日 POST 兩次 → 第二次 200 + `alreadyJoined: true`
- [ ] 加測試：同手機跨日 → 視為新票（無 `alreadyJoined`）
- [ ] 加測試：同手機已 `cancelled` → 視為新票
- [ ] 加測試：同手機已 `seated` → 視為新票
- [ ] 加測試：同手機已 `expired` → 視為新票
- [ ] 加測試：不同餐廳同手機 → 兩張票（既有行為）
- [ ] `pnpm --filter @makanmasak/shared-types typecheck` 全綠
- [ ] `pnpm --filter admin-dashboard typecheck` 全綠（確認新欄位不破壞前端 TS）
- [ ] PR 描述記下 follow-up：admin-dashboard 應依 `alreadyJoined` 切換 toast
- [ ] commit

---

## T5｜G3 lookup endpoint

- [ ] 寫 `WaitingListService.findActiveTicketByPhone(restaurantId, phone)` 方法
- [ ] 確認 SQL 加 `LIMIT 1`（依 G4 唯一性保證，但仍防禦）
- [ ] 確認 status filter 為 `('waiting', 'called', 'confirmed')`（不含 cancelled/expired/seated）
- [ ] 加 service 測試：active 票回傳完整 entry
- [ ] 加 service 測試：cancelled / expired / seated → null
- [ ] 加 service 測試：跨餐廳隔離（A 餐廳手機 in B → null）
- [ ] 在 `apps/api/src/features/waiting-list/routes/index.ts` 公開區（`app.use("/*", authMiddleware)` 之前）加 `GET /lookup` handler
- [ ] handler 驗證 query：`restaurantId` 必填、`phone` 必填且符合 `^09\d{8}$`
- [ ] handler 找不到 → 404 + `code: 'NO_ACTIVE_TICKET'`
- [ ] handler 找到 → 200 + `{ success: true, data }`
- [ ] 加 route 測試：4 種輸入（valid / cancelled / 格式錯 / 缺參數）
- [ ] commit

---

## T6｜G5 confirm phone gate

- [ ] 修 `apps/api/src/features/waiting-list/routes/index.ts:161-173` 的 `POST /:id/confirm`
- [ ] 從 body 讀 `customerPhone`，缺則 400
- [ ] 取 entry，不存在則 404
- [ ] phone 不符則 403 + `code: 'PHONE_MISMATCH'`
- [ ] phone 符 → 呼叫 `service.confirmWaiting(id)` → 200
- [ ] 加 route 測試：缺 phone → 400
- [ ] 加 route 測試：phone 不符 → 403
- [ ] 加 route 測試：phone 符 → 200
- [ ] 加 route 測試：不存在 id → 404
- [ ] 加整合測試：對 `seated` 票 confirm → 409（驗證 G6 接管，與 T2 整合無 regression）
- [ ] commit

---

## T7｜整合測試 + 整體驗證

- [ ] **CP2：self-review T2-T6 diff，確認每個缺口的 acceptance 全綠**
- [ ] 在 `apps/api/src/features/waiting-list/__tests__/` 加 / 補完整生命週期 integration test
- [ ] case 1：完整 happy path（join → call → confirm → seat）含 phone gate + SSE mock 驗證
- [ ] case 2：取消路徑（join → cancel by phone）
- [ ] case 3：過期路徑（join → call → expire）
- [ ] case 4：G4 冪等（同手機 join 兩次）
- [ ] case 5：G3 lookup（join → 不傳 ticketId → lookup by phone → 後續 seat 流程）
- [ ] case 6：G5 phone gate（缺 phone / 錯 phone）
- [ ] case 7：G6 違法轉移（seat 一張 waiting 票、call 一張 cancelled 票）
- [ ] `pnpm typecheck` 全綠（整個 monorepo）
- [ ] `pnpm lint` 全綠
- [ ] `pnpm test` 全綠（整個 monorepo）
- [ ] `pnpm --filter @makanmasak/api test:coverage waiting-list` — 覆蓋率不低於修改前
- [ ] 手動：wrangler dev + curl 走完完整流程，紀錄附 PR 描述
- [ ] 整理 PR 描述（5 個缺口 before/after、T0 結論摘要、curl log、follow-up）
- [ ] **CP3：請 user review 整體 diff**
- [ ] 開 PR

---

## 後續（不在 P1，但要記錄）

- [ ] 開 follow-up issue：admin-dashboard `WaitingListTab.vue` 依 `alreadyJoined` 切換 toast 訊息
- [ ] P2 plan：moduleGate 拆分（G7）
- [ ] P3 plan：候位 customer-app 自助頁（G2）
- [ ] P4 plan：排隊系統 MVP（4a/4b/4c/4d）

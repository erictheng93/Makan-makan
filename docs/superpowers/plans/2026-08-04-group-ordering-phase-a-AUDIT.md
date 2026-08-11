# Phase A 執行階段拆解與驗收標準

> 配套文件：`2026-08-04-group-ordering-phase-a-host-foundation.md`
> 角色分工：使用者實作，Claude 稽核。每個 Stage 完成後請求稽核，附上指定的證據輸出。
> 建立日期：2026-08-04

## 稽核規則

1. **證據優先**：每條驗收標準都要有可貼上的指令輸出。「看起來對」不算通過。
2. **不接受 mock 掩蓋的通過**：mock 掉 D1 的測試通過，不證明 SQL 正確。涉及 schema 的項目一律要求真實 D1 驗證。
3. **一條不過 = 該 Stage 不驗收**，退回修正後重驗。
4. 稽核只看驗收標準與實際程式碼，不看實作者的自述。

---

## Stage 0：Plan 缺口修正（動工前決策）

這三項在 plan 原文中缺漏或有誤，必須先確認處理方式。

- [ ] **G-1（P0）quotaGate guest 繞過**
  `apps/api/src/middleware/quotaGate.ts:210-213` 的 `enforceQuota` 在無 `restaurantId` 時 `return`（靜默放行）。`moduleGate` 補了 guest fallback 但 `quotaGate` 沒有 → guest 建立團購單時配額硬上限完全不生效。
  **處理方式**：在 Stage 1 新增 Task 1b，讓 `quotaGate` 接受相同的 `resolveGuestRestaurantId` 參數（或改以 `options.restaurantId` 明帶）。

- [ ] **G-2（P1）Task 2 → Task 4 之間 runtime 損壞**
  `recovery_code NOT NULL` 先落地，寫入它的服務程式碼在 Task 4。中間任何真實 `createGroupOrder` 會撞 NOT NULL。

  **決定：採 (a) — Stage 2 的 commit 保留在本地不推，與 Stage 3 一起推送／部署。**（2026-08-04 判定）

  排除 (b)「migration 給暫時 default、之後移除」的理由：
  1. SQLite 無 `ALTER COLUMN`，移除 default 需要**第二次整表重建**。`group_orders` 在 fresh 軌只於 `0005_powerful_roxanne_simpson.sql` 建立過，之後皆為 `ALTER TABLE ADD COLUMN` — 0080 是它的首次重建。(b) 會把一個尚無前例的高風險操作做兩次，每次都要正確還原 6 index + 2 trigger。
  2. 隨機 default（`lower(hex(randomblob(16)))`）會在寫入路徑漏接時產生**主辦人永遠拿不到**的 recovery code — 團購單看似正常實則永久無法復原，且無任何錯誤訊號。NOT NULL 違反則是當場失敗、原因明確。`DEFAULT ''` 則第二筆就撞 UNIQUE。
  3. Drizzle schema 宣告 `.notNull().unique()` 無 default，(b) 製造 schema 與 DB 漂移。
  4. 兩軌 migration 全 repo 無「暫時 default 再移除」前例；plan 援引的 `reservations.confirmation_code`（0012）與 `service_bookings.confirmation_code`（0060）皆自建表起即 `NOT NULL` + UNIQUE。

  亦排除 (c)「Task 2 + Task 4 壓成單一 commit」：可消滅視窗，但混合 migration 與 service 邏輯難以 review，破壞 `feat(database):` / `feat(api):` scope 慣例，且 Task 4 相依 Task 3。(a) 以更低成本取得同等 production 安全性。

  **(a) 的執行護欄（Stage 2 稽核時一併檢查）：**
  - 重建前先存 schema 快照，使 B-3 為 diff 比對而非肉眼清點：
    `sqlite3 "<local d1>" "SELECT type,name,sql FROM sqlite_master WHERE tbl_name='group_orders' ORDER BY type,name;" > /tmp/go_before.sql`
    migrate 後輸出 `go_after.sql` 並 diff。
  - Stage 2 commit 絕不單獨 push；Stage 3 綠燈後兩批一起推、一起部署。
  - `pnpm db:migrate:local` 後直接接續 Task 4，壓縮本地損壞視窗（本樹為多 session 共用）。

- [ ] **G-3（P2）moduleGate fallback 在 middleware 讀 body**
  Task 5 的 fallback 於 `validateBody` 之前呼叫 `await c.req.json()`。
  **處理方式**：Stage 3 必須有測試證明 (i) 下游 `validateBody` 仍讀得到 body、(ii) 非 JSON／空 body 不會 500。

---

## Stage 1：閘門層（Task 1 + 新增 Task 1b）

**目標**：讓 `moduleGate` 與 `quotaGate` 都能在無登入使用者時，從 route 提供的 fallback 取得 `restaurantId`。
**可獨立部署**：是。此階段不改任何 schema 與業務邏輯，向後相容。

### 驗收標準

- [ ] **A-1** `moduleGate` 第二參數 `resolveGuestRestaurantId` 為選用，且支援同步與 async 回傳。
- [ ] **A-2** 新增測試檔 `apps/api/src/middleware/moduleGate.guest-fallback.test.ts`，至少涵蓋：
  - fallback 回傳 restaurantId → 200 通過
  - fallback 回傳 undefined → 403 `NO_RESTAURANT`
  - fallback 回傳 Promise → 正確 await（plan 原文沒測這條，必須補）
- [ ] **A-3** `quotaGate` 亦支援 guest fallback，且新增測試證明：**無登入使用者 + fallback 提供 restaurantId 時，配額硬上限仍會擋下請求**（回應非 200）。這是 G-1 的關閉條件。
- [ ] **A-4** 現有所有 `moduleGate("x")` / `quotaGate("x")` 單參數呼叫點行為不變。
  證據：`grep -rn "moduleGate(\|quotaGate(" apps/api/src --include=*.ts | grep -v test` 列出的呼叫點數量，與 `pnpm --filter @makanmasak/api exec vitest run src/middleware` 全綠。
- [ ] **A-5** `pnpm --filter @makanmasak/api typecheck` 通過。
- [ ] **A-6** commit 為獨立且自身綠燈的 commit。

### 需提交的證據

```
pnpm --filter @makanmasak/api exec vitest run src/middleware
pnpm --filter @makanmasak/api typecheck
git log --oneline -2
```

---

## Stage 2：資料層（Task 2 + Task 3）

**目標**：`group_orders.created_by` 改為 nullable、新增 `recovery_code`；`GroupOrderSettings` 補上 fulfillment/expiry 欄位。
**可獨立部署**：**否**。依 G-2 決策，本階段 commit 不推送，與 Stage 3 同批。

### 驗收標準

- [ ] **B-1** Drizzle schema `packages/database/src/schema/group-orders.ts`：`createdBy` 去掉 `.notNull()`；新增 `recoveryCode: text("recovery_code").notNull().unique()`。
- [ ] **B-2** fresh 軌 migration `packages/database/migrations_fresh/0080_group_orders_guest_host.sql` 存在，且採 CREATE-new → INSERT → DROP → RENAME 重建模式。
- [ ] **B-3** 重建後**所有原有 index 與 trigger 都重新建立**：`group_orders_share_code_unique`、`idx_group_orders_expires`、`idx_group_orders_restaurant_status`、`idx_group_orders_status_created`、`idx_group_orders_table`、`group_orders_restaurant_guard_bi`、`group_orders_restaurant_guard_bu`，外加新的 `group_orders_recovery_code_unique`。
  證據：migrate 後對本地 D1 執行
  `SELECT type, name FROM sqlite_master WHERE tbl_name='group_orders' ORDER BY type, name;`
  必須列出全部 8 個（1 table + 6 index + 2 trigger，index 含 unique）。
- [ ] **B-4** legacy 軌 migration `packages/database/migrations/0097_group_orders_guest_host.sql` 存在，且其欄位清單與 FK 子句是**實際讀取 legacy 軌 schema 後寫的**，不是抄 fresh 軌。
  特別檢查：`created_by` 的 FK 必須保留 legacy 軌原有的 `ON DELETE CASCADE`（fresh 軌是 `no action`，兩軌不同，不可統一）。
  證據：`grep -n "created_by" packages/database/migrations/0017_group_ordering_system.sql` 的輸出，與新 migration 中對應行的並列比對。
- [ ] **B-5** `migration-dual-track.json` 的 `pairs` 已加入該對，含非空 `reason`。（`reviewedThrough` 不需更動 — 已確認 guard 邏輯只要求 checkpoint 之後的檔案被 track。）
- [ ] **B-6** `pnpm check:migration-dual-track` 通過。
- [ ] **B-7** 本地實際套用並驗證：
  `PRAGMA table_info(group_orders);` → `created_by` 的 `notnull = 0`、`recovery_code` 存在且 `notnull = 1`。
  若原本有資料列：`SELECT recovery_code, created_by FROM group_orders LIMIT 3;` → recovery_code 為 backfill 的 hex 字串且互不相同，created_by 原值保留。
- [ ] **B-8** `GroupOrderSettings` 新增 `fulfillmentType` / `deliveryAddress` / `pickupAt` / `autoSubmitOnExpiry` 與 `GroupOrderDeliveryAddress`，且**原有欄位一個都沒被刪**（`maxMembers` / `allowLateJoin` / `requireApproval` / `expirationMinutes` / `allowSplitBill` / `defaultSplitType` / `permissions` / `notes` / `tableNumber`）。
- [ ] **B-9** `pnpm typecheck`（workspace 全量）通過。
- [ ] **B-10** 現有 group-orders 測試全綠；若有測試直接 insert `group_orders` 列而撞 NOT NULL，修法必須是**補 fixture 的 recoveryCode**，不是放寬 schema。

### 需提交的證據

```
pnpm db:migrate:local
sqlite3 "<local d1 path>" "PRAGMA table_info(group_orders);"
sqlite3 "<local d1 path>" "SELECT type, name FROM sqlite_master WHERE tbl_name='group_orders' ORDER BY type, name;"
pnpm check:migration-dual-track
pnpm typecheck
pnpm --filter @makanmasak/api exec vitest run src/features/group-orders
```

---

## Stage 3：建立流程（Task 4 + Task 5）

**目標**：`createGroupOrder` 支援 `hostId: null`、產生並回傳 `recoveryCode`、寫入 fulfillment 設定；`POST /create` 改為 `optionalAuth` 並允許 guest。
**可獨立部署**：是（與 Stage 2 合併後）。此階段綠燈才可推送 Stage 2 + Stage 3。

### 驗收標準

- [ ] **C-1** `createGroupOrder(data, hostId: string | null)`，`hostId` 為 `null` 時寫入 `createdBy: null`。
- [ ] **C-2** 每次建立都產生唯一 `recoveryCode` 並寫入 DB，且在 `CreateGroupOrderResponse` 中回傳一次。
- [ ] **C-3** **`recoveryCode` 與 `memberToken` 都不得進入 cache**。
  證據：測試斷言 `cache.set("group_order:...", ...)` 的 payload 不含這兩個 key（不是只看程式碼有 destructure）。
- [ ] **C-4** 未指定過期時間時，`expiresAt` 預設為 45 分鐘後（±1 分鐘容許）。指定 `expirationMinutes` 或 `expirationHours` 時以指定值為準。
- [ ] **C-5** `fulfillmentType` / `deliveryAddress` / `pickupAt` / `autoSubmitOnExpiry` 正確寫入 `settings`；`fulfillmentType` 未給時預設 `"dine_in"`，`autoSubmitOnExpiry` 未給時預設 `true`。
- [ ] **C-6** 既有 staff 路徑不變：帶 `hostId` 字串時 `createdBy` 仍為該值，且**既有的 staff-hosted 測試沒有被刪除**，是新增 guest case 而非替換。
  證據：`git diff --stat` 中 `index.test.ts` 的刪除行數需可解釋。
- [ ] **C-7** validation schema 移除 `expirationHours` 的 `.default(24)` 與 `maxMembers` 的 `.default(8)`，未給時保持 `undefined`。
- [ ] **C-8** `fulfillmentType: "delivery"` 缺 `deliveryAddress` → 400；`fulfillmentType: "pickup"` 缺 `pickupAt` → 400。兩條各一測試。
- [ ] **C-9** 匿名（無 JWT）`POST /orders/group/create` 回傳 200，且 `createGroupOrder` 被以第二參數 `null` 呼叫。
- [ ] **C-10（G-3 關閉條件）** moduleGate fallback 讀 body 之後，下游 `validateBody` 仍正常運作。至少兩條測試：
  - 合法 JSON body → 通過驗證並進入 handler
  - body 為空／非 JSON → 回 400 驗證錯誤，**不是 500**
- [ ] **C-11（G-1 關閉條件）** 匿名建立團購單時配額仍受檢查：mock 一個已達硬上限的 restaurant，匿名 `POST /create` 必須被擋（非 200）。
- [ ] **C-12** `pnpm --filter @makanmasak/api typecheck && pnpm --filter @makanmasak/api lint` 通過。

### 需提交的證據

```
pnpm --filter @makanmasak/api exec vitest run src/features/group-orders
pnpm --filter @makanmasak/api typecheck
pnpm --filter @makanmasak/api lint
git diff --stat HEAD~4..HEAD
```

---

## Stage 4：新端點（Task 6 + Task 7）

**目標**：`GET /orders/group/join/:shareCode` 無副作用預覽；`POST /orders/group/:groupOrderId/recover` 主辦人裝置復原。
**可獨立部署**：是。

### 驗收標準

#### 預覽端點（Task 6）

- [ ] **D-1** `previewGroupByShareCode` **無任何寫入副作用**：不建立 member、不寫 cache、不寫 activity log。
  證據：測試斷言 insert/update/cache.set 的 mock 皆 `not.toHaveBeenCalled()`。
- [ ] **D-2** 只回傳 active 且未過期的團購單；未知或已過期的 shareCode → `{ found: false }` → route 回 404 `GROUP_ORDER_NOT_FOUND`。
- [ ] **D-3** `memberCount` 只計入未離開的成員（`leftAt IS NULL`）。
- [ ] **D-4** 回應**不含任何機密**：不得出現 `recoveryCode`、`memberToken`、`sessionId`、成員 email/電話。
  證據：一條測試把回應 JSON 序列化後斷言不含這些 key。
- [ ] **D-5** `GET` 與既有 `POST /join/:shareCode` 並存不衝突；一條測試證明 GET 不會觸發 `joinGroup`。
- [ ] **D-6（plan 未涵蓋，必須補）** 此端點有 rate limit。shareCode 是 8 碼 `Math.random()`，無限制的匿名 GET 等同開放列舉，可撈出餐廳 ID 與主辦人姓名。至少套用一層 rate limit middleware。

#### 復原端點（Task 7）

- [ ] **D-7** `recoverHost` 在 code 正確時簽發新 `sessionId` 給 creator 成員列，並回傳為 `memberToken`。
- [ ] **D-8** code 錯誤、團購單不存在、找不到 creator — 三種情況回**完全相同**的 `{ success: false, error: "Invalid recovery code" }`，不可洩漏團購單是否存在。三種情況各一測試。
- [ ] **D-9（plan 未涵蓋，必須補）** 已 `completed` / `cancelled` / 已過期的團購單不得復原。至少一條測試。
- [ ] **D-10** 路由套用 `strictRateLimit`，且有測試證明它確實掛上（不是只看程式碼）。
- [ ] **D-11** 舊的 `memberToken` 在復原後失效（新 sessionId 覆蓋舊值）。
- [ ] **D-12** 匿名（無 JWT）可呼叫 recover 端點。

#### Phase A 總驗收

- [ ] **D-13** `pnpm --filter @makanmasak/api test` 全綠。
- [ ] **D-14** `pnpm typecheck && pnpm lint` 全綠。
- [ ] **D-15** Stage 0 的 G-1 / G-2 / G-3 三項皆已關閉，並在稽核時說明各自的關閉方式。
- [ ] **D-16** 全部 commit 為原子 commit，每個各自綠燈。

### 需提交的證據

```
pnpm --filter @makanmasak/api test
pnpm typecheck
pnpm lint
git log --oneline -10
```

---

## Phase A 範圍界線（超出即為 scope creep，稽核會退回）

**在範圍內**：guest 主辦、recovery code、join 預覽、fulfillment/expiry 設定寫入 `settings`。

**不在範圍內**（屬 Phase B 之後）：分帳邏輯、finalize/checkout 流程、購物車協作與 realtime、原子性保證、任何前端 UI。

`autoSubmitOnExpiry` 在 Phase A 只**存下來**，不實作到期自動送出行為 — 若實作了自動送出，屬超出範圍。

---
---

# 稽核結果（2026-08-04 結案）

**Phase A 驗收通過。** 相關 commit：

| commit | 內容 |
| --- | --- |
| `e7c752da` | feat(api): support guest-hosted group orders（17 檔） |
| `243775dd` | fix(database): mark group orders guest host migration fresh-only（稽核退回後的修正） |

| Gate | 初審 | 結案 |
| --- | --- | --- |
| A 閘門層 | 通過 | 通過 |
| B 資料層 | **不通過**（B-4） | 通過（`243775dd` 修正後） |
| C 建立流程 | 通過 | 通過 |
| D 新端點 | 通過 | 通過 |

稽核方獨立重跑 `pnpm exec vitest run --project api src/features/group-orders src/middleware/moduleGate src/middleware/quotaGate` → 6 files / 51 tests passed，與實作方回報一致。

## 已退回並修正的阻斷項：B-4

**問題**：`packages/database/migrations/0097_group_orders_guest_host.sql` 在任何真正走過 legacy 軌的資料庫上都會執行失敗。

**根因**：0097 的 `INSERT ... SELECT` 讀取 `total_amount_cents` / `tax_amount_cents` / `service_charge_cents` / `final_amount_cents`，但 legacy 軌從未替 `group_orders` 建立這四個欄位（整個 `packages/database/migrations/` 目錄中 `ALTER TABLE group_orders ADD COLUMN` 數量為 0），而 `0087_money_cents_cutover.sql:213-219` 已將原有的四個 DECIMAL 金額欄位 DROP。post-0087 的 legacy `group_orders` 一個金額欄位都不剩 → 套用時 `no such column: total_amount_cents`。

**為何未被既有驗證攔截**：0097 從未被執行過。稽核查證兩顆本地 D1 的 `d1_migrations`：

| DB | 表數 | 最後套用 | 有 `group_orders`? |
| --- | --- | --- | --- |
| `2b35d4d4…`（api） | 119 | `0080_group_orders_guest_host.sql`（fresh 軌） | 是 |
| `1edbaac0…`（management） | 12 | `0012_create_onboarding_credential_deliveries.sql`（management 自有軌） | **否** |

`packages/database/migrations/` 在本地任何一顆 DB 上都沒有被套用。`pnpm check:migration-dual-track` 只驗配對登記、不執行 SQL，因此它通過不足以證明 migration 正確。

**衍生發現（保留備查）**：`0000_rich_mulholland_black.sql:1013` 與 `0017_group_ordering_system.sql:6` 皆以無保護的 `CREATE TABLE` 建立 `group_orders`，且形狀互不相容（0000：`restaurant_id integer` / `expires_at integer` / real 金額；0017：`restaurant_id INTEGER` / `expires_at DATETIME` / DECIMAL 金額）。legacy 軌無法從頭完整套用，因此該軌 `group_orders` 的真實形狀屬未定狀態 — 這是「不要靠推測補欄位清單」的直接理由。

**採用的處置**：刪除 0097，將 0080 登記為 `freshOnly`。前例為 `0065_service_booking_employee_overlap_guard.sql`（同型理由：legacy 軌不承載該表）。若日後確認 legacy 軌確實有 `group_orders` 在服役，必須先查詢 production management D1 的真實形狀再補 migration，不得由檔案推導。

**驗證**：`pnpm check:migration-dual-track` → passed (80 fresh, 76 legacy migrations)。

## 稽核方獨立驗證通過的重點

- **fresh 軌 live 驗證**（直讀 `sqlite_master`）：`created_by` 已 nullable、`recovery_code` NOT NULL，6 個 index + 2 個 trigger 全數還原 → B-3 / B-7 達標。
- **G-1 關閉**：`moduleGate` 與 `quotaGate` 皆加入 `resolveGuestRestaurantId`，且 async fallback 有正確 await。含「匿名 + fallback 時硬上限仍會擋」的測試。
- **G-2 關閉**：全部變更落在單一 commit，不存在 Task 2 → Task 4 的中間損壞視窗（比原訂的 (a) 方案更嚴格）。
- **G-3 關閉**：以 `c.req.raw.clone().json()` 解決，並有兩條測試證明 (i) 下游 `validateBody` 仍讀得到 body、(ii) 空／非 JSON body 回 400 而非 500。
- **C-3**：`GroupOrdersService.test.ts:514` `expect(cached).not.toHaveProperty("recoveryCode")` — 實際斷言 cache payload，非僅檢視程式碼。
- **C-7**：schema 移除 `expirationHours` / `maxMembers` 的預設值，`validation.test.ts` 同步更新為「不套用 service-owned defaults」。
- **D-9**（稽核額外要求）：`recoverHost` 的 where 條件含 `status = 'active'` 與 `expiresAt >= now`，已完成／已取消／已過期的團購單無法復原。
- **D-6**：預覽端點套 `publicRateLimit`，復原端點套 `strictRateLimit`，皆有 route 測試。

## 未阻斷、留待後續處理

1. **commit 粒度**：`e7c752da` 單一 commit 涵蓋 17 個檔案。A-6 / D-16 要求分階段原子 commit，亦為本 repo 常規。不影響正確性，但影響 bisect 能力。
2. **`previewGroupByShareCode` 無 try/catch**，為 `GroupOrdersService.ts` 中唯一無錯誤處理的方法；DB 例外會成為未格式化的 500。
3. **plan 文件未進版控**：本目錄五份 `.md` 皆為 untracked。

---

# Plan B / C / D 評估（2026-08-04）

**引用準確度高**，抽查的承重點全部屬實：`packages/database/src/services/order.ts:380` `OrderService.createOrder`、`db.batch`（line 622）、`CLIENT_MUTATION_DUPLICATE`（line 660）、`orders_client_mutation_unique` index、guest-orders catch pattern（`routes/index.ts:170-185`）。`orders.deliveryInfo.type` 確為 `"dine_in" | "takeaway" | "delivery"`，無 `"pickup"` — Plan C 選擇在 finalize 邊界做映射而非改名，判斷正確。

Plan B 的 grounding 較口頭摘要更精確：明載 create/join/detail 三個 URL 本就正確，錯誤者為 `/group-orders/:id/cart`（~line 397）與 `/group-orders/:id/submit`（~line 514）。

## 需處理的四點

1. ~~**`recoveryCode` 在 B/C/D 全無消費者。**~~ **已於 2026-08-05 補入 Plan B Task 4。** 原始發現：grep 三份 plan，`recoveryCode` 僅出現於測試 fixture，`/recover` 端點無任何前端 plan 呼叫；前端不儲存創建時回傳的 code，使用者亦無輸入入口，Phase A 的主辦人復原機制實為死碼。此為三份 plan 最實質的覆蓋缺口。

   補入內容涵蓋：`utils/groupOrderHost.ts` 憑證持久化（比照既有的 `utils/marketCheckouts.ts` guest-token 慣例）、`createGroup` 不再丟棄 `recoveryCode`、重新整理時由 storage 回填 `sessionToken`（此路徑才是日常情境，復原是例外情境）、`recoverHost()` 與 `HostRecoveryPanel.vue`、以及「`recoveryCode` 不得進入分享連結／URL／QR／log」的硬性約束與對應測試。

   實作時額外注意兩點：(a) `/recover` 的 `strictRateLimit` 是 15 分鐘 5 次，配上 36 字元 UUID 手動輸入極易鎖死，Plan B 已要求 429 與 400 分開提示，但根本解（較短的可輸入碼，或給該端點單獨的限制值）屬 Phase A 的 schema／設定決策，已列為 Plan B 的 open question，不在 Phase B 內逕行更動；(b) 復原成功後舊裝置的 `memberToken` 會失效，Tasks 1-3 沒有處理 token 失效的狀態，Plan B Task 4 Step 7 的雙情境煙霧測試第 5 步就是為了逼出這個缺口。

2. ~~**Plan B 單獨上線會形成死路。**~~ **已於 2026-08-05 決議並寫入 B/C 兩份 plan 的「Release binding」章節。** 原始發現：B Task 1 Step 3 將 `submitOrder` 留為拋錯 stub，實際接線在 C Task 5；B 若先上 production，使用者可建立群組與購物車但無法送出。

   決議：**綁定發布，但綁定範圍縮小到前端**。評估時確認 customer-app 無 feature flag 機制、router 亦無條件式路由前例，為此新造一套 flag 基礎設施不划算，故採整合分支。Phase C 的 Task 1-4 是純後端，一個沒有呼叫方的端點是惰性的，可獨立先行合併並部署；真正會造成死路的組合只有「customer-app 帶著 B 但沒有 C Task 5」。

   | 範圍 | 發布方式 |
   | --- | --- |
   | C Task 1-4（API：finalize service、`/lock`、expiry cron） | 獨立先行，正常部署 |
   | B Task 1-4 + C Task 5（customer-app） | 同一整合分支、單次合併、單次 Pages 部署 |

   附帶結論：C Task 4 的 cron 會在任何使用者能碰到團購單之前就已上線。這是安全的（沒有團購單可掃），但代表它的第一次真實運作發生在 B+C-Task-5 那次發布，監控重點應放在該次發布而非引入 cron 的 API 部署。

3. **建議延後 Plan D。** 278 行（B/C 為 699/853）。其自陳 `"proportional"` 在現有輸入下與 `"individual"` 產生相同數字，因系統尚無「共同分攤的固定費用」。D Task 1 將交付一個無可觀察行為差異的分支，難以有意義地測試或驗證正確性。Phase A 剛上線 `fulfillmentType: "delivery"` + `deliveryAddress`，外送費是自然的下一步，且應排在 Plan D **之前**。

4. **Plan C Task 4（cron 自動送出）為全套風險最高處** — 排程作業會產生真實金額的訂單。需確認對 cron 執行重疊有防重複保護（若以群組 id 作為 `clientMutationId` 即具備），並建議將此寫成該 Task 的明確驗收條件。

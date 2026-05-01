# Plan: P1 — 候位後端缺口修復

|  |  |
| --- | --- |
| **狀態** | Draft (pending review) |
| **建立日期** | 2026-05-01 |
| **對應 Spec** | `docs/specs/queue-and-waiting-list.md` |
| **範圍** | G1（SSE 廣播）、G3（lookup）、G4（冪等 join）、G5（confirm phone gate）、G6（state machine 守衛） |
| **不在範圍** | G2（customer-app）→ P3、G7（moduleGate）→ P2、SMS、`/queue` 路由收回（P4b） |
| **預估 PR 數** | 1 個 PR（含 7 個任務 + 2 個 checkpoint） |

---

## 1. 依賴圖（Dependency Graph）

```
   ┌────────────────────────────────────────┐
   │  T0: SSE 基礎設施 spike  ✅ 已完成     │
   │     結論：方案 A（見 §4）              │
   └────────────────┬───────────────────────┘
                    │
              [Checkpoint 1] ✅ 通過
                    │
   ┌────────────────▼─────────────────────────────────┐
   │  T1a: 搬 RealtimeBroadcastService 到             │
   │       packages/database（含 import path 更新）   │
   │  T1b: 建 ticket-primitives/state-machine.ts      │
   │  T1c: 加 apps/api/wrangler.toml 的 DO binding    │
   │       （三者可平行，但合在一個 commit 提交）     │
   └────────┬─────────────────────────┬───────────────┘
            │                         │
            ▼                         ▼
   ┌──────────────────┐  ┌────────────────────────────┐
   │ T2 (G6): 狀態機  │  │ T3 (G1): broadcastEvent     │
   │ 守衛 (依 T1b)    │  │ 接 service 出口 (依 T1a/T1c)│
   └──────────────────┘  └────────────────────────────┘

   獨立任務（與 T0-T3 平行可做）：
   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
   │ T4 (G4): 冪等 join│  │ T5 (G3): lookup  │  │ T6 (G5): confirm │
   │                  │  │ endpoint         │  │ phone gate       │
   └──────────────────┘  └──────────────────┘  └──────────────────┘

           T2-T6 全部完成 ──[Checkpoint 2]──▶ T7：整合測試
```

**Vertical slicing 設計**：每個 Tn 是一個完整垂直切片（service + route + test），不是「先做所有 service、再做所有 route」。例外是 T0/T1：T0 是研究、T1 是被多個切片共用的 infrastructure，必須前置。

**平行性**：T4/T5/T6 不依賴 primitives，可在 T0 進行時就動工。實際執行可考慮：

- 一人推 T0 → T1 → T2/T3
- 同時間另一人（或同一人之後）推 T4/T5/T6
- 全部完成後合 T7

但因 P1 是單一 PR，最終仍需在一個 branch 上整合。

---

## 2. Checkpoints

| # | 觸發條件 | 必須做的決策 / 確認 | 狀態 |
| --- | --- | --- | --- |
| **CP1** | T0 完成 | user 確認 G1 改造方案；架構決策定下；T1a/T1b/T1c+T3 才能動工 | ✅ **2026-05-01 通過**（user 採方案 A + Q2(iii)） |
| **CP2** | T2-T6 完成 | code review + self-review；確認 5 個缺口都通過 acceptance criteria；才能進 T7 整合測試 | ⏳ |
| **CP3** | T7 完成 | P1 ready for PR；user review 整體 diff | ⏳ |

---

## 3. 任務細節

### T0｜SSE 基礎設施 spike ✅ 已完成（2026-05-01）

> **結論摘要：** 既有 SSE feature 架構錯誤；`apps/realtime` DO 架構正確但 `apps/api/wrangler.toml` 沒 binding；採方案 A（搬 RealtimeBroadcastService 到 packages/database + 加 DO binding + 廣播 room 用 `admin:${id}`）。**完整論述見 §4。**

**問題陳述：** G1 spec 寫「不再用 HTTP self-call」，但既有 `apps/api/src/features/sse/services/SSEService.ts:18` 用 in-memory `Map<connectionId, connection>` 存連線。Cloudflare Workers 是無狀態多實例的，**廣播 Worker 與連線 Worker 可能不同實例**——HTTP self-call 也無法保證打到同一個 Map。並列存在的 `apps/realtime`（Durable Object 架構）才有正確的 stateful 廣播能力。動 G1 之前必須先確定真正的廣播通道。

**讀的東西：**

- `apps/api/src/features/sse/`（整個目錄）
- `apps/realtime/src/`（DO 架構）— 重點看 `advanced-realtime-session.ts`、`durableObjects/`
- `apps/admin-dashboard/src/composables/useStatisticsSSE.ts`、`useRealtimeOrderStatus.ts`（前端到底訂哪個）
- `apps/api/wrangler.toml`、`apps/realtime/wrangler.toml`（bindings）
- 既有 group-orders、queue routes 的 self-call 是否真的在 production 有效（讀 wrangler tail logs / tests）

**要回答的三個問題：**

1. 既有 SSE feature（in-memory Map）在 production 是否真的能廣播到客戶？還是其實是已知壞掉只是還沒人修？
2. `apps/realtime` 是否提供可被 API Worker 呼叫的廣播介面（service binding 或 DO RPC）？admin-dashboard 哪些頁面用它？
3. P1 的 G1 改造，正確做法是 (a) 接 apps/realtime DO、(b) 修現有 SSE feature 變成 DO-backed、(c) 接受現狀繼續用 HTTP self-call 但加技術債 ticket、(d) 其他？

**輸出：**

- 在本檔案的「§4 T0 spike 結論」段落補上一段 ≤300 字的決策紀要
- 列出 T1 `sse-broadcast.ts` 的具體 function signature

**驗收條件：**

- [ ] 三個問題都有明確答案（不是「可能」「應該」）
- [ ] T1 的介面 signature 寫死
- [ ] User 在 CP1 確認方案

**不做：** 任何程式變更。純粹研究 + 文件更新。

---

### T1a｜搬 `RealtimeBroadcastService` 到 `packages/database`

**前置：** T0 完成、CP1 通過

**修改檔案：**

- 新增 `packages/database/src/services/RealtimeBroadcastService.ts`（內容沿用 `apps/api/src/services/RealtimeBroadcastService.ts`，做兩處微調）：
  - `import type { Env } from "../shared/types"` → 改為內部宣告 `interface BroadcastEnv { REALTIME_SESSION?: DurableObjectNamespace }`
  - `import { ConsoleLogger } from "../core/monitoring"` → 移除，改用 `console.warn` / `console.error`（primitives 層不依賴 apps logger）
- 修改 `packages/database/src/services/index.ts`：re-export `RealtimeBroadcastService`、`BroadcastResult` 等
- 確認 `packages/database/package.json` 已依賴 `@makanmakan/shared-types`（應已存在，因 `WaitingListService` 已用）
- 刪除 `apps/api/src/services/RealtimeBroadcastService.ts`
- 更新所有 `apps/api/src/...` import path：
  - `OrdersService.ts`、`KitchenService.ts`：`from "../../../services/RealtimeBroadcastService"` → `from "@makanmakan/database"`
  - 6 個測試檔案的 import 同步更新（`apps/api/src/__tests__/security/business-logic-security.test.ts`、`features/orders/__tests__/*.test.ts` 共 5 檔、`services/__tests__/RealtimeBroadcastService.test.ts`）
- 把 `services/__tests__/RealtimeBroadcastService.test.ts` 一併搬到 `packages/database/src/services/__tests__/`
- `apps/api/src/services/__tests__/broadcast.test.ts` 中對 `RealtimeBroadcastService` 的依賴更新

**驗收條件：**

- [ ] `pnpm --filter @makanmakan/database typecheck` 全綠
- [ ] `pnpm --filter @makanmakan/api typecheck` 全綠
- [ ] `pnpm --filter @makanmakan/database test RealtimeBroadcast` 既有測試全綠（搬遷不改行為）
- [ ] `apps/api/src` 下 grep 無剩餘 `from "../services/RealtimeBroadcastService"` 或類似舊路徑
- [ ] 可選：在 `RealtimeEvent` union type 新增 `waiting_list_*` 事件類型（也可延到 T3，但建議在這裡一起加，避免 T3 還要回 packages/shared-types）

**驗證指令：**

```bash
pnpm --filter @makanmakan/database typecheck
pnpm --filter @makanmakan/api typecheck
pnpm --filter @makanmakan/database test
pnpm --filter @makanmakan/api test
rg "services/RealtimeBroadcastService" apps/  # 預期 0 命中（除了已刪檔案）
```

---

### T1b｜建 `ticket-primitives/state-machine.ts`

**前置：** 無（可與 T1a 平行）

**修改檔案：**

- 新增 `packages/database/src/services/ticket-primitives/index.ts`
- 新增 `packages/database/src/services/ticket-primitives/state-machine.ts`
- 新增 `packages/database/src/services/ticket-primitives/__tests__/state-machine.test.ts`
- 修改 `packages/database/src/services/index.ts`：re-export

**設計：**

```ts
import { ApiError } from "..."; // 看 packages/database 既有錯誤型別位置
import type { WaitingStatus } from "@makanmakan/shared-types";

export const WAITING_TRANSITIONS = {
  waiting: ["called", "cancelled", "expired"],
  called: ["confirmed", "cancelled", "expired"],
  confirmed: ["seated", "cancelled", "expired"],
  seated: [],
  cancelled: [],
  expired: [],
} as const satisfies Record<WaitingStatus, readonly WaitingStatus[]>;

export function assertWaitingTransition(
  from: WaitingStatus,
  to: WaitingStatus,
): void {
  const allowed = WAITING_TRANSITIONS[from];
  if (!allowed.includes(to as never)) {
    throw new ApiError(
      "INVALID_STATUS_TRANSITION",
      `Cannot transition from "${from}" to "${to}"`,
      409,
    );
  }
}
```

**注意：** `WAITING_STATUS` 既有 enum 包含 `no_show`（`schema/waiting-list.ts:16`），但 service 從未 set 過此狀態。確認後決定：(a) 加進轉移表當 terminal、(b) 從 enum 移除（**out of scope**）。本 P1 採 (a)：加 `no_show: []` 進 transitions。

**驗收條件：**

- [ ] 6 個 from-state × 各自 allowed 路徑全 pass
- [ ] 非法跳轉測試（至少 5 個）：`seated → called`、`cancelled → seated`、`waiting → seated`（跳 call/confirm）、`expired → 任何`、`no_show → 任何`
- [ ] `pnpm --filter @makanmakan/database typecheck` 全綠
- [ ] `pnpm --filter @makanmakan/database test ticket-primitives` 全綠

---

### T1c｜加 `apps/api/wrangler.toml` 的 DO binding

**前置：** 無（可與 T1a/T1b 平行）

**修改檔案：** 只動 `apps/api/wrangler.toml`

**修改內容：** 在 `[env.development]`、`[env.staging]`、`[env.production]` 三個 env 區塊各加：

```toml
[[env.development.durable_objects.bindings]]
name = "REALTIME_SESSION"
class_name = "RealtimeSession"
script_name = "makanmasak-realtime"  # 注意：dev 用 dev name，staging/prod 用對應的
```

正確的 `script_name` 對照：

- dev：`makanmasak-realtime`（同 root namespace）— 但 dev 環境下兩個 worker 跑在不同 wrangler 進程，cross-worker DO 在 dev 需要 `wrangler dev --remote` 或 service binding fallback；T1c 動工時要驗 dev 體驗
- staging：`makanmasak-realtime-staging`
- production：`makanmasak-realtime-prod`

**也要動的（外加 binding）：** dev 區塊的 `[vars]` 也要更新——目前 root level `[vars]` 有定義 `REALTIME_WS_URL = "ws://localhost:8788"` 但 `[env.development.vars]` 才是 `pnpm dev` 實際讀取的。確認雙處同步。

**驗收條件：**

- [ ] `pnpm wrangler deploy --dry-run --env development` 不報 binding 錯
- [ ] `pnpm wrangler deploy --dry-run --env staging` 不報錯
- [ ] `pnpm dev:api` 啟動成功（dev 環境下 cross-worker DO binding 可能需要先 `pnpm dev:realtime` 跑起來）
- [ ] 啟動後手動驗：在程式裡加暫時 `console.log(env.REALTIME_SESSION)` 看是否非 undefined（記得拿掉）
- [ ] **副作用驗證**：執行 `pnpm test apps/api orders` 確認 OrdersService 既有測試（mock REALTIME_SESSION）仍全綠

**已知風險：** dev 環境下 cross-worker DO 設定相對複雜。若 dev 體驗不佳，可在文件補充「先跑 `pnpm dev:realtime`，再跑 `pnpm dev:api`」的順序要求。production / staging 不受影響。

---

### T2｜G6: 狀態機強制守衛（vertical slice）

**前置：** T1b 完成

**修改檔案：**

- `packages/database/src/services/WaitingListService.ts`：5 個狀態變更方法入口加 `assertWaitingTransition()` 守衛
  - `callWaiting(id, request)` → assert(current, 'called')
  - `confirmWaiting(id)` → assert(current, 'confirmed')
  - `markSeated(id)` → assert(current, 'seated')
  - `cancelWaiting(id)` → assert(current, 'cancelled')
  - `expireWaiting(id)` → assert(current, 'expired')
- `packages/database/src/__tests__/WaitingListService.test.ts`（或 service 測試所在的檔案）

**驗收條件：**

- [ ] 對 `seated` 票呼叫 `callWaiting()` → 丟 409 `INVALID_STATUS_TRANSITION`
- [ ] 對 `cancelled` 票呼叫任何狀態變更 → 丟 409
- [ ] 對 `waiting` 票直接呼叫 `markSeated()`（跳過 call/confirm）→ 丟 409
- [ ] `waiting → called → confirmed → seated` 完整路徑全 pass
- [ ] `waiting → cancelled` / `called → expired` 等合法捷徑全 pass
- [ ] **既有測試不 regress**（特別注意 batch-call 流程）

**驗證指令：**

```bash
pnpm --filter @makanmakan/database test WaitingListService
```

**已知風險：**

- 既有自動化（如 cron 標 expired）可能對已 seated 的票誤呼叫 `expireWaiting`。Spike 應檢查 service 是否有 cron caller，若有則確認合法轉移表是否需要保留 `seated → expired` 的可能（**目前 spec 設計是不允許**，因為 seated 是 terminal）。若 cron 真會碰，需要先把 cron 改成 idempotent skip 而非依賴 service 接受。

---

### T3｜G1: 廣播接 service 出口（vertical slice）

**前置：** T1a + T1c 完成

**修改檔案：**

- `packages/database/src/services/WaitingListService.ts`：6 個狀態變更出口直接用 `RealtimeBroadcastService.broadcastEvent('admin', restaurantId, event)`
  - `joinWaitingList` → `waiting_list_joined`
  - `callWaiting` → `waiting_list_called`
  - `confirmWaiting` → `waiting_list_confirmed`
  - `markSeated` → `waiting_list_seated`
  - `cancelWaiting` → `waiting_list_cancelled`
  - `expireWaiting` → `waiting_list_expired`
- 廣播事件格式：
  ```ts
  {
    type: 'waiting_list_*',
    eventId: broadcaster.generateEventId(),
    timestamp: Date.now(),
    restaurantId,
    payload: { entryId, queueDisplay, status, partiesAhead?, tableId?, customerName? }
  }
  ```
- `packages/shared-types/src/...`：`RealtimeEvent` union 新增 `WaitingListEvent` 變體（若 T1a 未做就在此處做）

**廣播 room 命名：** **`admin:${restaurantId}`**（不是 `restaurant:`）。理由：admin-dashboard 既有 `useRealtimeOrderStatus.ts:45` 已連 `${VITE_REALTIME_WS_URL}/admin/${restaurantId}` → DO room `admin:${id}`，這是真正有 connection 的 room。OrdersService 用 `restaurant:` 是既有 bug（INC-002），P1 不動。

**驗收條件：**

- [ ] 透過 `POST /api/v1/waiting-list` 加入 → 監聽 `admin:${id}` room 的 mock 廣播器收到 `waiting_list_joined`
- [ ] 員工 `POST /:id/call` → mock 收到 `waiting_list_called`
- [ ] 廣播失敗（mock 拋例外或 `success: false`）→ 主流程仍 200，DB 仍寫入
- [ ] 新增程式 grep 0 命中 `${env.API_BASE_URL}/api/v1/sse/broadcast/`
- [ ] 既有 `apps/api/src/features/queue/routes/index.ts` 的 `broadcastQueueUpdate` **保持不動**（P4b 才動）

**驗證指令：**

```bash
pnpm --filter @makanmakan/database test WaitingListService
pnpm --filter @makanmakan/api test waiting-list
```

**手動驗證：**

```bash
# Terminal 1
pnpm dev:realtime
# Terminal 2
pnpm dev:api
# 連 admin-dashboard，登入後 useRealtimeOrderStatus 會連到 /admin/:restaurantId
# curl POST /api/v1/waiting-list 一筆
# 在 admin-dashboard onmessage handler 加暫時 console.log，確認收到 waiting_list_joined
```

---

### T4｜G4: 冪等 join（vertical slice）

**前置：** 無（可與 T0/T1 平行）

**修改檔案：**

- `packages/shared-types/src/...`（找實際路徑）：`WaitingListResponse` 介面新增 optional `alreadyJoined?: boolean`
- `packages/database/src/services/WaitingListService.ts:153-163`：`existingEntry` 路徑改為回傳現有 entry + `alreadyJoined: true`，不再 throw
- 對應測試

**修改邏輯：**

```ts
// Before
if (existingEntry) {
  throw new Error("您已在候位列表中");
}

// After
if (existingEntry) {
  const existing = await this.getWaitingListEntryById(existingEntry.id);
  if (!existing) {
    // existed in dedup query but not findable — race condition, treat as new
  } else {
    return { ...existing, alreadyJoined: true };
  }
}
```

**驗收條件：**

- [ ] 同手機同餐廳當日 POST 兩次 → 第二次 200，payload 含 `alreadyJoined: true` + 完整票資料（含 `partiesAhead`）
- [ ] 同手機跨日 → 視為新票（200，無 `alreadyJoined`）
- [ ] 同手機已 cancelled / seated / expired → 視為新票
- [ ] 不同餐廳同手機 → 視為新票（既有行為）
- [ ] `apps/admin-dashboard/src/views/seating/WaitingListTab.vue:895` 的 `addToQueue` 流程仍正常（前端 manual check：當服務員手動加同手機時，前端應顯示「已存在」狀態而非錯誤）

**驗證指令：**

```bash
pnpm --filter @makanmakan/database test WaitingListService
pnpm --filter @makanmakan/shared-types typecheck
pnpm --filter admin-dashboard typecheck
```

**已知風險：**

- 前端 `WaitingListTab.vue:addToQueue` 目前在成功時呼叫 `toast.success(t('waitingList.addSuccess'))`。若 G4 後回傳 alreadyJoined，前端會誤顯示「新增成功」而非「已存在」。**T4 範圍只動後端，不動前端**——但要在 PR 描述標記 follow-up：admin-dashboard 應檢查 `alreadyJoined` 顯示對應 toast。這個 follow-up 算 P3 或單獨 small PR。

---

### T5｜G3: lookup endpoint（vertical slice）

**前置：** 無

**修改檔案：**

- `packages/database/src/services/WaitingListService.ts`：新增 `findActiveTicketByPhone(restaurantId, phone): Promise<WaitingListResponse | null>` 方法
- `apps/api/src/features/waiting-list/routes/index.ts`：新增 `GET /lookup` route handler（**插在公開路由區，`app.use("/*", authMiddleware)` 之前**）
- 對應 service test + route test

**Service 邏輯：**

```ts
async findActiveTicketByPhone(restaurantId: string, phone: string) {
  const row = await this.db.get<WaitingListDbRow>(sql`
    SELECT * FROM waiting_list
    WHERE restaurant_id = ${restaurantId}
      AND customer_phone = ${phone}
      AND status IN ('waiting', 'called', 'confirmed')
      AND DATE(created_at / 1000, 'unixepoch', 'localtime') = DATE('now', 'localtime')
    LIMIT 1
  `);
  if (!row) return null;
  const partiesAhead = await this.getPartiesAhead(/* ... */);
  return this.formatWaitingListResponse(row, partiesAhead);
}
```

**Route 行為：**

- 缺 `restaurantId` 或 `phone` query → 400
- phone 格式錯誤（`!/^09\d{8}$/`，剝除 `-`/空白後）→ 400
- 找不到 → 404 + `code: 'NO_ACTIVE_TICKET'`
- 找到 → 200 + `{ success: true, data: <WaitingListResponse> }`

**驗收條件：**

- [ ] 提供有效手機（active 票）→ 200 + 完整 entry（含 `partiesAhead`、`queueDisplay`）
- [ ] 當日已 cancelled / expired / seated 的手機 → 404 `NO_ACTIVE_TICKET`
- [ ] phone 格式錯誤 → 400
- [ ] 缺 query 參數 → 400
- [ ] 跨餐廳隔離正確（A 餐廳查 B 餐廳手機 → 404）

**驗證指令：**

```bash
pnpm --filter @makanmakan/database test WaitingListService
pnpm --filter @makanmakan/api test waiting-list
```

---

### T6｜G5: confirm 端點 phone gate（vertical slice）

**前置：** 無

**修改檔案：**

- `apps/api/src/features/waiting-list/routes/index.ts:161-173` 的 `POST /:id/confirm` handler
- 對應 route test

**修改邏輯：**

```ts
app.post("/:id/confirm", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing id parameter", "MISSING_PARAM");
  const { customerPhone } = await c.req.json<{ customerPhone?: string }>();
  if (!customerPhone) throw badRequest("需要提供電話號碼");

  const service = new WaitingListService(c.env.DB, c.env);
  const entry = await service.getWaitingListEntryById(id);
  if (!entry) throw notFound("找不到此候位記錄");
  if (entry.customerPhone !== customerPhone) {
    throw forbidden("電話號碼不符", "PHONE_MISMATCH");
  }

  const confirmed = await service.confirmWaiting(id);
  return c.json({
    success: true,
    data: confirmed,
    message: "已確認，請盡快入座",
  });
});
```

**驗收條件：**

- [ ] confirm 缺 `customerPhone` body → 400
- [ ] confirm phone 不符 → 403 `PHONE_MISMATCH`
- [ ] confirm phone 正確 + entry 存在 + status 合法 → 200（沿用既有行為）
- [ ] 不存在的 id → 404
- [ ] 與 G6 (T2) 整合：對 `seated` 票 confirm → 409（state machine guard 接管）

**驗證指令：**

```bash
pnpm --filter @makanmakan/api test waiting-list
```

**Phone 比對策略：** 沿用 cancel handler 的既有比對方式（直接 string equality）。**不**做格式 normalize（剝 `-`/空白）——避免引入新的歧義。如果客戶端傳的 phone 與 DB 不匹配，視為驗證失敗。

---

### T7｜整合測試 + 整體驗證

**前置：** T2, T3, T4, T5, T6 全部完成、CP2 通過

**修改檔案：**

- `apps/api/src/features/waiting-list/__tests__/routes.test.ts`（已有）：補完整生命週期 integration test
- 必要時加 `__tests__/integration/waiting-list.real.integration.test.ts`（依現有 `discovery.real.integration.test.ts` 模式）

**測試案例：**

1. **完整 happy path：** join → call → confirm → seat（含 phone 驗證、SSE 廣播 mock 驗證）
2. **取消路徑：** join → cancel
3. **過期路徑：** join → call → expire
4. **G4 冪等：** 同手機 join 兩次
5. **G3 lookup：** join → 關閉 ticketId → lookup by phone → seat
6. **G5 phone gate：** confirm 缺 phone → 400；confirm 錯 phone → 403
7. **G6 違法轉移：** seat 一張 waiting 票 → 409；call 一張 cancelled 票 → 409

**驗收條件：**

- [ ] 上述 7 個案例全綠
- [ ] `pnpm typecheck`（整個 monorepo）全綠
- [ ] `pnpm lint` 全綠
- [ ] `pnpm test`（整個 monorepo）全綠
- [ ] `pnpm --filter @makanmakan/api test waiting-list` 覆蓋率不低於修改前
- [ ] 手動 wrangler dev 走完完整流程一次（curl 紀錄附在 PR 描述）

**驗證指令：**

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter @makanmakan/api test:coverage waiting-list
```

---

## 4. T0 spike 結論（2026-05-01 完成）

### 4.1 三個必答問題

**Q1：既有 SSE feature 在 production 是否能跨 Worker 實例廣播？** **答：不能。** `apps/api/src/features/sse/services/SSEService.ts:18` 用 in-memory `Map<connectionId, connection>` 存連線。Cloudflare Workers 多實例下，廣播 Worker 與連線 Worker 不同。HTTP self-call (`fetch(${API_BASE_URL}/api/v1/sse/broadcast/...)`) 在多實例下也無解（fetch 隨機落到任一 Worker，連線 Map 不在那個 Worker 上）。dev 看似正常只是因為單實例。**這個既有 SSE feature 主要服務 group-orders，不在 P1 範圍。**

**Q2：`apps/realtime` 是否有可被 API Worker 呼叫的廣播 API？** **答：架構正確、binding 缺失。**

- `apps/realtime` 是獨立 worker，導出 `RealtimeSession` Durable Object class（`apps/realtime/src/index.ts:6`）
- 每個 `${roomType}:${roomId}` 透過 `idFromName(...)` 對應全域唯一 DO instance（正確的 stateful broadcast 設計）
- DO 接受 `POST .../broadcast` 廣播給 instance 內所有 WebSocket 連線（`apps/realtime/src/durableObjects/RealtimeSession.ts:317-355`）
- `apps/api/src/services/RealtimeBroadcastService.ts` 已有正確的 wrapper 介面，OrdersService/KitchenService 在用
- **但是**：`apps/api/wrangler.toml` 缺 `[[durable_objects]]` binding 指向 `RealtimeSession`。`env.ts:91` 宣告了 `REALTIME_SESSION: DurableObjectNamespace` 但 wrangler 沒對應綁定。`RealtimeBroadcastService.ts:46-53` 的防禦性 `if (!this.env.REALTIME_SESSION) return success: true, recipientCount: 0` 讓**所有 production 訂單與廚房 realtime 廣播都靜默失敗**，6+ 個月沒人發現
- 此外：admin-dashboard 連 `/admin/${restaurantId}` (DO room `admin:${id}`)，但 `RealtimeBroadcastService.broadcastNewOrder` 廣播到 `restaurant:${id}` ——**room 不對**

**Q3：G1 改造採用的方案？** **答：方案 A（接 realtime DO，搬 RealtimeBroadcastService 到 packages/database，廣播 room 用 `admin:${restaurantId}`）**

完整決策：

- **架構決策 1**：把 `RealtimeBroadcastService.ts` 從 `apps/api/src/services/` **搬到** `packages/database/src/services/RealtimeBroadcastService.ts`。理由：該 class 唯二的 apps/api 依賴是 `Env` type 與 `ConsoleLogger`，前者可重新定義為最小介面，後者可換成 `console.*`。搬動後 `WaitingListService` 直接 import 使用，不需透過 ticket-primitives 中介層
- **架構決策 2**：`ticket-primitives` 不含 `sse-broadcast.ts`。primitives 限定為「純函式工具」。Broadcast 是 service，由 service 直接呼叫
- **架構決策 3**：waiting-list 廣播 room 用 `admin:${restaurantId}`，admin-dashboard 既有的 `useRealtimeOrderStatus` WebSocket 連線立刻可收到
- **架構決策 4**：加 `apps/api/wrangler.toml` 的 DO binding（必做，否則 `REALTIME_SESSION` 仍是 undefined，G1 也會靜默失敗）
- **明確不做**：OrdersService 廣播 room 從 `restaurant:` 改為 `admin:` 的修復——這是獨立 bug，獨立 PR 處理（見 `tasks/incidents/INC-002-realtime-room-mismatch.md`）

### 4.2 `broadcastTicketEvent` 不需要存在

依架構決策 2，`WaitingListService` 直接呼叫 `RealtimeBroadcastService.broadcastEvent('admin', restaurantId, event)`：

```ts
// 在 WaitingListService 各狀態變更出口：
const broadcaster = new RealtimeBroadcastService(this.env);
await broadcaster.broadcastEvent("admin", this.restaurantId, {
  type: "waiting_list_joined",
  eventId: broadcaster.generateEventId(),
  timestamp: Date.now(),
  restaurantId: this.restaurantId,
  payload: {
    entryId: entry.id,
    queueDisplay: entry.queueDisplay,
    status: entry.status,
    partiesAhead: entry.partiesAhead,
    customerName: entry.customerName,
  },
});
```

`broadcastEvent` 自帶失敗 swallow（`RealtimeBroadcastService.ts:107-118` 已 `try/catch + return error`），不需另包一層。

> **注意：** `RealtimeEvent` type 目前在 `@makanmakan/shared-types`，T1a 搬遷時需確認該 union type 是否需要新增 `waiting_list_*` 變體。預期需要——P1 內處理。

---

## 5. 風險登記簿

| 風險 | 影響 | 機率 | 緩解 |
| --- | --- | --- | --- |
| ~~**R-P1-1**：SSE 既有架構在 production 已壞~~ | ~~T1+T3 變大 2-3 倍工~~ | ~~高~~ | ✅ T0 已確認既有 SSE feature 確實壞，但 P1 採方案 A 接 realtime DO，不修 SSE feature。風險解決 |
| **R-P1-2**：state machine 守衛擋到既有 cron / 自動化 | 既有自動化故障 | 中 | T2 動工前 grep `expireWaiting` / `cancelWaiting` 的 caller，列出來逐個確認 |
| **R-P1-3**：G4 冪等回傳讓前端誤顯示「新增成功」 | UX 退化 | 中 | T4 不動前端，但 PR 描述強制標 follow-up（admin-dashboard 應檢查 `alreadyJoined`） |
| **R-P1-4**：T5 lookup 端點變成隱私風險（手機列舉） | 安全 | 低 | 公開端點僅回單筆 active 票（不洩漏終態票），找不到 404 不洩漏其他資訊；可加 rate limit（沿用既有 middleware） |
| **R-P1-5**：integration test fixture 無法產生 active WebSocket 連線，G1 廣播驗證只能用 mock | 信心不足 | 中 | 用 mock `RealtimeBroadcastService`（spy on `broadcastEvent`）驗證呼叫；真連線驗證留給 manual test |
| **R-P1-6**（T0 浮現）：T1c 加 DO binding 後，OrdersService/KitchenService 廣播從「靜默 no-op」變成「廣播到無人 room（`restaurant:`）」 | 對使用者無新影響（一樣收不到），但會多消耗 DO 調用次數（成本可忽略） | 已知 | 已驗證使用者體驗不變。OrdersService 的 room name 修復走獨立 PR（INC-002） |
| **R-P1-7**（T0 浮現）：dev 環境下 cross-worker DO binding 體驗可能不順 | dev 流程小幅變動 | 中 | T1c 動工時若 dev 體驗不佳，文件補充「先 `pnpm dev:realtime` 再 `pnpm dev:api`」的順序要求；production / staging 不受影響 |

---

## 6. 完工門檻（P1 PR ready 條件）

- [ ] T0-T7 所有 acceptance criteria 全綠
- [ ] CP1, CP2, CP3 都通過
- [ ] PR 描述包含：
  - [ ] 五個缺口的 before/after 行為對照
  - [ ] T0 spike 結論摘要
  - [ ] 手動驗證的 curl log
  - [ ] 已知 follow-up（如 R-P1-3）
  - [ ] 連結到 spec `docs/specs/queue-and-waiting-list.md`
- [ ] 所有變更檔案均無 `as any`、無 `// @ts-ignore`、無 `console.log` 留底（符合既有 strict 規範）

---

## 7. 不在 P1 範圍（明確排除）

| 項目 | 屬於 |
| --- | --- |
| customer-app 自助取號頁 | P3 (G2) |
| moduleGate 從 reservations 拆出 | P2 (G7) |
| Twilio SMS 通知 | spec §6 永久排除 |
| `/api/v1/queue` 路由收回與重寫 | P4b |
| ticket-primitives 中 `phone-validator.ts` / `today-window.ts` | P4a（P1 不需要） |
| 其他 features 的 SSE HTTP self-call 清理（group-orders 等） | spec §6 永久排除 |
| admin-dashboard `WaitingListTab.vue` 對應 G4 alreadyJoined 的 UX 改進 | follow-up small PR |
| OrdersService 廣播 room name 從 `restaurant:` 改為 `admin:` | INC-002（獨立 PR） |
| `apps/api/src/types/env.ts` 與 wrangler.toml binding 對齊的 lint / CI 檢查 | INC-001（工程議題） |
| 既有 SSE feature（in-memory Map 那套）的整體下線/重寫 | 待 group-orders 也遷移到 realtime DO 後再議 |

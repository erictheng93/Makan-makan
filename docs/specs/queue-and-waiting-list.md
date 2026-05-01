# Spec：候位系統 與 排隊系統

| | |
|---|---|
| **狀態** | Draft (pending review) |
| **建立日期** | 2026-05-01 |
| **作者** | Eric + Claude |
| **影響範圍** | `apps/api`、`apps/customer-app`、`apps/admin-dashboard`、`packages/database` |
| **預計分階段** | 5 階段 / 7 個 PR（P1 候位後端缺口 → P2 moduleGate 拆分 → P3 候位前端 → P4a-d 排隊系統 → P5 文件） |

---

## 0. TL;DR

兩個系統明確切開，不共用資料表、不共用服務基類，但共用一層薄薄的 `ticket-primitives` 工具模組。

| | 候位（Waiting List） | 排隊（Queue） |
|---|---|---|
| **核心語意** | 等「一張可坐 N 人的桌子」 | 依順序等「一個服務動作」 |
| **使用情境** | 內用餐廳滿座、現場登記等位 | 排隊點餐 / 取餐 / 結帳 / 入場 |
| **是否綁桌位** | ✅ 派位邏輯、`tableId` | ❌ 與桌位無關 |
| **是否綁人數** | ✅ 人數決定號碼前綴 A/B/C | ❌ 號碼前綴由 queue 設定決定 |
| **API 入口** | `/api/v1/waiting-list/**`（唯一） | `/api/v1/queue/**`（重新拆殼後給排隊用） |
| **資料表** | `waiting_list`（既有） | `queues` + `queue_tickets`（新增） |
| **服務類別** | `WaitingListService`（既有） | `QueueService`（新增） |
| **moduleGate** | `waiting_list`（從 `reservations` 拆出） | `queue`（新增） |
| **通知通道（首版）** | customer-app SSE 自輪詢 | customer-app SSE 自輪詢 |

---

## 1. 背景與決策摘要

### 1.1 為什麼要切開

現有 `WaitingListService` 從欄位設計（`partySize`、`preferredTableType`、`tableId`、`findAvailableTable(restaurantId, partySize)`、A/B/C 號碼前綴）就是純候位模型。`/api/v1/queue` 路由透過 `UnifiedQueueService` 套殼轉接到同一個 service，名為 queue 實為候位。

業務上**這是兩條獨立銷售線**，會被不同類型的餐廳獨立採購：

| 餐廳類型 | reservations | waiting-list | queue |
|---|---|---|---|
| 高級訂位餐廳 | ✅ | ❌ | ❌ |
| 連鎖小館 | ❌ | ✅ | ❌ |
| 攤車 / 檔口 | ❌ | ❌ | ✅ |
| 旗艦店 | ✅ | ✅ | ✅ |

把兩個系統綁在同一個服務 / 同一個 module gate，會鎖死定價、鎖死產品包裝、且實作上一定會遇到欄位裝飾化的反模式。

### 1.2 三大架構決策

**D1｜資料層分離（不抽多型表）**
兩張獨立表、兩個服務，外鍵形狀完全不同（`waiting_list.table_id → tables.id` vs. `queue_tickets.queue_id → queues.id`）。多型表會強迫每個 query 帶 discriminator + nullable join，且每張表會有一半欄位永遠 null。

**D2｜共用 `ticket-primitives` 工具模組**
狀態機、台灣手機驗證、「當日」SQL 片段、SSE 廣播這四件事兩邊都會用。抽到 `packages/database/src/services/ticket-primitives/`，但**不做基類繼承**——是工具箱，不是票據基類。

**D3｜三個獨立 moduleGate**
`reservations`、`waiting_list`、`queue` 各自獨立（snake_case 是 catalog 既有命名慣例，見 `subscriptions.ts:12`）。一次性 migration 把現有啟用 `reservations` 的租戶自動補上 `waiting_list`，避免破壞既有客戶。

> **命名雙軌**：API 路徑用 kebab（`/api/v1/waiting-list`），module key 用 snake（`waiting_list`）。這是現有 codebase 的既有不一致，本 spec 沿用，不重構。

---

## 2. 候位系統 Spec

### 2.1 既有 schema（不動）

`packages/database/src/schema/waiting-list.ts`，主要欄位：

```ts
waiting_list (
  id text primary key,                   // UUID v7
  restaurant_id text not null,
  customer_id integer,
  customer_name text not null,
  customer_phone text not null,          // 強制 ^09\d{8}$
  party_size integer not null,           // 1..20
  preferred_table_type text,             // 軟性偏好
  queue_number integer not null,         // 當日該前綴的流水號
  queue_letter text,                     // A=2人、B=4+、C=6+
  priority integer not null default 0,
  estimated_wait_minutes integer,
  table_id integer,                      // 派位後寫入
  status text not null default 'waiting',
  notes text,
  called_at, notified_at, confirmed_at,
  seated_at, cancelled_at, expired_at, timeout_at,
  created_at integer not null,
  updated_at integer not null
)
```

索引：`(restaurant_id, status, created_at)`、`(restaurant_id, queue_letter, queue_number)`、`(customer_phone)`。

### 2.2 狀態機

```
                   ┌──────────────┐
                   │   waiting    │ ← 入列起點
                   └──┬───────┬───┘
                      │       │
        staff calls   │       │ customer cancels (with phone)
                      ↓       ↓
                   ┌──────┐  ┌───────────┐
                   │called│  │ cancelled │ (terminal)
                   └─┬──┬─┘  └───────────┘
       customer       │  │   staff marks expired
       confirms       │  │   (no-show after timeout)
                      ↓  ↓
              ┌─────────┐ ┌──────────┐
              │confirmed│ │ expired  │ (terminal)
              └─────┬───┘ └──────────┘
                    │
        staff seats │
                    ↓
                ┌──────┐
                │seated│ (terminal)
                └──────┘
```

合法轉移由 `ticket-primitives/state-machine.ts` 定義；service 入口必須先 `assertTransition()`，違法時丟 409。

### 2.3 API 端點（修整後）

**全部走 `/api/v1/waiting-list`，不走 `/queue`。**

公開（顧客用，無需登入）：
| Method | Path | 用途 |
|---|---|---|
| POST | `/waiting-list` | 加入候位（**G4 改為冪等：重複時回現有票）** |
| GET | `/waiting-list/:id` | 查我這張票 |
| GET | `/waiting-list/lookup` | **G3 新增**：依 `restaurantId + phone` 找回當日 active 票據 |
| GET | `/waiting-list/queue-status/:restaurantId` | 查該餐廳整體候位狀態 |
| GET | `/waiting-list/estimate-wait/:restaurantId?partySize=N` | 估等待 |
| POST | `/waiting-list/:id/confirm` | 確認叫號（**G5 新增 phone 驗證**） |
| DELETE | `/waiting-list/:id` | 取消（body 帶 `customerPhone` 驗證，現有） |

員工（需登入，roles 0/1/3/4，moduleGate `waiting_list`）：
| Method | Path | 用途 |
|---|---|---|
| GET | `/waiting-list` | 候位列表（filters：status、phone、date、page、limit） |
| POST | `/waiting-list/:id/call` | 叫號（指定 tableId） |
| POST | `/waiting-list/:id/seat` | 標記入座 |
| POST | `/waiting-list/:id/expire` | 標記過期 |
| POST | `/waiting-list/batch-call` | 自動叫下一組 |
| GET | `/waiting-list/stats/:restaurantId?date=YYYY-MM-DD` | 統計（roles 0/1） |

### 2.4 七個缺口的修法 + 驗收條件

#### G1. SSE 廣播搬到 canonical 路徑

**修法：**
- 在 `ticket-primitives/sse-broadcast.ts` 寫一個 `broadcastTicketEvent(env, payload)`，**直接呼叫 SSE Durable Object** 或 service binding，不再用 `fetch(${API_BASE_URL}/api/v1/sse/broadcast/...)`。
- `WaitingListService` 的所有狀態變更出口（`joinWaitingList` / `callWaiting` / `markSeated` / `cancelWaiting` / `expireWaiting`）末端統一呼叫該 helper，事件名改為 `waiting_list_*`（`waiting_list_joined / called / confirmed / seated / cancelled / expired`）。
- 既有 `/queue` 路由的 `broadcastQueueUpdate`（`apps/api/src/features/queue/routes/index.ts:42-56`）拆殼後不復存在；新排隊系統獨立用 `queue_*` 事件名。

**驗收條件：**
- [ ] `POST /api/v1/waiting-list` 後，看板（admin-dashboard 候位頁）SSE 收到 `waiting_list_joined`
- [ ] `POST /:id/call` 後 admin-dashboard 與該客戶 customer-app 都收到 `waiting_list_called`
- [ ] 不再有任何路由透過 `${env.API_BASE_URL}/api/v1/sse/broadcast/*` 自呼叫（grep 0 命中）

> **注意**：現有其他 feature（group-orders）也用 HTTP self-call 模式，**那些不在本 spec 範圍**，不主動清理。只把 waiting-list / queue 系統做對。

#### G2. 客戶自助取號頁

**修法（customer-app 新頁面）：**
- 路由：`/r/:restaurantId/wait-list`，QR 掃描指向此 URL
- 頁面狀態機：
  1. **未登記**：顯示表單（姓名、手機、人數、備註）+ 提交按鈕
  2. **已登記**：顯示票面（`A005`）、目前位置（前面 N 組）、預估等待分鐘數，SSE 監聽自己這張票的事件
  3. **被叫號**：大字顯示「請至 X 桌」、「請於 5 分鐘內報到」、確認按鈕
  4. **已入座 / 取消 / 過期**：終態畫面
- 狀態跨重整持久化：`localStorage` 存 `{ queueId, customerPhone }`；頁面載入時若有就先打 `GET /:id` 拿最新狀態
- `localStorage` 沒有時：顯示「找回我的位置」入口，背後打 G3 的 lookup
- 同一手機同一餐廳當日重複登記：因 G4 變成冪等，前端直接收到現有票據，跳到狀態 2 即可

**驗收條件：**
- [ ] QR 掃描後可以全程在手機完成取號 → 等待 → 收到叫號 → 確認
- [ ] 關掉分頁再回來能還原狀態（從 localStorage 或 lookup）
- [ ] 沒有任何步驟需要 SMS

#### G3. 依手機找回票

**修法：**
- 新增 `GET /api/v1/waiting-list/lookup?restaurantId=X&phone=Y`（公開）
- service 方法 `findActiveTicketByPhone(restaurantId, phone)`：回傳當日該餐廳該手機 status 在 `(waiting, called, confirmed)` 的票，最多一張（因 G4 確保唯一）
- 找不到回 404 + `NO_ACTIVE_TICKET`，不洩漏其他資訊

**驗收條件：**
- [ ] 提供有效手機 → 回傳該票（含 `partiesAhead`、`queueDisplay`）
- [ ] 提供當日已 cancelled/expired/seated 的手機 → 404
- [ ] 提供格式錯誤手機 → 400（沿用 phone 驗證）
- [ ] 不會回傳「終態票據」資訊（隱私）

#### G4. 重複登記改為冪等

**修法（`WaitingListService.joinWaitingList`）：**

`packages/database/src/services/WaitingListService.ts:153-163` 目前是：

```ts
if (existingEntry) {
  throw new Error("您已在候位列表中");
}
```

改為：

```ts
if (existingEntry) {
  const existing = await this.getWaitingListEntryById(existingEntry.id);
  return { ...existing, alreadyJoined: true };
}
```

`WaitingListResponse` 介面新增 optional `alreadyJoined?: boolean` 欄位。前端據此決定要不要顯示「你已經登記過了」提示。

**驗收條件：**
- [ ] 同一手機同一餐廳當日 POST 兩次 → 第二次回 200（不是 400/409），payload 為現有票 + `alreadyJoined: true`
- [ ] 跨日的同一手機 → 視為新票（既有行為不變）
- [ ] 票已 cancelled / seated / expired 的同手機 → 視為新票

#### G5. confirm 端點補 phone 驗證

**修法（`apps/api/src/features/waiting-list/routes/index.ts`）：**

`POST /:id/confirm` 改為要求 body 帶 `customerPhone`，service 內比對 `entry.customerPhone === customerPhone`，不符回 403 `PHONE_MISMATCH`。

**驗收條件：**
- [ ] confirm 缺 phone → 400
- [ ] confirm phone 不符 → 403
- [ ] confirm phone 正確 → 200（現有行為）

#### G6. 狀態機強制守衛

**修法：**
- `ticket-primitives/state-machine.ts` 定義候位的合法轉移表：

```ts
const WAITING_TRANSITIONS = {
  waiting: ['called', 'cancelled', 'expired'],
  called: ['confirmed', 'cancelled', 'expired'],
  confirmed: ['seated', 'cancelled', 'expired'],
  seated: [],
  cancelled: [],
  expired: [],
} as const;

export function assertWaitingTransition(from, to) {
  if (!WAITING_TRANSITIONS[from].includes(to)) {
    throw new ApiError(409, 'INVALID_STATUS_TRANSITION',
      `Cannot transition from ${from} to ${to}`);
  }
}
```

- `WaitingListService` 每個狀態變更動作（`callWaiting / confirmWaiting / markSeated / cancelWaiting / expireWaiting`）入口先 `assertTransition()`。

**驗收條件：**
- [ ] 對 `seated` 票 call → 409 `INVALID_STATUS_TRANSITION`
- [ ] 對 `cancelled` 票 call → 409
- [ ] 對 `waiting` 票 seat → 409（必須先 call → confirm）
- [ ] 合法路徑全部 200

#### G7. moduleGate 改成 `waiting_list`

**修法：**
- `apps/api/src/features/waiting-list/routes/index.ts:176`：`moduleGate("reservations")` → `moduleGate("waiting_list")`
- `packages/database/src/schema/subscriptions.ts` 的 `MODULES` const 新增：
  ```ts
  WAITING_LIST: "waiting_list",
  QUEUE: "queue",
  ```
- `PLAN_DEFAULT_MODULES` 對應更新（見 §5.3 詳細表）
- 一次性 migration 寫入所有現有 `shop_subscriptions` 的 `moduleOverrides`：若 `reservations: true` 但沒有 `waiting_list` override → 設成 `waiting_list: true`
- migration 執行後**清除整張 `subscription:*` KV cache**（避免 stale 5 分鐘）

**驗收條件：**
- [ ] 既有有 reservations 的餐廳 → 候位 API 仍 200
- [ ] 新註冊只勾 waiting_list 的餐廳 → 候位 API 200，預約 API 403
- [ ] 全部關閉的餐廳 → 候位 API 403 `MODULE_NOT_ENABLED`

---

## 3. 排隊系統 Spec

### 3.1 範圍對齊（A 組答案）

- **A1=e**：通用框架優先，第一輪支援四種 `queueType`：`order`（排隊點餐）、`pickup`（排隊取餐）、`checkout`（排隊結帳）、`entry`（排隊入場）。
- **A2=a**：每個 queue 只有一條線（無多窗口分線）。
- **A3=a**：客戶在 customer-app 自輪詢（SSE）查號碼。**沒有大螢幕、沒有 SMS、沒有 push**。

### 3.2 資料模型（新增）

`packages/database/src/schema/queues.ts`：

```ts
// 餐廳的排隊配置（一個餐廳可有多個 queue，例如同時有取餐線與結帳線）
export const queues = sqliteTable("queues", {
  id: text("id").primaryKey(),                           // UUID v7
  restaurantId: text("restaurant_id").notNull(),
  queueType: text("queue_type").notNull(),               // order | pickup | checkout | entry
  name: text("name").notNull(),                          // 顯示名（"取餐線"）
  numberPrefix: text("number_prefix").notNull().default(""), // 號碼前綴（"P" → P001）
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  // 預估每張票的服務時間（分鐘），用於估等待
  avgServiceMinutes: integer("avg_service_minutes").notNull().default(3),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => ({
  restaurantTypeIdx: index("queues_restaurant_type_idx")
    .on(t.restaurantId, t.queueType),
  restaurantActiveIdx: index("queues_restaurant_active_idx")
    .on(t.restaurantId, t.isActive),
}));

// 票據
export const queueTickets = sqliteTable("queue_tickets", {
  id: text("id").primaryKey(),                           // UUID v7
  queueId: text("queue_id").notNull(),
  restaurantId: text("restaurant_id").notNull(),         // 反正規化，加速 tenant filter
  ticketNumber: integer("ticket_number").notNull(),      // 當日該 queue 的流水號
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),       // 強制 ^09\d{8}$（與候位一致）
  partySize: integer("party_size"),                      // 可選；某些情境用得到（入場限流）
  status: text("status").notNull().default("waiting"),
  notes: text("notes"),
  // 狀態時間戳
  calledAt: integer("called_at"),
  servedAt: integer("served_at"),
  cancelledAt: integer("cancelled_at"),
  expiredAt: integer("expired_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => ({
  queueStatusIdx: index("queue_tickets_queue_status_idx")
    .on(t.queueId, t.status, t.createdAt),
  restaurantPhoneIdx: index("queue_tickets_restaurant_phone_idx")
    .on(t.restaurantId, t.customerPhone),
  queueNumberIdx: index("queue_tickets_queue_number_idx")
    .on(t.queueId, t.ticketNumber),
}));
```

### 3.3 狀態機（簡化版，候位的子集）

```
                   ┌──────────────┐
                   │   waiting    │ ← 入列起點
                   └──┬───────┬───┘
                      │       │
        staff calls   │       │ customer cancels (with phone)
                      ↓       ↓
                   ┌──────┐  ┌───────────┐
                   │called│  │ cancelled │ (terminal)
                   └──┬───┘  └───────────┘
                      │
        staff serves  │ or expires
                      ↓
              ┌──────┐ ┌─────────┐
              │served│ │ expired │ (terminal)
              └──────┘ └─────────┘
```

**沒有 `confirmed` 狀態**——排隊情境通常是叫到號就直接被服務（取餐、結帳、入場），不需要顧客主動確認。

### 3.4 號碼規則

- 號碼格式：`{prefix}{ticketNumber:padStart(3,'0')}`，例如 prefix `"P"` 的票會顯示 `P001 P002 ...`
- prefix 是 queue 配置層級（每個 queue 一個前綴），**不依人數變化**——這是與候位最重要的差異
- `ticketNumber` 每日重置、每個 queue 獨立流水
- 預設前綴規則建議（onboarding 時自動填）：

| queueType | 建議 prefix |
|---|---|
| order | `O` |
| pickup | `P` |
| checkout | `C` |
| entry | `E` |

### 3.5 API 端點

**全部走 `/api/v1/queue`（拆殼後從候位手中接管）。**

公開（顧客用，無需登入）：
| Method | Path | 用途 |
|---|---|---|
| GET | `/queue/restaurants/:restaurantId` | 列出該餐廳所有 active queue |
| GET | `/queue/:queueId/status` | 查 queue 整體狀態（總人數、預估等待） |
| POST | `/queue/:queueId/tickets` | 抽號（body: name, phone, partySize?, notes?） |
| GET | `/queue/tickets/:ticketId` | 查我這張票 |
| GET | `/queue/tickets/lookup` | 依 `restaurantId + phone` 找回當日 active 票（**任何 queue**） |
| DELETE | `/queue/tickets/:ticketId` | 取消（body 帶 phone） |

員工（需登入，roles 0/1/3/4，moduleGate `queue`）：
| Method | Path | 用途 |
|---|---|---|
| GET | `/queue/restaurants/:restaurantId/admin` | 管理列表（含 inactive） |
| POST | `/queue/restaurants/:restaurantId` | 建立 queue（roles 0/1） |
| PUT | `/queue/:queueId` | 更新 queue 配置（roles 0/1） |
| DELETE | `/queue/:queueId` | 停用 queue（軟刪，roles 0/1） |
| GET | `/queue/:queueId/tickets` | 該 queue 票據列表（filters: status, page） |
| POST | `/queue/tickets/:ticketId/call` | 叫號 |
| POST | `/queue/tickets/:ticketId/serve` | 標記已服務（terminal） |
| POST | `/queue/tickets/:ticketId/expire` | 標記過期 |
| POST | `/queue/:queueId/call-next` | 自動叫下一張 |
| GET | `/queue/:queueId/stats?date=YYYY-MM-DD` | 統計（roles 0/1） |

### 3.6 顧客自助取號流程（customer-app）

- 路由：`/r/:restaurantId/queue` → 列出該餐廳所有 active queue 給客人選
- 路由：`/r/:restaurantId/queue/:queueId` → 抽號表單 + 票面狀態頁
- 與候位頁邏輯類似（localStorage 持久化、SSE 監聽自票事件、找回入口），但**呼叫的是 `/api/v1/queue/**`**
- 入場限流情境：若 queue 設定 `partySize` 為必填（透過 queue config 的 flag，**未來再做**），表單顯示人數欄；其他情境隱藏

### 3.7 SSE 事件命名

| 事件 | Trigger |
|---|---|
| `queue_ticket_joined` | 抽號 |
| `queue_ticket_called` | 叫號 |
| `queue_ticket_served` | 標記已服務 |
| `queue_ticket_cancelled` | 取消 |
| `queue_ticket_expired` | 過期 |
| `queue_config_updated` | queue 設定變更（停用/改名/改前綴） |

---

## 4. 共用 `ticket-primitives` 模組

`packages/database/src/services/ticket-primitives/`：

```
ticket-primitives/
├── index.ts                  // re-export
├── state-machine.ts          // WAITING_TRANSITIONS、QUEUE_TRANSITIONS、assertTransition()
├── phone-validator.ts        // validateTwPhone()，^09\d{8}$、剝除 -/空白（P4a）
└── today-window.ts           // todaySqlPredicate(restaurantTzCol)，當日 SQL 片段（P4a）
```

**設計原則：**
- 純工具函式，**沒有 class、沒有 I/O、沒有 D1 操作**
- 兩個 service 各自 import 各自需要的工具
- 不假設票據資料結構——例如 `assertTransition` 接 `(transitionsTable, from, to)` 而不是接票物件

**廣播不是 primitive，是 service。** 既有 `RealtimeBroadcastService`（將從 `apps/api/src/services/` 搬到 `packages/database/src/services/`）負責跟 `apps/realtime` Durable Object 對接，兩個 service 直接呼叫它。詳見 §5.5。

**不做什麼：**
- ❌ 不抽 base service class（前一版討論過，明確排除）
- ❌ 不抽通用 `Ticket` interface（兩邊欄位差太多，泛型化會稀釋語意）
- ❌ 不在 primitive 層做 D1 操作（純函式，DB 操作回到各自的 service）
- ❌ 不在 primitive 層做廣播（broadcast 是 stateful 副作用，不是純函式）

---

## 5. 遷移計劃

### 5.1 階段順序

**Phase 1：候位 G1+G3+G4+G5+G6（後端優先）**
- 改 `WaitingListService`：冪等 join、phone-gate confirm、狀態機守衛、lookup 端點
- 改 `apps/api/src/features/waiting-list/routes/index.ts`
- 改 `apps/api/src/features/queue/`：暫時保留現有 `/queue/*` 行為（仍打 WaitingListService），但 SSE 廣播從 HTTP self-call 改成 sse-broadcast helper
- 完整 unit + integration test

**Phase 2：moduleGate 拆分（G7）**
- `ModuleKey` 加 `waiting_list`、`queue`
- `PLAN_DEFAULT_MODULES` 對應更新（見 §5.3）
- 一次性 migration（含 KV cache flush）
- 候位 routes 的 gate 從 `reservations` 換成 `waiting_list`

**Phase 3：候位客戶自助頁（G2）**
- customer-app 新增 `/r/:restaurantId/wait-list`
- E2E 測試：QR 掃描 → 取號 → 叫號 → 確認

**Phase 4：排隊系統 MVP（拆成 4a / 4b / 4c / 4d 各自可獨立 PR）**

**4a — DB schema + service（後端基礎）**
- D1 migration：`queues` + `queue_tickets` 兩張表
- `packages/database/src/schema/queues.ts`：Drizzle schema + relations + types
- `packages/database/src/services/QueueService.ts`：完整 CRUD + 狀態機方法
- `packages/database/src/services/ticket-primitives/`：四個工具模組（state-machine、phone-validator、today-window、sse-broadcast）
- 單元測試 + integration 測試
- **完工門檻**：`pnpm typecheck` + `pnpm test` 全綠；service 可在測試裡走完票據生命週期
- **不含**：HTTP routes、前端

**4b — API routes（HTTP 殼）**
- 刪除 `apps/api/src/features/queue/services/UnifiedQueueService.ts`
- 重寫 `apps/api/src/features/queue/routes/index.ts`：接 `QueueService`，覆蓋 §3.5 全部端點
- `app-factory.ts:456` 註解更新（不是行為改）
- moduleGate 上 `queue`
- routes 層整合測試（mock service 即可）
- **完工門檻**：所有端點可在 wrangler dev 用 curl 跑通；admin / public 路徑 auth 守衛正確
- **不含**：admin-dashboard、customer-app

**4c — admin-dashboard（店家管理介面）**
- 新增路由樹 `/dashboard/queue/`（**獨立樹，不放 `/dashboard/seating/` 下**——`seating` 字面意思是座位，混入排隊語意衝突）：
  - `/dashboard/queue` — queue 配置列表（建立、改名、改前綴、停用）
  - `/dashboard/queue/:queueId` — 即時票據看板（叫號、標記服務）
  - `/dashboard/queue/:queueId/stats` — 統計
- Vue components 走 Apple-Native Soft Minimalism design system（依 CLAUDE.md 強制規定）
- SSE 訂閱 `queue_ticket_*` 事件，看板即時更新
- **完工門檻**：店家可從零建立 queue → 看到票據進來 → 叫號 → 服務完成
- **不含**：customer-app

**4d — customer-app（顧客取號介面）**
- 新增路由：
  - `/r/:restaurantId/queue` — 列出該餐廳所有 active queue 給客人選
  - `/r/:restaurantId/queue/:queueId` — 抽號表單 + 票面狀態頁
- localStorage 持久化 `{ ticketId, customerPhone }`
- 「找回我的票」入口（背後打 lookup endpoint）
- SSE 訂閱自票事件
- E2E（Playwright）：完整顧客流程
- **完工門檻**：QR 掃描 → 抽號 → 收到叫號 → 終態（served/cancelled）

**Phase 5：清理（可選，非緊急）**
- ~~確認沒有外部呼叫 `/api/v1/queue/join` 等舊端點~~ ✅ Q1 grep 已確認 0 命中
- 整體文件補充至 `docs/UIUX-design-system.md` 或新增 `docs/api/queue-and-waiting-list.md`

### 5.2 `/api/v1/queue` 收回的驗證清單（已完成）

執行（2026-05-01）：

```bash
rg -n "/api/v1/queue|/queue/join|UnifiedQueueService" \
  apps/customer-app apps/admin-dashboard apps/kitchen-display \
  apps/management-portal apps/onboarding-app apps/management-api
# → 0 matches
```

`apps/api/openapi.yaml` 不存在（檢查過）。整個 monorepo 沒有任何呼叫者用舊 `/queue/*` 端點，**Phase 4b 可以直接拆殼，無遷移期**。

### 5.3 plan tier × module 的預設配置（Q4 決策）

新增兩個 module key 後，建議的 `PLAN_DEFAULT_MODULES` 更新：

| Module Key | trial | basic | pro | enterprise | 理由 |
|---|---|---|---|---|---|
| `waiting_list` | ✅ | ❌ | ✅ | ✅ | 與 `reservations` 同層級（前場運營），維持兩者並列關係 |
| `queue` | ✅ | ✅ | ✅ | ✅ | **basic 也給**——攤車/檔口的客戶會選 basic 方案，排隊就是他們的核心使用情境，不應強迫升 pro |

**Migration SQL**（idempotent）：

```sql
-- 1. 既有 reservations: true 的租戶補上 waiting_list: true
UPDATE shop_subscriptions
SET module_overrides = json_patch(
  COALESCE(module_overrides, '{}'),
  json_object('waiting_list', true)
)
WHERE json_extract(module_overrides, '$.reservations') = 1
  AND json_extract(module_overrides, '$.waiting_list') IS NULL;

-- 2. queue 不需要遷移（新模組，按 plan 預設值生效）
```

Migration 執行後在 worker 進程內呼叫 `CACHE_KV.list({ prefix: "subscription:" })` 並逐筆 delete，避免 5 分鐘 stale。或者一次性提高 `CACHE_TTL_SECONDS` revision 號讓 cache key 變動失效——擇一。

### 5.4 廣播架構（T0 spike 結論，2026-05-01）

**現況：**
- `apps/realtime` 是獨立 worker，導出 `RealtimeSession` Durable Object class，提供正確的 stateful broadcast 能力
- `apps/api/src/services/RealtimeBroadcastService.ts` 已寫好 wrapper，但 `apps/api/wrangler.toml` 沒 `[[durable_objects]]` binding 指向 `RealtimeSession`，導致 `env.REALTIME_SESSION` 為 undefined，wrapper 走防禦性 no-op
- 結果：OrdersService、KitchenService 既有的 realtime 廣播在 production **全部靜默失敗**（INC-001）
- 此外：`broadcastNewOrder` 廣播到 room `restaurant:${id}` 但 admin-dashboard 連的是 `admin:${id}`（INC-002）

**P1 採取的決策：**
1. 把 `RealtimeBroadcastService.ts` 從 `apps/api/src/services/` 搬到 `packages/database/src/services/`，使候位（與將來的排隊）兩邊都能直接 import
2. 在 `apps/api/wrangler.toml` 各 env 加 `[[durable_objects.bindings]]`（必做）
3. 候位廣播 room 用 `admin:${restaurantId}`，admin-dashboard 既有連線立刻可收到
4. **不修** OrdersService 的 `restaurant:` → `admin:` room rename（INC-002 獨立 PR 處理）

**將來：**
- 排隊系統（P4）也會走同一條路徑：`QueueService` 直接呼叫 `RealtimeBroadcastService.broadcastEvent('admin', restaurantId, ...)`
- customer-app 候位 / 排隊頁的即時更新（P3、P4d）需要新的 room 設計（可能 `customer:waiting:${queueId}` 或類似），由各 phase spike 決定

### 5.5 無破壞性保證

- 候位現有 D1 schema 完全不動（只加缺口端點 + 改 service 行為）
- moduleGate migration 確保現有有 reservations 的租戶自動繼承 waiting-list
- 排隊是純新增系統，沒有舊資料要遷移
- `/api/v1/queue/*` 的舊行為（其實是候位）會在 Phase 4 一次切換；切換前已確認沒有 caller，所以不算破壞

---

## 6. 明確排除清單

以下**不在本 spec 範圍**，未來另開：

| 項目 | 為什麼排除 |
|---|---|
| Twilio SMS 通知 | 你說暫不使用；現有 `sendWaitingNotification` 維持「沒設 env 就 no-op」現狀 |
| 大螢幕看板（標號顯示） | A3=a 已排除；之後若做是新 feature |
| 多線排隊（同一個 queue 多個服務窗口） | A2=a；MVP 只支援單線 |
| Web Push / FCM 通知 | A3=a；customer-app SSE 為唯一通知通道 |
| ETA 預測（具體幾點幾分被叫） | 錦上添花；既有 `estimatedWaitMinutes` 夠用 |
| 跨日候位 / 排隊（過夜票據） | 業務不需要 |
| 候位 A/B/C 跳號顯示問題 | 是設計、不是 bug，spec 已記錄 |
| call 動作的 idempotency | 雙擊機率低、影響小，先不做 |
| 排隊系統的 `partySize` 必填配置 | 入場限流情境再回來補；MVP partySize 永遠 optional |
| 其他 feature 的 SSE HTTP self-call 清理 | 不在範圍（group-orders 等保持不變） |

---

## 7. 驗證與測試策略

### 7.1 單元測試（vitest）

- `WaitingListService` 的七個缺口各自至少一個 happy path + 一個 error path 測試
- `QueueService` 全部 public 方法 happy + error
- `ticket-primitives` 工具函式 100% coverage

### 7.2 整合測試（vitest，wrangler dev 起 D1）

- 候位完整生命週期：join → call → confirm → seat
- 候位異常路徑：重複登記（G4）、無效 phone、狀態機違法跳轉（G6）
- 排隊完整生命週期：join → call → serve
- moduleGate：未啟用 `waiting-list` 的租戶 → 候位 API 403

### 7.3 E2E（Playwright）

- 客戶自助候位：手機 QR 掃描 → 取號 → 看位置 → 收到叫號 → 確認
- 客戶自助排隊：選 queue → 抽號 → 看位置 → 收到叫號

### 7.4 手動驗證 / canary

- Phase 2（moduleGate 切換）後：production 抽樣 5 個有 reservations 的租戶 → 確認 waiting-list API 仍可用
- Phase 4（`/queue` 切換）後：grep production access log 過去 24 小時 `/api/v1/queue/join` 應為 0

---

## 8. 未決事項

全部已釐清：

- ~~**Q1**：其他 apps 是否有舊 `/queue` 呼叫者？~~ ✅ 0 命中（§5.2）
- ~~**Q2**：`apps/api/openapi.yaml` 是否存在？~~ ✅ 不存在
- ~~**Q3**：admin-dashboard 進入點放哪？~~ ✅ `/dashboard/queue/`（獨立樹，不混入 seating）
- ~~**Q4**：plan tier × module 預設配置？~~ ✅ 見 §5.3，`queue` 全 tier 啟用、`waiting_list` 對齊 `reservations`

執行階段才會浮現的問題（不阻擋現在動工）：

- **R1**：Phase 4a SSE Durable Object 的具體 binding 名稱與介面（要等 4a 動工時讀 `apps/api/src/features/sse/` 後才知道是 service binding 還是 DO RPC）
- **R2**：Phase 4c admin-dashboard queue 配置頁的 UI 細節（號碼前綴選擇器要 dropdown 還是自由輸入？）— 由 design system 規範與 4c PR 內定案
- **R3**：Phase 4d localStorage key 命名（`mm:queue-ticket:{restaurantId}`?）— 4d PR 內定案，不影響 spec

---

## 附錄 A：相關檔案索引

**既有：**
- `apps/api/src/app-factory.ts:456,460`（路由掛載）
- `apps/api/src/features/waiting-list/routes/index.ts`
- `apps/api/src/features/queue/routes/index.ts`（將被重寫）
- `apps/api/src/features/queue/services/UnifiedQueueService.ts`（將被刪除）
- `apps/api/src/middleware/moduleGate.ts:116`
- `packages/database/src/schema/waiting-list.ts`
- `packages/database/src/services/WaitingListService.ts:143`（join）
- `packages/database/src/services/WaitingListService.ts:1005`（號碼產生）
- `apps/admin-dashboard/src/router/index.ts:316`
- `apps/admin-dashboard/src/views/seating/WaitingListTab.vue:895`

**將新增：**
- `packages/database/src/schema/queues.ts`
- `packages/database/src/services/QueueService.ts`
- `packages/database/src/services/ticket-primitives/{index,state-machine,phone-validator,today-window,sse-broadcast}.ts`
- `apps/api/src/features/queue/services/QueueService.ts`（薄包裝層）
- `apps/customer-app/src/views/{WaitListPage,QueueListPage,QueueTicketPage}.vue`
- `apps/admin-dashboard/src/views/queues/{QueuesTab,QueueTicketsTab}.vue`
- D1 migration：`queues_init.sql`
- D1 migration：`module_keys_split.sql`（reservations → +waiting-list 自動繼承）

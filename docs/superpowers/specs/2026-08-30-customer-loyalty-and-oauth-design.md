# 會員點數 / 推薦碼 與 OAuth 第三方登入 — Phase 2 設計

**日期**: 2026-08-30
**狀態**: Draft — Open Questions 待拍板
**作者**: Eric
**Phase 2 範圍**: (A) 會員點數 ledger + 推薦碼、(B) LINE / Google / Apple OAuth 登入與帳號連結
**前置規格**: [`2026-05-25-customer-identity-and-profile-design.md`](./2026-05-25-customer-identity-and-profile-design.md) — §11 Future Work 把這兩項列為 Phase 2
**相鄰系統**: [`2026-06-03-market-checkout-voucher-redemption.md`](./2026-06-03-market-checkout-voucher-redemption.md)（券）、儲值代幣 `packages/database/src/schema/credits.ts`（代幣）

---

## 1. Overview

Phase 1 已經把 `customers`（TEXT/UUID v7）確立為唯一的顧客身分，並上線了 8 張顧客表、手機 OTP 登入、密碼登入、與 `CustomerSessionService`（15 分鐘 access／30 天 refresh、`type: "customer"`）。Phase 2 接續兩件被明確延後的事：

1. **會員點數 / 推薦碼** — 顧客消費累積點數、點數折抵、推薦朋友獲得獎勵。
2. **OAuth 第三方登入** — LINE（台灣主力）、Google、Apple。

這份規格的三個非顯而易見的重點，都是既有程式碼已經替我們決定了一半的事：

- **`customer_auth_identities` 已經是為 OAuth 設計的。** 它有 `provider` / `provider_uid` / `encrypted_payload` / `verified_at_ms` / `last_used_at_ms`，`(provider, provider_uid)` 是 UNIQUE，而 `customer_auth_identities_one_password_idx` 這個 partial unique 特意只在 `provider = 'password'` 生效 —— 這張表從第一天就預期承載多個 provider。Phase 1 規格寫的「新開 `customer_oauth_identities`」是在該表存在**之前**寫的，**不再適用**。詳見 §7.1。
- **`issueBindingToken()` 已經寫好但從來沒有人呼叫。** `apps/api/src/features/customer/services/CustomerSessionService.ts` 有一個產生 10 分鐘 `type: "customer_bind"` JWT 的函式，payload 剛好是 `{ provider, providerUid }`，而 `canonicalCustomerAuthMiddleware` 已經明確**拒絕**這種 token 存取顧客路由。這是一條為 OAuth 帳號連結預埋、但尚未接線的軌道。詳見 §7.4。
- **點數不能重造 ledger。** `CreditService.applyLedgerMovement`（儲值代幣）已經在真實 D1 上驗證過一套「條件式 UPDATE + 樂觀鎖 + `idempotency_key` UNIQUE + 單一 `DB.batch()`」的無交易記帳法。點數照抄這套，不發明新的。詳見 §5.3。

同時，這份規格必須先解掉一個命名地雷：`MODULE_KEYS.LOYALTY = "loyalty"` 目前**不是**消費者集點，而是 B2B 特約商店（partnerships）。詳見 §3。

---

## 2. Goals & Non-goals

### Goals (Phase 2)

1. 上線**每租戶獨立**的會員點數系統：append-only 帳本 + 物化餘額，發點／扣點／到期／退貨回沖四條路徑都可重放（idempotent）。
2. 明確劃出**點數（店家負債）**與**儲值代幣（平台負債）**的邊界，兩套系統不互相污染。
3. 上線推薦碼：一人一碼、防自我推薦、防多帳號刷，獎勵走**既有券管線**（`CouponService.distributeCoupon`），不新造發放機制。
4. 上線 LINE / Google / Apple OAuth 登入，與既有 `CustomerSessionService` 共用同一套 session 發放與 refresh 輪替。
5. 處理「先用手機 OTP 註冊、後來用 LINE 登入」的帳號連結，且**不引入以 email 自動合併帳號的接管漏洞**。
6. 解決 `loyalty` module key 的語意衝突，並讓處置方案對既有租戶訂閱資料的影響是可陳述、可驗證的。
7. 每個階段都能單獨出貨、單獨綠燈。

### Non-goals (延後)

- **點數跨店／跨夜市通用**。Schema 預留 `scope_type` 但 Phase 2 只實作 `restaurant`。理由見 §5.1。
- **FIFO 批次到期**（每筆發點各自計時）。Phase 2 用帳戶級 rolling expiry，與代幣一致。
- **會員等級（tier）/ 升降級**。點數餘額先跑起來，等級是它的下游。
- **點數換實體商品的 reward 目錄**。Phase 2 只做「折抵訂單金額」一種用途。
- **把 provider 的 access/refresh token 留存下來**以代表使用者呼叫 provider API（例如 LINE 推播、好友名單）。Phase 2 只取身分。理由見 §7.6。
- **顧客端點數的離線／POS 現場折抵**。先做線上點餐流程。
- **合併重複顧客**（同一人有兩個 `customers` row）。與 Phase 1 相同，仍是獨立的資料清理專案。

---

## 3. 前置決策：`loyalty` module key 的語意衝突

### 3.1 現況盤點（已驗證）

`MODULES.LOYALTY = "loyalty"`（`packages/database/src/schema/subscriptions.ts:37`）目前的**唯一**用途是 gate 特約商店（B2B 機構折扣）：

| 位置 | 內容 |
|---|---|
| `apps/api/src/features/partnerships/routes/index.ts` | `moduleGate("loyalty")` **21 處** |
| `apps/api/src/features/partnerships/routes/module-gate.test.ts` | 1 處 |
| 其他任何檔案 | **0 處** |

`partnerships` 賣的是「合作夥伴 → 折扣方案 → 已驗證員工（`verified_members`）→ 使用紀錄」，例如某公司員工憑證在店內享折扣。這與消費者集點沒有任何交集。

module key 的擴散面（改名要一起動的地方）：

| 檔案 | 角色 |
|---|---|
| `packages/database/src/schema/subscriptions.ts` | `MODULES` 常數 + `PLAN_DEFAULT_MODULES`（`trial`、`enterprise` 各含一次） |
| `packages/shared/types/module-access.ts` | 前端 `ModuleKey` 聯集型別 |
| `apps/admin-dashboard/src/views/SubscriptionsView.vue:433` | 後台模組切換清單 |
| `apps/admin-dashboard/src/i18n/locales/{zh-TW,zh-CN,en-US,ja-JP,vi-VN,id-ID}.ts` | 6 個語系的顯示名（zh-TW 目前寫「忠誠方案」——這個標籤本身就已經在誤導後台使用者） |
| `scripts/audit-module-gates.cjs:59-61` | pre-commit 強制的 `/partnerships/* → loyalty` 前綴對照 |
| `shop_subscriptions.module_overrides` (D1 JSON 欄) | **唯一的持久化資料面** |

### 3.2 這題真正的風險在哪裡

module key 是 TypeScript 常數，不是資料列 —— 新增一個 key 不需要 migration。**唯一會被改名弄壞的是 `shop_subscriptions.module_overrides` 這個 JSON map 裡已經存在的 `"loyalty"` 鍵**，改名後那筆 override 會被 `resolveModule` 讀成「key 不存在」而落回方案預設，靜默地改變某個租戶的權限。

實際查了 production（`makanmasak-prod`，唯讀查詢）：

```
shop_subscriptions:  1 列 — plan_tier=enterprise, module_overrides='{}', is_active=1
partnerships:        0 列
verified_members:    0 列
partnership_usage_logs: 0 列
```

**沒有任何一筆 `module_overrides` 帶 `loyalty` 鍵，而且 partnerships 這個產品線上從未被使用過。** 換句話說，「會動到已賣出的方案」這個顧慮在今天為真的機率是零，而且是**現在**才為零 —— 一旦有租戶開始用 override，這題就會變成需要跟客戶協調的資料遷移。

補充兩個降低風險的既有機制：`SubscriptionService.changePlan` 會把 `module_overrides` 重設為 `{}`，`TrialReaperService.downgradeExpiredTrials` 也會 —— override 在設計上就是短命的。

### 3.3 三個選項與影響

| | 選項 A：新增 `member_loyalty` | 選項 B：partnerships 改用 `partnerships` key（**建議**） | 選項 C：兩者共用 `loyalty` |
|---|---|---|---|
| 程式碼改動 | 只加不改（8 處新增） | 改 7 個檔案 + 21 個 `moduleGate` 字串 + 1 支 data migration | 只加不改 |
| 對既有訂閱資料 | 零影響 | `module_overrides` 需 JSON 改鍵；**今天 prod 命中 0 列** | 零影響 |
| 語意 | `loyalty` 永久指向 B2B 特約商店，後台標籤「忠誠方案」永久錯誤 | 每個 key 名副其實 | 完全錯誤 |
| 定價彈性 | 兩軸可分開賣 | 兩軸可分開賣 | **不可分** —— 只想買集點的租戶會連 partnerships 的 21 條寫入 API 一起拿到 |
| 未來成本 | 每個新人都要先被教育一次「`loyalty` 不是集點」 | 一次付清 | 無法拆分，將來要拆時資料已經髒了 |

**選項 C 直接排除**：它把兩個獨立的商業軸綁成一個開關，而且會實質擴大權限（買集點的租戶白拿 B2B 特約商店的建立／核可／使用紀錄寫入端點）。

**建議採選項 B，並且現在做。** 理由是時機而非偏好：改名的成本是固定的（7 個檔案），但風險會隨時間單調上升。今天 prod 有 1 筆 `{}` override、0 筆 partnership 資料，這是這個決策成本最低的一刻。

### 3.4 選項 B 的執行細節

程式碼側（單一 commit，可獨立部署）：

1. `MODULES.LOYALTY: "loyalty"` → `MODULES.PARTNERSHIPS: "partnerships"`（B2B），並**另加** `MODULES.LOYALTY: "loyalty"`（消費者集點，語意重新定義）。
2. `PLAN_DEFAULT_MODULES`：`partnerships` 承接原本 `loyalty` 的位置（`trial`、`enterprise`）；新的 `loyalty`（集點）放哪一層見 **Q-2**。
3. `apps/api/src/features/partnerships/routes/index.ts` 21 處 `moduleGate("loyalty")` → `moduleGate("partnerships")`。
4. `scripts/audit-module-gates.cjs` 前綴對照改成 `/partnerships/* → partnerships`。
5. `packages/shared/types/module-access.ts` 加 `"partnerships"`。
6. `SubscriptionsView.vue` 清單加入 `partnerships`。
7. 6 個語系新增 `partnerships` 標籤，並把 `loyalty` 的標籤從「忠誠方案」改為「會員點數」等正確字樣。

資料側（`0018_module_key_partnerships_rename.sql`，見 §8）：把既有 `module_overrides` 裡的 `loyalty` 鍵改名為 `partnerships`。這支 migration 今天會影響 0 列，**但它必須存在** —— 它是這次改名的正確性證明，也是在 staging／未來新增租戶時唯一的保險。

**部署後必須手動清 KV。** `module_overrides` 被 SQL 直接改動時沒有任何東西會失效 `subscription:{restaurantId}` 這個 KV key（TTL 300 秒）。依 `docs/architecture/modular-billing.md`：

```bash
pnpm wrangler kv key delete --binding=CACHE_KV "subscription:<restaurantId>" --remote
```

---

## 4. 點數 vs 代幣 vs 券 —— 邊界定義

這三套東西都會讓顧客「少付錢」，但負債歸屬、取得方式與可用範圍完全不同。這張表是本規格所有後續決策的依據：

| | **儲值代幣** (`credit_*`，已上線) | **會員點數** (`customer_loyalty_*`，本規格) | **優惠券** (`coupons` / `user_coupons`，已上線) |
|---|---|---|---|
| 顧客怎麼取得 | **付錢買**（儲值） | **消費贈與**（回饋、推薦獎勵） | 發放／活動／推薦獎勵 |
| 誰的負債 | **平台**（平台先收到錢） | **店家**（店家承諾的回饋） | 發券者（平台券 or 店家券） |
| 可用範圍 | 同幣別**跨店通用** | **單店限定**（Phase 2） | 依 `coupons.restaurant_id`：NULL＝平台券、非 NULL＝店家券 |
| 單位 | `balance_cents`（分） | `balance_points`（整數點） | `discount_percentage_bps` XOR `discount_value_cents` |
| 到期 | 帳戶級 rolling（儲值/消費往後推） | 帳戶級 rolling 12 個月（**同款**） | `coupons.valid_to`（TEXT `YYYY-MM-DD`） |
| 帳本 | `credit_ledger_entries`（append-only, `idempotency_key` UNIQUE） | `customer_loyalty_ledger_entries`（**同款**） | `coupon_usage`（(coupon_id, order_id) partial unique，非重放鍵） |
| 併發防護 | 條件式 UPDATE + `version` 樂觀鎖 | **同款** | `claimUsageSlot` / `releaseUsageSlot` |
| 未使用時的處置 | 到期沖銷（breakage），已有 `0 4 * * *` cron | 到期沖銷，新增 cron | 券過期即失效 |

**沿用而不重造的清單**：分為單位（點數改為「點」為單位，但同樣是整數，不用浮點）、樂觀鎖 `version` 欄、append-only ledger + `balance_after_*` 快照、`idempotency_key` UNIQUE、`(status, expires_at_ms)` 到期掃描索引、`findBalanceLedgerDrift()` 型的漂移偵測、單一 `DB.batch()` 的兩敘述原子寫。

**刻意不同的地方**：代幣有 `reserved_cents`（結帳鎖定中），點數 Phase 2 **不做預留**。理由：代幣的預留是為了跨攤結帳（`market_checkout`）先鎖後扣；點數是單店的，折抵發生在同一次下單交易內，多一個預留狀態只是多一條可能漂移的路徑。若 Q-3 拍板要跨店，再補 `reserved_points`。

---

## 5. Data Model — 點數

三張新表。全部 `TEXT` UUID v7 PK、`INTEGER` timestamp_ms、`STRICT`。

### 5.1 `customer_loyalty_accounts`（物化餘額 = 負債本體）

```ts
export const LOYALTY_SCOPE_TYPE = ["restaurant"] as const; // Phase 2 只有這一種
export const LOYALTY_ACCOUNT_STATUS = ["active", "frozen", "closed"] as const;

export const customerLoyaltyAccounts = sqliteTable(
  "customer_loyalty_accounts",
  {
    id: text("id").primaryKey().$defaultFn(() => uuidv7()),

    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),

    // 前瞻欄位：Phase 2 恆為 'restaurant'，service 層拒絕其他值。
    // 保留它是為了讓「夜市級共用點數」(Q-3) 不需要重建表。
    scopeType: text("scope_type")
      .$type<LoyaltyScopeType>()
      .notNull()
      .default("restaurant"),
    scopeId: text("scope_id").notNull(), // scopeType='restaurant' 時 = restaurants.id

    balancePoints: integer("balance_points").notNull().default(0),
    lifetimeEarnedPoints: integer("lifetime_earned_points").notNull().default(0),

    version: integer("version").notNull().default(0), // 樂觀鎖

    status: text("status")
      .$type<LoyaltyAccountStatus>()
      .notNull()
      .default("active"),

    expiresAtMs: integer("expires_at_ms", { mode: "timestamp_ms" }), // rolling expiry

    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    scopeUniqueIdx: uniqueIndex("idx_loyalty_accounts_customer_scope").on(
      table.customerId,
      table.scopeType,
      table.scopeId,
    ),
    scopeListIdx: index("idx_loyalty_accounts_scope_balance").on(
      table.scopeType,
      table.scopeId,
      table.balancePoints,
    ),
    expiryScanIdx: index("idx_loyalty_accounts_expiry_scan").on(
      table.status,
      table.expiresAtMs,
    ),
  }),
);
```

**為何單店而非平台通用（決策）。** 夜市有多攤商，這題看似該做跨攤通用，但跨攤通用會立刻長出攤商間清算：攤商 A 發的點在攤商 B 消費，B 少收的錢誰補？這正是**儲值代幣**存在的理由 —— 代幣是顧客先付錢、平台收錢、平台是負債方，所以跨店通用在會計上自洽。點數是店家單方面贈與，讓它跨店等於要求平台替攤商互相擔保，需要一套本規格範圍外的清分機制。

因此邊界是：**要跨攤共用的價值，用代幣；店家自己的回饋，用點數。** 若商業上仍要「夜市共同集點」，那是 `scope_type = 'market'` 的第二個產品，需要先定義清算規則 —— 已預留欄位，列入 **Q-3**。

**`balance_points >= 0` 不下 CHECK**，與 `credit_accounts` 一致，由條件式 UPDATE 保證。

### 5.2 `customer_loyalty_ledger_entries`（append-only 審計來源）

```ts
export const LOYALTY_ENTRY_TYPE = [
  "earn",   // 消費回饋（正）
  "redeem", // 折抵扣點（負）
  "expire", // 到期沖銷（負）
  "revoke", // 訂單取消/退款回沖（負，也可能正 = 回沖 redeem）
  "adjust", // 人工調整（正/負）
] as const;

export const customerLoyaltyLedgerEntries = sqliteTable(
  "customer_loyalty_ledger_entries",
  {
    id: text("id").primaryKey().$defaultFn(() => uuidv7()),

    accountId: text("account_id")
      .notNull()
      .references(() => customerLoyaltyAccounts.id, { onDelete: "restrict" }),

    entryType: text("entry_type").$type<LoyaltyEntryType>().notNull(),

    points: integer("points").notNull(),                       // 帶正負號
    balanceAfterPoints: integer("balance_after_points").notNull(), // 寫入當下快照

    // 去正規化，讓帳本自身可稽核（不必 JOIN 帳戶）
    scopeType: text("scope_type").$type<LoyaltyScopeType>().notNull(),
    scopeId: text("scope_id").notNull(),

    // 來源追溯。source_type='order' 時 source_id = orders.id（軟連結，
    // 刻意不設硬 FK：帳本必須比業務資料活得久，見 credit_ledger_entries 先例）
    sourceType: text("source_type").notNull(), // order | referral | expiry_job | admin_adjust
    sourceId: text("source_id"),

    // 折抵時實際折了多少錢，供對帳（redeem 以外為 NULL）
    redeemedValueCents: integer("redeemed_value_cents"),

    // 重放閘門：同一邏輯操作只記一次。NOT NULL，故用完整 UNIQUE 而非
    // partial unique —— 這比 CLAUDE.md 要求的
    // `WHERE idempotency_key IS NOT NULL` 更嚴格，且該規則對不可為 NULL
    // 的欄位自動滿足。
    idempotencyKey: text("idempotency_key").notNull().unique(),

    // 操作者（人工調整才有值）
    actorUserId: text("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reason: text("reason"),

    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    accountCreatedIdx: index("idx_loyalty_ledger_account_created").on(
      table.accountId,
      table.createdAt,
    ),
    entryTypeIdx: index("idx_loyalty_ledger_entry_type").on(table.entryType),
    sourceIdx: index("idx_loyalty_ledger_source").on(
      table.sourceType,
      table.sourceId,
    ),
  }),
);
```

**冪等鍵命名規約**（service 層強制，寫進常數而非散落字串）：

| 事件 | key |
|---|---|
| 訂單發點 | `loyalty:earn:order:{orderId}` |
| 訂單折抵 | `loyalty:redeem:order:{orderId}` |
| 訂單取消／退款回沖發點 | `loyalty:revoke:order:{orderId}` |
| 退款回沖折抵（把點還給顧客） | `loyalty:restore:order:{orderId}` |
| 到期沖銷 | `loyalty:expire:{accountId}:{yyyymmdd}` |
| 人工調整 | `loyalty:adjust:{accountId}:{callerSuppliedKey}` |
| 推薦獎勵（若 Q-6 選點數而非券） | `loyalty:referral:{referralId}:{referrer\|referee}` |

key 一律綁在**業務事件**上（訂單 id、帳戶+日期），不綁在請求上。這是重放安全的關鍵：同一張訂單被重送 100 次，只會有一筆 earn。

### 5.3 無交易下的記帳正確性（核心設計）

D1 **沒有** `db.transaction()`（跨呼叫的多敘述交易不存在）。但 D1 **有** `.batch()`，Cloudflare 文件將其定義為隱式交易 —— 同一個 batch 內的敘述要嘛全成功、要嘛全回滾。這個 repo 已經在 `CreditService.applyLedgerMovement`（`apps/api/src/features/credits/services/CreditService.ts:634`）用真實 D1 驗證過完整解法。點數照抄：

**步驟 1 — 確保帳戶存在（獨立呼叫，天然冪等）**

```sql
INSERT INTO customer_loyalty_accounts
  (id, customer_id, scope_type, scope_id, balance_points, lifetime_earned_points,
   version, status, created_at_ms, updated_at_ms)
VALUES (?, ?, 'restaurant', ?, 0, 0, 0, 'active', ?, ?)
ON CONFLICT (customer_id, scope_type, scope_id) DO NOTHING;
```

**步驟 2 — 兩敘述一個 batch（原子）**

```sql
-- 敘述 A：條件式 UPDATE。扣點時帶餘額 guard；發點時不帶。
UPDATE customer_loyalty_accounts
   SET balance_points = balance_points + ?,          -- 帶正負號
       lifetime_earned_points = lifetime_earned_points + ?,  -- earn 才 > 0
       version = version + 1,
       expires_at_ms = ?,                            -- rolling：每次異動往後推
       updated_at_ms = ?
 WHERE id = ?
   AND status = 'active'
   AND balance_points >= ?;                          -- 扣點才綁；發點傳 0
```

```sql
-- 敘述 B：changes() 是同一 batch 連線上「前一敘述」的影響列數。
-- guard 失敗 → changes()=0 → 這筆 INSERT 選不到列 → 不會憑空產生帳本。
-- 這裡刻意「不」寫 ON CONFLICT DO NOTHING：重複的 idempotency_key
-- 會讓整個 batch abort，連帶把敘述 A 的餘額異動一起回滾。
INSERT INTO customer_loyalty_ledger_entries
  (id, account_id, entry_type, points, balance_after_points,
   scope_type, scope_id, source_type, source_id, redeemed_value_cents,
   idempotency_key, actor_user_id, reason, created_at_ms)
SELECT ?, ?, ?, ?, balance_points, scope_type, scope_id, ?, ?, ?, ?, ?, ?, ?
  FROM customer_loyalty_accounts
 WHERE id = ? AND changes() = 1
RETURNING id, account_id, balance_after_points;
```

**步驟 3 — 重放與併發**

- `batch()` 丟例外（唯一鍵衝突）→ 以 `idempotency_key` 回查帳本；查到就回傳那筆 canonical row（**成功**，不是錯誤）。查不到才往上丟。
- `updateResult.meta.changes === 0` → 依情境丟 `conflict("點數不足", "INSUFFICIENT_POINTS")` 或 `conflict(..., "LOYALTY_ACCOUNT_MOVEMENT_FAILED")`。
- 兩個併發扣點：`balance_points >= ?` 是 SQL 層的原子判斷，不是先讀後寫，因此不可能超扣。

**為什麼這樣就夠**：餘額與帳本的每一次配對變動都在同一個 batch 內，不存在「餘額動了但帳本沒寫」或反之的中間態。剩下唯一的漂移來源是有人繞過 service 直接改資料庫 —— 這用 §5.4 的偵測抓。

**明確不做的事**：不做讀-改-寫（`SELECT balance` → 在 JS 算 → `UPDATE ... SET balance = <算好的值>`）。這是唯一會壞掉的寫法，也是最容易被寫出來的寫法，因此列為 code review 檢查項。

### 5.4 漂移偵測

沿用 `CreditService.findBalanceLedgerDrift` 的形狀，`LoyaltyService.findBalanceLedgerDrift()`：

```sql
SELECT a.id, a.balance_points, COALESCE(SUM(e.points), 0) AS ledger_sum
  FROM customer_loyalty_accounts a
  LEFT JOIN customer_loyalty_ledger_entries e ON e.account_id = a.id
 GROUP BY a.id
HAVING a.balance_points != COALESCE(SUM(e.points), 0)
```

（實作走 Drizzle Layer 2 `sql` 樣板 + schema 參照，不用字串 SQL。）由每日 cron 呼叫，非空即發 Slack 告警，並以 `GET /api/v1/admin/loyalty/drift`（role 0）暴露。

### 5.5 `restaurant_loyalty_settings`（每租戶規則）

```ts
export const restaurantLoyaltySettings = sqliteTable(
  "restaurant_loyalty_settings",
  {
    restaurantId: text("restaurant_id")
      .primaryKey()
      .references(() => restaurants.id, { onDelete: "cascade" }),

    isEnabled: integer("is_enabled").notNull().default(0),

    // 賺：每消費 100 cents（= 1 元）給幾點。預設 1。
    earnPointsPer100Cents: integer("earn_points_per_100_cents").notNull().default(1),
    // 用：1 點折抵幾 cents。預設 1（= 0.01 元）。
    redeemCentsPerPoint: integer("redeem_cents_per_point").notNull().default(1),

    minRedeemPoints: integer("min_redeem_points").notNull().default(100),
    // 單筆最多折抵訂單金額的幾 bps。預設 5000 = 50%。
    maxRedeemRatioBps: integer("max_redeem_ratio_bps").notNull().default(5000),

    expiryMonths: integer("expiry_months").notNull().default(12),

    // 發點掛在訂單哪個狀態。Phase 2 只接受 'paid'，欄位存在是為了
    // 讓未來放寬時不必改 schema。
    earnOnStatus: text("earn_on_status").notNull().default("paid"),

    // 推薦獎勵是否由本店的點數支付（Q-6）。預設 0 = 走平台券。
    referralRewardInPoints: integer("referral_reward_in_points").notNull().default(0),

    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull().default(sql`(unixepoch('now') * 1000)`),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull().default(sql`(unixepoch('now') * 1000)`),
  },
);
```

**全部是純量欄位，沒有 JSON config 欄位。** 依 CLAUDE.md，JSON config 只放非機密旗標與偏好；這裡的每一項都是會被 SQL 條件用到的規則值，放進 JSON 只會讓查詢退化成字串解析。

### 5.6 幣值換算與取整（決策）

全部整數運算，明確定義取整方向：

```
發點： points = floor(eligibleAmountCents * earnPointsPer100Cents / 100)
折抵： discountCents = min(
         points * redeemCentsPerPoint,
         floor(orderSubtotalCents * maxRedeemRatioBps / 10000)
       )
```

**兩邊都 floor**，方向都對平台／店家有利，避免「拆單刷小數」的套利。

- `eligibleAmountCents` 定義為**商品小計**，不含運費、服務費、已折抵金額（券折 + 點折）。理由：對已折抵的部分再回饋等於折上加折，且會讓 revoke 的計算變成非線性。
- 預設值 `earn=1, redeem=1` → 消費 100 元得 100 點，100 點折 1 元 → **1% 回饋**。這是台灣零售常見水位，作為預設合理，但金額是商業決策 → **Q-4**。
- `min_redeem_points = 100` 讓最小折抵單位是 1 元，避免 1 點 1 分的碎片操作。

### 5.7 發點／回沖的時機（決策）

`ORDER_STATUS` 有 `pending | confirmed | preparing | ready | delivered | paid | cancelled | refunded`。

| 事件 | 動作 | 冪等鍵 |
|---|---|---|
| 訂單進入 `paid` | `earn`，`points = floor(...)` | `loyalty:earn:order:{orderId}` |
| 訂單進入 `cancelled` 或 `refunded`（曾經 `paid`） | `revoke`，把該單發過的點扣回；扣到 0 為止，**不允許餘額變負** | `loyalty:revoke:order:{orderId}` |
| 同上，若該單曾折抵點數 | `restore`（`entry_type='revoke'`，points 為正），把折掉的點還給顧客 | `loyalty:restore:order:{orderId}` |

**選 `paid` 而非 `delivered`**：外帶／自取流程未必經過 `delivered`，而未付款就發點是可被直接濫用的（下單→拿點→取消）。錢真的收到才是唯一沒有歧義的門檻。

**回沖不允許負餘額**：顧客可能已經把點花掉了。`revoke` 的條件式 UPDATE 用 `balance_points >= ?` guard；guard 失敗時**不**丟 500，而是以實際可扣額（`MIN(balance_points, owed)`）記一筆 `revoke` 並在 `reason` 記下差額，同時寫 audit log。這是一個刻意的商業決策：把回沖不足變成可見的壞帳，而不是把顧客帳戶推成負數。**列入 Q-11 供拍板**（另一個選項是允許負餘額、直到未來發點時補平）。

---

## 6. Data Model — 推薦碼

### 6.1 `customer_referral_codes`

```ts
export const customerReferralCodes = sqliteTable(
  "customer_referral_codes",
  {
    customerId: text("customer_id")
      .primaryKey()
      .references(() => customers.id, { onDelete: "cascade" }),

    // Crockford base32 8 碼（排除 I/L/O/U），前綴 'MM'。例：MM-7K3QX9AB
    code: text("code").notNull(),

    isActive: integer("is_active").notNull().default(1),
    qualifiedCount: integer("qualified_count").notNull().default(0), // 物化計數

    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull().default(sql`(unixepoch('now') * 1000)`),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull().default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    codeIdx: uniqueIndex("idx_referral_codes_code").on(table.code),
  }),
);
```

碼放獨立表而非 `customers` 欄位：`customers` 是每次認證請求都會讀的熱路徑列（`canonicalCustomerAuthMiddleware` 每次還會 UPDATE `last_seen_at_ms`），Phase 1 已明確把它保持窄。推薦碼是低頻讀取。

**懶建立**：顧客第一次呼叫 `GET /customer/referral-code` 才產碼，碰撞就重試（最多 5 次）。

### 6.2 `customer_referrals`

```ts
export const REFERRAL_STATUS = ["pending", "qualified", "rewarded", "rejected"] as const;
export const REFERRAL_REJECT_REASON = [
  "self_referral", "duplicate_device", "duplicate_ip",
  "referrer_limit_exceeded", "unverified_phone", "order_below_threshold", "manual",
] as const;

export const customerReferrals = sqliteTable(
  "customer_referrals",
  {
    id: text("id").primaryKey().$defaultFn(() => uuidv7()),

    referrerCustomerId: text("referrer_customer_id")
      .notNull().references(() => customers.id, { onDelete: "cascade" }),
    referredCustomerId: text("referred_customer_id")
      .notNull().references(() => customers.id, { onDelete: "cascade" }),

    code: text("code").notNull(), // 使用當下的碼快照（碼之後可能停用）

    status: text("status").$type<ReferralStatus>().notNull().default("pending"),
    rejectedReason: text("rejected_reason").$type<ReferralRejectReason>(),

    qualifyingOrderId: text("qualifying_order_id"), // 使其達標的那張訂單
    qualifiedAtMs: integer("qualified_at_ms", { mode: "timestamp_ms" }),
    rewardedAtMs: integer("rewarded_at_ms", { mode: "timestamp_ms" }),

    // 獎勵成果（走券管線時記 user_coupons.id；走點數時記 ledger entry id）
    referrerRewardRef: text("referrer_reward_ref"),
    referredRewardRef: text("referred_reward_ref"),

    // 發獎的重放閘門。可為 NULL（尚未發獎），因此依 CLAUDE.md 規範
    // 使用 partial unique index。
    rewardIdempotencyKey: text("reward_idempotency_key"),

    // 風控訊號（註冊當下擷取）
    signupIp: text("signup_ip"),
    signupDeviceHash: text("signup_device_hash"),

    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull().default(sql`(unixepoch('now') * 1000)`),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull().default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    // 一個人一輩子只能被推薦一次
    referredUniqueIdx: uniqueIndex("idx_referrals_referred_unique").on(
      table.referredCustomerId,
    ),
    referrerIdx: index("idx_referrals_referrer_status").on(
      table.referrerCustomerId, table.status,
    ),
    rewardKeyIdx: uniqueIndex("idx_referrals_reward_key")
      .on(table.rewardIdempotencyKey)
      .where(sql`${table.rewardIdempotencyKey} IS NOT NULL`),
    deviceIdx: index("idx_referrals_device").on(table.signupDeviceHash),
    statusScanIdx: index("idx_referrals_status_created").on(
      table.status, table.createdAt,
    ),
  }),
);
```

DDL 額外帶一個 CHECK（Drizzle 無法表達，migration 手寫）：

```sql
CHECK (referred_customer_id <> referrer_customer_id)
```

### 6.3 防濫用（決策）

四層，由便宜到昂貴：

| 層 | 機制 | 擋住什麼 |
|---|---|---|
| 1. DB 約束 | `CHECK (referred <> referrer)`；`referred_customer_id` UNIQUE | 自我推薦；重複領取 |
| 2. 認領前置條件 | 呼叫 `POST /customer/referrals/claim` 時，referee 的 `primary_phone` 必須非空（代表走過 OTP 驗證）；帳號建立時間距今 < 7 天 | 用舊帳號回頭領新人獎勵 |
| 3. 發獎時機 | **referee 首張訂單進入 `paid` 且商品小計 ≥ 門檻**才 `qualified`，`qualified` 後才發獎。註冊即發＝零成本刷 | 大量註冊空帳號 |
| 4. 速率／裝置 | KV 計數：同 `signup_device_hash` 每 30 天最多 1 次成功推薦；同 `signup_ip` 每日最多 3 次；referrer 終身成功上限（預設 20，可設定） | 一人多機／同網段批次 |

**「註冊即發」被明確排除**：註冊的邊際成本近乎零（尤其 OAuth 上線後一鍵就有帳號），把獎勵綁在註冊等於把獎勵預算送給腳本。綁在「首單付款完成」才讓刷帳號需要真實付出金錢，而那筆金錢本來就是店家的營收。

**發獎的重放安全**：`qualified → rewarded` 用條件式 UPDATE 認領，而非先讀後寫：

```sql
UPDATE customer_referrals
   SET status = 'rewarded',
       reward_idempotency_key = ?,   -- 'referral-reward:{referralId}'
       rewarded_at_ms = ?,
       updated_at_ms = ?
 WHERE id = ? AND status = 'qualified' AND reward_idempotency_key IS NULL;
```

`changes() = 1` 才實際去發獎。這道 guard 是必要的：`CouponService.distributeCoupon` 的去重靠 `user_coupons_holder_live_unique`（`(coupon_id, owner_customer_id) WHERE state IN ('issued','reserved')`），**這只在券還沒被用掉時擋得住**；顧客用掉券之後重試會發第二張。conditional claim 補上這個缺口。

### 6.4 獎勵形式（決策）

**預設：發平台券，走既有 `CouponService.distributeCoupon`。**

推薦是**平台獲客**行為（拉一個人進 MakanMasak，不是拉進某一攤），成本理應由平台承擔；點數是店家負債，平台不該替店家決定要送多少。因此：

- 建立一張平台券（`coupons.restaurant_id IS NULL`），`code` 例如 `REFERRAL-NEW`、`REFERRAL-BONUS`。
- 發放呼叫 `distributeCoupon({ couponId, distributionType: "auto", targetType: "user", targetCriteria: { customerIds: [id] }, expiresAt })`。

需要注意的既有行為（已查證，不是猜測）：

- `distributeCoupon` **每次呼叫都會寫一列 `coupon_distributions`** 批次列。一次推薦兩個受益人（referrer + referee）→ 建議合成**一次**呼叫傳兩個 `customerIds`，只寫一列批次列。
- 券的金額欄位是 `discount_percentage_bps`（percentage 型，1500 = 15%）**XOR** `discount_value_cents`（fixed 型）。歷史上的 `coupons_cents_sync_ai/au` 觸發器**已在 `migrations/0087_money_cents_cutover.sql` 被 DROP，且浮點欄位已刪除**；`migrations_fresh` 這條軌上 `coupons` 只剩兩支 tenant FK guard 觸發器（`coupons_restaurant_guard_bi/bu`）。**沒有任何東西會替你把金額同步進 `_cents` 欄位** —— 建券時必須自己二選一寫對。這就是 memory 裡那個「`_cents` trigger 陷阱」的正確現況：陷阱本身已拆除，留下的是「必須手動寫對」這件事。
- `user_coupons` 沒有 `source` 欄位，也沒有回連 `coupon_distributions` 的 FK。因此「這張券是哪次推薦發的」只能從 `customer_referrals.referrer_reward_ref` 這一側查。這是接受的取捨（不動既有 schema）。

**替代方案（需拍板）**：由 referee 首單的那家店以點數支付獎勵 —— 語意上店家為拉新客付費，也自洽，但需要跟攤商簽商業協議。`restaurant_loyalty_settings.referral_reward_in_points` 已預留開關。列入 **Q-6**。

---

## 7. Data Model 與流程 — OAuth

### 7.1 決策：擴充 `customer_auth_identities`，不新開 `customer_oauth_identities`

Phase 1 規格 §11 寫「新開 `customer_oauth_identities`」，但那是在 `customer_auth_identities` 存在之前寫的。現況（`packages/database/migrations_fresh/0000_baseline_strict.sql:3810`，STRICT）：

```sql
CREATE TABLE `customer_auth_identities` (
  `id` text PRIMARY KEY NOT NULL,
  `customer_id` text NOT NULL,
  `provider` text NOT NULL,
  `provider_uid` text NOT NULL,
  `secret_hash` text,
  `encrypted_payload` text,
  `verified_at_ms` integer,
  `last_used_at_ms` integer,
  `created_at_ms` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  `updated_at_ms` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
) STRICT;
CREATE UNIQUE INDEX `customer_auth_identities_provider_uid_idx` ON `customer_auth_identities` (`provider`, `provider_uid`);
CREATE INDEX `customer_auth_identities_customer_idx` ON `customer_auth_identities` (`customer_id`);
CREATE UNIQUE INDEX `customer_auth_identities_one_password_idx` ON `customer_auth_identities` (`customer_id`) WHERE `provider` = 'password';
```

四個理由：

1. **它已經是多 provider 的形狀。** `provider` 是自由文字、無 CHECK；`(provider, provider_uid)` UNIQUE；而 `one_password_idx` 特意把「一人一組密碼」的 1:1 約束限定在 `provider='password'` —— 如果這張表只打算裝密碼，這個 `WHERE` 子句沒有存在的必要。
2. **`encrypted_payload` 目前沒有任何寫入者。** 全 repo 對這張表只有六處讀寫，`provider` 值只寫過 `'password'` 一種，`encrypted_payload` 從未被填。它就是為 OAuth token 預留的空位。
3. **唯一性保證不該被拆成兩處。** 分表後「這個 provider uid 是誰」會有兩條查找路徑，登入流程要查兩張表，而 `(provider, provider_uid)` 的全域唯一性就無法由單一索引保證。
4. **ALTER TABLE ADD COLUMN 在 STRICT 表上可行且保留 STRICT**，不需要 recreate-table 舞步，因此擴充成本比新開一張表還低。

### 7.2 `customer_auth_identities` 的擴充（migration 0017）

新增欄位（皆可為 NULL，不影響既有 `'password'` 列）：

| 欄位 | 型別 | 說明 |
|---|---|---|
| `provider_email` | TEXT | 連結當下 provider 回報的 email（**快照，非可信憑證**，見 §7.4） |
| `provider_email_verified` | INTEGER | provider 是否宣稱該 email 已驗證（0/1/NULL） |
| `provider_display_name` | TEXT | 顯示用 |
| `provider_avatar_url` | TEXT | 顯示用 |
| `scopes` | TEXT | 空白分隔的 scope 清單（**非機密**） |
| `token_expires_at_ms` | INTEGER | provider access token 到期時刻（**只存時刻，不存 token**） |
| `revoked_at_ms` | INTEGER | 顧客解除連結時設定；列保留供審計 |

新增索引：

```sql
CREATE UNIQUE INDEX idx_customer_auth_identities_customer_provider_live
  ON customer_auth_identities (customer_id, provider)
  WHERE revoked_at_ms IS NULL;
```

一位顧客每個 provider 最多一個有效連結。這條索引也順帶讓 `one_password_idx` 變得多餘，但**不移除它** —— 移除既有 partial unique 需要驗證沒有回歸，屬於獨立的清理工作。

**provider 常數（新增）**。目前 `'password'` 這個字串在五處 SQL 裡硬寫，沒有任何常數清單。依既有慣例（`CUSTOMER_CONSENT_TYPES` 放在 `@makanmasak/shared-types` 並以 `z.enum(...)` 消費），新增：

```ts
// packages/shared-types/src/auth-providers.ts
export const CUSTOMER_AUTH_PROVIDERS = ["password", "line", "google", "apple"] as const;
export type CustomerAuthProvider = (typeof CUSTOMER_AUTH_PROVIDERS)[number];
```

並把那五處硬寫的 `'password'` 改為引用常數（可獨立成一支小 PR，先於 OAuth 出貨）。

### 7.3 Workers 上的授權碼流程

三個 provider 都走 **Authorization Code + PKCE(S256) + state**。Workers 沒有 session storage，所以 state 與 code_verifier 放 KV。

**Step 1 — `GET /api/v1/customer/auth/oauth/:provider/start`**（public）

1. 產生 `state`（32 bytes `crypto.getRandomValues`，base64url）與 `code_verifier`（43–128 字元），`code_challenge = base64url(SHA-256(verifier))`。
2. 若請求帶有效的顧客 access token（走 `optionalCanonicalCustomerAuthMiddleware`），把 `linkCustomerId` 一併記入 —— 這是「已登入顧客主動連結 LINE」的路徑。
3. 寫 KV：`oauth_state:{provider}:{state}` → `{ codeVerifier, nonce, redirectTo, linkCustomerId? }`，**TTL 600 秒**。
4. `302` 到 provider 授權端點。

**Step 2 — `GET|POST /api/v1/customer/auth/oauth/:provider/callback`**（public）

> Apple 用 `response_mode=form_post`，回呼是 **POST**，其他兩家是 GET。同一個 handler 必須兩種都接。

1. 取出並**立刻刪除** KV state（一次性；重放的 callback 直接 400 `OAUTH_STATE_INVALID`）。
2. Token exchange：`POST` 到 provider token endpoint，帶 `grant_type=authorization_code`、`code`、`redirect_uri`、`client_id`、`client_secret`、`code_verifier`。
3. 驗證 `id_token`：抓 provider JWKS（KV 快取 24 小時）、驗簽、驗 `iss` / `aud` / `exp` / `nonce`。**三家都要驗，不可因為 token 是從 HTTPS 直接拿到就跳過** —— Apple 尤其必須驗，因為它的使用者資料只在 id_token 裡。
4. `providerUid = id_token.sub`。
5. 進入 §7.4 的身分解析。

**Step 3 — 身分解析與 session**

```
查 customer_auth_identities WHERE provider = ? AND provider_uid = ? AND revoked_at_ms IS NULL
├─ 命中
│   ├─ 有 linkCustomerId 且 ≠ identity.customer_id → 409 OAUTH_IDENTITY_TAKEN
│   └─ 否則 → UPDATE last_used_at_ms；issueCustomerSession(c, identity.customer_id)
└─ 未命中
    ├─ 有 linkCustomerId（已登入顧客主動連結）
    │   → INSERT identity(customer_id = linkCustomerId, verified_at_ms = now)
    │   → issueCustomerSession(c, linkCustomerId)
    └─ 無 linkCustomerId
        ├─ provider_email 對到某個 status='active' 顧客的 primary_email
        │   → 不建帳、不自動合併
        │   → issueBindingToken(env, { provider, providerUid })（10 分鐘）
        │   → 回 { needsLinking: true, bindingToken, maskedEmail }
        └─ 對不到
            → 建新 customers 列 + identity 列 → issueCustomerSession
```

**Step 4 — `POST /api/v1/customer/auth/oauth/link`**（public）

Body：`{ bindingToken, verification: { method: "otp" | "password", ... } }`。驗過 binding token（`type === "customer_bind"`）與既有身分驗證後，才寫入 identity 列並發 session。

### 7.4 帳號合併／連結（安全關鍵）

**絕不以 provider 回傳的 email 自動合併帳號。** 這是本節唯一不可妥協的決策：

- LINE 的 email 需要另外申請權限，且回傳值**不保證已驗證**。
- 攻擊路徑很短：在某 provider 註冊一個宣稱是受害者 email 的帳號 → 用它登入 MakanMasak → 自動合併 → 接管受害者的訂單歷史、點數、儲值代幣。
- 因此 email 對得上時，只用來**提示**（回傳遮罩後的 email，例如 `e***@d***.net`），實際連結必須由使用者證明他控制既有帳號（OTP 或密碼）。

這正是 `issueBindingToken` 存在的理由，而 `canonicalCustomerAuthMiddleware` 已經在 `isCustomerBindingTokenPayload` 那裡明確擋掉 binding token 存取顧客路由 —— 護欄已經在，只差把流程接上。

**寫 `primary_email` 時的既有陷阱**：`idx_customers_primary_email` 是 partial unique（`WHERE primary_email IS NOT NULL AND status = 'active'`），但被軟刪除的列仍持有那個值。既有的 `findOrCreateCustomerByPhone` 對 phone 做了「先清掉 deleted 列的 primary_phone」的動作；OAuth 建帳寫 email 時**必須做一模一樣的事**，否則會撞唯一索引。

**解除連結**：`DELETE /customer/auth/identities/:id` 設 `revoked_at_ms`（不 DELETE，保留審計）。**必須拒絕移除最後一個登入方式** —— 若顧客沒有 `primary_phone`（OTP 可登入）也沒有 `password` identity，且要移除的是唯一的 OAuth identity，回 `409 LAST_AUTH_METHOD`。

### 7.5 三家 provider 的差異

| | LINE Login | Google | Apple Sign In |
|---|---|---|---|
| Authorize | `https://access.line.me/oauth2/v2.1/authorize` | `https://accounts.google.com/o/oauth2/v2/auth` | `https://appleid.apple.com/auth/authorize` |
| Token | `https://api.line.me/oauth2/v2.1/token` | `https://oauth2.googleapis.com/token` | `https://appleid.apple.com/auth/token` |
| JWKS | `https://api.line.me/oauth2/v2.1/certs` | `https://www.googleapis.com/oauth2/v3/certs` | `https://appleid.apple.com/auth/keys` |
| scope | `openid profile email` | `openid profile email` | `name email` |
| email | **需在 LINE Developers 另外申請權限**；可能拿不到 | 一般都有，帶 `email_verified` | 只在**首次**授權回傳；使用者可選 Private Relay 匿名信箱 |
| client secret | 靜態 Channel Secret | 靜態字串 | **不是靜態字串** —— 要用 ES256 私鑰（.p8）現簽一個最長 6 個月的 JWT |
| callback | GET | GET | **POST**（`response_mode=form_post`） |
| 必要性 | 台灣主力，優先 | 次之 | 若上架 iOS App 且提供其他第三方登入則為**強制** |

**Apple 的三個坑（都要在實作前處理）**：

1. `client_secret` 必須在 Worker 內用 WebCrypto `ECDSA / P-256 / SHA-256` 現簽（`iss=TEAM_ID`, `sub=CLIENT_ID`, `aud=https://appleid.apple.com`, `kid=KEY_ID`）。快取到 KV，到期前重簽。
2. 使用者的 `name` / `email` **只在第一次授權回傳**，之後永遠拿不到 → 第一次就必須存進 `provider_display_name` / `provider_email`。
3. Private Relay 信箱（`xxx@privaterelay.appleid.com`）**不可**用來對照既有帳號，也不該當作可送信的地址。

**Secrets（一律 `wrangler secret put`，不進 `wrangler.toml [vars]`，不進任何 JSON config 欄位）**：

```
LINE_LOGIN_CHANNEL_SECRET      # secret
GOOGLE_OAUTH_CLIENT_SECRET     # secret
APPLE_SIGN_IN_PRIVATE_KEY      # secret（.p8 內容）
```

非機密的 client id 可放 `[vars]`：`LINE_LOGIN_CHANNEL_ID`、`GOOGLE_OAUTH_CLIENT_ID`、`APPLE_CLIENT_ID`、`APPLE_TEAM_ID`、`APPLE_KEY_ID`。

**Redirect URI** 三家都要在各自 console 白名單登記，且必須逐字相符：

```
https://api.makanmasak.com/api/v1/customer/auth/oauth/line/callback
https://api.makanmasak.com/api/v1/customer/auth/oauth/google/callback
https://api.makanmasak.com/api/v1/customer/auth/oauth/apple/callback
```

（dev 另外登記 `http://localhost:8787/...`。）

### 7.6 provider token 的存放（決策）

**Phase 2 預設不留存 provider 的 access / refresh token。**

我們需要的只是身分（`sub`），不需要代表使用者去呼叫 provider API。不存就沒有洩漏面，也不需要輪替。`token_expires_at_ms` 只記時刻，不記值。

若未來要用 LINE 推播或好友狀態而必須留存，則**只能**寫入 `encrypted_payload`，用既有 helper：

```ts
import { encrypt, decrypt } from "@makanmasak/utils";
// AES-256-GCM + PBKDF2(100k, SHA-256)，輸出 `${ivB64}:${cipherB64}`，單一 TEXT 欄位
const payload = await encrypt(JSON.stringify(tokens), env.ENCRYPTION_KEY, "customer-oauth-tokens");
```

用 `salt = "customer-oauth-tokens"` 做 domain separation（helper 支援第三參數）。注意 `decrypt` 對不含 `:` 的輸入會**靜默**退回 `atob()` 並只印 warning —— 不要依賴它對畸形輸入拋錯。

> **這件事被 production 環境擋住**：`makanmasak-api-prod` 目前只有 3 個 secret（`CLOUDFLARE_API_TOKEN`、`JWT_SECRET`、`QR_SIGNING_KEY`），**`ENCRYPTION_KEY` 沒有設定**，而 `apps/api/src/types/env.ts` 把它宣告為必填。任何走 `encrypt()` 的路徑在線上都會炸。這是「預設不留存 token」在工程上額外的好處：Phase 2 不會被這件事擋住。若 Q-10 拍板要留存，補這個 secret 是前置條件。

---

## 8. Migration Plan

手寫 sequential SQL 放 `packages/database/migrations_fresh/`，接在現有最大編號 **0014** 之後。**不使用 `pnpm db:generate`** —— 它的 snapshot 已過期且遇到欄位重新命名會進互動模式。所有新表**手動加 `STRICT`**（drizzle-kit 不會、也不該替我們加）。

| 檔名 | 內容 | 風險 |
|---|---|---|
| `0015_customer_loyalty_points.sql` | `customer_loyalty_accounts`、`customer_loyalty_ledger_entries`、`restaurant_loyalty_settings` + 索引 | 純新增，無讀寫者 |
| `0016_customer_referrals.sql` | `customer_referral_codes`、`customer_referrals` + 索引 + `CHECK (referred <> referrer)` | 純新增 |
| `0017_customer_oauth_identity_columns.sql` | `ALTER TABLE customer_auth_identities ADD COLUMN` × 7 + 1 條 partial unique index | 加欄位，既有列全部得到 NULL；**不需要 recreate-table，STRICT 自動保留** |
| `0018_module_key_partnerships_rename.sql` | `module_overrides` JSON 改鍵 `loyalty` → `partnerships` | **唯一動到既有資料的一支**；今天命中 0 列 |

四支都是 `freshOnly`（management-api 的資料庫沒有 `customers`、`orders`、`coupons`），必須在 `packages/database/migration-dual-track.json` 的 `freshOnly` 陣列補上四筆理由，再跑 `pnpm check:migration-dual-track` 與 `pnpm check:strict-tables`。

### 0018 的 SQL（唯一需要小心的一支）

```sql
-- module_overrides 的鍵必須跟著 MODULES 常數改名，否則既有 override
-- 會被 resolveModule 讀成「鍵不存在」而靜默落回方案預設。
-- json_extract 會把 JSON boolean 取成 0/1 整數，直接 json_set 回去會
-- 寫成數字而非 boolean（ModuleMap 的型別是 boolean），因此用 CASE + json()
-- 明確還原成 JSON 布林。
UPDATE shop_subscriptions
   SET module_overrides = json_remove(
         json_set(
           module_overrides,
           '$.partnerships',
           json(CASE
                  WHEN json_extract(module_overrides, '$.loyalty') IN (1, 'true')
                  THEN 'true' ELSE 'false'
                END)
         ),
         '$.loyalty'
       ),
       updated_at_ms = (unixepoch('now') * 1000)
 WHERE module_overrides IS NOT NULL
   AND json_valid(module_overrides)
   AND json_extract(module_overrides, '$.loyalty') IS NOT NULL;
```

**套用到 production 前的固定程序**（CLAUDE.md）：`wrangler d1 export` 在這個資料庫上會因 fts5 虛擬表而失敗，所以要從 `sqlite_master` 抓 `sql` 自行組出 schema 副本，在副本上重放並檢查末態，才對 `--remote` 執行，再以 `pragma_table_info` 驗證，最後 `INSERT OR IGNORE INTO d1_migrations`。0018 之後**必須手動刪 `subscription:{restaurantId}` KV key**（見 §3.4）。

### 一個必須記錄的現況落差

production 的實際表定義**大多不是 STRICT**，即使 baseline 宣稱 117 張全是。實測（唯讀）：

```
orders                   STRICT ✓
credit_ledger_entries    STRICT ✓
customers                ✗
customer_auth_identities ✗
credit_accounts          ✗
coupons                  ✗
user_coupons             ✗
shop_subscriptions       ✗
```

這與 CLAUDE.md 記載的「production 的 schema 不是從 baseline 來的」一致。對本規格的影響：

- **0015 / 0016 建立的新表會是 STRICT**（migration 自己寫的），所以點數與推薦的型別安全是有的。
- **0017 加欄位到一張非 STRICT 的表**，加完仍非 STRICT。`provider_email_verified` 之類的 INTEGER 欄位在 production 上有可能被寫進 TEXT 而不報錯 → service 層必須自己驗型別，不能依賴 DB。
- 這條落差本身不是本規格要修的，但**應另開 issue**，否則會被下一份規格再發現一次。

---

## 9. API 端點

### 9.1 點數 — 顧客端（`canonicalCustomerAuthMiddleware`）

```
GET    /api/v1/customer/loyalty/accounts
       → { success, data: [{ scopeType, scopeId, restaurantName, balancePoints,
                             lifetimeEarnedPoints, expiresAtMs }] }

GET    /api/v1/customer/loyalty/accounts/:restaurantId/ledger?cursor=&limit=
       → { success, data: [{ id, entryType, points, balanceAfterPoints,
                             sourceType, sourceId, createdAtMs }], pagination }

GET    /api/v1/customer/loyalty/quote?restaurantId=&subtotalCents=&points=
       → { success, data: { maxRedeemablePoints, discountCents, minRedeemPoints } }
       折抵前的試算，避免前端自己複製取整規則
```

### 9.2 點數 — 店家端（`authMiddleware` + `requireRole([0,1])` + `moduleGate("loyalty")`）

```
GET    /api/v1/loyalty/settings
PUT    /api/v1/loyalty/settings
       body { isEnabled, earnPointsPer100Cents, redeemCentsPerPoint,
              minRedeemPoints, maxRedeemRatioBps, expiryMonths }

GET    /api/v1/loyalty/members?cursor=&limit=&sort=balance|lifetime
GET    /api/v1/loyalty/members/:customerId/ledger?cursor=&limit=

POST   /api/v1/loyalty/adjust
       body { customerId, points, reason, idempotencyKey }
       → 寫 entry_type='adjust'，actor_user_id = 操作者
       requireRole([0,1])；一定要有 idempotencyKey（400 若缺）

GET    /api/v1/loyalty/stats
       → { activeMembers, outstandingPoints, pointsIssued30d,
           pointsRedeemed30d, pointsExpired30d, estimatedLiabilityCents }
```

### 9.3 推薦碼

```
GET    /api/v1/customer/referral-code            authed；懶建立
       → { success, data: { code, shareUrl, qualifiedCount } }

POST   /api/v1/customer/referrals/claim          authed
       body { code, deviceHash? }
       → 201 { success, data: { referralId, status: "pending" } }
       → 400 SELF_REFERRAL / ALREADY_REFERRED / REFERRAL_CODE_INVALID
       → 429 REFERRAL_RATE_LIMITED

GET    /api/v1/customer/referrals                authed
       → 我推薦了誰（遮罩顯示名）、各自狀態、已獲得的獎勵

GET    /api/v1/admin/referrals?status=&cursor=   role 0；風控審閱
POST   /api/v1/admin/referrals/:id/reject        role 0；body { reason }
```

### 9.4 OAuth

```
GET      /api/v1/customer/auth/oauth/:provider/start     public
         query { redirectTo? }；帶 access token 時進入「連結既有帳號」模式
         → 302

GET|POST /api/v1/customer/auth/oauth/:provider/callback  public
         → 200 { success, data: { accessToken, expiresIn, customer } }          （登入成功）
         → 200 { success, data: { needsLinking: true, bindingToken, maskedEmail } }（需驗證後連結）
         → 400 OAUTH_STATE_INVALID / OAUTH_CODE_INVALID
         → 409 OAUTH_IDENTITY_TAKEN

POST     /api/v1/customer/auth/oauth/link                public
         body { bindingToken, method: "otp"|"password", otp?|password?, identifier }
         → 200 { accessToken, expiresIn, customer }
         → 401 BINDING_TOKEN_INVALID / BINDING_TOKEN_EXPIRED

GET      /api/v1/customer/auth/identities                authed
         → [{ id, provider, providerDisplayName, providerEmail(遮罩),
              createdAtMs, lastUsedAtMs }]

DELETE   /api/v1/customer/auth/identities/:id            authed
         → 204；409 LAST_AUTH_METHOD 若這是最後一個登入方式
```

**所有錯誤走統一格式**（`{ success:false, error:{ code, message, details? } }`），由 route handler 丟 `ApiError` 工廠函式（`badRequest` / `unauthorized` / `forbidden` / `conflict` / `notFound`），交給全域 `app.onError` 格式化。**route handler 內不寫 try-catch 做錯誤格式化。**

**限流**：OAuth start/callback 沿用既有的私有 helper 形狀（`enforcePasswordRateLimit(c, purpose, identifier)`，KV `RATE_LIMIT_KV`），新增 purpose `"oauth_start"` / `"oauth_callback"` / `"oauth_link"`。注意全域的 `geoIntelligentRateLimitMiddleware` 的 `customLimits` 只認 `/api/v1/auth/*`，**不涵蓋 `/api/v1/customer/*`**，所以不能指望它。

---

## 10. Service 層

| Service | 位置 | 責任 |
|---|---|---|
| `LoyaltyService` | `apps/api/src/features/loyalty/services/LoyaltyService.ts` | `earn` / `redeem` / `revoke` / `restore` / `adjust` / `expireStaleAccounts` / `findBalanceLedgerDrift` / `quote`。內部只有一個 `applyLoyaltyMovement` 私有方法（§5.3 的兩敘述 batch） |
| `LoyaltySettingsService` | 同資料夾 | 每租戶規則 CRUD + KV 快取（TTL 300s，與 `moduleGate` 同款），寫入後失效 |
| `ReferralService` | `apps/api/src/features/referrals/services/ReferralService.ts` | 產碼、`claim`、風控判定、`qualify`（訂單掛鉤）、`issueReward`（呼叫 `CouponsService.distributeCouponToAudience`） |
| `CustomerOAuthService` | `apps/api/src/features/customer/services/CustomerOAuthService.ts` | provider 設定表、authorize URL 組裝、token exchange、id_token 驗簽（JWKS + KV 快取）、身分解析 |
| `AppleClientSecretService` | 同資料夾 | ES256 現簽 Apple client secret + KV 快取 |

**訂單掛鉤點**：`paid` / `cancelled` / `refunded` 三個狀態轉換要呼叫 `LoyaltyService` 與 `ReferralService.qualify`。**這些呼叫必須是 best-effort 且不阻擋訂單狀態轉換** —— 點數寫失敗不該讓一筆已收款的訂單卡住。做法：狀態轉換成功後以 `c.executionCtx.waitUntil()` 觸發，失敗時寫 audit log + Slack 告警；因為冪等鍵綁在訂單 id，補償只要重放同一個 key 即可。

**必須從 `apps/api/src/features/customer/routes/index.ts` 匯出的既有私有函式**（OAuth 要重用）：`findOrCreateCustomerByPhone` 的同族做法、`toCustomerSummary`、`requireCustomer`、`enforcePasswordRateLimit`。建議先做一支純重構 PR 把它們搬到 `features/customer/services/customer-lookup.ts` 並匯出，OAuth 的 PR 才不會夾帶大範圍搬移。

**資料庫查詢一律走 Drizzle Layer 1 / Layer 2**。`applyLoyaltyMovement` 是唯一的例外形狀（要用 `env.DB.prepare` 才能組出 `changes()` 與 `INSERT ... SELECT`）—— 但這正是 `CreditService` 已經在做的事，屬於既有先例而非新開破口，**必須在該方法上留註解說明為何不用 query builder**。

---

## 11. 前後端工作拆解（可獨立出貨、每個單獨綠）

| 階段 | 內容 | 依賴 | 可獨立部署 |
|---|---|---|---|
| **S0** | module key 整頓：`partnerships` 新 key、21 處 `moduleGate` 改字串、前端型別／i18n／audit script、`0018` data migration | 無 | ✅ 純後端 + 後台文案 |
| **S1** | `0015` + `0016` migration、Drizzle schema、`schema/index.ts` 匯出、`migration-dual-track.json` 條目 | 無 | ✅ 無讀寫者 |
| **S2** | `LoyaltyService`（earn / redeem / revoke / adjust / drift）+ real-D1 整合測試。**不接任何路由** | S1 | ✅ 死碼但綠 |
| **S3** | `LoyaltySettingsService` + 店家端 6 條路由 + 後台「會員點數設定」頁 | S0, S2 | ✅ 店家可設定但尚未發點 |
| **S4** | 訂單掛鉤（`paid` → earn、`cancelled`/`refunded` → revoke），feature flag 以 `restaurant_loyalty_settings.is_enabled` 控制 | S3 | ✅ 預設關閉 |
| **S5** | 顧客端 3 條點數路由 + customer-app「我的點數」頁 + 結帳頁折抵 UI | S4 | ✅ |
| **S6** | 點數到期 cron（掛 `0 4 * * *` 或新增時段）+ 漂移偵測 cron + `GET /admin/loyalty/drift` | S2 | ✅ |
| **S7** | `CUSTOMER_AUTH_PROVIDERS` 常數 + 五處 `'password'` 硬寫改引用 + customer routes 私有函式抽出匯出（純重構） | 無 | ✅ 行為不變 |
| **S8** | `0017` migration + `CustomerOAuthService` + **LINE 單一 provider** 全流程 + binding token 連結流程 + customer-app 登入頁 LINE 按鈕 | S7 | ✅ |
| **S9** | Google provider（複用 S8 的框架，只加設定） | S8 | ✅ |
| **S10** | Apple provider + `AppleClientSecretService`（ES256 現簽）+ POST callback | S8 | ✅ |
| **S11** | 推薦碼：`ReferralService` + 顧客端 3 條 + admin 2 條 + customer-app 分享頁 + 平台券建立 | S1, S8（推薦要能一鍵註冊才有意義） | ✅ |
| **S12** | `GET /loyalty/stats` + 後台會員報表 + 點數負債報表 | S4 | ✅ |

出貨順序的兩個關鍵理由：

- **S0 排第一**，因為它是唯一會動到既有租戶資料的一步，而它現在的成本是零；每晚一週，成本只會上升。
- **S8（LINE）排在 S11（推薦碼）之前**，因為推薦連結的轉換率完全取決於「點進來能不能三秒註冊」。在只有簡訊 OTP、而簡訊通道又沒設定的情況下推推薦碼，等於把流量倒進一個關著的門。

---

## 12. 測試策略

### 12.1 Real-D1 整合測試（`apps/api/src/__tests__/integration/*.real.integration.test.ts`）

用既有 harness：`createRealIntegrationTestApp`、`buildSeedHelpers`、`buildAuthHelper`、`truncateAll`。**點數的正確性只有真 D1 能證明** —— `changes()`、batch 的原子性、partial unique 的行為在 mock 上全都是假的。

`loyalty-ledger.real.integration.test.ts` 必須涵蓋：

1. **併發扣點不超扣** —— 餘額 100，同時發 10 個各扣 20 的請求 → 恰好 5 成功、5 拿 `INSUFFICIENT_POINTS`，最終餘額 0，帳本 5 列。
2. **同一 `idempotency_key` 重放** —— 連送 5 次同一張訂單的 earn → 帳本 1 列，餘額只加一次，5 次回應相同。
3. **guard 失敗不產生帳本列** —— 對 `status='frozen'` 的帳戶扣點 → 餘額不變且**帳本零新增**（這條專門盯 `changes()=1` 有沒有真的生效）。
4. **餘額 = 帳本總和** —— 隨機跑 200 次混合操作後，`findBalanceLedgerDrift()` 回空。
5. **回沖不會把餘額推成負** —— 發 100 點 → 花掉 80 → 訂單退款 → 餘額 0、帳本記 `revoke -20` 且 `reason` 帶差額 80。
6. **到期沖銷** —— 過期帳戶餘額歸零、帳本一列 `expire`、同日重跑 cron 不重複扣（日期入 key）。
7. **跨租戶隔離** —— 顧客在 A 店的點數不能在 B 店查到、不能折抵。

`referrals.real.integration.test.ts`：

8. 自我推薦被 `CHECK` 擋（DB 層，不是只有 service 層）。
9. 同一 referee 二次 claim → `ALREADY_REFERRED`（靠 UNIQUE，非 service 判斷）。
10. `pending` 狀態不發獎；首單 `paid` 後才 `qualified` → `rewarded`。
11. **發獎重放** —— `qualified` 狀態下重複觸發發獎 → 只發一次券，`reward_idempotency_key` 的 partial unique 生效。
12. 券真的落到 `user_coupons`，且 `owner_customer_id` 正確。

`customer-oauth.real.integration.test.ts`（provider HTTP 用 `vi.fn()` 假造，DB 走真 D1）：

13. state 一次性 —— 同一個 state 用第二次 → `OAUTH_STATE_INVALID`。
14. 首次登入建帳 + identity；第二次同 `provider_uid` 登入 → **不建第二個 customer**。
15. email 撞到既有顧客 → **不自動合併**，回 `needsLinking` + binding token，且**沒有**寫任何 identity 列。
16. binding token 不能當 access token 用（打 `/customer/me` → 401 `TOKEN_INVALID`）。
17. binding token 過期（>10 分鐘）→ `BINDING_TOKEN_EXPIRED`。
18. 解除最後一個登入方式 → `409 LAST_AUTH_METHOD`。
19. 同一 `(provider, provider_uid)` 想連到第二個顧客 → `409 OAUTH_IDENTITY_TAKEN`（靠 UNIQUE 索引）。
20. 對 email 建帳時，既有 `status='deleted'` 且持有同 email 的列不會撞唯一索引。

### 12.2 單元測試

- 取整規則：`earn` / `redeem` 的邊界（0 元、1 分、`maxRedeemRatioBps` 剛好卡住、`minRedeemPoints` 未達）。用 table-driven。
- `module_overrides` 改鍵的 SQL：在本地 D1 上用 `{"loyalty":true}` / `{"loyalty":false}` / `{}` / `NULL` / 非法 JSON 五種輸入驗證，且驗**輸出仍是 JSON boolean 而非 0/1**。
- Apple client secret 簽出來的 JWT header/claims 正確（`alg=ES256`、`kid`、`aud`）。
- **依 CLAUDE.md 測試規範**：本地 builder 函式（不 import `@makanmasak/testing-utils`，該套件不存在）、每個 `vi.fn()` 外部呼叫都要驗證呼叫參數（用 `expect.objectContaining`，不精準比對時間戳／UUID）、不斷言 CSS class（用 `data-testid` / `data-status` / 文字內容）。
- **重量級 import 放 `beforeAll`**（30s 預算），不要在計時的 `it` 內第一次 `await import()`。`apps/api` 的 feature `./index` barrel 冷載約 7 秒，會直接吃掉 10 秒 testTimeout。

### 12.3 前端

- customer-app「我的點數」與結帳折抵：測狀態與文字，不測 class。
- 後台「會員點數設定」：`ModuleGate module="loyalty"` 包住，並測未授權時 fallback 有渲染。
- i18n：新增的 key 六個語系都要有，`pnpm verify:push` 的 i18n coverage 會擋。

### 12.4 驗證節奏

每次編輯後 `pnpm verify`；推送前 `pnpm verify:push` 一次。**注意在 `main` 上 commit 之後 `pnpm verify` 會回「0 packages」的假綠燈**，用 `TURBO_SCM_BASE=HEAD~N pnpm verify` 指定範圍。

---

## 13. 相依關係：哪些被「production 無法註冊會員」擋住

production 現況（實測）：`makanmasak-api-prod` 只有 3 個 secret，沒有任何簡訊商或 email 商憑證；`customers` 0 列、`customer_auth_identities` 0 列。也就是說**線上今天沒有任何一條可用的會員註冊管道**。

| 工作 | 受影響程度 | 說明 |
|---|---|---|
| S0 module key 整頓 | **不受影響** | 純店家端 |
| S1 schema / migration | **不受影響** | 無讀寫者 |
| S2 `LoyaltyService` + real-D1 測試 | **不受影響** | 本機 D1，測試自己造顧客列 |
| S3 店家端設定 + 後台頁 | **不受影響** | 走 staff JWT |
| S4 訂單掛鉤 | **部分受影響** | 邏輯可測、可部署；但線上沒有已登入顧客下單，實際只會對 guest 訂單無作用（`customer_id IS NULL` 直接略過） |
| S6 到期 / 漂移 cron | **不受影響** | 無資料時是 no-op |
| S5 顧客端點數 API / UI | **線上無法驗收** | 需要 `canonicalCustomerAuthMiddleware` 通過，而線上拿不到顧客 token |
| S11 推薦碼 | **線上無法驗收，且商業上無意義** | 推薦連結導到一個註冊不了的頁面 |
| S8 LINE OAuth | **不被擋住 —— 它就是解方** | LINE 登入不經簡訊。上線後 production 立刻有第一條可用的會員註冊管道，並同時解鎖 S5 與 S11 的線上驗收 |
| S9 Google / S10 Apple | 不被擋住 | 同上 |
| provider token 留存 | **被 `ENCRYPTION_KEY` 未設定擋住** | 但 §7.6 已決定 Phase 2 不留存 → 實際不構成阻礙 |

**結論**：這份規格裡唯一真正被通道問題擋住的是「顧客端已登入功能的線上驗收」，而 **S8（LINE Login）本身就是解除這個封鎖的鑰匙**。因此建議順序把 S8 排在 S5 / S11 之前 —— 這不只是排程偏好，而是相依關係。

（若商業上要先開簡訊：需要選定台灣簡訊商並設定 `SMS_PROVIDER` + 對應 secret。`packages/database/src/services/sms.ts` 的抽象層已存在，支援 `mitake | every8d | twilio | noop`，切換是設定而非程式碼。這條路與 OAuth 並行、互不阻擋。）

---

## 14. 風險

| 風險 | 可能性 | 衝擊 | 緩解 |
|---|---|---|---|
| module key 改名弄壞既有租戶權限 | **低（今天為 0）** | 高 | 0018 做 JSON 改鍵；prod 實測命中 0 列；部署後手動清 KV；`changePlan`/`TrialReaper` 本來就會重設 override |
| 有人用讀-改-寫實作點數異動 | 中 | 高（餘額漂移） | §5.3 明列禁止；code review 檢查項；每日漂移偵測 cron + Slack 告警 |
| 訂單掛鉤失敗導致該發的點沒發 | 中 | 中 | `waitUntil` + audit log + 告警；冪等鍵綁訂單 id，補償＝重放同一 key |
| OAuth email 自動合併造成帳號接管 | 低（設計上排除） | **極高** | §7.4：email 只做提示，連結必經 OTP／密碼驗證；binding token 已被 middleware 擋在顧客路由外 |
| Apple 首次授權的 name/email 沒存下來 | **中高**（最常見的 Apple 實作失誤） | 中 | callback 第一件事就寫 `provider_display_name` / `provider_email`；整合測試明確覆蓋 |
| Apple client secret 過期（最長 6 個月） | 中 | 高（Apple 登入全掛） | `AppleClientSecretService` 現簽 + KV 快取，到期前自動重簽；不使用手工預先產生的長效字串 |
| production 表非 STRICT，型別可被繞過 | **已確認為真** | 中 | 0015/0016 新表是 STRICT；service 層對 0017 新增欄位自行驗型別；另開 issue 追既有表 |
| 推薦獎勵被重複發放 | 中 | 中 | conditional claim（`status='qualified' AND reward_idempotency_key IS NULL`）+ partial unique；不依賴 `distributeCoupon` 的 `onConflictDoNothing`（券被用掉後就不再擋） |
| 點數負債無上限累積 | 低 | 中 | 12 個月 rolling expiry + `GET /loyalty/stats` 的 `estimatedLiabilityCents` 讓店家看得見 |
| `coupon_distributions` 因逐筆推薦而爆量 | 低 | 低 | referrer + referee 合成一次 `distributeCoupon` 呼叫；必要時改為批次發獎 cron |
| 顧客刪除帳號後點數去向不明 | 中 | 中 | `customers` 是軟刪除（`status='deleted'`），帳戶 `onDelete: cascade` 因此不觸發；設 `status='closed'` 並記一筆 `expire` 沖銷。**需寫進顧客條款** |

---

## 15. Open Questions（需拍板）

| ID | 問題 | 建議 | 為何需要人決定 |
|---|---|---|---|
| **Q-1** | `loyalty` module key：partnerships 改用 `partnerships`（選項 B）、或新增 `member_loyalty`（選項 A）？ | **選項 B，現在做** | 動到方案定義；雖然今天 prod 命中 0 列，仍屬產品命名決策 |
| **Q-2** | 消費者集點（新的 `loyalty`）放進哪些方案？現行 `loyalty`(B2B) 只在 `enterprise` + `trial` | **`pro` + `enterprise` + `trial`**（集點是主流 C 端功能，夜市攤商多在 pro） | 直接影響定價與各方案賣點 |
| **Q-3** | 點數是否跨店／跨夜市通用？ | **單店限定**；`scope_type` 已預留，跨店走代幣 | 跨店需要攤商間清算規則與商業協議 |
| **Q-4** | 幣值：預設 1 元＝1 點、1 點＝0.01 元（1% 回饋）？折抵上限 50%？最低折抵 100 點？ | 如左 | 純商業參數 |
| **Q-5** | 到期政策：帳戶級 rolling 12 個月（同代幣），或 FIFO 逐筆到期？ | **帳戶級 rolling 12 個月**（可抄現成程式碼） | FIFO 對顧客較嚴格但實作與說明成本高 |
| **Q-6** | 推薦獎勵由誰買單：平台券，或 referee 首單店家的點數？ | **平台券**（推薦是平台獲客）；開關已預留 | 成本歸屬，涉及與攤商的協議 |
| **Q-7** | 推薦獎勵金額與達標門檻（referee 首單最低消費）？ | 待定 | 純商業參數 |
| **Q-8** | 回沖時顧客點數不足：記為壞帳（建議），或允許負餘額待未來補平？ | **記為壞帳**，差額寫 `reason` + audit | 影響顧客體驗與帳務呈現 |
| **Q-9** | LINE Login channel 由哪個法人申請？隱私權政策與服務條款 URL 用哪一版？ | 待定 | 需要法人資訊與法務確認，且**是 S8 的硬前置** |
| **Q-10** | 是否上架 iOS App？（決定 Apple Sign In 是否為 App Store 強制項） | 待定 | 決定 S10 是必做還是可選 |
| **Q-11** | 是否留存 provider access/refresh token？（若是，須先補 production `ENCRYPTION_KEY` secret） | **否**（最小權限） | 若未來要做 LINE 推播就得改 |
| **Q-12** | 點數在會計上是店家負債還是平台負債？需不需要對店家出月結負債報表？ | 建議店家負債 + 月結報表（S12） | 稅務／會計，需要專業意見 |

---

## 16. Out of Scope（明列）

- §2 Non-goals 的每一項。
- 員工（`users`）側的認證、schema、session 一律不動。
- `customer_auth_identities_one_password_idx` 的移除（雖然被新索引涵蓋）。
- production 既有表補 STRICT（另開 issue）。
- `coupons` / `user_coupons` schema 變更 —— 推薦獎勵**只消費**既有管線，不擴充它。
- 儲值代幣（`credit_*`）的任何修改。
- 會員等級 / tier、點數換實體商品目錄。
- 簡訊商選型與開通（與本規格並行，互不阻擋）。

---

## 17. Review Checklist

- [ ] Q-1 module key 處置拍板（**S0 的前置**）
- [ ] Q-2 集點放哪些方案層級拍板
- [ ] Q-3 單店 / 跨店拍板
- [ ] Q-4、Q-7 商業參數拍板
- [ ] Q-6 推薦獎勵成本歸屬拍板
- [ ] Q-9 LINE channel 申請主體確認（**S8 的硬前置**）
- [ ] Q-10 iOS 上架計畫確認（決定 S10 優先序）
- [ ] 確認「OAuth 不以 email 自動合併帳號」為不可妥協項
- [ ] 確認點數異動一律走 `.batch()` 兩敘述、禁止讀-改-寫
- [ ] 確認 Phase 2 不留存 provider token（因此不需要補 `ENCRYPTION_KEY`）
- [ ] 確認出貨順序 S8（LINE）先於 S5 / S11

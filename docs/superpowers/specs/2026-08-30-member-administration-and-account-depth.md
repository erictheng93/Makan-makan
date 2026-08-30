# 會員管理後台與帳號深度 — Phase 2 設計規格

**Date**: 2026-08-30
**Status**: Draft — 待審
**Author**: Eric
**Phase 2 scope**: (A) 後台「會員管理」頁、(B) 收貨地址、(C) 儲存付款方式、(D) 匿名訂單認領與重複會員合併
**前置規格**: [`2026-05-25-customer-identity-and-profile-design.md`](./2026-05-25-customer-identity-and-profile-design.md) — Phase 1 顧客身分。本規格接續其 §11 Future Work 的四個項目。
**相關規格**: [`2026-03-10-takeaway-delivery-ui-design.md`](./2026-03-10-takeaway-delivery-ui-design.md)（外送現況）、[`2026-06-01-market-multi-vendor-checkout.md`](./2026-06-01-market-multi-vendor-checkout.md)（holder proof 先例）

---

## 1. Overview

Phase 1 把 `customers` 變成權威的顧客實體，補上 OTP／密碼登入、偏好、收藏、推播、同意稽核。它刻意留下四個缺口，理由都是「等外部條件成熟」：

| Phase 1 §11 項目 | 當時寫的觸發條件 |
| --- | --- |
| `customer_addresses` | 外送（非外帶）功能上線時 |
| `customer_payment_methods` | 金流閘道串接完成時 |
| 匿名訂單認領 | 使用者回饋顯示有需要時 |
| 重複會員合併 | 資料衛生變痛時 |

**本規格先做的事，是去查那四個觸發條件今天到底成立幾個。** 結果並不整齊：一個已經成立、一個完全沒成立、兩個成立了但被別的東西擋住。詳見 §3 的 gating 判定總表。

同時，Phase 1 遺漏了一塊沒有列在 Future Work 裡、但比那四項都更迫切的東西：**後台完全沒有任何顧客／會員畫面**。`apps/admin-dashboard/src/views/` 有 59 個檔案，沒有一個是 customer / member / crm。店主今天無法回答「這位客人在我這裡消費過幾次」。而 `customers` 是**平台級**實體、admin-dashboard 是**租戶級**後台，這個落差正是本規格最難、也最容易寫錯的一題——這個 repo 在 2026-08-26 連續修了兩個跨租戶漏洞（#265、#275），根因都是「明列投影層沒有守門」而且「手寫的 auth mock 會靜默吞掉中介層所以測試看不到」。會員資料是 PII，同一個錯誤在這裡的代價比配方高一個量級。

因此本規格的重心分配是：**(A) 佔七成，(D) 佔兩成，(B) 一成，(C) 只給 schema 與解除條件、不排工。**

---

## 2. Goals & Non-goals

### 2.1 (A) 後台會員管理

**Goals**

1. 店主（role 1）能看到「在本店有消費紀錄的顧客」清單，含本店消費彙總（次數、金額、首末次）。
2. 平台管理員（role 0）能跨租戶查詢 `customers`，含 canonical id 與跨店彙總。
3. 租戶邊界是**結構性的**，不是靠每個 handler 記得加 `WHERE`：店主端 API 的對外識別碼不是 `customers.id`，回應是明列允許清單，服務層方法簽章強制帶 scope。
4. PII 預設遮罩；揭露是一個獨立動作，且寫 `audit_logs`。
5. 店主能在自己的租戶內對會員加標籤／備註／封鎖標記，這些資料不外流到其他租戶。

**Non-goals**

- 會員等級（VIP/白金）、點數、儲值餘額的後台管理 —— `credits` 是平台級負債且是未上線功能（`STORED_VALUE_CREDITS_ENABLED` 預設 false），不在本規格。
- 行銷名單匯出到外部 CRM／EDM。
- 店主端修改顧客的姓名／手機／Email —— 那是顧客自己的資料，後台只讀。
- 店主端刪除顧客 —— 見 §9.4。
- 跨店的顧客 360 視圖給店主看 —— 這是明確拒絕的（§4）。

### 2.2 (B) 收貨地址

**Goals**

1. 已登入顧客能維護地址簿，外送下單時可選取而非重打。
2. Schema 一次到位（含國別、經緯度預留），避免二次 migration。

**Non-goals**

- 地址正規化／郵遞區號驗證／地圖選點 —— 之後的事。
- 外送距離計算與運費分級 —— 現況是餐廳設定固定金額。
- 店主端編輯顧客地址。

### 2.3 (C) 儲存付款方式

**Goals**

1. 把「解除條件」寫死，讓下一個人不用重新調查一次。
2. 給出符合 CLAUDE.md 密文欄位規範的 schema 草案。

**Non-goals**

- 現在實作任何一行。**migration 不預先落地。**

### 2.4 (D) 匿名訂單認領與重複會員合併

**Goals**

1. 訪客下單後登入，能把手上那張單認到自己名下——**沿用既有的 guest token 持有證明**，不發明新的證明機制。
2. 市場結帳有延遲認領路徑（token 過期後）——複用既有的 `phone_last_digits` + 鎖定機制。
3. 重複會員能被合併，過程可稽核、可中斷續跑、可重入（D1 沒有 `db.transaction()`）。
4. 合併後舊 id 永久可解析（alias），不製造 dangling reference。

**Non-goals**

- 用「訂單號 + 手機末碼」認領任意訂單 —— 明確拒絕，理由見 §10.3。
- 自動偵測重複會員並自動合併 —— 只做「被觸發的合併」，偵測是後續的資料衛生工作。
- 合併的一鍵 undo —— 只承諾「可解釋、可寫反向 job」，理由見 §11.6。

---

## 3. Gating 判定總表（先讀這個）

| 區塊 | 現在能做嗎 | 被什麼擋住 | 解除條件 | 死碼風險 |
| --- | --- | --- | --- | --- |
| **(A) 會員管理** | ✅ **能，而且該現在做** | 無 | — | 無。資料已存在（`orders.customer_id` 已是 `customers.id` 的 FK），只是沒有畫面 |
| **(B) 收貨地址** | ⚠️ **Gated —— 條件差一步** | 外送的**收集端**已經建好（UI → zod → `orders.delivery_info`），但外送下單走 `POST /guest-orders`，該路由**完全沒有顧客認證**，所以每一張外送單都是 `customer_id = NULL`。地址簿掛在 `customers.id` 上，今天沒有任何一個已登入顧客走得到外送流程 | ①`POST /guest-orders` 加 `optionalCanonicalCustomerAuthMiddleware` 並把 `c.get("customer")?.id` 傳進 `createOrder`（約 10 行，market-checkouts 已有先例）；②至少一家餐廳實際開啟 `settings.enableDelivery` 並有真實外送單 | **高——若先做地址簿而不做 ①，它是 100% 死碼** |
| **(C) 儲存付款方式** | ❌ **Blocked** | 沒有任何會回傳 token 的支付閘道存在。而且這是**已記錄在案的產品決定**（`TODOS.md:105-125`，2026-06-06 Deferred），不是疏漏 | 見 §8.2 的四項 | **確定死碼。不排工，migration 不落地** |
| **(D-1) 匿名訂單認領** | ✅ **能做，且是 (B) 的前置** | 無（原料齊全：guest token、`phone_last_digits`、可空的 `customer_id` FK） | — | 低。但要先補 `orders.guest_placed` 才能區分「從未有主」與「主人被刪」 |
| **(D-2) 重複會員合併** | ✅ **能做，但最貴、價值最晚兌現** | 無技術阻礙 | — | 中——若重複會員實際數量是 0，這是一套沒人用的機器。**上線前先量測 `customers` 裡 phone/email 交叉重複的實際筆數** |

### 3.1 (B) 的證據

**外送不是沒建，是建好了沒人能用帳號走它。**

- `packages/database/src/schema/orders.ts:134-141` —— `delivery_info` JSON 欄位已有 `{ type: "dine_in"|"takeaway"|"delivery", address, phone, instructions, deliveryFee, estimatedDeliveryTime }`。
- `packages/database/src/schema/restaurants.ts:83` —— `settings.enableDelivery` 旗標已存在，`RestaurantsService.ts:1138-1146` 的 `hasEnabledFulfillmentMethod` 會讀它。
- `apps/customer-app/src/components/ShopCartModal.vue:114-150, 450-512` —— 地址／電話／備註三個欄位、外送費顯示、送出前驗證，全部已實作。`OrderTypeLandingView.vue` 是入口。
- `docs/superpowers/specs/2026-03-10-takeaway-delivery-ui-design.md` 決策 #3：「Address input — Plain text field」。也就是說**規格當初就決定不做地址簿**，每次重打。

擋住的地方：

- `apps/api/src/app-factory.ts:668` —— `apiV1.route("/guest-orders", guestOrdersRoutes)`，**掛載時沒有任何 auth middleware**。
- `apps/api/src/features/guest-orders/routes/index.ts:48-258` —— 整條路由沒有 `optionalCanonicalCustomerAuthMiddleware`，`createOrder` 呼叫也沒有傳 `customerId`。
- 對照組：`apps/api/src/features/market-checkouts/routes/index.ts:406, 559-566` 與 `apps/api/src/features/waiting-list/routes/index.ts:63` **都已經**掛了 `optionalCanonicalCustomerAuthMiddleware` 並把 `c.get("customer")?.id` 傳下去。market-checkouts 的註解甚至寫明理由：「A shopper with an account still checks out through this guest route, so without this the order lands with a null customer_id and never reaches `GET /customers/me/orders`」。

**所以 (B) 的解除條件 ① 是一個既有 pattern 的補齊，不是新設計。它同時也是 (D) 的一半價值——先讓新訂單不再變成孤兒，再去救舊訂單。**

**還有三個「外送是半成品」的證據，它們不改變 (B) 的判定，但改變它的期望值——地址簿蓋在一條還沒走完的路上：**

- **外送費從來沒被收過。** `packages/database/src/services/order.ts:656-662` 的 `calculateOrderTotal(subtotal, taxRate, serviceChargeRate, discountAmount)` **沒有外送費參數**。客戶端算了 `totalWithDelivery` 送上來（`shopCart.ts:99-103`），但伺服器會權威地重算並丟掉那筆費用。`deliveryFee` 在那個 1900 行的檔案裡只出現在第 99 行的型別宣告。存下來的 `total_amount_cents` **不含外送費**，費用只以顯示用數字活在 `delivery_info` JSON 裡。
- **伺服器端沒有外送閘門。** `OrdersService.createOrder` 與 guest-orders 路由**都不檢查 `settings.enableDelivery`**（該欄位在整個 API 只出現兩次，都不是閘門）。客戶端可以對一家關閉外送的餐廳 POST `deliveryInfo.type = "delivery"`，會被接受並存下來。
- **地址不會送到任何送得出餐的人手上。** `apps/api/src/features/print/` 完全沒有 `deliveryInfo` / `address` 的引用（收據不印地址）；KDS 只讀 `type` 不讀地址（`apps/kitchen-display/src/stores/orderManagement.ts:180`）。只有 admin-dashboard 的訂單詳情抽屜看得到。

這三項不屬於本規格的範圍（它們是外送功能自己的缺口），但**必須在排 Stage B 之前一併解決**，否則地址簿只是讓使用者更快地填一個沒人讀、也沒收到錢的欄位。

### 3.2 (C) 的證據

**沒有任何 PSP 串接，而且這是寫在案上的產品決定。**

`TODOS.md:105-125`，「payments / provider integrations → Defer real payment acquirer integration」，P2、**Deferred 2026-06-06 — product decision**：

> This project is not connecting a live payment acquirer for the current scope. Stored-value 代幣, admin/cash top-up, pay-at-venue, and vouchers are the supported MVP money loop. The market-checkout provider split and online credit top-up code paths intentionally remain provider-agnostic and fail closed when no provider endpoint is configured.

延後範圍明列「Select and contract a live acquirer such as ECPay, Stripe, LINE Pay, TapPay, or NewebPay」。**所以 (C) 不是被技術擋住，是被商業決定擋住。**

程式碼佐證：

- `apps/api/src/features/payments/services/PaymentService.ts:165-243` —— `processPayment` 自己鑄造 `paymentId = \`pay_${orderId}_${Date.now()}\``，然後把 `ATTEMPT` 稽核事件與 `status → "paid"` 的更新放進**同一個 `db.batch()`**，中間**沒有任何網路呼叫**。全檔沒有一個 `fetch(`。`payment_transactions.providerTransactionId` 欄位存在但**從未被任何程式路徑寫入**。
- `apps/api/src/app-factory.ts:661` —— `// apiV1.route('/payments/webhook', paymentsRouter) // Payment webhooks 無需認證 - Disabled`。**訂單付款沒有 webhook 端點。**
- `MarketCheckoutPaymentProvider.ts:450-496` 的 `HttpProviderSplitGateway` 與 `CreditTopupService.ts:300-338` 的 `HttpCreditTopupGateway` 都是真的 HTTP + HMAC 簽章——但打的是**我方自訂的端點**，是「將來要接 PSP 的轉接層」，不是 PSP。未設定 URL 時分別退回 `UnconfiguredProviderSplitGateway` / `UnconfiguredCreditTopupGateway`，直接 throw（fail closed，設計正確）。
- `apps/api/src/types/env.ts:185-201` 宣告了 12 個 provider 相關環境變數，**全部 optional，且 `apps/api/wrangler.toml` 一個都沒有設**。
- **`apps/admin-dashboard/src/components/payment/` 整個目錄是孤兒死碼**：`StripeCardElement.vue:367-368` 有真的 `stripe.confirmCardPayment`，`@stripe/stripe-js` 也真的在 `package.json:29`，但全 repo 沒有任何檔案 import `PaymentForm` / `StripeCardElement`；而且它需要的 `clientSecret` 在 API 回應裡根本不存在（`payments/routes/index.ts:173-192` 不回 `clientSecret` 也不回 `redirectUrl`）。**不要把這個目錄當成「已經做了一半」的證據。**
- `GET /payments/methods/:country`（`payments/routes/index.ts:110-114, 300`）回傳一份靜態的付款方式清單（`ecpay`、`newebpay`、`line_pay`、`fpx`、`momo`…），**沒有任何程式用它來路由一筆扣款**。同樣不要誤讀。
- `credits`（儲值代幣）是我方封閉迴圈帳本，且在 `apps/api/src/shared/feature-adoption.ts` 是 `enabledByDefault: false`，理由寫著「0 credit_accounts … Money code that has never settled a real transaction should not be reachable」。線上儲值端點回 `CREDIT_TOPUP_NOT_CONFIGURED`，只有 role 0 的人工儲值可用。

**今天真正端到端能用的付款方式**：現場現金／現場刷卡機（系統只記錄結果）／儲值代幣（管理員儲值）／折價券。**沒有一分錢流經這個系統。**

**結論：沒有閘道 → 沒有 token → 沒有東西可存。** CLAUDE.md 的規範是「絕不可自行儲存卡號，只能存閘道回傳的 token」——今天連 token 都不存在。現在建表只會多一張永遠 0 列的表（repo 已經有 `backup_configurations` 這個教訓）。

---

## 4. 多租戶邊界（本規格最重要的一節）

### 4.1 問題陳述

`customers` 是平台級：一個顧客可以在多個攤商、多個夜市消費。`market_checkout_sessions.customer_id`、`orders.customer_id`、`reservations.customer_id`、`waiting_list.customer_id`、`service_bookings.customer_id`、`credit_accounts.owner_customer_id`、`user_coupons.owner_customer_id` 全部指向同一個 `customers.id`。

admin-dashboard 是租戶級：`authStore.restaurantId` 決定一切。店主只該看到自己的客人、且只該看到本店的消費資料。

**兩者之間需要一個明確的投影層，而這個投影層必須是結構性的。** #265 的教訓是：守門檢查資源 A、handler 卻用呼叫者可控的資源 B 的 ID 去查詢。#275 的教訓是：`moduleGate` 讀的是呼叫者自己 JWT 上的 `restaurantId`，**它看起來像守門但完全不看路徑參數**。兩者在會員資料上重演的代價是 PII 外洩。

### 4.2 決策

**D-1：`customers` 保持平台級，不加 `restaurant_id`。**
理由：一個顧客本來就屬於多家店，加租戶欄位就是回頭走 Phase 1 已經否決的路。

**D-2：新增 `restaurant_customers` 作為租戶級投影，這是店主唯一可查詢的實體。**
它同時是 membership（誰是本店的客人）與 rollup（本店的消費彙總）。定義沿用 repo 既有的先例——`packages/database/src/services/coupon.ts:1085-1088` 的註解已經寫了：「`customers` carries no restaurant column, so a restaurant's audience comes from who has ordered there」，其查詢是：

```sql
SELECT customer_id, count(*) FROM orders
WHERE restaurant_id = ? AND customer_id IS NOT NULL AND status != 'cancelled'
GROUP BY customer_id
```

本規格採同一定義。MVP 的 membership 來源**只有 orders**（Q-1 留待後續是否納入訂位／候位／預約）。

**D-3：店主端 API 一律以 `memberId` = `restaurant_customers.id` 作為對外識別碼，永不回傳 `customers.id`。**

這條是有實據的，不是潔癖：

- `customers.id` 是**跨租戶關聯鍵**。兩位店主交換各自的清單，就能得知共同客人——這是他們透過本平台才拿得到的競爭資訊。
- 更具體的：`POST /api/v1/coupons/:id/distribute` 的 `targetType: "user"` 分支（`packages/database/src/services/coupon.ts:1093-1095`）**直接吃呼叫者傳來的 `customerIds`，完全不驗證那些顧客是否在本店消費過**：

  ```ts
  if (targetType === "user") {
    return [...new Set((criteria.customerIds ?? []).filter(Boolean))];
  }
  ```

  路由層（`apps/api/src/features/coupons/routes/index.ts:548-586`）只檢查「這張券屬於你的餐廳」，沒有檢查「這些顧客屬於你的餐廳」。這正是 #265 的形狀：守門檢查資源 A（coupon），handler 用資源 B（customerIds）。今天沒被利用是因為店主拿不到 `customers.id`——**會員管理頁如果回傳它，就等於把這條路變成可利用的**。

  → 配套 **S0.1（P0 硬化，排在所有事情前面）**：`resolveDistributionAudience` 的 `user` 分支必須與本店受眾取交集；店主端改吃 `memberIds`。

**D-4：店主可見欄位是明列允許清單，不是 spread-minus-key。**
沿用 `toPublicMarketCheckout` / `toRedactedMarketCheckout`（`apps/api/src/features/market-checkouts/routes/index.ts:190-260`）的做法——那裡的註解明說是允許清單，「新欄位必須顯式加入」。這是對抗「明列投影層沒有守門」的直接手段：忘記脫敏時，新欄位預設不出現，而不是預設出現。

| 分類 | 店主看得到 | 店主看不到 |
| --- | --- | --- |
| 身分 | `memberId`、`displayName`、`maskedPhone`（`0912***678`）、`maskedEmail`（`e***@example.com`）、`locale` | `customers.id`、完整 phone／email（除非走揭露流程）、`avatarUrl` 以外的任何 Phase 1 欄位 |
| 本店消費 | `orderCount`、`cancelledOrderCount`、`totalSpentCents`、`avgOrderValueCents`、`firstOrderAt`、`lastOrderAt` | 其他餐廳的任何訂單、金額、次數 |
| 本店標記 | `tags`、`note`、`isBlocked`、`blockedReason` | 其他餐廳給同一顧客下的標記 |
| 行銷 | `marketingReachable: boolean`（由 `customer_preferences.marketingOptIn` + `customer_consents` 現行狀態推導） | `customer_consents` 原始帳本、`quietHours`、`dietaryTags`、`allergens` |
| 一律不可見 | — | `customer_favorites`、`customer_recent_markets`、`customer_push_subscriptions`、`customer_auth_identities`、`credit_accounts` 餘額、非本店發出的 `user_coupons`、`customer_addresses`、`customer_payment_methods` |

**D-5：平台管理員（role 0）走另一組路由與另一個畫面。**
`PlatformCustomersView.vue`（沿用既有 `PlatformMarketsView` / `PlatformMarketCheckoutsView` 的先例），路由 `/api/v1/admin/customers/*`，`requireRole([0])`。可見 canonical id 與跨租戶彙總，但 **PII 一樣預設遮罩、揭露一樣寫 audit**。

**關鍵細節**：admin 在 admin-dashboard 上若已選定餐廳 context（`authStore.hasRestaurantContext` 為 true），日常操作走的是**租戶端那組 API**，受同樣的投影限制。這避免 admin 身分變成一條無意識的越權捷徑。要看跨租戶資料就得明確切到 platform 區段。

**D-6：守門是三層，缺一不可。**

```
authMiddleware
  → requireRole([0, 1])
  → requireRestaurantAccess("restaurantId")     ← 綁定第一個 ID（路徑參數）
  → handler 內 resolveTenantMember(scope, memberId)  ← 綁定第二個 ID
```

（**刻意沒有 `moduleGate`**，理由見 §12.1 與 Q-8。）

- 路由形狀一律是 `/api/v1/restaurants/:restaurantId/members/...`。**不提供 `/members?restaurantId=` 的 query 版本**，因為 `requireRestaurantAccess` 只比對路徑參數（`apps/api/src/middleware/auth.ts:688-722`），query 版本會讓它靜默失效——這正是 #275 的形狀。
- `resolveTenantMember` 以 `(restaurant_id, member_id)` 查 `restaurant_customers`，查不到就 `notFound`（不是 `forbidden`，避免變成存在性 oracle）。這是把第二個呼叫者可控 ID 綁回同一租戶。

**D-7：服務層簽章強制帶 scope。**

```ts
export interface TenantScope {
  readonly restaurantId: string;
}

export class TenantMemberDirectoryService {
  // 每個方法的第一個參數都是 scope，且是 required。
  // 不提供任何「不帶 scope」的方法——沒有可以忘記加的東西。
  list(scope: TenantScope, filters: MemberListFilters): Promise<MemberListResult>;
  get(scope: TenantScope, memberId: string): Promise<MemberDetail>;
  listOrders(scope: TenantScope, memberId: string, page: Pagination): Promise<OrderSummary[]>;
  revealContact(scope: TenantScope, memberId: string, actor: AuditActor): Promise<ContactDetail>;
  update(scope: TenantScope, memberId: string, patch: MemberPatch, actor: AuditActor): Promise<MemberDetail>;
}
```

所有查詢一律 Drizzle Layer 1／Layer 2（CLAUDE.md 強制），**禁止 raw SQL 字串**——`apps/api/src/features/customer/routes/index.ts` 目前大量使用 `c.env.DB.prepare(...).bind(...)`，那是既有碼，新碼不得沿用。

**D-8（硬性驗收條件）：每一條路由的每一個呼叫者可控 ID，都必須在同一個 handler 內被綁回同一個 `restaurantId`。**
Code review 時逐條列出該路由的可控 ID（路徑參數、query、body 欄位）並指出各自的綁定位置。沒有綁定位置的一律視為漏洞，不接受「service 內部應該有擋」的推測——#265 的掃描經驗是「grep 路由有沒有 `requireRestaurantAccess` 會嚴重高估，必須逐條讀 handler」。

---

## 5. 資料模型

所有新表**必須手寫 `) STRICT`**（drizzle-kit 不會產生），時間戳一律 `integer(..._ms, { mode: "timestamp_ms" })`，新表主鍵一律 `TEXT` UUID v7。

### 5.1 新增：`restaurant_customers`（租戶級投影 — Stage A1）

```ts
// packages/database/src/schema/restaurant-customers.ts
export const restaurantCustomers = sqliteTable(
  "restaurant_customers",
  {
    // 這就是店主端對外的 memberId。刻意不是複合鍵，
    // 好讓路由帶單一不透明識別碼、不洩漏 customers.id。
    id: text("id").primaryKey().$defaultFn(() => uuidv7()),

    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),

    // ── 本店 rollup：一律「重算」而非「遞增」，見 §6.2 ──
    orderCount: integer("order_count").notNull().default(0),
    cancelledOrderCount: integer("cancelled_order_count").notNull().default(0),
    totalSpentCents: integer("total_spent_cents").notNull().default(0),
    firstOrderAt: integer("first_order_at_ms", { mode: "timestamp_ms" }),
    lastOrderAt: integer("last_order_at_ms", { mode: "timestamp_ms" }),

    // ── 租戶本地欄位：不跨店共享 ──
    tags: text("tags", { mode: "json" }).$type<string[]>(),
    note: text("note"),
    isBlocked: integer("is_blocked").notNull().default(0),
    blockedReason: text("blocked_reason"),

    // drift 可見：對照 orders 的重算時間點
    recomputedAt: integer("recomputed_at_ms", { mode: "timestamp_ms" }),

    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull().default(sql`(unixepoch('now') * 1000)`),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull().default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    tenantCustomerUnique: uniqueIndex("restaurant_customers_tenant_customer_unique")
      .on(table.restaurantId, table.customerId),
    // 列表預設排序：最近消費
    recentIdx: index("restaurant_customers_recent_idx")
      .on(table.restaurantId, table.lastOrderAt),
    // 「常客」排序
    spendIdx: index("restaurant_customers_spend_idx")
      .on(table.restaurantId, table.totalSpentCents),
    ordersIdx: index("restaurant_customers_orders_idx")
      .on(table.restaurantId, table.orderCount),
    // 合併時反查一個顧客的所有租戶列
    customerIdx: index("restaurant_customers_customer_idx").on(table.customerId),
  }),
);
```

同時需要 `orders` 上的複合索引，否則 rollup 重算是全表掃描：

```sql
CREATE INDEX orders_restaurant_customer_idx
  ON orders (restaurant_id, customer_id, created_at_ms);
```

`restaurant_id` 依 `ingredient_stock_movements`（0011）的慣例加 `BEFORE INSERT` / `BEFORE UPDATE` guard trigger。

### 5.2 修改：`orders` 加 `guest_placed`（Stage 0.2）

```sql
ALTER TABLE orders ADD COLUMN guest_placed INTEGER NOT NULL DEFAULT 0;
```

**為什麼需要它。** `isGuestOrder` 今天是死參數——`guest-orders/routes/index.ts:183` 與 `market-checkouts/routes/index.ts:588` 都傳了它，但 `OrdersService.createOrder` 的 `baseOrderData`（`OrdersService.ts:171-193`）從不讀。所以「這是訪客單」在資料庫裡沒有痕跡，唯一的訊號是 `customer_id IS NULL`。

而 `customer_id` 是 `ON DELETE SET NULL`——顧客被硬刪時它也會變 NULL。認領流程必須能區分「從未有主的訪客單」與「主人被刪掉的單」，否則後者會變成任何人都能認領的孤兒。

寫入時機：`createOrder` 依 `isGuestOrder` 寫死一次，之後永不變更。既有列預設 0（歷史訪客單因此認領不到——可接受，它們的 guest token 早就過期了）。

### 5.3 新增：`order_claims`（append-only — Stage D1）

```ts
export const orderClaims = sqliteTable(
  "order_claims",
  {
    id: text("id").primaryKey().$defaultFn(() => uuidv7()),
    orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
    customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    // 'guest_token' | 'market_checkout_phone'
    proofKind: text("proof_kind").notNull(),
    // 只記證明的來源，不記證明本身（token 絕不落地）
    proofRef: text("proof_ref"),          // 例如 checkoutId
    // 'succeeded' | 'rejected'：失敗也記，暴力嘗試才看得見
    outcome: text("outcome").notNull(),
    rejectReason: text("reject_reason"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull().default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    // 一張訂單只能被成功認領一次。認領是可重試寫入（客戶端登入時
    // 會把手上所有 token 一次送出、失敗會重送），所以這個約束
    // 必須在 DB 層，不能只靠服務層先讀後寫。
    orderSucceededUnique: uniqueIndex("order_claims_order_succeeded_unique")
      .on(table.orderId).where(sql`${table.outcome} = 'succeeded'`),
    customerIdx: index("order_claims_customer_idx").on(table.customerId, table.createdAt),
    outcomeIdx: index("order_claims_outcome_idx").on(table.outcome, table.createdAt),
  }),
);
```

### 5.4 新增：`customer_addresses`（Stage B — gated）

```ts
export const customerAddresses = sqliteTable(
  "customer_addresses",
  {
    id: text("id").primaryKey().$defaultFn(() => uuidv7()),
    customerId: text("customer_id").notNull()
      .references(() => customers.id, { onDelete: "cascade" }),

    label: text("label"),                                  // 「家」「公司」
    recipientName: text("recipient_name").notNull(),
    recipientPhone: text("recipient_phone").notNull(),     // E.164
    countryCode: text("country_code").notNull(),           // ISO 3166-1 alpha-2
    postalCode: text("postal_code"),
    city: text("city"),
    district: text("district"),
    addressLine1: text("address_line1").notNull(),
    addressLine2: text("address_line2"),
    deliveryNote: text("delivery_note"),
    latitude: real("latitude"),
    longitude: real("longitude"),

    isDefault: integer("is_default").notNull().default(0),
    lastUsedAt: integer("last_used_at_ms", { mode: "timestamp_ms" }),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull().default(sql`(unixepoch('now') * 1000)`),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull().default(sql`(unixepoch('now') * 1000)`),
    deletedAt: integer("deleted_at_ms", { mode: "timestamp_ms" }),
  },
  (table) => ({
    customerIdx: index("customer_addresses_customer_idx")
      .on(table.customerId, table.deletedAt),
    defaultUnique: uniqueIndex("customer_addresses_default_unique")
      .on(table.customerId)
      .where(sql`${table.isDefault} = 1 AND ${table.deletedAt} IS NULL`),
  }),
);
```

**加密決策（明確寫出來，免得下一個人重問）**：地址**不加密**。理由是一致性與可用性——`orders.delivery_info.address` 今天已是明文，外送作業（列印、外送員 App）需要明文，而加密欄位無法被服務層以外的任何東西讀。保護手段是存取控制（只有本人的 customer JWT 讀得到）與後台不外露（店主端不提供地址簿）。CLAUDE.md 的密文欄位規範針對的是「OAuth 憑證、access/refresh token、client secret、webhook secret」——地址不在其列。

下單時把選取的地址**快照**進 `orders.delivery_info`（既有欄位），不存 FK。理由與 `service_bookings.service_name_snapshot` 相同：地址簿之後被編輯或刪除，不該改動歷史訂單。

### 5.5 新增：`customer_payment_methods`（Stage C — BLOCKED，migration 不落地）

草案先寫在這裡，等 §8.2 的解除條件成立再落地。

```ts
export const customerPaymentMethods = sqliteTable(
  "customer_payment_methods",
  {
    id: text("id").primaryKey().$defaultFn(() => uuidv7()),
    customerId: text("customer_id").notNull()
      .references(() => customers.id, { onDelete: "cascade" }),

    provider: text("provider").notNull(),              // "stripe" | "newebpay" | ...
    // PSP 端的 customer 參照。非機密但仍不對外回傳。
    providerCustomerRef: text("provider_customer_ref"),

    // 唯一存放 PSP token 的地方：AES-256-GCM(JSON{ paymentMethodToken, ... })
    // 走 packages/utils/src/encryption.ts 的 encrypt/decrypt。
    // CLAUDE.md：token 只能存在密文欄位，JSON config 欄位只放非機密旗標。
    encryptedPayload: text("encrypted_payload").notNull(),
    // token 的 HMAC-SHA256，只為了去重與唯一索引；明文 token 不落地、不建索引。
    providerRefHash: text("provider_ref_hash"),

    // 展示用，由 PSP 回傳。絕不儲存 PAN、CVV、或任何完整卡片資料。
    brand: text("brand"),
    last4: text("last4"),
    expMonth: integer("exp_month"),
    expYear: integer("exp_year"),

    isDefault: integer("is_default").notNull().default(0),
    status: text("status").notNull().default("active"),   // active | expired | revoked

    // 綁卡是可重試寫入 → CLAUDE.md 要求 DB 層 partial unique
    idempotencyKey: text("idempotency_key"),

    lastUsedAt: integer("last_used_at_ms", { mode: "timestamp_ms" }),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull().default(sql`(unixepoch('now') * 1000)`),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull().default(sql`(unixepoch('now') * 1000)`),
    deletedAt: integer("deleted_at_ms", { mode: "timestamp_ms" }),
  },
  (table) => ({
    customerStatusIdx: index("customer_payment_methods_customer_status_idx")
      .on(table.customerId, table.status),
    defaultUnique: uniqueIndex("customer_payment_methods_default_unique")
      .on(table.customerId)
      .where(sql`${table.isDefault} = 1 AND ${table.deletedAt} IS NULL`),
    providerRefUnique: uniqueIndex("customer_payment_methods_provider_ref_unique")
      .on(table.provider, table.providerRefHash)
      .where(sql`${table.providerRefHash} IS NOT NULL`),
    idempotencyUnique: uniqueIndex("customer_payment_methods_idempotency_unique")
      .on(table.idempotencyKey)
      .where(sql`${table.idempotencyKey} IS NOT NULL`),
  }),
);
```

`customer_preferences.preferredPaymentMethodId`（Phase 1 已預留的欄位）在這張表落地時才變成真的 FK。

### 5.6 新增：合併三表（Stage D4）

D1 **沒有 `db.transaction()`**，所以合併不能是一個原子操作，必須是一台可中斷續跑的狀態機。

```ts
export const customerMergeJobs = sqliteTable(
  "customer_merge_jobs",
  {
    id: text("id").primaryKey().$defaultFn(() => uuidv7()),
    survivorCustomerId: text("survivor_customer_id").notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    mergedCustomerId: text("merged_customer_id").notNull()
      .references(() => customers.id, { onDelete: "restrict" }),

    // pending | running | completed | failed | cancelled
    status: text("status").notNull().default("pending"),
    currentStep: text("current_step"),
    stepCursor: text("step_cursor", { mode: "json" }).$type<Record<string, unknown> | null>(),

    initiatedByType: text("initiated_by_type").notNull(),   // 'customer' | 'platform_admin'
    initiatedById: text("initiated_by_id"),
    reason: text("reason"),

    idempotencyKey: text("idempotency_key"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),

    startedAt: integer("started_at_ms", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at_ms", { mode: "timestamp_ms" }),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull().default(sql`(unixepoch('now') * 1000)`),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull().default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    idempotencyUnique: uniqueIndex("customer_merge_jobs_idempotency_unique")
      .on(table.idempotencyKey).where(sql`${table.idempotencyKey} IS NOT NULL`),
    // 同一個 customer 同時只能有一個進行中的合併，否則兩台狀態機
    // 會互相搬動同一批列。
    activeSurvivorUnique: uniqueIndex("customer_merge_jobs_active_survivor_unique")
      .on(table.survivorCustomerId).where(sql`${table.status} IN ('pending', 'running')`),
    activeMergedUnique: uniqueIndex("customer_merge_jobs_active_merged_unique")
      .on(table.mergedCustomerId).where(sql`${table.status} IN ('pending', 'running')`),
    statusIdx: index("customer_merge_jobs_status_idx").on(table.status, table.createdAt),
  }),
);

export const customerMergeSteps = sqliteTable(
  "customer_merge_steps",
  {
    id: text("id").primaryKey().$defaultFn(() => uuidv7()),
    jobId: text("job_id").notNull()
      .references(() => customerMergeJobs.id, { onDelete: "cascade" }),
    step: text("step").notNull(),          // 'orders' | 'orders#2' | 'user_coupons' | ...
    status: text("status").notNull(),      // pending | done | skipped | failed
    rowsMoved: integer("rows_moved").notNull().default(0),
    // 搬動的主鍵清單 / 衝突處置紀錄。這是「可解釋、可寫反向 job」的依據。
    detail: text("detail", { mode: "json" }).$type<Record<string, unknown> | null>(),
    startedAt: integer("started_at_ms", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at_ms", { mode: "timestamp_ms" }),
  },
  (table) => ({
    // 續跑的關鍵：同一步驟只能有一列，重跑是 upsert 而非再插一列。
    jobStepUnique: uniqueIndex("customer_merge_steps_job_step_unique")
      .on(table.jobId, table.step),
  }),
);

// 被併掉的 id 永久保留為別名，讓舊 JWT sub、舊外部引用、舊 log 都解析得到。
export const customerMergeAliases = sqliteTable(
  "customer_merge_aliases",
  {
    aliasCustomerId: text("alias_customer_id").primaryKey()
      .references(() => customers.id, { onDelete: "restrict" }),
    survivorCustomerId: text("survivor_customer_id").notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    mergeJobId: text("merge_job_id").notNull()
      .references(() => customerMergeJobs.id, { onDelete: "restrict" }),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull().default(sql`(unixepoch('now') * 1000)`),
  },
  (table) => ({
    survivorIdx: index("customer_merge_aliases_survivor_idx").on(table.survivorCustomerId),
  }),
);
```

`customers.status` 需要新增一個合法值 `merged`（既有值：`active` / `suspended` / `deleted`）。被併掉的列**保留**，但清空 `primary_phone` / `primary_email` 以釋放 partial unique 索引給 survivor。

---

## 6. Migration 規劃

手寫 sequential SQL 放 `packages/database/migrations_fresh/`，**不使用 `pnpm db:generate`**（snapshot 已陳舊、且對 rename 會進互動模式）。現有最大編號是 `0014_user_coupons_holder_unique.sql`（`0009` 在序列中缺號，屬既有狀態，不補）。

| 檔名 | 內容 | Stage |
| --- | --- | --- |
| `0015_orders_guest_placed.sql` | `ALTER TABLE orders ADD COLUMN guest_placed INTEGER NOT NULL DEFAULT 0;` | S0.2 |
| `0016_restaurant_customers.sql` | `CREATE TABLE restaurant_customers (...) STRICT;` + 5 個索引 + 2 個 restaurant guard trigger + `CREATE INDEX orders_restaurant_customer_idx ON orders (restaurant_id, customer_id, created_at_ms);` | A1 |
| `0017_order_claims.sql` | `CREATE TABLE order_claims (...) STRICT;` + 3 個索引（含 partial unique） | D1 |
| `0018_customer_merge_jobs.sql` | 三張合併表 `... ) STRICT` + 索引 | D4（**編號待確認**：平行的 loyalty/OAuth 規格也提了一支 `0018`，見 §12.1 的協調表） |
| `0019_customer_addresses.sql` | `CREATE TABLE customer_addresses (...) STRICT;` + 2 個索引 | B（**gated：Stage 0.2 完成前不落地**） |
| _（未編號）_ | `customer_payment_methods` | C（**blocked：不落地**） |

### 6.1 每個 migration 的必辦事項

1. **手寫 `) STRICT`**。`pnpm check:strict-tables` 會擋。
2. **`packages/database/migration-dual-track.json` 加 `freshOnly` 條目 + 理由**，`pnpm check:migration-dual-track` 會擋。四張表都是 platform API 專屬（management-api 沒有 orders／customers），理由照 `0004_market_checkout_customer.sql` 的寫法。
3. 索引一律有名字、跟 Drizzle schema 的索引名逐字一致。
4. `--> statement-breakpoint` 分隔每個語句（照 0011 的格式）。
5. 每個檔案開頭寫「為什麼」的註解，含 issue 編號。

### 6.2 回填與維護（`restaurant_customers`）

**回填**（一次性，Stage A1）：

```sql
INSERT INTO restaurant_customers (
  id, restaurant_id, customer_id,
  order_count, cancelled_order_count, total_spent_cents,
  first_order_at_ms, last_order_at_ms, recomputed_at_ms,
  created_at_ms, updated_at_ms
)
SELECT
  lower(hex(randomblob(16))),      -- 回填用；線上寫入走 uuidv7()
  o.restaurant_id,
  o.customer_id,
  SUM(CASE WHEN o.status != 'cancelled' THEN 1 ELSE 0 END),
  SUM(CASE WHEN o.status  = 'cancelled' THEN 1 ELSE 0 END),
  COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN o.total_amount_cents ELSE 0 END), 0),
  MIN(CASE WHEN o.status != 'cancelled' THEN o.created_at_ms END),
  MAX(CASE WHEN o.status != 'cancelled' THEN o.created_at_ms END),
  unixepoch('now') * 1000,
  unixepoch('now') * 1000,
  unixepoch('now') * 1000
FROM orders o
WHERE o.customer_id IS NOT NULL
GROUP BY o.restaurant_id, o.customer_id
HAVING SUM(CASE WHEN o.status != 'cancelled' THEN 1 ELSE 0 END) > 0
ON CONFLICT (restaurant_id, customer_id) DO NOTHING;
```

回填**不放在 migration 檔裡**，放 `scripts/backfill-restaurant-customers.ts`，理由：資料量未知、要能分批、要能重跑。線上執行前先量 `SELECT count(*) FROM orders WHERE customer_id IS NOT NULL`。

**增量維護**：

- **寫入點**：訂單進入終態（`status` 變為 `completed` 或 `cancelled`、或 `paid_at_ms` 被設定）時，對該 `(restaurant_id, customer_id)` 執行**重算式 upsert**。
- **必須是重算，不能是遞增。** D1 沒有交易，重試會發生；遞增在重試時會雙計，重算則不論跑幾次結果相同。重算的成本由 `orders_restaurant_customer_idx` 支撐（單一顧客在單一店的訂單數是小數字）。
- **對帳**：nightly cron 掃 `orders.updated_at_ms > (SELECT MIN(recomputed_at_ms) ...)` 的 `(restaurant_id, customer_id)` 組合重算，補上任何漏掉的寫入點。`recomputed_at_ms` 讓 drift 可見。
- **認領成功後**（Stage D1）與**合併完成後**（Stage D4）都必須觸發重算。

---

## 7. API 端點清單

新 feature folder `apps/api/src/features/members/`，依 `apps/api/src/features/<name>/index.ts` 的 default export 慣例。掛載（Hono 支援同一 prefix 掛多個 router，`/auth` 已有先例）：

```ts
apiV1.route("/restaurants", membersFeature.routes);        // 租戶端
apiV1.route("/admin/customers", membersFeature.adminRoutes); // 平台端
```

### 7.1 租戶端（會員管理）

所有路由的守門鏈固定為：
`authMiddleware` → `requireRole([0, 1])` → `requireRestaurantAccess("restaurantId")` → handler 內 `resolveTenantMember`

**沒有 `moduleGate`。** 若之後決定加，必須同步更新 `scripts/audit-module-gates.cjs` 的前綴對照表（pre-commit 會擋），且不能用 `loyalty` —— 見 §12.1。

```
GET    /api/v1/restaurants/:restaurantId/members
       query: page, limit, search, tag, minOrders, minSpentCents,
              lastOrderFrom, lastOrderTo, blocked, sort
       回應：{ success, data: MemberListItem[], pagination }

GET    /api/v1/restaurants/:restaurantId/members/stats
       回應：{ totalMembers, newThisMonth, repeatRate, avgOrderValueCents }

GET    /api/v1/restaurants/:restaurantId/members/:memberId
       回應：MemberDetail（§4.4 的允許清單）

GET    /api/v1/restaurants/:restaurantId/members/:memberId/orders
       只回本店訂單。實作上以 (restaurant_id, customer_id) 查，
       兩個條件都來自已驗證的 scope，不接受 body/query 覆寫。

POST   /api/v1/restaurants/:restaurantId/members/:memberId/reveal-contact
       回應：{ phone, email }（完整值）
       副作用：寫 audit_logs（action = "customer_pii_reveal"）
       限流：每 actor 每小時 30 次（KV）

PATCH  /api/v1/restaurants/:restaurantId/members/:memberId
       body: { tags?, note?, isBlocked?, blockedReason? }
       只寫 restaurant_customers 的租戶本地欄位。
       任何 customers 表欄位出現在 body 都是 400。

POST   /api/v1/restaurants/:restaurantId/members/export
       requireRole([0, 1])；預設遮罩欄位。完整 PII 匯出見 Q-3。
       副作用：寫 audit_logs（action = "customer_data_export"）

POST   /api/v1/restaurants/:restaurantId/members/recompute
       requireRole([0])。手動觸發本店 rollup 重算，供對帳用。
```

**搜尋的 PII 設計（重要）**：列表只顯示遮罩值，但店主必須能用完整手機找到客人。做法是**完整值等值比對**：

- `q` 看起來是手機 → `primary_phone = normalizeE164Phone(q)`
- `q` 看起來是 Email → `primary_email = lower(q)`
- 其餘 → `display_name LIKE '%q%'`

**不支援手機／Email 的部分比對。** 部分比對會把這個端點變成枚舉工具（輸入 `0912` 得到所有 09120 開頭的客人）。等值比對不洩漏額外資訊，因為店主必須已經知道完整號碼才查得到。這條要寫進 zod schema 的註解，避免之後有人「順手」改成 LIKE。

### 7.2 平台端

```
GET    /api/v1/admin/customers                       requireRole([0])
GET    /api/v1/admin/customers/:customerId           requireRole([0])
POST   /api/v1/admin/customers/:customerId/reveal-contact   （寫 audit）
GET    /api/v1/admin/customers/:customerId/restaurants      （跨租戶彙總）

POST   /api/v1/admin/customers/merges                建立合併 job
GET    /api/v1/admin/customers/merges                列表（status 篩選）
GET    /api/v1/admin/customers/merges/:jobId         含 steps 明細
POST   /api/v1/admin/customers/merges/:jobId/resume   續跑
POST   /api/v1/admin/customers/merges/:jobId/cancel   只在 pending 可取消
```

### 7.3 顧客端

全部 `canonicalCustomerAuthMiddleware`。

```
# 地址簿（Stage B，gated）
GET    /api/v1/customer/addresses
POST   /api/v1/customer/addresses
PATCH  /api/v1/customer/addresses/:id
DELETE /api/v1/customer/addresses/:id            soft delete
POST   /api/v1/customer/addresses/:id/default

# 訂單認領（Stage D1 / D2）
POST   /api/v1/customer/order-claims
       body A: { guestToken: string }                        （持有證明，首選）
       body B: { checkoutId: string, phoneLastDigits: string } （市場結帳延遲認領）
       回應：{ claimed: ClaimedOrderSummary[], skipped: [...] }
GET    /api/v1/customer/order-claims                 認領歷史（自己的）

# 識別碼綁定與合併（Stage D3 / D4）
GET    /api/v1/customer/identity                     列出已綁定的識別碼
POST   /api/v1/customer/identity/link/request        body { identifier }
POST   /api/v1/customer/identity/link/confirm        body { token }
DELETE /api/v1/customer/identity/:id                 至少保留一個，否則 409

# 儲存付款方式 —— BLOCKED，不實作
# GET/POST/DELETE /api/v1/customer/payment-methods
```

### 7.4 錯誤格式

一律 `throw` `apps/api/src/shared/utils/api-error.ts` 的 factory（`notFound` / `badRequest` / `forbidden` / `conflict`），交給全域 `app.onError` 格式化。route handler 內**不寫 try-catch 做錯誤格式化**。

新錯誤碼：
`MEMBER_NOT_FOUND`、`MEMBER_ACCESS_DENIED`、`PII_REVEAL_RATE_LIMITED`、`ORDER_NOT_CLAIMABLE`、`ORDER_ALREADY_CLAIMED`、`CLAIM_PROOF_INVALID`、`CLAIM_RATE_LIMITED`、`IDENTITY_ALREADY_LINKED`、`MERGE_ALREADY_RUNNING`、`MERGE_SELF_NOT_ALLOWED`

---

## 8. Gated / Blocked 兩塊的細節

### 8.1 (B) 地址簿 — 上線判定

**三個條件都成立才排工：**

1. **Stage 0.2 已上線**：`POST /guest-orders` 帶 `optionalCanonicalCustomerAuthMiddleware`，已登入顧客的訂單帶 `customer_id`。沒有這條，地址簿的使用者數量在數學上是 0。
2. **外送本身走完最後一哩**（§3.1 末段的三項）：伺服器端閘門檢查 `settings.enableDelivery`、`calculateOrderTotal` 收外送費、地址進收據或 KDS。這三項不在本規格範圍，但它們沒完成之前，地址簿只是讓人更快填一個沒人讀、也沒收到錢的欄位。
3. **實際採用**：至少一家餐廳開啟 `settings.enableDelivery` 且有真實外送單。用既有的 `apps/api/src/shared/feature-adoption.ts` 機制登記——地址簿以 `customerAddresses` 為 key、`enabledByDefault: false` 進 `UNLAUNCHED_FEATURES`，`adoption` 欄位寫下量測日期與筆數。這是這個 repo 對「建好但沒人用」的既有處理方式，不要另創一套。

**若在條件 1 之前先做**：`GET /customer/addresses` 會有人呼叫（顧客在 ProfileView 加地址），但 `ShopCartModal` 拿不到已登入身分，選不了地址，於是永遠是手打。也就是一個能寫不能用的表。**這就是「誠實標為 gated」的具體意思。**

### 8.2 (C) 儲存付款方式 — 解除條件

五項全部成立才解除：

0. **`TODOS.md:105-125` 的 Deferred 決定被推翻**。這是商業決定，不是工程債——工程上不能自行「解除」它。上面四項都建立在這一項之上。
1. **選定 PSP 並完成 tokenization**：卡號必須在 PSP 的 hosted fields／SDK 內輸入，**絕不經過我方任何一層**（Worker、Vue app、日誌）。
2. **該 PSP 支援 vault + 重複扣款**：能存 customer + payment method 並在後續交易引用。
3. **憑證進 Cloudflare secret store**：`wrangler secret put`，不進任何 committed 檔案。
4. **PCI DSS 責任邊界確認**：目標是 SAQ-A（卡資完全外包）。若方案會落到 SAQ-A-EP 或更高，成本要重新評估後再決定做不做。

現況距離這些最近的路，是把 `MARKET_CHECKOUT_PROVIDER_SPLIT_URL` / `CREDIT_TOPUP_PROVIDER_URL` 指向真正的 PSP 轉接服務——兩個抽象層都已寫好（含 HMAC 簽章與 `nextAction: { redirect | client_secret }` 的解析），而且 `credit_topup_intents` 已經是正確的 pending→webhook→confirm 意圖模型。也就是說**(C) 的前置是「金流本身要先能收到一筆錢」，不是「會員功能要更深」**。

**同時建議（不屬本規格，但該有人接）**：刪掉 `apps/admin-dashboard/src/components/payment/` 這個孤兒目錄與 `@stripe/stripe-js` 相依。它會讓每一個後來的人以為金流做了一半。

---

## 9. PII 與法遵

### 9.1 遮罩策略

遮罩發生在**服務層的投影函式**，不是前端。前端拿不到完整值，就不可能不小心 render 出來。

```ts
// apps/api/src/features/members/services/pii-masking.ts
export function maskPhone(e164: string | null): string | null;
  // "+886912345678" → "0912***678"（保留國碼可辨識性，中段遮蔽）
export function maskEmail(email: string | null): string | null;
  // "eric@example.com" → "e***@example.com"
```

repo 目前**沒有任何 mask 工具**（`grep maskPhone|maskEmail|redact` 無命中），所以這是新檔案。放在 members feature 下、不放 `packages/utils`，直到第二個消費者出現。

### 9.2 揭露流程與 audit

`POST .../members/:memberId/reveal-contact`：

1. 三層守門通過（§4.6）。
2. KV 限流：每 actor 每小時 30 次。超過 → `PII_REVEAL_RATE_LIMITED`。
3. 寫 `audit_logs`：`action = "customer_pii_reveal"`、`resource = "restaurant_customers"`、`resource_id = memberId`、`restaurant_id`、`user_id = actor`、`changes.metadata = { fields: ["phone", "email"] }`、`ip_address`、`user_agent`。
4. 回完整值。

需要在 `packages/database/src/schema/audit-logs.ts` 的 `AUDIT_ACTIONS` 加兩個常數：`CUSTOMER_PII_REVEAL: "customer_pii_reveal"`、`CUSTOMER_DATA_EXPORT: "customer_data_export"`。既有的 `DATA_EXPORT` 太籠統，會混進備份匯出。

前端配合：揭露前跳 `useConfirmModal()` 明示「此操作會被記錄」；揭露後的完整值在畫面上停留 5 分鐘後自動還原遮罩（純前端計時，防肩窺與截圖留存）。

### 9.3 同意（`customer_consents`）與後台的關係

- 店主端**不回傳** `customer_consents` 帳本，只回傳推導出的 `marketingReachable: boolean`。
- 推導規則：`customer_preferences.marketing_opt_in = 1` **且** 存在一筆 `consent_type = 'marketing'`、`granted = 1`、`revoked_at_ms IS NULL` 的紀錄。
- `marketingReachable = false` 的會員，在後台清單上以 pill 標示，且**不可**被選進任何行銷發送動作（配合 Q-4，coupon 發放亦然）。
- 版本目錄仍是 `packages/shared-types/src/consents.ts`，後台不得硬寫版本字串。

### 9.4 刪除會員：顧客自助 vs 後台

現況：`DELETE /api/v1/customer/me`（`customer/routes/index.ts:696-706`）做的是 **soft delete**——把 `customers.status` 設為 `deleted`、寫 `deleted_at_ms`。因為 `customers` 的 phone/email partial unique 帶 `status = 'active'` 條件，軟刪除會**釋放**該手機／Email 給新帳號使用（Phase 1 Q-1 的決策）。

本規格的決策：

- **店主（role 1）不能刪除會員。** 顧客不是店主的資產，刪除是顧客對平台的權利。店主能做的最強動作是 `isBlocked`（本店標記）。
- **平台管理員（role 0）也不提供刪除按鈕。** 若需要執行 PDPA 刪除請求，走顧客自助流程或一次性腳本，並留 audit。畫面上放一顆刪除鈕，遲早會有人誤按。
- **顧客軟刪除後，`restaurant_customers` 列保留**（訂單事實不因帳號刪除而消失，店主的營運報表不該憑空少一塊），但投影層必須把 `displayName` 換成 `"已刪除的顧客"`、`maskedPhone` / `maskedEmail` 回 `null`，且 `reveal-contact` 對該會員一律 `forbidden`。這是 §4.4 允許清單要涵蓋的分支。

---

## 10. 匿名訂單認領

### 10.1 現況（原料清單）

| 原料 | 位置 | 性質 |
| --- | --- | --- |
| Guest token `gt_<64 hex>` | KV `guest_token:{token}`，明文，**4 小時 TTL** | 真正的持有憑證。CSPRNG 256 bit，非 HMAC。`generateGuestToken()` 在 `apps/api/src/middleware/guestAuth.ts:191-198` |
| `X-Guest-Token` header | `market-checkouts` 路由 | 為了讓已登入顧客能同時帶 customer JWT 與 guest token |
| `market_checkout_sessions.phone_last_digits` | D1，明文 3 碼 | 弱恢復憑證，鎖在單一 checkout id 上 |
| `X-Guest-Device-Id` | localStorage，client 生成 | **明確不是憑證**，只用來組 KV 鎖 key |
| `orders.customer_id` | 可空 FK → `customers.id` | 認領的目標欄位 |
| `isMarketCheckoutOwner()` | `market-checkouts/routes/index.ts:1967-2014` | 現成的持有判定邏輯，直接沿用 |

### 10.2 認領流程

**路徑 1 — 持有證明（首選、且應該是絕大多數）**

```
POST /api/v1/customer/order-claims
Authorization: Bearer <customer JWT>
body: { guestToken: "gt_..." }
```

1. KV 讀 `guest_token:{token}` → 得 `{ orderId, restaurantId, guestName, createdAt }`。讀不到 → `CLAIM_PROOF_INVALID`（不區分「不存在」與「已過期」）。
2. 讀該 order。`guest_placed != 1` → `ORDER_NOT_CLAIMABLE`。`customer_id IS NOT NULL` → `ORDER_ALREADY_CLAIMED`（**不透露持有者是誰**）。
3. `UPDATE orders SET customer_id = ? WHERE id = ? AND customer_id IS NULL`（條件式 UPDATE，避免競態）。
4. 寫 `order_claims`（`outcome = 'succeeded'`）。partial unique 是併發下的權威。
5. **刪除該 guest token**（`CACHE_KV.delete`），避免舊持有者繼續以訪客身分操作已認領的單。
6. Upsert + 重算該 `(restaurant_id, customer_id)` 的 `restaurant_customers`。
7. 若該 order 是 market checkout 的 child（`order_source = 'market_checkout'`），一併把 `market_checkout_sessions.customer_id` 設為該顧客（同樣是 `WHERE customer_id IS NULL` 的條件式 UPDATE）。

**客戶端整合（這才是覆蓋率的關鍵）**：customer-app 登入成功後，自動把 `localStorage.guest_auth_token` 與 `localStorage.market_checkout_guest_tokens` 裡所有還在有效期內的 token 一次送出（body 支援陣列）。使用者無感，不需要記訂單號、不需要輸入任何東西。

**路徑 2 — 市場結帳延遲認領（token 過期後）**

```
POST /api/v1/customer/order-claims
body: { checkoutId: "...", phoneLastDigits: "678" }
```

完全複用 `POST /market-checkouts/:id/guest-token`（`market-checkouts/routes/index.ts:1196-1322`）的驗證與防暴力機制，一個字都不改：

- per-IP `rateLimitMiddleware({ windowMs: 15 * 60_000, maxRequests: 10 })`
- per-checkout KV 計數器 `market_checkout_recover_attempts:{checkoutId}`，5 次上限、1 小時鎖
- 成功後清除計數器

驗過之後認領該 session 與其**全部** child orders。

### 10.3 明確拒絕的設計：「訂單號 + 手機末碼」認領任意訂單

不做，四個理由：

1. `orders.order_number` 是可枚舉的（且 `orders.id` 是 UUID v7，時間可排序、部分可猜）。
2. `orders` **沒有可查詢的電話欄位**。電話只存在 `customer_info` JSON 裡（無索引），而且那是訪客自己填的、可以隨便填。
3. 末三碼的熵只有約 10 bit。訂單號 + 3 碼的組合，在有枚舉面的情況下不構成證明。
4. 市場結帳能用這招，是因為 `phone_last_digits` 是**結帳當下額外收集的、且鎖死在單一 checkout id 上**——攻擊者要先知道 checkout id 才進得了那扇門。單店訪客單沒有這個前置。

這一點應該直接寫進程式碼註解，因為它看起來很方便，很容易被後人「補上」。

### 10.4 濫用控制彙整

| 向量 | 控制 |
| --- | --- |
| 拿別人的 token | token 是 256 bit CSPRNG，猜不到；且 4h 後失效 |
| 暴力枚舉 checkoutId + 末三碼 | 沿用既有雙層限流（per-IP 10/15min + per-checkout 5 次/1h 鎖） |
| 大量嘗試找出哪些訂單未認領 | 每 customer 每小時 20 次認領請求（KV）；`ORDER_ALREADY_CLAIMED` 與 `ORDER_NOT_CLAIMABLE` 都是 409，不區分細節 |
| 重複認領同一張單 | `order_claims_order_succeeded_unique` partial unique + 條件式 UPDATE |
| 事後追查 | 每次嘗試（成功與失敗）都寫 `order_claims`，含 IP／UA |

### 10.5 涵蓋率的誠實評估

路徑 1 受 guest token 的 **4 小時 TTL** 限制。一位訪客當晚下單、隔天才註冊，token 已經失效——單店訂單就認領不到了（市場結帳還有路徑 2）。

**這是刻意接受的。** 提高涵蓋率的兩個選項都有代價，列在 Q-7：延長 TTL（增加憑證外洩的曝險窗口）、或在下單回應裡另發一個長效的 claim token（新的憑證面）。**Stage 0.2（下單當下就帶 `customer_id`）才是根本解**——它讓「需要認領」的訂單數在未來趨近於 0，認領只需要處理歷史與真正的訪客。

---

## 11. 重複會員合併

### 11.1 重複從哪來

`customers.primary_phone` / `primary_email` 的唯一索引都帶 `status = 'active'` 條件（`customers.ts:45-54`），而且**手機列與 Email 列彼此不衝突**。所以同一個人可以有：手機 OTP 註冊一列、Email 密碼註冊一列、之後 OAuth（`customer_auth_identities`，`(provider, provider_uid)` 全域唯一）又一列。

**上線前先量測**：`customers` 裡有多少列可以配對（例如 `display_name` 相同或 `customer_auth_identities` 指向同一 provider_uid）。若答案是個位數，Stage D4 的優先順序應該再往後排——手動 SQL 處理個位數比維護一台狀態機便宜。

### 11.2 誰能觸發

| 觸發者 | 可以嗎 | 條件 |
| --- | --- | --- |
| 顧客自助 | ✅ | 必須**同時**證明持有 survivor 的 session（customer JWT）**與** merged 的識別碼（OTP／Email 驗證連結）。少了任何一半就是帳號接管 |
| 平台管理員 role 0 | ✅ | 需填 `reason`，寫 audit |
| **店主 role 1** | ❌ **絕對不可** | 他看不到 canonical id，也沒有跨租戶資訊判斷是否同一人。合併會影響其他租戶的資料 |

`survivorCustomerId === mergedCustomerId` → `MERGE_SELF_NOT_ALLOWED`。

### 11.3 survivor 的選法

預設 survivor = **較早建立**那列（UUID v7 字典序較小）。理由：它的 id 被更多歷史資料引用，搬動量較小。呼叫端可明確覆寫（例如較新那列才有 OAuth 綁定）。

### 11.4 合併的每一步（`customer_merge_steps.step` 的完整清單，含衝突處置）

**執行順序很重要：事實表先搬，`restaurant_customers` 最後重算。**

| # | step | 動作 | 衝突處置 |
| --- | --- | --- | --- |
| 1 | `orders` | `UPDATE orders SET customer_id = survivor WHERE customer_id = merged` | 無唯一約束，直接搬。分批（每批 500），批次序號寫進 step 名 |
| 2 | `market_checkout_sessions` | 同上 | 無 |
| 3 | `reservations` | 同上 | 無 |
| 4 | `waiting_list` | 同上 | 無 |
| 5 | `service_bookings` | 同上（**兩張表**：`service_bookings.ts:101` 與 `:258`） | 無 |
| 6 | `order_claims` | 同上 | 無 |
| 7 | `customer_preferences` | PK 即 customer_id（1:1） | survivor 已有 → 保留 survivor，刪除 merged 那列並把內容存進 `detail`；survivor 沒有 → 直接搬 |
| 8 | `customer_favorites` | UNIQUE(customer, type, target) | 先刪除 merged 中與 survivor 重複者（記錄），再搬其餘 |
| 9 | `customer_recent_markets` | UNIQUE(customer, market) | 重複時取 `visited_at_ms` 較新者，刪另一列 |
| 10 | `customer_push_subscriptions` | `endpoint` 是**全域**唯一 | 直接搬，不會衝突 |
| 11 | `customer_consents` | append-only 帳本 | **搬** `customer_id`（保留原 `granted_at` / IP / UA），**並額外 INSERT 一筆 `source = 'merge'` 的紀錄**指出來源 alias。稽核要求原始事件不被改寫，搬 FK 不算改寫事件內容 |
| 12 | `customer_auth_identities` | `(provider, provider_uid)` 全域唯一 → 搬安全；但 `customer_auth_identities_one_password_idx`（每 customer 只能一組 password）會衝突 | survivor 已有 password identity → merged 的 password identity 標記刪除並記錄；其餘直接搬 |
| 13 | `customer_phone_verification_tokens` / `customer_verification_tokens` | 一次性、短命 | **不搬，刪除 merged 的**，只記筆數 |
| 14 | `user_coupons` | `user_coupons_holder_live_unique(coupon_id, owner_customer_id) WHERE state IN ('issued','reserved')` | 同券重複時保留 survivor 的、把 merged 的設為 `state = 'expired'` 並記錄 |
| 15 | `customer_addresses` | 無跨列唯一約束，但 `is_default` 每 customer 唯一 | 搬完後把 merged 帶來的 `is_default` 全部清 0，保留 survivor 原本的預設 |
| 16 | `credit_accounts` | `UNIQUE(owner_customer_id, currency) WHERE NOT NULL` | **同幣別衝突時不合併餘額**（那是動錢）。MVP：只搬無衝突的帳戶，衝突的留在原處並在 `detail` 標記 `requires_manual_transfer`。餘額轉移見 Q-6 |
| 17 | `partnerships/verified_members` | 需先確認其唯一約束 | 見 Q-9 |
| 18 | `restaurant_customers` | UNIQUE(restaurant_id, customer_id) | **不搬 FK，改重算**：對 merged 曾出現的每個 `restaurant_id`，重算 survivor 的那列（此時 orders 已搬完，重算自然涵蓋），`tags` 取聯集、`note` 串接並標明來源、`is_blocked` 取 OR；然後刪除 merged 的列 |
| 19 | `customers` | 收尾 | merged 列：`status = 'merged'`、清空 `primary_phone` / `primary_email`（釋放 partial unique）、寫 `updated_at_ms`。survivor 列：若原本缺 phone／email 而 merged 有，補上 |
| 20 | `customer_merge_aliases` | 收尾 | INSERT `(mergedId → survivorId, jobId)` |

### 11.5 可重入 / 可中斷續跑

- 每一步是**獨立的、冪等的** SQL。`UPDATE ... WHERE customer_id = merged` 跑第二次會影響 0 列——這就是冪等。
- 每一步完成後 upsert `customer_merge_steps`（`(job_id, step)` 唯一）。續跑時跳過所有 `status = 'done'` 的步驟。
- 大表分批：step 名帶批次序號（`orders#1`、`orders#2`…），`step_cursor` 存最後處理到的 `orders.id`。
- `customer_merge_jobs` 的兩個 partial unique（active survivor / active merged）保證同一個 customer 同時只有一台狀態機在動。
- 失敗：`status = 'failed'`、`last_error` 記錄、`attempts` 遞增。`POST .../resume` 從 `current_step` 續跑。
- Runner 由 cron 推進（`apps/api/src/index.ts` 已有 cron handler 慣例），也支援手動 resume。單次執行有時間預算（Worker CPU 限制），跑不完就存 cursor 下次繼續。

### 11.6 可稽核與可回溯（誠實的界線）

**承諾的**：

- 每一步搬了幾列、遇到什麼衝突、怎麼處置，全在 `customer_merge_steps.detail`。
- 筆數少的表（`customer_preferences`、`customer_favorites`、`customer_auth_identities`、`user_coupons`、`credit_accounts`、`customer_addresses`）在 `detail` 存**完整主鍵清單**。
- 筆數可能大的表（`orders` 等）分批存 `{ movedIds: [...] }`，每批一列 step。
- merged 的 `customers` 列**永久保留**（`status = 'merged'`），`customer_merge_aliases` 讓舊 id 永遠解析得到。
- 平台端 UI 可以逐步展開整個 job 的執行紀錄。

**不承諾的**：一鍵 undo。搬移後，`orders.customer_id = survivor` 的列無法從自身區分「本來就是 survivor 的」與「搬過來的」——除非每列都留原值。上面的 `movedIds` 讓**反向 job 可寫**（照清單把 id 搬回去），但那是一個要另外實作、另外測試的東西，不在本規格範圍。這是刻意的取捨：undo 的需求頻率未知，而為它在每張大表加一欄的成本是確定的。

---

## 12. 後台頁面設計

### 12.1 檔案與註冊（照 admin-dashboard 既有慣例）

| 項目 | 內容 |
| --- | --- |
| View | `apps/admin-dashboard/src/views/MembersView.vue`（租戶）、`PlatformCustomersView.vue`、`PlatformCustomerMergesView.vue`（平台） |
| 路由 | `{ path: "members", name: "Members", component: () => import("@/views/MembersView.vue"), meta: { titleKey: "pages.members", roles: [UserRole.ADMIN, UserRole.OWNER] } }`，放在 `/dashboard` 的 children 底下 |
| 路由權限 | 另在 `src/stores/auth.ts` 的 `routePermissions` map 加 `Members: [UserRole.ADMIN, UserRole.OWNER]`（不加的話 `canAccessRoute` 一律放行，只剩 `meta.roles` 一道） |
| 側欄 | `src/components/layout/Sidebar.vue` 的 `navigationItems`，**lucide 圖示**（`UserRound`），`label: t("nav.members")`、`visible: authStore.canAccessAdminFeatures`、`section: "restaurant"`。**不帶 `module`**（見下方） |
| Service | `src/services/membersService.ts`，匯出物件字面值，每個方法 `api.get/post/patch` + `unwrapApiPayload`，**不 catch**（由 view toast） |
| 圖示（頁內） | **Heroicons outline**（`@heroicons/vue/24/outline`）——`UsersView` / `OrdersView` / `CouponsView` 三個清單頁都用這套 |
| i18n | `members: { ... }` namespace + `nav.members` + `pages.members`，**六個 locale 檔全部要加**（`i18n-parity.test.ts` 有四條斷言在把關，且 `untranslated-baseline.json` 只能縮不能長） |
| 測試 | 同目錄 `MembersView.test.ts`，照 `CouponsView.test.ts` 的形狀 |

**模組閘門：v1 不加，理由具體。**

直覺會想用 `MODULES.LOYALTY = "loyalty"`（`packages/database/src/schema/subscriptions.ts:37`）。**不要。** `loyalty` 這個 key 今天的**唯一**用途是 gate B2B 特約商店：`apps/api/src/features/partnerships/routes/index.ts` 有 **21 處** `moduleGate("loyalty")`，而且 `scripts/audit-module-gates.cjs:58-62` 把 `/partnerships/* → loyalty` 的對照寫死在 pre-commit 檢查裡。拿它來 gate 會員管理，等於把「看自己的客人」綁在一條無關的產品線上。

其他 key 也都不合（`analytics` 是報表、`staff_management` 是員工）。新增一個 key 是 TypeScript 常數的事、不需要 migration，但**這個命名決定正由平行的
[`2026-08-30-customer-loyalty-and-oauth-design.md`](./2026-08-30-customer-loyalty-and-oauth-design.md) §3 在處理**（它提議把 B2B 那條改名為 `partnerships`、把 `loyalty` 重新定義為消費者集點）。在那個決定落地之前，本規格**不新增也不借用任何 module key**。

v1 的可見性只靠 `roles: [ADMIN, OWNER]`。這也符合產品直覺：店主看自己的客人不該是加購項目。若之後要 gate，見 Q-8。

**與平行規格的協調（必讀）**

| 項目 | 衝突 | 處置 |
| --- | --- | --- |
| module key 命名 | 兩份規格都會碰 `subscriptions.ts` | 本規格不碰。以 loyalty/OAuth 規格的 §3 決定為準 |
| migration 編號 | 兩份都想用 `0018` | **先落地者取 0018，後者順延。** 本規格的 0016/0017 與對方無交集；`0018_customer_merge_jobs.sql` 開工前先看 `migrations_fresh/` 的實際最大編號 |
| `customers.status` 新值 | 本規格加 `merged`；對方可能不動 | 無衝突，但 schema 檔會有 diff 交會，先合併者為準 |
| 顧客端路由前綴 | 兩份都在 `/api/v1/customer/*` 新增路由 | 無衝突（`/addresses`、`/order-claims`、`/identity` vs `/loyalty`、`/oauth`），但同一個 `routes/index.ts` 會衝突 —— 建議本規格的新路由拆到獨立檔案再 mount |

### 12.2 MembersView 資訊架構

**版面（由上到下）**

1. **頁首** — `flex justify-between items-end`
   - 左：`<h1 class="text-2xl font-semibold text-[#1C1C1E]">會員管理</h1>` + `<p class="mt-1 text-sm text-[#8E8E93]">查看在本店有消費紀錄的顧客</p>`
   - 右：「匯出 CSV」按鈕，`rounded-full px-5 py-2.5 bg-white shadow-ios-sm text-[#1C1C1E] text-sm font-medium`

2. **統計卡列** — `grid grid-cols-1 md:grid-cols-4 gap-4 mb-6`，每張 `bg-white rounded-2xl shadow-ios-card p-5`
   - 總會員數（`UsersIcon`，藍）／本月新增（`UserPlusIcon`，綠）／回頭客比例（`ArrowPathIcon`，橘）／平均客單價（`CurrencyDollarIcon`，靛）
   - 數值 `text-2xl font-semibold text-[#1C1C1E]`，標籤 `text-xs text-[#8E8E93]`，圖示放在 `w-10 h-10 rounded-full bg-blue-50` 的圓形容器裡

3. **快速篩選膠囊列** — `flex flex-wrap gap-2 mb-4`
   - 全部／常客（≥5 單）／新客（1 單）／30 天未回／已封鎖
   - 選中 `rounded-full px-4 py-2 bg-[#007AFF] text-white text-sm font-medium`
   - 未選中 `rounded-full px-4 py-2 bg-white text-[#8E8E93] text-sm font-medium shadow-ios-sm`

4. **進階篩選卡** — `bg-white rounded-2xl shadow-ios-card p-5 mb-6` > `grid grid-cols-1 md:grid-cols-4 gap-4`
   - 搜尋（姓名，或**完整**手機／Email；placeholder 要寫明「手機與 Email 需輸入完整值」；300ms debounce）
   - 標籤下拉、消費金額區間下拉、最後消費日期範圍（兩個 date input）
   - 一顆 `rounded-full` 的重設按鈕在 `flex items-end` 的格子裡
   - 輸入框：`bg-[#F2F2F7] border-0 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#007AFF]/30`（**無邊框**，靠底色分層）

5. **表格** — `bg-white rounded-2xl shadow-ios-card overflow-hidden` > `overflow-x-auto` > `<table class="min-w-full divide-y divide-gray-100">`
   - 三個 sibling `<tbody>`：loading（`colspan` 置中 `common.loading`）／empty（圖示 + 標題 + 說明 + CTA）／rows
   - 表頭 `px-6 py-3 text-left text-xs font-medium text-[#8E8E93] uppercase tracking-wider`
   - 欄位：

   | 欄 | 內容 |
   | --- | --- |
   | 會員 | 圓形頭像（`rounded-full`，無圖時顯示首字）+ `displayName` + 標籤 pill（`rounded-full px-2 py-0.5 text-xs bg-blue-50 text-[#007AFF]`） |
   | 聯絡方式 | `0912***678` + `e***@example.com`，右側一顆 `EyeIcon` 揭露鈕（`w-8 h-8 rounded-full bg-gray-100`） |
   | 本店訂單 | 數字 + 「取消 N」小字 |
   | 本店消費 | 金額（`useCurrency().formatPrice`） |
   | 最後消費 | 相對時間（`useDateFormatter().formatRelativeTime`） |
   | 首次消費 | 短日期 |
   | 狀態 | `rounded-full` badge：正常（綠）／已封鎖（紅）／已刪除（灰） |
   | 操作 | 「詳情」文字鈕 |

   - 列 `hover:bg-[#F2F2F7] transition-colors duration-200`，整列可點開抽屜
   - `data-testid="member-row-{memberId}"`、`data-status="{status}"`

6. **分頁** — 照 `CouponsView.vue:340-409` 的完整實作：mobile `sm:hidden` 的 prev/next 一對；desktop 「顯示 X–Y，共 Z 筆」+ 數字頁碼（current ± 2），按鈕 `rounded-full`，目前頁 `bg-[#007AFF] text-white`

7. **詳情抽屜** — 照 `FeedbackView.vue:173-210` 的 `Teleport` + `Transition name="sheet"` bottom sheet
   - 遮罩 `absolute inset-0 bg-black/30 backdrop-blur-sm`
   - 面板 `w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-[#F2F2F7] rounded-t-3xl sm:rounded-3xl p-5 space-y-4`
   - 關閉鈕 `w-8 h-8 rounded-full bg-gray-200`（lucide `X`）
   - 內容分成四張白色 `rounded-2xl shadow-ios-card p-4` 卡片：
     1. **身分** — 頭像、displayName、遮罩聯絡方式 + 揭露鈕、locale、加入本店時間
     2. **本店消費摘要** — 訂單數／取消數／總額／客單價／首末次，2×3 grid
     3. **本店訂單** — 近 20 筆的緊湊列表，每列可跳到 OrdersView
     4. **標籤與備註** — 可編輯（tag input + textarea），存檔走 `PATCH`
   - 底部危險區：封鎖／解封按鈕（`rounded-full bg-[#FF3B30]/10 text-[#FF3B30]`），走 `useConfirmModal()`
   - **明確不顯示**：跨店資料、收藏、同意帳本、儲值餘額、地址、付款方式

**揭露互動**：點眼睛 → `useConfirmModal({ type: "warning", title: "顯示完整聯絡方式", message: "此操作會被記錄在稽核日誌中。", confirmLabel: "顯示" })` → 呼叫 API → 就地換成完整值、圖示改成 `EyeSlashIcon` → 5 分鐘後自動還原遮罩。

### 12.3 PlatformCustomersView（role 0）

同樣的骨架，差別：

- 沒有 `moduleGate`（平台功能）
- 多一欄「消費過的店家數」
- 詳情抽屜多一張「各店消費」卡片（列出 `restaurant_customers` 的所有列）
- 多一個「發起合併」動作 → 開 `PlatformCustomerMergesView` 的建立表單（選另一個 customer、填 reason）
- 仍然預設遮罩、揭露仍寫 audit

`PlatformCustomerMergesView`：job 清單（status badge + 進度「12/20 步」）+ 詳情抽屜展開 `customer_merge_steps`（每步的 rowsMoved 與衝突處置），底部「續跑」／「取消」按鈕。

### 12.4 §15 設計檢查清單對照

| 檢查項 | 本設計 |
| --- | --- |
| 頁面背景 `#F2F2F7` | ✅ `DefaultLayout` 根已是 `bg-ios-bg`；篩選輸入框也用 `bg-[#F2F2F7]` 做內凹感 |
| 卡片白色 + 大圓角（≥20px）+ 柔和陰影 | ✅ 全部 `bg-white rounded-2xl`（16px→改用 `rounded-2xl`=16px；統計卡與表格容器一律 `rounded-2xl`，抽屜用 `rounded-3xl`=24px）+ `shadow-ios-card`（6% opacity） |
| 避免生硬實線邊框 | ✅ 輸入框 `border-0` 靠底色分層；表格分隔用 `divide-gray-100`（極淺）；篩選卡無框 |
| 按鈕與標籤膠囊形 | ✅ 所有按鈕、篩選膠囊、狀態 badge、標籤 pill 一律 `rounded-full` |
| 陰影 opacity ≤ 8% | ✅ `shadow-ios-sm`(4%)／`shadow-ios-card`(6%)／`shadow-ios-float`(8%)，不自訂更深的 |
| 文字避免純黑 | ✅ 主要文字 `text-[#1C1C1E]`，次要 `text-[#8E8E93]`，第三層 `text-[#AEAEB2]` |
| 標題與正文層級對比 | ✅ h1 `text-2xl font-semibold` / 區塊標題 `text-base font-semibold` / 正文 `text-sm` / 標籤 `text-xs` |
| 充足留白 | ✅ 卡片 `p-5`、區塊間 `mb-6`、格線 `gap-4`、表格 `px-6 py-4` |
| 功能色正確 | ✅ 藍 `#007AFF`=主要動作與選中；綠 `#34C759`=正常狀態；橘 `#FF9500`=回頭率等警示指標；紅 `#FF3B30`=封鎖與危險操作 |
| 粉彩低飽和高明度 | ✅ 圖示容器 `bg-blue-50` / `bg-green-50` / `bg-orange-50`，標籤 pill `bg-blue-50 text-[#007AFF]` |
| 圖示風格統一 | ✅ 頁內全部 Heroicons **outline**（不混 solid）；側欄用 lucide（該檔既有慣例） |
| 適當動效 | ✅ 列 hover `transition-colors duration-200`；抽屜 `.sheet` transition `0.3s ease-out` + `translateY(100%)`；膠囊切換 `transition-all duration-200` |
| 整體像 iOS 原生 App | ✅ bottom sheet、膠囊控制、無邊框輸入、柔和陰影、`#F2F2F7` 底 |

**一個要記錄的既有落差**：這個 app 的 `tailwind.config.js` 只定義了 `ios-bg`、`ios-primary/success/warning/error/teal` 與三個陰影，**沒有** `ios-text` / `ios-secondary` / `ios-separator` token；既有畫面一半用 token、一半用 `text-[#1C1C1E]` 這種 arbitrary value。本規格採**與 `FeedbackView.vue` 一致的 arbitrary value 寫法**（那是最新的 iOS 風格頁面），不順手擴充 config——擴充 token 是獨立的一個 PR，混進來會讓 diff 難審。

---

## 13. 工作拆解與出貨順序

每個 Stage 都可獨立出貨、且獨立跑得綠。

### Stage 0 — 前置硬化（1–2 天，無新功能，**最高優先**）

| ID | 內容 | 為什麼排最前 |
| --- | --- | --- |
| **S0.1** | 修 `resolveDistributionAudience` 的 `user` 分支：`customerIds` 必須與本店受眾取交集（`restaurantId !== null` 時）。加真實 D1 跨租戶測試 | 這是既有的 #265 形狀漏洞。會員管理頁會把識別碼交到店主手上，**必須先關上這扇門** |
| **S0.2** | `POST /guest-orders` 加 `optionalCanonicalCustomerAuthMiddleware`，把 `c.get("customer")?.id` 傳進 `createOrder`；migration 0015 加 `orders.guest_placed` 並在 `createOrder` 寫入 | 讓新訂單不再變成孤兒。它同時是 (B) 的解除條件之一、也讓 (D) 的長期工作量趨近於 0 |

### Stage A1 — 會員管理（唯讀）

- migration 0016（`restaurant_customers` + orders 複合索引 + guard triggers）
- `scripts/backfill-restaurant-customers.ts` + nightly reconcile cron
- 訂單終態時的重算式 upsert
- `TenantMemberDirectoryService` + list / stats / detail / member-orders 四條路由
- **跨租戶真實 D1 整合測試（含突變測試）**
- `MembersView.vue`：統計卡、篩選、表格、分頁；i18n×6；路由；側欄
- `membersService.ts`

### Stage A2 — PII 揭露與稽核

- `pii-masking.ts`、`reveal-contact` 路由、KV 限流
- `AUDIT_ACTIONS` 加兩個常數
- 前端揭露互動（確認 → 顯示 → 5 分鐘還原）
- CSV 匯出（預設遮罩）+ audit

### Stage D1 — 自動認領（持有證明）

- migration 0017（`order_claims`）
- `POST /customer/order-claims` 路徑 1 + `GET` 歷史
- 認領後觸發 `restaurant_customers` 重算
- customer-app 登入後自動送出手上的 token

### Stage A3 — 租戶本地標記

- `PATCH .../members/:memberId`（tags / note / isBlocked）
- 詳情抽屜的編輯區、封鎖確認

### Stage D2 — 市場結帳延遲認領

- `POST /customer/order-claims` 路徑 2（複用既有鎖定機制）

### Stage A4 — 平台端

- `/api/v1/admin/customers/*`
- `PlatformCustomersView.vue`

### Stage D3 — 識別碼綁定

- `/api/v1/customer/identity/*`（綁定，不含合併）
- customer-app ProfileView 的「已綁定的登入方式」區塊

### Stage D4 — 合併引擎（最大一塊）

- migration 0018（三張表）+ `customers.status` 加 `merged`
- 20 個步驟的 runner（可重入、可續跑、分批）
- `/api/v1/admin/customers/merges/*`
- `PlatformCustomerMergesView.vue`
- 顧客自助合併（建立在 D3 之上）

### Stage B — 地址簿（**gated**）

**Stage 0.2 上線且有真實外送單之後才排。** 內容：migration 0019、`/customer/addresses` 五條路由、`UNLAUNCHED_FEATURES` 登記、customer-app ProfileView 地址簿 + `ShopCartModal` 地址選取器。

### Stage C — 儲存付款方式（**blocked，不排工**）

§8.2 四項解除條件全部成立後另開規格。

### 建議順序

```
S0.1 → S0.2 → A1 → A2 → D1 → A3 → D2 → A4 → D3 → D4 → (B) → (C)
```

理由：S0 是既有漏洞與後續一切的前置；A1 立即有價值且風險為零；A2 讓 A1 合規；D1 阻止資料繼續流失；D4 最貴、且只有在 §11.1 的量測顯示重複數量夠多時才划算。

---

## 14. 測試策略

### 14.1 跨租戶隔離（硬性要求）

**必須是真實 D1 整合測試**，位置 `apps/api/src/__tests__/integration/members-cross-tenant.real.integration.test.ts`，用既有 harness：

```ts
import { createRealIntegrationTestApp, type RealIntegrationTestApp } from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";
// beforeAll: createRealIntegrationTestApp()
// beforeEach: await testApp.testDb.truncateAll()
```

理由（照 `forecast-cross-tenant.real.integration.test.ts` 的先例）：**單元測試把 drizzle 整個 mock 掉，就分辨不出「設限」與「未設限」的查詢**。

**禁止**手寫整包替換的 auth mock。必須 spread 真實模組：

```ts
vi.mock("../../../middleware/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../middleware/auth")>()),
  authMiddleware: vi.fn(/* 只換這一個 */),
}));
```

`forecast` 那次改成 spread 之後，測試從 31 個變成 35 個——有 4 個案例先前**根本沒在執行**。

**每個案例斷言兩件事**：攻擊被拒絕（403/404）**且**受害者的資料逐位元未變。只驗前者的話，「回 403 但仍然寫入」會矇混過關。

必測案例：

| # | 案例 | 期望 |
| --- | --- | --- |
| 1 | A 店主帶自己的 restaurantId + **B 店的 memberId** 讀 detail | 404，且不洩漏該 member 存在 |
| 2 | 同上，PATCH tags | 404，且 B 店那列的 tags 逐位元未變 |
| 3 | 同上，reveal-contact | 404，且未寫 audit_logs（不能讓失敗的嘗試也產生 A 店可讀的紀錄） |
| 4 | A 店主讀自己的 member，但該顧客也在 B 店消費 | 200，但 `orderCount` / `totalSpentCents` **只含 A 店的數字**（斷言具體數值） |
| 5 | A 店主讀 member 的訂單清單 | 只有 A 店訂單；斷言 B 店那張單的 id 不在回應裡 |
| 6 | 回應鍵值允許清單 | `expect(Object.keys(body.data).sort()).toEqual([...])` — 新增欄位忘記脫敏會立刻紅 |
| 7 | 回應不含 `customers.id` | 對整個回應 JSON 字串斷言不含該 UUID |
| 8 | role 2/3/4 存取 | 403 |
| 9 | role 0 未選餐廳 context 走租戶端路由 | 需明確帶 restaurantId，且行為與店主一致 |
| 10 | coupon 發放帶外店 customerIds（S0.1） | 該顧客不在受眾內，且 `user_coupons` 沒有多出列 |

**突變測試驗收**：把 `requireRestaurantAccess` 拿掉 → 預期案例 1/2/3 轉紅；把 `resolveTenantMember` 拿掉 → 預期 1/2/3 轉紅；把投影允許清單換成 spread → 預期 6/7 轉紅。**PR 描述要寫出實際觀察到的紅燈數量**，不是預測。

### 14.2 其他測試

| 範圍 | 做法 |
| --- | --- |
| rollup 重算冪等 | 真實 D1：同一組 `(restaurant, customer)` 重算三次，結果相同；訂單取消後重算，數字正確 |
| 認領 | 真實 D1：token 有效／過期／已被認領／`guest_placed = 0`／併發雙送（partial unique 生效）；成功後 KV token 已刪除 |
| 認領限流 | per-customer 計數器達上限後 429 |
| 合併續跑 | 真實 D1：跑到第 N 步中止 → resume → 最終狀態與一次跑完相同，且沒有任何表被雙搬（斷言 `rowsMoved` 總和） |
| 合併冪等 | 同一 job 連跑兩次，第二次所有步驟 skip，資料不變 |
| 合併衝突 | 對 §11.4 每一種衝突各寫一個案例（`customer_preferences` 1:1、`customer_favorites` unique、`user_coupons` live unique、`credit_accounts` 同幣別） |
| PII 遮罩 | 單元測試 `maskPhone` / `maskEmail` 的邊界（null、極短、國際碼、無 `@`） |
| 前端 | `MembersView.test.ts`：`data-testid` / `data-status` / 文字內容斷言，**不斷言 CSS class** |
| i18n | `i18n-parity.test.ts` 自動涵蓋 literal `t("...")`；**動態 key**（``t(`members.status.${s}`)``）逃得過第 4 條斷言，所以要在 `MembersView.test.ts` 裡逐一列舉所有可能值並斷言 zh-TW 有該 key |
| 大模組冷載入 | 若測試需要 `@/router` 或 feature `./index`，在 `beforeAll` 先 `await import(...)` 並給 30s 預算（#211） |

`pnpm verify:push` 的 `pnpm test:real-integration` 會執行上述整合測試，所以推送前一定跑到。

### 14.3 i18n mock 的陷阱

`vi.mock("@/i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }))` 是這個 app 的既有慣例，但它有個已知副作用：**`t()` 缺 key 時回傳 key 本身，而 mock 成 `key => key` 的測試看不出差別**。所以 i18n 完整性不能靠 view 測試，只能靠 `i18n-parity.test.ts` + 上面說的動態 key 逐一列舉。

---

## 15. 風險

| 風險 | 可能性 | 影響 | 緩解 |
| --- | --- | --- | --- |
| 租戶投影漏出跨店資料 | 中 | **嚴重（PII）** | 三層守門 + 允許清單投影 + 10 個跨租戶真實 D1 案例 + 突變測試；code review 逐條列出可控 ID 的綁定位置 |
| `restaurant_customers` rollup 與 orders drift | 中 | 中 | 重算式 upsert（非遞增）+ nightly reconcile + `recomputed_at_ms` 讓 drift 可見 + 手動 recompute 端點 |
| 生產回填耗時／逾時 | 中 | 中 | 回填放腳本不放 migration；先量 `orders WHERE customer_id IS NOT NULL` 的筆數；分批、可重跑（`ON CONFLICT DO NOTHING`） |
| 會員清單變成 PII 枚舉工具 | 中 | 高 | 搜尋只做完整值等值比對；匯出寫 audit；揭露限流；`memberId` 不透明 |
| coupon 發放的既有跨租戶洞被利用 | 低（今天拿不到 id） | 高 | **S0.1 排在所有事情之前** |
| 地址簿變成死碼 | 高（若不照 gating） | 中 | Gating 判定寫在 §3 與 §8.1；進 `UNLAUNCHED_FEATURES` 登記採用率 |
| 有人看到 `apps/admin-dashboard/src/components/payment/` 的 Stripe 元件，誤以為金流做了一半而開工 (C) | 中 | 中（浪費） | §3.2 明寫它是孤兒死碼；建議另案刪除該目錄 |
| `restaurant_customers` 的 `total_spent_cents` 與店主心中的數字不符（外送費未計入 `total_amount_cents`） | 中 | 低 | §3.1 已記錄成因；rollup 沿用 `orders.total_amount_cents` 這個唯一權威值，不自行加總 |
| 合併把訂單搬錯／搬一半 | 中 | 高 | 每步冪等 + `(job_id, step)` 唯一 + active job partial unique + steps 存 movedIds；先在 staging 對真實資料形狀跑一次 |
| 合併引擎沒人用 | 中 | 中（浪費） | §11.1 要求上線前先量測重複筆數；數量小就改手動 SQL、把 D4 往後排 |
| 認領涵蓋率低於預期 | 中 | 低 | 誠實記在 §10.5；根本解是 S0.2 而非延長 TTL |
| STRICT / dual-track 檢查漏做 | 中 | 低（會被擋） | 每個 migration 的 checklist 寫在 §6.1；`pnpm verify:push` 會跑兩個 check |
| 新頁面 i18n 只加 zh-TW | 中 | 低（會被擋） | `i18n-parity.test.ts` 四條斷言 |
| 有人「順手」把會員頁掛上 `moduleGate("loyalty")` | 中 | 中 | §12.1 寫明 `loyalty` = B2B 特約商店；`scripts/audit-module-gates.cjs` 的前綴對照表會在 pre-commit 擋下不一致的 gate |
| 與平行的 loyalty/OAuth 規格搶 migration 編號 0018 / 搶改 `subscriptions.ts` | 中 | 低 | §12.1 的協調表；開工前重看 `migrations_fresh/` 的實際最大編號 |

---

## 16. Open Questions

| ID | 問題 | 傾向 |
| --- | --- | --- |
| **Q-1** | `restaurant_customers` 的 membership 只看 orders，還是也納入 `reservations` / `waiting_list` / `service_bookings`？ | MVP 只看 orders（「會員」= 有消費）。訂位／候位的客人在各自頁面已看得到。若要納入，加 `membership_sources` 位元欄位而非改定義 |
| **Q-2** | `isBlocked` 只是標記，還是真的擋下單？ | 傾向先只做標記。真要擋，必須決定訪客單怎麼認定（訪客沒有 `customer_id`，擋不到），否則是半套 |
| **Q-3** | CSV 匯出可以包含完整 PII 嗎？ | 傾向：預設遮罩；完整匯出只給 role 0，且每次寫 audit + 要求填用途。店主拿到完整名單就等於平台失去對 PII 流向的控制 |
| **Q-4** | coupon 發放改吃 `memberIds` 而非 `customerIds`？ | 傾向是。S0.1 只是關上洞，改吃 memberIds 才是根治（店主的世界裡不該存在 `customers.id`） |
| **Q-5** | 合併要支援 undo 嗎？ | 傾向不承諾。`movedIds` 讓反向 job 可寫，但不預先實作 |
| **Q-6** | `credit_accounts` 同幣別衝突時的餘額轉移何時做？ | 傾向排在 `STORED_VALUE_CREDITS_ENABLED` 真的開啟之後。今天 0 列，寫了也測不到真實情況 |
| **Q-7** | guest token 的 4h TTL 要為認領延長嗎？ | 傾向不動。延長 TTL 是拿憑證曝險換涵蓋率，而 S0.2 才是根本解 |
| **Q-8** | 會員管理要不要 module gate？用哪個 key？ | v1 **不 gate**。`loyalty` 今天是 B2B 特約商店（21 處 `moduleGate("loyalty")` + pre-commit 對照表），借用它是錯的。若之後決定 gate，要等平行的 loyalty/OAuth 規格 §3 把命名理清、新增一個 `crm` 或 `members` key，並同步更新 `scripts/audit-module-gates.cjs` 與六個語系的標籤 |
| **Q-9** | `partnerships/verified_members` 的唯一約束是什麼？合併時怎麼處置？ | 待查。Stage D4 開工前必須確認，否則第 17 步會在生產爆 constraint |
| **Q-10** | 「本店消費金額」是否要扣掉退款？ | `orders.refund_amount_cents` 存在但目前未納入 rollup。傾向 v1 不扣（與 coupon 受眾定義一致），v2 再加一欄 `refunded_cents` 分開呈現 |

---

## 17. Out of Scope（明確排除）

- 會員等級／點數／推薦碼 —— 各自獨立規格。
- 顧客評價與評分 —— Phase 1 §11 已標為獨立規格。
- 行銷活動編輯器、EDM／簡訊群發 —— 需要先有 §9.3 的同意判定與發送基礎設施。
- 自動偵測重複會員 —— 只做被觸發的合併。
- `customers` 的 OAuth provider 新增（LINE／Apple／Google 的實際串接）—— `customer_auth_identities` 已存在，串接是另一件事。
- `apps/api/src/features/customer/routes/index.ts` 既有 raw SQL 的重寫 —— 新碼一律 Drizzle，既有碼另案處理。
- 擴充 `tailwind.config.js` 的 `ios-*` token —— 獨立 PR。

---

## 18. 估算

| 工作 | 估時 |
| --- | --- |
| S0.1 coupon 受眾跨租戶修正 + 測試 | 1 天 |
| S0.2 guest-orders 帶 customer_id + `guest_placed` + 測試 | 1 天 |
| A1 migration + 回填 + reconcile + 服務層 + 4 條路由 | 4 天 |
| A1 跨租戶真實 D1 測試（10 案例 + 突變驗收） | 2 天 |
| A1 MembersView + i18n×6 + 路由 + 側欄 + 前端測試 | 4 天 |
| A2 遮罩 + 揭露 + audit + 匯出 | 2 天 |
| D1 `order_claims` + 認領路徑 1 + 客戶端自動送出 | 3 天 |
| A3 標籤／備註／封鎖 | 1.5 天 |
| D2 市場結帳延遲認領 | 1 天 |
| A4 平台端路由 + PlatformCustomersView | 3 天 |
| D3 識別碼綁定 | 2.5 天 |
| D4 合併引擎（schema + 20 步 runner + 路由 + UI + 測試） | 8 天 |
| 文件、changelog、memory 更新 | 1 天 |
| **合計（不含 B / C）** | **約 34 dev-days** |
| B 地址簿（解除後） | 4 天 |
| C 儲存付款方式 | 不估——需先有 PSP |

到 A2 為止（**首次可交付的完整價值**）約 **14 dev-days**。

---

## 19. Review Checklist

- [ ] 多租戶邊界：`memberId` 不透明、投影是允許清單、三層守門、service 簽章強制帶 scope —— 同意？
- [ ] S0.1（coupon 受眾跨租戶）排在所有事情之前 —— 同意？
- [ ] (B) 標為 gated 且解除條件是 S0.2 + 真實外送單 —— 同意？
- [ ] (C) 標為 blocked 且 migration 不落地 —— 同意？
- [ ] 拒絕「訂單號 + 手機末碼」認領任意訂單 —— 同意？
- [ ] 店主不能刪除會員、也不能觸發合併 —— 同意？
- [ ] 合併不承諾一鍵 undo，只承諾可解釋 + 反向 job 可寫 —— 同意？
- [ ] Stage D4 開工前先量測重複會員實際筆數 —— 同意？
- [ ] 會員管理 v1 不加 module gate（`loyalty` 今天是 B2B 特約商店，不可借用）—— 同意？
- [ ] Q-9（`verified_members` 約束）需在 D4 開工前查清
- [ ] 與平行的 [`2026-08-30-customer-loyalty-and-oauth-design.md`](./2026-08-30-customer-loyalty-and-oauth-design.md) 的三處交會（module key、migration 編號、`/api/v1/customer/*` 路由檔）已在 §12.1 記錄 —— 需要一起拍板

# 特約商店 (Corporate Partnership) 功能實作規劃藍圖 v2.0

## 📋 文件資訊

- **版本**: 2.0
- **最後更新**: 2025-11-16
- **狀態**: 待審核
- **技術棧**: Drizzle ORM + Cloudflare D1 (SQLite)

## 🎯 1. 總覽 (Executive Summary)

本文件旨在規劃與說明「特約商店」功能的完整技術實作路徑。此功能讓與本平台簽約合作的企業或機構（特約商店）之員工在消費時能享有專屬的折扣或優惠。

### 1.1 功能定位

本功能實現 **B2B2C 的企業員工優惠系統**，讓與本平台簽約合作的企業/機構（特約商店）之員工，在消費時能享有專屬的折扣或優惠。

### 1.2 核心價值

```
┌─────────────────────────────────────────────────────────────┐
│                   價值主張三角                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                        【平台】                              │
│                          │                                  │
│                          │                                  │
│              增加 B2B 收入 + 提升用戶黏性                     │
│                          │                                  │
│            ┌─────────────┴─────────────┐                    │
│            │                           │                    │
│            ↓                           ↓                    │
│        【企業】                      【員工】                 │
│    員工福利成本降低              享有專屬優惠                 │
│    提升員工滿意度                提升消費體驗                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 影響範圍

此專案會與以下幾個核心應用程式協作：

```
影響的應用程式                    變更類型
════════════════════════════════════════════════════

apps/api                         🆕 新增模組（資料庫、Service、API）
apps/admin-dashboard             🆕 新增管理介面
apps/customer-app                🔧 修改結帳流程 + 新增驗證介面
packages/database                🆕 新增 5 個資料表
packages/shared-types            🆕 新增類型定義
```

---

## 🗄️ 2. 資料庫架構設計 (Database Schema)

### 2.1 技術規格

- **ORM**: Drizzle ORM v0.44.7
- **資料庫**: Cloudflare D1 (SQLite-compatible)
- **Schema 位置**: `packages/database/src/schema/corporate.ts`
- **Migration**: 使用 drizzle-kit generate

### 2.2 資料表關係圖

```
┌──────────────────────┐
│  corporatePartners   │ ← 特約商店主表
│  (特約商店)          │
└─────────┬────────────┘
          │ 1:N
          ├──────────────┬──────────────┐
          ↓              ↓              ↓
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ corporatePromo   │  │ corporateDisc    │  │ userCorporate    │
│   Codes          │  │   ounts          │  │  Memberships     │
└──────────────────┘  └─────────┬────────┘  └─────────┬────────┘
                                │                      │
                                │ N:1                  │ 1:N
                                ↓                      ↓
                      ┌──────────────────┐  ┌──────────────────┐
                      │   restaurants    │  │ corporateDisc    │
                      └──────────────────┘  │  ountUsages      │
                                            └─────────┬────────┘
                                                      │ N:1
                                                      ↓
                      ┌──────────────────┐  ┌──────────────────┐
                      │      users       │  │     orders       │
                      └──────────────────┘  └──────────────────┘
```

### 2.3 完整 Schema 定義

#### 📄 文件位置: `packages/database/src/schema/corporate.ts`

```typescript
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { restaurants } from './restaurants'
import { users } from './users'
import { orders } from './orders'

// ============================================
// 1. 特約商店主表 (Corporate Partners)
// ============================================
export const corporatePartners = sqliteTable('corporate_partners', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  // 基本資訊
  name: text('name').notNull(),
  displayName: text('display_name'), // 顯示名稱（可不同於正式名稱）
  description: text('description'),
  logoUrl: text('logo_url'),

  // 聯絡資訊
  contactName: text('contact_name'),
  contactEmail: text('contact_email').notNull(),
  contactPhone: text('contact_phone'),

  // 驗證配置
  allowedEmailDomains: text('allowed_email_domains', { mode: 'json' })
    .$type<string[]>(), // ['example.com', 'subsidiary.com']
  requireEmailVerification: integer('require_email_verification', { mode: 'boolean' })
    .notNull()
    .default(true),

  // 企業資訊
  companyRegistrationNumber: text('company_registration_number'), // 統一編號
  industry: text('industry'), // 產業類別
  employeeCount: integer('employee_count'), // 員工數（參考用）

  // 狀態管理
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  status: text('status').notNull().default('pending'),
  // 'pending' | 'active' | 'suspended' | 'terminated'

  suspendReason: text('suspend_reason'), // 暫停原因
  terminatedReason: text('terminated_reason'), // 終止原因

  // 合約資訊
  contractStartDate: integer('contract_start_date', { mode: 'timestamp' }),
  contractEndDate: integer('contract_end_date', { mode: 'timestamp' }),
  contractDocument: text('contract_document'), // 合約文件 URL

  // 備註
  notes: text('notes'), // 內部備註

  // 審計欄位
  createdBy: integer('created_by').references(() => users.id),
  updatedBy: integer('updated_by').references(() => users.id),
  approvedBy: integer('approved_by').references(() => users.id),
  approvedAt: integer('approved_at', { mode: 'timestamp' }),

  // 時間戳記
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$onUpdate(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }), // 軟刪除
})

// ============================================
// 2. 折扣規則表 (Corporate Discounts)
// ============================================
export const corporateDiscounts = sqliteTable('corporate_discounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  // 關聯
  partnerId: integer('partner_id')
    .notNull()
    .references(() => corporatePartners.id, { onDelete: 'cascade' }),
  restaurantId: integer('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' }),

  // 基本資訊
  name: text('name').notNull(), // 折扣名稱
  displayName: text('display_name'), // 前端顯示名稱
  description: text('description'),

  // 折扣設定
  discountType: text('discount_type').notNull(),
  // 'percentage' | 'fixed_amount' | 'buy_x_get_y'
  discountValue: real('discount_value').notNull(),
  // percentage: 0-100, fixed: 金額（元）

  // 進階條件
  minSpend: real('min_spend'), // 最低消費金額
  maxDiscount: real('max_discount'), // 最大折扣金額上限

  applicableCategories: text('applicable_categories', { mode: 'json' })
    .$type<number[]>(), // 適用的菜單分類 ID
  excludedMenuItems: text('excluded_menu_items', { mode: 'json' })
    .$type<number[]>(), // 排除的菜單項目 ID

  // 時間限制
  validFrom: integer('valid_from', { mode: 'timestamp' }),
  validUntil: integer('valid_until', { mode: 'timestamp' }),

  applicableDays: text('applicable_days', { mode: 'json' })
    .$type<number[]>(), // [0-6] 0=週日, 6=週六
  applicableTimeStart: text('applicable_time_start'), // HH:mm
  applicableTimeEnd: text('applicable_time_end'), // HH:mm

  // 使用限制
  totalUsageLimit: integer('total_usage_limit'), // 總使用次數上限
  perUserLimit: integer('per_user_limit'), // 每人使用次數上限
  perUserDailyLimit: integer('per_user_daily_limit'), // 每人每日使用次數上限
  usedCount: integer('used_count').notNull().default(0), // 已使用次數

  // 優先級與組合規則
  priority: integer('priority').notNull().default(0), // 數字越大優先級越高
  canCombineWithCoupons: integer('can_combine_with_coupons', { mode: 'boolean' })
    .notNull()
    .default(false),
  canCombineWithOtherDiscounts: integer('can_combine_with_other_discounts', { mode: 'boolean' })
    .notNull()
    .default(false),

  // 狀態
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),

  // 審計
  createdBy: integer('created_by').references(() => users.id),
  updatedBy: integer('updated_by').references(() => users.id),

  // 時間戳記
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$onUpdate(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
})

// ============================================
// 3. 用戶企業會員關聯表 (User Corporate Memberships)
// ============================================
export const userCorporateMemberships = sqliteTable('user_corporate_memberships', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  // 關聯
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  partnerId: integer('partner_id')
    .notNull()
    .references(() => corporatePartners.id, { onDelete: 'cascade' }),

  // 驗證資訊
  verificationMethod: text('verification_method').notNull(),
  // 'email_domain' | 'promo_code' | 'manual_approval'
  verificationValue: text('verification_value').notNull(),
  // 實際的 email 或 code

  // Email 驗證
  emailVerificationToken: text('email_verification_token'),
  emailVerificationTokenExpiry: integer('email_verification_token_expiry', { mode: 'timestamp' }),
  emailVerifiedAt: integer('email_verified_at', { mode: 'timestamp' }),

  // 審核資訊
  verifiedAt: integer('verified_at', { mode: 'timestamp' }),
  verifiedBy: integer('verified_by').references(() => users.id), // 審核者（如果需要人工審核）

  // 狀態管理
  status: text('status').notNull().default('pending'),
  // 'pending' | 'active' | 'expired' | 'revoked' | 'rejected'

  // 有效期
  expiresAt: integer('expires_at', { mode: 'timestamp' }), // 會員資格到期時間

  // 撤銷資訊
  revokedAt: integer('revoked_at', { mode: 'timestamp' }),
  revokedBy: integer('revoked_by').references(() => users.id),
  revokeReason: text('revoke_reason'),

  // 拒絕資訊（審核不通過）
  rejectedAt: integer('rejected_at', { mode: 'timestamp' }),
  rejectedBy: integer('rejected_by').references(() => users.id),
  rejectReason: text('reject_reason'),

  // 備註
  notes: text('notes'), // 管理員備註

  // 時間戳記
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$onUpdate(() => new Date()),
})

// ============================================
// 4. Promo Code 管理表 (Corporate Promo Codes)
// ============================================
export const corporatePromoCodes = sqliteTable('corporate_promo_codes', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  // 關聯
  partnerId: integer('partner_id')
    .notNull()
    .references(() => corporatePartners.id, { onDelete: 'cascade' }),

  // Code 資訊
  code: text('code').notNull().unique(),
  description: text('description'),
  codeType: text('code_type').notNull().default('general'),
  // 'general' | 'single_use' | 'employee_specific'

  // 使用限制
  maxUses: integer('max_uses'), // 總使用次數上限（null = 無限制）
  usedCount: integer('used_count').notNull().default(0),
  perUserLimit: integer('per_user_limit').notNull().default(1), // 每人使用次數

  // 時間限制
  validFrom: integer('valid_from', { mode: 'timestamp' }),
  validUntil: integer('valid_until', { mode: 'timestamp' }),

  // 用戶限制（如果是 employee_specific 類型）
  allowedUserEmails: text('allowed_user_emails', { mode: 'json' })
    .$type<string[]>(),
  allowedUserIds: text('allowed_user_ids', { mode: 'json' })
    .$type<number[]>(),

  // 批次管理（如果是批次產生的 code）
  batchId: text('batch_id'), // 批次識別碼
  batchNotes: text('batch_notes'), // 批次備註

  // 狀態
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),

  // 審計
  createdBy: integer('created_by').references(() => users.id),

  // 時間戳記
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$onUpdate(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
})

// ============================================
// 5. 折扣使用記錄表 (Corporate Discount Usages)
// ============================================
export const corporateDiscountUsages = sqliteTable('corporate_discount_usages', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  // 關聯
  discountId: integer('discount_id')
    .notNull()
    .references(() => corporateDiscounts.id),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  orderId: integer('order_id')
    .notNull()
    .references(() => orders.id),
  membershipId: integer('membership_id')
    .notNull()
    .references(() => userCorporateMemberships.id),
  restaurantId: integer('restaurant_id')
    .notNull()
    .references(() => restaurants.id),

  // 折扣詳情
  discountType: text('discount_type').notNull(), // 保存當時的折扣類型
  discountValue: real('discount_value').notNull(), // 保存當時的折扣值

  originalAmount: real('original_amount').notNull(), // 原始金額
  discountAmount: real('discount_amount').notNull(), // 折扣金額
  finalAmount: real('final_amount').notNull(), // 最終金額

  // 其他優惠組合資訊
  otherDiscounts: text('other_discounts', { mode: 'json' })
    .$type<{
      couponDiscount?: number
      memberDiscount?: number
      otherDiscount?: number
    }>(),

  // 快照資料（保留當時的折扣規則）
  discountSnapshot: text('discount_snapshot', { mode: 'json' })
    .$type<{
      name: string
      description?: string
      conditions?: any
    }>(),

  // 時間
  usedAt: integer('used_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

// ============================================
// Relations 定義
// ============================================

export const corporatePartnersRelations = relations(corporatePartners, ({ many }) => ({
  discounts: many(corporateDiscounts),
  promoCodes: many(corporatePromoCodes),
  memberships: many(userCorporateMemberships),
}))

export const corporateDiscountsRelations = relations(corporateDiscounts, ({ one, many }) => ({
  partner: one(corporatePartners, {
    fields: [corporateDiscounts.partnerId],
    references: [corporatePartners.id],
  }),
  restaurant: one(restaurants, {
    fields: [corporateDiscounts.restaurantId],
    references: [restaurants.id],
  }),
  usages: many(corporateDiscountUsages),
}))

export const userCorporateMembershipsRelations = relations(userCorporateMemberships, ({ one, many }) => ({
  user: one(users, {
    fields: [userCorporateMemberships.userId],
    references: [users.id],
  }),
  partner: one(corporatePartners, {
    fields: [userCorporateMemberships.partnerId],
    references: [corporatePartners.id],
  }),
  usages: many(corporateDiscountUsages),
}))

export const corporatePromoCodesRelations = relations(corporatePromoCodes, ({ one }) => ({
  partner: one(corporatePartners, {
    fields: [corporatePromoCodes.partnerId],
    references: [corporatePartners.id],
  }),
}))

export const corporateDiscountUsagesRelations = relations(corporateDiscountUsages, ({ one }) => ({
  discount: one(corporateDiscounts, {
    fields: [corporateDiscountUsages.discountId],
    references: [corporateDiscounts.id],
  }),
  user: one(users, {
    fields: [corporateDiscountUsages.userId],
    references: [users.id],
  }),
  order: one(orders, {
    fields: [corporateDiscountUsages.orderId],
    references: [orders.id],
  }),
  membership: one(userCorporateMemberships, {
    fields: [corporateDiscountUsages.membershipId],
    references: [userCorporateMemberships.id],
  }),
  restaurant: one(restaurants, {
    fields: [corporateDiscountUsages.restaurantId],
    references: [restaurants.id],
  }),
}))
```

### 2.4 索引設計

```typescript
// 建議在 migration 中新增的索引
// packages/database/migrations/XXXX_corporate_indexes.sql

CREATE INDEX idx_corporate_partners_status ON corporate_partners(status, is_active);
CREATE INDEX idx_corporate_partners_email_domains ON corporate_partners(allowed_email_domains);

CREATE INDEX idx_corporate_discounts_partner ON corporate_discounts(partner_id, is_active);
CREATE INDEX idx_corporate_discounts_restaurant ON corporate_discounts(restaurant_id, is_active);
CREATE INDEX idx_corporate_discounts_validity ON corporate_discounts(valid_from, valid_until);

CREATE INDEX idx_user_memberships_user ON user_corporate_memberships(user_id, status);
CREATE INDEX idx_user_memberships_partner ON user_corporate_memberships(partner_id, status);
CREATE INDEX idx_user_memberships_status ON user_corporate_memberships(status, expires_at);

CREATE INDEX idx_promo_codes_code ON corporate_promo_codes(code, is_active);
CREATE INDEX idx_promo_codes_partner ON corporate_promo_codes(partner_id, is_active);
CREATE INDEX idx_promo_codes_validity ON corporate_promo_codes(valid_from, valid_until);

CREATE INDEX idx_discount_usages_user ON corporate_discount_usages(user_id, used_at);
CREATE INDEX idx_discount_usages_discount ON corporate_discount_usages(discount_id, used_at);
CREATE INDEX idx_discount_usages_order ON corporate_discount_usages(order_id);
```

---

## 🔌 3. 後端 API 開發 (Backend API)

### 3.1 API 架構

```
apps/api/src/features/corporate/
├── routes/
│   ├── admin.ts           # 管理端 API
│   ├── customer.ts        # 顧客端 API
│   └── index.ts          # 路由聚合
├── services/
│   ├── CorporatePartnerService.ts
│   ├── CorporateDiscountService.ts
│   ├── MembershipService.ts
│   ├── PromoCodeService.ts
│   └── DiscountCalculatorService.ts
├── schemas/
│   └── validation.ts     # Zod 驗證 schemas
├── types/
│   └── index.ts         # TypeScript 類型
└── __tests__/
    ├── partner.test.ts
    ├── discount.test.ts
    └── membership.test.ts
```

### 3.2 管理端 API 端點

#### 🏢 特約商店管理

```typescript
// ============================================
// 特約商店 CRUD
// ============================================

POST   /api/v1/admin/corporate/partners
// 創建特約商店
Request:
{
  name: string
  displayName?: string
  description?: string
  contactEmail: string
  contactPhone?: string
  allowedEmailDomains?: string[]
  requireEmailVerification?: boolean
  contractStartDate?: string
  contractEndDate?: string
}
Response: { success: true, data: CorporatePartner }

GET    /api/v1/admin/corporate/partners
// 列出所有特約商店（支援分頁、篩選）
Query:
  - page?: number
  - limit?: number
  - status?: 'pending' | 'active' | 'suspended' | 'terminated'
  - search?: string
Response: {
  success: true,
  data: CorporatePartner[],
  pagination: { total, page, limit }
}

GET    /api/v1/admin/corporate/partners/:id
// 取得單一特約商店詳情
Response: { success: true, data: CorporatePartner }

PUT    /api/v1/admin/corporate/partners/:id
// 更新特約商店資訊
Request: Partial<CorporatePartner>
Response: { success: true, data: CorporatePartner }

DELETE /api/v1/admin/corporate/partners/:id
// 刪除特約商店（軟刪除）
Response: { success: true }

POST   /api/v1/admin/corporate/partners/:id/approve
// 審核通過特約商店
Response: { success: true, data: CorporatePartner }

POST   /api/v1/admin/corporate/partners/:id/suspend
// 暫停特約商店
Request: { reason: string }
Response: { success: true }

POST   /api/v1/admin/corporate/partners/:id/activate
// 重新啟用特約商店
Response: { success: true }
```

#### 💰 折扣規則管理

```typescript
// ============================================
// 折扣規則 CRUD
// ============================================

POST   /api/v1/admin/corporate/discounts
// 創建折扣規則
Request:
{
  partnerId: number
  restaurantId: number
  name: string
  description?: string
  discountType: 'percentage' | 'fixed_amount'
  discountValue: number
  minSpend?: number
  maxDiscount?: number
  validFrom?: string
  validUntil?: string
  totalUsageLimit?: number
  perUserLimit?: number
  canCombineWithCoupons?: boolean
}
Response: { success: true, data: CorporateDiscount }

GET    /api/v1/admin/corporate/discounts
// 列出折扣規則
Query:
  - partnerId?: number
  - restaurantId?: number
  - isActive?: boolean
  - page?: number
  - limit?: number
Response: { success: true, data: CorporateDiscount[], pagination }

GET    /api/v1/admin/corporate/discounts/:id
Response: { success: true, data: CorporateDiscount }

PUT    /api/v1/admin/corporate/discounts/:id
Request: Partial<CorporateDiscount>
Response: { success: true, data: CorporateDiscount }

DELETE /api/v1/admin/corporate/discounts/:id
Response: { success: true }

GET    /api/v1/admin/corporate/discounts/:id/usage-stats
// 取得折扣使用統計
Response: {
  success: true,
  data: {
    totalUsages: number
    totalDiscountAmount: number
    uniqueUsers: number
    usagesByDay: Array<{ date: string, count: number }>
  }
}
```

#### 🎟️ Promo Code 管理

```typescript
// ============================================
// Promo Code CRUD
// ============================================

POST   /api/v1/admin/corporate/promo-codes
// 創建 Promo Code
Request:
{
  partnerId: number
  code: string
  description?: string
  codeType: 'general' | 'single_use' | 'employee_specific'
  maxUses?: number
  perUserLimit?: number
  validFrom?: string
  validUntil?: string
  allowedUserEmails?: string[]
}
Response: { success: true, data: PromoCode }

POST   /api/v1/admin/corporate/promo-codes/batch
// 批次產生 Promo Codes
Request:
{
  partnerId: number
  quantity: number
  prefix?: string
  codeType: 'single_use'
  validFrom?: string
  validUntil?: string
}
Response: {
  success: true,
  data: {
    batchId: string,
    codes: PromoCode[]
  }
}

GET    /api/v1/admin/corporate/promo-codes
Query:
  - partnerId?: number
  - isActive?: boolean
  - codeType?: string
Response: { success: true, data: PromoCode[] }

GET    /api/v1/admin/corporate/promo-codes/:id
Response: { success: true, data: PromoCode }

PUT    /api/v1/admin/corporate/promo-codes/:id
Response: { success: true, data: PromoCode }

DELETE /api/v1/admin/corporate/promo-codes/:id
Response: { success: true }
```

#### 👥 會員管理

```typescript
// ============================================
// 會員管理
// ============================================

GET    /api/v1/admin/corporate/memberships
// 列出所有企業會員
Query:
  - partnerId?: number
  - userId?: number
  - status?: string
  - page?: number
  - limit?: number
Response: { success: true, data: Membership[], pagination }

GET    /api/v1/admin/corporate/memberships/:id
Response: { success: true, data: Membership }

POST   /api/v1/admin/corporate/memberships/:id/approve
// 審核通過會員申請
Response: { success: true, data: Membership }

POST   /api/v1/admin/corporate/memberships/:id/reject
// 拒絕會員申請
Request: { reason: string }
Response: { success: true }

POST   /api/v1/admin/corporate/memberships/:id/revoke
// 撤銷會員資格
Request: { reason: string }
Response: { success: true }

GET    /api/v1/admin/corporate/memberships/:id/usage-history
// 取得會員使用歷史
Response: {
  success: true,
  data: DiscountUsage[]
}
```

#### 📊 統計與報表

```typescript
// ============================================
// 統計報表
// ============================================

GET    /api/v1/admin/corporate/stats/overview
// 總覽統計
Response: {
  success: true,
  data: {
    totalPartners: number
    activePartners: number
    totalMemberships: number
    activeMemberships: number
    totalDiscounts: number
    totalDiscountAmount: number
    usageThisMonth: number
  }
}

GET    /api/v1/admin/corporate/stats/partners/:partnerId
// 特定特約商店統計
Response: {
  success: true,
  data: {
    memberCount: number
    discountCount: number
    totalUsages: number
    totalSavings: number
    usagesByMonth: Array<{ month: string, count: number, amount: number }>
  }
}

GET    /api/v1/admin/corporate/reports/usage
// 使用報表（可匯出）
Query:
  - partnerId?: number
  - restaurantId?: number
  - startDate?: string
  - endDate?: string
  - format?: 'json' | 'csv'
Response: DiscountUsage[] | CSV file
```

### 3.3 顧客端 API 端點

```typescript
// ============================================
// 顧客端 - 會員驗證
// ============================================

POST   /api/v1/corporate/verify-email
// Email Domain 驗證（步驟 1: 發送驗證碼）
Request:
{
  email: string
}
Response: {
  success: true,
  message: '驗證碼已發送到您的 Email'
}

POST   /api/v1/corporate/verify-email-token
// Email Domain 驗證（步驟 2: 驗證驗證碼）
Request:
{
  email: string
  token: string
}
Response: {
  success: true,
  data: {
    membership: Membership
    availableDiscounts: Discount[]
  }
}

POST   /api/v1/corporate/verify-promo-code
// Promo Code 驗證
Request:
{
  code: string
}
Response: {
  success: true,
  data: {
    membership: Membership
    availableDiscounts: Discount[]
  }
}

// ============================================
// 顧客端 - 會員資訊查詢
// ============================================

GET    /api/v1/corporate/my-memberships
// 取得我的企業會員資格
Response: {
  success: true,
  data: Membership[]
}

GET    /api/v1/corporate/available-discounts
// 取得可用的折扣
Query:
  - restaurantId: number
Response: {
  success: true,
  data: Discount[]
}

GET    /api/v1/corporate/my-savings
// 取得我的節省統計
Response: {
  success: true,
  data: {
    totalSavings: number
    usageCount: number
    savingsByMonth: Array<{ month: string, amount: number }>
  }
}

// ============================================
// 顧客端 - 訂單折扣計算
// ============================================

POST   /api/v1/orders/calculate-discount
// 計算訂單可用折扣（修改現有端點）
Request:
{
  restaurantId: number
  items: Array<{ menuItemId: number, quantity: number }>
  couponCode?: string
}
Response: {
  success: true,
  data: {
    subtotal: number
    corporateDiscount: number | null
    couponDiscount: number | null
    otherDiscounts: number
    finalTotal: number
    appliedDiscounts: Array<{
      type: 'corporate' | 'coupon' | 'other'
      name: string
      amount: number
    }>
  }
}
```

### 3.4 Service 層實作重點

#### 📄 `CorporateDiscountCalculatorService.ts`

```typescript
// 核心折扣計算邏輯

export class CorporateDiscountCalculatorService {
  /**
   * 計算訂單可用的企業折扣
   */
  async calculateDiscount(params: {
    userId: number
    restaurantId: number
    items: OrderItem[]
    subtotal: number
  }): Promise<DiscountResult> {
    // 1. 檢查用戶是否有有效的企業會員資格
    const membership = await this.getActiveMembership(
      params.userId,
      params.restaurantId
    )

    if (!membership) {
      return { applicable: false, amount: 0 }
    }

    // 2. 取得可用的折扣規則
    const discounts = await this.getApplicableDiscounts({
      partnerId: membership.partnerId,
      restaurantId: params.restaurantId,
      items: params.items,
      subtotal: params.subtotal,
    })

    // 3. 根據優先級排序
    const sortedDiscounts = discounts.sort((a, b) => b.priority - a.priority)

    // 4. 計算最佳折扣
    let bestDiscount = null
    let maxSaving = 0

    for (const discount of sortedDiscounts) {
      const saving = this.calculateDiscountAmount(discount, params.subtotal)
      if (saving > maxSaving) {
        maxSaving = saving
        bestDiscount = discount
      }
    }

    // 5. 檢查使用限制
    if (bestDiscount) {
      const canUse = await this.checkUsageLimit(
        bestDiscount.id,
        params.userId
      )

      if (!canUse) {
        return { applicable: false, amount: 0, reason: 'Usage limit exceeded' }
      }
    }

    return {
      applicable: !!bestDiscount,
      amount: maxSaving,
      discountId: bestDiscount?.id,
      discountName: bestDiscount?.name,
    }
  }

  /**
   * 檢查是否在有效時間內
   */
  private isTimeValid(discount: Discount): boolean {
    const now = new Date()

    // 檢查日期範圍
    if (discount.validFrom && now < discount.validFrom) return false
    if (discount.validUntil && now > discount.validUntil) return false

    // 檢查星期幾
    if (discount.applicableDays?.length) {
      const dayOfWeek = now.getDay()
      if (!discount.applicableDays.includes(dayOfWeek)) return false
    }

    // 檢查時間段
    if (discount.applicableTimeStart && discount.applicableTimeEnd) {
      const currentTime = now.toTimeString().slice(0, 5) // HH:mm
      if (currentTime < discount.applicableTimeStart ||
          currentTime > discount.applicableTimeEnd) {
        return false
      }
    }

    return true
  }

  /**
   * 計算折扣金額
   */
  private calculateDiscountAmount(
    discount: Discount,
    subtotal: number
  ): number {
    let amount = 0

    if (discount.discountType === 'percentage') {
      amount = subtotal * (discount.discountValue / 100)
    } else if (discount.discountType === 'fixed_amount') {
      amount = discount.discountValue
    }

    // 套用最大折扣限制
    if (discount.maxDiscount && amount > discount.maxDiscount) {
      amount = discount.maxDiscount
    }

    return Math.round(amount * 100) / 100 // 四捨五入到小數點後兩位
  }
}
```

### 3.5 安全性實作

```typescript
// ============================================
// Email 驗證流程
// ============================================

export class MembershipVerificationService {
  /**
   * 發送 Email 驗證碼
   */
  async sendEmailVerification(email: string): Promise<void> {
    // 1. 檢查 email domain 是否在允許列表中
    const domain = email.split('@')[1]
    const partner = await this.findPartnerByDomain(domain)

    if (!partner) {
      throw new Error('此 Email 不屬於任何特約商店')
    }

    if (!partner.requireEmailVerification) {
      // 如果不需要驗證，直接創建 membership
      return this.createMembershipDirectly(email, partner.id)
    }

    // 2. 產生 6 位數驗證碼
    const token = this.generateVerificationToken()
    const expiry = new Date(Date.now() + 15 * 60 * 1000) // 15分鐘有效

    // 3. 儲存驗證碼（或更新現有記錄）
    await this.saveVerificationToken({
      email,
      partnerId: partner.id,
      token,
      expiry,
    })

    // 4. 發送 Email
    await this.sendEmail({
      to: email,
      subject: `${partner.displayName || partner.name} - 企業會員驗證碼`,
      template: 'corporate-verification',
      data: {
        partnerName: partner.displayName || partner.name,
        token,
        expiryMinutes: 15,
      },
    })
  }

  /**
   * 驗證 Email 驗證碼
   */
  async verifyEmailToken(email: string, token: string): Promise<Membership> {
    // 1. 查找驗證記錄
    const record = await this.findVerificationRecord(email, token)

    if (!record) {
      throw new Error('驗證碼無效')
    }

    // 2. 檢查是否過期
    if (new Date() > record.expiry) {
      throw new Error('驗證碼已過期，請重新發送')
    }

    // 3. 創建或更新 membership
    const membership = await this.createOrUpdateMembership({
      email,
      partnerId: record.partnerId,
      verificationMethod: 'email_domain',
      status: 'active',
    })

    // 4. 清除驗證記錄
    await this.clearVerificationRecord(record.id)

    return membership
  }

  /**
   * 產生驗證碼
   */
  private generateVerificationToken(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  /**
   * 檢查 Promo Code 有效性
   */
  async verifyPromoCode(code: string, userId: number): Promise<Membership> {
    // 1. 查找 promo code
    const promoCode = await this.findPromoCode(code)

    if (!promoCode || !promoCode.isActive) {
      throw new Error('Promo Code 無效')
    }

    // 2. 檢查有效期
    const now = new Date()
    if (promoCode.validFrom && now < promoCode.validFrom) {
      throw new Error('Promo Code 尚未生效')
    }
    if (promoCode.validUntil && now > promoCode.validUntil) {
      throw new Error('Promo Code 已過期')
    }

    // 3. 檢查使用次數
    if (promoCode.maxUses && promoCode.usedCount >= promoCode.maxUses) {
      throw new Error('Promo Code 已達使用上限')
    }

    // 4. 檢查用戶限制
    if (promoCode.codeType === 'employee_specific') {
      const user = await this.getUser(userId)
      if (promoCode.allowedUserEmails?.length &&
          !promoCode.allowedUserEmails.includes(user.email)) {
        throw new Error('此 Promo Code 不適用於您的帳號')
      }
    }

    // 5. 檢查用戶使用次數
    const userUsageCount = await this.getUserPromoCodeUsageCount(userId, promoCode.id)
    if (userUsageCount >= promoCode.perUserLimit) {
      throw new Error('您已達此 Promo Code 的使用上限')
    }

    // 6. 創建 membership
    const membership = await this.createMembership({
      userId,
      partnerId: promoCode.partnerId,
      verificationMethod: 'promo_code',
      verificationValue: code,
      status: 'active',
    })

    // 7. 更新 promo code 使用次數
    await this.incrementPromoCodeUsage(promoCode.id)

    return membership
  }
}
```

---

## 🖥️ 4. 前端開發 (Frontend Development)

### 4.1 Admin Dashboard (`apps/admin-dashboard`)

#### 目錄結構

```
apps/admin-dashboard/src/
├── views/corporate/
│   ├── CorporatePartnersView.vue         # 特約商店列表
│   ├── CorporatePartnerDetailView.vue    # 特約商店詳情
│   ├── CorporateDiscountsView.vue        # 折扣規則管理
│   ├── CorporatePromoCodesView.vue       # Promo Code 管理
│   ├── CorporateMembershipsView.vue      # 會員管理
│   └── CorporateStatsView.vue            # 統計報表
├── components/corporate/
│   ├── PartnerForm.vue                   # 特約商店表單
│   ├── PartnerList.vue                   # 特約商店列表
│   ├── DiscountForm.vue                  # 折扣規則表單
│   ├── DiscountCard.vue                  # 折扣卡片
│   ├── PromoCodeGenerator.vue            # Promo Code 產生器
│   ├── MembershipTable.vue               # 會員表格
│   └── StatsCards.vue                    # 統計卡片
└── services/
    └── corporateApi.ts                   # API 服務
```

#### 路由配置

```typescript
// router/index.ts

{
  path: '/corporate',
  component: LayoutDefault,
  meta: { requiresAuth: true, role: [USER_ROLES.ADMIN, USER_ROLES.OWNER] },
  children: [
    {
      path: 'partners',
      name: 'CorporatePartners',
      component: () => import('@/views/corporate/CorporatePartnersView.vue'),
      meta: { title: '特約商店管理' },
    },
    {
      path: 'partners/:id',
      name: 'CorporatePartnerDetail',
      component: () => import('@/views/corporate/CorporatePartnerDetailView.vue'),
    },
    {
      path: 'discounts',
      name: 'CorporateDiscounts',
      component: () => import('@/views/corporate/CorporateDiscountsView.vue'),
      meta: { title: '折扣規則管理' },
    },
    {
      path: 'promo-codes',
      name: 'CorporatePromoCodes',
      component: () => import('@/views/corporate/CorporatePromoCodesView.vue'),
      meta: { title: 'Promo Code 管理' },
    },
    {
      path: 'memberships',
      name: 'CorporateMemberships',
      component: () => import('@/views/corporate/CorporateMembershipsView.vue'),
      meta: { title: '會員管理' },
    },
    {
      path: 'stats',
      name: 'CorporateStats',
      component: () => import('@/views/corporate/CorporateStatsView.vue'),
      meta: { title: '統計報表' },
    },
  ],
}
```

#### 側邊欄選單

```typescript
// components/layout/Sidebar.vue

const menuItems = [
  // ... 現有選單項目
  {
    id: 'corporate',
    label: 'i18n.sidebar.corporate',
    icon: 'mdi-office-building',
    role: [USER_ROLES.ADMIN, USER_ROLES.OWNER],
    children: [
      {
        id: 'corporate-partners',
        label: 'i18n.sidebar.corporate.partners',
        to: '/corporate/partners',
      },
      {
        id: 'corporate-discounts',
        label: 'i18n.sidebar.corporate.discounts',
        to: '/corporate/discounts',
      },
      {
        id: 'corporate-promo-codes',
        label: 'i18n.sidebar.corporate.promoCodes',
        to: '/corporate/promo-codes',
      },
      {
        id: 'corporate-memberships',
        label: 'i18n.sidebar.corporate.memberships',
        to: '/corporate/memberships',
      },
      {
        id: 'corporate-stats',
        label: 'i18n.sidebar.corporate.stats',
        to: '/corporate/stats',
      },
    ],
  },
]
```

### 4.2 Customer App (`apps/customer-app`)

#### 目錄結構

```
apps/customer-app/src/
├── views/
│   └── CorporateVerificationView.vue     # 企業驗證頁面
├── components/corporate/
│   ├── EmailVerificationForm.vue         # Email 驗證表單
│   ├── PromoCodeForm.vue                 # Promo Code 表單
│   ├── MembershipCard.vue                # 會員卡片
│   └── SavingsDisplay.vue                # 節省金額顯示
└── composables/
    └── useCorporateDiscount.ts           # 折扣邏輯 composable
```

#### 整合結帳流程

```vue
<!-- views/CartView.vue -->
<template>
  <div class="cart-view">
    <!-- 購物車項目 -->
    <div class="cart-items">
      <CartItem
        v-for="item in cartItems"
        :key="item.id"
        :item="item"
      />
    </div>

    <!-- 價格明細 -->
    <div class="price-breakdown">
      <div class="subtotal">
        <span>小計</span>
        <span>${{ subtotal }}</span>
      </div>

      <!-- 企業折扣 -->
      <div v-if="corporateDiscount" class="discount corporate-discount">
        <span>
          <Icon name="mdi-office-building" />
          {{ corporateDiscount.name }}
        </span>
        <span class="discount-amount">-${{ corporateDiscount.amount }}</span>
      </div>

      <!-- 優惠券折扣 -->
      <div v-if="couponDiscount" class="discount coupon-discount">
        <span>
          <Icon name="mdi-ticket" />
          優惠券折扣
        </span>
        <span class="discount-amount">-${{ couponDiscount }}</span>
      </div>

      <div class="total">
        <span>總計</span>
        <span class="total-amount">${{ finalTotal }}</span>
      </div>

      <!-- 節省金額提示 -->
      <div v-if="totalSavings > 0" class="savings-badge">
        <Icon name="mdi-check-circle" />
        您已節省 ${{ totalSavings }}
      </div>
    </div>

    <!-- 企業會員資訊 -->
    <div v-if="activeMembership" class="membership-info">
      <MembershipCard :membership="activeMembership" />
    </div>

    <!-- 沒有企業會員時顯示驗證提示 -->
    <div v-else class="verification-prompt">
      <p>您是企業員工嗎？驗證後可享專屬優惠！</p>
      <button @click="goToVerification">立即驗證</button>
    </div>

    <button class="checkout-btn" @click="checkout">
      結帳
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCorporateDiscount } from '@/composables/useCorporateDiscount'
import { useCart } from '@/stores/cart'

const cart = useCart()
const {
  activeMembership,
  corporateDiscount,
  calculateDiscount
} = useCorporateDiscount()

const subtotal = computed(() => cart.subtotal)
const couponDiscount = computed(() => cart.couponDiscount)
const totalSavings = computed(() => {
  let savings = 0
  if (corporateDiscount.value) savings += corporateDiscount.value.amount
  if (couponDiscount.value) savings += couponDiscount.value
  return savings
})
const finalTotal = computed(() => subtotal.value - totalSavings.value)

// 當購物車變化時重新計算折扣
watch(() => cart.items, async () => {
  await calculateDiscount(cart.items)
}, { deep: true })

const goToVerification = () => {
  router.push('/corporate/verify')
}

const checkout = async () => {
  // 結帳邏輯（會自動包含企業折扣）
}
</script>
```

#### Composable 實作

```typescript
// composables/useCorporateDiscount.ts

export function useCorporateDiscount() {
  const memberships = ref<Membership[]>([])
  const corporateDiscount = ref<{
    discountId: number
    name: string
    amount: number
  } | null>(null)

  // 取得有效的會員資格
  const activeMembership = computed(() => {
    return memberships.value.find(m => m.status === 'active')
  })

  // 載入會員資格
  const loadMemberships = async () => {
    try {
      const response = await api.get('/api/v1/corporate/my-memberships')
      memberships.value = response.data.data
    } catch (error) {
      console.error('Failed to load memberships:', error)
    }
  }

  // 計算可用折扣
  const calculateDiscount = async (items: CartItem[]) => {
    if (!activeMembership.value) {
      corporateDiscount.value = null
      return
    }

    try {
      const response = await api.post('/api/v1/orders/calculate-discount', {
        restaurantId: items[0]?.restaurantId,
        items: items.map(i => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
        })),
      })

      const appliedDiscount = response.data.data.appliedDiscounts
        .find(d => d.type === 'corporate')

      if (appliedDiscount) {
        corporateDiscount.value = {
          discountId: appliedDiscount.id,
          name: appliedDiscount.name,
          amount: appliedDiscount.amount,
        }
      } else {
        corporateDiscount.value = null
      }
    } catch (error) {
      console.error('Failed to calculate discount:', error)
      corporateDiscount.value = null
    }
  }

  // Email 驗證
  const sendEmailVerification = async (email: string) => {
    await api.post('/api/v1/corporate/verify-email', { email })
  }

  const verifyEmailToken = async (email: string, token: string) => {
    const response = await api.post('/api/v1/corporate/verify-email-token', {
      email,
      token,
    })
    await loadMemberships()
    return response.data.data
  }

  // Promo Code 驗證
  const verifyPromoCode = async (code: string) => {
    const response = await api.post('/api/v1/corporate/verify-promo-code', {
      code,
    })
    await loadMemberships()
    return response.data.data
  }

  // 初始化時載入
  onMounted(() => {
    loadMemberships()
  })

  return {
    memberships,
    activeMembership,
    corporateDiscount,
    loadMemberships,
    calculateDiscount,
    sendEmailVerification,
    verifyEmailToken,
    verifyPromoCode,
  }
}
```

---

## 🧪 5. 測試策略 (Testing Strategy)

### 5.1 單元測試 (Unit Tests)

```typescript
// apps/api/src/features/corporate/__tests__/discount-calculator.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import { CorporateDiscountCalculatorService } from '../services/DiscountCalculatorService'
import { createTestContext } from '@/tests/helpers/test-context'

describe('CorporateDiscountCalculatorService', () => {
  let service: CorporateDiscountCalculatorService
  let ctx: TestContext

  beforeEach(async () => {
    ctx = await createTestContext()
    service = new CorporateDiscountCalculatorService(ctx.db)
  })

  describe('calculateDiscount', () => {
    it('應該正確計算百分比折扣', async () => {
      // Arrange
      const { user, membership, discount } = await ctx.factory.createCorporateSetup({
        discountType: 'percentage',
        discountValue: 10, // 10%
      })

      // Act
      const result = await service.calculateDiscount({
        userId: user.id,
        restaurantId: 1,
        items: [],
        subtotal: 1000,
      })

      // Assert
      expect(result.applicable).toBe(true)
      expect(result.amount).toBe(100) // 10% of 1000
    })

    it('應該正確計算固定金額折扣', async () => {
      const { user } = await ctx.factory.createCorporateSetup({
        discountType: 'fixed_amount',
        discountValue: 50,
      })

      const result = await service.calculateDiscount({
        userId: user.id,
        restaurantId: 1,
        items: [],
        subtotal: 1000,
      })

      expect(result.applicable).toBe(true)
      expect(result.amount).toBe(50)
    })

    it('應該套用最大折扣限制', async () => {
      const { user } = await ctx.factory.createCorporateSetup({
        discountType: 'percentage',
        discountValue: 20, // 20%
        maxDiscount: 100,
      })

      const result = await service.calculateDiscount({
        userId: user.id,
        restaurantId: 1,
        items: [],
        subtotal: 1000, // 20% = 200, 但上限是 100
      })

      expect(result.amount).toBe(100)
    })

    it('應該檢查最低消費限制', async () => {
      const { user } = await ctx.factory.createCorporateSetup({
        discountType: 'percentage',
        discountValue: 10,
        minSpend: 500,
      })

      const result = await service.calculateDiscount({
        userId: user.id,
        restaurantId: 1,
        items: [],
        subtotal: 300, // 低於最低消費
      })

      expect(result.applicable).toBe(false)
    })

    it('應該檢查使用次數限制', async () => {
      const { user, discount } = await ctx.factory.createCorporateSetup({
        perUserLimit: 1,
      })

      // 先使用一次
      await ctx.factory.createDiscountUsage({
        userId: user.id,
        discountId: discount.id,
      })

      const result = await service.calculateDiscount({
        userId: user.id,
        restaurantId: 1,
        items: [],
        subtotal: 1000,
      })

      expect(result.applicable).toBe(false)
      expect(result.reason).toBe('Usage limit exceeded')
    })

    it('應該檢查有效時間範圍', async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const { user } = await ctx.factory.createCorporateSetup({
        validFrom: tomorrow,
      })

      const result = await service.calculateDiscount({
        userId: user.id,
        restaurantId: 1,
        items: [],
        subtotal: 1000,
      })

      expect(result.applicable).toBe(false)
    })

    it('應該檢查適用星期幾', async () => {
      const { user } = await ctx.factory.createCorporateSetup({
        applicableDays: [1, 2, 3, 4, 5], // 週一到週五
      })

      // Mock current day to Sunday (0)
      vi.setSystemTime(new Date('2025-01-19')) // Sunday

      const result = await service.calculateDiscount({
        userId: user.id,
        restaurantId: 1,
        items: [],
        subtotal: 1000,
      })

      expect(result.applicable).toBe(false)
    })
  })
})
```

### 5.2 整合測試 (Integration Tests)

```typescript
// apps/api/src/features/corporate/__tests__/api.integration.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import { createTestApp } from '@/tests/helpers/test-app'

describe('Corporate API Integration', () => {
  let app: TestApp

  beforeEach(async () => {
    app = await createTestApp()
  })

  describe('POST /api/v1/corporate/verify-email', () => {
    it('應該發送驗證碼到有效的企業 Email', async () => {
      // 創建特約商店
      await app.factory.createCorporatePartner({
        allowedEmailDomains: ['company.com'],
      })

      const response = await app.request
        .post('/api/v1/corporate/verify-email')
        .send({ email: 'employee@company.com' })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)

      // 驗證 Email 已發送
      expect(app.emailService.sentEmails).toHaveLength(1)
      expect(app.emailService.sentEmails[0].to).toBe('employee@company.com')
    })

    it('應該拒絕非企業 Email', async () => {
      const response = await app.request
        .post('/api/v1/corporate/verify-email')
        .send({ email: 'random@gmail.com' })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('不屬於任何特約商店')
    })
  })

  describe('POST /api/v1/corporate/verify-promo-code', () => {
    it('應該驗證有效的 Promo Code', async () => {
      const { partner } = await app.factory.createCorporatePartner()
      const { promoCode } = await app.factory.createPromoCode({
        partnerId: partner.id,
        code: 'TEST123',
      })

      const user = await app.factory.createUser()

      const response = await app.request
        .post('/api/v1/corporate/verify-promo-code')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ code: 'TEST123' })

      expect(response.status).toBe(200)
      expect(response.body.data.membership.partnerId).toBe(partner.id)
    })

    it('應該檢查 Promo Code 使用次數限制', async () => {
      const { promoCode } = await app.factory.createPromoCode({
        maxUses: 1,
      })

      const user1 = await app.factory.createUser()

      // 第一次使用成功
      await app.request
        .post('/api/v1/corporate/verify-promo-code')
        .set('Authorization', `Bearer ${user1.token}`)
        .send({ code: promoCode.code })

      const user2 = await app.factory.createUser()

      // 第二次使用失敗
      const response = await app.request
        .post('/api/v1/corporate/verify-promo-code')
        .set('Authorization', `Bearer ${user2.token}`)
        .send({ code: promoCode.code })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('使用上限')
    })
  })

  describe('POST /api/v1/orders/calculate-discount', () => {
    it('應該正確計算訂單折扣', async () => {
      // 創建完整的測試環境
      const { user, membership, discount, restaurant } =
        await app.factory.createCorporateSetup({
          discountType: 'percentage',
          discountValue: 10,
        })

      const menuItem = await app.factory.createMenuItem({
        restaurantId: restaurant.id,
        price: 100,
      })

      const response = await app.request
        .post('/api/v1/orders/calculate-discount')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          restaurantId: restaurant.id,
          items: [{ menuItemId: menuItem.id, quantity: 10 }],
        })

      expect(response.status).toBe(200)
      expect(response.body.data.subtotal).toBe(1000)
      expect(response.body.data.corporateDiscount).toBe(100)
      expect(response.body.data.finalTotal).toBe(900)
    })
  })
})
```

### 5.3 E2E 測試 (End-to-End Tests)

```typescript
// apps/customer-app/e2e/corporate.spec.ts

import { test, expect } from '@playwright/test'

test.describe('Corporate Partnership - Customer Flow', () => {
  test('完整的 Email 驗證流程', async ({ page }) => {
    // 1. 註冊新用戶
    await page.goto('/register')
    await page.fill('[name="email"]', 'test@company.com')
    await page.fill('[name="password"]', 'password123')
    await page.click('button[type="submit"]')

    // 2. 前往企業驗證頁面
    await page.goto('/corporate/verify')

    // 3. 輸入企業 Email
    await page.fill('[name="email"]', 'employee@company.com')
    await page.click('button:has-text("發送驗證碼")')

    // 4. 等待驗證碼輸入框出現
    await expect(page.locator('[name="token"]')).toBeVisible()

    // 5. 輸入驗證碼（在測試環境中可以從資料庫獲取）
    const token = await page.evaluate(() => {
      return window.testHelpers.getLatestVerificationToken()
    })
    await page.fill('[name="token"]', token)
    await page.click('button:has-text("驗證")')

    // 6. 驗證成功，應該看到會員卡片
    await expect(page.locator('.membership-card')).toBeVisible()
    await expect(page.locator('.membership-card')).toContainText('Company Inc')
  })

  test('完整的購物流程含企業折扣', async ({ page, context }) => {
    // 使用已驗證的企業會員登入
    const user = await context.createAuthenticatedUser({
      hasCorporateMembership: true,
    })

    // 1. 瀏覽餐廳
    await page.goto('/restaurants/1')

    // 2. 加入購物車
    await page.click('.menu-item:first-child .add-to-cart')
    await page.click('.menu-item:nth-child(2) .add-to-cart')

    // 3. 前往購物車
    await page.click('[data-testid="cart-button"]')

    // 4. 應該看到企業折扣
    await expect(page.locator('.corporate-discount')).toBeVisible()
    await expect(page.locator('.corporate-discount .discount-amount'))
      .toContainText('-$')

    // 5. 應該看到節省金額提示
    await expect(page.locator('.savings-badge')).toBeVisible()

    // 6. 結帳
    await page.click('button:has-text("結帳")')

    // 7. 確認訂單摘要包含企業折扣
    await expect(page.locator('.order-summary .corporate-discount')).toBeVisible()

    // 8. 完成訂單
    await page.click('button:has-text("確認訂單")')

    // 9. 驗證訂單成功
    await expect(page.locator('.order-success')).toBeVisible()
  })
})

test.describe('Corporate Partnership - Admin Flow', () => {
  test('管理員創建特約商店和折扣規則', async ({ page }) => {
    // 以管理員身份登入
    await page.goto('/login')
    await page.fill('[name="username"]', 'admin')
    await page.fill('[name="password"]', 'admin123')
    await page.click('button[type="submit"]')

    // 1. 前往特約商店管理
    await page.goto('/corporate/partners')

    // 2. 點擊新增按鈕
    await page.click('button:has-text("新增特約商店")')

    // 3. 填寫表單
    await page.fill('[name="name"]', 'Test Company')
    await page.fill('[name="contactEmail"]', 'contact@testcompany.com')
    await page.fill('[name="allowedEmailDomains"]', 'testcompany.com')
    await page.click('button[type="submit"]')

    // 4. 應該看到成功訊息
    await expect(page.locator('.success-message')).toBeVisible()

    // 5. 前往折扣規則管理
    await page.goto('/corporate/discounts')

    // 6. 新增折扣規則
    await page.click('button:has-text("新增折扣規則")')
    await page.selectOption('[name="partnerId"]', { label: 'Test Company' })
    await page.selectOption('[name="restaurantId"]', { label: '餐廳 A' })
    await page.fill('[name="name"]', '員工專屬 9折優惠')
    await page.selectOption('[name="discountType"]', 'percentage')
    await page.fill('[name="discountValue"]', '10')
    await page.click('button[type="submit"]')

    // 7. 驗證折扣已創建
    await expect(page.locator('.discount-card')).toContainText('員工專屬 9折優惠')
  })
})
```

---

## 📦 6. 實施階段規劃 (Implementation Phases)

### 階段 1: 資料庫與後端核心（5-7 天）

```
┌─────────────────────────────────────────────────────────────┐
│ 階段 1: 資料庫與後端核心                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Day 1-2: 資料庫 Schema                                       │
│ ├─ 建立 corporate.ts schema 文件                            │
│ ├─ 撰寫 migration 腳本                                      │
│ ├─ 本地測試 migration                                       │
│ └─ 建立索引                                                 │
│                                                             │
│ Day 3-4: Service 層                                         │
│ ├─ CorporatePartnerService                                 │
│ ├─ CorporateDiscountService                                │
│ ├─ MembershipService                                       │
│ ├─ PromoCodeService                                        │
│ └─ DiscountCalculatorService                               │
│                                                             │
│ Day 5-6: 單元測試                                           │
│ ├─ Service 層測試（70%+ 覆蓋率）                            │
│ ├─ Discount Calculator 測試                                │
│ └─ 驗證邏輯測試                                             │
│                                                             │
│ Day 7: Code Review & 調整                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 階段 2: API 端點開發（4-5 天）

```
┌─────────────────────────────────────────────────────────────┐
│ 階段 2: API 端點開發                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Day 1-2: 管理端 API                                         │
│ ├─ 特約商店 CRUD API                                        │
│ ├─ 折扣規則 CRUD API                                        │
│ ├─ Promo Code CRUD API                                     │
│ ├─ 會員管理 API                                             │
│ └─ 統計報表 API                                             │
│                                                             │
│ Day 3: 顧客端 API                                           │
│ ├─ Email 驗證 API                                           │
│ ├─ Promo Code 驗證 API                                     │
│ └─ 會員資訊查詢 API                                         │
│                                                             │
│ Day 4: 訂單折扣計算整合                                      │
│ ├─ 修改訂單計算邏輯                                          │
│ ├─ 整合 DiscountCalculatorService                          │
│ └─ 折扣優先級處理                                           │
│                                                             │
│ Day 5: 整合測試                                             │
│ └─ API 整合測試                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 階段 3: 管理後台開發（5-6 天）

```
┌─────────────────────────────────────────────────────────────┐
│ 階段 3: 管理後台開發                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Day 1: 路由與導航                                           │
│ ├─ 建立路由配置                                             │
│ ├─ 更新側邊欄選單                                           │
│ └─ 權限控制                                                 │
│                                                             │
│ Day 2-3: 特約商店管理頁面                                    │
│ ├─ 列表頁面                                                 │
│ ├─ 表單頁面（新增/編輯）                                     │
│ ├─ 詳情頁面                                                 │
│ └─ 審核功能                                                 │
│                                                             │
│ Day 4: 折扣規則管理頁面                                      │
│ ├─ 列表與篩選                                               │
│ ├─ 折扣規則表單                                             │
│ └─ 使用統計查詢                                             │
│                                                             │
│ Day 5: Promo Code 與會員管理                                │
│ ├─ Promo Code 管理頁面                                      │
│ ├─ 批次產生功能                                             │
│ └─ 會員審核頁面                                             │
│                                                             │
│ Day 6: 統計報表                                             │
│ ├─ 總覽統計卡片                                             │
│ ├─ 圖表展示                                                 │
│ └─ 報表匯出功能                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 階段 4: 顧客應用開發（3-4 天）

```
┌─────────────────────────────────────────────────────────────┐
│ 階段 4: 顧客應用開發                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Day 1: 驗證介面                                             │
│ ├─ Email 驗證表單                                           │
│ ├─ Promo Code 驗證表單                                     │
│ └─ 會員卡片顯示                                             │
│                                                             │
│ Day 2: Composable 開發                                      │
│ ├─ useCorporateDiscount composable                         │
│ └─ 狀態管理                                                 │
│                                                             │
│ Day 3: 購物車整合                                           │
│ ├─ 修改購物車顯示                                           │
│ ├─ 折扣計算邏輯                                             │
│ └─ 價格明細展示                                             │
│                                                             │
│ Day 4: 結帳流程整合                                         │
│ ├─ 訂單摘要頁面                                             │
│ └─ 訂單創建邏輯                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 階段 5: 測試與部署（3-4 天）

```
┌─────────────────────────────────────────────────────────────┐
│ 階段 5: 測試與部署                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Day 1: E2E 測試                                             │
│ ├─ 管理員流程測試                                           │
│ └─ 顧客流程測試                                             │
│                                                             │
│ Day 2: Staging 部署與測試                                   │
│ ├─ 部署到 Staging 環境                                      │
│ ├─ Migration 執行                                          │
│ ├─ 功能驗證                                                 │
│ └─ 效能測試                                                 │
│                                                             │
│ Day 3: Bug 修復與優化                                       │
│                                                             │
│ Day 4: Production 部署                                      │
│ ├─ 最終檢查                                                 │
│ ├─ 部署到 Production                                        │
│ ├─ Migration 執行                                          │
│ └─ 監控與驗證                                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 總時程表

```
總計: 20-26 天 (4-5 週)

┌────────┬────────┬────────┬────────┬────────┐
│ Week 1 │ Week 2 │ Week 3 │ Week 4 │ Week 5 │
├────────┼────────┼────────┼────────┼────────┤
│ 階段 1 │階段 1→2│ 階段 3 │階段 3→4│ 階段 5 │
│ 資料庫 │  API   │ Admin  │Customer│ 測試   │
│ 後端   │  開發  │  UI    │  App   │ 部署   │
└────────┴────────┴────────┴────────┴────────┘

里程碑:
✓ Week 1 結束: 後端核心完成
✓ Week 2 結束: API 完成
✓ Week 3 結束: Admin UI 完成
✓ Week 4 結束: Customer App 完成
✓ Week 5 結束: 上線
```

---

## 🚀 7. 部署指南 (Deployment Guide)

### 7.1 Migration 執行順序

```bash
# 1. Staging 環境測試
cd packages/database

# 產生 migration
pnpm db:generate

# 本地測試
pnpm db:migrate:local

# 部署到 Staging
pnpm db:migrate:staging

# 2. Production 部署（確認 Staging 無誤後）
pnpm db:migrate:prod
```

### 7.2 環境變數配置

```bash
# apps/api/.dev.vars (本地開發)
CORPORATE_EMAIL_VERIFICATION_ENABLED=true
CORPORATE_EMAIL_TOKEN_EXPIRY_MINUTES=15
CORPORATE_PROMO_CODE_PREFIX=CORP

# Production 環境（Cloudflare Dashboard → Workers → Settings → Variables）
CORPORATE_EMAIL_VERIFICATION_ENABLED=true
CORPORATE_EMAIL_TOKEN_EXPIRY_MINUTES=15
```

### 7.3 部署檢查清單

```
部署前檢查
═══════════════════════════════════════════════════

□ 所有測試通過（Unit + Integration + E2E）
□ TypeScript 無錯誤
□ ESLint 無錯誤
□ Migration 腳本已測試
□ 環境變數已設定
□ API 文檔已更新
□ i18n 翻譯已完成
□ Code Review 通過
□ 效能測試通過

部署後驗證
═══════════════════════════════════════════════════

□ Migration 成功執行
□ Health Check 通過
□ Admin 介面正常運作
□ Customer App 正常運作
□ Email 發送功能正常
□ 折扣計算正確
□ 統計數據顯示正常
□ 無錯誤日誌
□ 效能指標正常
□ 監控告警設定完成
```

### 7.4 Rollback 計畫

```sql
-- 如果需要 Rollback，執行以下 SQL

-- 1. 刪除資料表（按相反順序）
DROP TABLE IF EXISTS corporate_discount_usages;
DROP TABLE IF EXISTS corporate_promo_codes;
DROP TABLE IF EXISTS user_corporate_memberships;
DROP TABLE IF EXISTS corporate_discounts;
DROP TABLE IF EXISTS corporate_partners;

-- 2. 刪除索引
DROP INDEX IF EXISTS idx_corporate_partners_status;
DROP INDEX IF EXISTS idx_corporate_partners_email_domains;
DROP INDEX IF EXISTS idx_corporate_discounts_partner;
-- ... (其他索引)
```

---

## 📊 8. 監控與維運 (Monitoring & Operations)

### 8.1 關鍵指標 (KPIs)

```
業務指標
═══════════════════════════════════════════════════

• 特約商店數量
• 活躍會員數
• 折扣使用率
• 總節省金額
• 平均折扣金額
• 會員轉換率（驗證 → 實際消費）

技術指標
═══════════════════════════════════════════════════

• API 回應時間（P95 < 200ms）
• 折扣計算時間（P99 < 100ms）
• Email 發送成功率（> 99%）
• 驗證成功率
• 錯誤率（< 0.1%）
```

### 8.2 告警設定

```typescript
// 建議的告警規則

1. 驗證失敗率 > 5%（15分鐘內）
   → 可能的 Email 發送問題或驗證邏輯錯誤

2. 折扣計算錯誤率 > 1%
   → 折扣規則配置錯誤或程式碼 bug

3. API 回應時間 P95 > 500ms
   → 資料庫查詢效能問題

4. Promo Code 濫用檢測
   → 單一 IP 在短時間內嘗試多個 code

5. 異常大額折扣
   → 單筆訂單折扣 > $1000（可能是配置錯誤）
```

### 8.3 定期維護任務

```
每日
═══════════════════════════════════════════════════

• 檢查錯誤日誌
• 檢查異常折扣使用
• 監控 API 效能

每週
═══════════════════════════════════════════════════

• 檢查過期的會員資格
• 清理過期的驗證 token
• 檢查未使用的 Promo Code
• 統計報表審查

每月
═══════════════════════════════════════════════════

• 會員資格續約檢查
• 合約到期提醒
• 效能報表分析
• 成本分析
```

---

## 🔐 9. 安全性考量 (Security Considerations)

### 9.1 防護措施

```
1. Email 驗證安全性
═══════════════════════════════════════════════════

✓ 驗證碼 15 分鐘過期
✓ 單一 Email 24小時內最多發送 5 次驗證碼
✓ 驗證碼使用後立即失效
✓ 使用 HTTPS 傳輸
✓ 驗證碼不記錄在日誌中

2. Promo Code 安全性
═══════════════════════════════════════════════════

✓ Code 使用 CSPRNG 產生
✓ 使用次數限制
✓ IP 頻率限制（防暴力破解）
✓ 單一用戶使用次數限制
✓ 可設定 Email 白名單

3. 折扣計算安全性
═══════════════════════════════════════════════════

✓ 伺服器端驗證所有計算
✓ 防止負價格
✓ 最大折扣上限
✓ 訂單金額驗證
✓ 防止 Race Condition（使用資料庫 transaction）

4. API 安全性
═══════════════════════════════════════════════════

✓ JWT Token 驗證
✓ 角色權限檢查
✓ Rate Limiting
✓ Input Validation（Zod）
✓ SQL Injection 防護（Drizzle ORM）
✓ CORS 設定
```

### 9.2 資料隱私

```
GDPR 合規
═══════════════════════════════════════════════════

• 會員資格資料保留期限: 合約結束後 1 年
• 使用記錄保留期限: 3 年（會計需求）
• 用戶有權要求刪除個人資料
• 審計日誌記錄所有關鍵操作
• 個資加密儲存
```

---

## 📝 10. 後續優化建議 (Future Enhancements)

### Phase 2 功能 (上線後 3-6 個月)

```
1. 進階分析與報表
═══════════════════════════════════════════════════

□ 企業員工消費習慣分析
□ 折扣 ROI 分析
□ A/B Testing 不同折扣策略
□ 預測模型（會員流失預測）

2. 自動化功能
═══════════════════════════════════════════════════

□ 自動續約提醒
□ 自動過期處理
□ 批次會員審核
□ 智能折扣推薦

3. 整合功能
═══════════════════════════════════════════════════

□ 與 HR 系統整合（SSO）
□ 與發票系統整合
□ 與 CRM 系統整合
□ Excel 批次匯入會員

4. 用戶體驗優化
═══════════════════════════════════════════════════

□ PWA Push Notification（折扣提醒）
□ 會員專屬頁面（Dashboard）
□ 折扣推薦引擎
□ Gamification（集點系統）
```

---

## 📚 11. 相關文件 (Related Documentation)

```
技術文件
═══════════════════════════════════════════════════

□ API 文檔: docs/api/corporate-partnership.md
□ 資料庫 Schema: packages/database/src/schema/corporate.ts
□ 測試指南: docs/testing/corporate-tests.md
□ 部署指南: docs/deployment/corporate-deployment.md

用戶文件
═══════════════════════════════════════════════════

□ 管理員手冊: docs/user-guides/corporate-admin.md
□ 企業合作夥伴指南: docs/user-guides/corporate-partner.md
□ 員工使用指南: docs/user-guides/corporate-employee.md
□ FAQ: docs/faq/corporate-faq.md
```

---

## ✅ 12. 總結 (Summary)

本實作規劃提供了一個**完整、穩健且可擴展的企業合作夥伴系統**，主要特點：

### ✨ 核心優勢

1. **正確的技術棧**: 使用 Drizzle ORM + Cloudflare D1 (SQLite)
2. **完整的資料模型**: 5 個精心設計的資料表，涵蓋所有業務場景
3. **嚴謹的安全性**: Email 驗證、使用限制、防濫用機制
4. **多租戶支援**: 完整的 `restaurantId` 隔離
5. **彈性的折扣規則**: 支援多種折扣類型、時間限制、組合規則
6. **完整的審計追蹤**: createdAt, updatedAt, deletedAt, 操作者記錄
7. **高測試覆蓋率**: 單元測試、整合測試、E2E 測試
8. **清晰的實施路徑**: 5 個階段，20-26 天完成

### 🎯 預期成果

- **商業價值**: 增加 B2B 收入來源，提升平台競爭力
- **用戶體驗**: 無感折扣套用，清楚的價格明細
- **管理效率**: 完整的後台管理介面，自動化驗證流程
- **可擴展性**: 易於新增折扣類型、驗證方式、統計報表

### 🚀 下一步

1. **審核本文件**: 團隊評審並確認需求
2. **技術評估**: 確認技術可行性與資源需求
3. **時程規劃**: 根據團隊人力安排實施時程
4. **開始實施**: 按照階段 1 開始執行

---

**文件版本**: v2.0
**最後更新**: 2025-11-16
**維護者**: Development Team
**狀態**: ✅ Ready for Review

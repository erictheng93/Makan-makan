import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { restaurants } from './restaurants'
import { users } from './users'
import { orders } from './orders'

// 優惠券折扣類型定義
export const DISCOUNT_TYPE = {
  PERCENTAGE: 'percentage',  // 百分比折扣
  FIXED: 'fixed'             // 固定金額折扣
} as const

export type DiscountType = typeof DISCOUNT_TYPE[keyof typeof DISCOUNT_TYPE]

// 優惠券發放類型定義
export const DISTRIBUTION_TYPE = {
  MANUAL: 'manual',       // 手動發放
  AUTO: 'auto',           // 自動發放
  BULK: 'bulk',           // 批量發放
  PROMOTION: 'promotion'  // 促銷活動
} as const

export type DistributionType = typeof DISTRIBUTION_TYPE[keyof typeof DISTRIBUTION_TYPE]

// 目標類型定義
export const TARGET_TYPE = {
  ALL: 'all',           // 所有用戶
  USER: 'user',         // 特定用戶
  GROUP: 'group',       // 用戶群組
  NEW_USER: 'new_user', // 新用戶
  VIP: 'vip'            // VIP用戶
} as const

export type TargetType = typeof TARGET_TYPE[keyof typeof TARGET_TYPE]

// 使用狀態定義
export const USAGE_STATUS = {
  ACTIVE: 'active',     // 正常使用
  REFUNDED: 'refunded', // 已退款
  CANCELLED: 'cancelled' // 已取消
} as const

export type UsageStatus = typeof USAGE_STATUS[keyof typeof USAGE_STATUS]

// 優惠券主表
export const coupons = sqliteTable('coupons', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  restaurantId: text('restaurant_id').references(() => restaurants.id, { onDelete: 'cascade' }),
  
  // 優惠券基本資訊
  code: text('code').notNull().unique(), // 優惠券代碼
  name: text('name').notNull(), // 優惠券名稱
  description: text('description'), // 優惠券描述
  
  // 折扣設定
  discountType: text('discount_type').$type<DiscountType>().notNull(), // 折扣類型
  discountValue: real('discount_value').notNull(), // 折扣值
  maxDiscountAmount: real('max_discount_amount'), // 最大折扣金額
  
  // 使用條件
  minOrderAmount: real('min_order_amount').default(0), // 最低訂單金額
  applicableMenuItems: text('applicable_menu_items', { mode: 'json' }).$type<number[]>(), // 適用商品
  applicableCategories: text('applicable_categories', { mode: 'json' }).$type<number[]>(), // 適用分類
  
  // 使用限制
  usageLimit: integer('usage_limit'), // 總使用次數限制
  usageLimitPerUser: integer('usage_limit_per_user'), // 每用戶使用次數限制
  usedCount: integer('used_count').default(0), // 已使用次數
  
  // 有效期設定
  validFrom: text('valid_from').notNull(), // 有效期開始時間
  validTo: text('valid_to').notNull(), // 有效期結束時間
  
  // 狀態控制
  isActive: integer('is_active', { mode: 'boolean' }).default(true), // 是否啟用
  isVisible: integer('is_visible', { mode: 'boolean' }).default(true), // 是否對用戶可見
  
  // 元數據
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }), // 創建者
}, (table) => ({
  codeIdx: index('idx_coupons_code').on(table.code),
  restaurantIdIdx: index('idx_coupons_restaurant_id').on(table.restaurantId),
  validPeriodIdx: index('idx_coupons_valid_period').on(table.validFrom, table.validTo),
  statusIdx: index('idx_coupons_status').on(table.isActive, table.isVisible),
  discountTypeIdx: index('idx_coupons_discount_type').on(table.discountType),
}))

// 優惠券使用記錄表
export const couponUsage = sqliteTable('coupon_usage', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  couponId: integer('coupon_id').notNull().references(() => coupons.id, { onDelete: 'cascade' }),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }), // 使用者ID
  
  // 使用詳情
  discountAmount: real('discount_amount').notNull(), // 實際折扣金額
  originalAmount: real('original_amount').notNull(), // 使用前訂單金額
  finalAmount: real('final_amount').notNull(), // 使用後訂單金額
  
  // 使用時間和狀態
  usedAt: text('used_at').default('CURRENT_TIMESTAMP'),
  status: text('status').$type<UsageStatus>().default('active'), // 使用狀態
  
  // 元數據
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
}, (table) => ({
  couponIdIdx: index('idx_coupon_usage_coupon_id').on(table.couponId),
  orderIdIdx: index('idx_coupon_usage_order_id').on(table.orderId),
  userIdIdx: index('idx_coupon_usage_user_id').on(table.userId),
  usedAtIdx: index('idx_coupon_usage_used_at').on(table.usedAt),
  statusIdx: index('idx_coupon_usage_status').on(table.status),
  uniqueUsageIdx: index('idx_coupon_usage_unique').on(table.couponId, table.orderId),
}))

// 優惠券發放記錄表
export const couponDistributions = sqliteTable('coupon_distributions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  couponId: integer('coupon_id').notNull().references(() => coupons.id, { onDelete: 'cascade' }),
  
  // 發放資訊
  distributionType: text('distribution_type').$type<DistributionType>().notNull(), // 發放類型
  targetType: text('target_type').$type<TargetType>(), // 目標類型
  targetCriteria: text('target_criteria', { mode: 'json' }), // 目標條件
  
  // 發放統計
  totalDistributed: integer('total_distributed').default(0), // 總發放數量
  totalUsed: integer('total_used').default(0), // 總使用數量
  
  // 發放時間
  distributedAt: text('distributed_at').default('CURRENT_TIMESTAMP'),
  expiresAt: text('expires_at'), // 發放過期時間
  
  // 元數據
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }), // 發放者
  notes: text('notes'), // 發放備註
}, (table) => ({
  couponIdIdx: index('idx_coupon_distributions_coupon_id').on(table.couponId),
  distributionTypeIdx: index('idx_coupon_distributions_type').on(table.distributionType),
  distributedAtIdx: index('idx_coupon_distributions_distributed_at').on(table.distributedAt),
}))

// 優惠券模板表
export const couponTemplates = sqliteTable('coupon_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  restaurantId: text('restaurant_id').references(() => restaurants.id, { onDelete: 'cascade' }),
  
  // 模板資訊
  name: text('name').notNull(), // 模板名稱
  description: text('description'), // 模板描述
  templateData: text('template_data', { mode: 'json' }).notNull(), // 模板配置
  
  // 使用統計
  usageCount: integer('usage_count').default(0), // 使用次數
  
  // 狀態控制
  isActive: integer('is_active', { mode: 'boolean' }).default(true), // 是否啟用
  isSystemTemplate: integer('is_system_template', { mode: 'boolean' }).default(false), // 是否為系統模板
  
  // 元數據
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }), // 創建者
}, (table) => ({
  restaurantIdIdx: index('idx_coupon_templates_restaurant_id').on(table.restaurantId),
  activeIdx: index('idx_coupon_templates_active').on(table.isActive),
  systemTemplateIdx: index('idx_coupon_templates_system').on(table.isSystemTemplate),
}))

// 關聯定義
export const couponsRelations = relations(coupons, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [coupons.restaurantId],
    references: [restaurants.id]
  }),
  creator: one(users, {
    fields: [coupons.createdBy],
    references: [users.id]
  }),
  usages: many(couponUsage),
  distributions: many(couponDistributions),
}))

export const couponUsageRelations = relations(couponUsage, ({ one }) => ({
  coupon: one(coupons, {
    fields: [couponUsage.couponId],
    references: [coupons.id]
  }),
  order: one(orders, {
    fields: [couponUsage.orderId],
    references: [orders.id]
  }),
  user: one(users, {
    fields: [couponUsage.userId],
    references: [users.id]
  }),
}))

export const couponDistributionsRelations = relations(couponDistributions, ({ one }) => ({
  coupon: one(coupons, {
    fields: [couponDistributions.couponId],
    references: [coupons.id]
  }),
  creator: one(users, {
    fields: [couponDistributions.createdBy],
    references: [users.id]
  }),
}))

export const couponTemplatesRelations = relations(couponTemplates, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [couponTemplates.restaurantId],
    references: [restaurants.id]
  }),
  creator: one(users, {
    fields: [couponTemplates.createdBy],
    references: [users.id]
  }),
}))
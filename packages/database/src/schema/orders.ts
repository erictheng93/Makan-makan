import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { restaurants } from './restaurants'
import { tables } from './tables'
import { users } from './users'
import { orderItems } from './order-items'

// 訂單狀態定義
export const ORDER_STATUS = {
  PENDING: 'pending',           // 待確認
  CONFIRMED: 'confirmed',       // 已確認
  PREPARING: 'preparing',       // 準備中
  READY: 'ready',              // 已完成
  DELIVERED: 'delivered',       // 已送達
  PAID: 'paid',                // 已付款
  CANCELLED: 'cancelled',       // 已取消
  REFUNDED: 'refunded'         // 已退款
} as const

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS]

// 付款方式定義
export const PAYMENT_METHODS = {
  CASH: 'cash',                // 現金
  CARD: 'card',                // 信用卡
  DIGITAL_WALLET: 'digital_wallet', // 數位錢包
  BANK_TRANSFER: 'bank_transfer',   // 銀行轉帳
  OTHER: 'other'               // 其他
} as const

export type PaymentMethod = typeof PAYMENT_METHODS[keyof typeof PAYMENT_METHODS]

export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  // 關聯資訊
  restaurantId: integer('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  tableId: integer('table_id').notNull().references(() => tables.id, { onDelete: 'restrict' }),
  customerId: integer('customer_id').references(() => users.id), // 可選：註冊用戶
  
  // 訂單基本資訊
  orderNumber: text('order_number').notNull().unique(), // 訂單編號
  status: text('status').notNull().default(ORDER_STATUS.PENDING),
  
  // 金額資訊
  subtotal: real('subtotal').notNull(), // 小計
  taxAmount: real('tax_amount').notNull().default(0), // 稅額
  serviceCharge: real('service_charge').notNull().default(0), // 服務費
  discountAmount: real('discount_amount').notNull().default(0), // 折扣金額
  totalAmount: real('total_amount').notNull(), // 總金額
  
  // 顧客資訊
  customerInfo: text('customer_info', { mode: 'json' }).$type<{
    name?: string
    phone?: string
    email?: string
    peopleCount?: number // 用餐人數
    specialRequests?: string[] // 特殊需求
  }>(),
  
  // 時間資訊
  estimatedPrepTime: integer('estimated_prep_time'), // 預估準備時間（分鐘）
  actualPrepTime: integer('actual_prep_time'), // 實際準備時間（分鐘）
  
  // 狀態時間戳記
  confirmedAt: integer('confirmed_at', { mode: 'timestamp' }),
  preparingAt: integer('preparing_at', { mode: 'timestamp' }),
  readyAt: integer('ready_at', { mode: 'timestamp' }),
  deliveredAt: integer('delivered_at', { mode: 'timestamp' }),
  paidAt: integer('paid_at', { mode: 'timestamp' }),
  cancelledAt: integer('cancelled_at', { mode: 'timestamp' }),
  
  // 付款資訊
  paymentMethod: text('payment_method'),
  paymentStatus: text('payment_status').default('pending'), // pending, completed, failed, refunded
  paymentTransactionId: text('payment_transaction_id'),
  
  // 優惠券和促銷
  couponCode: text('coupon_code'),
  promotionIds: text('promotion_ids', { mode: 'json' }).$type<string[]>(),
  
  // 評價資訊
  rating: integer('rating'), // 1-5 星評分
  reviewComment: text('review_comment'),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
  
  // 訂單備註
  notes: text('notes'), // 顧客備註
  internalNotes: text('internal_notes'), // 內部備註
  
  // 取消資訊
  cancellationReason: text('cancellation_reason'),
  refundAmount: real('refund_amount'),
  
  // 配送資訊（外送使用）
  deliveryInfo: text('delivery_info', { mode: 'json' }).$type<{
    type?: 'dine_in' | 'takeaway' | 'delivery'
    address?: string
    phone?: string
    instructions?: string
    deliveryFee?: number
    estimatedDeliveryTime?: number
  }>(),
  
  // 時間戳記
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$onUpdate(() => new Date()),
}, (table) => ({
  // 關鍵索引優化
  restaurantStatusIdx: index('orders_restaurant_status_idx').on(
    table.restaurantId, 
    table.status, 
    table.createdAt
  ),
  restaurantTableIdx: index('orders_restaurant_table_idx').on(
    table.restaurantId, 
    table.tableId, 
    table.status
  ),
  orderNumberIdx: index('orders_order_number_idx').on(table.orderNumber),
  customerIdx: index('orders_customer_idx').on(table.customerId, table.createdAt),
  statusTimeIdx: index('orders_status_time_idx').on(table.status, table.createdAt),
  paymentStatusIdx: index('orders_payment_status_idx').on(table.paymentStatus, table.paidAt),
}))

export const orderRelations = relations(orders, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [orders.restaurantId],
    references: [restaurants.id],
  }),
  table: one(tables, {
    fields: [orders.tableId],
    references: [tables.id],
  }),
  customer: one(users, {
    fields: [orders.customerId],
    references: [users.id],
  }),
  items: many(orderItems),
}))
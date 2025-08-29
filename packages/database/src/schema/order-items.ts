import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { orders } from './orders'
import { menuItems } from './menu-items'

export const orderItems = sqliteTable('order_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  // 關聯資訊
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  menuItemId: integer('menu_item_id').notNull().references(() => menuItems.id, { onDelete: 'restrict' }),
  
  // 基本資訊
  quantity: integer('quantity').notNull(),
  
  // 價格資訊
  unitPrice: real('unit_price').notNull(), // 單價（快照，避免菜單價格變動影響）
  totalPrice: real('total_price').notNull(), // 總價
  
  // 菜品資訊快照（防止菜單變更影響歷史訂單）
  itemSnapshot: text('item_snapshot', { mode: 'json' }).$type<{
    name: string
    description?: string
    imageUrl?: string
    category?: string
  }>(),
  
  // 客製化選項
  customizations: text('customizations', { mode: 'json' }).$type<{
    // 選擇的尺寸
    size?: {
      id: string
      name: string
      priceAdjustment?: number
    }
    
    // 選擇的客製化選項
    options?: Array<{
      id: string
      optionName: string    // 選項類別名稱（如：辣度）
      choiceId: string
      choiceName: string    // 選擇值（如：中辣）
      priceAdjustment?: number
    }>
    
    // 選擇的加購項目
    addOns?: Array<{
      id: string
      name: string
      quantity: number
      unitPrice: number
      totalPrice: number
    }>
  }>(),
  
  // 狀態和時間
  status: text('status').notNull().default('pending'), // pending, preparing, ready, served, cancelled
  preparedAt: integer('prepared_at', { mode: 'timestamp' }),
  servedAt: integer('served_at', { mode: 'timestamp' }),
  
  // 備註
  notes: text('notes'), // 顧客備註
  kitchenNotes: text('kitchen_notes'), // 廚房備註
  
  // 取消資訊
  cancelledAt: integer('cancelled_at', { mode: 'timestamp' }),
  cancellationReason: text('cancellation_reason'),
  
  // 時間戳記
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$onUpdate(() => new Date()),
}, (table) => ({
  // 索引優化
  orderStatusIdx: index('order_items_order_status_idx').on(table.orderId, table.status),
  menuItemIdx: index('order_items_menu_item_idx').on(table.menuItemId, table.createdAt),
}))

export const orderItemRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  menuItem: one(menuItems, {
    fields: [orderItems.menuItemId],
    references: [menuItems.id],
  }),
}))
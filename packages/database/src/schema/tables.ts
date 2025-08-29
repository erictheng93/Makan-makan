import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { restaurants } from './restaurants'
import { orders } from './orders'

export const tables = sqliteTable('tables', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  restaurantId: integer('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  
  // 桌子資訊
  number: text('number').notNull(), // 桌號（如：A1, B2, 101）
  name: text('name'), // 桌子名稱（可選）
  capacity: integer('capacity').notNull().default(4), // 容納人數
  
  // 位置資訊
  location: text('location'), // 位置描述（如：窗邊、角落）
  floor: integer('floor').default(1), // 樓層
  section: text('section'), // 區域（如：A區、B區）
  
  // QR Code 資訊
  qrCode: text('qr_code').notNull().unique(), // QR Code 內容
  qrCodeImageUrl: text('qr_code_image_url'), // QR Code 圖片 URL
  qrCodeVersion: integer('qr_code_version').notNull().default(1), // QR Code 版本（用於更新）
  
  // 狀態
  isOccupied: integer('is_occupied', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  isReservable: integer('is_reservable', { mode: 'boolean' }).notNull().default(true),
  
  // 設備和設定
  features: text('features', { mode: 'json' }).$type<{
    hasChargingPort?: boolean // 充電插座
    hasWifi?: boolean         // WiFi 訊號強度
    isAccessible?: boolean    // 無障礙設施
    hasView?: boolean         // 景觀位置
    isQuietZone?: boolean     // 安靜區域
    smokingAllowed?: boolean  // 吸菸區
  }>(),
  
  // 目前使用狀況
  currentOrderId: integer('current_order_id').references(() => orders.id),
  occupiedAt: integer('occupied_at', { mode: 'timestamp' }),
  occupiedBy: text('occupied_by'), // 使用者標識
  estimatedFreeAt: integer('estimated_free_at', { mode: 'timestamp' }),
  
  // 清潔和維護
  lastCleanedAt: integer('last_cleaned_at', { mode: 'timestamp' }),
  maintenanceNotes: text('maintenance_notes'),
  
  // 統計資訊
  totalUsage: integer('total_usage').notNull().default(0), // 使用次數
  averageOccupancyMinutes: integer('average_occupancy_minutes').default(0),
  
  // 時間戳記
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$onUpdate(() => new Date()),
}, (table) => ({
  // 索引優化
  restaurantNumberIdx: index('tables_restaurant_number_idx').on(table.restaurantId, table.number),
  restaurantStatusIdx: index('tables_restaurant_status_idx').on(table.restaurantId, table.isOccupied, table.isActive),
  qrCodeIdx: index('tables_qr_code_idx').on(table.qrCode),
}))

export const tableRelations = relations(tables, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [tables.restaurantId],
    references: [restaurants.id],
  }),
  currentOrder: one(orders, {
    fields: [tables.currentOrderId],
    references: [orders.id],
  }),
  orders: many(orders),
}))
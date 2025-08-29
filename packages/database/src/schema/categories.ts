import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { restaurants } from './restaurants'
import { menuItems } from './menu-items'

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  restaurantId: integer('restaurant_id').notNull().references(() => restaurants.id, { onDelete: 'cascade' }),
  
  // 基本資訊
  name: text('name').notNull(),
  description: text('description'),
  
  // 顯示設定
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  isVisible: integer('is_visible', { mode: 'boolean' }).notNull().default(true),
  
  // 媒體檔案
  imageUrl: text('image_url'),
  iconUrl: text('icon_url'),
  
  // 營業時間限制（可選）
  availableHours: text('available_hours', { mode: 'json' }).$type<{
    start?: string // HH:mm 格式
    end?: string   // HH:mm 格式
    days?: number[] // 0-6 代表週日到週六
  }>(),
  
  // 統計資訊
  itemCount: integer('item_count').notNull().default(0),
  
  // 時間戳記
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$onUpdate(() => new Date()),
}, (table) => ({
  // 索引優化
  restaurantSortIdx: index('categories_restaurant_sort_idx').on(table.restaurantId, table.sortOrder),
  restaurantActiveIdx: index('categories_restaurant_active_idx').on(table.restaurantId, table.isActive),
}))

export const categoryRelations = relations(categories, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [categories.restaurantId],
    references: [restaurants.id],
  }),
  menuItems: many(menuItems),
}))
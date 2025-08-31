// 匯出 schema
export * from './schema'

// 匯出服務層
export * from './services'

// 匯出 Drizzle 相關
export { drizzle } from 'drizzle-orm/d1'
export { sql, count, eq, gte, and, lte, desc, asc, sum, avg, between } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import type { Database as D1Database } from '@cloudflare/d1'
import * as schema from './schema'

// 工具函數 - 使用 Cloudflare Workers 內建 D1Database 類型
export function createDatabase(d1: D1Database) {
  return drizzle(d1 as any, { 
    schema,
    logger: process.env.NODE_ENV === 'development'
  })
}

// 導入必要的 D1Database 類型
export type { Database as D1Database } from '@cloudflare/d1'

// 重新導出 Database 類型作為向後兼容別名
export type Database = D1Database
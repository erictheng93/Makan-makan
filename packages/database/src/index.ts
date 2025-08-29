// 匯出 schema
export * from './schema'

// 匯出服務層
export * from './services'

// 匯出 Drizzle 相關
export { drizzle } from 'drizzle-orm/d1'
export type { D1Database } from '@cloudflare/d1'

// 工具函數
export function createDatabase(d1: D1Database) {
  return drizzle(d1, { 
    schema: require('./schema'),
    logger: process.env.NODE_ENV === 'development'
  })
}
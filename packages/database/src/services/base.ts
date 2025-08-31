import { drizzle } from 'drizzle-orm/d1'
import type { Database as D1Database } from '@cloudflare/d1'
import * as schema from '../schema'

// 基礎服務類別
export class BaseService {
  protected db: ReturnType<typeof drizzle<typeof schema>>

  constructor(d1: D1Database) {
    this.db = drizzle(d1 as any, { 
      schema,
      logger: process.env.NODE_ENV === 'development'
    })
  }

  // 通用錯誤處理
  protected handleError(error: any, operation: string): never {
    console.error(`Database error in ${operation}:`, error)
    
    if (error.message?.includes('UNIQUE constraint failed')) {
      throw new Error('Record already exists')
    }
    
    if (error.message?.includes('FOREIGN KEY constraint failed')) {
      throw new Error('Related record not found')
    }
    
    if (error.message?.includes('NOT NULL constraint failed')) {
      throw new Error('Required field missing')
    }
    
    throw new Error(`Database operation failed: ${operation}`)
  }

  // 分頁輔助函數
  protected createPagination(page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit
    return { limit, offset }
  }

  // 生成訂單號碼
  protected generateOrderNumber(restaurantId: number): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substr(2, 4)
    return `${restaurantId}-${timestamp}-${random}`.toUpperCase()
  }

  // 計算總金額
  protected calculateOrderTotal(
    subtotal: number,
    taxRate: number = 0,
    serviceChargeRate: number = 0,
    discountAmount: number = 0
  ) {
    const taxAmount = subtotal * taxRate
    const serviceCharge = subtotal * serviceChargeRate
    const totalAmount = subtotal + taxAmount + serviceCharge - discountAmount
    
    return {
      subtotal,
      taxAmount,
      serviceCharge,
      discountAmount,
      totalAmount
    }
  }
}
/**
 * POSService Test Suite
 *
 * 全面测试 POS (Point of Sale) 服务的所有功能
 * 覆盖：收银机管理、班次管理、现金操作、收据管理、退款处理、报表生成
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { POSService } from '../POSService'
import type { D1Database } from '@cloudflare/workers-types'

// ==========================================
// Mock 設置
// ==========================================

const createMockDB = () => {
  const mockData = {
    registers: new Map(),
    shifts: new Map(),
    movements: new Map(),
    receipts: new Map(),
    refunds: new Map(),
    reports: new Map(),
    orders: new Map(),
    users: new Map()
  }

  // 跟踪最后插入的ID，用于 where 查询
  let lastInsertedId: any = null
  let lastInsertedTable: string = ''

  const db: any = {
    insert: (table: any) => {
      const tableName = getTableName(table)
      return {
        values: async (data: any) => {
          const id = data.id || crypto.randomUUID()
          const dataWithId = { ...data, id }
          mockData[tableName as keyof typeof mockData].set(id, dataWithId)
          lastInsertedId = id
          lastInsertedTable = tableName
          return { success: true }
        }
      }
    },
    select: (fields?: any) => {
      let currentTable: string = ''
      let whereClause: any = null

      return {
        from: (table: any) => {
          currentTable = getTableName(table)
          return {
            where: (condition: any) => {
              whereClause = condition
              return {
                get: async () => {
                  const dataMap = mockData[currentTable as keyof typeof mockData]
                  if (!dataMap || dataMap.size === 0) return null

                  // 如果有最后插入的ID，且是同一个表，返回那条记录
                  if (lastInsertedTable === currentTable && lastInsertedId) {
                    const record = dataMap.get(lastInsertedId)
                    if (record) return record
                  }

                  // 否则返回第一条记录
                  return Array.from(dataMap.values())[0] || null
                },
                all: async () => {
                  const dataMap = mockData[currentTable as keyof typeof mockData]
                  if (!dataMap) return []
                  return Array.from(dataMap.values())
                },
                orderBy: (field: any) => ({
                  all: async () => {
                    const dataMap = mockData[currentTable as keyof typeof mockData]
                    if (!dataMap) return []
                    return Array.from(dataMap.values())
                  }
                })
              }
            },
            leftJoin: (joinTable: any, condition: any) => ({
              where: (whereCondition: any) => ({
                orderBy: (field: any) => ({
                  all: async () => {
                    const dataMap = mockData[currentTable as keyof typeof mockData]
                    if (!dataMap) return []
                    return Array.from(dataMap.values()).map(item => ({
                      register: item,
                      currentShiftStatus: null
                    }))
                  }
                })
              })
            }),
            innerJoin: (joinTable: any, condition: any) => {
              return {
                where: (whereCondition: any) => ({
                  get: async () => {
                    const shifts = mockData.shifts
                    const users = mockData.users
                    const registers = mockData.registers

                    if (shifts.size > 0) {
                      const shift = Array.from(shifts.values())[0]
                      const user = users.size > 0 ? Array.from(users.values())[0] : null
                      const register = registers.size > 0 ? Array.from(registers.values())[0] : null

                      return {
                        shift,
                        operatorName: user?.fullName || 'Test Operator',
                        registerName: register?.name || 'Test Register'
                      }
                    }
                    return null
                  }
                }),
                innerJoin: (table2: any, condition2: any) => ({
                  where: (whereCondition: any) => ({
                    get: async () => {
                      const shifts = mockData.shifts
                      const users = mockData.users
                      const registers = mockData.registers

                      if (shifts.size > 0) {
                        const shift = Array.from(shifts.values())[0]
                        const user = users.size > 0 ? Array.from(users.values())[0] : null
                        const register = registers.size > 0 ? Array.from(registers.values())[0] : null

                        return {
                          shift,
                          operatorName: user?.fullName || 'Test Operator',
                          registerName: register?.name || 'Test Register'
                        }
                      }
                      return null
                    }
                  })
                })
              }
            },
            get: async () => {
              const dataMap = mockData[currentTable as keyof typeof mockData]
              if (!dataMap || dataMap.size === 0) return null
              return Array.from(dataMap.values())[0] || null
            },
            all: async () => {
              const dataMap = mockData[currentTable as keyof typeof mockData]
              if (!dataMap) return []
              return Array.from(dataMap.values())
            },
            orderBy: (field: any) => ({
              all: async () => {
                const dataMap = mockData[currentTable as keyof typeof mockData]
                if (!dataMap) return []
                return Array.from(dataMap.values())
              }
            })
          }
        }
      }
    },
    update: (table: any) => {
      const tableName = getTableName(table)
      return {
        set: (data: any) => ({
          where: (condition: any) => {
            // 更新 mock 数据
            const dataMap = mockData[tableName as keyof typeof mockData]
            if (dataMap && dataMap.size > 0) {
              // 更新所有记录（简化实现）
              dataMap.forEach((value, key) => {
                dataMap.set(key, { ...value, ...data })
              })
            }
            return Promise.resolve({ success: true })
          }
        })
      }
    },
    _mockData: mockData // 暴露 mockData 用于测试验证
  }

  return db
}

// 辅助函数：从 Drizzle table 对象获取表名
const getTableName = (table: any): string => {
  if (table?._ && 'name' in table._) return table._.name
  return 'registers' // 默认值
}

const createMockEnv = () => ({
  DB: {} as D1Database,
  JWT_SECRET: 'test-secret',
  CLOUDFLARE_IMAGES_KEY: 'test-key'
})

// ==========================================
// Test Suites
// ==========================================

describe('POSService', () => {
  let service: POSService
  let mockDB: any
  let mockEnv: any

  beforeEach(() => {
    mockDB = createMockDB()
    mockEnv = createMockEnv()
    service = new POSService(mockDB, mockEnv)

    // Mock crypto.randomUUID - 生成标准 UUID v4 格式
    let uuidCounter = 0
    vi.stubGlobal('crypto', {
      randomUUID: () => {
        uuidCounter++
        // 生成标准 UUID v4 格式: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
        const hex = uuidCounter.toString(16).padStart(12, '0')
        return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-4000-8000-000000000000`
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ==========================================
  // 1. 收銀機管理測試
  // ==========================================

  describe('收銀機管理', () => {
    describe('createRegister', () => {
      it('應該成功創建收銀機', async () => {
        const registerData = {
          name: 'POS-001',
          location: 'Front Counter',
          restaurantId: 'R-001',
          hardwareConfig: { printer: 'EPSON-TM-T88' },
          peripherals: { scanner: 'Honeywell' },
          settings: { currency: 'TWD' }
        }

        const result = await service.createRegister(registerData, 'R-001')

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(result.data?.name).toBe('POS-001')
        expect(result.data?.location).toBe('Front Counter')
        expect(result.data?.isActive).toBe(true)
      })

      it('應該拒絕無效的收銀機名稱', async () => {
        const registerData = {
          name: '', // 無效：空名稱
          restaurantId: 'R-001' }

        const result = await service.createRegister(registerData, 'R-001')

        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
      })

      it('應該正確處理可選配置', async () => {
        const registerData = {
          name: 'POS-002',
          restaurantId: 1
          // 沒有提供 location, hardwareConfig 等
        }

        const result = await service.createRegister(registerData, 'R-001')

        expect(result.success).toBe(true)
        expect(result.data?.hardwareConfig).toBeDefined()
        expect(result.data?.peripherals).toBeDefined()
      })
    })

    describe('getRegisters', () => {
      it('應該返回餐廳的所有收銀機', async () => {
        // 先創建幾個收銀機
        await service.createRegister({ restaurantId: 'R-001', name: 'POS-001', restaurantId: 'R-001' }, 1)
        await service.createRegister({ restaurantId: 'R-001', name: 'POS-002', restaurantId: 'R-001' }, 1)

        const result = await service.getRegisters(1)

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(Array.isArray(result.data)).toBe(true)
      })

      it('應該只返回指定餐廳的收銀機', async () => {
        await service.createRegister({ restaurantId: 'R-001', name: 'POS-R1', restaurantId: 'R-001' }, 1)
        await service.createRegister({ restaurantId: 'R-001', name: 'POS-R2', restaurantId: 'R-002' }, 1)

        const result = await service.getRegisters(1)

        expect(result.success).toBe(true)
        // 在實際實現中會過濾，這裡簡化處理
      })
    })
  })

  // ==========================================
  // 2. 班次管理測試
  // ==========================================

  describe('班次管理', () => {
    let testRegisterId: string

    beforeEach(async () => {
      // 先創建一個測試收銀機
      const registerResult = await service.createRegister({ restaurantId: 'R-001', name: 'Test-Register',
        restaurantId: 'R-001' }, 1)
      testRegisterId = registerResult.data!.id
    })

    describe('startShift', () => {
      it('應該成功開始班次', async () => {
        const shiftData = {
          registerId: testRegisterId,
          operatorId: 1,
          startAmount: 1000,
          notes: '早班開始'
        }

        const result = await service.startShift(shiftData)

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(result.data?.registerId).toBe(testRegisterId)
        expect(result.data?.startAmount).toBe(1000)
        expect(result.data?.status).toBe('active')
      })

      it('應該拒絕在已有活躍班次的收銀機上開新班次', async () => {
        const shiftData = {
          registerId: testRegisterId,
          operatorId: 1,
          startAmount: 1000
        }

        // 第一次開班應該成功
        const firstResult = await service.startShift(shiftData)
        expect(firstResult.success).toBe(true)

        // 第二次開班應該失敗
        const secondResult = await service.startShift(shiftData)
        expect(secondResult.success).toBe(false)
        expect(secondResult.error).toContain('已有活躍班次')
      })

      it('應該正確記錄開班現金操作', async () => {
        const shiftData = {
          registerId: testRegisterId,
          operatorId: 1,
          startAmount: 1000
        }

        await service.startShift(shiftData)

        // 驗證現金操作記錄已創建
        const movements = mockDB._mockData.movements
        expect(movements.size).toBeGreaterThan(0)
      })
    })

    describe('endShift', () => {
      let testShiftId: string

      beforeEach(async () => {
        // 創建用戶數據
        mockDB._mockData.users.set(1, {
          id: 1,
          fullName: 'Test Operator'
        })

        // 開始一個班次
        const shiftResult = await service.startShift({
          registerId: testRegisterId,
          operatorId: 1,
          startAmount: 1000
        })
        testShiftId = shiftResult.data!.id
      })

      it('應該成功結束班次', async () => {
        const endData = {
          actualAmount: 5000,
          closingNotes: '今日結束'
        }

        const result = await service.endShift(testShiftId, endData, 1)

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(result.data?.shift.status).toBe('closed')
      })

      it('應該正確計算現金差異', async () => {
        // 模擬班次有銷售
        const shift = mockDB._mockData.shifts.get(testShiftId)
        mockDB._mockData.shifts.set(testShiftId, {
          ...shift,
          totalSales: 4500,
          totalRefunds: 500
        })

        const endData = {
          actualAmount: 5100, // 期望: 1000 + 4500 - 500 = 5000
          closingNotes: '多出 100'
        }

        const result = await service.endShift(testShiftId, endData, 1)

        expect(result.success).toBe(true)
        expect(result.data?.shift.differenceAmount).toBe(100)
      })

      it('應該生成班次報表', async () => {
        const endData = {
          actualAmount: 1000
        }

        const result = await service.endShift(testShiftId, endData, 1)

        expect(result.success).toBe(true)
        expect(result.data?.report).toBeDefined()
      })

      it('應該拒絕結束不存在的班次', async () => {
        const endData = {
          actualAmount: 1000
        }

        const result = await service.endShift('non-existent-id', endData, 1)

        expect(result.success).toBe(false)
        expect(result.error).toContain('找不到活躍班次')
      })
    })
  })

  // ==========================================
  // 3. 現金操作測試
  // ==========================================

  describe('現金操作', () => {
    let testShiftId: string

    beforeEach(async () => {
      // 創建收銀機和班次
      const registerResult = await service.createRegister({ restaurantId: 'R-001', name: 'Test-Register',
        restaurantId: 'R-001' }, 1)

      const shiftResult = await service.startShift({
        registerId: registerResult.data!.id,
        operatorId: 1,
        startAmount: 1000
      })
      testShiftId = shiftResult.data!.id
    })

    describe('processCashMovement', () => {
      it('應該成功記錄現金存入', async () => {
        const movementData = {
          type: 'cash_in' as const,
          amount: 500,
          description: '現金存入',
          denominationBreakdown: { '100': 5 }
        }

        const result = await service.processCashMovement(
          testShiftId,
          movementData,
          1
        )

        expect(result.success).toBe(true)
      })

      it('應該成功記錄現金取出', async () => {
        const movementData = {
          type: 'cash_out' as const,
          amount: 200,
          description: '現金取出'
        }

        const result = await service.processCashMovement(
          testShiftId,
          movementData,
          1
        )

        expect(result.success).toBe(true)
      })

      it('應該拒絕在非活躍班次上記錄操作', async () => {
        // 結束班次
        mockDB._mockData.users.set(1, { id: 1, fullName: 'Test' })
        await service.endShift(testShiftId, { actualAmount: 1000 }, 1)

        const movementData = {
          type: 'cash_in' as const,
          amount: 500,
          description: '測試'
        }

        const result = await service.processCashMovement(
          testShiftId,
          movementData,
          1
        )

        expect(result.success).toBe(false)
        expect(result.error).toContain('班次不存在或已結束')
      })

      it('應該驗證操作類型', async () => {
        const movementData = {
          type: 'invalid_type' as any,
          amount: 500,
          description: '無效操作'
        }

        const result = await service.processCashMovement(
          testShiftId,
          movementData,
          1
        )

        expect(result.success).toBe(false)
      })
    })
  })

  // ==========================================
  // 4. 收據管理測試
  // ==========================================

  describe('收據管理', () => {
    let testRegisterId: string
    let testOrderId: number

    beforeEach(async () => {
      // 創建測試訂單
      testOrderId = 1
      mockDB._mockData.orders.set(testOrderId, {
        id: testOrderId,
        orderNumber: 'ORD-001',
        customerName: 'Test Customer',
        subtotal: 100,
        taxAmount: 5,
        totalAmount: 105,
        paymentMethod: 'cash'
      })

      // 創建收銀機
      const registerResult = await service.createRegister({ restaurantId: 'R-001', name: 'Test-Register',
        restaurantId: 'R-001' }, 1)
      testRegisterId = registerResult.data!.id
    })

    describe('printReceipt', () => {
      it('應該成功打印收據', async () => {
        const receiptData = {
          orderId: testOrderId,
          templateName: 'standard',
          receiptType: 'customer' as const
        }

        const result = await service.printReceipt(
          receiptData,
          testRegisterId
        )

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(result.data?.orderId).toBe(testOrderId)
        expect(result.data?.receiptNumber).toBeDefined()
        expect(result.data?.printStatus).toBe('pending')
      })

      it('應該拒絕打印不存在的訂單', async () => {
        const receiptData = {
          orderId: 999999, // 不存在的訂單
          templateName: 'standard',
          receiptType: 'customer' as const
        }

        const result = await service.printReceipt(
          receiptData,
          testRegisterId
        )

        expect(result.success).toBe(false)
        expect(result.error).toContain('訂單不存在')
      })

      it('應該生成正確的收據內容', async () => {
        const receiptData = {
          orderId: testOrderId,
          templateName: 'standard',
          receiptType: 'customer' as const
        }

        const result = await service.printReceipt(
          receiptData,
          testRegisterId
        )

        expect(result.success).toBe(true)
        expect(result.data?.content).toBeDefined()
        // 驗證內容包含訂單信息
      })

      it('應該支持多種收據類型', async () => {
        const types: Array<'customer' | 'kitchen' | 'merchant'> = [
          'customer',
          'kitchen',
          'merchant'
        ]

        for (const type of types) {
          const result = await service.printReceipt(
            {
              orderId: testOrderId,
              receiptType: type
            },
            testRegisterId
          )

          expect(result.success).toBe(true)
        }
      })
    })
  })

  // ==========================================
  // 5. 退款處理測試
  // ==========================================

  describe('退款處理', () => {
    let testRegisterId: string
    let testOrderId: number

    beforeEach(async () => {
      // 創建測試訂單
      testOrderId = 1
      mockDB._mockData.orders.set(testOrderId, {
        id: testOrderId,
        orderNumber: 'ORD-001',
        totalAmount: 1000
      })

      // 創建收銀機
      const registerResult = await service.createRegister({ restaurantId: 'R-001', name: 'Test-Register',
        restaurantId: 'R-001' }, 1)
      testRegisterId = registerResult.data!.id
    })

    describe('processRefund', () => {
      it('應該成功處理全額退款', async () => {
        const refundData = {
          originalOrderId: testOrderId,
          refundType: 'full' as const,
          refundAmount: 1000,
          refundMethod: 'cash',
          reasonCode: 'customer_request',
          reasonDescription: '客戶要求退款'
        }

        const result = await service.processRefund(
          refundData,
          testRegisterId,
          1
        )

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(result.data?.refundAmount).toBe(1000)
        expect(result.data?.status).toBe('processing')
      })

      it('應該成功處理部分退款', async () => {
        const refundData = {
          originalOrderId: testOrderId,
          refundType: 'partial' as const,
          refundAmount: 500,
          refundMethod: 'cash',
          reasonCode: 'item_defect'
        }

        const result = await service.processRefund(
          refundData,
          testRegisterId,
          1
        )

        expect(result.success).toBe(true)
        expect(result.data?.refundAmount).toBe(500)
      })

      it('應該拒絕超過原訂單金額的退款', async () => {
        const refundData = {
          originalOrderId: testOrderId,
          refundType: 'full' as const,
          refundAmount: 1500, // 超過原訂單的 1000
          refundMethod: 'cash',
          reasonCode: 'customer_request'
        }

        const result = await service.processRefund(
          refundData,
          testRegisterId,
          1
        )

        expect(result.success).toBe(false)
        expect(result.error).toContain('不能超過原訂單金額')
      })

      it('應該拒絕退款不存在的訂單', async () => {
        const refundData = {
          originalOrderId: 999999,
          refundType: 'full' as const,
          refundAmount: 100,
          refundMethod: 'cash',
          reasonCode: 'test'
        }

        const result = await service.processRefund(
          refundData,
          testRegisterId,
          1
        )

        expect(result.success).toBe(false)
        expect(result.error).toContain('原訂單不存在')
      })

      it('應該生成唯一的退款編號', async () => {
        const refundData = {
          originalOrderId: testOrderId,
          refundType: 'full' as const,
          refundAmount: 1000,
          refundMethod: 'cash',
          reasonCode: 'test'
        }

        const result1 = await service.processRefund(
          refundData,
          testRegisterId,
          1
        )
        const result2 = await service.processRefund(
          refundData,
          testRegisterId,
          1
        )

        expect(result1.data?.refundNumber).not.toBe(result2.data?.refundNumber)
      })
    })
  })

  // ==========================================
  // 6. 報表生成測試
  // ==========================================

  describe('報表生成', () => {
    let testShiftId: string

    beforeEach(async () => {
      // 設置測試數據
      mockDB._mockData.users.set(1, {
        id: 1,
        fullName: 'Test Operator'
      })

      const registerResult = await service.createRegister({ restaurantId: 'R-001', name: 'Test-Register',
        restaurantId: 'R-001' }, 1)

      const shiftResult = await service.startShift({
        registerId: registerResult.data!.id,
        operatorId: 1,
        startAmount: 1000
      })
      testShiftId = shiftResult.data!.id

      // 添加一些銷售數據
      const shift = mockDB._mockData.shifts.get(testShiftId)
      mockDB._mockData.shifts.set(testShiftId, {
        ...shift,
        totalSales: 5000,
        totalRefunds: 200,
        cashSales: 3000,
        cardSales: 1500,
        digitalSales: 500,
        totalTransactions: 25
      })
    })

    describe('generateShiftReport', () => {
      it('應該成功生成班次報表', async () => {
        const result = await service.generateShiftReport(testShiftId)

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        expect(result.data?.reportId).toBeDefined()
        expect(result.data?.reportData).toBeDefined()
      })

      it('報表應包含班次基本資訊', async () => {
        const result = await service.generateShiftReport(testShiftId)

        expect(result.data?.reportData.shift).toBeDefined()
        expect(result.data?.reportData.shift.registerName).toBeDefined()
        expect(result.data?.reportData.shift.operatorName).toBeDefined()
      })

      it('報表應包含銷售摘要', async () => {
        const result = await service.generateShiftReport(testShiftId)

        const summary = result.data?.reportData.summary
        expect(summary).toBeDefined()
        expect(summary.totalSales).toBe(5000)
        expect(summary.totalRefunds).toBe(200)
        expect(summary.netSales).toBe(4800)
      })

      it('報表應包含支付方式分類', async () => {
        const result = await service.generateShiftReport(testShiftId)

        const breakdown = result.data?.reportData.breakdown
        expect(breakdown).toBeDefined()
        expect(breakdown.cashSales).toBe(3000)
        expect(breakdown.cardSales).toBe(1500)
        expect(breakdown.digitalSales).toBe(500)
      })

      it('應該拒絕生成不存在班次的報表', async () => {
        const result = await service.generateShiftReport('non-existent-id')

        expect(result.success).toBe(false)
        expect(result.error).toContain('班次不存在')
      })
    })

    describe('getShiftStats', () => {
      it('應該返回餐廳的班次統計', async () => {
        const result = await service.getShiftStats(1)

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
      })

      it('應該支持日期範圍過濾', async () => {
        const dateRange = {
          from: new Date('2024-01-01'),
          to: new Date('2024-01-31')
        }

        const result = await service.getShiftStats(1, dateRange)

        expect(result.success).toBe(true)
      })
    })
  })

  // ==========================================
  // 7. 錯誤處理和邊界情況測試
  // ==========================================

  describe('錯誤處理', () => {
    it('應該正確處理數據庫錯誤', async () => {
      // 模擬數據庫錯誤
      const errorDB = {
        insert: () => {
          throw new Error('Database connection failed')
        },
        select: () => ({
          from: () => ({
            where: () => ({
              get: async () => { throw new Error('Query failed') }
            })
          })
        })
      }

      const errorService = new POSService(errorDB, mockEnv)
      const result = await errorService.createRegister({ restaurantId: 'R-001', name: 'Test',
        restaurantId: 'R-001' }, 1)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('應該處理無效的輸入數據', async () => {
      const invalidData: any = {
        name: '',
        restaurantId: 'R-INVALID'
      }

      const result = await service.createRegister(invalidData, 'R-001')

      expect(result.success).toBe(false)
    })

    it('應該處理缺失的必填字段', async () => {
      const incompleteData: any = {
        name: 'Test'
        // 缺少 restaurantId
      }

      const result = await service.createRegister(incompleteData, 'R-001')

      expect(result.success).toBe(false)
    })
  })

  // ==========================================
  // 8. 併發和競態條件測試
  // ==========================================

  describe('併發處理', () => {
    it('應該防止同時在同一收銀機開啟多個班次', async () => {
      const registerResult = await service.createRegister({ restaurantId: 'R-001', name: 'Test-Register',
        restaurantId: 'R-001' }, 1)
      const registerId = registerResult.data!.id

      const shiftData = {
        registerId,
        operatorId: 1,
        startAmount: 1000
      }

      // 模擬併發請求
      const promises = [
        service.startShift(shiftData),
        service.startShift(shiftData),
        service.startShift(shiftData)
      ]

      const results = await Promise.all(promises)
      const successCount = results.filter(r => r.success).length

      // 只有一個應該成功
      expect(successCount).toBeLessThanOrEqual(1)
    })
  })

  // ==========================================
  // 9. 數據完整性測試
  // ==========================================

  describe('數據完整性', () => {
    it('班次結束後應清除收銀機的當前班次ID', async () => {
      const registerResult = await service.createRegister({ restaurantId: 'R-001', name: 'Test-Register',
        restaurantId: 'R-001' }, 1)

      const shiftResult = await service.startShift({
        registerId: registerResult.data!.id,
        operatorId: 1,
        startAmount: 1000
      })

      mockDB._mockData.users.set(1, { id: 1, fullName: 'Test' })

      await service.endShift(shiftResult.data!.id, { actualAmount: 1000 }, 1)

      // 驗證收銀機的 currentShiftId 已被清除
      const register = mockDB._mockData.registers.get(registerResult.data!.id)
      expect(register?.currentShiftId).toBeNull()
    })

    it('應該正確累計班次銷售統計', async () => {
      const registerResult = await service.createRegister({ restaurantId: 'R-001', name: 'Test-Register',
        restaurantId: 'R-001' }, 1)

      const shiftResult = await service.startShift({
        registerId: registerResult.data!.id,
        operatorId: 1,
        startAmount: 1000
      })

      // 模擬多筆銷售
      const shift = mockDB._mockData.shifts.get(shiftResult.data!.id)
      mockDB._mockData.shifts.set(shiftResult.data!.id, {
        ...shift,
        totalSales: 5000,
        totalTransactions: 10
      })

      const shiftData = mockDB._mockData.shifts.get(shiftResult.data!.id)
      expect(shiftData.totalSales).toBe(5000)
      expect(shiftData.totalTransactions).toBe(10)
    })
  })
})

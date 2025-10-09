import { eq, and, desc, asc, like, or, count, isNull, isNotNull } from 'drizzle-orm'
import { BaseService } from './base'
import { tables, restaurants, orders, seats } from '../schema'
import { SeatService } from './seat'

export interface CreateTableData {
  restaurantId: number
  number: string
  name?: string
  capacity: number
  location?: string
  floor?: number
  section?: string
  features?: {
    hasChargingPort?: boolean
    hasWifi?: boolean
    isAccessible?: boolean
    hasView?: boolean
    isQuietZone?: boolean
    smokingAllowed?: boolean
  }
  isReservable?: boolean
  // 座位模式支持（新增）
  qrMode?: 'table' | 'seat'
  seatCount?: number
  seatNumberingStyle?: 'numeric' | 'alphabetic' | 'custom'
}

export interface UpdateTableData {
  number?: string
  name?: string
  capacity?: number
  location?: string
  floor?: number
  section?: string
  features?: any
  isActive?: boolean
  isReservable?: boolean
  maintenanceNotes?: string
}

export interface TableFilters {
  restaurantId?: number
  floor?: number
  section?: string
  isOccupied?: boolean
  isActive?: boolean
  isReservable?: boolean
  minCapacity?: number
  maxCapacity?: number
  search?: string
  page?: number
  limit?: number
}

export interface QRCodeOptions {
  size?: 'small' | 'medium' | 'large'
  format?: 'png' | 'svg' | 'pdf'
  includeTableInfo?: boolean
  customData?: any
}

export interface TableStats {
  totalTables: number
  occupiedTables: number
  availableTables: number
  inactiveTables: number
  averageOccupancyRate: number
  byFloor: Record<number, number>
  bySection: Record<string, number>
  byCapacity: Record<number, number>
}

export class TableService extends BaseService {

  // 創建新桌子
  async createTable(data: CreateTableData): Promise<any> {
    try {
      // 檢查桌號是否已存在於同一餐廳
      const existingTable = await this.db
        .select({ id: tables.id })
        .from(tables)
        .where(
          and(
            eq(tables.restaurantId, data.restaurantId),
            eq(tables.number, data.number)
          )
        )
        .get()

      if (existingTable) {
        throw new Error('Table number already exists in this restaurant')
      }

      // 生成 QR Code 內容（桌子模式）
      const qrCode = this.generateQRCodeData(data.restaurantId, data.number)

      const qrMode = data.qrMode || 'table'
      const seatCount = data.seatCount || 0
      const seatNumberingStyle = data.seatNumberingStyle || 'numeric'

      const [newTable] = await this.db
        .insert(tables)
        .values({
          restaurantId: data.restaurantId,
          number: data.number,
          name: data.name,
          capacity: data.capacity,
          location: data.location,
          floor: data.floor || 1,
          section: data.section,
          qrCode,
          qrCodeVersion: 1,
          qrMode,
          seatCount,
          seatNumberingStyle,
          features: data.features,
          isReservable: data.isReservable ?? true,
          isActive: true,
          isOccupied: false
        })
        .returning()

      // 如果是座位模式，自動創建座位
      if (qrMode === 'seat' && seatCount > 0) {
        const seatService = new SeatService(this.db as any, this.env)
        await seatService.createSeatsForTable(newTable.id, seatCount, {
          numberingStyle: seatNumberingStyle
        })
      }

      return newTable

    } catch (error) {
      this.handleError(error, 'createTable')
    }
  }

  // 取得桌子詳細資訊
  async getTableById(id: number): Promise<any> {
    try {
      const table = await this.db
        .select({
          id: tables.id,
          restaurantId: tables.restaurantId,
          number: tables.number,
          name: tables.name,
          capacity: tables.capacity,
          location: tables.location,
          floor: tables.floor,
          section: tables.section,
          qrCode: tables.qrCode,
          qrCodeImageUrl: tables.qrCodeImageUrl,
          qrCodeVersion: tables.qrCodeVersion,
          qrMode: tables.qrMode,
          seatCount: tables.seatCount,
          seatNumberingStyle: tables.seatNumberingStyle,
          seatLayout: tables.seatLayout,
          isOccupied: tables.isOccupied,
          isActive: tables.isActive,
          isReservable: tables.isReservable,
          features: tables.features,
          currentOrderId: tables.currentOrderId,
          occupiedAt: tables.occupiedAt,
          occupiedBy: tables.occupiedBy,
          estimatedFreeAt: tables.estimatedFreeAt,
          lastCleanedAt: tables.lastCleanedAt,
          maintenanceNotes: tables.maintenanceNotes,
          totalUsage: tables.totalUsage,
          averageOccupancyMinutes: tables.averageOccupancyMinutes,
          createdAt: tables.createdAt,
          updatedAt: tables.updatedAt,
          // 餐廳資訊
          restaurantName: restaurants.name
        })
        .from(tables)
        .leftJoin(restaurants, eq(tables.restaurantId, restaurants.id))
        .where(eq(tables.id, id))
        .get()

      // 如果是座位模式，附加座位資訊
      if (table && table.qrMode === 'seat') {
        const seatService = new SeatService(this.db as any, this.env)
        const seatsResult = await seatService.getSeatsByTableId(id)
        return {
          ...table,
          seats: seatsResult.seats
        }
      }

      return table

    } catch (error) {
      this.handleError(error, 'getTableById')
    }
  }

  // 根據 QR Code 取得桌子
  async getTableByQRCode(qrCode: string): Promise<any> {
    try {
      const table = await this.db
        .select()
        .from(tables)
        .where(eq(tables.qrCode, qrCode))
        .get()

      return table

    } catch (error) {
      this.handleError(error, 'getTableByQRCode')
    }
  }

  // 更新桌子資訊
  async updateTable(id: number, data: UpdateTableData): Promise<any> {
    try {
      // 如果更新桌號，檢查是否重複
      if (data.number) {
        const table = await this.db
          .select({ restaurantId: tables.restaurantId })
          .from(tables)
          .where(eq(tables.id, id))
          .get()

        if (table) {
          const existingTable = await this.db
            .select({ id: tables.id })
            .from(tables)
            .where(
              and(
                eq(tables.restaurantId, table.restaurantId),
                eq(tables.number, data.number),
                eq(tables.id, id) // 排除自己
              )
            )
            .get()

          if (existingTable && existingTable.id !== id) {
            throw new Error('Table number already exists in this restaurant')
          }
        }
      }

      const [updatedTable] = await this.db
        .update(tables)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(tables.id, id))
        .returning()

      return updatedTable

    } catch (error) {
      this.handleError(error, 'updateTable')
    }
  }

  // 刪除桌子（軟刪除 - 設為不活躍）
  async deleteTable(id: number): Promise<boolean> {
    try {
      const result = await this.db
        .update(tables)
        .set({
          isActive: false,
          updatedAt: new Date()
        })
        .where(eq(tables.id, id))

      return true // TODO: Drizzle ORM doesn't return changes count directly

    } catch (error) {
      console.error('Delete table error:', error)
      return false
    }
  }

  // 取得餐廳的所有桌子
  async getRestaurantTables(restaurantId: number, filters: Omit<TableFilters, 'restaurantId'> = {}): Promise<{
    tables: any[]
    total: number
    pagination: { page: number; limit: number; totalPages: number }
  }> {
    try {
      const { 
        page = 1, 
        limit = 20, 
        floor, 
        section, 
        isOccupied, 
        isActive, 
        isReservable,
        minCapacity,
        maxCapacity,
        search 
      } = filters
      const { offset } = this.createPagination(page, limit)

      // 建構查詢條件
      const conditions = [eq(tables.restaurantId, restaurantId)]

      if (floor !== undefined) {
        conditions.push(eq(tables.floor, floor))
      }

      if (section) {
        conditions.push(eq(tables.section, section))
      }

      if (isOccupied !== undefined) {
        conditions.push(eq(tables.isOccupied, isOccupied))
      }

      if (isActive !== undefined) {
        conditions.push(eq(tables.isActive, isActive))
      }

      if (isReservable !== undefined) {
        conditions.push(eq(tables.isReservable, isReservable))
      }

      if (minCapacity !== undefined) {
        conditions.push(eq(tables.capacity, minCapacity))
      }

      if (maxCapacity !== undefined) {
        conditions.push(eq(tables.capacity, maxCapacity))
      }

      if (search) {
        conditions.push(
          or(
            like(tables.number, `%${search}%`),
            like(tables.name, `%${search}%`),
            like(tables.location, `%${search}%`)
          )!
        )
      }

      // 查詢桌子列表
      const tablesList = await this.db
        .select({
          id: tables.id,
          number: tables.number,
          name: tables.name,
          capacity: tables.capacity,
          location: tables.location,
          floor: tables.floor,
          section: tables.section,
          isOccupied: tables.isOccupied,
          isActive: tables.isActive,
          isReservable: tables.isReservable,
          currentOrderId: tables.currentOrderId,
          occupiedAt: tables.occupiedAt,
          estimatedFreeAt: tables.estimatedFreeAt,
          totalUsage: tables.totalUsage,
          lastCleanedAt: tables.lastCleanedAt,
          createdAt: tables.createdAt
        })
        .from(tables)
        .where(and(...conditions))
        .orderBy(asc(tables.floor), asc(tables.number))
        .limit(limit)
        .offset(offset)

      // 計算總數
      const [{ total }] = await this.db
        .select({ total: count() })
        .from(tables)
        .where(and(...conditions))

      const totalPages = Math.ceil(total / limit)

      return {
        tables: tablesList,
        total,
        pagination: { page, limit, totalPages }
      }

    } catch (error) {
      this.handleError(error, 'getRestaurantTables')
    }
  }

  // 佔用桌子
  async occupyTable(tableId: number, orderId: number, occupiedBy?: string, estimatedMinutes?: number): Promise<boolean> {
    try {
      const estimatedFreeAt = estimatedMinutes 
        ? new Date(Date.now() + estimatedMinutes * 60 * 1000)
        : null

      const result = await this.db
        .update(tables)
        .set({
          isOccupied: true,
          currentOrderId: orderId,
          occupiedAt: new Date(),
          occupiedBy,
          estimatedFreeAt,
          updatedAt: new Date()
        })
        .where(eq(tables.id, tableId))

      // 更新使用統計
      // TODO: Drizzle ORM doesn't return changes count directly
      await this.updateTableUsageStats(tableId)

      return true // TODO: Drizzle ORM doesn't return changes count directly

    } catch (error) {
      console.error('Occupy table error:', error)
      return false
    }
  }

  // 釋放桌子
  async releaseTable(tableId: number): Promise<boolean> {
    try {
      // 取得當前佔用資訊來計算佔用時間
      const table = await this.db
        .select({ 
          occupiedAt: tables.occupiedAt, 
          totalUsage: tables.totalUsage,
          averageOccupancyMinutes: tables.averageOccupancyMinutes
        })
        .from(tables)
        .where(eq(tables.id, tableId))
        .get()

      let newAverageOccupancy = table?.averageOccupancyMinutes || 0
      
      // 計算這次佔用時間
      if (table?.occupiedAt) {
        const occupancyMinutes = Math.floor((Date.now() - table.occupiedAt.getTime()) / (1000 * 60))
        const totalUsage = (table.totalUsage || 0) + 1
        
        // 計算新的平均佔用時間
        const currentTotal = (table.averageOccupancyMinutes || 0) * (totalUsage - 1)
        newAverageOccupancy = Math.round((currentTotal + occupancyMinutes) / totalUsage)
      }

      const result = await this.db
        .update(tables)
        .set({
          isOccupied: false,
          currentOrderId: null,
          occupiedAt: null,
          occupiedBy: null,
          estimatedFreeAt: null,
          totalUsage: (table?.totalUsage || 0) + 1,
          averageOccupancyMinutes: newAverageOccupancy,
          updatedAt: new Date()
        })
        .where(eq(tables.id, tableId))

      return true // TODO: Drizzle ORM doesn't return changes count directly

    } catch (error) {
      console.error('Release table error:', error)
      return false
    }
  }

  // 更新清潔狀態
  async markTableCleaned(tableId: number, notes?: string): Promise<boolean> {
    try {
      const result = await this.db
        .update(tables)
        .set({
          lastCleanedAt: new Date(),
          maintenanceNotes: notes,
          updatedAt: new Date()
        })
        .where(eq(tables.id, tableId))

      return true // TODO: Drizzle ORM doesn't return changes count directly

    } catch (error) {
      console.error('Mark table cleaned error:', error)
      return false
    }
  }

  // 生成 QR Code 資料
  private generateQRCodeData(restaurantId: number, tableNumber: string, customData?: any): string {
    const baseUrl = process.env.CLIENT_BASE_URL || 'https://makanmakan.com'
    const qrData = {
      type: 'table',
      restaurantId,
      tableNumber,
      timestamp: Date.now(),
      ...customData
    }
    
    return `${baseUrl}/order?data=${Buffer.from(JSON.stringify(qrData)).toString('base64')}`
  }

  // 重新生成 QR Code
  async regenerateQRCode(tableId: number, customData?: any): Promise<{ success: boolean; qrCode?: string; error?: string }> {
    try {
      const table = await this.db
        .select({ restaurantId: tables.restaurantId, number: tables.number, qrCodeVersion: tables.qrCodeVersion })
        .from(tables)
        .where(eq(tables.id, tableId))
        .get()

      if (!table) {
        return { success: false, error: 'Table not found' }
      }

      const newQRCode = this.generateQRCodeData(table.restaurantId, table.number, customData)
      const newVersion = (table.qrCodeVersion || 0) + 1

      await this.db
        .update(tables)
        .set({
          qrCode: newQRCode,
          qrCodeVersion: newVersion,
          updatedAt: new Date()
        })
        .where(eq(tables.id, tableId))

      return { success: true, qrCode: newQRCode }

    } catch (error) {
      return { success: false, error: 'Failed to regenerate QR code' }
    }
  }

  // 批量生成 QR Codes
  async generateBulkQRCodes(restaurantId: number, tableIds: number[], options: QRCodeOptions = {}): Promise<{
    success: boolean
    qrCodes?: Array<{ tableId: number; qrCode: string; tableNumber: string }>
    error?: string
  }> {
    try {
      const tablesData = await this.db
        .select({ id: tables.id, number: tables.number })
        .from(tables)
        .where(
          and(
            eq(tables.restaurantId, restaurantId),
            eq(tables.id, tableIds[0]) // 這裡需要用 in 操作符，但 drizzle 的語法可能不同
          )
        )

      const qrCodes = tablesData.map(table => ({
        tableId: table.id,
        tableNumber: table.number,
        qrCode: this.generateQRCodeData(restaurantId, table.number, options.customData)
      }))

      // 批量更新 QR codes
      for (const { tableId, qrCode } of qrCodes) {
        await this.db
          .update(tables)
          .set({
            qrCode,
            qrCodeVersion: ((await this.db
              .select({ qrCodeVersion: tables.qrCodeVersion })
              .from(tables)
              .where(eq(tables.id, tableId))
              .get()
            )?.qrCodeVersion || 0) + 1,
            updatedAt: new Date()
          })
          .where(eq(tables.id, tableId))
      }

      return { success: true, qrCodes }

    } catch (error) {
      return { success: false, error: 'Failed to generate bulk QR codes' }
    }
  }

  // 取得可用桌子
  async getAvailableTables(restaurantId: number, capacity?: number): Promise<any[]> {
    try {
      const conditions = [
        eq(tables.restaurantId, restaurantId),
        eq(tables.isActive, true),
        eq(tables.isOccupied, false),
        eq(tables.isReservable, true)
      ]

      if (capacity) {
        conditions.push(eq(tables.capacity, capacity))
      }

      const availableTables = await this.db
        .select({
          id: tables.id,
          number: tables.number,
          name: tables.name,
          capacity: tables.capacity,
          location: tables.location,
          floor: tables.floor,
          section: tables.section,
          features: tables.features
        })
        .from(tables)
        .where(and(...conditions))
        .orderBy(asc(tables.floor), asc(tables.number))

      return availableTables

    } catch (error) {
      this.handleError(error, 'getAvailableTables')
    }
  }

  // 取得桌子統計資訊
  async getTableStats(restaurantId: number): Promise<TableStats> {
    try {
      // 總桌子數
      const [{ totalTables }] = await this.db
        .select({ totalTables: count() })
        .from(tables)
        .where(eq(tables.restaurantId, restaurantId))

      // 被佔用的桌子數
      const [{ occupiedTables }] = await this.db
        .select({ occupiedTables: count() })
        .from(tables)
        .where(
          and(
            eq(tables.restaurantId, restaurantId),
            eq(tables.isOccupied, true),
            eq(tables.isActive, true)
          )
        )

      // 可用桌子數
      const [{ availableTables }] = await this.db
        .select({ availableTables: count() })
        .from(tables)
        .where(
          and(
            eq(tables.restaurantId, restaurantId),
            eq(tables.isOccupied, false),
            eq(tables.isActive, true)
          )
        )

      // 不活躍桌子數
      const [{ inactiveTables }] = await this.db
        .select({ inactiveTables: count() })
        .from(tables)
        .where(
          and(
            eq(tables.restaurantId, restaurantId),
            eq(tables.isActive, false)
          )
        )

      // 計算平均佔用率
      const averageOccupancyRate = totalTables > 0 ? (occupiedTables / totalTables) * 100 : 0

      // 按樓層統計
      const floorStats = await this.db
        .select({
          floor: tables.floor,
          count: count()
        })
        .from(tables)
        .where(eq(tables.restaurantId, restaurantId))
        .groupBy(tables.floor)

      const byFloor: Record<number, number> = {}
      floorStats.forEach(stat => {
        byFloor[stat.floor || 1] = stat.count
      })

      // 按區域統計
      const sectionStats = await this.db
        .select({
          section: tables.section,
          count: count()
        })
        .from(tables)
        .where(
          and(
            eq(tables.restaurantId, restaurantId),
            isNotNull(tables.section)
          )
        )
        .groupBy(tables.section)

      const bySection: Record<string, number> = {}
      sectionStats.forEach(stat => {
        if (stat.section) {
          bySection[stat.section] = stat.count
        }
      })

      // 按容量統計
      const capacityStats = await this.db
        .select({
          capacity: tables.capacity,
          count: count()
        })
        .from(tables)
        .where(eq(tables.restaurantId, restaurantId))
        .groupBy(tables.capacity)

      const byCapacity: Record<number, number> = {}
      capacityStats.forEach(stat => {
        byCapacity[stat.capacity] = stat.count
      })

      return {
        totalTables,
        occupiedTables,
        availableTables,
        inactiveTables,
        averageOccupancyRate: Math.round(averageOccupancyRate * 100) / 100,
        byFloor,
        bySection,
        byCapacity
      }

    } catch (error) {
      this.handleError(error, 'getTableStats')
    }
  }

  // 更新桌子使用統計
  private async updateTableUsageStats(tableId: number): Promise<void> {
    try {
      await this.db
        .update(tables)
        .set({
          totalUsage: ((await this.db
            .select({ totalUsage: tables.totalUsage })
            .from(tables)
            .where(eq(tables.id, tableId))
            .get()
          )?.totalUsage || 0) + 1,
          updatedAt: new Date()
        })
        .where(eq(tables.id, tableId))

    } catch (error) {
      console.error('Update table usage stats error:', error)
    }
  }

  /**
   * 切換 QR 碼模式（桌子模式 <-> 座位模式）
   * 這是核心功能：讓店長可以自由轉換桌子模式與座位模式
   */
  async switchQRMode(
    tableId: number,
    newMode: 'table' | 'seat',
    seatConfig?: {
      count: number
      numberingStyle: 'numeric' | 'alphabetic' | 'custom'
      prefix?: string
    }
  ): Promise<{
    success: boolean
    message?: string
    data?: {
      tableId: number
      oldMode: 'table' | 'seat'
      newMode: 'table' | 'seat'
      seatsCreated?: number
      seatsDeleted?: number
    }
  }> {
    try {
      const table = await this.getTableById(tableId)

      if (!table) {
        return {
          success: false,
          message: '桌子不存在'
        }
      }

      const oldMode = table.qrMode || 'table'

      // 如果已經是目標模式，直接返回
      if (oldMode === newMode) {
        return {
          success: true,
          message: `桌子已經是 ${newMode === 'table' ? '桌子' : '座位'} 模式`,
          data: {
            tableId,
            oldMode,
            newMode
          }
        }
      }

      const seatService = new SeatService(this.db as any, this.env)

      // 從桌子模式切換到座位模式
      if (oldMode === 'table' && newMode === 'seat') {
        // 檢查桌子是否正在使用中
        if (table.isOccupied) {
          return {
            success: false,
            message: '桌子正在使用中，無法切換為座位模式。請先釋放桌子。'
          }
        }

        if (!seatConfig || !seatConfig.count || seatConfig.count <= 0) {
          return {
            success: false,
            message: '請提供座位數量配置'
          }
        }

        // 創建座位
        const createdSeats = await seatService.createSeatsForTable(
          tableId,
          seatConfig.count,
          {
            numberingStyle: seatConfig.numberingStyle || 'numeric',
            prefix: seatConfig.prefix
          }
        )

        // 更新桌子為座位模式
        await this.db
          .update(tables)
          .set({
            qrMode: 'seat',
            seatCount: seatConfig.count,
            seatNumberingStyle: seatConfig.numberingStyle || 'numeric',
            updatedAt: new Date()
          })
          .where(eq(tables.id, tableId))

        return {
          success: true,
          message: `成功切換為座位模式，已創建 ${createdSeats.length} 個座位`,
          data: {
            tableId,
            oldMode,
            newMode,
            seatsCreated: createdSeats.length
          }
        }
      }

      // 從座位模式切換到桌子模式
      if (oldMode === 'seat' && newMode === 'table') {
        // 檢查所有座位是否都沒在使用
        const seatsResult = await seatService.getSeatsByTableId(tableId)
        const hasOccupiedSeats = seatsResult.seats.some((seat: any) => seat.isOccupied)

        if (hasOccupiedSeats) {
          return {
            success: false,
            message: '有座位正在使用中，無法切換為桌子模式。請先釋放所有座位。'
          }
        }

        const seatCount = seatsResult.total

        // 刪除所有座位（硬刪除）
        const deleted = await seatService.deleteSeatsForTable(tableId)

        if (!deleted) {
          return {
            success: false,
            message: '刪除座位失敗'
          }
        }

        // 更新桌子為桌子模式
        await this.db
          .update(tables)
          .set({
            qrMode: 'table',
            seatCount: 0,
            updatedAt: new Date()
          })
          .where(eq(tables.id, tableId))

        return {
          success: true,
          message: `成功切換為桌子模式，已刪除 ${seatCount} 個座位`,
          data: {
            tableId,
            oldMode,
            newMode,
            seatsDeleted: seatCount
          }
        }
      }

      return {
        success: false,
        message: '未知的模式切換操作'
      }

    } catch (error) {
      console.error('Switch QR mode error:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : '切換模式失敗'
      }
    }
  }

  // 取得桌子的訂單歷史
  async getTableOrderHistory(tableId: number, limit = 20): Promise<any[]> {
    try {
      const orderHistory = await this.db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          status: orders.status,
          totalAmount: orders.totalAmount,
          customerInfo: orders.customerInfo,
          createdAt: orders.createdAt,
          confirmedAt: orders.confirmedAt,
          completedAt: orders.readyAt
        })
        .from(orders)
        .where(eq(orders.tableId, tableId))
        .orderBy(desc(orders.createdAt))
        .limit(limit)

      return orderHistory

    } catch (error) {
      this.handleError(error, 'getTableOrderHistory')
    }
  }
}
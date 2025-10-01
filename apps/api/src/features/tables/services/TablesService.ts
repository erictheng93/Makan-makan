/**
 * Tables Service
 *
 * Business logic service for table management operations
 */

import { TableService } from '@makanmakan/database'
import type { Env } from '../../../types/env'
import type {
  Table,
  CreateTableData,
  UpdateTableData,
  TableFilters,
  TableStats,
  TableListResult,
  ServiceResponse,
  QRRegenerateResult,
  BulkQRResult,
  QRCodeOptions
} from '../types'

export class TablesService {
  private tableService: TableService
  private env: Env

  constructor(env: Env) {
    this.env = env
    this.tableService = new TableService(env.DB as any, env)
  }

  /**
   * Get tables for a restaurant with filtering and pagination
   */
  async getRestaurantTables(
    restaurantId: number,
    filters: Omit<TableFilters, 'restaurantId'>
  ): Promise<TableListResult> {
    try {
      const result = await this.tableService.getRestaurantTables(restaurantId, filters)
      return {
        tables: result.tables,
        pagination: {
          ...result.pagination,
          total: result.total,
          hasNext: result.pagination.page < result.pagination.totalPages,
          hasPrev: result.pagination.page > 1
        }
      }
    } catch (error) {
      console.error('TablesService.getRestaurantTables error:', error)
      throw new Error('Failed to fetch restaurant tables')
    }
  }

  /**
   * Get a single table by ID
   */
  async getTableById(id: number): Promise<Table | null> {
    try {
      const table = await this.tableService.getTableById(id)
      return table
    } catch (error) {
      console.error('TablesService.getTableById error:', error)
      throw new Error('Failed to fetch table')
    }
  }

  /**
   * Create a new table
   */
  async createTable(data: CreateTableData): Promise<Table> {
    try {
      const newTable = await this.tableService.createTable(data)
      return newTable
    } catch (error) {
      console.error('TablesService.createTable error:', error)
      throw new Error('Failed to create table')
    }
  }

  /**
   * Update an existing table
   */
  async updateTable(id: number, data: UpdateTableData): Promise<Table> {
    try {
      const updatedTable = await this.tableService.updateTable(id, data)
      return updatedTable
    } catch (error) {
      console.error('TablesService.updateTable error:', error)
      throw new Error('Failed to update table')
    }
  }

  /**
   * Delete a table
   */
  async deleteTable(id: number): Promise<boolean> {
    try {
      const success = await this.tableService.deleteTable(id)
      return success
    } catch (error) {
      console.error('TablesService.deleteTable error:', error)
      throw new Error('Failed to delete table')
    }
  }

  /**
   * Occupy a table with an order
   */
  async occupyTable(
    id: number,
    orderId: number,
    occupiedBy?: string,
    estimatedMinutes?: number
  ): Promise<boolean> {
    try {
      const success = await this.tableService.occupyTable(id, orderId, occupiedBy, estimatedMinutes)
      return success
    } catch (error) {
      console.error('TablesService.occupyTable error:', error)
      throw new Error('Failed to occupy table')
    }
  }

  /**
   * Release a table (mark as unoccupied)
   */
  async releaseTable(id: number): Promise<boolean> {
    try {
      const success = await this.tableService.releaseTable(id)
      return success
    } catch (error) {
      console.error('TablesService.releaseTable error:', error)
      throw new Error('Failed to release table')
    }
  }

  /**
   * Mark table as cleaned
   */
  async markTableCleaned(id: number, notes?: string): Promise<boolean> {
    try {
      const success = await this.tableService.markTableCleaned(id, notes)
      return success
    } catch (error) {
      console.error('TablesService.markTableCleaned error:', error)
      throw new Error('Failed to mark table as cleaned')
    }
  }

  /**
   * Regenerate QR code for a table
   */
  async regenerateQRCode(id: number, customData?: any): Promise<QRRegenerateResult> {
    try {
      const result = await this.tableService.regenerateQRCode(id, customData)
      return result
    } catch (error) {
      console.error('TablesService.regenerateQRCode error:', error)
      return {
        success: false,
        error: 'Failed to regenerate QR code'
      }
    }
  }

  /**
   * Generate QR codes for multiple tables
   */
  async generateBulkQRCodes(
    restaurantId: number,
    tableIds: number[],
    options?: QRCodeOptions
  ): Promise<BulkQRResult> {
    try {
      const result = await this.tableService.generateBulkQRCodes(restaurantId, tableIds, options)
      if (result.success && result.qrCodes) {
        return {
          success: true,
          qrCodes: result.qrCodes.map(qr => ({
            tableId: qr.tableId,
            qrCode: qr.qrCode,
            url: qr.qrCode, // Using qrCode as URL for now
            format: options?.format || 'png',
            size: options?.size || 'medium'
          }))
        }
      }
      return {
        success: false,
        error: result.error || 'Failed to generate QR codes'
      }
    } catch (error) {
      console.error('TablesService.generateBulkQRCodes error:', error)
      return {
        success: false,
        error: 'Failed to generate bulk QR codes'
      }
    }
  }

  /**
   * Get available tables for a restaurant
   */
  async getAvailableTables(restaurantId: number, capacity?: number): Promise<Table[]> {
    try {
      const availableTables = await this.tableService.getAvailableTables(restaurantId, capacity)
      return availableTables
    } catch (error) {
      console.error('TablesService.getAvailableTables error:', error)
      throw new Error('Failed to fetch available tables')
    }
  }

  /**
   * Get table statistics for a restaurant
   */
  async getTableStats(restaurantId: number): Promise<TableStats> {
    try {
      const stats = await this.tableService.getTableStats(restaurantId)
      // Adapt database stats to feature stats format
      return {
        total: stats.totalTables,
        occupied: stats.occupiedTables,
        available: stats.availableTables,
        outOfService: stats.inactiveTables,
        avgOccupancyTime: 0, // TODO: calculate from database
        totalCapacity: 0, // TODO: calculate from database
        utilizationRate: stats.averageOccupancyRate,
        floorDistribution: Object.entries(stats.byFloor).map(([floor, total]) => ({
          floor: parseInt(floor),
          total,
          occupied: 0 // TODO: get occupied count by floor
        }))
      }
    } catch (error) {
      console.error('TablesService.getTableStats error:', error)
      throw new Error('Failed to fetch table statistics')
    }
  }

  /**
   * Get table information by QR code
   */
  async getTableByQRCode(qrCode: string): Promise<Table | null> {
    try {
      const table = await this.tableService.getTableByQRCode(qrCode)
      return table
    } catch (error) {
      console.error('TablesService.getTableByQRCode error:', error)
      throw new Error('Failed to fetch table by QR code')
    }
  }

  /**
   * Validate table access permissions
   */
  validateTableAccess(table: Table, userRestaurantId: number, isAdmin: boolean): boolean {
    if (isAdmin) {
      return true
    }
    return table.restaurantId === userRestaurantId
  }

  /**
   * Validate restaurant access permissions
   */
  validateRestaurantAccess(restaurantId: number, userRestaurantId: number, isAdmin: boolean): boolean {
    if (isAdmin) {
      return true
    }
    return restaurantId === userRestaurantId
  }

  /**
   * Get public table information (for QR code access)
   */
  getPublicTableInfo(table: Table) {
    return {
      id: table.id,
      restaurantId: table.restaurantId,
      number: table.number,
      name: table.name,
      capacity: table.capacity,
      location: table.location,
      floor: table.floor,
      section: table.section,
      features: table.features,
      isActive: table.isActive,
      isOccupied: table.isOccupied
    }
  }

  /**
   * Create success response helper
   */
  createSuccessResponse<T>(data: T, message?: string): ServiceResponse<T> {
    return {
      success: true,
      data,
      message
    }
  }

  /**
   * Create error response helper
   */
  createErrorResponse(error: string): ServiceResponse {
    return {
      success: false,
      error
    }
  }
}
/**
 * 收銀機管理服務
 */

import { BaseService } from '../../../shared/services/BaseService'
import { getCurrentTimestamp } from '@makanmakan/database'
import type {
  CashRegister,
  CreateRegisterRequest
} from '../types'
import { createRegisterSchema } from '../schemas'

export class RegisterService extends BaseService {
  constructor(db: any) {
    super(db)
  }

  /**
   * 創建收銀機
   */
  async createRegister(
    data: CreateRegisterRequest,
    _createdBy: number
  ): Promise<{ success: boolean; data?: CashRegister; error?: string }> {
    try {
      const validatedData = createRegisterSchema.parse(data)
      const registerId = crypto.randomUUID()
      const now = getCurrentTimestamp()

      await this.d1.prepare(`
        INSERT INTO cash_registers (
          id, name, location, restaurant_id, is_active,
          hardware_config, peripherals, settings, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
      `).bind(
        registerId,
        validatedData.name,
        validatedData.location || null,
        validatedData.restaurantId,
        JSON.stringify(validatedData.hardwareConfig || {}),
        JSON.stringify(validatedData.peripherals || {}),
        JSON.stringify(validatedData.settings || {}),
        now,
        now
      ).run()

      const register = await this.d1.prepare(
        'SELECT * FROM cash_registers WHERE id = ?'
      ).bind(registerId).first() as any

      return {
        success: true,
        data: {
          ...register,
          hardwareConfig: JSON.parse(register.hardware_config || '{}'),
          peripherals: JSON.parse(register.peripherals || '{}'),
          settings: JSON.parse(register.settings || '{}')
        }
      }

    } catch (error) {
      console.error('創建收銀機失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '創建收銀機失敗'
      }
    }
  }

  /**
   * 獲取收銀機列表
   */
  async getRegisters(
    restaurantId: string
  ): Promise<{ success: boolean; data?: CashRegister[]; error?: string }> {
    try {
      const result = await this.d1.prepare(`
        SELECT cr.*, cs.id as current_shift_status
        FROM cash_registers cr
        LEFT JOIN cash_shifts cs ON cr.current_shift_id = cs.id AND cs.status = 'active'
        WHERE cr.restaurant_id = ?
        ORDER BY cr.name
      `).bind(restaurantId).all()

      const registers = (result.results || []).map((register: any) => ({
        ...register,
        hardwareConfig: JSON.parse(register.hardware_config || '{}'),
        peripherals: JSON.parse(register.peripherals || '{}'),
        settings: JSON.parse(register.settings || '{}')
      })) as CashRegister[]

      return {
        success: true,
        data: registers
      }

    } catch (error) {
      console.error('獲取收銀機列表失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '獲取收銀機列表失敗'
      }
    }
  }

  /**
   * 獲取收銀機狀態
   */
  async getRegisterStatus(
    registerId: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const status = await this.d1.prepare(`
        SELECT
          cr.*,
          cs.id as current_shift_id,
          cs.operator_id,
          cs.started_at as shift_started,
          cs.start_amount,
          cs.total_sales,
          cs.total_transactions,
          u.full_name as operator_name
        FROM cash_registers cr
        LEFT JOIN cash_shifts cs ON cr.current_shift_id = cs.id AND cs.status = 'active'
        LEFT JOIN users u ON cs.operator_id = u.id
        WHERE cr.id = ?
      `).bind(registerId).first()

      if (!status) {
        return {
          success: false,
          error: '收銀機不存在'
        }
      }

      return {
        success: true,
        data: {
          ...status,
          hardwareConfig: JSON.parse(status.hardware_config || '{}'),
          peripherals: JSON.parse(status.peripherals || '{}'),
          settings: JSON.parse(status.settings || '{}'),
          isShiftActive: !!status.current_shift_id
        }
      }

    } catch (error) {
      console.error('獲取收銀機狀態失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '獲取收銀機狀態失敗'
      }
    }
  }

  /**
   * 更新收銀機設定
   */
  async updateRegister(
    registerId: string,
    data: Partial<CreateRegisterRequest>
  ): Promise<{ success: boolean; data?: CashRegister; error?: string }> {
    try {
      const updateFields: string[] = []
      const updateValues: any[] = []

      if (data.name) {
        updateFields.push('name = ?')
        updateValues.push(data.name)
      }

      if (data.location !== undefined) {
        updateFields.push('location = ?')
        updateValues.push(data.location)
      }

      if (data.hardwareConfig) {
        updateFields.push('hardware_config = ?')
        updateValues.push(JSON.stringify(data.hardwareConfig))
      }

      if (data.peripherals) {
        updateFields.push('peripherals = ?')
        updateValues.push(JSON.stringify(data.peripherals))
      }

      if (data.settings) {
        updateFields.push('settings = ?')
        updateValues.push(JSON.stringify(data.settings))
      }

      if (updateFields.length === 0) {
        return {
          success: false,
          error: '沒有需要更新的欄位'
        }
      }

      const now = getCurrentTimestamp()
      updateFields.push('updated_at = ?')
      updateValues.push(now)
      updateValues.push(registerId)

      await this.d1.prepare(`
        UPDATE cash_registers
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `).bind(...updateValues).run()

      const updatedRegister = await this.d1.prepare(
        'SELECT * FROM cash_registers WHERE id = ?'
      ).bind(registerId).first() as any

      return {
        success: true,
        data: {
          ...updatedRegister,
          hardwareConfig: JSON.parse(updatedRegister.hardware_config || '{}'),
          peripherals: JSON.parse(updatedRegister.peripherals || '{}'),
          settings: JSON.parse(updatedRegister.settings || '{}')
        }
      }

    } catch (error) {
      console.error('更新收銀機失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '更新收銀機失敗'
      }
    }
  }

  /**
   * 啟用/停用收銀機
   */
  async toggleRegisterStatus(
    registerId: string,
    isActive: boolean
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const now = getCurrentTimestamp()
      await this.d1.prepare(`
        UPDATE cash_registers
        SET is_active = ?, updated_at = ?
        WHERE id = ?
      `).bind(isActive ? 1 : 0, now, registerId).run()

      return { success: true }

    } catch (error) {
      console.error('切換收銀機狀態失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '切換收銀機狀態失敗'
      }
    }
  }

  /**
   * 刪除收銀機
   */
  async deleteRegister(
    registerId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 檢查是否有活躍班次
      const activeShift = await this.d1.prepare(
        'SELECT id FROM cash_shifts WHERE register_id = ? AND status = "active"'
      ).bind(registerId).first()

      if (activeShift) {
        return {
          success: false,
          error: '無法刪除有活躍班次的收銀機'
        }
      }

      await this.d1.prepare(
        'DELETE FROM cash_registers WHERE id = ?'
      ).bind(registerId).run()

      return { success: true }

    } catch (error) {
      console.error('刪除收銀機失敗:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '刪除收銀機失敗'
      }
    }
  }
}
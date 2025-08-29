import type { ApiResponse } from '@/types'

interface OwnerDashboardData {
  today_overview: {
    total_orders: number
    completed_orders: number
    total_revenue: number
    avg_order_value: number
    unique_customers: number
  }
  staff_status: {
    total_staff: number
    online_staff: number
    avg_chef_efficiency: number
    avg_service_efficiency: number
  }
  system_health: Array<{
    name: string
    status: string
    uptime: string
  }>
  emergency_alerts: Array<{
    id: number
    title: string
    description: string
    severity: string
    created_at: string
  }>
  popular_items: Array<{
    name: string
    sales_count: number
    revenue: number
  }>
}

interface FinancialReportData {
  period: string
  revenue_summary: {
    total_orders: number
    gross_revenue: number
    total_tax: number
    net_revenue: number
    avg_order_value: number
  }
  payment_methods: Array<{
    payment_method: string
    order_count: number
    total_amount: number
  }>
  refund_stats: {
    refund_count: number
    total_refunded: number
  }
}

interface RealtimeOrder {
  id: number
  order_number: string
  status: string
  total: number
  customer_name?: string
  table_id?: number
  order_type: string
  created_at: string
  elapsed_minutes: number
}

interface StaffActivity {
  id: number
  name: string
  role: string
  status: 'online' | 'busy' | 'offline'
  performance: number
}

class OwnerService {
  private baseURL = '/api/v1'

  async getDashboardData(restaurantId?: number): Promise<OwnerDashboardData> {
    try {
      const params = new URLSearchParams()
      if (restaurantId) {
        params.append('restaurantId', restaurantId.toString())
      }
      
      const response = await fetch(`${this.baseURL}/analytics/owner-dashboard?${params}`)
      const result: ApiResponse<OwnerDashboardData> = await response.json()
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch dashboard data')
      }
      
      return result.data!
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      throw error
    }
  }

  async getFinancialReport(options: {
    restaurantId?: number
    period?: 'daily' | 'weekly' | 'monthly' | 'yearly'
    year?: string
    month?: string
  } = {}): Promise<FinancialReportData> {
    try {
      const params = new URLSearchParams()
      if (options.restaurantId) {
        params.append('restaurantId', options.restaurantId.toString())
      }
      if (options.period) {
        params.append('period', options.period)
      }
      if (options.year) {
        params.append('year', options.year)
      }
      if (options.month) {
        params.append('month', options.month)
      }
      
      const response = await fetch(`${this.baseURL}/analytics/financial-report?${params}`)
      const result: ApiResponse<FinancialReportData> = await response.json()
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch financial report')
      }
      
      return result.data!
    } catch (error) {
      console.error('Error fetching financial report:', error)
      throw error
    }
  }

  async getRealtimeOrders(restaurantId?: number): Promise<RealtimeOrder[]> {
    try {
      const params = new URLSearchParams()
      if (restaurantId) {
        params.append('restaurantId', restaurantId.toString())
      }
      
      const response = await fetch(`${this.baseURL}/analytics/realtime-dashboard?${params}`)
      const result: ApiResponse<any> = await response.json()
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to fetch realtime orders')
      }
      
      return result.data?.active_orders || []
    } catch (error) {
      console.error('Error fetching realtime orders:', error)
      throw error
    }
  }

  async getStaffActivity(restaurantId?: number): Promise<StaffActivity[]> {
    try {
      // 模擬員工活動數據，實際應該從 API 獲取
      return [
        { id: 1, name: '張小明', role: '廚師', status: 'online', performance: 98 },
        { id: 2, name: '李美華', role: '送菜員', status: 'busy', performance: 95 },
        { id: 3, name: '王大偉', role: '收銀員', status: 'online', performance: 92 },
        { id: 4, name: '陳小芳', role: '廚師', status: 'offline', performance: 88 }
      ]
    } catch (error) {
      console.error('Error fetching staff activity:', error)
      throw error
    }
  }

  async handleQuickAction(action: string): Promise<void> {
    try {
      console.log('Executing quick action:', action)
      
      switch (action) {
        case 'add-staff':
          // 跳轉到員工管理頁面或打開新增員工彈窗
          window.location.href = '/dashboard/users'
          break
        case 'update-menu':
          // 跳轉到菜單管理頁面
          window.location.href = '/dashboard/menu'
          break
        case 'view-reports':
          // 跳轉到報表頁面
          window.location.href = '/dashboard/analytics'
          break
        case 'system-settings':
          // 跳轉到系統設定頁面
          window.location.href = '/dashboard/settings'
          break
        case 'send-notification':
          // 打開通知發送介面
          this.showNotificationDialog()
          break
        case 'emergency':
          // 處理緊急狀況
          this.handleEmergency()
          break
        default:
          console.log('Unknown action:', action)
      }
    } catch (error) {
      console.error('Error handling quick action:', error)
      throw error
    }
  }

  private showNotificationDialog(): void {
    // 實現通知發送對話框
    alert('通知發送功能將在此實現')
  }

  private handleEmergency(): void {
    // 實現緊急處理功能
    alert('緊急處理功能將在此實現')
  }

  async resolveEmergencyAlert(alertId: number): Promise<void> {
    try {
      const response = await fetch(`${this.baseURL}/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to resolve alert')
      }
      
      console.log('Emergency alert resolved:', alertId)
    } catch (error) {
      console.error('Error resolving emergency alert:', error)
      throw error
    }
  }

  async escalateEmergencyAlert(alertId: number): Promise<void> {
    try {
      const response = await fetch(`${this.baseURL}/alerts/${alertId}/escalate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to escalate alert')
      }
      
      console.log('Emergency alert escalated:', alertId)
    } catch (error) {
      console.error('Error escalating emergency alert:', error)
      throw error
    }
  }

  // 緩存管理
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>()

  private getCachedData<T>(key: string): T | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data
    }
    return null
  }

  private setCachedData<T>(key: string, data: T, ttl: number = 60000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  async getDashboardDataCached(restaurantId?: number): Promise<OwnerDashboardData> {
    const cacheKey = `dashboard-${restaurantId || 'all'}`
    const cached = this.getCachedData<OwnerDashboardData>(cacheKey)
    
    if (cached) {
      return cached
    }
    
    const data = await this.getDashboardData(restaurantId)
    this.setCachedData(cacheKey, data, 30000) // 30秒緩存
    return data
  }

  clearCache(): void {
    this.cache.clear()
  }
}

export const ownerService = new OwnerService()
export default ownerService
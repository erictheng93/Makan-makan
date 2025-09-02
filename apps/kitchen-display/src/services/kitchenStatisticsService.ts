// Comprehensive kitchen statistics and analytics service
import { ref, reactive } from 'vue'
import { useOrderManagementStore } from '@/stores/orderManagement'
import type { KitchenOrder } from '@/types'

export interface TimeRange {
  start: Date
  end: Date
  label: string
}

export interface OrderStatistics {
  totalOrders: number
  completedOrders: number
  pendingOrders: number
  cookingOrders: number
  averageCookingTime: number
  averageWaitTime: number
  completionRate: number
  orderTrends: Array<{
    time: string
    orders: number
    completed: number
  }>
}

export interface PerformanceMetrics {
  efficiency: number // percentage
  averageOrderValue: number
  ordersPerHour: number
  peakHours: string[]
  slowestItems: Array<{
    name: string
    avgTime: number
    count: number
  }>
  fastestItems: Array<{
    name: string
    avgTime: number
    count: number
  }>
}

export interface ChefPerformance {
  chefId: string
  name: string
  ordersCompleted: number
  averageCookTime: number
  efficiency: number
  specialties: string[]
  workload: number
}

export interface ItemAnalytics {
  itemName: string
  orderCount: number
  averageCookTime: number
  successRate: number
  popularityTrend: 'up' | 'down' | 'stable'
  revenueContribution: number
}

export interface CustomerSatisfaction {
  averageRating: number
  complaintRate: number
  repeatCustomerRate: number
  satisfactionTrends: Array<{
    date: string
    rating: number
  }>
}

export interface KitchenStats {
  orders: OrderStatistics
  performance: PerformanceMetrics
  chefs: ChefPerformance[]
  items: ItemAnalytics[]
  customer: CustomerSatisfaction
  realTime: {
    activeOrders: number
    waitingTime: number
    systemLoad: number
    lastUpdate: Date
  }
}

class KitchenStatisticsService {
  private orderStore = useOrderManagementStore()
  
  // Reactive state
  public timeRange = ref<TimeRange>({
    start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    end: new Date(),
    label: '最近 24 小時'
  })
  
  public isLoading = ref(false)
  public lastUpdated = ref<Date>(new Date())
  public autoRefresh = ref(true)
  
  // Cached statistics
  private cachedStats = reactive<KitchenStats>({
    orders: {
      totalOrders: 0,
      completedOrders: 0,
      pendingOrders: 0,
      cookingOrders: 0,
      averageCookingTime: 0,
      averageWaitTime: 0,
      completionRate: 0,
      orderTrends: []
    },
    performance: {
      efficiency: 0,
      averageOrderValue: 0,
      ordersPerHour: 0,
      peakHours: [],
      slowestItems: [],
      fastestItems: []
    },
    chefs: [],
    items: [],
    customer: {
      averageRating: 0,
      complaintRate: 0,
      repeatCustomerRate: 0,
      satisfactionTrends: []
    },
    realTime: {
      activeOrders: 0,
      waitingTime: 0,
      systemLoad: 0,
      lastUpdate: new Date()
    }
  })
  
  private updateInterval: NodeJS.Timeout | null = null

  constructor() {
    this.startAutoRefresh()
  }

  // Main statistics computation
  public async computeStatistics(): Promise<KitchenStats> {
    this.isLoading.value = true
    
    try {
      const orders = this.getOrdersInRange()
      
      // Compute all statistics
      const orderStats = this.computeOrderStatistics(orders)
      const performanceMetrics = this.computePerformanceMetrics(orders)
      const chefPerformance = this.computeChefPerformance(orders)
      const itemAnalytics = this.computeItemAnalytics(orders)
      const customerSatisfaction = this.computeCustomerSatisfaction(orders)
      const realTimeStats = this.computeRealTimeStats()
      
      // Update cached stats
      Object.assign(this.cachedStats, {
        orders: orderStats,
        performance: performanceMetrics,
        chefs: chefPerformance,
        items: itemAnalytics,
        customer: customerSatisfaction,
        realTime: realTimeStats
      })
      
      this.lastUpdated.value = new Date()
      
      return this.cachedStats
    } catch (error) {
      console.error('Failed to compute statistics:', error)
      throw error
    } finally {
      this.isLoading.value = false
    }
  }

  // Order statistics
  private computeOrderStatistics(orders: KitchenOrder[]): OrderStatistics {
    const total = orders.length
    const completed = orders.filter(o => o.status >= 3).length
    const pending = orders.filter(o => o.status === 1).length
    const cooking = orders.filter(o => o.status === 2).length
    
    const cookingTimes = orders
      .filter(o => o.status >= 3 && o.elapsedTime)
      .map(o => o.elapsedTime)
    
    const avgCookingTime = cookingTimes.length > 0
      ? cookingTimes.reduce((sum, time) => sum + time, 0) / cookingTimes.length
      : 0
    
    const waitTimes = orders
      .filter(o => o.status >= 2)
      .map(o => this.calculateWaitTime(o))
    
    const avgWaitTime = waitTimes.length > 0
      ? waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length
      : 0
    
    const completionRate = total > 0 ? (completed / total) * 100 : 0
    
    const trends = this.generateOrderTrends(orders)
    
    return {
      totalOrders: total,
      completedOrders: completed,
      pendingOrders: pending,
      cookingOrders: cooking,
      averageCookingTime: Math.round(avgCookingTime),
      averageWaitTime: Math.round(avgWaitTime),
      completionRate: Math.round(completionRate * 100) / 100,
      orderTrends: trends
    }
  }

  // Performance metrics
  private computePerformanceMetrics(orders: KitchenOrder[]): PerformanceMetrics {
    const completedOrders = orders.filter(o => o.status >= 3)
    
    // Efficiency: completed orders vs total orders with consideration of time
    const efficiency = this.calculateEfficiency(completedOrders, orders)
    
    // Average order value
    const totalValue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
    const avgOrderValue = orders.length > 0 ? totalValue / orders.length : 0
    
    // Orders per hour
    const timeSpanHours = (this.timeRange.value.end.getTime() - this.timeRange.value.start.getTime()) / (1000 * 60 * 60)
    const ordersPerHour = timeSpanHours > 0 ? orders.length / timeSpanHours : 0
    
    // Peak hours analysis
    const peakHours = this.identifyPeakHours(orders)
    
    // Item speed analysis
    const itemTimes = this.analyzeItemCookingTimes(orders)
    const sortedItems = Object.entries(itemTimes)
      .map(([name, data]) => ({
        name,
        avgTime: data.totalTime / data.count,
        count: data.count
      }))
      .filter(item => item.count >= 3) // Only items with enough data
    
    const slowestItems = sortedItems
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 5)
    
    const fastestItems = sortedItems
      .sort((a, b) => a.avgTime - b.avgTime)
      .slice(0, 5)
    
    return {
      efficiency,
      averageOrderValue: Math.round(avgOrderValue * 100) / 100,
      ordersPerHour: Math.round(ordersPerHour * 100) / 100,
      peakHours,
      slowestItems,
      fastestItems
    }
  }

  // Chef performance analysis
  private computeChefPerformance(orders: KitchenOrder[]): ChefPerformance[] {
    const chefStats = new Map<string, {
      ordersCompleted: number
      totalCookTime: number
      items: string[]
    }>()
    
    orders
      .filter(o => o.assignedChef && o.status >= 3)
      .forEach(order => {
        const chefId = String(order.assignedChef!)
        const existing = chefStats.get(chefId) || {
          ordersCompleted: 0,
          totalCookTime: 0,
          items: []
        }
        
        existing.ordersCompleted++
        existing.totalCookTime += order.elapsedTime || 0
        existing.items.push(...order.items.map(item => item.name))
        
        chefStats.set(chefId, existing)
      })
    
    return Array.from(chefStats.entries()).map(([chefId, stats]) => {
      const avgCookTime = stats.ordersCompleted > 0
        ? stats.totalCookTime / stats.ordersCompleted
        : 0
      
      // Calculate efficiency based on average cook time vs expected time
      const efficiency = this.calculateChefEfficiency(avgCookTime, stats.ordersCompleted)
      
      // Find specialties (most common items)
      const itemCounts: Record<string, number> = {}
      stats.items.forEach(item => {
        itemCounts[item] = (itemCounts[item] || 0) + 1
      })
      
      const specialties = Object.entries(itemCounts)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 3)
        .map(([item]) => item)
      
      return {
        chefId,
        name: this.getChefName(chefId),
        ordersCompleted: stats.ordersCompleted,
        averageCookTime: Math.round(avgCookTime),
        efficiency: Math.round(efficiency * 100) / 100,
        specialties,
        workload: this.calculateWorkload(chefId)
      }
    }).sort((a, b) => b.efficiency - a.efficiency)
  }

  // Item analytics
  private computeItemAnalytics(orders: KitchenOrder[]): ItemAnalytics[] {
    const itemStats = new Map<string, {
      count: number
      totalCookTime: number
      successfulOrders: number
      revenue: number
    }>()
    
    orders.forEach(order => {
      order.items.forEach(item => {
        const existing = itemStats.get(item.name) || {
          count: 0,
          totalCookTime: 0,
          successfulOrders: 0,
          revenue: 0
        }
        
        existing.count++
        existing.totalCookTime += item.cookingTime || 0
        
        if (order.status >= 3) {
          existing.successfulOrders++
        }
        
        existing.revenue += (item.price || 0)
        
        itemStats.set(item.name, existing)
      })
    })
    
    return Array.from(itemStats.entries())
      .map(([itemName, stats]) => ({
        itemName,
        orderCount: stats.count,
        averageCookTime: Math.round(stats.totalCookTime / stats.count),
        successRate: Math.round((stats.successfulOrders / stats.count) * 10000) / 100,
        popularityTrend: this.calculatePopularityTrend(itemName),
        revenueContribution: Math.round(stats.revenue * 100) / 100
      }))
      .sort((a, b) => b.orderCount - a.orderCount)
  }

  // Customer satisfaction metrics
  private computeCustomerSatisfaction(orders: KitchenOrder[]): CustomerSatisfaction {
    // This would typically come from customer feedback data
    // For now, we'll simulate based on order completion times and other factors
    
    const completedOrders = orders.filter(o => o.status >= 3)
    
    // Simulate satisfaction based on wait times
    const avgSatisfaction = completedOrders.length > 0
      ? completedOrders.reduce((sum, order) => {
          const waitTime = this.calculateWaitTime(order)
          const satisfaction = Math.max(1, 5 - (waitTime / 10)) // Decrease satisfaction with longer waits
          return sum + satisfaction
        }, 0) / completedOrders.length
      : 5
    
    const complaintRate = Math.max(0, (avgSatisfaction - 4) / 4 * 5) // Simulate complaint rate
    
    return {
      averageRating: Math.round(avgSatisfaction * 100) / 100,
      complaintRate: Math.round(complaintRate * 100) / 100,
      repeatCustomerRate: 75, // This would come from customer data
      satisfactionTrends: this.generateSatisfactionTrends()
    }
  }

  // Real-time statistics
  private computeRealTimeStats() {
    const currentOrders: KitchenOrder[] = [] // TODO: Get orders from proper store
    const activeOrders = currentOrders.filter((o: KitchenOrder) => o.status < 3).length
    
    const waitingOrders = currentOrders.filter((o: KitchenOrder) => o.status === 1)
    const avgWaitingTime = waitingOrders.length > 0
      ? waitingOrders.reduce((sum: number, o: KitchenOrder) => sum + (o.elapsedTime || 0), 0) / waitingOrders.length
      : 0
    
    // System load based on active orders vs capacity
    const capacity = 20 // Assumed kitchen capacity
    const systemLoad = Math.min((activeOrders / capacity) * 100, 100)
    
    return {
      activeOrders,
      waitingTime: Math.round(avgWaitingTime),
      systemLoad: Math.round(systemLoad),
      lastUpdate: new Date()
    }
  }

  // Utility methods
  private getOrdersInRange(): KitchenOrder[] {
    const start = this.timeRange.value.start.getTime()
    const end = this.timeRange.value.end.getTime()
    
    const orders: KitchenOrder[] = [] // TODO: Get orders from proper store
    return orders.filter((order: KitchenOrder) => {
      const orderTime = new Date(order.createdAt).getTime()
      return orderTime >= start && orderTime <= end
    })
  }

  private calculateWaitTime(order: KitchenOrder): number {
    const now = new Date()
    const created = new Date(order.createdAt)
    return Math.floor((now.getTime() - created.getTime()) / 1000 / 60) // minutes
  }

  private calculateEfficiency(completed: KitchenOrder[], total: KitchenOrder[]): number {
    if (total.length === 0) return 100
    
    const completionRate = completed.length / total.length
    const avgCompletionTime = completed.length > 0
      ? completed.reduce((sum, o) => sum + (o.elapsedTime || 0), 0) / completed.length
      : 0
    
    // Efficiency considers both completion rate and speed
    const timeEfficiency = Math.max(0, 100 - (avgCompletionTime - 15)) // 15 min baseline
    
    return Math.round((completionRate * 0.7 + timeEfficiency * 0.3) * 100) / 100
  }

  private generateOrderTrends(orders: KitchenOrder[]): Array<{ time: string; orders: number; completed: number }> {
    const trends = []
    const now = new Date()
    
    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000)
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000)
      
      const hourOrders = orders.filter(order => {
        const orderTime = new Date(order.createdAt).getTime()
        return orderTime >= hourStart.getTime() && orderTime < hourEnd.getTime()
      })
      
      const completed = hourOrders.filter(o => o.status >= 3).length
      
      trends.push({
        time: hourStart.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
        orders: hourOrders.length,
        completed
      })
    }
    
    return trends
  }

  private identifyPeakHours(orders: KitchenOrder[]): string[] {
    const hourCounts = new Map<number, number>()
    
    orders.forEach(order => {
      const hour = new Date(order.createdAt).getHours()
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1)
    })
    
    const avgCount = orders.length / 24
    
    return Array.from(hourCounts.entries())
      .filter(([, count]) => count > avgCount * 1.5) // 50% above average
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => `${hour.toString().padStart(2, '0')}:00`)
  }

  private analyzeItemCookingTimes(orders: KitchenOrder[]): Record<string, { totalTime: number; count: number }> {
    const itemTimes: Record<string, { totalTime: number; count: number }> = {}
    
    orders
      .filter(o => o.status >= 3)
      .forEach(order => {
        order.items.forEach(item => {
          if (!itemTimes[item.name]) {
            itemTimes[item.name] = { totalTime: 0, count: 0 }
          }
          
          itemTimes[item.name].totalTime += (item as any).cookingTime || 0 // TODO: Add cookingTime to KitchenOrderItem type
          itemTimes[item.name].count++
        })
      })
    
    return itemTimes
  }

  private calculateChefEfficiency(avgCookTime: number, ordersCompleted: number): number {
    const baselineTime = 20 // minutes
    const timeEfficiency = Math.max(0, 100 - ((avgCookTime - baselineTime) / baselineTime * 100))
    const volumeBonus = Math.min(ordersCompleted / 10, 1) * 10 // Bonus for volume
    
    return Math.max(0, Math.min(100, timeEfficiency + volumeBonus))
  }

  private getChefName(chefId: string): string {
    // This would typically come from a chef database
    const chefNames: Record<string, string> = {
      chef1: '主廚 張師傅',
      chef2: '副廚 李師傅',
      chef3: '學徒 王小明'
    }
    
    return chefNames[chefId] || `廚師 ${chefId}`
  }

  private calculateWorkload(chefId: string): number {
    // Calculate current workload for the chef
    const orders: KitchenOrder[] = [] // TODO: Get orders from proper store
    const activeOrders = orders
      .filter((o: KitchenOrder) => String(o.assignedChef) === chefId && o.status < 3)
      .length
    
    return Math.min(activeOrders * 20, 100) // Assume max 5 concurrent orders
  }

  private calculatePopularityTrend(itemName: string): 'up' | 'down' | 'stable' {
    // This would typically compare recent periods
    // For now, simulate based on item name hash
    const hash = itemName.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
    
    if (hash % 3 === 0) return 'up'
    if (hash % 3 === 1) return 'down'
    return 'stable'
  }

  private generateSatisfactionTrends(): Array<{ date: string; rating: number }> {
    const trends = []
    const now = new Date()
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const rating = 4.2 + Math.random() * 0.6 // Random satisfaction between 4.2-4.8
      
      trends.push({
        date: date.toLocaleDateString('zh-TW'),
        rating: Math.round(rating * 100) / 100
      })
    }
    
    return trends
  }

  // Auto refresh functionality
  private startAutoRefresh(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
    }
    
    this.updateInterval = setInterval(() => {
      if (this.autoRefresh.value) {
        this.computeStatistics()
      }
    }, 30000) // Update every 30 seconds
  }

  // Public API
  public setTimeRange(range: TimeRange): void {
    this.timeRange.value = range
    this.computeStatistics()
  }

  public getQuickStats(): {
    totalToday: number
    completedToday: number
    avgCookTime: number
    efficiency: number
  } {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const orders: KitchenOrder[] = [] // TODO: Get orders from proper store
    const todayOrders = orders.filter((order: KitchenOrder) => 
      new Date(order.createdAt) >= today
    )
    
    const completed = todayOrders.filter((o: KitchenOrder) => o.status >= 3)
    const avgCookTime = completed.length > 0
      ? completed.reduce((sum: number, o: KitchenOrder) => sum + (o.elapsedTime || 0), 0) / completed.length
      : 0
    
    const efficiency = todayOrders.length > 0
      ? (completed.length / todayOrders.length) * 100
      : 100
    
    return {
      totalToday: todayOrders.length,
      completedToday: completed.length,
      avgCookTime: Math.round(avgCookTime),
      efficiency: Math.round(efficiency)
    }
  }

  public exportStats(): string {
    return JSON.stringify({
      ...this.cachedStats,
      exportedAt: new Date().toISOString(),
      timeRange: this.timeRange.value
    }, null, 2)
  }

  public cleanup(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
  }

  // Computed getters
  get currentStats(): KitchenStats {
    return this.cachedStats
  }
  
  get isReady(): boolean {
    return this.cachedStats.orders.totalOrders > 0 || !this.isLoading.value
  }
}

// Create and export singleton instance
export const kitchenStatisticsService = new KitchenStatisticsService()
export default kitchenStatisticsService
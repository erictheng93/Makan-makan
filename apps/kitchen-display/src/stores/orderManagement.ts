import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useSettingsStore } from './settings'
import type { 
  KitchenOrder, 
  KitchenOrderItem,
  OrderStatus,
  ItemStatus
} from '@/types'

export interface OrderFilter {
  status?: OrderStatus[]
  priority?: ('normal' | 'high' | 'urgent')[]
  searchText?: string
  minElapsedTime?: number
  maxElapsedTime?: number
  tableIds?: number[]
  hasNotes?: boolean
  hasCustomizations?: boolean
}

export interface OrderSort {
  field: 'createdAt' | 'elapsedTime' | 'priority' | 'tableId' | 'totalItems'
  direction: 'asc' | 'desc'
}

export const useOrderManagementStore = defineStore('orderManagement', () => {
  const settingsStore = useSettingsStore()

  // State
  const selectedOrders = ref<Set<number>>(new Set())
  const filters = ref<OrderFilter>({})
  const sortBy = ref<OrderSort>({
    field: 'createdAt',
    direction: 'asc'
  })
  const viewMode = ref<'card' | 'list' | 'compact'>('card')
  const showCompletedOrders = ref(false)
  const autoRefreshEnabled = ref(true)

  // Selection Management
  const selectOrder = (orderId: number) => {
    selectedOrders.value.add(orderId)
  }

  const deselectOrder = (orderId: number) => {
    selectedOrders.value.delete(orderId)
  }

  const toggleOrderSelection = (orderId: number) => {
    if (selectedOrders.value.has(orderId)) {
      deselectOrder(orderId)
    } else {
      selectOrder(orderId)
    }
  }

  const selectAll = (orders: KitchenOrder[]) => {
    orders.forEach(order => {
      selectedOrders.value.add(order.id)
    })
  }

  const deselectAll = () => {
    selectedOrders.value.clear()
  }

  const isOrderSelected = (orderId: number) => {
    return selectedOrders.value.has(orderId)
  }

  // Computed
  const selectedOrdersCount = computed(() => selectedOrders.value.size)
  const hasSelectedOrders = computed(() => selectedOrders.value.size > 0)

  // Filtering Logic
  const filterOrders = (orders: KitchenOrder[]): KitchenOrder[] => {
    let filtered = [...orders]

    // Status filter
    if (filters.value.status && filters.value.status.length > 0) {
      filtered = filtered.filter(order => 
        filters.value.status!.includes(order.status)
      )
    }

    // Priority filter
    if (filters.value.priority && filters.value.priority.length > 0) {
      filtered = filtered.filter(order => 
        filters.value.priority!.includes(order.priority)
      )
    }

    // Search text filter
    if (filters.value.searchText && filters.value.searchText.trim() !== '') {
      const searchText = filters.value.searchText.toLowerCase()
      filtered = filtered.filter(order => {
        const matchesOrderNumber = order.orderNumber.toLowerCase().includes(searchText)
        const matchesCustomerName = order.customerName?.toLowerCase().includes(searchText)
        const matchesTableName = order.tableName.toLowerCase().includes(searchText)
        const matchesNotes = order.notes?.toLowerCase().includes(searchText)
        const matchesItemName = order.items.some(item => 
          item.name.toLowerCase().includes(searchText)
        )
        
        return matchesOrderNumber || matchesCustomerName || matchesTableName || 
               matchesNotes || matchesItemName
      })
    }

    // Elapsed time filter
    if (filters.value.minElapsedTime !== undefined) {
      filtered = filtered.filter(order => 
        order.elapsedTime >= filters.value.minElapsedTime!
      )
    }

    if (filters.value.maxElapsedTime !== undefined) {
      filtered = filtered.filter(order => 
        order.elapsedTime <= filters.value.maxElapsedTime!
      )
    }

    // Table filter
    if (filters.value.tableIds && filters.value.tableIds.length > 0) {
      filtered = filtered.filter(order => 
        filters.value.tableIds!.includes(order.tableId)
      )
    }

    // Has notes filter
    if (filters.value.hasNotes === true) {
      filtered = filtered.filter(order => order.notes && order.notes.trim() !== '')
    } else if (filters.value.hasNotes === false) {
      filtered = filtered.filter(order => !order.notes || order.notes.trim() === '')
    }

    // Has customizations filter
    if (filters.value.hasCustomizations === true) {
      filtered = filtered.filter(order => 
        order.items.some(item => item.customizations && item.customizations.length > 0)
      )
    } else if (filters.value.hasCustomizations === false) {
      filtered = filtered.filter(order => 
        !order.items.some(item => item.customizations && item.customizations.length > 0)
      )
    }

    return filtered
  }

  // Sorting Logic
  const sortOrders = (orders: KitchenOrder[]): KitchenOrder[] => {
    const sorted = [...orders].sort((a, b) => {
      let comparison = 0

      switch (sortBy.value.field) {
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'elapsedTime':
          comparison = a.elapsedTime - b.elapsedTime
          break
        case 'priority':
          const priorityOrder = { 'urgent': 3, 'high': 2, 'normal': 1 }
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority]
          break
        case 'tableId':
          comparison = a.tableId - b.tableId
          break
        case 'totalItems':
          comparison = a.totalItems - b.totalItems
          break
      }

      return sortBy.value.direction === 'asc' ? comparison : -comparison
    })

    return sorted
  }

  // Priority Management
  const calculateOrderPriority = (order: KitchenOrder): 'normal' | 'high' | 'urgent' => {
    const { urgentThreshold, warningThreshold } = settingsStore.settings

    if (order.elapsedTime >= urgentThreshold) {
      return 'urgent'
    } else if (order.elapsedTime >= warningThreshold) {
      return 'high'
    } else {
      return 'normal'
    }
  }

  const updateOrderPriorities = (orders: KitchenOrder[]): KitchenOrder[] => {
    return orders.map(order => ({
      ...order,
      priority: calculateOrderPriority(order)
    }))
  }

  // Time Management
  const calculateElapsedTime = (order: KitchenOrder): number => {
    const createdTime = new Date(order.createdAt).getTime()
    const now = Date.now()
    return Math.floor((now - createdTime) / (1000 * 60)) // Minutes
  }

  const updateElapsedTimes = (orders: KitchenOrder[]): KitchenOrder[] => {
    return orders.map(order => ({
      ...order,
      elapsedTime: calculateElapsedTime(order)
    }))
  }

  // Item Status Management
  const getNextItemStatus = (currentStatus: ItemStatus): ItemStatus => {
    const statusFlow: Record<ItemStatus, ItemStatus> = {
      'pending': 'preparing',
      'preparing': 'ready',
      'ready': 'completed',
      'completed': 'completed'
    }
    return statusFlow[currentStatus]
  }

  const canAdvanceItemStatus = (status: ItemStatus): boolean => {
    return status !== 'ready' && status !== 'completed'
  }

  const getItemsByStatus = (order: KitchenOrder, status: ItemStatus): KitchenOrderItem[] => {
    return order.items.filter(item => item.status === status)
  }

  const getOrderProgress = (order: KitchenOrder): number => {
    const totalItems = order.items.length
    if (totalItems === 0) return 0

    const completedItems = order.items.filter(item => 
      item.status === 'ready' || item.status === 'completed'
    ).length

    return Math.round((completedItems / totalItems) * 100)
  }

  // Batch Operations
  const getSelectedOrdersData = (allOrders: KitchenOrder[]) => {
    return allOrders.filter(order => selectedOrders.value.has(order.id))
  }

  const canBatchStartCooking = (orders: KitchenOrder[]): boolean => {
    return orders.some(order => 
      order.items.some(item => item.status === 'pending')
    )
  }

  const canBatchMarkReady = (orders: KitchenOrder[]): boolean => {
    return orders.some(order => 
      order.items.some(item => item.status === 'preparing')
    )
  }

  const getBatchOperationSummary = (orders: KitchenOrder[]) => {
    const totalOrders = orders.length
    const totalItems = orders.reduce((sum, order) => sum + order.items.length, 0)
    const pendingItems = orders.reduce((sum, order) => 
      sum + order.items.filter(item => item.status === 'pending').length, 0)
    const preparingItems = orders.reduce((sum, order) => 
      sum + order.items.filter(item => item.status === 'preparing').length, 0)

    return {
      totalOrders,
      totalItems,
      pendingItems,
      preparingItems
    }
  }

  // Filter Management
  const setFilter = (key: keyof OrderFilter, value: any) => {
    filters.value[key] = value
  }

  const clearFilters = () => {
    filters.value = {}
  }

  const hasActiveFilters = computed(() => {
    return Object.keys(filters.value).some(key => {
      const value = filters.value[key as keyof OrderFilter]
      if (Array.isArray(value)) {
        return value.length > 0
      }
      return value !== undefined && value !== null && value !== ''
    })
  })

  // Sort Management
  const setSorting = (field: OrderSort['field'], direction?: OrderSort['direction']) => {
    if (sortBy.value.field === field && !direction) {
      // Toggle direction if same field
      sortBy.value.direction = sortBy.value.direction === 'asc' ? 'desc' : 'asc'
    } else {
      sortBy.value.field = field
      sortBy.value.direction = direction || 'asc'
    }
  }

  // View Management
  const setViewMode = (mode: 'card' | 'list' | 'compact') => {
    viewMode.value = mode
  }

  const toggleCompletedOrders = () => {
    showCompletedOrders.value = !showCompletedOrders.value
  }

  // Auto-refresh Management
  const toggleAutoRefresh = () => {
    autoRefreshEnabled.value = !autoRefreshEnabled.value
  }

  // Drag and Drop Status Management
  const moveOrderToStatus = (orderId: number, newStatus: 'pending' | 'preparing' | 'ready') => {
    // This would trigger API calls to update order status
    // For now, we'll emit an event that the parent component can handle
    return { orderId, newStatus }
  }

  const batchStartAllItems = (orderId: number) => {
    // Start all pending items in an order
    return { orderId, action: 'start_all' }
  }

  const batchCompleteAllItems = (orderId: number) => {
    // Complete all preparing items in an order  
    return { orderId, action: 'complete_all' }
  }

  // Quick Filters
  const quickFilters = {
    showUrgentOnly: () => {
      setFilter('priority', ['urgent'])
    },
    showPendingOnly: () => {
      setFilter('status', [1]) // CONFIRMED
    },
    showPreparingOnly: () => {
      setFilter('status', [2]) // PREPARING
    },
    showWithNotes: () => {
      setFilter('hasNotes', true)
    },
    showOverdue: () => {
      setFilter('minElapsedTime', settingsStore.settings.urgentThreshold)
    }
  }

  // Reset all management state
  const resetManagementState = () => {
    deselectAll()
    clearFilters()
    sortBy.value = { field: 'createdAt', direction: 'asc' }
    viewMode.value = 'card'
    showCompletedOrders.value = false
    autoRefreshEnabled.value = true
  }

  return {
    // State
    selectedOrders,
    filters,
    sortBy,
    viewMode,
    showCompletedOrders,
    autoRefreshEnabled,

    // Computed
    selectedOrdersCount,
    hasSelectedOrders,
    hasActiveFilters,

    // Selection methods
    selectOrder,
    deselectOrder,
    toggleOrderSelection,
    selectAll,
    deselectAll,
    isOrderSelected,

    // Processing methods
    filterOrders,
    sortOrders,
    updateOrderPriorities,
    updateElapsedTimes,

    // Item management
    getNextItemStatus,
    canAdvanceItemStatus,
    getItemsByStatus,
    getOrderProgress,

    // Batch operations
    getSelectedOrdersData,
    canBatchStartCooking,
    canBatchMarkReady,
    getBatchOperationSummary,

    // Drag and drop operations
    moveOrderToStatus,
    batchStartAllItems,
    batchCompleteAllItems,

    // Filter management
    setFilter,
    clearFilters,

    // Sort management
    setSorting,

    // View management
    setViewMode,
    toggleCompletedOrders,
    toggleAutoRefresh,

    // Quick filters
    quickFilters,

    // Reset
    resetManagementState
  }
})
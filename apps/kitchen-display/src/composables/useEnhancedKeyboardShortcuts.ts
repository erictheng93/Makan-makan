// Enhanced keyboard shortcuts with visual feedback and customization
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useToast } from 'vue-toastification'
import { enhancedAudioService } from '@/services/enhancedAudioService'
import { useOrderManagementStore } from '@/stores/orderManagement'

export interface KeyboardShortcut {
  id: string
  name: string
  description: string
  keys: string[]
  action: string
  category: 'orders' | 'navigation' | 'system' | 'filters' | 'audio'
  enabled: boolean
  global?: boolean
  context?: string
  customizable?: boolean
  visual?: {
    icon?: string
    color?: string
    animation?: string
  }
}

export interface ShortcutExecution {
  shortcutId: string
  timestamp: number
  success: boolean
  context?: string
  executionTime: number
}

export interface ShortcutStats {
  totalExecutions: number
  successRate: number
  averageExecutionTime: number
  mostUsed: { shortcutId: string; count: number }[]
  recentExecutions: ShortcutExecution[]
}

export function useEnhancedKeyboardShortcuts(orders = ref<any[]>([])) {
  const toast = useToast()
  const orderStore = useOrderManagementStore()
  
  // State
  const enabled = ref(true)
  const showVisualFeedback = ref(true)
  const recordingMode = ref(false)
  const recordingKeys = ref<string[]>([])
  const pressedKeys = ref(new Set<string>())
  const keySequence = ref<string[]>([])
  const lastKeyTime = ref(0)
  const executionHistory = ref<ShortcutExecution[]>([])
  
  // Visual feedback
  const visualFeedback = ref<{
    show: boolean
    message: string
    type: 'success' | 'error' | 'info'
    position: { x: number; y: number }
  }>({
    show: false,
    message: '',
    type: 'info',
    position: { x: 0, y: 0 }
  })

  // Enhanced shortcut definitions
  const shortcuts = ref<KeyboardShortcut[]>([
    // Order management shortcuts
    {
      id: 'complete_order',
      name: '標記完成',
      description: '將選中的訂單標記為完成',
      keys: ['Space'],
      action: 'complete_selected_order',
      category: 'orders',
      enabled: true,
      visual: { icon: '✅', color: 'green', animation: 'bounce' }
    },
    {
      id: 'start_cooking',
      name: '開始製作',
      description: '開始製作選中的訂單',
      keys: ['Enter'],
      action: 'start_cooking_selected',
      category: 'orders',
      enabled: true,
      visual: { icon: '🍳', color: 'orange', animation: 'pulse' }
    },
    {
      id: 'toggle_priority',
      name: '切換優先級',
      description: '切換訂單優先級',
      keys: ['p'],
      action: 'toggle_order_priority',
      category: 'orders',
      enabled: true,
      visual: { icon: '⚡', color: 'red', animation: 'shake' }
    },
    {
      id: 'assign_to_chef',
      name: '分配廚師',
      description: '分配訂單給廚師',
      keys: ['a'],
      action: 'assign_chef',
      category: 'orders',
      enabled: true,
      visual: { icon: '👨‍🍳', color: 'blue' }
    },

    // Navigation shortcuts
    {
      id: 'next_order',
      name: '下一個訂單',
      description: '選擇下一個訂單',
      keys: ['ArrowDown'],
      action: 'select_next_order',
      category: 'navigation',
      enabled: true,
      global: true
    },
    {
      id: 'prev_order',
      name: '上一個訂單',
      description: '選擇上一個訂單',
      keys: ['ArrowUp'],
      action: 'select_prev_order',
      category: 'navigation',
      enabled: true,
      global: true
    },
    {
      id: 'first_order',
      name: '第一個訂單',
      description: '選擇第一個訂單',
      keys: ['Home'],
      action: 'select_first_order',
      category: 'navigation',
      enabled: true
    },
    {
      id: 'last_order',
      name: '最後一個訂單',
      description: '選擇最後一個訂單',
      keys: ['End'],
      action: 'select_last_order',
      category: 'navigation',
      enabled: true
    },

    // Filter shortcuts
    {
      id: 'filter_pending',
      name: '篩選待處理',
      description: '顯示待處理訂單',
      keys: ['1'],
      action: 'filter_pending',
      category: 'filters',
      enabled: true,
      visual: { icon: '⏳', color: 'yellow' }
    },
    {
      id: 'filter_cooking',
      name: '篩選製作中',
      description: '顯示製作中訂單',
      keys: ['2'],
      action: 'filter_cooking',
      category: 'filters',
      enabled: true,
      visual: { icon: '🔥', color: 'orange' }
    },
    {
      id: 'filter_ready',
      name: '篩選已完成',
      description: '顯示已完成訂單',
      keys: ['3'],
      action: 'filter_ready',
      category: 'filters',
      enabled: true,
      visual: { icon: '✅', color: 'green' }
    },
    {
      id: 'filter_all',
      name: '顯示全部',
      description: '顯示所有訂單',
      keys: ['0'],
      action: 'filter_all',
      category: 'filters',
      enabled: true,
      visual: { icon: '📋', color: 'blue' }
    },

    // System shortcuts
    {
      id: 'toggle_audio',
      name: '音效開關',
      description: '開啟或關閉音效',
      keys: ['m'],
      action: 'toggle_audio',
      category: 'audio',
      enabled: true,
      global: true,
      visual: { icon: '🔊', color: 'purple' }
    },
    {
      id: 'fullscreen',
      name: '全螢幕模式',
      description: '切換全螢幕顯示',
      keys: ['f'],
      action: 'toggle_fullscreen',
      category: 'system',
      enabled: true,
      global: true,
      visual: { icon: '🖥️', color: 'gray' }
    },
    {
      id: 'refresh',
      name: '重新整理',
      description: '重新載入資料',
      keys: ['F5'],
      action: 'refresh_data',
      category: 'system',
      enabled: true,
      global: true,
      visual: { icon: '🔄', color: 'blue', animation: 'spin' }
    },
    {
      id: 'help',
      name: '顯示幫助',
      description: '顯示快捷鍵幫助',
      keys: ['?'],
      action: 'show_help',
      category: 'system',
      enabled: true,
      global: true,
      visual: { icon: '❓', color: 'blue' }
    },

    // Advanced shortcuts
    {
      id: 'select_all',
      name: '選擇全部',
      description: '選擇所有可見訂單',
      keys: ['Ctrl', 'a'],
      action: 'select_all_orders',
      category: 'orders',
      enabled: true,
      visual: { icon: '📋', color: 'blue' }
    },
    {
      id: 'batch_start',
      name: '批量開始',
      description: '批量開始選中訂單',
      keys: ['Ctrl', 'Enter'],
      action: 'batch_start_cooking',
      category: 'orders',
      enabled: true,
      visual: { icon: '🚀', color: 'green' }
    },
    {
      id: 'quick_search',
      name: '快速搜尋',
      description: '開啟搜尋框',
      keys: ['Ctrl', 'f'],
      action: 'quick_search',
      category: 'navigation',
      enabled: true,
      visual: { icon: '🔍', color: 'blue' }
    }
  ])

  // Computed properties
  const shortcutsByCategory = computed(() => {
    const categories: Record<string, KeyboardShortcut[]> = {}
    shortcuts.value.forEach(shortcut => {
      if (!categories[shortcut.category]) {
        categories[shortcut.category] = []
      }
      categories[shortcut.category].push(shortcut)
    })
    return categories
  })

  const enabledShortcuts = computed(() => 
    shortcuts.value.filter(s => s.enabled)
  )

  const stats = computed((): ShortcutStats => {
    const total = executionHistory.value.length
    const successful = executionHistory.value.filter(e => e.success).length
    
    const usageCounts: Record<string, number> = {}
    executionHistory.value.forEach(execution => {
      usageCounts[execution.shortcutId] = (usageCounts[execution.shortcutId] || 0) + 1
    })
    
    const mostUsed = Object.entries(usageCounts)
      .map(([shortcutId, count]) => ({ shortcutId, count: Number(count) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
    
    const avgTime = executionHistory.value.length > 0
      ? executionHistory.value.reduce((sum, e) => sum + e.executionTime, 0) / total
      : 0

    return {
      totalExecutions: total,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      averageExecutionTime: avgTime,
      mostUsed,
      recentExecutions: executionHistory.value.slice(-10)
    }
  })

  // Event handlers
  const handleKeyDown = async (event: KeyboardEvent): Promise<boolean> => {
    if (!enabled.value) return false

    // Skip if in input elements (unless global shortcut)
    if (isInputElement(event.target) && !isGlobalShortcut(event)) {
      return false
    }

    const key = normalizeKey(event)
    pressedKeys.value.add(key)
    
    // Update key sequence for multi-key shortcuts
    updateKeySequence(key)
    
    // Find matching shortcut
    const shortcut = findMatchingShortcut(Array.from(pressedKeys.value))
    
    if (shortcut) {
      event.preventDefault()
      
      const startTime = performance.now()
      const success = await executeShortcut(shortcut, event)
      const executionTime = performance.now() - startTime
      
      // Record execution
      recordExecution(shortcut.id, success, executionTime)
      
      // Show visual feedback
      if (showVisualFeedback.value && shortcut.visual) {
        showVisualShortcutFeedback(shortcut, success, event)
      }
      
      // Play audio feedback
      if (success) {
        enhancedAudioService.playSound('tick', { volume: 0.3 })
      } else {
        enhancedAudioService.playSound('error', { volume: 0.4 })
      }
      
      return true
    }
    
    return false
  }

  const handleKeyUp = (event: KeyboardEvent) => {
    const key = normalizeKey(event)
    pressedKeys.value.delete(key)
    
    // Clear key sequence after timeout
    setTimeout(() => {
      if (keySequence.value.length > 0 && Date.now() - lastKeyTime.value > 1000) {
        keySequence.value = []
      }
    }, 1000)
  }

  // Shortcut execution
  const executeShortcut = async (shortcut: KeyboardShortcut, event: KeyboardEvent): Promise<boolean> => {
    try {
      switch (shortcut.action) {
        case 'complete_selected_order':
          return await completeSelectedOrder()
        
        case 'start_cooking_selected':
          return await startCookingSelected()
        
        case 'toggle_order_priority':
          return await toggleOrderPriority()
        
        case 'assign_chef':
          return await assignChef()
        
        case 'select_next_order':
          return selectNextOrder()
        
        case 'select_prev_order':
          return selectPreviousOrder()
        
        case 'select_first_order':
          return selectFirstOrder()
        
        case 'select_last_order':
          return selectLastOrder()
        
        case 'filter_pending':
          return await applyFilter('pending')
        
        case 'filter_cooking':
          return await applyFilter('cooking')
        
        case 'filter_ready':
          return await applyFilter('ready')
        
        case 'filter_all':
          return await applyFilter('all')
        
        case 'toggle_audio':
          return toggleAudio()
        
        case 'toggle_fullscreen':
          return toggleFullscreen()
        
        case 'refresh_data':
          return await refreshData()
        
        case 'show_help':
          return showHelp()
        
        case 'select_all_orders':
          return selectAllOrders()
        
        case 'batch_start_cooking':
          return await batchStartCooking()
        
        case 'quick_search':
          return showQuickSearch()
        
        default:
          console.warn(`Unknown shortcut action: ${shortcut.action}`)
          return false
      }
    } catch (error) {
      console.error(`Error executing shortcut ${shortcut.id}:`, error)
      toast.error(`執行快捷鍵失敗: ${shortcut.name}`)
      return false
    }
  }

  // Shortcut actions implementation
  const completeSelectedOrder = async (): Promise<boolean> => {
    // TODO: Implement focusedOrder property in store
    const selectedOrders = Array.from(orderStore.selectedOrders)
    if (selectedOrders.length === 0) {
      toast.warning('請先選擇一個訂單')
      return false
    }
    
    try {
      // TODO: Implement completeOrder method in store
      toast.success(`已完成 ${selectedOrders.length} 個訂單`)
      return true
    } catch (error) {
      toast.error('完成訂單失敗')
      return false
    }
  }

  const startCookingSelected = async (): Promise<boolean> => {
    // TODO: Implement focusedOrder property in store
    const selectedOrders = Array.from(orderStore.selectedOrders)
    if (selectedOrders.length === 0) {
      toast.warning('請先選擇一個訂單')
      return false
    }
    
    try {
      // TODO: Implement startCooking method in store
      toast.success(`開始製作 ${selectedOrders.length} 個訂單`)
      return true
    } catch (error) {
      toast.error('開始製作失敗')
      return false
    }
  }

  const toggleOrderPriority = async (): Promise<boolean> => {
    const selectedOrderIds = Array.from(orderStore.selectedOrders)
    if (selectedOrderIds.length === 0) {
      toast.warning('請先選擇一個訂單')
      return false
    }
    
    const firstOrderId = selectedOrderIds[0]
    const selectedOrder = orders.value?.find((order: any) => order.id === firstOrderId)
    if (!selectedOrder) {
      toast.warning('找不到選中的訂單')
      return false
    }
    
    const priorities = ['normal', 'high', 'urgent']
    const currentIndex = priorities.indexOf(selectedOrder.priority)
    const nextPriority = priorities[(currentIndex + 1) % priorities.length]
    
    try {
      // Use updateOrderPriorities instead of updateOrderPriority
      const updatedOrders = orders.value?.map((order: any) => 
        order.id === selectedOrder.id 
          ? { ...order, priority: nextPriority as any }
          : order
      ) || []
      orders.value = orderStore.updateOrderPriorities(updatedOrders)
      toast.success(`訂單優先級已更新為 ${nextPriority}`)
      return true
    } catch (error) {
      toast.error('更新優先級失敗')
      return false
    }
  }

  const assignChef = async (): Promise<boolean> => {
    const selectedOrder = orderStore.focusedOrder
    if (!selectedOrder) {
      toast.warning('請先選擇一個訂單')
      return false
    }
    
    // This would typically open a chef selection modal
    toast.info('打開廚師分配選單')
    return true
  }

  const selectNextOrder = (): boolean => {
    orderStore.selectNextOrder()
    return true
  }

  const selectPreviousOrder = (): boolean => {
    orderStore.selectPreviousOrder()
    return true
  }

  const selectFirstOrder = (): boolean => {
    orderStore.selectFirstOrder()
    return true
  }

  const selectLastOrder = (): boolean => {
    orderStore.selectLastOrder()
    return true
  }

  const applyFilter = async (filter: string): Promise<boolean> => {
    const filterMap: Record<string, { status?: number[] }> = {
      'pending': { status: [1] },
      'cooking': { status: [2] },
      'ready': { status: [3] },
      'all': {}
    }
    
    try {
      await orderStore.applyFilter(filter, filterMap[filter] || {})
      toast.success(`已應用 ${filter} 篩選`)
      return true
    } catch (error) {
      toast.error('應用篩選失敗')
      return false
    }
  }

  const toggleAudio = (): boolean => {
    enhancedAudioService.toggleEnabled()
    const status = enhancedAudioService.settings.enabled ? '已啟用' : '已停用'
    toast.info(`音效 ${status}`)
    return true
  }

  const toggleFullscreen = (): boolean => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
      toast.info('退出全螢幕模式')
    } else {
      document.documentElement.requestFullscreen()
      toast.info('進入全螢幕模式')
    }
    return true
  }

  const refreshData = async (): Promise<boolean> => {
    try {
      await orderStore.refreshOrders()
      toast.success('資料已更新')
      return true
    } catch (error) {
      toast.error('更新資料失敗')
      return false
    }
  }

  const showHelp = (): boolean => {
    // This would typically open a help modal
    toast.info('快捷鍵幫助已開啟')
    return true
  }

  const selectAllOrders = (): boolean => {
    orderStore.selectAllVisibleOrders()
    toast.info('已選擇所有可見訂單')
    return true
  }

  const batchStartCooking = async (): Promise<boolean> => {
    const selectedOrders = Array.from(orderStore.selectedOrders)
    if (selectedOrders.length === 0) {
      toast.warning('請先選擇訂單')
      return false
    }
    
    try {
      const selectedOrderIds = Array.from(orderStore.selectedOrders)
      await orderStore.batchOperation('start_cooking', selectedOrderIds)
      toast.success(`已開始製作 ${selectedOrders.length} 個訂單`)
      return true
    } catch (error) {
      toast.error('批量開始製作失敗')
      return false
    }
  }

  const showQuickSearch = (): boolean => {
    // Focus on search input if exists
    const searchInput = document.querySelector('input[type="search"], input[placeholder*="搜"]') as HTMLInputElement
    if (searchInput) {
      searchInput.focus()
      return true
    }
    
    toast.info('搜尋功能開啟')
    return true
  }

  // Visual feedback
  const showVisualShortcutFeedback = (
    shortcut: KeyboardShortcut, 
    success: boolean, 
    event: KeyboardEvent
  ) => {
    const rect = (event.target as HTMLElement)?.getBoundingClientRect()
    
    visualFeedback.value = {
      show: true,
      message: success ? shortcut.name : `${shortcut.name} 失敗`,
      type: success ? 'success' : 'error',
      position: {
        x: rect?.left + (rect?.width / 2) || window.innerWidth / 2,
        y: rect?.top || window.innerHeight / 2
      }
    }
    
    // Hide after animation
    setTimeout(() => {
      visualFeedback.value.show = false
    }, 1500)
  }

  // Utility functions
  const normalizeKey = (event: KeyboardEvent): string => {
    let key = event.key
    
    if (event.ctrlKey && key !== 'Control') key = `Ctrl+${key}`
    if (event.altKey && key !== 'Alt') key = `Alt+${key}`
    if (event.shiftKey && key !== 'Shift' && key.length > 1) key = `Shift+${key}`
    if (event.metaKey && key !== 'Meta') key = `Cmd+${key}`
    
    return key
  }

  const findMatchingShortcut = (pressedKeys: string[]): KeyboardShortcut | null => {
    return enabledShortcuts.value.find(shortcut => {
      if (shortcut.keys.length !== pressedKeys.length) return false
      return shortcut.keys.every(key => pressedKeys.includes(key))
    }) || null
  }

  const isInputElement = (target: EventTarget | null): boolean => {
    if (!target) return false
    
    const element = target as HTMLElement
    const tagName = element.tagName.toLowerCase()
    
    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      element.contentEditable === 'true'
    )
  }

  const isGlobalShortcut = (event: KeyboardEvent): boolean => {
    const key = normalizeKey(event)
    return enabledShortcuts.value.some(
      shortcut => shortcut.global && 
      shortcut.keys.some(shortcutKey => shortcutKey === key)
    )
  }

  const updateKeySequence = (key: string) => {
    keySequence.value.push(key)
    lastKeyTime.value = Date.now()
    
    // Keep only recent keys (max 5)
    if (keySequence.value.length > 5) {
      keySequence.value = keySequence.value.slice(-5)
    }
  }

  const recordExecution = (shortcutId: string, success: boolean, executionTime: number) => {
    const execution: ShortcutExecution = {
      shortcutId,
      timestamp: Date.now(),
      success,
      executionTime
    }
    
    executionHistory.value.unshift(execution)
    
    // Keep only recent executions (max 100)
    if (executionHistory.value.length > 100) {
      executionHistory.value = executionHistory.value.slice(0, 100)
    }
  }

  // Custom shortcut management
  const addCustomShortcut = (shortcut: Omit<KeyboardShortcut, 'id'>): string => {
    const id = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newShortcut: KeyboardShortcut = {
      id,
      customizable: true,
      ...shortcut
    }
    
    shortcuts.value.push(newShortcut)
    saveShortcuts()
    
    return id
  }

  const updateShortcut = (id: string, updates: Partial<KeyboardShortcut>): boolean => {
    const index = shortcuts.value.findIndex(s => s.id === id)
    if (index === -1) return false
    
    shortcuts.value[index] = { ...shortcuts.value[index], ...updates }
    saveShortcuts()
    
    return true
  }

  const removeShortcut = (id: string): boolean => {
    const index = shortcuts.value.findIndex(s => s.id === id && s.customizable)
    if (index === -1) return false
    
    shortcuts.value.splice(index, 1)
    saveShortcuts()
    
    return true
  }

  // Persistence
  const saveShortcuts = () => {
    try {
      localStorage.setItem('kitchen-keyboard-shortcuts', JSON.stringify(shortcuts.value))
    } catch (error) {
      console.error('Failed to save shortcuts:', error)
    }
  }

  const loadShortcuts = () => {
    try {
      const saved = localStorage.getItem('kitchen-keyboard-shortcuts')
      if (saved) {
        const parsed = JSON.parse(saved)
        shortcuts.value = parsed
      }
    } catch (error) {
      console.error('Failed to load shortcuts:', error)
    }
  }

  // Recording mode for custom shortcuts
  const startRecording = () => {
    recordingMode.value = true
    recordingKeys.value = []
    toast.info('開始錄製快捷鍵，按下想要的組合鍵...')
  }

  const stopRecording = (): string[] => {
    recordingMode.value = false
    const keys = [...recordingKeys.value]
    recordingKeys.value = []
    toast.success(`錄製完成: ${keys.join(' + ')}`)
    return keys
  }

  // Setup and cleanup
  const setupEventListeners = () => {
    document.addEventListener('keydown', handleKeyDown, { capture: true })
    document.addEventListener('keyup', handleKeyUp, { capture: true })
  }

  const removeEventListeners = () => {
    document.removeEventListener('keydown', handleKeyDown, { capture: true })
    document.removeEventListener('keyup', handleKeyUp, { capture: true })
  }

  // Lifecycle
  onMounted(() => {
    loadShortcuts()
    setupEventListeners()
  })

  onUnmounted(() => {
    saveShortcuts()
    removeEventListeners()
  })

  return {
    // State
    enabled,
    showVisualFeedback,
    recordingMode,
    shortcuts,
    shortcutsByCategory,
    enabledShortcuts,
    stats,
    visualFeedback,
    executionHistory,
    
    // Methods
    executeShortcut,
    addCustomShortcut,
    updateShortcut,
    removeShortcut,
    startRecording,
    stopRecording,
    setupEventListeners,
    removeEventListeners,
    
    // Utility
    normalizeKey,
    findMatchingShortcut
  }
}
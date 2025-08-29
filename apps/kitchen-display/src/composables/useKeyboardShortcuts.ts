import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useToast } from 'vue-toastification'
import type { KitchenOrder } from '@/types'

// Keyboard shortcut configuration
export interface KeyboardShortcut {
  id: string
  name: string
  description: string
  keys: string[]
  action: string
  enabled: boolean
  category: 'orders' | 'navigation' | 'system' | 'filters'
  global?: boolean // Can be used anywhere, not just when focused
}

export interface ShortcutGroup {
  category: string
  title: string
  shortcuts: KeyboardShortcut[]
}

// Default shortcuts configuration
const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  // Order management shortcuts
  {
    id: 'quick_complete',
    name: '快速標記完成',
    description: '快速標記當前選中或第一個訂單為完成',
    keys: ['Space'],
    action: 'quick_complete',
    enabled: true,
    category: 'orders',
    global: true
  },
  {
    id: 'toggle_order_status',
    name: '切換訂單狀態',
    description: '在等待、製作中、完成之間循環切換訂單狀態',
    keys: ['Enter'],
    action: 'toggle_order_status',
    enabled: true,
    category: 'orders',
    global: true
  },
  {
    id: 'select_all_pending',
    name: '選擇所有待處理',
    description: '選擇所有待處理的訂單',
    keys: ['Ctrl', 'a'],
    action: 'select_all_pending',
    enabled: true,
    category: 'orders'
  },
  {
    id: 'batch_start_selected',
    name: '批量開始選中訂單',
    description: '開始所有選中訂單的製作',
    keys: ['Ctrl', 'Enter'],
    action: 'batch_start_selected',
    enabled: true,
    category: 'orders'
  },
  {
    id: 'deselect_all',
    name: '取消所有選擇',
    description: '取消選擇所有訂單',
    keys: ['Escape'],
    action: 'deselect_all',
    enabled: true,
    category: 'orders',
    global: true
  },

  // Navigation shortcuts
  {
    id: 'toggle_view_mode',
    name: '切換顯示模式',
    description: '在拖拽模式和傳統模式之間切換',
    keys: ['Tab'],
    action: 'toggle_view_mode',
    enabled: true,
    category: 'navigation',
    global: true
  },
  {
    id: 'focus_search',
    name: '聚焦搜索框',
    description: '將焦點移至搜索輸入框',
    keys: ['Ctrl', 'f'],
    action: 'focus_search',
    enabled: true,
    category: 'navigation'
  },
  {
    id: 'toggle_filters',
    name: '顯示/隱藏篩選器',
    description: '顯示或隱藏訂單篩選面板',
    keys: ['Shift', 'f'],
    action: 'toggle_filters',
    enabled: true,
    category: 'navigation',
    global: true
  },

  // Filter shortcuts
  {
    id: 'filter_urgent',
    name: '篩選緊急訂單',
    description: '只顯示緊急優先級的訂單',
    keys: ['u'],
    action: 'filter_urgent',
    enabled: true,
    category: 'filters',
    global: true
  },
  {
    id: 'filter_preparing',
    name: '篩選製作中訂單',
    description: '只顯示正在製作的訂單',
    keys: ['p'],
    action: 'filter_preparing',
    enabled: true,
    category: 'filters',
    global: true
  },
  {
    id: 'clear_filters',
    name: '清除所有篩選',
    description: '重設所有篩選條件',
    keys: ['c'],
    action: 'clear_filters',
    enabled: true,
    category: 'filters',
    global: true
  },

  // System shortcuts
  {
    id: 'refresh_orders',
    name: '刷新訂單',
    description: '手動刷新訂單列表',
    keys: ['F5'],
    action: 'refresh_orders',
    enabled: true,
    category: 'system',
    global: true
  },
  {
    id: 'toggle_fullscreen',
    name: '切換全屏模式',
    description: '進入或退出全屏顯示',
    keys: ['f'],
    action: 'toggle_fullscreen',
    enabled: true,
    category: 'system',
    global: true
  },
  {
    id: 'show_shortcuts',
    name: '顯示快捷鍵幫助',
    description: '顯示所有可用的鍵盤快捷鍵',
    keys: ['?'],
    action: 'show_shortcuts',
    enabled: true,
    category: 'system',
    global: true
  },
  {
    id: 'toggle_audio',
    name: '切換音頻通知',
    description: '開啟或關閉音頻通知',
    keys: ['m'],
    action: 'toggle_audio',
    enabled: true,
    category: 'system',
    global: true
  }
]

export function useKeyboardShortcuts() {
  const toast = useToast()
  
  // State
  const shortcuts = ref<KeyboardShortcut[]>([...DEFAULT_SHORTCUTS])
  const activeKeys = ref<Set<string>>(new Set())
  const enabled = ref(true)
  const showHelp = ref(false)
  const lastActionTime = ref(0)
  const actionQueue = ref<string[]>([])

  // Action handlers registry
  const actionHandlers = ref<Map<string, (...args: any[]) => void>>(new Map())

  // Computed
  const shortcutGroups = computed((): ShortcutGroup[] => {
    const groups: { [key: string]: ShortcutGroup } = {}
    
    shortcuts.value.forEach(shortcut => {
      if (!shortcut.enabled) return
      
      if (!groups[shortcut.category]) {
        groups[shortcut.category] = {
          category: shortcut.category,
          title: getCategoryTitle(shortcut.category),
          shortcuts: []
        }
      }
      groups[shortcut.category].shortcuts.push(shortcut)
    })
    
    return Object.values(groups)
  })

  const enabledShortcuts = computed(() => 
    shortcuts.value.filter(s => s.enabled)
  )

  // Utility functions
  const getCategoryTitle = (category: string): string => {
    const titles = {
      orders: '訂單管理',
      navigation: '導航操作',
      filters: '篩選功能',
      system: '系統功能'
    }
    return titles[category] || category
  }

  const normalizeKey = (key: string): string => {
    // Normalize key names for consistency
    const keyMap: { [key: string]: string } = {
      ' ': 'Space',
      'Control': 'Ctrl',
      'Meta': 'Cmd',
      'Alt': 'Alt',
      'Shift': 'Shift'
    }
    
    return keyMap[key] || key
  }

  const formatShortcut = (keys: string[]): string => {
    const symbols: { [key: string]: string } = {
      'Ctrl': '⌃',
      'Cmd': '⌘',
      'Alt': '⌥',
      'Shift': '⇧',
      'Space': '␣',
      'Enter': '↵',
      'Tab': '⇥',
      'Escape': '⎋',
      'Backspace': '⌫',
      'Delete': '⌦',
      'ArrowUp': '↑',
      'ArrowDown': '↓',
      'ArrowLeft': '←',
      'ArrowRight': '→'
    }
    
    return keys.map(key => symbols[key] || key).join(' + ')
  }

  const matchesShortcut = (shortcut: KeyboardShortcut, pressedKeys: Set<string>): boolean => {
    if (!shortcut.enabled) return false
    
    const requiredKeys = new Set(shortcut.keys.map(normalizeKey))
    const currentKeys = new Set([...pressedKeys].map(normalizeKey))
    
    // Check if all required keys are pressed
    if (requiredKeys.size !== currentKeys.size) return false
    
    for (const key of requiredKeys) {
      if (!currentKeys.has(key)) return false
    }
    
    return true
  }

  const shouldIgnoreEvent = (event: KeyboardEvent): boolean => {
    // Ignore shortcuts when typing in input fields
    const target = event.target as HTMLElement
    const isInputElement = target.tagName === 'INPUT' || 
                          target.tagName === 'TEXTAREA' || 
                          target.contentEditable === 'true'
    
    // Allow some global shortcuts even in input fields
    const globalShortcuts = ['F5', 'F11', 'Escape']
    const isGlobalShortcut = globalShortcuts.some(key => 
      event.key === key || event.code === key
    )
    
    return isInputElement && !isGlobalShortcut
  }

  // Event handlers
  const handleKeyDown = (event: KeyboardEvent) => {
    if (!enabled.value || shouldIgnoreEvent(event)) return

    const key = normalizeKey(event.key)
    activeKeys.value.add(key)

    // Add modifier keys
    if (event.ctrlKey) activeKeys.value.add('Ctrl')
    if (event.altKey) activeKeys.value.add('Alt')
    if (event.shiftKey) activeKeys.value.add('Shift')
    if (event.metaKey) activeKeys.value.add('Cmd')

    // Find matching shortcut
    const matchingShortcut = enabledShortcuts.value.find(shortcut => 
      matchesShortcut(shortcut, activeKeys.value)
    )

    if (matchingShortcut) {
      event.preventDefault()
      event.stopPropagation()
      
      // Prevent rapid repeated actions
      const now = Date.now()
      if (now - lastActionTime.value < 200) return
      
      lastActionTime.value = now
      executeAction(matchingShortcut.action)
    }
  }

  const handleKeyUp = (event: KeyboardEvent) => {
    const key = normalizeKey(event.key)
    activeKeys.value.delete(key)

    // Remove modifier keys when released
    if (!event.ctrlKey) activeKeys.value.delete('Ctrl')
    if (!event.altKey) activeKeys.value.delete('Alt')
    if (!event.shiftKey) activeKeys.value.delete('Shift')
    if (!event.metaKey) activeKeys.value.delete('Cmd')
  }

  const handleBlur = () => {
    // Clear active keys when window loses focus
    activeKeys.value.clear()
  }

  // Action execution
  const executeAction = (action: string) => {
    const handler = actionHandlers.value.get(action)
    
    if (handler) {
      try {
        handler()
        actionQueue.value.push(action)
        
        // Keep only last 10 actions
        if (actionQueue.value.length > 10) {
          actionQueue.value.shift()
        }
        
        // Show visual feedback for some actions
        showActionFeedback(action)
      } catch (error: any) {
        console.error(`Error executing shortcut action "${action}":`, error)
        toast.error(`快捷鍵執行失敗: ${error.message}`)
      }
    } else {
      console.warn(`No handler found for action: ${action}`)
    }
  }

  const showActionFeedback = (action: string) => {
    const shortcut = shortcuts.value.find(s => s.action === action)
    if (shortcut && shortcut.name) {
      const message = `⌨️ ${shortcut.name}`
      toast.info(message, { timeout: 1000 })
    }
  }

  // Registration methods
  const registerHandler = (action: string, handler: (...args: any[]) => void) => {
    actionHandlers.value.set(action, handler)
  }

  const unregisterHandler = (action: string) => {
    actionHandlers.value.delete(action)
  }

  const registerMultipleHandlers = (handlers: Record<string, (...args: any[]) => void>) => {
    Object.entries(handlers).forEach(([action, handler]) => {
      registerHandler(action, handler)
    })
  }

  // Shortcut management
  const addShortcut = (shortcut: KeyboardShortcut) => {
    const existingIndex = shortcuts.value.findIndex(s => s.id === shortcut.id)
    if (existingIndex >= 0) {
      shortcuts.value[existingIndex] = shortcut
    } else {
      shortcuts.value.push(shortcut)
    }
    saveShortcuts()
  }

  const removeShortcut = (shortcutId: string) => {
    shortcuts.value = shortcuts.value.filter(s => s.id !== shortcutId)
    saveShortcuts()
  }

  const enableShortcut = (shortcutId: string) => {
    const shortcut = shortcuts.value.find(s => s.id === shortcutId)
    if (shortcut) {
      shortcut.enabled = true
      saveShortcuts()
    }
  }

  const disableShortcut = (shortcutId: string) => {
    const shortcut = shortcuts.value.find(s => s.id === shortcutId)
    if (shortcut) {
      shortcut.enabled = false
      saveShortcuts()
    }
  }

  const updateShortcutKeys = (shortcutId: string, newKeys: string[]) => {
    const shortcut = shortcuts.value.find(s => s.id === shortcutId)
    if (shortcut) {
      shortcut.keys = newKeys
      saveShortcuts()
    }
  }

  // Storage
  const saveShortcuts = () => {
    localStorage.setItem('kitchen-shortcuts', JSON.stringify(shortcuts.value))
  }

  const loadShortcuts = () => {
    const saved = localStorage.getItem('kitchen-shortcuts')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        shortcuts.value = [...DEFAULT_SHORTCUTS.map(defaultShortcut => {
          const savedShortcut = parsed.find((s: KeyboardShortcut) => s.id === defaultShortcut.id)
          return savedShortcut ? { ...defaultShortcut, ...savedShortcut } : defaultShortcut
        })]
      } catch (error) {
        console.warn('Failed to load shortcuts from storage:', error)
      }
    }
  }

  const resetToDefaults = () => {
    shortcuts.value = [...DEFAULT_SHORTCUTS]
    saveShortcuts()
    toast.success('快捷鍵設置已重設為預設值')
  }

  // Control methods
  const enable = () => {
    enabled.value = true
    toast.success('鍵盤快捷鍵已啟用')
  }

  const disable = () => {
    enabled.value = false
    activeKeys.value.clear()
    toast.info('鍵盤快捷鍵已停用')
  }

  const toggle = () => {
    if (enabled.value) {
      disable()
    } else {
      enable()
    }
  }

  // Help system
  const toggleHelp = () => {
    showHelp.value = !showHelp.value
  }

  const hideHelp = () => {
    showHelp.value = false
  }

  // Export/Import
  const exportShortcuts = () => {
    const data = {
      shortcuts: shortcuts.value,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `kitchen-shortcuts-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    
    toast.success('快捷鍵配置已導出')
  }

  const importShortcuts = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string)
          if (data.shortcuts && Array.isArray(data.shortcuts)) {
            shortcuts.value = data.shortcuts
            saveShortcuts()
            toast.success('快捷鍵配置已導入')
            resolve()
          } else {
            throw new Error('Invalid shortcut configuration format')
          }
        } catch (error: any) {
          toast.error('導入失敗: ' + error.message)
          reject(error)
        }
      }
      
      reader.onerror = () => {
        const error = new Error('File read error')
        toast.error('文件讀取失敗')
        reject(error)
      }
      
      reader.readAsText(file)
    })
  }

  // Lifecycle
  onMounted(() => {
    loadShortcuts()
    
    // Add event listeners
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    
    // Register built-in handlers
    registerHandler('show_shortcuts', toggleHelp)
  })

  onUnmounted(() => {
    // Remove event listeners
    document.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('keyup', handleKeyUp)
    window.removeEventListener('blur', handleBlur)
  })

  return {
    // State
    shortcuts,
    enabled,
    showHelp,
    activeKeys,
    actionQueue,
    shortcutGroups,

    // Registration
    registerHandler,
    unregisterHandler,
    registerMultipleHandlers,

    // Shortcut management
    addShortcut,
    removeShortcut,
    enableShortcut,
    disableShortcut,
    updateShortcutKeys,

    // Control
    enable,
    disable,
    toggle,

    // Help
    toggleHelp,
    hideHelp,

    // Utilities
    formatShortcut,
    getCategoryTitle,

    // Storage
    saveShortcuts,
    loadShortcuts,
    resetToDefaults,

    // Export/Import
    exportShortcuts,
    importShortcuts
  }
}
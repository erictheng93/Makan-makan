import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MenuItem, SelectedCustomizations, CartItem } from '@makanmakan/shared-types'

export const useCartStore = defineStore('cart', () => {
  // State
  const items = ref<CartItem[]>([])
  const restaurantId = ref<number | null>(null)
  const tableId = ref<number | null>(null)

  // Getters
  const itemCount = computed(() => {
    return items.value.reduce((total, item) => total + item.quantity, 0)
  })

  const subtotal = computed(() => {
    return items.value.reduce((total, item) => total + item.totalPrice, 0)
  })

  const isEmpty = computed(() => items.value.length === 0)

  const getItemById = (id: string) => {
    return items.value.find(item => item.id === id)
  }

  // Actions
  const initializeCart = (restId: number, tblId: number) => {
    // 如果是不同的餐廳/桌台，清空購物車
    if (restaurantId.value !== restId || tableId.value !== tblId) {
      clearCart()
    }
    
    restaurantId.value = restId
    tableId.value = tblId
    
    // 從 localStorage 恢復購物車
    restoreCart()
  }

  const addItem = (
    menuItem: MenuItem,
    quantity: number = 1,
    customizations?: SelectedCustomizations,
    notes?: string
  ) => {
    // 計算客製化後的價格
    const unitPrice = calculatePrice(menuItem, customizations)
    
    // 生成唯一ID（基於菜品ID + 客製化選項）
    const id = generateCartItemId(menuItem.id, customizations, notes)
    
    // 檢查是否已存在相同配置的項目
    const existingItem = getItemById(id)
    
    if (existingItem) {
      // 更新數量
      updateQuantity(id, existingItem.quantity + quantity)
    } else {
      // 新增項目
      const cartItem: CartItem = {
        id,
        menuItem,
        quantity,
        customizations,
        notes,
        price: unitPrice,
        totalPrice: unitPrice * quantity
      }
      
      items.value.push(cartItem)
    }
    
    saveCart()
  }

  const updateQuantity = (id: string, quantity: number) => {
    const item = getItemById(id)
    if (!item) return

    if (quantity <= 0) {
      removeItem(id)
    } else {
      item.quantity = quantity
      item.totalPrice = item.price * quantity
      saveCart()
    }
  }

  const removeItem = (id: string) => {
    const index = items.value.findIndex(item => item.id === id)
    if (index > -1) {
      items.value.splice(index, 1)
      saveCart()
    }
  }

  const clearCart = () => {
    items.value = []
    restaurantId.value = null
    tableId.value = null
    localStorage.removeItem(getCartStorageKey())
  }

  const updateItemNotes = (id: string, notes: string) => {
    const item = getItemById(id)
    if (item) {
      item.notes = notes
      saveCart()
    }
  }

  // Helper functions
  const calculatePrice = (menuItem: MenuItem, customizations?: SelectedCustomizations): number => {
    let price = menuItem.price

    if (!customizations) return price

    // 計算尺寸價格調整
    if (customizations.size) {
      price += customizations.size.priceAdjustment || 0
    }

    // 計算客製化選項價格
    if (customizations.options && customizations.options.length > 0) {
      for (const option of customizations.options) {
        price += option.priceAdjustment || 0
      }
    }

    // 計算加購項目價格
    if (customizations.addOns && customizations.addOns.length > 0) {
      for (const addOn of customizations.addOns) {
        price += addOn.unitPrice
      }
    }

    return Math.max(0, price) // 確保價格不為負數
  }

  const generateCartItemId = (
    menuItemId: number,
    customizations?: SelectedCustomizations,
    notes?: string
  ): string => {
    const parts = [menuItemId.toString()]
    
    if (customizations) {
      if (customizations.size) parts.push(`size:${customizations.size.id}`)
      
      if (customizations.options && customizations.options.length > 0) {
        const optionIds = customizations.options.map(opt => opt.id).sort().join(',')
        parts.push(`options:${optionIds}`)
      }
      
      if (customizations.addOns && customizations.addOns.length > 0) {
        const addonIds = customizations.addOns.map(addon => addon.id).sort().join(',')
        parts.push(`addons:${addonIds}`)
      }
    }
    
    if (notes?.trim()) {
      parts.push(`notes:${notes.trim()}`)
    }
    
    return parts.join('|')
  }

  const getCartStorageKey = () => {
    return `makanmakan_cart_${restaurantId.value}_${tableId.value}`
  }

  const saveCart = () => {
    if (!restaurantId.value || !tableId.value) return

    const cartData = {
      items: items.value,
      restaurantId: restaurantId.value,
      tableId: tableId.value,
      timestamp: Date.now()
    }

    try {
      localStorage.setItem(getCartStorageKey(), JSON.stringify(cartData))
    } catch (error) {
      console.warn('保存購物車失敗:', error)
    }
  }

  const restoreCart = () => {
    if (!restaurantId.value || !tableId.value) return

    try {
      const saved = localStorage.getItem(getCartStorageKey())
      if (!saved) return

      const { items: savedItems, timestamp } = JSON.parse(saved)
      
      // 檢查是否過期（2小時）
      if (Date.now() - timestamp > 2 * 60 * 60 * 1000) {
        localStorage.removeItem(getCartStorageKey())
        return
      }

      items.value = savedItems
      
    } catch (error) {
      console.warn('恢復購物車失敗:', error)
      localStorage.removeItem(getCartStorageKey())
    }
  }

  return {
    // State
    items,
    restaurantId,
    tableId,
    
    // Getters
    itemCount,
    subtotal,
    isEmpty,
    getItemById,
    
    // Actions
    initializeCart,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    updateItemNotes
  }
})
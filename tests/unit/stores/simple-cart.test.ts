import { describe, it, expect, beforeEach } from 'vitest'

// 簡單的購物車邏輯測試，不依賴 Pinia
describe('Simple Cart Logic', () => {
  interface CartItem {
    id: number
    name: string
    price: number
    quantity: number
    image_url?: string
    customizations?: any
  }

  class CartLogic {
    private items: CartItem[] = []

    // 基本方法
    getItems(): CartItem[] {
      return [...this.items]
    }

    addItem(newItem: CartItem): void {
      const existingItem = this.items.find(item => 
        item.id === newItem.id && 
        JSON.stringify(item.customizations) === JSON.stringify(newItem.customizations)
      )
      
      if (existingItem) {
        existingItem.quantity += newItem.quantity
      } else {
        this.items.push({ ...newItem })
      }
    }

    removeItem(id: number): void {
      const index = this.items.findIndex(item => item.id === id)
      if (index > -1) {
        this.items.splice(index, 1)
      }
    }

    updateQuantity(id: number, quantity: number): void {
      if (quantity <= 0) {
        this.removeItem(id)
        return
      }
      
      const item = this.items.find(item => item.id === id)
      if (item) {
        item.quantity = quantity
      }
    }

    clearCart(): void {
      this.items = []
    }

    // 計算方法
    getTotalItems(): number {
      return this.items.reduce((total, item) => total + item.quantity, 0)
    }

    getTotalPrice(): number {
      return this.items.reduce((total, item) => total + (item.price * item.quantity), 0)
    }

    isEmpty(): boolean {
      return this.items.length === 0
    }

    // 查詢方法
    getItemById(id: number): CartItem | undefined {
      return this.items.find(item => item.id === id)
    }

    hasItem(id: number): boolean {
      return this.items.some(item => item.id === id)
    }

    // 儲存方法（模擬）
    saveToStorage(): string {
      return JSON.stringify(this.items)
    }

    loadFromStorage(data: string): void {
      try {
        this.items = JSON.parse(data)
      } catch (error) {
        this.items = []
      }
    }
  }

  const mockCartItem: CartItem = {
    id: 1,
    name: '紅燒牛肉麵',
    price: 180,
    quantity: 1,
    image_url: '/images/beef-noodles.jpg'
  }

  let cart: CartLogic

  beforeEach(() => {
    cart = new CartLogic()
  })

  describe('初始狀態', () => {
    it('初始狀態為空購物車', () => {
      expect(cart.getItems()).toEqual([])
      expect(cart.getTotalItems()).toBe(0)
      expect(cart.getTotalPrice()).toBe(0)
      expect(cart.isEmpty()).toBe(true)
    })
  })

  describe('添加商品', () => {
    it('正確添加新商品到購物車', () => {
      cart.addItem(mockCartItem)
      
      expect(cart.getItems()).toHaveLength(1)
      expect(cart.getItems()[0]).toEqual(mockCartItem)
      expect(cart.getTotalItems()).toBe(1)
      expect(cart.getTotalPrice()).toBe(180)
      expect(cart.isEmpty()).toBe(false)
    })

    it('相同商品增加數量而非新增項目', () => {
      cart.addItem(mockCartItem)
      cart.addItem(mockCartItem)
      
      expect(cart.getItems()).toHaveLength(1)
      expect(cart.getItems()[0].quantity).toBe(2)
      expect(cart.getTotalItems()).toBe(2)
      expect(cart.getTotalPrice()).toBe(360)
    })

    it('不同商品分別添加', () => {
      const item2: CartItem = {
        id: 2,
        name: '排骨飯',
        price: 150,
        quantity: 1,
        image_url: '/images/pork-rice.jpg'
      }
      
      cart.addItem(mockCartItem)
      cart.addItem(item2)
      
      expect(cart.getItems()).toHaveLength(2)
      expect(cart.getTotalItems()).toBe(2)
      expect(cart.getTotalPrice()).toBe(330)
    })

    it('添加指定數量的商品', () => {
      const multipleItem = { ...mockCartItem, quantity: 3 }
      cart.addItem(multipleItem)
      
      expect(cart.getItems()[0].quantity).toBe(3)
      expect(cart.getTotalItems()).toBe(3)
      expect(cart.getTotalPrice()).toBe(540)
    })
  })

  describe('更新商品數量', () => {
    beforeEach(() => {
      cart.addItem(mockCartItem)
    })

    it('正確更新商品數量', () => {
      cart.updateQuantity(1, 5)
      
      expect(cart.getItems()[0].quantity).toBe(5)
      expect(cart.getTotalItems()).toBe(5)
      expect(cart.getTotalPrice()).toBe(900)
    })

    it('更新數量為 0 時移除商品', () => {
      cart.updateQuantity(1, 0)
      
      expect(cart.getItems()).toHaveLength(0)
      expect(cart.getTotalItems()).toBe(0)
      expect(cart.getTotalPrice()).toBe(0)
    })

    it('更新不存在的商品 ID 不影響購物車', () => {
      const originalItems = cart.getItems().length
      
      cart.updateQuantity(999, 5)
      
      expect(cart.getItems()).toHaveLength(originalItems)
    })
  })

  describe('移除商品', () => {
    beforeEach(() => {
      cart.addItem(mockCartItem)
      cart.addItem({
        id: 2,
        name: '排骨飯',
        price: 150,
        quantity: 2,
        image_url: '/images/pork-rice.jpg'
      })
    })

    it('正確移除指定商品', () => {
      cart.removeItem(1)
      
      expect(cart.getItems()).toHaveLength(1)
      expect(cart.getItems()[0].id).toBe(2)
      expect(cart.getTotalItems()).toBe(2)
      expect(cart.getTotalPrice()).toBe(300)
    })

    it('移除不存在的商品 ID 不影響購物車', () => {
      const originalItemsCount = cart.getItems().length
      
      cart.removeItem(999)
      
      expect(cart.getItems()).toHaveLength(originalItemsCount)
    })
  })

  describe('清空購物車', () => {
    beforeEach(() => {
      cart.addItem(mockCartItem)
      cart.addItem({
        id: 2,
        name: '排骨飯',
        price: 150,
        quantity: 2,
        image_url: '/images/pork-rice.jpg'
      })
    })

    it('正確清空購物車', () => {
      cart.clearCart()
      
      expect(cart.getItems()).toEqual([])
      expect(cart.getTotalItems()).toBe(0)
      expect(cart.getTotalPrice()).toBe(0)
      expect(cart.isEmpty()).toBe(true)
    })
  })

  describe('查詢方法', () => {
    beforeEach(() => {
      cart.addItem(mockCartItem)
    })

    it('根據 ID 查找商品', () => {
      const foundItem = cart.getItemById(1)
      const notFoundItem = cart.getItemById(999)
      
      expect(foundItem).toEqual(mockCartItem)
      expect(notFoundItem).toBeUndefined()
    })

    it('檢查商品是否在購物車中', () => {
      expect(cart.hasItem(1)).toBe(true)
      expect(cart.hasItem(999)).toBe(false)
    })
  })

  describe('客製化商品處理', () => {
    it('相同商品不同客製化選項分別添加', () => {
      const customizedItem1 = {
        ...mockCartItem,
        customizations: { spiceLevel: '中辣', extras: ['加蛋'] }
      }
      const customizedItem2 = {
        ...mockCartItem,
        customizations: { spiceLevel: '小辣', extras: ['加菜'] }
      }
      
      cart.addItem(customizedItem1)
      cart.addItem(customizedItem2)
      
      expect(cart.getItems()).toHaveLength(2)
      expect(cart.getItems()[0].customizations).toEqual({ spiceLevel: '中辣', extras: ['加蛋'] })
      expect(cart.getItems()[1].customizations).toEqual({ spiceLevel: '小辣', extras: ['加菜'] })
    })

    it('相同客製化選項的商品增加數量', () => {
      const customizedItem = {
        ...mockCartItem,
        customizations: { spiceLevel: '中辣', extras: ['加蛋'] }
      }
      
      cart.addItem(customizedItem)
      cart.addItem(customizedItem)
      
      expect(cart.getItems()).toHaveLength(1)
      expect(cart.getItems()[0].quantity).toBe(2)
    })
  })

  describe('數據持久化', () => {
    it('正確序列化購物車資料', () => {
      cart.addItem(mockCartItem)
      const serialized = cart.saveToStorage()
      
      expect(serialized).toBe(JSON.stringify([mockCartItem]))
    })

    it('正確反序列化購物車資料', () => {
      const savedData = JSON.stringify([mockCartItem])
      cart.loadFromStorage(savedData)
      
      expect(cart.getItems()).toEqual([mockCartItem])
    })

    it('處理無效的序列化資料', () => {
      cart.loadFromStorage('invalid json')
      
      expect(cart.getItems()).toEqual([])
    })
  })

  describe('計算方法正確性', () => {
    it('正確計算複雜購物車的總數和總價', () => {
      cart.addItem({ ...mockCartItem, quantity: 2 }) // 180 * 2 = 360
      cart.addItem({
        id: 2,
        name: '排骨飯',
        price: 150,
        quantity: 3, // 150 * 3 = 450
        image_url: '/images/pork-rice.jpg'
      })
      cart.addItem({
        id: 3,
        name: '珍奶',
        price: 60,
        quantity: 1, // 60 * 1 = 60
        image_url: '/images/bubble-tea.jpg'
      })
      
      expect(cart.getTotalItems()).toBe(6) // 2 + 3 + 1
      expect(cart.getTotalPrice()).toBe(870) // 360 + 450 + 60
      expect(cart.isEmpty()).toBe(false)
    })
  })
})
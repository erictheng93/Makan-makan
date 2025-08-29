import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import CartItemCard from '@/components/CartItemCard.vue'
import type { CartItem } from '@makanmakan/shared-types'

// Mock formatPrice function
vi.mock('@/utils/format', () => ({
  formatPrice: vi.fn((cents: number) => (cents / 100).toFixed(2))
}))

describe('CartItemCard.vue', () => {
  let wrapper: VueWrapper<any>
  
  const mockCartItem: CartItem = {
    id: 'cart-item-1',
    menuItem: {
      id: 1,
      restaurantId: 1,
      name: '牛肉麵',
      description: '香濃牛肉湯配手工麵條',
      price: 12000,
      imageUrl: '/images/beef-noodles.jpg',
      imageVariants: {
        thumbnail: '/images/beef-noodles-thumb.jpg'
      },
      categoryId: 1,
      isAvailable: true,
      inventoryCount: 50,
      spiceLevel: 1,
      sortOrder: 1,
      isFeatured: false,
      orderCount: 0,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    },
    quantity: 2,
    price: 14000, // 包含客製化價格調整
    totalPrice: 28000, // price * quantity
    customizations: {
      size: { id: '2', name: '大碗', priceAdjustment: 2000 },
      options: [
        { id: '1', name: '小辣', priceAdjustment: 0 }
      ],
      addOns: [
        { id: '1', name: '滷蛋', price: 1000 }
      ]
    },
    notes: '不要香菜'
  }

  beforeEach(() => {
    wrapper = mount(CartItemCard, {
      props: {
        item: mockCartItem
      }
    })
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('基本渲染', () => {
    it('應該正確渲染商品名稱', () => {
      expect(wrapper.text()).toContain('牛肉麵')
    })

    it('應該正確渲染商品圖片', () => {
      const img = wrapper.find('img')
      expect(img.exists()).toBe(true)
      expect(img.attributes('src')).toBe('/images/beef-noodles-thumb.jpg')
      expect(img.attributes('alt')).toBe('牛肉麵')
    })

    it('應該正確渲染數量', () => {
      expect(wrapper.text()).toContain('2')
    })

    it('應該正確渲染總價', () => {
      // 14000 * 2 = 28000 cents = $280.00
      expect(wrapper.text()).toContain('$280.00')
    })
  })

  describe('客製化資訊顯示', () => {
    it('應該顯示尺寸資訊', () => {
      expect(wrapper.text()).toContain('大碗')
    })

    it('應該顯示選項資訊', () => {
      expect(wrapper.text()).toContain('小辣')
    })

    it('應該顯示加購項目', () => {
      expect(wrapper.text()).toContain('+滷蛋')
    })

    it('應該將所有客製化資訊用逗號分隔', () => {
      const customizationText = wrapper.find('p.text-sm.text-gray-600')
      expect(customizationText.text()).toBe('大碗, 小辣, +滷蛋')
    })

    it('當沒有客製化時不應該顯示客製化區域', async () => {
      await wrapper.setProps({
        item: { ...mockCartItem, customizations: undefined }
      })
      
      const customizationArea = wrapper.find('p.text-sm.text-gray-600')
      expect(customizationArea.exists()).toBe(false)
    })
  })

  describe('數量控制', () => {
    it('應該顯示減少數量按鈕', () => {
      const decreaseBtn = wrapper.findAll('button')[0]
      expect(decreaseBtn.exists()).toBe(true)
    })

    it('應該顯示增加數量按鈕', () => {
      const buttons = wrapper.findAll('button')
      const increaseBtn = buttons.find(btn => 
        btn.find('svg').exists() && 
        btn.find('path[d="M12 4v16m8-8H4"]').exists()
      )
      expect(increaseBtn?.exists()).toBe(true)
    })

    it('點擊增加按鈕應該觸發 update-quantity 事件', async () => {
      const buttons = wrapper.findAll('button')
      const increaseBtn = buttons.find(btn => 
        btn.find('path[d="M12 4v16m8-8H4"]').exists()
      )
      
      await increaseBtn?.trigger('click')
      
      expect(wrapper.emitted('update-quantity')).toBeTruthy()
      expect(wrapper.emitted('update-quantity')![0]).toEqual(['cart-item-1', 3])
    })

    it('點擊減少按鈕應該觸發 update-quantity 事件', async () => {
      const buttons = wrapper.findAll('button')
      const decreaseBtn = buttons.find(btn => 
        btn.find('path[d="M20 12H4"]').exists()
      )
      
      await decreaseBtn?.trigger('click')
      
      expect(wrapper.emitted('update-quantity')).toBeTruthy()
      expect(wrapper.emitted('update-quantity')![0]).toEqual(['cart-item-1', 1])
    })

    it('當數量為 1 時減少按鈕應該被禁用', async () => {
      await wrapper.setProps({
        item: { ...mockCartItem, quantity: 1 }
      })
      
      const buttons = wrapper.findAll('button')
      const decreaseBtn = buttons.find(btn => 
        btn.find('path[d="M20 12H4"]').exists()
      )
      
      expect(decreaseBtn?.attributes('disabled')).toBeDefined()
      expect(decreaseBtn?.classes()).toContain('disabled:opacity-50')
    })

    it('當數量達到 99 時增加按鈕應該被禁用', async () => {
      await wrapper.setProps({
        item: { ...mockCartItem, quantity: 99 }
      })
      
      const buttons = wrapper.findAll('button')
      const increaseBtn = buttons.find(btn => 
        btn.find('path[d="M12 4v16m8-8H4"]').exists()
      )
      
      expect(increaseBtn?.attributes('disabled')).toBeDefined()
    })
  })

  describe('移除功能', () => {
    it('應該顯示移除按鈕', () => {
      const removeBtn = wrapper.findAll('button')[0]
      expect(removeBtn.exists()).toBe(true)
      expect(removeBtn.find('path[d="M6 18L18 6M6 6l12 12"]').exists()).toBe(true)
    })

    it('點擊移除按鈕應該觸發 remove 事件', async () => {
      const removeBtn = wrapper.findAll('button')[0]
      await removeBtn.trigger('click')
      
      expect(wrapper.emitted('remove')).toBeTruthy()
      expect(wrapper.emitted('remove')![0]).toEqual(['cart-item-1'])
    })
  })

  describe('備註功能', () => {
    it('應該顯示備註切換按鈕', () => {
      const toggleBtn = wrapper.find('button[data-testid="toggle-notes-btn"]')
      expect(toggleBtn.text()).toContain('新增備註')
    })

    it('當有備註時應該自動顯示備註輸入框', () => {
      const textarea = wrapper.find('textarea')
      expect(textarea.exists()).toBe(true)
      expect(textarea.element.value).toBe('不要香菜')
    })

    it('點擊切換按鈕應該顯示/隱藏備註輸入框', async () => {
      // 清除備註，重新渲染
      await wrapper.setProps({
        item: { ...mockCartItem, notes: undefined }
      })
      
      let textarea = wrapper.find('textarea')
      expect(textarea.exists()).toBe(false)
      
      // 點擊顯示備註
      const buttons = wrapper.findAll('button')
      const toggleBtn = buttons[buttons.length - 1]
      await toggleBtn.trigger('click')
      
      textarea = wrapper.find('textarea')
      expect(textarea.exists()).toBe(true)
      
      // 再次點擊隱藏備註
      await toggleBtn.trigger('click')
      
      textarea = wrapper.find('textarea')
      expect(textarea.exists()).toBe(false)
    })

    it('修改備註應該觸發 update-notes 事件', async () => {
      const textarea = wrapper.find('textarea')
      await textarea.setValue('新的備註內容')
      
      expect(wrapper.emitted('update-notes')).toBeTruthy()
      expect(wrapper.emitted('update-notes')![0]).toEqual(['cart-item-1', '新的備註內容'])
    })
  })

  describe('價格顯示', () => {
    it('應該顯示項目總價', () => {
      expect(wrapper.text()).toContain('$280.00')
    })

    it('當數量大於 1 時應該顯示單價和總價', () => {
      expect(wrapper.text()).toContain('($140.00 × 2)')
    })

    it('當數量為 1 時不應該顯示單價分解', async () => {
      await wrapper.setProps({
        item: { ...mockCartItem, quantity: 1 }
      })
      
      expect(wrapper.text()).not.toContain('×')
      expect(wrapper.text()).toContain('$140.00')
    })
  })

  describe('圖片處理', () => {
    it('應該優先使用 thumbnail 圖片', () => {
      const img = wrapper.find('img')
      expect(img.attributes('src')).toBe('/images/beef-noodles-thumb.jpg')
    })

    it('當沒有 thumbnail 時應該使用原始圖片', async () => {
      await wrapper.setProps({
        item: {
          ...mockCartItem,
          menuItem: {
            ...mockCartItem.menuItem,
            imageVariants: undefined
          }
        }
      })
      
      const img = wrapper.find('img')
      expect(img.attributes('src')).toBe('/images/beef-noodles.jpg')
    })

    it('當沒有圖片時應該顯示預設圖標', async () => {
      await wrapper.setProps({
        item: {
          ...mockCartItem,
          menuItem: {
            ...mockCartItem.menuItem,
            imageUrl: '',
            imageVariants: undefined
          }
        }
      })
      
      const img = wrapper.find('img')
      expect(img.exists()).toBe(false)
      
      const placeholder = wrapper.find('.text-gray-400 svg')
      expect(placeholder.exists()).toBe(true)
    })
  })

  describe('響應式設計', () => {
    it('應該有適當的響應式佈局類', () => {
      expect(wrapper.classes()).toContain('bg-white')
      expect(wrapper.classes()).toContain('rounded-2xl')
      expect(wrapper.classes()).toContain('shadow-sm')
    })

    it('應該使用 flexbox 佈局', () => {
      const container = wrapper.find('.flex')
      expect(container.exists()).toBe(true)
    })
  })

  describe('無障礙性', () => {
    it('應該為按鈕提供適當的標籤', () => {
      const buttons = wrapper.findAll('button')
      
      // 檢查是否有適當的 aria 屬性或文字內容
      buttons.forEach(button => {
        expect(
          button.attributes('aria-label') || 
          button.text().length > 0 ||
          button.find('svg').exists()
        ).toBeTruthy()
      })
    })

    it('textarea 應該有適當的標籤', () => {
      const textarea = wrapper.find('textarea')
      expect(textarea.attributes('placeholder')).toBeTruthy()
    })

    it('圖片應該有 alt 屬性', () => {
      const img = wrapper.find('img')
      expect(img.attributes('alt')).toBe('牛肉麵')
    })
  })

  describe('邊界情況', () => {
    it('應該處理極大的數量', async () => {
      await wrapper.setProps({
        item: { ...mockCartItem, quantity: 999 }
      })
      
      expect(wrapper.text()).toContain('999')
    })

    it('應該處理極長的商品名稱', async () => {
      await wrapper.setProps({
        item: {
          ...mockCartItem,
          menuItem: {
            ...mockCartItem.menuItem,
            name: '超級無敵美味香濃濃郁牛肉麵加上特製手工麵條和獨家秘製湯頭'
          }
        }
      })
      
      const nameElement = wrapper.find('h3')
      expect(nameElement.classes()).toContain('truncate')
    })

    it('應該處理空的客製化物件', async () => {
      await wrapper.setProps({
        item: {
          ...mockCartItem,
          customizations: {}
        }
      })
      
      const customizationText = wrapper.find('p.text-sm.text-gray-600')
      expect(customizationText.exists()).toBe(false)
    })
  })
})
import { Page, expect, Locator } from '@playwright/test'

/**
 * E2E 測試工具函數
 */

export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * 等待頁面完全載入
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForSelector('[data-testid="app-ready"]', { timeout: 10000 })
  }

  /**
   * 等待並點擊元素
   */
  async clickElement(selector: string | Locator) {
    const element = typeof selector === 'string' ? this.page.locator(selector) : selector
    await element.waitFor({ state: 'visible' })
    await element.click()
  }

  /**
   * 等待並填寫輸入框
   */
  async fillInput(selector: string | Locator, value: string) {
    const element = typeof selector === 'string' ? this.page.locator(selector) : selector
    await element.waitFor({ state: 'visible' })
    await element.clear()
    await element.fill(value)
  }

  /**
   * 檢查元素是否可見
   */
  async isVisible(selector: string | Locator): Promise<boolean> {
    const element = typeof selector === 'string' ? this.page.locator(selector) : selector
    try {
      await element.waitFor({ state: 'visible', timeout: 5000 })
      return true
    } catch {
      return false
    }
  }

  /**
   * 等待文字出現
   */
  async waitForText(text: string, timeout: number = 10000) {
    await this.page.waitForSelector(`text=${text}`, { timeout })
  }

  /**
   * 截圖
   */
  async screenshot(name: string) {
    await this.page.screenshot({
      path: `test-results/screenshots/${name}.png`,
      fullPage: true
    })
  }

  /**
   * 模擬 QR Code 掃描
   */
  async simulateQRScan(restaurantId: number, tableId: number) {
    // 模擬 QR 掃描結果
    const qrData = JSON.stringify({ restaurantId, tableId })
    await this.page.evaluate((data) => {
      // 模擬掃描成功事件
      window.dispatchEvent(new CustomEvent('qr-scan-success', { 
        detail: { content: data } 
      }))
    }, qrData)
  }

  /**
   * 模擬網路離線
   */
  async goOffline() {
    await this.page.context().setOffline(true)
  }

  /**
   * 模擬網路恢復
   */
  async goOnline() {
    await this.page.context().setOffline(false)
  }

  /**
   * 等待 API 請求完成
   */
  async waitForAPIResponse(urlPattern: string | RegExp) {
    return await this.page.waitForResponse(urlPattern, { timeout: 15000 })
  }

  /**
   * 模擬 API 響應
   */
  async mockAPIResponse(url: string | RegExp, response: any) {
    await this.page.route(url, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response)
      })
    })
  }

  /**
   * 切換語言
   */
  async switchLanguage(languageCode: string) {
    // 假設有語言切換下拉選單
    await this.clickElement('[data-testid="language-switcher"]')
    await this.clickElement(`[data-value="${languageCode}"]`)
    await this.page.waitForTimeout(1000) // 等待語言切換生效
  }

  /**
   * 檢查翻譯是否正確
   */
  async checkTranslation(key: string, expectedValue: string) {
    const element = this.page.locator(`[data-i18n="${key}"]`)
    await expect(element).toHaveText(expectedValue)
  }

  /**
   * 添加商品到購物車
   */
  async addItemToCart(itemName: string, quantity: number = 1) {
    // 找到商品卡片
    const itemCard = this.page.locator(`[data-testid="menu-item-card"]`).filter({ hasText: itemName }).first()
    
    // 點擊添加按鈕或進入詳情
    const addButton = itemCard.locator('[data-testid="add-to-cart-btn"]')
    const detailsButton = itemCard.locator('[data-testid="item-details-btn"]')
    
    if (await addButton.isVisible()) {
      // 直接添加
      for (let i = 0; i < quantity; i++) {
        await addButton.click()
        await this.page.waitForTimeout(500)
      }
    } else if (await detailsButton.isVisible()) {
      // 進入詳情頁面
      await detailsButton.click()
      
      // 調整數量
      if (quantity > 1) {
        const quantityInput = this.page.locator('[data-testid="quantity-input"]')
        await quantityInput.clear()
        await quantityInput.fill(quantity.toString())
      }
      
      // 添加到購物車
      await this.clickElement('[data-testid="add-to-cart-modal-btn"]')
    }
  }

  /**
   * 檢查購物車商品數量
   */
  async checkCartItemCount(expectedCount: number) {
    const cartBadge = this.page.locator('[data-testid="cart-badge"]')
    if (expectedCount > 0) {
      await expect(cartBadge).toHaveText(expectedCount.toString())
    } else {
      await expect(cartBadge).not.toBeVisible()
    }
  }

  /**
   * 提交訂單
   */
  async submitOrder(customerInfo?: { name?: string; phone?: string; notes?: string }) {
    // 進入購物車
    await this.clickElement('[data-testid="cart-link"]')
    
    // 填寫顧客資訊
    if (customerInfo?.name) {
      await this.fillInput('[data-testid="customer-name"]', customerInfo.name)
    }
    
    if (customerInfo?.phone) {
      await this.fillInput('[data-testid="customer-phone"]', customerInfo.phone)
    }
    
    if (customerInfo?.notes) {
      await this.fillInput('[data-testid="order-notes"]', customerInfo.notes)
    }
    
    // 提交訂單
    await this.clickElement('[data-testid="submit-order-btn"]')
    
    // 確認提交
    await this.clickElement('[data-testid="confirm-submit-btn"]')
  }

  /**
   * 檢查訂單狀態
   */
  async checkOrderStatus(expectedStatus: string) {
    const statusElement = this.page.locator('[data-testid="order-status"]')
    await expect(statusElement).toContainText(expectedStatus)
  }
}

/**
 * 測試數據生成器
 */
export class TestDataGenerator {
  static generateRestaurantData() {
    return {
      id: 1,
      name: 'Test Restaurant',
      description: 'A test restaurant for E2E testing',
      imageUrl: '/images/test-restaurant.jpg',
      businessHours: {
        monday: '09:00-22:00',
        tuesday: '09:00-22:00',
        wednesday: '09:00-22:00',
        thursday: '09:00-22:00',
        friday: '09:00-22:00',
        saturday: '09:00-22:00',
        sunday: '09:00-22:00'
      },
      isOpen: true
    }
  }

  static generateMenuData() {
    return {
      restaurant: this.generateRestaurantData(),
      categories: [
        {
          id: 1,
          name: '主餐',
          description: '主要餐點',
          sortOrder: 1
        },
        {
          id: 2,
          name: '飲品',
          description: '各種飲料',
          sortOrder: 2
        }
      ],
      menuItems: [
        {
          id: 1,
          name: '牛肉麵',
          description: '香濃牛肉湯配手工麵條',
          price: 12000, // 120.00 in cents
          imageUrl: '/images/beef-noodles.jpg',
          categoryId: 1,
          isAvailable: true,
          inventoryCount: 50,
          spiceLevel: 1,
          featured: true,
          orderCount: 256
        },
        {
          id: 2,
          name: '珍珠奶茶',
          description: '經典台式珍珠奶茶',
          price: 6000, // 60.00 in cents
          imageUrl: '/images/bubble-tea.jpg',
          categoryId: 2,
          isAvailable: true,
          inventoryCount: 100,
          spiceLevel: 0,
          featured: false,
          orderCount: 189
        }
      ],
      featuredItems: [
        // 特色商品，引用上面的牛肉麵
      ]
    }
  }

  static generateOrderData() {
    return {
      id: 1,
      restaurantId: 1,
      tableId: 5,
      customerName: 'Test Customer',
      customerPhone: '0912345678',
      status: 0, // pending
      items: [
        {
          id: 1,
          menuItemId: 1,
          quantity: 1,
          price: 12000,
          totalPrice: 12000,
          notes: '不要辣',
          customizations: {}
        }
      ],
      subtotal: 12000,
      serviceCharge: 1200,
      tax: 660,
      total: 13860,
      notes: '測試訂單',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  }
}
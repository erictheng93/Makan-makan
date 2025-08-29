import { Page, expect, Locator } from '@playwright/test'

/**
 * 點餐流程測試輔助類
 */
export class OrderingHelper {
  constructor(private page: Page) {}

  /**
   * 掃描 QR Code 進入餐廳
   */
  async scanQRCodeToRestaurant(restaurantId: string, tableNumber: string) {
    await this.page.goto(`/menu/${restaurantId}/table-${tableNumber}`)
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * 添加商品到購物車
   */
  async addItemToCart(itemId: string, quantity: number = 1) {
    for (let i = 0; i < quantity; i++) {
      await this.page.locator(`[data-testid="menu-item-${itemId}"] [data-testid="add-btn"]`).click()
      await this.page.waitForTimeout(300) // 等待動畫完成
    }
  }

  /**
   * 添加客製化商品到購物車
   */
  async addCustomizedItemToCart(itemId: string, customizations: {
    spiceLevel?: string
    extras?: string[]
    notes?: string
  }) {
    // 點擊商品開啟客製化彈窗
    await this.page.locator(`[data-testid="menu-item-${itemId}"]`).click()
    await expect(this.page.locator('[data-testid="customization-modal"]')).toBeVisible()

    // 選擇辣度
    if (customizations.spiceLevel) {
      await this.page.locator(`[data-testid="spice-level-${customizations.spiceLevel}"]`).click()
    }

    // 選擇額外配料
    if (customizations.extras) {
      for (const extra of customizations.extras) {
        await this.page.locator(`[data-testid="extra-${extra}"]`).check()
      }
    }

    // 添加備註
    if (customizations.notes) {
      await this.page.locator('[data-testid="special-notes"]').fill(customizations.notes)
    }

    // 確認添加
    await this.page.locator('[data-testid="add-customized-item"]').click()
    await expect(this.page.locator('[data-testid="customization-modal"]')).not.toBeVisible()
  }

  /**
   * 前往購物車
   */
  async goToCart() {
    await this.page.locator('[data-testid="cart-btn"]').click()
    await expect(this.page.locator('h2')).toContainText('您的訂單')
  }

  /**
   * 更新購物車商品數量
   */
  async updateItemQuantity(itemId: string, quantity: number) {
    const currentQuantity = await this.page.locator(`[data-testid="item-quantity-${itemId}"]`).textContent()
    const current = parseInt(currentQuantity || '0')
    const difference = quantity - current

    if (difference > 0) {
      for (let i = 0; i < difference; i++) {
        await this.page.locator(`[data-testid="quantity-increase-${itemId}"]`).click()
      }
    } else if (difference < 0) {
      for (let i = 0; i < Math.abs(difference); i++) {
        await this.page.locator(`[data-testid="quantity-decrease-${itemId}"]`).click()
      }
    }

    await expect(this.page.locator(`[data-testid="item-quantity-${itemId}"]`)).toHaveText(quantity.toString())
  }

  /**
   * 移除購物車商品
   */
  async removeItemFromCart(itemId: string) {
    await this.page.locator(`[data-testid="remove-item-${itemId}"]`).click()
    
    // 確認移除對話框
    await expect(this.page.locator('[data-testid="confirm-remove-modal"]')).toBeVisible()
    await this.page.locator('[data-testid="confirm-remove-btn"]').click()
    
    await expect(this.page.locator(`[data-testid="cart-item-${itemId}"]`)).not.toBeVisible()
  }

  /**
   * 填寫顧客資訊
   */
  async fillCustomerInfo(customerInfo: {
    name: string
    phone: string
    email?: string
    notes?: string
  }) {
    await this.page.locator('[data-testid="customer-name"]').fill(customerInfo.name)
    await this.page.locator('[data-testid="customer-phone"]').fill(customerInfo.phone)
    
    if (customerInfo.email) {
      await this.page.locator('[data-testid="customer-email"]').fill(customerInfo.email)
    }
    
    if (customerInfo.notes) {
      await this.page.locator('[data-testid="order-notes"]').fill(customerInfo.notes)
    }
  }

  /**
   * 提交訂單
   */
  async submitOrder(): Promise<string> {
    await this.page.locator('[data-testid="submit-order-btn"]').click()
    
    // 等待訂單提交成功
    await expect(this.page.locator('[data-testid="order-success-message"]')).toBeVisible()
    
    // 取得訂單編號
    const orderNumber = await this.page.locator('[data-testid="order-number"]').textContent()
    return orderNumber || ''
  }

  /**
   * 檢查購物車數量
   */
  async expectCartCount(count: number) {
    await expect(this.page.locator('[data-testid="cart-count"]')).toHaveText(count.toString())
  }

  /**
   * 檢查總金額
   */
  async expectTotalPrice(price: number) {
    await expect(this.page.locator('[data-testid="total-price"]')).toContainText(`NT$${price}`)
  }
}

/**
 * 管理後台測試輔助類
 */
export class AdminHelper {
  constructor(private page: Page) {}

  /**
   * 管理員登入
   */
  async login(credentials: { email: string; password: string }) {
    await this.page.goto('/admin/login')
    await this.page.locator('[data-testid="email"]').fill(credentials.email)
    await this.page.locator('[data-testid="password"]').fill(credentials.password)
    await this.page.locator('[data-testid="login-btn"]').click()
    
    await expect(this.page.locator('h1')).toContainText('管理後台')
  }

  /**
   * 前往菜單管理
   */
  async goToMenuManagement() {
    await this.page.locator('[data-testid="menu-management"]').click()
    await expect(this.page.locator('h2')).toContainText('菜單管理')
  }

  /**
   * 新增菜品
   */
  async addMenuItem(item: {
    name: string
    price: string
    description: string
    category: string
    imagePath?: string
  }) {
    await this.page.locator('[data-testid="add-item-btn"]').click()
    
    await this.page.locator('[data-testid="item-name"]').fill(item.name)
    await this.page.locator('[data-testid="item-price"]').fill(item.price)
    await this.page.locator('[data-testid="item-description"]').fill(item.description)
    await this.page.locator('[data-testid="item-category"]').selectOption(item.category)
    
    if (item.imagePath) {
      await this.page.locator('[data-testid="image-upload"]').setInputFiles(item.imagePath)
    }
    
    await this.page.locator('[data-testid="save-item-btn"]').click()
    
    // 確認新菜品出現在列表中
    await expect(this.page.locator(`[data-testid="menu-item"][data-name="${item.name}"]`)).toBeVisible()
  }

  /**
   * 前往訂單管理
   */
  async goToOrderManagement() {
    await this.page.locator('[data-testid="order-management"]').click()
    await expect(this.page.locator('h2')).toContainText('訂單管理')
  }

  /**
   * 更新訂單狀態
   */
  async updateOrderStatus(orderId: string, status: string) {
    await this.page.locator(`[data-testid="order-${orderId}"] [data-testid="status-dropdown"]`).selectOption(status)
    
    // 確認狀態更新
    await expect(this.page.locator(`[data-testid="order-${orderId}"] [data-testid="order-status"]`)).toContainText(this.getStatusText(status))
  }

  /**
   * 前往桌號管理
   */
  async goToTableManagement() {
    await this.page.locator('[data-testid="table-management"]').click()
    await expect(this.page.locator('h2')).toContainText('桌號管理')
  }

  /**
   * 新增桌號
   */
  async addTable(tableInfo: { number: string; seats: string }) {
    await this.page.locator('[data-testid="add-table-btn"]').click()
    
    await this.page.locator('[data-testid="table-number"]').fill(tableInfo.number)
    await this.page.locator('[data-testid="table-seats"]').fill(tableInfo.seats)
    
    await this.page.locator('[data-testid="save-table-btn"]').click()
    
    // 確認新桌號出現在列表中
    await expect(this.page.locator(`[data-testid="table-${tableInfo.number}"]`)).toBeVisible()
  }

  /**
   * 產生桌號 QR Code
   */
  async generateTableQRCode(tableNumber: string) {
    await this.page.locator(`[data-testid="table-${tableNumber}"] [data-testid="generate-qr-btn"]`).click()
    
    // 確認 QR Code 彈窗出現
    await expect(this.page.locator('[data-testid="qr-code-modal"]')).toBeVisible()
    await expect(this.page.locator('[data-testid="qr-code-image"]')).toBeVisible()
  }

  /**
   * 取得訂單狀態文字
   */
  private getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      'pending': '待處理',
      'confirmed': '已確認',
      'preparing': '製作中',
      'ready': '待取餐',
      'completed': '已完成',
      'cancelled': '已取消'
    }
    return statusMap[status] || status
  }
}

/**
 * 訂單追蹤測試輔助類
 */
export class OrderTrackingHelper {
  constructor(private page: Page) {}

  /**
   * 前往訂單追蹤頁面
   */
  async goToOrderTracking(orderId: string) {
    await this.page.goto(`/order-tracking/${orderId}`)
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * 檢查訂單狀態
   */
  async expectOrderStatus(status: string) {
    const statusText = this.getStatusText(status)
    await expect(this.page.locator('[data-testid="current-status"]')).toContainText(statusText)
  }

  /**
   * 檢查時間線步驟
   */
  async expectTimelineStep(step: string, state: 'completed' | 'active' | 'pending') {
    const stepLocator = this.page.locator(`[data-testid="timeline-step-${step}"]`)
    await expect(stepLocator).toHaveClass(new RegExp(state))
  }

  /**
   * 檢查預估完成時間
   */
  async expectEstimatedTime(minutes: number) {
    await expect(this.page.locator('[data-testid="estimated-time"]')).toContainText(`${minutes} 分鐘`)
  }

  /**
   * 取得訂單狀態文字
   */
  private getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      'pending': '等待確認',
      'confirmed': '已確認',
      'preparing': '製作中',
      'ready': '餐點就緒',
      'completed': '已取餐',
      'cancelled': '已取消'
    }
    return statusMap[status] || status
  }
}

/**
 * 通用測試工具
 */
export class TestUtils {
  constructor(private page: Page) {}

  /**
   * 等待網路請求完成
   */
  async waitForNetworkIdle() {
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * 等待載入完成
   */
  async waitForLoading() {
    await this.page.waitForSelector('[data-testid="loading"]', { state: 'detached' })
  }

  /**
   * 截圖
   */
  async takeScreenshot(name: string) {
    await this.page.screenshot({ path: `tests/screenshots/${name}.png`, fullPage: true })
  }

  /**
   * 檢查可訪問性
   */
  async checkAccessibility() {
    // 這裡可以整合 axe-playwright 進行可訪問性檢查
    console.log('可訪問性檢查功能待實作')
  }

  /**
   * 模擬網路狀況
   */
  async simulateNetworkCondition(condition: 'slow' | 'offline') {
    if (condition === 'slow') {
      await this.page.route('**/*', route => {
        setTimeout(() => route.continue(), 2000) // 延遲 2 秒
      })
    } else if (condition === 'offline') {
      await this.page.route('**/*', route => {
        route.abort('internetdisconnected')
      })
    }
  }
}

/**
 * 測試資料生成器
 */
export class TestDataGenerator {
  /**
   * 生成測試訂單資料
   */
  static generateOrderData() {
    return {
      customerName: `測試顾客_${Date.now()}`,
      customerPhone: '0912345678',
      items: [
        { id: 1, name: '紅燒牛肉麵', price: 180, quantity: 1 },
        { id: 2, name: '招牌排骨飯', price: 150, quantity: 2 }
      ],
      totalAmount: 480,
      notes: '測試訂單備註'
    }
  }

  /**
   * 生成測試菜品資料
   */
  static generateMenuItemData() {
    const timestamp = Date.now()
    return {
      name: `測試菜品_${timestamp}`,
      price: '199',
      description: '這是一道測試菜品的描述',
      category: '主食'
    }
  }

  /**
   * 生成測試桌號資料
   */
  static generateTableData() {
    return {
      number: `T${Date.now().toString().slice(-3)}`,
      seats: '4'
    }
  }
}
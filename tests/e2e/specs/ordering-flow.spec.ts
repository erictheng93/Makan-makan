import { test, expect } from '@playwright/test'
import { OrderingHelper, TestDataGenerator } from '../support/test-helpers'

test.describe('顧客點餐流程', () => {
  let orderingHelper: OrderingHelper

  test.beforeEach(async ({ page }) => {
    orderingHelper = new OrderingHelper(page)
    
    // 掃描 QR Code 進入餐廳
    await orderingHelper.scanQRCodeToRestaurant('test-restaurant-123', '1')
    
    // 確認頁面載入完成
    await expect(page.locator('h1')).toContainText('美味餐廳菜單')
    await expect(page.locator('[data-testid="loading"]')).not.toBeVisible()
  })

  test('完整點餐流程 - 基本商品', async ({ page }) => {
    // 1. 查看菜單內容
    await expect(page.locator('[data-testid="menu-categories"]')).toBeVisible()
    await expect(page.locator('[data-testid="menu-item"]')).toHaveCount(3, { timeout: 10000 })

    // 2. 添加商品到購物車
    await orderingHelper.addItemToCart('1', 2) // 紅燒牛肉麵 x2
    await orderingHelper.addItemToCart('2', 1) // 招牌排骨飯 x1

    // 3. 檢查購物車數量和總額
    await orderingHelper.expectCartCount(3)
    await orderingHelper.expectTotalPrice(510) // 180*2 + 150*1

    // 4. 進入購物車頁面
    await orderingHelper.goToCart()

    // 5. 驗證購物車內容
    await expect(page.locator('[data-testid="cart-item-1"]')).toBeVisible()
    await expect(page.locator('[data-testid="cart-item-2"]')).toBeVisible()
    await expect(page.locator('[data-testid="item-quantity-1"]')).toHaveText('2')
    await expect(page.locator('[data-testid="item-quantity-2"]')).toHaveText('1')

    // 6. 修改商品數量
    await orderingHelper.updateItemQuantity('1', 3)
    await orderingHelper.expectTotalPrice(690) // 180*3 + 150*1

    // 7. 填寫顾客資訊
    const customerData = TestDataGenerator.generateOrderData()
    await orderingHelper.fillCustomerInfo({
      name: customerData.customerName,
      phone: customerData.customerPhone,
      notes: customerData.notes
    })

    // 8. 提交訂單
    const orderNumber = await orderingHelper.submitOrder()

    // 9. 確認訂單提交成功
    await expect(page.locator('[data-testid="order-success-message"]')).toContainText('訂單提交成功')
    expect(orderNumber).toMatch(/^#\d+/)
    
    // 10. 確認跳轉到訂單追蹤頁面
    await expect(page.url()).toContain('/order-tracking/')
    await expect(page.locator('[data-testid="order-status"]')).toContainText('等待確認')
  })

  test('客製化商品點餐流程', async ({ page }) => {
    // 1. 點擊有客製化選項的商品
    await page.locator('[data-testid="menu-item-1"]').click()

    // 2. 確認客製化彈窗出現
    await expect(page.locator('[data-testid="customization-modal"]')).toBeVisible()
    await expect(page.locator('[data-testid="modal-title"]')).toContainText('紅燒牛肉麵')

    // 3. 選擇客製化選項
    await orderingHelper.addCustomizedItemToCart('1', {
      spiceLevel: 'medium',
      extras: ['cheese', 'egg'],
      notes: '少油少鹽，謝謝'
    })

    // 4. 進入購物車檢查客製化資訊
    await orderingHelper.goToCart()
    
    const customizationInfo = page.locator('[data-testid="item-customization-1"]')
    await expect(customizationInfo).toContainText('中辣')
    await expect(customizationInfo).toContainText('加起司')
    await expect(customizationInfo).toContainText('加蛋')
    await expect(page.locator('[data-testid="item-notes-1"]')).toContainText('少油少鹽，謝謝')

    // 5. 確認客製化商品價格正確計算
    const expectedPrice = 180 + 20 + 15 // 基本價格 + 起司 + 蛋
    await expect(page.locator('[data-testid="item-total-1"]')).toContainText(`NT$${expectedPrice}`)
  })

  test('購物車管理功能', async ({ page }) => {
    // 1. 添加多個商品
    await orderingHelper.addItemToCart('1', 2)
    await orderingHelper.addItemToCart('2', 1)
    await orderingHelper.addItemToCart('3', 3)

    await orderingHelper.goToCart()

    // 2. 測試數量調整
    await orderingHelper.updateItemQuantity('1', 1)
    await orderingHelper.updateItemQuantity('3', 2)
    
    // 確認總額更新
    const expectedTotal = 180 * 1 + 150 * 1 + 60 * 2 // 牛肉麵*1 + 排骨飯*1 + 珍奶*2
    await orderingHelper.expectTotalPrice(expectedTotal)

    // 3. 測試商品移除
    await orderingHelper.removeItemFromCart('2')
    
    // 確認商品已移除
    await expect(page.locator('[data-testid="cart-item-2"]')).not.toBeVisible()
    
    // 確認總額更新
    const newTotal = 180 * 1 + 60 * 2
    await orderingHelper.expectTotalPrice(newTotal)

    // 4. 測試清空購物車
    await page.locator('[data-testid="clear-cart-btn"]').click()
    await expect(page.locator('[data-testid="confirm-clear-modal"]')).toBeVisible()
    await page.locator('[data-testid="confirm-clear-btn"]').click()
    
    await expect(page.locator('[data-testid="empty-cart-message"]')).toBeVisible()
    await orderingHelper.expectCartCount(0)
  })

  test('表單驗證功能', async ({ page }) => {
    // 1. 添加商品
    await orderingHelper.addItemToCart('1', 1)
    await orderingHelper.goToCart()

    // 2. 嘗試不填資訊直接提交
    await page.locator('[data-testid="submit-order-btn"]').click()
    
    // 確認顯示驗證錯誤
    await expect(page.locator('[data-testid="name-error"]')).toContainText('請輸入姓名')
    await expect(page.locator('[data-testid="phone-error"]')).toContainText('請輸入手機號碼')

    // 3. 填入無效手機號碼
    await page.locator('[data-testid="customer-name"]').fill('王小明')
    await page.locator('[data-testid="customer-phone"]').fill('123')
    await page.locator('[data-testid="submit-order-btn"]').click()
    
    await expect(page.locator('[data-testid="phone-error"]')).toContainText('手機號碼格式不正確')

    // 4. 填入正確資訊
    await page.locator('[data-testid="customer-phone"]').fill('0912345678')
    await page.locator('[data-testid="submit-order-btn"]').click()
    
    // 確認提交成功
    await expect(page.locator('[data-testid="order-success-message"]')).toBeVisible()
  })

  test('響應式設計 - 手機版', async ({ page }) => {
    // 設置手機視窗大小
    await page.setViewportSize({ width: 375, height: 667 })

    // 1. 確認手機版菜單正確顯示
    await expect(page.locator('[data-testid="mobile-menu-grid"]')).toBeVisible()
    await expect(page.locator('[data-testid="desktop-menu-grid"]')).not.toBeVisible()

    // 2. 測試手機版購物車
    await orderingHelper.addItemToCart('1', 1)
    
    // 確認浮動購物車按鈕顯示
    await expect(page.locator('[data-testid="floating-cart-btn"]')).toBeVisible()
    
    await page.locator('[data-testid="floating-cart-btn"]').click()
    
    // 確認購物車從底部滑出
    await expect(page.locator('[data-testid="mobile-cart-drawer"]')).toBeVisible()
  })

  test('錯誤處理 - 網路異常', async ({ page }) => {
    // 1. 添加商品到購物車
    await orderingHelper.addItemToCart('1', 1)
    await orderingHelper.goToCart()

    // 2. 填寫顧客資訊
    await orderingHelper.fillCustomerInfo({
      name: '測試顧客',
      phone: '0912345678'
    })

    // 3. 模擬網路錯誤
    await page.route('**/api/v1/orders', route => {
      route.abort('failed')
    })

    // 4. 嘗試提交訂單
    await page.locator('[data-testid="submit-order-btn"]').click()

    // 5. 確認錯誤訊息顯示
    await expect(page.locator('[data-testid="error-message"]')).toContainText('網路連線異常')
    await expect(page.locator('[data-testid="retry-btn"]')).toBeVisible()

    // 6. 測試重試功能
    await page.unroute('**/api/v1/orders')
    await page.locator('[data-testid="retry-btn"]').click()

    // 確認訂單提交成功
    await expect(page.locator('[data-testid="order-success-message"]')).toBeVisible()
  })

  test('商品庫存不足處理', async ({ page }) => {
    // 1. 模擬商品庫存不足
    await page.route('**/api/v1/menu/test-restaurant-123', route => {
      const mockResponse = {
        categories: [
          {
            id: 1,
            name: '主食',
            items: [
              {
                id: 1,
                name: '紅燒牛肉麵',
                price: 180,
                available: false, // 設置為不可用
                stock: 0
              }
            ]
          }
        ]
      }
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse)
      })
    })

    // 2. 重新載入頁面
    await page.reload()
    await page.waitForLoadState('networkidle')

    // 3. 確認商品顯示為不可用
    const menuItem = page.locator('[data-testid="menu-item-1"]')
    await expect(menuItem.locator('[data-testid="unavailable-badge"]')).toBeVisible()
    await expect(menuItem.locator('[data-testid="add-to-cart-btn"]')).toBeDisabled()

    // 4. 嘗試點擊不可用商品
    await menuItem.click()
    await expect(page.locator('[data-testid="unavailable-message"]')).toContainText('此商品暫時無法提供')
  })
})
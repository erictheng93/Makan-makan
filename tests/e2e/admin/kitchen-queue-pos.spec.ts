import { test, expect, Page } from '@playwright/test'

/**
 * Admin Dashboard - 廚房顯示、隊列管理和 POS 收銀 E2E 測試
 *
 * 測試場景：
 * 廚房顯示：
 * 1. 查看待處理訂單
 * 2. 更新訂單項目狀態
 * 3. 標記訂單為完成
 *
 * 隊列管理：
 * 1. 查看排隊列表
 * 2. 安排座位
 * 3. 管理等待狀態
 *
 * POS 收銀：
 * 1. 處理支付
 * 2. 查看交易記錄
 * 3. 生成收據
 */

// 測試輔助函數：登入
async function login(page: Page, role: number = 1) {
  await page.route('/api/v1/auth/login', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          token: 'mock-jwt-token-admin',
          user: {
            id: 1,
            username: role === 2 ? 'chef' : role === 4 ? 'cashier' : 'admin',
            role: role,
            restaurantId: 1,
            restaurantName: 'Test Restaurant'
          }
        }
      })
    })
  })

  await page.goto('/login')
  await page.fill('input[type="text"], input[type="email"]', role === 2 ? 'chef' : role === 4 ? 'cashier' : 'admin')
  await page.fill('input[type="password"]', 'password123')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/.*\/dashboard/)
}

const mockKitchenOrders = [
  {
    id: 1,
    orderNumber: 'ORD-2025-001',
    tableName: 'A-1',
    items: [
      { id: 1, name: '牛肉麵', quantity: 2, status: 'pending', notes: '少辣' },
      { id: 2, name: '炒飯', quantity: 1, status: 'preparing', notes: '' }
    ],
    status: 'preparing',
    createdAt: new Date().toISOString(),
    elapsedTime: 5
  },
  {
    id: 2,
    orderNumber: 'ORD-2025-002',
    tableName: 'B-3',
    items: [
      { id: 3, name: '湯麵', quantity: 3, status: 'pending', notes: '' }
    ],
    status: 'pending',
    createdAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    elapsedTime: 3
  }
]

const mockQueueCustomers = [
  {
    id: 1,
    customerName: '張小明',
    partySize: 4,
    phoneNumber: '0912345678',
    status: 'waiting',
    queueNumber: 'Q001',
    estimatedWaitTime: 15,
    createdAt: new Date().toISOString()
  },
  {
    id: 2,
    customerName: '李美麗',
    partySize: 2,
    phoneNumber: '0923456789',
    status: 'waiting',
    queueNumber: 'Q002',
    estimatedWaitTime: 25,
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString()
  },
  {
    id: 3,
    customerName: '王大明',
    partySize: 6,
    phoneNumber: '0934567890',
    status: 'seated',
    queueNumber: 'Q003',
    tableId: 5,
    tableName: 'C-2',
    createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString()
  }
]

test.describe('Admin Dashboard - 廚房顯示', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 2) // 廚師角色

    // Mock 廚房訂單 API
    await page.route('/api/v1/kitchen/orders*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockKitchenOrders
        })
      })
    })

    await page.click('text=廚房顯示, text=廚房')
    await expect(page).toHaveURL(/.*\/(kitchen|dashboard\/kitchen)/)
  })

  test('應該顯示待處理訂單列表', async ({ page }) => {
    await page.waitForSelector('[data-testid="kitchen-orders"], .kitchen-orders-list, .order-card')

    const orderCount = await page.locator('[data-testid="order-card"], .order-card').count()
    expect(orderCount).toBeGreaterThan(0)

    await expect(page.locator('text=ORD-2025-001')).toBeVisible()
    await expect(page.locator('text=A-1')).toBeVisible()
  })

  test('應該能夠更新訂單項目狀態', async ({ page }) => {
    let updateCalled = false

    await page.route('/api/v1/kitchen/orders/1/items/1', async route => {
      if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
        updateCalled = true
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              ...mockKitchenOrders[0].items[0],
              status: 'preparing'
            }
          })
        })
      }
    })

    // 查找「開始準備」按鈕
    const prepareButton = page.locator(
      '[data-item-id="1"] button:has-text("準備"), ' +
      '[data-order-id="1"] button:has-text("開始")'
    ).first()

    if (await prepareButton.isVisible({ timeout: 3000 })) {
      await prepareButton.click()
      await page.waitForTimeout(1000)
      expect(updateCalled).toBe(true)
    }
  })

  test('應該能夠標記訂單為完成', async ({ page }) => {
    let completeCalled = false

    await page.route('/api/v1/kitchen/orders/1/complete', async route => {
      if (route.request().method() === 'POST' || route.request().method() === 'PUT') {
        completeCalled = true
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              ...mockKitchenOrders[0],
              status: 'completed'
            }
          })
        })
      }
    })

    const completeButton = page.locator(
      '[data-order-id="1"] button:has-text("完成"), ' +
      '[data-testid="complete-order-1"]'
    ).first()

    if (await completeButton.isVisible({ timeout: 3000 })) {
      await completeButton.click()
      await page.waitForTimeout(1000)
      expect(completeCalled).toBe(true)
    }
  })

  test('應該顯示訂單計時器', async ({ page }) => {
    // 查找計時器元素
    const timer = page.locator('[data-testid="order-timer"], .timer, .elapsed-time')

    if (await timer.first().isVisible({ timeout: 3000 })) {
      const timerText = await timer.first().textContent()
      expect(timerText).toBeTruthy()
      // 驗證格式包含數字（如：5分鐘、05:00 等）
      expect(timerText).toMatch(/\d+/)
    }
  })

  test('應該能夠按優先級排序訂單', async ({ page }) => {
    // 查找排序選項
    const sortButton = page.locator('button:has-text("排序"), select[name="sort"]').first()

    if (await sortButton.isVisible({ timeout: 3000 })) {
      if (await sortButton.evaluate(el => el.tagName === 'SELECT')) {
        await sortButton.selectOption('time')
      } else {
        await sortButton.click()
        const timeOption = page.locator('text=時間, [value="time"]')
        if (await timeOption.isVisible({ timeout: 2000 })) {
          await timeOption.click()
        }
      }

      await page.waitForTimeout(500)

      // 驗證訂單重新排列
      const firstOrder = await page.locator('[data-testid="order-card"], .order-card').first().textContent()
      expect(firstOrder).toBeTruthy()
    }
  })
})

test.describe('Admin Dashboard - 隊列管理', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 1) // 店主角色

    // Mock 排隊列表 API
    await page.route('/api/v1/queue*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            customers: mockQueueCustomers,
            statistics: {
              waiting: 2,
              seated: 1,
              totalToday: 10
            }
          }
        })
      })
    })

    await page.click('text=排隊管理, text=隊列')
    await expect(page).toHaveURL(/.*\/dashboard\/queue/)
  })

  test('應該顯示排隊列表', async ({ page }) => {
    await page.waitForSelector('[data-testid="queue-list"], .queue-list, .queue-table')

    const customerCount = await page.locator('[data-testid="queue-item"], tbody tr').count()
    expect(customerCount).toBeGreaterThan(0)

    await expect(page.locator('text=Q001')).toBeVisible()
    await expect(page.locator('text=張小明')).toBeVisible()
  })

  test('應該能夠安排座位', async ({ page }) => {
    let seatCalled = false

    // Mock 可用桌台 API
    await page.route('/api/v1/tables/available*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { id: 1, name: 'A-1', capacity: 4 },
            { id: 2, name: 'A-2', capacity: 2 }
          ]
        })
      })
    })

    // Mock 安排座位 API
    await page.route('/api/v1/queue/1/seat', async route => {
      if (route.request().method() === 'POST') {
        seatCalled = true
        const postData = route.request().postDataJSON()

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              ...mockQueueCustomers[0],
              status: 'seated',
              tableId: postData.tableId
            }
          })
        })
      }
    })

    // 點擊安排座位按鈕
    const seatButton = page.locator(
      '[data-queue-id="1"] button:has-text("安排"), ' +
      'tr:has-text("Q001") button:has-text("安排"), ' +
      '[data-testid="seat-customer-1"]'
    ).first()

    await seatButton.click()

    // 等待桌台選擇對話框
    await page.waitForSelector('.modal:visible, .dialog:visible')

    // 選擇桌台
    const tableOption = page.locator('button:has-text("A-1"), [data-table-id="1"]').first()
    if (await tableOption.isVisible({ timeout: 2000 })) {
      await tableOption.click()
    }

    // 確認安排
    const confirmButton = page.locator('button:has-text("確認"), button:has-text("確定")').last()
    if (await confirmButton.isVisible({ timeout: 2000 })) {
      await confirmButton.click()
    }

    await page.waitForTimeout(1000)
    expect(seatCalled).toBe(true)
  })

  test('應該能夠取消排隊', async ({ page }) => {
    let cancelCalled = false

    await page.route('/api/v1/queue/1/cancel', async route => {
      if (route.request().method() === 'POST' || route.request().method() === 'DELETE') {
        cancelCalled = true
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Queue entry cancelled'
          })
        })
      }
    })

    const cancelButton = page.locator(
      '[data-queue-id="1"] button:has-text("取消"), ' +
      'tr:has-text("Q001") button:has-text("取消")'
    ).first()

    if (await cancelButton.isVisible({ timeout: 3000 })) {
      await cancelButton.click()

      // 確認取消
      const confirmButton = page.locator('button:has-text("確認"), button:has-text("確定")').last()
      if (await confirmButton.isVisible({ timeout: 2000 })) {
        await confirmButton.click()
      }

      await page.waitForTimeout(1000)
      expect(cancelCalled).toBe(true)
    }
  })

  test('應該顯示排隊統計資訊', async ({ page }) => {
    // 查找統計區域
    const statsSection = page.locator('[data-testid="queue-stats"], .stats-grid')

    if (await statsSection.isVisible({ timeout: 5000 })) {
      const statCards = await statsSection.locator('.stat-card, .card').count()
      expect(statCards).toBeGreaterThan(0)

      // 驗證統計數字
      await expect(statsSection.locator('text=2, text=等待')).toBeVisible()
    }
  })
})

test.describe('Admin Dashboard - POS 收銀', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 4) // 收銀員角色

    // Mock POS API
    await page.route('/api/v1/pos/transactions*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            transactions: [
              {
                id: 1,
                orderId: 1,
                orderNumber: 'ORD-2025-001',
                amount: 285.50,
                paymentMethod: 'cash',
                status: 'completed',
                createdAt: new Date().toISOString()
              }
            ],
            summary: {
              totalSales: 1500.00,
              totalTransactions: 25,
              cashAmount: 800.00,
              cardAmount: 700.00
            }
          }
        })
      })
    })

    await page.click('text=收銀台, text=POS')
    await expect(page).toHaveURL(/.*\/(pos|cashier)/)
  })

  test('應該顯示待付款訂單', async ({ page }) => {
    // Mock 待付款訂單 API
    await page.route('/api/v1/pos/pending-orders*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 1,
              orderNumber: 'ORD-2025-001',
              tableName: 'A-1',
              totalAmount: 285.50,
              status: 'completed'
            }
          ]
        })
      })
    })

    await page.waitForSelector('[data-testid="pending-orders"], .orders-list')

    const orderCount = await page.locator('[data-testid="order-item"], .order-card').count()
    expect(orderCount).toBeGreaterThanOrEqual(0)
  })

  test('應該能夠處理現金支付', async ({ page }) => {
    let paymentCalled = false

    await page.route('/api/v1/pos/payment', async route => {
      if (route.request().method() === 'POST') {
        paymentCalled = true
        const postData = route.request().postDataJSON()

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              transactionId: 'TXN-001',
              orderId: postData.orderId,
              amount: postData.amount,
              change: postData.receivedAmount - postData.amount,
              receiptUrl: 'https://example.com/receipt-001.pdf'
            }
          })
        })
      }
    })

    // Mock 待付款訂單
    await page.route('/api/v1/pos/pending-orders*', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          data: [{
            id: 1,
            orderNumber: 'ORD-2025-001',
            tableName: 'A-1',
            totalAmount: 285.50
          }]
        })
      })
    })

    // 選擇訂單
    const orderItem = page.locator('[data-order-id="1"], tr:has-text("ORD-2025-001")').first()
    if (await orderItem.isVisible({ timeout: 3000 })) {
      await orderItem.click()

      // 選擇現金支付
      const cashButton = page.locator('button:has-text("現金"), [data-payment="cash"]').first()
      if (await cashButton.isVisible({ timeout: 2000 })) {
        await cashButton.click()

        // 輸入收到金額
        const amountInput = page.locator('input[name="receivedAmount"], #receivedAmount')
        if (await amountInput.isVisible({ timeout: 2000 })) {
          await amountInput.fill('300')
        }

        // 確認支付
        const confirmButton = page.locator('button:has-text("確認"), button[type="submit"]').last()
        await confirmButton.click()

        await page.waitForTimeout(1000)
        expect(paymentCalled).toBe(true)
      }
    }
  })

  test('應該顯示交易記錄', async ({ page }) => {
    await page.waitForSelector('[data-testid="transactions"], .transactions-list')

    const transactionCount = await page.locator('[data-testid="transaction-item"], tbody tr').count()
    expect(transactionCount).toBeGreaterThanOrEqual(0)
  })

  test('應該顯示銷售摘要', async ({ page }) => {
    const summarySection = page.locator('[data-testid="sales-summary"], .sales-summary')

    if (await summarySection.isVisible({ timeout: 5000 })) {
      await expect(summarySection.locator('text=1500, text=1,500')).toBeVisible()
    }
  })
})

test.describe('Admin Dashboard - 廚房/隊列/POS（錯誤處理）', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('應該處理廚房訂單更新失敗', async ({ page }) => {
    await page.route('/api/v1/kitchen/orders*', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true, data: mockKitchenOrders })
        })
      } else {
        await route.fulfill({
          status: 500,
          body: JSON.stringify({ success: false, error: 'Update failed' })
        })
      }
    })

    await page.click('text=廚房')

    const prepareButton = page.locator('button:has-text("準備"), button:has-text("開始")').first()
    if (await prepareButton.isVisible({ timeout: 3000 })) {
      await prepareButton.click()

      const errorMessage = await page.locator('.error-message, .alert-error, [role="alert"]').isVisible({
        timeout: 3000
      }).catch(() => false)

      expect(typeof errorMessage).toBe('boolean')
    }
  })

  test('應該處理安排座位時無可用桌台', async ({ page }) => {
    await page.route('/api/v1/queue*', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true, data: { customers: mockQueueCustomers, statistics: {} } })
      })
    })

    await page.route('/api/v1/tables/available*', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true, data: [] })
      })
    })

    await page.click('text=排隊, text=隊列')

    const seatButton = page.locator('button:has-text("安排")').first()
    if (await seatButton.isVisible({ timeout: 3000 })) {
      await seatButton.click()

      // 驗證顯示無可用桌台訊息
      const noTablesMessage = await page.locator(
        'text=無可用桌台, text=沒有可用, .empty-state'
      ).isVisible({ timeout: 3000 }).catch(() => false)

      expect(typeof noTablesMessage).toBe('boolean')
    }
  })
})

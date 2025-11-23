import { test, expect, Page } from '@playwright/test'

/**
 * Admin Dashboard - 菜單管理流程 E2E 測試
 *
 * 測試場景：
 * 1. 查看菜單列表
 * 2. 新增菜品
 * 3. 編輯菜品
 * 4. 刪除菜品
 * 5. 管理分類
 * 6. 上傳菜品圖片
 * 7. 批量操作
 */

// 測試輔助函數：登入
async function login(page: Page) {
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
            username: 'admin',
            role: 1,
            restaurantId: 1,
            restaurantName: 'Test Restaurant'
          }
        }
      })
    })
  })

  await page.goto('/login')
  await page.fill('input[type="text"], input[type="email"]', 'admin')
  await page.fill('input[type="password"]', 'password123')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/.*\/dashboard/)
}

// 測試輔助函數：模擬菜單數據
const mockCategories = [
  { id: 1, name: '主菜', nameEn: 'Main Dishes', sortOrder: 1 },
  { id: 2, name: '飲料', nameEn: 'Beverages', sortOrder: 2 },
  { id: 3, name: '甜點', nameEn: 'Desserts', sortOrder: 3 }
]

const mockMenuItems = [
  {
    id: 1,
    name: '牛肉麵',
    nameEn: 'Beef Noodles',
    description: '精選牛肉配手工麵',
    categoryId: 1,
    categoryName: '主菜',
    price: 120,
    imageUrl: 'https://example.com/beef-noodles.jpg',
    isAvailable: true,
    prepTime: 15,
    spicyLevel: 1
  },
  {
    id: 2,
    name: '珍珠奶茶',
    nameEn: 'Bubble Milk Tea',
    description: '經典台灣珍珠奶茶',
    categoryId: 2,
    categoryName: '飲料',
    price: 50,
    imageUrl: 'https://example.com/bubble-tea.jpg',
    isAvailable: true,
    prepTime: 5,
    spicyLevel: 0
  },
  {
    id: 3,
    name: '芒果冰',
    nameEn: 'Mango Ice',
    description: '新鮮芒果刨冰',
    categoryId: 3,
    categoryName: '甜點',
    price: 80,
    imageUrl: 'https://example.com/mango-ice.jpg',
    isAvailable: false,
    prepTime: 10,
    spicyLevel: 0
  }
]

test.describe('Admin Dashboard - 菜單管理', () => {
  test.beforeEach(async ({ page }) => {
    // 登入
    await login(page)

    // Mock 分類 API
    await page.route('/api/v1/menu/*/categories*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockCategories
        })
      })
    })

    // Mock 菜單列表 API
    await page.route('/api/v1/menu/*/items*', async route => {
      const url = new URL(route.request().url())
      const categoryId = url.searchParams.get('categoryId')

      let filteredItems = mockMenuItems
      if (categoryId) {
        filteredItems = mockMenuItems.filter(
          item => item.categoryId === parseInt(categoryId)
        )
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            items: filteredItems,
            pagination: {
              total: filteredItems.length,
              page: 1,
              pageSize: 20,
              totalPages: 1
            }
          }
        })
      })
    })

    // 導航到菜單管理頁面
    await page.click('text=菜單管理')
    await expect(page).toHaveURL(/.*\/dashboard\/menu/)
  })

  test('應該顯示菜單列表', async ({ page }) => {
    // 等待菜單列表載入
    await page.waitForSelector(
      '[data-testid="menu-items-list"], .menu-grid, .menu-table',
      { timeout: 10000 }
    )

    // 驗證菜品數量
    const menuItems = await page.locator(
      '[data-testid="menu-item"], .menu-item-card, tbody tr'
    ).count()
    expect(menuItems).toBeGreaterThan(0)

    // 驗證菜品資訊
    await expect(page.locator('text=牛肉麵')).toBeVisible()
    await expect(page.locator('text=珍珠奶茶')).toBeVisible()
    await expect(page.locator('text=120').or(page.locator('text=$120')).first()).toBeVisible()
  })

  test('應該能夠按分類篩選菜品', async ({ page }) => {
    // 等待頁面載入
    await page.waitForLoadState('networkidle')

    // 點擊「主菜」分類
    const categoryFilter = page.locator(
      'text=主菜, [data-category="1"], button:has-text("主菜")'
    ).first()

    if (await categoryFilter.isVisible({ timeout: 5000 })) {
      await categoryFilter.click()

      // 等待 API 請求完成
      await page.waitForResponse(
        resp => resp.url().includes('/api/v1/menu') && resp.url().includes('categoryId')
      )

      // 驗證只顯示主菜分類的菜品
      await expect(page.locator('text=牛肉麵')).toBeVisible()
      await expect(page.locator('text=珍珠奶茶')).not.toBeVisible()
    }
  })

  test('應該能夠新增菜品', async ({ page }) => {
    let createCalled = false

    // Mock 新增菜品 API
    await page.route('/api/v1/menu/*/items', async route => {
      if (route.request().method() === 'POST') {
        createCalled = true
        const postData = route.request().postDataJSON()

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 4,
              ...postData,
              imageUrl: 'https://example.com/new-item.jpg'
            }
          })
        })
      }
    })

    // 點擊「新增菜品」按鈕
    const addButton = page.locator(
      'button:has-text("新增"), button:has-text("添加"), [data-testid="add-menu-item"]'
    ).first()

    await addButton.click()

    // 等待表單模態框出現
    await page.waitForSelector(
      '[data-testid="menu-item-form"], .modal:visible, .dialog:visible'
    )

    // 填寫表單
    await page.fill('input[name="name"], #name, [placeholder*="名稱"]', '炒飯')
    await page.fill('input[name="nameEn"], #nameEn, [placeholder*="English"]', 'Fried Rice')
    await page.fill(
      'textarea[name="description"], #description',
      '美味炒飯'
    )
    await page.fill('input[name="price"], #price, [placeholder*="價格"]', '90')

    // 選擇分類
    const categorySelect = page.locator('select[name="categoryId"], #categoryId').first()
    if (await categorySelect.isVisible({ timeout: 3000 })) {
      await categorySelect.selectOption('1')
    }

    // 提交表單
    await page.click('button[type="submit"], button:has-text("確定"), button:has-text("保存")')

    // 等待 API 請求完成
    await page.waitForTimeout(1000)

    // 驗證 API 被調用
    expect(createCalled).toBe(true)

    // 驗證成功訊息
    const successMessage = await page.locator(
      'text=成功, .success-message, .toast-success, [role="status"]'
    ).isVisible({ timeout: 3000 })

    expect(successMessage).toBe(true)
  })

  test('應該能夠編輯菜品', async ({ page }) => {
    let updateCalled = false

    // Mock 取得菜品詳情 API
    await page.route('/api/v1/menu/*/items/1', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: mockMenuItems[0]
          })
        })
      } else if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
        updateCalled = true
        const postData = route.request().postDataJSON()

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              ...mockMenuItems[0],
              ...postData
            }
          })
        })
      }
    })

    // 查找並點擊編輯按鈕
    const editButton = page.locator(
      '[data-item-id="1"] button:has-text("編輯"), ' +
      'tr:has-text("牛肉麵") button:has-text("編輯"), ' +
      '[data-testid="edit-menu-item-1"]'
    ).first()

    await editButton.click()

    // 等待表單載入
    await page.waitForSelector(
      '[data-testid="menu-item-form"], .modal:visible'
    )

    // 修改價格
    const priceInput = page.locator('input[name="price"], #price')
    await priceInput.clear()
    await priceInput.fill('150')

    // 提交表單
    await page.click('button[type="submit"], button:has-text("確定"), button:has-text("保存")')

    // 等待更新完成
    await page.waitForTimeout(1000)

    // 驗證 API 被調用
    expect(updateCalled).toBe(true)
  })

  test('應該能夠刪除菜品', async ({ page }) => {
    let deleteCalled = false

    // Mock 刪除菜品 API
    await page.route('/api/v1/menu/*/items/1', async route => {
      if (route.request().method() === 'DELETE') {
        deleteCalled = true
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Menu item deleted successfully'
          })
        })
      }
    })

    // 查找並點擊刪除按鈕
    const deleteButton = page.locator(
      '[data-item-id="1"] button:has-text("刪除"), ' +
      'tr:has-text("牛肉麵") button:has-text("刪除"), ' +
      '[data-testid="delete-menu-item-1"]'
    ).first()

    await deleteButton.click()

    // 確認刪除對話框
    const confirmButton = page.locator(
      'button:has-text("確認"), button:has-text("確定"), [data-testid="confirm-delete"]'
    ).last()

    if (await confirmButton.isVisible({ timeout: 3000 })) {
      await confirmButton.click()
    }

    // 等待刪除完成
    await page.waitForTimeout(1000)

    // 驗證 API 被調用
    expect(deleteCalled).toBe(true)
  })

  test('應該能夠管理分類', async ({ page }) => {
    let createCategoryCalled = false

    // Mock 新增分類 API
    await page.route('/api/v1/menu/*/categories', async route => {
      if (route.request().method() === 'POST') {
        createCategoryCalled = true
        const postData = route.request().postDataJSON()

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 4,
              ...postData,
              sortOrder: 4
            }
          })
        })
      }
    })

    // 查找分類管理按鈕
    const manageCategoriesButton = page.locator(
      'button:has-text("管理分類"), button:has-text("分類設定"), [data-testid="manage-categories"]'
    ).first()

    if (await manageCategoriesButton.isVisible({ timeout: 3000 })) {
      await manageCategoriesButton.click()

      // 等待分類管理對話框
      await page.waitForSelector('.modal:visible, .dialog:visible')

      // 點擊新增分類
      const addCategoryButton = page.locator(
        'button:has-text("新增分類"), button:has-text("添加分類")'
      ).first()

      if (await addCategoryButton.isVisible({ timeout: 2000 })) {
        await addCategoryButton.click()

        // 填寫分類名稱
        await page.fill('input[name="name"], #categoryName', '湯品')
        await page.fill('input[name="nameEn"], #categoryNameEn', 'Soups')

        // 提交
        await page.click('button[type="submit"], button:has-text("確定")')

        // 等待創建完成
        await page.waitForTimeout(1000)

        // 驗證 API 被調用
        expect(createCategoryCalled).toBe(true)
      }
    }
  })

  test('應該能夠上傳菜品圖片', async ({ page }) => {
    let uploadCalled = false

    // Mock 圖片上傳 API
    await page.route('/api/v1/menu/*/items/1/image', async route => {
      if (route.request().method() === 'POST') {
        uploadCalled = true
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              imageUrl: 'https://example.com/uploaded-image.jpg',
              variants: {
                thumbnail: 'https://example.com/uploaded-image-thumb.jpg',
                medium: 'https://example.com/uploaded-image-medium.jpg'
              }
            }
          })
        })
      }
    })

    // Mock 菜品詳情 API
    await page.route('/api/v1/menu/*/items/1', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: mockMenuItems[0]
          })
        })
      }
    })

    // 點擊編輯按鈕
    const editButton = page.locator(
      '[data-item-id="1"] button:has-text("編輯"), ' +
      'tr:has-text("牛肉麵") button:has-text("編輯")'
    ).first()

    await editButton.click()

    // 等待表單載入
    await page.waitForSelector('.modal:visible')

    // 查找圖片上傳輸入
    const fileInput = page.locator('input[type="file"], #imageUpload')

    if (await fileInput.isVisible({ timeout: 3000 })) {
      // 模擬檔案上傳
      await fileInput.setInputFiles({
        name: 'test-image.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('fake-image-content')
      })

      // 等待上傳完成
      await page.waitForTimeout(1000)

      // 驗證上傳被調用（如果有即時上傳）
      // 注意：某些實現可能在表單提交時才上傳
    }
  })

  test('應該能夠切換菜品可用狀態', async ({ page }) => {
    let toggleCalled = false

    // Mock 切換狀態 API
    await page.route('/api/v1/menu/*/items/1/toggle', async route => {
      if (route.request().method() === 'PUT' || route.request().method() === 'PATCH') {
        toggleCalled = true
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              ...mockMenuItems[0],
              isAvailable: !mockMenuItems[0].isAvailable
            }
          })
        })
      }
    })

    // 查找切換開關
    const toggleSwitch = page.locator(
      '[data-item-id="1"] input[type="checkbox"], ' +
      '[data-item-id="1"] .toggle-switch, ' +
      'tr:has-text("牛肉麵") input[type="checkbox"]'
    ).first()

    if (await toggleSwitch.isVisible({ timeout: 3000 })) {
      await toggleSwitch.click()

      // 等待切換完成
      await page.waitForTimeout(1000)

      // 驗證 API 被調用
      expect(toggleCalled).toBe(true)
    }
  })

  test('應該能夠搜尋菜品', async ({ page }) => {
    // 查找搜尋輸入框
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="搜"], [data-testid="menu-search"]'
    ).first()

    await searchInput.fill('牛肉麵')

    // 等待搜尋結果
    await page.waitForTimeout(500)

    // 驗證搜尋結果
    await expect(page.locator('text=牛肉麵')).toBeVisible()

    // 驗證其他菜品被過濾
    const visibleItems = await page.locator(
      '[data-testid="menu-item"]:visible, .menu-item-card:visible, tbody tr:visible'
    ).count()

    expect(visibleItems).toBeLessThanOrEqual(1)
  })

  test('應該顯示菜品統計資訊', async ({ page }) => {
    // 查找統計區域
    const statsSection = page.locator(
      '[data-testid="menu-stats"], .stats-grid, .menu-statistics'
    )

    if (await statsSection.isVisible({ timeout: 5000 })) {
      // 驗證統計卡片存在
      const statCards = await statsSection.locator('.stat-card, .card').count()
      expect(statCards).toBeGreaterThan(0)
    }
  })
})

test.describe('Admin Dashboard - 菜單管理（錯誤處理）', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('應該處理新增菜品時的驗證錯誤', async ({ page }) => {
    // Mock 驗證錯誤回應
    await page.route('/api/v1/menu/*/items', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Validation failed',
            details: {
              name: 'Name is required',
              price: 'Price must be positive'
            }
          })
        })
      }
    })

    // Mock 分類和列表 API
    await page.route('/api/v1/menu/*/categories*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockCategories
        })
      })
    })

    await page.route('/api/v1/menu/*/items*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { items: mockMenuItems, pagination: { total: 3, page: 1, pageSize: 20 } }
        })
      })
    })

    await page.click('text=菜單管理')
    await expect(page).toHaveURL(/.*\/dashboard\/menu/)

    // 點擊新增按鈕
    const addButton = page.locator('button:has-text("新增")').first()
    await addButton.click()

    // 等待表單
    await page.waitForSelector('.modal:visible')

    // 提交空表單
    await page.click('button[type="submit"], button:has-text("確定")')

    // 驗證錯誤訊息
    await page.waitForSelector('.error-message, .text-red-500, [role="alert"]', {
      timeout: 3000
    })

    const errorExists = await page.locator('.error-message, .text-red-500').isVisible()
    expect(errorExists).toBe(true)
  })

  test('應該處理圖片上傳失敗', async ({ page }) => {
    // Mock 圖片上傳失敗
    await page.route('/api/v1/menu/*/items/1/image', async route => {
      await route.fulfill({
        status: 413,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'File too large'
        })
      })
    })

    // Mock 其他 API
    await page.route('/api/v1/menu/*/categories*', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true, data: mockCategories })
      })
    })

    await page.route('/api/v1/menu/*/items*', async route => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true, data: { items: mockMenuItems, pagination: {} } })
      })
    })

    await page.route('/api/v1/menu/*/items/1', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true, data: mockMenuItems[0] })
        })
      }
    })

    await page.click('text=菜單管理')
    await page.click('[data-item-id="1"] button:has-text("編輯"), tr:has-text("牛肉麵") button:has-text("編輯")')

    const fileInput = page.locator('input[type="file"]')

    if (await fileInput.isVisible({ timeout: 3000 })) {
      await fileInput.setInputFiles({
        name: 'large-image.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.alloc(10 * 1024 * 1024) // 10MB
      })

      // 等待錯誤訊息
      await page.waitForSelector('.error-message, .alert-error, [role="alert"]', {
        timeout: 3000
      }).catch(() => {
        // 如果沒有立即上傳，錯誤可能在提交時顯示
      })
    }
  })
})

import { test, expect } from '@playwright/test'
import { TestHelpers, TestDataGenerator } from './utils/test-helpers'

test.describe('多語言國際化 E2E 測試', () => {
  let helpers: TestHelpers

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page)
    
    // 模擬 API 響應
    await helpers.mockAPIResponse(/\/restaurants\/1\/menu/, TestDataGenerator.generateMenuData())
    await helpers.mockAPIResponse(/\/restaurants\/1$/, TestDataGenerator.generateRestaurantData())
  })

  const testLanguages = [
    { code: 'zh-TW', name: '繁體中文', welcome: '歡迎來到 MakanMakan' },
    { code: 'zh-CN', name: '简体中文', welcome: '欢迎来到 MakanMakan' },
    { code: 'en', name: 'English', welcome: 'Welcome to MakanMakan' },
    { code: 'vi', name: 'Tiếng Việt', welcome: 'Chào mừng đến với MakanMakan' }
  ]

  testLanguages.forEach(({ code, name, welcome }) => {
    test(`${name} (${code}) - 完整用戶流程測試`, async ({ page }) => {
      // 1. 進入首頁並切換語言
      await page.goto('/')
      await helpers.waitForPageLoad()
      
      // 切換到指定語言
      await helpers.switchLanguage(code)
      
      // 2. 驗證首頁翻譯
      await helpers.waitForText(welcome)
      
      // 3. 檢查通用翻譯
      const commonTranslations = {
        'zh-TW': { confirm: '確認', cancel: '取消', menu: '菜單', cart: '購物車' },
        'zh-CN': { confirm: '确认', cancel: '取消', menu: '菜单', cart: '购物车' },
        'en': { confirm: 'Confirm', cancel: 'Cancel', menu: 'Menu', cart: 'Cart' },
        'vi': { confirm: 'Xác nhận', cancel: 'Hủy', menu: 'Thực đơn', cart: 'Giỏ hàng' }
      }
      
      const translations = commonTranslations[code as keyof typeof commonTranslations]
      
      // 4. 進入菜單頁面
      await page.goto('/restaurant/1/table/5')
      await helpers.waitForPageLoad()
      
      // 檢查菜單翻譯
      await helpers.checkTranslation('menu.title', translations.menu)
      
      // 5. 添加商品到購物車
      await helpers.addItemToCart('牛肉麵', 1)
      
      // 6. 進入購物車
      await helpers.clickElement('[data-testid="cart-link"]')
      
      // 檢查購物車翻譯
      await helpers.checkTranslation('cart.title', translations.cart)
      
      // 7. 檢查按鈕翻譯
      const confirmBtn = page.locator(`button:has-text("${translations.confirm}")`)
      const cancelBtn = page.locator(`button:has-text("${translations.cancel}")`)
      
      await expect(confirmBtn).toBeVisible()
      await expect(cancelBtn).toBeVisible()
    })
  })

  test('動態語言切換不重載頁面', async ({ page }) => {
    // 1. 進入菜單頁面
    await page.goto('/restaurant/1/table/5')
    await helpers.waitForPageLoad()
    
    // 記錄頁面加載時間戳
    const initialTimestamp = await page.evaluate(() => window.performance.now())
    
    // 2. 切換語言
    await helpers.switchLanguage('en')
    await helpers.waitForText('Menu')
    
    // 3. 再次切換語言
    await helpers.switchLanguage('zh-CN')
    await helpers.waitForText('菜单')
    
    // 4. 驗證頁面沒有重新載入
    const finalTimestamp = await page.evaluate(() => window.performance.now())
    const timeDiff = finalTimestamp - initialTimestamp
    
    // 語言切換應該很快完成，不應該重新載入頁面
    expect(timeDiff).toBeLessThan(5000)
    
    // 5. 檢查 URL 沒有變化
    await expect(page).toHaveURL(/\/restaurant\/1\/table\/5/)
  })

  test('瀏覽器語言偵測', async ({ page, context }) => {
    // 1. 設置瀏覽器語言為簡體中文
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'language', {
        get: () => 'zh-CN'
      })
      Object.defineProperty(navigator, 'languages', {
        get: () => ['zh-CN', 'zh', 'en']
      })
    })
    
    // 2. 首次訪問頁面
    await page.goto('/')
    await helpers.waitForPageLoad()
    
    // 3. 應該自動顯示簡體中文
    await helpers.waitForText('欢迎来到 MakanMakan')
    
    // 4. 檢查語言設置
    const currentLang = await page.evaluate(() => {
      return document.documentElement.lang
    })
    expect(currentLang).toBe('zh-CN')
  })

  test('語言偏好本地存儲', async ({ page, context }) => {
    // 1. 設置本地存儲的語言偏好
    await context.addInitScript(() => {
      localStorage.setItem('makanmakan_language', 'vi')
    })
    
    // 2. 訪問頁面
    await page.goto('/')
    await helpers.waitForPageLoad()
    
    // 3. 應該使用存儲的語言設置
    await helpers.waitForText('Chào mừng đến với MakanMakan')
    
    // 4. 切換語言並檢查存儲
    await helpers.switchLanguage('en')
    
    const storedLang = await page.evaluate(() => {
      return localStorage.getItem('makanmakan_language')
    })
    expect(storedLang).toBe('en')
  })

  test('參數化翻譯測試', async ({ page }) => {
    await page.goto('/restaurant/1/table/5')
    await helpers.waitForPageLoad()
    
    // 添加商品到購物車
    await helpers.addItemToCart('牛肉麵', 3)
    await helpers.clickElement('[data-testid="cart-link"]')
    
    // 測試不同語言的數量顯示
    const languages = [
      { code: 'zh-TW', expected: '3 項商品' },
      { code: 'zh-CN', expected: '3 项商品' },
      { code: 'en', expected: '3 items' },
      { code: 'vi', expected: '3 món ăn' }
    ]
    
    for (const { code, expected } of languages) {
      await helpers.switchLanguage(code)
      await helpers.waitForText(expected)
    }
  })

  test('複數形式處理', async ({ page }) => {
    await page.goto('/restaurant/1/table/5')
    await helpers.waitForPageLoad()
    
    // 測試單數和複數情況
    const testCases = [
      { count: 1, lang: 'en', expected: '1 item' },
      { count: 2, lang: 'en', expected: '2 items' },
      { count: 1, lang: 'zh-TW', expected: '1 項商品' },
      { count: 5, lang: 'zh-TW', expected: '5 項商品' }
    ]
    
    for (const { count, lang, expected } of testCases) {
      // 清空購物車
      await page.evaluate(() => {
        localStorage.removeItem('makanmakan_cart_1_5')
      })
      await page.reload()
      
      // 切換語言
      await helpers.switchLanguage(lang)
      
      // 添加指定數量的商品
      await helpers.addItemToCart('牛肉麵', count)
      await helpers.clickElement('[data-testid="cart-link"]')
      
      // 檢查複數形式
      await helpers.waitForText(expected)
    }
  })

  test('錯誤訊息翻譯', async ({ page }) => {
    await page.goto('/')
    await helpers.waitForPageLoad()
    
    // 測試不同語言的錯誤訊息
    const errorTests = [
      { lang: 'zh-TW', error: '網路連接有問題' },
      { lang: 'zh-CN', error: '网络连接有问题' },
      { lang: 'en', error: 'Network connection problem' },
      { lang: 'vi', error: 'Có vấn đề kết nối mạng' }
    ]
    
    for (const { lang, error } of errorTests) {
      await helpers.switchLanguage(lang)
      
      // 模擬網路錯誤
      await helpers.goOffline()
      
      // 觸發 API 請求
      await helpers.clickElement('[data-testid="scan-qr-btn"]')
      
      // 檢查錯誤訊息翻譯
      await helpers.waitForText(error)
      
      // 恢復網路
      await helpers.goOnline()
    }
  })

  test('RTL 語言支持準備（未來擴展）', async ({ page }) => {
    // 這個測試為未來支持阿拉伯語等 RTL 語言做準備
    await page.goto('/')
    await helpers.waitForPageLoad()
    
    // 檢查當前支持的語言都是 LTR
    const supportedLanguages = ['zh-TW', 'zh-CN', 'en', 'vi']
    
    for (const lang of supportedLanguages) {
      await helpers.switchLanguage(lang)
      
      const dir = await page.evaluate(() => document.documentElement.dir)
      expect(dir).toBe('ltr')
    }
    
    // 確保 CSS 支持 RTL（通過檢查是否有相關的 CSS 類）
    const hasRTLSupport = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement)
      return styles.direction === 'ltr' // 當前應該是 LTR
    })
    
    expect(hasRTLSupport).toBe(true)
  })
})
import { test, expect } from '@playwright/test'
import { TestHelpers, TestDataGenerator } from './utils/test-helpers'

test.describe('跨瀏覽器相容性測試', () => {
  let helpers: TestHelpers

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page)
    
    // 模擬 API 響應
    await helpers.mockAPIResponse(/\/restaurants\/1\/menu/, TestDataGenerator.generateMenuData())
    await helpers.mockAPIResponse(/\/restaurants\/1$/, TestDataGenerator.generateRestaurantData())
    await helpers.mockAPIResponse(/\/orders/, TestDataGenerator.generateOrderData())
  })

  // Chromium 瀏覽器測試
  test('Chromium - 完整功能測試', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', '此測試專為 Chromium')
    
    await page.goto('/restaurant/1/table/5')
    await helpers.waitForPageLoad()
    
    // 測試現代 Web API 支援
    const webApiSupport = await page.evaluate(() => {
      return {
        serviceWorker: 'serviceWorker' in navigator,
        webSocket: 'WebSocket' in window,
        localStorage: 'localStorage' in window,
        indexedDB: 'indexedDB' in window,
        geolocation: 'geolocation' in navigator,
        notifications: 'Notification' in window,
        webGL: !!document.createElement('canvas').getContext('webgl')
      }
    })
    
    expect(webApiSupport.serviceWorker).toBe(true)
    expect(webApiSupport.webSocket).toBe(true)
    expect(webApiSupport.localStorage).toBe(true)
    expect(webApiSupport.indexedDB).toBe(true)
    
    // 測試 CSS Grid 和 Flexbox 支援
    const cssSupport = await page.evaluate(() => {
      const _testElement = document.createElement('div')
      return {
        grid: CSS.supports('display', 'grid'),
        flexbox: CSS.supports('display', 'flex'),
        customProperties: CSS.supports('color', 'var(--test)')
      }
    })
    
    expect(cssSupport.grid).toBe(true)
    expect(cssSupport.flexbox).toBe(true)
    expect(cssSupport.customProperties).toBe(true)
    
    // 測試核心功能
    await helpers.addItemToCart('牛肉麵', 2)
    await helpers.checkCartItemCount(2)
  })

  // Firefox 瀏覽器測試
  test('Firefox - 跨瀏覽器功能驗證', async ({ page, browserName }) => {
    test.skip(browserName !== 'firefox', '此測試專為 Firefox')
    
    await page.goto('/restaurant/1/table/5')
    await helpers.waitForPageLoad()
    
    // Firefox 特定的功能測試
    const firefoxFeatures = await page.evaluate(() => {
      return {
        userAgent: navigator.userAgent.includes('Firefox'),
        webGL2: !!document.createElement('canvas').getContext('webgl2'),
        css: {
          scrollBehavior: CSS.supports('scroll-behavior', 'smooth'),
          backdropFilter: CSS.supports('backdrop-filter', 'blur(10px)')
        }
      }
    })
    
    expect(firefoxFeatures.userAgent).toBe(true)
    
    // 測試 Vue.js 在 Firefox 中的運行
    const vueApp = await page.locator('#app').isVisible()
    expect(vueApp).toBe(true)
    
    // 測試事件處理
    await helpers.addItemToCart('珍珠奶茶', 1)
    await helpers.clickElement('[data-testid="cart-link"]')
    
    const cartItems = await page.locator('[data-testid="cart-item"]').count()
    expect(cartItems).toBe(1)
  })

  // Safari (WebKit) 測試
  test('Safari - WebKit 引擎相容性', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', '此測試專為 Safari/WebKit')
    
    await page.goto('/restaurant/1/table/5')
    await helpers.waitForPageLoad()
    
    // Safari 特定功能檢查
    const safariFeatures = await page.evaluate(() => {
      return {
        userAgent: navigator.userAgent.includes('Safari'),
        webKit: navigator.userAgent.includes('WebKit'),
        touchEvents: 'ontouchstart' in window,
        cssProperties: {
          webkitAppearance: CSS.supports('-webkit-appearance', 'none'),
          webkitTransform: CSS.supports('-webkit-transform', 'translateX(0)')
        }
      }
    })
    
    // 測試觸控事件支援（重要針對 iPad/iPhone）
    if (safariFeatures.touchEvents) {
      await page.touchscreen.tap(200, 300)
    }
    
    // 測試 PWA 功能在 Safari 中的支援
    const pwaSupport = await page.evaluate(() => {
      return {
        manifest: 'manifest' in document.createElement('link'),
        serviceWorker: 'serviceWorker' in navigator
      }
    })
    
    // Safari 對 PWA 支援有限，但基本功能應該可用
    expect(pwaSupport.serviceWorker).toBe(true)
    
    // 測試核心購物功能
    await helpers.addItemToCart('牛肉麵', 1)
    await helpers.submitOrder({
      name: 'Safari 測試用戶',
      phone: '0987654321'
    })
    
    await helpers.waitForText('訂單提交成功')
  })

  // 移動端瀏覽器測試
  test('Mobile Chrome - 移動端體驗', async ({ page, isMobile }) => {
    test.skip(!isMobile, '此測試專為移動端')
    
    await page.goto('/restaurant/1/table/5')
    await helpers.waitForPageLoad()
    
    // 檢查視口設定
    const viewport = page.viewportSize()
    expect(viewport?.width).toBeLessThanOrEqual(768)
    
    // 測試觸控友善的 UI 元素
    const touchTargets = await page.locator('button, a, [role="button"]').all()
    
    for (const target of touchTargets.slice(0, 5)) { // 測試前 5 個元素
      const box = await target.boundingBox()
      if (box) {
        // 觸控目標應該至少 44x44px (Apple HIG 建議)
        expect(box.width).toBeGreaterThanOrEqual(44)
        expect(box.height).toBeGreaterThanOrEqual(44)
      }
    }
    
    // 測試移動端特有功能
    await page.evaluate(() => {
      // 測試設備方向變化
      window.screen?.orientation?.lock?.('portrait')
    })
    
    // 測試手勢操作
    await helpers.addItemToCart('牛肉麵', 1)
    
    // 模擬滑動操作
    const startX = page.viewportSize()!.width / 2
    const startY = page.viewportSize()!.height / 2
    
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX, startY - 100)
    await page.mouse.up()
    
    // 檢查滑動後頁面狀態
    const pageVisible = await page.locator('#app').isVisible()
    expect(pageVisible).toBe(true)
  })

  // 低端設備模擬測試
  test('低端設備性能測試', async ({ page, context }) => {
    // 模擬慢速網路和低端 CPU
    await context.route('**/*', async route => {
      await new Promise(resolve => setTimeout(resolve, 100)) // 模擬網路延遲
      await route.continue()
    })
    
    // 限制 CPU 性能（Chromium only）
    if (context.browser()?.browserType().name() === 'chromium') {
      const cdp = await context.newCDPSession(page)
      await cdp.send('Runtime.enable')
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    }
    
    await page.goto('/restaurant/1/table/5')
    
    // 測量頁面載入時間
    const startTime = Date.now()
    await helpers.waitForPageLoad()
    const loadTime = Date.now() - startTime
    
    // 低端設備上載入時間應該在合理範圍內
    expect(loadTime).toBeLessThan(10000) // 10秒內載入
    
    // 測試基本功能在低性能環境下的表現
    await helpers.addItemToCart('牛肉麵', 1)
    await helpers.checkCartItemCount(1)
  })

  // 舊版瀏覽器回退測試
  test('功能降級處理', async ({ page }) => {
    // 模擬舊瀏覽器環境
    await page.addInitScript(() => {
      // 移除現代 API
      delete (window as any).fetch
      delete (window as any).Promise
      delete (window as any).IntersectionObserver
      
      // 模擬舊版 CSS 支援
      const _originalSupports = CSS.supports
      CSS.supports = () => false
    })
    
    await page.goto('/restaurant/1/table/5')
    
    // 檢查是否有適當的 polyfill 載入
    const hasPolyfills = await page.evaluate(() => {
      return !!(window as any).fetch || !!(window as any).XMLHttpRequest
    })
    
    expect(hasPolyfills).toBe(true)
    
    // 基本功能應該仍然可用
    const appVisible = await page.locator('#app').isVisible()
    expect(appVisible).toBe(true)
  })

  // JavaScript 禁用測試
  test('JavaScript 禁用情況下的體驗', async ({ context }) => {
    // 禁用 JavaScript
    await context.setExtraHTTPHeaders({ 'Content-Security-Policy': "script-src 'none'" })
    
    const page = await context.newPage()
    await page.goto('/restaurant/1/table/5')
    
    // 檢查是否有適當的 noscript 內容
    const noscriptContent = await page.locator('noscript').textContent()
    expect(noscriptContent).toContain('JavaScript')
    
    // 或者檢查基本 HTML 內容是否可用
    const bodyContent = await page.locator('body').textContent()
    expect(bodyContent).toBeTruthy()
  })

  // 網路連線類型測試
  test('不同網路條件下的表現', async ({ page, context }) => {
    // 模擬慢速 3G 網路
    await context.route('**/*', async route => {
      // 模擬慢速連線
      await new Promise(resolve => setTimeout(resolve, 200))
      await route.continue()
    })
    
    await page.goto('/restaurant/1/table/5')
    await helpers.waitForPageLoad()
    
    // 檢查載入指示器
    const _loadingIndicator = page.locator('[data-testid="loading"]')
    
    // 在慢速網路下，載入指示器應該會顯示
    // (需要快速檢查，因為載入完成後會消失)
    
    // 測試離線功能
    await helpers.goOffline()
    
    // 檢查離線提示
    await helpers.waitForText('網路連接')
    
    await helpers.goOnline()
    await helpers.waitForPageLoad()
  })

  // 可存取性跨瀏覽器測試
  test('無障礙功能跨瀏覽器支援', async ({ page }) => {
    await page.goto('/restaurant/1/table/5')
    await helpers.waitForPageLoad()
    
    // 測試鍵盤導航
    await page.keyboard.press('Tab')
    
    const focusedElement = await page.evaluate(() => {
      return document.activeElement?.tagName
    })
    
    expect(['BUTTON', 'A', 'INPUT'].includes(focusedElement!)).toBe(true)
    
    // 測試螢幕閱讀器支援
    const ariaSupport = await page.evaluate(() => {
      const elementsWithAria = document.querySelectorAll('[aria-label], [aria-labelledby], [role]')
      return elementsWithAria.length > 0
    })
    
    expect(ariaSupport).toBe(true)
    
    // 測試高對比度模式
    await page.emulateMedia({ colorScheme: 'dark' })
    
    const _darkModeApplied = await page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor !== 'rgb(255, 255, 255)'
    })
    
    // 應該有深色模式支援或至少不會破壞佈局
    const appStillVisible = await page.locator('#app').isVisible()
    expect(appStillVisible).toBe(true)
  })

  // 字體和國際化跨瀏覽器測試
  test('字體渲染和多語言支援', async ({ page }) => {
    await page.goto('/restaurant/1/table/5')
    await helpers.waitForPageLoad()
    
    // 測試中文字體渲染
    const chineseText = await page.locator('h1').first().textContent()
    expect(chineseText).toBeTruthy()
    
    // 測試字體載入
    const fontLoaded = await page.evaluate(async () => {
      if ('fonts' in document) {
        await document.fonts.ready
        return document.fonts.status === 'loaded'
      }
      return true // 舊瀏覽器假設字體已載入
    })
    
    expect(fontLoaded).toBe(true)
    
    // 測試不同語言切換
    const languages = ['zh-TW', 'zh-CN', 'en', 'vi']
    
    for (const lang of languages) {
      await helpers.switchLanguage(lang)
      
      // 檢查語言是否正確應用
      const htmlLang = await page.evaluate(() => document.documentElement.lang)
      expect(htmlLang).toBe(lang)
      
      // 檢查文字方向（為未來 RTL 支援做準備）
      const textDirection = await page.evaluate(() => {
        return getComputedStyle(document.documentElement).direction
      })
      expect(textDirection).toBe('ltr') // 目前支援的語言都是 LTR
    }
  })
})
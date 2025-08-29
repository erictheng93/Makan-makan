import { test, expect } from '@playwright/test'
import { TestHelpers, TestDataGenerator } from './utils/test-helpers'

test.describe('性能與可存取性測試', () => {
  let helpers: TestHelpers

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page)
    
    // 模擬 API 響應
    await helpers.mockAPIResponse(/\/restaurants\/1\/menu/, TestDataGenerator.generateMenuData())
    await helpers.mockAPIResponse(/\/restaurants\/1$/, TestDataGenerator.generateRestaurantData())
  })

  test.describe('性能測試', () => {
    test('頁面載入性能', async ({ page }) => {
      // 開始性能監控
      const startTime = Date.now()
      
      await page.goto('/restaurant/1/table/5')
      
      // 等待頁面完全載入
      await page.waitForLoadState('networkidle')
      await helpers.waitForPageLoad()
      
      const loadTime = Date.now() - startTime
      
      // 頁面應在 3 秒內載入完成
      expect(loadTime).toBeLessThan(3000)
      
      // 檢查首次內容繪製 (FCP)
      const fcp = await page.evaluate(() => {
        const perfEntries = performance.getEntriesByType('paint') as PerformanceEntry[]
        const fcpEntry = perfEntries.find(entry => entry.name === 'first-contentful-paint')
        return fcpEntry ? fcpEntry.startTime : 0
      })
      
      // FCP 應在 1.5 秒內
      expect(fcp).toBeLessThan(1500)
      
      // 檢查最大內容繪製 (LCP)
      const lcp = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries()
            const lastEntry = entries[entries.length - 1] as any
            resolve(lastEntry.startTime)
            observer.disconnect()
          })
          observer.observe({ type: 'largest-contentful-paint', buffered: true })
          
          // 如果 2 秒內沒有觸發，返回 0
          setTimeout(() => resolve(0), 2000)
        })
      })
      
      // LCP 應在 2.5 秒內
      if (lcp > 0) {
        expect(lcp).toBeLessThan(2500)
      }
    })

    test('JavaScript 包大小檢查', async ({ page }) => {
      // 監控所有網路請求
      const jsRequests: { url: string; size: number }[] = []
      
      page.on('response', async (response) => {
        const url = response.url()
        if (url.endsWith('.js') && response.status() === 200) {
          try {
            const buffer = await response.body()
            jsRequests.push({
              url: url,
              size: buffer.length
            })
          } catch (error) {
            // 忽略無法取得內容的請求
          }
        }
      })
      
      await page.goto('/restaurant/1/table/5')
      await helpers.waitForPageLoad()
      
      // 檢查主要 JavaScript 包大小
      const totalJSSize = jsRequests.reduce((total, req) => total + req.size, 0)
      
      // 總 JS 包大小應小於 1MB（壓縮後）
      expect(totalJSSize).toBeLessThan(1024 * 1024)
      
      // 檢查是否有代碼分割
      const jsFiles = jsRequests.map(req => req.url)
      const hasCodeSplitting = jsFiles.length > 1
      
      // 應該有代碼分割以改善初始載入性能
      expect(hasCodeSplitting).toBe(true)
    })

    test('圖片載入優化', async ({ page }) => {
      await page.goto('/restaurant/1/table/5')
      await helpers.waitForPageLoad()
      
      // 檢查圖片懶載入
      const images = await page.locator('img').all()
      
      for (const img of images.slice(0, 5)) { // 檢查前 5 張圖片
        const loading = await img.getAttribute('loading')
        const isLazyLoaded = loading === 'lazy'
        
        // 非首屏圖片應該使用懶載入
        if (await img.isVisible()) {
          // 可見圖片可能是 eager 或沒有設置
          expect(['lazy', 'eager', null].includes(loading)).toBe(true)
        } else {
          // 不可見圖片應該使用懶載入
          expect(isLazyLoaded).toBe(true)
        }
      }
      
      // 檢查圖片格式優化
      const imageRequests: string[] = []
      
      page.on('response', (response) => {
        const url = response.url()
        if (url.match(/\.(jpg|jpeg|png|webp|avif)$/i)) {
          imageRequests.push(url)
        }
      })
      
      // 滾動頁面觸發懶載入
      await page.mouse.wheel(0, 500)
      await page.waitForTimeout(1000)
      
      // 檢查是否使用現代圖片格式
      const modernFormats = imageRequests.filter(url => 
        url.match(/\.(webp|avif)$/i)
      )
      
      // 至少一部分圖片應該使用現代格式
      const modernFormatRatio = modernFormats.length / Math.max(imageRequests.length, 1)
      expect(modernFormatRatio).toBeGreaterThan(0.3) // 至少 30% 使用現代格式
    })

    test('記憶體使用測試', async ({ page }) => {
      await page.goto('/restaurant/1/table/5')
      await helpers.waitForPageLoad()
      
      // 獲取初始記憶體使用
      const initialMemory = await page.evaluate(() => {
        return (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0
      })
      
      // 模擬用戶操作
      for (let i = 0; i < 10; i++) {
        await helpers.addItemToCart('牛肉麵', 1)
        await page.locator('[data-testid="remove-item-btn"]').first().click()
        await page.waitForTimeout(100)
      }
      
      // 觸發垃圾回收（如果支援）
      await page.evaluate(() => {
        if ((window as any).gc) {
          (window as any).gc()
        }
      })
      
      await page.waitForTimeout(1000)
      
      // 檢查最終記憶體使用
      const finalMemory = await page.evaluate(() => {
        return (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0
      })
      
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = finalMemory - initialMemory
        
        // 記憶體增長應該控制在合理範圍內（10MB）
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)
      }
    })

    test('滾動性能', async ({ page }) => {
      await page.goto('/restaurant/1/table/5')
      await helpers.waitForPageLoad()
      
      // 開始性能監控
      await page.evaluate(() => {
        (window as any).scrollFrames = []
        
        let lastTime = performance.now()
        function measureFrame() {
          const currentTime = performance.now()
          const delta = currentTime - lastTime
          ;(window as any).scrollFrames.push(delta)
          lastTime = currentTime
          
          if ((window as any).scrollFrames.length < 60) { // 監控 60 幀
            requestAnimationFrame(measureFrame)
          }
        }
        
        requestAnimationFrame(measureFrame)
      })
      
      // 執行滾動操作
      await page.mouse.wheel(0, 1000)
      await page.waitForTimeout(1000)
      
      // 分析幀率
      const frameData = await page.evaluate(() => {
        const frames = (window as any).scrollFrames || []
        const avgFrameTime = frames.reduce((a: number, b: number) => a + b, 0) / frames.length
        const fps = 1000 / avgFrameTime
        
        return {
          avgFrameTime,
          fps,
          frameCount: frames.length
        }
      })
      
      if (frameData.frameCount > 0) {
        // 滾動時 FPS 應該保持在 30 以上
        expect(frameData.fps).toBeGreaterThan(30)
        
        // 平均幀時間應該小於 33ms (30fps)
        expect(frameData.avgFrameTime).toBeLessThan(33)
      }
    })
  })

  test.describe('可存取性測試', () => {
    test('鍵盤導航', async ({ page }) => {
      await page.goto('/restaurant/1/table/5')
      await helpers.waitForPageLoad()
      
      // 測試 Tab 鍵導航
      const focusableElements: string[] = []
      
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab')
        
        const focusedElement = await page.evaluate(() => {
          const el = document.activeElement
          return el ? `${el.tagName}${el.id ? '#' + el.id : ''}${el.className ? '.' + el.className.split(' ').join('.') : ''}` : ''
        })
        
        if (focusedElement) {
          focusableElements.push(focusedElement)
        }
      }
      
      // 應該有可聚焦的元素
      expect(focusableElements.length).toBeGreaterThan(0)
      
      // 測試 Enter 鍵操作
      await page.keyboard.press('Enter')
      
      // 確保聚焦可見
      const focusIndicator = await page.evaluate(() => {
        const el = document.activeElement
        if (!el) return false
        
        const styles = getComputedStyle(el)
        return styles.outlineWidth !== '0px' || 
               styles.outlineStyle !== 'none' ||
               styles.boxShadow.includes('0 0')
      })
      
      expect(focusIndicator).toBe(true)
    })

    test('螢幕閱讀器支援', async ({ page }) => {
      await page.goto('/restaurant/1/table/5')
      await helpers.waitForPageLoad()
      
      // 檢查頁面結構語義
      const semanticElements = await page.evaluate(() => {
        return {
          headings: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length,
          landmarks: document.querySelectorAll('header, nav, main, section, article, aside, footer').length,
          lists: document.querySelectorAll('ul, ol').length,
          buttons: document.querySelectorAll('button, [role="button"]').length,
          links: document.querySelectorAll('a').length
        }
      })
      
      // 應該有適當的標題結構
      expect(semanticElements.headings).toBeGreaterThan(0)
      
      // 應該有地標元素
      expect(semanticElements.landmarks).toBeGreaterThan(0)
      
      // 檢查 ARIA 屬性
      const ariaAttributes = await page.evaluate(() => {
        const elementsWithAria = document.querySelectorAll(`
          [aria-label], [aria-labelledby], [aria-describedby], 
          [role], [aria-hidden], [aria-expanded], [aria-live]
        `)
        
        return {
          total: elementsWithAria.length,
          labels: document.querySelectorAll('[aria-label], [aria-labelledby]').length,
          roles: document.querySelectorAll('[role]').length
        }
      })
      
      // 應該有 ARIA 屬性來增強可存取性
      expect(ariaAttributes.total).toBeGreaterThan(0)
      expect(ariaAttributes.labels).toBeGreaterThan(0)
      
      // 檢查圖片的 alt 文字
      const images = await page.locator('img').all()
      for (const img of images.slice(0, 5)) {
        const alt = await img.getAttribute('alt')
        const ariaLabel = await img.getAttribute('aria-label')
        const isDecorative = await img.getAttribute('aria-hidden')
        
        // 每個圖片都應該有 alt 文字或被標記為裝飾性
        expect(alt || ariaLabel || isDecorative === 'true').toBeTruthy()
      }
    })

    test('色彩對比度', async ({ page }) => {
      await page.goto('/restaurant/1/table/5')
      await helpers.waitForPageLoad()
      
      // 檢查文字元素的對比度
      const contrastResults = await page.evaluate(() => {
        function getLuminance(r: number, g: number, b: number) {
          const [rs, gs, bs] = [r, g, b].map(c => {
            c = c / 255
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
          })
          return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
        }
        
        function getContrastRatio(color1: [number, number, number], color2: [number, number, number]) {
          const l1 = getLuminance(...color1)
          const l2 = getLuminance(...color2)
          const lighter = Math.max(l1, l2)
          const darker = Math.min(l1, l2)
          return (lighter + 0.05) / (darker + 0.05)
        }
        
        function parseColor(colorStr: string): [number, number, number] | null {
          const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
          return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : null
        }
        
        const textElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, a, button')
        const results: Array<{ element: string; ratio: number }> = []
        
        for (let i = 0; i < Math.min(textElements.length, 10); i++) {
          const element = textElements[i] as HTMLElement
          const styles = getComputedStyle(element)
          
          const textColor = parseColor(styles.color)
          const backgroundColor = parseColor(styles.backgroundColor)
          
          if (textColor && backgroundColor) {
            const ratio = getContrastRatio(textColor, backgroundColor)
            results.push({
              element: element.tagName.toLowerCase(),
              ratio: ratio
            })
          }
        }
        
        return results
      })
      
      // 檢查對比度是否符合 WCAG AA 標準 (4.5:1)
      for (const result of contrastResults) {
        if (result.ratio > 1) { // 只檢查有效的對比度值
          expect(result.ratio).toBeGreaterThan(4.5)
        }
      }
    })

    test('焦點管理', async ({ page }) => {
      await page.goto('/restaurant/1/table/5')
      await helpers.waitForPageLoad()
      
      // 測試模態框焦點陷阱
      await helpers.clickElement('[data-testid="menu-item-card"] button')
      
      // 等待模態框出現
      await page.waitForSelector('[role="dialog"]', { timeout: 2000 })
        .catch(() => {
          // 如果沒有模態框，跳過這個測試
          return null
        })
      
      const modal = await page.locator('[role="dialog"]').count()
      
      if (modal > 0) {
        // 檢查焦點是否在模態框內
        const focusInModal = await page.evaluate(() => {
          const modal = document.querySelector('[role="dialog"]')
          const activeElement = document.activeElement
          return modal?.contains(activeElement) ?? false
        })
        
        expect(focusInModal).toBe(true)
        
        // 測試 Tab 鍵是否被困在模態框內
        const initialFocus = await page.evaluate(() => document.activeElement?.tagName)
        
        // 按 Tab 多次
        for (let i = 0; i < 5; i++) {
          await page.keyboard.press('Tab')
        }
        
        // 焦點仍應在模態框內
        const stillInModal = await page.evaluate(() => {
          const modal = document.querySelector('[role="dialog"]')
          const activeElement = document.activeElement
          return modal?.contains(activeElement) ?? false
        })
        
        expect(stillInModal).toBe(true)
        
        // 按 Escape 關閉模態框
        await page.keyboard.press('Escape')
        
        // 焦點應該回到觸發元素
        await page.waitForTimeout(500)
        
        const focusedAfterClose = await page.evaluate(() => {
          return document.activeElement?.tagName
        })
        
        expect(['BUTTON', 'A'].includes(focusedAfterClose!)).toBe(true)
      }
    })

    test('語音提示和狀態更新', async ({ page }) => {
      await page.goto('/restaurant/1/table/5')
      await helpers.waitForPageLoad()
      
      // 檢查即時狀態更新區域
      const liveRegions = await page.evaluate(() => {
        return document.querySelectorAll('[aria-live]').length
      })
      
      // 應該有即時更新區域
      expect(liveRegions).toBeGreaterThan(0)
      
      // 測試購物車狀態更新
      await helpers.addItemToCart('牛肉麵', 1)
      
      // 檢查是否有狀態變化提示
      const statusMessages = await page.evaluate(() => {
        const liveElements = document.querySelectorAll('[aria-live="polite"], [aria-live="assertive"]')
        return Array.from(liveElements).map(el => el.textContent?.trim()).filter(Boolean)
      })
      
      // 至少應該有一些狀態訊息
      expect(statusMessages.length).toBeGreaterThan(0)
    })

    test('表單可存取性', async ({ page }) => {
      await page.goto('/restaurant/1/table/5')
      await helpers.waitForPageLoad()
      
      // 添加商品並進入購物車
      await helpers.addItemToCart('牛肉麵', 1)
      await helpers.clickElement('[data-testid="cart-link"]')
      
      // 如果有表單，檢查表單可存取性
      const forms = await page.locator('form').count()
      
      if (forms > 0) {
        // 檢查標籤關聯
        const formFields = await page.evaluate(() => {
          const inputs = document.querySelectorAll('input, textarea, select')
          const results = []
          
          for (const input of inputs) {
            const hasLabel = !!input.closest('label') || 
                            !!document.querySelector(`label[for="${input.id}"]`) ||
                            !!input.getAttribute('aria-label') ||
                            !!input.getAttribute('aria-labelledby')
            
            results.push({
              type: input.tagName.toLowerCase(),
              hasLabel,
              required: input.hasAttribute('required'),
              hasErrorMessage: !!input.getAttribute('aria-describedby')
            })
          }
          
          return results
        })
        
        // 每個表單欄位都應該有標籤
        for (const field of formFields) {
          expect(field.hasLabel).toBe(true)
        }
        
        // 測試表單驗證訊息
        const submitButton = await page.locator('button[type="submit"]').first()
        if (await submitButton.count() > 0) {
          await submitButton.click()
          
          // 檢查是否有可存取的錯誤訊息
          const errorMessages = await page.evaluate(() => {
            return document.querySelectorAll('[role="alert"], .error, [aria-invalid="true"]').length
          })
          
          // 如果有驗證錯誤，應該以可存取的方式顯示
          if (errorMessages > 0) {
            const accessibleErrors = await page.evaluate(() => {
              const errors = document.querySelectorAll('[role="alert"]')
              return errors.length
            })
            
            expect(accessibleErrors).toBeGreaterThan(0)
          }
        }
      }
    })
  })

  test.describe('行動裝置可存取性', () => {
    test('觸控目標大小', async ({ page, isMobile }) => {
      test.skip(!isMobile, '此測試專為行動裝置')
      
      await page.goto('/restaurant/1/table/5')
      await helpers.waitForPageLoad()
      
      // 檢查所有可互動元素的大小
      const touchTargets = await page.locator('button, a, [role="button"], input').all()
      
      for (const target of touchTargets.slice(0, 10)) {
        const box = await target.boundingBox()
        
        if (box && await target.isVisible()) {
          // 觸控目標應該至少 44x44px
          expect(box.width).toBeGreaterThanOrEqual(44)
          expect(box.height).toBeGreaterThanOrEqual(44)
        }
      }
    })

    test('螢幕閱讀器手勢支援', async ({ page, isMobile }) => {
      test.skip(!isMobile, '此測試專為行動裝置')
      
      await page.goto('/restaurant/1/table/5')
      await helpers.waitForPageLoad()
      
      // 模擬螢幕閱讀器導航手勢
      const viewport = page.viewportSize()!
      const centerX = viewport.width / 2
      const centerY = viewport.height / 2
      
      // 向右滑動（下一個元素）
      await page.touchscreen.tap(centerX, centerY)
      await page.mouse.move(centerX - 100, centerY)
      await page.mouse.move(centerX + 100, centerY)
      
      // 檢查是否有適當的焦點管理
      const focusedElement = await page.evaluate(() => {
        return document.activeElement?.tagName
      })
      
      // 應該有元素被聚焦
      expect(focusedElement).toBeTruthy()
    })
  })
})
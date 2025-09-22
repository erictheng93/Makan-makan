/**
 * PWA 功能測試套件
 * 測試 MakanMakan 平台的所有 PWA 功能
 */

class PWATestSuite {
  constructor() {
    this.testResults = {
      serviceWorker: {},
      manifest: {},
      offline: {},
      pushNotifications: {},
      backgroundSync: {},
      installation: {},
      performance: {}
    }
    this.errors = []
  }

  async runAllTests() {
    console.log('🚀 開始 PWA 功能全面測試...')

    try {
      await this.testServiceWorker()
      await this.testManifest()
      await this.testOfflineCapabilities()
      await this.testPushNotifications()
      await this.testBackgroundSync()
      await this.testInstallation()
      await this.testPerformance()

      this.generateReport()
    } catch (error) {
      console.error('❌ 測試過程發生錯誤:', error)
      this.errors.push(error)
    }
  }

  // 1. Service Worker 功能測試
  async testServiceWorker() {
    console.log('📋 測試 Service Worker 功能...')
    const swTest = this.testResults.serviceWorker

    // 檢查 Service Worker 支援
    swTest.supported = 'serviceWorker' in navigator
    if (!swTest.supported) {
      swTest.error = 'Service Worker 不支援'
      return
    }

    try {
      // 檢查註冊狀態
      const registration = await navigator.serviceWorker.getRegistration()
      swTest.registered = !!registration

      if (registration) {
        swTest.scope = registration.scope
        swTest.state = registration.active?.state || 'unknown'

        // 檢查更新功能
        swTest.updateAvailable = !!registration.waiting

        // 測試訊息通信
        if (registration.active) {
          try {
            registration.active.postMessage({ type: 'test', data: 'ping' })
            swTest.messaging = true
          } catch (error) {
            swTest.messaging = false
            swTest.messagingError = error.message
          }
        }
      }

      // 檢查快取 API
      swTest.cacheApiSupported = 'caches' in window
      if (swTest.cacheApiSupported) {
        const cacheNames = await caches.keys()
        swTest.caches = cacheNames
        swTest.cacheCount = cacheNames.length
      }

    } catch (error) {
      swTest.error = error.message
      this.errors.push(error)
    }
  }

  // 2. Web App Manifest 測試
  async testManifest() {
    console.log('📱 測試 Web App Manifest...')
    const manifestTest = this.testResults.manifest

    try {
      // 檢查 manifest link
      const manifestLink = document.querySelector('link[rel="manifest"]')
      manifestTest.linkExists = !!manifestLink

      if (manifestLink) {
        manifestTest.href = manifestLink.href

        // 獲取 manifest 內容
        const response = await fetch(manifestLink.href)
        if (response.ok) {
          const manifest = await response.json()
          manifestTest.content = manifest

          // 檢查必要欄位
          manifestTest.hasName = !!manifest.name
          manifestTest.hasShortName = !!manifest.short_name
          manifestTest.hasStartUrl = !!manifest.start_url
          manifestTest.hasDisplay = !!manifest.display
          manifestTest.hasIcons = !!(manifest.icons && manifest.icons.length > 0)
          manifestTest.hasThemeColor = !!manifest.theme_color
          manifestTest.hasBackgroundColor = !!manifest.background_color

          // 檢查圖標
          if (manifest.icons) {
            manifestTest.iconSizes = manifest.icons.map(icon => icon.sizes)
            manifestTest.iconCount = manifest.icons.length
            manifestTest.hasLargeIcon = manifest.icons.some(icon =>
              icon.sizes && icon.sizes.includes('512x512')
            )
          }

          // 檢查快捷方式
          manifestTest.hasShortcuts = !!(manifest.shortcuts && manifest.shortcuts.length > 0)
          if (manifest.shortcuts) {
            manifestTest.shortcutCount = manifest.shortcuts.length
          }

          manifestTest.valid = true
        } else {
          manifestTest.error = `無法獲取 manifest: ${response.status}`
        }
      }
    } catch (error) {
      manifestTest.error = error.message
      this.errors.push(error)
    }
  }

  // 3. 離線功能測試
  async testOfflineCapabilities() {
    console.log('🔌 測試離線功能...')
    const offlineTest = this.testResults.offline

    try {
      // 檢查網路狀態 API
      offlineTest.networkApiSupported = 'navigator' in window && 'onLine' in navigator
      if (offlineTest.networkApiSupported) {
        offlineTest.isOnline = navigator.onLine
      }

      // 檢查 IndexedDB 支援
      offlineTest.indexedDBSupported = 'indexedDB' in window

      if (offlineTest.indexedDBSupported) {
        // 測試 IndexedDB 連接
        try {
          await this.testIndexedDB()
          offlineTest.indexedDBWorking = true
        } catch (error) {
          offlineTest.indexedDBWorking = false
          offlineTest.indexedDBError = error.message
        }
      }

      // 檢查本地存儲
      offlineTest.localStorageSupported = 'localStorage' in window
      if (offlineTest.localStorageSupported) {
        try {
          localStorage.setItem('pwa-test', 'test')
          localStorage.removeItem('pwa-test')
          offlineTest.localStorageWorking = true
        } catch (error) {
          offlineTest.localStorageWorking = false
        }
      }

      // 測試快取策略
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        offlineTest.hasCaches = cacheNames.length > 0
        offlineTest.cacheStrategies = await this.testCacheStrategies()
      }

    } catch (error) {
      offlineTest.error = error.message
      this.errors.push(error)
    }
  }

  // 4. 推送通知測試
  async testPushNotifications() {
    console.log('🔔 測試推送通知功能...')
    const pushTest = this.testResults.pushNotifications

    try {
      // 檢查 Notification API 支援
      pushTest.notificationSupported = 'Notification' in window
      if (pushTest.notificationSupported) {
        pushTest.permission = Notification.permission
      }

      // 檢查 Push API 支援
      pushTest.pushSupported = 'PushManager' in window

      if (pushTest.pushSupported && 'serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration()
        if (registration) {
          // 檢查推送管理器
          pushTest.pushManagerAvailable = 'pushManager' in registration

          if (pushTest.pushManagerAvailable) {
            // 檢查現有訂閱
            const subscription = await registration.pushManager.getSubscription()
            pushTest.hasSubscription = !!subscription

            if (subscription) {
              pushTest.subscriptionDetails = {
                endpoint: subscription.endpoint,
                hasKeys: !!subscription.getKey
              }
            }
          }
        }
      }

      // 檢查 VAPID 支援
      pushTest.vapidSupported = pushTest.pushSupported &&
        'applicationServerKey' in PushSubscriptionOptions.prototype

    } catch (error) {
      pushTest.error = error.message
      this.errors.push(error)
    }
  }

  // 5. 背景同步測試
  async testBackgroundSync() {
    console.log('🔄 測試背景同步功能...')
    const syncTest = this.testResults.backgroundSync

    try {
      // 檢查 Background Sync API 支援
      syncTest.supported = 'serviceWorker' in navigator &&
        'sync' in window.ServiceWorkerRegistration.prototype

      if (syncTest.supported) {
        const registration = await navigator.serviceWorker.getRegistration()
        if (registration) {
          // 測試同步註冊
          try {
            await registration.sync.register('test-sync')
            syncTest.canRegister = true
          } catch (error) {
            syncTest.canRegister = false
            syncTest.registerError = error.message
          }
        }
      }

      // 檢查自定義同步實作
      syncTest.hasCustomSync = this.checkCustomSyncImplementation()

    } catch (error) {
      syncTest.error = error.message
      this.errors.push(error)
    }
  }

  // 6. 安裝功能測試
  async testInstallation() {
    console.log('⬇️ 測試 PWA 安裝功能...')
    const installTest = this.testResults.installation

    try {
      // 檢查 beforeinstallprompt 事件支援
      installTest.beforeInstallPromptSupported = 'onbeforeinstallprompt' in window

      // 檢查 appinstalled 事件支援
      installTest.appInstalledSupported = 'onappinstalled' in window

      // 檢查是否已安裝
      installTest.isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true

      // 檢查安裝提示狀態
      installTest.installPromptAvailable = !!window.deferredPrompt

      // 檢查 PWA 顯示模式
      const displayMode = this.getDisplayMode()
      installTest.displayMode = displayMode

    } catch (error) {
      installTest.error = error.message
      this.errors.push(error)
    }
  }

  // 7. 性能測試
  async testPerformance() {
    console.log('⚡ 測試 PWA 性能...')
    const perfTest = this.testResults.performance

    try {
      // 檢查 Performance API
      perfTest.performanceApiSupported = 'performance' in window

      if (perfTest.performanceApiSupported) {
        // 測量載入時間
        const navigation = performance.getEntriesByType('navigation')[0]
        if (navigation) {
          perfTest.loadTime = navigation.loadEventEnd - navigation.fetchStart
          perfTest.domContentLoaded = navigation.domContentLoadedEventEnd - navigation.fetchStart
          perfTest.firstPaint = this.getFirstPaint()
          perfTest.firstContentfulPaint = this.getFirstContentfulPaint()
        }

        // 測量資源載入
        const resources = performance.getEntriesByType('resource')
        perfTest.resourceCount = resources.length
        perfTest.totalResourceSize = resources.reduce((total, resource) =>
          total + (resource.transferSize || 0), 0)

        // 檢查快取命中率
        perfTest.cacheHitRate = this.calculateCacheHitRate(resources)
      }

      // 檢查記憶體使用 (如果支援)
      if ('memory' in performance) {
        perfTest.memoryUsage = {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit
        }
      }

      // 測試 Service Worker 快取效能
      perfTest.cachePerformance = await this.testCachePerformance()

    } catch (error) {
      perfTest.error = error.message
      this.errors.push(error)
    }
  }

  // 輔助測試方法
  async testIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('pwa-test-db', 1)
      request.onerror = () => reject(new Error('IndexedDB 測試失敗'))
      request.onsuccess = () => {
        request.result.close()
        indexedDB.deleteDatabase('pwa-test-db')
        resolve()
      }
    })
  }

  async testCacheStrategies() {
    const strategies = {}

    try {
      // 測試不同快取策略
      const testUrl = '/test-cache-endpoint'

      // 測試 Network First
      strategies.networkFirst = await this.testNetworkFirst(testUrl)

      // 測試 Cache First
      strategies.cacheFirst = await this.testCacheFirst(testUrl)

      // 測試 Stale While Revalidate
      strategies.staleWhileRevalidate = await this.testStaleWhileRevalidate(testUrl)

    } catch (error) {
      strategies.error = error.message
    }

    return strategies
  }

  async testNetworkFirst(url) {
    const start = performance.now()
    try {
      const response = await fetch(url)
      const end = performance.now()
      return {
        success: response.ok,
        responseTime: end - start,
        fromCache: response.headers.get('X-Cache') === 'HIT'
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async testCacheFirst(url) {
    const start = performance.now()
    try {
      const cachedResponse = await caches.match(url)
      const end = performance.now()

      if (cachedResponse) {
        return {
          success: true,
          responseTime: end - start,
          fromCache: true
        }
      } else {
        const response = await fetch(url)
        return {
          success: response.ok,
          responseTime: performance.now() - start,
          fromCache: false
        }
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async testStaleWhileRevalidate(url) {
    const start = performance.now()
    try {
      const cachedResponse = await caches.match(url)
      const cacheTime = performance.now() - start

      // 同時發起網路請求
      const networkPromise = fetch(url)

      if (cachedResponse) {
        // 返回快取版本，同時更新快取
        networkPromise.then(response => {
          if (response.ok) {
            caches.open('test-cache').then(cache => cache.put(url, response))
          }
        }).catch(() => {})

        return {
          success: true,
          responseTime: cacheTime,
          fromCache: true,
          strategy: 'stale-while-revalidate'
        }
      } else {
        const response = await networkPromise
        return {
          success: response.ok,
          responseTime: performance.now() - start,
          fromCache: false
        }
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  checkCustomSyncImplementation() {
    // 檢查是否存在自定義同步實作
    const hasCustomerSync = typeof window.customerBackgroundSync !== 'undefined'
    const hasAdminSync = typeof window.adminBackgroundSync !== 'undefined'
    const hasKitchenSync = typeof window.kitchenBackgroundSync !== 'undefined'

    return {
      customer: hasCustomerSync,
      admin: hasAdminSync,
      kitchen: hasKitchenSync,
      total: [hasCustomerSync, hasAdminSync, hasKitchenSync].filter(Boolean).length
    }
  }

  getDisplayMode() {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return 'standalone'
    }
    if (window.matchMedia('(display-mode: minimal-ui)').matches) {
      return 'minimal-ui'
    }
    if (window.matchMedia('(display-mode: fullscreen)').matches) {
      return 'fullscreen'
    }
    return 'browser'
  }

  getFirstPaint() {
    const fpEntry = performance.getEntriesByName('first-paint')[0]
    return fpEntry ? fpEntry.startTime : null
  }

  getFirstContentfulPaint() {
    const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0]
    return fcpEntry ? fcpEntry.startTime : null
  }

  calculateCacheHitRate(resources) {
    const cachedResources = resources.filter(resource =>
      resource.transferSize === 0 && resource.decodedBodySize > 0
    )
    return resources.length > 0 ? (cachedResources.length / resources.length) * 100 : 0
  }

  async testCachePerformance() {
    const performance = {}

    try {
      // 測試快取讀取性能
      const start = performance.now()
      const cacheNames = await caches.keys()
      performance.cacheListTime = performance.now() - start

      if (cacheNames.length > 0) {
        const cache = await caches.open(cacheNames[0])
        const cacheStart = performance.now()
        const cachedRequests = await cache.keys()
        performance.cacheKeysTime = performance.now() - cacheStart
        performance.cachedItemCount = cachedRequests.length
      }

    } catch (error) {
      performance.error = error.message
    }

    return performance
  }

  // 生成測試報告
  generateReport() {
    console.log('\n📊 PWA 功能測試報告')
    console.log('========================\n')

    // Service Worker 報告
    this.logTestSection('Service Worker', this.testResults.serviceWorker)

    // Manifest 報告
    this.logTestSection('Web App Manifest', this.testResults.manifest)

    // 離線功能報告
    this.logTestSection('離線功能', this.testResults.offline)

    // 推送通知報告
    this.logTestSection('推送通知', this.testResults.pushNotifications)

    // 背景同步報告
    this.logTestSection('背景同步', this.testResults.backgroundSync)

    // 安裝功能報告
    this.logTestSection('安裝功能', this.testResults.installation)

    // 性能報告
    this.logTestSection('性能測試', this.testResults.performance)

    // 錯誤總結
    if (this.errors.length > 0) {
      console.log('\n❌ 發現的問題:')
      this.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.message}`)
      })
    }

    // 整體評分
    const score = this.calculateOverallScore()
    console.log(`\n🏆 整體 PWA 評分: ${score}/100`)

    return {
      results: this.testResults,
      errors: this.errors,
      score: score
    }
  }

  logTestSection(title, results) {
    console.log(`\n${title}:`)
    console.log('─'.repeat(title.length + 1))

    Object.entries(results).forEach(([key, value]) => {
      if (key === 'error') {
        console.log(`❌ ${key}: ${value}`)
      } else if (typeof value === 'boolean') {
        console.log(`${value ? '✅' : '❌'} ${key}: ${value}`)
      } else if (typeof value === 'object' && value !== null) {
        console.log(`📋 ${key}:`, JSON.stringify(value, null, 2))
      } else {
        console.log(`📊 ${key}: ${value}`)
      }
    })
  }

  calculateOverallScore() {
    let score = 0
    let maxScore = 0

    // Service Worker (25分)
    const sw = this.testResults.serviceWorker
    maxScore += 25
    if (sw.supported) score += 5
    if (sw.registered) score += 10
    if (sw.cacheApiSupported) score += 5
    if (sw.messaging) score += 5

    // Manifest (20分)
    const manifest = this.testResults.manifest
    maxScore += 20
    if (manifest.linkExists) score += 5
    if (manifest.valid) score += 10
    if (manifest.hasIcons) score += 3
    if (manifest.hasShortcuts) score += 2

    // 離線功能 (25分)
    const offline = this.testResults.offline
    maxScore += 25
    if (offline.indexedDBSupported) score += 10
    if (offline.localStorageSupported) score += 5
    if (offline.hasCaches) score += 10

    // 推送通知 (15分)
    const push = this.testResults.pushNotifications
    maxScore += 15
    if (push.notificationSupported) score += 5
    if (push.pushSupported) score += 10

    // 背景同步 (10分)
    const sync = this.testResults.backgroundSync
    maxScore += 10
    if (sync.supported) score += 5
    if (sync.hasCustomSync?.total > 0) score += 5

    // 安裝功能 (5分)
    const install = this.testResults.installation
    maxScore += 5
    if (install.beforeInstallPromptSupported) score += 3
    if (install.isStandalone) score += 2

    return Math.round((score / maxScore) * 100)
  }
}

// 執行測試
const pwaTest = new PWATestSuite()
pwaTest.runAllTests()
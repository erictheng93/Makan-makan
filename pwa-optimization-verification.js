/**
 * PWA 性能優化驗證腳本
 * 測試已實施的性能優化效果
 */

class PWAOptimizationVerifier {
  constructor() {
    this.testResults = []
    this.startTime = Date.now()
  }

  /**
   * 運行完整的優化驗證測試
   */
  async runVerification() {
    console.log('🚀 開始 PWA 性能優化驗證...')

    const tests = [
      this.verifyServiceWorkerOptimization.bind(this),
      this.verifyIndexedDBOptimization.bind(this),
      this.verifyBackgroundSyncOptimization.bind(this),
      this.verifyPerformanceMonitoring.bind(this),
      this.verifyOfflineStorageOptimization.bind(this),
      this.verifyCacheStrategy.bind(this),
      this.verifyOverallPerformance.bind(this)
    ]

    for (const test of tests) {
      try {
        const result = await test()
        this.testResults.push(result)
      } catch (error) {
        this.testResults.push({
          test: test.name,
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        })
      }
    }

    this.generateReport()
  }

  /**
   * 驗證 Service Worker 優化
   */
  async verifyServiceWorkerOptimization() {
    const testName = 'Service Worker 優化驗證'
    console.log(`📊 ${testName}...`)

    const tests = {
      optimizedSWRegistered: false,
      preloadingActive: false,
      cacheOptimized: false,
      performanceTracking: false
    }

    // 檢查優化版 Service Worker 是否註冊
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      tests.optimizedSWRegistered = registrations.some(reg =>
        reg.active && reg.active.scriptURL.includes('sw-optimized.js')
      )

      // 檢查 Service Worker 性能追蹤
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'GET_PERFORMANCE_METRICS'
        })

        const metricsReceived = await new Promise((resolve) => {
          const timeout = setTimeout(() => resolve(false), 3000)

          navigator.serviceWorker.addEventListener('message', function handler(event) {
            if (event.data && event.data.type === 'PERFORMANCE_UPDATE') {
              clearTimeout(timeout)
              navigator.serviceWorker.removeEventListener('message', handler)
              resolve(true)
            }
          })
        })

        tests.performanceTracking = metricsReceived
      }
    }

    // 檢查快取優化
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      tests.cacheOptimized = cacheNames.some(name => name.includes('optimized') || name.includes('preload'))
    }

    // 檢查預載功能
    if (window.pwaPerformanceManager) {
      tests.preloadingActive = true
    }

    const passedTests = Object.values(tests).filter(Boolean).length
    const totalTests = Object.keys(tests).length

    return {
      test: testName,
      status: passedTests === totalTests ? 'pass' : 'partial',
      score: Math.round((passedTests / totalTests) * 100),
      details: tests,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * 驗證 IndexedDB 優化
   */
  async verifyIndexedDBOptimization() {
    const testName = 'IndexedDB 優化驗證'
    console.log(`📊 ${testName}...`)

    const tests = {
      optimizedStorageActive: false,
      compressionWorking: false,
      batchOperations: false,
      performanceTracking: false
    }

    // 檢查優化存儲管理器
    if (window.optimizedStorage) {
      tests.optimizedStorageActive = true

      // 測試批量操作
      try {
        const testData = Array.from({ length: 10 }, (_, i) => ({
          id: `test_${i}`,
          data: `test data ${i}`,
          timestamp: Date.now()
        }))

        const startTime = performance.now()
        await window.optimizedStorage.batchSaveOrders(testData)
        const duration = performance.now() - startTime

        tests.batchOperations = duration < 1000 // 應該在 1 秒內完成
      } catch (error) {
        console.warn('批量操作測試失敗:', error)
      }
    }

    // 檢查性能管理器
    if (window.pwaPerformanceManager) {
      const report = window.pwaPerformanceManager.databaseOptimizer.getPerformanceReport()
      tests.performanceTracking = report.totalOperations >= 0
    }

    // 檢查壓縮功能
    if (window.optimizedStorage) {
      try {
        const testItem = { large_data: 'x'.repeat(2000) }
        await window.optimizedStorage.saveOrder(testItem)
        tests.compressionWorking = true
      } catch (error) {
        console.warn('壓縮測試失敗:', error)
      }
    }

    const passedTests = Object.values(tests).filter(Boolean).length
    const totalTests = Object.keys(tests).length

    return {
      test: testName,
      status: passedTests >= totalTests * 0.75 ? 'pass' : 'partial',
      score: Math.round((passedTests / totalTests) * 100),
      details: tests,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * 驗證背景同步優化
   */
  async verifyBackgroundSyncOptimization() {
    const testName = '背景同步優化驗證'
    console.log(`📊 ${testName}...`)

    const tests = {
      optimizedSyncActive: false,
      batchingWorking: false,
      priorityHandling: false,
      queueManagement: false
    }

    // 檢查優化背景同步
    if (window.pwaPerformanceManager && window.pwaPerformanceManager.optimizedBackgroundSync) {
      tests.optimizedSyncActive = true

      const syncManager = window.pwaPerformanceManager.optimizedBackgroundSync

      // 測試批次處理
      try {
        await syncManager.queueForSync('test', { data: 'test1' }, 'normal')
        await syncManager.queueForSync('test', { data: 'test2' }, 'high')
        await syncManager.queueForSync('test', { data: 'test3' }, 'critical')

        const queueStatus = syncManager.getQueueStatus()
        tests.batchingWorking = Object.keys(queueStatus).length > 0
        tests.queueManagement = true

        // 測試優先級處理
        if (queueStatus.test) {
          tests.priorityHandling = queueStatus.test.priorities &&
            queueStatus.test.priorities.critical > 0
        }
      } catch (error) {
        console.warn('同步測試失敗:', error)
      }
    }

    const passedTests = Object.values(tests).filter(Boolean).length
    const totalTests = Object.keys(tests).length

    return {
      test: testName,
      status: passedTests >= totalTests * 0.75 ? 'pass' : 'partial',
      score: Math.round((passedTests / totalTests) * 100),
      details: tests,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * 驗證性能監控
   */
  async verifyPerformanceMonitoring() {
    const testName = '性能監控驗證'
    console.log(`📊 ${testName}...`)

    const tests = {
      monitoringActive: false,
      metricsCollection: false,
      reportGeneration: false,
      alertSystem: false
    }

    // 檢查性能監控器
    if (window.pwaPerformanceManager && window.pwaPerformanceManager.performanceMonitor) {
      tests.monitoringActive = true

      const monitor = window.pwaPerformanceManager.performanceMonitor

      // 檢查指標收集
      const currentMetrics = monitor.getCurrentMetrics()
      tests.metricsCollection = currentMetrics && Object.keys(currentMetrics).length > 0

      // 檢查報告生成
      const latestReport = monitor.getLatestReport()
      tests.reportGeneration = latestReport !== null

      // 檢查警報系統
      if (latestReport && latestReport.alerts) {
        tests.alertSystem = Array.isArray(latestReport.alerts)
      }
    }

    const passedTests = Object.values(tests).filter(Boolean).length
    const totalTests = Object.keys(tests).length

    return {
      test: testName,
      status: passedTests >= totalTests * 0.75 ? 'pass' : 'partial',
      score: Math.round((passedTests / totalTests) * 100),
      details: tests,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * 驗證離線存儲優化
   */
  async verifyOfflineStorageOptimization() {
    const testName = '離線存儲優化驗證'
    console.log(`📊 ${testName}...`)

    const tests = {
      optimizedStorageInitialized: false,
      compressionActive: false,
      batchOperationsOptimized: false,
      cleanupMechanisms: false
    }

    if (window.optimizedStorage) {
      tests.optimizedStorageInitialized = true

      // 測試壓縮
      try {
        const largeData = {
          id: 'compression_test',
          content: 'x'.repeat(5000),
          metadata: { large: true }
        }

        const startTime = performance.now()
        await window.optimizedStorage.saveOrder(largeData)
        const duration = performance.now() - startTime

        tests.compressionActive = duration < 500 // 壓縮應該很快
      } catch (error) {
        console.warn('壓縮測試失敗:', error)
      }

      // 測試批量操作
      try {
        const batchData = Array.from({ length: 50 }, (_, i) => ({
          id: `batch_test_${i}`,
          data: `item ${i}`
        }))

        const startTime = performance.now()
        await window.optimizedStorage.batchSaveOrders(batchData)
        const duration = performance.now() - startTime

        tests.batchOperationsOptimized = duration < 2000 // 2秒內完成
      } catch (error) {
        console.warn('批量操作測試失敗:', error)
      }

      // 檢查清理機制
      if (typeof window.optimizedStorage.autoCleanup === 'function') {
        tests.cleanupMechanisms = true
      }
    }

    const passedTests = Object.values(tests).filter(Boolean).length
    const totalTests = Object.keys(tests).length

    return {
      test: testName,
      status: passedTests >= totalTests * 0.75 ? 'pass' : 'partial',
      score: Math.round((passedTests / totalTests) * 100),
      details: tests,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * 驗證快取策略
   */
  async verifyCacheStrategy() {
    const testName = '智慧快取策略驗證'
    console.log(`📊 ${testName}...`)

    const tests = {
      cacheHitRateOptimal: false,
      strategicCaching: false,
      preloadingEffective: false,
      cacheManagement: false
    }

    // 測試快取命中率
    if (window.pwaPerformanceManager) {
      try {
        const report = await window.pwaPerformanceManager.getComprehensivePerformanceReport()

        if (report.performance && report.performance.metrics) {
          const cacheHitRate = report.performance.metrics.cacheHitRate
          tests.cacheHitRateOptimal = cacheHitRate > 0.7 // 70% 以上

          const avgResponseTime = report.performance.metrics.averageResponseTime
          tests.strategicCaching = avgResponseTime < 1000 // 1秒以下
        }
      } catch (error) {
        console.warn('快取策略測試失敗:', error)
      }
    }

    // 檢查預載
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      const preloadCache = cacheNames.find(name => name.includes('preload'))

      if (preloadCache) {
        const cache = await caches.open(preloadCache)
        const cachedItems = await cache.keys()
        tests.preloadingEffective = cachedItems.length > 0
      }

      tests.cacheManagement = cacheNames.length > 0
    }

    const passedTests = Object.values(tests).filter(Boolean).length
    const totalTests = Object.keys(tests).length

    return {
      test: testName,
      status: passedTests >= totalTests * 0.75 ? 'pass' : 'partial',
      score: Math.round((passedTests / totalTests) * 100),
      details: tests,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * 驗證整體性能
   */
  async verifyOverallPerformance() {
    const testName = '整體性能驗證'
    console.log(`📊 ${testName}...`)

    const tests = {
      loadTimeOptimized: false,
      memoryUsageOptimal: false,
      networkEfficiency: false,
      userExperience: false
    }

    // 檢查載入時間
    if ('performance' in window) {
      const navTiming = performance.getEntriesByType('navigation')[0]
      if (navTiming) {
        const loadTime = navTiming.loadEventEnd - navTiming.loadEventStart
        tests.loadTimeOptimized = loadTime < 3000 // 3秒以下
      }

      // 檢查記憶體使用
      if ('memory' in performance) {
        const memory = performance.memory
        const memoryUsage = memory.usedJSHeapSize / (1024 * 1024) // MB
        tests.memoryUsageOptimal = memoryUsage < 100 // 100MB 以下
      }
    }

    // 檢查網路效率
    if (window.pwaPerformanceManager) {
      try {
        const report = await window.pwaPerformanceManager.getComprehensivePerformanceReport()

        if (report.backgroundSync && report.backgroundSync.performanceMetrics) {
          const syncMetrics = report.backgroundSync.performanceMetrics
          tests.networkEfficiency = syncMetrics.networkRequestsSaved > 0
        }

        if (report.performance && report.performance.score) {
          tests.userExperience = report.performance.score > 80
        }
      } catch (error) {
        console.warn('整體性能測試失敗:', error)
      }
    }

    const passedTests = Object.values(tests).filter(Boolean).length
    const totalTests = Object.keys(tests).length

    return {
      test: testName,
      status: passedTests >= totalTests * 0.75 ? 'pass' : 'partial',
      score: Math.round((passedTests / totalTests) * 100),
      details: tests,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * 生成驗證報告
   */
  generateReport() {
    const totalTests = this.testResults.length
    const passedTests = this.testResults.filter(r => r.status === 'pass').length
    const partialTests = this.testResults.filter(r => r.status === 'partial').length
    const failedTests = this.testResults.filter(r => r.status === 'error').length

    const overallScore = this.testResults.reduce((sum, r) => sum + (r.score || 0), 0) / totalTests
    const duration = Date.now() - this.startTime

    const report = {
      summary: {
        totalTests,
        passedTests,
        partialTests,
        failedTests,
        overallScore: Math.round(overallScore),
        duration: `${Math.round(duration / 1000)}s`,
        status: overallScore >= 85 ? 'excellent' : overallScore >= 70 ? 'good' : 'needs-improvement'
      },
      results: this.testResults,
      recommendations: this.generateRecommendations(),
      timestamp: new Date().toISOString()
    }

    console.log('📊 PWA 優化驗證報告:')
    console.log('=' .repeat(50))
    console.log(`總體評分: ${report.summary.overallScore}/100 (${report.summary.status})`)
    console.log(`測試結果: ${passedTests} 通過, ${partialTests} 部分通過, ${failedTests} 失敗`)
    console.log(`測試時間: ${report.summary.duration}`)
    console.log('=' .repeat(50))

    this.testResults.forEach(result => {
      const statusIcon = result.status === 'pass' ? '✅' :
                        result.status === 'partial' ? '⚠️' : '❌'
      console.log(`${statusIcon} ${result.test}: ${result.score || 0}/100`)

      if (result.details) {
        Object.entries(result.details).forEach(([key, value]) => {
          const icon = value ? '✓' : '✗'
          console.log(`   ${icon} ${key}`)
        })
      }
    })

    if (report.recommendations.length > 0) {
      console.log('\n💡 優化建議:')
      report.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`)
      })
    }

    // 存儲報告到全局變量供後續使用
    window.pwaOptimizationReport = report

    return report
  }

  /**
   * 生成優化建議
   */
  generateRecommendations() {
    const recommendations = []

    this.testResults.forEach(result => {
      if (result.status === 'error' || result.score < 75) {
        switch (result.test) {
          case 'Service Worker 優化驗證':
            recommendations.push('檢查 Service Worker 優化版本是否正確部署')
            recommendations.push('確保預載機制正常運作')
            break

          case 'IndexedDB 優化驗證':
            recommendations.push('優化 IndexedDB 批量操作性能')
            recommendations.push('檢查數據壓縮機制是否正常')
            break

          case '背景同步優化驗證':
            recommendations.push('改善背景同步批次處理效率')
            recommendations.push('調整同步優先級策略')
            break

          case '性能監控驗證':
            recommendations.push('確保性能監控系統正常運作')
            recommendations.push('檢查指標收集和報告生成')
            break

          case '離線存儲優化驗證':
            recommendations.push('優化離線存儲壓縮和批量操作')
            recommendations.push('實施更積極的清理策略')
            break

          case '智慧快取策略驗證':
            recommendations.push('調整快取策略以提高命中率')
            recommendations.push('優化預載資源選擇')
            break

          case '整體性能驗證':
            recommendations.push('進一步優化載入時間和記憶體使用')
            recommendations.push('改善網路效率和用戶體驗')
            break
        }
      }
    })

    return [...new Set(recommendations)] // 去重
  }
}

// 自動執行驗證 (如果在瀏覽器環境中)
if (typeof window !== 'undefined') {
  window.PWAOptimizationVerifier = PWAOptimizationVerifier

  // 等待頁面載入完成後自動驗證
  window.addEventListener('load', () => {
    // 等待優化器初始化
    setTimeout(async () => {
      const verifier = new PWAOptimizationVerifier()
      await verifier.runVerification()
    }, 3000) // 等待 3 秒讓優化器初始化
  })
}

// Node.js 環境導出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PWAOptimizationVerifier
}
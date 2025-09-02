// Test runner utility for organizing and running integration tests
// Test framework utilities available globally in Vitest

// Test suite configuration
export interface TestSuiteConfig {
  name: string
  description: string
  setupTimeout: number
  teardownTimeout: number
  parallel: boolean
}

// Test result tracking
export interface TestResults {
  suite: string
  passed: number
  failed: number
  duration: number
  errors: Error[]
}

export class IntegrationTestRunner {
  private results: TestResults[] = []
  private startTime: number = 0
  
  constructor(private config: TestSuiteConfig) {}

  async runSuite(testFn: () => Promise<void>): Promise<TestResults> {
    this.startTime = performance.now()
    
    console.log(`🧪 Running test suite: ${this.config.name}`)
    console.log(`📝 Description: ${this.config.description}`)
    
    const result: TestResults = {
      suite: this.config.name,
      passed: 0,
      failed: 0,
      duration: 0,
      errors: []
    }
    
    try {
      await testFn()
      result.passed++
    } catch (error) {
      result.failed++
      result.errors.push(error as Error)
    }
    
    result.duration = performance.now() - this.startTime
    this.results.push(result)
    
    this.printResults(result)
    return result
  }

  private printResults(result: TestResults): void {
    const duration = Math.round(result.duration)
    
    console.log(`\n📊 Test Results for ${result.suite}:`)
    console.log(`✅ Passed: ${result.passed}`)
    console.log(`❌ Failed: ${result.failed}`)
    console.log(`⏱️ Duration: ${duration}ms`)
    
    if (result.errors.length > 0) {
      console.log(`\n🚨 Errors:`)
      result.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.message}`)
      })
    }
    
    console.log('─'.repeat(50))
  }

  getOverallResults(): {
    totalPassed: number
    totalFailed: number
    totalDuration: number
    successRate: number
  } {
    const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0)
    const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0)
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0)
    const total = totalPassed + totalFailed
    const successRate = total > 0 ? (totalPassed / total) * 100 : 0
    
    return {
      totalPassed,
      totalFailed,
      totalDuration: Math.round(totalDuration),
      successRate: Math.round(successRate * 100) / 100
    }
  }

  printOverallSummary(): void {
    const summary = this.getOverallResults()
    
    console.log('\n' + '='.repeat(60))
    console.log('🏁 OVERALL TEST SUMMARY')
    console.log('='.repeat(60))
    console.log(`📈 Success Rate: ${summary.successRate}%`)
    console.log(`✅ Total Passed: ${summary.totalPassed}`)
    console.log(`❌ Total Failed: ${summary.totalFailed}`)
    console.log(`⏱️ Total Duration: ${summary.totalDuration}ms`)
    
    if (summary.successRate === 100) {
      console.log('🎉 All tests passed!')
    } else if (summary.successRate >= 80) {
      console.log('⚠️ Most tests passed, but some issues need attention')
    } else {
      console.log('🚨 Many tests failed, significant issues detected')
    }
    
    console.log('='.repeat(60))
  }
}

// Predefined test suite configurations
export const testSuiteConfigs = {
  workflow: {
    name: 'Workflow Automation',
    description: 'Tests for automated workflow features',
    setupTimeout: 5000,
    teardownTimeout: 3000,
    parallel: false
  } as TestSuiteConfig,
  
  audio: {
    name: 'Audio Notifications',
    description: 'Tests for audio notification system',
    setupTimeout: 3000,
    teardownTimeout: 2000,
    parallel: true
  } as TestSuiteConfig,
  
  keyboard: {
    name: 'Keyboard Shortcuts',
    description: 'Tests for keyboard shortcut system',
    setupTimeout: 2000,
    teardownTimeout: 1000,
    parallel: true
  } as TestSuiteConfig,
  
  offline: {
    name: 'Offline Synchronization',
    description: 'Tests for offline mode and data sync',
    setupTimeout: 5000,
    teardownTimeout: 3000,
    parallel: false
  } as TestSuiteConfig,
  
  performance: {
    name: 'Performance Monitoring',
    description: 'Tests for performance tracking and analytics',
    setupTimeout: 3000,
    teardownTimeout: 2000,
    parallel: true
  } as TestSuiteConfig,
  
  endToEnd: {
    name: 'End-to-End Integration',
    description: 'Complete system integration tests',
    setupTimeout: 10000,
    teardownTimeout: 5000,
    parallel: false
  } as TestSuiteConfig
}

// Test data factory
export class TestDataFactory {
  static createMockOrder(overrides: Partial<any> = {}): any {
    return {
      id: Math.floor(Math.random() * 1000),
      orderNumber: `#${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      tableNumber: `T${Math.floor(Math.random() * 50) + 1}`,
      items: [
        {
          id: Math.floor(Math.random() * 1000),
          name: 'Test Item',
          status: 'pending',
          cookingTime: Math.floor(Math.random() * 30) + 5,
          priority: 'normal'
        }
      ],
      status: 1,
      totalAmount: Math.floor(Math.random() * 50) + 10,
      createdAt: new Date().toISOString(),
      elapsedTime: Math.floor(Math.random() * 20),
      estimatedTime: Math.floor(Math.random() * 30) + 5,
      priority: 'normal',
      customer: { name: '測試客戶', phone: '0912345678' },
      specialInstructions: '',
      assignedChef: null,
      ...overrides
    }
  }

  static createMockOrders(count: number): any[] {
    return Array.from({ length: count }, (_, i) => 
      this.createMockOrder({ id: i + 1 })
    )
  }

  static createPerformanceMetric(overrides: Partial<any> = {}): any {
    return {
      name: 'test_metric',
      value: Math.floor(Math.random() * 1000),
      unit: 'ms',
      timestamp: Date.now(),
      category: 'system',
      severity: 'info',
      ...overrides
    }
  }

  static createOfflineAction(overrides: Partial<any> = {}): any {
    return {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'start_cooking',
      orderId: Math.floor(Math.random() * 100) + 1,
      payload: {},
      timestamp: Date.now(),
      synced: false,
      retryCount: 0,
      ...overrides
    }
  }
}

// Test environment utilities
export class TestEnvironment {
  static async setupBrowser(): Promise<void> {
    // Setup browser-like environment for tests
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:3002',
        origin: 'http://localhost:3002'
      }
    })
  }

  static async cleanupBrowser(): Promise<void> {
    // Cleanup browser environment
    localStorage.clear()
    sessionStorage.clear()
  }

  static mockNetworkConditions(condition: 'online' | 'offline' | 'slow'): void {
    switch (condition) {
      case 'offline':
        Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
        break
      case 'online':
        Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
        break
      case 'slow': {
        // Mock slow network by adding delays to fetch
        const originalFetch = global.fetch
        global.fetch = (...args) => 
          new Promise(resolve => 
            setTimeout(() => resolve(originalFetch(...args)), 2000)
          )
        break
      }
    }
  }

  static resetNetworkConditions(): void {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
    // Reset fetch if it was mocked
    if (global.fetch.toString().includes('setTimeout')) {
      global.fetch = vi.fn()
    }
  }
}
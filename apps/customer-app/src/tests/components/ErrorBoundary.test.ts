import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'

// Mock console methods to avoid noise in tests
const consoleMock = {
  error: vi.fn(),
  warn: vi.fn()
}

vi.stubGlobal('console', {
  ...console,
  ...consoleMock
})

describe('ErrorBoundary.vue', () => {
  let wrapper: VueWrapper<any>
  
  // 創建一個會拋出錯誤的測試組件
  const ThrowingComponent = {
    name: 'ThrowingComponent',
    props: ['shouldThrow'],
    setup(props: any) {
      if (props.shouldThrow) {
        throw new Error('測試錯誤')
      }
      return () => '正常內容'
    }
  }

  beforeEach(() => {
    consoleMock.error.mockClear()
    consoleMock.warn.mockClear()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('正常狀態', () => {
    it('應該正常渲染子組件', () => {
      wrapper = mount(ErrorBoundary, {
        slots: {
          default: '<div>測試內容</div>'
        }
      })
      
      expect(wrapper.text()).toContain('測試內容')
      expect(wrapper.find('[data-testid="error-boundary"]').exists()).toBe(false)
    })

    it('沒有錯誤時不應該顯示錯誤頁面', () => {
      wrapper = mount(ErrorBoundary, {
        slots: {
          default: ThrowingComponent
        },
        props: {
          shouldThrow: false
        }
      })
      
      expect(wrapper.text()).toContain('正常內容')
      expect(wrapper.find('.min-h-screen.bg-gray-50').exists()).toBe(false)
    })
  })

  describe('錯誤捕獲', () => {
    it('應該捕獲子組件中的錯誤', async () => {
      wrapper = mount(ErrorBoundary, {
        global: {
          components: {
            ThrowingComponent
          }
        },
        slots: {
          default: '<ThrowingComponent :should-throw="true" />'
        }
      })
      
      await nextTick()
      
      expect(wrapper.find('.min-h-screen.bg-gray-50').exists()).toBe(true)
      expect(wrapper.text()).toContain('發生錯誤')
    })

    it('應該記錄錯誤到控制台', async () => {
      const error = new Error('測試錯誤')
      
      wrapper = mount(ErrorBoundary)
      
      // 模擬錯誤捕獲
      const vm = wrapper.vm as any
      vm.$options.errorCaptured(error, {}, 'test component')
      
      await nextTick()
      
      expect(consoleMock.error).toHaveBeenCalledWith(
        'ErrorBoundary captured an error:',
        error
      )
    })
  })

  describe('錯誤顯示', () => {
    beforeEach(async () => {
      wrapper = mount(ErrorBoundary)
      
      const vm = wrapper.vm as any
      vm.$options.errorCaptured(
        new Error('測試錯誤'),
        {},
        'test component'
      )
      
      await nextTick()
    })

    it('應該顯示錯誤圖標', () => {
      const errorIcon = wrapper.find('svg')
      expect(errorIcon.exists()).toBe(true)
      expect(errorIcon.classes()).toContain('text-red-600')
    })

    it('應該顯示錯誤標題', () => {
      expect(wrapper.text()).toContain('應用程式錯誤')
    })

    it('應該顯示錯誤描述', () => {
      expect(wrapper.text()).toContain('發生未預期的錯誤')
    })

    it('應該顯示重新載入按鈕', () => {
      const reloadBtn = wrapper.findAll('button')[0]
      expect(reloadBtn.text()).toContain('重新載入')
      expect(reloadBtn.classes()).toContain('bg-indigo-600')
    })

    it('應該顯示回到首頁按鈕', () => {
      const homeBtn = wrapper.findAll('button')[1]
      expect(homeBtn.text()).toContain('回到首頁')
      expect(homeBtn.classes()).toContain('bg-white')
    })

    it('應該顯示問題回報按鈕', () => {
      const reportBtn = wrapper.findAll('button')[2]
      expect(reportBtn.text()).toContain('回報問題')
    })
  })

  describe('錯誤類型處理', () => {
    it('應該識別 ChunkLoadError', async () => {
      wrapper = mount(ErrorBoundary)
      
      const chunkError = new Error('Loading chunk 123 failed')
      chunkError.name = 'ChunkLoadError'
      
      const vm = wrapper.vm as any
      vm.$options.errorCaptured(chunkError, {}, 'test')
      
      await nextTick()
      
      expect(wrapper.text()).toContain('載入失敗')
      expect(wrapper.text()).toContain('應用程式更新中')
    })

    it('應該識別網路錯誤', async () => {
      wrapper = mount(ErrorBoundary)
      
      const networkError = new Error('Network error')
      networkError.name = 'NetworkError'
      
      const vm = wrapper.vm as any
      vm.$options.errorCaptured(networkError, {}, 'test')
      
      await nextTick()
      
      expect(wrapper.text()).toContain('網路連接問題')
      expect(wrapper.text()).toContain('請檢查您的網路連接')
    })

    it('應該識別 fetch 相關錯誤', async () => {
      wrapper = mount(ErrorBoundary)
      
      const fetchError = new Error('fetch failed')
      
      const vm = wrapper.vm as any
      vm.$options.errorCaptured(fetchError, {}, 'test')
      
      await nextTick()
      
      expect(wrapper.text()).toContain('無法連接到伺服器')
    })
  })

  describe('開發模式功能', () => {
    beforeEach(() => {
      // 模擬開發環境
      vi.stubGlobal('import', {
        meta: {
          env: {
            DEV: true
          }
        }
      })
    })

    it('在開發模式下應該顯示錯誤詳情', async () => {
      wrapper = mount(ErrorBoundary)
      
      const error = new Error('詳細錯誤資訊')
      const vm = wrapper.vm as any
      vm.$options.errorCaptured(error, {}, 'test component stack')
      
      await nextTick()
      
      expect(wrapper.find('details').exists()).toBe(true)
      expect(wrapper.text()).toContain('顯示錯誤詳情')
    })

    it('應該顯示完整的錯誤堆疊', async () => {
      wrapper = mount(ErrorBoundary)
      
      const error = new Error('測試錯誤')
      error.stack = 'Error: 測試錯誤\n    at TestComponent'
      
      const vm = wrapper.vm as any
      vm.$options.errorCaptured(error, {}, 'component stack')
      
      await nextTick()
      
      const details = wrapper.find('pre')
      expect(details.exists()).toBe(true)
      expect(details.text()).toContain('測試錯誤')
    })
  })

  describe('生產模式行為', () => {
    beforeEach(() => {
      vi.stubGlobal('import', {
        meta: {
          env: {
            DEV: false
          }
        }
      })
    })

    it('在生產模式下不應該顯示錯誤詳情', async () => {
      wrapper = mount(ErrorBoundary)
      
      const error = new Error('敏感錯誤資訊')
      const vm = wrapper.vm as any
      vm.$options.errorCaptured(error, {}, 'test')
      
      await nextTick()
      
      expect(wrapper.find('details').exists()).toBe(false)
      expect(wrapper.text()).not.toContain('敏感錯誤資訊')
      expect(wrapper.text()).toContain('發生未預期的錯誤，我們正在處理這個問題')
    })
  })

  describe('用戶互動', () => {
    beforeEach(async () => {
      // Mock window.location.reload
      vi.stubGlobal('window', {
        location: {
          reload: vi.fn()
        }
      })

      wrapper = mount(ErrorBoundary, {
        global: {
          mocks: {
            $router: {
              push: vi.fn()
            }
          }
        }
      })
      
      const vm = wrapper.vm as any
      vm.$options.errorCaptured(new Error('測試'), {}, 'test')
      
      await nextTick()
    })

    it('點擊重新載入應該刷新頁面', async () => {
      const reloadBtn = wrapper.findAll('button')[0]
      await reloadBtn.trigger('click')
      
      expect(window.location.reload).toHaveBeenCalled()
    })

    it('點擊回到首頁應該導航到首頁', async () => {
      const homeBtn = wrapper.findAll('button')[1]
      await homeBtn.trigger('click')
      
      expect(wrapper.vm.$router.push).toHaveBeenCalledWith('/')
    })

    it('點擊問題回報應該複製錯誤資訊', async () => {
      // Mock clipboard API
      const mockWriteText = vi.fn()
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: mockWriteText
        }
      })

      const reportBtn = wrapper.findAll('button')[2]
      await reportBtn.trigger('click')
      
      expect(mockWriteText).toHaveBeenCalled()
    })
  })

  describe('全域錯誤處理', () => {
    it('應該處理未捕獲的 Promise rejection', async () => {
      wrapper = mount(ErrorBoundary)
      
      // 模擬未處理的 Promise rejection
      const rejectionEvent = new Event('unhandledrejection') as any
      rejectionEvent.reason = { message: 'Promise rejection error' }
      rejectionEvent.preventDefault = vi.fn()
      
      window.dispatchEvent(rejectionEvent)
      
      await nextTick()
      
      expect(wrapper.find('.min-h-screen.bg-gray-50').exists()).toBe(true)
      expect(rejectionEvent.preventDefault).toHaveBeenCalled()
    })

    it('應該處理全域 JavaScript 錯誤', async () => {
      wrapper = mount(ErrorBoundary)
      
      // 模擬全域錯誤
      const errorEvent = new ErrorEvent('error', {
        error: new Error('Global error'),
        message: 'Global error message'
      })
      
      window.dispatchEvent(errorEvent)
      
      await nextTick()
      
      expect(wrapper.find('.min-h-screen.bg-gray-50').exists()).toBe(true)
    })
  })

  describe('錯誤回報', () => {
    it('應該在有設定端點時回報錯誤', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response())
      vi.stubGlobal('fetch', mockFetch)
      
      vi.stubGlobal('import', {
        meta: {
          env: {
            VITE_ERROR_REPORTING_ENDPOINT: 'https://api.example.com/errors'
          }
        }
      })

      wrapper = mount(ErrorBoundary)
      
      const error = new Error('需要回報的錯誤')
      const vm = wrapper.vm as any
      vm.$options.errorCaptured(error, {}, 'component stack')
      
      await nextTick()
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/errors',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        })
      )
    })
  })
})
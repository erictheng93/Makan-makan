import { vi, beforeEach, afterEach } from 'vitest'
import { config } from '@vue/test-utils'
import 'jsdom'

// 全域 Mock
vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  }
}))

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(() => null),
    removeItem: vi.fn(() => null),
    clear: vi.fn(() => null)
  },
  writable: true
})

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(() => null),
    removeItem: vi.fn(() => null),
    clear: vi.fn(() => null)
  },
  writable: true
})

// Mock fetch
global.fetch = vi.fn()

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
}))

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'mock-url')

// Vue Test Utils 全域配置
config.global.mocks = {
  $t: (key: string, params?: any) => key + (params ? JSON.stringify(params) : ''),
  $route: { 
    params: {}, 
    query: {}, 
    path: '/',
    name: 'home'
  },
  $router: { 
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    go: vi.fn()
  }
}

// 環境變數設置
process.env.NODE_ENV = 'test'
process.env.VITE_API_BASE_URL = 'http://localhost:3000'
process.env.VITE_APP_TITLE = 'MakanMakan Test'

// 測試前後清理
beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})
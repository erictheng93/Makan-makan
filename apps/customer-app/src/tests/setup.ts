import { vi } from 'vitest'

// Mock localStorage with proper implementation
const localStorageMock = {
  getItem: vi.fn((key: string) => {
    if (key === 'makanmakan_language') return 'zh-TW'
    return null
  }),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
})

// Mock navigator
Object.defineProperty(window, 'navigator', {
  value: {
    language: 'zh-TW',
    languages: ['zh-TW', 'zh', 'en'],
  },
  writable: true
})

// Mock document.documentElement
const documentElementMock = {
  lang: 'zh-TW',
  dir: 'ltr'
}
Object.defineProperty(document, 'documentElement', {
  value: documentElementMock,
  writable: true
})

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

// Make mocks available globally for tests
declare global {
  var localStorageMock: any
  var documentElementMock: any
}

;(global as any).localStorageMock = localStorageMock
;(global as any).documentElementMock = documentElementMock
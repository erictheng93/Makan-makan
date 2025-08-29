// Test setup configuration
import { vi } from 'vitest'
import { config } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'

// Mock global objects
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock Web Audio API
global.AudioContext = vi.fn().mockImplementation(() => ({
  createOscillator: vi.fn().mockReturnValue({
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    frequency: { value: 440 }
  }),
  createGain: vi.fn().mockReturnValue({
    connect: vi.fn(),
    gain: { value: 1 }
  }),
  destination: {}
}))

global.webkitAudioContext = global.AudioContext

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = localStorageMock

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.sessionStorage = sessionStorageMock

// Mock EventSource
global.EventSource = vi.fn().mockImplementation(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  close: vi.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSED: 2
}))

// Mock Howler.js
vi.mock('howler', () => ({
  Howl: vi.fn().mockImplementation(() => ({
    play: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    volume: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    state: vi.fn().mockReturnValue('loaded')
  }))
}))

// Mock SortableJS
vi.mock('sortablejs', () => ({
  default: vi.fn().mockImplementation(() => ({
    destroy: vi.fn()
  }))
}))

// Global test configuration for Vue Test Utils
config.global.plugins = [createPinia()]
config.global.mocks = {
  $router: createRouter({
    history: createWebHistory(),
    routes: []
  }),
  $route: {
    params: {},
    query: {},
    path: '/',
    name: 'test'
  }
}

// Mock performance.now for performance tests
global.performance = {
  ...global.performance,
  now: vi.fn(() => Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByName: vi.fn().mockReturnValue([]),
  getEntriesByType: vi.fn().mockReturnValue([])
}

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
})

// Mock window events
global.window = Object.create(window)
Object.defineProperty(window, 'addEventListener', {
  value: vi.fn()
})
Object.defineProperty(window, 'removeEventListener', {
  value: vi.fn()
})

// Mock document events
Object.defineProperty(document, 'addEventListener', {
  value: vi.fn()
})
Object.defineProperty(document, 'removeEventListener', {
  value: vi.fn()
})
Object.defineProperty(document, 'hidden', {
  writable: true,
  value: false
})
// Test setup configuration
import { vi } from "vitest";
import { config } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";

// Mock global objects
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock Web Audio API
global.AudioContext = vi.fn().mockImplementation(() => ({
  createOscillator: vi.fn().mockReturnValue({
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    frequency: { value: 440 },
  }),
  createGain: vi.fn().mockReturnValue({
    connect: vi.fn(),
    gain: { value: 1 },
  }),
  destination: {},
}));

global.webkitAudioContext = global.AudioContext;

// Mock URL.createObjectURL and URL.revokeObjectURL for audio/file tests
// Always override to ensure consistent mocking
global.URL.createObjectURL = vi.fn(
  () => "blob:mock-url-" + Math.random().toString(36).substring(7),
);
global.URL.revokeObjectURL = vi.fn();

// Mock localStorage with unlimited storage (no quota errors)
const createStorageMock = () => {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      for (const key in store) {
        delete store[key];
      }
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }),
  };
};

global.localStorage = createStorageMock() as any;
global.sessionStorage = createStorageMock() as any;

// Mock EventSource
global.EventSource = vi.fn().mockImplementation(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  close: vi.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSED: 2,
}));

// Mock Howler.js
vi.mock("howler", () => ({
  Howl: vi.fn().mockImplementation(() => ({
    play: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    volume: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    state: vi.fn().mockReturnValue("loaded"),
  })),
}));

// Mock SortableJS
vi.mock("sortablejs", () => ({
  default: vi.fn().mockImplementation(() => ({
    destroy: vi.fn(),
  })),
}));

// Global test configuration for Vue Test Utils
config.global.plugins = [createPinia()];
config.global.mocks = {
  $router: createRouter({
    history: createWebHistory(),
    routes: [],
  }),
  $route: {
    params: {},
    query: {},
    path: "/",
    name: "test",
  },
};

// Mock performance.now for performance tests
global.performance = {
  ...global.performance,
  now: vi.fn(() => Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByName: vi.fn().mockReturnValue([]),
  getEntriesByType: vi.fn().mockReturnValue([]),
};

// Mock navigator.onLine
Object.defineProperty(navigator, "onLine", {
  writable: true,
  value: true,
});

// Note: We intentionally do NOT mock window.addEventListener/removeEventListener
// and document.addEventListener/removeEventListener to allow proper event handling
// in integration tests (especially keyboard shortcuts tests)

// Mock document.hidden for visibility tests
Object.defineProperty(document, "hidden", {
  writable: true,
  value: false,
});

// Spy on window/document event listeners instead of mocking them
// This allows both real event handling AND ability to verify calls
vi.spyOn(window, "addEventListener");
vi.spyOn(window, "removeEventListener");
vi.spyOn(document, "addEventListener");
vi.spyOn(document, "removeEventListener");

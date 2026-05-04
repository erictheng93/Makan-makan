import { vi } from "vitest";
import { config } from "@vue/test-utils";
import { i18n } from "@/i18n";

// ============================================================
// Vue Test Utils Global Configuration
// ============================================================

/**
 * Register i18n plugin globally so all component tests can call useI18n()
 * without hitting "Need to install with app.use function"
 */
config.global.plugins = [i18n];

/**
 * Configure global directives for Vue Test Utils
 * 添加 v-lazy 指令的 stub，避免測試中出現 "Failed to resolve directive: lazy" 警告
 */
config.global.directives = {
  lazy: {
    // v-lazy 指令的簡單 stub 實現
    // 在測試環境中，我們不需要實際的延遲加載功能
    mounted(el: HTMLElement, binding: any) {
      // 如果綁定了圖片 src，直接設置到元素上
      if (binding.value?.src) {
        el.setAttribute("src", binding.value.src);
      } else if (typeof binding.value === "string") {
        el.setAttribute("src", binding.value);
      }
    },
    updated(el: HTMLElement, binding: any) {
      if (binding.value?.src) {
        el.setAttribute("src", binding.value.src);
      } else if (typeof binding.value === "string") {
        el.setAttribute("src", binding.value);
      }
    },
  },
};

// ============================================================
// Browser API Mocks
// ============================================================

// Mock localStorage with a backing store so setItem/getItem round-trip.
// The previous version had setItem as a no-op vi.fn(), which silently
// dropped writes — any test exercising real storage behavior (e.g. the
// waiting-list lastTicket flow) would see null on read.
//
// Default seed: makanmasak_locale = "zh-TW" so i18n tests don't need to
// pre-set it. Tests can call localStorage.clear() to wipe (the seed is
// re-applied on each test via beforeEach below if needed, but most tests
// only read the locale once at i18n init time).
const localStorageStore = new Map<string, string>();
localStorageStore.set("makanmasak_locale", "zh-TW");
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageStore.set(key, String(value));
  }),
  removeItem: vi.fn((key: string) => {
    localStorageStore.delete(key);
  }),
  clear: vi.fn(() => {
    localStorageStore.clear();
  }),
};

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// Mock navigator
Object.defineProperty(window, "navigator", {
  value: {
    language: "zh-TW",
    languages: ["zh-TW", "zh", "en"],
  },
  writable: true,
});

// Mock document.documentElement
const documentElementMock = {
  lang: "zh-TW",
  dir: "ltr",
};
Object.defineProperty(document, "documentElement", {
  value: documentElementMock,
  writable: true,
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Make mocks available globally for tests
type LocalStorageMock = typeof localStorageMock;
type DocumentElementMock = typeof documentElementMock;

declare global {
  var localStorageMock: LocalStorageMock;

  var documentElementMock: DocumentElementMock;
}

const testGlobal = globalThis as typeof globalThis & {
  localStorageMock: LocalStorageMock;
  documentElementMock: DocumentElementMock;
};

testGlobal.localStorageMock = localStorageMock;
testGlobal.documentElementMock = documentElementMock;

/**
 * Test Setup for Onboarding App
 * Provides global mocks and test environment configuration
 */

import { vi, beforeEach } from "vitest";
import { config } from "@vue/test-utils";
import { ref, h } from "vue";

// ============================================================
// Browser API Mocks
// ============================================================

/**
 * matchMedia mock
 */
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

/**
 * IntersectionObserver mock
 */
class IntersectionObserverMock {
  readonly root: Element | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
}

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  value: IntersectionObserverMock,
});

/**
 * ResizeObserver mock
 */
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: ResizeObserverMock,
});

// ============================================================
// Storage Mocks
// ============================================================

class StorageMock {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }
}

Object.defineProperty(window, "sessionStorage", {
  value: new StorageMock(),
  writable: true,
  configurable: true,
});

Object.defineProperty(window, "localStorage", {
  value: new StorageMock(),
  writable: true,
  configurable: true,
});

// ============================================================
// Clipboard API Mock
// ============================================================

Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: vi.fn(() => Promise.resolve()),
    readText: vi.fn(() => Promise.resolve("")),
  },
  writable: true,
});

// ============================================================
// Vue Router Mock
// ============================================================

const mockRouter = {
  push: vi.fn((_to) => Promise.resolve()),
  replace: vi.fn((_to) => Promise.resolve()),
  go: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  resolve: vi.fn((to) => {
    if (typeof to === "string") {
      return {
        href: to,
        path: to,
        name: undefined,
        params: {},
        query: {},
        hash: "",
        fullPath: to,
        matched: [],
        meta: {},
        redirectedFrom: undefined,
      };
    }
    return {
      href: to.path || to.name || "/",
      path: to.path || "/",
      name: to.name || undefined,
      params: to.params || {},
      query: to.query || {},
      hash: to.hash || "",
      fullPath: to.path || "/",
      matched: [],
      meta: to.meta || {},
      redirectedFrom: undefined,
    };
  }),
  addRoute: vi.fn(),
  removeRoute: vi.fn(),
  hasRoute: vi.fn(() => true),
  getRoutes: vi.fn(() => []),
  currentRoute: ref({
    path: "/",
    name: "Home",
    params: {},
    query: {},
    meta: {},
    hash: "",
    fullPath: "/",
    matched: [],
    redirectedFrom: undefined,
  }),
  options: {
    history: { state: {}, location: "/" },
    routes: [],
  },
  beforeEach: vi.fn(),
  beforeResolve: vi.fn(),
  afterEach: vi.fn(),
  onError: vi.fn(),
  isReady: vi.fn(() => Promise.resolve()),
  install: vi.fn(),
};

// ============================================================
// Vue Router Module Mock
// ============================================================

vi.mock("vue-router", async () => {
  const { ref } = await import("vue");

  return {
    useRouter: () => ({
      push: vi.fn((_to) => Promise.resolve()),
      replace: vi.fn((_to) => Promise.resolve()),
      go: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      resolve: vi.fn((to) => ({
        href: typeof to === "string" ? to : to.path || "/",
        path: typeof to === "string" ? to : to.path || "/",
        name: typeof to === "object" ? to.name : undefined,
        params: typeof to === "object" ? to.params || {} : {},
        query: typeof to === "object" ? to.query || {} : {},
        hash: "",
        fullPath: typeof to === "string" ? to : to.path || "/",
        matched: [],
        meta: {},
      })),
      currentRoute: ref({
        path: "/",
        name: "Home",
        params: {},
        query: {},
        meta: {},
        hash: "",
        fullPath: "/",
        matched: [],
      }),
    }),
    useRoute: () => ({
      path: "/",
      name: "Home",
      params: {},
      query: {},
      meta: {},
      hash: "",
      fullPath: "/",
      matched: [],
    }),
    RouterLink: {
      name: "RouterLink",
      template: "<a><slot /></a>",
      props: ["to"],
    },
    RouterView: {
      name: "RouterView",
      template: "<div><slot /></div>",
    },
    createRouter: vi.fn(),
    createWebHistory: vi.fn(),
    createMemoryHistory: vi.fn(),
  };
});

// ============================================================
// Toast Mock
// ============================================================

vi.mock("vue-toastification", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
  default: {
    install: vi.fn(),
  },
}));

// ============================================================
// Vue Test Utils Global Configuration
// ============================================================

const RouterLinkStub = {
  name: "RouterLink",
  props: {
    to: { type: [String, Object], required: true },
    custom: Boolean,
    replace: Boolean,
  },
  setup(props: any, { slots }: any) {
    return () => {
      const children = slots.default ? slots.default() : [];
      return h(
        "a",
        {
          href: typeof props.to === "string" ? props.to : props.to.path || "#",
          onClick: (e: Event) => {
            e.preventDefault();
            mockRouter.push(props.to);
          },
        },
        children,
      );
    };
  },
};

config.global = {
  ...config.global,
  mocks: {
    $router: mockRouter,
    $route: mockRouter.currentRoute,
  },
  stubs: {
    "router-link": RouterLinkStub,
    RouterLink: RouterLinkStub,
    transition: false,
    "transition-group": false,
  },
  provide: {
    router: mockRouter,
    route: mockRouter.currentRoute,
  },
  plugins: [mockRouter],
};

// ============================================================
// Test Lifecycle
// ============================================================

beforeEach(() => {
  vi.clearAllMocks();

  mockRouter.currentRoute.value = {
    path: "/",
    name: "Home",
    params: {},
    query: {},
    meta: {},
    hash: "",
    fullPath: "/",
    matched: [],
    redirectedFrom: undefined,
  };

  window.sessionStorage.clear();
  window.localStorage.clear();
});

// ============================================================
// Exports
// ============================================================

export { mockRouter, RouterLinkStub };

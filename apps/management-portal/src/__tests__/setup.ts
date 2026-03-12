/**
 * Test Setup for Management Portal
 */

import { vi, beforeEach } from "vitest";
import { config } from "@vue/test-utils";
import { ref, h } from "vue";

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
    name: "Dashboard",
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
// Router-Link Stub
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

// ============================================================
// Chart.js Mocks
// ============================================================

vi.mock("chart.js", () => {
  const mockChartInstance = {
    destroy: vi.fn(),
    update: vi.fn(),
    resize: vi.fn(),
    render: vi.fn(),
    data: { labels: [], datasets: [] },
    options: {},
  };
  return {
    Chart: Object.assign(
      vi.fn(() => mockChartInstance),
      {
        register: vi.fn(),
        unregister: vi.fn(),
        defaults: {
          font: { family: "sans-serif" },
          color: "#666",
          plugins: {},
        },
        overrides: {},
        controllers: {},
        elements: {},
        plugins: {},
        scales: {},
      },
    ),
    CategoryScale: vi.fn(),
    LinearScale: vi.fn(),
    PointElement: vi.fn(),
    LineElement: vi.fn(),
    BarElement: vi.fn(),
    ArcElement: vi.fn(),
    Title: vi.fn(),
    Tooltip: vi.fn(),
    Legend: vi.fn(),
    Filler: vi.fn(),
    registerables: [],
  };
});

vi.mock("vue-chartjs", () => ({
  Bar: {
    name: "Bar",
    props: ["data", "options"],
    template: '<canvas data-testid="chart-canvas"></canvas>',
  },
  Line: {
    name: "Line",
    props: ["data", "options"],
    template: '<canvas data-testid="chart-canvas"></canvas>',
  },
  Pie: {
    name: "Pie",
    props: ["data", "options"],
    template: '<canvas data-testid="chart-canvas"></canvas>',
  },
  Doughnut: {
    name: "Doughnut",
    props: ["data", "options"],
    template: '<canvas data-testid="chart-canvas"></canvas>',
  },
}));

// ============================================================
// Vue-Toastification Mock
// ============================================================

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  clear: vi.fn(),
};

vi.mock("vue-toastification", () => ({
  useToast: () => mockToast,
  default: { install: vi.fn() },
  POSITION: {
    TOP_RIGHT: "top-right",
    TOP_LEFT: "top-left",
    BOTTOM_RIGHT: "bottom-right",
    BOTTOM_LEFT: "bottom-left",
  },
}));

// ============================================================
// Vue Router Composables Mock
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
        name: "Dashboard",
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
      name: "Dashboard",
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
// Heroicons Stubs
// ============================================================

const createIconStub = (name: string) => ({
  name,
  props: { class: String, style: [String, Object] },
  template: `<svg data-testid="${name.toLowerCase()}"><title>${name}</title></svg>`,
});

// ============================================================
// Global Test Configuration
// ============================================================

config.global = {
  ...config.global,
  mocks: {
    $router: mockRouter,
    $route: mockRouter.currentRoute,
  },
  stubs: {
    "router-link": RouterLinkStub,
    RouterLink: RouterLinkStub,
    // Stub all heroicons to avoid resolution warnings
    BuildingStorefrontIcon: createIconStub("BuildingStorefrontIcon"),
    CheckCircleIcon: createIconStub("CheckCircleIcon"),
    ClockIcon: createIconStub("ClockIcon"),
    ExclamationTriangleIcon: createIconStub("ExclamationTriangleIcon"),
    XCircleIcon: createIconStub("XCircleIcon"),
    ArrowTrendingUpIcon: createIconStub("ArrowTrendingUpIcon"),
    PlusIcon: createIconStub("PlusIcon"),
    MagnifyingGlassIcon: createIconStub("MagnifyingGlassIcon"),
    FunnelIcon: createIconStub("FunnelIcon"),
    HomeIcon: createIconStub("HomeIcon"),
    CloudIcon: createIconStub("CloudIcon"),
    HeartIcon: createIconStub("HeartIcon"),
    KeyIcon: createIconStub("KeyIcon"),
    Bars3Icon: createIconStub("Bars3Icon"),
    XMarkIcon: createIconStub("XMarkIcon"),
    ArrowLeftIcon: createIconStub("ArrowLeftIcon"),
    ServerStackIcon: createIconStub("ServerStackIcon"),
    PlayIcon: createIconStub("PlayIcon"),
    ArrowPathIcon: createIconStub("ArrowPathIcon"),
    RocketLaunchIcon: createIconStub("RocketLaunchIcon"),
    ArrowUpIcon: createIconStub("ArrowUpIcon"),
    transition: false,
    "transition-group": false,
    Teleport: { template: "<div><slot /></div>" },
  },
  provide: {
    router: mockRouter,
    route: mockRouter.currentRoute,
  },
  plugins: [mockRouter],
};

// ============================================================
// Browser API Mocks
// ============================================================

global.fetch = vi.fn();

// localStorage
class LocalStorageMock {
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
    return Array.from(this.store.keys())[index] ?? null;
  }
}

Object.defineProperty(window, "localStorage", {
  value: new LocalStorageMock(),
  writable: true,
  configurable: true,
});

Object.defineProperty(window, "sessionStorage", {
  value: new LocalStorageMock(),
  writable: true,
  configurable: true,
});

// matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
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

// IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: "",
  thresholds: [],
})) as any;

// ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any;

// URL
if (typeof window.URL.createObjectURL === "undefined") {
  window.URL.createObjectURL = vi.fn(
    () => `blob:http://localhost/${Math.random().toString(36).substring(7)}`,
  );
  window.URL.revokeObjectURL = vi.fn();
}

// window.location
Object.defineProperty(window, "location", {
  value: {
    href: "http://localhost:3010",
    origin: "http://localhost:3010",
    protocol: "http:",
    host: "localhost:3010",
    hostname: "localhost",
    port: "3010",
    pathname: "/",
    search: "",
    hash: "",
    reload: vi.fn(),
    assign: vi.fn(),
    replace: vi.fn(),
  },
  writable: true,
});

// ============================================================
// Test Lifecycle
// ============================================================

beforeEach(() => {
  vi.clearAllMocks();

  mockRouter.currentRoute.value = {
    path: "/",
    name: "Dashboard",
    params: {},
    query: {},
    meta: {},
    hash: "",
    fullPath: "/",
    matched: [],
    redirectedFrom: undefined,
  };

  window.localStorage.clear();
});

// ============================================================
// Exports
// ============================================================

export { mockRouter, mockToast, RouterLinkStub };

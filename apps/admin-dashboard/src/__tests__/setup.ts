/**
 * Test Setup for Admin Dashboard
 * 為管理後台提供完整的測試環境配置
 */

import { vi, beforeEach } from "vitest";
import { config } from "@vue/test-utils";
import { ref, h } from "vue";
import { setupAllBrowserAPIs } from "./browser-api-mocks";

// ============================================================
// Vue Router Mock (完整版)
// ============================================================

/**
 * 創建完整的 Vue Router Mock
 * 包含所有常用 API 和正確的 resolve 實現
 */
const mockRouter: Record<string, any> = {
  // 導航方法
  push: vi.fn((_to) => Promise.resolve()),
  replace: vi.fn((_to) => Promise.resolve()),
  go: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),

  // 路由解析（修復 "invalid location" 警告）
  resolve: vi.fn((to) => {
    // 處理字符串路徑
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

    // 處理對象格式的路由
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

  // 路由管理
  addRoute: vi.fn(),
  removeRoute: vi.fn(),
  hasRoute: vi.fn(() => true),
  getRoutes: vi.fn(() => []),

  // 當前路由
  currentRoute: ref({
    path: "/",
    name: "home",
    params: {},
    query: {},
    meta: {},
    hash: "",
    fullPath: "/",
    matched: [],
    redirectedFrom: undefined,
  }),

  // 路由選項
  options: {
    history: {
      state: {},
      location: "/",
    },
    routes: [],
  },

  // 導航守衛
  beforeEach: vi.fn(),
  beforeResolve: vi.fn(),
  afterEach: vi.fn(),

  // 錯誤處理
  onError: vi.fn(),

  // 準備就緒
  isReady: vi.fn(() => Promise.resolve()),

  // 安裝方法（Vue Router 插件接口）
  install: vi.fn(),
};

// ============================================================
// Pinia Store Mocks (響應式版本)
// ============================================================

/**
 * Mock Auth Store
 * 使用 ref() 確保響應式，避免 "readonly" 錯誤
 */
export const mockAuthStore: Record<string, any> = {
  user: ref(null),
  isAuthenticated: ref(false),
  token: ref(null),
  login: vi.fn(),
  logout: vi.fn(),
  checkAuth: vi.fn(),
  refreshToken: vi.fn(),
  canManageOrders: ref(false),
  canManageMenu: ref(false),
  canAccessAdminFeatures: ref(false),
  hasPermission: vi.fn(() => false),
  userRole: ref(4),
  restaurantId: ref(1),
};

/**
 * Mock Notification Store
 */
export const mockNotificationStore: Record<string, any> = {
  notifications: ref([]),
  addNotification: vi.fn(),
  removeNotification: vi.fn(),
  clearAll: vi.fn(),
};

/**
 * Mock Order Store
 */
export const mockOrderStore: Record<string, any> = {
  orders: ref([]),
  currentOrder: ref(null),
  updateOrder: vi.fn(),
  fetchOrders: vi.fn(),
  updateOrderStatus: vi.fn(),
};

/**
 * Mock Settings Store (修復 getters 問題)
 */
export const mockSettingsStore = {
  language: ref("en-US"),
  theme: ref("light"),
  getters: {
    "settings/language": "en-US",
    "settings/theme": "light",
  },
  setLanguage: vi.fn((lang) => {
    mockSettingsStore.language.value = lang;
    mockSettingsStore.getters["settings/language"] = lang;
  }),
  setTheme: vi.fn((theme) => {
    mockSettingsStore.theme.value = theme;
    mockSettingsStore.getters["settings/theme"] = theme;
  }),
};

// ============================================================
// Vue 組件 Mocks
// ============================================================

/**
 * Mock router-link 組件
 * 避免 "Failed to resolve component: router-link" 警告
 */
const RouterLinkStub = {
  name: "RouterLink",
  props: {
    to: {
      type: [String, Object],
      required: true,
    },
    custom: Boolean,
    replace: Boolean,
    activeClass: String,
    exactActiveClass: String,
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

/**
 * Mock Heroicons 組件
 * 避免 "Failed to resolve component: ShareIcon/CashIcon" 警告
 */
const createIconStub = (name: string) => ({
  name,
  props: {
    class: String,
    style: [String, Object],
  },
  template: `<svg data-testid="${name.toLowerCase()}" :class="class" :style="style"><title>${name}</title></svg>`,
});

const ShareIconStub = createIconStub("ShareIcon");
const CashIconStub = createIconStub("CashIcon");
const UserIconStub = createIconStub("UserIcon");
const BellIconStub = createIconStub("BellIcon");
const CogIconStub = createIconStub("CogIcon");

// ============================================================
// Chart.js Mock (修復 Chart.register is not a function 錯誤)
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
    // Scale types
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
    // Additional exports
    registerables: [],
  };
});

// Also mock vue-chartjs
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
// Element Plus Mocks
// ============================================================

vi.mock("element-plus", () => ({
  ElMessage: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
  ElNotification: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
  ElMessageBox: {
    confirm: vi.fn(() => Promise.resolve("confirm")),
    alert: vi.fn(() => Promise.resolve()),
    prompt: vi.fn(() => Promise.resolve({ value: "test" })),
  },
  ElLoading: {
    service: vi.fn(() => ({
      close: vi.fn(),
    })),
  },
}));

// ============================================================
// Composables Mocks
// ============================================================

/**
 * Mock SSE Composable
 */
vi.mock("@/composables/useSSE", () => ({
  useSSE: () => ({
    isConnected: ref(false),
    connect: vi.fn(),
    disconnect: vi.fn(),
    reconnectAttempts: ref(0),
  }),
}));

/**
 * Mock Vue Router Composables
 * 修復 "Symbol(route location) not found" 警告
 *
 * 注意：這個 mock 必須返回函數，因為會在組件中被調用
 */
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
        name: "home",
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
      name: "home",
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
// Global Test Configuration
// ============================================================

/**
 * Vue Test Utils 全局配置
 * 包含 mocks, stubs, provide
 */
config.global = {
  ...config.global,

  // Mocks (舊版 API 支持)
  mocks: {
    $router: mockRouter,
    $route: mockRouter.currentRoute,
  },

  // Stubs (組件替身)
  stubs: {
    "router-link": RouterLinkStub,
    RouterLink: RouterLinkStub,
    ShareIcon: ShareIconStub,
    CashIcon: CashIconStub,
    UserIcon: UserIconStub,
    BellIcon: BellIconStub,
    CogIcon: CogIconStub,
    transition: false, // 禁用過渡動畫以加快測試
    "transition-group": false,
  },

  // Provide (依賴注入) - 使用多種方式確保 router 可用
  provide: {
    // Vue Router 注入（修復 "Symbol(route location) not found" 警告）
    // 使用多個可能的 Symbol
    router: mockRouter,
    route: mockRouter.currentRoute,
  },

  // Plugins - 包含 mock router
  plugins: [mockRouter as any],
};

// ============================================================
// Browser APIs Mocks
// ============================================================

/**
 * Mock fetch API
 */
global.fetch = vi.fn();

/**
 * Mock EventSource (SSE)
 */
global.EventSource = vi.fn().mockImplementation(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  close: vi.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSED: 2,
})) as any;

/**
 * Mock Notification API
 * 測試環境不支持瀏覽器通知 API，需要手動 mock
 */
if (typeof global.Notification === "undefined") {
  global.Notification = class Notification extends EventTarget {
    static permission: NotificationPermission = "default";

    static requestPermission(): Promise<NotificationPermission> {
      return Promise.resolve("granted");
    }

    title: string;
    body?: string;
    icon?: string;
    tag?: string;
    data?: any;
    onclick: ((event: Event) => void) | null = null;
    onclose: ((event: Event) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    onshow: ((event: Event) => void) | null = null;

    constructor(title: string, options?: NotificationOptions) {
      super();
      this.title = title;
      this.body = options?.body;
      this.icon = options?.icon;
      this.tag = options?.tag;
      this.data = options?.data;

      // Auto-trigger show event in next tick
      setTimeout(() => {
        this.onshow?.(new Event("show"));
      }, 0);
    }

    close(): void {
      setTimeout(() => {
        this.onclose?.(new Event("close"));
      }, 0);
    }
  } as any;
}

/**
 * Mock CloseEvent (for WebSocket testing)
 * jsdom 可能不完全支持 CloseEvent
 */
if (typeof global.CloseEvent === "undefined") {
  global.CloseEvent = class CloseEvent extends Event {
    code: number;
    reason: string;
    wasClean: boolean;

    constructor(
      type: string,
      eventInitDict?: {
        code?: number;
        reason?: string;
        wasClean?: boolean;
        bubbles?: boolean;
        cancelable?: boolean;
        composed?: boolean;
      },
    ) {
      super(type, eventInitDict);
      this.code = eventInitDict?.code ?? 0;
      this.reason = eventInitDict?.reason ?? "";
      this.wasClean = eventInitDict?.wasClean ?? false;
    }
  } as any;
}

/**
 * Mock MessageEvent (for WebSocket testing)
 * 確保 MessageEvent 在測試環境中可用
 */
if (typeof global.MessageEvent === "undefined") {
  global.MessageEvent = class MessageEvent extends Event {
    data: any;
    origin: string;
    lastEventId: string;
    source: any;
    ports: any[];

    constructor(
      type: string,
      eventInitDict?: {
        data?: any;
        origin?: string;
        lastEventId?: string;
        source?: any;
        ports?: any[];
        bubbles?: boolean;
        cancelable?: boolean;
        composed?: boolean;
      },
    ) {
      super(type, eventInitDict);
      this.data = eventInitDict?.data;
      this.origin = eventInitDict?.origin ?? "";
      this.lastEventId = eventInitDict?.lastEventId ?? "";
      this.source = eventInitDict?.source ?? null;
      this.ports = eventInitDict?.ports ?? [];
    }
  } as any;
}

// ============================================================
// Browser APIs Mocks (完整版)
// ============================================================

/**
 * 設置所有瀏覽器 API mocks
 * 包含真正的 localStorage、URL.createObjectURL 等
 */
setupAllBrowserAPIs();

/**
 * Mock window.location
 */
Object.defineProperty(window, "location", {
  value: {
    href: "http://localhost:3000",
    origin: "http://localhost:3000",
    protocol: "http:",
    host: "localhost:3000",
    hostname: "localhost",
    port: "3000",
    pathname: "/",
    search: "",
    hash: "",
    reload: vi.fn(),
    assign: vi.fn(),
    replace: vi.fn(),
  },
  writable: true,
});

/**
 * Mock window.alert, window.confirm, window.prompt
 * jsdom 不完全實現這些方法，需要手動 mock
 */
Object.defineProperty(window, "alert", {
  value: vi.fn(),
  writable: true,
  configurable: true,
});

Object.defineProperty(window, "confirm", {
  value: vi.fn(() => true),
  writable: true,
  configurable: true,
});

Object.defineProperty(window, "prompt", {
  value: vi.fn((_message: string, defaultValue?: string) => defaultValue || ""),
  writable: true,
  configurable: true,
});

// ============================================================
// Clipboard API Mock
// ============================================================

/**
 * Mock Clipboard API
 * 用於測試複製功能
 */
if (typeof global.navigator === "undefined") {
  (global as any).navigator = {};
}

Object.defineProperty(global.navigator, "clipboard", {
  value: {
    writeText: vi.fn(() => Promise.resolve()),
    readText: vi.fn(() => Promise.resolve("")),
  },
  writable: true,
});

// ============================================================
// Test Lifecycle Hooks
// ============================================================

/**
 * 每個測試前重置所有 mocks
 */
beforeEach(() => {
  vi.clearAllMocks();

  // 重置 Router 狀態
  mockRouter.currentRoute.value = {
    path: "/",
    name: "home",
    params: {},
    query: {},
    meta: {},
    hash: "",
    fullPath: "/",
    matched: [],
    redirectedFrom: undefined,
  };

  // 重置 Store 狀態
  mockAuthStore.user.value = null;
  mockAuthStore.isAuthenticated.value = false;
  mockAuthStore.token.value = null;
  mockNotificationStore.notifications.value = [];
  mockOrderStore.orders.value = [];
  mockOrderStore.currentOrder.value = null;
  mockSettingsStore.language.value = "en-US";
  mockSettingsStore.theme.value = "light";

  // 重置 localStorage (使用真正的 clear 方法)
  window.localStorage.clear();

  // 重置 window dialog mocks
  if (vi.isMockFunction(window.alert)) {
    (window.alert as any).mockClear();
  }
  if (vi.isMockFunction(window.confirm)) {
    (window.confirm as any).mockClear();
    (window.confirm as any).mockReturnValue(true);
  }
  if (vi.isMockFunction(window.prompt)) {
    (window.prompt as any).mockClear();
  }
});

// ============================================================
// Export for Test Files
// ============================================================

export {
  mockRouter,
  RouterLinkStub,
  ShareIconStub,
  CashIconStub,
  UserIconStub,
  BellIconStub,
  CogIconStub,
};

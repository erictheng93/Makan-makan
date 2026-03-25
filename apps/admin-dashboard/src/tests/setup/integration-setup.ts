import { vi, afterEach } from "vitest";
import { config } from "@vue/test-utils";

// Global test setup for integration tests

// Mock Vue Router
vi.mock("vue-router", async () => {
  const actual = await vi.importActual("vue-router");
  return {
    ...actual,
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      go: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
    }),
    useRoute: () => ({
      path: "/test",
      name: "Test",
      params: {},
      query: {},
      meta: {},
    }),
  };
});

// Mock Pinia stores
vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    user: {
      id: 1,
      username: "test_user",
      role: 0, // ADMIN
      restaurantId: "rest_test_001",
    },
    isAuthenticated: true,
    hasPermission: vi.fn().mockReturnValue(true),
    canAccessAdminFeatures: true,
    canManageOrders: true,
    canManageMenu: true,
    getDefaultRoute: () => "/dashboard",
    canAccessRoute: vi.fn().mockReturnValue(true),
    userRole: 0,
  }),
}));

// Mock API client
vi.mock("@/services/api", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

// Global component stubs
config.global.stubs = {
  "router-link": true,
  "router-view": true,
};

// Global mocks
config.global.mocks = {
  $t: (key: string) => key, // Mock i18n
  $route: {
    path: "/test",
    name: "Test",
    params: {},
    query: {},
    meta: {},
  },
  $router: {
    push: vi.fn(),
    replace: vi.fn(),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  },
};

// Global provide
config.global.provide = {
  // Add any global providers here
};

// Mock window methods
Object.defineProperty(window, "alert", {
  writable: true,
  value: vi.fn(),
});

Object.defineProperty(window, "confirm", {
  writable: true,
  value: vi.fn().mockReturnValue(true),
});

Object.defineProperty(window, "prompt", {
  writable: true,
  value: vi.fn().mockReturnValue("mocked input"),
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn().mockReturnValue("mock_token"),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0,
};

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// Mock sessionStorage
Object.defineProperty(window, "sessionStorage", {
  value: localStorageMock,
});

// Mock navigator methods
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue("mocked text"),
  },
});

// Mock Notification API
Object.defineProperty(window, "Notification", {
  value: class MockNotification {
    static permission = "granted";
    static requestPermission = vi.fn().mockResolvedValue("granted");

    constructor(title: string, options?: NotificationOptions) {
      this.title = title;
      this.body = options?.body || "";
      this.icon = options?.icon || "";
    }

    title: string;
    body: string;
    icon: string;
    close = vi.fn();
    onclick = vi.fn();
    onclose = vi.fn();
    onerror = vi.fn();
    onshow = vi.fn();
  },
});

// Mock EventSource for SSE
Object.defineProperty(window, "EventSource", {
  value: class MockEventSource {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 2;

    readyState = MockEventSource.CONNECTING;
    url: string;
    withCredentials = false;

    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;

    constructor(url: string) {
      this.url = url;
      // Simulate connection
      setTimeout(() => {
        this.readyState = MockEventSource.OPEN;
        if (this.onopen) {
          this.onopen(new Event("open"));
        }
      }, 100);
    }

    addEventListener = vi.fn();
    removeEventListener = vi.fn();
    dispatchEvent = vi.fn();
    close = vi.fn(() => {
      this.readyState = MockEventSource.CLOSED;
    });

    // Helper method to simulate messages
    _simulateMessage(data: any, type = "message") {
      if (this.onmessage && type === "message") {
        this.onmessage(
          new MessageEvent("message", { data: JSON.stringify(data) }),
        );
      }
    }
  },
});

// Mock fetch for API calls
global.fetch = vi.fn().mockImplementation((url: string) => {
  // Default successful response
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: "OK",
    json: () => Promise.resolve({ success: true, data: {} }),
    text: () => Promise.resolve(""),
    blob: () => Promise.resolve(new Blob()),
    headers: new Headers(),
    url,
    type: "default" as ResponseType,
    body: null,
    bodyUsed: false,
    redirected: false,
    clone: vi.fn(),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    formData: () => Promise.resolve(new FormData()),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response);
});

// Environment variables
process.env.VITE_API_URL = "http://localhost:3000";
process.env.NODE_ENV = "test";

// Console methods for testing
const originalConsole = { ...console };

// Suppress console logs in tests unless needed
if (process.env.TEST_VERBOSE !== "true") {
  console.log = vi.fn();
  console.info = vi.fn();
  console.warn = vi.fn();
  console.error = vi.fn();
}

// Export utilities for tests
export { localStorageMock, originalConsole };

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
});

// Global error handler for unhandled promises
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

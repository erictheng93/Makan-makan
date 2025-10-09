var _a, _b;
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
        canViewKitchen: true,
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
    $t: (key) => key, // Mock i18n
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
    value: (_a = class MockNotification {
            constructor(title, options) {
                Object.defineProperty(this, "title", {
                    enumerable: true,
                    configurable: true,
                    writable: true,
                    value: void 0
                });
                Object.defineProperty(this, "body", {
                    enumerable: true,
                    configurable: true,
                    writable: true,
                    value: void 0
                });
                Object.defineProperty(this, "icon", {
                    enumerable: true,
                    configurable: true,
                    writable: true,
                    value: void 0
                });
                Object.defineProperty(this, "close", {
                    enumerable: true,
                    configurable: true,
                    writable: true,
                    value: vi.fn()
                });
                Object.defineProperty(this, "onclick", {
                    enumerable: true,
                    configurable: true,
                    writable: true,
                    value: vi.fn()
                });
                Object.defineProperty(this, "onclose", {
                    enumerable: true,
                    configurable: true,
                    writable: true,
                    value: vi.fn()
                });
                Object.defineProperty(this, "onerror", {
                    enumerable: true,
                    configurable: true,
                    writable: true,
                    value: vi.fn()
                });
                Object.defineProperty(this, "onshow", {
                    enumerable: true,
                    configurable: true,
                    writable: true,
                    value: vi.fn()
                });
                this.title = title;
                this.body = options?.body || "";
                this.icon = options?.icon || "";
            }
        },
        Object.defineProperty(_a, "permission", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "granted"
        }),
        Object.defineProperty(_a, "requestPermission", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: vi.fn().mockResolvedValue("granted")
        }),
        _a),
});
// Mock EventSource for SSE
Object.defineProperty(window, "EventSource", {
    value: (_b = class MockEventSource {
            constructor(url) {
                Object.defineProperty(this, "readyState", {
                    enumerable: true,
                    configurable: true,
                    writable: true,
                    value: _b.CONNECTING
                });
                Object.defineProperty(this, "url", {
                    enumerable: true,
                    configurable: true,
                    writable: true,
                    value: void 0
                });
                Object.defineProperty(this, "withCredentials", {
                    enumerable: true,
                    configurable: true,
                    writable: true,
                    value: false
                });
                Object.defineProperty(this, "onopen", {
                    enumerable: true,
                    configurable: true,
                    writable: true,
                    value: null
                });
                Object.defineProperty(this, "onmessage", {
                    enumerable: true,
                    configurable: true,
                    writable: true,
                    value: null
                });
                Object.defineProperty(this, "onerror", {
                    enumerable: true,
                    configurable: true,
                    writable: true,
                    value: null
                });
                Object.defineProperty(this, "addEventListener", {
                    enumerable: true,
                    configurable: true,
                    writable: true,
                    value: vi.fn()
                });
                Object.defineProperty(this, "removeEventListener", {
                    enumerable: true,
                    configurable: true,
                    writable: true,
                    value: vi.fn()
                });
                Object.defineProperty(this, "dispatchEvent", {
                    enumerable: true,
                    configurable: true,
                    writable: true,
                    value: vi.fn()
                });
                Object.defineProperty(this, "close", {
                    enumerable: true,
                    configurable: true,
                    writable: true,
                    value: vi.fn(() => {
                        this.readyState = _b.CLOSED;
                    })
                });
                this.url = url;
                // Simulate connection
                setTimeout(() => {
                    this.readyState = _b.OPEN;
                    if (this.onopen) {
                        this.onopen(new Event("open"));
                    }
                }, 100);
            }
            // Helper method to simulate messages
            _simulateMessage(data, type = "message") {
                if (this.onmessage && type === "message") {
                    this.onmessage(new MessageEvent("message", { data: JSON.stringify(data) }));
                }
            }
        },
        Object.defineProperty(_b, "CONNECTING", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        }),
        Object.defineProperty(_b, "OPEN", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        }),
        Object.defineProperty(_b, "CLOSED", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 2
        }),
        _b),
});
// Mock fetch for API calls
global.fetch = vi.fn().mockImplementation((url) => {
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
        type: "default",
        body: null,
        bodyUsed: false,
        redirected: false,
        clone: vi.fn(),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        formData: () => Promise.resolve(new FormData()),
        bytes: () => Promise.resolve(new Uint8Array()),
    });
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

import { vi, beforeEach } from 'vitest';
import { config } from '@vue/test-utils';
import { ref } from 'vue';
// Mock Vue Router
const mockRouter = {
    push: vi.fn(),
    replace: vi.fn(),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    currentRoute: {
        value: {
            path: '/',
            name: 'home',
            params: {},
            query: {},
            meta: {}
        }
    }
};
// Mock Pinia stores
export const mockAuthStore = {
    user: null,
    isAuthenticated: false,
    token: null,
    login: vi.fn(),
    logout: vi.fn(),
    checkAuth: vi.fn(),
    refreshToken: vi.fn(),
    canManageOrders: false,
    canManageMenu: false,
    canAccessAdminFeatures: false,
    canViewKitchen: false,
    hasPermission: vi.fn(() => false),
    userRole: 4,
    restaurantId: 1
};
export const mockNotificationStore = {
    notifications: [],
    addNotification: vi.fn(),
    removeNotification: vi.fn(),
    clearAll: vi.fn()
};
export const mockOrderStore = {
    orders: [],
    currentOrder: null,
    updateOrder: vi.fn(),
    fetchOrders: vi.fn(),
    updateOrderStatus: vi.fn()
};
// Mock Element Plus components if needed
vi.mock('element-plus', () => ({
    ElMessage: vi.fn(),
    ElNotification: vi.fn(),
    ElMessageBox: {
        confirm: vi.fn(),
        alert: vi.fn(),
        prompt: vi.fn()
    }
}));
// Mock SSE composable
vi.mock('@/composables/useSSE', () => ({
    useSSE: () => ({
        isConnected: ref(false),
        connect: vi.fn(),
        disconnect: vi.fn(),
        reconnectAttempts: ref(0)
    })
}));
// Global test configuration for Vue Test Utils
config.global.mocks = {
    $router: mockRouter,
    $route: mockRouter.currentRoute
};
// Mock fetch globally
global.fetch = vi.fn();
// Mock EventSource for SSE testing
global.EventSource = vi.fn(() => ({
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    close: vi.fn(),
    readyState: 1,
    CONNECTING: 0,
    OPEN: 1,
    CLOSED: 2
}));
// Mock localStorage
Object.defineProperty(window, 'localStorage', {
    value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
    }
});
// Mock window.location
Object.defineProperty(window, 'location', {
    value: {
        href: 'http://localhost:3000',
        origin: 'http://localhost:3000',
        reload: vi.fn()
    },
    writable: true
});
// Reset all mocks before each test
beforeEach(() => {
    vi.clearAllMocks();
});

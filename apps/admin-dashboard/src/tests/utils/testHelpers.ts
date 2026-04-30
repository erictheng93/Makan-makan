/**
 * 測試輔助工具
 * 提供通用的測試工具函數和輔助方法
 */

import { defineComponent, h } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { createTestingPinia } from "@pinia/testing";
import { vi } from "vitest";

// Re-export for easier access
export { vi } from "vitest";

/**
 * 在 Vue 組件上下文中掛載 composable
 * 這解決了 composable 使用 onMounted/onUnmounted 時需要組件上下文的問題
 *
 * @param composable - 要測試的 composable 函數
 * @param options - 掛載選項
 * @returns 包含 wrapper 和 result 的對象
 */
export function mountComposable<T>(
  composable: () => T,
  options: {
    global?: Record<string, any>;
    attachTo?: HTMLElement | string;
    shallow?: boolean;
  } = {},
): { wrapper: VueWrapper<any>; result: T } {
  let result: T;

  const TestComponent = defineComponent({
    setup() {
      result = composable();
      return { result };
    },
    render() {
      return h("div", { "data-testid": "composable-wrapper" });
    },
  });

  const wrapper = mount(TestComponent, {
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          stubActions: false,
        }),
      ],
      ...options.global,
    },
    attachTo: options.attachTo,
    shallow: options.shallow,
  });

  return { wrapper, result: result! };
}

/**
 * 創建可追蹤的 Mock WebSocket 類
 * 用於在測試中協調 composable 和測試代碼之間的 WebSocket 實例
 */
export function createTrackedMockWebSocket(): {
  TrackedMockWebSocket: typeof WebSocket;
  getActiveInstance: () => MockWebSocketInstance | null;
  clearActiveInstance: () => void;
} {
  let activeInstance: MockWebSocketInstance | null = null;

  class MockWebSocketInstance {
    public readyState: number = WebSocket.CONNECTING;
    public url: string;
    public protocol: string;

    private listeners: Record<string, Function[]> = {};
    private sentMessages: any[] = [];
    public connectionAttempts: number = 0;

    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    // Static property to track last created instance (avoids this-alias)
    static lastInstance: MockWebSocketInstance | null = null;

    onopen: ((event: Event) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;

    constructor(url: string, protocol?: string) {
      this.url = url;
      this.protocol = protocol || "";
      this.connectionAttempts++;

      // 記錄活動實例 (use static property to avoid this-alias)
      MockWebSocketInstance.lastInstance = this;
      activeInstance = MockWebSocketInstance.lastInstance;

      // 模擬異步連接
      setTimeout(() => {
        this.readyState = WebSocket.OPEN;
        this.dispatchEvent(new Event("open"));
      }, 10);
    }

    send(data: string | ArrayBuffer): void {
      if (this.readyState !== WebSocket.OPEN) {
        throw new Error("WebSocket is not open");
      }

      try {
        const message = typeof data === "string" ? JSON.parse(data) : data;
        this.sentMessages.push(message);

        // 自動模擬響應
        this.handleMockResponse(message);
      } catch (error) {
        console.error("Mock WebSocket send error:", error);
      }
    }

    close(code?: number, reason?: string): void {
      this.readyState = WebSocket.CLOSING;

      setTimeout(() => {
        this.readyState = WebSocket.CLOSED;
        this.dispatchEvent(
          new CloseEvent("close", { code: code || 1000, reason }),
        );
      }, 10);
    }

    addEventListener(type: string, listener: Function): void {
      if (!this.listeners[type]) {
        this.listeners[type] = [];
      }
      this.listeners[type].push(listener);
    }

    removeEventListener(type: string, listener: Function): void {
      if (this.listeners[type]) {
        const index = this.listeners[type].indexOf(listener);
        if (index !== -1) {
          this.listeners[type].splice(index, 1);
        }
      }
    }

    private dispatchEvent(event: Event): void {
      const type = event.type;
      if (this.listeners[type]) {
        this.listeners[type].forEach((listener) => {
          try {
            listener(event);
          } catch (error) {
            console.error("Mock WebSocket event listener error:", error);
          }
        });
      }

      const handlerName = `on${type}` as keyof this;
      if (typeof this[handlerName] === "function") {
        (this[handlerName] as (event: Event) => void)(event);
      }
    }

    // 測試工具方法
    mockReceiveMessage(data: any): void {
      if (this.readyState === WebSocket.OPEN) {
        const messageEvent = new MessageEvent("message", {
          data: typeof data === "string" ? data : JSON.stringify(data),
        });
        this.dispatchEvent(messageEvent);
      }
    }

    mockError(error?: any): void {
      const errorEvent = new Event("error");
      if (error) {
        (errorEvent as Event & { error?: unknown }).error = error;
      }
      this.dispatchEvent(errorEvent);
    }

    mockResponse(response: any): void {
      setTimeout(() => {
        this.mockReceiveMessage(response);
      }, 5);
    }

    open(): void {
      if (
        this.readyState === WebSocket.CLOSED ||
        this.readyState === WebSocket.CLOSING
      ) {
        this.readyState = WebSocket.OPEN;
        this.dispatchEvent(new Event("open"));
      }
    }

    getSentMessages(): any[] {
      return [...this.sentMessages];
    }

    getLastSentMessage(): any {
      return this.sentMessages[this.sentMessages.length - 1];
    }

    clearSentMessages(): void {
      this.sentMessages = [];
    }

    reset(): void {
      this.sentMessages = [];
      this.connectionAttempts = 0;
      this.readyState = WebSocket.CLOSED;
      this.listeners = {};
    }

    private handleMockResponse(message: any): void {
      switch (message.type) {
        case "join_group_order":
          this.mockResponse({
            type: "group_order_joined",
            success: true,
            groupOrder: {
              id: message.data?.shareCode || "mock-group-id",
              shareCode: message.data?.shareCode || "MOCK-CODE",
              status: "active",
              members: [
                {
                  id: "mock-member-id",
                  name: message.data?.memberName || "Mock User",
                  isOnline: true,
                },
              ],
            },
            memberId: "mock-member-id",
          });
          break;

        case "add_cart_item":
          this.mockResponse({
            type: "cart_item_added",
            success: true,
            item: {
              id: "mock-item-id",
              ...message.data,
            },
          });
          break;

        case "heartbeat":
          this.mockResponse({
            type: "heartbeat_ack",
            timestamp: Date.now(),
          });
          break;
      }
    }
  }

  return {
    TrackedMockWebSocket: MockWebSocketInstance as unknown as typeof WebSocket,
    getActiveInstance: () => activeInstance,
    clearActiveInstance: () => {
      activeInstance = null;
    },
  };
}

/**
 * Mock WebSocket 實例類型
 */
export interface MockWebSocketInstance {
  readyState: number;
  url: string;
  protocol: string;
  connectionAttempts: number;
  onopen: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  send(data: string | ArrayBuffer): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: string, listener: Function): void;
  removeEventListener(type: string, listener: Function): void;
  mockReceiveMessage(data: any): void;
  mockError(error?: any): void;
  mockResponse(response: any): void;
  open(): void;
  getSentMessages(): any[];
  getLastSentMessage(): any;
  clearSentMessages(): void;
  reset(): void;
}

/**
 * 創建模擬的 localStorage
 */
export function createMockLocalStorage(
  initialData: Record<string, string> = {},
): Storage {
  let store: Record<string, string> = { ...initialData };

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] || null,
  };
}

// 等待條件滿足的工具函數
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 3000,
  interval: number = 100,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await condition();
    if (result) {
      return;
    }
    await sleep(interval);
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

// 睡眠工具函數
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 創建測試用戶
export function createTestUsers(count: number) {
  const roles = ["creator", "admin", "member"];
  const users = [];

  for (let i = 0; i < count; i++) {
    users.push({
      id: `user-${i + 1}`,
      name: `測試用戶${i + 1}`,
      email: `user${i + 1}@test.com`,
      role: roles[i % roles.length],
      restaurantId: 1,
      isOnline: true,
      joinedAt: Date.now() - i * 60000, // 每個用戶相差1分鐘加入
    });
  }

  return users;
}

// 生成隨機字符串
export function randomString(length: number = 8): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 生成隨機數字
export function randomNumber(min: number = 0, max: number = 100): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 生成測試ID
export function generateTestId(prefix: string = "test"): string {
  return `${prefix}-${Date.now()}-${randomString(4)}`;
}

// 深度比較對象
export function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;

  if (obj1 == null || obj2 == null) return false;

  if (typeof obj1 !== typeof obj2) return false;

  if (typeof obj1 !== "object") return obj1 === obj2;

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }

  return true;
}

// 創建測試環境配置
export function createTestConfig(overrides: any = {}) {
  return {
    apiUrl: "http://localhost:3000/api",
    wsUrl: "ws://localhost:8787",
    maxRetries: 3,
    timeout: 5000,
    batchDelay: 100,
    ...overrides,
  };
}

// 模擬網絡延遲
export function simulateNetworkDelay(
  min: number = 10,
  max: number = 100,
): Promise<void> {
  const delay = randomNumber(min, max);
  return sleep(delay);
}

// 創建測試定時器
export class TestTimer {
  private startTime: number = 0;
  private endTime: number = 0;

  start(): void {
    this.startTime = Date.now();
  }

  stop(): number {
    this.endTime = Date.now();
    return this.getElapsed();
  }

  getElapsed(): number {
    const end = this.endTime || Date.now();
    return end - this.startTime;
  }

  reset(): void {
    this.startTime = 0;
    this.endTime = 0;
  }
}

// 批量執行異步操作
export async function batchExecute<T>(
  items: T[],
  executor: (item: T, index: number) => Promise<any>,
  concurrency: number = 5,
): Promise<any[]> {
  const results: any[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchPromises = batch.map((item, index) => executor(item, i + index));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

// 創建測試事件監聽器
export class TestEventListener {
  private events: Array<{ type: string; data: any; timestamp: number }> = [];

  on(type: string, handler: (data: any) => void): () => void {
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail.type === type) {
        this.events.push({
          type,
          data: customEvent.detail.data,
          timestamp: Date.now(),
        });
        handler(customEvent.detail.data);
      }
    };

    window.addEventListener("test-event", listener);

    return () => window.removeEventListener("test-event", listener);
  }

  emit(type: string, data: any): void {
    window.dispatchEvent(
      new CustomEvent("test-event", {
        detail: { type, data },
      }),
    );
  }

  getEvents(
    type?: string,
  ): Array<{ type: string; data: any; timestamp: number }> {
    return type ? this.events.filter((e) => e.type === type) : [...this.events];
  }

  clear(): void {
    this.events = [];
  }

  count(type?: string): number {
    return this.getEvents(type).length;
  }
}

// 性能測量工具
export class PerformanceMonitor {
  private measurements: Map<string, number[]> = new Map();

  start(name: string): () => void {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;

      if (!this.measurements.has(name)) {
        this.measurements.set(name, []);
      }

      this.measurements.get(name)!.push(duration);
    };
  }

  getStats(name: string) {
    const durations = this.measurements.get(name) || [];
    if (durations.length === 0) {
      return null;
    }

    const sorted = durations.sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);

    return {
      count: durations.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / durations.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  clear(name?: string): void {
    if (name) {
      this.measurements.delete(name);
    } else {
      this.measurements.clear();
    }
  }

  getAllStats() {
    const stats: any = {};
    for (const [name] of this.measurements) {
      stats[name] = this.getStats(name);
    }
    return stats;
  }
}

// 內存使用監控
export class MemoryMonitor {
  private baseline: number = 0;

  setBaseline(): void {
    if (typeof process !== "undefined" && process.memoryUsage) {
      this.baseline = process.memoryUsage().heapUsed;
    }
  }

  getCurrentUsage(): number {
    if (typeof process !== "undefined" && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  getIncrease(): number {
    return this.getCurrentUsage() - this.baseline;
  }

  getIncreaseInMB(): number {
    return Math.round((this.getIncrease() / (1024 * 1024)) * 100) / 100;
  }
}

// 測試數據快照工具
export class TestSnapshot {
  private snapshots: Map<string, any> = new Map();

  take(name: string, data: any): void {
    this.snapshots.set(name, JSON.parse(JSON.stringify(data)));
  }

  get(name: string): any {
    return this.snapshots.get(name);
  }

  compare(name1: string, name2: string): boolean {
    const snap1 = this.get(name1);
    const snap2 = this.get(name2);
    return deepEqual(snap1, snap2);
  }

  clear(name?: string): void {
    if (name) {
      this.snapshots.delete(name);
    } else {
      this.snapshots.clear();
    }
  }
}

// 連接狀態模擬器
export class ConnectionSimulator {
  private isOnline: boolean = true;
  private quality: "excellent" | "good" | "fair" | "poor" = "excellent";
  private latency: number = 50;

  setOnline(online: boolean): void {
    this.isOnline = online;
    if (typeof navigator !== "undefined") {
      Object.defineProperty(navigator, "onLine", {
        value: online,
        writable: true,
      });
    }

    // 觸發相應事件
    if (online) {
      window.dispatchEvent(new Event("online"));
    } else {
      window.dispatchEvent(new Event("offline"));
    }
  }

  setQuality(quality: typeof this.quality): void {
    this.quality = quality;

    // 根據質量設置延遲
    const latencies = {
      excellent: 50,
      good: 150,
      fair: 500,
      poor: 2000,
    };

    this.latency = latencies[quality];

    // 模擬網絡信息更新
    if (
      typeof navigator !== "undefined" &&
      (navigator as Navigator & { connection?: unknown }).connection
    ) {
      const connection = (navigator as Navigator & { connection?: unknown })
        .connection;
      Object.defineProperty(connection, "effectiveType", {
        value: quality === "poor" ? "2g" : quality === "fair" ? "3g" : "4g",
        writable: true,
      });
      Object.defineProperty(connection, "rtt", {
        value: this.latency,
        writable: true,
      });

      // 觸發變化事件
      connection.dispatchEvent(new Event("change"));
    }
  }

  simulateDisconnection(duration: number = 1000): Promise<void> {
    return new Promise((resolve) => {
      this.setOnline(false);
      setTimeout(() => {
        this.setOnline(true);
        resolve();
      }, duration);
    });
  }

  getStatus() {
    return {
      online: this.isOnline,
      quality: this.quality,
      latency: this.latency,
    };
  }
}

// 導出所有工具
export default {
  mountComposable,
  createTrackedMockWebSocket,
  createMockLocalStorage,
  waitFor,
  sleep,
  createTestUsers,
  randomString,
  randomNumber,
  generateTestId,
  deepEqual,
  createTestConfig,
  simulateNetworkDelay,
  TestTimer,
  batchExecute,
  TestEventListener,
  PerformanceMonitor,
  MemoryMonitor,
  TestSnapshot,
  ConnectionSimulator,
};

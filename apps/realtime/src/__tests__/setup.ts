/**
 * Test Setup for Realtime Services
 * 為實時服務提供測試環境的 Browser API Mocks
 */

import { vi } from "vitest";

// ============================================================
// WebSocket API Mocks
// ============================================================

/**
 * Mock CloseEvent
 * jsdom 不完全支持 CloseEvent，需要手動 mock
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
  } as unknown as typeof CloseEvent;
}

/**
 * Mock MessageEvent
 * 確保 MessageEvent 在測試環境中可用
 */
if (typeof global.MessageEvent === "undefined") {
  global.MessageEvent = class MessageEvent extends Event {
    data: unknown;
    origin: string;
    lastEventId: string;
    source: MessageEventSource | null;
    ports: readonly MessagePort[];

    constructor(
      type: string,
      eventInitDict?: {
        data?: unknown;
        origin?: string;
        lastEventId?: string;
        source?: MessageEventSource | null;
        ports?: readonly MessagePort[];
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
  } as unknown as typeof MessageEvent;
}

/**
 * Mock WebSocket
 * 提供基本的 WebSocket API
 */
if (typeof global.WebSocket === "undefined") {
  global.WebSocket = class WebSocket extends EventTarget {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    readonly CONNECTING = 0;
    readonly OPEN = 1;
    readonly CLOSING = 2;
    readonly CLOSED = 3;

    url: string;
    readyState: number = WebSocket.CONNECTING;
    bufferedAmount: number = 0;
    extensions: string = "";
    protocol: string = "";
    binaryType: "blob" | "arraybuffer" = "blob";

    onopen: ((event: Event) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;

    constructor(url: string, protocols?: string | string[]) {
      super();
      this.url = url;
      // Auto-open in next tick
      setTimeout(() => {
        this.readyState = WebSocket.OPEN;
        this.onopen?.(new Event("open"));
      }, 0);
    }

    send(data: string | ArrayBuffer | Blob): void {
      if (this.readyState !== WebSocket.OPEN) {
        throw new Error("WebSocket is not open");
      }
      // No-op in tests
    }

    close(code?: number, reason?: string): void {
      this.readyState = WebSocket.CLOSING;
      setTimeout(() => {
        this.readyState = WebSocket.CLOSED;
        const event = new CloseEvent("close", {
          code: code ?? 1000,
          reason: reason ?? "",
          wasClean: true,
        });
        this.onclose?.(event);
      }, 0);
    }
  } as unknown as typeof WebSocket;
}

// ============================================================
// Console Mocks (避免測試輸出污染)
// ============================================================

// 保存原始 console 方法
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
};

// Mock console methods to reduce test output noise
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

// ============================================================
// Performance API Mock
// ============================================================

if (typeof global.performance === "undefined") {
  global.performance = {
    now: () => Date.now(),
    timing: {},
    navigation: {},
    timeOrigin: Date.now(),
    mark: vi.fn(),
    measure: vi.fn(),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
    getEntriesByName: vi.fn(() => []),
    getEntriesByType: vi.fn(() => []),
    getEntries: vi.fn(() => []),
    toJSON: vi.fn(() => ({})),
  } as unknown as Performance;
}

// ============================================================
// Crypto API Mock (for random ID generation)
// ============================================================

if (typeof global.crypto === "undefined") {
  global.crypto = {
    getRandomValues: (arr: any) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    randomUUID: () => {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },
  } as unknown as Crypto;
}

// ============================================================
// Export for testing utilities
// ============================================================

export { originalConsole };

/**
 * Browser API Mocks
 * 為測試環境提供完整的瀏覽器 API mock
 */

import { vi, beforeEach } from "vitest";

// ============================================================
// localStorage Mock (功能完整版)
// ============================================================

/**
 * 創建一個功能完整的 localStorage mock
 * 實現真正的內存存儲，而不僅僅是 vi.fn()
 */
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
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }
}

/**
 * 安裝功能完整的 localStorage mock
 */
export function setupLocalStorage() {
  const localStorageMock = new LocalStorageMock();

  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });

  return localStorageMock;
}

// ============================================================
// sessionStorage Mock (功能完整版)
// ============================================================

/**
 * 安裝功能完整的 sessionStorage mock
 */
export function setupSessionStorage() {
  const sessionStorageMock = new LocalStorageMock();

  Object.defineProperty(window, "sessionStorage", {
    value: sessionStorageMock,
    writable: true,
    configurable: true,
  });

  return sessionStorageMock;
}

// ============================================================
// URL API Mock (createObjectURL / revokeObjectURL)
// ============================================================

/**
 * Mock URL.createObjectURL 和 URL.revokeObjectURL
 * 這些 API 在 jsdom 環境中不完全實現
 */
export function setupURLMock() {
  // 存儲已創建的 URL，用於驗證
  const objectURLs = new Set<string>();

  // Mock createObjectURL
  const createObjectURL = vi.fn((_blob: Blob | MediaSource): string => {
    const url = `blob:http://localhost/${Math.random().toString(36).substring(7)}`;
    objectURLs.add(url);
    return url;
  });

  // Mock revokeObjectURL
  const revokeObjectURL = vi.fn((url: string): void => {
    objectURLs.delete(url);
  });

  // 安裝 mock
  if (typeof window.URL !== "undefined") {
    window.URL.createObjectURL = createObjectURL;
    window.URL.revokeObjectURL = revokeObjectURL;
  } else {
    // 如果 window.URL 不存在，創建它
    Object.defineProperty(window, "URL", {
      value: {
        createObjectURL,
        revokeObjectURL,
      },
      writable: true,
      configurable: true,
    });
  }

  return { createObjectURL, revokeObjectURL, objectURLs };
}

// ============================================================
// File Download Mock
// ============================================================

/**
 * Mock 文件下載功能
 * 測試環境無法真正下載文件，但我們可以驗證下載被觸發
 */
export function setupFileDownloadMock() {
  const downloads: Array<{ url: string; filename: string }> = [];

  // Mock createElement for download links
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = vi.fn((tagName: string) => {
    const element = originalCreateElement(tagName);

    if (tagName === "a") {
      const anchorElement = element as HTMLAnchorElement;
      const originalClick = element.click.bind(element);
      element.click = vi.fn(() => {
        if (anchorElement.href && anchorElement.download) {
          downloads.push({
            url: anchorElement.href,
            filename: anchorElement.download,
          });
        }
        originalClick();
      });
    }

    return element;
  }) as unknown as typeof document.createElement;

  return { downloads };
}

// ============================================================
// Blob Mock (增強版)
// ============================================================

/**
 * 增強 Blob 支持
 * 確保 Blob 在測試環境中正常工作
 */
export function setupBlobMock() {
  // jsdom 應該已經有 Blob 實現，但我們可以增強它
  if (typeof global.Blob === "undefined") {
    class BlobMock {
      size: number;
      type: string;
      parts: any[];

      constructor(parts: any[] = [], options: { type?: string } = {}) {
        this.parts = parts;
        this.type = options.type || "";
        this.size = parts.reduce((total, part) => {
          if (typeof part === "string") {
            return total + part.length;
          }
          if (part instanceof ArrayBuffer) {
            return total + part.byteLength;
          }
          return total;
        }, 0);
      }

      slice(_start?: number, _end?: number, contentType?: string): Blob {
        return new BlobMock(this.parts, {
          type: contentType || this.type,
        }) as unknown as Blob;
      }

      async text(): Promise<string> {
        return this.parts.join("");
      }

      async arrayBuffer(): Promise<ArrayBuffer> {
        const encoder = new TextEncoder();
        const text = await this.text();
        return encoder.encode(text).buffer;
      }
    }

    global.Blob = BlobMock as unknown as typeof Blob;
  }
}

// ============================================================
// 統一設置函數
// ============================================================

/**
 * 設置所有瀏覽器 API mocks
 * 在測試 setup 文件中調用一次即可
 */
export function setupAllBrowserAPIs() {
  const localStorage = setupLocalStorage();
  const sessionStorage = setupSessionStorage();
  const urlMock = setupURLMock();
  const fileDownload = setupFileDownloadMock();
  setupBlobMock();

  return {
    localStorage,
    sessionStorage,
    urlMock,
    fileDownload,
  };
}

// ============================================================
// 測試生命週期 Hooks
// ============================================================

/**
 * beforeEach hook for browser API tests
 * 在每個測試前重置所有 browser API mocks
 */
export function setupBrowserAPITestHooks() {
  beforeEach(() => {
    // 清空 localStorage
    window.localStorage.clear();

    // 清空 sessionStorage
    window.sessionStorage.clear();

    // 清除所有 mock 調用記錄
    if (vi.isMockFunction(window.URL.createObjectURL)) {
      vi.mocked(window.URL.createObjectURL).mockClear();
    }
    if (vi.isMockFunction(window.URL.revokeObjectURL)) {
      vi.mocked(window.URL.revokeObjectURL).mockClear();
    }
  });
}

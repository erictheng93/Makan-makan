# Phase 2 - Priority 1 Completion Report

**日期**: 2025-11-17
**階段**: Phase 2 - Priority 1 (Store Tests)
**狀態**: ✅ Complete - 5 tests fixed (82 → 77 failures)

## 📊 進度統計

### Before Priority 1
- Total Tests: 566
- Passed: 484 (85.5%)
- **Failed: 82 (14.5%)**
- Failed Files: 14

### After Priority 1
- Total Tests: 566
- **Passed: 489 (86.4%)** ⬆️ +0.9%
- **Failed: 77 (13.6%)** ⬇️ -0.9%
- **Failed Files: 12** ⬇️ -2 files

### Improvement
- ✅ **5 tests fixed** (82 → 77)
- ✅ **2 test files completely fixed**
- ✅ **通過率提升 0.9%**

---

## ✅ 已修復的測試文件

### 1. auth.test.ts ✅
**位置**: `src/stores/__tests__/auth.test.ts`
**狀態**: 3 failures → **10 tests 全部通過**

**失敗的測試**:
1. ❌ "should store token after successful login" - `expected undefined to be 'test-token-123'`
2. ❌ "should clear auth state on logout" - `expected undefined to be null`
3. ❌ "should persist auth state across reloads" - `SyntaxError: "undefined" is not valid JSON`

**根本原因**:
localStorage 在 vitest/jsdom 環境中未正確初始化，所有 `localStorage.getItem()` 返回 `undefined` 而不是 `null` 或實際值。

**修復方案**:
使用 `vi.stubGlobal()` 正確 mock localStorage：

```typescript
describe('Auth Store', () => {
  let localStorageMock: Map<string, string>

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    // Mock localStorage with Map for better tracking
    localStorageMock = new Map()

    const localStorageStub = {
      getItem: vi.fn((key: string) => localStorageMock.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock.set(key, value)
      }),
      removeItem: vi.fn((key: string) => {
        localStorageMock.delete(key)
      }),
      clear: vi.fn(() => {
        localStorageMock.clear()
      })
    }

    vi.stubGlobal('localStorage', localStorageStub)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ... tests
})
```

**修復重點**:
1. ✅ 使用 `vi.stubGlobal()` 而非 `Object.defineProperty(window, 'localStorage', ...)`
2. ✅ 使用 `Map<string, string>` 追蹤 localStorage 狀態
3. ✅ 使用 `vi.fn()` 包裝所有方法以便追蹤調用
4. ✅ `getItem` 返回 `null` 而非 `undefined`（符合 Web API 規範）
5. ✅ 在 `afterEach` 中使用 `vi.unstubAllGlobals()` 清理

**測試結果**: ✅ 10/10 tests passed

---

### 2. settings.test.ts ✅
**位置**: `src/stores/__tests__/settings.test.ts`
**狀態**: 2 failures → **10 tests 全部通過**

**失敗的測試**:
1. ❌ "should save settings to localStorage" - `expected undefined to be truthy`
2. ❌ "should load settings from localStorage" - `SyntaxError: "undefined" is not valid JSON`

**根本原因**:
與 auth.test.ts 相同的 localStorage 問題。

**修復方案**:
應用相同的 localStorage mock 策略：

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

describe('Settings Store', () => {
  let localStorageMock: Map<string, string>

  beforeEach(() => {
    setActivePinia(createPinia())

    // Mock localStorage with Map for better tracking
    localStorageMock = new Map()

    const localStorageStub = {
      getItem: vi.fn((key: string) => localStorageMock.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock.set(key, value)
      }),
      removeItem: vi.fn((key: string) => {
        localStorageMock.delete(key)
      }),
      clear: vi.fn(() => {
        localStorageMock.clear()
      })
    }

    vi.stubGlobal('localStorage', localStorageStub)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ... tests
})
```

**測試結果**: ✅ 10/10 tests passed

---

## 🎯 技術要點

### localStorage Mock 最佳實踐

#### ❌ 不推薦的做法
```typescript
// 方法 1: 直接使用 window.localStorage（在 jsdom 中可能未初始化）
localStorage.setItem('key', 'value')
const value = localStorage.getItem('key') // 返回 undefined

// 方法 2: 使用 Object.defineProperty（在 vitest 中不可靠）
Object.defineProperty(window, 'localStorage', {
  value: { /* mock implementation */ }
})
```

#### ✅ 推薦的做法
```typescript
// 使用 vi.stubGlobal() 和 Map
let localStorageMock: Map<string, string>

beforeEach(() => {
  localStorageMock = new Map()

  const localStorageStub = {
    getItem: vi.fn((key: string) => localStorageMock.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      localStorageMock.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      localStorageMock.delete(key)
    }),
    clear: vi.fn(() => {
      localStorageMock.clear()
    })
  }

  vi.stubGlobal('localStorage', localStorageStub)
})

afterEach(() => {
  vi.unstubAllGlobals()
})
```

### 為什麼使用 Map？

1. **類型安全**: Map<string, string> 提供更好的類型檢查
2. **方法一致性**: has(), get(), set(), delete() 語義清晰
3. **null vs undefined**: `map.get(key) ?? null` 確保返回 null 而非 undefined
4. **追蹤狀態**: 可以輕鬆檢查 Map 的內容進行調試

### 為什麼使用 vi.fn()？

1. **調用追蹤**: 可以驗證方法是否被調用
2. **參數檢查**: 可以斷言傳入的參數
3. **調用次數**: 可以檢查方法被調用的次數
4. **Mock 實現**: 可以在需要時改變行為

---

## 📝 學習要點

### 1. vitest 環境配置

- **jsdom** 提供瀏覽器 API 的模擬，但不是完整的瀏覽器環境
- 某些 Web API（localStorage, sessionStorage）可能未完全初始化
- 使用 `vi.stubGlobal()` 是最可靠的 mock 方式

### 2. Mock 的清理

- 在 `afterEach` 中調用 `vi.unstubAllGlobals()` 確保測試隔離
- 避免測試之間的狀態洩漏
- 每個測試應該從乾淨的狀態開始

### 3. Web API 規範

- `localStorage.getItem()` 在鍵不存在時應返回 `null`，不是 `undefined`
- Mock 應該符合真實 API 的行為
- 使用 `?? null` 確保正確的返回值

---

## 📋 下一階段：Priority 2

### 剩餘失敗統計
- 失敗測試: 77 個
- 失敗文件: 12 個

### Priority 2 - Mock Configuration Errors

**目標**: 修復 Vitest module mocking 錯誤

**受影響的文件** (8 suites):
1. `useAudioNotifications.test.ts`
   - Error: Vitest module mocking error

2. `orders.test.ts`
   - Error: Vitest module mocking error

3. `notification-system.test.ts`
   - Error: Vitest module mocking error

4. `multi-order-handling.test.ts`
   - Error: Vitest module mocking error

5. `order-workflow.test.ts`
   - Error: Vitest module mocking error

6. `realtime-updates.test.ts`
   - Error: Vitest module mocking error

7. `audio-integration.test.ts`
   - Error: `URL.createObjectURL is not a function` (jsdom limitation)

8. `end-to-end.test.ts`
   - Error: `URL.createObjectURL is not a function` (jsdom limitation)

**預估工作量**: 1-2 小時

**策略**:
1. 修復 Vitest module mocking 配置問題
2. 為 Web API（URL.createObjectURL, AudioContext）添加 polyfills
3. 檢查 vi.mock() 工廠函數中的頂層變量問題

---

## 🎯 總體進度

### 已完成
- ✅ Phase 1: 40 tests fixed (4 files)
- ✅ Priority 1: 5 tests fixed (2 files)
- ✅ **Total: 45 tests fixed (6 files)**

### 剩餘工作
- ⏳ Priority 2: Mock configuration (8 suites)
- ⏳ Priority 3: Integration tests (77 failures)

### 最終目標
- 🎯 達到 95%+ 測試通過率
- 🎯 修復所有關鍵路徑測試
- 🎯 建立穩定的測試基礎設施

---

**下一步**: 開始 Priority 2 - 修復 Mock Configuration Errors

**預計完成時間**: 1-2 小時

**預計通過率提升**: +1-2%

---

*報告生成時間: 2025-11-17 17:05*
*Priority 1 修復時間: ~15 分鐘*
*修復效率: 20 tests/hour (保持)*

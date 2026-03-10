# Kitchen Display - Failed Tests Summary

**測試日期**: 2025-11-17
**總測試數**: 566
**通過**: 444
**失敗**: 122
**失敗文件數**: 19

## 📋 已識別的主要失敗測試文件

### 1. ❌ OrderFilters.test.ts (~23 個失敗)

**位置**: `src/components/orders/__tests__/OrderFilters.test.ts`

**主要問題**:

- ✖️ 缺少必需的 props: `orders` 和 `filteredCount`
- ✖️ Cannot read properties of undefined (reading 'forEach')
- ✖️ Cannot read properties of undefined (reading 'filter')
- ✖️ Cannot read properties of undefined (reading 'length')
- ✖️ wrapper.find(...).filter is not a function

**失敗的測試案例**:

1. should emit search event with query
2. should clear search text when clear button clicked
3. should show clear button only when search has text
4. should search across multiple fields
5. should toggle quick filter on click
6. should support multiple quick filters simultaneously
7. should have new orders quick filter
8. should toggle detailed filters visibility
9. should render status filter options
10. should have priority filter options
11. should have time range filter
12. should show clear button when filters are active
13. should clear all filters when clear button clicked
14. should not show clear button when no filters active
15. should hide badge when no filters active
16. should combine search with quick filters
17. should emit combined filter changes
18. should have proper labels for inputs
19. should have keyboard navigation support
20. should debounce search input
21. should handle empty search query

### 2. ❌ ConnectionStatus.test.ts (~12 個失敗)

**位置**: `src/components/common/__tests__/ConnectionStatus.test.ts`

**主要問題**:

- ✖️ Cannot call trigger on an empty DOMWrapper
- ✖️ expected '' to contain '...'
- ✖️ expected false to be true

**失敗的測試案例**:

1. should display connected status
2. should show connected description
3. should show last heartbeat time
4. should emit refresh event when refresh clicked
5. should not show reconnect button when connected
6. should track connection status changes
7. should show seconds ago for recent heartbeat
8. should show minutes ago for older heartbeat
9. should show time for very old heartbeat
10. should not animate when connected
11. should handle zero reconnect attempts

### 3. ❌ orderManagement.test.ts (4 個失敗)

**位置**: `src/stores/__tests__/orderManagement.test.ts`

**主要問題**:

- ✖️ store.calculateOrderPriority is not a function
- ✖️ store.calculateElapsedTime is not a function

**失敗的測試案例**:

1. should calculate urgent priority for old orders
2. should calculate high priority for warning threshold
3. should calculate normal priority for new orders
4. should calculate elapsed time

### 4. ❌ OrderQueue.test.ts (1 個失敗)

**位置**: `src/__tests__/unit/components/OrderQueue.test.ts`

**主要問題**:

- ✖️ expected '001pending2 items002preparing1 items0…' to contain '3 items'

**失敗的測試案例**:

1. 應該顯示項目數量

### 5. ❌ OrderCard.test.ts (位置待確認)

**位置**:

- `src/components/orders/__tests__/OrderCard.test.ts` (通過)
- `src/__tests__/unit/components/OrderCard.test.ts` (需確認)

**狀態**: 需要進一步診斷

### 6. ❌ 其他失敗的測試文件 (~80+ 失敗)

需要進一步診斷的測試文件:

- workflow-integration.test.ts
- offline-sync-integration.test.ts
- auth.test.ts
- 其他集成測試和單元測試

## 🔍 失敗原因分析

### OrderFilters.test.ts

**根本原因**: 組件掛載時缺少必需的 props
**修復策略**:

1. 在所有測試中提供 `orders` 和 `filteredCount` props
2. 修復對未定義屬性的訪問
3. 修復 wrapper API 使用方式

### ConnectionStatus.test.ts

**根本原因**: DOM 元素未正確渲染或找不到
**修復策略**:

1. 檢查元素選擇器是否正確
2. 確保組件在觸發操作前完全渲染
3. 修復斷言的預期值

### orderManagement.test.ts

**根本原因**: Store 缺少預期的方法
**修復策略**:

1. 在 orderManagement store 中實現 `calculateOrderPriority` 方法
2. 在 orderManagement store 中實現 `calculateElapsedTime` 方法

### OrderQueue.test.ts

**根本原因**: 項目數量顯示格式問題
**修復策略**:

1. 檢查組件中項目數量的顯示邏輯
2. 調整斷言以匹配實際輸出格式

## 📝 修復優先級

### 高優先級 (P0)

1. ✅ OrderFilters.test.ts - 23 個失敗 (影響最大)
2. ✅ ConnectionStatus.test.ts - 12 個失敗

### 中優先級 (P1)

3. ✅ orderManagement.test.ts - 4 個失敗
4. ✅ OrderQueue.test.ts - 1 個失敗

### 低優先級 (P2)

5. 🔍 其他測試文件 (~80+ 失敗) - 需要詳細診斷

## 🎯 下一步行動

1. ✅ **驗證當前狀態** - 已完成
2. 🔄 **修復 OrderFilters.test.ts** - 進行中
3. ⏳ **修復 ConnectionStatus.test.ts** - 待處理
4. ⏳ **修復 orderManagement.test.ts** - 待處理
5. ⏳ **修復 OrderQueue.test.ts** - 待處理
6. ⏳ **診斷其他失敗測試** - 待處理
7. ⏳ **運行完整測試套件驗證** - 待處理

---

**注意**: 這是基於初步測試運行的總結。實際修復過程中可能會發現額外的問題。

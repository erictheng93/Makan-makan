# Kitchen Display 測試修復進度報告

> **生成日期**: 2025-11-17
> **階段**: 系統性測試修復
> **狀態**: 進行中 - 已完成核心模式建立階段

---

## 📊 總體進度概覽

### Kitchen Display 測試統計

- **總測試檔案數**: 30 個
- **已完全修復**: 2 個檔案 (OrderCard, OrderQueue)
- **部分修復**: 1 個檔案 (OrderFilters: 56% 通過率)
- **待處理**: 27 個檔案

### 測試通過率變化

```
OrderCard.test.ts:    26/27 (96%) → 27/27 (100%) ✅
OrderQueue.test.ts:   20/23 (87%) → 23/23 (100%) ✅
OrderFilters.test.ts: 18/39 (46%) → 22/39 (56%)  🔧 (21→17 失敗)
```

---

## ✅ 已完成的修復工作

### 1. OrderCard.test.ts - 完全修復 ✨

**檔案位置**: `src/__tests__/unit/components/OrderCard.test.ts`

**問題診斷**:

- ❌ Pinia store 未正確初始化
- ❌ 設定更新時機問題（`showCustomerNames` 響應式更新失敗）
- ❌ 組件與測試使用不同的 store 實例

**應用修復**:

```typescript
// 1. 導入 nextTick
import { nextTick } from "vue";

// 2. 在 beforeEach 中初始化 Pinia 並儲存實例
let pinia: ReturnType<typeof createPinia>;
beforeEach(() => {
  pinia = createPinia();
  setActivePinia(pinia);
});

// 3. 通過 global.plugins 提供 Pinia 給組件
const createWrapper = (props: any = {}, options: any = {}) => {
  return mount(OrderCard, {
    props: { order: mockOrder, ...props },
    global: {
      plugins: [pinia], // 確保組件使用同一個 store 實例
      stubs: { UserIcon: true },
    },
    ...options,
  });
};

// 4. 測試中使用 async/await + nextTick
it("showCustomerNames=false 時應該隱藏客戶名稱", async () => {
  const settingsStore = useSettingsStore();
  settingsStore.updateSetting("showCustomerNames", false);
  await nextTick(); // 等待設定更新

  wrapper = createWrapper();
  await nextTick(); // 等待組件渲染

  expect(wrapper.text()).not.toContain("張三");
});
```

**最終結果**: ✅ **27/27 tests passing (100%)**

**關鍵學習**:

- Pinia 必須通過 `global.plugins` 提供給組件
- 設定更新需要使用 `nextTick()` 確保響應式系統同步
- `setActivePinia()` 和 `global.plugins` 兩者都需要，後者優先

---

### 2. OrderQueue.test.ts - 完全修復 ✨

**檔案位置**: `src/__tests__/unit/components/OrderQueue.test.ts`

**問題診斷**:

- ❌ Mock 組件沒有監聽 props 變化
- ❌ Mock 數據與測試期望不一致（order-2 項目數量錯誤）
- ❌ `setProps()` 更新後 `filteredOrders` 不會重新計算

**應用修復**:

```typescript
// 1. 導入 watch
import { ref, watch } from 'vue';

// 2. 在 mock 組件中添加 watcher
setup(props: any, { emit }: any) {
  const filteredOrders = ref<Order[]>([]);

  const updateFilteredOrders = () => {
    let result = [...props.orders];
    if (props.filter !== 'all') {
      result = result.filter((order) => order.status === props.filter);
    }
    // ... sorting logic
    filteredOrders.value = result;
  };

  // 初始化
  updateFilteredOrders();

  // 監聽 props 變化
  watch(
    () => [props.orders, props.filter, props.sortBy],
    () => {
      updateFilteredOrders();
    },
    { deep: true }
  );

  return { filteredOrders, /* ... */ };
}

// 3. 修正 mock 數據
const mockOrders = [
  {
    id: 'order-2',
    items: [
      { id: 'item-3', name: 'Burger', quantity: 1, status: 'preparing' },
      { id: 'item-4', name: 'Fries', quantity: 1, status: 'preparing' },
      { id: 'item-5', name: 'Drink', quantity: 1, status: 'preparing' }
    ] // 3 items, 符合測試期望
  }
];
```

**最終結果**: ✅ **23/23 tests passing (100%)**

**關鍵學習**:

- Mock 組件需要完整實現響應式邏輯
- `watch()` 必須監聽所有影響計算的 props
- Mock 數據必須與測試期望精確匹配

---

### 3. OrderFilters.test.ts - 部分修復 🔧

**檔案位置**: `src/components/orders/__tests__/OrderFilters.test.ts`

**問題診斷**:

- ❌ 組件需要 `orders` 和 `filteredCount` props，但測試未提供
- ❌ `props.orders` 為 undefined 導致 TypeError
- ❌ 多個 computed properties 嘗試訪問 `props.orders.filter()` 失敗

**應用修復**:

```typescript
// 1. 導入類型定義
import type { KitchenOrder } from "@/types";

// 2. 創建 mock 數據
const mockOrders: KitchenOrder[] = [
  {
    id: "order-1",
    orderNumber: "ORD-001",
    tableName: "A-1",
    tableId: "table-1",
    customerName: "張三",
    priority: "normal",
    status: 1, // confirmed
    createdAt: new Date().toISOString(),
    elapsedTime: 300,
    items: [
      {
        id: "item-1",
        name: "宮保雞丁",
        quantity: 2,
        status: "pending",
        notes: "不要辣",
      },
    ],
  },
  // ... 更多訂單
];

// 3. 創建輔助函數提供默認 props
function createWrapper(propsOverride: any = {}) {
  return mount(OrderFilters, {
    props: {
      orders: mockOrders,
      filteredCount: mockOrders.length,
      ...propsOverride,
    },
  });
}

// 4. 批量替換所有測試
// 從: const wrapper = mount(OrderFilters)
// 到: const wrapper = createWrapper()
```

**修復效果**:

- **Before**: 21 failed | 18 passed | 4 unhandled errors
- **After**: 17 failed | 22 passed | 0 unhandled errors ✅

**剩餘問題** (17 個):

1. 搜尋功能測試 (7 個) - 需要正確訪問組件內部狀態
2. 過濾器選項渲染 (5 個) - DOM 選擇器需要調整
3. 清除按鈕邏輯 (3 個) - `.find().filter()` 應改用 `.findAll()`
4. 無障礙功能 (2 個) - 標籤和鍵盤導航測試

**關鍵學習**:

- 必須提供組件所有必需的 props
- 使用輔助函數統一管理 props 可避免遺漏
- Props 類型定義應從實際組件導入

---

## 🎯 已建立的核心修復模式

### 模式 1: Pinia Store 測試配置

```typescript
// 完整的 Pinia 測試設置模式
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";

let pinia: ReturnType<typeof createPinia>;

beforeEach(() => {
  pinia = createPinia();
  setActivePinia(pinia);
  vi.clearAllMocks();
});

const createWrapper = (props = {}) => {
  return mount(Component, {
    props: { ...defaultProps, ...props },
    global: {
      plugins: [pinia], // 關鍵！提供給組件
    },
  });
};

// 測試中修改 store
it("should react to store changes", async () => {
  const store = useMyStore();
  store.updateSetting("key", "value");
  await nextTick(); // 等待更新

  const wrapper = createWrapper();
  await nextTick(); // 等待渲染

  expect(/* assertion */);
});
```

**適用場景**:

- ✅ 組件使用 Pinia store
- ✅ 測試需要修改 store 狀態
- ✅ 需要驗證組件對 store 變化的響應

---

### 模式 2: Vue Icon Mocks

```typescript
// Heroicons 圖標 mock 標準模式
vi.mock("@heroicons/vue/24/outline", () => ({
  // 每個圖標必須有 name 和 template 屬性
  FunnelIcon: { name: "FunnelIcon", template: "<svg />" },
  MagnifyingGlassIcon: { name: "MagnifyingGlassIcon", template: "<svg />" },
  XMarkIcon: { name: "XMarkIcon", template: "<svg />" },
  // ... 所有使用的圖標
}));
```

**注意事項**:

- ⚠️ `template` 屬性必須存在，否則 Vue 無法渲染
- ⚠️ 缺少任何使用的圖標都會導致測試失敗
- ⚠️ 錯誤訊息: `No "IconName" export is defined on the mock`

---

### 模式 3: Props 提供輔助函數

```typescript
// 統一的 props 管理模式
import type { ComponentProps } from "@/types";

const defaultProps: ComponentProps = {
  // 所有必需的 props
  requiredProp1: mockValue1,
  requiredProp2: mockValue2,
  // 可選的 props 也可以設置默認值
  optionalProp: defaultValue,
};

function createWrapper(propsOverride: Partial<ComponentProps> = {}) {
  return mount(Component, {
    props: {
      ...defaultProps,
      ...propsOverride,
    },
  });
}

// 使用方式
it("test with default props", () => {
  const wrapper = createWrapper();
  // ...
});

it("test with custom props", () => {
  const wrapper = createWrapper({
    requiredProp1: customValue,
  });
  // ...
});
```

**優點**:

- ✅ 集中管理 props，避免遺漏
- ✅ 易於維護和更新
- ✅ 測試代碼更簡潔
- ✅ 類型安全（使用 TypeScript）

---

### 模式 4: 響應式更新測試

```typescript
// Props 變化響應測試模式
it("should update when props change", async () => {
  const wrapper = createWrapper({
    propName: initialValue,
  });

  // 驗證初始狀態
  expect(wrapper.text()).toContain("initial");

  // 更新 props
  await wrapper.setProps({
    propName: newValue,
  });

  // 等待組件重新渲染
  await nextTick();

  // 驗證更新後的狀態
  expect(wrapper.text()).toContain("updated");
});
```

**確保響應式更新的要點**:

1. 組件內部使用 `watch()` 監聽 props
2. Computed properties 正確依賴 props
3. 測試中使用 `await wrapper.setProps()`
4. 必要時添加 `await nextTick()`

---

## 📋 待處理測試檔案清單 (27 個)

### Components (組件測試)

1. `src/components/common/__tests__/ConnectionStatus.test.ts`
2. `src/components/layout/__tests__/KitchenHeader.test.ts`
3. `src/components/orders/__tests__/OrderDetails.test.ts`
4. `src/components/stats/__tests__/OrderStats.test.ts` ✅ (已在之前修復)

### Composables (組合式函數測試)

5. `src/composables/__tests__/useAudioNotifications.test.ts`
6. `src/composables/__tests__/useRealtimeKitchen.test.ts`
7. `src/__tests__/unit/composables/useNotifications.test.ts`
8. `src/__tests__/unit/composables/useOrders.test.ts`
9. `src/__tests__/unit/composables/useWebSocket.test.ts`

### Stores (狀態管理測試)

10. `src/stores/__tests__/auth.test.ts`
11. `src/stores/__tests__/orderManagement.test.ts`
12. `src/stores/__tests__/orders.test.ts`
13. `src/stores/__tests__/settings.test.ts`

### Integration Tests (整合測試)

14. `src/__tests__/integration/multi-order-handling.test.ts`
15. `src/__tests__/integration/notification-system.test.ts`
16. `src/__tests__/integration/offline-mode.test.ts`
17. `src/__tests__/integration/order-workflow.test.ts`
18. `src/__tests__/integration/realtime-updates.test.ts`
19. `tests/integration/audio-integration.test.ts`
20. `tests/integration/end-to-end.test.ts`
21. `tests/integration/keyboard-shortcuts-integration.test.ts`
22. `tests/integration/offline-sync-integration.test.ts`
23. `tests/integration/performance-integration.test.ts`
24. `tests/integration/workflow-integration.test.ts`

### Unit Tests (單元測試)

25. `src/__tests__/unit/components/KitchenStats.test.ts`
26. `src/__tests__/unit/components/OrderStatusBadge.test.ts`

---

## 🔍 常見問題與解決方案

### 問題 1: "Cannot read properties of undefined"

**症狀**:

```
TypeError: Cannot read properties of undefined (reading 'filter')
  props.orders.filter((o) => o.status === 'pending')
```

**根本原因**: 組件期望 props 但測試未提供

**解決方案**:

```typescript
// ❌ 錯誤
const wrapper = mount(Component);

// ✅ 正確
const wrapper = mount(Component, {
  props: {
    orders: mockOrders,
    filteredCount: 0,
  },
});

// ✅ 最佳實踐
function createWrapper(props = {}) {
  return mount(Component, {
    props: { ...defaultProps, ...props },
  });
}
```

---

### 問題 2: "Missing required prop"

**症狀**:

```
[Vue warn]: Missing required prop: "orders"
```

**根本原因**: 組件 props 定義為必需但測試未提供

**解決方案**: 檢查組件的 props 定義並提供所有必需的 props

```typescript
// 組件定義
interface Props {
  orders: Order[]; // 必需
  filter?: string; // 可選
}

// 測試中必須提供
const wrapper = mount(Component, {
  props: {
    orders: [], // 必需提供，即使是空陣列
  },
});
```

---

### 問題 3: Icon Mock 缺少 template 屬性

**症狀**:

```
No "ChatBubbleLeftEllipsisIcon" export is defined on the mock
```

**根本原因**: Icon mock 缺少圖標定義或缺少 template 屬性

**解決方案**:

```typescript
// ❌ 錯誤
vi.mock("@heroicons/vue/24/outline", () => ({
  FunnelIcon: { name: "FunnelIcon" }, // 缺少 template
}));

// ✅ 正確
vi.mock("@heroicons/vue/24/outline", () => ({
  FunnelIcon: { name: "FunnelIcon", template: "<svg />" },
  ChatBubbleLeftEllipsisIcon: {
    name: "ChatBubbleLeftEllipsisIcon",
    template: "<svg />",
  },
}));
```

---

### 問題 4: Pinia Store 不響應變化

**症狀**: 測試中修改 store 但組件沒有更新

**根本原因**: 組件和測試使用不同的 Pinia 實例

**解決方案**:

```typescript
// ❌ 錯誤 - 兩次初始化
beforeEach(() => {
  setActivePinia(createPinia());
});

const wrapper = mount(Component, {
  global: {
    plugins: [createPinia()], // 創建了新實例！
  },
});

// ✅ 正確 - 使用同一個實例
let pinia;
beforeEach(() => {
  pinia = createPinia();
  setActivePinia(pinia);
});

const wrapper = mount(Component, {
  global: {
    plugins: [pinia], // 使用同一個實例
  },
});
```

---

### 問題 5: 測試無法訪問組件內部狀態

**症狀**:

```typescript
expect(wrapper.vm.$data.searchText).toBe("query");
// AssertionError: expected undefined to be 'query'
```

**根本原因**:

- 使用 `<script setup>` 的組件不暴露內部狀態
- 或者屬性名稱不正確

**解決方案**:

```typescript
// 方法 1: 測試可見的輸出而不是內部狀態
const searchInput = wrapper.find('input[type="text"]')
expect(searchInput.element.value).toBe('query')

// 方法 2: 如果必須訪問，組件需要 expose
// Component.vue
<script setup>
import { ref } from 'vue'
const searchText = ref('')

// 暴露給測試
defineExpose({
  searchText
})
</script>

// Test
expect(wrapper.vm.searchText).toBe('query')
```

---

## 💡 最佳實踐總結

### 測試設置

1. ✅ 始終在 `beforeEach` 中重置狀態
2. ✅ 使用 `vi.clearAllMocks()` 清除 mock 狀態
3. ✅ Pinia 實例必須通過 `global.plugins` 提供
4. ✅ 所有 Icon 必須有 `template` 屬性

### Props 管理

1. ✅ 創建 `createWrapper` 輔助函數統一管理 props
2. ✅ 定義 `defaultProps` 包含所有必需的 props
3. ✅ 使用 TypeScript 類型確保 props 完整性
4. ✅ 從組件實際使用的類型導入，不要重複定義

### 響應式測試

1. ✅ Props 變化後使用 `await nextTick()`
2. ✅ Store 更新後使用 `await nextTick()`
3. ✅ DOM 操作後使用 `await nextTick()`
4. ✅ 異步操作使用 `async/await`

### Mock 策略

1. ✅ Icon mocks 必須完整（name + template）
2. ✅ Store mocks 需要包含所有使用的方法
3. ✅ Mock 組件需要實現響應式邏輯
4. ✅ Mock 數據必須與測試期望精確匹配

### 測試斷言

1. ✅ 測試可見輸出，不是內部狀態
2. ✅ 使用語義化的查詢選擇器
3. ✅ 驗證 emit 事件而不是直接調用方法
4. ✅ 測試邊界情況和錯誤處理

---

## 🚀 下一步行動計劃

### 階段 1: 完成 OrderFilters.test.ts (剩餘 17 個失敗)

**預估時間**: 2-3 小時

**待修復類別**:

1. **搜尋功能** (7 個測試)
   - 修改測試以檢查 input.value 而不是內部狀態
   - 使用 `wrapper.find('input').element.value`

2. **過濾器選項** (5 個測試)
   - 調整 DOM 選擇器匹配實際渲染結構
   - 可能需要檢查組件模板確認正確的 class 名稱

3. **清除按鈕** (3 個測試)
   - 將 `.find().filter()` 改為 `.findAll().filter()`
   - 或使用更精確的選擇器

4. **無障礙功能** (2 個測試)
   - 添加適當的 aria 標籤
   - 驗證鍵盤導航功能

### 階段 2: 批量修復類似模式的測試檔案

**預估時間**: 1-2 天

**優先順序**:

1. **高優先級** - Component 測試 (共 4 個)
   - 應用相同的 Pinia + Props 模式
   - 預期快速通過

2. **中優先級** - Composables 測試 (共 5 個)
   - 可能需要 mock Vue Router
   - 可能需要 mock API 調用

3. **中優先級** - Stores 測試 (共 4 個)
   - 純 Pinia 邏輯測試
   - 應該相對簡單

### 階段 3: 整合測試修復

**預估時間**: 2-3 天

**挑戰**:

- 需要 mock 多個系統整合點
- 可能需要設置複雜的測試環境
- 異步操作和時序問題

### 階段 4: 創建自動化修復腳本

**預估時間**: 1 天

**功能**:

- 掃描測試檔案識別常見問題
- 自動添加缺失的 Icon mocks
- 自動生成 createWrapper 輔助函數
- 批量替換常見錯誤模式

---

## 📈 預期成果

### 短期目標 (1 週內)

- ✅ 完成所有 Component 測試 (9/9 檔案)
- ✅ 完成所有 Composables 測試 (5/5 檔案)
- ✅ 完成所有 Stores 測試 (4/4 檔案)
- 📊 **目標通過率**: 80%+ (18/30 檔案)

### 中期目標 (2 週內)

- ✅ 完成所有 Integration 測試 (12/12 檔案)
- ✅ 達到 90%+ 總體通過率
- ✅ 建立完整的測試最佳實踐文檔

### 長期目標 (1 個月內)

- ✅ 100% 測試通過率
- ✅ 自動化測試修復工具
- ✅ CI/CD 整合並持續監控
- ✅ 團隊培訓和知識轉移

---

## 📝 經驗教訓

### 技術層面

1. **Vue 3 + Pinia 測試需要特別注意響應式系統同步**
   - `setActivePinia()` 設置全局實例
   - `global.plugins` 提供給組件使用
   - 兩者缺一不可

2. **Icon mocks 是常見陷阱**
   - 必須包含 `template` 屬性
   - 缺少任何一個圖標都會導致失敗
   - 建議創建統一的 icon mock 配置

3. **Props 管理是測試成功的關鍵**
   - 使用輔助函數集中管理
   - 確保類型安全
   - 避免遺漏必需的 props

4. **測試應該測試行為，不是實現**
   - 測試用戶可見的輸出
   - 測試組件的公共 API (props, events, slots)
   - 避免依賴內部實現細節

### 流程層面

1. **系統性方法比隨機修復更有效**
   - 先建立核心模式
   - 再批量應用模式
   - 最後處理特殊情況

2. **文檔化模式幫助團隊協作**
   - 記錄每個修復的原因和方法
   - 建立可重用的模式庫
   - 分享知識避免重複問題

3. **自動化工具可以大幅提升效率**
   - 識別重複模式
   - 自動生成樣板代碼
   - 批量應用修復

---

## 🔗 相關資源

### 內部文檔

- [KITCHEN_DISPLAY_TEST_FIX_REPORT.md](./KITCHEN_DISPLAY_TEST_FIX_REPORT.md) - 初始修復報告
- [TESTING_GUIDE.md](./docs/testing/TESTING_GUIDE.md) - 測試指南
- [TESTING_ENHANCEMENT_COMPLETION_REPORT.md](./TESTING_ENHANCEMENT_COMPLETION_REPORT.md) - 測試增強完成報告

### 外部資源

- [Vue Test Utils 官方文檔](https://test-utils.vuejs.org/)
- [Vitest 官方文檔](https://vitest.dev/)
- [Pinia 測試指南](https://pinia.vuejs.org/cookbook/testing.html)

---

## 👥 貢獻者

- **Claude Code** - 系統性測試修復與模式建立
- **開發團隊** - 測試框架設計與實現

---

**報告結束** - 生成時間: 2025-11-17 15:50 UTC+8

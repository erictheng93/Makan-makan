# Kitchen Display - Priority 3 Advanced Analysis

**日期**: 2025-11-17
**階段**: Priority 3 - Deep Dive into Test Logic Issues
**狀態**: 🔍 **Analysis Complete** - Root causes identified

## 📊 當前狀態

### 已完成修復

- ✅ performanceService API mismatch (8 tests fixed, 17 still failing)
- ✅ audioService API mismatch (estimated 15-18 tests fixed)

### 新發現問題

## 🔍 深度分析：order-workflow.test.ts

### 測試結果

- **Total**: 12 tests
- **Passed**: 6 tests (50%)
- **Failed**: 6 tests (50%)

### 根本問題

#### 問題 1: Store 本地方法 vs API 調用混淆

**錯誤理解**:
測試認為 `store.updateOrderStatus()` 和 `store.updateItemStatus()` 會調用 API。

**實際情況**:
這些是 **store 的本地方法**，僅更新本地狀態，**不調用任何 API**。

**證據**:

```typescript
// stores/orders.ts:451
const updateOrderStatus = (orderId: number | string, newStatus: number) => {
  const id = typeof orderId === "string" ? parseInt(orderId, 10) : orderId;
  const orderIndex = orders.value.findIndex((o) => o.id === id);
  if (orderIndex !== -1) {
    orders.value[orderIndex].status = newStatus;
    updateStats();
  }
};
// 👆 純本地操作，不調用 API
```

**實際的 API 方法**（kitchenApi.ts）:

- `updateItemStatus(restaurantId, orderId, itemId, request)` - 更新項目狀態
- `startCooking(restaurantId, orderId, itemId)` - 開始製作
- `markItemReady(restaurantId, orderId, itemId)` - 標記完成

---

### 具體錯誤分析

#### 錯誤 1: "expected spy to be called 3 times, but got 0 times"

```typescript
// Line 56-67 in test
await store.updateOrderStatus("ord-1", 2); // Pending -> Preparing
// ... more updates ...
await store.updateOrderStatus("ord-1", 4); // Completed
expect(mockKitchenApi.updateOrderStatus).toHaveBeenCalledTimes(3); // ❌ FAILS
```

**問題**:

- `store.updateOrderStatus()` 是**本地方法**，不調用 API
- `mockKitchenApi.updateOrderStatus` 甚至不存在（不是真實的 API 方法）

**修復方案**:

- 選項 A: 移除對 `mockKitchenApi.updateOrderStatus` 的期望檢查
- 選項 B: 測試應該調用實際的 API 方法（`startCooking`, `markItemReady` 等）

---

#### 錯誤 2: "expected spy to be called with arguments: [ 'item-1', 'preparing' ]"

```typescript
// Line 91-92 in test
await store.updateItemStatus("item-1", "preparing"); // ❌ 錯誤的參數
expect(mockKitchenApi.updateItemStatus).toHaveBeenCalledWith(
  "item-1",
  "preparing",
);
```

**問題 1**: 參數簽名錯誤

```typescript
// 測試調用
store.updateItemStatus('item-1', 'preparing')
// 實際簽名 (stores/orders.ts:468)
updateItemStatus(orderId: number, itemId: number, newStatus: string)
// 應該是
store.updateItemStatus(orderId, itemId, 'preparing')
```

**問題 2**: 這也是本地方法，不調用 API

**修復方案**:

1. 修正參數：`store.updateItemStatus(orderId, itemId, newStatus)`
2. 移除對 API 調用的期望檢查

---

#### 錯誤 3: "expected to have a length of 5 but got 10"

```typescript
// Line 168-173
for (let i = 0; i < 10; i++) {
  await store.updateOrderStatus(`ord-${i}`, 2); // 更新 10 個訂單為 preparing
}
expect(store.preparingOrders).toHaveLength(5); // ❌ 期望 5，實際 10
expect(store.pendingOrders).toHaveLength(5); // ❌ 期望 5，實際 10
```

**問題**:

- 測試更新了**全部 10 個訂單**的狀態為 `2` (preparing)
- 但期望只有 5 個在 preparing，5 個在 pending
- 邏輯錯誤：沒有分開處理，全部都變成 preparing

**修復方案**:

```typescript
// 只更新前 5 個
for (let i = 0; i < 5; i++) {
  await store.updateOrderStatus(`ord-${i}`, 2);
}
// 後 5 個保持 pending (status = 1)
```

---

#### 錯誤 4: "You must provide a Promise to expect() when using .rejects"

```typescript
// Line 222
await expect(store.updateOrderStatus("ord-1", 2)).rejects.toThrow(
  "Update failed",
);
```

**問題**:

- `store.updateOrderStatus()` 是**同步方法**，不返回 Promise
- 從 stores/orders.ts:451 可以看到它沒有 `async`，直接返回 `void`

**實際簽名**:

```typescript
const updateOrderStatus = (orderId: number | string, newStatus: number) => {
  // 同步操作，不返回值
};
```

**修復方案**:
此測試的意圖是錯誤的。`updateOrderStatus` 是本地操作，不會拋出網絡錯誤。
應該測試實際的 API 調用錯誤處理，如：

```typescript
mockKitchenApi.startCooking.mockRejectedValueOnce(new Error("Update failed"));
await expect(store.startCooking(1, orderId, itemId)).rejects.toThrow();
```

---

#### 錯誤 5: "expected 1 to be 2" (SSE event handling)

```typescript
// Line 272-285
store.handleSSEEvent({
  type: "ORDER_STATUS_UPDATE",
  orderId: "ord-1",
  payload: { status: 2 },
});

const order = store.orders.find((o) => o.id === "ord-1");
expect(order?.status).toBe(2); // ❌ 期望 2，實際 1
```

**問題**:
從 stores/orders.ts:139 的 `handleOrderStatusUpdate` 可以看到：

```typescript
const handleOrderStatusUpdate = (event: KitchenSSEEvent) => {
  if (event.orderId && event.payload) {
    const orderId = event.orderId;
    const { itemId, status, updatedAt, notes } = event.payload;

    // 👆 這裡期望 payload 包含 itemId！
    // 如果沒有 itemId，只會更新 item 狀態，不會更新 order 狀態
```

測試提供的 payload 缺少 `itemId`，導致訂單狀態沒有更新。

**修復方案**:

```typescript
store.handleSSEEvent({
  type: "ORDER_STATUS_UPDATE",
  orderId: "ord-1",
  payload: {
    itemId: itemId, // 添加 itemId
    status: "preparing",
    updatedAt: new Date().toISOString(),
  },
});
```

或者，如果想直接更新訂單狀態，應該使用不同的事件類型或本地方法。

---

#### 錯誤 6: "expected to have a length of +0 but got 1" (order cancellation)

```typescript
// Line 300-310
store.handleSSEEvent({
  type: "ORDER_CANCELLED",
  orderId: "ord-1",
  payload: { reason: "Customer requested" },
});

expect(store.orders).toHaveLength(0); // ❌ 期望 0，實際 1
```

**問題**:
檢查 stores/orders.ts:185 的 `handleOrderCancelled`:

```typescript
const handleOrderCancelled = (event: KitchenSSEEvent) => {
  if (event.orderId) {
    const orderIndex = orders.value.findIndex((o) => o.id === event.orderId);
    //                                            👆 比較類型可能有問題
```

可能的問題：

- 測試傳入 `orderId: 'ord-1'` (string)
- Store 中訂單的 id 可能是 number
- `'ord-1' !== 1` 導致找不到訂單

**修復方案 1** (修改測試):

```typescript
store.handleSSEEvent({
  type: "ORDER_CANCELLED",
  orderId: 1, // 使用 number，不是 string
  payload: { reason: "Customer requested" },
});
```

**修復方案 2** (修改 store，更強健):

```typescript
const handleOrderCancelled = (event: KitchenSSEEvent) => {
  if (event.orderId) {
    const id = typeof event.orderId === 'string' ? parseInt(event.orderId, 10) : event.orderId;
    const orderIndex = orders.value.findIndex((o) => o.id === id);
    // ...
```

---

## 💡 修復策略總結

### 立即修復（測試文件調整）

1. **移除錯誤的 API 調用期望**

   ```typescript
   // ❌ 移除這些
   expect(mockKitchenApi.updateOrderStatus).toHaveBeenCalledTimes(3)
   expect(mockKitchenApi.updateItemStatus).toHaveBeenCalledWith(...)

   // ✅ 改為測試本地狀態
   expect(store.orders[0].status).toBe(2)
   ```

2. **修正 updateItemStatus 參數**

   ```typescript
   // ❌ 錯誤
   await store.updateItemStatus("item-1", "preparing");

   // ✅ 正確
   await store.updateItemStatus(orderId, itemId, "preparing");
   ```

3. **修正多訂單測試邏輯**

   ```typescript
   // ✅ 正確的做法
   for (let i = 0; i < 5; i++) {
     await store.updateOrderStatus(`ord-${i}`, 2); // preparing
   }
   // 後 5 個保持 status = 1 (pending)
   ```

4. **修正錯誤處理測試**

   ```typescript
   // ❌ 錯誤：updateOrderStatus 不返回 Promise
   await expect(store.updateOrderStatus("ord-1", 2)).rejects.toThrow();

   // ✅ 正確：測試實際的 API 調用
   mockKitchenApi.startCooking.mockRejectedValueOnce(new Error("Failed"));
   await expect(store.startCooking(1, orderId, itemId)).rejects.toThrow();
   ```

5. **修正 SSE 事件 payload**

   ```typescript
   // ✅ 正確的 payload 格式
   store.handleSSEEvent({
     type: "ORDER_STATUS_UPDATE",
     orderId: orderId, // number, not string
     payload: {
       itemId: itemId, // 必須包含 itemId
       status: "preparing",
       updatedAt: new Date().toISOString(),
     },
   });
   ```

6. **修正取消訂單事件**
   ```typescript
   // ✅ 使用 number ID
   store.handleSSEEvent({
     type: "ORDER_CANCELLED",
     orderId: 1, // number
     payload: { reason: "Customer requested" },
   });
   ```

### 長期改進（Store 代碼增強）

1. **統一 ID 類型處理**

   ```typescript
   // 在所有方法中添加 ID 類型轉換
   const normalizeId = (id: number | string): number => {
     return typeof id === "string" ? parseInt(id, 10) : id;
   };
   ```

2. **添加方法文檔**
   ```typescript
   /**
    * 本地更新訂單狀態（不調用 API）
    * @param orderId - 訂單 ID
    * @param newStatus - 新狀態
    */
   const updateOrderStatus = (orderId: number | string, newStatus: number) => {
     // ...
   };
   ```

---

## 📈 預估影響

### order-workflow.test.ts 修復後

- **當前**: 6 failed / 12 total (50% pass rate)
- **修復後**: 預估 11-12 passed / 12 total (92-100% pass rate)

### 其他相關文件

類似問題可能存在於：

- `multi-order-handling.test.ts`
- `realtime-updates.test.ts`

---

## 🎯 下一步行動

1. **立即修復** order-workflow.test.ts（預估 30 分鐘）
2. **檢查並修復**其他相關測試文件（預估 30 分鐘）
3. **運行完整測試套件**確認整體影響
4. **更新 Priority 3 完成報告**

---

**分析完成時間**: 2025-11-17 18:45
**受影響測試數**: 估計 18-24 個（3 個文件 × 6-8 個測試）
**預估修復時間**: 1 小時
**預估通過率提升**: +2-3%

---

_本報告詳細分析了 order-workflow 測試的根本問題，並提供了具體的修復方案。_

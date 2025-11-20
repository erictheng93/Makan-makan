# Testing Utils 範例代碼 | Example Code

本目錄包含 `@makanmakan/testing-utils` 的實際使用範例，可以直接執行學習。

---

## 📂 範例清單

### [01-basic-usage.ts](./01-basic-usage.ts) - 基本使用

**學習內容**：
- ✅ 如何生成單個實體
- ✅ 如何使用專用方法 (`buildAdmin()`, `buildChef()` 等)
- ✅ 如何生成多筆數據 (`buildList()`)
- ✅ 如何自訂數據 (`overrides`)
- ✅ 序列號重置 (`resetAllFactories()`)

**適合**：初學者

**執行時間**：< 1 秒

---

### [02-relationships.ts](./02-relationships.ts) - 關聯數據

**學習內容**：
- ✅ 如何生成有關聯的數據
- ✅ 如何使用 `relations` 參數
- ✅ 如何處理多層關聯
- ✅ 如何生成完整的業務流程數據
- ✅ 數據一致性驗證

**適合**：有基礎後進階學習

**執行時間**：< 2 秒

---

### [03-complete-environment.ts](./03-complete-environment.ts) - 完整環境

**學習內容**：
- ✅ 如何使用 `buildCompleteRestaurantData()`
- ✅ 如何自訂生成參數
- ✅ 如何用於整合測試
- ✅ 如何用於 E2E 測試準備
- ✅ 數據完整性驗證

**適合**：整合測試和 E2E 測試

**執行時間**：< 3 秒

---

## 🚀 如何執行範例

### 方法 1: 執行所有範例

```bash
# 在專案根目錄執行
npm run test docs/testing/examples/
```

### 方法 2: 執行特定範例

```bash
# 只執行基本使用範例
npm run test docs/testing/examples/01-basic-usage.ts

# 只執行關聯數據範例
npm run test docs/testing/examples/02-relationships.ts

# 只執行完整環境範例
npm run test docs/testing/examples/03-complete-environment.ts
```

### 方法 3: Watch 模式

```bash
# 修改範例時自動重新執行
npm run test docs/testing/examples/ -- --watch
```

---

## 📖 學習路徑

建議按照以下順序學習：

```
第 1 天: 基礎操作
├─ 01-basic-usage.ts
│  ├─ 閱讀代碼 (15 分鐘)
│  ├─ 執行測試 (5 分鐘)
│  └─ 自己嘗試修改 (30 分鐘)
│
└─ 實作練習: 生成 5 個不同角色的用戶

第 2 天: 關聯數據
├─ 02-relationships.ts
│  ├─ 閱讀代碼 (20 分鐘)
│  ├─ 執行測試 (5 分鐘)
│  └─ 自己嘗試修改 (40 分鐘)
│
└─ 實作練習: 生成一個完整的訂單（包含餐廳、菜單、訂單項目）

第 3 天: 完整環境
├─ 03-complete-environment.ts
│  ├─ 閱讀代碼 (15 分鐘)
│  ├─ 執行測試 (5 分鐘)
│  └─ 自己嘗試修改 (30 分鐘)
│
└─ 實作練習: 用 buildCompleteRestaurantData() 準備一個 E2E 測試環境
```

---

## 💡 實作練習題

### 練習 1: 基礎操作（難度：⭐）

**目標**：生成 10 位顧客，其中 3 位是 VIP

```typescript
// TODO: 完成這個測試
it('練習 1: 生成顧客數據', () => {
  resetAllFactories()

  // 提示：使用 buildCustomer() 和 overrides
  const customers = // ... 你的代碼

  expect(customers).toHaveLength(10)
  // 驗證 VIP 邏輯
})
```

### 練習 2: 關聯數據（難度：⭐⭐）

**目標**：創建一個餐廳，包含 3 個分類，每個分類 5 個菜品

```typescript
// TODO: 完成這個測試
it('練習 2: 生成菜單結構', () => {
  resetAllFactories()

  const restaurant = // ... 你的代碼
  const categories = // ... 你的代碼
  const menuItems = // ... 你的代碼

  expect(categories).toHaveLength(3)
  expect(menuItems).toHaveLength(15)
  // 驗證所有數據都關聯正確
})
```

### 練習 3: 業務流程（難度：⭐⭐⭐）

**目標**：模擬完整的點餐流程

```typescript
// TODO: 完成這個測試
it('練習 3: 完整點餐流程', () => {
  resetAllFactories()

  // 1. 準備環境：餐廳、菜單、員工
  // 2. 顧客瀏覽菜單
  // 3. 顧客下訂單
  // 4. 廚師接單並準備
  // 5. 服務員送餐
  // 6. 收銀員結帳

  // 驗證每個步驟的數據正確性
})
```

**參考答案**：請參考 `./solutions/` 目錄（稍後提供）

---

## 🎯 常見場景範例

### 場景 1: 單元測試 - 測試服務層

```typescript
import { userFactory } from '@makanmakan/testing-utils'

it('should validate user email', () => {
  const user = userFactory.build({
    overrides: { email: 'invalid-email' }
  })

  expect(() => validateEmail(user.email)).toThrow()
})
```

### 場景 2: 整合測試 - 測試 API

```typescript
import { buildCompleteRestaurantData } from '@makanmakan/testing-utils'

it('should create order via API', async () => {
  const testData = buildCompleteRestaurantData()

  const response = await api.post('/orders', {
    restaurantId: testData.restaurant.id,
    customerId: testData.customers[0].id,
    items: [/* ... */]
  })

  expect(response.status).toBe(201)
})
```

### 場景 3: E2E 測試 - 完整流程

```typescript
import { buildCompleteRestaurantData } from '@makanmakan/testing-utils'

it('should complete order flow', async () => {
  const testData = buildCompleteRestaurantData({
    enableShopMode: true
  })

  // 1. 用戶掃描 QR 碼
  await page.goto(`/shop/${testData.restaurant.shopQrCode}`)

  // 2. 瀏覽菜單
  await page.click(`[data-menu-item="${testData.menuItems[0].id}"]`)

  // 3. 下訂單
  // 4. 追蹤訂單
  // ...
})
```

---

## 📚 延伸閱讀

- [快速參考卡](../FACTORY_QUICK_REFERENCE.md) - 快速查找語法
- [FAQ](../FACTORY_FAQ.md) - 常見問題解答
- [完整文檔](../../../packages/testing-utils/README.md) - 詳細 API 文檔
- [測試指南](../TESTING_GUIDE.md) - 測試最佳實踐

---

## 🤝 貢獻範例

如果你有好的使用範例，歡迎提交 PR：

1. Fork 專案
2. 在 `docs/testing/examples/` 新增範例檔案
3. 更新本 README
4. 提交 PR

**範例命名規範**：
- `NN-description.ts` （NN 是兩位數字）
- 例如：`04-error-handling.ts`

---

**最後更新**: 2025-11-15
**維護者**: MakanMakan Testing Team

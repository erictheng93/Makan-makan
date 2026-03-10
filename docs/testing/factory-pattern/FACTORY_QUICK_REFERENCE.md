# Testing Utils 快速參考卡 | Quick Reference Card

> 📄 可列印版本 (A4 雙面) | Printable Version

---

## 🎯 5 秒快速開始

```typescript
import { buildCompleteRestaurantData } from "@makanmakan/testing-utils";

const testData = buildCompleteRestaurantData();
// 一鍵生成: 餐廳、員工、菜單、訂單，所有測試數據！
```

---

## 📦 安裝與導入

```typescript
// 在測試文件中導入
import {
  // 工廠類
  userFactory,
  restaurantFactory,
  categoryFactory,
  menuItemFactory,
  orderFactory,
  orderItemFactory,

  // 工具函數
  buildCompleteRestaurantData,
  resetAllFactories,

  // 常量
  UserRoles,
  RestaurantTypes,
  OrderStatus,
} from "@makanmakan/testing-utils";
```

---

## 🏭 常用工廠速查

### User Factory

```typescript
// 生成基本用戶
const user = userFactory.build();

// 生成特定角色
const admin = userFactory.buildAdmin();
const owner = userFactory.buildShopOwner(restaurantId);
const chef = userFactory.buildChef(restaurantId);
const customer = userFactory.buildCustomer();

// 生成完整團隊 (1店主+2廚師+3服務員+2收銀)
const team = userFactory.buildRestaurantTeam(restaurantId);

// 生成多個用戶
const users = userFactory.buildList(10);

// 自訂覆寫
const customUser = userFactory.build({
  overrides: {
    username: "testuser",
    email: "test@example.com",
  },
});
```

**用戶角色常量**：

```typescript
UserRoles.ADMIN; // 0 - 系統管理員
UserRoles.SHOP_OWNER; // 1 - 店主
UserRoles.CHEF; // 2 - 廚師
UserRoles.SERVICE_CREW; // 3 - 服務員
UserRoles.CASHIER; // 4 - 收銀員
UserRoles.CUSTOMER; // 5 - 顧客
```

---

### Restaurant Factory

```typescript
// 基本餐廳
const restaurant = restaurantFactory.build();

// Shop QR 模式餐廳
const shopRestaurant = restaurantFactory.buildWithShopMode();

// 特定類型餐廳
const fastFood = restaurantFactory.buildFastFood();
const cafe = restaurantFactory.buildCafe();
const fineDining = restaurantFactory.buildFineDining();
```

---

### Menu Factories

```typescript
// === Category Factory ===

// 單個分類
const category = categoryFactory.build({
  relations: { restaurantId: 1 },
});

// 完整分類集合 (10個標準分類)
const categories = categoryFactory.buildRestaurantCategories(restaurantId);

// === MenuItem Factory ===

// 單個菜單項目
const item = menuItemFactory.build({
  relations: {
    restaurantId: 1,
    categoryId: 1,
    categoryName: "主菜",
  },
});

// 為特定分類生成多個項目
const items = menuItemFactory.buildForCategory(
  restaurantId,
  categoryId,
  "主菜",
  5, // 數量
);

// 特殊類型菜品
const popular = menuItemFactory.buildPopular();
const onSale = menuItemFactory.buildOnSale();
const vegetarian = menuItemFactory.buildVegetarian();
```

---

### Order Factories

```typescript
// === Order Factory ===

// 基本訂單
const order = orderFactory.build({
  relations: {
    restaurantId: 1,
    tableId: 5,
    customerId: 10,
  },
});

// 特定狀態訂單
const pending = orderFactory.buildPending();
const inProgress = orderFactory.buildInProgress();
const completed = orderFactory.buildCompleted();

// 特定類型訂單
const takeaway = orderFactory.buildTakeaway();
const delivery = orderFactory.buildDelivery();

// === OrderItem Factory ===

// 為訂單生成項目
const items = orderItemFactory.buildForOrder(orderId, 3);

// 特定狀態項目
const prepared = orderItemFactory.buildPrepared();
const served = orderItemFactory.buildServed();
```

---

## 🚀 完整測試環境生成

```typescript
// 一鍵生成完整測試數據
const testData = buildCompleteRestaurantData({
  enableShopMode: true,
  categoryCount: 10, // 預設 10
  menuItemsPerCategory: 5, // 預設 5
  orderCount: 20, // 預設 10
});

// 包含的數據:
testData.restaurant; // 餐廳
testData.team.owner; // 店主
testData.team.chefs; // 廚師 (2位)
testData.team.serviceCrews; // 服務員 (3位)
testData.team.cashiers; // 收銀員 (2位)
testData.categories; // 分類 (10個)
testData.menuItems; // 菜單項目 (50個)
testData.orders; // 訂單 (20筆)
testData.orderItems; // 訂單項目
testData.customers; // 顧客 (20位)
testData.summary; // 數據摘要統計
```

---

## 🔄 序列號管理

```typescript
// 在每個測試前重置序列號
beforeEach(() => {
  resetAllFactories();
});

// 手動重置單個工廠
userFactory.resetSequence();
orderFactory.resetSequence();

// 序列號的作用
const user1 = userFactory.build(); // id: 1
const user2 = userFactory.build(); // id: 2
resetAllFactories();
const user3 = userFactory.build(); // id: 1 (重置後)
```

---

## 🎨 高級用法

### 覆寫預設值

```typescript
const user = userFactory.build({
  overrides: {
    username: "custom_user",
    email: "custom@test.com",
    role: UserRoles.ADMIN,
    isActive: false,
  },
});
```

### 指定序列號

```typescript
const user = userFactory.build({
  sequence: 100, // 強制使用序列號 100
});
// user.id === 101
```

### 建立關聯數據

```typescript
// 正確的方式：使用 relations
const order = orderFactory.build({
  relations: {
    restaurantId: restaurant.id!,
    customerId: customer.id!,
    tableId: table.id!,
  },
});

// ❌ 錯誤：不要用 overrides 設置關聯
const order = orderFactory.build({
  overrides: {
    restaurantId: restaurant.id, // 不推薦
  },
});
```

---

## 🛠️ 工具函數速查

```typescript
// 隨機字串
randomString(8, "prefix_"); // 'prefix_abc12345'

// 隨機數字
randomNumber(1, 100); // 1-100

// 隨機選擇
randomChoice(["A", "B", "C"]); // 'B'

// 隨機布林值
randomBoolean(0.7); // 70% 機率 true

// 隨機日期
randomDate();

// 隨機電話 (台灣格式)
randomPhone(); // '0912345678'

// 隨機 Email
randomEmail("test.com"); // 'user_abc123@test.com'

// UUID
randomUUID();

// 時間戳
currentTimestamp();
pastTimestamp(7); // 7天前
futureTimestamp(7); // 7天後
```

---

## ✅ 最佳實踐

### 1. 每個測試前重置

```typescript
beforeEach(() => {
  resetAllFactories();
});
```

### 2. 使用常量而非魔術數字

```typescript
// ✅ 好
const admin = userFactory.build({
  overrides: { role: UserRoles.ADMIN },
});

// ❌ 不好
const admin = userFactory.build({
  overrides: { role: 0 },
});
```

### 3. 優先使用專用方法

```typescript
// ✅ 好
const admin = userFactory.buildAdmin();

// ❌ 不好（手動設置所有字段）
const admin = userFactory.build({
  overrides: {
    role: UserRoles.ADMIN,
    fullName: "管理員",
    // ... 其他字段
  },
});
```

### 4. 利用關聯關係

```typescript
// ✅ 好（確保數據關聯正確）
const restaurant = restaurantFactory.build();
const menuItem = menuItemFactory.build({
  relations: {
    restaurantId: restaurant.id!,
    categoryId: category.id!,
  },
});
```

---

## 🚨 常見錯誤

### ❌ 忘記重置序列號

```typescript
// 問題：ID 會持續累加
it("test 1", () => {
  const user = userFactory.build(); // id: 1
});
it("test 2", () => {
  const user = userFactory.build(); // id: 2 (應該是 1)
});

// ✅ 解決：使用 beforeEach
beforeEach(() => {
  resetAllFactories();
});
```

### ❌ 使用 overrides 設置關聯

```typescript
// ❌ 不好
const order = orderFactory.build({
  overrides: { restaurantId: 1 },
});

// ✅ 好
const order = orderFactory.build({
  relations: { restaurantId: 1 },
});
```

### ❌ 不檢查 undefined

```typescript
// ❌ 危險
const restaurant = restaurantFactory.build();
const menu = menuItemFactory.build({
  relations: {
    restaurantId: restaurant.id, // 可能是 undefined
  },
});

// ✅ 安全
const restaurant = restaurantFactory.build();
const menu = menuItemFactory.build({
  relations: {
    restaurantId: restaurant.id!, // 使用 ! 斷言
  },
});
```

---

## 📝 完整測試範例

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
  userFactory,
  orderFactory,
  resetAllFactories,
  UserRoles,
} from "@makanmakan/testing-utils";

describe("Order Service", () => {
  beforeEach(() => {
    resetAllFactories();
  });

  it("should create order for customer", async () => {
    // 準備測試數據
    const customer = userFactory.buildCustomer();
    const order = orderFactory.build({
      relations: {
        restaurantId: 1,
        customerId: customer.id!,
      },
    });

    // 執行測試邏輯
    const result = await orderService.create(order);

    // 驗證結果
    expect(result.id).toBeDefined();
    expect(result.customerId).toBe(customer.id);
    expect(result.status).toBe("pending");
  });

  it("should handle multiple orders", async () => {
    // 使用 buildList 生成多筆數據
    const orders = orderFactory.buildList(5, {
      relations: { restaurantId: 1 },
    });

    expect(orders).toHaveLength(5);
    expect(orders[0].id).toBe(1);
    expect(orders[4].id).toBe(5);
  });
});
```

---

## 🔗 相關資源

- **完整文檔**: `packages/testing-utils/README.md`
- **測試指南**: `docs/testing/TESTING_GUIDE.md`
- **API 參考**: `packages/testing-utils/src/factories/`
- **範例代碼**: `docs/testing/examples/`

---

## 💡 快速提示

| 場景         | 使用方法                              |
| ------------ | ------------------------------------- |
| 單元測試     | 使用單個 factory                      |
| 整合測試     | 使用 `buildCompleteRestaurantData()`  |
| 特定角色測試 | 使用 `buildAdmin()`, `buildChef()` 等 |
| 關聯數據     | 使用 `relations` 參數                 |
| 自訂數據     | 使用 `overrides` 參數                 |
| 批量數據     | 使用 `buildList()`                    |

---

**最後更新**: 2025-11-15
**版本**: 1.0.0
**需要幫助？** 查看 [FAQ](./FACTORY_FAQ.md) 或聯繫 Factory Champions

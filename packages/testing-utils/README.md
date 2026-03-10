# @makanmakan/testing-utils

統一的測試數據工廠和測試工具,用於 MakanMakan 平台的所有測試場景。

## 📦 安裝

```bash
# 在測試文件中引入
import {
  userFactory,
  restaurantFactory,
  menuItemFactory,
  orderFactory,
  buildCompleteRestaurantData
} from '@makanmakan/testing-utils'
```

## 🎯 核心概念

### Factory Pattern

所有工廠都繼承自 `BaseFactory`,提供統一的 API:

```typescript
// 生成單筆數據
const user = userFactory.build();

// 生成多筆數據
const users = userFactory.buildList(10);

// 覆寫預設值
const admin = userFactory.build({
  overrides: {
    role: UserRoles.ADMIN,
    fullName: "自訂管理員",
  },
});

// 重置序列號
userFactory.resetSequence();
```

## 🏭 可用工廠

### 1. User Factory

生成用戶測試數據。

**基本使用**:

```typescript
import { userFactory, UserRoles } from "@makanmakan/testing-utils";

// 生成隨機用戶
const user = userFactory.build();

// 生成特定角色的用戶
const admin = userFactory.buildAdmin();
const owner = userFactory.buildShopOwner(restaurantId);
const chef = userFactory.buildChef(restaurantId);
const serviceCrew = userFactory.buildServiceCrew(restaurantId);
const cashier = userFactory.buildCashier(restaurantId);
const customer = userFactory.buildCustomer();

// 生成完整的餐廳團隊
const team = userFactory.buildRestaurantTeam(restaurantId);
// {
//   owner: UserTestData,
//   chefs: UserTestData[],
//   serviceCrews: UserTestData[],
//   cashiers: UserTestData[]
// }
```

**用戶角色**:

```typescript
UserRoles.ADMIN; // 0 - 系統管理員
UserRoles.SHOP_OWNER; // 1 - 店主
UserRoles.CHEF; // 2 - 廚師
UserRoles.SERVICE_CREW; // 3 - 服務員
UserRoles.CASHIER; // 4 - 收銀員
UserRoles.CUSTOMER; // 5 - 顧客
```

---

### 2. Restaurant Factory

生成餐廳測試數據。

**基本使用**:

```typescript
import { restaurantFactory, RestaurantTypes } from "@makanmakan/testing-utils";

// 生成隨機餐廳
const restaurant = restaurantFactory.build();

// 生成啟用 Shop QR 的餐廳
const shopModeRestaurant = restaurantFactory.buildWithShopMode();

// 生成特定類型的餐廳
const fastFood = restaurantFactory.buildFastFood();
const fineDining = restaurantFactory.buildFineDining();
const cafe = restaurantFactory.buildCafe();
```

**餐廳類型**:

```typescript
RestaurantTypes.DINE_IN; // 內用
RestaurantTypes.TAKEAWAY; // 外帶
RestaurantTypes.DELIVERY; // 外送
RestaurantTypes.ALL; // 全部
```

---

### 3. Menu Factories

生成菜單分類和菜單項目。

**Category Factory**:

```typescript
import { categoryFactory } from "@makanmakan/testing-utils";

// 生成單個分類
const category = categoryFactory.build({
  relations: { restaurantId: 1 },
});

// 生成完整的餐廳分類集合 (10 個分類)
const categories = categoryFactory.buildRestaurantCategories(restaurantId);
```

**MenuItem Factory**:

```typescript
import { menuItemFactory } from "@makanmakan/testing-utils";

// 生成單個菜單項目
const menuItem = menuItemFactory.build({
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

// 生成特殊類型的菜品
const popularItem = menuItemFactory.buildPopular();
const saleItem = menuItemFactory.buildOnSale();
const vegetarianItem = menuItemFactory.buildVegetarian();
```

---

### 4. Order Factories

生成訂單和訂單項目。

**Order Factory**:

```typescript
import {
  orderFactory,
  OrderStatus,
  OrderType,
} from "@makanmakan/testing-utils";

// 生成隨機訂單
const order = orderFactory.build({
  relations: {
    restaurantId: 1,
    tableId: 5,
    customerId: 10,
  },
});

// 生成特定狀態的訂單
const pendingOrder = orderFactory.buildPending();
const inProgressOrder = orderFactory.buildInProgress();
const completedOrder = orderFactory.buildCompleted();

// 生成特定類型的訂單
const takeawayOrder = orderFactory.buildTakeaway();
const deliveryOrder = orderFactory.buildDelivery();
```

**OrderItem Factory**:

```typescript
import { orderItemFactory } from "@makanmakan/testing-utils";

// 為訂單生成項目
const items = orderItemFactory.buildForOrder(orderId, 3);

// 生成特定狀態的項目
const preparedItem = orderItemFactory.buildPrepared();
const servedItem = orderItemFactory.buildServed();
```

---

## 🚀 快速生成完整數據

使用 `buildCompleteRestaurantData()` 一次生成完整的測試環境:

```typescript
import { buildCompleteRestaurantData } from "@makanmakan/testing-utils";

const testData = buildCompleteRestaurantData({
  enableShopMode: true, // 是否啟用 Shop QR 模式
  categoryCount: 10, // 分類數量 (預設: 10)
  menuItemsPerCategory: 5, // 每個分類的菜品數量 (預設: 5)
  orderCount: 20, // 訂單數量 (預設: 10)
});

// testData 包含:
// - restaurant: 餐廳數據
// - team: 員工團隊 (owner, chefs, serviceCrews, cashiers, all)
// - categories: 分類列表
// - menuItems: 菜單項目列表
// - orders: 訂單列表
// - orderItems: 訂單項目列表
// - customers: 顧客列表
// - summary: 數據摘要統計
```

## 🛠️ 輔助函數

```typescript
import {
  randomString,
  randomNumber,
  randomChoice,
  randomBoolean,
  randomDate,
  randomPhone,
  randomEmail,
  randomUUID,
  currentTimestamp,
  pastTimestamp,
  futureTimestamp,
} from "@makanmakan/testing-utils";

// 生成隨機字串
const str = randomString(8, "prefix_"); // 'prefix_abc12345'

// 生成隨機數字
const num = randomNumber(1, 100); // 1-100 之間的隨機數

// 從陣列隨機選擇
const item = randomChoice(["A", "B", "C"]);

// 生成隨機布林值
const bool = randomBoolean(0.7); // 70% 機率為 true

// 生成隨機日期
const date = randomDate();

// 生成隨機電話 (台灣格式)
const phone = randomPhone(); // '0912345678'

// 生成隨機 Email
const email = randomEmail("test.com"); // 'user_abc123@test.com'

// 生成 UUID
const uuid = randomUUID();

// 時間戳相關
const now = currentTimestamp();
const past = pastTimestamp(7); // 7 天前
const future = futureTimestamp(7); // 7 天後
```

## 📝 測試範例

### 範例 1: 單元測試

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { userFactory, UserRoles } from "@makanmakan/testing-utils";

describe("User Service", () => {
  beforeEach(() => {
    userFactory.resetSequence();
  });

  it("should create an admin user", () => {
    const admin = userFactory.buildAdmin();

    expect(admin.role).toBe(UserRoles.ADMIN);
    expect(admin.isActive).toBe(true);
  });

  it("should create multiple customers", () => {
    const customers = userFactory.buildList(5, {
      overrides: { role: UserRoles.CUSTOMER },
    });

    expect(customers).toHaveLength(5);
    expect(customers.every((c) => c.role === UserRoles.CUSTOMER)).toBe(true);
  });
});
```

### 範例 2: 整合測試

```typescript
import { describe, it, beforeEach } from "vitest";
import {
  buildCompleteRestaurantData,
  resetAllFactories,
} from "@makanmakan/testing-utils";

describe("Restaurant Integration Tests", () => {
  let testData: ReturnType<typeof buildCompleteRestaurantData>;

  beforeEach(() => {
    resetAllFactories();
    testData = buildCompleteRestaurantData({
      menuItemsPerCategory: 3,
      orderCount: 5,
    });
  });

  it("should have complete restaurant data", () => {
    expect(testData.restaurant).toBeDefined();
    expect(testData.team.owner).toBeDefined();
    expect(testData.categories).toHaveLength(10);
    expect(testData.menuItems).toHaveLength(30); // 10 categories * 3 items
    expect(testData.orders).toHaveLength(5);
  });
});
```

### 範例 3: API 測試

```typescript
import { describe, it } from "vitest";
import { userFactory, orderFactory } from "@makanmakan/testing-utils";

describe("Order API", () => {
  it("should create order for authenticated user", async () => {
    // 創建測試用戶
    const customer = userFactory.buildCustomer();

    // 創建測試訂單
    const orderData = orderFactory.build({
      relations: {
        restaurantId: 1,
        customerId: customer.id!,
      },
    });

    // 呼叫 API
    const response = await api.post("/orders", orderData);

    expect(response.status).toBe(201);
  });
});
```

## 🎨 最佳實踐

### 1. 在測試前重置序列

```typescript
beforeEach(() => {
  resetAllFactories();
});
```

### 2. 使用有意義的覆寫

```typescript
// ❌ 不好: 魔術數字
const user = userFactory.build({ overrides: { role: 1 } });

// ✅ 好: 使用常量
const user = userFactory.build({ overrides: { role: UserRoles.SHOP_OWNER } });
```

### 3. 利用關聯關係

```typescript
// 確保數據關聯正確
const restaurant = restaurantFactory.build();
const menuItem = menuItemFactory.build({
  relations: {
    restaurantId: restaurant.id!,
    categoryId: 1,
  },
});
```

### 4. 為特定場景使用專用方法

```typescript
// ❌ 不好: 手動設定所有字段
const admin = userFactory.build({
  overrides: {
    role: 0,
    fullName: "管理員",
    // ... 其他字段
  },
});

// ✅ 好: 使用專用方法
const admin = userFactory.buildAdmin();
```

## 📊 數據統計

使用 `buildCompleteRestaurantData()` 預設生成:

- 1 間餐廳
- 8 名員工 (1 店主 + 2 廚師 + 3 服務員 + 2 收銀員)
- 10 個分類
- 50 個菜單項目 (每個分類 5 項)
- 10 筆訂單
- 30 個訂單項目 (每筆訂單 3 項)
- 20 位顧客

## 🔄 版本歷史

### v1.0.0 (2025-11-15)

- ✅ 初始版本
- ✅ 實現 User Factory
- ✅ 實現 Restaurant Factory
- ✅ 實現 Menu Factories (Category + MenuItem)
- ✅ 實現 Order Factories (Order + OrderItem)
- ✅ 提供完整數據生成工具

## 📄 授權

MIT License - MakanMakan Platform

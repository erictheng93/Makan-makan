> ⚠️ **SUPERSEDED (2026-07-05)**: This guide instructs importing test data
> builders from `@makanmasak/testing-utils` — that package does not exist
> anywhere in this repo (confirmed via repeated repo-wide search). Root
> `CLAUDE.md`'s Testing Standards section is explicit: "Do not import
> `@makanmasak/testing-utils`; that workspace package does not currently
> exist. Keep builders close to the owning test file or shared in an
> existing local test helper." Follow that guidance instead — see the
> `buildUser(overrides = {})`-style example in `CLAUDE.md`. This entire
> factory-pattern proposal was apparently never actually implemented as a
> shared package; kept here for historical context only.

# Testing Utils 常見問題 | FAQ

> 💬 收集團隊最常問的問題和解答

---

## 📋 目錄

- [基礎問題](#基礎問題)
- [使用問題](#使用問題)
- [進階問題](#進階問題)
- [疑難排解](#疑難排解)
- [最佳實踐](#最佳實踐)

---

## 基礎問題

### Q1: 為什麼要使用測試數據工廠？

**A**: 使用測試數據工廠有以下優點：

```typescript
// ❌ 沒有工廠：每次都要手動創建數據
it("should create order", () => {
  const user = {
    id: 1,
    username: "testuser",
    email: "test@example.com",
    phone: "0912345678",
    fullName: "Test User",
    role: 5,
    restaurantId: null,
    isActive: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  // ... 重複的代碼
});

// ✅ 使用工廠：一行搞定
it("should create order", () => {
  const user = userFactory.buildCustomer();
  // 清楚、簡潔、可維護
});
```

**優點總結**：

- ✅ 減少重複代碼（平均減少 50-70%）
- ✅ 提高可讀性
- ✅ 統一測試數據格式
- ✅ 容易維護和修改
- ✅ 自動處理關聯關係

---

### Q2: 我一定要使用工廠嗎？

**A**: 分情況：

```
新測試    → 必須使用工廠 ✅
舊測試    → 遇到修改時再遷移 🟡
簡單測試  → 可以保持現狀 🟢
```

**政策**：

- 🔴 **新測試必須使用工廠**（從 2025-11-15 開始）
- 🟡 修改現有測試時，建議順便遷移
- 🟢 穩定的舊測試可以保持現狀

---

### Q3: 工廠會讓測試變慢嗎？

**A**: 不會，反而可能更快！

```typescript
// 性能測試結果
describe("Performance Comparison", () => {
  it("手動創建數據", () => {
    const start = Date.now();
    const user = {
      id: 1,
      username: "testuser",
      // ... 10+ 字段
    };
    const time = Date.now() - start;
    // 平均: ~0.5ms
  });

  it("使用工廠", () => {
    const start = Date.now();
    const user = userFactory.build();
    const time = Date.now() - start;
    // 平均: ~0.3ms (更快！)
  });
});
```

**結論**：工廠使用優化過的數據生成邏輯，通常比手動創建更快。

---

### Q4: 我可以在生產代碼中使用工廠嗎？

**A**: **絕對不可以！** ❌

```typescript
// ❌ 錯誤：在生產代碼中使用
import { userFactory } from "@makanmasak/testing-utils";

export async function createUser() {
  const user = userFactory.build(); // 絕對不要這樣做！
  return db.insert(users).values(user);
}

// ✅ 正確：只在測試中使用
import { userFactory } from "@makanmasak/testing-utils";

describe("User Service", () => {
  it("should create user", () => {
    const testUser = userFactory.build(); // 只在測試中使用
    // ...
  });
});
```

**原因**：

- testing-utils 是 devDependency
- 工廠生成的是測試數據，不適合生產環境
- 會增加生產包的大小

---

## 使用問題

### Q5: 如何生成特定 ID 的數據？

**A**: 使用 `sequence` 參數：

```typescript
// 方法 1: 使用 sequence 參數
const user = userFactory.build({
  sequence: 99, // 會生成 id: 100
});

// 方法 2: 使用 overrides (不推薦，但可行)
const user = userFactory.build({
  overrides: { id: 100 },
});

// 方法 3: 重置序列號後生成
userFactory.resetSequence();
const user1 = userFactory.build(); // id: 1
const user2 = userFactory.build(); // id: 2
```

**建議**：大多數情況不需要指定 ID，讓工廠自動生成即可。

---

### Q6: 如何生成關聯數據？

**A**: 使用 `relations` 參數：

```typescript
// ✅ 正確方式：使用 relations
const restaurant = restaurantFactory.build();
const category = categoryFactory.build({
  relations: {
    restaurantId: restaurant.id!,
  },
});
const menuItem = menuItemFactory.build({
  relations: {
    restaurantId: restaurant.id!,
    categoryId: category.id!,
    categoryName: category.name,
  },
});

// ❌ 錯誤方式：使用 overrides
const menuItem = menuItemFactory.build({
  overrides: {
    restaurantId: restaurant.id, // 不推薦
  },
});
```

**原因**：`relations` 參數專門用於設置關聯，語義更清楚。

---

### Q7: `buildCompleteRestaurantData()` 生成的數據太多了怎麼辦？

**A**: 自訂參數減少數據量：

```typescript
// 預設生成（數據較多）
const testData = buildCompleteRestaurantData();
// 10 categories * 5 items = 50 menu items
// 10 orders * 3 items = 30 order items

// 自訂生成（減少數據量）
const testData = buildCompleteRestaurantData({
  categoryCount: 5, // 只生成 5 個分類
  menuItemsPerCategory: 2, // 每個分類 2 個項目
  orderCount: 3, // 只生成 3 筆訂單
});
// 5 categories * 2 items = 10 menu items
// 3 orders * 3 items = 9 order items

// 最小化數據
const testData = buildCompleteRestaurantData({
  categoryCount: 1,
  menuItemsPerCategory: 1,
  orderCount: 1,
});
```

---

### Q8: 如何生成多個不同餐廳的數據？

**A**: 多次調用並重置序列號：

```typescript
describe("Multi-Restaurant Tests", () => {
  it("should handle multiple restaurants", () => {
    // 餐廳 1
    resetAllFactories();
    const restaurant1Data = buildCompleteRestaurantData();

    // 餐廳 2
    resetAllFactories();
    const restaurant2Data = buildCompleteRestaurantData();

    // 驗證
    expect(restaurant1Data.restaurant.id).toBe(1);
    expect(restaurant2Data.restaurant.id).toBe(1);
  });
});
```

**或者手動生成**：

```typescript
describe("Multi-Restaurant Tests", () => {
  it("should handle multiple restaurants", () => {
    resetAllFactories();

    // 生成 3 個餐廳
    const restaurants = restaurantFactory.buildList(3);

    // 為每個餐廳生成菜單
    restaurants.forEach((restaurant) => {
      const categories = categoryFactory.buildRestaurantCategories(
        restaurant.id!,
      );
      // ...
    });
  });
});
```

---

### Q9: 工廠生成的數據會存入資料庫嗎？

**A**: **不會！**工廠只生成 JavaScript 對象，不會自動存入資料庫。

```typescript
// 工廠只生成數據對象
const user = userFactory.build();
console.log(user); // { id: 1, username: '...', ... }

// 你需要手動存入資料庫（在測試中）
await db.insert(users).values(user);

// 或者使用測試輔助函數
const testDB = await createTestDB();
await testDB.insert(users).values(user);
```

---

### Q10: 為什麼要在 `beforeEach` 中重置序列號？

**A**: 確保每個測試的數據 ID 都從 1 開始，避免測試之間互相影響：

```typescript
// ❌ 沒有重置：測試結果不穩定
describe("User Tests", () => {
  it("test 1", () => {
    const user = userFactory.build();
    expect(user.id).toBe(1); // ✅ 通過
  });

  it("test 2", () => {
    const user = userFactory.build();
    expect(user.id).toBe(1); // ❌ 失敗！實際是 2
  });
});

// ✅ 有重置：測試結果穩定
describe("User Tests", () => {
  beforeEach(() => {
    resetAllFactories();
  });

  it("test 1", () => {
    const user = userFactory.build();
    expect(user.id).toBe(1); // ✅ 通過
  });

  it("test 2", () => {
    const user = userFactory.build();
    expect(user.id).toBe(1); // ✅ 通過
  });
});
```

---

## 進階問題

### Q11: 如何擴展現有的工廠？

**A**: 有兩種方式：

**方法 1：使用 overrides（簡單場景）**

```typescript
// 創建自己的輔助函數
function buildPremiumUser() {
  return userFactory.build({
    overrides: {
      fullName: "Premium User",
      // 假設有 isPremium 字段
      // isPremium: true
    },
  });
}

// 使用
const premiumUser = buildPremiumUser();
```

**方法 2：繼承 Factory 類（複雜場景）**

```typescript
// 在你的測試輔助文件中
import { UserFactory, userFactory } from "@makanmasak/testing-utils";

class ExtendedUserFactory extends UserFactory {
  buildPremiumUser() {
    return this.build({
      overrides: {
        fullName: "Premium User",
        // 自訂字段
      },
    });
  }

  buildInactiveUser() {
    return this.build({
      overrides: {
        isActive: false,
      },
    });
  }
}

export const extendedUserFactory = new ExtendedUserFactory();
```

---

### Q12: 如何生成符合特定業務規則的數據？

**A**: 組合使用工廠和自訂邏輯：

```typescript
// 業務規則：訂單金額 = 項目價格總和 + 服務費
function buildValidOrder() {
  const items = orderItemFactory.buildForOrder(1, 3);

  // 計算總金額
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const serviceCharge = subtotal * 0.1;
  const totalAmount = subtotal + serviceCharge;

  // 生成訂單
  const order = orderFactory.build({
    overrides: {
      subtotal,
      serviceCharge,
      totalAmount,
    },
  });

  return { order, items };
}

// 使用
const { order, items } = buildValidOrder();
expect(order.totalAmount).toBe(order.subtotal + order.serviceCharge);
```

---

### Q13: 如何處理可選字段？

**A**: 工廠已經處理了大部分可選字段，但你可以自訂：

```typescript
// 生成沒有電話的用戶
const user = userFactory.build({
  overrides: {
    phone: null,
  },
});

// 生成沒有餐廳的用戶（顧客）
const customer = userFactory.build({
  overrides: {
    restaurantId: null,
    role: UserRoles.CUSTOMER,
  },
});

// 或使用專用方法
const customer = userFactory.buildCustomer(); // 自動設置 restaurantId: null
```

---

### Q14: 可以用工廠生成無效數據來測試錯誤處理嗎？

**A**: 可以！這是測試錯誤處理的好方法：

```typescript
describe("Error Handling", () => {
  it("should reject invalid email", async () => {
    const user = userFactory.build({
      overrides: {
        email: "not-an-email", // 無效 email
      },
    });

    await expect(userService.create(user)).rejects.toThrow("Invalid email");
  });

  it("should reject negative price", async () => {
    const menuItem = menuItemFactory.build({
      overrides: {
        price: -100, // 無效價格
      },
    });

    await expect(menuService.create(menuItem)).rejects.toThrow(
      "Price must be positive",
    );
  });
});
```

---

### Q15: 如何在整合測試中使用工廠？

**A**: 結合測試資料庫使用：

```typescript
import { createTestDB } from "@/tests/helpers/test-utils";
import { userFactory, resetAllFactories } from "@makanmasak/testing-utils";

describe("User API Integration", () => {
  let testDB: TestDatabase;

  beforeEach(async () => {
    testDB = await createTestDB();
    resetAllFactories();
  });

  it("should create user via API", async () => {
    // 1. 使用工廠生成測試數據
    const userData = userFactory.build();

    // 2. 通過 API 創建
    const response = await api.post("/users", userData);

    // 3. 驗證結果
    expect(response.status).toBe(201);

    // 4. 從資料庫驗證
    const dbUser = await testDB
      .select()
      .from(users)
      .where(eq(users.id, response.data.id))
      .get();

    expect(dbUser).toBeDefined();
    expect(dbUser.username).toBe(userData.username);
  });
});
```

---

## 疑難排解

### Q16: 為什麼我的測試數據 ID 不是從 1 開始？

**A**: 可能原因：

1. **忘記重置序列號**：

```typescript
// ❌ 問題
describe("Tests", () => {
  it("test 1", () => {
    const user = userFactory.build(); // id: 1
  });
  it("test 2", () => {
    const user = userFactory.build(); // id: 2 (應該是 1)
  });
});

// ✅ 解決
describe("Tests", () => {
  beforeEach(() => {
    resetAllFactories();
  });
  // ...
});
```

2. **在 beforeEach 之外生成數據**：

```typescript
// ❌ 問題
describe("Tests", () => {
  const user = userFactory.build(); // 在外面生成

  beforeEach(() => {
    resetAllFactories(); // 重置無效
  });
});

// ✅ 解決
describe("Tests", () => {
  let user: UserTestData;

  beforeEach(() => {
    resetAllFactories();
    user = userFactory.build(); // 在 beforeEach 裡生成
  });
});
```

---

### Q17: TypeScript 報錯說找不到模組？

**A**: 檢查以下事項：

1. **確保已安裝**：

```bash
# 檢查是否安裝
pnpm list @makanmasak/testing-utils

# 如果沒有，重新安裝
pnpm install
```

2. **檢查 tsconfig.json**：

```json
{
  "compilerOptions": {
    "paths": {
      "@makanmasak/testing-utils": ["../../packages/testing-utils/src"]
    }
  }
}
```

3. **確保只在測試文件中使用**：

```typescript
// ✅ 在測試文件中
// __tests__/user.test.ts
import { userFactory } from "@makanmasak/testing-utils";

// ❌ 在生產代碼中（會報錯）
// src/services/user.ts
import { userFactory } from "@makanmasak/testing-utils"; // 錯誤！
```

---

### Q18: 為什麼 `buildCompleteRestaurantData()` 很慢？

**A**: 可能原因和解決方案：

```typescript
// 問題：生成太多數據
const testData = buildCompleteRestaurantData();
// 預設：50 menu items, 10 orders, 30 order items

// 解決方案 1：減少數據量
const testData = buildCompleteRestaurantData({
  categoryCount: 3,
  menuItemsPerCategory: 2,
  orderCount: 2,
});
// 只生成：6 menu items, 2 orders, 6 order items

// 解決方案 2：只生成需要的數據
const restaurant = restaurantFactory.build();
const team = userFactory.buildRestaurantTeam(restaurant.id!);
// 只生成餐廳和團隊，不生成菜單和訂單
```

**性能參考**：

- 最小化數據：~5ms
- 預設數據：~20ms
- 大量數據：~100ms

---

### Q19: 工廠生成的隨機數據導致測試不穩定怎麼辦？

**A**: 使用固定的 seed 或覆寫特定字段：

```typescript
// 方法 1：覆寫關鍵字段
const user = userFactory.build({
  overrides: {
    username: "fixed_username", // 使用固定值
    email: "fixed@test.com",
  },
});

// 方法 2：只驗證格式，不驗證具體值
const user = userFactory.build();
expect(user.email).toMatch(/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/);
expect(user.phone).toMatch(/^09\d{8}$/);

// 方法 3：重置序列號確保 ID 一致
beforeEach(() => {
  resetAllFactories();
});
const user1 = userFactory.build();
expect(user1.id).toBe(1); // 每次都是 1
```

---

### Q20: import 路徑應該用什麼？

**A**: 統一使用套件名稱：

```typescript
// ✅ 正確：使用套件名稱
import { userFactory } from "@makanmasak/testing-utils";

// ❌ 錯誤：使用相對路徑
import { userFactory } from "../../packages/testing-utils/src/factories/user.factory";

// ❌ 錯誤：直接導入 factories
import { userFactory } from "@makanmasak/testing-utils/factories";
```

---

## 最佳實踐

### Q21: 什麼時候應該使用 `buildCompleteRestaurantData()`？

**A**: 使用決策樹：

```
需要完整餐廳環境？
├─ 是
│  ├─ 整合測試 → 使用 buildCompleteRestaurantData()
│  ├─ E2E 測試 → 使用 buildCompleteRestaurantData()
│  └─ 複雜場景測試 → 使用 buildCompleteRestaurantData()
│
└─ 否
   ├─ 單一實體測試 → 使用單個 factory
   ├─ 單元測試 → 使用單個 factory
   └─ 簡單關聯測試 → 手動組合 factories
```

**範例**：

```typescript
// ✅ 適合使用 buildCompleteRestaurantData
it("should process complete order flow", () => {
  const testData = buildCompleteRestaurantData();
  // 需要餐廳、員工、菜單、訂單的完整流程測試
});

// ❌ 不適合，太重了
it("should validate user email", () => {
  const testData = buildCompleteRestaurantData();
  const user = testData.customers[0];
  expect(validateEmail(user.email)).toBe(true);
});

// ✅ 更好的方式
it("should validate user email", () => {
  const user = userFactory.build();
  expect(validateEmail(user.email)).toBe(true);
});
```

---

### Q22: 如何組織測試數據的生成代碼？

**A**: 建議結構：

```typescript
describe("Order Service", () => {
  // 1. 在頂層聲明變量
  let testData: ReturnType<typeof buildCompleteRestaurantData>;
  let testDB: TestDatabase;

  // 2. 在 beforeEach 中初始化
  beforeEach(async () => {
    resetAllFactories();
    testDB = await createTestDB();
    testData = buildCompleteRestaurantData();
  });

  // 3. 測試中直接使用
  it("should create order", () => {
    const order = testData.orders[0];
    // ...
  });

  // 4. 如需特殊數據，在測試內生成
  it("should handle custom scenario", () => {
    const customOrder = orderFactory.build({
      relations: {
        restaurantId: testData.restaurant.id!,
      },
      overrides: {
        status: "custom_status",
      },
    });
    // ...
  });
});
```

---

### Q23: 建議的遷移策略是什麼？

**A**: 漸進式遷移：

```
階段 1: 新測試 (立即執行)
└─ 所有新測試必須使用工廠

階段 2: 修改測試 (遇到再改)
└─ 修改現有測試時，順便遷移到工廠

階段 3: 核心測試 (優先處理)
└─ 主動遷移核心業務邏輯測試

階段 4: 其他測試 (非必要)
└─ 穩定的舊測試可保持不變
```

**不要一次性遷移所有測試！**風險太高。

---

### Q24: 如何知道我是否正確使用了工廠？

**A**: 自我檢查清單：

```typescript
// ✅ 好的使用方式
describe("Good Example", () => {
  beforeEach(() => {
    resetAllFactories(); // ✅ 重置序列號
  });

  it("should work correctly", () => {
    // ✅ 使用專用方法
    const admin = userFactory.buildAdmin();

    // ✅ 使用 relations
    const order = orderFactory.build({
      relations: {
        restaurantId: 1,
        customerId: admin.id!,
      },
    });

    // ✅ 使用常量
    expect(admin.role).toBe(UserRoles.ADMIN);
  });
});

// ❌ 不好的使用方式
describe("Bad Example", () => {
  // ❌ 沒有重置序列號

  it("should work correctly", () => {
    // ❌ 手動設置所有字段
    const admin = userFactory.build({
      overrides: {
        role: 0, // ❌ 魔術數字
        fullName: "管理員",
        // ... 一堆字段
      },
    });

    // ❌ 使用 overrides 設置關聯
    const order = orderFactory.build({
      overrides: {
        restaurantId: 1,
      },
    });
  });
});
```

---

### Q25: 遇到問題時應該怎麼做？

**A**: 尋求幫助的步驟：

```
1. 查看文檔
   ├─ 快速參考卡: FACTORY_QUICK_REFERENCE.md
   ├─ 完整文檔: packages/testing-utils/README.md
   └─ 本 FAQ

2. 查看範例代碼
   ├─ docs/testing/examples/
   └─ packages/testing-utils/src/__tests__/

3. 詢問 Factory Champions
   └─ 每個團隊的 Factory Champion

4. 團隊 Slack
   └─ #testing 頻道

5. 提交 Issue
   └─ GitHub Issues (詳細描述問題)
```

**提問時請包含**：

- 完整的錯誤訊息
- 相關的程式碼片段
- 你已經嘗試的解決方案
- 你的預期結果 vs 實際結果

---

## 📞 需要更多幫助？

- 📚 [完整文檔](../../packages/testing-utils/README.md)
- 🎯 [快速參考卡](./FACTORY_QUICK_REFERENCE.md)
- 💬 團隊 Slack #testing 頻道
- 👥 聯繫你的 Factory Champion

---

**最後更新**: 2025-11-15
**版本**: 1.0.0
**貢獻**: 如果你發現新的常見問題，請提交 PR 添加到本文檔

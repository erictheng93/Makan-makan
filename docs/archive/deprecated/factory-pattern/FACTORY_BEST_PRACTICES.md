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

# Factory 測試數據最佳實踐指南

> 📚 **版本**: 1.0
> 📅 **發布日期**: 2025-11-15
> 👥 **目標讀者**: 所有開發人員
> 🎯 **目的**: 提供清晰、可操作的 Factory 使用指南

---

## 📖 目錄

1. [快速開始](#快速開始)
2. [核心原則](#核心原則)
3. [使用模式](#使用模式)
4. [常見場景](#常見場景)
5. [避免陷阱](#避免陷阱)
6. [問題排查](#問題排查)
7. [參考資源](#參考資源)

---

## 🚀 快速開始

### 第一次使用 Factory？

**3 步驟開始：**

```typescript
// 1️⃣ 導入 factory 和 reset 函數
import { userFactory, resetAllFactories } from "@makanmasak/testing-utils";

// 2️⃣ 在 beforeEach 調用 reset
beforeEach(() => {
  resetAllFactories();
});

// 3️⃣ 使用 factory 創建測試數據
test("example", () => {
  const user = userFactory.buildChef(1);
  expect(user.role).toBe(USER_ROLES.CHEF);
});
```

### 第一次遷移測試？

**簡單替換模式：**

```typescript
// ❌ Before
const user = {
  id: 1,
  username: "testuser",
  role: USER_ROLES.CHEF,
  restaurantId: 1,
};

// ✅ After
const user = userFactory.buildChef(1);
```

---

## 🎯 核心原則

### 原則 1: Factory 用於有效數據

```typescript
// ✅ 正確：使用 factory 創建有效數據
test("can create order", () => {
  const user = userFactory.buildChef(1);
  const order = orderFactory.build({ userId: user.id });
  // ...
});

// ❌ 錯誤：不要用 factory 創建無效數據
test("rejects invalid role", () => {
  const user = userFactory.build({
    overrides: { role: 999 }, // ❌ Factory 不應生成無效數據
  });
  // ...
});

// ✅ 正確：手動創建無效數據用於錯誤測試
test("rejects invalid role", () => {
  const invalidUser = {
    id: 1,
    role: 999, // ✅ 明確表達這是無效數據
    // ... 最小必要字段
  };
  // ...
});
```

**為什麼？**

- Factory 設計用於生成「正常運行路徑」的數據
- 邊界和錯誤測試需要明確的無效數據
- 手動創建讓測試意圖更清晰

---

### 原則 2: 優先使用語義化方法

```typescript
// ✅ 推薦：清晰的語義
const chef = userFactory.buildChef(1);
const owner = userFactory.buildShopOwner(1);
const admin = userFactory.buildAdmin();

// ⚠️ 次選：需要更多配置
const chef = userFactory.build({
  overrides: {
    role: USER_ROLES.CHEF,
    restaurantId: 1,
  },
});
```

**為什麼？**

- 代碼自我解釋
- 減少配置錯誤
- 團隊一致性

---

### 原則 3: 最小化 Overrides

```typescript
// ✅ 好：只覆蓋測試必需的字段
const user = userFactory.buildChef(1, {
  overrides: {
    isActive: false, // 測試非活躍用戶邏輯
  },
});

// ❌ 差：過度覆蓋
const user = userFactory.buildChef(1, {
  overrides: {
    username: "testuser",
    email: "test@example.com",
    fullName: "Test User",
    isActive: false,
    // ... 太多了！
  },
});
```

**為什麼？**

- Factory 提供合理的默認值
- 過度覆蓋失去了 factory 的價值
- 只覆蓋測試關鍵字段

---

### 原則 4: 引用而非硬編碼

```typescript
// ✅ 正確：引用 factory 生成的值
const user = userFactory.buildChef(1);
const profile = { userId: user.id }; // 使用 user.id

// ❌ 錯誤：硬編碼假設的值
const user = userFactory.buildChef(1);
const profile = { userId: 1 }; // ❌ 假設 user.id === 1
```

**為什麼？**

- Factory 管理 ID 序列
- 避免 ID 衝突
- 測試更穩定

---

### 原則 5: 總是 Reset Factories

```typescript
// ✅ 正確：每個測試前 reset
beforeEach(() => {
  resetAllFactories(); // 重置所有 factory 序列
  // ... 其他設置
});

// ❌ 錯誤：忘記 reset
beforeEach(() => {
  // 缺少 resetAllFactories()
});
```

**為什麼？**

- 確保測試獨立性
- ID 序列從 1 開始
- 避免測試間干擾

---

## 📋 使用模式

### 模式 1: 基本實體創建

**使用場景**: 測試單一實體的邏輯

```typescript
test("user has correct role", () => {
  const chef = userFactory.buildChef(1);

  expect(chef.role).toBe(USER_ROLES.CHEF);
  expect(chef.restaurantId).toBe(1);
});
```

**可用方法**:

```typescript
// Users
userFactory.buildAdmin();
userFactory.buildShopOwner(restaurantId);
userFactory.buildChef(restaurantId);
userFactory.buildService(restaurantId);
userFactory.buildCashier(restaurantId);
userFactory.buildCustomer();

// Restaurants
restaurantFactory.build();
restaurantFactory.buildWithMenu();

// Menu Items
menuItemFactory.build();
categoryFactory.build();

// Orders
orderFactory.build();
orderItemFactory.build();
```

---

### 模式 2: 關聯實體創建

**使用場景**: 測試實體間關係

```typescript
test("order belongs to user and restaurant", () => {
  const restaurant = restaurantFactory.build();
  const user = userFactory.buildCustomer();

  const order = orderFactory.build({
    restaurantId: restaurant.id,
    userId: user.id,
  });

  expect(order.restaurantId).toBe(restaurant.id);
  expect(order.userId).toBe(user.id);
});
```

**最佳實踐**:

1. 先創建父實體
2. 使用父實體的 ID 創建子實體
3. 驗證關聯正確

---

### 模式 3: 批量數據創建

**使用場景**: 測試列表、分頁等

```typescript
test("can paginate users", () => {
  // 創建 10 個用戶
  const users = Array.from({ length: 10 }, (_, i) => userFactory.buildChef(1));

  const page1 = users.slice(0, 5);
  const page2 = users.slice(5, 10);

  expect(page1).toHaveLength(5);
  expect(page2).toHaveLength(5);
});
```

**注意事項**:

- 每次調用生成不同的 ID
- 適合測試數量相關邏輯
- 避免創建過多數據（性能）

---

### 模式 4: 自定義字段

**使用場景**: 測試特定狀態或條件

```typescript
test("inactive users cannot login", () => {
  const inactiveUser = userFactory.buildChef(1, {
    overrides: {
      isActive: false, // 關鍵測試條件
    },
  });

  expect(canLogin(inactiveUser)).toBe(false);
});
```

**何時使用 overrides**:

- ✅ 測試特定狀態（active/inactive）
- ✅ 測試邊界值（maxOrders, maxSeats）
- ✅ 測試業務規則（roles, permissions）
- ❌ 不要覆蓋所有字段

---

### 模式 5: 完整數據場景

**使用場景**: 測試複雜業務流程

```typescript
test("complete restaurant setup", () => {
  // 使用便利方法創建完整場景
  const data = buildCompleteRestaurantData();

  expect(data.restaurant).toBeDefined();
  expect(data.owner).toBeDefined();
  expect(data.menu).toHaveLength(10);
  expect(data.tables).toHaveLength(5);
});
```

**可用便利方法**:

```typescript
buildCompleteRestaurantData(); // 餐廳 + 菜單 + 桌位
buildOrderWithItems(); // 訂單 + 訂單項目
buildUserWithOrders(); // 用戶 + 歷史訂單
```

---

## 🎯 常見場景

### 場景 1: 測試用戶權限

```typescript
describe("User Permissions", () => {
  beforeEach(() => {
    resetAllFactories();
  });

  test("admin can manage all users", () => {
    const admin = userFactory.buildAdmin();
    const chef = userFactory.buildChef(1);

    expect(admin.canManage(chef)).toBe(true);
  });

  test("owner can only manage same restaurant", () => {
    const owner = userFactory.buildShopOwner(1);
    const chef1 = userFactory.buildChef(1); // 同餐廳
    const chef2 = userFactory.buildChef(2); // 不同餐廳

    expect(owner.canManage(chef1)).toBe(true);
    expect(owner.canManage(chef2)).toBe(false);
  });
});
```

---

### 場景 2: 測試訂單流程

```typescript
describe("Order Flow", () => {
  beforeEach(() => {
    resetAllFactories();
  });

  test("can create and complete order", () => {
    const restaurant = restaurantFactory.build();
    const customer = userFactory.buildCustomer();
    const menuItem = menuItemFactory.build({ restaurantId: restaurant.id });

    const order = orderFactory.build({
      restaurantId: restaurant.id,
      userId: customer.id,
    });

    const orderItem = orderItemFactory.build({
      orderId: order.id,
      menuItemId: menuItem.id,
      quantity: 2,
    });

    expect(order.items).toContain(orderItem);
    expect(order.total).toBe(menuItem.price * 2);
  });
});
```

---

### 場景 3: 測試數據格式化

```typescript
describe("User Formatting", () => {
  beforeEach(() => {
    resetAllFactories();
  });

  test("formats user data correctly", () => {
    const user = userFactory.buildChef(1, {
      overrides: {
        preferences: { theme: "dark" },
        totalOrders: 10,
      },
    });

    const formatted = formatUser(user);

    // ✅ 驗證結構而非具體值
    expect(formatted).toHaveProperty("id", user.id);
    expect(formatted).toHaveProperty("username", user.username);
    expect(formatted).toHaveProperty("role_name", "Chef");
    expect(formatted).toHaveProperty("preferences", { theme: "dark" });
    expect(formatted).toHaveProperty("totalOrders", 10);
  });
});
```

---

### 場景 4: 測試列表過濾

```typescript
describe("User Filtering", () => {
  beforeEach(() => {
    resetAllFactories();
  });

  test("can filter by restaurant", () => {
    const users = [
      userFactory.buildChef(1),
      userFactory.buildChef(1),
      userFactory.buildChef(2),
      userFactory.buildService(1),
    ];

    const restaurant1Users = users.filter((u) => u.restaurantId === 1);

    expect(restaurant1Users).toHaveLength(3);
  });

  test("can filter by role", () => {
    const users = [
      userFactory.buildChef(1),
      userFactory.buildChef(1),
      userFactory.buildService(1),
    ];

    const chefs = users.filter((u) => u.role === USER_ROLES.CHEF);

    expect(chefs).toHaveLength(2);
  });
});
```

---

## ⚠️ 避免陷阱

### 陷阱 1: 硬編碼 ID

```typescript
// ❌ 錯誤
const user = userFactory.buildChef(1);
const order = orderFactory.build({ userId: 1 }); // 假設 user.id === 1

// ✅ 正確
const user = userFactory.buildChef(1);
const order = orderFactory.build({ userId: user.id });
```

**為什麼錯誤？**

- Factory 生成的 ID 不可預測
- 可能導致間歇性失敗
- 違反了引用原則

---

### 陷阱 2: 忘記 Reset

```typescript
// ❌ 錯誤
describe("Tests", () => {
  // 缺少 beforeEach resetAllFactories()

  test("first test", () => {
    const user = userFactory.buildChef(1); // ID = 1
  });

  test("second test", () => {
    const user = userFactory.buildChef(1); // ID = 2 (不是 1!)
  });
});

// ✅ 正確
describe("Tests", () => {
  beforeEach(() => {
    resetAllFactories(); // 每個測試重置
  });

  test("first test", () => {
    const user = userFactory.buildChef(1); // ID = 1
  });

  test("second test", () => {
    const user = userFactory.buildChef(1); // ID = 1 (一致！)
  });
});
```

---

### 陷阱 3: 過度使用 Factory

```typescript
// ❌ 錯誤：用 factory 創建無效數據
test("rejects invalid email", () => {
  const user = userFactory.build({
    overrides: { email: "invalid-email" }, // ❌ 混淆了測試意圖
  });
  expect(validateEmail(user.email)).toBe(false);
});

// ✅ 正確：直接測試驗證邏輯
test("rejects invalid email", () => {
  expect(validateEmail("invalid-email")).toBe(false);
});
```

---

### 陷阱 4: 斷言具體值

```typescript
// ❌ 錯誤：斷言 factory 生成的具體值
test("formats user", () => {
  const user = userFactory.buildChef(1);
  const formatted = formatUser(user);

  expect(formatted.username).toBe("chef_1"); // ❌ 假設了 factory 實現
});

// ✅ 正確：斷言結構和關係
test("formats user", () => {
  const user = userFactory.buildChef(1);
  const formatted = formatUser(user);

  expect(formatted.username).toBe(user.username); // ✅ 驗證關係
  expect(formatted).toHaveProperty("role_name", "Chef"); // ✅ 驗證轉換
});
```

---

### 陷阱 5: 缺少依賴聲明

```typescript
// ❌ 錯誤：忘記添加依賴
// package.json 缺少 @makanmasak/testing-utils

import { userFactory } from '@makanmasak/testing-utils'
// Error: Cannot find package

// ✅ 正確：聲明依賴
// package.json
{
  "devDependencies": {
    "@makanmasak/testing-utils": "workspace:*"
  }
}
```

---

## 🔍 問題排查

### 問題: 測試間數據 ID 不一致

**症狀**:

```
Expected user.id to be 1, received 3
```

**原因**: 忘記調用 `resetAllFactories()`

**解決**:

```typescript
beforeEach(() => {
  resetAllFactories(); // 添加這行
});
```

---

### 問題: 無法找到 factory 包

**症狀**:

```
Error: Cannot find package '@makanmasak/testing-utils'
```

**原因**: 未聲明依賴

**解決**:

```json
// package.json
{
  "devDependencies": {
    "@makanmasak/testing-utils": "workspace:*"
  }
}
```

然後運行:

```bash
pnpm install
```

---

### 問題: 斷言失敗（動態數據）

**症狀**:

```
Expected: { username: 'testuser' }
Received: { username: 'chef_2' }
```

**原因**: 斷言了 factory 生成的具體值

**解決**:

```typescript
// Before
expect(user).toMatchObject({ username: "testuser" });

// After
expect(user.username).toBe(user.username); // 或
expect(user).toHaveProperty("username");
```

---

### 問題: TypeScript 類型錯誤

**症狀**:

```
Property 'buildChef' does not exist on type 'UserFactory'
```

**原因**: TypeScript 定義未更新或導入錯誤

**解決**:

```typescript
// 確保正確導入
import { userFactory, resetAllFactories } from '@makanmasak/testing-utils'

// 運行類型檢查
pnpm run typecheck
```

---

## 📚 參考資源

### 文檔

- [Testing Utils README](../../../packages/testing-utils/README.md)
- [Factory Migration Plan](../../../reports/factory-migration/PLAN.md)
- [Users Module Migration Analysis](../../../apps/api/src/features/users/__tests__/MIGRATION_ANALYSIS.md)

### 示例代碼

- [Users Feature Tests](../../../apps/api/src/features/users/__tests__/feature.test.ts) - 完整遷移示例
- [Factory Tests](../../../packages/testing-utils/src/__tests__/factories.test.ts) - Factory 本身的測試

### 工具

```bash
# 查看 factory 使用統計
npm run factory:usage

# 查看遷移進度
npm run migration:report

# 檢查 factory 使用
npm run factory:check
```

---

## 🎓 學習路徑

### 初學者（0-1 週）

1. ✅ 閱讀 [快速開始](#快速開始)
2. ✅ 理解 [核心原則](#核心原則)
3. ✅ 嘗試 [模式 1: 基本實體創建](#模式-1-基本實體創建)
4. ✅ 練習簡單測試遷移

### 中級（1-2 週）

1. ✅ 掌握所有 [使用模式](#使用模式)
2. ✅ 學習 [常見場景](#常見場景)
3. ✅ 了解 [避免陷阱](#避免陷阱)
4. ✅ 遷移複雜測試文件

### 高級（2+ 週）

1. ✅ 貢獻新的 factory 方法
2. ✅ 優化現有 factory
3. ✅ 指導團隊成員
4. ✅ 成為 Factory Champion

---

## 💡 貢獻指南

### 發現新模式？

1. 在實際使用中發現有用的模式
2. 在本文檔添加新的「模式 N」
3. 提供清晰的代碼示例
4. 提交 PR 並說明價值

### 遇到新問題？

1. 記錄問題症狀
2. 找到根本原因
3. 提供解決方案
4. 添加到 [問題排查](#問題排查)

---

## 📊 檢查清單

### 開始新測試文件

```markdown
- [ ] 添加 testing-utils 依賴（如果是新模組）
- [ ] 導入需要的 factories
- [ ] 導入 resetAllFactories
- [ ] 在 beforeEach 調用 resetAllFactories()
- [ ] 使用語義化 factory 方法
- [ ] 運行測試確保通過
```

### 遷移現有測試

```markdown
- [ ] 閱讀測試理解意圖
- [ ] 識別手動數據創建
- [ ] 選擇合適的 factory 方法
- [ ] 替換手動創建
- [ ] 調整斷言（如需要）
- [ ] 運行測試驗證
- [ ] Code review
```

### Code Review 重點

```markdown
- [ ] 是否調用 resetAllFactories()?
- [ ] 是否使用語義化方法?
- [ ] 是否最小化 overrides?
- [ ] 是否引用而非硬編碼 ID?
- [ ] 無效數據測試是否手動創建?
- [ ] 斷言是否驗證結構而非值?
```

---

## 🎯 快速參考

### 常用方法

```typescript
// Users
userFactory.buildAdmin();
userFactory.buildShopOwner(restaurantId);
userFactory.buildChef(restaurantId);
userFactory.buildCustomer();

// Restaurants
restaurantFactory.build();

// Menu
menuItemFactory.build();
categoryFactory.build();

// Orders
orderFactory.build();
orderItemFactory.build();

// Utility
resetAllFactories();
buildCompleteRestaurantData();
```

### 導入語句

```typescript
import {
  userFactory,
  restaurantFactory,
  menuItemFactory,
  categoryFactory,
  orderFactory,
  orderItemFactory,
  resetAllFactories,
  buildCompleteRestaurantData,
} from "@makanmasak/testing-utils";
```

### Setup 模板

```typescript
import { describe, test, expect, beforeEach } from "vitest";
import { userFactory, resetAllFactories } from "@makanmasak/testing-utils";

describe("Feature Name", () => {
  beforeEach(() => {
    resetAllFactories();
  });

  test("test case", () => {
    const user = userFactory.buildChef(1);
    // ... 測試邏輯
  });
});
```

---

**文檔版本**: 1.0
**最後更新**: 2025-11-15
**維護者**: Factory Migration Team
**反饋渠道**: #factory-migration Slack 頻道

---

**記住核心原則**:

1. Factory 用於有效數據
2. 優先語義化方法
3. 最小化 overrides
4. 引用而非硬編碼
5. 總是 reset factories

**Happy Testing! 🎉**

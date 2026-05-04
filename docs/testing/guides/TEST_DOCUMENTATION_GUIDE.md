# 測試文檔維護指南 | Test Documentation Maintenance Guide

本指南說明如何維護 MakanMasak 專案的測試文檔，確保測試代碼與文檔保持同步。

This guide explains how to maintain test documentation in the MakanMasak project to ensure test code and documentation stay in sync.

---

## 📋 目錄 | Table of Contents

1. [何時需要更新文檔](#何時需要更新文檔)
2. [文檔更新流程](#文檔更新流程)
3. [文檔類型與範圍](#文檔類型與範圍)
4. [文檔更新檢查清單](#文檔更新檢查清單)
5. [良好文檔實踐](#良好文檔實踐)
6. [文檔審查標準](#文檔審查標準)
7. [常見問題](#常見問題)

---

## 何時需要更新文檔

### ✅ 需要更新文檔的情況

以下情況**必須**更新相關測試文檔：

#### 1. 新增測試場景或測試用例

```typescript
// ❌ 只有程式碼，沒有文檔
describe("New Feature: Group Order Split Bill", () => {
  it("should split bill equally among group members", () => {
    // test implementation
  });
});
```

**需要更新**：

- `docs/testing/TESTING_GUIDE.md` - 新增測試場景說明
- 相關模組的 `README.md` - 新增功能測試範例
- `docs/features/group-orders.md` - 新增測試說明章節

#### 2. 修改測試策略或測試方法

```typescript
// 從 mock 改為使用真實資料庫
// Before: Using mocked DB
const mockDB = createMockDB();

// After: Using real test database with factories
const testDB = await createTestDB();
const testData = buildCompleteRestaurantData();
```

**需要更新**：

- `docs/testing/TESTING_GUIDE.md` - 更新測試策略章節
- 相關模組的測試說明 - 說明為何改變策略

#### 3. 新增測試工具或測試輔助函數

```typescript
// 新增測試數據工廠
export function buildCompleteRestaurantData(options?: {
  enableShopMode?: boolean;
  categoryCount?: number;
  menuItemsPerCategory?: number;
  orderCount?: number;
}): CompleteTestData {
  // factory implementation
}
```

**需要更新**：

- `packages/testing-utils/README.md` - 新增 API 文檔
- `docs/testing/TESTING_GUIDE.md` - 新增測試工具使用指南
- 相關測試檔案 - 新增使用範例

#### 4. 修改重要的測試配置

```typescript
// vitest.config.ts - 修改覆蓋率目標
export default defineConfig({
  test: {
    coverage: {
      lines: 80, // 從 70% 提升到 80%
      functions: 80, // 從 70% 提升到 80%
      branches: 75, // 從 65% 提升到 75%
      statements: 80, // 從 70% 提升到 80%
    },
  },
});
```

**需要更新**：

- `docs/testing/TESTING_GUIDE.md` - 更新覆蓋率目標說明
- `CONTRIBUTING.md` - 更新 PR 提交標準

#### 5. 新增整合測試或 E2E 測試

```typescript
// 新增 Realtime WebSocket 整合測試
describe("Realtime WebSocket Integration", () => {
  it("should handle concurrent connections", async () => {
    // integration test
  });
});
```

**需要更新**：

- `docs/testing/TESTING_GUIDE.md` - 新增整合測試章節
- 相關功能文檔 (如 `docs/REALTIME_SERVICES_IMPLEMENTATION.md`) - 新增測試說明

---

### ❌ 不需要更新文檔的情況

以下情況**可以不用**更新文檔：

#### 1. 修復測試中的小 Bug

```typescript
// Before: Wrong assertion
expect(order.totalAmount).toBe(100);

// After: Fixed calculation
expect(order.totalAmount).toBe(calculateTotal(order.items));
```

**原因**：測試邏輯修正，不影響測試策略或使用方式。

#### 2. 調整測試數據

```typescript
// Before: Small dataset
const items = menuItemFactory.buildList(5);

// After: Larger dataset for better coverage
const items = menuItemFactory.buildList(20);
```

**原因**：數據量調整，測試目的和方法未改變。

#### 3. 重構測試代碼但功能不變

```typescript
// Before: Inline test data
it("should create order", () => {
  const order = {
    id: 1,
    restaurantId: 1,
    customerId: 10,
    totalAmount: 500,
  };
  // test logic
});

// After: Using factory (same functionality)
it("should create order", () => {
  const order = orderFactory.build({
    relations: { restaurantId: 1, customerId: 10 },
  });
  // same test logic
});
```

**原因**：僅改善代碼品質，測試行為相同。

#### 4. 調整測試命名或結構

```typescript
// Before: Unclear naming
describe("Tests", () => {
  it("test1", () => {});
  it("test2", () => {});
});

// After: Better naming (same tests)
describe("Order Service", () => {
  it("should create order with valid data", () => {});
  it("should reject order with invalid data", () => {});
});
```

**原因**：改善可讀性，測試內容未變。

---

## 文檔更新流程

### 步驟 1: 識別需要更新的文檔

根據你的測試變更，確定需要更新哪些文檔：

```
測試變更類型              →  需要更新的文檔
─────────────────────────────────────────────────
新增測試場景              →  TESTING_GUIDE.md
                            模組 README.md
                            功能實現文檔

新增測試工具/輔助函數      →  testing-utils README.md
                            TESTING_GUIDE.md

修改測試策略              →  TESTING_GUIDE.md
                            相關實現文檔

修改測試配置              →  TESTING_GUIDE.md
                            CONTRIBUTING.md

新增整合測試/E2E 測試     →  TESTING_GUIDE.md
                            功能實現文檔
```

### 步驟 2: 準備文檔內容

#### 範例：新增測試工具文檔

**在 `packages/testing-utils/README.md` 新增**：

```markdown
### buildCompleteRestaurantData()

一次生成完整的測試環境，包含餐廳、員工、菜單、訂單等所有數據。

**使用範例**:

\`\`\`typescript
import { buildCompleteRestaurantData } from '@makanmasak/testing-utils'

const testData = buildCompleteRestaurantData({
enableShopMode: true,
menuItemsPerCategory: 5,
orderCount: 20
})

// testData 包含:
// - restaurant: 餐廳數據
// - team: 員工團隊
// - categories: 分類列表
// - menuItems: 菜單項目列表
// - orders: 訂單列表
// - customers: 顧客列表
\`\`\`

**參數說明**:

| 參數                 | 類型    | 預設值 | 說明                  |
| -------------------- | ------- | ------ | --------------------- |
| enableShopMode       | boolean | false  | 是否啟用 Shop QR 模式 |
| categoryCount        | number  | 10     | 分類數量              |
| menuItemsPerCategory | number  | 5      | 每個分類的菜品數量    |
| orderCount           | number  | 10     | 訂單數量              |
```

#### 範例：新增測試場景文檔

**在 `docs/testing/TESTING_GUIDE.md` 新增**：

```markdown
## 測試場景：群組訂單分帳

### 測試目標

驗證群組訂單的分帳功能，確保能正確計算每位成員應付金額。

### 測試覆蓋

- ✅ 平均分帳
- ✅ 按比例分帳
- ✅ 自訂金額分帳
- ✅ 處理小數點四捨五入
- ✅ 處理優惠券折扣

### 測試範例

\`\`\`typescript
describe('Group Order Split Bill', () => {
it('should split bill equally', () => {
const order = orderFactory.build({
overrides: { totalAmount: 1000 }
})
const members = 4

    const result = splitBillEqually(order, members)

    expect(result.amountPerPerson).toBe(250)

})
})
\`\`\`

### 相關檔案

- 測試檔案: `apps/api/src/features/group-orders/__tests__/split-bill.test.ts`
- 實現文檔: `docs/features/GROUP_ORDERS.md`
```

### 步驟 3: 提交文檔更新

```bash
# 1. 確認測試通過
npm run test

# 2. 確認文檔變更
git status

# 3. 提交測試代碼和文檔
git add .
git commit -m "feat(group-orders): Add split bill feature

- Add split bill service with 3 modes
- Add unit tests (12 test cases)
- Update TESTING_GUIDE.md with test scenarios
- Update testing-utils README with new factories"

# 4. 推送並創建 PR
git push origin feature/group-order-split-bill
```

### 步驟 4: PR 自我檢查

在提交 PR 前，檢查以下事項：

- [ ] 所有新增/修改的測試都有對應的文檔說明
- [ ] 測試範例代碼可以直接執行
- [ ] 文檔中的參數說明完整準確
- [ ] 相關連結都正確無誤
- [ ] 文檔遵循專案的格式規範

---

## 文檔類型與範圍

### 1. 測試指南 (`docs/testing/TESTING_GUIDE.md`)

**適用情況**：

- 新增測試類型或測試策略
- 修改測試配置或覆蓋率目標
- 新增測試工具或測試框架
- 新增測試最佳實踐

**內容要求**：

- 清楚說明測試目的和適用場景
- 提供完整的測試範例代碼
- 說明測試策略和決策原因
- 包含常見問題和解決方案

### 2. 模組 README (`packages/*/README.md`, `apps/*/README.md`)

**適用情況**：

- 模組新增測試範例
- 測試使用方式變更
- 新增測試工具 API

**內容要求**：

- 簡潔的 API 文檔
- 實際可執行的範例代碼
- 參數說明表格
- 常見使用場景

### 3. 功能實現文檔 (`docs/features/*.md`, `docs/*_IMPLEMENTATION.md`)

**適用情況**：

- 功能新增整合測試或 E2E 測試
- 測試涵蓋重要業務邏輯
- 測試驗證功能正確性

**內容要求**：

- 測試策略說明
- 關鍵測試場景列表
- 測試檔案位置
- 測試覆蓋率目標

### 4. 貢獻指南 (`CONTRIBUTING.md`)

**適用情況**：

- 修改測試提交標準
- 新增測試檢查流程
- 修改 PR 審查要求

**內容要求**：

- 清楚的提交規範
- 測試要求檢查清單
- PR 審查標準

---

## 文檔更新檢查清單

### 提交 PR 前檢查

使用以下檢查清單確保文檔完整：

#### 📝 測試代碼檢查

- [ ] 所有測試都有清楚的 describe/it 描述
- [ ] 測試代碼有必要的註解說明
- [ ] 複雜測試邏輯有文檔字串 (docstring)
- [ ] 測試檔案頂部有檔案用途說明

#### 📚 文檔內容檢查

- [ ] 更新了 `docs/testing/TESTING_GUIDE.md`（如適用）
- [ ] 更新了相關模組的 README（如適用）
- [ ] 更新了功能實現文檔（如適用）
- [ ] 文檔範例代碼可以直接執行
- [ ] 所有連結和引用都正確

#### 🔗 關聯檢查

- [ ] PR 描述中說明了測試變更目的
- [ ] PR 描述中列出了更新的文檔
- [ ] 測試檔案和文檔在同一個 commit/PR
- [ ] CI 文檔檢查通過

#### ✅ 品質檢查

- [ ] 文檔遵循專案格式規範
- [ ] 程式碼範例使用正確的語法高亮
- [ ] 表格格式正確對齊
- [ ] 沒有拼寫錯誤

---

## 良好文檔實踐

### ✅ 好的文檔範例

#### 範例 1: 清楚的測試場景說明

```markdown
## 測試場景：訂單狀態流轉

### 測試目標

驗證訂單從創建到完成的完整生命週期，確保狀態轉換邏輯正確。

### 測試流程

\`\`\`
PENDING → CONFIRMED → PREPARING → READY → DELIVERED → COMPLETED
↓ ↓ ↓ ↓ ↓ ↓
CANCELLED CANCELLED CANCELLED CANCELLED CANCELLED ✓
\`\`\`

### 測試覆蓋

- ✅ 正常流程：所有狀態按順序轉換
- ✅ 異常流程：任意狀態可取消訂單
- ✅ 邊界條件：不允許跳過狀態
- ✅ 併發處理：同時更新不衝突

### 實現文件

- 測試檔案: `apps/api/src/features/orders/__tests__/order-lifecycle.test.ts`
- 服務檔案: `apps/api/src/features/orders/services/OrdersService.ts`
  \`\`\`
```

**優點**：

- 有清楚的視覺化流程圖
- 測試覆蓋完整明確
- 提供相關檔案連結

#### 範例 2: 完整的 API 文檔

```markdown
### userFactory.buildRestaurantTeam(restaurantId)

生成完整的餐廳員工團隊，包含店主、廚師、服務員和收銀員。

**參數**：

| 名稱         | 類型   | 必填 | 說明    |
| ------------ | ------ | ---- | ------- |
| restaurantId | number | 是   | 餐廳 ID |

**返回值**：

\`\`\`typescript
{
owner: UserTestData, // 1 位店主
chefs: UserTestData[], // 2 位廚師
serviceCrews: UserTestData[], // 3 位服務員
cashiers: UserTestData[] // 2 位收銀員
}
\`\`\`

**使用範例**：

\`\`\`typescript
import { userFactory } from '@makanmasak/testing-utils'

const team = userFactory.buildRestaurantTeam(1)

console.log(team.owner.role) // UserRoles.OWNER
console.log(team.chefs.length) // 2
\`\`\`

**相關方法**：

- `buildShopOwner(restaurantId)` - 只生成店主
- `buildChef(restaurantId)` - 只生成廚師
- `buildServiceCrew(restaurantId)` - 只生成服務員
  \`\`\`
```

**優點**：

- 參數說明清楚完整
- 返回值有型別定義
- 範例代碼可直接執行
- 提供相關方法連結

---

### ❌ 不好的文檔範例

#### 範例 1: 說明不清楚

```markdown
❌ 不好的範例：

## 測試

我們有一些測試。

\`\`\`typescript
it('test', () => {
// some test
})
\`\`\`
```

**問題**：

- 沒有說明測試目的
- 沒有測試場景說明
- 範例代碼不完整
- 沒有提供檔案位置

#### 範例 2: 文檔與代碼不同步

```markdown
❌ 不好的範例：

### createUser(name, email)

創建新用戶。

\`\`\`typescript
// 實際代碼已經改為：
createUser(data: CreateUserInput): Promise<User>

// 但文檔還是舊的參數簽名
\`\`\`
```

**問題**：

- 參數簽名過時
- 缺少型別資訊
- 沒有說明必填/可選
- 沒有返回值說明

---

## 文檔審查標準

### PR 審查時的文檔檢查

審查者應該檢查以下事項：

#### 1. 完整性檢查

- [ ] 所有新增的測試都有文檔說明
- [ ] 測試場景說明完整
- [ ] API 參數說明齊全
- [ ] 使用範例可以執行

#### 2. 準確性檢查

- [ ] 文檔與代碼實現一致
- [ ] 範例代碼正確無誤
- [ ] 連結都可以訪問
- [ ] 版本資訊正確

#### 3. 可讀性檢查

- [ ] 文檔結構清晰
- [ ] 語言表達清楚
- [ ] 格式規範統一
- [ ] 有適當的視覺化元素

#### 4. 可維護性檢查

- [ ] 文檔放在正確位置
- [ ] 遵循既有格式規範
- [ ] 有版本或更新日期
- [ ] 有必要的交叉引用

---

## 常見問題

### Q1: 我只是修復了一個測試 bug，真的不需要更新文檔嗎？

**A**: 如果是以下情況，確實不需要更新文檔：

- 修正了錯誤的斷言 (assertion)
- 調整了測試數據
- 改善了測試代碼結構但功能不變

但如果是以下情況，建議更新文檔：

- Bug 修復揭示了測試策略的問題
- Bug 修復改變了測試方式
- Bug 修復值得記錄以避免重複犯錯

### Q2: 測試範例代碼要多詳細？

**A**: 遵循以下原則：

- ✅ 範例代碼應該可以直接複製執行
- ✅ 包含必要的 import 語句
- ✅ 包含完整的測試設定 (setup)
- ✅ 展示實際使用場景
- ❌ 不要省略關鍵步驟
- ❌ 不要使用 `...` 省略太多代碼

**好的範例**：

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { userFactory, resetAllFactories } from "@makanmasak/testing-utils";

describe("User Service", () => {
  beforeEach(() => {
    resetAllFactories();
  });

  it("should create admin user", () => {
    const admin = userFactory.buildAdmin();

    expect(admin.role).toBe(UserRoles.ADMIN);
    expect(admin.isActive).toBe(true);
  });
});
```

### Q3: 多個測試檔案改動，要如何組織文檔更新？

**A**: 建議策略：

1. **按功能模組分組**：相關的測試改動放在同一個文檔章節
2. **使用清單格式**：列出所有改動的測試檔案
3. **提供統一的測試策略說明**：如果多個測試共用相同策略

**範例**：

```markdown
## 測試更新：群組訂單功能

### 新增測試檔案

- `group-orders.test.ts` - 群組訂單核心邏輯
- `split-bill.test.ts` - 分帳功能
- `group-cart.test.ts` - 購物車管理
- `group-payments.test.ts` - 付款流程

### 測試策略

所有群組訂單測試使用統一的測試數據工廠：

\`\`\`typescript
const groupData = buildGroupOrderTestData({
memberCount: 4,
itemsPerMember: 3
})
\`\`\`

### 測試覆蓋

- ✅ 創建群組訂單
- ✅ 成員加入/離開
- ✅ 購物車管理
- ✅ 分帳計算
- ✅ 付款流程
```

### Q4: CI 檢查提示我需要更新文檔，但我確定不需要，怎麼辦？

**A**: 在 PR 描述中清楚說明原因：

```markdown
## 為什麼不需要更新文檔？

本次 PR 只是重構測試代碼以提高可讀性：

- ✅ 測試功能完全相同
- ✅ 測試策略沒有改變
- ✅ 沒有新增測試工具
- ✅ 測試配置沒有變更

**變更內容**：

- 將內聯測試數據改為使用 factory
- 改善測試命名使其更清楚
- 移除重複的測試設定代碼
```

審查者會根據你的說明判斷是否合理。

### Q5: 要如何確保文檔不會過時？

**A**: 遵循以下實踐：

1. **測試代碼和文檔在同一個 PR**：確保同步更新
2. **CI 自動檢查**：使用 GitHub Actions 檢查文檔更新
3. **定期審查**：每個 sprint/release 檢查文檔準確性
4. **版本標註**：在文檔中標註最後更新日期
5. **自動化測試文檔範例**：將文檔中的範例代碼加入測試

**範例**：在文檔中的範例代碼也寫成測試：

```typescript
// docs/testing/TESTING_GUIDE.md 中的範例
// 同時也是 docs/testing/__tests__/guide-examples.test.ts

describe("Documentation Examples", () => {
  it("example from TESTING_GUIDE.md should work", () => {
    // 直接複製文檔中的範例代碼
    const admin = userFactory.buildAdmin();

    expect(admin.role).toBe(UserRoles.ADMIN);
    expect(admin.isActive).toBe(true);
  });
});
```

這樣可以確保文檔範例永遠是正確可執行的。

---

## 📞 需要協助？

如果對測試文檔維護有任何疑問：

1. 查看 [測試指南](./TESTING_GUIDE.md)
2. 查看 [貢獻指南](../../CONTRIBUTING.md)
3. 在 PR 中詢問審查者
4. 在團隊 Slack 的 #testing 頻道發問

---

**最後更新**: 2025-11-15
**版本**: 1.0.0
**維護者**: MakanMasak Development Team

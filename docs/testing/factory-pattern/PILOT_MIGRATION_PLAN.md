# 試點遷移計畫 | Pilot Migration Plan

> 📊 Factory 遷移試點模組分析與執行計畫

---

## 📊 模組分析結果

### 候選模組評估

```
模組          測試行數  複雜度  數據生成  優先級  推薦度
──────────────────────────────────────────────────────
users          136      低      中       P1      ⭐⭐⭐⭐⭐
restaurants    326      中      高       P2      ⭐⭐⭐⭐
menu           629      高      高       P3      ⭐⭐⭐
orders         626      高      高       P3      ⭐⭐⭐
```

### 評分標準

- **測試行數**：越少越適合試點（降低風險）
- **複雜度**：邏輯複雜度
- **數據生成**：手動創建測試數據的程度（越高收益越大）
- **優先級**：遷移優先級
- **推薦度**：綜合評分

---

## 🎯 試點選擇：Users 模組

### 選擇理由

#### ✅ 優點

1. **規模最小**（136 行）
   - 風險最低
   - 容易驗證成果
   - 團隊學習曲線平緩

2. **數據生成適中**

   ```typescript
   // 現有代碼有手動數據生成
   const rawUser = {
     id: 1,
     username: "testuser",
     role: USER_ROLES.CHEF,
     restaurantId: 1,
     email: "test@example.com",
     fullName: "Test User",
     phone: "+1234567890",
     // ... 更多字段
   };
   ```

   使用 factory 可以簡化為：

   ```typescript
   const user = userFactory.buildChef(1);
   ```

3. **非核心業務邏輯**
   - 主要測試權限檢查
   - 測試失敗不影響關鍵功能

4. **清晰的測試結構**
   - 3 個主要測試群組
   - 總共 11 個測試用例
   - 容易追蹤遷移進度

#### ⚠️ 注意事項

- 數據生成相對簡單（可能無法完全展示 factory 的優勢）
- 需要配合文檔說明複雜場景的用法

---

## 📋 遷移執行計畫

### 第 1 天：準備階段

#### 任務 1: 分析現有測試 (2 小時)

```
1. 識別所有手動數據生成
   └─ feature.test.ts 第 83-102 行

2. 列出需要的測試數據類型
   ├─ Admin 用戶
   ├─ Owner 用戶
   ├─ Chef 用戶
   ├─ Customer 用戶
   └─ 自訂字段用戶

3. 確認 factory 支援度
   ├─ userFactory.buildAdmin() ✅
   ├─ userFactory.buildShopOwner() ✅
   ├─ userFactory.buildChef() ✅
   ├─ userFactory.buildCustomer() ✅
   └─ userFactory.build({ overrides }) ✅
```

#### 任務 2: 創建遷移分支 (10 分鐘)

```bash
git checkout -b pilot/migrate-users-tests-to-factory
```

---

### 第 2 天：實施遷移

#### 遷移步驟

**步驟 1: 導入 testing-utils** (5 分鐘)

```typescript
// 在文件頂部添加
import {
  userFactory,
  resetAllFactories,
  UserRoles,
} from "@makanmakan/testing-utils";
```

**步驟 2: 添加 beforeEach 重置** (5 分鐘)

```typescript
describe("Users Feature Module", () => {
  beforeEach(() => {
    resetAllFactories(); // 新增
    usersService = new UsersService(mockEnv);
  });
});
```

**步驟 3: 遷移測試數據** (1-2 小時)

```typescript
// ❌ 遷移前
test("admin can manage all users", () => {
  const adminUser = { role: USER_ROLES.ADMIN, restaurantId: 1 };
  // ...
});

// ✅ 遷移後
test("admin can manage all users", () => {
  const adminUser = userFactory.buildAdmin({ overrides: { restaurantId: 1 } });
  // ...
});
```

**詳細遷移清單**：

```
測試用例                                  當前狀態    遷移狀態
────────────────────────────────────────────────────────────
1. admin can manage all users               手動        → factory
2. owner can only manage restaurant staff   手動        → factory
3. other roles cannot manage users          手動        → factory
4. admin can view all users                 手動        → factory
5. user can view themselves                 手動        → factory
6. owner can view restaurant staff          手動        → factory
7. formats user data correctly              手動        → factory
8. handles unknown roles gracefully         手動        → factory
9. role hierarchy is correctly enforced     常量        → 保持不變
```

**步驟 4: 執行測試** (10 分鐘)

```bash
npm run test apps/api/src/features/users/__tests__/feature.test.ts
```

**步驟 5: 驗證結果** (15 分鐘)

```
檢查項目：
├─ ✅ 所有測試通過
├─ ✅ 代碼量減少
├─ ✅ 可讀性提升
└─ ✅ 無額外依賴問題
```

---

### 第 3 天：文檔與總結

#### 任務 1: 更新遷移記錄 (30 分鐘)

創建 `apps/api/src/features/users/__tests__/MIGRATION_NOTES.md`:

```markdown
# Users 測試遷移記錄

## 遷移日期

2025-11-XX

## 變更摘要

- 從手動數據生成遷移到 testing-utils factory
- 減少代碼 XX 行 (XX%)
- 提升測試可讀性

## 遷移對比

### Before

\`\`\`typescript
const adminUser = { role: USER_ROLES.ADMIN, restaurantId: 1 }
\`\`\`

### After

\`\`\`typescript
const adminUser = userFactory.buildAdmin({ overrides: { restaurantId: 1 } })
\`\`\`

## 學到的經驗

- ...
- ...

## 遇到的問題

- ...
- ...
```

#### 任務 2: 團隊分享 (1 小時)

準備 10 分鐘分享內容：

1. 遷移過程演示
2. Before/After 對比
3. 收益說明
4. Q&A

---

## 📊 成功指標

### 量化指標

```typescript
interface PilotMetrics {
  // 代碼量
  linesBefore: 136;
  linesAfter: number; // 目標：< 120
  reduction: number; // 目標：> 10%

  // 測試結果
  testsTotal: 11;
  testsPassing: number; // 目標：11 (100%)
  testsFailing: 0;

  // 時間
  migrationTime: number; // 目標：< 8 小時
  testExecutionTime: {
    before: number;
    after: number;
  };

  // 可讀性 (團隊評分 1-5)
  readabilityScore: number; // 目標：> 4.0
}
```

### 質化指標

- [ ] 團隊成員理解 factory 使用方法
- [ ] 測試邏輯更清晰易懂
- [ ] 維護成本降低
- [ ] 願意在新測試中使用 factory

---

## 🚀 後續計畫

### 如果試點成功 ✅

```
第 2 週：
├─ 遷移 restaurants 模組 (326 行)
├─ 更新最佳實踐文檔
└─ 舉辦工作坊培訓

第 3-4 週：
├─ 遷移 menu 模組 (629 行)
├─ 遷移 orders 模組 (626 行)
└─ 建立 Code Review 檢查清單

第 5-6 週：
├─ 新測試強制使用 factory
├─ 評估整體收益
└─ 規劃下一階段
```

### 如果遇到問題 ⚠️

**問題類型 1：Factory 功能不足**

```
解決方案：
1. 記錄缺失功能
2. 擴展 factory API
3. 重新測試
```

**問題類型 2：測試失敗**

```
解決方案：
1. 比對數據差異
2. 調整 factory 或測試
3. 確保功能等價
```

**問題類型 3：團隊抗拒**

```
解決方案：
1. 收集反饋
2. 調整策略
3. 提供更多培訓
```

---

## 📝 遷移檢查清單

### 開始前

- [ ] 已閱讀 [Factory 快速參考](./FACTORY_QUICK_REFERENCE.md)
- [ ] 已閱讀 [FAQ](./FACTORY_FAQ.md)
- [ ] 已安裝 testing-utils
- [ ] 已創建遷移分支

### 遷移中

- [ ] 導入必要的 factory
- [ ] 添加 resetAllFactories()
- [ ] 逐個測試用例遷移
- [ ] 每遷移 2-3 個測試執行一次
- [ ] 記錄遇到的問題

### 遷移後

- [ ] 所有測試通過
- [ ] 代碼 review 通過
- [ ] 更新文檔
- [ ] 提交 PR
- [ ] 團隊分享

---

## 📞 需要協助？

- 💬 Slack #testing 頻道
- 👥 Factory Champions
- 📚 [完整文檔](../../packages/testing-utils/README.md)

---

**建立日期**: 2025-11-15
**狀態**: Ready to Execute
**預計完成**: 3 天
**負責人**: TBD

# Users 模組測試遷移分析

> 📊 試點模組遷移前分析報告

---

## 📋 文件信息

- **文件路徑**: `apps/api/src/features/users/__tests__/feature.test.ts`
- **總行數**: 162 行
- **測試群組**: 3 個
- **測試用例**: 11 個
- **分析日期**: 2025-11-15

---

## 🔍 手動數據生成識別

### 發現的手動數據創建（7 處）

#### 1. Line 24: Admin User（簡單）

```typescript
// ❌ 現況
const adminUser = { role: USER_ROLES.ADMIN, restaurantId: 1 }

// ✅ 遷移後
const adminUser = userFactory.buildAdmin({ overrides: { restaurantId: 1 } })
```

**複雜度**: 🟢 低
**改進**: 更完整的用戶數據，ID 自動管理

---

#### 2. Line 32: Owner User（簡單）

```typescript
// ❌ 現況
const ownerUser = { role: USER_ROLES.OWNER, restaurantId: 1 }

// ✅ 遷移後
const ownerUser = userFactory.buildShopOwner(1)
```

**複雜度**: 🟢 低
**改進**: 語義化方法名，數據完整

---

#### 3. Line 49: Chef User（簡單）

```typescript
// ❌ 現況
const chefUser = { role: USER_ROLES.CHEF, restaurantId: 1 }

// ✅ 遷移後
const chefUser = userFactory.buildChef(1)
```

**複雜度**: 🟢 低
**改進**: 清晰的角色定義

---

#### 4. Line 58-59: Admin + Target User（中等）

```typescript
// ❌ 現況
const adminUser = { role: USER_ROLES.ADMIN, id: 1, restaurantId: 1 }
const targetUser = { id: 2, restaurantId: 2 }

// ✅ 遷移後
const adminUser = userFactory.buildAdmin({ overrides: { restaurantId: 1 } })
const targetUser = userFactory.build({ overrides: { restaurantId: 2 } })
```

**複雜度**: 🟡 中
**改進**: ID 自動管理，避免衝突

---

#### 5. Line 65-66: Chef + Same User（中等）

```typescript
// ❌ 現況
const user = { role: USER_ROLES.CHEF, id: 1, restaurantId: 1 }
const sameUser = { id: 1, restaurantId: 1 }

// ✅ 遷移後
const user = userFactory.buildChef(1)
const sameUser = { id: user.id, restaurantId: user.restaurantId }
```

**複雜度**: 🟡 中
**改進**: 確保 ID 一致性

**注意**: 第二個對象可以直接使用第一個對象的字段

---

#### 6. Line 72-74: Owner + Staff Users（中等）

```typescript
// ❌ 現況
const ownerUser = { role: USER_ROLES.OWNER, id: 1, restaurantId: 1 }
const staffUser = { id: 2, restaurantId: 1 }
const otherRestaurantUser = { id: 3, restaurantId: 2 }

// ✅ 遷移後
const ownerUser = userFactory.buildShopOwner(1)
const staffUser = userFactory.build({ overrides: { restaurantId: 1 } })
const otherRestaurantUser = userFactory.build({ overrides: { restaurantId: 2 } })
```

**複雜度**: 🟡 中
**改進**: 自動 ID 管理，避免硬編碼

---

#### 7. Line 83-102: Complete User Object（高）

```typescript
// ❌ 現況（18 個字段的手動對象）
const rawUser = {
  id: 1,
  username: 'testuser',
  role: USER_ROLES.CHEF,
  restaurantId: 1,
  email: 'test@example.com',
  fullName: 'Test User',
  phone: '+1234567890',
  address: '123 Test St',
  dateOfBirth: '1990-01-01',
  profileImageUrl: 'https://example.com/avatar.jpg',
  isActive: true,
  isVerified: true,
  preferences: { theme: 'dark' },
  totalOrders: 10,
  totalSpent: 250.50,
  lastLoginAt: '2023-01-01T00:00:00Z',
  createdAt: '2022-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z'
}

// ✅ 遷移後（factory 已提供所有字段）
const rawUser = userFactory.buildChef(1, {
  overrides: {
    preferences: { theme: 'dark' },
    totalOrders: 10,
    totalSpent: 250.50
  }
})
```

**複雜度**: 🔴 高
**改進**:
- 減少 18 行代碼
- 所有基礎字段由 factory 自動生成
- 只需覆蓋特殊字段
- 數據格式一致性

---

## ✅ Factory 支援度確認

### 可用的 Factory 方法

| 方法 | 用途 | 使用場景 |
|------|------|----------|
| `userFactory.buildAdmin()` | 創建 ADMIN | Line 24, 58 |
| `userFactory.buildShopOwner(restaurantId)` | 創建 OWNER | Line 32, 72 |
| `userFactory.buildChef(restaurantId)` | 創建 CHEF | Line 49, 65, 83 |
| `userFactory.build()` | 創建通用用戶 | Line 59, 73, 74 |

### 所有測試場景都已覆蓋 ✅

```
✅ 簡單角色創建（ADMIN, OWNER, CHEF）
✅ 自定義 restaurantId
✅ 自定義 ID（通過 overrides）
✅ 完整用戶對象（所有字段）
✅ 多用戶場景（不同 restaurant）
```

---

## 🎯 遷移策略

### Phase 1: 簡單替換（5 處）

**預計時間**: 30 分鐘

1. Line 24: `adminUser` → `userFactory.buildAdmin()`
2. Line 32: `ownerUser` → `userFactory.buildShopOwner(1)`
3. Line 49: `chefUser` → `userFactory.buildChef(1)`
4. Line 58: `adminUser` → `userFactory.buildAdmin()`
5. Line 65: `user` → `userFactory.buildChef(1)`

### Phase 2: Overrides 使用（2 處）

**預計時間**: 45 分鐘

1. Line 59, 73-74: 使用 `overrides` 指定 restaurantId
2. Line 83-102: 大幅簡化，使用 `overrides` 覆蓋特殊字段

### Phase 3: 測試驗證

**預計時間**: 15 分鐘

1. 運行測試確保通過
2. 檢查數據一致性
3. Code review

---

## 📊 預期改進

### 代碼量

```
Before: 162 lines
After:  ~140 lines (-14%)

節省: ~22 lines (主要來自 Line 83-102 的簡化)
```

### 可讀性

```
Before:
├─ ❌ 手動創建 18 個字段
├─ ❌ 硬編碼 ID（1, 2, 3）
└─ ❌ 角色不明確（{ role: USER_ROLES.CHEF }）

After:
├─ ✅ 清晰的方法名（buildChef, buildAdmin）
├─ ✅ 自動 ID 管理
└─ ✅ 最小化 overrides
```

### 維護性

```
✅ 字段變更只需修改 factory
✅ 測試數據格式一致
✅ 減少重複代碼
✅ 更容易添加新測試
```

### 數據一致性

```
✅ 所有用戶 ID 不衝突
✅ timestamps 格式統一
✅ 字段完整性保證
```

---

## ⚠️ 注意事項

### 需要額外處理的場景

#### 1. Line 65-66: 相同 ID 的用戶

```typescript
// 需要確保 sameUser 的 ID 與 user 相同
const user = userFactory.buildChef(1)
const sameUser = { id: user.id, restaurantId: user.restaurantId }
```

#### 2. Line 150-159: 常量檢查

```typescript
// 這個測試不需要遷移，保持不變
test('role hierarchy is correctly enforced', () => {
  const roles = [
    USER_ROLES.ADMIN,
    USER_ROLES.OWNER,
    // ...
  ]
  expect(roles).toEqual([0, 1, 2, 3, 4, 5])
})
```

---

## 📝 遷移檢查清單

### 準備階段 ✅

- [x] 閱讀測試文件
- [x] 識別所有手動數據創建
- [x] 確認 factory 支援度
- [x] 制定遷移策略

### 實施階段（待完成）

- [ ] 導入 testing-utils
- [ ] 添加 beforeEach resetAllFactories
- [ ] 遷移簡單場景（5 處）
- [ ] 遷移 overrides 場景（2 處）
- [ ] 運行測試驗證

### 驗證階段（待完成）

- [ ] 所有測試通過 ✅
- [ ] Code review 完成
- [ ] 更新進度追蹤
- [ ] 記錄經驗教訓

---

## 🎓 學習要點

### 從這次遷移中學到的

1. **簡單場景**: 直接使用角色特定方法（`buildChef`, `buildAdmin`）
2. **自定義場景**: 使用 `overrides` 參數
3. **複雜對象**: Factory 已提供所有字段，只需覆蓋特殊值
4. **ID 管理**: 依賴 factory 的自動序列，避免硬編碼

### 可復用的模式

```typescript
// 模式 1: 基本角色創建
const user = userFactory.buildChef(restaurantId)

// 模式 2: 自定義字段
const user = userFactory.build({
  overrides: { email: 'custom@example.com' }
})

// 模式 3: 關聯對象
const user = userFactory.buildChef(restaurant.id)

// 模式 4: 相同 ID 引用
const user1 = userFactory.buildChef(1)
const user2 = { id: user1.id, ...otherFields }
```

---

## 📊 風險評估

| 風險 | 可能性 | 影響 | 緩解措施 |
|------|--------|------|----------|
| 測試失敗 | 低 | 中 | 逐步遷移，每步驗證 |
| ID 衝突 | 低 | 低 | 使用 resetAllFactories |
| 字段遺漏 | 極低 | 中 | Factory 已包含所有字段 |
| 性能影響 | 無 | 無 | Factory 性能優異 |

**總體風險**: 🟢 低

---

## 📅 時間表

```
Day 1 (今天):
├─ ✅ 分析完成
└─ ⏳ 創建遷移分支

Day 2 (明天):
├─ 09:00-09:30 | 導入和設置
├─ 09:30-11:00 | Phase 1 遷移
├─ 11:00-12:00 | Phase 2 遷移
├─ 13:00-13:30 | 測試驗證
└─ 13:30-14:00 | Code review

Day 3 (後天):
├─ 09:00-10:00 | 記錄經驗
└─ 10:00-11:00 | 團隊分享
```

---

**分析完成日期**: 2025-11-15
**分析師**: Claude (Factory Migration Assistant)
**狀態**: ✅ Ready for Migration

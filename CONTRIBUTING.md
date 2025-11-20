# 貢獻指南 | Contributing Guide

感謝你對 MakanMakan 專案的貢獻！本指南將幫助你了解如何參與專案開發。

Thank you for contributing to the MakanMakan project! This guide will help you understand how to participate in project development.

---

## 📋 目錄 | Table of Contents

1. [行為準則](#行為準則)
2. [開始之前](#開始之前)
3. [開發流程](#開發流程)
4. [程式碼規範](#程式碼規範)
5. [測試要求](#測試要求)
6. [提交規範](#提交規範)
7. [Pull Request 流程](#pull-request-流程)
8. [文檔要求](#文檔要求)

---

## 行為準則

### 我們的承諾

為了營造一個開放且友善的環境，我們承諾：

- 🤝 尊重不同的觀點和經驗
- 💬 接受建設性的批評
- 🎯 專注於對社群最有利的事情
- 🌟 對其他社群成員展現同理心

### 不可接受的行為

- ❌ 使用性暗示的言語或圖像
- ❌ 人身攻擊或貶損評論
- ❌ 公開或私下騷擾
- ❌ 未經許可發布他人的私人資訊

---

## 開始之前

### 1. 環境設置

確保你的開發環境滿足以下要求：

```bash
# 檢查 Node.js 版本 (需要 20+)
node --version

# 檢查 pnpm 版本
pnpm --version

# 如果沒有 pnpm，先安裝
npm install -g pnpm

# 登入 Cloudflare (需要帳號)
npx wrangler login
```

### 2. Fork 和 Clone

```bash
# 1. Fork 專案到你的 GitHub 帳號
# 2. Clone 你的 fork
git clone https://github.com/YOUR_USERNAME/makanmakan.git
cd makanmakan

# 3. 設置 upstream remote
git remote add upstream https://github.com/makanmakan/makanmakan.git

# 4. 安裝依賴
pnpm install

# 5. 執行資料庫遷移
npm run db:migrate:local
```

### 3. 驗證設置

```bash
# 執行測試確保環境正確
npm run test

# 執行 TypeScript 類型檢查
npm run typecheck

# 執行 ESLint 檢查
npm run lint
```

---

## 開發流程

### 1. 創建功能分支

```bash
# 從最新的 main 分支創建新分支
git checkout main
git pull upstream main
git checkout -b feature/your-feature-name

# 或修復 bug
git checkout -b fix/bug-description
```

### 2. 分支命名規範

使用以下前綴：

- `feature/` - 新功能
- `fix/` - Bug 修復
- `refactor/` - 代碼重構
- `docs/` - 文檔更新
- `test/` - 測試相關
- `chore/` - 建置工具或輔助工具的變動

**範例**：
```
feature/group-order-split-bill
fix/order-status-transition
refactor/database-query-optimization
docs/update-testing-guide
test/add-integration-tests
chore/update-dependencies
```

### 3. 開發過程

```bash
# 啟動開發伺服器
npm run dev

# 在另一個終端執行測試（watch 模式）
npm run test -- --watch

# 定期檢查代碼品質
npm run typecheck
npm run lint
```

### 4. 提交變更

```bash
# 查看變更
git status
git diff

# 添加變更
git add .

# 提交（遵循提交規範）
git commit -m "feat(orders): Add split bill feature"

# 推送到你的 fork
git push origin feature/your-feature-name
```

---

## 程式碼規範

### TypeScript 規範

#### ✅ 好的實踐

```typescript
// 使用明確的類型定義
interface CreateOrderInput {
  restaurantId: number
  customerId: number
  items: OrderItem[]
  totalAmount: number
}

// 使用 async/await 而非 Promise.then
async function createOrder(data: CreateOrderInput): Promise<Order> {
  const order = await db.insert(orders).values(data)
  return order
}

// 使用解構賦值
const { restaurantId, customerId, items } = orderData

// 使用可選鏈
const userName = user?.profile?.name ?? 'Guest'
```

#### ❌ 避免的實踐

```typescript
// ❌ 不要使用 any
function process(data: any) { }  // 不好

// ✅ 使用明確類型
function process(data: ProcessData) { }  // 好

// ❌ 不要忽略錯誤處理
await createOrder(data)  // 不好

// ✅ 正確處理錯誤
try {
  await createOrder(data)
} catch (error) {
  logger.error('Failed to create order', error)
  throw new ApiError('ORDER_CREATION_FAILED', 500)
}
```

### Vue 組件規範

```vue
<!-- ✅ 好的組件結構 -->
<template>
  <div class="order-list">
    <OrderItem
      v-for="order in orders"
      :key="order.id"
      :order="order"
      @update="handleUpdate"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Order } from '@makanmakan/shared-types'

// Props 定義
interface Props {
  restaurantId: number
  status?: OrderStatus
}

const props = withDefaults(defineProps<Props>(), {
  status: 'pending'
})

// Emits 定義
interface Emits {
  (e: 'update', order: Order): void
}

const emit = defineEmits<Emits>()

// 狀態管理
const orders = ref<Order[]>([])
const loading = ref(false)

// 計算屬性
const pendingCount = computed(() =>
  orders.value.filter(o => o.status === 'pending').length
)

// 生命週期
onMounted(async () => {
  await fetchOrders()
})

// 方法
async function fetchOrders() {
  loading.value = true
  try {
    orders.value = await api.getOrders(props.restaurantId)
  } catch (error) {
    console.error('Failed to fetch orders', error)
  } finally {
    loading.value = false
  }
}

function handleUpdate(order: Order) {
  emit('update', order)
}
</script>

<style scoped>
.order-list {
  display: grid;
  gap: 1rem;
}
</style>
```

### 命名規範

- **檔案名稱**: kebab-case (`order-service.ts`, `user-factory.ts`)
- **組件名稱**: PascalCase (`OrderList.vue`, `UserProfile.vue`)
- **函數名稱**: camelCase (`createOrder`, `getUserProfile`)
- **常數**: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`, `API_BASE_URL`)
- **類型/介面**: PascalCase (`CreateOrderInput`, `UserProfile`)

---

## 測試要求

### 測試覆蓋率目標

你的 PR 必須滿足以下測試覆蓋率：

- **單元測試**: 82% 以上
- **整合測試**: 75% 以上
- **E2E 測試**: 100% (關鍵流程)
- **整體覆蓋率**: 80% 以上

### 必須包含測試的情況

#### ✅ 必須寫測試

- 🔴 **新增功能**: 所有新功能都要有單元測試
- 🔴 **API 端點**: 所有 API 都要有整合測試
- 🔴 **業務邏輯**: 所有業務邏輯都要有單元測試
- 🔴 **資料庫操作**: 使用測試數據庫驗證
- 🔴 **關鍵流程**: 訂單、支付等流程要有 E2E 測試

#### 📝 測試範例

**單元測試**：

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { OrderService } from '../OrderService'
import { createTestDB } from '@/tests/helpers/test-utils'

describe('OrderService', () => {
  let orderService: OrderService
  let db: TestDatabase

  beforeEach(async () => {
    db = await createTestDB()
    orderService = new OrderService(db)
  })

  describe('createOrder', () => {
    it('should create order with valid data', async () => {
      const orderData = {
        restaurantId: 1,
        customerId: 1,
        items: [{ menuItemId: 1, quantity: 2 }]
      }

      const order = await orderService.createOrder(orderData)

      expect(order.id).toBeDefined()
      expect(order.status).toBe('pending')
      expect(order.totalAmount).toBeGreaterThan(0)
    })

    it('should reject order with invalid restaurant', async () => {
      const orderData = {
        restaurantId: 999, // Non-existent
        customerId: 1,
        items: []
      }

      await expect(
        orderService.createOrder(orderData)
      ).rejects.toThrow('Restaurant not found')
    })
  })
})
```

**整合測試**：

```typescript
import { describe, it, expect } from 'vitest'
import { createTestApp } from '@/tests/helpers/test-utils'

describe('POST /api/v1/orders', () => {
  it('should create order for authenticated user', async () => {
    const app = await createTestApp()

    const response = await app.request('/api/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer valid-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        restaurantId: 1,
        items: [{ menuItemId: 1, quantity: 2 }]
      })
    })

    expect(response.status).toBe(201)
    const order = await response.json()
    expect(order.id).toBeDefined()
  })
})
```

### 使用測試數據工廠

**使用 `@makanmakan/testing-utils`**：

```typescript
import {
  userFactory,
  restaurantFactory,
  orderFactory,
  buildCompleteRestaurantData,
  resetAllFactories
} from '@makanmakan/testing-utils'

describe('Order Flow', () => {
  beforeEach(() => {
    resetAllFactories()
  })

  it('should process complete order flow', async () => {
    // 使用工廠快速生成測試數據
    const testData = buildCompleteRestaurantData()

    const order = orderFactory.build({
      relations: {
        restaurantId: testData.restaurant.id!,
        customerId: testData.customers[0].id!
      }
    })

    // 執行測試邏輯
    // ...
  })
})
```

### 執行測試

```bash
# 執行所有測試
npm run test

# 執行特定測試檔案
npm run test orders.test.ts

# Watch 模式
npm run test -- --watch

# 生成覆蓋率報告
npm run test:coverage

# 執行整合測試
npm run test:integration

# 執行 E2E 測試
npm run test:e2e
```

---

## 提交規範

### Commit Message 格式

使用 [Conventional Commits](https://www.conventionalcommits.org/) 規範：

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Type 類型

- `feat`: 新功能
- `fix`: Bug 修復
- `docs`: 文檔變更
- `style`: 程式碼格式（不影響功能）
- `refactor`: 重構（不是新功能也不是修 bug）
- `test`: 新增或修改測試
- `chore`: 建置工具或輔助工具的變動
- `perf`: 效能優化

### Scope 範圍

使用模組或功能名稱：

- `orders` - 訂單模組
- `menu` - 菜單模組
- `users` - 用戶模組
- `auth` - 認證模組
- `realtime` - 即時功能
- `database` - 資料庫相關
- `api` - API 相關
- `admin` - 管理後台
- `customer` - 客戶端應用

### 範例

```bash
# 新功能
git commit -m "feat(orders): Add split bill functionality

- Support equal split
- Support custom split
- Support ratio-based split
- Add unit tests for split calculations"

# Bug 修復
git commit -m "fix(auth): Fix JWT token expiration check

Previously the token expiration was not properly validated,
causing security issues. Now properly checks exp claim."

# 文檔更新
git commit -m "docs(testing): Update testing guide with factory examples"

# 測試
git commit -m "test(orders): Add integration tests for order lifecycle"

# 重構
git commit -m "refactor(database): Optimize query performance

- Use indexes for frequently queried columns
- Implement query result caching
- Reduce N+1 queries"
```

---

## Pull Request 流程

### 1. 創建 PR 前檢查清單

在創建 PR 之前，確保完成以下檢查：

#### 📝 程式碼品質

- [ ] 所有測試通過 (`npm run test`)
- [ ] TypeScript 類型檢查通過 (`npm run typecheck`)
- [ ] ESLint 檢查通過 (`npm run lint`)
- [ ] 沒有 console.log 或除錯代碼
- [ ] 程式碼遵循專案規範

#### 🧪 測試要求

- [ ] 新增功能有對應的單元測試
- [ ] API 變更有整合測試
- [ ] 關鍵流程有 E2E 測試（如適用）
- [ ] 測試覆蓋率達到目標（80%+）
- [ ] 所有測試用例都有清楚的描述

#### 📚 文檔要求

- [ ] 更新了 `docs/testing/TESTING_GUIDE.md`（如適用）
- [ ] 更新了相關模組的 README（如適用）
- [ ] 更新了功能實現文檔（如適用）
- [ ] PR 描述清楚說明變更內容
- [ ] 如果不需要更新文檔，在 PR 中說明原因

#### 🔄 Git 狀態

- [ ] Commit message 遵循規範
- [ ] 已 rebase 到最新的 main 分支
- [ ] 沒有合併衝突
- [ ] 沒有不必要的檔案變更

### 2. 創建 Pull Request

1. **推送分支到你的 fork**：
   ```bash
   git push origin feature/your-feature-name
   ```

2. **在 GitHub 上創建 PR**：
   - 前往你的 fork 頁面
   - 點擊 "Compare & pull request"
   - 填寫 PR 模板（自動載入）

3. **填寫 PR 描述**：
   使用提供的模板，確保包含：
   - 變更摘要
   - 測試說明
   - 文檔更新說明
   - 相關 Issue 連結
   - 截圖（如適用）

### 3. PR 標題格式

遵循 Conventional Commits 格式：

```
feat(orders): Add split bill feature
fix(auth): Resolve token expiration issue
docs(testing): Update factory usage examples
```

### 4. PR 審查流程

1. **自動檢查**：
   - ✅ CI 測試必須通過
   - ✅ 代碼覆蓋率達標
   - ✅ 文檔同步檢查通過

2. **人工審查**：
   - 至少需要 1 位審查者核准
   - 回應所有審查意見
   - 必要時更新代碼

3. **合併條件**：
   - ✅ 所有自動檢查通過
   - ✅ 獲得必要的核准
   - ✅ 沒有未解決的討論
   - ✅ 已 rebase 到最新 main

### 5. 回應審查意見

```bash
# 根據審查意見修改代碼
# ...

# 提交修改
git add .
git commit -m "refactor(orders): Address PR review comments

- Improve error handling
- Add input validation
- Update test cases"

# 推送更新
git push origin feature/your-feature-name
```

### 6. 合併後清理

```bash
# PR 合併後，刪除本地分支
git checkout main
git pull upstream main
git branch -d feature/your-feature-name

# 刪除遠端分支
git push origin --delete feature/your-feature-name
```

---

## 文檔要求

### 必須更新文檔的情況

根據 [測試文檔維護指南](docs/testing/TEST_DOCUMENTATION_GUIDE.md)，以下情況必須更新文檔：

#### ✅ 必須更新

1. **新增測試場景或測試用例**
   - 更新 `docs/testing/TESTING_GUIDE.md`
   - 在相關模組 README 中新增測試範例

2. **修改測試策略或測試方法**
   - 說明為何改變策略
   - 更新相關文檔中的測試方法說明

3. **新增測試工具或輔助函數**
   - 在 `packages/testing-utils/README.md` 中新增 API 文檔
   - 提供使用範例

4. **修改測試配置**
   - 更新 `docs/testing/TESTING_GUIDE.md`
   - 說明配置變更的原因

5. **新增整合測試或 E2E 測試**
   - 在功能實現文檔中新增測試說明
   - 說明測試場景和覆蓋範圍

#### ❌ 可以不更新

1. 修復測試中的小 bug
2. 調整測試數據
3. 重構測試代碼但功能不變
4. 調整測試命名或結構

### 文檔更新檢查清單

提交 PR 時，使用此檢查清單：

- [ ] 所有新增/修改的測試都有對應的文檔說明
- [ ] 測試範例代碼可以直接執行
- [ ] 文檔中的參數說明完整準確
- [ ] 相關連結都正確無誤
- [ ] 文檔遵循專案的格式規範
- [ ] 如果不需要更新文檔，在 PR 中說明原因

---

## 常見問題

### Q: 我應該從哪裡開始貢獻？

**A**: 建議從以下開始：

1. **Good First Issue**: 查看標記為 `good first issue` 的 Issue
2. **文檔改進**: 修正文檔中的錯誤或補充說明
3. **測試覆蓋**: 為現有功能補充測試
4. **Bug 修復**: 修復已知的 Bug

### Q: 如何找到可以貢獻的任務？

**A**: 檢查以下位置：

- GitHub Issues 中標記為 `help wanted` 的項目
- GitHub Issues 中標記為 `good first issue` 的項目
- 專案看板 (Project Board)
- 文檔中標記為 TODO 的章節

### Q: 我的 PR 需要多長時間才能被審查？

**A**: 通常情況：

- 小型 PR（< 100 行）: 1-2 天
- 中型 PR（100-500 行）: 3-5 天
- 大型 PR（> 500 行）: 5-7 天

建議將大型變更拆分成多個小 PR，這樣可以更快獲得審查。

### Q: 我的 PR 被要求修改，該怎麼做？

**A**: 按照以下步驟：

1. 仔細閱讀審查意見
2. 如有疑問，在 PR 中提問
3. 修改代碼並提交新的 commit
4. 推送到同一個分支，PR 會自動更新
5. 回覆審查意見，說明你的修改

### Q: CI 測試失敗了怎麼辦？

**A**: 檢查以下項目：

```bash
# 本地執行相同的檢查
npm run test
npm run typecheck
npm run lint

# 查看 GitHub Actions 的詳細錯誤訊息
# 修復錯誤後重新推送
git push origin feature/your-feature-name
```

### Q: 如何保持我的 fork 與上游同步？

**A**: 定期同步：

```bash
# 切換到 main 分支
git checkout main

# 拉取上游更新
git pull upstream main

# 推送到你的 fork
git push origin main

# 在功能分支上 rebase
git checkout feature/your-feature-name
git rebase main
```

---

## 獲取幫助

如果你在貢獻過程中遇到問題：

1. 📖 查看 [測試指南](docs/testing/TESTING_GUIDE.md)
2. 📖 查看 [測試文檔維護指南](docs/testing/TEST_DOCUMENTATION_GUIDE.md)
3. 📖 查看專案文檔 (`docs/` 目錄)
4. 💬 在 PR 或 Issue 中提問
5. 💬 加入團隊 Slack 的 #development 頻道

---

## 授權

提交貢獻即表示你同意將你的工作以 MIT 授權釋出。

---

**感謝你的貢獻！** 🎉

---

**最後更新**: 2025-11-15
**版本**: 1.0.0
**維護者**: MakanMakan Development Team

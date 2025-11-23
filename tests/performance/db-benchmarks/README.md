# 資料庫性能基準測試

完整的資料庫性能測試框架，包含查詢性能測試、N+1 查詢檢測和性能退化檢測。

## 📋 目錄

- [快速開始](#快速開始)
- [測試類別](#測試類別)
- [性能基準線管理](#性能基準線管理)
- [性能退化檢測](#性能退化檢測)
- [CI/CD 整合](#cicd-整合)
- [最佳實踐](#最佳實踐)

---

## 🚀 快速開始

### 安裝依賴

```bash
# 在專案根目錄
pnpm install
```

### 執行測試

```bash
# 執行所有資料庫性能測試
pnpm test tests/performance/db-benchmarks/

# 執行特定測試
pnpm test tests/performance/db-benchmarks/query-performance.test.ts
pnpm test tests/performance/db-benchmarks/n-plus-one-detection.test.ts
```

### 建立性能基準線

```bash
cd tests/performance/db-benchmarks
ts-node create-baseline.ts v1.0.0
```

### 比較性能

```bash
cd tests/performance/db-benchmarks
ts-node compare-performance.ts --fail-on-regression
```

---

## 📊 測試類別

### 1. 查詢性能測試 (`query-performance.test.ts`)

測試所有關鍵資料庫查詢的執行性能。

**涵蓋範圍:**

```
┌─────────────────────────────────────────────┐
│          查詢性能測試覆蓋範圍               │
├─────────────────────────────────────────────┤
│                                             │
│  🍽️  Menu Queries (4 tests)                │
│    ├─ 根據餐廳ID獲取菜單                    │
│    ├─ 菜單with分類JOIN                     │
│    ├─ 菜單搜尋                             │
│    └─ 索引使用驗證                         │
│                                             │
│  📋 Order Queries (4 tests)                │
│    ├─ 訂單列表                             │
│    ├─ 根據狀態查詢訂單                     │
│    ├─ 訂單with訂單項目JOIN                 │
│    └─ 訂單狀態更新                         │
│                                             │
│  🪑 Table Queries (2 tests)                │
│    ├─ 桌台列表                             │
│    └─ 桌台可用性檢查                       │
│                                             │
│  👤 User Queries (2 tests)                 │
│    ├─ 根據用戶名查詢                       │
│    └─ 索引驗證                             │
│                                             │
│  📈 Analytics Queries (2 tests)            │
│    ├─ 每日營收統計                         │
│    └─ 熱門菜品統計                         │
│                                             │
│  ⚡ Load Tests (2 tests)                   │
│    ├─ 10並發查詢測試                       │
│    └─ 50並發查詢測試                       │
│                                             │
│  💪 Stress Test (1 test)                   │
│    └─ 持續負載測試 (5秒)                   │
│                                             │
└─────────────────────────────────────────────┘

Total: 17 performance test cases
```

**性能目標:**

| 查詢類型 | P95 目標 | P99 目標 |
|---------|----------|----------|
| 簡單查詢 (SELECT by ID) | < 30ms | < 50ms |
| 複雜查詢 (JOIN, GROUP BY) | < 100ms | < 150ms |
| 分析查詢 (Analytics) | < 200ms | < 300ms |

**執行:**

```bash
pnpm test tests/performance/db-benchmarks/query-performance.test.ts
```

**輸出示例:**

```
📊 Menu Items Query Performance:
   Average: 42.35ms
   P95: 58.21ms
   P99: 72.89ms

🔍 Menu Items Index Validation:
   Index Used: ✅
   Execution Time: 38.42ms
   ✅ Query uses index efficiently.
```

---

### 2. N+1 查詢檢測 (`n-plus-one-detection.test.ts`)

自動檢測 N+1 查詢問題，確保使用最佳化的查詢策略。

**檢測場景:**

```
┌──────────────────────────────────────────┐
│        N+1 查詢檢測場景                  │
├──────────────────────────────────────────┤
│                                          │
│  ❌ 問題場景 (Should Detect):            │
│                                          │
│  1. 訂單列表 + 逐一載入訂單項目           │
│     SELECT * FROM orders...              │
│     → SELECT * FROM order_items (N次)    │
│                                          │
│  2. 菜單列表 + 逐一載入分類               │
│     SELECT * FROM menu_items...          │
│     → SELECT * FROM categories (N次)     │
│                                          │
│  3. 用戶列表 + 逐一檢查權限               │
│     SELECT * FROM users...               │
│     → SELECT * FROM permissions (N次)    │
│                                          │
│  ✅ 優化場景 (Should NOT Detect):        │
│                                          │
│  1. 使用 JOIN 一次載入                   │
│     SELECT o.*, oi.* FROM orders o       │
│     LEFT JOIN order_items oi ON...       │
│                                          │
│  2. 使用 IN 批次載入                     │
│     SELECT * FROM menu_items             │
│     WHERE id IN (1,2,3,4,5)              │
│                                          │
└──────────────────────────────────────────┘
```

**檢測邏輯:**

```
查詢追蹤流程:

  開始請求
     ↓
  startQueryLogging()
     ↓
  執行業務邏輯 ───→ 記錄每個查詢
     ↓                  ↓
  stopQueryLogging()    分析模式
     ↓                  ↓
  分析結果 ←───────────┘
     ↓
  判斷:
  • 總查詢數 > 10?
  • 重複查詢 > 5次?
  • 查詢模式相同?
     ↓
  N+1 Problem: YES/NO
```

**執行:**

```bash
pnpm test tests/performance/db-benchmarks/n-plus-one-detection.test.ts
```

**輸出示例:**

```
🔴 N+1 Detection - Naive Approach:
   Total Queries: 11
   Unique Queries: 2
   Has N+1 Problem: ❌ YES
   Suggestions:
   🔴 N+1 query problem detected!
   Consider using JOIN or batch loading to reduce queries
     - Query executed 10 times: SELECT * FROM order_items WHERE order_id = ?...

✅ N+1 Detection - Optimized Approach:
   Total Queries: 1
   Has N+1 Problem: ✅ NO
```

---

## 🎯 性能基準線管理

### 建立基準線

基準線是性能比較的參考點，應該在穩定版本建立。

**時機:**

- ✅ 新版本發布前
- ✅ 重大功能開發完成後
- ✅ 性能優化實施後
- ✅ 定期建立 (每月/每季)

**建立命令:**

```bash
cd tests/performance/db-benchmarks

# 建立基準線 (使用版本號)
ts-node create-baseline.ts v1.0.0

# 或使用 git commit SHA
ts-node create-baseline.ts $(git rev-parse --short HEAD)
```

**基準線結構:**

```json
{
  "version": "v1.0.0",
  "timestamp": 1699999999999,
  "queries": {
    "menu_items_by_restaurant": {
      "avgTime": 42.35,
      "p95Time": 58.21,
      "p99Time": 72.89,
      "indexUsed": true,
      "category": "menu"
    },
    "orders_list": {
      "avgTime": 67.42,
      "p95Time": 89.12,
      "p99Time": 105.34,
      "indexUsed": true,
      "category": "orders"
    }
    // ... 更多查詢
  }
}
```

**基準線儲存位置:**

```
tests/performance/baselines/
└── db-baseline.json      ← 當前基準線
```

**版本控制:**

基準線應該提交到 Git,以便:
- 追蹤性能變化歷史
- 在不同分支比較性能
- 回滾到之前的基準線

```bash
git add tests/performance/baselines/db-baseline.json
git commit -m "feat: update performance baseline for v1.0.0"
```

---

## 🔍 性能退化檢測

### 自動檢測流程

```
性能退化檢測流程:

  PR/Commit
     ↓
  CI 觸發
     ↓
  執行性能測試
     ↓
  收集當前指標
     ↓
  載入基準線
     ↓
  ┌──────────────┐
  │ 逐查詢比較   │
  └──────────────┘
     ↓
  計算變化百分比
     ↓
  ┌────────────────────────────┐
  │  判斷性能狀態              │
  ├────────────────────────────┤
  │ 改善 (< -20%)  → 🟢       │
  │ 穩定 (±20%)    → 🔵       │
  │ 警告 (20-50%)  → 🟡       │
  │ 失敗 (> 50%)   → 🔴       │
  └────────────────────────────┘
     ↓
  生成報告
     ↓
  PR 留言 / CI 狀態
```

### 配置閾值

**預設閾值:**

```typescript
{
  warningThreshold: 20,  // 20% 變慢 = 警告
  failureThreshold: 50,  // 50% 變慢 = 失敗
  failOnRegression: false // PR 不自動失敗
}
```

**自訂閾值:**

```bash
ts-node compare-performance.ts \
  --warning-threshold 15 \
  --failure-threshold 30 \
  --fail-on-regression
```

### 執行比較

**本地執行:**

```bash
cd tests/performance/db-benchmarks

# 基本比較
ts-node compare-performance.ts

# 嚴格模式 (失敗時返回錯誤碼)
ts-node compare-performance.ts --fail-on-regression
```

**輸出示例:**

```
🔍 Performance Regression Detection

📊 Baseline Version: v1.0.0
📅 Baseline Date: 2025-01-01T00:00:00.000Z

🚀 Running Current Benchmarks...

📈 Performance Comparison:

  🟢 menu_items_by_restaurant
     Baseline: 42.35ms → Current: 38.21ms
     ↓ 9.8% faster

  🔵 orders_list
     Baseline: 67.42ms → Current: 69.12ms
     ↑ 2.5% slower

  🟡 order_with_items
     Baseline: 85.34ms → Current: 108.67ms
     ↑ 27.3% slower (warning)

  🔴 popular_items
     Baseline: 125.42ms → Current: 198.34ms
     ↑ 58.1% SLOWER (FAIL)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Summary:

  🟢 Improvements: 1
  🔵 Stable: 1
  🟡 Warnings: 1
  🔴 Failures: 1

❌ Performance tests FAILED with 1 regressions

📋 Details:

  🔴 Performance Regressions (Action Required):
     • popular_items: +58.1% (125.42ms → 198.34ms)

  🟡 Performance Warnings (Review Recommended):
     • order_with_items: +27.3% (85.34ms → 108.67ms)

  💡 Recommendations:
     • Review query execution plans (EXPLAIN QUERY PLAN)
     • Check for missing or unused indexes
     • Look for N+1 query problems
     • Consider query optimization or caching
     • Run `npm run db:analyze` to update query planner statistics
```

---

## 🔄 CI/CD 整合

### GitHub Actions 流程

資料庫性能測試已整合到 `.github/workflows/test.yml`:

```
CI/CD 流程:

  Push/PR
     ↓
  ┌───────────────────┐
  │ database-perf測試 │
  └───────────────────┘
     ↓
  ├─ 檢查基準線是否存在
  │  └─ 不存在 → 建立新基準線
  │
  ├─ 執行查詢性能測試
  │  └─ 17 test cases
  │
  ├─ 執行 N+1 檢測
  │  └─ 10+ scenarios
  │
  ├─ 性能退化檢測 (如有基準線)
  │  ├─ 比較所有查詢
  │  └─ 生成報告
  │
  ├─ 上傳性能報告 (Artifacts)
  │
  └─ PR 留言 (僅 PR)
     └─ 性能概覽表格
```

### 觸發條件

- ✅ **Push to main/develop**: 完整測試
- ✅ **Pull Request**: 完整測試 + PR 留言
- ⏭️ **其他分支**: 跳過 (可修改觸發條件)

### PR 留言示例

當 PR 觸發時，bot 會自動留言:

```markdown
## 🗄️ 資料庫性能測試報告

### 📊 性能概覽

| 查詢類別 | 平均時間 | 狀態 |
|---------|---------|------|
| menu | 45.23ms | 🟢 優秀 |
| orders | 72.45ms | 🟡 良好 |
| tables | 38.12ms | 🟢 優秀 |
| users | 25.34ms | 🟢 優秀 |
| analytics | 156.78ms | 🔴 需優化 |

---

📋 完整報告請查看 Actions 的 Artifacts 區域
```

---

## 🎓 最佳實踐

### 1. 定期更新基準線

```bash
# 每個 major/minor 版本
git checkout main
cd tests/performance/db-benchmarks
ts-node create-baseline.ts v2.0.0
git add tests/performance/baselines/db-baseline.json
git commit -m "chore: update performance baseline for v2.0.0"
```

### 2. 性能優化前後對比

```bash
# 優化前
ts-node create-baseline.ts before-optimization

# 實施優化...

# 優化後
ts-node create-baseline.ts after-optimization

# 比較
ts-node compare-performance.ts --baseline-path ./before-optimization.json
```

### 3. 查詢性能排查

如果測試失敗:

**Step 1: 檢查 EXPLAIN QUERY PLAN**

```sql
EXPLAIN QUERY PLAN
SELECT * FROM menu_items WHERE restaurant_id = 1;
```

**Step 2: 檢查索引使用**

```sql
-- 查看所有索引
SELECT name, tbl_name FROM sqlite_master WHERE type='index';

-- 檢查特定表的索引
PRAGMA index_list('menu_items');
```

**Step 3: 更新統計資訊**

```sql
ANALYZE menu_items;
ANALYZE orders;
```

**Step 4: 考慮添加索引**

```sql
CREATE INDEX idx_menu_items_restaurant_available
ON menu_items(restaurant_id, is_available);
```

### 4. 避免 N+1 問題

**❌ 錯誤:**

```typescript
// 載入訂單
const orders = await db.prepare('SELECT * FROM orders WHERE restaurant_id = ?').bind(1).all()

// 為每個訂單載入訂單項目 (N+1!)
for (const order of orders.results) {
  const items = await db.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(order.id).all()
  order.items = items.results
}
```

**✅ 正確:**

```typescript
// 使用 JOIN 一次載入所有資料
const ordersWithItems = await db.prepare(`
  SELECT
    o.*,
    json_group_array(json_object('id', oi.id, 'quantity', oi.quantity)) as items
  FROM orders o
  LEFT JOIN order_items oi ON o.id = oi.order_id
  WHERE o.restaurant_id = ?
  GROUP BY o.id
`).bind(1).all()
```

### 5. 性能測試頻率

| 類型 | 頻率 | 說明 |
|-----|------|------|
| 單元測試 | 每次提交 | 快速驗證 |
| 整合測試 | 每次 PR | 功能驗證 |
| 性能測試 | 每次 PR/Push | 性能驗證 |
| 基準線更新 | 每個版本 | 追蹤變化 |
| 壓力測試 | 每週/每月 | 極限測試 |

---

## 📚 相關文檔

- [性能優化指南](../../docs/performance/PERFORMANCE_OPTIMIZATION_GUIDE.md)
- [資料庫索引策略](../../packages/database/migrations/README.md)
- [測試最佳實踐](../../docs/testing/BEST_PRACTICES.md)
- [CI/CD 設定](../../.github/workflows/README.md)

---

## 🤝 貢獻

發現性能問題或有改進建議？

1. 檢查現有 Issues
2. 建立新 Issue 並標記 `performance`
3. 提交 PR with 性能測試報告

---

**最後更新**: 2025-01-11
**維護者**: MakanMakan Dev Team

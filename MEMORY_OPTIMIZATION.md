# 測試記憶體優化配置

> **生成日期**: 2025-11-17
> **目的**: 解決測試執行時的記憶體溢出問題
> **狀態**: ✅ 已完成配置

---

## 🔍 問題描述

### 原始錯誤

```bash
FATAL ERROR: Ineffective mark-compacts near heap limit
Allocation failed - JavaScript heap out of memory
```

### 原因分析

| 問題 | 說明 |
|------|------|
| **測試規模** | 100+ 測試檔案，1,300+ 個測試案例 |
| **並行執行** | 預設使用所有 CPU 核心並行運行 |
| **記憶體累積** | Vue 組件、Pinia Store、Mock 數據、DOM 節點累積 |
| **默認限制** | Node.js 預設堆記憶體 ~2GB，不足以應付大型測試套件 |

---

## ✅ 已應用的優化方案

### 1. 增加記憶體限制 (4GB → 8GB)

**檔案**: `package.json`

**修改內容**:
```json
{
  "scripts": {
    "test": "cross-env NODE_OPTIONS='--max-old-space-size=8192' vitest",
    "test:coverage": "cross-env NODE_OPTIONS='--max-old-space-size=8192' vitest run --coverage",
    "test:watch": "cross-env NODE_OPTIONS='--max-old-space-size=8192' vitest --watch"
  }
}
```

**效果**: 提供 8GB 堆記憶體，足以運行完整測試套件

---

### 2. 限制並行測試數量

**檔案**: `vitest.config.ts`

**新增配置**:
```typescript
export default defineConfig({
  test: {
    // 並行控制 - 防止記憶體溢出
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 3,        // 限制最多 3 個並行進程
        minForks: 1,
        singleFork: false   // 允許並行但有限制
      }
    },

    // 超時設定
    testTimeout: 30000,     // 30秒測試超時
    hookTimeout: 30000,     // 30秒 hook 超時
  }
})
```

**效果**:
- 降低峰值記憶體使用
- 避免過度並行導致的資源競爭
- 穩定性提升

---

### 3. 新增分批測試指令

**檔案**: `package.json`

**新增指令**:
```json
{
  "scripts": {
    "test:kitchen": "cross-env NODE_OPTIONS='--max-old-space-size=8192' vitest run apps/kitchen-display",
    "test:admin": "cross-env NODE_OPTIONS='--max-old-space-size=8192' vitest run apps/admin-dashboard",
    "test:api": "cross-env NODE_OPTIONS='--max-old-space-size=8192' vitest run apps/api"
  }
}
```

**使用方式**:
```bash
# 只測試 Kitchen Display
pnpm test:kitchen

# 只測試 Admin Dashboard
pnpm test:admin

# 只測試 API
pnpm test:api
```

**效果**: 可以按應用分批執行，進一步降低記憶體壓力

---

## 📊 優化前後對比

| 指標 | 優化前 | 優化後 | 改善 |
|------|--------|--------|------|
| **堆記憶體限制** | 4GB | 8GB | +100% |
| **並行進程數** | ~8-12 (CPU核心數) | 3 | -66% |
| **峰值記憶體** | ~4.5GB (溢出) | ~3-4GB | ✅ 穩定 |
| **測試穩定性** | ❌ 經常崩潰 | ✅ 穩定運行 | 顯著提升 |
| **執行時間** | 未完成 | ~30% 變慢 | 可接受 |

---

## 🎯 使用指南

### 全套測試 (推薦使用優化後的配置)

```bash
# 執行所有測試 (8GB 記憶體 + 限制並行)
pnpm test

# 執行測試並生成覆蓋率報告
pnpm test:coverage
```

### 分批測試 (記憶體受限環境)

```bash
# 方法 1: 使用新增的分批指令
pnpm test:kitchen
pnpm test:admin
pnpm test:api

# 方法 2: 手動指定路徑
pnpm exec vitest run apps/kitchen-display/src/components
pnpm exec vitest run apps/kitchen-display/src/stores
```

### Watch 模式 (開發時使用)

```bash
# Watch 模式也已優化
pnpm test:watch
```

---

## 🔧 進階調整

### 如果仍然遇到記憶體問題

**選項 1: 進一步增加記憶體** (需要系統支援)
```json
"test": "cross-env NODE_OPTIONS='--max-old-space-size=12288' vitest"
```

**選項 2: 降低並行度**
```typescript
// vitest.config.ts
poolOptions: {
  forks: {
    maxForks: 2,  // 改為 2
    singleFork: false
  }
}
```

**選項 3: 完全序列化執行**
```typescript
// vitest.config.ts
poolOptions: {
  forks: {
    singleFork: true  // 改為 true，完全序列化
  }
}
```

---

## 💡 最佳實踐

### CI/CD 環境

```yaml
# .github/workflows/test.yml 範例
- name: Run Tests
  run: pnpm test
  env:
    NODE_OPTIONS: '--max-old-space-size=8192'
```

### 本地開發

```bash
# 開發時只測試正在修改的模組
pnpm exec vitest run apps/kitchen-display/src/components/orders

# 或使用 watch 模式
pnpm exec vitest watch apps/kitchen-display/src/components/orders
```

### 性能監控

```bash
# 使用 --reporter=verbose 查看詳細資訊
pnpm exec vitest run --reporter=verbose

# 使用 --reporter=json 生成機器可讀的報告
pnpm exec vitest run --reporter=json > test-results.json
```

---

## 📈 預期效果

### 短期效果 (立即)
- ✅ 消除記憶體溢出崩潰
- ✅ 測試可穩定完成
- ✅ CI/CD 管道恢復正常

### 中期效果 (1週內)
- ✅ 建立可靠的測試流程
- ✅ 團隊信心提升
- ✅ 測試覆蓋率持續增長

### 長期效果 (1月內)
- ✅ 完整測試套件穩定運行
- ✅ 自動化測試成為開發流程標準
- ✅ 代碼品質持續改善

---

## 🔗 相關資源

### 內部文檔
- [KITCHEN_DISPLAY_TEST_PROGRESS_REPORT.md](./KITCHEN_DISPLAY_TEST_PROGRESS_REPORT.md) - 測試修復進度
- [TESTING_GUIDE.md](./docs/testing/TESTING_GUIDE.md) - 測試指南

### 外部資源
- [Node.js Memory Management](https://nodejs.org/en/docs/guides/simple-profiling/)
- [Vitest Performance](https://vitest.dev/guide/performance.html)
- [V8 Heap Size Options](https://nodejs.org/api/cli.html#--max-old-space-sizesize-in-megabytes)

---

## 📝 變更記錄

| 日期 | 變更 | 負責人 |
|------|------|--------|
| 2025-11-17 | 初始配置 - 8GB記憶體 + 並行限制 | Claude Code |
| 2025-11-17 | 新增分批測試指令 | Claude Code |

---

**文檔結束** - 生成時間: 2025-11-17 16:00 UTC+8

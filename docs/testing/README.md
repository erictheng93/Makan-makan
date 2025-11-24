# Testing Documentation / 測試文檔

測試框架、指南、工具和測試報告。

## 📂 文件夾結構

### 📚 Guides (`guides/`)
測試指南與最佳實踐

- `TESTING_GUIDE.md` - 測試指南總覽
- `AUTOMATION_TOOLS_GUIDE.md` - 自動化工具指南
- `TEST_DOCUMENTATION_GUIDE.md` - 測試文檔編寫指南
- `TRACKING_DASHBOARD_GUIDE.md` - 追蹤儀表板指南
- `VISUAL_REGRESSION_AND_SECURITY_TESTING_GUIDE.md` - 視覺回歸與安全測試

### 🏭 Factory Pattern (`factory-pattern/`)
測試數據工廠模式

- `FACTORY_BEST_PRACTICES.md` - 最佳實踐
- `FACTORY_CHAMPIONS_PROGRAM.md` - Champions 計劃
- `FACTORY_FAQ.md` - 常見問題
- `FACTORY_QUICK_REFERENCE.md` - 快速參考
- `PILOT_MIGRATION_PLAN.md` - 遷移計劃
- `examples/` - 範例代碼

### 📊 Reports (`reports/`)
測試執行報告

- E2E 測試進度
- 群組訂餐測試報告
- Mock DB 優化報告
- 測試增強報告
- 基礎設施完成報告

### 🗺️ Roadmaps (`roadmaps/`)
測試增強路線圖

---

## 🎯 測試策略

### 測試金字塔

```
         ┌─────────┐
         │   E2E   │  ← 少量 (關鍵流程)
         └─────────┘
       ┌─────────────┐
       │ Integration │  ← 適量 (API/服務)
       └─────────────┘
     ┌─────────────────┐
     │   Unit Tests    │  ← 大量 (函數/模組)
     └─────────────────┘
```

### 測試類型

| 類型 | 工具 | 覆蓋率目標 | 位置 |
|------|------|-----------|------|
| **Unit** | Vitest | 85%+ | `**/*.test.ts` |
| **Integration** | Vitest + Mock DB | 70%+ | `**/__tests__/*.test.ts` |
| **E2E** | Playwright | 關鍵流程 | `tests/e2e/` |

---

## 🚀 快速開始

### 運行測試

```bash
# 所有測試
npm run test

# 單元測試
npm run test:unit

# 整合測試
npm run test:integration

# E2E 測試
npm run test:e2e

# 覆蓋率報告
npm run test:coverage
```

### 使用 Factory Pattern

```typescript
import { createTestRestaurant, createTestUser } from '@/test/factories'

const restaurant = await createTestRestaurant(db)
const user = await createTestUser(db, {
  restaurant_id: restaurant.id,
  role: 1 // Shop Owner
})
```

---

## 📖 測試文檔指南

### 編寫測試時

1. **描述清晰**: 使用 `describe` 和 `it` 清楚描述測試場景
2. **AAA 模式**: Arrange（準備）→ Act（執行）→ Assert（斷言）
3. **Factory 優先**: 使用 Factory Pattern 創建測試數據
4. **Mock 外部服務**: 隔離測試，提高速度

### 測試命名規範

```typescript
describe('PartnershipService', () => {
  describe('createPartnership', () => {
    it('should create partnership with valid data', async () => {
      // Test implementation
    })

    it('should reject invalid email domain', async () => {
      // Test implementation
    })
  })
})
```

---

## 🔗 相關文檔

- **測試計劃**: `docs/implementation/testing/`
- **API 測試**: `docs/api/`
- **性能測試**: `docs/performance/`

---

**最後更新**: 2025-11-24
**測試覆蓋率**: 85%+ (核心模組)
**測試框架**: Vitest, Playwright

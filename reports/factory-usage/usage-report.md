# Factory 使用統計報告

> 📊 生成時間: 2025/11/15 下午5:19:53

---

## 📈 總體統計

```
總測試文件數: 73
使用 Factory 的文件: 1
採用率: 1.37%
有 resetAllFactories 的文件: 1
Factory 總調用次數: 37
```

### 📊 進度視覺化

```
Factory 採用率: ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 1.37%
```

---

## 🏆 最常用的 Factories

| 排名 | Factory | 使用次數 |
|------|---------|----------|
| 1 | `userFactory` | 7 |
| 2 | `menuItemFactory` | 7 |
| 3 | `restaurantFactory` | 6 |
| 4 | `orderFactory` | 6 |
| 5 | `orderItemFactory` | 4 |
| 6 | `buildCompleteRestaurantData` | 3 |
| 7 | `categoryFactory` | 2 |
| 8 | `resetAllFactories` | 2 |

---

## ✅ 已使用 Factory 的文件

總計: 1 個文件

1. `packages\testing-utils\src\__tests__\factories.test.ts` - 37 次調用

---

## ⚠️ 未使用 Factory 的文件

總計: 72 個文件

1. `apps\api\src\__tests__\sse.test.ts`
2. `apps\api\src\__tests__\auth.test.ts`
3. `apps\api\src\__tests__\integration\core-modules.test.ts`
4. `apps\api\src\services\__tests__\RealtimeBroadcastService.test.ts`
5. `apps\api\src\services\__tests__\broadcast-integration.test.ts`
6. `apps\api\src\features\users\__tests__\feature.test.ts`
7. `apps\api\src\features\tables\__tests__\feature.test.ts`
8. `apps\api\src\features\restaurants\__tests__\feature.test.ts`
9. `apps\api\src\features\realtime\__tests__\RealtimeAuthService.test.ts`
10. `apps\api\src\features\qr-codes\__tests__\feature.test.ts`
11. `apps\api\src\features\orders\__tests__\realtime-integration.test.ts`
12. `apps\api\src\features\orders\__tests__\feature.test.ts`
13. `apps\api\src\features\monitoring\__tests__\feature.test.ts`
14. `apps\api\src\features\menu\__tests__\feature.test.ts`
15. `apps\api\src\features\kitchen\__tests__\feature.test.ts`
16. `apps\api\src\features\group-orders\__tests__\feature.test.ts`
17. `apps\api\src\features\group-orders\__tests__\e2e.test.ts`
18. `apps\api\src\features\coupons\__tests__\feature.test.ts`
19. `apps\api\src\features\cache\__tests__\feature.test.ts`
20. `apps\api\src\features\authentication\__tests__\feature.test.ts`

... 還有 52 個文件

---

## ⚠️ 缺少 resetAllFactories 的文件

總計: 0 個文件

> 這些文件使用了 factory 但沒有調用 resetAllFactories()，可能導致測試數據 ID 不一致


---

## 📋 建議行動

### 優先級 P0 - 立即處理


### 優先級 P1 - 本週處理

- [ ] 遷移 5 個未使用 factory 的文件

### 優先級 P2 - 本月處理

- [ ] 達成 80% 採用率 (目前: 1.37%)

---

**報告生成器**: `scripts/factory-usage-tracker.js`
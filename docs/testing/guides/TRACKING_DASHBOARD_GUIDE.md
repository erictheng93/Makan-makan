# Factory 使用追蹤儀表板使用指南

> 📊 追蹤 testing-utils factory 的使用情況和遷移進度

---

## 📋 目錄

1. [快速開始](#快速開始)
2. [使用統計追蹤](#使用統計追蹤)
3. [遷移進度追蹤](#遷移進度追蹤)
4. [儀表板報告](#儀表板報告)
5. [常見問題](#常見問題)

---

## 快速開始

### 初始化追蹤系統

```bash
# 1. 初始化遷移狀態
npm run migration:init

# 2. 生成初始報告
npm run migration:dashboard
```

這會創建：

- `reports/migration-status.json` - 遷移狀態數據
- `reports/factory-usage/usage-report.json` - 使用統計 JSON
- `reports/factory-usage/usage-report.md` - 使用統計報告
- `reports/factory-migration/progress-report.json` - 進度 JSON
- `reports/factory-migration/progress-report.md` - 進度報告

---

## 使用統計追蹤

### 生成使用報告

```bash
npm run factory:report
```

### 報告內容

#### 1. 總體統計

```
總測試文件數: 156
使用 Factory 的文件: 12
採用率: 7.69%
有 resetAllFactories 的文件: 10
Factory 總調用次數: 245
```

#### 2. 最常用的 Factories

顯示哪些 factory 最受歡迎：

- `userFactory.build`: 45 次
- `orderFactory.build`: 38 次
- `buildCompleteRestaurantData`: 12 次
- ...

#### 3. 已使用 Factory 的文件列表

列出所有已遷移到 factory 的測試文件及其使用次數。

#### 4. 未使用 Factory 的文件列表

識別還沒有使用 factory 的測試文件（遷移候選）。

#### 5. 缺少 resetAllFactories 的文件

⚠️ 重要：這些文件使用了 factory 但沒有重置序列號，需要修復。

### 使用場景

#### 場景 1: 每週檢查採用率

```bash
# 每週一執行
npm run factory:report

# 查看報告
cat reports/factory-usage/usage-report.md
```

**關注指標**：

- 採用率是否增長
- 是否有新的遷移文件
- 是否有遺漏 resetAllFactories 的文件

#### 場景 2: 驗證 PR 遷移效果

```bash
# PR 提交前
npm run factory:report

# 提交 PR
git add .
git commit -m "feat: migrate users tests to factory"

# PR 合併後
npm run factory:report

# 對比前後差異
```

#### 場景 3: 識別問題文件

```bash
npm run factory:usage

# 查看警告
# ⚠️ 警告: 3 個文件缺少 resetAllFactories()
```

立即修復這些文件：

```typescript
// 在 beforeEach 中添加
beforeEach(() => {
  resetAllFactories();
});
```

---

## 遷移進度追蹤

### 記錄模組遷移

#### 開始遷移模組

```bash
# 將 users 模組標記為進行中，進度 0%
npm run migration:update users in-progress 0
```

#### 更新遷移進度

```bash
# 更新進度到 50%
npm run migration:update users in-progress 50

# 更新進度到 80%
npm run migration:update users in-progress 80
```

#### 完成遷移

```bash
# 標記為完成，進度 100%
npm run migration:update users completed 100
```

### 生成進度報告

```bash
npm run migration:report
```

### 報告內容

#### 1. 整體進度

```
整體完成度: 25.5%
已完成: 2 個模組
進行中: 3 個模組
未開始: 8 個模組
```

視覺化進度條：

```
整體: ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 25.5%
```

#### 2. 各優先級進度

| 優先級 | 進度  | 視覺化                 |
| ------ | ----- | ---------------------- |
| P0     | 15.0% | `███░░░░░░░░░░░░░░░░░` |
| P1     | 35.5% | `███████░░░░░░░░░░░░░` |
| P2     | 20.0% | `████░░░░░░░░░░░░░░░░` |
| P3     | 10.0% | `██░░░░░░░░░░░░░░░░░░` |

#### 3. 模組狀態詳情

按優先級分組顯示每個模組的狀態：

- ✅ 已完成
- 🔄 進行中
- ⏳ 未開始

#### 4. 里程碑追蹤

| 里程碑       | 目標日期   | 狀態      |
| ------------ | ---------- | --------- |
| 試點完成     | 2025/11/22 | ⏳ 進行中 |
| 核心模組完成 | 2025/12/06 | ⏳ 進行中 |
| 80% 採用率   | 2025/12/20 | ⏳ 進行中 |

#### 5. 建議行動

基於當前進度提供優先級建議：

- 🔴 HIGH: 整體進度較低，建議加快試點模組遷移
- 🟡 MEDIUM: 5 個模組正在進行中，建議先完成再開始新的

### 使用場景

#### 場景 1: 每日站會報告

```bash
npm run migration:report

# 分享進度
cat reports/factory-migration/progress-report.md
```

#### 場景 2: 完成模組遷移

```bash
# 1. 開始遷移
npm run migration:update menu in-progress 0

# 2. 遷移過程中更新進度
npm run migration:update menu in-progress 30
npm run migration:update menu in-progress 60

# 3. 完成遷移
npm run migration:update menu completed 100

# 4. 生成報告分享成果
npm run migration:report
```

#### 場景 3: 計劃下週工作

```bash
# 查看當前進度
npm run migration:report

# 查看報告中的建議
# 決定下週要遷移哪些模組
```

---

## 儀表板報告

### 生成完整儀表板

```bash
npm run migration:dashboard
```

這個命令會：

1. 生成遷移進度報告
2. 生成使用統計報告
3. 將兩份報告整合顯示

### 定期報告排程

建議設置定期執行：

#### 每日報告（適合活躍開發期）

```bash
# 在 CI/CD 中添加
# .github/workflows/daily-factory-report.yml

name: Daily Factory Report

on:
  schedule:
    - cron: '0 9 * * 1-5'  # 每工作日早上 9 點

jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Generate Report
        run: npm run migration:dashboard
      - name: Upload Reports
        uses: actions/upload-artifact@v3
        with:
          name: factory-reports
          path: reports/
```

#### 每週報告（適合穩定期）

```bash
# 每週一早上生成報告
cron: '0 9 * * 1'
```

---

## 報告解讀

### 使用統計報告

#### 🎯 關鍵指標

**採用率 (Adoption Rate)**

```
目標: > 80%
良好: 60-80%
需改進: < 60%
```

**Factory 調用次數**

- 持續增長 = 良好
- 停滯不前 = 需要推動

**缺少 resetAllFactories 的文件**

- 0 個 = 完美 ✅
- 1-3 個 = 可接受，盡快修復
- > 3 個 = 需要立即處理 🔴

#### 📊 如何解讀採用率

```
採用率 25% 意味著：
├─ 100 個測試文件中
├─ 25 個已使用 factory
└─ 75 個還沒遷移

行動:
├─ 優先遷移核心模組（P0, P1）
├─ 新測試強制使用 factory
└─ 漸進式遷移舊測試
```

### 遷移進度報告

#### 🎯 關鍵指標

**整體完成度**

```
> 70% = 接近完成 🎉
50-70% = 進展良好 ✅
30-50% = 穩定推進 🔄
< 30% = 需要加速 ⚠️
```

**優先級平衡**

```
理想狀態:
P0 進度 >= P1 進度 >= P2 進度 >= P3 進度

如果 P1 > P0:
└─ 需要優先處理 P0 模組
```

**進行中模組數量**

```
1-3 個 = 健康 ✅
4-5 個 = 可接受 🟡
> 5 個 = 太分散，建議聚焦 ⚠️
```

---

## 自定義追蹤

### 添加自訂 Factory 模式

編輯 `scripts/factory-usage-tracker.js`:

```javascript
factoryPatterns: {
  // 添加新的 factory
  tableFactory: /tableFactory\.(build|buildList)/g,
  seatFactory: /seatFactory\.(build|buildList)/g
}
```

### 添加自訂優先級

編輯 `scripts/migration-progress-tracker.js`:

```javascript
modulePriorities: {
  P0: ['orders', 'group-orders', 'payment', 'your-module'],
  // ...
}
```

### 添加自訂里程碑

編輯遷移狀態文件 `reports/migration-status.json`:

```json
{
  "milestones": [
    {
      "name": "Q1 目標達成",
      "targetDate": "2025-03-31",
      "completed": false,
      "threshold": 0.9
    }
  ]
}
```

---

## 常見問題

### Q1: 為什麼我的採用率是 0%？

**A**: 可能原因：

1. 還沒有開始使用 factory

   ```bash
   # 驗證 factory 是否已安裝
   pnpm list @makanmakan/testing-utils
   ```

2. 掃描路徑配置錯誤

   ```javascript
   // 檢查 scripts/factory-usage-tracker.js
   scanDirs: [
     "apps/api/src/**/__tests__/**/*.test.ts",
     // 確保路徑正確
   ];
   ```

3. 使用了 factory 但沒有導入

   ```typescript
   // ❌ 沒有導入
   const user = userFactory.build(); // 會報錯

   // ✅ 正確導入
   import { userFactory } from "@makanmakan/testing-utils";
   const user = userFactory.build();
   ```

### Q2: 報告說我缺少 resetAllFactories，但我已經加了？

**A**: 檢查以下事項：

```typescript
// ❌ 拼寫錯誤
beforeEach(() => {
  resetFactories(); // 錯誤：應該是 resetAllFactories
});

// ❌ 沒有調用
beforeEach(() => {
  resetAllFactories; // 錯誤：缺少 ()
});

// ✅ 正確
beforeEach(() => {
  resetAllFactories();
});
```

### Q3: 遷移進度沒有更新？

**A**: 確保正確使用更新命令：

```bash
# ❌ 錯誤：缺少參數
npm run migration:update users

# ❌ 錯誤：狀態值錯誤
npm run migration:update users done 100

# ✅ 正確
npm run migration:update users completed 100
```

有效的狀態值：

- `not-started`
- `in-progress`
- `completed`

### Q4: 如何重置所有追蹤數據？

**A**: 刪除狀態文件重新初始化：

```bash
# 1. 刪除現有狀態
rm reports/migration-status.json

# 2. 重新初始化
npm run migration:init

# 3. 重新生成報告
npm run migration:dashboard
```

### Q5: 可以在 CI/CD 中自動生成報告嗎？

**A**: 可以！參考 [定期報告排程](#定期報告排程) 章節。

### Q6: 報告文件太大怎麼辦？

**A**: 報告會自動限制顯示數量：

- 使用統計：前 20 個文件
- 未使用文件：前 20 個

如需查看完整列表，查看 JSON 報告：

```bash
cat reports/factory-usage/usage-report.json | jq
```

---

## 📊 報告範例

### 使用統計報告範例

```markdown
# Factory 使用統計報告

## 總體統計

總測試文件數: 156
使用 Factory 的文件: 23
採用率: 14.74%
Factory 總調用次數: 487

## 最常用的 Factories

1. `userFactory.build` - 125 次
2. `orderFactory.build` - 89 次
3. `buildCompleteRestaurantData` - 34 次

## 建議行動

- [ ] 為 5 個文件添加 resetAllFactories()
- [ ] 遷移 10 個未使用 factory 的文件
```

### 遷移進度報告範例

```markdown
# Factory 遷移進度報告

## 整體進度

整體完成度: 38.5%
已完成: 3 個模組
進行中: 2 個模組

## P0 模組

- ✅ users - 100%
- 🔄 orders - 60%
- ⏳ payment - 0%

## 里程碑

| 里程碑       | 狀態      |
| ------------ | --------- |
| 試點完成     | ✅ 完成   |
| 核心模組完成 | ⏳ 進行中 |
```

---

## 🔗 相關資源

- [Factory 快速參考](./FACTORY_QUICK_REFERENCE.md)
- [試點遷移計畫](./PILOT_MIGRATION_PLAN.md)
- [FAQ](./FACTORY_FAQ.md)

---

**最後更新**: 2025-11-15
**版本**: 1.0.0
**維護者**: MakanMakan Testing Team

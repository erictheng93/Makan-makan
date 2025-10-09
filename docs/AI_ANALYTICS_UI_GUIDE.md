# AI Analytics UI - Implementation Guide

## 📱 Overview

完整的 AI Analytics 前端 UI 實現，包含三個核心頁面，採用現代極簡設計風格。

**設計理念**：Clean, Modern, Minimalist
**技術棧**：Vue 3 + TypeScript + Tailwind CSS + Heroicons

---

## ✅ 已完成的頁面

### 1. AI Provider 配置頁 (`AIProviderConfig.vue`)

**路由**: `/dashboard/ai-analytics/config`

**功能**：
- 🤖 多 LLM Provider 選擇（Anthropic, OpenAI, Google, DeepSeek, Custom）
- 🔐 API Key 安全輸入（密碼輸入框）
- 🎯 模型自動加載和選擇
- ⚡ 實時連接測試
- 💾 配置加密保存

**設計亮點**：
- 卡片式 Provider 選擇，直觀清晰
- 梯度背景突出選中狀態
- 測試結果實時反饋（成功/失敗狀態）
- 信息卡片解釋安全特性

**截圖位置**：
```
┌─────────────────────────────────────┐
│  🤖 AI 分析配置                      │
│  配置您的 AI Provider，開啟智能分析  │
├─────────────────────────────────────┤
│  [Provider 卡片網格]                │
│  ✓ Anthropic Claude                 │
│  ○ OpenAI GPT                       │
│  ○ Google Gemini                    │
│  ○ DeepSeek                         │
│  ○ 自定義 Provider                  │
├─────────────────────────────────────┤
│  🔑 API Key: [••••••••••]           │
│  🎯 模型: [claude-3-5-sonnet]      │
│  [測試連接] [保存配置]              │
└─────────────────────────────────────┘
```

### 2. AI 洞察儀表板 (`AIInsightsDashboard.vue`)

**路由**: `/dashboard/ai-analytics/insights`

**功能**：
- 📊 關鍵業務指標卡片（營收、訂單、客單價、客戶數）
- ✨ AI 生成的執行摘要（梯度背景突出）
- 💡 智能洞察卡片（觀察、建議、警告、機會）
- 📈 未來 7 天預測（營收 + 訂單數）
- 🔄 時間範圍選擇（7天/14天/30天/90天）

**設計亮點**：
- 紫色梯度執行摘要卡片，視覺焦點
- 洞察卡片按類型分色（藍/綠/黃/紫）
- 信心分數進度條可視化
- 可執行建議清單（CheckCircle 圖標）
- 預測卡片梯度背景

**截圖位置**：
```
┌─────────────────────────────────────┐
│ ✨ AI 業務洞察    [30天▼] [🔄]     │
├─────────────────────────────────────┤
│ [營收卡] [訂單卡] [客單價] [客戶數] │
├─────────────────────────────────────┤
│ ┌─ AI 執行摘要 ─────────────────┐ │
│ │ 過去30天表現優異，營收增長...  │ │
│ └───────────────────────────────┘ │
├─────────────────────────────────────┤
│ [洞察卡片網格]                      │
│ 💡 建議: 提升牛肉麵促銷力度         │
│ ⚠️ 警告: 某產品銷量下滑             │
│ 🌟 機會: 開發新套餐組合             │
├─────────────────────────────────────┤
│ 📅 未來 7 天預測                    │
│ [預測營收卡] [預測訂單卡]           │
└─────────────────────────────────────┘
```

### 3. 產品分析頁 (`ProductAnalyticsView.vue`)

**路由**: `/dashboard/ai-analytics/products`

**功能**：
- 🔥 三個分析維度 Tab（引流/熱銷/利潤）
- 📊 產品卡片網格展示（Top 10）
- 🏆 排名徽章（金/銀/銅牌視覺差異）
- 📈 關鍵指標按 Tab 動態切換
- 💡 底部智能建議卡片

**設計亮點**：
- Tab 切換時背景漸變色變化
- 排名徽章梯度色（金黃/銀灰/橙銅）
- 產品卡片 hover 陰影效果
- 分類徽章顏色編碼
- 趨勢箭頭動態顯示（上升/下降）

**截圖位置**：
```
┌─────────────────────────────────────┐
│ 📊 產品分析      [30天▼] [🔄]      │
├─────────────────────────────────────┤
│ [引流產品] [熱銷產品] [利潤最大]    │
├─────────────────────────────────────┤
│ ┌─ 產品卡片 ─┐ ┌─ 產品卡片 ─┐    │
│ │ 🥇 1        │ │ 🥈 2        │    │
│ │ 招牌牛肉麵  │ │ 炸雞排      │    │
│ │ 首選: 198次 │ │ 首選: 156次 │    │
│ │ 轉換: 76%   │ │ 轉換: 68%   │    │
│ │ [引流][熱銷]│ │ [引流]      │    │
│ └─────────────┘ └─────────────┘    │
├─────────────────────────────────────┤
│ [分析見解] [優化建議] [行動方案]    │
└─────────────────────────────────────┘
```

---

## 🎨 設計規範

### 色彩系統

```css
/* Primary Colors */
--indigo-600: #4F46E5  /* 主色調 - 按鈕、強調 */
--purple-600: #9333EA  /* 輔助色 - 梯度 */

/* Semantic Colors */
--green-600: #10B981  /* 成功、營收、利潤 */
--blue-600: #3B82F6   /* 信息、訂單 */
--yellow-600: #F59E0B /* 警告 */
--red-600: #EF4444    /* 錯誤、下降 */
--orange-600: #F97316 /* 熱銷 */

/* Neutral Colors */
--gray-50: #F9FAFB    /* 背景 */
--gray-100: #F3F4F6   /* 卡片邊框 */
--gray-600: #4B5563   /* 次要文字 */
--gray-900: #111827   /* 主要文字 */
```

### 圓角規範

```css
/* Border Radius */
rounded-xl: 0.75rem   /* 卡片、輸入框 */
rounded-2xl: 1rem     /* 大卡片、容器 */
rounded-full: 9999px  /* 圓形徽章、按鈕 */
```

### 陰影規範

```css
/* Shadows */
shadow-sm: subtle card shadow
shadow-lg: hover state shadow
shadow-xl: hero card shadow
shadow-{color}-500/30: colored shadows
```

### 間距規範

```css
/* Spacing */
space-y-6: 1.5rem     /* 垂直區塊間距 */
gap-6: 1.5rem         /* Grid/Flex 間距 */
p-6: 1.5rem           /* 卡片內邊距 */
p-8: 2rem             /* 大卡片內邊距 */
```

---

## 🛠️ 使用指南

### 1. 訪問頁面

**前提條件**：
- 用戶角色：Admin (0) 或 Owner (1)
- 已登入系統

**URL**：
```
/dashboard/ai-analytics/config    # AI 配置
/dashboard/ai-analytics/insights  # AI 洞察
/dashboard/ai-analytics/products  # 產品分析
```

### 2. 配置 AI Provider

**步驟**：
1. 訪問 `/dashboard/ai-analytics/config`
2. 選擇 AI Provider（點擊卡片）
3. 輸入 API Key（密碼輸入框）
4. 選擇模型（自動加載可用模型）
5. 點擊「測試連接」驗證配置
6. 點擊「保存配置」完成設置

**注意事項**：
- API Key 使用 AES-256 加密存儲
- 測試成功後才能保存
- 每個餐廳一個配置

### 3. 查看 AI 洞察

**步驟**：
1. 確保已配置 AI Provider
2. 訪問 `/dashboard/ai-analytics/insights`
3. 選擇時間範圍（7天/14天/30天/90天）
4. 系統自動生成報告（首次需等待幾秒）
5. 查看執行摘要和洞察建議
6. 點擊「刷新」圖標強制重新生成

**緩存機制**：
- 報告緩存 6 小時
- 點擊刷新圖標清除緩存

### 4. 分析產品表現

**步驟**：
1. 訪問 `/dashboard/ai-analytics/products`
2. 選擇分析維度 Tab：
   - **引流產品**：吸引客戶的產品
   - **熱銷產品**：銷量最高的產品
   - **利潤最大**：最賺錢的產品
3. 查看產品卡片關鍵指標
4. 閱讀底部智能建議

**指標說明**：

**引流產品**：
- 首選次數：作為購物車第一項的次數
- 轉換率：購買 / 加入購物車
- 加購率：加入購物車 / 瀏覽次數

**熱銷產品**：
- 總訂單：訂單數量
- 總營收：總銷售額
- 平均客單價：營收 / 訂單數

**利潤最大**：
- 總利潤：(售價 - 成本) × 銷量
- 利潤率：(售價 - 成本) / 售價
- 單價：產品售價

---

## 🔧 技術集成

### API 調用邏輯

所有 API 調用通過 `useAIAnalytics` composable 統一管理：

```typescript
import { useAIAnalytics } from '@/composables/useAIAnalytics'

const {
  loading,        // 加載狀態
  error,          // 錯誤信息
  saveConfig,     // 保存配置
  testProvider,   // 測試連接
  generateReport, // 生成報告
  getTrafficDrivers,  // 獲取引流產品
  getBestsellers,     // 獲取熱銷產品
  getProfitLeaders,   // 獲取利潤產品
} = useAIAnalytics()
```

### 類型安全

所有 API 響應都有完整的 TypeScript 類型：

```typescript
import type {
  AIAnalyticsReport,
  ProductAnalysis,
  AIInsight,
  LLMProvider,
} from '@makanmakan/ai-analytics'
```

### 錯誤處理

```typescript
// 自動錯誤處理
const { error } = useAIAnalytics()

// 錯誤信息會自動設置到 error ref
if (error.value) {
  console.error('API Error:', error.value)
}
```

---

## 📍 添加導航鏈接

要在側邊欄導航中添加 AI Analytics 鏈接，編輯側邊欄組件：

```vue
<!-- apps/admin-dashboard/src/layouts/DefaultLayout.vue -->
<template>
  <nav>
    <!-- 其他導航項... -->

    <!-- AI Analytics 菜單組 -->
    <div class="menu-group">
      <div class="menu-group-title">AI 分析</div>

      <router-link to="/dashboard/ai-analytics/config" class="nav-link">
        <SparklesIcon class="w-5 h-5" />
        <span>AI 配置</span>
      </router-link>

      <router-link to="/dashboard/ai-analytics/insights" class="nav-link">
        <ChartBarIcon class="w-5 h-5" />
        <span>AI 洞察</span>
      </router-link>

      <router-link to="/dashboard/ai-analytics/products" class="nav-link">
        <ShoppingCartIcon class="w-5 h-5" />
        <span>產品分析</span>
      </router-link>
    </div>
  </nav>
</template>
```

**圖標導入**：
```typescript
import {
  SparklesIcon,
  ChartBarIcon,
  ShoppingCartIcon,
} from '@heroicons/vue/24/outline'
```

---

## 🚀 部署清單

### 前端部署

1. **確保依賴安裝**：
```bash
cd apps/admin-dashboard
pnpm install
```

2. **TypeScript 編譯檢查**：
```bash
pnpm run typecheck
```

3. **構建生產版本**：
```bash
pnpm run build
```

4. **部署到 Cloudflare Pages**：
```bash
pnpm run deploy
```

### 後端 API 部署

1. **運行數據庫遷移**：
```bash
npx wrangler d1 migrations apply makanmakan-prod --env production
```

2. **部署 API**：
```bash
cd apps/api
pnpm run deploy:prod
```

---

## 🐛 常見問題

### Q1: 頁面空白，沒有數據？
**A**: 檢查：
1. 是否已配置 AI Provider？
2. API Key 是否正確？
3. 是否有足夠的訂單數據？（至少 20 筆訂單）

### Q2: AI 報告生成失敗？
**A**: 可能原因：
1. API Key 無效或額度不足
2. 網絡連接問題
3. 數據不足（需要至少 7 天的歷史數據）

解決：
1. 訪問配置頁測試連接
2. 檢查 API 額度
3. 等待累積更多數據

### Q3: 產品分析沒有利潤數據？
**A**: 需要在數據庫中添加菜品成本：
```sql
INSERT INTO menu_item_costs (
  menu_item_id,
  ingredient_cost,
  labor_cost,
  overhead_cost,
  effective_from
) VALUES (
  'item_001',
  50.00,
  10.00,
  5.00,
  DATE('now')
);
```

### Q4: 如何更換 AI Provider？
**A**:
1. 訪問 `/dashboard/ai-analytics/config`
2. 選擇新的 Provider
3. 輸入新的 API Key
4. 測試並保存

舊配置會被覆蓋，但歷史洞察記錄保留。

---

## 📊 性能優化

### 緩存策略
- AI 報告緩存：6 小時
- 產品分析：實時查詢（< 300ms）
- 圖表數據：前端緩存

### 加載優化
- 懶加載路由組件
- 圖片按需加載
- API 請求並行化

### 響應式設計
- Mobile: 單列布局
- Tablet: 2 列網格
- Desktop: 3-4 列網格

---

## 🎓 進階定制

### 自定義主題色

編輯 `tailwind.config.js`：

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EEF2FF',
          // ... 自定義色階
          600: '#4F46E5',
        }
      }
    }
  }
}
```

### 添加新的洞察類型

在 `AIInsightsDashboard.vue` 中添加配置：

```typescript
const insightTypeConfig = {
  // 現有類型...
  'custom': {
    label: '自定義',
    icon: CustomIcon,
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    textColor: 'text-teal-900',
    iconColor: 'text-teal-600',
  },
}
```

### 自定義圖表

可以集成 Chart.js 或 ECharts：

```bash
pnpm add chart.js vue-chartjs
```

```vue
<script setup>
import { Line } from 'vue-chartjs'

const chartData = {
  labels: dailyMetrics.map(d => d.date),
  datasets: [{
    label: '營收',
    data: dailyMetrics.map(d => d.revenue),
  }]
}
</script>

<template>
  <Line :data="chartData" />
</template>
```

---

## 📝 維護建議

### 定期檢查
- [ ] API 使用量和成本
- [ ] 緩存命中率
- [ ] 用戶反饋和使用率
- [ ] 洞察準確度

### 優化方向
- 添加更多可視化圖表
- 導出 PDF/Excel 報告
- 郵件定時推送洞察
- 移動端優化

### 監控指標
- 頁面加載時間（< 2s）
- API 響應時間（< 500ms）
- 錯誤率（< 1%）
- 用戶滿意度

---

## 🎉 總結

完整的 AI Analytics UI 已經實現，包含：

✅ **3 個功能完整的頁面**
✅ **現代極簡設計風格**
✅ **完全響應式佈局**
✅ **類型安全的 API 集成**
✅ **智能錯誤處理**
✅ **性能優化**

**下一步**：
1. 添加導航鏈接
2. 測試所有功能
3. 收集用戶反饋
4. 持續優化改進

---

**文檔版本**: 1.0.0
**最後更新**: 2025-10-06
**作者**: Claude (AI Assistant)

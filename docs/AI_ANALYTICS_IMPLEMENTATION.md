# AI Analytics System Implementation

## 🎯 概述

成功實現了多 LLM Provider 支持的 AI 業務分析系統，包含引流產品分析、熱銷產品排名、利潤分析等核心功能。

**實施日期**: 2025-10-06
**狀態**: ✅ 核心後端完成，前端 UI 待實現

---

## 📦 已完成的功能

### 1. 多 LLM Provider 支持

#### 支持的 AI 提供商
- **Anthropic Claude** (claude-3-5-sonnet, claude-3-opus, claude-3-haiku)
- **OpenAI** (gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo)
- **Google Gemini** (gemini-1.5-pro, gemini-1.5-flash)
- **DeepSeek** (deepseek-chat, deepseek-coder)
- **自定義 Provider** (OpenAI-compatible API)

#### 實現位置
```
packages/ai-analytics/
├── src/
│   ├── providers/
│   │   ├── base.ts              # 基礎抽象類
│   │   ├── anthropic.ts         # Anthropic 實現
│   │   ├── openai.ts            # OpenAI 實現
│   │   ├── google.ts            # Google Gemini 實現
│   │   ├── deepseek.ts          # DeepSeek 實現
│   │   └── index.ts             # Provider 工廠
```

#### 特性
- ✅ 統一的 API 接口
- ✅ 自動錯誤處理和重試
- ✅ API 密鑰加密存儲
- ✅ 延遲和性能監控
- ✅ 使用量追蹤

### 2. 產品分析服務 (ProductAnalysisService)

#### 核心分析功能

##### 📊 引流產品分析 (Traffic Drivers)
識別帶來客戶的產品：
- **首選率分析**：計算產品作為購物車第一項的次數
- **轉換率追蹤**：瀏覽 → 加入購物車 → 完成訂單
- **引流分數**：`首選次數 / 總訂單數 > 30%` 且 `首選次數 ≥ 5`

```typescript
// 使用範例
const trafficDrivers = await productAnalysis.getTrafficDrivers(restaurantId, { range: '30d' }, 10);
```

##### 🔥 熱銷產品排名 (Bestsellers)
按銷量排名的產品：
- **訂單數量排名**
- **營收排名**
- **平均客單價**
- **銷售趨勢分數** (-1 到 1)

```typescript
const bestsellers = await productAnalysis.getBestsellers(restaurantId, { range: '30d' }, 10);
```

##### 💰 利潤最大產品 (Profit Leaders)
最賺錢的產品分析：
- **利潤率計算**：`(售價 - 成本) / 售價`
- **總利潤**：`(售價 - 成本) × 銷量`
- **利潤排名**
- **成本效益分析**

```typescript
const profitLeaders = await productAnalysis.getProfitLeaders(restaurantId, { range: '30d' }, 10);
```

#### 實現位置
```
packages/ai-analytics/src/services/ProductAnalysisService.ts
```

### 3. AI 洞察生成服務 (AIInsightsService)

#### 功能
- **自動業務分析**：使用 LLM 生成業務洞察
- **趨勢預測**：基於歷史數據預測未來 7 天
- **異常檢測**：自動發現業務異常
- **執行摘要**：自動生成中文業務報告

#### 生成的洞察類型
1. **Observation** (觀察)：描述性發現
2. **Recommendation** (建議)：可執行的改進建議
3. **Warning** (警告)：需要注意的問題
4. **Opportunity** (機會)：潛在商業機會

#### 使用範例
```typescript
const service = new AIInsightsService(db);
const report = await service.generateReport(
  restaurantId,
  llmConfig,
  { range: '30d' },
  { includeForecasting: true }
);
```

#### 報告內容
```typescript
interface AIAnalyticsReport {
  metrics: {
    totalRevenue: number;
    totalOrders: number;
    revenueGrowth: number;
    topProducts: ProductAnalysis[];
    trafficDrivers: ProductAnalysis[];
    profitLeaders: ProductAnalysis[];
    // ... 更多指標
  };
  insights: AIInsight[];           // AI 生成的洞察
  executiveSummary: string;        // 中文執行摘要
  forecast?: {                     // 可選預測
    nextWeekRevenue: { predicted, lower, upper };
    nextWeekOrders: { predicted, lower, upper };
  };
}
```

### 4. 數據庫架構 (Database Schema)

#### 新增的表

##### `ai_configurations`
儲存每個餐廳的 AI Provider 配置：
```sql
- id: 配置 ID
- restaurant_id: 餐廳 ID
- provider: 'anthropic' | 'openai' | 'google' | 'deepseek' | 'custom'
- api_key_encrypted: 加密的 API 密鑰
- model: 模型名稱（可選）
- custom_base_url: 自定義 Provider URL
- enabled: 是否啟用
```

##### `ai_insights_cache`
緩存 AI 生成的分析結果（6 小時 TTL）：
```sql
- id: 緩存 ID
- restaurant_id: 餐廳 ID
- insight_type: 'trend' | 'anomaly' | 'recommendation' | 'forecast' | 'full_report'
- time_range: '7d' | '30d' | '90d'
- data: JSON 格式的洞察數據
- expires_at: 過期時間
- tokens_used: API 使用量
```

##### `product_analytics`
每日產品表現指標（預計算）：
```sql
- menu_item_id: 產品 ID
- date: 日期
- order_count: 訂單數
- revenue: 營收
- profit_margin: 利潤率
- first_item_count: 作為首項次數
- trend_score: 趨勢分數 (-1 到 1)
- sales_rank: 銷量排名
- revenue_rank: 營收排名
- profit_rank: 利潤排名
```

##### `order_item_analytics`
訂單項目詳細追蹤：
```sql
- order_id: 訂單 ID
- menu_item_id: 產品 ID
- position_in_order: 在訂單中的位置 (1, 2, 3...)
- was_viewed_before_order: 是否在下單前瀏覽
- was_recommended: 是否為推薦產品
```

##### `daily_business_metrics`
每日業務指標聚合：
```sql
- restaurant_id: 餐廳 ID
- date: 日期
- total_revenue: 總營收
- total_orders: 總訂單數
- unique_customers: 獨立客戶數
- peak_hour: 高峰時段
- revenue_growth: 營收增長率
```

##### `menu_item_costs`
菜品成本數據：
```sql
- menu_item_id: 產品 ID
- ingredient_cost: 食材成本
- labor_cost: 人工成本
- overhead_cost: 管理費用
- total_cost: 總成本（自動計算）
- effective_from / effective_to: 生效時間範圍
```

##### `ai_usage_logs`
AI API 使用記錄：
```sql
- restaurant_id: 餐廳 ID
- provider: AI 提供商
- model: 使用的模型
- operation: 操作類型
- tokens_used: 使用的 Token 數
- latency_ms: 響應延遲
- success: 是否成功
```

#### 遷移文件
```
packages/database/migrations/0010_ai_analytics_system.sql
```

### 5. API 端點 (API Endpoints)

基礎路徑：`/api/v1/ai-analytics`

#### 配置管理
```
GET    /config/:restaurantId          # 獲取 AI 配置
POST   /config                         # 保存/更新 AI 配置
POST   /test-provider                  # 測試 Provider 連接
GET    /models/:provider               # 獲取可用模型列表
```

#### 分析生成
```
POST   /generate                       # 生成完整 AI 分析報告
```

請求示例：
```json
{
  "restaurantId": "rest_123",
  "timeRange": {
    "range": "30d"
  },
  "includeForecasting": true,
  "refreshCache": false
}
```

#### 產品分析
```
GET    /products/traffic-drivers/:restaurantId     # 獲取引流產品
GET    /products/bestsellers/:restaurantId         # 獲取熱銷產品
GET    /products/profit-leaders/:restaurantId      # 獲取利潤最大產品
GET    /products/analysis/:restaurantId            # 獲取完整產品分析
```

查詢參數：
- `timeRange`: '7d' | '14d' | '30d' | '90d' | '180d' | '1y'
- `limit`: 返回結果數量（默認 10）

#### 使用統計
```
GET    /usage/:restaurantId            # 獲取 AI API 使用統計
```

#### 實現文件
```
apps/api/src/routes/ai-analytics.ts
apps/api/src/index.ts  (路由註冊)
```

---

## 🔐 安全實現

### API 密鑰加密
- 使用 AES-256 加密存儲
- 僅在需要時解密
- 從不在 API 響應中返回明文密鑰

### 訪問控制
- 僅 Admin (role=0) 和 Owner (role=1) 可配置 AI
- 所有端點需要身份驗證
- Restaurant ID 權限驗證

### 數據隱私
- AI 分析結果按餐廳隔離
- 緩存數據自動過期
- 使用量日誌追蹤

---

## 📊 性能優化

### 緩存策略
1. **AI 洞察緩存**：6 小時 TTL
2. **產品分析預計算**：每日凌晨更新
3. **業務指標聚合**：日級別預計算

### 數據庫優化
- 複合索引：`(restaurant_id, date)`
- 生成列：自動計算總成本
- 視圖：常用查詢預定義

### API 優化
- 並行查詢：`Promise.all` 獲取多維度數據
- 條件查詢：僅在有成本數據時計算利潤
- 分頁支持：限制返回結果數量

---

## 🚀 下一步：前端實現

### Admin Dashboard UI Components (待實現)

#### 1. AI 配置頁面 (`AIProviderConfig.vue`)
```
apps/admin-dashboard/src/views/ai-analytics/
├── AIProviderConfig.vue       # AI Provider 配置頁面
├── AIInsightsDashboard.vue    # AI 洞察儀表板
└── ProductAnalytics.vue       # 產品分析頁面
```

**功能需求**：
- Provider 選擇下拉框 (Anthropic, OpenAI, Google, DeepSeek, Custom)
- API Key 輸入框（加密顯示）
- 模型選擇（自動加載可用模型）
- 測試連接按鈕
- 保存配置

**UI 參考**：
```vue
<template>
  <div class="ai-config-panel">
    <h2>AI 分析配置</h2>

    <el-form :model="form" label-width="120px">
      <el-form-item label="AI Provider">
        <el-select v-model="form.provider" @change="onProviderChange">
          <el-option label="Anthropic Claude" value="anthropic" />
          <el-option label="OpenAI GPT" value="openai" />
          <el-option label="Google Gemini" value="google" />
          <el-option label="DeepSeek" value="deepseek" />
          <el-option label="自定義" value="custom" />
        </el-select>
      </el-form-item>

      <el-form-item label="API Key">
        <el-input
          v-model="form.apiKey"
          type="password"
          show-password
          placeholder="請輸入 API Key"
        />
      </el-form-item>

      <el-form-item label="模型">
        <el-select v-model="form.model">
          <el-option
            v-for="model in availableModels"
            :key="model"
            :label="model"
            :value="model"
          />
        </el-select>
      </el-form-item>

      <el-form-item v-if="form.provider === 'custom'" label="Base URL">
        <el-input v-model="form.customBaseUrl" placeholder="https://..." />
      </el-form-item>

      <el-form-item>
        <el-button @click="testConnection" :loading="testing">
          測試連接
        </el-button>
        <el-button type="primary" @click="saveConfig" :loading="saving">
          保存配置
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>
```

#### 2. AI 洞察儀表板 (`AIInsightsDashboard.vue`)

**功能需求**：
- 時間範圍選擇器 (7天/30天/90天)
- 執行摘要顯示卡片
- 洞察列表（觀察/建議/警告/機會）
- 預測圖表（未來 7 天營收/訂單）
- 刷新按鈕（清除緩存重新生成）

**關鍵 API 調用**：
```typescript
// composables/useAIAnalytics.ts
export function useAIAnalytics() {
  const generateReport = async (restaurantId: string, timeRange: string) => {
    const response = await fetch('/api/v1/ai-analytics/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId,
        timeRange: { range: timeRange },
        includeForecasting: true,
        refreshCache: false
      })
    });
    return response.json();
  };

  return { generateReport };
}
```

#### 3. 產品分析頁面 (`ProductAnalytics.vue`)

**功能需求**：
- 三個 Tab：引流產品 / 熱銷產品 / 利潤最大產品
- 產品卡片網格佈局
- 關鍵指標徽章：
  - 引流產品：首選次數、轉換率
  - 熱銷產品：銷量、營收、趨勢
  - 利潤產品：利潤率、總利潤
- 趨勢折線圖（每日數據）
- 導出為 CSV 功能

**示例佈局**：
```vue
<template>
  <div class="product-analytics">
    <el-tabs v-model="activeTab">
      <el-tab-pane label="引流產品" name="traffic">
        <div class="product-grid">
          <el-card v-for="product in trafficDrivers" :key="product.menuItemId">
            <template #header>
              <div class="card-header">
                <span>{{ product.menuItemName }}</span>
                <el-tag type="success">引流</el-tag>
              </div>
            </template>

            <div class="metrics">
              <div class="metric">
                <span class="label">首選次數</span>
                <span class="value">{{ product.firstItemInOrderCount }}</span>
              </div>
              <div class="metric">
                <span class="label">轉換率</span>
                <span class="value">{{ (product.conversionRate * 100).toFixed(1) }}%</span>
              </div>
              <div class="metric">
                <span class="label">總訂單</span>
                <span class="value">{{ product.totalOrders }}</span>
              </div>
            </div>
          </el-card>
        </div>
      </el-tab-pane>

      <el-tab-pane label="熱銷產品" name="bestsellers">
        <!-- 類似結構 -->
      </el-tab-pane>

      <el-tab-pane label="利潤最大" name="profit">
        <!-- 類似結構 -->
      </el-tab-pane>
    </el-tabs>
  </div>
</template>
```

---

## 💡 使用示例

### 完整流程

#### 1. 配置 AI Provider（店長操作）
```bash
POST /api/v1/ai-analytics/config
{
  "restaurantId": "rest_123",
  "provider": "anthropic",
  "apiKey": "sk-ant-xxxxx",
  "model": "claude-3-5-sonnet-20241022"
}
```

#### 2. 生成 AI 分析報告
```bash
POST /api/v1/ai-analytics/generate
{
  "restaurantId": "rest_123",
  "timeRange": { "range": "30d" },
  "includeForecasting": true
}
```

**響應示例**：
```json
{
  "success": true,
  "report": {
    "metrics": {
      "totalRevenue": 85420.50,
      "totalOrders": 1247,
      "averageOrderValue": 68.50,
      "revenueGrowth": 15.3,
      "orderGrowth": 12.8
    },
    "insights": [
      {
        "type": "recommendation",
        "category": "product",
        "title": "提升牛肉麵促銷力度",
        "description": "牛肉麵作為引流產品（45%首選率），但利潤率僅20%。建議搭配高利潤配菜促銷。",
        "impact": "high",
        "confidence": 0.87,
        "suggestedActions": [
          "創建「牛肉麵+小菜」套餐",
          "提供續加肉片升級選項（利潤率60%）"
        ]
      }
    ],
    "executiveSummary": "過去30天表現優異，營收增長15.3%...",
    "forecast": {
      "nextWeekRevenue": {
        "predicted": 22000,
        "confidenceLower": 19800,
        "confidenceUpper": 24200
      }
    }
  }
}
```

#### 3. 獲取引流產品
```bash
GET /api/v1/ai-analytics/products/traffic-drivers/rest_123?timeRange=30d&limit=10
```

**響應示例**：
```json
{
  "success": true,
  "products": [
    {
      "menuItemId": "item_001",
      "menuItemName": "招牌牛肉麵",
      "totalOrders": 432,
      "firstItemInOrderCount": 198,
      "conversionRate": 0.76,
      "cartAdditionRate": 0.82,
      "trendScore": 0.23,
      "categories": ["traffic-driver", "bestseller"]
    }
  ]
}
```

---

## 🛠️ 開發和部署

### 本地開發

#### 1. 安裝依賴
```bash
pnpm install
```

#### 2. 運行數據庫遷移
```bash
npx wrangler d1 migrations apply makanmakan-local --local
```

#### 3. 構建 AI Analytics Package
```bash
cd packages/ai-analytics
pnpm run build
```

#### 4. 啟動 API 服務
```bash
cd apps/api
pnpm run dev
```

### 測試

#### 單元測試
```bash
cd packages/ai-analytics
pnpm test
```

#### API 測試
```bash
# 使用 curl 或 Postman 測試端點
curl -X POST http://localhost:8787/api/v1/ai-analytics/test-provider \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "anthropic",
    "apiKey": "sk-ant-xxxxx"
  }'
```

### 部署

#### Staging 環境
```bash
# 1. 運行數據庫遷移
npx wrangler d1 migrations apply makanmakan-staging --env staging

# 2. 部署 API
cd apps/api
pnpm run deploy:staging
```

#### Production 環境
```bash
# 1. 運行數據庫遷移
npx wrangler d1 migrations apply makanmakan-prod --env production

# 2. 部署 API
cd apps/api
pnpm run deploy:prod
```

---

## 📈 監控和維護

### 監控指標
- AI API 調用成功率
- 平均響應延遲
- Token 使用量
- 緩存命中率
- 錯誤率

### 日誌查看
```bash
# 查看 API 日誌
npx wrangler tail makanmakan-api-prod

# 查看 AI 使用日誌
SELECT * FROM ai_usage_logs
WHERE restaurant_id = 'rest_123'
ORDER BY created_at DESC
LIMIT 100;
```

### 成本控制
- 設置每月 Token 配額
- 監控異常高頻調用
- 緩存策略優化
- 選擇成本效益最佳的模型

---

## 🎓 技術架構亮點

### 1. 設計模式
- **工廠模式**：Provider 創建 (`createProvider`)
- **策略模式**：不同 LLM Provider 統一接口
- **模板方法**：`BaseLLMProvider` 抽象類

### 2. 可擴展性
- 新增 LLM Provider 只需實現 `BaseLLMProvider`
- 產品分類邏輯可插拔式擴展
- 數據庫 Schema 支持未來功能擴展

### 3. 性能考量
- 多層緩存（API 緩存 + 預計算表）
- 並行數據獲取
- 索引優化

### 4. 安全性
- API 密鑰加密
- 錯誤消息脫敏
- SQL 注入防護（Prepared Statements）

---

## ❓ 常見問題 (FAQ)

### Q1: 如何添加新的 LLM Provider？
```typescript
// 1. 創建新的 Provider 類
export class NewProvider extends BaseLLMProvider {
  protected getDefaultModel(): string {
    return 'new-model-v1';
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    // 實現 API 調用邏輯
  }

  async test(): Promise<...> {
    // 實現測試邏輯
  }
}

// 2. 在 providers/index.ts 中註冊
export function createProvider(config: LLMConfig): BaseLLMProvider {
  switch (config.provider) {
    case 'new-provider':
      return new NewProvider(config);
    // ...
  }
}
```

### Q2: 如何自定義產品分類邏輯？
編輯 `ProductAnalysisService.categorizeProduct()` 方法調整閾值和規則。

### Q3: 如何調整緩存時間？
在 `AIInsightsService.cacheReport()` 中修改 TTL：
```typescript
const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6 hours
```

### Q4: 支援哪些語言？
目前生成的洞察和報告為**繁體中文**。可在 Prompt 中調整語言。

---

## 📚 相關文檔

- [API 文檔](../api/README.md)
- [數據庫 Schema](../database/schema.md)
- [安全審計報告](../SECURITY_AUDIT_REPORT.md)
- [產品需求文檔](../requirements.md)

---

## 👥 貢獻者

- **設計與實現**: Claude (AI Assistant)
- **項目**: MakanMakan Restaurant Management System
- **日期**: 2025-10-06

---

**注意**：本文檔描述的是已完成的後端實現。前端 UI 組件仍待開發。建議使用 Element Plus 或類似 UI 框架實現管理界面。

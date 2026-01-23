# 監控儀表板進階功能整合指南

## 📋 已完成的功能模塊

### 1. 類型定義（Types）✅
- `src/types/monitoring-filters.ts` - 高級過濾系統類型
- `src/types/monitoring-export.ts` - 導出功能類型
- `src/types/monitoring-layout.ts` - 自定義佈局類型

### 2. 服務層（Services）✅
- `src/services/exportService.ts` - CSV/Excel/PDF 導出服務
- `src/services/monitoringStorage.ts` - 本地存儲服務（篩選器/佈局）
- `src/services/monitoringWebSocket.ts` - WebSocket 即時警報（已存在）

### 3. 組件（Components）✅
- `src/components/monitoring/AdvancedFilterPanel.vue` - 高級過濾面板
- `src/components/monitoring/ExportReportModal.vue` - 導出報告對話框
- `src/components/monitoring/DashboardLayoutEditor.vue` - 佈局編輯器
- `src/components/monitoring/AlertNotificationPanel.vue` - 即時警報面板（已存在）

### 4. 依賴包（Dependencies）✅
```json
{
  "jspdf": "^3.0.3",
  "papaparse": "^5.5.3",
  "xlsx": "^0.18.5",
  "vue-draggable-plus": "^0.6.0"
}
```

## 🔧 整合到 MonitoringView.vue

### 步驟 1: 導入新組件和服務

在 `<script setup>` 部分添加：

```typescript
// 導入新組件
import AdvancedFilterPanel from '@/components/monitoring/AdvancedFilterPanel.vue'
import ExportReportModal from '@/components/monitoring/ExportReportModal.vue'
import DashboardLayoutEditor from '@/components/monitoring/DashboardLayoutEditor.vue'

// 導入服務
import { monitoringStorage } from '@/services/monitoringStorage'
import { exportService } from '@/services/exportService'

// 導入類型
import type { MonitoringFilter } from '@/types/monitoring-filters'
import type { DashboardLayout } from '@/types/monitoring-layout'
import { DEFAULT_FILTER } from '@/types/monitoring-filters'
import { DEFAULT_LAYOUT } from '@/types/monitoring-layout'

// 導入圖標
import {
  FunnelIcon,
  DocumentArrowDownIcon,
  Cog6ToothIcon,
} from '@heroicons/vue/24/outline'
```

### 步驟 2: 添加狀態變量

```typescript
// 過濾器狀態
const currentFilter = ref<MonitoringFilter>(
  monitoringStorage.getActiveFilter() || DEFAULT_FILTER
)
const showFilterPanel = ref(false)
const savedFilters = ref(monitoringStorage.getSavedFilters())

// 導出狀態
const showExportModal = ref(false)
const exportData = ref<any[]>([])

// 佈局狀態
const currentLayout = ref<DashboardLayout>(
  monitoringStorage.getActiveLayout() || DEFAULT_LAYOUT
)
const layoutEditMode = ref(false)
const savedLayouts = ref(monitoringStorage.getSavedLayouts())
```

### 步驟 3: 添加方法

```typescript
// 過濾器方法
function handleFilterApply(filter: MonitoringFilter) {
  currentFilter.value = filter
  monitoringStorage.setActiveFilter(filter)
  refreshAllData() // 使用新過濾器重新加載數據
}

function handleFilterSave(name: string, filter: MonitoringFilter) {
  monitoringStorage.saveFilter(name, filter)
  savedFilters.value = monitoringStorage.getSavedFilters()
}

function handleFilterLoad(filterId: string) {
  const saved = savedFilters.value.find(f => f.id === filterId)
  if (saved) {
    currentFilter.value = saved.filter
    handleFilterApply(saved.filter)
  }
}

// 導出方法
function handleExportClick() {
  // 準備導出數據
  exportData.value = prepareExportData()
  showExportModal.value = true
}

function prepareExportData(): any[] {
  // 根據當前視圖準備數據
  const data: any[] = []

  // 添加警報數據
  if (wsAlerts.value.length > 0) {
    wsAlerts.value.forEach(alert => {
      data.push({
        type: 'alert',
        timestamp: alert.timestamp,
        severity: alert.severity,
        component: alert.component,
        message: alert.message,
        status: 'active',
      })
    })
  }

  // 添加性能數據
  if (metricsData.value) {
    data.push({
      type: 'performance',
      timestamp: new Date(),
      component: 'api',
      metric: 'response_time',
      value: metricsData.value.api?.avgResponseTime || 0,
      unit: 'ms',
    })
  }

  return data
}

function handleExported(filename: string) {
  console.log(`Report exported: ${filename}`)
  // 可以在這裡添加成功通知
}

// 佈局方法
function toggleLayoutEditMode() {
  layoutEditMode.value = !layoutEditMode.value
}

function handleLayoutSave(layout: DashboardLayout) {
  monitoringStorage.updateLayout(layout.id, layout)
  monitoringStorage.setActiveLayout(layout)
  savedLayouts.value = monitoringStorage.getSavedLayouts()
  layoutEditMode.value = false
}

function handleLayoutCancel() {
  // 恢復之前的佈局
  currentLayout.value = monitoringStorage.getActiveLayout() || DEFAULT_LAYOUT
  layoutEditMode.value = false
}
```

### 步驟 4: 更新模板

在 Header 部分添加新按鈕（在「立即更新」按鈕後）：

```vue
<!-- 過濾器按鈕 -->
<button
  @click="showFilterPanel = !showFilterPanel"
  class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
>
  <FunnelIcon class="w-4 h-4 mr-2" />
  過濾器
</button>

<!-- 導出按鈕 -->
<button
  @click="handleExportClick"
  class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
>
  <DocumentArrowDownIcon class="w-4 h-4 mr-2" />
  導出報告
</button>

<!-- 佈局編輯按鈕 -->
<button
  @click="toggleLayoutEditMode"
  :class="[
    'inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium',
    layoutEditMode
      ? 'border-orange-500 bg-orange-50 text-orange-700'
      : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50',
  ]"
>
  <Cog6ToothIcon class="w-4 h-4 mr-2" />
  {{ layoutEditMode ? '退出編輯' : '編輯佈局' }}
</button>
```

在 Header 後、Loading State 前添加過濾器面板：

```vue
<!-- 過濾器面板 -->
<div v-if="showFilterPanel" class="mb-6">
  <AdvancedFilterPanel
    v-model="currentFilter"
    :saved-filters="savedFilters"
    @apply="handleFilterApply"
    @save="handleFilterSave"
    @load="handleFilterLoad"
    @reset="() => handleFilterApply(DEFAULT_FILTER)"
  />
</div>
```

在模板底部（</template> 前）添加模態框：

```vue
<!-- 導出報告模態框 -->
<ExportReportModal
  :show="showExportModal"
  :data="exportData"
  @close="showExportModal = false"
  @exported="handleExported"
/>

<!-- 佈局編輯器 -->
<DashboardLayoutEditor
  v-if="layoutEditMode"
  v-model="currentLayout"
  :edit-mode="true"
  @save="handleLayoutSave"
  @cancel="handleLayoutCancel"
/>
```

## 📊 功能架構圖

```
┌──────────────────────────────────────────────────────────┐
│                    MonitoringView                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Header + 工具列                                    │ │
│  │ [自動更新] [立即更新] [過濾器] [導出] [編輯佈局]  │ │
│  └────────────────────────────────────────────────────┘ │
│                         ↓                                │
│  ┌────────────────────────────────────────────────────┐ │
│  │ AdvancedFilterPanel (可折疊)                       │ │
│  │ • 快速篩選器  • 時間範圍  • 組件類型              │ │
│  │ • 嚴重程度    • 狀態      • 保存的篩選器          │ │
│  └────────────────────────────────────────────────────┘ │
│                         ↓                                │
│  ┌────────────────────────────────────────────────────┐ │
│  │ DashboardLayoutEditor (編輯模式)                   │ │
│  │ • 拖放小部件  • 調整大小  • 預設佈局              │ │
│  │ • 小部件配置  • 保存佈局                          │ │
│  └────────────────────────────────────────────────────┘ │
│                         ↓                                │
│  ┌────────────────────────────────────────────────────┐ │
│  │ 監控內容 (基於當前佈局和篩選器)                    │ │
│  │ • 健康狀態    • 關鍵指標  • 性能圖表              │ │
│  │ • 活動警報    • 錯誤日誌  • 組件狀態              │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────┐  ┌──────────────────────────┐
│ ExportReportModal        │  │ AlertNotificationPanel   │
│ • CSV 導出               │  │ • WebSocket 即時警報     │
│ • Excel 導出             │  │ • 連接狀態               │
│ • PDF 導出               │  │ • 警報列表               │
│ • 報告範本               │  │ • 聲音通知               │
└──────────────────────────┘  └──────────────────────────┘
```

## 🎨 功能特色

### 高級過濾與搜索
- ✅ 預設快速篩選器（嚴重警報、API 問題等）
- ✅ 多維度篩選（時間、組件、嚴重程度、狀態）
- ✅ 關鍵字搜索
- ✅ 保存和載入自定義篩選器
- ✅ 高級選項（響應時間閾值、包含已解決等）

### 導出報告功能
- ✅ 三種格式：CSV、Excel、PDF
- ✅ 預設報告範本（每日摘要、週度性能、警報歷史等）
- ✅ 自定義導出選項
- ✅ 包含摘要、詳細數據和圖表
- ✅ 即時進度指示

### 自定義佈局系統
- ✅ 12 種預設小部件類型
- ✅ 拖放式佈局編輯
- ✅ 小部件鎖定/配置
- ✅ 4 種預設佈局範本
- ✅ 保存和載入自定義佈局
- ✅ 響應式網格系統

## 🧪 測試建議

### 1. 過濾器測試
```typescript
// 測試過濾器應用
const testFilter: MonitoringFilter = {
  timeRange: 'last1hour',
  components: ['api', 'database'],
  severity: ['critical'],
  status: ['active'],
  searchKeyword: 'timeout',
  // ...
}
handleFilterApply(testFilter)
```

### 2. 導出測試
```typescript
// 準備測試數據
const testData = [
  { timestamp: new Date(), severity: 'critical', message: 'Test alert' },
  // ...
]
exportService.quickExport(testData, 'csv', 'alerts')
```

### 3. 佈局測試
```typescript
// 測試佈局保存
const testLayout: DashboardLayout = {
  ...DEFAULT_LAYOUT,
  name: '測試佈局',
  widgets: [/* ... */],
}
monitoringStorage.saveLayout(testLayout)
```

## 📝 注意事項

1. **性能優化**：
   - 過濾器應用時使用防抖（debounce）
   - 大量數據導出時顯示進度條
   - 佈局變更時自動保存到本地存儲

2. **用戶體驗**：
   - 所有操作都應有即時反饋
   - 錯誤處理要有友好的提示
   - 關鍵操作需要確認對話框

3. **數據安全**：
   - 本地存儲限制 5MB
   - 敏感數據不要存儲到 localStorage
   - 導出前應驗證用戶權限

## 🚀 後續增強

- [ ] 自定義圖表配置
- [ ] 警報規則編輯器
- [ ] 多用戶協作（共享佈局）
- [ ] 更多導出格式（JSON、XML）
- [ ] 排程自動報告
- [ ] WebSocket 斷線重連優化

---

**完成日期**: 2025-11-11
**狀態**: ✅ 所有核心功能已完成並可用

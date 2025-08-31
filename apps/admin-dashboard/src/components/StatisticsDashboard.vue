<template>
  <div class="statistics-dashboard">
    <!-- 頁面標題和控制 -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">統計面板</h1>
        <p class="text-gray-600 mt-1">實時統計數據、平均製作時間、完成率統計和績效趨勢</p>
      </div>
      <div class="mt-4 sm:mt-0 flex items-center space-x-4">
        <!-- 自動刷新控制 -->
        <div class="flex items-center">
          <label class="flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              v-model="statisticsService.autoRefresh.value"
              @change="handleAutoRefreshChange"
              class="sr-only"
            >
            <div class="relative">
              <div class="w-10 h-6 bg-gray-200 rounded-full shadow-inner transition-colors duration-200 ease-in-out"
                   :class="{ 'bg-blue-500': statisticsService.autoRefresh.value }"></div>
              <div class="absolute left-0 top-0 w-6 h-6 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out"
                   :class="{ 'translate-x-4': statisticsService.autoRefresh.value }"></div>
            </div>
            <span class="ml-2 text-sm text-gray-700">自動刷新</span>
          </label>
        </div>
        
        <button
          @click="handleRefresh"
          :disabled="statisticsService.isLoading.value"
          class="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <ArrowPathIcon class="h-4 w-4 mr-2" :class="{ 'animate-spin': statisticsService.isLoading.value }" />
          刷新
        </button>
        
        <button
          @click="handleExport"
          class="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <DocumentArrowDownIcon class="h-4 w-4 mr-2" />
          匯出
        </button>
      </div>
    </div>

    <!-- 最後更新時間和連線狀態 -->
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center space-x-4">
        <div class="flex items-center text-sm text-gray-500">
          <ClockIcon class="h-4 w-4 mr-1" />
          <span v-if="statisticsService.lastUpdated.value">
            最後更新：{{ formatDateTime(statisticsService.lastUpdated.value) }}
          </span>
          <span v-else>尚未載入數據</span>
        </div>
        
        <!-- WebSocket 連線狀態 -->
        <div class="flex items-center text-sm" :class="connectionStatus.color">
          <component :is="connectionStatus.icon" class="h-4 w-4 mr-1" 
                    :class="{ 'animate-spin': isConnecting }" />
          <span>{{ connectionStatus.text }}</span>
        </div>
      </div>
      
      <div class="flex items-center space-x-2">
        <div v-if="statisticsService.error.value" class="text-red-600 text-sm">
          {{ statisticsService.error.value }}
        </div>
        <div v-if="sseError" class="text-orange-600 text-sm">
          SSE: {{ sseError }}
        </div>
        <button 
          v-if="!isConnected && !isConnecting"
          @click="reconnect"
          class="text-blue-600 hover:text-blue-800 text-sm underline"
        >
          重新連線
        </button>
      </div>
    </div>

    <!-- 實時統計卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <!-- 待處理訂單 -->
      <StatCard
        title="待處理訂單"
        :value="statisticsService.dashboardData.realtime_stats.pending_orders"
        icon="QueueListIcon"
        color="yellow"
        :subtitle="`${statisticsService.dashboardData.realtime_stats.preparing_orders} 製作中`"
      />

      <!-- 完成率 -->
      <StatCard
        title="今日完成率"
        :value="`${statisticsService.completionRateToday}%`"
        icon="CheckCircleIcon"
        :color="statisticsService.completionRateToday >= 90 ? 'green' : statisticsService.completionRateToday >= 80 ? 'yellow' : 'red'"
        :subtitle="`${statisticsService.dashboardData.realtime_stats.completed_today}/${statisticsService.dashboardData.realtime_stats.total_today} 訂單`"
      />

      <!-- 平均製作時間 -->
      <StatCard
        title="平均製作時間"
        :value="statisticsService.formatTime(statisticsService.dashboardData.kpis.avg_preparation_time)"
        icon="ClockIcon"
        :color="statisticsService.dashboardData.kpis.avg_preparation_time <= 20 ? 'green' : statisticsService.dashboardData.kpis.avg_preparation_time <= 30 ? 'yellow' : 'red'"
        :subtitle="'目標: 20分鐘以內'"
      />

      <!-- 效率評分 -->
      <StatCard
        title="效率評分"
        :value="`${statisticsService.dashboardData.kpis.efficiency_score}分`"
        icon="ChartBarIcon"
        :color="statisticsService.dashboardData.kpis.efficiency_score >= 85 ? 'green' : statisticsService.dashboardData.kpis.efficiency_score >= 70 ? 'yellow' : 'red'"
        :subtitle="'綜合效率指標'"
      />
    </div>

    <!-- 系統負載和活躍訂單 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
      <!-- 系統負載 -->
      <div class="bg-white rounded-lg shadow-sm p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">系統負載</h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">廚房容量</span>
            <span class="text-sm font-medium">{{ statisticsService.dashboardData.system_load.active_orders }}/{{ statisticsService.dashboardData.system_load.kitchen_capacity }}</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-3">
            <div 
              class="h-3 rounded-full transition-all duration-300"
              :class="statisticsService.getLoadColor(statisticsService.dashboardData.system_load.load_percentage)"
              :style="{ width: `${statisticsService.dashboardData.system_load.load_percentage}%` }"
            ></div>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-gray-600">負載程度</span>
            <span :class="statisticsService.getLoadColor(statisticsService.dashboardData.system_load.load_percentage).replace('bg-', 'text-')">
              {{ statisticsService.dashboardData.system_load.load_percentage }}%
            </span>
          </div>
        </div>
      </div>

      <!-- 緊急訂單 -->
      <div class="bg-white rounded-lg shadow-sm p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">緊急訂單</h3>
        <div class="space-y-3">
          <div v-if="statisticsService.urgentOrders.length === 0" class="text-center py-4">
            <CheckCircleIcon class="mx-auto h-8 w-8 text-green-500 mb-2" />
            <p class="text-sm text-gray-500">沒有緊急訂單</p>
          </div>
          <div v-else>
            <div v-for="order in statisticsService.urgentOrders.slice(0, 3)" :key="order.id" 
                 class="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div>
                <p class="text-sm font-medium text-gray-900">#{{ order.order_number }}</p>
                <p class="text-xs text-gray-500">桌號 {{ order.table_id }}</p>
              </div>
              <div class="text-right">
                <p class="text-sm font-medium text-red-600">{{ order.elapsed_minutes }}分鐘</p>
                <p class="text-xs text-gray-500">{{ order.status }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 今日營收 -->
      <div class="bg-white rounded-lg shadow-sm p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">今日營收</h3>
        <div class="space-y-3">
          <div class="text-3xl font-bold text-green-600">
            {{ statisticsService.formatCurrency(statisticsService.dashboardData.realtime_stats.revenue_today) }}
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-gray-600">平均客單價</span>
            <span class="font-medium">{{ statisticsService.formatCurrency(statisticsService.averageOrderValue) }}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-gray-600">每小時訂單</span>
            <span class="font-medium">{{ statisticsService.dashboardData.kpis.orders_per_hour }} 筆</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 圖表和分析 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      <!-- 每小時完成率 -->
      <div class="bg-white rounded-lg shadow-sm p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">每小時完成率</h3>
        <div class="space-y-3">
          <div v-for="hour in statisticsService.dashboardData.hourly_completion_rate" :key="hour.hour" 
               class="flex items-center justify-between">
            <span class="text-sm text-gray-600">{{ hour.hour }}:00</span>
            <div class="flex items-center space-x-3">
              <div class="w-32 bg-gray-200 rounded-full h-2">
                <div 
                  class="h-2 rounded-full transition-all duration-300"
                  :class="hour.completion_rate >= 90 ? 'bg-green-500' : hour.completion_rate >= 80 ? 'bg-yellow-500' : 'bg-red-500'"
                  :style="{ width: `${hour.completion_rate}%` }"
                ></div>
              </div>
              <span class="text-sm font-medium w-12 text-right">{{ hour.completion_rate }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 分類平均時間 -->
      <div class="bg-white rounded-lg shadow-sm p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">各分類平均製作時間</h3>
        <div class="space-y-3">
          <div v-for="category in statisticsService.slowestCategories" :key="category.category_name" 
               class="flex items-center justify-between">
            <div>
              <span class="text-sm font-medium text-gray-900">{{ category.category_name }}</span>
              <span class="text-xs text-gray-500 ml-2">({{ category.item_count }} 品項)</span>
            </div>
            <div class="text-right">
              <span class="text-sm font-medium" 
                    :class="category.avg_time_minutes <= 15 ? 'text-green-600' : category.avg_time_minutes <= 25 ? 'text-yellow-600' : 'text-red-600'">
                {{ Math.round(category.avg_time_minutes) }}分鐘
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 績效趨勢圖表 -->
    <div class="bg-white rounded-lg shadow-sm p-6 mb-8">
      <PerformanceTrendChart 
        :data="statisticsService.dashboardData.performance_trend"
        title="績效趨勢（最近7天）"
        :is-loading="statisticsService.isLoading.value"
      />
    </div>

    <!-- 詳細趨勢數據表格 -->
    <div class="bg-white rounded-lg shadow-sm mb-8">
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">詳細趨勢數據</h3>
          <div class="flex items-center">
            <div :class="`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              statisticsService.performanceTrendDirection === 'up' ? 'bg-green-100 text-green-800' :
              statisticsService.performanceTrendDirection === 'down' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`">
              <ArrowTrendingUpIcon v-if="statisticsService.performanceTrendDirection === 'up'" class="w-3 h-3 mr-1" />
              <ArrowTrendingDownIcon v-if="statisticsService.performanceTrendDirection === 'down'" class="w-3 h-3 mr-1" />
              <MinusIcon v-if="statisticsService.performanceTrendDirection === 'stable'" class="w-3 h-3 mr-1" />
              {{ 
                statisticsService.performanceTrendDirection === 'up' ? '上升趨勢' :
                statisticsService.performanceTrendDirection === 'down' ? '下降趨勢' : '穩定趨勢'
              }}
            </div>
          </div>
        </div>
        
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日期</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">總訂單</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">已完成</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">完成率</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">平均時間</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">營收</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="trend in statisticsService.dashboardData.performance_trend" :key="trend.date" class="hover:bg-gray-50 transition-colors">
                <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ formatDate(trend.date) }}</td>
                <td class="px-4 py-3 text-sm text-gray-900">{{ trend.total_orders }}</td>
                <td class="px-4 py-3 text-sm text-gray-900">{{ trend.completed_orders }}</td>
                <td class="px-4 py-3 text-sm">
                  <div class="flex items-center">
                    <span :class="`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      trend.completion_rate >= 90 ? 'bg-green-100 text-green-800' :
                      trend.completion_rate >= 80 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`">
                      {{ trend.completion_rate }}%
                    </span>
                    <div class="ml-2 w-16 bg-gray-200 rounded-full h-1.5">
                      <div 
                        :class="`h-1.5 rounded-full ${
                          trend.completion_rate >= 90 ? 'bg-green-500' :
                          trend.completion_rate >= 80 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`"
                        :style="{ width: `${trend.completion_rate}%` }"
                      ></div>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-900">
                  <span :class="`${
                    (trend.avg_prep_time || 0) <= 20 ? 'text-green-600' :
                    (trend.avg_prep_time || 0) <= 30 ? 'text-yellow-600' :
                    'text-red-600'
                  }`">
                    {{ Math.round(trend.avg_prep_time || 0) }}分鐘
                  </span>
                </td>
                <td class="px-4 py-3 text-sm font-medium text-gray-900">{{ statisticsService.formatCurrency(trend.revenue) }}</td>
              </tr>
            </tbody>
          </table>
          
          <div v-if="statisticsService.dashboardData.performance_trend.length === 0" class="text-center py-8">
            <ChartBarIcon class="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p class="text-gray-500">暫無趨勢數據</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 活躍訂單列表 -->
    <div class="bg-white rounded-lg shadow-sm p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">活躍訂單 ({{ statisticsService.totalActiveOrders }})</h3>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">訂單號</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">顧客</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">桌號</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">類型</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">狀態</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">等待時間</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">金額</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="order in statisticsService.dashboardData.active_orders" :key="order.id" 
                class="hover:bg-gray-50"
                :class="{ 'bg-red-50': order.elapsed_minutes > 30 }">
              <td class="px-4 py-3 text-sm font-medium text-gray-900">#{{ order.order_number }}</td>
              <td class="px-4 py-3 text-sm text-gray-900">{{ order.customer_name || '匿名' }}</td>
              <td class="px-4 py-3 text-sm text-gray-900">{{ order.table_id || '-' }}</td>
              <td class="px-4 py-3 text-sm text-gray-900">{{ order.order_type }}</td>
              <td class="px-4 py-3 text-sm">
                <span :class="`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statisticsService.getStatusColor(order.status)}`">
                  {{ getStatusText(order.status) }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm" :class="order.elapsed_minutes > 30 ? 'text-red-600 font-semibold' : 'text-gray-900'">
                {{ order.elapsed_minutes }}分鐘
              </td>
              <td class="px-4 py-3 text-sm text-gray-900">{{ statisticsService.formatCurrency(order.total) }}</td>
            </tr>
          </tbody>
        </table>
        
        <div v-if="statisticsService.dashboardData.active_orders.length === 0" class="text-center py-8">
          <CheckCircleIcon class="mx-auto h-12 w-12 text-green-500 mb-4" />
          <p class="text-gray-500">目前沒有活躍訂單</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import { statisticsService } from '@/services/statisticsService'
import useStatisticsSSE from '@/composables/useStatisticsSSE'
import StatCard from '@/components/StatCard.vue'
import PerformanceTrendChart from '@/components/PerformanceTrendChart.vue'
import {
  ArrowPathIcon,
  DocumentArrowDownIcon,
  ClockIcon,
  CheckCircleIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  WifiIcon,
  ExclamationTriangleIcon
} from '@heroicons/vue/24/outline'

// SSE 實時更新
const {
  isConnected,
  isConnecting,
  error: sseError,
  disconnect: disconnectSSE,
  reconnect
} = useStatisticsSSE()

// SSE 連線狀態指示
const connectionStatus = computed(() => {
  if (isConnected.value) return { text: '已連線', color: 'text-green-600', icon: WifiIcon }
  if (isConnecting.value) return { text: '連線中...', color: 'text-yellow-600', icon: ArrowPathIcon }
  return { text: '未連線', color: 'text-red-600', icon: ExclamationTriangleIcon }
})

// 初始化數據載入
onMounted(() => {
  statisticsService.fetchDashboardData()
})

onUnmounted(() => {
  statisticsService.cleanup()
  disconnectSSE()
})

// 事件處理
const handleRefresh = () => {
  statisticsService.fetchDashboardData()
}

const handleAutoRefreshChange = () => {
  statisticsService.setAutoRefresh(statisticsService.autoRefresh.value)
}

const handleExport = () => {
  const csvData = statisticsService.exportCSV()
  const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `statistics_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// 輔助方法
const formatDateTime = (date: Date) => {
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('zh-TW', {
    month: '2-digit',
    day: '2-digit'
  })
}

const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    pending: '待確認',
    preparing: '製作中',
    ready: '待取餐',
    completed: '已完成',
    cancelled: '已取消'
  }
  return statusMap[status] || status
}
</script>

<style scoped>
.statistics-dashboard {
  @apply p-6;
}

@media (max-width: 640px) {
  .statistics-dashboard {
    @apply p-4;
  }
}
</style>
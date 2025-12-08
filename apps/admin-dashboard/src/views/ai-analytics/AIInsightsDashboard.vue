<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAIAnalytics } from '@/composables/useAIAnalytics'
import type { AIAnalyticsReport, AIInsight } from '@makanmakan/ai-analytics'

// Icons
import {
  SparklesIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CalendarIcon
} from '@heroicons/vue/24/outline'
import LightBulbIcon from '@heroicons/vue/24/outline/LightBulbIcon'

const { generateReport } = useAIAnalytics()

const report = ref<AIAnalyticsReport | null>(null)
const selectedTimeRange = ref('30d')
const isGenerating = ref(false)
const errorMessage = ref<string | null>(null)

// Mock restaurant ID
const restaurantId = ref('rest_123')

const timeRangeOptions = [
  { value: '7d', label: '過去 7 天' },
  { value: '14d', label: '過去 14 天' },
  { value: '30d', label: '過去 30 天' },
  { value: '90d', label: '過去 90 天' },
]

// Group insights by type
const insightsByType = computed(() => {
  if (!report.value?.insights) return {}

  return report.value.insights.reduce((acc: Record<string, AIInsight[]>, insight) => {
    if (!acc[insight.type]) {
      acc[insight.type] = []
    }
    acc[insight.type].push(insight)
    return acc
  }, {} as Record<string, AIInsight[]>)
})

// Insight type configurations
const insightTypeConfig = {
  observation: {
    label: '觀察',
    icon: ChartBarIcon,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-900',
    iconColor: 'text-blue-600',
  },
  recommendation: {
    label: '建議',
    icon: LightBulbIcon,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-900',
    iconColor: 'text-green-600',
  },
  warning: {
    label: '警告',
    icon: ExclamationTriangleIcon,
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-900',
    iconColor: 'text-yellow-600',
  },
  opportunity: {
    label: '機會',
    icon: SparklesIcon,
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-900',
    iconColor: 'text-purple-600',
  },
}

// Generate report
const handleGenerateReport = async (refresh = false) => {
  isGenerating.value = true
  errorMessage.value = null

  try {
    const result = await generateReport(
      restaurantId.value,
      { range: selectedTimeRange.value as '7d' | '14d' | '30d' | '90d' },
      {
        includeForecasting: true,
        refreshCache: refresh,
      }
    )

    if (result) {
      report.value = result
    } else {
      errorMessage.value = 'AI 分析生成失敗，請稍後再試'
    }
  } catch (err) {
    console.error('Failed to generate report:', err)
    errorMessage.value = err instanceof Error ? err.message : 'AI 分析生成失敗，請稍後再試'
  } finally {
    isGenerating.value = false
  }
}

// Load report on mount
onMounted(() => {
  handleGenerateReport()
})

// Format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: 0,
  }).format(value)
}

// Format percentage
const formatPercent = (value: number) => {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-4 sm:py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="mb-6 sm:mb-8">
        <div class="mb-4">
          <div class="flex items-center space-x-3 mb-2">
            <SparklesIcon class="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" aria-hidden="true" />
            <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">AI 業務洞察</h1>
          </div>
          <p class="text-sm sm:text-base text-gray-600">智能分析您的業務表現，發現增長機會</p>
        </div>

        <!-- Quick Navigation -->
        <nav aria-label="AI Analytics 導航" class="flex flex-wrap items-center gap-2 bg-white rounded-xl p-2 border border-gray-100 w-fit">
          <router-link
            to="/dashboard/ai-analytics/insights"
            class="px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap"
            :class="$route.path.includes('insights')
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'"
            aria-current="page"
          >
            AI 洞察
          </router-link>
          <router-link
            to="/dashboard/ai-analytics/products"
            class="px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap"
            :class="$route.path.includes('products')
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'"
          >
            產品分析
          </router-link>
          <router-link
            to="/dashboard/ai-analytics/config"
            class="px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap"
            :class="$route.path.includes('config')
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'"
          >
            AI 配置
          </router-link>
        </nav>
      </div>

      <!-- Controls -->
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0 sm:justify-end mb-6 sm:mb-8">
        <!-- Time Range & Refresh -->
        <div class="flex items-center gap-2 sm:gap-3">
          <label for="time-range-select" class="sr-only">選擇時間範圍</label>
          <select
            id="time-range-select"
            v-model="selectedTimeRange"
            aria-label="選擇分析時間範圍"
            class="flex-1 sm:flex-initial px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            @change="handleGenerateReport()"
          >
            <option v-for="option in timeRangeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>

          <button
            :disabled="isGenerating"
            :aria-label="isGenerating ? '正在重新生成報告' : '重新生成報告'"
            class="px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all focus:ring-2 focus:ring-indigo-500"
            @click="handleGenerateReport(true)"
          >
            <ArrowPathIcon
              class="w-5 h-5 text-gray-700"
              :class="{ 'animate-spin': isGenerating }"
              aria-hidden="true"
            />
            <span class="sr-only">{{ isGenerating ? '正在重新生成' : '重新生成' }}</span>
          </button>
        </div>
      </div>

      <!-- Error State -->
      <div v-if="errorMessage && !isGenerating" class="bg-red-50 border border-red-200 rounded-2xl p-6 mb-6">
        <div class="flex items-start space-x-3">
          <ExclamationTriangleIcon class="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div class="flex-1">
            <h3 class="text-red-900 font-semibold mb-1">生成報告時發生錯誤</h3>
            <p class="text-red-700 text-sm mb-3">{{ errorMessage }}</p>
            <button
              class="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
              @click="handleGenerateReport(true)"
            >
              重試
            </button>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isGenerating && !report" class="flex items-center justify-center py-20">
        <div class="text-center">
          <ArrowPathIcon class="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <div class="text-gray-600 font-medium">AI 正在分析您的業務數據...</div>
          <div class="text-sm text-gray-500 mt-2">這可能需要幾秒鐘</div>
        </div>
      </div>

      <!-- Report Content -->
      <div v-else-if="report" class="space-y-6">
        <!-- Key Metrics -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <!-- Total Revenue -->
          <div class="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-shadow">
            <div class="flex items-center justify-between mb-4">
              <div class="text-sm font-medium text-gray-600">總營收</div>
              <div class="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <ArrowTrendingUpIcon class="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div class="text-2xl font-bold text-gray-900 mb-1">
              {{ formatCurrency(report.metrics.totalRevenue) }}
            </div>
            <div class="flex items-center space-x-1 text-sm"
                 :class="report.metrics.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'">
              <ArrowTrendingUpIcon v-if="report.metrics.revenueGrowth >= 0" class="w-4 h-4" />
              <ArrowTrendingDownIcon v-else class="w-4 h-4" />
              <span class="font-semibold">{{ formatPercent(report.metrics.revenueGrowth) }}</span>
              <span class="text-gray-500">vs 上期</span>
            </div>
          </div>

          <!-- Total Orders -->
          <div class="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-shadow">
            <div class="flex items-center justify-between mb-4">
              <div class="text-sm font-medium text-gray-600">總訂單</div>
              <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <ChartBarIcon class="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div class="text-2xl font-bold text-gray-900 mb-1">
              {{ report.metrics.totalOrders.toLocaleString() }}
            </div>
            <div class="flex items-center space-x-1 text-sm"
                 :class="report.metrics.orderGrowth >= 0 ? 'text-green-600' : 'text-red-600'">
              <ArrowTrendingUpIcon v-if="report.metrics.orderGrowth >= 0" class="w-4 h-4" />
              <ArrowTrendingDownIcon v-else class="w-4 h-4" />
              <span class="font-semibold">{{ formatPercent(report.metrics.orderGrowth) }}</span>
              <span class="text-gray-500">vs 上期</span>
            </div>
          </div>

          <!-- Average Order Value -->
          <div class="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-shadow">
            <div class="flex items-center justify-between mb-4">
              <div class="text-sm font-medium text-gray-600">平均客單價</div>
              <div class="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <span class="text-xl">💰</span>
              </div>
            </div>
            <div class="text-2xl font-bold text-gray-900 mb-1">
              {{ formatCurrency(report.metrics.averageOrderValue) }}
            </div>
            <div class="text-sm text-gray-500">每筆訂單平均金額</div>
          </div>

          <!-- Unique Customers -->
          <div class="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-shadow">
            <div class="flex items-center justify-between mb-4">
              <div class="text-sm font-medium text-gray-600">獨立客戶</div>
              <div class="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                <span class="text-xl">👥</span>
              </div>
            </div>
            <div class="text-2xl font-bold text-gray-900 mb-1">
              {{ report.metrics.uniqueCustomers.toLocaleString() }}
            </div>
            <div class="text-sm text-gray-500">
              人均 {{ report.metrics.averageOrdersPerCustomer.toFixed(1) }} 單
            </div>
          </div>
        </div>

        <!-- Executive Summary -->
        <div class="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-8 text-white shadow-xl">
          <div class="flex items-center space-x-3 mb-4">
            <div class="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <SparklesIcon class="w-7 h-7" />
            </div>
            <h2 class="text-2xl font-bold">AI 執行摘要</h2>
          </div>
          <p class="text-lg leading-relaxed opacity-95">
            {{ report.executiveSummary }}
          </p>
        </div>

        <!-- Insights Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <template v-for="(insights, type) in insightsByType" :key="type">
            <div
              v-for="insight in insights"
              :key="insight.id"
              class="bg-white rounded-2xl p-6 border transition-all hover:shadow-lg"
              :class="[
                insightTypeConfig[type as keyof typeof insightTypeConfig].borderColor
              ]"
            >
              <!-- Insight Header -->
              <div class="flex items-start justify-between mb-4">
                <div class="flex items-center space-x-3">
                  <div
                    class="w-10 h-10 rounded-xl flex items-center justify-center"
                    :class="insightTypeConfig[type as keyof typeof insightTypeConfig].bgColor"
                  >
                    <component
                      :is="insightTypeConfig[type as keyof typeof insightTypeConfig].icon"
                      class="w-6 h-6"
                      :class="insightTypeConfig[type as keyof typeof insightTypeConfig].iconColor"
                    />
                  </div>
                  <div>
                    <div class="text-xs font-semibold uppercase tracking-wide"
                         :class="insightTypeConfig[type as keyof typeof insightTypeConfig].textColor">
                      {{ insightTypeConfig[type as keyof typeof insightTypeConfig].label }}
                    </div>
                    <div class="text-sm text-gray-500 mt-1">{{ insight.category }}</div>
                  </div>
                </div>
                <div
                  class="px-3 py-1 rounded-full text-xs font-semibold"
                  :class="{
                    'bg-red-100 text-red-700': insight.impact === 'high',
                    'bg-yellow-100 text-yellow-700': insight.impact === 'medium',
                    'bg-gray-100 text-gray-700': insight.impact === 'low',
                  }"
                >
                  {{ insight.impact === 'high' ? '高影響' : insight.impact === 'medium' ? '中影響' : '低影響' }}
                </div>
              </div>

              <!-- Insight Content -->
              <h3 class="text-lg font-bold text-gray-900 mb-2">
                {{ insight.title }}
              </h3>
              <p class="text-gray-600 mb-4 leading-relaxed">
                {{ insight.description }}
              </p>

              <!-- Suggested Actions -->
              <div v-if="insight.actionable && insight.suggestedActions?.length" class="mt-4">
                <div class="text-sm font-semibold text-gray-900 mb-2">建議行動：</div>
                <ul class="space-y-2">
                  <li
                    v-for="(action, idx) in insight.suggestedActions"
                    :key="idx"
                    class="flex items-start space-x-2 text-sm text-gray-700"
                  >
                    <CheckCircleIcon class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>{{ action }}</span>
                  </li>
                </ul>
              </div>

              <!-- Confidence Score -->
              <div class="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <div class="text-xs text-gray-500">信心分數</div>
                <div class="flex items-center space-x-2">
                  <div class="flex-1 h-2 w-24 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                      :style="{ width: `${insight.confidence * 100}%` }"
                    ></div>
                  </div>
                  <div class="text-sm font-semibold text-gray-900">
                    {{ Math.round(insight.confidence * 100) }}%
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Forecast (if available) -->
        <div v-if="report.forecast" class="bg-white rounded-2xl p-8 border border-gray-100">
          <div class="flex items-center space-x-3 mb-6">
            <CalendarIcon class="w-6 h-6 text-indigo-600" />
            <h2 class="text-xl font-bold text-gray-900">未來 7 天預測</h2>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Revenue Forecast -->
            <div class="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
              <div class="text-sm font-semibold text-green-900 mb-2">預測營收</div>
              <div class="text-3xl font-bold text-green-700 mb-4">
                {{ formatCurrency(report.forecast.nextWeekRevenue.predicted) }}
              </div>
              <div class="flex items-center justify-between text-sm">
                <div class="text-green-600">
                  最低: {{ formatCurrency(report.forecast.nextWeekRevenue.confidenceLower) }}
                </div>
                <div class="text-green-600">
                  最高: {{ formatCurrency(report.forecast.nextWeekRevenue.confidenceUpper) }}
                </div>
              </div>
            </div>

            <!-- Orders Forecast -->
            <div class="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-200">
              <div class="text-sm font-semibold text-blue-900 mb-2">預測訂單數</div>
              <div class="text-3xl font-bold text-blue-700 mb-4">
                {{ report.forecast.nextWeekOrders.predicted.toLocaleString() }}
              </div>
              <div class="flex items-center justify-between text-sm">
                <div class="text-blue-600">
                  最低: {{ report.forecast.nextWeekOrders.confidenceLower.toLocaleString() }}
                </div>
                <div class="text-blue-600">
                  最高: {{ report.forecast.nextWeekOrders.confidenceUpper.toLocaleString() }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- No Data State -->
      <div v-else class="text-center py-20">
        <SparklesIcon class="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <div class="text-gray-600 font-medium mb-2">尚未生成 AI 分析報告</div>
        <div class="text-sm text-gray-500 mb-6">請先配置 AI Provider 並生成報告</div>
        <button
          class="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all"
          @click="handleGenerateReport()"
        >
          立即生成報告
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}

.animate-shimmer {
  animation: shimmer 2s infinite linear;
  background: linear-gradient(
    to right,
    #f3f4f6 0%,
    #e5e7eb 20%,
    #f3f4f6 40%,
    #f3f4f6 100%
  );
  background-size: 1000px 100%;
}
</style>

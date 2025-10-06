<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAIAnalytics } from '@/composables/useAIAnalytics'
import type { ProductAnalysis } from '@makanmakan/ai-analytics'

// Icons
import {
  ChartBarIcon,
  ArrowPathIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  SparklesIcon,
  CurrencyDollarIcon,
  ShoppingCartIcon,
  UserGroupIcon,
  FireIcon
} from '@heroicons/vue/24/outline'

const {
  getTrafficDrivers,
  getBestsellers,
  getProfitLeaders
} = useAIAnalytics()

const activeTab = ref<'traffic' | 'bestsellers' | 'profit'>('traffic')
const selectedTimeRange = ref('30d')
const isRefreshing = ref(false)

// Mock restaurant ID
const restaurantId = ref('rest_123')

// Product data
const trafficDrivers = ref<ProductAnalysis[]>([])
const bestsellers = ref<ProductAnalysis[]>([])
const profitLeaders = ref<ProductAnalysis[]>([])

const timeRangeOptions = [
  { value: '7d', label: '過去 7 天' },
  { value: '14d', label: '過去 14 天' },
  { value: '30d', label: '過去 30 天' },
  { value: '90d', label: '過去 90 天' },
]

// Tab configurations
const tabs = [
  {
    id: 'traffic',
    label: '引流產品',
    icon: UserGroupIcon,
    description: '帶來新客戶的產品',
    color: 'indigo',
  },
  {
    id: 'bestsellers',
    label: '熱銷產品',
    icon: FireIcon,
    description: '銷量最高的產品',
    color: 'orange',
  },
  {
    id: 'profit',
    label: '利潤最大',
    icon: CurrencyDollarIcon,
    description: '最賺錢的產品',
    color: 'green',
  },
]

// Current tab data
const currentProducts = computed(() => {
  switch (activeTab.value) {
    case 'traffic':
      return trafficDrivers.value
    case 'bestsellers':
      return bestsellers.value
    case 'profit':
      return profitLeaders.value
    default:
      return []
  }
})

// Load data
const loadData = async () => {
  isRefreshing.value = true

  const [traffic, best, profit] = await Promise.all([
    getTrafficDrivers(restaurantId.value, selectedTimeRange.value, 10),
    getBestsellers(restaurantId.value, selectedTimeRange.value, 10),
    getProfitLeaders(restaurantId.value, selectedTimeRange.value, 10),
  ])

  trafficDrivers.value = traffic
  bestsellers.value = best
  profitLeaders.value = profit

  isRefreshing.value = false
}

// Watch time range changes
watch(selectedTimeRange, () => {
  loadData()
})

// Load on mount
onMounted(() => {
  loadData()
})

// Format currency
const formatCurrency = (value?: number) => {
  if (value === undefined) return 'N/A'
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: 0,
  }).format(value)
}

// Format percent
const formatPercent = (value: number) => {
  return `${(value * 100).toFixed(1)}%`
}

// Get trend color
const getTrendColor = (trend: number) => {
  if (trend > 0.2) return 'text-green-600'
  if (trend < -0.2) return 'text-red-600'
  return 'text-gray-600'
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <div>
            <div class="flex items-center space-x-3 mb-2">
              <ChartBarIcon class="w-8 h-8 text-indigo-600" />
              <h1 class="text-3xl font-bold text-gray-900">產品分析</h1>
            </div>
            <p class="text-gray-600">深度分析產品表現，優化菜單策略</p>
          </div>
        </div>

        <!-- Quick Navigation -->
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2 bg-white rounded-xl p-2 border border-gray-100 w-fit">
            <router-link
              to="/dashboard/ai-analytics/insights"
              class="px-4 py-2 rounded-lg text-sm font-medium transition-all text-gray-600 hover:bg-gray-100"
            >
              AI 洞察
            </router-link>
            <router-link
              to="/dashboard/ai-analytics/products"
              class="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-indigo-600 text-white"
            >
              產品分析
            </router-link>
            <router-link
              to="/dashboard/ai-analytics/config"
              class="px-4 py-2 rounded-lg text-sm font-medium transition-all text-gray-600 hover:bg-gray-100"
            >
              AI 配置
            </router-link>
          </div>

          <!-- Time Range & Refresh -->
          <div class="flex items-center space-x-3">
            <select
              v-model="selectedTimeRange"
              class="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option v-for="option in timeRangeOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>

            <button
              @click="loadData()"
              :disabled="isRefreshing"
              class="px-4 py-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-all"
            >
              <ArrowPathIcon
                class="w-5 h-5 text-gray-700"
                :class="{ 'animate-spin': isRefreshing }"
              />
            </button>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6">
        <div class="flex border-b border-gray-100">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id as any"
            class="flex-1 px-6 py-4 flex items-center justify-center space-x-3 transition-all relative"
            :class="activeTab === tab.id
              ? 'bg-gradient-to-br from-' + tab.color + '-50 to-' + tab.color + '-100 border-b-2 border-' + tab.color + '-600'
              : 'hover:bg-gray-50'"
          >
            <component
              :is="tab.icon"
              class="w-6 h-6"
              :class="activeTab === tab.id ? 'text-' + tab.color + '-600' : 'text-gray-400'"
            />
            <div class="text-left">
              <div
                class="font-semibold"
                :class="activeTab === tab.id ? 'text-' + tab.color + '-900' : 'text-gray-600'"
              >
                {{ tab.label }}
              </div>
              <div class="text-xs text-gray-500">{{ tab.description }}</div>
            </div>
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isRefreshing && currentProducts.length === 0" class="flex items-center justify-center py-20">
        <div class="text-center">
          <ArrowPathIcon class="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <div class="text-gray-600 font-medium">載入產品分析...</div>
        </div>
      </div>

      <!-- Products Grid -->
      <div v-else-if="currentProducts.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="(product, index) in currentProducts"
          :key="product.menuItemId"
          class="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-all relative overflow-hidden group"
        >
          <!-- Rank Badge -->
          <div class="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-lg"
               :class="{
                 'bg-gradient-to-br from-yellow-400 to-orange-500': index === 0,
                 'bg-gradient-to-br from-gray-300 to-gray-400': index === 1,
                 'bg-gradient-to-br from-orange-300 to-orange-400': index === 2,
                 'bg-gradient-to-br from-indigo-500 to-purple-600': index > 2,
               }">
            {{ index + 1 }}
          </div>

          <!-- Product Header -->
          <div class="mb-4 pr-12">
            <h3 class="text-lg font-bold text-gray-900 mb-1 line-clamp-2">
              {{ product.menuItemName }}
            </h3>
            <div class="text-sm text-gray-500">{{ product.category }}</div>
          </div>

          <!-- Key Metrics -->
          <div class="space-y-3 mb-4">
            <!-- Traffic Drivers Metrics -->
            <template v-if="activeTab === 'traffic'">
              <div class="flex items-center justify-between py-2 border-b border-gray-100">
                <span class="text-sm text-gray-600">首選次數</span>
                <span class="font-semibold text-gray-900">{{ product.firstItemInOrderCount }}</span>
              </div>
              <div class="flex items-center justify-between py-2 border-b border-gray-100">
                <span class="text-sm text-gray-600">轉換率</span>
                <span class="font-semibold text-indigo-600">{{ formatPercent(product.conversionRate) }}</span>
              </div>
              <div class="flex items-center justify-between py-2 border-b border-gray-100">
                <span class="text-sm text-gray-600">加購率</span>
                <span class="font-semibold text-purple-600">{{ formatPercent(product.cartAdditionRate) }}</span>
              </div>
            </template>

            <!-- Bestsellers Metrics -->
            <template v-if="activeTab === 'bestsellers'">
              <div class="flex items-center justify-between py-2 border-b border-gray-100">
                <span class="text-sm text-gray-600">總訂單</span>
                <span class="font-semibold text-gray-900">{{ product.totalOrders }}</span>
              </div>
              <div class="flex items-center justify-between py-2 border-b border-gray-100">
                <span class="text-sm text-gray-600">總營收</span>
                <span class="font-semibold text-green-600">{{ formatCurrency(product.totalRevenue) }}</span>
              </div>
              <div class="flex items-center justify-between py-2 border-b border-gray-100">
                <span class="text-sm text-gray-600">平均客單價</span>
                <span class="font-semibold text-blue-600">{{ formatCurrency(product.averageOrderValue) }}</span>
              </div>
            </template>

            <!-- Profit Leaders Metrics -->
            <template v-if="activeTab === 'profit'">
              <div class="flex items-center justify-between py-2 border-b border-gray-100">
                <span class="text-sm text-gray-600">總利潤</span>
                <span class="font-semibold text-green-600">{{ formatCurrency(product.totalProfit) }}</span>
              </div>
              <div class="flex items-center justify-between py-2 border-b border-gray-100">
                <span class="text-sm text-gray-600">利潤率</span>
                <span class="font-semibold text-emerald-600">
                  {{ product.profitMargin ? formatPercent(product.profitMargin) : 'N/A' }}
                </span>
              </div>
              <div class="flex items-center justify-between py-2 border-b border-gray-100">
                <span class="text-sm text-gray-600">單價</span>
                <span class="font-semibold text-gray-900">{{ formatCurrency(product.unitPrice) }}</span>
              </div>
            </template>

            <!-- Common Metrics -->
            <div class="flex items-center justify-between py-2">
              <span class="text-sm text-gray-600">趨勢</span>
              <div class="flex items-center space-x-1" :class="getTrendColor(product.trendScore)">
                <TrendingUpIcon v-if="product.trendScore > 0" class="w-4 h-4" />
                <TrendingDownIcon v-else-if="product.trendScore < 0" class="w-4 h-4" />
                <span class="font-semibold">
                  {{ product.trendScore > 0 ? '+' : '' }}{{ (product.trendScore * 100).toFixed(0) }}%
                </span>
              </div>
            </div>
          </div>

          <!-- Categories Badges -->
          <div class="flex flex-wrap gap-2">
            <span
              v-for="category in product.categories"
              :key="category"
              class="px-2 py-1 text-xs font-semibold rounded-full"
              :class="{
                'bg-indigo-100 text-indigo-700': category === 'traffic-driver',
                'bg-orange-100 text-orange-700': category === 'bestseller',
                'bg-green-100 text-green-700': category === 'profit-leader',
                'bg-red-100 text-red-700': category === 'underperformer',
              }"
            >
              {{
                category === 'traffic-driver' ? '引流'
                : category === 'bestseller' ? '熱銷'
                : category === 'profit-leader' ? '高利潤'
                : '待改進'
              }}
            </span>
          </div>

          <!-- Hover Effect -->
          <div class="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
        </div>
      </div>

      <!-- No Data State -->
      <div v-else class="text-center py-20">
        <ChartBarIcon class="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <div class="text-gray-600 font-medium mb-2">暫無產品數據</div>
        <div class="text-sm text-gray-500">請確保有足夠的訂單數據進行分析</div>
      </div>

      <!-- Summary Cards -->
      <div v-if="currentProducts.length > 0" class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 border border-blue-100">
          <div class="flex items-center space-x-3 mb-3">
            <div class="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
              <ShoppingCartIcon class="w-6 h-6 text-white" />
            </div>
            <div class="font-semibold text-blue-900">分析見解</div>
          </div>
          <p class="text-sm text-blue-800 leading-relaxed">
            <template v-if="activeTab === 'traffic'">
              引流產品幫助您吸引新客戶。考慮搭配高利潤產品進行促銷。
            </template>
            <template v-else-if="activeTab === 'bestsellers'">
              熱銷產品是您的核心競爭力。確保庫存充足，維持品質穩定。
            </template>
            <template v-else>
              高利潤產品提升整體盈利能力。可通過推薦或套餐增加銷量。
            </template>
          </p>
        </div>

        <div class="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-100">
          <div class="flex items-center space-x-3 mb-3">
            <div class="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center">
              <SparklesIcon class="w-6 h-6 text-white" />
            </div>
            <div class="font-semibold text-purple-900">優化建議</div>
          </div>
          <p class="text-sm text-purple-800 leading-relaxed">
            <template v-if="activeTab === 'traffic'">
              將引流產品放置在菜單顯眼位置，優化產品圖片和描述。
            </template>
            <template v-else-if="activeTab === 'bestsellers'">
              分析熱銷產品的成功要素，複製到其他產品上。
            </template>
            <template v-else>
              優化成本控制，考慮價格策略調整以最大化利潤。
            </template>
          </p>
        </div>

        <div class="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100">
          <div class="flex items-center space-x-3 mb-3">
            <div class="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
              <TrendingUpIcon class="w-6 h-6 text-white" />
            </div>
            <div class="font-semibold text-green-900">行動方案</div>
          </div>
          <p class="text-sm text-green-800 leading-relaxed">
            <template v-if="activeTab === 'traffic'">
              創建「引流產品 + 高利潤產品」套餐，提升整體利潤率。
            </template>
            <template v-else-if="activeTab === 'bestsellers'">
              考慮推出熱銷產品的變體或升級版本，擴大產品線。
            </template>
            <template v-else>
              培訓員工重點推薦高利潤產品，設置銷售獎勵機制。
            </template>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

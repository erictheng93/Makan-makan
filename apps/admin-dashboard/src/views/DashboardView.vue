<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">儀表板</h1>
        <p class="text-gray-600">歡迎回來，{{ user?.username }}</p>
      </div>
      <div class="flex items-center space-x-3">
        <div class="text-sm text-gray-500">
          最後更新: {{ lastUpdatedText }}
        </div>
        <button
          @click="refreshData"
          :disabled="isLoading"
          class="btn-secondary"
          :class="{ 'opacity-50': isLoading }"
        >
          <RefreshCw class="w-4 h-4 mr-2" :class="{ 'animate-spin': isLoading }" />
          重新整理
        </button>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatsCard
        title="今日訂單"
        :value="todayOrders"
        icon="shopping-cart"
        color="blue"
        :loading="isLoading"
      />
      <StatsCard
        title="今日營收"
        :value="formatCurrency(todayRevenue)"
        icon="dollar-sign"
        color="green"
        :loading="isLoading"
      />
      <StatsCard
        title="平均客單價"
        :value="formatCurrency(averageOrderValue)"
        icon="trending-up"
        color="purple"
        :loading="isLoading"
      />
      <StatsCard
        title="完成率"
        :value="formatPercentage(completionRate)"
        icon="check-circle"
        color="orange"
        :loading="isLoading"
      />
    </div>

    <!-- Charts Section -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Revenue Chart -->
      <div class="card p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">營收趨勢</h3>
          <select 
            v-model="revenueChartPeriod" 
            @change="updateRevenueChart"
            class="form-input w-auto"
          >
            <option value="daily">今日</option>
            <option value="weekly">本週</option>
            <option value="monthly">本月</option>
          </select>
        </div>
        <RevenueChart 
          :data="revenueChart as any" 
          :loading="isLoading"
          :period="revenueChartPeriod as 'daily' | 'weekly' | 'monthly'"
        />
      </div>

      <!-- Orders Chart -->
      <div class="card p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">訂單趨勢</h3>
          <select 
            v-model="ordersChartPeriod" 
            @change="updateOrdersChart"
            class="form-input w-auto"
          >
            <option value="daily">今日</option>
            <option value="weekly">本週</option>
            <option value="monthly">本月</option>
          </select>
        </div>
        <OrdersChart 
          :data="ordersChart as any" 
          :loading="isLoading"
          :period="ordersChartPeriod as 'daily' | 'weekly' | 'monthly'"
        />
      </div>
    </div>

    <!-- Recent Activity Section -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Top Menu Items -->
      <div class="lg:col-span-2">
        <div class="card p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">熱門菜品</h3>
          <TopMenuItems 
            :items="topMenuItems as any" 
            :loading="isLoading"
          />
        </div>
      </div>

      <!-- Recent Orders -->
      <div class="card p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">最新訂單</h3>
          <router-link 
            to="/dashboard/orders" 
            class="text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            查看全部
          </router-link>
        </div>
        <RecentOrders :loading="orderStore.isLoading" />
      </div>
    </div>

    <!-- Quick Actions -->
    <div v-if="canAccessAdminFeatures" class="card p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">快速操作</h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <router-link
          to="/dashboard/menu"
          class="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Menu class="w-8 h-8 text-primary-600 mb-2" />
          <span class="text-sm font-medium text-gray-900">管理菜單</span>
        </router-link>
        
        <router-link
          to="/dashboard/tables"
          class="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Table class="w-8 h-8 text-primary-600 mb-2" />
          <span class="text-sm font-medium text-gray-900">管理桌台</span>
        </router-link>
        
        <router-link
          to="/dashboard/users"
          class="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Users class="w-8 h-8 text-primary-600 mb-2" />
          <span class="text-sm font-medium text-gray-900">員工管理</span>
        </router-link>
        
        <router-link
          to="/dashboard/analytics"
          class="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <BarChart3 class="w-8 h-8 text-primary-600 mb-2" />
          <span class="text-sm font-medium text-gray-900">詳細分析</span>
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useDashboardStore } from '@/stores/dashboard'
import { useOrderStore } from '@/stores/order'
import { OrderStatus } from '@/types'
import { useDashboardPolling } from '@/composables/usePolling'
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  RefreshCw,
  Menu,
  Table,
  Users,
  BarChart3
} from 'lucide-vue-next'

// Components (these would be implemented separately)
import StatsCard from '@/components/dashboard/StatsCard.vue'
import RevenueChart from '@/components/dashboard/RevenueChart.vue'
import OrdersChart from '@/components/dashboard/OrdersChart.vue'
import TopMenuItems from '@/components/dashboard/TopMenuItems.vue'
import RecentOrders from '@/components/dashboard/RecentOrders.vue'

const authStore = useAuthStore()
const dashboardStore = useDashboardStore()
const orderStore = useOrderStore()

const revenueChartPeriod = ref('daily')
const ordersChartPeriod = ref('daily')

// Start auto-refresh for dashboard data
const { start: startPolling, stop: stopPolling } = useDashboardPolling(30000)

const user = computed(() => authStore.user)
const isLoading = computed(() => dashboardStore.isLoading)
const canAccessAdminFeatures = computed(() => authStore.canAccessAdminFeatures)

// Dashboard stats
const todayOrders = computed(() => dashboardStore.todayOrders)
const todayRevenue = computed(() => dashboardStore.todayRevenue)
const averageOrderValue = computed(() => dashboardStore.averageOrderValue)
const completionRate = computed(() => dashboardStore.completionRate)
const topMenuItems = computed(() => dashboardStore.topMenuItems)
const revenueChart = computed(() => dashboardStore.revenueChart)
const ordersChart = computed(() => dashboardStore.ordersChart)

const lastUpdatedText = computed(() => {
  if (!dashboardStore.lastUpdated) return '從未更新'
  return formatDistanceToNow(dashboardStore.lastUpdated, {
    addSuffix: true,
    locale: zhTW
  })
})

const formatCurrency = (amount: number) => {
  return dashboardStore.formatCurrency(amount)
}

const formatPercentage = (value: number) => {
  return dashboardStore.formatPercentage(value)
}

const refreshData = async () => {
  await Promise.all([
    dashboardStore.fetchDashboardStats(),
    orderStore.fetchOrders({ status: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY] })
  ])
}

const updateRevenueChart = async () => {
  await dashboardStore.fetchRevenueAnalytics(revenueChartPeriod.value as 'daily' | 'weekly' | 'monthly')
}

const updateOrdersChart = async () => {
  await dashboardStore.fetchOrderAnalytics(ordersChartPeriod.value as 'daily' | 'weekly' | 'monthly')
}

onMounted(async () => {
  // Initial data load
  await refreshData()
  
  // Start auto-refresh
  startPolling()
  dashboardStore.startAutoRefresh(30000)
})

onUnmounted(() => {
  stopPolling()
  dashboardStore.stopAutoRefresh()
})
</script>
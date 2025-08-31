<template>
  <div class="space-y-3">
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 5" :key="i" class="animate-pulse">
        <div class="flex items-center justify-between py-3 px-3 border rounded-lg">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-gray-300 rounded-full"></div>
            <div class="space-y-2">
              <div class="h-4 bg-gray-300 rounded w-20"></div>
              <div class="h-3 bg-gray-300 rounded w-16"></div>
            </div>
          </div>
          <div class="space-y-2">
            <div class="h-4 bg-gray-300 rounded w-16"></div>
            <div class="h-3 bg-gray-300 rounded w-12"></div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="!orders || orders.length === 0" class="text-center py-8 text-gray-500">
      <ShoppingCart class="w-16 h-16 mx-auto mb-4 text-gray-300" />
      <p>暫無最新訂單</p>
    </div>

    <div v-else class="space-y-2">
      <div 
        v-for="order in orders.slice(0, maxOrders)" 
        :key="order.id"
        class="flex items-center justify-between py-3 px-3 border rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all cursor-pointer"
        @click="$emit('orderClick', order)"
      >
        <div class="flex items-center space-x-3">
          <div class="flex-shrink-0">
            <div 
              class="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
              :class="getStatusColor(order.status).bg"
            >
              <component :is="getStatusIcon(order.status)" class="w-5 h-5" />
            </div>
          </div>
          
          <div class="flex-1 min-w-0">
            <div class="flex items-center space-x-2">
              <p class="text-sm font-medium text-gray-900">
                #{{ order.orderNumber }}
              </p>
              <span 
                class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                :class="getStatusColor(order.status).text"
              >
                {{ getStatusText(order.status) }}
              </span>
            </div>
            <div class="flex items-center space-x-2 mt-1">
              <p class="text-xs text-gray-500">
                桌號 {{ order.tableNumber }}
              </p>
              <span class="text-gray-300">•</span>
              <p class="text-xs text-gray-500">
                {{ formatTime(order.createdAt) }}
              </p>
              <span v-if="order.itemCount" class="text-gray-300">•</span>
              <p v-if="order.itemCount" class="text-xs text-gray-500">
                {{ order.itemCount }} 項商品
              </p>
            </div>
          </div>
        </div>

        <div class="flex-shrink-0 text-right">
          <p class="text-sm font-semibold text-gray-900">
            ${{ order.total.toLocaleString() }}
          </p>
          <div class="flex items-center space-x-1 mt-1">
            <Clock class="w-3 h-3 text-gray-400" />
            <p class="text-xs text-gray-500">
              {{ getTimeElapsed(order.createdAt) }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="orders && orders.length > maxOrders" class="pt-2 text-center">
      <button 
        @click="$emit('showMore')"
        class="text-sm text-primary-600 hover:text-primary-700 font-medium"
      >
        查看更多訂單 ({{ orders.length - maxOrders }} 筆)
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// Remove unused computed import
import { formatDistanceToNow } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { 
  ShoppingCart, 
  Clock, 
  CheckCircle, 
  XCircle,
  Utensils,
  Package
} from 'lucide-vue-next'

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled'

interface RecentOrder {
  id: string
  orderNumber: string
  tableNumber: string
  status: OrderStatus
  total: number
  itemCount?: number
  createdAt: string
  updatedAt: string
}

interface RecentOrdersProps {
  orders?: RecentOrder[]
  loading?: boolean
  maxOrders?: number
}

withDefaults(defineProps<RecentOrdersProps>(), {
  loading: false,
  maxOrders: 10
})

defineEmits<{
  orderClick: [order: RecentOrder]
  showMore: []
}>()

const getStatusColor = (status: OrderStatus) => {
  const colorMap = {
    pending: {
      bg: 'bg-yellow-500',
      text: 'bg-yellow-100 text-yellow-800'
    },
    confirmed: {
      bg: 'bg-blue-500',
      text: 'bg-blue-100 text-blue-800'
    },
    preparing: {
      bg: 'bg-orange-500',
      text: 'bg-orange-100 text-orange-800'
    },
    ready: {
      bg: 'bg-purple-500',
      text: 'bg-purple-100 text-purple-800'
    },
    completed: {
      bg: 'bg-green-500',
      text: 'bg-green-100 text-green-800'
    },
    cancelled: {
      bg: 'bg-red-500',
      text: 'bg-red-100 text-red-800'
    }
  }
  return colorMap[status] || colorMap.pending
}

const getStatusIcon = (status: OrderStatus) => {
  const iconMap = {
    pending: Clock,
    confirmed: CheckCircle,
    preparing: Utensils,
    ready: Package,
    completed: CheckCircle,
    cancelled: XCircle
  }
  return iconMap[status] || Clock
}

const getStatusText = (status: OrderStatus) => {
  const textMap = {
    pending: '待確認',
    confirmed: '已確認',
    preparing: '製作中',
    ready: '待取餐',
    completed: '已完成',
    cancelled: '已取消'
  }
  return textMap[status] || '未知'
}

const formatTime = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleTimeString('zh-TW', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false
  })
}

const getTimeElapsed = (dateString: string) => {
  const date = new Date(dateString)
  return formatDistanceToNow(date, {
    addSuffix: true,
    locale: zhTW
  })
}
</script>
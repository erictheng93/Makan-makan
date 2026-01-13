<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useTenantsStore } from '@/stores/tenants'
import { RouterLink } from 'vue-router'
import { useToast } from 'vue-toastification'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  BuildingStorefrontIcon
} from '@heroicons/vue/24/outline'
import CreateTenantModal from '@/components/tenants/CreateTenantModal.vue'
import type { TenantStatus } from '@/types'

const tenantsStore = useTenantsStore()
const toast = useToast()

// 狀態
const showCreateModal = ref(false)
const searchQuery = ref('')
const statusFilter = ref<TenantStatus | 'all'>('all')

// 載入資料
onMounted(async () => {
  await tenantsStore.fetchTenants()
})

// 過濾後的租戶列表
const filteredTenants = computed(() => {
  let result = tenantsStore.tenants

  // 搜索過濾
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(t =>
      t.businessName.toLowerCase().includes(query) ||
      t.contactEmail.toLowerCase().includes(query) ||
      t.subdomain?.toLowerCase().includes(query)
    )
  }

  // 狀態過濾
  if (statusFilter.value !== 'all') {
    result = result.filter(t => t.status === statusFilter.value)
  }

  return result
})

// 狀態選項
const statusOptions = [
  { value: 'all', label: '全部狀態' },
  { value: 'active', label: '運行中' },
  { value: 'pending', label: '待處理' },
  { value: 'provisioning', label: '配置中' },
  { value: 'suspended', label: '已暫停' },
  { value: 'terminated', label: '已終止' }
]

// 處理創建成功
const handleCreateSuccess = () => {
  showCreateModal.value = false
  toast.success('租戶創建成功')
}

// 獲取狀態標籤
const getStatusLabel = (status: TenantStatus) => {
  const labels: Record<TenantStatus, string> = {
    pending: '待處理',
    provisioning: '配置中',
    active: '運行中',
    suspended: '已暫停',
    terminated: '已終止'
  }
  return labels[status] || status
}

// 獲取狀態樣式
const getStatusClass = (status: TenantStatus) => {
  const classes: Record<TenantStatus, string> = {
    pending: 'badge-warning',
    provisioning: 'badge-info',
    active: 'badge-success',
    suspended: 'badge-danger',
    terminated: 'badge-gray'
  }
  return classes[status] || 'badge-gray'
}
</script>

<template>
  <div class="space-y-6">
    <!-- 頁面標題 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">租戶管理</h1>
        <p class="mt-1 text-sm text-gray-500">
          管理所有獨立部署的餐廳租戶
        </p>
      </div>
      <button
        type="button"
        class="btn btn-primary"
        @click="showCreateModal = true"
      >
        <PlusIcon class="h-5 w-5 mr-2" />
        新增租戶
      </button>
    </div>

    <!-- 過濾器 -->
    <div class="card">
      <div class="flex flex-col sm:flex-row gap-4">
        <!-- 搜索 -->
        <div class="flex-1">
          <div class="relative">
            <MagnifyingGlassIcon
              class="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
            />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索商家名稱、Email、子域名..."
              class="input pl-10"
            />
          </div>
        </div>

        <!-- 狀態過濾 -->
        <div class="flex items-center gap-2">
          <FunnelIcon class="h-5 w-5 text-gray-400" />
          <select v-model="statusFilter" class="input w-40">
            <option
              v-for="option in statusOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- 租戶列表 -->
    <div class="card p-0 overflow-hidden">
      <div v-if="tenantsStore.loading" class="text-center py-12">
        <div class="loading-spinner mx-auto" />
        <p class="mt-2 text-sm text-gray-500">載入中...</p>
      </div>

      <div v-else-if="filteredTenants.length === 0" class="text-center py-12">
        <BuildingStorefrontIcon class="mx-auto h-12 w-12 text-gray-400" />
        <h3 class="mt-2 text-sm font-medium text-gray-900">
          {{ searchQuery || statusFilter !== 'all' ? '沒有符合條件的租戶' : '暫無租戶' }}
        </h3>
        <p class="mt-1 text-sm text-gray-500">
          {{ searchQuery || statusFilter !== 'all' ? '嘗試調整搜索條件' : '點擊新增按鈕創建第一個租戶' }}
        </p>
      </div>

      <table v-else class="table">
        <thead>
          <tr>
            <th>商家名稱</th>
            <th>聯絡 Email</th>
            <th>子域名</th>
            <th>狀態</th>
            <th>部署版本</th>
            <th>建立時間</th>
            <th class="text-right">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 bg-white">
          <tr v-for="tenant in filteredTenants" :key="tenant.id">
            <td>
              <div class="flex items-center">
                <div
                  class="flex-shrink-0 h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center"
                >
                  <span class="text-primary-700 font-medium">
                    {{ tenant.businessName.charAt(0) }}
                  </span>
                </div>
                <div class="ml-4">
                  <div class="font-medium text-gray-900">{{ tenant.businessName }}</div>
                  <div v-if="tenant.customDomain" class="text-sm text-gray-500">
                    {{ tenant.customDomain }}
                  </div>
                </div>
              </div>
            </td>
            <td>{{ tenant.contactEmail }}</td>
            <td>
              <code v-if="tenant.subdomain" class="text-sm bg-gray-100 px-2 py-1 rounded">
                {{ tenant.subdomain }}.makanmakan.app
              </code>
              <span v-else class="text-gray-400">-</span>
            </td>
            <td>
              <span class="badge" :class="getStatusClass(tenant.status)">
                {{ getStatusLabel(tenant.status) }}
              </span>
            </td>
            <td>
              <code v-if="tenant.deployedVersion" class="text-sm">
                v{{ tenant.deployedVersion }}
              </code>
              <span v-else class="text-gray-400">-</span>
            </td>
            <td class="text-gray-500">
              {{ new Date(tenant.createdAt).toLocaleDateString() }}
            </td>
            <td class="text-right">
              <RouterLink
                :to="`/tenants/${tenant.id}`"
                class="text-primary-600 hover:text-primary-700 font-medium"
              >
                管理
              </RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 創建租戶 Modal -->
    <CreateTenantModal
      :show="showCreateModal"
      @close="showCreateModal = false"
      @success="handleCreateSuccess"
    />
  </div>
</template>

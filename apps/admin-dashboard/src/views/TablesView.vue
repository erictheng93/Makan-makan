<template>
  <div class="tables-view">
    <!-- 頁面標題和操作 -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">桌台管理</h1>
        <p class="text-gray-600">管理餐廳桌台和 QR 碼</p>
      </div>
      <div class="flex space-x-4">
        <button
          @click="generateAllQRCodes"
          class="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <PhotoIcon class="h-4 w-4 mr-2" />
          批量生成 QR 碼
        </button>
        <button
          @click="showTableModal = true"
          class="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusIcon class="h-4 w-4 mr-2" />
          新增桌台
        </button>
      </div>
    </div>

    <!-- 桌台統計 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-green-100 rounded-lg">
            <CheckCircleIcon class="h-6 w-6 text-green-600" />
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900">可用桌台</h3>
            <p class="text-2xl font-bold text-green-600">{{ stats.available }}</p>
          </div>
        </div>
      </div>
      
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-red-100 rounded-lg">
            <UserGroupIcon class="h-6 w-6 text-red-600" />
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900">使用中</h3>
            <p class="text-2xl font-bold text-red-600">{{ stats.occupied }}</p>
          </div>
        </div>
      </div>
      
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-yellow-100 rounded-lg">
            <ClockIcon class="h-6 w-6 text-yellow-600" />
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900">已預約</h3>
            <p class="text-2xl font-bold text-yellow-600">{{ stats.reserved }}</p>
          </div>
        </div>
      </div>
      
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-gray-100 rounded-lg">
            <WrenchScrewdriverIcon class="h-6 w-6 text-gray-600" />
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900">維護中</h3>
            <p class="text-2xl font-bold text-gray-600">{{ stats.maintenance }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 桌台篩選 -->
    <div class="bg-white rounded-lg shadow mb-6">
      <div class="p-6">
        <div class="flex flex-col sm:flex-row gap-4">
          <div class="relative flex-1">
            <MagnifyingGlassIcon class="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索桌台號碼或位置..."
              class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            v-model="statusFilter"
            class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">所有狀態</option>
            <option value="available">可用</option>
            <option value="occupied">使用中</option>
            <option value="reserved">已預約</option>
            <option value="maintenance">維護中</option>
          </select>
          <select
            v-model="capacityFilter"
            class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">所有容量</option>
            <option value="2">2人桌</option>
            <option value="4">4人桌</option>
            <option value="6">6人桌</option>
            <option value="8">8人桌以上</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 桌台網格視圖 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <div
        v-for="table in filteredTables"
        :key="table.id"
        class="bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
      >
        <!-- 桌台卡片 -->
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center">
              <div :class="getStatusColor(table.status)" class="w-3 h-3 rounded-full mr-3"></div>
              <h3 class="text-lg font-semibold text-gray-900">桌號 {{ table.tableNumber }}</h3>
            </div>
            <span
              :class="getStatusBadgeClass(table.status)"
              class="px-2 py-1 text-xs font-medium rounded-full"
            >
              {{ getStatusText(table.status) }}
            </span>
          </div>

          <div class="space-y-2 mb-4">
            <div class="flex items-center text-sm text-gray-600">
              <UserGroupIcon class="h-4 w-4 mr-2" />
              <span>容量: {{ table.capacity }} 人</span>
            </div>
            <div class="flex items-center text-sm text-gray-600">
              <MapPinIcon class="h-4 w-4 mr-2" />
              <span>位置: {{ table.location || '未設定' }}</span>
            </div>
            <div v-if="table.currentOrderId" class="flex items-center text-sm text-gray-600">
              <DocumentTextIcon class="h-4 w-4 mr-2" />
              <span>訂單: #{{ table.currentOrderId }}</span>
            </div>
          </div>

          <!-- QR 碼預覽 -->
          <div class="mb-4 text-center">
            <div class="inline-block p-3 bg-gray-50 rounded-lg">
              <div class="w-20 h-20 bg-white border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                <PhotoIcon class="h-8 w-8 text-gray-400" />
              </div>
            </div>
          </div>

          <!-- 操作按鈕 -->
          <div class="flex flex-wrap gap-2">
            <button
              @click="viewQRCode(table)"
              class="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              查看 QR 碼
            </button>
            <button
              @click="editTable(table)"
              class="px-3 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              編輯
            </button>
            <button
              @click="changeTableStatus(table)"
              :class="getStatusButtonClass(table.status)"
              class="px-3 py-2 text-sm rounded-lg transition-colors"
            >
              {{ getStatusButtonText(table.status) }}
            </button>
          </div>
        </div>
      </div>

      <!-- 空狀態 -->
      <div v-if="filteredTables.length === 0" class="col-span-full text-center py-12">
        <TableCellsIcon class="mx-auto h-12 w-12 text-gray-400" />
        <h3 class="mt-2 text-sm font-medium text-gray-900">暫無桌台</h3>
        <p class="mt-1 text-sm text-gray-500">開始添加您的第一張桌台</p>
        <button
          @click="showTableModal = true"
          class="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusIcon class="h-4 w-4 mr-2" />
          新增桌台
        </button>
      </div>
    </div>

    <!-- 桌台管理模態框 -->
    <div v-if="showTableModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div class="fixed inset-0 bg-black opacity-30" @click="closeTableModal"></div>
        <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          <div class="p-6">
            <h3 class="text-lg font-semibold mb-4">
              {{ editingTable ? '編輯桌台' : '新增桌台' }}
            </h3>
            
            <form @submit.prevent="saveTable">
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    桌台號碼 <span class="text-red-500">*</span>
                  </label>
                  <input
                    v-model="tableForm.tableNumber"
                    type="text"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">桌台名稱</label>
                  <input
                    v-model="tableForm.tableName"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    容量 <span class="text-red-500">*</span>
                  </label>
                  <select
                    v-model.number="tableForm.capacity"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="2">2 人</option>
                    <option value="4">4 人</option>
                    <option value="6">6 人</option>
                    <option value="8">8 人</option>
                    <option value="10">10 人</option>
                  </select>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">位置描述</label>
                  <input
                    v-model="tableForm.location"
                    type="text"
                    placeholder="例如: 靠窗位置、角落、中央區域"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">狀態</label>
                  <select
                    v-model="tableForm.status"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="available">可用</option>
                    <option value="occupied">使用中</option>
                    <option value="reserved">已預約</option>
                    <option value="maintenance">維護中</option>
                  </select>
                </div>
              </div>
              
              <div class="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  @click="closeTableModal"
                  class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {{ editingTable ? '更新' : '新增' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- QR 碼預覽模態框 -->
    <div v-if="showQRModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div class="fixed inset-0 bg-black opacity-30" @click="showQRModal = false"></div>
        <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          <div class="p-6 text-center">
            <h3 class="text-lg font-semibold mb-4">
              桌號 {{ selectedTable?.tableNumber }} QR 碼
            </h3>
            
            <div class="mb-6">
              <div class="inline-block p-4 bg-white border rounded-lg">
                <div class="w-48 h-48 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                  <div class="text-center">
                    <PhotoIcon class="mx-auto h-16 w-16 text-gray-400 mb-2" />
                    <p class="text-sm text-gray-500">QR 碼預覽</p>
                    <p class="text-xs text-gray-400 mt-1">{{ selectedTable?.qrCode }}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="flex justify-center space-x-3">
              <button
                @click="downloadQRCode"
                class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                下載 QR 碼
              </button>
              <button
                @click="printQRCode"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                列印 QR 碼
              </button>
              <button
                @click="showQRModal = false"
                class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PhotoIcon,
  CheckCircleIcon,
  UserGroupIcon,
  ClockIcon,
  WrenchIcon,
  MapPinIcon,
  DocumentTextIcon,
  TableCellsIcon
} from '@heroicons/vue/24/outline'

// 響應式數據
const searchQuery = ref('')
const statusFilter = ref('')
const capacityFilter = ref('')
const showTableModal = ref(false)
const showQRModal = ref(false)
const editingTable = ref(null)
const selectedTable = ref(null)

// 模擬桌台數據
const tables = ref([
  {
    id: 1,
    tableNumber: 'T01',
    tableName: 'Table 1',
    capacity: 2,
    location: '靠窗位置',
    status: 'available',
    qrCode: 'QR_REST1_T01_ABC123',
    currentOrderId: null
  },
  {
    id: 2,
    tableNumber: 'T02',
    tableName: 'Table 2',
    capacity: 4,
    location: '中央區域',
    status: 'occupied',
    qrCode: 'QR_REST1_T02_DEF456',
    currentOrderId: 'ORD-2024-001'
  },
  {
    id: 3,
    tableNumber: 'T03',
    tableName: 'Table 3',
    capacity: 4,
    location: '中央區域',
    status: 'available',
    qrCode: 'QR_REST1_T03_GHI789',
    currentOrderId: null
  },
  {
    id: 4,
    tableNumber: 'T04',
    tableName: 'Table 4',
    capacity: 6,
    location: '角落位置',
    status: 'reserved',
    qrCode: 'QR_REST1_T04_JKL012',
    currentOrderId: null
  },
  {
    id: 5,
    tableNumber: 'T05',
    tableName: 'Table 5',
    capacity: 2,
    location: '吧台區',
    status: 'maintenance',
    qrCode: 'QR_REST1_T05_MNO345',
    currentOrderId: null
  }
])

// 表單數據
const tableForm = ref({
  tableNumber: '',
  tableName: '',
  capacity: 4,
  location: '',
  status: 'available'
})

// 計算屬性
const stats = computed(() => ({
  available: tables.value.filter(t => t.status === 'available').length,
  occupied: tables.value.filter(t => t.status === 'occupied').length,
  reserved: tables.value.filter(t => t.status === 'reserved').length,
  maintenance: tables.value.filter(t => t.status === 'maintenance').length
}))

const filteredTables = computed(() => {
  let filtered = tables.value

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(table => 
      table.tableNumber.toLowerCase().includes(query) ||
      table.tableName?.toLowerCase().includes(query) ||
      table.location?.toLowerCase().includes(query)
    )
  }

  if (statusFilter.value) {
    filtered = filtered.filter(table => table.status === statusFilter.value)
  }

  if (capacityFilter.value) {
    const capacity = parseInt(capacityFilter.value)
    if (capacity === 8) {
      filtered = filtered.filter(table => table.capacity >= 8)
    } else {
      filtered = filtered.filter(table => table.capacity === capacity)
    }
  }

  return filtered.sort((a, b) => a.tableNumber.localeCompare(b.tableNumber))
})

// 方法
const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    'available': 'bg-green-500',
    'occupied': 'bg-red-500',
    'reserved': 'bg-yellow-500',
    'maintenance': 'bg-gray-500'
  }
  return colors[status] || 'bg-gray-500'
}

const getStatusBadgeClass = (status: string) => {
  const classes: Record<string, string> = {
    'available': 'bg-green-100 text-green-800',
    'occupied': 'bg-red-100 text-red-800',
    'reserved': 'bg-yellow-100 text-yellow-800',
    'maintenance': 'bg-gray-100 text-gray-800'
  }
  return classes[status] || 'bg-gray-100 text-gray-800'
}

const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    'available': '可用',
    'occupied': '使用中',
    'reserved': '已預約',
    'maintenance': '維護中'
  }
  return texts[status] || status
}

const getStatusButtonClass = (status: string) => {
  const classes: Record<string, string> = {
    'available': 'bg-red-600 text-white hover:bg-red-700',
    'occupied': 'bg-green-600 text-white hover:bg-green-700',
    'reserved': 'bg-blue-600 text-white hover:bg-blue-700',
    'maintenance': 'bg-yellow-600 text-white hover:bg-yellow-700'
  }
  return classes[status] || 'bg-gray-600 text-white hover:bg-gray-700'
}

const getStatusButtonText = (status: string) => {
  const texts: Record<string, string> = {
    'available': '使用',
    'occupied': '清理',
    'reserved': '入座',
    'maintenance': '修復'
  }
  return texts[status] || '變更'
}

const generateAllQRCodes = async () => {
  if (confirm('確定要為所有桌台重新生成 QR 碼嗎？')) {
    tables.value.forEach(table => {
      table.qrCode = `QR_REST1_${table.tableNumber}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    })
    alert('QR 碼生成完成！')
  }
}

const viewQRCode = (table: any) => {
  selectedTable.value = table
  showQRModal.value = true
}

const editTable = (table: any) => {
  editingTable.value = table
  tableForm.value = { ...table }
  showTableModal.value = true
}

const changeTableStatus = async (table: any) => {
  const statusFlow: Record<string, string> = {
    'available': 'occupied',
    'occupied': 'available',
    'reserved': 'occupied',
    'maintenance': 'available'
  }
  
  const newStatus = statusFlow[table.status]
  if (newStatus) {
    const index = tables.value.findIndex(t => t.id === table.id)
    if (index > -1) {
      tables.value[index].status = newStatus
      if (newStatus === 'available') {
        tables.value[index].currentOrderId = null
      }
    }
  }
}

const closeTableModal = () => {
  showTableModal.value = false
  editingTable.value = null
  tableForm.value = {
    tableNumber: '',
    tableName: '',
    capacity: 4,
    location: '',
    status: 'available'
  }
}

const saveTable = async () => {
  if (editingTable.value) {
    // 更新現有桌台
    const index = tables.value.findIndex(t => t.id === editingTable.value.id)
    if (index > -1) {
      tables.value[index] = { ...tables.value[index], ...tableForm.value }
    }
  } else {
    // 新增桌台
    const newTable = {
      id: Math.max(...tables.value.map(t => t.id)) + 1,
      ...tableForm.value,
      qrCode: `QR_REST1_${tableForm.value.tableNumber}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      currentOrderId: null
    }
    tables.value.push(newTable)
  }
  closeTableModal()
}

const downloadQRCode = () => {
  alert('QR 碼下載功能開發中...')
}

const printQRCode = () => {
  alert('QR 碼列印功能開發中...')
}

onMounted(() => {
  // 初始化數據
})
</script>

<style scoped>
.tables-view {
  padding: 1.5rem;
}

@media (max-width: 640px) {
  .tables-view {
    padding: 1rem;
  }
}
</style>
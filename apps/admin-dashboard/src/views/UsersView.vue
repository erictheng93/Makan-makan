<template>
  <div class="users-view">
    <!-- 頁面標題和操作 -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">員工管理</h1>
        <p class="text-gray-600">管理餐廳員工帳戶和權限</p>
      </div>
      <button
        @click="showUserModal = true"
        class="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <PlusIcon class="h-4 w-4 mr-2" />
        新增員工
      </button>
    </div>

    <!-- 員工統計 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-purple-100 rounded-lg">
            <CrownIcon class="h-6 w-6 text-purple-600" />
          </div>
          <div class="ml-4">
            <h3 class="text-sm font-semibold text-gray-900">店主</h3>
            <p class="text-xl font-bold text-purple-600">{{ stats.owner }}</p>
          </div>
        </div>
      </div>
      
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-orange-100 rounded-lg">
            <ChefHatIcon class="h-6 w-6 text-orange-600" />
          </div>
          <div class="ml-4">
            <h3 class="text-sm font-semibold text-gray-900">廚師</h3>
            <p class="text-xl font-bold text-orange-600">{{ stats.chef }}</p>
          </div>
        </div>
      </div>
      
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-green-100 rounded-lg">
            <TruckIcon class="h-6 w-6 text-green-600" />
          </div>
          <div class="ml-4">
            <h3 class="text-sm font-semibold text-gray-900">送菜員</h3>
            <p class="text-xl font-bold text-green-600">{{ stats.service }}</p>
          </div>
        </div>
      </div>
      
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-blue-100 rounded-lg">
            <CalculatorIcon class="h-6 w-6 text-blue-600" />
          </div>
          <div class="ml-4">
            <h3 class="text-sm font-semibold text-gray-900">收銀</h3>
            <p class="text-xl font-bold text-blue-600">{{ stats.cashier }}</p>
          </div>
        </div>
      </div>
      
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-gray-100 rounded-lg">
            <UserGroupIcon class="h-6 w-6 text-gray-600" />
          </div>
          <div class="ml-4">
            <h3 class="text-sm font-semibold text-gray-900">總員工</h3>
            <p class="text-xl font-bold text-gray-600">{{ stats.total }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 搜索和篩選 -->
    <div class="bg-white rounded-lg shadow mb-6">
      <div class="p-6">
        <div class="flex flex-col sm:flex-row gap-4">
          <div class="relative flex-1">
            <MagnifyingGlassIcon class="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索員工姓名或用戶名..."
              class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            v-model="roleFilter"
            class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">所有角色</option>
            <option value="1">店主 (Owner)</option>
            <option value="2">廚師 (Chef)</option>
            <option value="3">送菜員 (Service)</option>
            <option value="4">收銀員 (Cashier)</option>
          </select>
          <select
            v-model="statusFilter"
            class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">所有狀態</option>
            <option value="active">活躍</option>
            <option value="inactive">停用</option>
            <option value="suspended">暫停</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 員工列表 -->
    <div class="bg-white rounded-lg shadow">
      <div class="p-6">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  員工資訊
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  用戶名
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  角色
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  狀態
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  最後登入
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  加入日期
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="user in filteredUsers" :key="user.id" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10">
                      <div class="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                        <UserIcon class="h-6 w-6 text-gray-600" />
                      </div>
                    </div>
                    <div class="ml-4">
                      <div class="text-sm font-medium text-gray-900">{{ user.fullName || user.username }}</div>
                      <div class="text-sm text-gray-500">{{ user.email || '未設定 Email' }}</div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ user.username }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span :class="getRoleBadgeClass(user.role)" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
                    <component :is="getRoleIcon(user.role)" class="w-3 h-3 mr-1" />
                    {{ getRoleText(user.role) }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span :class="getStatusBadgeClass(user.status)" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                    {{ getStatusText(user.status) }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ user.lastLoginAt ? formatDateTime(user.lastLoginAt) : '從未登入' }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatDate(user.createdAt) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div class="flex items-center space-x-2">
                    <button
                      @click="editUser(user)"
                      class="text-indigo-600 hover:text-indigo-900"
                    >
                      編輯
                    </button>
                    <button
                      @click="resetPassword(user)"
                      class="text-green-600 hover:text-green-900"
                    >
                      重置密碼
                    </button>
                    <button
                      v-if="user.status === 'active'"
                      @click="toggleUserStatus(user)"
                      class="text-red-600 hover:text-red-900"
                    >
                      停用
                    </button>
                    <button
                      v-else
                      @click="toggleUserStatus(user)"
                      class="text-green-600 hover:text-green-900"
                    >
                      啟用
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 空狀態 -->
        <div v-if="filteredUsers.length === 0" class="text-center py-12">
          <UserGroupIcon class="mx-auto h-12 w-12 text-gray-400" />
          <h3 class="mt-2 text-sm font-medium text-gray-900">暫無員工</h3>
          <p class="mt-1 text-sm text-gray-500">開始添加您的第一位員工</p>
          <button
            @click="showUserModal = true"
            class="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon class="h-4 w-4 mr-2" />
            新增員工
          </button>
        </div>
      </div>
    </div>

    <!-- 員工管理模態框 -->
    <div v-if="showUserModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div class="fixed inset-0 bg-black opacity-30" @click="closeUserModal"></div>
        <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          <div class="p-6">
            <h3 class="text-lg font-semibold mb-4">
              {{ editingUser ? '編輯員工' : '新增員工' }}
            </h3>
            
            <form @submit.prevent="saveUser">
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    用戶名 <span class="text-red-500">*</span>
                  </label>
                  <input
                    v-model="userForm.username"
                    type="text"
                    required
                    :disabled="editingUser"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  />
                </div>
                
                <div v-if="!editingUser">
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    密碼 <span class="text-red-500">*</span>
                  </label>
                  <input
                    v-model="userForm.password"
                    type="password"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">全名</label>
                  <input
                    v-model="userForm.fullName"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    v-model="userForm.email"
                    type="email"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    角色 <span class="text-red-500">*</span>
                  </label>
                  <select
                    v-model.number="userForm.role"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">選擇角色</option>
                    <option value="1">店主 (Owner)</option>
                    <option value="2">廚師 (Chef)</option>
                    <option value="3">送菜員 (Service)</option>
                    <option value="4">收銀員 (Cashier)</option>
                  </select>
                </div>
                
                <div v-if="editingUser">
                  <label class="block text-sm font-medium text-gray-700 mb-1">狀態</label>
                  <select
                    v-model="userForm.status"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="active">活躍</option>
                    <option value="inactive">停用</option>
                    <option value="suspended">暫停</option>
                  </select>
                </div>
              </div>
              
              <div class="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  @click="closeUserModal"
                  class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {{ editingUser ? '更新' : '新增' }}
                </button>
              </div>
            </form>
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
  UserIcon,
  UserGroupIcon,
  StarIcon,
  ListBulletIcon,
  CurrencyDollarIcon
} from '@heroicons/vue/24/outline'
// ChefHatIcon placeholder - using UserIcon instead

// Type definitions
interface User {
  id: number
  username: string
  fullName: string
  email: string
  role: number
  status: string
  lastLoginAt: string | null
  createdAt: string
  password?: string
}

// 響應式數據
const searchQuery = ref('')
const roleFilter = ref('')
const statusFilter = ref('')
const showUserModal = ref(false)
const editingUser = ref<User | null>(null)

// 模擬用戶數據
const users = ref([
  {
    id: 1,
    username: 'owner1',
    fullName: '店主 張三',
    email: 'owner@example.com',
    role: 1,
    status: 'active',
    lastLoginAt: '2024-08-26T08:00:00Z',
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 2,
    username: 'chef1',
    fullName: '主廚 李四',
    email: 'chef@example.com',
    role: 2,
    status: 'active',
    lastLoginAt: '2024-08-26T07:30:00Z',
    createdAt: '2024-01-15T00:00:00Z'
  },
  {
    id: 3,
    username: 'service1',
    fullName: '服務員 王五',
    email: 'service@example.com',
    role: 3,
    status: 'active',
    lastLoginAt: '2024-08-25T18:00:00Z',
    createdAt: '2024-02-01T00:00:00Z'
  },
  {
    id: 4,
    username: 'cashier1',
    fullName: '收銀員 趙六',
    email: 'cashier@example.com',
    role: 4,
    status: 'active',
    lastLoginAt: null,
    createdAt: '2024-02-15T00:00:00Z'
  },
  {
    id: 5,
    username: 'service2',
    fullName: '服務員 陳七',
    email: 'service2@example.com',
    role: 3,
    status: 'inactive',
    lastLoginAt: '2024-08-20T12:00:00Z',
    createdAt: '2024-03-01T00:00:00Z'
  }
])

// 表單數據
const userForm = ref({
  username: '',
  password: '',
  fullName: '',
  email: '',
  role: 1,
  status: 'active'
})

// 計算屬性
const stats = computed(() => ({
  owner: users.value.filter(u => u.role === 1).length,
  chef: users.value.filter(u => u.role === 2).length,
  service: users.value.filter(u => u.role === 3).length,
  cashier: users.value.filter(u => u.role === 4).length,
  total: users.value.length
}))

const filteredUsers = computed(() => {
  let filtered = users.value

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(user => 
      user.username.toLowerCase().includes(query) ||
      user.fullName?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query)
    )
  }

  if (roleFilter.value) {
    filtered = filtered.filter(user => user.role.toString() === roleFilter.value)
  }

  if (statusFilter.value) {
    filtered = filtered.filter(user => user.status === statusFilter.value)
  }

  return filtered.sort((a, b) => {
    if (a.role !== b.role) {
      return a.role - b.role
    }
    return a.username.localeCompare(b.username)
  })
})

// 方法
const getRoleIcon = (role: number) => {
  const icons: Record<number, any> = {
    1: StarIcon,
    2: UserIcon, // ChefHatIcon placeholder
    3: ListBulletIcon,
    4: CurrencyDollarIcon
  }
  return icons[role] || UserIcon
}

const getRoleBadgeClass = (role: number) => {
  const classes: Record<number, string> = {
    1: 'bg-purple-100 text-purple-800',
    2: 'bg-orange-100 text-orange-800',
    3: 'bg-green-100 text-green-800',
    4: 'bg-blue-100 text-blue-800'
  }
  return classes[role] || 'bg-gray-100 text-gray-800'
}

const getRoleText = (role: number) => {
  const texts: Record<number, string> = {
    1: '店主',
    2: '廚師',
    3: '送菜員',
    4: '收銀員'
  }
  return texts[role] || '未知'
}

const getStatusBadgeClass = (status: string) => {
  const classes: Record<string, string> = {
    'active': 'bg-green-100 text-green-800',
    'inactive': 'bg-red-100 text-red-800',
    'suspended': 'bg-yellow-100 text-yellow-800'
  }
  return classes[status] || 'bg-gray-100 text-gray-800'
}

const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    'active': '活躍',
    'inactive': '停用',
    'suspended': '暫停'
  }
  return texts[status] || status
}

const formatDateTime = (dateTime: string) => {
  return new Date(dateTime).toLocaleString('zh-TW')
}

const formatDate = (dateTime: string) => {
  return new Date(dateTime).toLocaleDateString('zh-TW')
}

const editUser = (user: User) => {
  editingUser.value = user
  userForm.value = { ...user }
  showUserModal.value = true
}

const resetPassword = async (user: User) => {
  if (confirm(`確定要重置 ${user.username} 的密碼嗎？新密碼將會發送到用戶 Email。`)) {
    alert('密碼重置郵件已發送！')
  }
}

const toggleUserStatus = async (user: User) => {
  const newStatus = user.status === 'active' ? 'inactive' : 'active'
  const action = newStatus === 'active' ? '啟用' : '停用'
  
  if (confirm(`確定要${action}用戶 ${user.username} 嗎？`)) {
    const index = users.value.findIndex(u => u.id === user.id)
    if (index > -1) {
      users.value[index].status = newStatus
    }
  }
}

const closeUserModal = () => {
  showUserModal.value = false
  editingUser.value = null
  userForm.value = {
    username: '',
    password: '',
    fullName: '',
    email: '',
    role: 1,
    status: 'active'
  }
}

const saveUser = async () => {
  if (editingUser.value) {
    // 更新現有用戶
    const index = users.value.findIndex(u => u.id === editingUser.value!.id)
    if (index > -1) {
      users.value[index] = { ...users.value[index], ...userForm.value }
    }
  } else {
    // 新增用戶
    const newUser = {
      id: Math.max(...users.value.map(u => u.id)) + 1,
      ...userForm.value,
      lastLoginAt: null,
      createdAt: new Date().toISOString()
    }
    users.value.push(newUser)
  }
  closeUserModal()
}

onMounted(() => {
  // 初始化數據
})
</script>

<style scoped>
.users-view {
  padding: 1.5rem;
}

@media (max-width: 640px) {
  .users-view {
    padding: 1rem;
  }
}
</style>
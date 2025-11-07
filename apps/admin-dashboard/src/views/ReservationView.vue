<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">訂位管理</h1>
        <p class="text-gray-600 mt-1">管理餐廳訂位與預約</p>
      </div>
      <button
        @click="showCreateDialog = true"
        class="btn-primary inline-flex items-center"
      >
        <Plus class="w-5 h-5 mr-2" />
        建立訂位
      </button>
    </div>

    <!-- Stats Cards -->
    <div v-if="stats" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div class="card p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600">總訂位數</p>
            <p class="text-3xl font-bold text-gray-900 mt-2">{{ stats.totalReservations }}</p>
          </div>
          <div class="p-3 bg-blue-100 rounded-full">
            <Calendar class="w-6 h-6 text-blue-600" />
          </div>
        </div>
      </div>

      <div class="card p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600">已確認</p>
            <p class="text-3xl font-bold text-green-600 mt-2">{{ stats.confirmedCount }}</p>
          </div>
          <div class="p-3 bg-green-100 rounded-full">
            <CheckCircle class="w-6 h-6 text-green-600" />
          </div>
        </div>
      </div>

      <div class="card p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600">已完成</p>
            <p class="text-3xl font-bold text-purple-600 mt-2">{{ stats.completedCount }}</p>
          </div>
          <div class="p-3 bg-purple-100 rounded-full">
            <CheckCheck class="w-6 h-6 text-purple-600" />
          </div>
        </div>
      </div>

      <div class="card p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600">未到店率</p>
            <p class="text-3xl font-bold text-orange-600 mt-2">{{ (stats.noShowRate * 100).toFixed(1) }}%</p>
          </div>
          <div class="p-3 bg-orange-100 rounded-full">
            <AlertCircle class="w-6 h-6 text-orange-600" />
          </div>
        </div>
      </div>
    </div>

    <!-- Filters Card -->
    <div class="card p-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">日期</label>
          <input
            v-model="filters.date"
            type="date"
            class="form-input"
            @change="loadReservations"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">狀態</label>
          <select v-model="filters.status" class="form-input" @change="loadReservations">
            <option value="">全部狀態</option>
            <option value="pending">待確認</option>
            <option value="confirmed">已確認</option>
            <option value="arrived">已到店</option>
            <option value="seated">已入座</option>
            <option value="completed">已完成</option>
            <option value="cancelled">已取消</option>
            <option value="no_show">未到店</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">電話號碼</label>
          <input
            v-model="filters.phone"
            type="tel"
            class="form-input"
            placeholder="輸入電話號碼"
            @keyup.enter="loadReservations"
          />
        </div>

        <div class="flex items-end space-x-2">
          <button @click="loadReservations" class="btn-primary flex-1">
            <Search class="w-4 h-4 mr-2" />
            搜尋
          </button>
          <button @click="resetFilters" class="btn-secondary flex-1">
            <RotateCcw class="w-4 h-4 mr-2" />
            重置
          </button>
        </div>
      </div>
    </div>

    <!-- Reservations List -->
    <div class="card">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                確認碼
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                客戶資訊
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                預訂時間
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                人數
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                狀態
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                特殊要求
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-if="loading" v-for="i in 5" :key="i" class="animate-pulse">
              <td class="px-6 py-4"><div class="h-4 bg-gray-200 rounded w-20"></div></td>
              <td class="px-6 py-4"><div class="h-4 bg-gray-200 rounded w-32"></div></td>
              <td class="px-6 py-4"><div class="h-4 bg-gray-200 rounded w-40"></div></td>
              <td class="px-6 py-4"><div class="h-4 bg-gray-200 rounded w-12"></div></td>
              <td class="px-6 py-4"><div class="h-6 bg-gray-200 rounded w-16"></div></td>
              <td class="px-6 py-4"><div class="h-4 bg-gray-200 rounded w-24"></div></td>
              <td class="px-6 py-4"><div class="h-8 bg-gray-200 rounded w-32 ml-auto"></div></td>
            </tr>
            <tr v-else-if="reservations.length === 0">
              <td colspan="7" class="px-6 py-12 text-center text-gray-500">
                <Calendar class="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>暫無訂位記錄</p>
              </td>
            </tr>
            <tr v-for="reservation in reservations" :key="reservation.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="text-sm font-mono text-gray-900">{{ reservation.confirmationCode }}</span>
              </td>
              <td class="px-6 py-4">
                <div class="text-sm">
                  <div class="font-medium text-gray-900">{{ reservation.customerName }}</div>
                  <div class="text-gray-500">{{ reservation.customerPhone }}</div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ reservation.reservationDate }} {{ reservation.reservationTime }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ reservation.partySize }} 人
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="getStatusBadgeClass(reservation.status)" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                  {{ getStatusText(reservation.status) }}
                </span>
              </td>
              <td class="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                {{ reservation.specialRequests || '--' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                <button @click="viewDetail(reservation)" class="text-blue-600 hover:text-blue-900" title="查看詳情">
                  <Eye class="w-5 h-5" />
                </button>
                <button
                  v-if="reservation.status === 'pending'"
                  @click="confirmReservation(reservation.id)"
                  class="text-green-600 hover:text-green-900"
                  title="確認訂位"
                >
                  <CheckCircle class="w-5 h-5" />
                </button>
                <button
                  v-if="reservation.status === 'confirmed'"
                  @click="markArrived(reservation.id)"
                  class="text-purple-600 hover:text-purple-900"
                  title="標記到店"
                >
                  <UserCheck class="w-5 h-5" />
                </button>
                <button
                  v-if="reservation.status === 'arrived'"
                  @click="markSeated(reservation.id)"
                  class="text-indigo-600 hover:text-indigo-900"
                  title="標記入座"
                >
                  <CheckCheck class="w-5 h-5" />
                </button>
                <button
                  v-if="['pending', 'confirmed'].includes(reservation.status)"
                  @click="cancelReservation(reservation.id)"
                  class="text-red-600 hover:text-red-900"
                  title="取消訂位"
                >
                  <XCircle class="w-5 h-5" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="pagination.total > 0" class="px-6 py-4 flex items-center justify-between border-t border-gray-200">
        <div class="flex-1 flex justify-between sm:hidden">
          <button
            @click="pagination.page--; loadReservations()"
            :disabled="pagination.page === 1"
            class="btn-secondary"
          >
            上一頁
          </button>
          <button
            @click="pagination.page++; loadReservations()"
            :disabled="pagination.page * pagination.limit >= pagination.total"
            class="btn-secondary"
          >
            下一頁
          </button>
        </div>
        <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p class="text-sm text-gray-700">
              顯示第
              <span class="font-medium">{{ (pagination.page - 1) * pagination.limit + 1 }}</span>
              到
              <span class="font-medium">{{ Math.min(pagination.page * pagination.limit, pagination.total) }}</span>
              筆，共
              <span class="font-medium">{{ pagination.total }}</span>
              筆結果
            </p>
          </div>
          <div>
            <nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
              <button
                @click="pagination.page--; loadReservations()"
                :disabled="pagination.page === 1"
                class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft class="h-5 w-5" />
              </button>
              <button
                v-for="page in getPaginationPages()"
                :key="page"
                @click="pagination.page = page; loadReservations()"
                :class="[
                  page === pagination.page
                    ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50',
                  'relative inline-flex items-center px-4 py-2 border text-sm font-medium'
                ]"
              >
                {{ page }}
              </button>
              <button
                @click="pagination.page++; loadReservations()"
                :disabled="pagination.page * pagination.limit >= pagination.total"
                class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronRight class="h-5 w-5" />
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Reservation Dialog -->
    <TransitionRoot as="template" :show="showCreateDialog">
      <Dialog as="div" class="relative z-10" @close="showCreateDialog = false">
        <TransitionChild
          as="template"
          enter="ease-out duration-300"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="ease-in duration-200"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </TransitionChild>

        <div class="fixed inset-0 z-10 overflow-y-auto">
          <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <TransitionChild
              as="template"
              enter="ease-out duration-300"
              enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enter-to="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leave-from="opacity-100 translate-y-0 sm:scale-100"
              leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <DialogPanel class="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <DialogTitle as="h3" class="text-lg font-medium leading-6 text-gray-900 mb-4">
                    建立訂位
                  </DialogTitle>
                  <div class="space-y-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">客戶姓名 *</label>
                      <input v-model="form.customerName" type="text" class="form-input" />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">電話號碼 *</label>
                      <input v-model="form.customerPhone" type="tel" class="form-input" />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">電子郵件</label>
                      <input v-model="form.customerEmail" type="email" class="form-input" />
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">預訂日期 *</label>
                        <input v-model="formDate" type="date" class="form-input" />
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">預訂時間 *</label>
                        <input v-model="formTime" type="time" class="form-input" />
                      </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">用餐人數 *</label>
                        <input v-model.number="form.partySize" type="number" min="1" max="20" class="form-input" />
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">用餐時長（分鐘）</label>
                        <input v-model.number="form.durationMinutes" type="number" min="30" max="240" step="30" class="form-input" />
                      </div>
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">特殊要求</label>
                      <textarea v-model="form.specialRequests" rows="3" class="form-input" placeholder="例如：兒童椅、過敏原資訊等"></textarea>
                    </div>
                  </div>
                </div>
                <div class="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                  <button
                    @click="createReservation"
                    :disabled="submitting"
                    class="btn-primary w-full sm:ml-3 sm:w-auto disabled:opacity-50"
                  >
                    <span v-if="!submitting">確認建立</span>
                    <span v-else class="flex items-center justify-center">
                      <Loader2 class="animate-spin w-4 h-4 mr-2" />
                      建立中...
                    </span>
                  </button>
                  <button
                    @click="showCreateDialog = false"
                    class="btn-secondary mt-3 w-full sm:mt-0 sm:w-auto"
                  >
                    取消
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>

    <!-- Detail Dialog -->
    <TransitionRoot as="template" :show="showDetailDialog">
      <Dialog as="div" class="relative z-10" @close="showDetailDialog = false">
        <TransitionChild
          as="template"
          enter="ease-out duration-300"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="ease-in duration-200"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </TransitionChild>

        <div class="fixed inset-0 z-10 overflow-y-auto">
          <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <TransitionChild
              as="template"
              enter="ease-out duration-300"
              enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enter-to="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leave-from="opacity-100 translate-y-0 sm:scale-100"
              leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <DialogPanel class="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
                <div class="bg-white px-4 pt-5 pb-4 sm:p-6">
                  <DialogTitle as="h3" class="text-lg font-medium leading-6 text-gray-900 mb-4">
                    訂位詳情
                  </DialogTitle>
                  <div v-if="selectedReservation" class="space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                      <div>
                        <label class="text-sm font-medium text-gray-500">確認碼</label>
                        <p class="mt-1 text-sm text-gray-900 font-mono">{{ selectedReservation.confirmationCode }}</p>
                      </div>
                      <div>
                        <label class="text-sm font-medium text-gray-500">狀態</label>
                        <p class="mt-1">
                          <span :class="getStatusBadgeClass(selectedReservation.status)" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                            {{ getStatusText(selectedReservation.status) }}
                          </span>
                        </p>
                      </div>
                      <div>
                        <label class="text-sm font-medium text-gray-500">客戶姓名</label>
                        <p class="mt-1 text-sm text-gray-900">{{ selectedReservation.customerName }}</p>
                      </div>
                      <div>
                        <label class="text-sm font-medium text-gray-500">電話號碼</label>
                        <p class="mt-1 text-sm text-gray-900">{{ selectedReservation.customerPhone }}</p>
                      </div>
                      <div class="col-span-2">
                        <label class="text-sm font-medium text-gray-500">預訂時間</label>
                        <p class="mt-1 text-sm text-gray-900">{{ selectedReservation.reservationDate }} {{ selectedReservation.reservationTime }}</p>
                      </div>
                      <div>
                        <label class="text-sm font-medium text-gray-500">用餐人數</label>
                        <p class="mt-1 text-sm text-gray-900">{{ selectedReservation.partySize }} 人</p>
                      </div>
                      <div>
                        <label class="text-sm font-medium text-gray-500">用餐時長</label>
                        <p class="mt-1 text-sm text-gray-900">{{ selectedReservation.durationMinutes }} 分鐘</p>
                      </div>
                      <div class="col-span-2">
                        <label class="text-sm font-medium text-gray-500">特殊要求</label>
                        <p class="mt-1 text-sm text-gray-900">{{ selectedReservation.specialRequests || '--' }}</p>
                      </div>
                      <div class="col-span-2">
                        <label class="text-sm font-medium text-gray-500">備註</label>
                        <p class="mt-1 text-sm text-gray-900">{{ selectedReservation.notes || '--' }}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                  <button
                    @click="showDetailDialog = false"
                    class="btn-secondary w-full sm:w-auto"
                  >
                    關閉
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import {
  Plus,
  Calendar,
  Search,
  RotateCcw,
  Eye,
  CheckCircle,
  CheckCheck,
  UserCheck,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-vue-next';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '@/stores/auth';
import { ReservationService } from '@/services/reservationService';
import type {
  Reservation,
  CreateReservationRequest,
  ReservationStats,
} from '@makanmakan/shared-types';

const toast = useToast();
const authStore = useAuthStore();

// State
const loading = ref(false);
const submitting = ref(false);
const showCreateDialog = ref(false);
const showDetailDialog = ref(false);
const reservations = ref<Reservation[]>([]);
const selectedReservation = ref<Reservation | null>(null);
const stats = ref<ReservationStats | null>(null);

// Filters
const filters = reactive({
  date: '',
  status: '',
  phone: ''
});

// Pagination
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0
});

// Form
const form = reactive<Partial<CreateReservationRequest>>({
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  partySize: 2,
  durationMinutes: 90,
  specialRequests: ''
});

const formDate = ref('');
const formTime = ref('');

// Restaurant ID
const restaurantId = computed(() => authStore.user?.restaurantId?.toString() || '');

/**
 * Load reservations list
 */
async function loadReservations() {
  loading.value = true;
  try {
    const response = await ReservationService.listReservations({
      restaurantId: restaurantId.value,
      reservationDate: filters.date || undefined,
      status: (filters.status as any) || undefined,
      customerPhone: filters.phone || undefined,
      page: pagination.page,
      limit: pagination.limit
    });

    // Handle response as array (API returns array of reservations)
    reservations.value = Array.isArray(response) ? response : [];
    pagination.total = reservations.value.length;
  } catch (error) {
    console.error('Load reservations error:', error);
    toast.error('載入訂位列表失敗');
  } finally {
    loading.value = false;
  }
}

/**
 * Load stats
 */
async function loadStats() {
  try {
    stats.value = await ReservationService.getStats(restaurantId.value, filters.date || undefined);
  } catch (error) {
    console.error('Load stats error:', error);
  }
}

/**
 * Create reservation
 */
async function createReservation() {
  if (!form.customerName || !form.customerPhone || !formDate.value || !formTime.value || !form.partySize) {
    toast.warning('請填寫必填欄位');
    return;
  }

  submitting.value = true;
  try {
    const request: CreateReservationRequest = {
      restaurantId: restaurantId.value,
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      customerEmail: form.customerEmail,
      partySize: form.partySize,
      reservationDate: formDate.value,
      reservationTime: formTime.value,
      durationMinutes: form.durationMinutes || 90,
      specialRequests: form.specialRequests
    };

    await ReservationService.createReservation(request);
    toast.success('建立訂位成功');
    showCreateDialog.value = false;
    resetForm();
    await loadReservations();
    await loadStats();
  } catch (error: any) {
    console.error('Create reservation error:', error);
    toast.error(error.response?.data?.error || '建立訂位失敗');
  } finally {
    submitting.value = false;
  }
}

/**
 * Confirm reservation
 */
async function confirmReservation(id: string) {
  if (!confirm('確定要確認此訂位嗎？')) return;

  try {
    await ReservationService.confirmReservation(id);
    toast.success('確認訂位成功');
    await loadReservations();
    await loadStats();
  } catch (error: any) {
    console.error('Confirm reservation error:', error);
    toast.error(error.response?.data?.error || '確認訂位失敗');
  }
}

/**
 * Mark arrived
 */
async function markArrived(id: string) {
  try {
    await ReservationService.markArrived(id);
    toast.success('標記到店成功');
    await loadReservations();
    await loadStats();
  } catch (error: any) {
    console.error('Mark arrived error:', error);
    toast.error(error.response?.data?.error || '標記到店失敗');
  }
}

/**
 * Mark seated
 */
async function markSeated(id: string) {
  try {
    await ReservationService.markSeated(id);
    toast.success('標記入座成功');
    await loadReservations();
    await loadStats();
  } catch (error: any) {
    console.error('Mark seated error:', error);
    toast.error(error.response?.data?.error || '標記入座失敗');
  }
}

/**
 * Cancel reservation
 */
async function cancelReservation(id: string) {
  if (!confirm('確定要取消此訂位嗎？')) return;

  try {
    await ReservationService.cancelReservation(id);
    toast.success('取消訂位成功');
    await loadReservations();
    await loadStats();
  } catch (error: any) {
    console.error('Cancel reservation error:', error);
    toast.error(error.response?.data?.error || '取消訂位失敗');
  }
}

/**
 * View detail
 */
function viewDetail(reservation: Reservation) {
  selectedReservation.value = reservation;
  showDetailDialog.value = true;
}

/**
 * Reset filters
 */
function resetFilters() {
  filters.date = '';
  filters.status = '';
  filters.phone = '';
  pagination.page = 1;
  loadReservations();
}

/**
 * Reset form
 */
function resetForm() {
  form.customerName = '';
  form.customerPhone = '';
  form.customerEmail = '';
  form.partySize = 2;
  form.durationMinutes = 90;
  form.specialRequests = '';
  formDate.value = '';
  formTime.value = '';
}

/**
 * Get status text
 */
function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    pending: '待確認',
    confirmed: '已確認',
    arrived: '已到店',
    seated: '已入座',
    completed: '已完成',
    cancelled: '已取消',
    no_show: '未到店'
  };
  return statusMap[status] || status;
}

/**
 * Get status badge class
 */
function getStatusBadgeClass(status: string): string {
  const classMap: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-green-100 text-green-800',
    arrived: 'bg-purple-100 text-purple-800',
    seated: 'bg-indigo-100 text-indigo-800',
    completed: 'bg-blue-100 text-blue-800',
    cancelled: 'bg-red-100 text-red-800',
    no_show: 'bg-gray-100 text-gray-800'
  };
  return classMap[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Get pagination pages
 */
function getPaginationPages(): number[] {
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const current = pagination.page;
  const pages: number[] = [];

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    if (current <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push(-1); // Separator
      pages.push(totalPages);
    } else if (current >= totalPages - 3) {
      pages.push(1);
      pages.push(-1);
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push(-1);
      for (let i = current - 1; i <= current + 1; i++) pages.push(i);
      pages.push(-1);
      pages.push(totalPages);
    }
  }

  return pages;
}

// Initialize
onMounted(async () => {
  await loadReservations();
  await loadStats();
});
</script>

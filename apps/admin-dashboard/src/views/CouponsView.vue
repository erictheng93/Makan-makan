<template>
  <div class="coupons-view">
    <!-- 標題和操作按鈕 -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">優惠券管理</h1>
        <p class="text-gray-600">創建和管理優惠券與促銷活動</p>
      </div>
      <div class="flex items-center space-x-4">
        <button
          class="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          @click="showCreateModal = true"
        >
          <PlusIcon class="w-5 h-5 inline mr-2" />
          創建優惠券
        </button>
      </div>
    </div>

    <!-- 統計卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-blue-100 rounded-lg">
            <TicketIcon class="w-6 h-6 text-blue-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm text-gray-600">總優惠券數</p>
            <p class="text-2xl font-bold text-gray-900">{{ stats.total }}</p>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-green-100 rounded-lg">
            <CheckCircleIcon class="w-6 h-6 text-green-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm text-gray-600">已使用</p>
            <p class="text-2xl font-bold text-gray-900">{{ stats.used }}</p>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-yellow-100 rounded-lg">
            <ClockIcon class="w-6 h-6 text-yellow-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm text-gray-600">進行中</p>
            <p class="text-2xl font-bold text-gray-900">{{ stats.active }}</p>
          </div>
        </div>
      </div>
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-purple-100 rounded-lg">
            <CurrencyDollarIcon class="w-6 h-6 text-purple-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm text-gray-600">總節省金額</p>
            <p class="text-2xl font-bold text-gray-900">
              RM{{ formatMoney(stats.totalSavings) }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 篩選和搜索 -->
    <div class="bg-white rounded-lg shadow mb-6 p-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2"
            >搜索</label
          >
          <input
            v-model="filters.search"
            type="text"
            placeholder="搜索優惠券代碼或名稱..."
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2"
            >狀態</label
          >
          <select
            v-model="filters.status"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">全部狀態</option>
            <option value="active">進行中</option>
            <option value="expired">已過期</option>
            <option value="exhausted">已用完</option>
            <option value="inactive">已停用</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2"
            >折扣類型</label
          >
          <select
            v-model="filters.discountType"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">全部類型</option>
            <option value="percentage">百分比折扣</option>
            <option value="fixed">固定金額</option>
          </select>
        </div>
        <div class="flex items-end">
          <button
            class="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            @click="resetFilters"
          >
            重置篩選
          </button>
        </div>
      </div>
    </div>

    <!-- 優惠券列表 -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                優惠券資訊
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                折扣
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                使用情況
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                有效期
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                狀態
              </th>
              <th
                class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                操作
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr
              v-for="coupon in filteredCoupons"
              :key="coupon.id"
              class="hover:bg-gray-50"
            >
              <td class="px-6 py-4">
                <div>
                  <div class="text-sm font-medium text-gray-900">
                    {{ coupon.name }}
                  </div>
                  <div class="text-sm text-gray-500">{{ coupon.code }}</div>
                  <div
                    v-if="coupon.description"
                    class="text-xs text-gray-400 mt-1"
                  >
                    {{ coupon.description }}
                  </div>
                </div>
              </td>
              <td class="px-6 py-4">
                <div class="text-sm">
                  <span v-if="coupon.discountType === 'percentage'">
                    {{ coupon.discountValue }}%
                    <span v-if="coupon.maxDiscountAmount" class="text-gray-500">
                      (最高 RM{{ formatMoney(coupon.maxDiscountAmount) }})
                    </span>
                  </span>
                  <span v-else>
                    RM{{ formatMoney(coupon.discountValue) }}
                  </span>
                </div>
                <div
                  v-if="coupon.minOrderAmount > 0"
                  class="text-xs text-gray-500"
                >
                  最低消費 RM{{ formatMoney(coupon.minOrderAmount) }}
                </div>
              </td>
              <td class="px-6 py-4">
                <div class="text-sm">
                  <div class="flex items-center">
                    <span class="text-gray-900">{{ coupon.usedCount }}</span>
                    <span v-if="coupon.usageLimit" class="text-gray-500"
                      >/ {{ coupon.usageLimit }}</span
                    >
                    <span v-else class="text-gray-500">/ 無限制</span>
                  </div>
                  <div
                    v-if="coupon.usageLimit"
                    class="w-full bg-gray-200 rounded-full h-2 mt-1"
                  >
                    <div
                      class="bg-indigo-600 h-2 rounded-full"
                      :style="{
                        width: `${Math.min(100, (coupon.usedCount / coupon.usageLimit) * 100)}%`,
                      }"
                    ></div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4">
                <div class="text-sm">
                  <div class="text-gray-900">
                    {{ formatDate(coupon.validFrom) }}
                  </div>
                  <div class="text-gray-500">
                    至 {{ formatDate(coupon.validTo) }}
                  </div>
                </div>
              </td>
              <td class="px-6 py-4">
                <span
                  :class="[
                    'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                    getCouponStatusClass(coupon),
                  ]"
                >
                  {{ getCouponStatusText(coupon) }}
                </span>
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end space-x-2">
                  <button
                    class="text-indigo-600 hover:text-indigo-900 text-sm"
                    @click="viewCouponStats(coupon)"
                  >
                    統計
                  </button>
                  <button
                    class="text-blue-600 hover:text-blue-900 text-sm"
                    @click="editCoupon(coupon)"
                  >
                    編輯
                  </button>
                  <button
                    v-if="coupon.isActive"
                    class="text-yellow-600 hover:text-yellow-900 text-sm"
                    @click="deactivateCoupon(coupon)"
                  >
                    停用
                  </button>
                  <button
                    v-else
                    class="text-green-600 hover:text-green-900 text-sm"
                    @click="activateCoupon(coupon)"
                  >
                    啟用
                  </button>
                  <button
                    class="text-red-600 hover:text-red-900 text-sm"
                    @click="deleteCoupon(coupon)"
                  >
                    刪除
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 分頁 -->
      <div
        class="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6"
      >
        <div class="flex-1 flex justify-between sm:hidden">
          <button
            :disabled="currentPage === 1"
            class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            @click="currentPage--"
          >
            上一頁
          </button>
          <button
            :disabled="currentPage >= totalPages"
            class="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            @click="currentPage++"
          >
            下一頁
          </button>
        </div>
        <div
          class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between"
        >
          <div>
            <p class="text-sm text-gray-700">
              顯示第 <span class="font-medium">{{ startIndex }}</span> 到
              <span class="font-medium">{{ endIndex }}</span> 項， 共
              <span class="font-medium">{{ totalCoupons }}</span> 項結果
            </p>
          </div>
          <div>
            <nav
              class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
              aria-label="分頁"
            >
              <button
                :disabled="currentPage === 1"
                class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                @click="currentPage--"
              >
                <ChevronLeftIcon class="h-5 w-5" />
              </button>
              <button
                v-for="page in visiblePages"
                :key="page"
                :class="[
                  'relative inline-flex items-center px-4 py-2 border text-sm font-medium',
                  page === currentPage
                    ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50',
                ]"
                @click="currentPage = page"
              >
                {{ page }}
              </button>
              <button
                :disabled="currentPage >= totalPages"
                class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                @click="currentPage++"
              >
                <ChevronRightIcon class="h-5 w-5" />
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>

    <!-- 創建/編輯優惠券 Modal -->
    <!-- 表單 Modal with Suspense -->
    <Suspense v-if="showCreateModal">
      <template #default>
        <CouponFormModal
          :coupon="editingCoupon || undefined"
          @close="closeModal"
          @save="handleSaveCoupon"
        />
      </template>
      <template #fallback>
        <div
          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <div class="bg-white rounded-lg p-8 max-w-md w-full animate-pulse">
            <div class="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div class="h-4 bg-gray-200 rounded w-1/2 mb-6"></div>
            <div class="h-32 bg-gray-100 rounded mb-4"></div>
            <div class="h-10 bg-gray-200 rounded w-24"></div>
          </div>
        </div>
      </template>
    </Suspense>

    <!-- 統計 Modal with Suspense -->
    <Suspense v-if="showStatsModal && selectedCoupon">
      <template #default>
        <CouponStatsModal
          :coupon="selectedCoupon"
          :stats="couponStats"
          @close="showStatsModal = false"
        />
      </template>
      <template #fallback>
        <div
          class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <div class="bg-white rounded-lg p-8 max-w-2xl w-full animate-pulse">
            <div class="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div class="grid grid-cols-2 gap-4 mb-4">
              <div class="h-20 bg-gray-100 rounded"></div>
              <div class="h-20 bg-gray-100 rounded"></div>
            </div>
            <div class="h-48 bg-gray-100 rounded"></div>
          </div>
        </div>
      </template>
    </Suspense>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useToast } from "vue-toastification";
import {
  PlusIcon,
  TicketIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/vue/24/outline";

// Components
import { useAsyncModals } from "@/composables/useAsyncModals";

// 異步加載 Modal 組件
const { CouponFormModal, CouponStatsModal } = useAsyncModals();

// Types
interface Coupon {
  id: number;
  code: string;
  name: string;
  description?: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderAmount: number;
  usageLimit?: number;
  usageLimitPerUser?: number;
  usedCount: number;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  isVisible: boolean;
  createdAt: string;
}

interface CouponStats {
  total: number;
  active: number;
  used: number;
  totalSavings: number;
}

// Reactive state
const showCreateModal = ref(false);
const showStatsModal = ref(false);
const editingCoupon = ref<Coupon | null>(null);
const selectedCoupon = ref<Coupon | null>(null);
const couponStats = ref<any>(null);
const currentPage = ref(1);
const pageSize = 20;

const filters = ref({
  search: "",
  status: "",
  discountType: "",
});

const stats = ref<CouponStats>({
  total: 0,
  active: 0,
  used: 0,
  totalSavings: 0,
});

// API calls
const toast = useToast();
const couponsData = ref<any>(null);
const isLoading = ref(false);

// Fetch coupons function
const fetchCoupons = async () => {
  isLoading.value = true;
  try {
    const params = new URLSearchParams({
      page: currentPage.value.toString(),
      limit: pageSize.toString(),
      ...(filters.value.search && { search: filters.value.search }),
      ...(filters.value.status && { status: filters.value.status }),
      ...(filters.value.discountType && {
        discountType: filters.value.discountType,
      }),
    });

    const response = await fetch(`/api/v1/coupons?${params}`);
    if (!response.ok) throw new Error("Failed to fetch coupons");
    couponsData.value = await response.json();
  } catch (error) {
    toast.error("獲取優惠券列表失敗");
    console.error("Failed to fetch coupons:", error);
  } finally {
    isLoading.value = false;
  }
};

// Computed properties
const filteredCoupons = computed(() => couponsData.value?.data || []);
const totalCoupons = computed(() => couponsData.value?.pagination?.total || 0);
const totalPages = computed(() => Math.ceil(totalCoupons.value / pageSize));

const startIndex = computed(() => (currentPage.value - 1) * pageSize + 1);
const endIndex = computed(() =>
  Math.min(currentPage.value * pageSize, totalCoupons.value),
);

const visiblePages = computed(() => {
  const pages = [];
  const start = Math.max(1, currentPage.value - 2);
  const end = Math.min(totalPages.value, currentPage.value + 2);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  return pages;
});

// Methods
const formatMoney = (amount: number) => {
  return (amount / 100).toFixed(2);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const getCouponStatusClass = (coupon: Coupon) => {
  const now = new Date();
  const validTo = new Date(coupon.validTo);

  if (!coupon.isActive) {
    return "bg-gray-100 text-gray-800";
  } else if (now > validTo) {
    return "bg-red-100 text-red-800";
  } else if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    return "bg-yellow-100 text-yellow-800";
  } else {
    return "bg-green-100 text-green-800";
  }
};

const getCouponStatusText = (coupon: Coupon) => {
  const now = new Date();
  const validTo = new Date(coupon.validTo);

  if (!coupon.isActive) {
    return "已停用";
  } else if (now > validTo) {
    return "已過期";
  } else if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    return "已用完";
  } else {
    return "進行中";
  }
};

const resetFilters = () => {
  filters.value = {
    search: "",
    status: "",
    discountType: "",
  };
  currentPage.value = 1;
};

const editCoupon = (coupon: Coupon) => {
  editingCoupon.value = coupon ? { ...coupon } : null;
  showCreateModal.value = true;
};

const closeModal = () => {
  showCreateModal.value = false;
  editingCoupon.value = null;
};

const handleSaveCoupon = async (couponData: any) => {
  try {
    if (editingCoupon.value) {
      // Update existing coupon
      const response = await fetch(
        `/api/v1/coupons/${editingCoupon.value.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(couponData),
        },
      );

      if (!response.ok) throw new Error("Failed to update coupon");
      toast.success("優惠券更新成功");
    } else {
      // Create new coupon
      const response = await fetch("/api/v1/coupons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(couponData),
      });

      if (!response.ok) throw new Error("Failed to create coupon");
      toast.success("優惠券創建成功");
    }

    await fetchCoupons();
    closeModal();
  } catch (error) {
    toast.error("操作失敗：" + (error as Error).message);
  }
};

const viewCouponStats = async (coupon: Coupon) => {
  try {
    const response = await fetch(`/api/v1/coupons/${coupon.id}/stats`);
    if (!response.ok) throw new Error("Failed to fetch coupon stats");

    const result = await response.json();
    selectedCoupon.value = coupon;
    couponStats.value = result.data.stats;
    showStatsModal.value = true;
  } catch {
    toast.error("無法獲取統計數據");
  }
};

const deactivateCoupon = async (coupon: Coupon) => {
  try {
    const response = await fetch(`/api/v1/coupons/${coupon.id}/deactivate`, {
      method: "POST",
    });

    if (!response.ok) throw new Error("Failed to deactivate coupon");

    toast.success("優惠券已停用");
    await fetchCoupons();
  } catch {
    toast.error("停用失敗");
  }
};

const activateCoupon = async (coupon: Coupon) => {
  try {
    const response = await fetch(`/api/v1/coupons/${coupon.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isActive: true }),
    });

    if (!response.ok) throw new Error("Failed to activate coupon");

    toast.success("優惠券已啟用");
    await fetchCoupons();
  } catch {
    toast.error("啟用失敗");
  }
};

const deleteCoupon = async (coupon: Coupon) => {
  if (!confirm(`確定要刪除優惠券 "${coupon.name}" 嗎？此操作無法復原。`)) {
    return;
  }

  try {
    const response = await fetch(`/api/v1/coupons/${coupon.id}`, {
      method: "DELETE",
    });

    if (!response.ok) throw new Error("Failed to delete coupon");

    toast.success("優惠券已刪除");
    await fetchCoupons();
  } catch {
    toast.error("刪除失敗");
  }
};

// Initialize data and watchers
onMounted(() => {
  fetchCoupons();
});

// Watch for filter changes
watch(
  [currentPage, filters],
  () => {
    fetchCoupons();
  },
  { deep: true },
);

// Watch for data changes to update statistics
watch(
  () => couponsData.value,
  (data) => {
    if (data?.data) {
      const coupons = data.data as Coupon[];
      const now = new Date();

      stats.value = {
        total: coupons.length,
        active: coupons.filter(
          (c) =>
            c.isActive &&
            new Date(c.validTo) > now &&
            (!c.usageLimit || c.usedCount < c.usageLimit),
        ).length,
        used: coupons.reduce((sum, c) => sum + c.usedCount, 0),
        totalSavings: coupons.reduce(
          (sum, c) => sum + c.usedCount * c.discountValue,
          0,
        ),
      };
    }
  },
  { immediate: true },
);
</script>

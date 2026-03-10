<script setup lang="ts">
import { onMounted, computed } from "vue";
import { useTenantsStore } from "@/stores/tenants";
import { useHealthStore } from "@/stores/health";
import { RouterLink } from "vue-router";
import {
  BuildingStorefrontIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/vue/24/outline";

const tenantsStore = useTenantsStore();
const healthStore = useHealthStore();

// 載入資料
onMounted(async () => {
  await Promise.all([
    tenantsStore.fetchTenants(),
    healthStore.fetchAllHealthChecks(),
  ]);
});

// 統計卡片
const stats = computed(() => [
  {
    name: "總租戶數",
    value: tenantsStore.totalTenants,
    icon: BuildingStorefrontIcon,
    color: "text-blue-600 bg-blue-100",
  },
  {
    name: "運行中",
    value: tenantsStore.statusCounts.active,
    icon: CheckCircleIcon,
    color: "text-green-600 bg-green-100",
  },
  {
    name: "待處理",
    value:
      tenantsStore.statusCounts.pending +
      tenantsStore.statusCounts.provisioning,
    icon: ClockIcon,
    color: "text-yellow-600 bg-yellow-100",
  },
  {
    name: "健康異常",
    value: healthStore.degradedCount + healthStore.downCount,
    icon: ExclamationTriangleIcon,
    color: "text-red-600 bg-red-100",
  },
]);

// 最近的健康問題
const recentIssues = computed(() => {
  return [
    ...healthStore.groupedByStatus.down,
    ...healthStore.groupedByStatus.degraded,
  ].slice(0, 5);
});

// 獲取租戶名稱
const getTenantName = (tenantId: string) => {
  const tenant = tenantsStore.tenants.find((t) => t.id === tenantId);
  return tenant?.businessName || tenantId;
};
</script>

<template>
  <div class="space-y-6">
    <!-- 頁面標題 -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900">總覽</h1>
      <p class="mt-1 text-sm text-gray-500">管理平台運行狀態概覽</p>
    </div>

    <!-- 統計卡片 -->
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <div v-for="stat in stats" :key="stat.name" class="card">
        <div class="flex items-center">
          <div :class="[stat.color, 'rounded-md p-3']">
            <component :is="stat.icon" class="h-6 w-6" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">{{ stat.name }}</p>
            <p class="text-2xl font-semibold text-gray-900">{{ stat.value }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 主要內容區域 -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <!-- 健康狀態概覽 -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-gray-900">健康狀態</h2>
          <RouterLink
            to="/health"
            class="text-sm text-primary-600 hover:text-primary-700"
          >
            查看全部
          </RouterLink>
        </div>

        <!-- 狀態環形圖示意 -->
        <div class="flex items-center justify-center py-4">
          <div class="relative">
            <div
              class="w-32 h-32 rounded-full border-8 flex items-center justify-center"
              :class="{
                'border-green-500': healthStore.overallStatus === 'healthy',
                'border-yellow-500': healthStore.overallStatus === 'degraded',
                'border-red-500': healthStore.overallStatus === 'down',
                'border-gray-300': healthStore.overallStatus === 'unknown',
              }"
            >
              <div class="text-center">
                <div class="text-3xl font-bold text-gray-900">
                  {{ healthStore.healthyCount }}
                </div>
                <div class="text-xs text-gray-500">正常運行</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 狀態統計 -->
        <div class="grid grid-cols-3 gap-4 mt-4">
          <div class="text-center">
            <div class="flex items-center justify-center">
              <CheckCircleIcon class="h-5 w-5 text-green-500" />
              <span class="ml-1 text-lg font-semibold text-gray-900">
                {{ healthStore.healthyCount }}
              </span>
            </div>
            <div class="text-xs text-gray-500">正常</div>
          </div>
          <div class="text-center">
            <div class="flex items-center justify-center">
              <ExclamationTriangleIcon class="h-5 w-5 text-yellow-500" />
              <span class="ml-1 text-lg font-semibold text-gray-900">
                {{ healthStore.degradedCount }}
              </span>
            </div>
            <div class="text-xs text-gray-500">降級</div>
          </div>
          <div class="text-center">
            <div class="flex items-center justify-center">
              <XCircleIcon class="h-5 w-5 text-red-500" />
              <span class="ml-1 text-lg font-semibold text-gray-900">
                {{ healthStore.downCount }}
              </span>
            </div>
            <div class="text-xs text-gray-500">離線</div>
          </div>
        </div>
      </div>

      <!-- 待處理事項 -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-gray-900">待處理事項</h2>
        </div>

        <div
          v-if="
            tenantsStore.pendingTenants.length === 0 &&
            recentIssues.length === 0
          "
          class="text-center py-8"
        >
          <CheckCircleIcon class="mx-auto h-12 w-12 text-green-400" />
          <p class="mt-2 text-sm text-gray-500">沒有待處理的事項</p>
        </div>

        <div v-else class="space-y-3">
          <!-- 待配置的租戶 -->
          <div
            v-for="tenant in tenantsStore.pendingTenants.slice(0, 3)"
            :key="tenant.id"
            class="flex items-center p-3 bg-yellow-50 rounded-lg"
          >
            <ClockIcon class="h-5 w-5 text-yellow-500 flex-shrink-0" />
            <div class="ml-3 flex-1">
              <p class="text-sm font-medium text-gray-900">
                {{ tenant.businessName }}
              </p>
              <p class="text-xs text-gray-500">等待配置資源</p>
            </div>
            <RouterLink
              :to="`/tenants/${tenant.id}`"
              class="text-sm text-primary-600 hover:text-primary-700"
            >
              處理
            </RouterLink>
          </div>

          <!-- 健康問題 -->
          <div
            v-for="issue in recentIssues"
            :key="issue.id"
            class="flex items-center p-3 rounded-lg"
            :class="{
              'bg-red-50': issue.status === 'down',
              'bg-yellow-50': issue.status === 'degraded',
            }"
          >
            <XCircleIcon
              v-if="issue.status === 'down'"
              class="h-5 w-5 text-red-500 flex-shrink-0"
            />
            <ExclamationTriangleIcon
              v-else
              class="h-5 w-5 text-yellow-500 flex-shrink-0"
            />
            <div class="ml-3 flex-1">
              <p class="text-sm font-medium text-gray-900">
                {{ getTenantName(issue.tenantId) }}
              </p>
              <p class="text-xs text-gray-500">
                {{ issue.status === "down" ? "服務離線" : "服務降級" }}
              </p>
            </div>
            <RouterLink
              :to="`/tenants/${issue.tenantId}`"
              class="text-sm text-primary-600 hover:text-primary-700"
            >
              查看
            </RouterLink>
          </div>
        </div>
      </div>
    </div>

    <!-- 最近活動 -->
    <div class="card">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-900">最近租戶</h2>
        <RouterLink
          to="/tenants"
          class="text-sm text-primary-600 hover:text-primary-700"
        >
          查看全部
        </RouterLink>
      </div>

      <div v-if="tenantsStore.loading" class="text-center py-8">
        <div class="loading-spinner mx-auto" />
        <p class="mt-2 text-sm text-gray-500">載入中...</p>
      </div>

      <div
        v-else-if="tenantsStore.tenants.length === 0"
        class="text-center py-8"
      >
        <BuildingStorefrontIcon class="mx-auto h-12 w-12 text-gray-400" />
        <p class="mt-2 text-sm text-gray-500">暫無租戶</p>
        <RouterLink
          to="/tenants"
          class="mt-4 inline-flex items-center text-sm text-primary-600 hover:text-primary-700"
        >
          <ArrowTrendingUpIcon class="mr-1 h-4 w-4" />
          新增租戶
        </RouterLink>
      </div>

      <div v-else class="overflow-hidden">
        <table class="table">
          <thead>
            <tr>
              <th>商家名稱</th>
              <th>狀態</th>
              <th>版本</th>
              <th>建立時間</th>
              <th></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <tr
              v-for="tenant in tenantsStore.tenants.slice(0, 5)"
              :key="tenant.id"
            >
              <td class="font-medium">{{ tenant.businessName }}</td>
              <td>
                <span
                  class="badge"
                  :class="{
                    'badge-success': tenant.status === 'active',
                    'badge-warning':
                      tenant.status === 'pending' ||
                      tenant.status === 'provisioning',
                    'badge-danger':
                      tenant.status === 'suspended' ||
                      tenant.status === 'terminated',
                    'badge-gray': !tenant.status,
                  }"
                >
                  {{
                    tenant.status === "active"
                      ? "運行中"
                      : tenant.status === "pending"
                        ? "待處理"
                        : tenant.status === "provisioning"
                          ? "配置中"
                          : tenant.status === "suspended"
                            ? "已暫停"
                            : tenant.status === "terminated"
                              ? "已終止"
                              : "未知"
                  }}
                </span>
              </td>
              <td>{{ tenant.deployedVersion || "-" }}</td>
              <td>{{ new Date(tenant.createdAt).toLocaleDateString() }}</td>
              <td>
                <RouterLink
                  :to="`/tenants/${tenant.id}`"
                  class="text-primary-600 hover:text-primary-700"
                >
                  查看
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useTenantsStore } from "@/stores/tenants";
import { licensesApi } from "@/services/api";
import { useToast } from "vue-toastification";
import { RouterLink } from "vue-router";
import { KeyIcon, PlusIcon, ArrowUpIcon } from "@heroicons/vue/24/outline";
import type { License, LicenseTier, GenerateLicenseRequest } from "@/types";

const tenantsStore = useTenantsStore();
const toast = useToast();

// 狀態
const licenses = ref<(License & { tenantName?: string })[]>([]);
const loading = ref(false);
const showGenerateModal = ref(false);

// 生成表單
const generateForm = ref<GenerateLicenseRequest>({
  tenantId: "",
  tier: "standard",
  expiresAt: "",
});

// 載入資料
onMounted(async () => {
  await tenantsStore.fetchTenants();
  await loadAllLicenses();
});

// 載入所有授權
const loadAllLicenses = async () => {
  loading.value = true;
  const allLicenses: (License & { tenantName?: string })[] = [];
  for (const tenant of tenantsStore.tenants) {
    try {
      const tenantLicenses = await licensesApi.getTenantLicense(tenant.id);
      tenantLicenses.forEach((l) => {
        allLicenses.push({
          ...l,
          tenantName: tenant.businessName,
        });
      });
    } catch {
      // 忽略錯誤
    }
  }
  licenses.value = allLicenses.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  loading.value = false;
};

// 統計
const stats = computed(() => ({
  total: licenses.value.length,
  active: licenses.value.filter((l) => !l.revokedAt).length,
  standard: licenses.value.filter((l) => l.tier === "standard" && !l.revokedAt)
    .length,
  professional: licenses.value.filter(
    (l) => l.tier === "professional" && !l.revokedAt,
  ).length,
  enterprise: licenses.value.filter(
    (l) => l.tier === "enterprise" && !l.revokedAt,
  ).length,
}));

// 生成授權
const handleGenerate = async () => {
  if (!generateForm.value.tenantId) {
    toast.warning("請選擇租戶");
    return;
  }

  try {
    const license = await licensesApi.generate(generateForm.value);
    const tenant = tenantsStore.tenants.find(
      (t) => t.id === generateForm.value.tenantId,
    );
    licenses.value.unshift({
      ...license,
      tenantName: tenant?.businessName,
    });
    toast.success("授權生成成功");
    showGenerateModal.value = false;
    generateForm.value = { tenantId: "", tier: "standard", expiresAt: "" };
  } catch (e) {
    toast.error("授權生成失敗");
  }
};

// 獲取等級標籤
const getTierLabel = (tier: LicenseTier) => {
  const labels: Record<LicenseTier, string> = {
    standard: "標準版",
    professional: "專業版",
    enterprise: "企業版",
  };
  return labels[tier] || tier;
};

const getTierClass = (tier: LicenseTier) => {
  const classes: Record<LicenseTier, string> = {
    standard: "badge-info",
    professional: "badge-success",
    enterprise: "bg-purple-100 text-purple-800",
  };
  return classes[tier] || "badge-gray";
};
</script>

<template>
  <div class="space-y-6">
    <!-- 頁面標題 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">授權管理</h1>
        <p class="mt-1 text-sm text-gray-500">管理租戶授權金鑰</p>
      </div>
      <button
        type="button"
        class="btn btn-primary"
        @click="showGenerateModal = true"
      >
        <PlusIcon class="h-5 w-5 mr-2" />
        生成授權
      </button>
    </div>

    <!-- 統計卡片 -->
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-4">
      <div class="card">
        <div class="flex items-center">
          <div class="rounded-full bg-blue-100 p-3">
            <KeyIcon class="h-6 w-6 text-blue-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">有效授權</p>
            <p class="text-2xl font-semibold text-gray-900">
              {{ stats.active }}
            </p>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="text-center">
          <p class="text-sm font-medium text-gray-500">標準版</p>
          <p class="text-2xl font-semibold text-blue-600">
            {{ stats.standard }}
          </p>
        </div>
      </div>
      <div class="card">
        <div class="text-center">
          <p class="text-sm font-medium text-gray-500">專業版</p>
          <p class="text-2xl font-semibold text-green-600">
            {{ stats.professional }}
          </p>
        </div>
      </div>
      <div class="card">
        <div class="text-center">
          <p class="text-sm font-medium text-gray-500">企業版</p>
          <p class="text-2xl font-semibold text-purple-600">
            {{ stats.enterprise }}
          </p>
        </div>
      </div>
    </div>

    <!-- 授權列表 -->
    <div class="card p-0 overflow-hidden">
      <div v-if="loading" class="text-center py-12">
        <div class="loading-spinner mx-auto" />
        <p class="mt-2 text-sm text-gray-500">載入中...</p>
      </div>

      <div v-else-if="licenses.length === 0" class="text-center py-12">
        <KeyIcon class="mx-auto h-12 w-12 text-gray-400" />
        <p class="mt-2 text-sm text-gray-500">暫無授權記錄</p>
      </div>

      <table v-else class="table">
        <thead>
          <tr>
            <th>租戶</th>
            <th>授權金鑰</th>
            <th>等級</th>
            <th>狀態</th>
            <th>有效期</th>
            <th>建立時間</th>
            <th class="text-right">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 bg-white">
          <tr v-for="license in licenses" :key="license.id">
            <td>
              <RouterLink
                :to="`/tenants/${license.tenantId}`"
                class="font-medium text-primary-600 hover:text-primary-700"
              >
                {{ license.tenantName }}
              </RouterLink>
            </td>
            <td class="font-mono text-sm">{{ license.licenseKey }}</td>
            <td>
              <span class="badge" :class="getTierClass(license.tier)">
                {{ getTierLabel(license.tier) }}
              </span>
            </td>
            <td>
              <span
                class="badge"
                :class="license.revokedAt ? 'badge-danger' : 'badge-success'"
              >
                {{ license.revokedAt ? "已撤銷" : "有效" }}
              </span>
            </td>
            <td>
              {{
                license.expiresAt
                  ? new Date(license.expiresAt).toLocaleDateString()
                  : "永久"
              }}
            </td>
            <td class="text-gray-500">
              {{ new Date(license.createdAt).toLocaleDateString() }}
            </td>
            <td class="text-right">
              <button
                v-if="!license.revokedAt && license.tier !== 'enterprise'"
                type="button"
                class="text-primary-600 hover:text-primary-700 font-medium text-sm"
              >
                <ArrowUpIcon class="h-4 w-4 inline mr-1" />
                升級
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 生成授權 Modal -->
    <Teleport to="body">
      <div v-if="showGenerateModal" class="fixed inset-0 z-50 overflow-y-auto">
        <div
          class="fixed inset-0 bg-gray-500 bg-opacity-75"
          @click="showGenerateModal = false"
        />
        <div class="flex min-h-full items-center justify-center p-4">
          <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full">
            <div class="px-6 py-4 border-b">
              <h3 class="text-lg font-semibold">生成授權</h3>
            </div>
            <div class="px-6 py-4 space-y-4">
              <!-- 選擇租戶 -->
              <div>
                <label class="label">選擇租戶</label>
                <select v-model="generateForm.tenantId" class="input">
                  <option value="">請選擇</option>
                  <option
                    v-for="tenant in tenantsStore.tenants"
                    :key="tenant.id"
                    :value="tenant.id"
                  >
                    {{ tenant.businessName }}
                  </option>
                </select>
              </div>

              <!-- 選擇等級 -->
              <div>
                <label class="label">授權等級</label>
                <select v-model="generateForm.tier" class="input">
                  <option value="standard">標準版 - $149/月</option>
                  <option value="professional">專業版 - $299/月</option>
                  <option value="enterprise">企業版 - 議價</option>
                </select>
              </div>

              <!-- 有效期 -->
              <div>
                <label class="label">有效期至 (選填)</label>
                <input
                  v-model="generateForm.expiresAt"
                  type="date"
                  class="input"
                />
                <p class="mt-1 text-xs text-gray-500">留空表示永久有效</p>
              </div>
            </div>
            <div class="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                type="button"
                class="btn btn-secondary"
                @click="showGenerateModal = false"
              >
                取消
              </button>
              <button
                type="button"
                class="btn btn-primary"
                @click="handleGenerate"
              >
                生成
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

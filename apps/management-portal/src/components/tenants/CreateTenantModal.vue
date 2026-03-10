<script setup lang="ts">
import { ref, watch } from "vue";
import { useTenantsStore } from "@/stores/tenants";
import { XMarkIcon } from "@heroicons/vue/24/outline";
import type { CreateTenantRequest } from "@/types";

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  close: [];
  success: [];
}>();

const tenantsStore = useTenantsStore();

// 表單資料
const form = ref<CreateTenantRequest>({
  businessName: "",
  contactEmail: "",
  contactPhone: "",
  subdomain: "",
  planId: "standard",
});

// 表單錯誤
const errors = ref<Record<string, string>>({});
const submitting = ref(false);

// 方案選項
const planOptions = [
  {
    value: "standard",
    label: "標準版 - $149/月",
    description: "1 間餐廳，基本功能",
  },
  {
    value: "professional",
    label: "專業版 - $299/月",
    description: "3 間餐廳，完整功能",
  },
  {
    value: "enterprise",
    label: "企業版 - 議價",
    description: "無限餐廳，客製化服務",
  },
];

// 重置表單
watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      form.value = {
        businessName: "",
        contactEmail: "",
        contactPhone: "",
        subdomain: "",
        planId: "standard",
      };
      errors.value = {};
    }
  },
);

// 驗證表單
const validate = (): boolean => {
  errors.value = {};

  if (!form.value.businessName.trim()) {
    errors.value.businessName = "請輸入商家名稱";
  }

  if (!form.value.contactEmail.trim()) {
    errors.value.contactEmail = "請輸入聯絡 Email";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.contactEmail)) {
    errors.value.contactEmail = "請輸入有效的 Email";
  }

  if (form.value.subdomain && !/^[a-z0-9-]+$/.test(form.value.subdomain)) {
    errors.value.subdomain = "子域名只能包含小寫字母、數字和連字符";
  }

  return Object.keys(errors.value).length === 0;
};

// 提交表單
const handleSubmit = async () => {
  if (!validate()) return;

  submitting.value = true;
  try {
    await tenantsStore.createTenant(form.value);
    emit("success");
  } catch (e) {
    console.error("創建租戶失敗:", e);
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-50 overflow-y-auto">
      <!-- 背景遮罩 -->
      <div
        class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
        @click="emit('close')"
      />

      <!-- Modal -->
      <div
        class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0"
      >
        <div
          class="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg"
        >
          <!-- 標題 -->
          <div
            class="flex items-center justify-between px-6 py-4 border-b border-gray-200"
          >
            <h3 class="text-lg font-semibold text-gray-900">新增租戶</h3>
            <button
              type="button"
              class="text-gray-400 hover:text-gray-500"
              @click="emit('close')"
            >
              <XMarkIcon class="h-6 w-6" />
            </button>
          </div>

          <!-- 表單 -->
          <form @submit.prevent="handleSubmit" class="px-6 py-4 space-y-4">
            <!-- 商家名稱 -->
            <div>
              <label class="label">商家名稱 *</label>
              <input
                v-model="form.businessName"
                type="text"
                class="input"
                :class="{ 'input-error': errors.businessName }"
                placeholder="例如：御膳房"
              />
              <p v-if="errors.businessName" class="mt-1 text-sm text-red-600">
                {{ errors.businessName }}
              </p>
            </div>

            <!-- 聯絡 Email -->
            <div>
              <label class="label">聯絡 Email *</label>
              <input
                v-model="form.contactEmail"
                type="email"
                class="input"
                :class="{ 'input-error': errors.contactEmail }"
                placeholder="owner@restaurant.com"
              />
              <p v-if="errors.contactEmail" class="mt-1 text-sm text-red-600">
                {{ errors.contactEmail }}
              </p>
            </div>

            <!-- 聯絡電話 -->
            <div>
              <label class="label">聯絡電話</label>
              <input
                v-model="form.contactPhone"
                type="tel"
                class="input"
                placeholder="02-1234-5678"
              />
            </div>

            <!-- 子域名 -->
            <div>
              <label class="label">子域名</label>
              <div class="flex items-center">
                <input
                  v-model="form.subdomain"
                  type="text"
                  class="input rounded-r-none"
                  :class="{ 'input-error': errors.subdomain }"
                  placeholder="yushenfang"
                />
                <span
                  class="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 bg-gray-50 text-gray-500 text-sm rounded-r-md"
                >
                  .makanmakan.app
                </span>
              </div>
              <p v-if="errors.subdomain" class="mt-1 text-sm text-red-600">
                {{ errors.subdomain }}
              </p>
              <p class="mt-1 text-xs text-gray-500">留空將自動生成</p>
            </div>

            <!-- 方案選擇 -->
            <div>
              <label class="label">選擇方案</label>
              <div class="space-y-2">
                <label
                  v-for="plan in planOptions"
                  :key="plan.value"
                  class="flex items-start p-3 border rounded-lg cursor-pointer transition-colors"
                  :class="{
                    'border-primary-500 bg-primary-50':
                      form.planId === plan.value,
                    'border-gray-200 hover:border-gray-300':
                      form.planId !== plan.value,
                  }"
                >
                  <input
                    v-model="form.planId"
                    type="radio"
                    :value="plan.value"
                    class="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500"
                  />
                  <div class="ml-3">
                    <div class="text-sm font-medium text-gray-900">
                      {{ plan.label }}
                    </div>
                    <div class="text-xs text-gray-500">
                      {{ plan.description }}
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </form>

          <!-- 操作按鈕 -->
          <div
            class="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50"
          >
            <button
              type="button"
              class="btn btn-secondary"
              @click="emit('close')"
            >
              取消
            </button>
            <button
              type="button"
              class="btn btn-primary"
              :disabled="submitting"
              @click="handleSubmit"
            >
              <span v-if="submitting" class="loading-spinner mr-2" />
              {{ submitting ? "創建中..." : "創建租戶" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

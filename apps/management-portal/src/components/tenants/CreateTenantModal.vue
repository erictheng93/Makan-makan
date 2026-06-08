<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useTenantsStore } from "@/stores/tenants";
import { XMarkIcon } from "@heroicons/vue/24/outline";
import type { CreateTenantRequest } from "@/types";
import { useI18n } from "@/i18n";

const { t } = useI18n();

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
  licenseTier: "standard",
});

// 表單錯誤
const errors = ref<Record<string, string>>({});
const submitting = ref(false);
const submitError = ref("");

// 方案選項
const planOptions = computed(() => [
  {
    value: "standard",
    label: t("tenants.createModal.plan.standard.label"),
    description: t("tenants.createModal.plan.standard.description"),
  },
  {
    value: "professional",
    label: t("tenants.createModal.plan.professional.label"),
    description: t("tenants.createModal.plan.professional.description"),
  },
  {
    value: "enterprise",
    label: t("tenants.createModal.plan.enterprise.label"),
    description: t("tenants.createModal.plan.enterprise.description"),
  },
]);

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
        licenseTier: "standard",
      };
      errors.value = {};
      submitError.value = "";
    }
  },
);

// 驗證表單
const validate = (): boolean => {
  errors.value = {};

  if (!form.value.businessName.trim()) {
    errors.value.businessName = t(
      "tenants.createModal.validation.businessNameRequired",
    );
  }

  if (!form.value.contactEmail.trim()) {
    errors.value.contactEmail = t(
      "tenants.createModal.validation.emailRequired",
    );
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.contactEmail)) {
    errors.value.contactEmail = t(
      "tenants.createModal.validation.emailInvalid",
    );
  }

  if (form.value.subdomain && !/^[a-z0-9-]+$/.test(form.value.subdomain)) {
    errors.value.subdomain = t(
      "tenants.createModal.validation.subdomainFormat",
    );
  }

  return Object.keys(errors.value).length === 0;
};

// 提交表單
const handleSubmit = async () => {
  if (!validate()) return;

  submitting.value = true;
  submitError.value = "";
  try {
    await tenantsStore.createTenant(form.value);
    emit("success");
  } catch (e) {
    console.error("創建租戶失敗:", e);
    submitError.value =
      e instanceof Error
        ? e.message
        : t("tenants.createModal.error.createFailed");
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
          data-testid="management-tenant-create-modal"
          class="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg"
        >
          <!-- 標題 -->
          <div
            class="flex items-center justify-between px-6 py-4 border-b border-gray-200"
          >
            <h3 class="text-lg font-semibold text-gray-900">
              {{ t("tenants.create") }}
            </h3>
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
              <label class="label">
                {{ t("tenants.createModal.field.businessName") }} *
              </label>
              <input
                v-model="form.businessName"
                data-testid="management-tenant-business-name"
                type="text"
                class="input"
                :class="{ 'input-error': errors.businessName }"
                :placeholder="
                  t('tenants.createModal.field.businessNamePlaceholder')
                "
              />
              <p v-if="errors.businessName" class="mt-1 text-sm text-red-600">
                {{ errors.businessName }}
              </p>
            </div>

            <!-- 聯絡 Email -->
            <div>
              <label class="label">
                {{ t("tenants.createModal.field.contactEmail") }} *
              </label>
              <input
                v-model="form.contactEmail"
                data-testid="management-tenant-contact-email"
                type="email"
                class="input"
                :class="{ 'input-error': errors.contactEmail }"
                :placeholder="
                  t('tenants.createModal.field.contactEmailPlaceholder')
                "
              />
              <p v-if="errors.contactEmail" class="mt-1 text-sm text-red-600">
                {{ errors.contactEmail }}
              </p>
            </div>

            <!-- 聯絡電話 -->
            <div>
              <label class="label">
                {{ t("tenants.createModal.field.contactPhone") }}
              </label>
              <input
                v-model="form.contactPhone"
                data-testid="management-tenant-contact-phone"
                type="tel"
                class="input"
                :placeholder="
                  t('tenants.createModal.field.contactPhonePlaceholder')
                "
              />
            </div>

            <!-- 子域名 -->
            <div>
              <label class="label">
                {{ t("tenants.createModal.field.subdomain") }}
              </label>
              <div class="flex items-center">
                <input
                  v-model="form.subdomain"
                  data-testid="management-tenant-subdomain"
                  type="text"
                  class="input rounded-r-none"
                  :class="{ 'input-error': errors.subdomain }"
                  :placeholder="
                    t('tenants.createModal.field.subdomainPlaceholder')
                  "
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
              <p class="mt-1 text-xs text-gray-500">
                {{ t("tenants.createModal.field.subdomainHint") }}
              </p>
            </div>

            <!-- 方案選擇 -->
            <div>
              <label class="label">
                {{ t("tenants.createModal.field.selectPlan") }}
              </label>
              <div class="space-y-2">
                <label
                  v-for="plan in planOptions"
                  :key="plan.value"
                  class="flex items-start p-3 border rounded-lg cursor-pointer transition-colors"
                  :class="{
                    'border-primary-500 bg-primary-50':
                      form.licenseTier === plan.value,
                    'border-gray-200 hover:border-gray-300':
                      form.licenseTier !== plan.value,
                  }"
                >
                  <input
                    v-model="form.licenseTier"
                    :data-testid="`management-tenant-license-${plan.value}`"
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

          <!-- 錯誤提示 -->
          <div
            v-if="submitError"
            class="mx-6 mb-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
          >
            {{ submitError }}
          </div>

          <!-- 操作按鈕 -->
          <div
            class="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50"
          >
            <button
              type="button"
              data-testid="management-tenant-create-cancel"
              class="btn btn-secondary"
              @click="emit('close')"
            >
              {{ t("common.cancel") }}
            </button>
            <button
              type="button"
              data-testid="management-tenant-create-submit"
              class="btn btn-primary"
              :disabled="submitting"
              @click="handleSubmit"
            >
              <span v-if="submitting" class="loading-spinner mr-2" />
              {{
                submitting
                  ? t("tenants.createModal.creating")
                  : t("tenants.createModal.submit")
              }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

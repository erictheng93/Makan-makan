<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { useOnboardingStore } from "@/stores/onboarding";
import {
  InformationCircleIcon,
  ClipboardDocumentIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
} from "@heroicons/vue/24/outline";
import { useI18n } from "@/i18n";

const { t } = useI18n();
const router = useRouter();
const toast = useToast();
const store = useOnboardingStore();

const form = ref({
  accountId: "",
  apiToken: "",
});

const errors = ref<Record<string, string>>({});
const completing = ref(false);

// Check if we have application data
onMounted(() => {
  if (!store.applicationId) {
    router.push("/apply");
  }
});

const validate = (): boolean => {
  errors.value = {};

  if (!form.value.accountId.trim()) {
    errors.value.accountId = t("connect.validation.accountIdRequired");
  } else if (form.value.accountId.length !== 32) {
    errors.value.accountId = t("connect.validation.accountIdLength");
  }

  if (!form.value.apiToken.trim()) {
    errors.value.apiToken = t("connect.validation.apiTokenRequired");
  } else if (form.value.apiToken.length < 40) {
    errors.value.apiToken = t("connect.validation.apiTokenFormat");
  }

  return Object.keys(errors.value).length === 0;
};

const handleVerify = async () => {
  if (!validate()) return;

  store.clearError();

  const success = await store.verifyCloudflare(
    form.value.accountId,
    form.value.apiToken,
  );

  if (success) {
    toast.success(t("connect.toast.verifySuccess"));
  } else {
    toast.error(store.apiError || t("connect.toast.verifyFailureFallback"));
  }
};

const handleComplete = async () => {
  completing.value = true;
  store.clearError();

  try {
    const success = await store.completeApplication();

    if (success) {
      toast.success(t("connect.toast.completeSuccess"));
      router.push("/success");
    } else {
      toast.error(store.apiError || t("connect.toast.completeFailureFallback"));
    }
  } finally {
    completing.value = false;
  }
};

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success(t("common.toast.copiedToClipboard"));
};

// Helper to check if verified
const isVerified = () => store.cloudflareInfo?.verified === true;
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <!-- Progress -->
    <div class="flex items-center justify-center mb-8">
      <div class="flex items-center">
        <div
          class="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-medium"
        >
          ✓
        </div>
        <div class="w-24 h-1 bg-primary-600" />
        <div
          class="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-medium"
        >
          2
        </div>
        <div class="w-24 h-1 bg-gray-200">
          <div
            :class="isVerified() ? 'w-full' : 'w-0'"
            class="h-full bg-primary-600 transition-all"
          />
        </div>
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center font-medium"
          :class="
            isVerified()
              ? 'bg-primary-600 text-white'
              : 'bg-gray-200 text-gray-500'
          "
        >
          3
        </div>
      </div>
    </div>

    <div class="card">
      <h1 class="text-2xl font-bold text-gray-900 mb-6">
        {{ t("connect.title") }}
      </h1>

      <!-- Application Info -->
      <div
        v-if="store.assignedSubdomain"
        class="mb-6 p-4 bg-gray-50 rounded-lg"
      >
        <p class="text-sm text-gray-600">
          {{ t("connect.assignedSubdomainLabel")
          }}<span class="font-mono font-medium text-gray-900"
            >{{ store.assignedSubdomain }}.makanmasak.app</span
          >
        </p>
      </div>

      <!-- API Error Alert -->
      <div
        v-if="store.apiError"
        class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"
      >
        <div class="flex">
          <ExclamationTriangleIcon class="h-5 w-5 text-red-500 flex-shrink-0" />
          <div class="ml-3">
            <p class="text-sm text-red-700">{{ store.apiError }}</p>
          </div>
        </div>
      </div>

      <!-- 說明 -->
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div class="flex">
          <InformationCircleIcon
            class="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5"
          />
          <div class="ml-3">
            <h3 class="text-sm font-medium text-blue-800">
              {{ t("connect.info.title") }}
            </h3>
            <p class="mt-1 text-sm text-blue-700">
              {{ t("connect.info.description") }}
            </p>
          </div>
        </div>
      </div>

      <!-- 步驟指引 -->
      <div class="space-y-4 mb-6">
        <h3 class="font-medium text-gray-900">
          {{ t("connect.steps.heading") }}
        </h3>
        <ol class="list-decimal list-inside space-y-2 text-gray-600">
          <li>
            {{ t("connect.steps.step1Prefix") }}
            <a
              href="https://dash.cloudflare.com"
              target="_blank"
              class="text-primary-600 hover:underline"
              >Cloudflare Dashboard</a
            >
            {{ t("connect.steps.step1Suffix") }}
          </li>
          <li>{{ t("connect.steps.step2") }}</li>
          <li>
            {{ t("connect.steps.step3Prefix") }} <strong>Account ID</strong>
            <button
              type="button"
              class="ml-2 text-gray-400 hover:text-gray-600"
              @click="copyToClipboard(t('connect.steps.step3ClipboardText'))"
            >
              <ClipboardDocumentIcon class="h-4 w-4 inline" />
            </button>
          </li>
          <li>{{ t("connect.steps.step4") }}</li>
          <li>{{ t("connect.steps.step5") }}</li>
          <li>{{ t("connect.steps.step6") }}</li>
        </ol>
      </div>

      <!-- 表單 -->
      <form @submit.prevent="handleVerify" class="space-y-6">
        <!-- Account ID -->
        <div>
          <label class="label">{{ t("connect.form.accountId.label") }} *</label>
          <input
            v-model="form.accountId"
            type="text"
            class="input font-mono"
            :class="{ 'input-error': errors.accountId }"
            :placeholder="t('connect.form.accountId.placeholder')"
            :disabled="isVerified()"
          />
          <p v-if="errors.accountId" class="mt-1 text-sm text-red-600">
            {{ errors.accountId }}
          </p>
        </div>

        <!-- API Token -->
        <div>
          <label class="label">{{ t("connect.form.apiToken.label") }} *</label>
          <input
            v-model="form.apiToken"
            type="password"
            class="input font-mono"
            :class="{ 'input-error': errors.apiToken }"
            :placeholder="t('connect.form.apiToken.placeholder')"
            :disabled="isVerified()"
          />
          <p v-if="errors.apiToken" class="mt-1 text-sm text-red-600">
            {{ errors.apiToken }}
          </p>
        </div>

        <!-- Permission Status (shown after verification attempt) -->
        <div
          v-if="store.cloudflareInfo?.permissions"
          class="p-4 rounded-lg"
          :class="
            isVerified()
              ? 'bg-green-50 border border-green-200'
              : 'bg-yellow-50 border border-yellow-200'
          "
        >
          <h4
            class="font-medium mb-3"
            :class="isVerified() ? 'text-green-800' : 'text-yellow-800'"
          >
            {{
              isVerified()
                ? t("connect.permissions.titleSuccess")
                : t("connect.permissions.titleWarning")
            }}
          </h4>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div class="flex items-center">
              <CheckCircleIcon
                v-if="store.cloudflareInfo.permissions.workers"
                class="h-4 w-4 text-green-500 mr-2"
              />
              <XCircleIcon v-else class="h-4 w-4 text-red-500 mr-2" />
              <span
                :class="
                  store.cloudflareInfo.permissions.workers
                    ? 'text-green-700'
                    : 'text-red-700'
                "
                >Workers</span
              >
            </div>
            <div class="flex items-center">
              <CheckCircleIcon
                v-if="store.cloudflareInfo.permissions.d1"
                class="h-4 w-4 text-green-500 mr-2"
              />
              <XCircleIcon v-else class="h-4 w-4 text-red-500 mr-2" />
              <span
                :class="
                  store.cloudflareInfo.permissions.d1
                    ? 'text-green-700'
                    : 'text-red-700'
                "
                >D1 Database</span
              >
            </div>
            <div class="flex items-center">
              <CheckCircleIcon
                v-if="store.cloudflareInfo.permissions.kv"
                class="h-4 w-4 text-green-500 mr-2"
              />
              <XCircleIcon v-else class="h-4 w-4 text-red-500 mr-2" />
              <span
                :class="
                  store.cloudflareInfo.permissions.kv
                    ? 'text-green-700'
                    : 'text-red-700'
                "
                >KV Storage</span
              >
            </div>
            <div class="flex items-center">
              <CheckCircleIcon
                v-if="store.cloudflareInfo.permissions.r2"
                class="h-4 w-4 text-green-500 mr-2"
              />
              <XCircleIcon v-else class="h-4 w-4 text-red-500 mr-2" />
              <span
                :class="
                  store.cloudflareInfo.permissions.r2
                    ? 'text-green-700'
                    : 'text-red-700'
                "
                >R2 Storage</span
              >
            </div>
            <div class="flex items-center">
              <CheckCircleIcon
                v-if="store.cloudflareInfo.permissions.pages"
                class="h-4 w-4 text-green-500 mr-2"
              />
              <XCircleIcon v-else class="h-4 w-4 text-red-500 mr-2" />
              <span
                :class="
                  store.cloudflareInfo.permissions.pages
                    ? 'text-green-700'
                    : 'text-red-700'
                "
                >{{ t("connect.permissions.pagesOptional") }}</span
              >
            </div>
          </div>
        </div>

        <!-- 驗證成功提示 -->
        <div
          v-if="isVerified()"
          class="flex items-center p-4 bg-green-50 border border-green-200 rounded-lg"
        >
          <CheckCircleIcon class="h-5 w-5 text-green-500" />
          <span class="ml-2 text-green-700">{{
            t("connect.verifiedMessage")
          }}</span>
        </div>

        <!-- 按鈕 -->
        <div class="flex justify-between pt-4">
          <button
            type="button"
            class="btn btn-secondary"
            @click="router.push('/apply')"
          >
            {{ t("common.back") }}
          </button>
          <button
            v-if="!isVerified()"
            type="submit"
            class="btn btn-primary"
            :disabled="store.isVerifyingCf"
          >
            <ArrowPathIcon
              v-if="store.isVerifyingCf"
              class="h-4 w-4 mr-2 animate-spin"
            />
            {{
              store.isVerifyingCf
                ? t("connect.button.verifying")
                : t("connect.button.verify")
            }}
          </button>
          <button
            v-else
            type="button"
            class="btn btn-primary"
            :disabled="completing || store.isCompleting"
            @click="handleComplete"
          >
            <ArrowPathIcon
              v-if="completing || store.isCompleting"
              class="h-4 w-4 mr-2 animate-spin"
            />
            {{
              completing || store.isCompleting
                ? t("connect.button.completing")
                : t("connect.button.complete")
            }}
          </button>
        </div>
      </form>
    </div>

    <!-- 需要協助？ -->
    <div class="mt-6 text-center text-sm text-gray-500">
      {{ t("connect.help.prompt") }}
      <a
        href="mailto:support@makanmasak.app"
        class="text-primary-600 hover:underline"
      >
        {{ t("connect.help.linkText") }}
      </a>
    </div>
  </div>
</template>

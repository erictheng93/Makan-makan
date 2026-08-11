<template>
  <div class="min-h-screen bg-ios-bg py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full mx-auto space-y-8">
      <div class="text-center">
        <div
          class="mx-auto w-16 h-16 bg-ios-blue rounded-2xl flex items-center justify-center mb-4 shadow-[0_4px_16px_rgba(0,122,255,0.24)]"
        >
          <span class="text-white font-bold text-2xl">M</span>
        </div>
        <h2 class="text-3xl font-bold text-ios-text">
          {{ t("auth.forgotPasswordTitle") }}
        </h2>
      </div>

      <div
        class="bg-ios-card rounded-3xl shadow-[0_4px_16px_rgba(0,0,0,0.06)] p-8"
      >
        <!-- 送出後的答覆對「帳號存在」與否完全一致，前端不得再細分 -->
        <div v-if="sent" data-testid="sent-panel">
          <div
            class="w-12 h-12 rounded-full bg-ios-green/10 flex items-center justify-center mb-4"
          >
            <svg
              class="w-6 h-6 text-ios-green"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p class="text-sm text-ios-secondary">
            {{ t("auth.forgotPasswordSent") }}
          </p>
        </div>

        <form v-else class="space-y-5" @submit.prevent="handleSubmit">
          <p class="text-sm text-ios-secondary">
            {{ t("auth.forgotPasswordHint") }}
          </p>

          <div>
            <label
              for="identifier"
              class="block text-sm font-medium text-ios-text mb-2"
            >
              {{ t("auth.identifier") }}
            </label>
            <input
              id="identifier"
              v-model="identifier"
              type="text"
              required
              autocomplete="username"
              data-testid="identifier-input"
              class="w-full px-4 py-3 bg-ios-bg rounded-2xl text-ios-text placeholder:text-ios-tertiary focus:ring-2 focus:ring-ios-blue focus:bg-white transition"
              :placeholder="t('auth.identifierPlaceholder')"
            />
            <p v-if="fieldError" class="mt-2 text-sm text-ios-red">
              {{ fieldError }}
            </p>
          </div>

          <div
            v-if="error"
            data-testid="auth-error"
            class="bg-ios-red/10 rounded-2xl px-4 py-3"
          >
            <p class="text-sm text-ios-red">{{ error }}</p>
          </div>

          <button
            type="submit"
            :disabled="isLoading"
            data-testid="submit"
            class="w-full bg-ios-blue text-white py-3.5 px-4 rounded-full font-semibold shadow-[0_4px_16px_rgba(0,122,255,0.24)] transition-all duration-200 ease-out hover:bg-ios-blue/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{
              isLoading ? t("common.loading") : t("auth.forgotPasswordSubmit")
            }}
          </button>
        </form>

        <div class="mt-6 text-center">
          <router-link
            to="/login?mode=password"
            data-testid="back-to-login"
            class="text-sm text-ios-blue"
          >
            {{ t("auth.backToLogin") }}
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { customerIdentityApi } from "@/services/customerIdentityApi";
import { useI18n } from "@/composables/useI18n";

const { t } = useI18n();

const identifier = ref("");
const isLoading = ref(false);
const sent = ref(false);
const error = ref("");
const fieldError = ref("");

const handleSubmit = async () => {
  error.value = "";
  fieldError.value = "";

  if (!identifier.value.trim()) {
    fieldError.value = t("auth.identifierRequired");
    return;
  }

  isLoading.value = true;

  try {
    await customerIdentityApi.forgotPassword(identifier.value.trim());
    sent.value = true;
  } catch (err: unknown) {
    error.value =
      (err instanceof Error && err.message) || t("messages.networkError");
  } finally {
    isLoading.value = false;
  }
};
</script>

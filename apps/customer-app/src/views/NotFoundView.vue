<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center">
    <div class="max-w-md mx-auto text-center px-4">
      <div class="mb-8">
        <div class="text-9xl font-bold text-gray-300 mb-4">404</div>
        <svg
          class="w-16 h-16 mx-auto text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-3-1v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      <h1 class="text-2xl font-bold text-gray-900 mb-4">
        {{ t("errorBoundary.notFoundTitle") }}
      </h1>
      <p class="text-gray-600 mb-8">{{ t("errorBoundary.notFoundMessage") }}</p>

      <div class="space-y-4">
        <button
          class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          @click="goBack"
        >
          {{ t("common.back") }}
        </button>

        <button
          class="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-3 px-6 rounded-lg transition-colors"
          @click="goHome"
        >
          {{ t("common.home") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { useI18n } from "@/composables/useI18n";

const router = useRouter();
const { t } = useI18n();

const goBack = () => {
  window.history.back();
};

const goHome = () => {
  router.push("/");
};
</script>

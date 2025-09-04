<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center">
    <div class="max-w-md mx-auto text-center px-4">
      <div class="mb-8">
        <svg
          class="w-24 h-24 mx-auto text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>

      <h1 class="text-3xl font-bold text-gray-900 mb-4">發生錯誤</h1>
      <p class="text-gray-600 mb-8">
        {{ errorMessage || "很抱歉，系統發生了未預期的錯誤。" }}
      </p>

      <div class="space-y-4">
        <button
          class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          @click="retry"
        >
          重新嘗試
        </button>

        <button
          class="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-3 px-6 rounded-lg transition-colors"
          @click="goHome"
        >
          回到首頁
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter, useRoute } from "vue-router";

const router = useRouter();
const route = useRoute();

const errorMessage = ref((route.query.message as string) || "");

const retry = () => {
  window.location.reload();
};

const goHome = () => {
  router.push("/");
};
</script>

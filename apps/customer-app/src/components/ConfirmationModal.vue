<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
    @click.self="$emit('cancel')"
  >
    <div class="bg-white rounded-2xl shadow-xl max-w-sm w-full" @click.stop>
      <!-- 標題區域 -->
      <div class="p-6 pb-4">
        <div class="flex items-center justify-center mb-4">
          <div
            class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center"
          >
            <svg
              class="w-6 h-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        <h3 class="text-lg font-semibold text-gray-900 text-center mb-2">
          {{ title }}
        </h3>

        <p class="text-gray-600 text-center">
          {{ message }}
        </p>
      </div>

      <!-- 按鈕區域 -->
      <div class="p-6 pt-0 space-y-3">
        <button
          :disabled="loading"
          class="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center"
          @click="$emit('confirm')"
        >
          <div
            v-if="loading"
            class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
          />
          {{ confirmText }}
        </button>

        <button
          :disabled="loading"
          class="w-full bg-white border border-gray-300 hover:bg-gray-50 disabled:bg-gray-100 text-gray-700 font-semibold py-3 px-4 rounded-xl transition-colors"
          @click="$emit('cancel')"
        >
          {{ cancelText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Props
defineProps<{
  show: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
}>();

// Emits
defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>

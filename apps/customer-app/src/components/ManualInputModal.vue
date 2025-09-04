<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
    @click.self="$emit('close')"
  >
    <div class="bg-white rounded-2xl shadow-xl max-w-md w-full" @click.stop>
      <!-- 標題區域 -->
      <div class="px-6 py-4 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900">輸入餐廳資訊</h3>
          <button
            class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
            @click="$emit('close')"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- 表單內容 -->
      <div class="px-6 py-4 space-y-4">
        <!-- 餐廳ID輸入 -->
        <div>
          <label
            for="restaurant-id"
            class="block text-sm font-medium text-gray-700 mb-2"
          >
            餐廳ID
          </label>
          <input
            id="restaurant-id"
            v-model="form.restaurantId"
            type="number"
            placeholder="請輸入餐廳ID"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            :class="{ 'border-red-500': errors.restaurantId }"
          />
          <p v-if="errors.restaurantId" class="mt-1 text-sm text-red-600">
            {{ errors.restaurantId }}
          </p>
        </div>

        <!-- 桌號輸入 -->
        <div>
          <label
            for="table-id"
            class="block text-sm font-medium text-gray-700 mb-2"
          >
            桌號
          </label>
          <input
            id="table-id"
            v-model="form.tableId"
            type="number"
            placeholder="請輸入桌號"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            :class="{ 'border-red-500': errors.tableId }"
          />
          <p v-if="errors.tableId" class="mt-1 text-sm text-red-600">
            {{ errors.tableId }}
          </p>
        </div>

        <!-- 提示文字 -->
        <div class="bg-blue-50 p-3 rounded-lg">
          <div class="flex items-start">
            <svg
              class="w-5 h-5 text-blue-400 mt-0.5 mr-2 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div class="text-sm text-blue-800">
              <p class="font-medium mb-1">找不到餐廳和桌號資訊？</p>
              <p>請聯繫餐廳服務人員，或使用桌上的QR Code掃描進入。</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 按鈕區域 -->
      <div class="px-6 py-4 bg-gray-50 rounded-b-2xl space-y-3">
        <button
          :disabled="!isFormValid || loading"
          class="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center"
          @click="handleConfirm"
        >
          <div
            v-if="loading"
            class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
          />
          {{ loading ? "驗證中..." : "確認" }}
        </button>

        <button
          :disabled="loading"
          class="w-full bg-white border border-gray-300 hover:bg-gray-50 disabled:bg-gray-100 text-gray-700 font-semibold py-3 px-4 rounded-xl transition-colors"
          @click="$emit('close')"
        >
          取消
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";

// Props
const props = defineProps<{
  show: boolean;
  loading?: boolean;
}>();

// Emits
const emits = defineEmits<{
  close: [];
  confirm: [data: { restaurantId: number; tableId: number }];
}>();

// State
const form = ref({
  restaurantId: "",
  tableId: "",
});

const errors = ref({
  restaurantId: "",
  tableId: "",
});

// Computed
const isFormValid = computed(() => {
  return (
    form.value.restaurantId &&
    form.value.tableId &&
    !errors.value.restaurantId &&
    !errors.value.tableId
  );
});

// Validation
const validateForm = () => {
  errors.value = { restaurantId: "", tableId: "" };

  // 驗證餐廳ID
  if (!form.value.restaurantId) {
    errors.value.restaurantId = "請輸入餐廳ID";
  } else if (!/^\d+$/.test(form.value.restaurantId)) {
    errors.value.restaurantId = "餐廳ID必須為數字";
  } else if (parseInt(form.value.restaurantId) <= 0) {
    errors.value.restaurantId = "餐廳ID必須大於0";
  }

  // 驗證桌號
  if (!form.value.tableId) {
    errors.value.tableId = "請輸入桌號";
  } else if (!/^\d+$/.test(form.value.tableId)) {
    errors.value.tableId = "桌號必須為數字";
  } else if (parseInt(form.value.tableId) <= 0) {
    errors.value.tableId = "桌號必須大於0";
  }
};

// 監聽輸入變化進行即時驗證
watch(form, validateForm, { deep: true });

// Methods
const handleConfirm = () => {
  validateForm();

  if (isFormValid.value) {
    emits("confirm", {
      restaurantId: parseInt(form.value.restaurantId),
      tableId: parseInt(form.value.tableId),
    });
  }
};

// 重置表單
const resetForm = () => {
  form.value = { restaurantId: "", tableId: "" };
  errors.value = { restaurantId: "", tableId: "" };
};

// 監聽 show 屬性變化，重置表單
watch(
  () => props.show,
  (newShow) => {
    if (!newShow) {
      resetForm();
    }
  },
);
</script>

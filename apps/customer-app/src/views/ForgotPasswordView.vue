<template>
  <div
    class="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 py-12 px-4 sm:px-6 lg:px-8"
  >
    <div class="max-w-md w-full space-y-8">
      <!-- Logo 和標題 -->
      <div class="text-center">
        <div
          class="mx-auto w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center mb-4 shadow-lg"
        >
          <span class="text-white font-bold text-2xl">M</span>
        </div>
        <h2 class="text-3xl font-bold text-gray-900">忘記密碼</h2>
        <p class="mt-2 text-sm text-gray-600">
          輸入您的 Email 地址，我們將發送重設密碼的連結給您
        </p>
      </div>

      <!-- 成功訊息 -->
      <div
        v-if="success"
        class="bg-green-50 border-l-4 border-green-400 p-4 rounded-lg"
      >
        <div class="flex items-center">
          <svg
            class="w-6 h-6 text-green-400 mr-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <p class="text-sm font-medium text-green-800">
              {{ successMessage }}
            </p>
            <p class="text-xs text-green-700 mt-1">
              請檢查您的郵箱，連結有效期限為 15 分鐘
            </p>
          </div>
        </div>
        <button
          class="mt-4 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          @click="$router.push('/login')"
        >
          返回登入
        </button>
      </div>

      <!-- 忘記密碼表單 -->
      <div v-if="!success" class="bg-white rounded-2xl shadow-xl p-8">
        <form class="space-y-6" @submit.prevent="handleSubmit">
          <!-- Email 輸入 -->
          <div>
            <label
              for="email"
              class="block text-sm font-medium text-gray-700 mb-2"
            >
              Email 地址
            </label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              required
              autocomplete="email"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
              :class="{ 'border-red-500': errors.email }"
              placeholder="your@email.com"
            />
            <p v-if="errors.email" class="mt-1 text-sm text-red-600">
              {{ errors.email }}
            </p>
          </div>

          <!-- 錯誤訊息 -->
          <div
            v-if="error"
            class="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg"
          >
            <div class="flex items-center">
              <svg
                class="w-5 h-5 text-red-400 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p class="text-sm text-red-800">{{ error }}</p>
            </div>
          </div>

          <!-- 提交按鈕 -->
          <div>
            <button
              type="submit"
              :disabled="isLoading"
              class="w-full flex justify-center items-center px-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200"
              :class="{ 'opacity-50 cursor-not-allowed': isLoading }"
            >
              <svg
                v-if="isLoading"
                class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>{{ isLoading ? "發送中..." : "發送重設連結" }}</span>
            </button>
          </div>

          <!-- 返回登入 -->
          <div class="text-center">
            <router-link
              to="/login"
              class="text-sm text-orange-600 hover:text-orange-700 font-medium"
            >
              ← 返回登入
            </router-link>
          </div>
        </form>
      </div>

      <!-- 提示訊息 -->
      <div class="text-center text-sm text-gray-600">
        <p>沒有收到郵件？</p>
        <ul class="mt-2 space-y-1 text-xs">
          <li>• 請檢查垃圾郵件資料夾</li>
          <li>• 確認 Email 地址是否正確</li>
          <li>• 等待幾分鐘後再嘗試</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue";
import { useRouter } from "vue-router";

const _router = useRouter();

const form = reactive({
  email: "",
});

const errors = reactive({
  email: "",
});

const error = ref("");
const success = ref(false);
const successMessage = ref("");
const isLoading = ref(false);

const validateForm = () => {
  errors.email = "";
  let isValid = true;

  // Email 驗證
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!form.email) {
    errors.email = "請輸入 Email 地址";
    isValid = false;
  } else if (!emailRegex.test(form.email)) {
    errors.email = "請輸入有效的 Email 地址";
    isValid = false;
  }

  return isValid;
};

const handleSubmit = async () => {
  error.value = "";

  if (!validateForm()) {
    return;
  }

  isLoading.value = true;

  try {
    const response = await fetch("/api/v1/auth/forgot-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        identifier: form.email,
        method: "email",
      }),
    });

    const data = await response.json();

    if (data.success) {
      success.value = true;
      successMessage.value = data.message || "重設連結已發送至您的 Email";
    } else {
      error.value = data.error || "發送重設連結失敗，請稍後再試";
    }
  } catch (err) {
    console.error("Forgot password error:", err);
    error.value = "網路錯誤，請檢查您的網路連線";
  } finally {
    isLoading.value = false;
  }
};
</script>

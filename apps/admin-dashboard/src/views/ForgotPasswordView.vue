<template>
  <div
    class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8"
  >
    <div class="max-w-md w-full space-y-8">
      <!-- Header -->
      <div class="text-center">
        <div
          class="mx-auto w-16 h-16 bg-primary-600 rounded-xl flex items-center justify-center mb-4"
        >
          <span class="text-white font-bold text-2xl">M</span>
        </div>
        <h2 class="text-3xl font-bold text-gray-900">MakanMakan</h2>
        <p class="mt-2 text-sm text-gray-600">管理後台 - 忘記密碼</p>
      </div>

      <!-- Success State -->
      <div v-if="success" class="mt-8 space-y-6">
        <div class="bg-green-50 border border-green-200 rounded-lg p-6">
          <div class="flex items-start">
            <div
              class="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center"
            >
              <CheckCircle class="w-6 h-6 text-green-600" />
            </div>
            <div class="ml-4 flex-1">
              <h3 class="text-lg font-medium text-green-900">郵件已發送</h3>
              <p class="mt-2 text-sm text-green-700">
                {{ successMessage }}
              </p>
              <p class="mt-3 text-sm text-green-600">
                請檢查您的電子郵件收件箱，並點擊重設密碼連結。如果您沒有收到郵件，請檢查垃圾郵件資料夾。
              </p>
            </div>
          </div>
        </div>

        <div class="text-center">
          <router-link
            to="/login"
            class="text-sm font-medium text-primary-600 hover:text-primary-500"
          >
            ← 返回登入頁面
          </router-link>
        </div>
      </div>

      <!-- Form State -->
      <form v-else class="mt-8 space-y-6" @submit.prevent="handleSubmit">
        <div class="space-y-4">
          <!-- Instructions -->
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div class="flex items-start">
              <Info class="w-5 h-5 text-blue-400 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p class="text-sm text-blue-800">
                  請輸入您註冊時使用的電子郵件地址。我們將向您發送密碼重設連結。
                </p>
              </div>
            </div>
          </div>

          <!-- Email Input -->
          <div>
            <label for="email" class="form-label">電子郵件</label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              required
              autocomplete="email"
              class="form-input"
              :class="{ 'border-red-500': emailError }"
              placeholder="請輸入電子郵件地址"
              :disabled="isLoading"
            />
            <p v-if="emailError" class="mt-1 text-sm text-red-600">
              {{ emailError }}
            </p>
          </div>
        </div>

        <!-- Error Message -->
        <div
          v-if="error"
          class="bg-red-50 border border-red-200 rounded-lg p-4"
        >
          <div class="flex items-center">
            <AlertCircle class="w-5 h-5 text-red-400 mr-2" />
            <p class="text-sm text-red-800">
              {{ error }}
            </p>
          </div>
        </div>

        <!-- Submit Button -->
        <div class="space-y-4">
          <button
            type="submit"
            :disabled="isLoading"
            class="w-full btn-primary"
            :class="{ 'opacity-50 cursor-not-allowed': isLoading }"
          >
            <span v-if="isLoading" class="flex items-center justify-center">
              <div
                class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"
              />
              發送中...
            </span>
            <span v-else>發送重設密碼郵件</span>
          </button>

          <!-- Back to Login -->
          <div class="text-center">
            <router-link
              to="/login"
              class="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              ← 返回登入頁面
            </router-link>
          </div>
        </div>
      </form>

      <!-- Footer -->
      <div class="text-center">
        <p class="text-xs text-gray-500">
          © 2025 MakanMakan. All rights reserved.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue";
import { CheckCircle, AlertCircle, Info } from "lucide-vue-next";

const isLoading = ref(false);
const success = ref(false);
const error = ref("");
const emailError = ref("");
const successMessage = ref("");

const form = reactive({
  email: "",
});

const validateForm = () => {
  emailError.value = "";

  if (!form.email.trim()) {
    emailError.value = "請輸入電子郵件地址";
    return false;
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(form.email)) {
    emailError.value = "請輸入有效的電子郵件格式";
    return false;
  }

  return true;
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
      successMessage.value = data.message || "密碼重設郵件已發送";
    } else {
      error.value = data.error || "發送失敗，請稍後再試";
    }
  } catch (err) {
    console.error("Forgot password error:", err);
    error.value = "網路錯誤，請檢查您的網路連線";
  } finally {
    isLoading.value = false;
  }
};
</script>

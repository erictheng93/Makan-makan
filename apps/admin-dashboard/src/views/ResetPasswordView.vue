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
        <p class="mt-2 text-sm text-gray-600">管理後台 - 重設密碼</p>
      </div>

      <!-- Verifying Token -->
      <div v-if="verifying" class="mt-8 space-y-6">
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div class="flex items-center justify-center">
            <div
              class="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"
            />
            <p class="ml-3 text-sm text-blue-800">正在驗證重設連結...</p>
          </div>
        </div>
      </div>

      <!-- Token Error -->
      <div v-else-if="tokenError" class="mt-8 space-y-6">
        <div class="bg-red-50 border border-red-200 rounded-lg p-6">
          <div class="flex items-start">
            <div
              class="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center"
            >
              <AlertCircle class="w-6 h-6 text-red-600" />
            </div>
            <div class="ml-4 flex-1">
              <h3 class="text-lg font-medium text-red-900">連結無效或已過期</h3>
              <p class="mt-2 text-sm text-red-700">
                {{ tokenError }}
              </p>
              <p class="mt-3 text-sm text-red-600">
                請重新請求密碼重設郵件，或聯絡系統管理員以獲得協助。
              </p>
            </div>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row gap-3">
          <router-link
            to="/forgot-password"
            class="flex-1 btn-primary text-center"
          >
            重新發送重設郵件
          </router-link>
          <router-link
            to="/login"
            class="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 text-center"
          >
            返回登入
          </router-link>
        </div>
      </div>

      <!-- Success State -->
      <div v-else-if="success" class="mt-8 space-y-6">
        <div class="bg-green-50 border border-green-200 rounded-lg p-6">
          <div class="flex items-start">
            <div
              class="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center"
            >
              <CheckCircle class="w-6 h-6 text-green-600" />
            </div>
            <div class="ml-4 flex-1">
              <h3 class="text-lg font-medium text-green-900">密碼重設成功</h3>
              <p class="mt-2 text-sm text-green-700">
                {{ successMessage }}
              </p>
              <p class="mt-3 text-sm text-green-600">
                現在您可以使用新密碼登入系統了。
              </p>
            </div>
          </div>
        </div>

        <div class="text-center">
          <router-link to="/login" class="w-full btn-primary inline-block">
            前往登入頁面
          </router-link>
        </div>
      </div>

      <!-- Reset Password Form -->
      <form v-else class="mt-8 space-y-6" @submit.prevent="handleSubmit">
        <!-- User Info -->
        <div v-if="maskedEmail" class="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div class="flex items-center">
            <div
              class="flex-shrink-0 w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center"
            >
              <User class="w-5 h-5 text-gray-600" />
            </div>
            <div class="ml-3">
              <p class="text-xs text-gray-500">重設密碼的帳號</p>
              <p class="text-sm font-medium text-gray-900">{{ maskedEmail }}</p>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <!-- New Password -->
          <div>
            <label for="new-password" class="form-label">新密碼</label>
            <div class="relative">
              <input
                id="new-password"
                v-model="form.newPassword"
                :type="showPassword ? 'text' : 'password'"
                required
                autocomplete="new-password"
                class="form-input pr-10"
                :class="{ 'border-red-500': errors.newPassword }"
                placeholder="請輸入新密碼（至少6個字符）"
                :disabled="isLoading"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 pr-3 flex items-center"
                tabindex="-1"
                @click="showPassword = !showPassword"
              >
                <Eye v-if="showPassword" class="w-4 h-4 text-gray-400" />
                <EyeOff v-else class="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <p v-if="errors.newPassword" class="mt-1 text-sm text-red-600">
              {{ errors.newPassword }}
            </p>

            <!-- Password Strength Indicator -->
            <div v-if="form.newPassword" class="mt-2">
              <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-gray-600">密碼強度：</span>
                <span
                  class="text-xs font-medium"
                  :class="passwordStrengthTextColor"
                >
                  {{ passwordStrengthText }}
                </span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div
                  class="h-2 rounded-full transition-all duration-300"
                  :class="passwordStrengthColor"
                  :style="{ width: `${(passwordStrength / 5) * 100}%` }"
                />
              </div>
              <ul class="mt-2 space-y-1">
                <li
                  class="text-xs flex items-center"
                  :class="
                    form.newPassword.length >= 6
                      ? 'text-green-600'
                      : 'text-gray-500'
                  "
                >
                  <Check
                    v-if="form.newPassword.length >= 6"
                    class="w-3 h-3 mr-1"
                  />
                  <X v-else class="w-3 h-3 mr-1" />
                  至少6個字符
                </li>
                <li
                  class="text-xs flex items-center"
                  :class="
                    form.newPassword.length >= 8
                      ? 'text-green-600'
                      : 'text-gray-500'
                  "
                >
                  <Check
                    v-if="form.newPassword.length >= 8"
                    class="w-3 h-3 mr-1"
                  />
                  <X v-else class="w-3 h-3 mr-1" />
                  至少8個字符（建議）
                </li>
                <li
                  class="text-xs flex items-center"
                  :class="
                    /[a-z]/.test(form.newPassword) &&
                    /[A-Z]/.test(form.newPassword)
                      ? 'text-green-600'
                      : 'text-gray-500'
                  "
                >
                  <Check
                    v-if="
                      /[a-z]/.test(form.newPassword) &&
                      /[A-Z]/.test(form.newPassword)
                    "
                    class="w-3 h-3 mr-1"
                  />
                  <X v-else class="w-3 h-3 mr-1" />
                  包含大小寫字母
                </li>
                <li
                  class="text-xs flex items-center"
                  :class="
                    /\d/.test(form.newPassword)
                      ? 'text-green-600'
                      : 'text-gray-500'
                  "
                >
                  <Check
                    v-if="/\d/.test(form.newPassword)"
                    class="w-3 h-3 mr-1"
                  />
                  <X v-else class="w-3 h-3 mr-1" />
                  包含數字
                </li>
                <li
                  class="text-xs flex items-center"
                  :class="
                    /[^a-zA-Z0-9]/.test(form.newPassword)
                      ? 'text-green-600'
                      : 'text-gray-500'
                  "
                >
                  <Check
                    v-if="/[^a-zA-Z0-9]/.test(form.newPassword)"
                    class="w-3 h-3 mr-1"
                  />
                  <X v-else class="w-3 h-3 mr-1" />
                  包含特殊字符（建議）
                </li>
              </ul>
            </div>
          </div>

          <!-- Confirm Password -->
          <div>
            <label for="confirm-password" class="form-label">確認密碼</label>
            <div class="relative">
              <input
                id="confirm-password"
                v-model="form.confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                required
                autocomplete="new-password"
                class="form-input pr-10"
                :class="{ 'border-red-500': errors.confirmPassword }"
                placeholder="請再次輸入新密碼"
                :disabled="isLoading"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 pr-3 flex items-center"
                tabindex="-1"
                @click="showConfirmPassword = !showConfirmPassword"
              >
                <Eye v-if="showConfirmPassword" class="w-4 h-4 text-gray-400" />
                <EyeOff v-else class="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <p v-if="errors.confirmPassword" class="mt-1 text-sm text-red-600">
              {{ errors.confirmPassword }}
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
        <div>
          <button
            type="submit"
            :disabled="isLoading || passwordStrength < 1"
            class="w-full btn-primary"
            :class="{
              'opacity-50 cursor-not-allowed':
                isLoading || passwordStrength < 1,
            }"
          >
            <span v-if="isLoading" class="flex items-center justify-center">
              <div
                class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"
              />
              重設中...
            </span>
            <span v-else>重設密碼</span>
          </button>
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
import { ref, reactive, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  User,
  Check,
  X,
} from "lucide-vue-next";

const route = useRoute();
const router = useRouter();

const verifying = ref(true);
const tokenError = ref("");
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const isLoading = ref(false);
const success = ref(false);
const error = ref("");
const maskedEmail = ref("");
const successMessage = ref("");
const token = ref("");

const form = reactive({
  newPassword: "",
  confirmPassword: "",
});

const errors = reactive({
  newPassword: "",
  confirmPassword: "",
});

// Password strength calculation
const passwordStrength = computed(() => {
  const password = form.newPassword;
  let strength = 0;

  if (password.length >= 6) strength++;
  if (password.length >= 8) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;

  return strength;
});

const passwordStrengthText = computed(() => {
  const strength = passwordStrength.value;
  if (strength <= 1) return "弱";
  if (strength <= 2) return "中等";
  if (strength <= 3) return "良好";
  if (strength <= 4) return "強";
  return "非常強";
});

const passwordStrengthColor = computed(() => {
  const strength = passwordStrength.value;
  if (strength <= 1) return "bg-red-500";
  if (strength <= 2) return "bg-orange-500";
  if (strength <= 3) return "bg-yellow-500";
  if (strength <= 4) return "bg-blue-500";
  return "bg-green-500";
});

const passwordStrengthTextColor = computed(() => {
  const strength = passwordStrength.value;
  if (strength <= 1) return "text-red-600";
  if (strength <= 2) return "text-orange-600";
  if (strength <= 3) return "text-yellow-600";
  if (strength <= 4) return "text-blue-600";
  return "text-green-600";
});

const verifyToken = async () => {
  try {
    const response = await fetch(
      `/api/v1/auth/reset-password/verify?token=${token.value}`,
    );
    const data = await response.json();

    if (data.valid) {
      maskedEmail.value = data.email || "";
    } else {
      tokenError.value = data.error || "Token 無效或已過期";
    }
  } catch (err) {
    console.error("Token verification error:", err);
    tokenError.value = "驗證 Token 時發生錯誤";
  } finally {
    verifying.value = false;
  }
};

const validateForm = () => {
  errors.newPassword = "";
  errors.confirmPassword = "";

  if (!form.newPassword) {
    errors.newPassword = "請輸入新密碼";
    return false;
  }

  if (form.newPassword.length < 6) {
    errors.newPassword = "密碼至少需要6個字符";
    return false;
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = "請確認密碼";
    return false;
  }

  if (form.newPassword !== form.confirmPassword) {
    errors.confirmPassword = "兩次輸入的密碼不一致";
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
    const response = await fetch("/api/v1/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: token.value,
        newPassword: form.newPassword,
        confirmPassword: form.confirmPassword,
      }),
    });

    const data = await response.json();

    if (data.success) {
      success.value = true;
      successMessage.value = data.message || "密碼已成功重設";

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } else {
      error.value = data.error || "重設密碼失敗，請重試";
    }
  } catch (err) {
    console.error("Reset password error:", err);
    error.value = "網路錯誤，請檢查您的網路連線";
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  const tokenParam = route.query.token as string;

  if (!tokenParam) {
    tokenError.value = "缺少重設 Token";
    verifying.value = false;
    return;
  }

  token.value = tokenParam;
  verifyToken();
});
</script>

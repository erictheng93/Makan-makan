<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useOnboardingStore } from '@/stores/onboarding'
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon
} from '@heroicons/vue/24/outline'

const router = useRouter()
const toast = useToast()
const store = useOnboardingStore()

const form = ref({
  businessName: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  planId: 'standard' as 'standard' | 'professional' | 'enterprise',
  subdomain: ''
})

const errors = ref<Record<string, string>>({})

// Debounce timer for subdomain check
let subdomainCheckTimer: ReturnType<typeof setTimeout> | null = null

const plans = [
  { value: 'standard', label: '標準版 - $149/月' },
  { value: 'professional', label: '專業版 - $299/月' },
  { value: 'enterprise', label: '企業版 - 議價' }
]

// Watch subdomain input for debounced availability check
watch(() => form.value.subdomain, (newValue) => {
  // Clear previous timer
  if (subdomainCheckTimer) {
    clearTimeout(subdomainCheckTimer)
  }

  // Reset status if empty
  if (!newValue) {
    store.subdomainStatus = null
    return
  }

  // Validate format first
  if (!/^[a-z0-9-]*$/.test(newValue)) {
    store.subdomainStatus = 'invalid'
    return
  }

  // Debounce the API call (300ms)
  subdomainCheckTimer = setTimeout(async () => {
    if (newValue.length >= 3) {
      await store.checkSubdomain(newValue)
    } else {
      store.subdomainStatus = null
    }
  }, 300)
})

const validate = (): boolean => {
  errors.value = {}

  if (!form.value.businessName.trim()) {
    errors.value.businessName = '請輸入餐廳名稱'
  }

  if (!form.value.contactName.trim()) {
    errors.value.contactName = '請輸入聯絡人姓名'
  }

  if (!form.value.contactEmail.trim()) {
    errors.value.contactEmail = '請輸入 Email'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.contactEmail)) {
    errors.value.contactEmail = '請輸入有效的 Email'
  }

  if (!form.value.contactPhone.trim()) {
    errors.value.contactPhone = '請輸入聯絡電話'
  }

  if (form.value.subdomain) {
    if (!/^[a-z0-9-]+$/.test(form.value.subdomain)) {
      errors.value.subdomain = '只能包含小寫字母、數字和連字符'
    } else if (form.value.subdomain.length < 3) {
      errors.value.subdomain = '至少需要 3 個字元'
    } else if (store.subdomainStatus === 'taken') {
      errors.value.subdomain = '此網址已被使用'
    }
  }

  return Object.keys(errors.value).length === 0
}

const handleSubmit = async () => {
  if (!validate()) return

  store.clearError()

  const success = await store.submitApplication({
    businessName: form.value.businessName,
    contactName: form.value.contactName,
    contactEmail: form.value.contactEmail,
    contactPhone: form.value.contactPhone,
    planId: form.value.planId,
    subdomain: form.value.subdomain || undefined
  })

  if (success) {
    toast.success('申請資料已提交')
    router.push('/connect')
  } else {
    toast.error(store.apiError || '提交失敗，請稍後再試')
  }
}

const selectSuggestion = (suggestion: string) => {
  form.value.subdomain = suggestion
}
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <!-- Progress -->
    <div class="flex items-center justify-center mb-8">
      <div class="flex items-center">
        <div class="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-medium">
          1
        </div>
        <div class="w-24 h-1 bg-gray-200">
          <div class="w-0 h-full bg-primary-600" />
        </div>
        <div class="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-medium">
          2
        </div>
        <div class="w-24 h-1 bg-gray-200" />
        <div class="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-medium">
          3
        </div>
      </div>
    </div>

    <div class="card">
      <h1 class="text-2xl font-bold text-gray-900 mb-6">填寫申請資料</h1>

      <!-- API Error Alert -->
      <div v-if="store.apiError" class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
        <p class="text-sm text-red-700">{{ store.apiError }}</p>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-6">
        <!-- 餐廳名稱 -->
        <div>
          <label class="label">餐廳名稱 *</label>
          <input
            v-model="form.businessName"
            type="text"
            class="input"
            :class="{ 'input-error': errors.businessName }"
            placeholder="例如：御膳房"
          />
          <p v-if="errors.businessName" class="mt-1 text-sm text-red-600">
            {{ errors.businessName }}
          </p>
        </div>

        <!-- 聯絡人姓名 -->
        <div>
          <label class="label">聯絡人姓名 *</label>
          <input
            v-model="form.contactName"
            type="text"
            class="input"
            :class="{ 'input-error': errors.contactName }"
            placeholder="您的姓名"
          />
          <p v-if="errors.contactName" class="mt-1 text-sm text-red-600">
            {{ errors.contactName }}
          </p>
        </div>

        <!-- Email -->
        <div>
          <label class="label">Email *</label>
          <input
            v-model="form.contactEmail"
            type="email"
            class="input"
            :class="{ 'input-error': errors.contactEmail }"
            placeholder="your@email.com"
          />
          <p v-if="errors.contactEmail" class="mt-1 text-sm text-red-600">
            {{ errors.contactEmail }}
          </p>
        </div>

        <!-- 電話 -->
        <div>
          <label class="label">聯絡電話 *</label>
          <input
            v-model="form.contactPhone"
            type="tel"
            class="input"
            :class="{ 'input-error': errors.contactPhone }"
            placeholder="02-1234-5678"
          />
          <p v-if="errors.contactPhone" class="mt-1 text-sm text-red-600">
            {{ errors.contactPhone }}
          </p>
        </div>

        <!-- 方案選擇 -->
        <div>
          <label class="label">選擇方案</label>
          <select v-model="form.planId" class="input">
            <option v-for="plan in plans" :key="plan.value" :value="plan.value">
              {{ plan.label }}
            </option>
          </select>
        </div>

        <!-- 子域名 -->
        <div>
          <label class="label">期望的網址 (選填)</label>
          <div class="flex">
            <div class="relative flex-1">
              <input
                v-model="form.subdomain"
                type="text"
                class="input rounded-r-none pr-10"
                :class="{
                  'input-error': errors.subdomain || store.subdomainStatus === 'taken',
                  'border-green-500 focus:border-green-500 focus:ring-green-500': store.subdomainStatus === 'available'
                }"
                placeholder="yourrestaurant"
              />
              <!-- Status indicator -->
              <div class="absolute inset-y-0 right-0 flex items-center pr-3">
                <ArrowPathIcon
                  v-if="store.isCheckingSubdomain"
                  class="h-5 w-5 text-gray-400 animate-spin"
                />
                <CheckCircleIcon
                  v-else-if="store.subdomainStatus === 'available'"
                  class="h-5 w-5 text-green-500"
                />
                <XCircleIcon
                  v-else-if="store.subdomainStatus === 'taken' || store.subdomainStatus === 'invalid'"
                  class="h-5 w-5 text-red-500"
                />
              </div>
            </div>
            <span class="inline-flex items-center px-3 border border-l-0 border-gray-300 bg-gray-50 text-gray-500 text-sm rounded-r-md">
              .makanmakan.app
            </span>
          </div>

          <!-- Subdomain status message -->
          <div class="mt-1">
            <p v-if="errors.subdomain" class="text-sm text-red-600">
              {{ errors.subdomain }}
            </p>
            <p v-else-if="store.subdomainStatus === 'available'" class="text-sm text-green-600">
              此網址可以使用
            </p>
            <p v-else-if="store.subdomainStatus === 'taken'" class="text-sm text-red-600">
              此網址已被使用
            </p>
            <p v-else-if="store.subdomainStatus === 'invalid'" class="text-sm text-red-600">
              只能包含小寫字母、數字和連字符
            </p>
            <p v-else class="text-xs text-gray-500">
              留空將自動生成
            </p>
          </div>

          <!-- Subdomain suggestions -->
          <div v-if="store.subdomainStatus === 'taken' && store.subdomainSuggestions.length > 0" class="mt-2">
            <p class="text-xs text-gray-600 mb-1">建議的替代網址：</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="suggestion in store.subdomainSuggestions"
                :key="suggestion"
                type="button"
                class="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700 transition-colors"
                @click="selectSuggestion(suggestion)"
              >
                {{ suggestion }}.makanmakan.app
              </button>
            </div>
          </div>
        </div>

        <!-- 提交按鈕 -->
        <div class="flex justify-between pt-4">
          <button
            type="button"
            class="btn btn-secondary"
            @click="router.push('/')"
          >
            返回
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            :disabled="store.isLoading || store.isCheckingSubdomain"
          >
            <ArrowPathIcon v-if="store.isLoading" class="h-4 w-4 mr-2 animate-spin" />
            {{ store.isLoading ? '提交中...' : '下一步' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useOnboardingStore } from '@/stores/onboarding'

const router = useRouter()
const toast = useToast()
const store = useOnboardingStore()

const form = ref({
  businessName: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  planId: 'standard',
  subdomain: ''
})

const errors = ref<Record<string, string>>({})
const submitting = ref(false)

const plans = [
  { value: 'standard', label: '標準版 - $149/月' },
  { value: 'professional', label: '專業版 - $299/月' },
  { value: 'enterprise', label: '企業版 - 議價' }
]

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

  if (form.value.subdomain && !/^[a-z0-9-]+$/.test(form.value.subdomain)) {
    errors.value.subdomain = '只能包含小寫字母、數字和連字符'
  }

  return Object.keys(errors.value).length === 0
}

const handleSubmit = async () => {
  if (!validate()) return

  submitting.value = true
  try {
    // 儲存申請資料
    store.setApplication({
      ...form.value,
      status: 'pending'
    })

    toast.success('申請資料已提交')
    router.push('/connect')
  } catch (e) {
    toast.error('提交失敗，請稍後再試')
  } finally {
    submitting.value = false
  }
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
            <input
              v-model="form.subdomain"
              type="text"
              class="input rounded-r-none"
              :class="{ 'input-error': errors.subdomain }"
              placeholder="yourrestaurant"
            />
            <span class="inline-flex items-center px-3 border border-l-0 border-gray-300 bg-gray-50 text-gray-500 text-sm rounded-r-md">
              .makanmakan.app
            </span>
          </div>
          <p v-if="errors.subdomain" class="mt-1 text-sm text-red-600">
            {{ errors.subdomain }}
          </p>
          <p class="mt-1 text-xs text-gray-500">留空將自動生成</p>
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
            :disabled="submitting"
          >
            {{ submitting ? '提交中...' : '下一步' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

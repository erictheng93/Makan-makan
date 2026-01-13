<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useOnboardingStore } from '@/stores/onboarding'
import {
  InformationCircleIcon,
  ClipboardDocumentIcon,
  CheckCircleIcon
} from '@heroicons/vue/24/outline'

const router = useRouter()
const toast = useToast()
const store = useOnboardingStore()

const form = ref({
  accountId: '',
  apiToken: ''
})

const errors = ref<Record<string, string>>({})
const verifying = ref(false)
const verified = ref(false)

// 檢查是否有申請資料
if (!store.application) {
  router.push('/apply')
}

const validate = (): boolean => {
  errors.value = {}

  if (!form.value.accountId.trim()) {
    errors.value.accountId = '請輸入 Account ID'
  }

  if (!form.value.apiToken.trim()) {
    errors.value.apiToken = '請輸入 API Token'
  }

  return Object.keys(errors.value).length === 0
}

const handleVerify = async () => {
  if (!validate()) return

  verifying.value = true
  try {
    // 模擬驗證 API 呼叫
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 儲存 Cloudflare 資訊
    store.setCloudflareInfo(form.value)
    verified.value = true
    toast.success('Cloudflare 帳號驗證成功！')
  } catch (e) {
    toast.error('驗證失敗，請檢查您的資訊')
  } finally {
    verifying.value = false
  }
}

const handleComplete = async () => {
  // 提交最終申請
  try {
    // 模擬 API 呼叫
    await new Promise(resolve => setTimeout(resolve, 1000))
    router.push('/success')
  } catch (e) {
    toast.error('提交失敗，請稍後再試')
  }
}

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text)
  toast.success('已複製到剪貼簿')
}
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <!-- Progress -->
    <div class="flex items-center justify-center mb-8">
      <div class="flex items-center">
        <div class="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-medium">
          ✓
        </div>
        <div class="w-24 h-1 bg-primary-600" />
        <div class="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-medium">
          2
        </div>
        <div class="w-24 h-1 bg-gray-200">
          <div :class="verified ? 'w-full' : 'w-0'" class="h-full bg-primary-600 transition-all" />
        </div>
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center font-medium"
          :class="verified ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'"
        >
          3
        </div>
      </div>
    </div>

    <div class="card">
      <h1 class="text-2xl font-bold text-gray-900 mb-6">連接 Cloudflare 帳號</h1>

      <!-- 說明 -->
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div class="flex">
          <InformationCircleIcon class="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div class="ml-3">
            <h3 class="text-sm font-medium text-blue-800">為什麼需要 Cloudflare 帳號？</h3>
            <p class="mt-1 text-sm text-blue-700">
              MakanMakan 獨立部署使用您自己的 Cloudflare 帳號來運行，
              這確保您對所有資料擁有完整控制權。資源費用已包含在訂閱費中。
            </p>
          </div>
        </div>
      </div>

      <!-- 步驟指引 -->
      <div class="space-y-4 mb-6">
        <h3 class="font-medium text-gray-900">操作步驟：</h3>
        <ol class="list-decimal list-inside space-y-2 text-gray-600">
          <li>
            前往 <a href="https://dash.cloudflare.com" target="_blank" class="text-primary-600 hover:underline">Cloudflare Dashboard</a>
            （如果沒有帳號，請先註冊）
          </li>
          <li>點擊右上角的頭像 → 選擇「My Profile」</li>
          <li>
            複製您的 <strong>Account ID</strong>
            <button
              type="button"
              class="ml-2 text-gray-400 hover:text-gray-600"
              @click="copyToClipboard('Account ID 位於 Dashboard 右側欄')"
            >
              <ClipboardDocumentIcon class="h-4 w-4 inline" />
            </button>
          </li>
          <li>前往「API Tokens」→ 點擊「Create Token」</li>
          <li>選擇「Edit Cloudflare Workers」模板</li>
          <li>複製生成的 API Token</li>
        </ol>
      </div>

      <!-- 表單 -->
      <form @submit.prevent="handleVerify" class="space-y-6">
        <!-- Account ID -->
        <div>
          <label class="label">Cloudflare Account ID *</label>
          <input
            v-model="form.accountId"
            type="text"
            class="input font-mono"
            :class="{ 'input-error': errors.accountId }"
            placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            :disabled="verified"
          />
          <p v-if="errors.accountId" class="mt-1 text-sm text-red-600">
            {{ errors.accountId }}
          </p>
        </div>

        <!-- API Token -->
        <div>
          <label class="label">API Token *</label>
          <input
            v-model="form.apiToken"
            type="password"
            class="input font-mono"
            :class="{ 'input-error': errors.apiToken }"
            placeholder="••••••••••••••••••••••••••••••••"
            :disabled="verified"
          />
          <p v-if="errors.apiToken" class="mt-1 text-sm text-red-600">
            {{ errors.apiToken }}
          </p>
        </div>

        <!-- 驗證成功提示 -->
        <div v-if="verified" class="flex items-center p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircleIcon class="h-5 w-5 text-green-500" />
          <span class="ml-2 text-green-700">Cloudflare 帳號已成功連接！</span>
        </div>

        <!-- 按鈕 -->
        <div class="flex justify-between pt-4">
          <button
            type="button"
            class="btn btn-secondary"
            @click="router.push('/apply')"
          >
            返回
          </button>
          <button
            v-if="!verified"
            type="submit"
            class="btn btn-primary"
            :disabled="verifying"
          >
            {{ verifying ? '驗證中...' : '驗證連接' }}
          </button>
          <button
            v-else
            type="button"
            class="btn btn-primary"
            @click="handleComplete"
          >
            完成申請
          </button>
        </div>
      </form>
    </div>

    <!-- 需要協助？ -->
    <div class="mt-6 text-center text-sm text-gray-500">
      需要協助？
      <a href="mailto:support@makanmakan.app" class="text-primary-600 hover:underline">
        聯繫我們安排視訊輔導
      </a>
    </div>
  </div>
</template>

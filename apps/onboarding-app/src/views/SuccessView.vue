<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useOnboardingStore } from '@/stores/onboarding'
import {
  CheckCircleIcon,
  EnvelopeIcon,
  ClockIcon,
  RocketLaunchIcon,
  DocumentDuplicateIcon
} from '@heroicons/vue/24/outline'
import { useToast } from 'vue-toastification'

const router = useRouter()
const toast = useToast()
const store = useOnboardingStore()

// Redirect if no completion data
onMounted(() => {
  if (!store.completionResult) {
    router.push('/apply')
  }
})

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text)
  toast.success('已複製到剪貼簿')
}

const getPlanLabel = (planId: string) => {
  switch (planId) {
    case 'professional':
      return '專業版'
    case 'enterprise':
      return '企業版'
    default:
      return '標準版'
  }
}

const handleStartNew = () => {
  store.reset()
  router.push('/')
}
</script>

<template>
  <div class="max-w-2xl mx-auto text-center">
    <!-- Progress -->
    <div class="flex items-center justify-center mb-8">
      <div class="flex items-center">
        <div class="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-medium">
          ✓
        </div>
        <div class="w-24 h-1 bg-primary-600" />
        <div class="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-medium">
          ✓
        </div>
        <div class="w-24 h-1 bg-primary-600" />
        <div class="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-medium">
          ✓
        </div>
      </div>
    </div>

    <!-- Success Message -->
    <div class="card">
      <div class="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
        <CheckCircleIcon class="h-10 w-10 text-green-600" />
      </div>

      <h1 class="text-2xl font-bold text-gray-900 mb-2">申請已完成！</h1>
      <p class="text-gray-600 mb-8">
        恭喜您！您的 MakanMakan 獨立部署已建立完成。<br />
        系統正在為您準備專屬環境。
      </p>

      <!-- 申請摘要 -->
      <div class="bg-gray-50 rounded-lg p-6 text-left mb-8">
        <h3 class="font-medium text-gray-900 mb-4">申請摘要</h3>
        <dl class="space-y-3 text-sm">
          <div class="flex justify-between items-center">
            <dt class="text-gray-500">申請編號</dt>
            <dd class="text-gray-900 font-mono text-xs flex items-center">
              {{ store.applicationId || '-' }}
              <button
                v-if="store.applicationId"
                type="button"
                class="ml-2 text-gray-400 hover:text-gray-600"
                @click="copyToClipboard(store.applicationId!)"
              >
                <DocumentDuplicateIcon class="h-4 w-4" />
              </button>
            </dd>
          </div>
          <div class="flex justify-between items-center">
            <dt class="text-gray-500">租戶編號</dt>
            <dd class="text-gray-900 font-mono text-xs flex items-center">
              {{ store.completionResult?.tenantId || '-' }}
              <button
                v-if="store.completionResult?.tenantId"
                type="button"
                class="ml-2 text-gray-400 hover:text-gray-600"
                @click="copyToClipboard(store.completionResult!.tenantId)"
              >
                <DocumentDuplicateIcon class="h-4 w-4" />
              </button>
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-gray-500">餐廳名稱</dt>
            <dd class="text-gray-900 font-medium">{{ store.application?.businessName || '-' }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-gray-500">聯絡 Email</dt>
            <dd class="text-gray-900">{{ store.application?.contactEmail || '-' }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-gray-500">選擇方案</dt>
            <dd class="text-gray-900">
              {{ getPlanLabel(store.application?.planId || 'standard') }}
            </dd>
          </div>
          <div class="flex justify-between items-center">
            <dt class="text-gray-500">專屬網址</dt>
            <dd class="text-primary-600 font-medium flex items-center">
              <a
                :href="`https://${store.completionResult?.subdomain || store.assignedSubdomain}.makanmakan.app`"
                target="_blank"
                class="hover:underline"
              >
                {{ store.completionResult?.subdomain || store.assignedSubdomain }}.makanmakan.app
              </a>
              <button
                v-if="store.completionResult?.subdomain || store.assignedSubdomain"
                type="button"
                class="ml-2 text-gray-400 hover:text-gray-600"
                @click="copyToClipboard(`https://${store.completionResult?.subdomain || store.assignedSubdomain}.makanmakan.app`)"
              >
                <DocumentDuplicateIcon class="h-4 w-4" />
              </button>
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-gray-500">Cloudflare 帳號</dt>
            <dd class="text-green-600 font-medium">
              已連接 ✓
            </dd>
          </div>
        </dl>
      </div>

      <!-- 接下來 -->
      <div class="space-y-4 text-left">
        <h3 class="font-medium text-gray-900">接下來會發生什麼？</h3>
        <div class="space-y-4">
          <div class="flex items-start">
            <div class="flex-shrink-0 p-2 bg-primary-100 rounded-lg">
              <EnvelopeIcon class="h-5 w-5 text-primary-600" />
            </div>
            <div class="ml-4">
              <p class="font-medium text-gray-900">確認郵件</p>
              <p class="text-sm text-gray-500">
                我們已發送確認郵件至 <span class="font-medium">{{ store.application?.contactEmail }}</span>，請查收。
              </p>
            </div>
          </div>
          <div class="flex items-start">
            <div class="flex-shrink-0 p-2 bg-primary-100 rounded-lg">
              <ClockIcon class="h-5 w-5 text-primary-600" />
            </div>
            <div class="ml-4">
              <p class="font-medium text-gray-900">系統部署</p>
              <p class="text-sm text-gray-500">
                您的專屬系統正在部署中，通常在幾分鐘內完成。完成後會發送登入資訊。
              </p>
            </div>
          </div>
          <div class="flex items-start">
            <div class="flex-shrink-0 p-2 bg-primary-100 rounded-lg">
              <RocketLaunchIcon class="h-5 w-5 text-primary-600" />
            </div>
            <div class="ml-4">
              <p class="font-medium text-gray-900">開始使用</p>
              <p class="text-sm text-gray-500">
                收到登入資訊後，您可以立即登入管理後台開始設定您的餐廳。
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- 按鈕 -->
      <div class="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
        <a
          :href="`https://${store.completionResult?.subdomain || store.assignedSubdomain}.makanmakan.app/admin`"
          target="_blank"
          class="btn btn-primary"
        >
          前往管理後台
        </a>
        <button
          type="button"
          class="btn btn-secondary"
          @click="handleStartNew"
        >
          返回首頁
        </button>
      </div>
    </div>

    <!-- 聯絡資訊 -->
    <div class="mt-6 text-sm text-gray-500">
      有任何問題？請聯繫
      <a href="mailto:support@makanmakan.app" class="text-primary-600 hover:underline">
        support@makanmakan.app
      </a>
    </div>
  </div>
</template>

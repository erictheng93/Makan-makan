<script setup lang="ts">
import { useOnboardingStore } from '@/stores/onboarding'
import { CheckCircleIcon, EnvelopeIcon, ClockIcon } from '@heroicons/vue/24/outline'

const store = useOnboardingStore()
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

      <h1 class="text-2xl font-bold text-gray-900 mb-2">申請已提交！</h1>
      <p class="text-gray-600 mb-8">
        感謝您選擇 MakanMakan 獨立部署方案。<br />
        我們已收到您的申請，將盡快為您處理。
      </p>

      <!-- 申請摘要 -->
      <div class="bg-gray-50 rounded-lg p-6 text-left mb-8">
        <h3 class="font-medium text-gray-900 mb-4">申請摘要</h3>
        <dl class="space-y-3 text-sm">
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
              {{ store.application?.planId === 'professional' ? '專業版' :
                 store.application?.planId === 'enterprise' ? '企業版' : '標準版' }}
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-gray-500">Cloudflare 帳號</dt>
            <dd class="text-gray-900">
              {{ store.cloudflareInfo ? '已連接' : '待連接' }}
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
                我們已發送確認郵件至您的信箱，請查收。
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
                我們會在 24 小時內完成您的專屬系統部署，並發送登入資訊。
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- 按鈕 -->
      <div class="mt-8">
        <a
          href="https://makanmakan.app"
          class="btn btn-primary"
        >
          返回首頁
        </a>
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

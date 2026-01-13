<script setup lang="ts">
import { RouterLink } from 'vue-router'
import {
  CloudIcon,
  ShieldCheckIcon,
  CubeIcon,
  RocketLaunchIcon
} from '@heroicons/vue/24/outline'

const features = [
  {
    icon: CloudIcon,
    title: '獨立環境',
    description: '完全隔離的雲端環境，數據 100% 歸您所有'
  },
  {
    icon: ShieldCheckIcon,
    title: '安全可靠',
    description: '基於 Cloudflare 全球邊緣網絡，企業級安全防護'
  },
  {
    icon: CubeIcon,
    title: '完整功能',
    description: '點餐、菜單管理、桌位管理、員工排班等完整功能'
  },
  {
    icon: RocketLaunchIcon,
    title: '快速部署',
    description: '自動化部署流程，最快 24 小時內完成上線'
  }
]

const plans = [
  {
    name: '標準版',
    price: '$149',
    period: '/月',
    features: ['1 間餐廳', '基本功能', '獨立環境', '資料備份', 'Email 支援'],
    recommended: false
  },
  {
    name: '專業版',
    price: '$299',
    period: '/月',
    features: ['最多 3 間餐廳', '完整功能', 'AI 分析', '員工排班', '請假管理', '優先支援'],
    recommended: true
  },
  {
    name: '企業版',
    price: '議價',
    period: '',
    features: ['無限餐廳', '客製化功能', '專屬客服', 'SLA 保證', 'API 整合'],
    recommended: false
  }
]
</script>

<template>
  <div class="space-y-12">
    <!-- Hero Section -->
    <div class="text-center">
      <h1 class="text-4xl font-bold text-gray-900 sm:text-5xl">
        為您的餐廳打造<br />
        <span class="text-primary-600">專屬管理系統</span>
      </h1>
      <p class="mt-6 text-lg text-gray-600 max-w-2xl mx-auto">
        MakanMakan 獨立部署方案，讓您擁有完全獨立的餐廳管理系統，
        數據安全、功能完整、彈性擴展。
      </p>
      <div class="mt-8 flex justify-center gap-4">
        <RouterLink to="/apply" class="btn btn-primary btn-lg">
          <RocketLaunchIcon class="h-5 w-5 mr-2" />
          立即申請
        </RouterLink>
        <a
          href="https://makanmakan.app/demo"
          target="_blank"
          class="btn btn-secondary btn-lg"
        >
          查看演示
        </a>
      </div>
    </div>

    <!-- Features -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div
        v-for="feature in features"
        :key="feature.title"
        class="card flex items-start"
      >
        <div class="flex-shrink-0 p-3 bg-primary-100 rounded-lg">
          <component :is="feature.icon" class="h-6 w-6 text-primary-600" />
        </div>
        <div class="ml-4">
          <h3 class="text-lg font-semibold text-gray-900">{{ feature.title }}</h3>
          <p class="mt-1 text-gray-600">{{ feature.description }}</p>
        </div>
      </div>
    </div>

    <!-- Pricing -->
    <div>
      <h2 class="text-2xl font-bold text-gray-900 text-center mb-8">選擇適合的方案</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          v-for="plan in plans"
          :key="plan.name"
          class="card relative"
          :class="{ 'border-2 border-primary-500': plan.recommended }"
        >
          <div
            v-if="plan.recommended"
            class="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-xs font-medium px-3 py-1 rounded-full"
          >
            推薦
          </div>
          <div class="text-center">
            <h3 class="text-lg font-semibold text-gray-900">{{ plan.name }}</h3>
            <div class="mt-4">
              <span class="text-4xl font-bold text-gray-900">{{ plan.price }}</span>
              <span class="text-gray-500">{{ plan.period }}</span>
            </div>
            <ul class="mt-6 space-y-3 text-left">
              <li
                v-for="feature in plan.features"
                :key="feature"
                class="flex items-center text-gray-600"
              >
                <svg class="h-5 w-5 text-primary-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
                {{ feature }}
              </li>
            </ul>
            <RouterLink
              to="/apply"
              class="mt-8 btn w-full"
              :class="plan.recommended ? 'btn-primary' : 'btn-secondary'"
            >
              選擇此方案
            </RouterLink>
          </div>
        </div>
      </div>
    </div>

    <!-- CTA -->
    <div class="card bg-primary-600 text-white text-center">
      <h2 class="text-2xl font-bold">準備好開始了嗎？</h2>
      <p class="mt-2 text-primary-100">
        填寫申請表單，我們將在 24 小時內與您聯繫
      </p>
      <RouterLink to="/apply" class="mt-6 btn bg-white text-primary-600 hover:bg-gray-100">
        開始申請
      </RouterLink>
    </div>
  </div>
</template>

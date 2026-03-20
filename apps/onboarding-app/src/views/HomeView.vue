<script setup lang="ts">
import { RouterLink } from "vue-router";
import {
  CloudIcon,
  ShieldCheckIcon,
  CubeIcon,
  RocketLaunchIcon,
} from "@heroicons/vue/24/outline";

const DEMO_RESTAURANT_ID = "019469a0-0099-7000-8000-000000000099";
const CUSTOMER_APP_URL =
  import.meta.env.VITE_CUSTOMER_APP_URL || "http://localhost:3000";
const demoUrl = `${CUSTOMER_APP_URL}/restaurant/${DEMO_RESTAURANT_ID}/shop/order-type`;

const features = [
  {
    icon: CloudIcon,
    title: "獨立環境",
    description: "完全隔離的雲端環境，數據 100% 歸您所有",
  },
  {
    icon: ShieldCheckIcon,
    title: "安全可靠",
    description: "基於 Cloudflare 全球邊緣網絡，企業級安全防護",
  },
  {
    icon: CubeIcon,
    title: "完整功能",
    description: "點餐、菜單管理、桌位管理、員工排班等完整功能",
  },
  {
    icon: RocketLaunchIcon,
    title: "快速部署",
    description: "自動化部署流程，最快 24 小時內完成上線",
  },
];
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
        <a :href="demoUrl" target="_blank" class="btn btn-secondary btn-lg">
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
          <h3 class="text-lg font-semibold text-gray-900">
            {{ feature.title }}
          </h3>
          <p class="mt-1 text-gray-600">{{ feature.description }}</p>
        </div>
      </div>
    </div>

    <!-- CTA -->
    <div class="card bg-primary-600 text-white text-center">
      <h2 class="text-2xl font-bold">準備好開始了嗎？</h2>
      <p class="mt-2 text-primary-100">
        填寫申請表單，我們將在 24 小時內與您聯繫
      </p>
      <RouterLink
        to="/apply"
        class="mt-6 btn bg-white text-primary-600 hover:bg-gray-100"
      >
        開始申請
      </RouterLink>
    </div>
  </div>
</template>

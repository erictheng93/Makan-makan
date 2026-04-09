<script setup lang="ts">
import { RouterLink } from "vue-router";
import {
  CloudIcon,
  ShieldCheckIcon,
  RocketLaunchIcon,
  ArrowRightIcon,
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
    icon: RocketLaunchIcon,
    title: "快速部署",
    description: "自動化部署流程，最快 24 小時內完成上線",
  },
];
</script>

<template>
  <div>
    <!-- Hero Section -->
    <section class="pt-16 pb-20 text-center sm:pt-20 sm:pb-24">
      <h1
        class="text-4xl font-semibold tracking-tight text-[#1C1C1E] sm:text-5xl"
      >
        為您的餐廳打造<br />
        <span class="text-primary-600">專屬管理系統</span>
      </h1>
      <p
        class="mx-auto mt-5 max-w-xl text-base leading-relaxed text-gray-500 sm:text-lg"
      >
        獨立部署 · 數據安全 · 24 小時內完成上線
      </p>

      <div class="mt-10 flex flex-col items-center gap-4">
        <RouterLink
          to="/apply"
          class="inline-flex items-center justify-center rounded-full bg-primary-600 px-8 py-3.5 text-base font-semibold text-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-primary-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          立即申請
          <ArrowRightIcon class="ml-2 h-4 w-4" />
        </RouterLink>
        <a
          :href="demoUrl"
          target="_blank"
          class="text-sm font-medium text-primary-600 transition-colors duration-200 hover:text-primary-700"
        >
          查看演示 →
        </a>
      </div>
    </section>

    <!-- Features -->
    <section class="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
      <div
        v-for="feature in features"
        :key="feature.title"
        class="group flex flex-col rounded-3xl bg-white p-8 shadow-card transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)]"
      >
        <div
          class="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50"
        >
          <component
            :is="feature.icon"
            class="h-6 w-6 text-primary-600"
            aria-hidden="true"
          />
        </div>
        <h3 class="mt-5 text-lg font-semibold text-[#1C1C1E]">
          {{ feature.title }}
        </h3>
        <p class="mt-2 text-sm leading-relaxed text-gray-500">
          {{ feature.description }}
        </p>
      </div>
    </section>

    <!-- Subtle CTA -->
    <section
      class="mt-16 flex flex-col items-center justify-between gap-5 rounded-3xl bg-white p-8 shadow-card sm:flex-row sm:gap-6 sm:p-10"
    >
      <div class="text-center sm:text-left">
        <h2 class="text-lg font-semibold text-[#1C1C1E] sm:text-xl">
          準備好開始了嗎？
        </h2>
        <p class="mt-1 text-sm text-gray-500">
          填寫申請表單，我們將在 24 小時內與您聯繫
        </p>
      </div>
      <RouterLink
        to="/apply"
        class="inline-flex shrink-0 items-center justify-center rounded-full bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-primary-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
      >
        開始申請
        <ArrowRightIcon class="ml-2 h-4 w-4" />
      </RouterLink>
    </section>
  </div>
</template>

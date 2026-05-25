<template>
  <section class="bg-white">
    <div class="h-44 bg-gray-100">
      <img
        v-if="market.bannerUrl || market.logoUrl"
        :src="market.bannerUrl || market.logoUrl || ''"
        :alt="market.name"
        class="h-full w-full object-cover"
      />
      <div
        v-else
        class="flex h-full items-center justify-center text-lg font-semibold text-gray-500"
      >
        {{ market.name }}
      </div>
    </div>
    <div class="space-y-3 px-4 py-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h1 class="text-xl font-semibold text-gray-900">
            {{ market.name }}
          </h1>
          <p class="mt-1 text-sm text-gray-500">
            {{ market.city }} · {{ market.district }}
          </p>
        </div>
        <span
          class="rounded-full bg-ios-blue/10 px-3 py-1 text-sm font-medium text-ios-blue"
        >
          {{ vendorCount }} 攤
        </span>
      </div>
      <p v-if="market.description" class="text-sm leading-6 text-gray-700">
        {{ market.description }}
      </p>
      <p class="text-sm text-gray-500">{{ market.address }}</p>
      <div v-if="market.tags?.length" class="flex flex-wrap gap-2">
        <span
          v-for="tag in market.tags.slice(0, 5)"
          :key="tag"
          class="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600"
        >
          {{ tag }}
        </span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { MarketDetail } from "@/services/marketsApi";

defineProps<{
  market: MarketDetail;
  vendorCount: number;
}>();
</script>

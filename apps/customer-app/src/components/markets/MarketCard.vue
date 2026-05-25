<template>
  <article
    class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
  >
    <button
      type="button"
      class="block w-full text-left focus:outline-none focus:ring-2 focus:ring-ios-blue focus:ring-offset-2"
      @click="$emit('select', market)"
    >
      <div class="h-32 bg-gray-100">
        <img
          v-if="market.bannerUrl || market.logoUrl"
          :src="market.bannerUrl || market.logoUrl || ''"
          :alt="market.name"
          class="h-full w-full object-cover"
        />
        <div
          v-else
          class="flex h-full items-center justify-center bg-gray-100 text-sm text-gray-500"
        >
          {{ market.name }}
        </div>
      </div>
      <div class="space-y-2 p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="truncate text-base font-semibold text-gray-900">
              {{ market.name }}
            </h2>
            <p class="mt-0.5 text-sm text-gray-500">
              {{ market.city }} · {{ market.district }}
            </p>
          </div>
          <span class="shrink-0 text-sm font-medium text-ios-blue">
            {{ vendorLabel }}
          </span>
        </div>
        <p
          v-if="market.description"
          class="line-clamp-2 text-sm leading-5 text-gray-600"
        >
          {{ market.description }}
        </p>
        <p v-if="distanceLabel" class="text-xs font-medium text-gray-500">
          {{ distanceLabel }}
        </p>
      </div>
    </button>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { MarketListItem } from "@/services/marketsApi";

const props = defineProps<{
  market: MarketListItem & { distanceKm?: number };
}>();

defineEmits<{
  select: [market: MarketListItem];
}>();

const vendorLabel = computed(() => `${props.market.vendorCount ?? 0} 攤`);
const distanceLabel = computed(() =>
  props.market.distanceKm == null
    ? ""
    : `離你 ${props.market.distanceKm.toFixed(1)} km`,
);
</script>

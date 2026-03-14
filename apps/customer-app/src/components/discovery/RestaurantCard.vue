<template>
  <div
    class="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
    @click="$emit('select', restaurant)"
  >
    <div class="flex items-center gap-3">
      <div
        class="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
      >
        <img
          v-if="restaurant.imageUrl"
          :src="restaurant.imageUrl"
          :alt="restaurant.name"
          class="w-full h-full object-cover"
        />
        <svg
          v-else
          class="w-7 h-7 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H7m2 0v-9m10 9v-9M9 8h6m-6 4h6"
          />
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <h4 class="font-medium text-gray-900 truncate">
          {{ restaurant.name }}
        </h4>
        <p class="text-sm text-gray-500 truncate">
          {{ restaurant.type }}
          <span v-if="restaurant.district" class="text-gray-400">
            · {{ restaurant.district }}
          </span>
        </p>
        <div class="flex items-center gap-2 mt-1">
          <span
            v-if="restaurant.isOpen"
            class="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700"
          >
            {{ t("discovery.open") }}
          </span>
          <span
            v-else
            class="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500"
          >
            {{ t("discovery.closed") }}
          </span>
          <span v-if="restaurant.rating" class="text-xs text-yellow-600">
            {{ restaurant.rating.toFixed(1) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { RestaurantListItem } from "@/services/discoveryApi";

const { t } = useI18n();

defineProps<{
  restaurant: RestaurantListItem;
}>();

defineEmits<{
  select: [restaurant: RestaurantListItem];
}>();
</script>

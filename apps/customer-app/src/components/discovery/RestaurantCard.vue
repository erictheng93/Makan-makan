<template>
  <article
    class="rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
  >
    <button
      type="button"
      class="block w-full text-left focus:outline-none focus:ring-2 focus:ring-ios-blue focus:ring-offset-2"
      @click="$emit('select', restaurant)"
    >
      <div class="flex items-center gap-3">
        <div
          class="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100"
        >
          <img
            v-if="restaurant.imageUrl"
            :src="restaurant.imageUrl"
            :alt="restaurant.name"
            class="h-full w-full object-cover"
          />
          <svg
            v-else
            class="h-7 w-7 text-gray-400"
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
        <div class="min-w-0 flex-1">
          <h4 class="truncate font-medium text-gray-900">
            {{ restaurant.name }}
          </h4>
          <p class="truncate text-sm text-gray-500">
            {{ restaurant.type }}
            <span v-if="restaurant.district" class="text-gray-400">
              · {{ restaurant.district }}
            </span>
          </p>
          <div class="mt-1 flex items-center gap-2">
            <span
              v-if="restaurant.isOpen"
              class="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700"
            >
              {{ t("discovery.open") }}
            </span>
            <span
              v-else
              class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500"
            >
              {{ t("discovery.closed") }}
            </span>
            <span v-if="restaurant.rating" class="text-xs text-yellow-600">
              {{ restaurant.rating.toFixed(1) }}
            </span>
          </div>
        </div>
      </div>
    </button>
    <button
      v-if="canTakeaway"
      type="button"
      data-testid="restaurant-takeaway-button"
      class="mt-3 w-full rounded-lg bg-ios-blue px-3 py-2 text-sm font-medium text-white"
      @click="$emit('takeaway', restaurant)"
    >
      立即外帶
    </button>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { RestaurantListItem } from "@/services/discoveryApi";

const { t } = useI18n();

const props = defineProps<{
  restaurant: RestaurantListItem;
}>();

defineEmits<{
  select: [restaurant: RestaurantListItem];
  takeaway: [restaurant: RestaurantListItem];
}>();

const canTakeaway = computed(
  () => props.restaurant.isOpen && props.restaurant.supportsTakeaway,
);
</script>

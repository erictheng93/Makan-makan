<template>
  <div
    class="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
    @click="$emit('select', dish)"
  >
    <div class="flex items-start justify-between">
      <div class="flex-1 min-w-0">
        <h4 class="font-medium text-gray-900 truncate">{{ dish.dishName }}</h4>
        <p class="text-sm text-gray-500 mt-0.5 truncate">
          {{ dish.restaurantName }}
          <span v-if="dish.district" class="text-gray-400">
            · {{ dish.district }}
          </span>
        </p>
        <div class="flex items-center gap-2 mt-2">
          <span class="text-indigo-600 font-semibold">
            {{ formatPrice(dish.price) }}
          </span>
          <span
            v-if="dish.isOpen"
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
        </div>
      </div>
    </div>
    <div v-if="dish.tags.length > 0" class="mt-2 flex flex-wrap gap-1">
      <span
        v-for="tag in dish.tags.slice(0, 3)"
        :key="tag"
        class="text-xs px-2 py-0.5 bg-gray-50 text-gray-500 rounded"
      >
        {{ tag }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useCurrency } from "@/composables/useCurrency";
import type { DishSearchResult } from "@/services/discoveryApi";

const { t } = useI18n();
const { formatPrice } = useCurrency();

defineProps<{
  dish: DishSearchResult;
}>();

defineEmits<{
  select: [dish: DishSearchResult];
}>();
</script>

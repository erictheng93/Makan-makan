<template>
  <section class="space-y-3">
    <div class="flex items-center gap-2">
      <input
        :value="query"
        type="search"
        class="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ios-blue focus:outline-none focus:ring-2 focus:ring-ios-blue/20"
        placeholder="搜尋攤位"
        @input="
          $emit('update:query', ($event.target as HTMLInputElement).value)
        "
      />
      <label
        class="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm text-gray-700"
      >
        <input
          :checked="takeawayOnly"
          type="checkbox"
          class="rounded border-gray-300 text-ios-blue focus:ring-ios-blue"
          @change="
            $emit(
              'update:takeawayOnly',
              ($event.target as HTMLInputElement).checked,
            )
          "
        />
        外帶
      </label>
    </div>

    <div v-if="loading" class="py-8 text-center text-sm text-gray-500">
      載入攤位中...
    </div>
    <div
      v-else-if="vendors.length === 0"
      class="py-8 text-center text-sm text-gray-500"
    >
      目前沒有符合條件的攤位。
    </div>
    <div v-else class="space-y-2">
      <RestaurantCard
        v-for="vendor in vendors"
        :key="vendor.restaurantId"
        :restaurant="vendor"
        @select="$emit('selectVendor', vendor)"
        @takeaway="$emit('takeaway', vendor)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import RestaurantCard from "@/components/discovery/RestaurantCard.vue";
import type { MarketVendor } from "@/services/marketsApi";

defineProps<{
  vendors: MarketVendor[];
  loading: boolean;
  query: string;
  takeawayOnly: boolean;
}>();

defineEmits<{
  "update:query": [query: string];
  "update:takeawayOnly": [value: boolean];
  selectVendor: [vendor: MarketVendor];
  takeaway: [vendor: MarketVendor];
}>();
</script>

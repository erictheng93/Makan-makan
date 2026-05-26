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
      <label
        class="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm text-gray-700"
      >
        <input
          :checked="deliveryOnly"
          data-testid="vendor-delivery-filter"
          type="checkbox"
          class="rounded border-gray-300 text-ios-blue focus:ring-ios-blue"
          @change="
            $emit(
              'update:deliveryOnly',
              ($event.target as HTMLInputElement).checked,
            )
          "
        />
        外送
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
      <div
        v-for="vendor in vendors"
        :key="vendor.restaurantId"
        class="rounded-xl border border-gray-200 bg-white"
      >
        <RestaurantCard
          :restaurant="vendor"
          class="border-0"
          @select="$emit('selectVendor', vendor)"
          @takeaway="$emit('takeaway', vendor)"
        />
        <div class="border-t border-gray-100 px-4 py-3">
          <button
            type="button"
            class="w-full rounded-lg border border-ios-blue px-3 py-2 text-sm font-medium text-ios-blue"
            @click="$emit('contactVendor', vendor)"
          >
            聯絡店家
          </button>
        </div>
      </div>
      <button
        v-if="hasMore"
        type="button"
        data-testid="vendor-list-load-more"
        class="h-10 w-full rounded-lg border border-ios-blue px-4 text-sm font-medium text-ios-blue disabled:border-gray-300 disabled:text-gray-400"
        :disabled="loading"
        @click="$emit('loadMore')"
      >
        {{ loading ? "載入中..." : "載入更多店鋪" }}
      </button>
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
  deliveryOnly: boolean;
  hasMore?: boolean;
}>();

defineEmits<{
  "update:query": [query: string];
  "update:takeawayOnly": [value: boolean];
  "update:deliveryOnly": [value: boolean];
  selectVendor: [vendor: MarketVendor];
  takeaway: [vendor: MarketVendor];
  contactVendor: [vendor: MarketVendor];
  loadMore: [];
}>();
</script>

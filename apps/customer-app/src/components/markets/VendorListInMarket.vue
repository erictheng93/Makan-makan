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
      <button
        type="button"
        data-testid="vendor-use-location"
        class="h-10 shrink-0 rounded-lg border border-ios-blue px-3 text-sm font-medium text-ios-blue"
        @click="$emit('useLocation')"
      >
        離我最近
      </button>
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
          @select="selectPrimaryVendorEntry(vendor)"
          @takeaway="$emit('takeaway', vendor)"
        />
        <div
          class="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-sm"
        >
          <div class="min-w-0 text-gray-500">
            <span v-if="vendor.stallNumber">
              攤位 {{ vendor.stallNumber }}
            </span>
            <span v-else>未標示攤位</span>
          </div>
          <span
            v-if="vendor.isPrimary"
            class="shrink-0 rounded bg-ios-blue/10 px-2 py-0.5 text-xs font-medium text-ios-blue"
          >
            主要店鋪
          </span>
        </div>
        <div
          class="flex flex-wrap gap-2 border-t border-gray-100 px-4 py-3"
          :data-testid="`vendor-availability-${vendor.restaurantId}`"
        >
          <span
            class="rounded px-2 py-0.5 text-xs font-medium"
            :class="
              vendor.availableMenuItemCount > 0
                ? 'bg-ios-blue/10 text-ios-blue'
                : 'bg-gray-50 text-gray-500'
            "
          >
            {{
              vendor.availableMenuItemCount > 0
                ? `菜單/商品 ${vendor.availableMenuItemCount} 項`
                : "尚無菜單/商品"
            }}
          </span>
          <span
            class="rounded px-2 py-0.5 text-xs font-medium"
            :class="
              vendor.publicServiceItemCount > 0
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-gray-50 text-gray-500'
            "
          >
            {{
              vendor.publicServiceItemCount > 0
                ? `服務 ${vendor.publicServiceItemCount} 項`
                : "尚無服務"
            }}
          </span>
        </div>
        <div class="grid grid-cols-2 gap-2 border-t border-gray-100 px-4 py-3">
          <button
            type="button"
            class="rounded-lg bg-ios-blue px-3 py-2 text-sm font-medium text-white disabled:bg-gray-200 disabled:text-gray-400"
            :data-testid="`open-vendor-menu-${vendor.restaurantId}`"
            :disabled="vendor.availableMenuItemCount <= 0"
            @click="$emit('selectVendor', vendor)"
          >
            查看菜單/商品
          </button>
          <button
            type="button"
            class="rounded-lg border border-emerald-500 px-3 py-2 text-sm font-medium text-emerald-700 disabled:border-gray-200 disabled:text-gray-400"
            :data-testid="`open-vendor-services-${vendor.restaurantId}`"
            :disabled="vendor.publicServiceItemCount <= 0"
            @click="$emit('selectServices', vendor)"
          >
            查看服務
          </button>
          <button
            type="button"
            class="col-span-2 rounded-lg border border-ios-blue px-3 py-2 text-sm font-medium text-ios-blue"
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

const emit = defineEmits<{
  "update:query": [query: string];
  "update:takeawayOnly": [value: boolean];
  "update:deliveryOnly": [value: boolean];
  selectVendor: [vendor: MarketVendor];
  selectServices: [vendor: MarketVendor];
  takeaway: [vendor: MarketVendor];
  contactVendor: [vendor: MarketVendor];
  useLocation: [];
  loadMore: [];
}>();

function selectPrimaryVendorEntry(vendor: MarketVendor) {
  if (vendor.availableMenuItemCount > 0) {
    emit("selectVendor", vendor);
    return;
  }

  if (vendor.publicServiceItemCount > 0) {
    emit("selectServices", vendor);
  }
}
</script>

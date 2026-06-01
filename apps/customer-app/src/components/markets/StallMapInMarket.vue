<template>
  <section
    v-if="mappedVendors.length > 0"
    data-testid="stall-map"
    class="space-y-3 rounded-xl border border-gray-200 bg-white p-4"
  >
    <div class="flex items-center justify-between gap-3">
      <div>
        <h2 class="text-base font-semibold text-gray-900">攤位示意圖</h2>
        <p class="text-sm text-gray-500">依攤位號與位置標籤快速找到店家。</p>
      </div>
      <span class="shrink-0 rounded bg-gray-50 px-2 py-1 text-xs text-gray-500">
        {{ mappedVendors.length }} 攤
      </span>
    </div>

    <div class="space-y-3">
      <div
        v-for="group in groupedVendors"
        :key="group.locationLabel"
        class="space-y-2"
      >
        <h3 class="text-sm font-medium text-gray-700">
          {{ group.locationLabel }}
        </h3>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button
            v-for="vendor in group.vendors"
            :key="vendor.restaurantId"
            type="button"
            class="min-h-16 rounded-lg border border-gray-200 bg-ios-bg px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-ios-blue focus:ring-offset-2"
            :data-testid="`stall-map-vendor-${vendor.restaurantId}`"
            @click="$emit('selectVendor', vendor)"
          >
            <span class="block text-xs font-medium text-ios-blue">
              攤位 {{ vendor.stallNumber }}
            </span>
            <span class="mt-1 block truncate text-sm font-medium text-gray-900">
              {{ vendor.name }}
            </span>
            <span class="mt-0.5 block text-xs text-gray-500">
              {{ vendor.isOpen ? "營業中" : "休息中" }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { MarketVendor } from "@/services/marketsApi";

const props = defineProps<{
  vendors: MarketVendor[];
}>();

defineEmits<{
  selectVendor: [vendor: MarketVendor];
}>();

const mappedVendors = computed(() =>
  props.vendors
    .filter((vendor) => vendor.stallNumber?.trim())
    .sort((left, right) =>
      String(left.stallNumber).localeCompare(
        String(right.stallNumber),
        "zh-Hant",
        {
          numeric: true,
        },
      ),
    ),
);

const groupedVendors = computed(() => {
  const groups = new Map<string, MarketVendor[]>();

  for (const vendor of mappedVendors.value) {
    const label = vendor.locationLabel?.trim() || "未標示區域";
    groups.set(label, [...(groups.get(label) ?? []), vendor]);
  }

  return Array.from(groups.entries()).map(([locationLabel, vendors]) => ({
    locationLabel,
    vendors,
  }));
});
</script>

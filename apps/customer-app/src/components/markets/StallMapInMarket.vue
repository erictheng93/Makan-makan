<template>
  <section
    v-if="mappedVendors.length > 0"
    data-testid="stall-map"
    class="space-y-4 rounded-xl border border-gray-200 bg-white p-4"
  >
    <div class="flex items-start justify-between gap-3">
      <div>
        <h2 class="text-base font-semibold text-gray-900">攤位示意圖</h2>
        <p class="mt-1 text-sm leading-5 text-gray-500">
          依市場區域與攤位號查看店家位置。
        </p>
      </div>
      <div class="shrink-0 text-right">
        <span
          class="inline-flex rounded bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600"
        >
          {{ mappedVendors.length }} 攤
        </span>
        <p class="mt-1 text-xs text-gray-500">{{ openVendorCount }} 營業中</p>
      </div>
    </div>

    <div class="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3">
      <div class="flex items-center justify-between text-xs text-gray-500">
        <span>入口</span>
        <span>動線</span>
        <span>出口</span>
      </div>
      <div class="mt-2 h-1 rounded-full bg-gray-200">
        <div class="h-1 w-2/3 rounded-full bg-ios-blue/60"></div>
      </div>
    </div>

    <div
      v-if="positionedVendors.length > 0"
      data-testid="stall-position-map"
      class="relative min-h-[18rem] overflow-hidden rounded-lg border border-gray-200 bg-white"
      aria-label="攤位位置圖"
    >
      <div
        class="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 bg-gray-200"
        aria-hidden="true"
      ></div>
      <div
        class="absolute inset-y-4 left-1/2 w-px -translate-x-1/2 bg-gray-200"
        aria-hidden="true"
      ></div>
      <button
        v-for="vendor in positionedVendors"
        :key="vendor.restaurantId"
        type="button"
        class="absolute min-h-[4.5rem] w-32 max-w-[42%] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-white px-2 py-2 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-ios-blue focus:ring-offset-2"
        :class="
          vendor.isOpen ? 'border-ios-blue/40' : 'border-gray-200 opacity-80'
        "
        :style="{
          left: `${mapAxis(vendor, 'x')}%`,
          top: `${mapAxis(vendor, 'y')}%`,
        }"
        :data-testid="`stall-position-vendor-${vendor.restaurantId}`"
        @click="$emit('selectVendor', vendor)"
      >
        <span class="block text-[11px] font-semibold text-ios-blue">
          攤位 {{ vendor.stallNumber }}
        </span>
        <span class="mt-1 block truncate text-xs font-semibold text-gray-900">
          {{ vendor.name }}
        </span>
        <span class="mt-1 block text-[11px] text-gray-500">
          {{ vendor.locationLabel || "未標示區域" }}
        </span>
      </button>
    </div>

    <div v-if="groupedVendors.length > 0" class="space-y-4">
      <div
        v-for="group in groupedVendors"
        :key="group.locationLabel"
        class="space-y-2"
        data-testid="stall-map-lane"
      >
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-sm font-semibold text-gray-800">
            {{ group.locationLabel }}
          </h3>
          <span class="text-xs text-gray-500"
            >{{ group.vendors.length }} 攤</span
          >
        </div>

        <div
          class="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2"
          :aria-label="`${group.locationLabel} 攤位動線`"
        >
          <div class="relative flex justify-center" aria-hidden="true">
            <div class="absolute inset-y-3 w-px bg-ios-blue/20"></div>
            <div class="mt-3 h-3 w-3 rounded-full bg-ios-blue"></div>
          </div>

          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button
              v-for="vendor in group.vendors"
              :key="vendor.restaurantId"
              type="button"
              class="min-h-[6.5rem] rounded-lg border bg-white px-3 py-2 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-ios-blue focus:ring-offset-2"
              :class="
                vendor.isOpen
                  ? 'border-ios-blue/30'
                  : 'border-gray-200 opacity-80'
              "
              :data-testid="`stall-map-vendor-${vendor.restaurantId}`"
              @click="$emit('selectVendor', vendor)"
            >
              <span class="flex items-center justify-between gap-2">
                <span class="text-xs font-semibold text-ios-blue">
                  攤位 {{ vendor.stallNumber }}
                </span>
                <span
                  class="rounded px-1.5 py-0.5 text-[11px] font-medium"
                  :class="
                    vendor.isOpen
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-gray-100 text-gray-500'
                  "
                >
                  {{ vendor.isOpen ? "營業" : "休息" }}
                </span>
              </span>
              <span
                class="mt-2 block min-h-[2.5rem] text-sm font-semibold leading-5 text-gray-900"
              >
                {{ vendor.name }}
              </span>
              <span class="mt-2 flex flex-wrap gap-1">
                <span
                  v-if="vendor.availableMenuItemCount > 0"
                  class="rounded bg-ios-blue/10 px-1.5 py-0.5 text-[11px] font-medium text-ios-blue"
                >
                  菜單 {{ vendor.availableMenuItemCount }}
                </span>
                <span
                  v-if="vendor.publicServiceItemCount > 0"
                  class="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700"
                >
                  服務 {{ vendor.publicServiceItemCount }}
                </span>
                <span
                  v-if="
                    vendor.availableMenuItemCount <= 0 &&
                    vendor.publicServiceItemCount <= 0
                  "
                  class="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500"
                >
                  資料補齊中
                </span>
              </span>
            </button>
          </div>
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

const positionedVendors = computed(() =>
  mappedVendors.value.filter(
    (vendor) =>
      vendor.mapPosition &&
      Number.isFinite(vendor.mapPosition.x) &&
      Number.isFinite(vendor.mapPosition.y),
  ),
);

const openVendorCount = computed(
  () => mappedVendors.value.filter((vendor) => vendor.isOpen).length,
);

const groupedVendors = computed(() => {
  const groups = new Map<string, MarketVendor[]>();

  for (const vendor of mappedVendors.value.filter(
    (vendor) => !positionedVendors.value.includes(vendor),
  )) {
    const label = vendor.locationLabel?.trim() || "未標示區域";
    groups.set(label, [...(groups.get(label) ?? []), vendor]);
  }

  return Array.from(groups.entries()).map(([locationLabel, vendors]) => ({
    locationLabel,
    vendors,
  }));
});

function mapAxis(vendor: MarketVendor, axis: "x" | "y") {
  return vendor.mapPosition?.[axis] ?? 50;
}
</script>

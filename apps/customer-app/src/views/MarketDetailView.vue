<template>
  <div class="min-h-screen bg-ios-bg">
    <nav class="sticky top-0 z-10 border-b border-gray-100 bg-white shadow-sm">
      <div class="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
        <button
          type="button"
          class="text-gray-500 hover:text-gray-700"
          aria-label="返回"
          @click="$router.back()"
        >
          <svg
            class="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <h1 class="truncate text-lg font-semibold text-gray-900">
          {{ store.selectedMarket?.name || "市場" }}
        </h1>
      </div>
    </nav>

    <main class="mx-auto max-w-md">
      <div v-if="store.loading" class="py-12 text-center text-sm text-gray-500">
        載入中...
      </div>
      <div
        v-else-if="store.error"
        class="py-8 text-center text-sm text-red-500"
      >
        {{ store.error }}
      </div>
      <template v-else-if="store.selectedMarket">
        <MarketDetailHero
          :market="store.selectedMarket"
          :vendor-count="store.vendorCount"
        />
        <section class="space-y-4 px-4 py-4">
          <VendorListInMarket
            :vendors="store.vendors"
            :loading="store.vendorsLoading"
            :query="vendorQuery"
            :takeaway-only="takeawayOnly"
            @update:query="onQueryChange"
            @update:takeaway-only="onTakeawayOnlyChange"
            @select-vendor="openVendor"
            @takeaway="startTakeaway"
          />
        </section>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import MarketDetailHero from "@/components/markets/MarketDetailHero.vue";
import VendorListInMarket from "@/components/markets/VendorListInMarket.vue";
import { useMarketsStore } from "@/stores/markets";
import { discoveryApi } from "@/services/discoveryApi";
import type { MarketVendor } from "@/services/marketsApi";

const route = useRoute();
const router = useRouter();
const store = useMarketsStore();
const vendorQuery = ref("");
const takeawayOnly = ref(false);
let queryTimer: ReturnType<typeof setTimeout> | undefined;

const slug = () => String(route.params.slug);

function loadVendors() {
  store.loadVendors(slug(), {
    q: vendorQuery.value || undefined,
    takeaway: takeawayOnly.value || undefined,
  });
}

function onQueryChange(value: string) {
  vendorQuery.value = value;
  if (queryTimer) clearTimeout(queryTimer);
  queryTimer = setTimeout(loadVendors, 250);
}

function onTakeawayOnlyChange(value: boolean) {
  takeawayOnly.value = value;
  loadVendors();
}

function openVendor(vendor: MarketVendor) {
  router.push({
    name: "ShopMenu",
    params: { restaurantId: vendor.restaurantId },
  });
}

async function startTakeaway(vendor: MarketVendor) {
  const result = await discoveryApi.getTakeawayEligibility(vendor.restaurantId);
  if (!result.eligible) {
    store.error = "目前無法從 Discovery 直接外帶。";
    return;
  }
  router.push({
    name: "OrderTypeLanding",
    params: { restaurantId: vendor.restaurantId },
    query: { qr: result.shopQrCode },
  });
}

onMounted(async () => {
  await store.loadMarketDetail(slug());
  await store.loadVendors(slug());
});

onBeforeUnmount(() => {
  if (queryTimer) clearTimeout(queryTimer);
  store.resetSelectedMarket();
});
</script>

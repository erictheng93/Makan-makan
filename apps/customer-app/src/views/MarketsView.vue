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
        <h1 class="text-lg font-semibold text-gray-900">夜市與商圈</h1>
      </div>
    </nav>

    <main class="mx-auto max-w-md space-y-4 px-4 py-4">
      <section class="space-y-3">
        <div class="flex gap-2">
          <select
            v-model="city"
            class="h-10 flex-1 rounded-lg border border-gray-300 px-3 text-sm focus:border-ios-blue focus:outline-none focus:ring-2 focus:ring-ios-blue/20"
            @change="reloadList"
          >
            <option value="台中市">台中市</option>
          </select>
          <select
            v-model="district"
            class="h-10 flex-1 rounded-lg border border-gray-300 px-3 text-sm focus:border-ios-blue focus:outline-none focus:ring-2 focus:ring-ios-blue/20"
            @change="reloadList"
          >
            <option value="">全部區域</option>
            <option v-for="item in districts" :key="item" :value="item">
              {{ item }}
            </option>
          </select>
        </div>
        <button
          type="button"
          class="w-full rounded-lg border border-ios-blue px-3 py-2 text-sm font-medium text-ios-blue disabled:border-gray-300 disabled:text-gray-400"
          :disabled="locating"
          @click="loadNearby"
        >
          {{ locating ? "定位中..." : "找附近夜市" }}
        </button>
      </section>

      <div v-if="store.loading" class="py-12 text-center text-sm text-gray-500">
        載入中...
      </div>
      <div
        v-else-if="store.error"
        class="py-8 text-center text-sm text-red-500"
      >
        {{ store.error }}
      </div>
      <template v-else>
        <section v-if="store.nearbyMarkets.length > 0" class="space-y-3">
          <h2 class="text-sm font-medium text-gray-700">附近</h2>
          <MarketCard
            v-for="market in store.nearbyMarkets"
            :key="`nearby-${market.id}`"
            :market="market"
            @select="openMarket"
          />
        </section>

        <section class="space-y-3">
          <h2 class="text-sm font-medium text-gray-700">所有夜市與商圈</h2>
          <MarketCard
            v-for="market in store.markets"
            :key="market.id"
            :market="market"
            @select="openMarket"
          />
          <p
            v-if="!store.hasMarkets"
            class="py-8 text-center text-sm text-gray-500"
          >
            目前沒有符合條件的市場。
          </p>
        </section>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import MarketCard from "@/components/markets/MarketCard.vue";
import { useMarketsStore } from "@/stores/markets";
import type { MarketListItem } from "@/services/marketsApi";

const router = useRouter();
const store = useMarketsStore();
const city = ref("台中市");
const district = ref("");
const locating = ref(false);

const districts = [
  "西屯區",
  "北屯區",
  "南屯區",
  "中區",
  "東區",
  "西區",
  "南區",
  "北區",
  "豐原區",
  "大里區",
];

function reloadList() {
  store.loadMarkets({
    city: city.value,
    district: district.value || undefined,
  });
}

function loadNearby() {
  if (!navigator.geolocation) return;
  locating.value = true;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      locating.value = false;
      store.loadNearby({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        radiusKm: 2,
      });
    },
    () => {
      locating.value = false;
      reloadList();
    },
    { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 },
  );
}

function openMarket(market: MarketListItem) {
  router.push({ name: "MarketDetail", params: { slug: market.slug } });
}

onMounted(reloadList);
</script>

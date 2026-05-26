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
        <form
          data-testid="markets-search-form"
          class="flex gap-2"
          @submit.prevent="reloadList"
        >
          <input
            v-model="query"
            data-testid="markets-search-input"
            type="search"
            class="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ios-blue focus:outline-none focus:ring-2 focus:ring-ios-blue/20"
            placeholder="搜尋夜市、商圈或標籤"
          />
          <button
            type="submit"
            class="h-10 shrink-0 rounded-lg bg-ios-blue px-4 text-sm font-medium text-white"
          >
            搜尋
          </button>
        </form>
        <div class="flex gap-2">
          <select
            v-model="city"
            data-testid="markets-city-select"
            class="h-10 flex-1 rounded-lg border border-gray-300 px-3 text-sm focus:border-ios-blue focus:outline-none focus:ring-2 focus:ring-ios-blue/20"
            @change="onCityChange"
          >
            <option value="">全部城市</option>
            <option
              v-for="area in marketAreas"
              :key="area.city"
              :value="area.city"
            >
              {{ area.city }}
            </option>
          </select>
          <select
            v-model="district"
            data-testid="markets-district-select"
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
          <div
            v-if="!store.hasMarkets"
            data-testid="markets-empty-state"
            class="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-6 text-center"
          >
            <span class="block text-sm font-medium text-gray-700">
              {{
                hasDirectoryFilters
                  ? "沒有符合目前條件的夜市或商圈"
                  : "尚未收錄可瀏覽的夜市或商圈"
              }}
            </span>
            <span class="mt-1 block text-sm text-gray-500">
              {{
                hasDirectoryFilters
                  ? "可清除搜尋條件，或改用城市、行政區重新查找。"
                  : "資料上架後會在這裡顯示可搜尋的夜市、商圈與店鋪。"
              }}
            </span>
            <button
              v-if="hasDirectoryFilters"
              type="button"
              data-testid="markets-clear-filters"
              class="mt-4 h-9 rounded-lg border border-ios-blue px-3 text-sm font-medium text-ios-blue"
              @click="clearFilters"
            >
              清除條件
            </button>
          </div>
          <button
            v-if="store.hasMoreMarkets"
            type="button"
            data-testid="markets-load-more"
            class="h-10 w-full rounded-lg border border-ios-blue px-4 text-sm font-medium text-ios-blue disabled:border-gray-300 disabled:text-gray-400"
            :disabled="store.loading"
            @click="loadMoreMarkets"
          >
            {{ store.loading ? "載入中..." : "載入更多市場" }}
          </button>
        </section>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import MarketCard from "@/components/markets/MarketCard.vue";
import { useMarketsStore } from "@/stores/markets";
import {
  marketsApi,
  type MarketArea,
  type MarketListItem,
} from "@/services/marketsApi";

const router = useRouter();
const route = useRoute();
const store = useMarketsStore();
const query = ref(firstQueryString(route.query.q));
const city = ref(firstQueryString(route.query.city));
const district = ref(firstQueryString(route.query.district));
const locating = ref(false);
const marketAreas = ref<MarketArea[]>([]);
const hasDirectoryFilters = computed(
  () =>
    query.value.trim().length > 0 ||
    city.value.length > 0 ||
    district.value.length > 0,
);

const districts = computed(() => {
  const areas =
    city.value === ""
      ? marketAreas.value
      : marketAreas.value.filter((area) => area.city === city.value);

  return Array.from(new Set(areas.flatMap((area) => area.districts))).sort(
    (left, right) => left.localeCompare(right, "zh-Hant"),
  );
});

function reloadList() {
  syncDirectoryQuery();
  store.loadMarkets({
    q: query.value.trim() || undefined,
    city: city.value || undefined,
    district: district.value || undefined,
  });
}

function loadMoreMarkets() {
  store.loadMoreMarkets({
    q: query.value.trim() || undefined,
    city: city.value || undefined,
    district: district.value || undefined,
  });
}

function onCityChange() {
  district.value = "";
  reloadList();
}

function clearFilters() {
  query.value = "";
  city.value = "";
  district.value = "";
  reloadList();
}

function firstQueryString(value: unknown) {
  if (Array.isArray(value)) {
    return value.find((item) => typeof item === "string") ?? "";
  }

  return typeof value === "string" ? value : "";
}

function syncDirectoryQuery() {
  router.replace({
    query: {
      ...(query.value.trim() ? { q: query.value.trim() } : {}),
      ...(city.value ? { city: city.value } : {}),
      ...(district.value ? { district: district.value } : {}),
    },
  });
}

async function loadAreas() {
  try {
    const response = await marketsApi.listAreas();
    marketAreas.value = response.areas;
  } catch (error) {
    console.error("Failed to load market area filters:", error);
  }
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
  router.push({
    name: "MarketDetail",
    params: { slug: market.slug },
    query: {
      returnPath: route.fullPath,
      returnLabel: "夜市與商圈",
    },
  });
}

onMounted(() => {
  loadAreas();
  reloadList();
});
</script>

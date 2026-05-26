<template>
  <div class="min-h-screen bg-ios-bg">
    <nav class="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-10">
      <div class="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
        <button
          class="text-gray-500 hover:text-gray-700"
          @click="$router.back()"
        >
          <svg
            class="w-6 h-6"
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
        <h1 class="text-lg font-semibold text-gray-900">
          {{ t("discovery.title") }}
        </h1>
      </div>
    </nav>

    <main class="max-w-md mx-auto px-4 py-4 space-y-4">
      <SearchBar
        v-model="store.searchQuery"
        :keywords="store.popularKeywords"
        @search="store.searchDishes($event)"
        @clear="store.clearSearch"
      />

      <section v-if="marketOptions.length > 0" class="space-y-2">
        <h2 class="text-sm font-medium text-gray-700">選擇夜市或商圈</h2>
        <div class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <button
            v-for="market in marketOptions"
            :key="market.id"
            type="button"
            data-testid="discovery-market-chip"
            class="h-9 shrink-0 rounded-full border px-3 text-sm font-medium"
            :class="
              selectedMarketId === market.id
                ? 'border-ios-blue bg-ios-blue text-white'
                : 'border-gray-300 bg-white text-gray-700'
            "
            :aria-pressed="selectedMarketId === market.id"
            @click="toggleMarketFilter(market.id)"
          >
            {{ market.name }}
          </button>
        </div>
      </section>

      <FilterPanel
        :filters="store.filters"
        :cities="cities"
        :districts="districts"
        @update:filters="store.updateFilters($event)"
      />

      <div v-if="store.loading" class="flex justify-center py-12">
        <div
          class="animate-spin rounded-full h-8 w-8 border-b-2 border-ios-blue"
        ></div>
      </div>

      <div v-else-if="store.error" class="text-center py-8">
        <p class="text-red-500 text-sm">{{ store.error }}</p>
      </div>

      <template v-else>
        <!-- Search results (dishes) -->
        <div
          v-if="store.isSearchMode && store.dishResults.length > 0"
          class="space-y-3"
        >
          <p class="text-sm text-gray-500">
            {{ tWithParams("discovery.resultsCount", { count: store.total }) }}
          </p>
          <DishResultCard
            v-for="dish in store.dishResults"
            :key="dish.menuItemId"
            :dish="dish"
            @select="onDishSelect"
            @takeaway="onDishTakeaway"
          />
        </div>

        <!-- Browse mode (restaurants) -->
        <div v-else-if="!store.isSearchMode" class="space-y-3">
          <!-- Popular dishes section -->
          <div v-if="store.popularDishes.length > 0 && !store.hasResults">
            <h3 class="text-sm font-medium text-gray-700 mb-2">
              {{ t("discovery.popularDishes") }}
            </h3>
            <div class="space-y-2">
              <DishResultCard
                v-for="dish in store.popularDishes.slice(0, 5)"
                :key="dish.menuItemId"
                :dish="dish"
                @select="onDishSelect"
                @takeaway="onDishTakeaway"
              />
            </div>
          </div>

          <!-- Restaurant list -->
          <div v-if="store.restaurantResults.length > 0">
            <h3 class="text-sm font-medium text-gray-700 mb-2">
              {{ t("discovery.restaurants") }}
            </h3>
            <div class="space-y-2">
              <RestaurantCard
                v-for="r in store.restaurantResults"
                :key="r.restaurantId"
                :restaurant="r"
                @select="onRestaurantSelect"
                @takeaway="onRestaurantTakeaway"
              />
            </div>
          </div>

          <!-- Popular restaurants fallback -->
          <div
            v-else-if="store.popularRestaurants.length > 0 && !store.hasResults"
          >
            <h3 class="text-sm font-medium text-gray-700 mb-2">
              {{ t("discovery.popularRestaurants") }}
            </h3>
            <div class="space-y-2">
              <RestaurantCard
                v-for="r in store.popularRestaurants"
                :key="r.restaurantId"
                :restaurant="r"
                @select="onRestaurantSelect"
                @takeaway="onRestaurantTakeaway"
              />
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div
          v-if="
            store.isSearchMode &&
            store.dishResults.length === 0 &&
            store.searchQuery
          "
          class="text-center py-12"
        >
          <p class="text-gray-500">{{ t("discovery.noResults") }}</p>
        </div>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "@/composables/useI18n";
import { useDiscoveryStore } from "@/stores/discovery";
import SearchBar from "@/components/discovery/SearchBar.vue";
import FilterPanel from "@/components/discovery/FilterPanel.vue";
import DishResultCard from "@/components/discovery/DishResultCard.vue";
import RestaurantCard from "@/components/discovery/RestaurantCard.vue";
import type {
  DishSearchResult,
  RestaurantListItem,
} from "@/services/discoveryApi";
import { discoveryApi } from "@/services/discoveryApi";
import { marketsApi, type MarketListItem } from "@/services/marketsApi";
import { shopMenuItemQuery } from "@/utils/shopMenuDeepLink";

const { t, tWithParams } = useI18n();
const router = useRouter();
const store = useDiscoveryStore();
const marketOptions = ref<MarketListItem[]>([]);
const marketAreas = ref<{ city: string; districts: string[] }[]>([]);

const selectedMarketId = computed(() => store.filters.marketId);
const selectedCity = computed(() => store.filters.city);
const cities = computed(() => marketAreas.value.map((area) => area.city));
const districts = computed(() => {
  const areas = selectedCity.value
    ? marketAreas.value.filter((area) => area.city === selectedCity.value)
    : marketAreas.value;

  return Array.from(new Set(areas.flatMap((area) => area.districts))).sort(
    (left, right) => left.localeCompare(right, "zh-Hant"),
  );
});

function onDishSelect(dish: DishSearchResult) {
  router.push({
    name: "ShopMenu",
    params: { restaurantId: dish.restaurantId },
    query: shopMenuItemQuery(dish),
  });
}

function onRestaurantSelect(restaurant: RestaurantListItem) {
  router.push(`/restaurant/${restaurant.restaurantId}/shop/menu`);
}

async function startTakeaway(
  restaurantId: string,
  query: Record<string, string> = {},
) {
  const result = await discoveryApi.getTakeawayEligibility(restaurantId);
  if (!result.eligible) {
    store.error = "目前無法從 Discovery 直接外帶。";
    return;
  }
  router.push({
    name: "OrderTypeLanding",
    params: { restaurantId },
    query: { qr: result.shopQrCode, ...query },
  });
}

function onDishTakeaway(dish: DishSearchResult) {
  startTakeaway(dish.restaurantId, shopMenuItemQuery(dish));
}

function onRestaurantTakeaway(restaurant: RestaurantListItem) {
  startTakeaway(restaurant.restaurantId);
}

function toggleMarketFilter(marketId: string) {
  store.updateFilters({
    marketId: selectedMarketId.value === marketId ? undefined : marketId,
  });
}

async function loadMarketOptions() {
  try {
    const response = await marketsApi.listMarkets({ limit: 20 });
    marketOptions.value = response.markets;
  } catch (error) {
    console.error("Failed to load discovery markets:", error);
  }

  try {
    const response = await marketsApi.listAreas();
    marketAreas.value = response.areas;
  } catch (error) {
    console.error("Failed to load discovery market areas:", error);
  }
}

onMounted(() => {
  store.loadPopular();
  store.browseRestaurants();
  loadMarketOptions();
});
</script>

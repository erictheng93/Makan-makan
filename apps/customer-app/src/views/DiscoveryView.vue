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

      <FilterPanel
        :filters="store.filters"
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
import { onMounted } from "vue";
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

const { t, tWithParams } = useI18n();
const router = useRouter();
const store = useDiscoveryStore();

// TODO: Load from API or config
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

function onDishSelect(dish: DishSearchResult) {
  // Navigate to restaurant menu with this dish highlighted
  router.push(`/restaurant/${dish.restaurantId}/shop/menu`);
}

function onRestaurantSelect(restaurant: RestaurantListItem) {
  router.push(`/restaurant/${restaurant.restaurantId}/shop/menu`);
}

onMounted(() => {
  store.loadPopular();
  store.browseRestaurants();
});
</script>

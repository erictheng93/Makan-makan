import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  discoveryApi,
  type DishSearchResult,
  type RestaurantListItem,
  type SearchFilters,
} from "@/services/discoveryApi";

export const useDiscoveryStore = defineStore("discovery", () => {
  // State
  const searchQuery = ref("");
  const filters = ref<SearchFilters>({});
  const dishResults = ref<DishSearchResult[]>([]);
  const restaurantResults = ref<RestaurantListItem[]>([]);
  const popularKeywords = ref<string[]>([]);
  const popularDishes = ref<DishSearchResult[]>([]);
  const popularRestaurants = ref<RestaurantListItem[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const total = ref(0);
  const page = ref(1);
  const mode = ref<"search" | "browse">("browse");

  // Computed
  const hasResults = computed(
    () => dishResults.value.length > 0 || restaurantResults.value.length > 0,
  );
  const isSearchMode = computed(() => mode.value === "search");

  function hasProductBrowseScope(searchFilters: SearchFilters) {
    return Boolean(searchFilters.marketId || searchFilters.categoryName);
  }

  // Actions
  async function searchDishes(query: string) {
    searchQuery.value = query;
    mode.value = "search";
    loading.value = true;
    error.value = null;

    try {
      const trimmedQuery = query.trim();
      const result = await discoveryApi.searchDishes({
        ...(trimmedQuery ? { q: trimmedQuery } : {}),
        ...filters.value,
        page: page.value,
      });
      dishResults.value = result.results;
      total.value = result.total;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Search failed";
    } finally {
      loading.value = false;
    }
  }

  async function browseRestaurants() {
    mode.value = "browse";
    loading.value = true;
    error.value = null;

    try {
      const result = await discoveryApi.browseRestaurants({
        ...filters.value,
        page: page.value,
      });
      restaurantResults.value = result.results;
      total.value = result.total;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Browse failed";
    } finally {
      loading.value = false;
    }
  }

  async function loadPopular() {
    loading.value = true;
    error.value = null;

    try {
      const result = await discoveryApi.getPopular();
      popularKeywords.value = result.keywords;
      popularDishes.value = result.dishes;
      popularRestaurants.value = result.restaurants;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to load popular";
    } finally {
      loading.value = false;
    }
  }

  function updateFilters(newFilters: Partial<SearchFilters>) {
    filters.value = { ...filters.value, ...newFilters };
    page.value = 1;
    if (
      (mode.value === "search" && searchQuery.value) ||
      hasProductBrowseScope(filters.value)
    ) {
      searchDishes(searchQuery.value);
    } else {
      browseRestaurants();
    }
  }

  function clearSearch() {
    searchQuery.value = "";
    dishResults.value = [];
    mode.value = "browse";
    page.value = 1;
  }

  function resetAll() {
    searchQuery.value = "";
    filters.value = {};
    dishResults.value = [];
    restaurantResults.value = [];
    error.value = null;
    total.value = 0;
    page.value = 1;
    mode.value = "browse";
  }

  return {
    searchQuery,
    filters,
    dishResults,
    restaurantResults,
    popularKeywords,
    popularDishes,
    popularRestaurants,
    loading,
    error,
    total,
    page,
    mode,
    hasResults,
    isSearchMode,
    searchDishes,
    browseRestaurants,
    loadPopular,
    updateFilters,
    clearSearch,
    resetAll,
  };
});

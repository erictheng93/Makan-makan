import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  marketsApi,
  type ListMarketsParams,
  type MarketDetail,
  type MarketListItem,
  type MarketVendor,
  type NearbyMarketsParams,
  type VendorFilters,
} from "@/services/marketsApi";

export const useMarketsStore = defineStore("markets", () => {
  const markets = ref<MarketListItem[]>([]);
  const nearbyMarkets = ref<Array<MarketListItem & { distanceKm: number }>>([]);
  const selectedMarket = ref<MarketDetail | null>(null);
  const vendors = ref<MarketVendor[]>([]);
  const vendorCount = ref(0);
  const total = ref(0);
  const page = ref(1);
  const loading = ref(false);
  const vendorsLoading = ref(false);
  const error = ref<string | null>(null);

  const hasMarkets = computed(
    () => markets.value.length > 0 || nearbyMarkets.value.length > 0,
  );

  async function loadMarkets(params: ListMarketsParams = {}) {
    loading.value = true;
    error.value = null;
    try {
      const response = await marketsApi.listMarkets(params);
      markets.value = response.markets;
      total.value = response.total;
      page.value = response.page;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to load markets";
    } finally {
      loading.value = false;
    }
  }

  async function loadNearby(params: NearbyMarketsParams) {
    loading.value = true;
    error.value = null;
    try {
      const response = await marketsApi.findNearby(params);
      nearbyMarkets.value = response.markets;
    } catch (e) {
      error.value =
        e instanceof Error ? e.message : "Failed to load nearby markets";
    } finally {
      loading.value = false;
    }
  }

  async function loadMarketDetail(slug: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await marketsApi.getMarket(slug);
      selectedMarket.value = response.market;
      vendorCount.value = response.vendorCount;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to load market";
      selectedMarket.value = null;
    } finally {
      loading.value = false;
    }
  }

  async function loadVendors(slug: string, filters: VendorFilters = {}) {
    vendorsLoading.value = true;
    error.value = null;
    try {
      const response = await marketsApi.listVendors(slug, filters);
      vendors.value = response.vendors;
      vendorCount.value = response.total;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to load vendors";
    } finally {
      vendorsLoading.value = false;
    }
  }

  function resetSelectedMarket() {
    selectedMarket.value = null;
    vendors.value = [];
    vendorCount.value = 0;
  }

  return {
    markets,
    nearbyMarkets,
    selectedMarket,
    vendors,
    vendorCount,
    total,
    page,
    loading,
    vendorsLoading,
    error,
    hasMarkets,
    loadMarkets,
    loadNearby,
    loadMarketDetail,
    loadVendors,
    resetSelectedMarket,
  };
});

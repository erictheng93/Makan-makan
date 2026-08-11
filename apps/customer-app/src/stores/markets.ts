import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  marketsApi,
  type ListMarketsParams,
  type MarketDetail,
  type MarketExplorationSummary,
  type MarketListItem,
  type MarketVendor,
  type NearbyMarketsParams,
  type VendorFilters,
} from "@/services/marketsApi";

const DEFAULT_VENDOR_LIMIT = 20;
const DEFAULT_MARKET_LIMIT = 20;

export const useMarketsStore = defineStore("markets", () => {
  const markets = ref<MarketListItem[]>([]);
  const nearbyMarkets = ref<Array<MarketListItem & { distanceKm: number }>>([]);
  const selectedMarket = ref<MarketDetail | null>(null);
  const explorationSummary = ref<MarketExplorationSummary | null>(null);
  const vendors = ref<MarketVendor[]>([]);
  const vendorCount = ref(0);
  const vendorPage = ref(1);
  const vendorLimit = ref(DEFAULT_VENDOR_LIMIT);
  const total = ref(0);
  const page = ref(1);
  const marketLimit = ref(DEFAULT_MARKET_LIMIT);
  const loading = ref(false);
  const vendorsLoading = ref(false);
  /**
   * An i18n key, never prose — the views render it through `t()`. A server
   * message baked in here can only ever be in one language.
   */
  const error = ref<string | null>(null);

  const hasMarkets = computed(
    () => markets.value.length > 0 || nearbyMarkets.value.length > 0,
  );
  const hasMoreMarkets = computed(() => markets.value.length < total.value);
  const hasMoreVendors = computed(
    () => vendors.value.length < vendorCount.value,
  );

  async function loadMarkets(params: ListMarketsParams = {}) {
    loading.value = true;
    error.value = null;
    try {
      const response = await marketsApi.listMarkets({
        ...params,
        page: params.page ?? 1,
        limit: params.limit ?? DEFAULT_MARKET_LIMIT,
      });
      markets.value = response.markets;
      total.value = response.total;
      page.value = response.page;
      marketLimit.value = response.limit;
    } catch (e) {
      console.error("Market list load failed:", e);
      error.value = "markets.loadListFailed";
    } finally {
      loading.value = false;
    }
  }

  async function loadMoreMarkets(
    params: Omit<ListMarketsParams, "page" | "limit"> = {},
  ) {
    if (!hasMoreMarkets.value || loading.value) return;

    loading.value = true;
    error.value = null;
    try {
      const response = await marketsApi.listMarkets({
        ...params,
        page: page.value + 1,
        limit: marketLimit.value,
      });
      markets.value = [...markets.value, ...response.markets];
      total.value = response.total;
      page.value = response.page;
      marketLimit.value = response.limit;
    } catch (e) {
      console.error("Market list load failed:", e);
      error.value = "markets.loadListFailed";
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
      console.error("Nearby market load failed:", e);
      error.value = "markets.loadNearbyFailed";
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
      explorationSummary.value = response.explorationSummary ?? null;
    } catch (e) {
      console.error("Market detail load failed:", e);
      error.value = "markets.loadDetailFailed";
      selectedMarket.value = null;
      explorationSummary.value = null;
    } finally {
      loading.value = false;
    }
  }

  async function loadVendors(slug: string, filters: VendorFilters = {}) {
    vendorsLoading.value = true;
    error.value = null;
    try {
      const response = await marketsApi.listVendors(slug, {
        ...filters,
        page: filters.page ?? 1,
        limit: filters.limit ?? DEFAULT_VENDOR_LIMIT,
      });
      vendors.value = response.vendors;
      vendorCount.value = response.total;
      vendorPage.value = response.page;
      vendorLimit.value = response.limit;
    } catch (e) {
      console.error("Market vendor load failed:", e);
      error.value = "markets.loadVendorsFailed";
    } finally {
      vendorsLoading.value = false;
    }
  }

  async function loadMoreVendors(
    slug: string,
    filters: Omit<VendorFilters, "page" | "limit"> = {},
  ) {
    if (!hasMoreVendors.value || vendorsLoading.value) return;

    vendorsLoading.value = true;
    error.value = null;
    try {
      const response = await marketsApi.listVendors(slug, {
        ...filters,
        page: vendorPage.value + 1,
        limit: vendorLimit.value,
      });
      vendors.value = [...vendors.value, ...response.vendors];
      vendorCount.value = response.total;
      vendorPage.value = response.page;
      vendorLimit.value = response.limit;
    } catch (e) {
      console.error("Market vendor load failed:", e);
      error.value = "markets.loadVendorsFailed";
    } finally {
      vendorsLoading.value = false;
    }
  }

  function resetSelectedMarket() {
    selectedMarket.value = null;
    explorationSummary.value = null;
    vendors.value = [];
    vendorCount.value = 0;
    vendorPage.value = 1;
    vendorLimit.value = DEFAULT_VENDOR_LIMIT;
  }

  return {
    markets,
    nearbyMarkets,
    selectedMarket,
    explorationSummary,
    vendors,
    vendorCount,
    hasMoreVendors,
    total,
    page,
    hasMoreMarkets,
    loading,
    vendorsLoading,
    error,
    hasMarkets,
    loadMarkets,
    loadMoreMarkets,
    loadNearby,
    loadMarketDetail,
    loadVendors,
    loadMoreVendors,
    resetSelectedMarket,
  };
});

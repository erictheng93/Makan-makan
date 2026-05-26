<template>
  <section class="space-y-3">
    <form class="space-y-3" @submit.prevent="submitSearch">
      <div class="flex items-center gap-2">
        <input
          v-model="query"
          data-testid="market-product-search-input"
          type="search"
          class="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ios-blue focus:outline-none focus:ring-2 focus:ring-ios-blue/20"
          placeholder="搜尋商品或服務"
        />
        <button
          type="submit"
          class="h-10 shrink-0 rounded-lg bg-ios-blue px-4 text-sm font-medium text-white disabled:bg-gray-300"
          :disabled="loading || !canSearch"
        >
          搜尋
        </button>
      </div>

      <label
        class="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm text-gray-700"
      >
        <input
          v-model="takeawayOnly"
          type="checkbox"
          class="rounded border-gray-300 text-ios-blue focus:ring-ios-blue"
          @change="onTakeawayOnlyChange"
        />
        只看可外帶
      </label>
      <select
        v-if="categoryOptions.length > 0"
        v-model="selectedCategory"
        data-testid="market-product-category-select"
        class="h-9 rounded-lg border border-gray-300 px-3 text-sm text-gray-700 focus:border-ios-blue focus:outline-none focus:ring-2 focus:ring-ios-blue/20"
        @change="searchIfReady"
      >
        <option value="">全部分類</option>
        <option
          v-for="category in categoryOptions"
          :key="category"
          :value="category"
        >
          {{ category }}
        </option>
      </select>
      <select
        v-if="serviceTypeOptions.length > 0"
        v-model="selectedServiceType"
        data-testid="market-service-type-select"
        class="h-9 rounded-lg border border-gray-300 px-3 text-sm text-gray-700 focus:border-ios-blue focus:outline-none focus:ring-2 focus:ring-ios-blue/20"
        @change="searchIfReady"
      >
        <option value="">全部服務</option>
        <option
          v-for="option in serviceTypeOptions"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }} {{ option.count }}
        </option>
      </select>
      <select
        v-model="sortBy"
        data-testid="market-product-sort-select"
        class="h-9 rounded-lg border border-gray-300 px-3 text-sm text-gray-700 focus:border-ios-blue focus:outline-none focus:ring-2 focus:ring-ios-blue/20"
        @change="searchIfReady"
      >
        <option value="price_asc">價格低到高</option>
        <option value="price_desc">價格高到低</option>
        <option value="popular">熱門優先</option>
      </select>
    </form>

    <section
      v-if="hasSearched || hasActiveFilters"
      data-testid="market-product-search-summary"
      class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
    >
      <div class="flex items-center justify-between gap-3">
        <p class="text-xs font-medium text-gray-500">目前條件</p>
        <button
          v-if="hasActiveFilters"
          type="button"
          data-testid="market-product-clear-filters"
          class="h-8 shrink-0 rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700"
          @click="clearFilters"
        >
          清除條件
        </button>
      </div>
      <div
        v-if="activeFilterLabels.length > 0"
        class="mt-2 flex flex-wrap gap-1.5"
      >
        <span
          v-for="label in activeFilterLabels"
          :key="label"
          class="rounded-full bg-white px-2 py-1 text-xs text-gray-700 ring-1 ring-gray-200"
        >
          {{ label }}
        </span>
      </div>
      <p v-else class="mt-1 text-sm text-gray-600">瀏覽此市場所有商品與服務</p>
    </section>

    <div
      v-if="loading && combinedResultCount === 0"
      class="py-8 text-center text-sm text-gray-500"
    >
      搜尋商品中...
    </div>
    <div
      v-else-if="error && combinedResultCount === 0"
      class="py-6 text-center text-sm text-red-500"
    >
      {{ error }}
    </div>
    <div
      v-else-if="hasSearched && combinedResultCount === 0"
      class="space-y-3 py-8 text-center text-sm text-gray-500"
    >
      <p>目前沒有符合條件的商品或服務。</p>
      <p v-if="hasActiveFilters" class="text-xs text-gray-400">
        可清除條件或改用更寬的關鍵字。
      </p>
    </div>
    <div v-else-if="combinedResultCount > 0" class="space-y-2">
      <p class="text-sm text-gray-500">
        顯示 {{ combinedResultCount }} / {{ combinedTotal }} 項商品或服務
      </p>
      <DishResultCard
        v-for="dish in results"
        :key="dish.menuItemId"
        :dish="dish"
        @select="$emit('select', dish)"
        @takeaway="$emit('takeaway', dish)"
      />
      <article
        v-for="service in serviceResults"
        :key="service.serviceItemId"
        class="rounded-lg border border-gray-200 bg-white p-3"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="truncate text-sm font-semibold text-gray-900">
                {{ service.name }}
              </h3>
              <span
                class="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              >
                服務
              </span>
            </div>
            <p class="mt-1 truncate text-sm text-gray-500">
              {{ service.restaurantName }}
            </p>
          </div>
          <span
            v-if="servicePriceLabel(service)"
            class="shrink-0 text-sm font-semibold text-gray-900"
          >
            {{ servicePriceLabel(service) }}
          </span>
        </div>
        <p
          v-if="service.description"
          class="mt-2 line-clamp-2 text-sm leading-5 text-gray-600"
        >
          {{ service.description }}
        </p>
        <div v-if="service.tags.length > 0" class="mt-2 flex flex-wrap gap-1">
          <span
            v-for="tag in service.tags.slice(0, 4)"
            :key="tag"
            class="rounded-full bg-ios-blue/10 px-2 py-0.5 text-xs text-ios-blue"
          >
            {{ tag }}
          </span>
        </div>
        <div class="mt-3 flex items-center justify-between gap-2">
          <p class="text-xs text-gray-500">
            {{ service.isOpen ? "目前營業中" : "目前未營業" }}
          </p>
          <button
            type="button"
            data-testid="service-result-open"
            class="h-9 rounded-lg border border-ios-blue px-3 text-sm font-medium text-ios-blue"
            @click="$emit('selectService', service)"
          >
            查看店鋪
          </button>
        </div>
      </article>
      <p
        v-if="error"
        class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600"
      >
        {{ error }}
      </p>
      <button
        v-if="hasMoreResults"
        type="button"
        data-testid="market-product-load-more"
        class="h-10 w-full rounded-lg border border-ios-blue px-4 text-sm font-medium text-ios-blue disabled:border-gray-300 disabled:text-gray-400"
        :disabled="loading"
        @click="loadMore"
      >
        {{ loading ? "載入中..." : "載入更多" }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import DishResultCard from "@/components/discovery/DishResultCard.vue";
import { useCurrency } from "@/composables/useCurrency";
import {
  discoveryApi,
  type DishSearchResult,
  type ServiceTypeFacet,
  type ServiceSearchResult,
} from "@/services/discoveryApi";

const props = withDefaults(
  defineProps<{
    marketId: string;
    categories?: string[];
    autoLoad?: boolean;
    initialQuery?: string;
    initialCategory?: string;
    initialServiceType?: ServiceTypeFilter | "";
    initialTakeaway?: boolean;
    initialSortBy?: "price_asc" | "price_desc" | "popular";
  }>(),
  {
    categories: () => [],
    autoLoad: true,
    initialQuery: "",
    initialCategory: "",
    initialServiceType: "",
    initialTakeaway: false,
    initialSortBy: "price_asc",
  },
);

const emit = defineEmits<{
  select: [dish: DishSearchResult];
  takeaway: [dish: DishSearchResult];
  selectService: [service: ServiceSearchResult];
  searchStateChange: [
    state: {
      q: string;
      categoryName: string;
      serviceType: ServiceTypeFilter | "";
      takeaway: boolean;
      sortBy: "price_asc" | "price_desc" | "popular";
    },
  ];
}>();

const { formatPrice } = useCurrency();
const query = ref(props.initialQuery);
const takeawayOnly = ref(props.initialTakeaway);
const selectedCategory = ref(props.initialCategory);
const selectedServiceType = ref<ServiceTypeFilter | "">(
  props.initialServiceType,
);
const sortBy = ref<"price_asc" | "price_desc" | "popular">(props.initialSortBy);
const loadedCategories = ref<string[]>([]);
const loadedServiceTypes = ref<ServiceTypeFacet[]>([]);
const results = ref<DishSearchResult[]>([]);
const serviceResults = ref<ServiceSearchResult[]>([]);
const total = ref(0);
const serviceTotal = ref(0);
const loading = ref(false);
const error = ref<string | null>(null);
const hasSearched = ref(false);
const page = ref(1);
const pageSize = 20;
type ServiceTypeFilter =
  | "general"
  | "booking"
  | "pickup"
  | "delivery"
  | "consultation"
  | "rental"
  | "activity";
const serviceTypeDefinitions: Array<{
  value: ServiceTypeFilter;
  label: string;
}> = [
  { value: "general", label: "一般服務" },
  { value: "booking", label: "預約" },
  { value: "pickup", label: "自取" },
  { value: "delivery", label: "外送" },
  { value: "consultation", label: "諮詢" },
  { value: "rental", label: "租借" },
  { value: "activity", label: "活動" },
];
const serviceTypeLabels = new Map(
  serviceTypeDefinitions.map((option) => [option.value, option.label]),
);
const sortLabels: Record<"price_asc" | "price_desc" | "popular", string> = {
  price_asc: "價格低到高",
  price_desc: "價格高到低",
  popular: "熱門優先",
};

const combinedResultCount = computed(
  () => results.value.length + serviceResults.value.length,
);
const combinedTotal = computed(() => total.value + serviceTotal.value);
const hasMoreResults = computed(
  () =>
    results.value.length < total.value ||
    serviceResults.value.length < serviceTotal.value,
);
const categoryOptions = computed(() =>
  props.categories.length > 0 ? props.categories : loadedCategories.value,
);
const serviceTypeOptions = computed(() =>
  loadedServiceTypes.value.map((facet) => ({
    value: facet.serviceType,
    label: serviceTypeLabels.get(facet.serviceType) ?? facet.serviceType,
    count: facet.count,
  })),
);
const canSearch = computed(
  () =>
    props.marketId.length > 0 ||
    query.value.trim().length > 0 ||
    selectedCategory.value.length > 0,
);
const activeFilterLabels = computed(() => {
  const labels: string[] = [];
  const trimmed = query.value.trim();

  if (trimmed.length > 0) labels.push(`關鍵字：${trimmed}`);
  if (selectedCategory.value.length > 0) {
    labels.push(`分類：${selectedCategory.value}`);
  }
  const serviceType = selectedServiceType.value;
  if (serviceType !== "") {
    labels.push(`服務：${serviceTypeLabels.get(serviceType) ?? serviceType}`);
  }
  if (takeawayOnly.value) labels.push("只看可外帶");
  if (sortBy.value !== "price_asc") {
    labels.push(`排序：${sortLabels[sortBy.value]}`);
  }

  return labels;
});
const hasActiveFilters = computed(() => activeFilterLabels.value.length > 0);

async function submitSearch() {
  if (!canSearch.value) return;

  page.value = 1;
  results.value = [];
  serviceResults.value = [];
  total.value = 0;
  serviceTotal.value = 0;
  emitSearchState();
  await fetchResults({ append: false });
}

async function loadMore() {
  if (!hasMoreResults.value || loading.value) return;

  page.value += 1;
  await fetchResults({ append: true });
}

async function fetchResults({ append }: { append: boolean }) {
  const trimmed = query.value.trim();
  if (!canSearch.value) return;

  loading.value = true;
  error.value = null;
  hasSearched.value = true;

  try {
    const [response, serviceResponse] = await Promise.all([
      discoveryApi.searchDishes({
        q: trimmed || undefined,
        marketId: props.marketId,
        categoryName: selectedCategory.value || undefined,
        sortBy: sortBy.value,
        takeaway: takeawayOnly.value ? true : undefined,
        page: page.value,
        limit: pageSize,
      }),
      trimmed || props.marketId
        ? discoveryApi.searchServices({
            q: trimmed || undefined,
            marketId: props.marketId,
            serviceType: selectedServiceType.value || undefined,
            takeaway: takeawayOnly.value ? true : undefined,
            page: page.value,
            limit: pageSize,
          })
        : Promise.resolve({ results: [], total: 0 }),
    ]);
    results.value = append
      ? [...results.value, ...response.results]
      : response.results;
    serviceResults.value = append
      ? [...serviceResults.value, ...serviceResponse.results]
      : serviceResponse.results;
    total.value = response.total;
    serviceTotal.value = serviceResponse.total;
  } catch (searchError) {
    error.value =
      searchError instanceof Error ? searchError.message : "搜尋商品失敗";
    if (append) {
      page.value -= 1;
    } else {
      results.value = [];
      serviceResults.value = [];
      total.value = 0;
      serviceTotal.value = 0;
    }
  } finally {
    loading.value = false;
  }
}

function searchIfReady() {
  if (hasSearched.value && canSearch.value) {
    submitSearch();
  }
}

function onTakeawayOnlyChange() {
  loadCategories();
  loadServiceTypes();
  searchIfReady();
}

function clearFilters() {
  query.value = "";
  takeawayOnly.value = false;
  selectedCategory.value = "";
  selectedServiceType.value = "";
  sortBy.value = "price_asc";
  loadCategories();
  loadServiceTypes();
  submitSearch();
}

function emitSearchState() {
  emit("searchStateChange", {
    q: query.value.trim(),
    categoryName: selectedCategory.value,
    serviceType: selectedServiceType.value,
    takeaway: takeawayOnly.value,
    sortBy: sortBy.value,
  });
}

async function loadCategories() {
  if (props.categories.length > 0) return;

  try {
    const response = await discoveryApi.listCategories({
      marketId: props.marketId,
      takeaway: takeawayOnly.value ? true : undefined,
    });
    loadedCategories.value = response.categories;
  } catch (categoryError) {
    console.error("Failed to load market product categories:", categoryError);
  }
}

async function loadServiceTypes() {
  try {
    const response = await discoveryApi.listServiceTypes({
      marketId: props.marketId,
      takeaway: takeawayOnly.value ? true : undefined,
    });
    loadedServiceTypes.value = response.serviceTypes;
  } catch (serviceTypeError) {
    console.error("Failed to load market service types:", serviceTypeError);
    loadedServiceTypes.value = [];
  }
}

function servicePriceLabel(service: ServiceSearchResult) {
  if (service.priceLabel) return service.priceLabel;
  if (typeof service.priceCents === "number") {
    return formatPrice(service.priceCents / 100);
  }
  return "";
}

onMounted(loadCategories);
onMounted(loadServiceTypes);
onMounted(() => {
  if (props.autoLoad) {
    submitSearch();
  }
});

watch(
  () => props.marketId,
  () => {
    selectedCategory.value = "";
    selectedServiceType.value = "";
    loadedCategories.value = [];
    loadedServiceTypes.value = [];
    loadCategories();
    loadServiceTypes();
    if (props.autoLoad) {
      submitSearch();
    }
  },
);
</script>

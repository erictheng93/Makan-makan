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
          @change="searchIfReady"
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

    <div
      v-if="loading && results.length === 0"
      class="py-8 text-center text-sm text-gray-500"
    >
      搜尋商品中...
    </div>
    <div
      v-else-if="error && results.length === 0"
      class="py-6 text-center text-sm text-red-500"
    >
      {{ error }}
    </div>
    <div
      v-else-if="hasSearched && results.length === 0"
      class="py-8 text-center text-sm text-gray-500"
    >
      目前沒有符合條件的商品或服務。
    </div>
    <div v-else-if="results.length > 0" class="space-y-2">
      <p class="text-sm text-gray-500">
        顯示 {{ results.length }} / {{ total }} 項商品或服務
      </p>
      <DishResultCard
        v-for="dish in results"
        :key="dish.menuItemId"
        :dish="dish"
        @select="$emit('select', dish)"
        @takeaway="$emit('takeaway', dish)"
      />
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
import { discoveryApi, type DishSearchResult } from "@/services/discoveryApi";

const props = withDefaults(
  defineProps<{
    marketId: string;
    categories?: string[];
  }>(),
  {
    categories: () => [],
  },
);

defineEmits<{
  select: [dish: DishSearchResult];
  takeaway: [dish: DishSearchResult];
}>();

const query = ref("");
const takeawayOnly = ref(false);
const selectedCategory = ref("");
const sortBy = ref<"price_asc" | "price_desc" | "popular">("price_asc");
const loadedCategories = ref<string[]>([]);
const results = ref<DishSearchResult[]>([]);
const total = ref(0);
const loading = ref(false);
const error = ref<string | null>(null);
const hasSearched = ref(false);
const page = ref(1);
const pageSize = 20;

const hasMoreResults = computed(() => results.value.length < total.value);
const categoryOptions = computed(() =>
  props.categories.length > 0 ? props.categories : loadedCategories.value,
);
const canSearch = computed(
  () => query.value.trim().length > 0 || selectedCategory.value.length > 0,
);

async function submitSearch() {
  if (!canSearch.value) return;

  page.value = 1;
  results.value = [];
  total.value = 0;
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
    const response = await discoveryApi.searchDishes({
      q: trimmed || undefined,
      marketId: props.marketId,
      categoryName: selectedCategory.value || undefined,
      sortBy: sortBy.value,
      takeaway: takeawayOnly.value ? true : undefined,
      page: page.value,
      limit: pageSize,
    });
    results.value = append
      ? [...results.value, ...response.results]
      : response.results;
    total.value = response.total;
  } catch (searchError) {
    error.value =
      searchError instanceof Error ? searchError.message : "搜尋商品失敗";
    if (append) {
      page.value -= 1;
    } else {
      results.value = [];
      total.value = 0;
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

async function loadCategories() {
  if (props.categories.length > 0) return;

  try {
    const response = await discoveryApi.listCategories({
      marketId: props.marketId,
    });
    loadedCategories.value = response.categories;
  } catch (categoryError) {
    console.error("Failed to load market product categories:", categoryError);
  }
}

onMounted(loadCategories);

watch(
  () => props.marketId,
  () => {
    selectedCategory.value = "";
    loadedCategories.value = [];
    loadCategories();
  },
);
</script>

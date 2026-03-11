<template>
  <div class="min-h-screen bg-gray-50">
    <!-- 頂部固定導航 -->
    <nav class="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-md mx-auto">
        <!-- 餐廳資訊區域 -->
        <div class="px-4 py-3 border-b border-gray-100">
          <div class="flex items-center justify-between">
            <button
              class="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors"
              @click="router.push('/')"
            >
              <svg
                class="w-5 h-5"
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

            <div class="flex-1 text-center">
              <h1 class="font-semibold text-gray-900">
                {{ restaurant?.name || t("common.loading") }}
              </h1>
              <p class="text-sm text-gray-500">
                {{ t("orderTracking.tableNumber") }} {{ tableId }}
              </p>
            </div>

            <button
              class="relative w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors"
              @click="
                router.push(`/restaurant/${restaurantId}/table/${tableId}/cart`)
              "
            >
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4m2.6 8L6 2H3m4 11a3 3 0 100 6 3 3 0 000-6zm10 0a3 3 0 100 6 3 3 0 000-6z"
                />
              </svg>
              <!-- 購物車數量徽章 -->
              <div
                v-if="cartStore.itemCount > 0"
                class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium"
              >
                {{ cartStore.itemCount }}
              </div>
            </button>
          </div>
        </div>

        <!-- 分類導航 -->
        <div v-if="categories.length > 0" class="px-4 py-3">
          <div class="flex space-x-2 overflow-x-auto scrollbar-hide">
            <button
              v-for="category in categories"
              :key="category.id"
              :class="[
                'flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors',
                activeCategoryId === category.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
              ]"
              @click="scrollToCategory(category.id)"
            >
              {{ category.name }}
            </button>
          </div>
        </div>
      </div>
    </nav>

    <!-- 主要內容區域 -->
    <main class="max-w-md mx-auto pb-20">
      <!-- 載入狀態 -->
      <div v-if="isLoading" class="p-8 text-center">
        <div
          class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"
        />
        <p class="text-gray-600">{{ t("shopMenu.loadingMenu") }}</p>
      </div>

      <!-- 錯誤狀態 -->
      <div v-else-if="error" class="p-8 text-center">
        <div
          class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <svg
            class="w-8 h-8 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 mb-2">
          {{ t("shopMenu.loadFailed") }}
        </h3>
        <p class="text-gray-600 mb-4">
          {{ error }}
        </p>
        <button
          class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          @click="() => refetch()"
        >
          {{ t("shopMenu.reload") }}
        </button>
      </div>

      <!-- 菜單內容 -->
      <div v-else-if="menuStructure" class="px-4 space-y-8">
        <!-- 搜尋框 -->
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('menu.searchPlaceholder')"
            class="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          />
          <svg
            class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <!-- 推薦菜品 -->
        <section v-if="featuredItems.length > 0" class="mb-8">
          <h2 class="text-xl font-bold text-gray-900 mb-4">
            🌟 {{ t("menu.featured") }}
          </h2>
          <div class="grid gap-4">
            <MenuItemCard
              v-for="item in featuredItems"
              :key="item.id"
              :item="item"
              :is-featured="true"
              @add-to-cart="handleAddToCart"
              @view-details="handleViewDetails"
            />
          </div>
        </section>

        <!-- 分類菜單 -->
        <section
          v-for="category in filteredCategories"
          :id="`category-${category.id}`"
          :key="category.id"
          class="scroll-mt-32"
        >
          <h2
            class="text-xl font-bold text-gray-900 mb-4 sticky top-32 bg-gray-50 py-2 z-10"
          >
            {{ category.name }}
            <span
              v-if="category.description"
              class="text-sm font-normal text-gray-500 block"
            >
              {{ category.description }}
            </span>
          </h2>

          <div class="grid gap-4">
            <MenuItemCard
              v-for="item in getItemsByCategory(category.id)"
              :key="item.id"
              :item="item"
              @add-to-cart="handleAddToCart"
              @view-details="handleViewDetails"
            />
          </div>

          <!-- 分類內無菜品提示 -->
          <div
            v-if="getItemsByCategory(category.id).length === 0"
            class="py-8 text-center text-gray-500"
          >
            <p>{{ t("shopMenu.noItemsInCategory") }}</p>
          </div>
        </section>

        <!-- 搜尋無結果 -->
        <div
          v-if="searchQuery && filteredCategories.length === 0"
          class="py-12 text-center"
        >
          <div
            class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <svg
              class="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">
            {{ t("menu.noResults") }}
          </h3>
          <p class="text-gray-600">
            {{ t("menu.search") }}
          </p>
        </div>
      </div>
    </main>

    <!-- 底部固定購物車按鈕 -->
    <div
      v-if="cartStore.itemCount > 0"
      class="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto"
    >
      <button
        class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 px-6 rounded-2xl shadow-lg transition-colors flex items-center justify-between"
        @click="
          router.push(`/restaurant/${restaurantId}/table/${tableId}/cart`)
        "
      >
        <div class="flex items-center space-x-3">
          <div
            class="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center"
          >
            <span class="text-sm font-bold">{{ cartStore.itemCount }}</span>
          </div>
          <span>{{ t("shopMenu.viewCart") }}</span>
        </div>
        <div class="text-lg font-bold">
          ${{ formatPrice(cartStore.subtotal) }}
        </div>
      </button>
    </div>

    <!-- 菜品詳情彈窗 -->
    <MenuItemModal
      v-if="selectedItem"
      :item="selectedItem"
      :show="showItemModal"
      @close="showItemModal = false"
      @add-to-cart="handleAddToCart"
    />

    <!-- 客製化選項彈窗 -->
    <CustomizationModal
      v-if="customizingItem"
      :item="customizingItem"
      :show="showCustomizationModal"
      @close="showCustomizationModal = false"
      @add-to-cart="handleAddToCart"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { useToast } from "vue-toastification";
import { useI18n } from "@/composables/useI18n";
import { useAppStore } from "@/stores/app";
import { useCartStore } from "@/stores/cart";
import MenuItemCard from "@/components/MenuItemCard.vue";
import MenuItemModal from "@/components/MenuItemModal.vue";
import CustomizationModal from "@/components/CustomizationModal.vue";
import { menuApi } from "@/services/menuApi";
import { formatPrice } from "@/utils/format";
import type {
  MenuItem,
  SelectedCustomizations,
} from "@makanmakan/shared-types";

// Props
const props = defineProps<{
  restaurantId: string;
  tableId: number;
}>();

// Composables
const router = useRouter();
const toast = useToast();
const { t, tWithParams } = useI18n();
const appStore = useAppStore();
const cartStore = useCartStore();

// State
const searchQuery = ref("");
const activeCategoryId = ref<number | null>(null);
const selectedItem = ref<MenuItem | null>(null);
const customizingItem = ref<MenuItem | null>(null);
const showItemModal = ref(false);
const showCustomizationModal = ref(false);

// 初始化購物車
onMounted(() => {
  cartStore.initializeCart(props.restaurantId, props.tableId);
});

// API Queries
const { data: restaurant, isLoading: isLoadingRestaurant } = useQuery({
  queryKey: ["restaurant", props.restaurantId],
  queryFn: () => menuApi.getRestaurant(props.restaurantId),
  staleTime: 5 * 60 * 1000, // 5分鐘
});

const {
  data: menuStructure,
  isLoading: isLoadingMenu,
  error: menuError,
  refetch,
} = useQuery({
  queryKey: ["menu", props.restaurantId],
  queryFn: () => menuApi.getMenu(props.restaurantId),
  staleTime: 2 * 60 * 1000, // 2分鐘
  refetchOnWindowFocus: true,
});

// Computed
const isLoading = computed(
  () => isLoadingRestaurant.value || isLoadingMenu.value,
);
const error = computed(() => menuError.value?.message || null);

const categories = computed(() => menuStructure.value?.categories || []);
const menuItems = computed(() => menuStructure.value?.menuItems || []);

const featuredItems = computed(() =>
  menuItems.value.filter((item: any) => item.isFeatured && item.isAvailable),
);

const filteredCategories = computed(() => {
  if (!searchQuery.value.trim()) {
    return categories.value.filter(
      (category) => getItemsByCategory(category.id).length > 0,
    );
  }

  const query = searchQuery.value.toLowerCase().trim();
  return categories.value.filter((category: any) => {
    const categoryItems = getItemsByCategory(category.id);
    return categoryItems.some(
      (item: any) =>
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query),
    );
  });
});

// Methods
const getItemsByCategory = (categoryId: number) => {
  let items = menuItems.value.filter(
    (item: any) => item.categoryId === categoryId && item.isAvailable,
  );

  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim();
    items = items.filter(
      (item: any) =>
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query),
    );
  }

  return items.sort((a: any, b: any) => a.sortOrder - b.sortOrder);
};

const scrollToCategory = (categoryId: number) => {
  activeCategoryId.value = categoryId;
  const element = document.getElementById(`category-${categoryId}`);
  if (element) {
    element.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
};

const handleAddToCart = (data: {
  item: MenuItem;
  quantity: number;
  customizations?: SelectedCustomizations;
  notes?: string;
}) => {
  cartStore.addItem(data.item, data.quantity, data.customizations, data.notes);

  toast.success(
    tWithParams("toast.itemAdded", {
      name: data.item.name,
      quantity: data.quantity,
    }),
  );

  // 關閉彈窗
  showItemModal.value = false;
  showCustomizationModal.value = false;
  selectedItem.value = null;
  customizingItem.value = null;
};

const handleViewDetails = (item: MenuItem) => {
  selectedItem.value = item;
  showItemModal.value = true;
};

// 監聽滾動位置更新活躍分類
const updateActiveCategoryOnScroll = () => {
  const sections = categories.value.map((category: any) => ({
    id: category.id,
    element: document.getElementById(`category-${category.id}`),
  }));

  const _scrollTop = window.pageYOffset;
  const windowHeight = window.innerHeight;

  for (let i = sections.length - 1; i >= 0; i--) {
    const section = sections[i];
    if (section.element) {
      const rect = section.element.getBoundingClientRect();
      if (rect.top <= windowHeight / 3) {
        activeCategoryId.value = section.id;
        break;
      }
    }
  }
};

onMounted(() => {
  window.addEventListener("scroll", updateActiveCategoryOnScroll);

  // 設定餐廳上下文
  if (restaurant.value) {
    appStore.setRestaurantContext(restaurant.value, props.tableId);
  }
});

// 監聽餐廳資料變化
watch(restaurant, (newRestaurant) => {
  if (newRestaurant) {
    appStore.setRestaurantContext(newRestaurant, props.tableId);
  }
});
</script>

<style scoped>
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>

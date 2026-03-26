<template>
  <div class="min-h-screen bg-ios-bg">
    <!-- 頂部固定導航 -->
    <nav class="sticky top-0 z-40 bg-white/80 backdrop-blur-xl shadow-card-sm">
      <div
        class="max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto px-4 md:px-6 lg:px-8"
      >
        <!-- 餐廳資訊區域 -->
        <div class="px-5 py-3">
          <div class="flex items-center justify-between">
            <button
              class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-ios-text active:scale-95 transition-transform duration-150"
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
              <h1 class="font-semibold text-ios-text">
                {{ restaurant?.name || t("common.loading") }}
              </h1>
              <p class="text-sm text-ios-secondary">
                {{ t("orderTracking.tableNumber") }} {{ tableId }}
              </p>
            </div>

            <button
              class="relative w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-ios-text active:scale-95 transition-transform duration-150"
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
                class="absolute -top-1 -right-1 w-5 h-5 bg-ios-red text-white text-xs rounded-full flex items-center justify-center font-medium"
              >
                {{ cartStore.itemCount }}
              </div>
            </button>
          </div>
        </div>

        <!-- 分類導航 -->
        <div v-if="categories.length > 0" class="px-4 py-3">
          <div
            class="flex space-x-2 overflow-x-auto scrollbar-hide md:flex-wrap md:overflow-x-visible md:gap-2 md:space-x-0"
          >
            <button
              v-for="category in categories"
              :key="category.id"
              :class="[
                'flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors',
                activeCategoryId === category.id
                  ? 'bg-ios-blue text-white shadow-card-sm'
                  : 'bg-gray-100 text-ios-secondary active:bg-gray-200',
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
    <main
      class="max-w-lg md:max-w-3xl lg:max-w-6xl mx-auto pb-20 px-4 md:px-6 lg:px-8"
    >
      <!-- 載入狀態 -->
      <div v-if="isLoading" class="p-8 text-center">
        <div
          class="animate-spin rounded-full h-12 w-12 border-2 border-ios-blue/20 border-t-ios-blue mx-auto mb-4"
        />
        <p class="text-ios-secondary">{{ t("shopMenu.loadingMenu") }}</p>
      </div>

      <!-- 錯誤狀態 -->
      <div v-else-if="error" class="p-8 text-center">
        <div
          class="w-16 h-16 bg-ios-red/15 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <svg
            class="w-8 h-8 text-ios-red"
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
        <h3 class="text-lg font-medium text-ios-text mb-2">
          {{ t("shopMenu.loadFailed") }}
        </h3>
        <p class="text-ios-secondary mb-4">
          {{ error }}
        </p>
        <button
          class="px-6 py-2.5 bg-ios-blue text-white rounded-full active:scale-[0.98] transition-transform duration-150"
          @click="() => refetch()"
        >
          {{ t("shopMenu.reload") }}
        </button>
      </div>

      <!-- 菜單內容 -->
      <div v-else-if="menuStructure" class="lg:flex lg:gap-6 lg:items-start">
        <div class="flex-1 min-w-0 px-5 space-y-6">
          <!-- 搜尋框 -->
          <div class="relative">
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="t('menu.searchPlaceholder')"
              class="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl text-ios-text placeholder:text-ios-tertiary border-0 focus:ring-2 focus:ring-ios-blue/30 focus:bg-white transition-all duration-200"
            />
            <svg
              class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ios-secondary"
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
            <h2 class="text-xl font-semibold text-ios-text mb-4">
              {{ t("menu.featured") }}
            </h2>
            <div
              class="flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-5 px-5"
            >
              <MenuItemCard
                v-for="(item, index) in featuredItems"
                :key="item.id"
                :item="item"
                :is-featured="true"
                class="animate-slide-up min-w-[280px] md:min-w-[260px] snap-start flex-shrink-0"
                :style="{
                  animationDelay: `${index * 50}ms`,
                  animationFillMode: 'both',
                }"
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
            <div
              class="sticky bg-ios-bg/95 backdrop-blur-sm py-3 z-10 -mx-5 px-5"
              :class="categories.length > 0 ? 'top-32' : 'top-16'"
            >
              <h2 class="text-xl font-semibold text-ios-text">
                {{ category.name }}
              </h2>
              <p
                v-if="category.description"
                class="text-sm text-ios-secondary mt-0.5"
              >
                {{ category.description }}
              </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <MenuItemCard
                v-for="(item, index) in getItemsByCategory(category.id)"
                :key="item.id"
                :item="item"
                class="animate-slide-up"
                :style="{
                  animationDelay: `${index * 50}ms`,
                  animationFillMode: 'both',
                }"
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
            <h3 class="text-lg font-medium text-ios-text mb-2">
              {{ t("menu.noResults") }}
            </h3>
            <p class="text-ios-secondary">
              {{ t("menu.search") }}
            </p>
          </div>
        </div>

        <!-- Right: Desktop cart panel -->
        <Transition name="slide-in-right">
          <DesktopCartPanel
            v-if="isDesktop && cartStore.itemCount > 0"
            :items="cartStore.items"
            :item-count="cartStore.itemCount"
            :subtotal="cartStore.subtotal"
            @checkout="
              router.push(`/restaurant/${restaurantId}/table/${tableId}/cart`)
            "
            @remove-item="cartStore.removeItem($event)"
            @update-quantity="(id, qty) => cartStore.updateQuantity(id, qty)"
          />
        </Transition>
      </div>
    </main>

    <!-- 底部固定購物車按鈕 -->
    <div
      v-if="cartStore.itemCount > 0"
      class="fixed bottom-4 left-4 right-4 z-50 max-w-lg mx-auto lg:hidden"
    >
      <button
        class="w-full bg-ios-blue text-white font-semibold py-4 px-6 rounded-full shadow-card-lg active:scale-[0.98] transition-transform duration-150 flex items-center justify-between"
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
          {{ formatPrice(cartStore.subtotal) }}
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
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { useToast } from "vue-toastification";
import { useI18n } from "@/composables/useI18n";
import { useAppStore } from "@/stores/app";
import { useCartStore } from "@/stores/cart";
import MenuItemCard from "@/components/MenuItemCard.vue";
import MenuItemModal from "@/components/MenuItemModal.vue";
import CustomizationModal from "@/components/CustomizationModal.vue";
import DesktopCartPanel from "@/components/DesktopCartPanel.vue";
import { useIsDesktop } from "@/composables/useBreakpoint";
import { menuApi } from "@/services/menuApi";
import { useCurrency } from "@/composables/useCurrency";
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
const isDesktop = useIsDesktop();
const { formatPrice } = useCurrency();

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

onUnmounted(() => {
  window.removeEventListener("scroll", updateActiveCategoryOnScroll);
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

.slide-in-right-enter-active {
  transition: all 300ms ease-out;
}
.slide-in-right-leave-active {
  transition: all 200ms ease-in;
}
.slide-in-right-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.slide-in-right-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>

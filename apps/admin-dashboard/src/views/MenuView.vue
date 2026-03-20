<template>
  <div class="menu-view">
    <!-- 頁面標題和操作 -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">{{ t("menu.title") }}</h1>
        <p class="text-gray-600">{{ t("menu.subtitle") }}</p>
      </div>
      <div class="flex space-x-4">
        <button
          class="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          @click="showCategoryModal = true"
        >
          <PlusIcon class="h-4 w-4 mr-2" />
          {{ t("menu.addCategory") }}
        </button>
        <button
          class="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          @click="showMenuItemModal = true"
        >
          <PlusIcon class="h-4 w-4 mr-2" />
          {{ t("menu.addItem") }}
        </button>
      </div>
    </div>

    <!-- 搜索和篩選 -->
    <div class="bg-white rounded-lg shadow mb-6">
      <div class="p-6">
        <div class="flex flex-col sm:flex-row gap-4">
          <div class="relative flex-1">
            <MagnifyingGlassIcon
              class="absolute left-3 top-3 h-4 w-4 text-gray-400"
            />
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="t('menu.searchPlaceholder')"
              class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            v-model="categoryFilter"
            class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">{{ t("menu.allCategories") }}</option>
            <option
              v-for="category in categories"
              :key="category.id"
              :value="category.id"
            >
              {{ category.name }}
            </option>
          </select>
          <select
            v-model="statusFilter"
            class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">{{ t("menu.allStatus") }}</option>
            <option value="active">{{ t("menu.statusActive") }}</option>
            <option value="inactive">{{ t("menu.statusInactive") }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 分類標籤 -->
    <div class="mb-6">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="category in categories"
          :key="category.id"
          :class="[
            'px-4 py-2 rounded-full text-sm font-medium transition-colors',
            categoryFilter === category.id.toString()
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
          ]"
          @click="
            categoryFilter =
              categoryFilter === category.id.toString()
                ? ''
                : category.id.toString()
          "
        >
          {{ category.name }}
          <span class="ml-2 text-xs opacity-75">
            ({{ getMenuItemsInCategory(category.id).length }})
          </span>
        </button>
      </div>
    </div>

    <!-- 虛擬滾動菜品網格 -->
    <VirtualMenuGrid
      v-if="filteredMenuItems.length > 0"
      :menu-items="filteredMenuItems"
      :item-height="MENU_ITEM_HEIGHT"
      :container-height="MENU_CONTAINER_HEIGHT"
      :columns-count="4"
      :buffer-size="3"
    >
      <template #default="{ menuItem: item }">
        <div
          class="bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
        >
          <!-- 菜品圖片 - 🚀 使用優化圖片組件 -->
          <div class="relative">
            <OptimizedImage
              :src="
                item.imageUrl ||
                'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27600%27 height=%27400%27 fill=%27%23e5e7eb%27%3E%3Crect width=%27600%27 height=%27400%27/%3E%3Ctext x=%27300%27 y=%27200%27 text-anchor=%27middle%27 dominant-baseline=%27central%27 font-family=%27system-ui%27 font-size=%2748%27 fill=%27%239ca3af%27%3E🍽️%3C/text%3E%3C/svg%3E'
              "
              :alt="item.name"
              :width="600"
              :height="400"
              format="auto"
              fit="cover"
              :lazy="true"
              :fade-in="true"
              image-class="w-full h-48 object-cover rounded-t-lg"
            />
            <div class="absolute top-2 right-2">
              <span
                :class="[
                  'px-2 py-1 rounded-full text-xs font-medium',
                  item.isAvailable
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800',
                ]"
              >
                {{ item.isAvailable ? t("menu.available") : t("menu.soldOut") }}
              </span>
            </div>
            <div v-if="item.isFeatured" class="absolute top-2 left-2">
              <span
                class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium"
              >
                {{ t("menu.featured") }}
              </span>
            </div>
          </div>

          <!-- 菜品信息 -->
          <div class="p-4">
            <div class="flex justify-between items-start mb-2">
              <h3 class="text-lg font-semibold text-gray-900 line-clamp-1">
                {{ item.name }}
              </h3>
              <span class="text-lg font-bold text-blue-600">{{
                formatPrice(item.price)
              }}</span>
            </div>

            <p class="text-sm text-gray-600 mb-3 line-clamp-2">
              {{ item.description }}
            </p>

            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-500">
                {{ getCategoryName(item.categoryId) }}
              </span>
              <div class="flex space-x-2">
                <button
                  class="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                  :title="t('common.edit')"
                  @click="editMenuItem(item)"
                >
                  <PencilIcon class="h-4 w-4" />
                </button>
                <button
                  :class="[
                    'p-1 transition-colors',
                    item.isAvailable
                      ? 'text-gray-400 hover:text-red-600'
                      : 'text-gray-400 hover:text-green-600',
                  ]"
                  :title="
                    item.isAvailable
                      ? t('menu.statusInactive')
                      : t('menu.statusActive')
                  "
                  @click="toggleMenuItemStatus(item)"
                >
                  <component
                    :is="item.isAvailable ? EyeSlashIcon : EyeIcon"
                    class="h-4 w-4"
                  />
                </button>
                <button
                  class="p-1 text-gray-400 hover:text-red-600 transition-colors"
                  :title="t('common.delete')"
                  @click="deleteMenuItem(item)"
                >
                  <TrashIcon class="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </VirtualMenuGrid>

    <!-- 空狀態 -->
    <div v-if="filteredMenuItems.length === 0" class="text-center py-12">
      <CakeIcon class="mx-auto h-12 w-12 text-gray-400" />
      <h3 class="mt-2 text-sm font-medium text-gray-900">
        {{ t("menu.empty.title") }}
      </h3>
      <p class="mt-1 text-sm text-gray-500">{{ t("menu.empty.subtitle") }}</p>
      <button
        class="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        @click="showMenuItemModal = true"
      >
        <PlusIcon class="h-4 w-4 mr-2" />
        {{ t("menu.addItem") }}
      </button>
    </div>

    <!-- 分類管理模態框 -->
    <div v-if="showCategoryModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div
          class="fixed inset-0 bg-black opacity-30"
          @click="closeCategoryModal"
        />
        <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          <div class="p-6">
            <h3 class="text-lg font-semibold mb-4">
              {{
                editingCategory ? t("menu.editCategory") : t("menu.addCategory")
              }}
            </h3>

            <form @submit.prevent="saveCategory">
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    {{ t("menu.form.categoryName") }}
                    <span class="text-red-500">*</span>
                  </label>
                  <input
                    v-model="categoryForm.name"
                    type="text"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">{{
                    t("menu.form.nameEn")
                  }}</label>
                  <input
                    v-model="categoryForm.nameEn"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">{{
                    t("menu.form.description")
                  }}</label>
                  <textarea
                    v-model="categoryForm.description"
                    rows="3"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">{{
                    t("menu.form.sortOrder")
                  }}</label>
                  <input
                    v-model.number="categoryForm.sortOrder"
                    type="number"
                    min="0"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div class="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  @click="closeCategoryModal"
                >
                  {{ t("common.cancel") }}
                </button>
                <button
                  type="submit"
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {{
                    editingCategory ? t("menu.form.update") : t("menu.form.add")
                  }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- 菜品管理模態框 -->
    <div v-if="showMenuItemModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div
          class="fixed inset-0 bg-black opacity-30"
          @click="closeMenuItemModal"
        />
        <div
          class="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          <div class="p-6">
            <h3 class="text-lg font-semibold mb-4">
              {{ editingMenuItem ? t("menu.editItem") : t("menu.addItem") }}
            </h3>

            <form @submit.prevent="saveMenuItem">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="md:col-span-2">
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    {{ t("menu.form.itemName") }}
                    <span class="text-red-500">*</span>
                  </label>
                  <input
                    v-model="menuItemForm.name"
                    type="text"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">{{
                    t("menu.form.nameEn")
                  }}</label>
                  <input
                    v-model="menuItemForm.nameEn"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    {{ t("menu.form.price") }}
                    <span class="text-red-500">*</span>
                  </label>
                  <input
                    v-model.number="menuItemForm.price"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    {{ t("menu.form.category") }}
                    <span class="text-red-500">*</span>
                  </label>
                  <select
                    v-model="menuItemForm.categoryId"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">
                      {{ t("menu.form.selectCategory") }}
                    </option>
                    <option
                      v-for="category in categories"
                      :key="category.id"
                      :value="category.id"
                    >
                      {{ category.name }}
                    </option>
                  </select>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">{{
                    t("menu.form.imageUrl")
                  }}</label>
                  <input
                    v-model="menuItemForm.imageUrl"
                    type="url"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div class="md:col-span-2">
                  <label class="block text-sm font-medium text-gray-700 mb-1">{{
                    t("menu.form.description")
                  }}</label>
                  <textarea
                    v-model="menuItemForm.description"
                    rows="3"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">{{
                    t("menu.form.sortOrder")
                  }}</label>
                  <input
                    v-model.number="menuItemForm.sortOrder"
                    type="number"
                    min="0"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div class="flex items-center space-x-4">
                  <label class="flex items-center">
                    <input
                      v-model="menuItemForm.isFeatured"
                      type="checkbox"
                      class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span class="ml-2 text-sm text-gray-700">{{
                      t("menu.form.featuredItem")
                    }}</span>
                  </label>
                  <label class="flex items-center">
                    <input
                      v-model="menuItemForm.isAvailable"
                      type="checkbox"
                      class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span class="ml-2 text-sm text-gray-700">{{
                      t("menu.form.isAvailable")
                    }}</span>
                  </label>
                </div>
              </div>

              <div class="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  @click="closeMenuItemModal"
                >
                  {{ t("common.cancel") }}
                </button>
                <button
                  type="submit"
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {{
                    editingMenuItem ? t("menu.form.update") : t("menu.form.add")
                  }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useI18n } from "@/i18n";
import VirtualMenuGrid from "@/components/VirtualMenuGrid.vue";
import OptimizedImage from "@/components/OptimizedImage.vue";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  CakeIcon,
} from "@heroicons/vue/24/outline";
import { useCurrency } from "@/composables/useCurrency";

const { t } = useI18n();
const { formatPrice } = useCurrency();

// 虛擬滾動配置
const MENU_ITEM_HEIGHT = 330; // 每個菜品卡片的高度 (圖片 192px + 內容 138px)
const MENU_CONTAINER_HEIGHT = 800; // 容器高度 (px)

// 響應式數據
const searchQuery = ref("");
const categoryFilter = ref("");
const statusFilter = ref("");
const showCategoryModal = ref(false);
const showMenuItemModal = ref(false);
const editingCategory = ref<any>(null);
const editingMenuItem = ref<any>(null);

// 模擬數據
const categories = ref([
  {
    id: 1,
    name: "熱飲",
    nameEn: "Hot Beverages",
    description: "各式熱飲茶類咖啡",
    sortOrder: 1,
    status: "active",
  },
  {
    id: 2,
    name: "冷飲",
    nameEn: "Cold Beverages",
    description: "新鮮果汁冰涼飲品",
    sortOrder: 2,
    status: "active",
  },
  {
    id: 3,
    name: "主食",
    nameEn: "Main Dishes",
    description: "招牌主食類",
    sortOrder: 3,
    status: "active",
  },
  {
    id: 4,
    name: "小食",
    nameEn: "Snacks",
    description: "精緻小點心",
    sortOrder: 4,
    status: "active",
  },
  {
    id: 5,
    name: "甜品",
    nameEn: "Desserts",
    description: "傳統甜品",
    sortOrder: 5,
    status: "active",
  },
]);

const menuItems = ref([
  {
    id: 1,
    categoryId: 1,
    name: "奶茶",
    nameEn: "Milk Tea",
    description: "香濃奶茶",
    price: 4.5,
    imageUrl: null,
    isFeatured: true,
    isAvailable: true,
    sortOrder: 1,
  },
  {
    id: 2,
    categoryId: 1,
    name: "咖啡",
    nameEn: "Coffee",
    description: "精選咖啡豆",
    price: 5.0,
    imageUrl: null,
    isFeatured: false,
    isAvailable: true,
    sortOrder: 2,
  },
  {
    id: 3,
    categoryId: 2,
    name: "冰奶茶",
    nameEn: "Iced Milk Tea",
    description: "冰涼奶茶",
    price: 5.0,
    imageUrl: null,
    isFeatured: true,
    isAvailable: true,
    sortOrder: 1,
  },
  {
    id: 4,
    categoryId: 3,
    name: "炒飯",
    nameEn: "Fried Rice",
    description: "招牌炒飯",
    price: 12.0,
    imageUrl: null,
    isFeatured: true,
    isAvailable: true,
    sortOrder: 1,
  },
  {
    id: 5,
    categoryId: 4,
    name: "春卷",
    nameEn: "Spring Rolls",
    description: "酥脆春卷",
    price: 8.0,
    imageUrl: null,
    isFeatured: false,
    isAvailable: false,
    sortOrder: 1,
  },
]);

// 表單數據
const categoryForm = ref({
  name: "",
  nameEn: "",
  description: "",
  sortOrder: 0,
});

const menuItemForm = ref({
  name: "",
  nameEn: "",
  description: "",
  price: 0,
  categoryId: "",
  imageUrl: "",
  isFeatured: false,
  isAvailable: true,
  sortOrder: 0,
});

// 計算屬性
const filteredMenuItems = computed(() => {
  let filtered = menuItems.value;

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.nameEn?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query),
    );
  }

  if (categoryFilter.value) {
    filtered = filtered.filter(
      (item) => item.categoryId.toString() === categoryFilter.value,
    );
  }

  if (statusFilter.value) {
    if (statusFilter.value === "active") {
      filtered = filtered.filter((item) => item.isAvailable);
    } else if (statusFilter.value === "inactive") {
      filtered = filtered.filter((item) => !item.isAvailable);
    }
  }

  return filtered.sort((a, b) => {
    if (a.categoryId !== b.categoryId) {
      return a.categoryId - b.categoryId;
    }
    return a.sortOrder - b.sortOrder;
  });
});

// 方法
const getMenuItemsInCategory = (categoryId: number) => {
  return menuItems.value.filter((item) => item.categoryId === categoryId);
};

const getCategoryName = (categoryId: number) => {
  const category = categories.value.find((c) => c.id === categoryId);
  return category ? category.name : t("menu.unknownCategory");
};

const editMenuItem = (item: any) => {
  editingMenuItem.value = item;
  menuItemForm.value = { ...item };
  showMenuItemModal.value = true;
};

const deleteMenuItem = async (item: any) => {
  if (confirm(t("menu.confirms.deleteItem", { name: item.name }))) {
    const index = menuItems.value.findIndex((i) => i.id === item.id);
    if (index > -1) {
      menuItems.value.splice(index, 1);
    }
  }
};

const toggleMenuItemStatus = async (item: any) => {
  const index = menuItems.value.findIndex((i) => i.id === item.id);
  if (index > -1) {
    menuItems.value[index].isAvailable = !menuItems.value[index].isAvailable;
  }
};

const closeCategoryModal = () => {
  showCategoryModal.value = false;
  editingCategory.value = null;
  categoryForm.value = {
    name: "",
    nameEn: "",
    description: "",
    sortOrder: 0,
  };
};

const closeMenuItemModal = () => {
  showMenuItemModal.value = false;
  editingMenuItem.value = null;
  menuItemForm.value = {
    name: "",
    nameEn: "",
    description: "",
    price: 0,
    categoryId: "",
    imageUrl: "",
    isFeatured: false,
    isAvailable: true,
    sortOrder: 0,
  };
};

const saveCategory = async () => {
  if (editingCategory.value) {
    // 更新現有分類
    const index = categories.value.findIndex(
      (c) => editingCategory.value && c.id === editingCategory.value.id,
    );
    if (index > -1) {
      categories.value[index] = {
        ...categories.value[index],
        ...categoryForm.value,
      };
    }
  } else {
    // 新增分類
    const newCategory = {
      id: Math.max(...categories.value.map((c) => c.id)) + 1,
      ...categoryForm.value,
      status: "active",
    };
    categories.value.push(newCategory);
  }
  closeCategoryModal();
};

const saveMenuItem = async () => {
  if (editingMenuItem.value) {
    // 更新現有菜品
    const index = menuItems.value.findIndex(
      (i) => editingMenuItem.value && i.id === editingMenuItem.value.id,
    );
    if (index > -1) {
      menuItems.value[index] = {
        ...menuItems.value[index],
        ...menuItemForm.value,
        categoryId: parseInt(menuItemForm.value.categoryId),
        imageUrl: menuItemForm.value.imageUrl || null,
      } as any;
    }
  } else {
    // 新增菜品
    const newMenuItem = {
      id: Math.max(...menuItems.value.map((i) => i.id)) + 1,
      ...menuItemForm.value,
      categoryId: parseInt(menuItemForm.value.categoryId),
    };
    menuItems.value.push(newMenuItem as any);
  }
  closeMenuItemModal();
};

onMounted(() => {
  // 初始化數據
});
</script>

<style scoped>
.menu-view {
  padding: 1.5rem;
}

.line-clamp-1 {
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

.line-clamp-2 {
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

@media (max-width: 640px) {
  .menu-view {
    padding: 1rem;
  }
}
</style>

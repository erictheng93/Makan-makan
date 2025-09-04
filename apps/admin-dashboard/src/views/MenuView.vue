<template>
  <div class="menu-view">
    <!-- 頁面標題和操作 -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">菜單管理</h1>
        <p class="text-gray-600">管理餐廳菜單分類和菜品</p>
      </div>
      <div class="flex space-x-4">
        <button
          class="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          @click="showCategoryModal = true"
        >
          <PlusIcon class="h-4 w-4 mr-2" />
          新增分類
        </button>
        <button
          class="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          @click="showMenuItemModal = true"
        >
          <PlusIcon class="h-4 w-4 mr-2" />
          新增菜品
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
              placeholder="搜索菜品名稱..."
              class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            v-model="categoryFilter"
            class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">所有分類</option>
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
            <option value="">所有狀態</option>
            <option value="active">啟用</option>
            <option value="inactive">停用</option>
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

    <!-- 菜品網格 -->
    <div
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
    >
      <div
        v-for="item in filteredMenuItems"
        :key="item.id"
        class="bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
      >
        <!-- 菜品圖片 -->
        <div class="relative">
          <LazyImage
            :src="item.imageUrl || '/placeholder-food.jpg'"
            :alt="item.name"
            container-class="w-full h-48"
            image-class="w-full h-48 object-cover rounded-t-lg"
            :show-loading-skeleton="true"
            :quality="80"
            :progressive="true"
          >
            <!-- <template #loading>
              <div class="w-full h-48 bg-gray-200 rounded-t-lg animate-pulse flex items-center justify-center">
                <svg class="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
            </template> -->
            <!-- <template #error="{ retry }: { retry: () => void }">
              <div class="w-full h-48 bg-gray-100 rounded-t-lg flex flex-col items-center justify-center text-gray-400">
                <svg class="w-8 h-8 mb-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                </svg>
                <span class="text-xs">載入失敗</span>
                <button 
                  @click="retry"
                  class="mt-1 px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300 transition-colors"
                >
                  重試
                </button>
              </div>
            </template> -->
          </LazyImage>
          <div class="absolute top-2 right-2">
            <span
              :class="[
                'px-2 py-1 rounded-full text-xs font-medium',
                item.isAvailable
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800',
              ]"
            >
              {{ item.isAvailable ? "供應中" : "已售完" }}
            </span>
          </div>
          <div v-if="item.isFeatured" class="absolute top-2 left-2">
            <span
              class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium"
            >
              推薦
            </span>
          </div>
        </div>

        <!-- 菜品信息 -->
        <div class="p-4">
          <div class="flex justify-between items-start mb-2">
            <h3 class="text-lg font-semibold text-gray-900 line-clamp-1">
              {{ item.name }}
            </h3>
            <span class="text-lg font-bold text-blue-600"
              >RM{{ item.price }}</span
            >
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
                title="編輯"
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
                :title="item.isAvailable ? '停用' : '啟用'"
                @click="toggleMenuItemStatus(item)"
              >
                <component
                  :is="item.isAvailable ? EyeSlashIcon : EyeIcon"
                  class="h-4 w-4"
                />
              </button>
              <button
                class="p-1 text-gray-400 hover:text-red-600 transition-colors"
                title="刪除"
                @click="deleteMenuItem(item)"
              >
                <TrashIcon class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 空狀態 -->
      <div
        v-if="filteredMenuItems.length === 0"
        class="col-span-full text-center py-12"
      >
        <CakeIcon class="mx-auto h-12 w-12 text-gray-400" />
        <h3 class="mt-2 text-sm font-medium text-gray-900">暫無菜品</h3>
        <p class="mt-1 text-sm text-gray-500">開始添加您的第一道菜品</p>
        <button
          class="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          @click="showMenuItemModal = true"
        >
          <PlusIcon class="h-4 w-4 mr-2" />
          新增菜品
        </button>
      </div>
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
              {{ editingCategory ? "編輯分類" : "新增分類" }}
            </h3>

            <form @submit.prevent="saveCategory">
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    分類名稱 <span class="text-red-500">*</span>
                  </label>
                  <input
                    v-model="categoryForm.name"
                    type="text"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1"
                    >英文名稱</label
                  >
                  <input
                    v-model="categoryForm.nameEn"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1"
                    >描述</label
                  >
                  <textarea
                    v-model="categoryForm.description"
                    rows="3"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1"
                    >排序順序</label
                  >
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
                  取消
                </button>
                <button
                  type="submit"
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {{ editingCategory ? "更新" : "新增" }}
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
              {{ editingMenuItem ? "編輯菜品" : "新增菜品" }}
            </h3>

            <form @submit.prevent="saveMenuItem">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="md:col-span-2">
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    菜品名稱 <span class="text-red-500">*</span>
                  </label>
                  <input
                    v-model="menuItemForm.name"
                    type="text"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1"
                    >英文名稱</label
                  >
                  <input
                    v-model="menuItemForm.nameEn"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    價格 (RM) <span class="text-red-500">*</span>
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
                    分類 <span class="text-red-500">*</span>
                  </label>
                  <select
                    v-model="menuItemForm.categoryId"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">選擇分類</option>
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
                  <label class="block text-sm font-medium text-gray-700 mb-1"
                    >圖片 URL</label
                  >
                  <input
                    v-model="menuItemForm.imageUrl"
                    type="url"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div class="md:col-span-2">
                  <label class="block text-sm font-medium text-gray-700 mb-1"
                    >描述</label
                  >
                  <textarea
                    v-model="menuItemForm.description"
                    rows="3"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1"
                    >排序順序</label
                  >
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
                    <span class="ml-2 text-sm text-gray-700">推薦菜品</span>
                  </label>
                  <label class="flex items-center">
                    <input
                      v-model="menuItemForm.isAvailable"
                      type="checkbox"
                      class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span class="ml-2 text-sm text-gray-700">可供應</span>
                  </label>
                </div>
              </div>

              <div class="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  @click="closeMenuItemModal"
                >
                  取消
                </button>
                <button
                  type="submit"
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {{ editingMenuItem ? "更新" : "新增" }}
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
import LazyImage from "../../../packages/shared/components/LazyImage.vue";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  CakeIcon,
} from "@heroicons/vue/24/outline";

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
  return category ? category.name : "未知分類";
};

const editMenuItem = (item: any) => {
  editingMenuItem.value = item;
  menuItemForm.value = { ...item };
  showMenuItemModal.value = true;
};

const deleteMenuItem = async (item: any) => {
  if (confirm(`確定要刪除菜品「${item.name}」嗎？`)) {
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

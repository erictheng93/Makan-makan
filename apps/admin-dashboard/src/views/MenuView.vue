<template>
  <div class="menu-view p-6 bg-[#F2F2F7] min-h-screen">
    <!-- Page header -->
    <div
      class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6"
    >
      <div>
        <h1 class="text-2xl font-bold text-[#1C1C1E]">{{ t("menu.title") }}</h1>
        <p class="text-[15px] text-[#8E8E93] mt-0.5">
          {{ t("menu.subtitle") }}
        </p>
      </div>
      <div class="flex gap-2.5 items-center">
        <!-- Categories stat chip -->
        <div
          class="flex items-center gap-1.5 px-3.5 py-2 bg-white rounded-full shadow-[0_1px_6px_rgba(0,0,0,0.06)]"
        >
          <span class="text-[13px] font-semibold text-[#1C1C1E]">{{
            categories.length
          }}</span>
          <span class="text-[12px] text-[#8E8E93]">{{
            t("menu.stats.categories")
          }}</span>
        </div>
        <!-- Total items stat chip -->
        <div
          class="flex items-center gap-1.5 px-3.5 py-2 bg-white rounded-full shadow-[0_1px_6px_rgba(0,0,0,0.06)]"
        >
          <span class="text-[13px] font-semibold text-[#1C1C1E]">{{
            menuItems.length
          }}</span>
          <span class="text-[12px] text-[#8E8E93]">{{
            t("menu.stats.items")
          }}</span>
        </div>
        <!-- Available stat chip -->
        <div
          class="flex items-center gap-1.5 px-3.5 py-2 bg-[#E8F5E9] rounded-full"
        >
          <span class="text-[13px] font-semibold text-[#2D8E47]">{{
            availableCount
          }}</span>
          <span class="text-[12px] text-[#2D8E47]">{{
            t("menu.stats.available")
          }}</span>
        </div>
      </div>
    </div>

    <!-- Master-detail grid -->
    <div class="grid grid-cols-[300px_1fr] gap-5 items-start">
      <!-- LEFT: CategoryPanel -->
      <CategoryPanel
        :categories="categories"
        :menu-items="menuItems"
        :selected-category-id="selectedCategoryId"
        @select="selectedCategoryId = $event"
        @add-category="startAddCategory"
        @edit-category="startEditCategory"
        @delete-category="handleDeleteCategory"
        @reorder="reorderCategories"
      />

      <!-- RIGHT: Items panel -->
      <div>
        <!-- Items header -->
        <div
          class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 bg-white rounded-2xl px-5 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
        >
          <div class="flex items-center gap-3">
            <h2 class="text-[17px] font-bold text-[#1C1C1E]">
              {{ currentCategoryName }}
            </h2>
            <span
              class="px-2.5 py-0.5 bg-[#F2F2F7] rounded-full text-[12px] font-semibold text-[#8E8E93]"
            >
              {{
                t("menu.itemsHeader.itemCount", { count: filteredItems.length })
              }}
            </span>
          </div>
          <div class="flex flex-wrap gap-2.5 items-center">
            <!-- Search input -->
            <div class="relative">
              <MagnifyingGlassIcon
                class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#AEAEB2]"
              />
              <input
                v-model="searchQuery"
                type="text"
                :placeholder="t('menu.searchPlaceholder')"
                class="pl-9 pr-4 py-2 bg-[#F2F2F7] rounded-full text-[13px] text-[#1C1C1E] placeholder-[#AEAEB2] border-0 outline-none focus:ring-2 focus:ring-ios-primary/30 w-44 transition-all"
              />
            </div>

            <!-- Status filter pills -->
            <div class="flex items-center bg-[#F2F2F7] rounded-full p-0.5">
              <button
                v-for="filter in statusFilters"
                :key="filter.value"
                :class="[
                  'px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all',
                  statusFilter === filter.value
                    ? 'bg-white text-[#1C1C1E] shadow-[0_1px_4px_rgba(0,0,0,0.1)]'
                    : 'text-[#8E8E93] hover:text-[#1C1C1E]',
                ]"
                @click="statusFilter = filter.value"
              >
                {{ filter.label }}
              </button>
            </div>

            <!-- Add item button -->
            <button
              class="flex items-center gap-1.5 px-[18px] py-[9px] bg-[#0066D6] text-white rounded-full text-[13px] font-semibold -translate-y-px shadow-[0_4px_14px_rgba(0,122,255,0.3)]"
              @click="openAddItemModal"
            >
              <PlusIcon class="h-4 w-4" />
              {{ t("menu.addItem") }}
            </button>
          </div>
        </div>

        <!-- VirtualMenuGrid -->
        <VirtualMenuGrid
          v-if="filteredItems.length > 0"
          ref="menuGridRef"
          :menu-items="filteredItems"
          :item-height="330"
          :container-height="800"
          :columns-count="3"
          :buffer-size="3"
        >
          <template #default="{ menuItem }">
            <MenuItemCard
              :item="menuItem as MenuItemData"
              :category-name="getCategoryName(menuItem.categoryId)"
              :highlighted="menuItem.id === highlightedItemId"
              @edit="editMenuItem"
              @toggle-status="toggleMenuItemStatus"
              @delete="handleDeleteMenuItem"
            />
          </template>
        </VirtualMenuGrid>

        <!-- Empty state -->
        <div
          v-if="filteredItems.length === 0 && !isLoading"
          class="flex flex-col items-center justify-center py-20 bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
        >
          <CakeIcon class="h-14 w-14 text-[#AEAEB2] mb-3" />
          <h3 class="text-[17px] font-semibold text-[#1C1C1E] mb-1">
            {{ t("menu.empty.title") }}
          </h3>
          <p class="text-[14px] text-[#8E8E93] mb-5">
            {{ t("menu.empty.subtitle") }}
          </p>
          <button
            class="flex items-center gap-1.5 px-5 py-2.5 bg-[#0066D6] text-white rounded-full text-[14px] font-semibold -translate-y-px shadow-[0_4px_14px_rgba(0,122,255,0.3)]"
            @click="openAddItemModal"
          >
            <PlusIcon class="h-4 w-4" />
            {{ t("menu.addItem") }}
          </button>
        </div>

        <!-- Loading state -->
        <div
          v-if="isLoading"
          class="flex items-center justify-center py-20 bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
        >
          <div
            class="animate-spin rounded-full h-8 w-8 border-b-2 border-ios-primary"
          />
        </div>
      </div>
    </div>

    <!-- Category edit modal -->
    <CategoryEditForm
      v-if="showCategoryEditForm"
      :editing-category="editingCategory"
      @save="handleSaveCategory"
      @cancel="cancelCategoryEdit"
    />

    <!-- Delete confirm modal -->
    <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div
          class="fixed inset-0 bg-black/30 backdrop-blur-sm"
          @click="cancelDelete"
        />
        <div class="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full">
          <div class="p-6 text-center">
            <div
              class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-ios-error/10 mb-4"
            >
              <ExclamationTriangleIcon class="h-6 w-6 text-ios-error" />
            </div>
            <h3 class="text-[17px] font-bold text-[#1C1C1E] mb-2">
              {{ deleteConfirmTitle }}
            </h3>
            <p class="text-[14px] text-[#8E8E93] mb-6">
              {{ deleteConfirmMessage }}
            </p>
            <div class="flex gap-2.5 justify-center">
              <button
                class="px-5 py-2.5 text-[14px] font-semibold text-[#1C1C1E] bg-[#F2F2F7] rounded-full hover:bg-[#E5E5EA] transition-colors"
                @click="cancelDelete"
              >
                {{ t("common.cancel") }}
              </button>
              <button
                class="px-5 py-2.5 text-[14px] font-semibold text-white bg-ios-error rounded-full hover:bg-ios-error/90 transition-colors shadow-[0_2px_8px_rgba(255,59,48,0.25)]"
                @click="confirmDelete"
              >
                {{ t("common.delete") }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Menu item modal -->
    <div v-if="showMenuItemModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div
          class="fixed inset-0 bg-black/30 backdrop-blur-sm"
          @click="closeMenuItemModal"
        />
        <div
          class="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          data-testid="item-modal"
        >
          <div class="p-6">
            <h3 class="text-[18px] font-bold text-[#1C1C1E] mb-5">
              {{ editingMenuItem ? t("menu.editItem") : t("menu.addItem") }}
            </h3>

            <form @submit.prevent="handleSaveMenuItem">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Item name -->
                <div class="md:col-span-2">
                  <label
                    class="block text-[13px] font-semibold text-[#1C1C1E] mb-1.5"
                  >
                    {{ t("menu.form.itemName") }}
                    <span class="text-ios-error ml-0.5">*</span>
                  </label>
                  <input
                    v-model="menuItemForm.name"
                    type="text"
                    required
                    class="w-full px-4 py-2.5 bg-[#F2F2F7] rounded-xl text-[14px] text-[#1C1C1E] border-0 outline-none focus:ring-2 focus:ring-ios-primary/30 transition-all"
                  />
                </div>

                <!-- Name (English) -->
                <div>
                  <label
                    class="block text-[13px] font-semibold text-[#1C1C1E] mb-1.5"
                  >
                    {{ t("menu.form.nameEn") }}
                  </label>
                  <input
                    v-model="menuItemForm.nameEn"
                    type="text"
                    class="w-full px-4 py-2.5 bg-[#F2F2F7] rounded-xl text-[14px] text-[#1C1C1E] border-0 outline-none focus:ring-2 focus:ring-ios-primary/30 transition-all"
                  />
                </div>

                <!-- Price -->
                <div>
                  <label
                    class="block text-[13px] font-semibold text-[#1C1C1E] mb-1.5"
                  >
                    {{ t("menu.form.price") }}
                    <span class="text-ios-error ml-0.5">*</span>
                  </label>
                  <input
                    v-model.number="menuItemForm.price"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    class="w-full px-4 py-2.5 bg-[#F2F2F7] rounded-xl text-[14px] text-[#1C1C1E] border-0 outline-none focus:ring-2 focus:ring-ios-primary/30 transition-all"
                  />
                </div>

                <!-- Category -->
                <div>
                  <label
                    class="block text-[13px] font-semibold text-[#1C1C1E] mb-1.5"
                  >
                    {{ t("menu.form.category") }}
                    <span class="text-ios-error ml-0.5">*</span>
                  </label>
                  <select
                    v-model="menuItemForm.categoryId"
                    required
                    class="w-full px-4 py-2.5 bg-[#F2F2F7] rounded-xl text-[14px] text-[#1C1C1E] border-0 outline-none focus:ring-2 focus:ring-ios-primary/30 transition-all"
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

                <!-- Image URL -->
                <div>
                  <label
                    class="block text-[13px] font-semibold text-[#1C1C1E] mb-1.5"
                  >
                    {{ t("menu.form.imageUrl") }}
                  </label>
                  <input
                    v-model="menuItemForm.imageUrl"
                    type="url"
                    class="w-full px-4 py-2.5 bg-[#F2F2F7] rounded-xl text-[14px] text-[#1C1C1E] border-0 outline-none focus:ring-2 focus:ring-ios-primary/30 transition-all"
                  />
                </div>

                <!-- Description -->
                <div class="md:col-span-2">
                  <label
                    class="block text-[13px] font-semibold text-[#1C1C1E] mb-1.5"
                  >
                    {{ t("menu.form.description") }}
                  </label>
                  <textarea
                    v-model="menuItemForm.description"
                    rows="3"
                    class="w-full px-4 py-2.5 bg-[#F2F2F7] rounded-xl text-[14px] text-[#1C1C1E] border-0 outline-none focus:ring-2 focus:ring-ios-primary/30 transition-all resize-none"
                  />
                </div>

                <!-- Sort order -->
                <div>
                  <label
                    class="block text-[13px] font-semibold text-[#1C1C1E] mb-1.5"
                  >
                    {{ t("menu.form.sortOrder") }}
                  </label>
                  <input
                    v-model.number="menuItemForm.sortOrder"
                    type="number"
                    min="0"
                    class="w-full px-4 py-2.5 bg-[#F2F2F7] rounded-xl text-[14px] text-[#1C1C1E] border-0 outline-none focus:ring-2 focus:ring-ios-primary/30 transition-all"
                  />
                </div>

                <!-- Checkboxes -->
                <div class="flex items-center gap-5">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      v-model="menuItemForm.isFeatured"
                      type="checkbox"
                      class="w-4 h-4 rounded border-[#D1D1D6] text-ios-primary focus:ring-ios-primary/30"
                    />
                    <span class="text-[13px] text-[#1C1C1E]">{{
                      t("menu.form.featuredItem")
                    }}</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      v-model="menuItemForm.isAvailable"
                      type="checkbox"
                      class="w-4 h-4 rounded border-[#D1D1D6] text-ios-primary focus:ring-ios-primary/30"
                    />
                    <span class="text-[13px] text-[#1C1C1E]">{{
                      t("menu.form.isAvailable")
                    }}</span>
                  </label>
                </div>
              </div>

              <!-- Modal actions -->
              <div
                class="flex justify-end gap-2.5 mt-6 pt-5 border-t border-black/[0.06]"
              >
                <button
                  type="button"
                  class="px-5 py-2.5 text-[14px] font-semibold text-[#1C1C1E] bg-[#F2F2F7] rounded-full hover:bg-[#E5E5EA] transition-colors"
                  @click="closeMenuItemModal"
                >
                  {{ t("common.cancel") }}
                </button>
                <button
                  type="submit"
                  class="px-5 py-2.5 text-[14px] font-semibold text-white bg-ios-primary rounded-full hover:bg-ios-primary/90 transition-colors shadow-[0_2px_8px_rgba(0,122,255,0.25)]"
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
import { ref, computed, onMounted, watch, nextTick } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "@/i18n";
import { useMenuManagement } from "@/composables/useMenuManagement";
import type {
  CategoryData,
  MenuItemData,
} from "@/composables/useMenuManagement";
import CategoryPanel from "@/components/menu/CategoryPanel.vue";
import CategoryEditForm from "@/components/menu/CategoryEditForm.vue";
import MenuItemCard from "@/components/menu/MenuItemCard.vue";
import VirtualMenuGrid from "@/components/VirtualMenuGrid.vue";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  CakeIcon,
  ExclamationTriangleIcon,
} from "@heroicons/vue/24/outline";

const { t } = useI18n();
const route = useRoute();
const {
  categories,
  menuItems,
  isLoading,
  selectedCategoryId,
  filteredItemsByCategory,
  getCategoryName,
  fetchMenu,
  saveCategory,
  deleteCategory,
  reorderCategories,
  saveMenuItem,
  deleteMenuItem,
  toggleMenuItemStatus,
} = useMenuManagement();

// ── Local UI State ──
const searchQuery = ref("");
const statusFilter = ref<"all" | "available" | "unavailable">("all");
const showCategoryEditForm = ref(false);
const editingCategory = ref<CategoryData | null>(null);
const showMenuItemModal = ref(false);
const editingMenuItem = ref<MenuItemData | null>(null);
const menuGridRef = ref<InstanceType<typeof VirtualMenuGrid> | null>(null);
const highlightedItemId = ref<number | null>(null);

const menuItemForm = ref({
  name: "",
  nameEn: "",
  description: "",
  price: 0,
  categoryId: "" as string | number,
  imageUrl: "",
  isFeatured: false,
  isAvailable: true,
  sortOrder: 0,
});

// ── Status filter options ──
const statusFilters = computed(() => [
  { value: "all" as const, label: t("menu.itemsHeader.filterAll") },
  { value: "available" as const, label: t("menu.itemsHeader.filterAvailable") },
  {
    value: "unavailable" as const,
    label: t("menu.itemsHeader.filterUnavailable"),
  },
]);

// ── Computed ──
const currentCategoryName = computed(() => {
  if (selectedCategoryId.value === null)
    return t("menu.categoryPanel.allItems");
  return getCategoryName(selectedCategoryId.value);
});

const filteredItems = computed(() => {
  let items = filteredItemsByCategory.value;

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    items = items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.nameEn?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query),
    );
  }

  if (statusFilter.value === "available") {
    items = items.filter((item) => item.isAvailable);
  } else if (statusFilter.value === "unavailable") {
    items = items.filter((item) => !item.isAvailable);
  }

  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
});

const availableCount = computed(
  () => menuItems.value.filter((i) => i.isAvailable).length,
);

// ── Category Panel Handlers ──
const startAddCategory = () => {
  editingCategory.value = null;
  showCategoryEditForm.value = true;
};

const startEditCategory = (category: CategoryData) => {
  editingCategory.value = category;
  showCategoryEditForm.value = true;
};

const handleSaveCategory = async (
  form: {
    name: string;
    nameEn: string;
    description: string;
    sortOrder: number;
  },
  editingId?: number,
) => {
  await saveCategory(form, editingId);
  showCategoryEditForm.value = false;
  editingCategory.value = null;
};

const cancelCategoryEdit = () => {
  showCategoryEditForm.value = false;
  editingCategory.value = null;
};

// ── Delete Confirm Modal ──
const deleteConfirm = ref<{
  title: string;
  message: string;
  action: (() => Promise<void>) | null;
} | null>(null);

const showDeleteConfirm = computed(() => deleteConfirm.value !== null);
const deleteConfirmTitle = computed(() => deleteConfirm.value?.title ?? "");
const deleteConfirmMessage = computed(() => deleteConfirm.value?.message ?? "");

const openDeleteConfirm = (
  title: string,
  message: string,
  action: () => Promise<void>,
) => {
  deleteConfirm.value = { title, message, action };
};

const confirmDelete = async () => {
  if (deleteConfirm.value?.action) {
    await deleteConfirm.value.action();
  }
  cancelDelete();
};

const cancelDelete = () => {
  deleteConfirm.value = null;
};

const handleDeleteCategory = (category: CategoryData) => {
  openDeleteConfirm(
    t("common.delete"),
    t("menu.confirms.deleteCategory", { name: category.name }),
    () => deleteCategory(category.id),
  );
};

// ── Menu Item Handlers ──
const openAddItemModal = () => {
  editingMenuItem.value = null;
  menuItemForm.value = {
    name: "",
    nameEn: "",
    description: "",
    price: 0,
    categoryId: selectedCategoryId.value ?? "",
    imageUrl: "",
    isFeatured: false,
    isAvailable: true,
    sortOrder: 0,
  };
  showMenuItemModal.value = true;
};

const editMenuItem = (item: MenuItemData) => {
  editingMenuItem.value = item;
  menuItemForm.value = {
    name: item.name,
    nameEn: item.nameEn ?? "",
    description: item.description ?? "",
    price: item.price,
    categoryId: item.categoryId,
    imageUrl: item.imageUrl ?? "",
    isFeatured: item.isFeatured,
    isAvailable: item.isAvailable,
    sortOrder: item.sortOrder,
  };
  showMenuItemModal.value = true;
};

const closeMenuItemModal = () => {
  showMenuItemModal.value = false;
  editingMenuItem.value = null;
};

const handleSaveMenuItem = async () => {
  await saveMenuItem(
    {
      name: menuItemForm.value.name,
      nameEn: menuItemForm.value.nameEn || undefined,
      description: menuItemForm.value.description || undefined,
      price: Number(menuItemForm.value.price),
      categoryId: Number(menuItemForm.value.categoryId),
      imageUrl: menuItemForm.value.imageUrl || null,
      isFeatured: menuItemForm.value.isFeatured,
      isAvailable: menuItemForm.value.isAvailable,
      sortOrder: menuItemForm.value.sortOrder,
    },
    editingMenuItem.value?.id,
  );
  closeMenuItemModal();
};

const handleDeleteMenuItem = (item: MenuItemData) => {
  openDeleteConfirm(
    t("common.delete"),
    t("menu.confirms.deleteItem", { name: item.name }),
    () => deleteMenuItem(item),
  );
};

// ── Highlight item from cross-module navigation ──
watch(
  () => route.query.highlightItem,
  async (itemIdStr) => {
    if (!itemIdStr) {
      highlightedItemId.value = null;
      return;
    }
    const itemId = Number(itemIdStr);
    if (isNaN(itemId)) return;

    const item = menuItems.value.find((m) => m.id === itemId);
    if (item) {
      selectedCategoryId.value = item.categoryId;
      searchQuery.value = "";
      statusFilter.value = "all";
    }

    highlightedItemId.value = itemId;

    await nextTick();
    await nextTick();
    menuGridRef.value?.scrollToMenuItem(itemId);

    setTimeout(() => {
      highlightedItemId.value = null;
    }, 3000);
  },
  { immediate: true },
);

onMounted(() => {
  fetchMenu();
});
</script>

<style scoped>
.menu-view {
  min-height: 100vh;
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

@media (max-width: 900px) {
  .grid-cols-\[300px_1fr\] {
    grid-template-columns: 1fr;
  }
}
</style>

import { ref, computed } from "vue";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { useToast } from "vue-toastification";
import { useI18n } from "@/i18n";
import type { MenuItemImportInput } from "@/utils/menuItemImport";
import type { ImageVariants } from "@/composables/useImageUpload";

export interface CategoryData {
  id: number;
  name: string;
  nameEn?: string;
  description?: string;
  sortOrder: number;
  isActive?: boolean;
  isVisible?: boolean;
  itemCount?: number;
}

export interface MenuItemData {
  id: number;
  categoryId: number;
  catalogType: "menu_item" | "product";
  name: string;
  nameEn?: string;
  description?: string;
  price: number;
  imageUrl?: string | null;
  imageId?: string | null;
  imageVariants?: ImageVariants | null;
  isFeatured: boolean;
  isAvailable: boolean;
  sortOrder: number;
  orderCount?: number;
  rating?: number;
  reviewCount?: number;
}

// Singleton state — shared across components within the same page
const categories = ref<CategoryData[]>([]);
const menuItems = ref<MenuItemData[]>([]);
const isLoading = ref(false);
const selectedCategoryId = ref<number | null>(null);

export function useMenuManagement() {
  const authStore = useAuthStore();
  const toast = useToast();
  const { t } = useI18n();

  // ── Computed ──

  const filteredItemsByCategory = computed(() => {
    if (selectedCategoryId.value === null) return menuItems.value;
    return menuItems.value.filter(
      (item) => item.categoryId === selectedCategoryId.value,
    );
  });

  const getItemsInCategory = (categoryId: number) => {
    return menuItems.value.filter((item) => item.categoryId === categoryId);
  };

  const getCategoryName = (categoryId: number) => {
    const cat = categories.value.find((c) => c.id === categoryId);
    return cat?.name ?? t("menu.unknownCategory");
  };

  // ── Fetch ──

  const fetchMenu = async () => {
    if (!authStore.restaurantId) return;
    isLoading.value = true;
    try {
      const response = await api.get<{ categories: any[]; menuItems: any[] }>(
        `/menu/${authStore.restaurantId}?includeAll=true`,
      );
      const payload = response.data?.success ? response.data.data : undefined;
      if (payload) {
        categories.value = payload.categories.map((c: any) => ({
          ...c,
          nameEn: c.nameEn || "",
        }));
        menuItems.value = payload.menuItems
          .filter((item: any) => item.sortOrder !== -1) // Exclude soft-deleted items (sortOrder = -1)
          .map((item: any) => ({
            ...item,
            nameEn: item.nameEn || "",
            catalogType: item.catalogType ?? "menu_item",
            isFeatured: !!item.isFeatured,
            isAvailable: !!item.isAvailable,
          }));
      }
    } catch (error) {
      console.error("Failed to fetch menu:", error);
      toast.error(t("menu.errors.fetchFailed"));
    } finally {
      isLoading.value = false;
    }
  };

  // ── Category CRUD ──

  const saveCategory = async (
    form: {
      name: string;
      nameEn?: string;
      description?: string;
      sortOrder: number;
    },
    editingId?: number,
  ) => {
    if (!authStore.restaurantId) return;
    try {
      if (editingId) {
        await api.put(`/menu/categories/${editingId}`, form);
        toast.success(t("menu.toast.categoryUpdated"));
      } else {
        await api.post(`/menu/${authStore.restaurantId}/categories`, form);
        toast.success(t("menu.toast.categoryCreated"));
      }
      await fetchMenu();
    } catch (error: any) {
      console.error("Failed to save category:", error);
      toast.error(
        error.response?.data?.error?.message || t("menu.errors.saveFailed"),
      );
    }
  };

  const deleteCategory = async (categoryId: number) => {
    try {
      await api.delete(`/menu/categories/${categoryId}`);
      // Optimistically remove from local state
      categories.value = categories.value.filter((c) => c.id !== categoryId);
      menuItems.value = menuItems.value.filter(
        (i) => i.categoryId !== categoryId,
      );
      toast.success(t("menu.toast.categoryDeleted"));
      if (selectedCategoryId.value === categoryId) {
        selectedCategoryId.value = null;
      }
      await fetchMenu();
    } catch (error: any) {
      console.error("Failed to delete category:", error);
      toast.error(
        error.response?.data?.error?.message || t("menu.errors.deleteFailed"),
      );
      await fetchMenu();
    }
  };

  const reorderCategories = async (orderedCategories: CategoryData[]) => {
    if (!authStore.restaurantId) return;
    // Optimistic update
    categories.value = orderedCategories;
    try {
      await api.patch(`/menu/${authStore.restaurantId}/categories/reorder`, {
        categories: orderedCategories.map((c, i) => ({
          id: c.id,
          sortOrder: i,
        })),
      });
    } catch (error) {
      console.error("Failed to reorder categories:", error);
      toast.error(t("menu.errors.reorderFailed"));
      await fetchMenu(); // rollback
    }
  };

  // ── Menu Item CRUD ──

  const saveMenuItem = async (
    form: {
      name: string;
      nameEn?: string;
      description?: string;
      price: number;
      categoryId: number;
      catalogType?: "menu_item" | "product";
      imageUrl?: string | null;
      imageId?: string | null;
      imageVariants?: ImageVariants | null;
      isFeatured: boolean;
      isAvailable: boolean;
      sortOrder: number;
    },
    editingId?: number,
  ) => {
    if (!authStore.restaurantId) return false;
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        categoryId: Number(form.categoryId),
        imageUrl: form.imageUrl || null,
        imageId: form.imageId || null,
        imageVariants: form.imageVariants ?? null,
      };
      if (editingId) {
        await api.put(`/menu/items/${editingId}`, payload);
        toast.success(t("menu.toast.itemUpdated"));
      } else {
        await api.post(`/menu/${authStore.restaurantId}/items`, payload);
        toast.success(t("menu.toast.itemCreated"));
      }
      await fetchMenu();
      return true;
    } catch (error: any) {
      console.error("Failed to save menu item:", error);
      toast.error(
        error.response?.data?.error?.message || t("menu.errors.saveFailed"),
      );
      return false;
    }
  };

  const importMenuItems = async (items: MenuItemImportInput[]) => {
    if (!authStore.restaurantId || items.length === 0) return;
    try {
      for (const item of items) {
        await api.post(`/menu/${authStore.restaurantId}/items`, item);
      }
      toast.success(`已匯入 ${items.length} 個商品`);
      await fetchMenu();
    } catch (error: any) {
      console.error("Failed to import menu items:", error);
      toast.error(
        error.response?.data?.error?.message || t("menu.errors.saveFailed"),
      );
      throw error;
    }
  };

  const deleteMenuItem = async (item: MenuItemData) => {
    try {
      await api.delete(`/menu/items/${item.id}`);
      // Optimistically remove from local state immediately so UI updates
      menuItems.value = menuItems.value.filter((i) => i.id !== item.id);
      toast.success(t("menu.toast.itemDeleted"));
      // Also refetch to sync with server (handles edge cache staleness)
      await fetchMenu();
    } catch (error: any) {
      console.error("Failed to delete menu item:", error);
      toast.error(
        error.response?.data?.error?.message || t("menu.errors.deleteFailed"),
      );
      // Re-fetch to restore state if delete failed
      await fetchMenu();
    }
  };

  const toggleMenuItemStatus = async (item: MenuItemData) => {
    try {
      await api.put(`/menu/items/${item.id}`, {
        isAvailable: !item.isAvailable,
      });
      await fetchMenu();
    } catch (error) {
      console.error("Failed to toggle status:", error);
      toast.error(t("menu.errors.toggleFailed"));
    }
  };

  return {
    // State
    categories,
    menuItems,
    isLoading,
    selectedCategoryId,
    // The restaurant currently being managed — for a platform admin this is the
    // one picked in the header selector, not anything carried in their token.
    // Wrapped in computed() because Pinia unwraps store refs on access, which
    // would otherwise snapshot the value at composable-call time.
    restaurantId: computed(() => authStore.restaurantId),
    // Computed
    filteredItemsByCategory,
    // Methods
    getItemsInCategory,
    getCategoryName,
    fetchMenu,
    saveCategory,
    deleteCategory,
    reorderCategories,
    saveMenuItem,
    importMenuItems,
    deleteMenuItem,
    toggleMenuItemStatus,
  };
}

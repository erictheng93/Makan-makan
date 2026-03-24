# Menu Management Master-Detail Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the monolithic MenuView.vue (752 lines) into a master-detail layout with a persistent category sidebar panel and contextual menu item management, following the Apple-Native Soft Minimalism design system.

**Architecture:** Split MenuView into an orchestrator + 4 focused components. The left panel manages categories (with inline editing and drag-to-reorder). The right panel shows menu items filtered by the selected category, with a contextual "add item" button that auto-populates categoryId. A new batch reorder API endpoint supports drag-and-drop category sorting.

**Tech Stack:** Vue 3 Composition API, TypeScript, Tailwind CSS, Heroicons, vue-draggable-plus (already installed, for drag-and-drop), existing VirtualMenuGrid component, Hono API routes, Drizzle ORM.

**Design Reference:** Mockup at `.tmp-mockup/menu-redesign-mockup.html`

---

## File Structure

### New Files (Frontend)

| File                                                            | Responsibility                                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `apps/admin-dashboard/src/components/menu/CategoryPanel.vue`    | Left sidebar: category list, drag-to-reorder, inline edit trigger, add/delete  |
| `apps/admin-dashboard/src/components/menu/CategoryEditForm.vue` | Inline form for create/edit category (replaces modal)                          |
| `apps/admin-dashboard/src/components/menu/MenuItemCard.vue`     | Single menu item card with image, badges, hover actions                        |
| `apps/admin-dashboard/src/composables/useMenuManagement.ts`     | Shared state & API logic extracted from MenuView (categories, items, CRUD ops) |

### Modified Files (Frontend)

| File                                             | Changes                                                                          |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| `apps/admin-dashboard/src/views/MenuView.vue`    | Rewrite: master-detail grid layout, orchestrates child components via composable |
| `apps/admin-dashboard/src/i18n/locales/zh-TW.ts` | Add new i18n keys for redesigned UI                                              |
| `apps/admin-dashboard/src/i18n/locales/en-US.ts` | Add new i18n keys (English)                                                      |

### Modified Files (Backend)

| File                                                 | Changes                                                |
| ---------------------------------------------------- | ------------------------------------------------------ |
| `apps/api/src/features/menu/routes/index.ts`         | Add `PATCH /:restaurantId/categories/reorder` endpoint |
| `apps/api/src/features/menu/schemas/validation.ts`   | Add `categoryReorder` schema                           |
| `apps/api/src/features/menu/services/MenuService.ts` | Add `reorderCategories()` wrapper method               |
| `apps/api/src/features/menu/types/index.ts`          | Add `reorderCategories` to `IMenuService` interface    |
| `packages/database/src/services/menu.ts`             | Add `reorderCategories()` method                       |
| `apps/admin-dashboard/tailwind.config.js`            | Add `ios-*` design system color tokens                 |

### Existing Files (No Changes - Reused As-Is)

| File                                                      | Role                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------ |
| `apps/admin-dashboard/src/components/VirtualMenuGrid.vue` | Virtual scrolling grid (reused in right panel, columns reduced from 4→3) |
| `apps/admin-dashboard/src/components/OptimizedImage.vue`  | Image optimization (reused in MenuItemCard)                              |
| `apps/admin-dashboard/src/services/api.ts`                | API client (reused in composable)                                        |
| `apps/admin-dashboard/src/stores/auth.ts`                 | Auth store for restaurantId                                              |

---

## Task 1: Add iOS design system color tokens to Tailwind config

**Files:**

- Modify: `apps/admin-dashboard/tailwind.config.js`

The design system specifies iOS semantic colors (`#007AFF`, `#34C759`, etc.) but the Tailwind config only has `primary` (orange) and `secondary` (slate) palettes. Add `ios-*` tokens so components can use classes like `bg-ios-primary`, `text-ios-success`, etc.

> **Note:** `vue-draggable-plus@0.6.0` is already installed in `apps/admin-dashboard/package.json` — no installation needed for drag-and-drop.

- [ ] **Step 1: Add ios color tokens to tailwind.config.js**

In `apps/admin-dashboard/tailwind.config.js`, add inside `extend.colors`:

```javascript
ios: {
  primary: '#007AFF',
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  teal: '#30B0C7',
},
```

- [ ] **Step 2: Verify Tailwind picks up the new tokens**

```bash
pnpm dev --filter=admin-dashboard
```

Open browser DevTools, verify `bg-ios-primary` produces `background-color: #007AFF`.

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/tailwind.config.js
git commit -m "style(admin): add iOS design system color tokens to Tailwind config"
```

---

## Task 2: Add backend category reorder endpoint

**Files:**

- Modify: `apps/api/src/features/menu/schemas/validation.ts`
- Modify: `packages/database/src/services/menu.ts`
- Modify: `apps/api/src/features/menu/services/MenuService.ts`
- Modify: `apps/api/src/features/menu/types/index.ts`
- Modify: `apps/api/src/features/menu/routes/index.ts`

The current API has no way to batch-update category sort orders. This task adds a `PATCH /:restaurantId/categories/reorder` endpoint. The architecture has two service layers: a database-level `MenuService` (in `packages/database`) and an API-level `MenuService` (in `apps/api`) that wraps it. Both need the new method.

- [ ] **Step 1: Add validation schema**

In `apps/api/src/features/menu/schemas/validation.ts`, add the `categoryReorder` schema to the existing `menuSchemas` object:

```typescript
categoryReorder: z.object({
  categories: z.array(
    z.object({
      id: z.number().int().positive(),
      sortOrder: z.number().int().min(0),
    })
  ).min(1),
}),
```

- [ ] **Step 2: Add `reorderCategories` to MenuService**

In `packages/database/src/services/menu.ts`, add this method to the `MenuService` class (after the existing `createCategory` method around line 491):

```typescript
async reorderCategories(
  restaurantId: string,
  updates: Array<{ id: number; sortOrder: number }>
): Promise<void> {
  try {
    for (const { id, sortOrder } of updates) {
      await this.db
        .update(categories)
        .set({ sortOrder, updatedAt: new Date() })
        .where(
          and(
            eq(categories.id, id),
            eq(categories.restaurantId, restaurantId)
          )
        );
    }

    await this.invalidateCache(
      [`menu:${restaurantId}`, `restaurant:${restaurantId}`],
      "tag"
    );
  } catch (error) {
    this.handleError(error, "reorderCategories");
  }
}
```

- [ ] **Step 3: Add `reorderCategories` to IMenuService interface**

In `apps/api/src/features/menu/types/index.ts`, add inside the `IMenuService` interface (after `deleteCategory`):

```typescript
  // Category reordering
  reorderCategories(
    restaurantId: string,
    updates: Array<{ id: number; sortOrder: number }>,
  ): Promise<void>;
```

- [ ] **Step 4: Add API-level wrapper in MenuService**

In `apps/api/src/features/menu/services/MenuService.ts`, add this method after the `deleteCategory` method (around line 305):

```typescript
  async reorderCategories(
    restaurantId: string,
    updates: Array<{ id: number; sortOrder: number }>,
  ): Promise<void> {
    try {
      this.logger.info("Reordering categories", {
        restaurantId,
        count: updates.length,
      });

      await this.dbService.reorderCategories(restaurantId, updates);

      // Invalidate menu cache
      await this.invalidateMenuCache(restaurantId);

      this.logger.info("Categories reordered successfully", { restaurantId });
    } catch (error) {
      this.logger.error(
        "Failed to reorder categories",
        error instanceof Error ? error : undefined,
        { restaurantId },
      );
      throw error;
    }
  }
```

- [ ] **Step 5: Add route handler**

In `apps/api/src/features/menu/routes/index.ts`, add this route **before** the `DELETE /categories/:id` route (to keep category routes grouped):

```typescript
// PATCH /:restaurantId/categories/reorder - Batch reorder categories
app.patch(
  "/:restaurantId/categories/reorder",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.SHOP_OWNER]),
  requireRestaurantAccess("restaurantId"),
  validateParams(menuSchemas.restaurantIdParam),
  validateBody(menuSchemas.categoryReorder),
  async (c) => {
    const { restaurantId } = c.get("validatedParams");
    const { categories } = c.get("validatedBody");
    const service = new MenuService(c.env);

    await service.reorderCategories(restaurantId, categories);

    return c.json(
      createSuccessResponse(null, "Categories reordered successfully"),
      HTTP_STATUS.OK,
    );
  },
);
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/eric/Documents/Code/Makan-makan
pnpm typecheck --filter=api --filter=database
```

Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/features/menu/routes/index.ts apps/api/src/features/menu/schemas/validation.ts apps/api/src/features/menu/services/MenuService.ts apps/api/src/features/menu/types/index.ts packages/database/src/services/menu.ts
git commit -m "feat(api): add PATCH categories/reorder endpoint for drag-and-drop sorting"
```

---

## Task 3: Create useMenuManagement composable

**Files:**

- Create: `apps/admin-dashboard/src/composables/useMenuManagement.ts`

Extract all menu state and API logic from MenuView.vue into a reusable composable. This is the shared "brain" that CategoryPanel, MenuItemsPanel, and MenuView will all consume.

- [ ] **Step 1: Create the composable**

Create `apps/admin-dashboard/src/composables/useMenuManagement.ts`:

```typescript
import { ref, computed } from "vue";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { useToast } from "vue-toastification";
import { useI18n } from "@/i18n";

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
  name: string;
  nameEn?: string;
  description?: string;
  price: number;
  imageUrl?: string | null;
  isFeatured: boolean;
  isAvailable: boolean;
  sortOrder: number;
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
        `/menu/${authStore.restaurantId}`,
      );
      const payload = response.data?.success ? response.data.data : undefined;
      if (payload) {
        categories.value = payload.categories.map((c: any) => ({
          ...c,
          nameEn: c.nameEn || "",
        }));
        menuItems.value = payload.menuItems.map((item: any) => ({
          ...item,
          nameEn: item.nameEn || "",
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
      imageUrl?: string | null;
      isFeatured: boolean;
      isAvailable: boolean;
      sortOrder: number;
    },
    editingId?: number,
  ) => {
    if (!authStore.restaurantId) return;
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        categoryId: Number(form.categoryId),
        imageUrl: form.imageUrl || null,
      };
      if (editingId) {
        await api.put(`/menu/items/${editingId}`, payload);
        toast.success(t("menu.toast.itemUpdated"));
      } else {
        await api.post(`/menu/${authStore.restaurantId}/items`, payload);
        toast.success(t("menu.toast.itemCreated"));
      }
      await fetchMenu();
    } catch (error: any) {
      console.error("Failed to save menu item:", error);
      toast.error(
        error.response?.data?.error?.message || t("menu.errors.saveFailed"),
      );
    }
  };

  const deleteMenuItem = async (item: MenuItemData) => {
    try {
      await api.delete(`/menu/items/${item.id}`);
      toast.success(t("menu.toast.itemDeleted"));
      await fetchMenu();
    } catch (error: any) {
      console.error("Failed to delete menu item:", error);
      toast.error(
        error.response?.data?.error?.message || t("menu.errors.deleteFailed"),
      );
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
    deleteMenuItem,
    toggleMenuItemStatus,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm typecheck --filter=admin-dashboard
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/composables/useMenuManagement.ts
git commit -m "refactor(admin): extract useMenuManagement composable from MenuView"
```

---

## Task 4: Create MenuItemCard component

**Files:**

- Create: `apps/admin-dashboard/src/components/menu/MenuItemCard.vue`

Extract the menu item card rendering from the VirtualMenuGrid slot template in MenuView.vue into a standalone component.

- [ ] **Step 1: Create the components/menu directory and MenuItemCard.vue**

```bash
mkdir -p apps/admin-dashboard/src/components/menu
```

Create `apps/admin-dashboard/src/components/menu/MenuItemCard.vue`:

```vue
<template>
  <div
    class="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.07)] transition-all duration-[280ms] cursor-pointer group"
  >
    <!-- Image -->
    <div class="relative">
      <OptimizedImage
        :src="item.imageUrl || placeholderSvg"
        :alt="item.name"
        :width="600"
        :height="400"
        format="auto"
        fit="cover"
        :lazy="true"
        :fade-in="true"
        image-class="w-full h-44 object-cover rounded-t-2xl"
      />
      <!-- Badges -->
      <div
        class="absolute top-2.5 left-2.5 right-2.5 flex justify-between pointer-events-none"
      >
        <span
          v-if="item.isFeatured"
          class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-ios-warning/90 text-white backdrop-blur-sm"
        >
          {{ t("menu.featured") }}
        </span>
        <span v-else />
        <span
          :class="[
            'px-2.5 py-1 rounded-full text-[11px] font-semibold backdrop-blur-sm',
            item.isAvailable
              ? 'bg-ios-success/90 text-white'
              : 'bg-ios-error/85 text-white',
          ]"
        >
          {{ item.isAvailable ? t("menu.available") : t("menu.soldOut") }}
        </span>
      </div>
    </div>

    <!-- Body -->
    <div class="p-3.5 pb-4">
      <div class="flex justify-between items-start mb-1.5">
        <h3 class="text-[15px] font-bold text-[#1C1C1E] line-clamp-1">
          {{ item.name }}
        </h3>
        <span
          class="text-[15px] font-bold text-ios-primary whitespace-nowrap ml-2"
        >
          {{ formatPrice(item.price) }}
        </span>
      </div>

      <p class="text-xs text-[#8E8E93] leading-relaxed line-clamp-2 mb-2.5">
        {{ item.description }}
      </p>

      <div class="flex justify-between items-center">
        <div class="flex gap-1">
          <span
            v-if="categoryName"
            class="px-2 py-0.5 bg-[#F2F2F7] rounded-full text-[11px] text-[#8E8E93] font-medium"
          >
            {{ categoryName }}
          </span>
        </div>
        <!-- Hover actions -->
        <div
          class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        >
          <button
            class="w-[30px] h-[30px] flex items-center justify-center rounded-lg text-[#8E8E93] hover:bg-black/5 hover:text-[#1C1C1E] transition-colors"
            :title="t('common.edit')"
            @click.stop="$emit('edit', item)"
          >
            <PencilIcon class="h-[15px] w-[15px]" />
          </button>
          <button
            class="w-[30px] h-[30px] flex items-center justify-center rounded-lg text-[#8E8E93] hover:bg-black/5 hover:text-[#1C1C1E] transition-colors"
            :title="
              item.isAvailable
                ? t('menu.statusInactive')
                : t('menu.statusActive')
            "
            @click.stop="$emit('toggle-status', item)"
          >
            <component
              :is="item.isAvailable ? EyeSlashIcon : EyeIcon"
              class="h-[15px] w-[15px]"
            />
          </button>
          <button
            class="w-[30px] h-[30px] flex items-center justify-center rounded-lg text-[#8E8E93] hover:bg-[#FFEBEE] hover:text-ios-error transition-colors"
            :title="t('common.delete')"
            @click.stop="$emit('delete', item)"
          >
            <TrashIcon class="h-[15px] w-[15px]" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "@/i18n";
import { useCurrency } from "@/composables/useCurrency";
import OptimizedImage from "@/components/OptimizedImage.vue";
import {
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
} from "@heroicons/vue/24/outline";
import type { MenuItemData } from "@/composables/useMenuManagement";

const { t } = useI18n();
const { formatPrice } = useCurrency();

defineProps<{
  item: MenuItemData;
  categoryName?: string;
}>();

defineEmits<{
  edit: [item: MenuItemData];
  "toggle-status": [item: MenuItemData];
  delete: [item: MenuItemData];
}>();

const placeholderSvg =
  "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27600%27 height=%27400%27 fill=%27%23e5e7eb%27%3E%3Crect width=%27600%27 height=%27400%27/%3E%3Ctext x=%27300%27 y=%27200%27 text-anchor=%27middle%27 dominant-baseline=%27central%27 font-family=%27system-ui%27 font-size=%2748%27 fill=%27%239ca3af%27%3E🍽️%3C/text%3E%3C/svg%3E";
</script>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm typecheck --filter=admin-dashboard
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/components/menu/MenuItemCard.vue
git commit -m "feat(admin): create MenuItemCard component with design system styling"
```

---

## Task 5: Create CategoryEditForm component

**Files:**

- Create: `apps/admin-dashboard/src/components/menu/CategoryEditForm.vue`

Inline form that appears below the category panel (instead of a modal) for creating/editing categories.

- [ ] **Step 1: Create CategoryEditForm.vue**

Create `apps/admin-dashboard/src/components/menu/CategoryEditForm.vue`:

```vue
<template>
  <div
    class="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 mt-4"
  >
    <div class="flex items-center gap-2 mb-4">
      <span class="w-2 h-2 rounded-full bg-ios-success" />
      <h3 class="text-[15px] font-bold text-[#1C1C1E]">
        {{ isEditing ? t("menu.editCategory") : t("menu.addCategory") }}
      </h3>
    </div>

    <form @submit.prevent="handleSubmit">
      <div class="space-y-3.5">
        <div>
          <label
            class="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5"
          >
            {{ t("menu.form.categoryName") }}
            <span class="text-ios-error">*</span>
          </label>
          <input
            ref="nameInput"
            v-model="form.name"
            type="text"
            required
            :placeholder="t('menu.form.categoryNamePlaceholder')"
            class="w-full px-3.5 py-2.5 bg-[#F2F2F7] border-none rounded-xl text-sm text-[#1C1C1E] outline-none transition-all duration-200 focus:shadow-[0_0_0_2px_rgba(0,122,255,0.25)] focus:bg-white placeholder:text-[#AEAEB2]"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label
              class="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5"
            >
              {{ t("menu.form.nameEn") }}
            </label>
            <input
              v-model="form.nameEn"
              type="text"
              placeholder="English name"
              class="w-full px-3.5 py-2.5 bg-[#F2F2F7] border-none rounded-xl text-sm text-[#1C1C1E] outline-none transition-all duration-200 focus:shadow-[0_0_0_2px_rgba(0,122,255,0.25)] focus:bg-white placeholder:text-[#AEAEB2]"
            />
          </div>
          <div>
            <label
              class="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5"
            >
              {{ t("menu.form.sortOrder") }}
            </label>
            <input
              v-model.number="form.sortOrder"
              type="number"
              min="0"
              class="w-full px-3.5 py-2.5 bg-[#F2F2F7] border-none rounded-xl text-sm text-[#1C1C1E] outline-none transition-all duration-200 focus:shadow-[0_0_0_2px_rgba(0,122,255,0.25)] focus:bg-white placeholder:text-[#AEAEB2]"
            />
          </div>
        </div>

        <div>
          <label
            class="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5"
          >
            {{ t("menu.form.description") }}
          </label>
          <input
            v-model="form.description"
            type="text"
            :placeholder="t('menu.form.descriptionPlaceholder')"
            class="w-full px-3.5 py-2.5 bg-[#F2F2F7] border-none rounded-xl text-sm text-[#1C1C1E] outline-none transition-all duration-200 focus:shadow-[0_0_0_2px_rgba(0,122,255,0.25)] focus:bg-white placeholder:text-[#AEAEB2]"
          />
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-4">
        <button
          type="button"
          class="px-4 py-2 rounded-full text-[13px] font-medium text-[#8E8E93] hover:bg-black/[0.04] transition-colors"
          @click="$emit('cancel')"
        >
          {{ t("common.cancel") }}
        </button>
        <button
          type="submit"
          class="px-5 py-2 rounded-full text-[13px] font-semibold bg-ios-primary text-white hover:bg-[#0066D6] transition-colors"
        >
          {{ isEditing ? t("menu.form.update") : t("menu.form.add") }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { useI18n } from "@/i18n";
import type { CategoryData } from "@/composables/useMenuManagement";

const { t } = useI18n();

const props = defineProps<{
  editingCategory?: CategoryData | null;
}>();

const emit = defineEmits<{
  save: [
    form: {
      name: string;
      nameEn: string;
      description: string;
      sortOrder: number;
    },
    editingId?: number,
  ];
  cancel: [];
}>();

const nameInput = ref<HTMLInputElement>();

const form = ref({
  name: "",
  nameEn: "",
  description: "",
  sortOrder: 0,
});

const isEditing = ref(false);

watch(
  () => props.editingCategory,
  (cat) => {
    if (cat) {
      isEditing.value = true;
      form.value = {
        name: cat.name,
        nameEn: cat.nameEn || "",
        description: cat.description || "",
        sortOrder: cat.sortOrder,
      };
    } else {
      isEditing.value = false;
      form.value = { name: "", nameEn: "", description: "", sortOrder: 0 };
    }
    nextTick(() => nameInput.value?.focus());
  },
  { immediate: true },
);

const handleSubmit = () => {
  emit("save", { ...form.value }, props.editingCategory?.id);
};
</script>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm typecheck --filter=admin-dashboard
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/components/menu/CategoryEditForm.vue
git commit -m "feat(admin): create CategoryEditForm for inline category editing"
```

---

## Task 6: Create CategoryPanel component

**Files:**

- Create: `apps/admin-dashboard/src/components/menu/CategoryPanel.vue`

The persistent left sidebar showing all categories with drag-to-reorder, hover actions (edit/more), and item counts.

- [ ] **Step 1: Create CategoryPanel.vue**

Create `apps/admin-dashboard/src/components/menu/CategoryPanel.vue`:

```vue
<template>
  <div>
    <!-- Category List Card -->
    <div
      class="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden sticky top-7"
    >
      <!-- Header -->
      <div class="flex justify-between items-center px-5 pt-5 pb-4">
        <h2 class="text-[17px] font-bold text-[#1C1C1E]">
          {{ t("menu.categoryPanel.title") }}
        </h2>
        <button
          class="flex items-center gap-1 px-3.5 py-1.5 bg-[#E8F5E9] text-[#2D8E47] rounded-full text-[13px] font-semibold hover:bg-[#D4EDDA] transition-colors"
          @click="$emit('add-category')"
        >
          <PlusIcon class="h-3.5 w-3.5" />
          {{ t("menu.categoryPanel.add") }}
        </button>
      </div>

      <!-- "All items" row -->
      <div
        :class="[
          'flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors border-t border-black/[0.04]',
          selectedCategoryId === null
            ? 'bg-ios-primary/[0.06]'
            : 'hover:bg-black/[0.02]',
        ]"
        @click="$emit('select', null)"
      >
        <div
          class="w-9 h-9 rounded-[10px] bg-[#F2F2F7] flex items-center justify-center text-[#8E8E93]"
        >
          <Squares2X2Icon class="h-[18px] w-[18px]" />
        </div>
        <div>
          <div class="text-sm font-medium text-[#8E8E93]">
            {{ t("menu.categoryPanel.allItems") }}
          </div>
          <div class="text-xs text-[#AEAEB2]">
            {{ t("menu.categoryPanel.totalItems", { count: totalItems }) }}
          </div>
        </div>
      </div>

      <!-- Draggable category list -->
      <VueDraggable
        v-model="localCategories"
        handle=".drag-handle"
        ghost-class="opacity-40"
        :animation="200"
        @end="handleReorder"
      >
        <div
          v-for="category in localCategories"
          :key="category.id"
          :class="[
            'flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors relative group',
            selectedCategoryId === category.id
              ? 'bg-ios-primary/[0.06]'
              : 'hover:bg-ios-primary/[0.03]',
          ]"
          @click="emit('select', category.id)"
        >
          <!-- Active indicator bar -->
          <div
            v-if="selectedCategoryId === category.id"
            class="absolute left-0 top-2 bottom-2 w-[3px] bg-ios-primary rounded-r"
          />

          <!-- Drag handle (visible on hover) -->
          <div
            class="drag-handle w-4 flex-shrink-0 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity text-[#AEAEB2]"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
              <circle cx="9" cy="6" r="1.5" />
              <circle cx="15" cy="6" r="1.5" />
              <circle cx="9" cy="12" r="1.5" />
              <circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="18" r="1.5" />
              <circle cx="15" cy="18" r="1.5" />
            </svg>
          </div>

          <!-- Category info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <span
                :class="[
                  'text-sm font-semibold',
                  selectedCategoryId === category.id
                    ? 'text-ios-primary'
                    : 'text-[#1C1C1E]',
                ]"
              >
                {{ category.name }}
              </span>
              <span
                class="text-[11px] font-medium text-[#8E8E93] bg-[#F2F2F7] px-1.5 py-px rounded-full"
              >
                {{ getItemsInCategory(category.id).length }}
              </span>
            </div>
            <div class="text-xs text-[#8E8E93] mt-0.5">
              {{ getCategoryMeta(category) }}
            </div>
          </div>

          <!-- Hover actions -->
          <div
            class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <button
              class="w-7 h-7 flex items-center justify-center rounded-lg text-[#8E8E93] hover:bg-black/5 hover:text-[#1C1C1E] transition-colors"
              :title="t('common.edit')"
              @click.stop="emit('edit-category', category)"
            >
              <PencilIcon class="h-3.5 w-3.5" />
            </button>
            <button
              class="w-7 h-7 flex items-center justify-center rounded-lg text-[#8E8E93] hover:bg-[#FFEBEE] hover:text-ios-error transition-colors"
              :title="t('common.delete')"
              @click.stop="emit('delete-category', category)"
            >
              <TrashIcon class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </VueDraggable>
    </div>

    <!-- Inline edit form (below the list) -->
    <CategoryEditForm
      v-if="showEditForm"
      :editing-category="editingCategory"
      @save="(form, id) => $emit('save-category', form, id)"
      @cancel="$emit('cancel-edit')"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useI18n } from "@/i18n";
import { VueDraggable } from "vue-draggable-plus";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  Squares2X2Icon,
} from "@heroicons/vue/24/outline";
import CategoryEditForm from "./CategoryEditForm.vue";
import type {
  CategoryData,
  MenuItemData,
} from "@/composables/useMenuManagement";

const { t } = useI18n();

const props = defineProps<{
  categories: CategoryData[];
  menuItems: MenuItemData[];
  selectedCategoryId: number | null;
  showEditForm: boolean;
  editingCategory: CategoryData | null;
}>();

const emit = defineEmits<{
  select: [categoryId: number | null];
  "add-category": [];
  "edit-category": [category: CategoryData];
  "delete-category": [category: CategoryData];
  "save-category": [form: any, editingId?: number];
  "cancel-edit": [];
  reorder: [categories: CategoryData[]];
}>();

// Local writable copy for VueDraggable v-model (props are readonly)
const localCategories = ref<CategoryData[]>([]);
watch(
  () => props.categories,
  (newVal) => {
    localCategories.value = [...newVal];
  },
  { immediate: true, deep: true },
);

const totalItems = computed(() => props.menuItems.length);

const getItemsInCategory = (categoryId: number) => {
  return props.menuItems.filter((item) => item.categoryId === categoryId);
};

const getCategoryMeta = (category: CategoryData) => {
  const items = getItemsInCategory(category.id);
  if (items.length === 0) return t("menu.categoryPanel.noItems");
  const available = items.filter((i) => i.isAvailable).length;
  if (available === items.length) return t("menu.categoryPanel.allAvailable");
  const unavailable = items.length - available;
  return t("menu.categoryPanel.mixedStatus", { available, unavailable });
};

// Called after drag-and-drop ends — emit the new order
const handleReorder = () => {
  emit("reorder", [...localCategories.value]);
};
</script>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm typecheck --filter=admin-dashboard
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/components/menu/CategoryPanel.vue
git commit -m "feat(admin): create CategoryPanel with drag-to-reorder and inline editing"
```

---

## Task 7: Rewrite MenuView.vue as master-detail orchestrator

**Files:**

- Modify: `apps/admin-dashboard/src/views/MenuView.vue`

Replace the entire 752-line monolith with a clean orchestrator that:

- Uses master-detail grid layout (`300px 1fr`)
- Delegates to CategoryPanel (left) and menu items grid (right)
- Uses the useMenuManagement composable for all state/API calls
- Keeps the menu item modal (for now — drawer refactor is a future task)

- [ ] **Step 1: Rewrite MenuView.vue**

Replace the entire content of `apps/admin-dashboard/src/views/MenuView.vue` with the new master-detail layout. Key structural changes:

**Template structure:**

```
<div class="menu-view">
  <!-- Page header: title + stats chips -->
  <div class="page-header">...</div>

  <!-- Master-detail grid -->
  <div class="grid grid-cols-[300px_1fr] gap-5 items-start">
    <!-- LEFT: CategoryPanel -->
    <CategoryPanel ... />

    <!-- RIGHT: Items panel -->
    <div>
      <!-- Items header: category title + search + filters + add button -->
      <div class="items-header">...</div>

      <!-- VirtualMenuGrid with MenuItemCard -->
      <VirtualMenuGrid ...>
        <template #default="{ menuItem }">
          <MenuItemCard ... />
        </template>
      </VirtualMenuGrid>

      <!-- Empty state -->
      <div v-if="!filteredItems.length">...</div>
    </div>
  </div>

  <!-- Menu item modal (kept for now, will refactor to drawer later) -->
  <div v-if="showMenuItemModal">...</div>
</div>
```

**Script setup key changes:**

- Import and use `useMenuManagement()` composable
- Import `CategoryPanel`, `MenuItemCard` components
- Remove all inline state management (replaced by composable)
- `selectedCategoryId` drives filtering instead of `categoryFilter` dropdown
- `showCategoryEditForm` and `editingCategory` control inline form
- "Add item" button auto-populates `menuItemForm.categoryId` with `selectedCategoryId`
- Search + status filter remain in the right panel header
- Reduce VirtualMenuGrid columns from 4 to 3 (narrower right panel)

**Style changes:**

- Follow design system: `#F2F2F7` page background, `rounded-2xl` cards, soft shadows
- Items header uses pill-shaped filter buttons instead of `<select>` dropdowns
- Responsive: below 900px, stack category panel above items

- [ ] **Step 2: Verify the page renders**

```bash
pnpm dev --filter=admin-dashboard
```

Navigate to `http://localhost:3001/dashboard/menu` and verify:

- [ ] Category panel appears on the left
- [ ] Clicking a category filters items on the right
- [ ] "All items" shows all items
- [ ] Add category opens inline form below category panel
- [ ] Edit category populates inline form
- [ ] Delete category works with confirmation
- [ ] Drag-to-reorder categories works
- [ ] Add item button is in the right panel header
- [ ] Add item auto-selects current category
- [ ] Search and status filter work
- [ ] Menu item cards show hover actions
- [ ] Edit/delete/toggle on items work

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm typecheck --filter=admin-dashboard
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin-dashboard/src/views/MenuView.vue
git commit -m "feat(admin): rewrite MenuView with master-detail layout and component decomposition"
```

---

## Task 8: Add i18n keys for new UI

**Files:**

- Modify: `apps/admin-dashboard/src/i18n/locales/zh-TW.ts`
- Modify: `apps/admin-dashboard/src/i18n/locales/en-US.ts`
- Modify: `apps/admin-dashboard/src/i18n/locales/zh-CN.ts` (copy from zh-TW with simplified chars)
- Modify: `apps/admin-dashboard/src/i18n/locales/ja-JP.ts` (use en-US as fallback)
- Modify: `apps/admin-dashboard/src/i18n/locales/vi-VN.ts` (use en-US as fallback)
- Modify: `apps/admin-dashboard/src/i18n/locales/id-ID.ts` (use en-US as fallback)

Add missing i18n keys used by the new components. The project supports 6 locales — all must have the new keys to avoid raw key strings.

> **Known limitation:** The `nameEn` field in category forms is a pre-existing pattern from the original MenuView.vue. The `categories` database schema has no `nameEn` column — the API silently ignores this field. This is acceptable for now; a schema migration to add `nameEn` to categories is tracked as a separate task.

- [ ] **Step 1: Add zh-TW translations**

Add these keys inside the existing `menu` section in `apps/admin-dashboard/src/i18n/locales/zh-TW.ts`:

```typescript
// Inside menu: { ... }
categoryPanel: {
  title: "分類管理",
  add: "新增",
  allItems: "所有菜品",
  totalItems: "共 {count} 項",
  noItems: "尚無菜品",
  allAvailable: "全部供應中",
  mixedStatus: "{available} 供應中 · {unavailable} 已停售",
},
toast: {
  categoryCreated: "分類已新增",
  categoryUpdated: "分類已更新",
  categoryDeleted: "分類已刪除",
  itemCreated: "菜品已新增",
  itemUpdated: "菜品已更新",
  itemDeleted: "菜品已刪除",
},
errors: {
  fetchFailed: "載入菜單失敗",
  saveFailed: "操作失敗",
  deleteFailed: "刪除失敗",
  reorderFailed: "排序更新失敗",
  toggleFailed: "更新狀態失敗",
},
form: {
  // Add to existing form keys:
  categoryNamePlaceholder: "輸入分類名稱",
  descriptionPlaceholder: "選填描述",
},
itemsHeader: {
  filterAll: "全部",
  filterAvailable: "供應中",
  filterUnavailable: "已停售",
  searchPlaceholder: "搜尋菜品...",
  addItem: "新增菜品",
  itemCount: "{count} 項菜品",
},
confirms: {
  // Add to existing confirms:
  deleteCategory: "確定要刪除分類「{name}」嗎？該分類下的所有菜品也會被刪除。",
},
stats: {
  categories: "分類",
  items: "菜品",
  available: "供應中",
},
```

- [ ] **Step 2: Add en-US translations**

Add equivalent English keys in `apps/admin-dashboard/src/i18n/locales/en-US.ts`:

```typescript
categoryPanel: {
  title: "Categories",
  add: "Add",
  allItems: "All Items",
  totalItems: "{count} total",
  noItems: "No items yet",
  allAvailable: "All available",
  mixedStatus: "{available} available · {unavailable} unavailable",
},
toast: {
  categoryCreated: "Category created",
  categoryUpdated: "Category updated",
  categoryDeleted: "Category deleted",
  itemCreated: "Item created",
  itemUpdated: "Item updated",
  itemDeleted: "Item deleted",
},
errors: {
  fetchFailed: "Failed to load menu",
  saveFailed: "Operation failed",
  deleteFailed: "Delete failed",
  reorderFailed: "Reorder failed",
  toggleFailed: "Status update failed",
},
form: {
  categoryNamePlaceholder: "Enter category name",
  descriptionPlaceholder: "Optional description",
},
itemsHeader: {
  filterAll: "All",
  filterAvailable: "Available",
  filterUnavailable: "Unavailable",
  searchPlaceholder: "Search items...",
  addItem: "Add Item",
  itemCount: "{count} items",
},
confirms: {
  deleteCategory: "Delete category \"{name}\"? All items in this category will also be deleted.",
},
stats: {
  categories: "categories",
  items: "items",
  available: "available",
},
```

- [ ] **Step 3: Add keys to remaining 4 locales**

For `zh-CN.ts`: copy the zh-TW keys and convert to simplified Chinese.
For `ja-JP.ts`, `vi-VN.ts`, `id-ID.ts`: copy the en-US keys as fallback translations.

Each locale file has the same nested structure — add the same keys under the `menu` section.

- [ ] **Step 4: Verify no missing i18n keys at runtime**

Open browser console and check for any i18n key warnings when navigating the menu page. Switch between all 6 locale options to verify.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-dashboard/src/i18n/locales/*.ts
git commit -m "feat(admin): add i18n keys for menu master-detail redesign (6 locales)"
```

---

## Task 9: Design system compliance pass

**Files:**

- Modify: All new components as needed

Final pass to ensure all components follow the Apple-Native Soft Minimalism design system (`docs/UIUX-design-system.md`).

- [ ] **Step 1: Review against design checklist (Section 15)**

Verify each of these design system rules:

- [ ] Page background is `#F2F2F7`
- [ ] Cards use `rounded-2xl` ~ `rounded-3xl` + soft shadow (opacity <= 8%)
- [ ] No hard borders (`border-gray-300` etc.) — use shadow + bg difference
- [ ] Buttons/tags are pill-shaped (`rounded-full`)
- [ ] Text never pure black, using `#1C1C1E`
- [ ] Colors: `#007AFF` primary, `#34C759` success, `#FF9500` warning, `#FF3B30` error
- [ ] Animations 200-350ms, ease-out
- [ ] Inputs use `rounded-xl` (12px)
- [ ] No visible scrollbars (use thin/custom or auto-hide)

- [ ] **Step 2: Fix any violations found**

Update the components to fix any design system violations found.

- [ ] **Step 3: Verify responsive layout**

Test at these breakpoints:

- [ ] 1440px: full master-detail layout
- [ ] 1024px: narrower category panel (260px)
- [ ] 768px: stacked layout (category panel on top)
- [ ] 375px: mobile layout

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "style(admin): design system compliance pass for menu master-detail layout"
```

---

## Task 10: Visual verification and cleanup

**Files:**

- Delete: Old modal code remnants if any remain

- [ ] **Step 1: Verify complete user flow**

Test each flow end-to-end:

1. Load menu page → categories and items appear
2. Click a category → right panel filters to that category
3. Click "所有菜品" → shows all items
4. Click "新增" in category panel → inline form appears below
5. Fill in form and save → category appears in list
6. Hover a category → edit/delete buttons appear
7. Click edit → form populates with category data
8. Drag a category to reorder → order persists after refresh
9. Click "新增菜品" in right panel → modal opens with category pre-selected
10. Edit a menu item → modal populates correctly
11. Toggle availability → status badge updates
12. Delete an item → item removed from grid

- [ ] **Step 2: Remove old modal-only category code**

Verify that the old category modal code has been fully removed from MenuView.vue. There should be no `showCategoryModal` ref, no category modal template, and no `closeCategoryModal` function.

- [ ] **Step 3: Run full typecheck and lint**

```bash
pnpm typecheck
pnpm lint
```

Expected: 0 errors, 0 warnings

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(admin): complete menu management master-detail refactor

- Split MenuView.vue (752 lines) into 4 focused components
- CategoryPanel: persistent sidebar with drag-to-reorder
- CategoryEditForm: inline editing (replaces modal)
- MenuItemCard: self-contained card component
- useMenuManagement: shared composable for state & API
- New API: PATCH /categories/reorder for batch sort order updates
- Design system compliant (Apple-Native Soft Minimalism)"
```

---

## Summary

| Metric             | Before                       | After                            |
| ------------------ | ---------------------------- | -------------------------------- |
| MenuView.vue lines | ~752                         | ~180 (orchestrator)              |
| Components         | 1 monolith + VirtualMenuGrid | 5 focused components             |
| Category UX        | Hidden in modal              | Persistent sidebar + inline edit |
| Item filtering     | Manual dropdown              | Click category → auto-filter     |
| Category reorder   | Manual sortOrder number      | Drag-and-drop                    |
| API endpoints      | Existing CRUD                | + PATCH categories/reorder       |
| Design system      | Partial compliance           | Full compliance                  |

**Total new/modified files:** 15 files (4 new frontend + 1 modified view + 6 i18n + 4 backend)
**Estimated tasks:** 10 tasks, each ~5-15 minutes

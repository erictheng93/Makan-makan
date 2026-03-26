<template>
  <div>
    <!-- Category List Card -->
    <div
      class="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden lg:sticky lg:top-7"
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

    <!-- Category edit form is rendered as a modal by MenuView -->
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
import type {
  CategoryData,
  MenuItemData,
} from "@/composables/useMenuManagement";

const { t } = useI18n();

const props = defineProps<{
  categories: CategoryData[];
  menuItems: MenuItemData[];
  selectedCategoryId: number | null;
}>();

const emit = defineEmits<{
  select: [categoryId: number | null];
  "add-category": [];
  "edit-category": [category: CategoryData];
  "delete-category": [category: CategoryData];
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

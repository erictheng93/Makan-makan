<template>
  <div
    ref="container"
    :style="{ height: containerHeight + 'px', overflowY: 'auto' }"
    class="virtual-menu-grid-container grid gap-6"
    :class="gridCols"
    @scroll="handleScroll"
  >
    <!-- Virtual spacer for items before visible area -->
    <div
      v-if="beforeHeight > 0"
      :style="{
        height: beforeHeight + 'px',
        gridColumn: `1 / -1`,
      }"
    />

    <!-- Visible menu item cards -->
    <div
      v-for="menuItem in visibleMenuItems"
      :key="menuItem.id"
      :style="{ minHeight: itemHeight + 'px' }"
      class="virtual-grid-item"
    >
      <slot :menu-item="menuItem" :index="menuItem._virtualIndex" />
    </div>

    <!-- Virtual spacer for items after visible area -->
    <div
      v-if="afterHeight > 0"
      :style="{
        height: afterHeight + 'px',
        gridColumn: `1 / -1`,
      }"
    />

    <!-- Loading indicator -->
    <div
      v-if="loading"
      :style="{ height: itemHeight + 'px', gridColumn: `1 / -1` }"
      class="virtual-grid-loading"
    >
      <div class="flex items-center justify-center h-full">
        <div
          class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
        />
        <span class="ml-3 text-gray-600">載入中...</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from "vue";

interface MenuItem {
  id: number;
  categoryId: number;
  name: string;
  nameEn?: string;
  description?: string;
  price: number;
  imageUrl?: string | null;
  isFeatured?: boolean;
  isAvailable: boolean;
  sortOrder: number;
}

interface MenuItemWithIndex extends MenuItem {
  _virtualIndex: number;
}

interface Props {
  menuItems: MenuItem[];
  itemHeight: number;
  containerHeight?: number;
  columnsCount?: number;
  bufferSize?: number;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  containerHeight: 600,
  columnsCount: 4,
  bufferSize: 3,
  loading: false,
});

// Refs
const container = ref<HTMLElement>();
const scrollTop = ref(0);

// Computed properties
const totalMenuItems = computed(() => props.menuItems.length);
const rowsPerView = computed(() =>
  Math.ceil(props.containerHeight / props.itemHeight),
);
const totalRows = computed(() =>
  Math.ceil(totalMenuItems.value / props.columnsCount),
);

const gridCols = computed(() => {
  const colsMap: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
    5: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
    6: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
  };
  return (
    colsMap[props.columnsCount] ||
    "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
  );
});

const startRow = computed(() => {
  const row = Math.floor(scrollTop.value / props.itemHeight) - props.bufferSize;
  return Math.max(0, row);
});

const endRow = computed(() => {
  const row = startRow.value + rowsPerView.value + props.bufferSize * 2;
  return Math.min(totalRows.value - 1, row);
});

const visibleMenuItems = computed(() => {
  const startIndex = startRow.value * props.columnsCount;
  const endIndex = (endRow.value + 1) * props.columnsCount - 1;

  const items: MenuItemWithIndex[] = [];
  for (let i = startIndex; i <= endIndex && i < props.menuItems.length; i++) {
    if (props.menuItems[i]) {
      items.push({
        ...props.menuItems[i],
        _virtualIndex: i,
      });
    }
  }
  return items;
});

const beforeHeight = computed(() => startRow.value * props.itemHeight);
const afterHeight = computed(() => {
  const remaining = totalRows.value - endRow.value - 1;
  return Math.max(0, remaining * props.itemHeight);
});

// Methods
const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement;
  scrollTop.value = target.scrollTop;
};

const scrollToTop = (behavior: "auto" | "smooth" = "smooth") => {
  if (!container.value) return;

  container.value.scrollTo({
    top: 0,
    behavior,
  });
};

const scrollToBottom = (behavior: "auto" | "smooth" = "smooth") => {
  if (!container.value) return;

  container.value.scrollTo({
    top: container.value.scrollHeight,
    behavior,
  });
};

const scrollToMenuItem = (
  menuItemId: number,
  behavior: "auto" | "smooth" = "smooth",
) => {
  const itemIndex = props.menuItems.findIndex((item) => item.id === menuItemId);
  if (itemIndex === -1 || !container.value) return;

  const row = Math.floor(itemIndex / props.columnsCount);
  const scrollPosition = row * props.itemHeight;

  container.value.scrollTo({
    top: scrollPosition,
    behavior,
  });
};

// Watch for menuItems changes and maintain scroll position
let previousMenuItemsLength = 0;
watch(
  () => props.menuItems.length,
  (newLength) => {
    const itemsAdded = newLength - previousMenuItemsLength;

    // If items were prepended, adjust scroll position
    if (itemsAdded > 0 && previousMenuItemsLength > 0) {
      nextTick(() => {
        if (container.value) {
          const newRows = Math.ceil(itemsAdded / props.columnsCount);
          const newScrollTop = scrollTop.value + newRows * props.itemHeight;
          container.value.scrollTop = newScrollTop;
        }
      });
    }

    previousMenuItemsLength = newLength;
  },
);

// Lifecycle
onMounted(() => {
  if (container.value) {
    scrollTop.value = container.value.scrollTop;
  }
});

// Expose methods for parent components
defineExpose({
  scrollToTop,
  scrollToBottom,
  scrollToMenuItem,
  container,
});
</script>

<style scoped>
.virtual-menu-grid-container {
  position: relative;
  box-sizing: border-box;
}

.virtual-grid-item {
  overflow: hidden;
  box-sizing: border-box;
}

.virtual-grid-loading {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Webkit scrollbar styling */
.virtual-menu-grid-container::-webkit-scrollbar {
  width: 12px;
}

.virtual-menu-grid-container::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 6px;
}

.virtual-menu-grid-container::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 6px;
}

.virtual-menu-grid-container::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>

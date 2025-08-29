<template>
  <div
    ref="container"
    :style="{ height: containerHeight + 'px', overflowY: 'auto' }"
    @scroll="handleScroll"
    class="virtual-scroll-container"
  >
    <!-- Virtual spacer for items before visible area -->
    <div :style="{ height: beforeHeight + 'px' }"></div>
    
    <!-- Visible items -->
    <div
      v-for="item in visibleItems"
      :key="getItemKey ? getItemKey(item) : item.id"
      :style="{ height: itemHeight + 'px' }"
      class="virtual-scroll-item"
    >
      <slot :item="item" :index="item._virtualIndex"></slot>
    </div>
    
    <!-- Virtual spacer for items after visible area -->
    <div :style="{ height: afterHeight + 'px' }"></div>
    
    <!-- Loading indicator -->
    <div
      v-if="loading && hasMore"
      class="virtual-scroll-loading"
      :style="{ height: itemHeight + 'px' }"
    >
      <div class="flex items-center justify-center h-full">
        <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span class="ml-2 text-gray-600">載入中...</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

interface Props<T = any> {
  items: T[]
  itemHeight: number
  containerHeight?: number
  bufferSize?: number
  getItemKey?: (item: T) => string | number
  loading?: boolean
  hasMore?: boolean
  loadMore?: () => Promise<void>
  loadMoreThreshold?: number
}

const props = withDefaults(defineProps<Props<T>>(), {
  containerHeight: 400,
  bufferSize: 5,
  loading: false,
  hasMore: false,
  loadMoreThreshold: 3
})

const emit = defineEmits<{
  'load-more': []
}>()

// Refs
const container = ref<HTMLElement>()
const scrollTop = ref(0)
const isLoadingMore = ref(false)

// Computed properties
const totalItems = computed(() => props.items.length)
const totalHeight = computed(() => totalItems.value * props.itemHeight)
const visibleCount = computed(() => Math.ceil(props.containerHeight / props.itemHeight))

const startIndex = computed(() => {
  const index = Math.floor(scrollTop.value / props.itemHeight) - props.bufferSize
  return Math.max(0, index)
})

const endIndex = computed(() => {
  const index = startIndex.value + visibleCount.value + props.bufferSize * 2
  return Math.min(totalItems.value - 1, index)
})

const visibleItems = computed(() => {
  const items = []
  for (let i = startIndex.value; i <= endIndex.value; i++) {
    if (props.items[i]) {
      items.push({
        ...props.items[i],
        _virtualIndex: i
      })
    }
  }
  return items
})

const beforeHeight = computed(() => startIndex.value * props.itemHeight)
const afterHeight = computed(() => {
  const remaining = totalItems.value - endIndex.value - 1
  return Math.max(0, remaining * props.itemHeight)
})

// Methods
const handleScroll = async (event: Event) => {
  const target = event.target as HTMLElement
  scrollTop.value = target.scrollTop
  
  // Check if we need to load more items
  if (props.hasMore && !isLoadingMore.value && props.loadMore) {
    const scrolledPercentage = (target.scrollTop + target.clientHeight) / target.scrollHeight
    if (scrolledPercentage > 0.9) { // Load more when 90% scrolled
      await loadMoreItems()
    }
  }
}

const loadMoreItems = async () => {
  if (isLoadingMore.value || !props.loadMore) return
  
  try {
    isLoadingMore.value = true
    await props.loadMore()
    emit('load-more')
  } catch (error) {
    console.error('Error loading more items:', error)
  } finally {
    isLoadingMore.value = false
  }
}

const scrollToIndex = (index: number, behavior: 'auto' | 'smooth' = 'auto') => {
  if (!container.value) return
  
  const scrollPosition = index * props.itemHeight
  container.value.scrollTo({
    top: scrollPosition,
    behavior
  })
}

const scrollToTop = (behavior: 'auto' | 'smooth' = 'smooth') => {
  if (!container.value) return
  
  container.value.scrollTo({
    top: 0,
    behavior
  })
}

const scrollToBottom = (behavior: 'auto' | 'smooth' = 'smooth') => {
  if (!container.value) return
  
  container.value.scrollTo({
    top: container.value.scrollHeight,
    behavior
  })
}

// Watch for items changes and maintain scroll position
let previousItemsLength = 0
watch(() => props.items.length, (newLength) => {
  const itemsAdded = newLength - previousItemsLength
  
  // If items were prepended, adjust scroll position
  if (itemsAdded > 0 && previousItemsLength > 0) {
    nextTick(() => {
      if (container.value) {
        const newScrollTop = scrollTop.value + (itemsAdded * props.itemHeight)
        container.value.scrollTop = newScrollTop
      }
    })
  }
  
  previousItemsLength = newLength
})

// Lifecycle
onMounted(() => {
  if (container.value) {
    scrollTop.value = container.value.scrollTop
  }
})

// Expose methods for parent components
defineExpose({
  scrollToIndex,
  scrollToTop,
  scrollToBottom,
  container
})
</script>

<style scoped>
.virtual-scroll-container {
  position: relative;
  box-sizing: border-box;
}

.virtual-scroll-item {
  overflow: hidden;
  box-sizing: border-box;
}

.virtual-scroll-loading {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Webkit scrollbar styling */
.virtual-scroll-container::-webkit-scrollbar {
  width: 8px;
}

.virtual-scroll-container::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}

.virtual-scroll-container::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.virtual-scroll-container::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
import { ref, computed, onMounted, onBeforeUnmount, Ref } from 'vue'

interface VirtualScrollOptions {
  itemHeight: number
  buffer?: number
  containerHeight?: number
}

/**
 * 虛擬滾動 Hook
 * 只渲染可見區域的項目，大幅提升長列表性能
 */
export function useVirtualScroll<T>(
  items: Ref<T[]> | T[],
  options: VirtualScrollOptions
) {
  const {
    itemHeight,
    buffer = 5,
    containerHeight: fixedContainerHeight
  } = options

  const scrollTop = ref(0)
  const containerHeight = ref(fixedContainerHeight || 600)
  const containerRef = ref<HTMLElement | null>(null)

  // 獲取項目數組（支持 Ref 和普通數組）
  const itemsArray = computed(() => {
    return Array.isArray(items) ? items : items.value
  })

  // 計算可見範圍
  const visibleRange = computed(() => {
    const start = Math.floor(scrollTop.value / itemHeight)
    const end = Math.ceil((scrollTop.value + containerHeight.value) / itemHeight)

    return {
      start: Math.max(0, start - buffer),
      end: Math.min(itemsArray.value.length, end + buffer)
    }
  })

  // 可見項目
  const visibleItems = computed(() => {
    const { start, end } = visibleRange.value
    return itemsArray.value.slice(start, end).map((item, index) => ({
      item,
      index: start + index,
      offsetTop: (start + index) * itemHeight
    }))
  })

  // 總高度
  const totalHeight = computed(() => {
    return itemsArray.value.length * itemHeight
  })

  // 滾動偏移量（用於定位虛擬內容）
  const offsetY = computed(() => {
    return visibleRange.value.start * itemHeight
  })

  // 處理滾動事件
  const handleScroll = (event: Event) => {
    const target = event.target as HTMLElement
    scrollTop.value = target.scrollTop
  }

  // 滾動到指定索引
  const scrollToIndex = (index: number, behavior: ScrollBehavior = 'smooth') => {
    if (!containerRef.value) return

    const targetScrollTop = index * itemHeight
    containerRef.value.scrollTo({
      top: targetScrollTop,
      behavior
    })
  }

  // 更新容器高度
  const updateContainerHeight = () => {
    if (containerRef.value && !fixedContainerHeight) {
      containerHeight.value = containerRef.value.clientHeight
    }
  }

  // 監聽容器大小變化
  let resizeObserver: ResizeObserver | null = null

  onMounted(() => {
    updateContainerHeight()

    if (containerRef.value && !fixedContainerHeight) {
      resizeObserver = new ResizeObserver(updateContainerHeight)
      resizeObserver.observe(containerRef.value)
    }
  })

  onBeforeUnmount(() => {
    if (resizeObserver) {
      resizeObserver.disconnect()
    }
  })

  return {
    containerRef,
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
    scrollToIndex,
    scrollTop
  }
}

/**
 * 動態高度虛擬滾動（項目高度不固定）
 */
export function useDynamicVirtualScroll<T>(
  items: Ref<T[]> | T[],
  options: {
    estimatedItemHeight: number
    buffer?: number
    containerHeight?: number
  }
) {
  const {
    estimatedItemHeight,
    buffer = 5,
    containerHeight: fixedContainerHeight
  } = options

  const scrollTop = ref(0)
  const containerHeight = ref(fixedContainerHeight || 600)
  const containerRef = ref<HTMLElement | null>(null)

  // 存儲每個項目的實際高度
  const itemHeights = ref<Map<number, number>>(new Map())
  const itemOffsets = ref<Map<number, number>>(new Map())

  const itemsArray = computed(() => {
    return Array.isArray(items) ? items : items.value
  })

  // 計算項目偏移量
  const calculateOffsets = () => {
    let offset = 0
    itemOffsets.value.clear()

    for (let i = 0; i < itemsArray.value.length; i++) {
      itemOffsets.value.set(i, offset)
      const height = itemHeights.value.get(i) || estimatedItemHeight
      offset += height
    }
  }

  // 獲取項目偏移量
  const getItemOffset = (index: number): number => {
    if (itemOffsets.value.has(index)) {
      return itemOffsets.value.get(index)!
    }
    return index * estimatedItemHeight
  }

  // 獲取項目高度
  const getItemHeight = (index: number): number => {
    return itemHeights.value.get(index) || estimatedItemHeight
  }

  // 查找可見範圍
  const findVisibleRange = () => {
    const scrollBottom = scrollTop.value + containerHeight.value

    let start = 0
    let end = itemsArray.value.length

    // 二分查找起始索引
    let left = 0
    let right = itemsArray.value.length - 1

    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const offset = getItemOffset(mid)

      if (offset < scrollTop.value) {
        left = mid + 1
      } else {
        start = mid
        right = mid - 1
      }
    }

    // 查找結束索引
    for (let i = start; i < itemsArray.value.length; i++) {
      const offset = getItemOffset(i)
      if (offset > scrollBottom) {
        end = i
        break
      }
    }

    return {
      start: Math.max(0, start - buffer),
      end: Math.min(itemsArray.value.length, end + buffer)
    }
  }

  const visibleRange = computed(findVisibleRange)

  const visibleItems = computed(() => {
    const { start, end } = visibleRange.value
    return itemsArray.value.slice(start, end).map((item, index) => ({
      item,
      index: start + index,
      offsetTop: getItemOffset(start + index)
    }))
  })

  const totalHeight = computed(() => {
    const lastIndex = itemsArray.value.length - 1
    if (lastIndex < 0) return 0

    const lastOffset = getItemOffset(lastIndex)
    const lastHeight = getItemHeight(lastIndex)
    return lastOffset + lastHeight
  })

  const offsetY = computed(() => {
    return getItemOffset(visibleRange.value.start)
  })

  // 更新項目高度
  const setItemHeight = (index: number, height: number) => {
    if (itemHeights.value.get(index) !== height) {
      itemHeights.value.set(index, height)
      calculateOffsets()
    }
  }

  const handleScroll = (event: Event) => {
    const target = event.target as HTMLElement
    scrollTop.value = target.scrollTop
  }

  const scrollToIndex = (index: number, behavior: ScrollBehavior = 'smooth') => {
    if (!containerRef.value) return

    const targetScrollTop = getItemOffset(index)
    containerRef.value.scrollTo({
      top: targetScrollTop,
      behavior
    })
  }

  const updateContainerHeight = () => {
    if (containerRef.value && !fixedContainerHeight) {
      containerHeight.value = containerRef.value.clientHeight
    }
  }

  let resizeObserver: ResizeObserver | null = null

  onMounted(() => {
    updateContainerHeight()
    calculateOffsets()

    if (containerRef.value && !fixedContainerHeight) {
      resizeObserver = new ResizeObserver(updateContainerHeight)
      resizeObserver.observe(containerRef.value)
    }
  })

  onBeforeUnmount(() => {
    if (resizeObserver) {
      resizeObserver.disconnect()
    }
  })

  return {
    containerRef,
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
    scrollToIndex,
    setItemHeight,
    scrollTop
  }
}

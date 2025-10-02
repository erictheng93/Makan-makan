/**
 * Vue Composable for Pagination (PWA-Optimized)
 *
 * Mobile-optimized pagination with offline support and performance features
 */

import { ref, computed, onMounted, onUnmounted, type Ref } from "vue";
import type {
  PaginationParams,
  PaginatedResponse,
  InfiniteScrollState,
} from "@makanmakan/shared-types";

/**
 * Infinite scroll pagination optimized for mobile PWA
 *
 * Features:
 * - Automatic load more on scroll
 * - Intersection Observer for performance
 * - Network-aware loading
 * - Offline support with cached data
 *
 * @example
 * const { items, isLoading, hasMore, loadMore, containerRef } = useInfiniteScroll(
 *   (params) => api.getMenuItems(params),
 *   { pageSize: 10, autoLoad: true }
 * )
 */
export function useInfiniteScroll<T>(
  fetchFn: (params: PaginationParams) => Promise<PaginatedResponse<T>>,
  options: {
    pageSize?: number;
    autoLoad?: boolean;
    threshold?: number;
    rootMargin?: string;
    networkAware?: boolean;
  } = {},
) {
  const {
    pageSize = 10, // Smaller for mobile
    autoLoad = true,
    threshold = 0.5,
    rootMargin = "200px",
    networkAware = true,
  } = options;

  const state = ref<InfiniteScrollState<T>>({
    items: [],
    isLoading: false,
    hasMore: true,
    currentPage: 0,
    error: null,
  });

  const params = ref<PaginationParams>({
    page: 1,
    pageSize,
    sortOrder: "desc",
  });

  // Refs for Intersection Observer
  const containerRef = ref<HTMLElement | null>(null);
  const sentinelRef = ref<HTMLElement | null>(null);
  let observer: IntersectionObserver | null = null;

  // Network status
  const isOnline = ref(navigator.onLine);

  /**
   * Check if should load based on network conditions
   */
  const shouldLoad = (): boolean => {
    if (!networkAware) return true;
    if (!isOnline.value) return false;

    // Check connection type if available
    if ("connection" in navigator) {
      const conn = (navigator as any).connection;
      if (conn) {
        // Don't auto-load on slow connections
        if (conn.effectiveType === "2g" || conn.effectiveType === "slow-2g") {
          console.log(
            "[InfiniteScroll] Slow connection detected, skipping auto-load",
          );
          return false;
        }
        // Respect data saver mode
        if (conn.saveData) {
          console.log(
            "[InfiniteScroll] Data saver mode detected, skipping auto-load",
          );
          return false;
        }
      }
    }

    return true;
  };

  /**
   * Load next page and append to items
   */
  const loadMore = async (force = false) => {
    if (state.value.isLoading || !state.value.hasMore) {
      return;
    }

    if (!force && !shouldLoad()) {
      return;
    }

    state.value.isLoading = true;
    state.value.error = null;

    try {
      const nextPage = state.value.currentPage + 1;
      params.value.page = nextPage;

      const response = await fetchFn(params.value);

      state.value.items.push(...response.data);
      state.value.currentPage = nextPage;
      state.value.hasMore = response.pagination.hasNextPage;
    } catch (e) {
      state.value.error = e as Error;
      console.error("[InfiniteScroll] Failed to load more:", e);
    } finally {
      state.value.isLoading = false;
    }
  };

  /**
   * Setup Intersection Observer for auto-loading
   */
  const setupObserver = () => {
    if (!autoLoad || !("IntersectionObserver" in window)) {
      return;
    }

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (
            entry.isIntersecting &&
            state.value.hasMore &&
            !state.value.isLoading
          ) {
            loadMore();
          }
        });
      },
      {
        threshold,
        rootMargin,
        root: containerRef.value,
      },
    );

    if (sentinelRef.value) {
      observer.observe(sentinelRef.value);
    }
  };

  /**
   * Reset and load first page
   */
  const refresh = async () => {
    state.value.items = [];
    state.value.currentPage = 0;
    state.value.hasMore = true;
    state.value.error = null;
    await loadMore(true); // Force load even on slow connection
  };

  /**
   * Update search query and refresh
   */
  const search = async (query: string) => {
    params.value.search = query;
    await refresh();
  };

  /**
   * Apply filters and refresh
   */
  const applyFilters = async (filters: Record<string, any>) => {
    params.value.filters = filters;
    await refresh();
  };

  /**
   * Handle online/offline events
   */
  const handleOnline = () => {
    isOnline.value = true;
    console.log("[InfiniteScroll] Back online");
  };

  const handleOffline = () => {
    isOnline.value = false;
    console.log("[InfiniteScroll] Offline");
  };

  // Computed properties
  const isEmpty = computed(
    () => state.value.items.length === 0 && !state.value.isLoading,
  );
  const canLoadMore = computed(
    () => state.value.hasMore && !state.value.isLoading,
  );

  // Lifecycle
  onMounted(() => {
    setupObserver();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
  });

  onUnmounted(() => {
    observer?.disconnect();
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  });

  return {
    // State
    items: computed(() => state.value.items),
    isLoading: computed(() => state.value.isLoading),
    hasMore: computed(() => state.value.hasMore),
    error: computed(() => state.value.error),
    isOnline,

    // Computed
    isEmpty,
    canLoadMore,

    // Refs for template
    containerRef,
    sentinelRef,

    // Methods
    loadMore: () => loadMore(true), // Force load when called manually
    refresh,
    search,
    applyFilters,
  };
}

/**
 * Pull-to-refresh functionality for mobile
 *
 * @example
 * const { isRefreshing, handleTouchStart, handleTouchMove, handleTouchEnd } = usePullToRefresh(
 *   async () => { await refreshData() }
 * )
 */
export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const isRefreshing = ref(false);
  const startY = ref(0);
  const currentY = ref(0);
  const threshold = 80; // Pull down threshold in pixels

  const isPulling = computed(() => currentY.value - startY.value > 0);
  const pullDistance = computed(() =>
    Math.max(0, currentY.value - startY.value),
  );
  const shouldRefresh = computed(() => pullDistance.value >= threshold);

  const handleTouchStart = (event: TouchEvent) => {
    if (window.scrollY === 0) {
      startY.value = event.touches[0].clientY;
    }
  };

  const handleTouchMove = (event: TouchEvent) => {
    if (startY.value > 0 && window.scrollY === 0) {
      currentY.value = event.touches[0].clientY;

      // Prevent default scroll if pulling down
      if (pullDistance.value > 10) {
        event.preventDefault();
      }
    }
  };

  const handleTouchEnd = async () => {
    if (shouldRefresh.value && !isRefreshing.value) {
      isRefreshing.value = true;
      try {
        await onRefresh();
      } finally {
        isRefreshing.value = false;
      }
    }

    startY.value = 0;
    currentY.value = 0;
  };

  return {
    isRefreshing,
    isPulling,
    pullDistance,
    shouldRefresh,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}

/**
 * Virtual scrolling for large lists (performance optimization)
 *
 * Only renders visible items in viewport
 *
 * @example
 * const { visibleItems, containerStyle, itemStyle } = useVirtualScroll(
 *   items,
 *   { itemHeight: 80, buffer: 5 }
 * )
 */
export function useVirtualScroll<T>(
  items: Ref<T[]>,
  options: {
    itemHeight: number;
    buffer?: number;
    containerHeight?: number;
  },
) {
  const {
    itemHeight,
    buffer = 5,
    containerHeight = window.innerHeight,
  } = options;

  const scrollTop = ref(0);

  const startIndex = computed(() => {
    return Math.max(0, Math.floor(scrollTop.value / itemHeight) - buffer);
  });

  const endIndex = computed(() => {
    return Math.min(
      items.value.length,
      Math.ceil((scrollTop.value + containerHeight) / itemHeight) + buffer,
    );
  });

  const visibleItems = computed(() => {
    return items.value
      .slice(startIndex.value, endIndex.value)
      .map((item, index) => ({
        item,
        index: startIndex.value + index,
      }));
  });

  const totalHeight = computed(() => items.value.length * itemHeight);

  const offsetY = computed(() => startIndex.value * itemHeight);

  const handleScroll = (event: Event) => {
    const target = event.target as HTMLElement;
    scrollTop.value = target.scrollTop;
  };

  const containerStyle = computed(() => ({
    height: `${containerHeight}px`,
    overflow: "auto",
    position: "relative" as const,
  }));

  const wrapperStyle = computed(() => ({
    height: `${totalHeight.value}px`,
    position: "relative" as const,
  }));

  const contentStyle = computed(() => ({
    transform: `translateY(${offsetY.value}px)`,
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
  }));

  const itemStyle = computed(() => ({
    height: `${itemHeight}px`,
  }));

  return {
    visibleItems,
    containerStyle,
    wrapperStyle,
    contentStyle,
    itemStyle,
    handleScroll,
  };
}

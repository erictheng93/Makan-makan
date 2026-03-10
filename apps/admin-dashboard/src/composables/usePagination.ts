/**
 * Vue Composable for Pagination
 *
 * Provides reactive pagination state and utilities
 */

import { ref, computed, type Ref } from "vue";
import type {
  PaginationParams,
  PaginatedResponse,
  CursorPaginatedResponse,
  InfiniteScrollState,
} from "@makanmakan/shared-types";

/**
 * Standard offset-based pagination
 *
 * @example
 * const { data, pagination, isLoading, loadPage, refresh } = usePagination(
 *   (params) => api.getOrders(params),
 *   { pageSize: 20, sortBy: 'createdAt' }
 * )
 */
export function usePagination<T>(
  fetchFn: (params: PaginationParams) => Promise<PaginatedResponse<T>>,
  initialParams: PaginationParams = {},
) {
  const params = ref<PaginationParams>({
    page: 1,
    pageSize: 20,
    sortOrder: "desc",
    ...initialParams,
  });

  const data = ref<T[]>([]) as Ref<T[]>;
  const pagination = ref({
    currentPage: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
    startIndex: 0,
    endIndex: 0,
  });

  const isLoading = ref(false);
  const error = ref<Error | null>(null);

  /**
   * Load data for specific page
   */
  const loadPage = async (page: number) => {
    isLoading.value = true;
    error.value = null;

    try {
      params.value.page = page;
      const response = await fetchFn(params.value);

      data.value = response.data;
      pagination.value = response.pagination;
    } catch (e) {
      error.value = e as Error;
      console.error("[Pagination] Failed to load page:", e);
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Go to next page
   */
  const nextPage = async () => {
    if (pagination.value.hasNextPage) {
      await loadPage(pagination.value.currentPage + 1);
    }
  };

  /**
   * Go to previous page
   */
  const previousPage = async () => {
    if (pagination.value.hasPreviousPage) {
      await loadPage(pagination.value.currentPage - 1);
    }
  };

  /**
   * Go to first page
   */
  const firstPage = async () => {
    await loadPage(1);
  };

  /**
   * Go to last page
   */
  const lastPage = async () => {
    await loadPage(pagination.value.totalPages);
  };

  /**
   * Change page size and reload
   */
  const changePageSize = async (newPageSize: number) => {
    params.value.pageSize = newPageSize;
    await loadPage(1); // Reset to first page
  };

  /**
   * Change sort and reload
   */
  const changeSort = async (
    sortBy: string,
    sortOrder: "asc" | "desc" = "desc",
  ) => {
    params.value.sortBy = sortBy;
    params.value.sortOrder = sortOrder;
    await loadPage(1); // Reset to first page
  };

  /**
   * Search and reload
   */
  const search = async (query: string) => {
    params.value.search = query;
    await loadPage(1); // Reset to first page
  };

  /**
   * Apply filters and reload
   */
  const applyFilters = async (filters: Record<string, any>) => {
    params.value.filters = filters;
    await loadPage(1); // Reset to first page
  };

  /**
   * Refresh current page
   */
  const refresh = async () => {
    await loadPage(pagination.value.currentPage);
  };

  /**
   * Computed properties
   */
  const isEmpty = computed(() => data.value.length === 0 && !isLoading.value);
  const isFirstPage = computed(() => !pagination.value.hasPreviousPage);
  const isLastPage = computed(() => !pagination.value.hasNextPage);

  return {
    // State
    data,
    pagination,
    params,
    isLoading,
    error,

    // Computed
    isEmpty,
    isFirstPage,
    isLastPage,

    // Methods
    loadPage,
    nextPage,
    previousPage,
    firstPage,
    lastPage,
    changePageSize,
    changeSort,
    search,
    applyFilters,
    refresh,
  };
}

/**
 * Infinite scroll pagination (load more pattern)
 *
 * @example
 * const { items, isLoading, hasMore, loadMore, refresh } = useInfiniteScroll(
 *   (params) => api.getOrders(params),
 *   { pageSize: 20 }
 * )
 */
export function useInfiniteScroll<T>(
  fetchFn: (params: PaginationParams) => Promise<PaginatedResponse<T>>,
  initialParams: PaginationParams = {},
) {
  const state = ref<InfiniteScrollState<T>>({
    items: [],
    isLoading: false,
    hasMore: true,
    currentPage: 0,
    error: null,
  });

  const params = ref<PaginationParams>({
    page: 1,
    pageSize: 20,
    sortOrder: "desc",
    ...initialParams,
  });

  /**
   * Load next page and append to items
   */
  const loadMore = async () => {
    if (state.value.isLoading || !state.value.hasMore) {
      return;
    }

    state.value.isLoading = true;
    state.value.error = null;

    try {
      const nextPage = state.value.currentPage + 1;
      params.value.page = nextPage;

      const paginatedResult: PaginatedResponse<T> = await fetchFn(params.value);
      (state.value.items as T[]).push(...paginatedResult.data);
      state.value.currentPage = nextPage;
      state.value.hasMore = paginatedResult.pagination.hasNextPage;
    } catch (e) {
      state.value.error = e as Error;
      console.error("[InfiniteScroll] Failed to load more:", e);
    } finally {
      state.value.isLoading = false;
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
    await loadMore();
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

  const isEmpty = computed(
    () => state.value.items.length === 0 && !state.value.isLoading,
  );

  return {
    // State
    items: computed(() => state.value.items),
    isLoading: computed(() => state.value.isLoading),
    hasMore: computed(() => state.value.hasMore),
    error: computed(() => state.value.error),

    // Computed
    isEmpty,

    // Methods
    loadMore,
    refresh,
    search,
    applyFilters,
  };
}

/**
 * Cursor-based pagination (for real-time feeds)
 *
 * @example
 * const { data, isLoading, hasMore, loadMore, loadPrevious } = useCursorPagination(
 *   (cursor) => api.getMessages(cursor)
 * )
 */
export function useCursorPagination<T>(
  fetchFn: (
    cursor?: string,
    limit?: number,
  ) => Promise<CursorPaginatedResponse<T>>,
  limit = 20,
) {
  const data = ref<T[]>([]) as Ref<T[]>;
  const isLoading = ref(false);
  const error = ref<Error | null>(null);

  const nextCursor = ref<string | null>(null);
  const previousCursor = ref<string | null>(null);
  const hasMore = ref(true);

  /**
   * Load more items (forward pagination)
   */
  const loadMore = async () => {
    if (isLoading.value || !hasMore.value) {
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetchFn(nextCursor.value ?? undefined, limit);

      data.value.push(...response.data);
      nextCursor.value = response.pagination.nextCursor;
      previousCursor.value = response.pagination.previousCursor;
      hasMore.value = response.pagination.hasMore;
    } catch (e) {
      error.value = e as Error;
      console.error("[CursorPagination] Failed to load more:", e);
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Load previous items (backward pagination)
   */
  const loadPrevious = async () => {
    if (isLoading.value || !previousCursor.value) {
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetchFn(previousCursor.value, limit);

      data.value.unshift(...response.data);
      nextCursor.value = response.pagination.nextCursor;
      previousCursor.value = response.pagination.previousCursor;
    } catch (e) {
      error.value = e as Error;
      console.error("[CursorPagination] Failed to load previous:", e);
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Refresh from beginning
   */
  const refresh = async () => {
    data.value = [];
    nextCursor.value = null;
    previousCursor.value = null;
    hasMore.value = true;
    await loadMore();
  };

  const isEmpty = computed(() => data.value.length === 0 && !isLoading.value);

  return {
    // State
    data,
    isLoading,
    error,
    hasMore,

    // Computed
    isEmpty,

    // Methods
    loadMore,
    loadPrevious,
    refresh,
  };
}

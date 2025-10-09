/**
 * Vue Composable for Pagination
 *
 * Provides reactive pagination state and utilities
 */
import { type Ref } from 'vue';
import type { PaginationParams, PaginatedResponse, CursorPaginatedResponse } from '@makanmakan/shared-types';
/**
 * Standard offset-based pagination
 *
 * @example
 * const { data, pagination, isLoading, loadPage, refresh } = usePagination(
 *   (params) => api.getOrders(params),
 *   { pageSize: 20, sortBy: 'createdAt' }
 * )
 */
export declare function usePagination<T>(fetchFn: (params: PaginationParams) => Promise<PaginatedResponse<T>>, initialParams?: PaginationParams): {
    data: Ref<T[], T[]>;
    pagination: Ref<{
        currentPage: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        startIndex: number;
        endIndex: number;
    }, {
        currentPage: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        startIndex: number;
        endIndex: number;
    } | {
        currentPage: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        startIndex: number;
        endIndex: number;
    }>;
    params: Ref<{
        page?: number | undefined;
        pageSize?: number | undefined;
        sortBy?: string | undefined;
        sortOrder?: "asc" | "desc" | undefined;
        search?: string | undefined;
        filters?: Record<string, any> | undefined;
    }, PaginationParams | {
        page?: number | undefined;
        pageSize?: number | undefined;
        sortBy?: string | undefined;
        sortOrder?: "asc" | "desc" | undefined;
        search?: string | undefined;
        filters?: Record<string, any> | undefined;
    }>;
    isLoading: Ref<boolean, boolean>;
    error: Ref<Error | null, Error | null>;
    isEmpty: import("vue").ComputedRef<boolean>;
    isFirstPage: import("vue").ComputedRef<boolean>;
    isLastPage: import("vue").ComputedRef<boolean>;
    loadPage: (page: number) => Promise<void>;
    nextPage: () => Promise<void>;
    previousPage: () => Promise<void>;
    firstPage: () => Promise<void>;
    lastPage: () => Promise<void>;
    changePageSize: (newPageSize: number) => Promise<void>;
    changeSort: (sortBy: string, sortOrder?: "asc" | "desc") => Promise<void>;
    search: (query: string) => Promise<void>;
    applyFilters: (filters: Record<string, any>) => Promise<void>;
    refresh: () => Promise<void>;
};
/**
 * Infinite scroll pagination (load more pattern)
 *
 * @example
 * const { items, isLoading, hasMore, loadMore, refresh } = useInfiniteScroll(
 *   (params) => api.getOrders(params),
 *   { pageSize: 20 }
 * )
 */
export declare function useInfiniteScroll<T>(fetchFn: (params: PaginationParams) => Promise<PaginatedResponse<T>>, initialParams?: PaginationParams): {
    items: import("vue").ComputedRef<import("@vue/reactivity").UnwrapRefSimple<T>[]>;
    isLoading: import("vue").ComputedRef<boolean>;
    hasMore: import("vue").ComputedRef<boolean>;
    error: import("vue").ComputedRef<Error | null>;
    isEmpty: import("vue").ComputedRef<boolean>;
    loadMore: () => Promise<void>;
    refresh: () => Promise<void>;
    search: (query: string) => Promise<void>;
    applyFilters: (filters: Record<string, any>) => Promise<void>;
};
/**
 * Cursor-based pagination (for real-time feeds)
 *
 * @example
 * const { data, isLoading, hasMore, loadMore, loadPrevious } = useCursorPagination(
 *   (cursor) => api.getMessages(cursor)
 * )
 */
export declare function useCursorPagination<T>(fetchFn: (cursor?: string, limit?: number) => Promise<CursorPaginatedResponse<T>>, limit?: number): {
    data: Ref<T[], T[]>;
    isLoading: Ref<boolean, boolean>;
    error: Ref<Error | null, Error | null>;
    hasMore: Ref<boolean, boolean>;
    isEmpty: import("vue").ComputedRef<boolean>;
    loadMore: () => Promise<void>;
    loadPrevious: () => Promise<void>;
    refresh: () => Promise<void>;
};

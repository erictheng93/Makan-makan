import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { ref, nextTick } from "vue";
import type {
  PaginationParams,
  PaginatedResponse,
  PaginationMeta,
} from "@makanmasak/shared-types";

const mockMeta = (hasNextPage: boolean): PaginationMeta => ({
  currentPage: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 1,
  hasNextPage,
  hasPreviousPage: false,
  startIndex: 0,
  endIndex: 0,
});

const touchEvent = (
  clientY: number,
  preventDefault: () => void = vi.fn(),
): TouchEvent =>
  ({
    touches: [{ clientY }],
    preventDefault,
  }) as unknown as TouchEvent;

const scrollEvent = (scrollTop: number): Event =>
  ({
    target: { scrollTop },
  }) as unknown as Event;

// We need to test the composables in isolation. Since they use onMounted/onUnmounted,
// we need to mock Vue lifecycle hooks for unit testing outside components.
vi.mock("vue", async () => {
  const actual = await vi.importActual("vue");
  return {
    ...actual,
    onMounted: vi.fn((cb: () => void) => cb()),
    onUnmounted: vi.fn(),
  };
});

import {
  useInfiniteScroll,
  usePullToRefresh,
  useVirtualScroll,
} from "@/composables/usePagination";

describe("useInfiniteScroll", () => {
  let mockFetchFn: Mock<
    [PaginationParams],
    Promise<PaginatedResponse<unknown>>
  >;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchFn = vi.fn();
  });

  it("should initialize with empty items and hasMore = true", () => {
    mockFetchFn.mockResolvedValue({
      data: [],
      pagination: mockMeta(false),
    });

    const { items, isLoading, hasMore, isEmpty } = useInfiniteScroll(
      mockFetchFn,
      { autoLoad: false },
    );

    expect(items.value).toEqual([]);
    expect(isLoading.value).toBe(false);
    expect(hasMore.value).toBe(true);
    expect(isEmpty.value).toBe(true);
  });

  it("loadMore should fetch and append items", async () => {
    mockFetchFn.mockResolvedValueOnce({
      data: [{ id: 1 }, { id: 2 }],
      pagination: mockMeta(true),
    });

    const { items, loadMore, hasMore } = useInfiniteScroll(mockFetchFn, {
      autoLoad: false,
      networkAware: false,
    });

    await loadMore();

    expect(mockFetchFn).toHaveBeenCalledOnce();
    expect(mockFetchFn).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 10 }),
    );
    expect(items.value).toHaveLength(2);
    expect(hasMore.value).toBe(true);
  });

  it("should stop loading when hasNextPage is false", async () => {
    mockFetchFn.mockResolvedValueOnce({
      data: [{ id: 1 }],
      pagination: mockMeta(false),
    });

    const { loadMore, hasMore, canLoadMore } = useInfiniteScroll(mockFetchFn, {
      autoLoad: false,
      networkAware: false,
    });

    await loadMore();

    expect(hasMore.value).toBe(false);
    expect(canLoadMore.value).toBe(false);
  });

  it("should accumulate items across pages", async () => {
    mockFetchFn
      .mockResolvedValueOnce({
        data: [{ id: 1 }],
        pagination: mockMeta(true),
      })
      .mockResolvedValueOnce({
        data: [{ id: 2 }],
        pagination: mockMeta(false),
      });

    const { items, loadMore } = useInfiniteScroll(mockFetchFn, {
      autoLoad: false,
      networkAware: false,
    });

    await loadMore();
    await loadMore();

    expect(items.value).toHaveLength(2);
    expect(mockFetchFn).toHaveBeenCalledTimes(2);
  });

  it("should handle fetch errors", async () => {
    mockFetchFn.mockRejectedValueOnce(new Error("Network fail"));

    const { loadMore, error } = useInfiniteScroll(mockFetchFn, {
      autoLoad: false,
      networkAware: false,
    });

    await loadMore();

    expect(error.value).toBeInstanceOf(Error);
    expect(error.value?.message).toBe("Network fail");
  });

  it("refresh should reset and reload from page 1", async () => {
    mockFetchFn
      .mockResolvedValueOnce({
        data: [{ id: 1 }],
        pagination: mockMeta(true),
      })
      .mockResolvedValueOnce({
        data: [{ id: 99 }],
        pagination: mockMeta(false),
      });

    const { items, loadMore, refresh } = useInfiniteScroll(mockFetchFn, {
      autoLoad: false,
      networkAware: false,
    });

    await loadMore();
    expect(items.value).toHaveLength(1);

    await refresh();
    expect(items.value).toHaveLength(1);
    expect(items.value[0]).toEqual({ id: 99 });
  });

  it("search should set query and refresh", async () => {
    mockFetchFn.mockResolvedValue({
      data: [],
      pagination: mockMeta(false),
    });

    const { search } = useInfiniteScroll(mockFetchFn, {
      autoLoad: false,
      networkAware: false,
    });

    await search("nasi");

    expect(mockFetchFn).toHaveBeenCalledWith(
      expect.objectContaining({ search: "nasi", page: 1 }),
    );
  });

  it("should respect custom pageSize", async () => {
    mockFetchFn.mockResolvedValue({
      data: [],
      pagination: mockMeta(false),
    });

    const { loadMore } = useInfiniteScroll(mockFetchFn, {
      pageSize: 25,
      autoLoad: false,
      networkAware: false,
    });

    await loadMore();

    expect(mockFetchFn).toHaveBeenCalledWith(
      expect.objectContaining({ pageSize: 25 }),
    );
  });
});

describe("usePullToRefresh", () => {
  it("should initialize with isRefreshing = false", () => {
    const { isRefreshing, isPulling, shouldRefresh } = usePullToRefresh(
      async () => {},
    );

    expect(isRefreshing.value).toBe(false);
    expect(isPulling.value).toBe(false);
    expect(shouldRefresh.value).toBe(false);
  });

  it("pullDistance should track touch movement", () => {
    const { pullDistance, handleTouchStart, handleTouchMove } =
      usePullToRefresh(async () => {});

    // Simulate scrollY = 0 for pull-to-refresh to activate
    Object.defineProperty(window, "scrollY", { value: 0, writable: true });

    handleTouchStart(touchEvent(100));
    handleTouchMove(touchEvent(200));

    expect(pullDistance.value).toBe(100);
  });

  it("shouldRefresh should be true when pull exceeds threshold", () => {
    const { shouldRefresh, handleTouchStart, handleTouchMove } =
      usePullToRefresh(async () => {});

    Object.defineProperty(window, "scrollY", { value: 0, writable: true });

    // startY must be > 0 for handleTouchMove to track movement
    handleTouchStart(touchEvent(10));
    handleTouchMove(touchEvent(100));

    expect(shouldRefresh.value).toBe(true);
  });

  it("handleTouchEnd should call onRefresh when shouldRefresh is true", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { handleTouchStart, handleTouchMove, handleTouchEnd } =
      usePullToRefresh(onRefresh);

    Object.defineProperty(window, "scrollY", { value: 0, writable: true });

    handleTouchStart(touchEvent(10));
    handleTouchMove(touchEvent(100));

    await handleTouchEnd();

    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("handleTouchEnd should reset pull state", async () => {
    const { pullDistance, handleTouchStart, handleTouchMove, handleTouchEnd } =
      usePullToRefresh(async () => {});

    Object.defineProperty(window, "scrollY", { value: 0, writable: true });

    handleTouchStart(touchEvent(0));
    handleTouchMove(touchEvent(50));

    await handleTouchEnd();

    expect(pullDistance.value).toBe(0);
  });
});

describe("useVirtualScroll", () => {
  it("should compute visible items based on scroll position", () => {
    const items = ref([
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
      { id: 5 },
      { id: 6 },
      { id: 7 },
      { id: 8 },
      { id: 9 },
      { id: 10 },
    ]);

    const { visibleItems } = useVirtualScroll(items, {
      itemHeight: 50,
      buffer: 1,
      containerHeight: 200,
    });

    // scrollTop = 0: visible items 0..3 + buffer 1 = indices 0..5
    expect(visibleItems.value.length).toBeGreaterThan(0);
    expect(visibleItems.value.length).toBeLessThanOrEqual(items.value.length);
  });

  it("handleScroll should update visible items", async () => {
    const items = ref(Array.from({ length: 100 }, (_, i) => ({ id: i })));

    const { visibleItems, handleScroll } = useVirtualScroll(items, {
      itemHeight: 50,
      buffer: 2,
      containerHeight: 200,
    });

    const initialCount = visibleItems.value.length;

    // Simulate scrolling down
    handleScroll(scrollEvent(2000));

    await nextTick();

    // After scrolling, the first visible item should have a higher index
    const firstVisibleIndex = visibleItems.value[0]?.index ?? 0;
    expect(firstVisibleIndex).toBeGreaterThan(0);
  });

  it("should compute container and item styles", () => {
    const items = ref([{ id: 1 }]);

    const { containerStyle, itemStyle, wrapperStyle } = useVirtualScroll(
      items,
      {
        itemHeight: 80,
        containerHeight: 500,
      },
    );

    expect(containerStyle.value.height).toBe("500px");
    expect(itemStyle.value.height).toBe("80px");
    expect(wrapperStyle.value.height).toBe("80px"); // 1 item * 80
  });
});

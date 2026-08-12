import { ref, onMounted, onBeforeUnmount, type Ref } from "vue";

interface LazyLoadOptions {
  rootMargin?: string;
  threshold?: number | number[];
  once?: boolean;
  onIntersect?: (entry: IntersectionObserverEntry) => void;
}

/**
 * 懶加載 Hook
 * 使用 Intersection Observer API 實現元素可見時才加載
 */
export function useLazyLoad(options: LazyLoadOptions = {}) {
  const {
    rootMargin = "50px",
    threshold = 0.1,
    once = true,
    onIntersect,
  } = options;

  const targetRef = ref<HTMLElement | null>(null);
  const isVisible = ref(false);
  const hasLoaded = ref(false);

  let observer: IntersectionObserver | null = null;

  const observe = () => {
    if (!targetRef.value || !("IntersectionObserver" in window)) {
      // 不支持 IntersectionObserver，直接加載
      isVisible.value = true;
      hasLoaded.value = true;
      return;
    }

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            isVisible.value = true;

            if (once && !hasLoaded.value) {
              hasLoaded.value = true;
              observer?.unobserve(entry.target);
            }

            onIntersect?.(entry);
          } else {
            if (!once) {
              isVisible.value = false;
            }
          }
        });
      },
      {
        rootMargin,
        threshold,
      },
    );

    observer.observe(targetRef.value);
  };

  const unobserve = () => {
    if (observer && targetRef.value) {
      observer.unobserve(targetRef.value);
    }
  };

  onMounted(() => {
    observe();
  });

  onBeforeUnmount(() => {
    unobserve();
    observer?.disconnect();
  });

  return {
    targetRef,
    isVisible,
    hasLoaded,
  };
}

/**
 * 懶加載圖片 Hook
 */
export function useLazyImage(src: string, options: LazyLoadOptions = {}) {
  const { targetRef, isVisible } = useLazyLoad(options);
  const currentSrc = ref<string>("");
  const isLoading = ref(false);
  const hasError = ref(false);

  const loadImage = () => {
    if (isLoading.value || currentSrc.value === src) return;

    isLoading.value = true;
    hasError.value = false;

    const img = new Image();

    img.onload = () => {
      currentSrc.value = src;
      isLoading.value = false;
    };

    img.onerror = () => {
      hasError.value = true;
      isLoading.value = false;
    };

    img.src = src;
  };

  // 當元素可見時加載圖片
  onMounted(() => {
    const unwatch = watch(isVisible, (visible) => {
      if (visible) {
        loadImage();
        unwatch();
      }
    });
  });

  return {
    targetRef,
    currentSrc,
    isLoading,
    hasError,
    isVisible,
  };
}

/**
 * 無限滾動 Hook
 */
export function useInfiniteScroll(
  loadMore: () => Promise<void>,
  options: {
    distance?: number;
    threshold?: number;
    immediate?: boolean;
  } = {},
) {
  const distance = options.distance || 100;
  const threshold = options.threshold || 0.1;

  const targetRef = ref<HTMLElement | null>(null);
  const isLoading = ref(false);
  const hasMore = ref(true);

  const { isVisible } = useLazyLoad({
    rootMargin: `${distance}px`,
    threshold,
    once: false,
    onIntersect: async () => {
      if (isLoading.value || !hasMore.value) return;

      isLoading.value = true;

      try {
        await loadMore();
      } catch (error) {
        console.error("Failed to load more:", error);
        hasMore.value = false;
      } finally {
        isLoading.value = false;
      }
    },
  });

  return {
    targetRef,
    isLoading,
    hasMore,
    isVisible,
  };
}

/**
 * 組件懶加載 Hook
 * 延遲加載組件直到需要時
 */
export function useComponentLazyLoad(
  loadComponent: () => Promise<unknown>,
  options: LazyLoadOptions = {},
) {
  const { targetRef, isVisible, hasLoaded } = useLazyLoad({
    ...options,
    once: true,
  });

  const component = ref<unknown>(null);
  const isLoading = ref(false);
  const hasError = ref(false);

  const load = async () => {
    if (isLoading.value || component.value) return;

    isLoading.value = true;
    hasError.value = false;

    try {
      const loaded = await loadComponent();
      component.value = loaded.default || loaded;
    } catch (error) {
      console.error("Failed to load component:", error);
      hasError.value = true;
    } finally {
      isLoading.value = false;
    }
  };

  onMounted(() => {
    const unwatch = watch(isVisible, (visible) => {
      if (visible) {
        load();
        unwatch();
      }
    });
  });

  return {
    targetRef,
    component,
    isLoading,
    hasError,
    isVisible,
    hasLoaded,
  };
}

// 工具函數
import { watch } from "vue";

/**
 * 預加載圖片
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * 預加載多張圖片
 */
export function preloadImages(sources: string[]): Promise<void[]> {
  return Promise.all(sources.map(preloadImage));
}

/**
 * 批量懶加載
 */
export function useBatchLazyLoad<T>(
  items: Ref<T[]>,
  batchSize: number = 10,
  delay: number = 100,
) {
  const loadedItems = ref<T[]>([]) as Ref<T[]>;
  const currentBatch = ref(0);
  const isLoading = ref(false);

  const loadNextBatch = () => {
    if (isLoading.value) return;

    const startIndex = currentBatch.value * batchSize;
    const endIndex = Math.min(startIndex + batchSize, items.value.length);

    if (startIndex >= items.value.length) return;

    isLoading.value = true;

    setTimeout(() => {
      const batch = items.value.slice(startIndex, endIndex);
      loadedItems.value = loadedItems.value.concat(batch);
      currentBatch.value++;
      isLoading.value = false;
    }, delay);
  };

  const reset = () => {
    loadedItems.value = [];
    currentBatch.value = 0;
    isLoading.value = false;
  };

  onMounted(() => {
    loadNextBatch();
  });

  return {
    loadedItems,
    loadNextBatch,
    isLoading,
    hasMore: computed(() => loadedItems.value.length < items.value.length),
    reset,
  };
}

import { computed } from "vue";

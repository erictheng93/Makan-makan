import { ref, onMounted, onBeforeUnmount, type Ref } from "vue";

interface ProgressiveRenderOptions {
  batchSize?: number;
  delay?: number;
  onBatchRendered?: (currentIndex: number, totalItems: number) => void;
}

/**
 * 漸進式渲染 Hook
 * 用於大列表的性能優化，分批渲染項目
 */
export function useProgressiveRender<T>(
  items: T[],
  options: ProgressiveRenderOptions = {},
) {
  const {
    batchSize = 20,
    delay = 16, // ~60fps
    onBatchRendered,
  } = options;

  const renderedItems = ref<T[]>([]) as Ref<T[]>;
  const isRendering = ref(false);
  const progress = ref(0);
  const currentIndex = ref(0);

  let rafId: number | null = null;
  let timeoutId: NodeJS.Timeout | null = null;

  /**
   * 開始漸進式渲染
   */
  const startRendering = () => {
    if (isRendering.value) return;

    isRendering.value = true;
    currentIndex.value = 0;
    renderedItems.value = [];

    renderNextBatch();
  };

  /**
   * 渲染下一批項目
   */
  const renderNextBatch = () => {
    if (currentIndex.value >= items.length) {
      // 所有項目已渲染完成
      isRendering.value = false;
      progress.value = 100;
      return;
    }

    // 計算本批次要渲染的項目
    const endIndex = Math.min(currentIndex.value + batchSize, items.length);
    const batch = items.slice(currentIndex.value, endIndex);

    // 添加到已渲染列表
    renderedItems.value = renderedItems.value.concat(batch);

    // 更新進度
    currentIndex.value = endIndex;
    progress.value = Math.round((currentIndex.value / items.length) * 100);

    // 回調
    onBatchRendered?.(currentIndex.value, items.length);

    // 調度下一批渲染
    if (currentIndex.value < items.length) {
      if (delay > 0) {
        timeoutId = setTimeout(() => {
          rafId = requestAnimationFrame(renderNextBatch);
        }, delay);
      } else {
        rafId = requestAnimationFrame(renderNextBatch);
      }
    } else {
      isRendering.value = false;
    }
  };

  /**
   * 停止渲染
   */
  const stopRendering = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    isRendering.value = false;
  };

  /**
   * 重置並重新開始渲染
   */
  const reset = () => {
    stopRendering();
    renderedItems.value = [];
    currentIndex.value = 0;
    progress.value = 0;
    startRendering();
  };

  // 自動開始渲染
  onMounted(() => {
    if (items.length > 0) {
      startRendering();
    }
  });

  // 清理
  onBeforeUnmount(() => {
    stopRendering();
  });

  return {
    renderedItems,
    isRendering,
    progress,
    startRendering,
    stopRendering,
    reset,
  };
}

/**
 * 簡化版本：立即渲染指定數量，剩餘延遲渲染
 */
export function useChunkedRender<T>(items: T[], initialCount: number = 20) {
  const displayedItems = ref<T[]>([]) as Ref<T[]>;
  const isComplete = ref(false);

  onMounted(() => {
    // 立即渲染初始項目
    displayedItems.value = items.slice(0, initialCount);

    // 延遲渲染剩餘項目
    if (items.length > initialCount) {
      requestIdleCallback(() => {
        displayedItems.value = items;
        isComplete.value = true;
      });
    } else {
      isComplete.value = true;
    }
  });

  return {
    displayedItems,
    isComplete,
  };
}

/**
 * requestIdleCallback polyfill
 */
const requestIdleCallback: typeof window.requestIdleCallback =
  typeof window.requestIdleCallback === "function"
    ? window.requestIdleCallback.bind(window)
    : function (cb: IdleRequestCallback) {
        const start = Date.now();
        return window.setTimeout(() => {
          cb({
            didTimeout: false,
            timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
          });
        }, 1);
      };

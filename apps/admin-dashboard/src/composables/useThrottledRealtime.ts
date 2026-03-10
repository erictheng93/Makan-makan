/**
 * 實時數據流節流優化 Composable
 * Throttled Realtime Data Stream Optimization
 *
 * 功能：
 * 1. 節流實時更新到固定幀率（默認 30fps）
 * 2. 批量處理多個更新，減少渲染次數
 * 3. 支援防抖模式用於某些場景
 * 4. 智能更新合併，避免重複渲染
 *
 * 性能目標：
 * - 將渲染頻率穩定在 30fps (33.3ms/frame)
 * - 降低 CPU 使用率 30%
 * - 支援高頻更新場景（Kitchen Display、Order Status）
 */

import { ref, onUnmounted, type Ref } from "vue";

// ============================================================================
// 類型定義
// ============================================================================

/**
 * 節流策略
 */
export type ThrottleStrategy = "throttle" | "debounce" | "batch";

/**
 * 更新優先級
 */
export type UpdatePriority = "high" | "normal" | "low";

/**
 * 節流配置
 */
export interface ThrottleConfig {
  /**
   * 節流策略
   * - throttle: 固定時間間隔更新（默認）
   * - debounce: 延遲更新，等待輸入停止
   * - batch: 批量更新，累積後一次性處理
   */
  strategy?: ThrottleStrategy;

  /**
   * 節流間隔（毫秒）
   * - throttle: 兩次更新之間的最小間隔（默認 33ms = 30fps）
   * - debounce: 延遲時間（默認 150ms）
   * - batch: 批次間隔（默認 100ms）
   */
  interval?: number;

  /**
   * 最大等待時間（毫秒）
   * 即使在節流狀態，超過此時間也會強制更新
   * 默認 1000ms
   */
  maxWait?: number;

  /**
   * 批次大小（僅 batch 策略）
   * 達到此數量時立即處理，不等待間隔
   * 默認 10
   */
  batchSize?: number;

  /**
   * 是否在首次調用時立即執行
   * 默認 true
   */
  leading?: boolean;

  /**
   * 是否在結束後執行最後一次
   * 默認 true
   */
  trailing?: boolean;
}

/**
 * 更新項目
 */
interface UpdateItem<T> {
  data: T;
  timestamp: number;
  priority: UpdatePriority;
  key?: string; // 用於去重的唯一鍵
}

/**
 * 節流狀態
 */
interface ThrottleState<T> {
  isThrottled: boolean;
  lastUpdateTime: number;
  pendingUpdate: UpdateItem<T> | null;
  batchedUpdates: UpdateItem<T>[];
  timerId: number | null;
  maxWaitTimerId: number | null;
}

// ============================================================================
// Composable 主體
// ============================================================================

/**
 * 使用節流實時更新
 *
 * @example
 * ```typescript
 * // Kitchen Display - 高頻訂單狀態更新
 * const { throttledUpdate, flush, pending } = useThrottledRealtime<Order>(
 *   (updates) => {
 *     orders.value = mergeOrders(orders.value, updates)
 *   },
 *   {
 *     strategy: 'throttle',
 *     interval: 33, // 30fps
 *     maxWait: 500,
 *   }
 * )
 *
 * // 接收到訂單更新
 * onOrderUpdate((order) => {
 *   throttledUpdate(order, 'high', order.id)
 * })
 * ```
 */
export function useThrottledRealtime<T>(
  updateFn: (updates: T[]) => void,
  config: ThrottleConfig = {},
) {
  // ========================================
  // 配置初始化
  // ========================================

  const {
    strategy = "throttle",
    interval = strategy === "throttle"
      ? 33
      : strategy === "debounce"
        ? 150
        : 100,
    maxWait = 1000,
    batchSize = 10,
    leading = true,
    trailing = true,
  } = config;

  // ========================================
  // 狀態管理
  // ========================================

  const state = ref<ThrottleState<T>>({
    isThrottled: false,
    lastUpdateTime: 0,
    pendingUpdate: null,
    batchedUpdates: [],
    timerId: null,
    maxWaitTimerId: null,
  }) as Ref<ThrottleState<T>>;

  // 待處理更新數量
  const pendingCount = ref(0);

  // 統計數據
  const stats = ref({
    totalUpdates: 0,
    processedBatches: 0,
    droppedUpdates: 0,
    averageBatchSize: 0,
    lastProcessTime: 0,
  });

  // ========================================
  // 核心處理函數
  // ========================================

  /**
   * 執行更新
   */
  const executeUpdate = (updates: UpdateItem<T>[]) => {
    if (updates.length === 0) return;

    const startTime = performance.now();

    // 按優先級排序
    const sortedUpdates = updates.sort((a, b) => {
      const priorityWeight = { high: 3, normal: 2, low: 1 };
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    });

    // 去重：如果有 key，保留最新的更新
    const uniqueUpdates = new Map<string, T>();
    const noKeyUpdates: T[] = [];

    sortedUpdates.forEach((item) => {
      if (item.key) {
        uniqueUpdates.set(item.key, item.data);
      } else {
        noKeyUpdates.push(item.data);
      }
    });

    const finalUpdates = [
      ...Array.from(uniqueUpdates.values()),
      ...noKeyUpdates,
    ];

    // 執行更新回調
    updateFn(finalUpdates);

    // 更新統計
    const processTime = performance.now() - startTime;
    stats.value.processedBatches++;
    stats.value.lastProcessTime = processTime;
    stats.value.averageBatchSize =
      (stats.value.averageBatchSize * (stats.value.processedBatches - 1) +
        updates.length) /
      stats.value.processedBatches;

    // 重置狀態
    state.value.lastUpdateTime = Date.now();
    state.value.isThrottled = true;
  };

  /**
   * 清除所有計時器
   */
  const clearTimers = () => {
    if (state.value.timerId !== null) {
      clearTimeout(state.value.timerId);
      state.value.timerId = null;
    }
    if (state.value.maxWaitTimerId !== null) {
      clearTimeout(state.value.maxWaitTimerId);
      state.value.maxWaitTimerId = null;
    }
  };

  /**
   * 節流策略：固定時間間隔更新
   */
  const throttleUpdate = (item: UpdateItem<T>) => {
    const now = Date.now();
    const timeSinceLastUpdate = now - state.value.lastUpdateTime;

    // Leading edge：立即執行第一次（只有當之前沒有執行過時）
    if (
      leading &&
      !state.value.isThrottled &&
      state.value.lastUpdateTime === 0
    ) {
      executeUpdate([item]);
      state.value.isThrottled = true;
      return;
    }

    // 保存待處理更新
    state.value.pendingUpdate = item;
    pendingCount.value = 1;

    // 設置最大等待計時器
    if (!state.value.maxWaitTimerId && maxWait > 0) {
      state.value.maxWaitTimerId = window.setTimeout(() => {
        if (state.value.pendingUpdate) {
          executeUpdate([state.value.pendingUpdate]);
          state.value.pendingUpdate = null;
          pendingCount.value = 0;
        }
        state.value.maxWaitTimerId = null;
      }, maxWait);
    }

    // 如果超過間隔時間，立即執行
    if (timeSinceLastUpdate >= interval) {
      clearTimers();
      executeUpdate([item]);
      state.value.pendingUpdate = null;
      pendingCount.value = 0;
      state.value.isThrottled = true;
    } else if (!state.value.timerId) {
      // 設置延遲執行
      const delay = interval - timeSinceLastUpdate;
      state.value.timerId = window.setTimeout(() => {
        if (state.value.pendingUpdate) {
          executeUpdate([state.value.pendingUpdate]);
          state.value.pendingUpdate = null;
          pendingCount.value = 0;
        }
        state.value.timerId = null;
        state.value.isThrottled = false;
      }, delay);
    }
  };

  /**
   * 防抖策略：延遲更新，等待輸入停止
   */
  const debounceUpdate = (item: UpdateItem<T>) => {
    // 取消之前的計時器
    clearTimers();

    // 保存待處理更新
    state.value.pendingUpdate = item;
    pendingCount.value = 1;

    // Leading edge：立即執行第一次
    if (leading && state.value.lastUpdateTime === 0) {
      executeUpdate([item]);
      state.value.pendingUpdate = null;
      pendingCount.value = 0;
    }

    // 設置新的計時器
    state.value.timerId = window.setTimeout(() => {
      if (trailing && state.value.pendingUpdate) {
        executeUpdate([state.value.pendingUpdate]);
        state.value.pendingUpdate = null;
        pendingCount.value = 0;
      }
      state.value.timerId = null;
    }, interval);

    // 設置最大等待計時器
    if (!state.value.maxWaitTimerId && maxWait > 0) {
      state.value.maxWaitTimerId = window.setTimeout(() => {
        clearTimers();
        if (state.value.pendingUpdate) {
          executeUpdate([state.value.pendingUpdate]);
          state.value.pendingUpdate = null;
          pendingCount.value = 0;
        }
      }, maxWait);
    }
  };

  /**
   * 批量策略：累積後一次性處理
   */
  const batchUpdate = (item: UpdateItem<T>) => {
    // 添加到批次
    state.value.batchedUpdates.push(item);
    pendingCount.value = state.value.batchedUpdates.length;

    // 達到批次大小，立即處理
    if (state.value.batchedUpdates.length >= batchSize) {
      clearTimers();
      executeUpdate([...state.value.batchedUpdates]);
      state.value.batchedUpdates = [];
      pendingCount.value = 0;
      return;
    }

    // 設置批次計時器
    if (!state.value.timerId) {
      state.value.timerId = window.setTimeout(() => {
        if (state.value.batchedUpdates.length > 0) {
          executeUpdate([...state.value.batchedUpdates]);
          state.value.batchedUpdates = [];
          pendingCount.value = 0;
        }
        state.value.timerId = null;
      }, interval);
    }

    // 設置最大等待計時器
    if (!state.value.maxWaitTimerId && maxWait > 0) {
      state.value.maxWaitTimerId = window.setTimeout(() => {
        clearTimers();
        if (state.value.batchedUpdates.length > 0) {
          executeUpdate([...state.value.batchedUpdates]);
          state.value.batchedUpdates = [];
          pendingCount.value = 0;
        }
      }, maxWait);
    }
  };

  // ========================================
  // 公開 API
  // ========================================

  /**
   * 提交一個節流更新
   *
   * @param data - 更新數據
   * @param priority - 優先級（high/normal/low）
   * @param key - 去重鍵（可選）
   */
  const throttledUpdate = (
    data: T,
    priority: UpdatePriority = "normal",
    key?: string,
  ) => {
    const item: UpdateItem<T> = {
      data,
      timestamp: Date.now(),
      priority,
      key,
    };

    stats.value.totalUpdates++;

    // 根據策略處理
    switch (strategy) {
      case "throttle":
        throttleUpdate(item);
        break;
      case "debounce":
        debounceUpdate(item);
        break;
      case "batch":
        batchUpdate(item);
        break;
    }
  };

  /**
   * 立即處理所有待處理的更新
   */
  const flush = () => {
    clearTimers();

    if (strategy === "batch" && state.value.batchedUpdates.length > 0) {
      executeUpdate([...state.value.batchedUpdates]);
      state.value.batchedUpdates = [];
      pendingCount.value = 0;
    } else if (state.value.pendingUpdate) {
      executeUpdate([state.value.pendingUpdate]);
      state.value.pendingUpdate = null;
      pendingCount.value = 0;
    }
  };

  /**
   * 取消所有待處理的更新
   */
  const cancel = () => {
    clearTimers();
    state.value.pendingUpdate = null;
    state.value.batchedUpdates = [];
    pendingCount.value = 0;
    stats.value.droppedUpdates += pendingCount.value;
  };

  /**
   * 重置統計數據
   */
  const resetStats = () => {
    stats.value = {
      totalUpdates: 0,
      processedBatches: 0,
      droppedUpdates: 0,
      averageBatchSize: 0,
      lastProcessTime: 0,
    };
  };

  // ========================================
  // 生命週期（可選）
  // ========================================

  // 只在 Vue 組件上下文中註冊生命週期鉤子
  try {
    onUnmounted(() => {
      // 清理所有計時器
      clearTimers();

      // 如果需要，處理最後的更新
      if (trailing) {
        flush();
      }
    });
  } catch {
    // 在測試環境或非組件上下文中忽略
    // 用戶需要手動調用 flush() 或 cancel()
  }

  // ========================================
  // 返回 API
  // ========================================

  return {
    // 主要 API
    throttledUpdate,
    flush,
    cancel,

    // 狀態
    pending: pendingCount,
    isThrottled: state,
    stats,

    // 工具
    resetStats,
  };
}

// ============================================================================
// 預設配置導出
// ============================================================================

/**
 * Kitchen Display 專用配置
 * 高頻訂單狀態更新，30fps 節流
 */
export const KITCHEN_THROTTLE_CONFIG: ThrottleConfig = {
  strategy: "throttle",
  interval: 33, // 30fps
  maxWait: 500,
  leading: true,
  trailing: true,
};

/**
 * Order List 專用配置
 * 中頻訂單列表更新，批量處理
 */
export const ORDER_LIST_THROTTLE_CONFIG: ThrottleConfig = {
  strategy: "batch",
  interval: 100,
  batchSize: 10,
  maxWait: 1000,
  leading: false,
  trailing: true,
};

/**
 * Search Input 專用配置
 * 搜索輸入防抖
 */
export const SEARCH_DEBOUNCE_CONFIG: ThrottleConfig = {
  strategy: "debounce",
  interval: 300,
  maxWait: 1500,
  leading: false,
  trailing: true,
};

/**
 * Real-time Stats 專用配置
 * 統計數據更新，低頻批量
 */
export const STATS_THROTTLE_CONFIG: ThrottleConfig = {
  strategy: "batch",
  interval: 500,
  batchSize: 5,
  maxWait: 2000,
  leading: true,
  trailing: true,
};

/**
 * Throttled Realtime Tests
 * 測試節流實時更新功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref, nextTick } from "vue";
import {
  useThrottledRealtime,
  KITCHEN_THROTTLE_CONFIG,
} from "@/composables/useThrottledRealtime";

describe("useThrottledRealtime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Throttle Strategy", () => {
    it("should throttle updates to specified interval", async () => {
      const updateFn = vi.fn();
      const { throttledUpdate } = useThrottledRealtime<number>(updateFn, {
        strategy: "throttle",
        interval: 100,
        leading: true, // 默認為 true，首次調用會立即執行
      });

      // 發送多個快速更新
      throttledUpdate(1, "normal"); // 首次更新會立即執行 (leading edge)
      throttledUpdate(2, "normal"); // 這些會被節流
      throttledUpdate(3, "normal");

      // 首次更新已執行（leading edge）
      expect(updateFn).toHaveBeenCalledTimes(1);
      expect(updateFn).toHaveBeenCalledWith([1]);

      // 等待間隔時間
      vi.advanceTimersByTime(100);

      // 現在應該執行最後的待處理更新
      expect(updateFn).toHaveBeenCalledTimes(2);
      expect(updateFn).toHaveBeenLastCalledWith([3]);
    });

    it("should respect leading edge option", () => {
      const updateFn = vi.fn();
      const { throttledUpdate } = useThrottledRealtime<number>(updateFn, {
        strategy: "throttle",
        interval: 100,
        leading: true,
        trailing: false,
      });

      // 第一次更新應該立即執行
      throttledUpdate(1, "normal");
      expect(updateFn).toHaveBeenCalledTimes(1);
      expect(updateFn).toHaveBeenCalledWith([1]);

      // 後續更新在間隔內應該被節流
      throttledUpdate(2, "normal");
      expect(updateFn).toHaveBeenCalledTimes(1); // 還是 1 次
    });

    it("should enforce maxWait timeout", () => {
      const updateFn = vi.fn();
      const { throttledUpdate } = useThrottledRealtime<number>(updateFn, {
        strategy: "throttle",
        interval: 100,
        maxWait: 500,
        leading: false,
      });

      // 持續發送更新
      for (let i = 0; i < 10; i++) {
        throttledUpdate(i, "normal");
        vi.advanceTimersByTime(50); // 每 50ms 一次，小於 interval
      }

      // 500ms 後應該強制執行
      expect(updateFn).toHaveBeenCalled();
    });
  });

  describe("Batch Strategy", () => {
    it("should batch updates and process them together", () => {
      const updateFn = vi.fn();
      const { throttledUpdate } = useThrottledRealtime<number>(updateFn, {
        strategy: "batch",
        interval: 100,
        batchSize: 5,
      });

      // 發送 3 個更新（小於 batchSize）
      throttledUpdate(1, "normal");
      throttledUpdate(2, "normal");
      throttledUpdate(3, "normal");

      // 還沒達到 batchSize，也沒到間隔時間
      expect(updateFn).not.toHaveBeenCalled();

      // 等待間隔時間
      vi.advanceTimersByTime(100);

      // 應該批量處理這 3 個更新
      expect(updateFn).toHaveBeenCalledTimes(1);
      expect(updateFn).toHaveBeenCalledWith([1, 2, 3]);
    });

    it("should process immediately when batch size is reached", () => {
      const updateFn = vi.fn();
      const { throttledUpdate } = useThrottledRealtime<number>(updateFn, {
        strategy: "batch",
        interval: 1000, // 長間隔
        batchSize: 3,
      });

      // 發送 3 個更新達到 batchSize
      throttledUpdate(1, "normal");
      throttledUpdate(2, "normal");
      throttledUpdate(3, "normal");

      // 應該立即處理，不等待間隔
      expect(updateFn).toHaveBeenCalledTimes(1);
      expect(updateFn).toHaveBeenCalledWith([1, 2, 3]);
    });
  });

  describe("Debounce Strategy", () => {
    it("should debounce updates", () => {
      const updateFn = vi.fn();
      const { throttledUpdate } = useThrottledRealtime<number>(updateFn, {
        strategy: "debounce",
        interval: 200,
        leading: false,
        trailing: true,
      });

      // 快速發送多個更新
      throttledUpdate(1, "normal");
      vi.advanceTimersByTime(100);

      throttledUpdate(2, "normal");
      vi.advanceTimersByTime(100);

      throttledUpdate(3, "normal");

      // 還沒有執行
      expect(updateFn).not.toHaveBeenCalled();

      // 等待完整的延遲時間
      vi.advanceTimersByTime(200);

      // 應該只執行最後的更新
      expect(updateFn).toHaveBeenCalledTimes(1);
      expect(updateFn).toHaveBeenCalledWith([3]);
    });
  });

  describe("Priority Handling", () => {
    it("should process updates by priority order", () => {
      const updates: number[] = [];
      const updateFn = vi.fn((items: number[]) => {
        updates.push(...items);
      });

      const { throttledUpdate, flush } = useThrottledRealtime<number>(
        updateFn,
        {
          strategy: "batch",
          interval: 100,
        },
      );

      // 發送不同優先級的更新
      throttledUpdate(1, "low");
      throttledUpdate(2, "high");
      throttledUpdate(3, "normal");
      throttledUpdate(4, "high");

      // 立即處理
      flush();

      // 應該按優先級排序：high (2, 4) > normal (3) > low (1)
      expect(updates).toEqual([2, 4, 3, 1]);
    });
  });

  describe("Deduplication", () => {
    it("should deduplicate updates with same key", () => {
      const updateFn = vi.fn();
      const { throttledUpdate, flush } = useThrottledRealtime<{
        id: number;
        value: string;
      }>(updateFn, {
        strategy: "batch",
        interval: 100,
      });

      // 發送具有相同 key 的多個更新
      throttledUpdate({ id: 1, value: "first" }, "normal", "item-1");
      throttledUpdate({ id: 2, value: "second" }, "normal", "item-2");
      throttledUpdate({ id: 1, value: "updated" }, "normal", "item-1"); // 更新 item-1

      flush();

      // 應該只保留最新的 item-1 和 item-2
      expect(updateFn).toHaveBeenCalledTimes(1);
      const updates = updateFn.mock.calls[0][0];
      expect(updates).toHaveLength(2);
      expect(updates.find((u: any) => u.id === 1).value).toBe("updated");
    });
  });

  describe("Flush and Cancel", () => {
    it("should flush all pending updates immediately", () => {
      const updateFn = vi.fn();
      const { throttledUpdate, flush } = useThrottledRealtime<number>(
        updateFn,
        {
          strategy: "batch", // 使用 batch 策略來累積更新
          interval: 1000, // 長間隔
        },
      );

      // 發送多個更新（batch 策略會累積它們）
      throttledUpdate(1, "normal");
      throttledUpdate(2, "normal");
      throttledUpdate(3, "normal");

      // 在間隔時間之前，不應該執行
      expect(updateFn).not.toHaveBeenCalled();

      // 立即刷新
      flush();

      // 應該立即批量處理所有更新
      expect(updateFn).toHaveBeenCalledTimes(1);
      // batch 策略保留所有更新（按優先級排序）
      expect(updateFn).toHaveBeenCalledWith([1, 2, 3]);
    });

    it("should cancel all pending updates", () => {
      const updateFn = vi.fn();
      const { throttledUpdate, cancel, pending } = useThrottledRealtime<number>(
        updateFn,
        {
          strategy: "batch",
          interval: 100,
        },
      );

      throttledUpdate(1, "normal");
      throttledUpdate(2, "normal");
      throttledUpdate(3, "normal");

      // 取消所有更新
      cancel();

      // 不應該有待處理的更新
      expect(pending.value).toBe(0);

      // 即使等待時間過去也不應該執行
      vi.advanceTimersByTime(100);
      expect(updateFn).not.toHaveBeenCalled();
    });
  });

  describe("Stats Tracking", () => {
    it("should track update statistics", () => {
      const updateFn = vi.fn();
      const { throttledUpdate, stats, flush } = useThrottledRealtime<number>(
        updateFn,
        {
          strategy: "batch",
          interval: 100,
        },
      );

      // 發送更新
      throttledUpdate(1, "normal");
      throttledUpdate(2, "normal");
      throttledUpdate(3, "normal");

      expect(stats.value.totalUpdates).toBe(3);

      flush();

      expect(stats.value.processedBatches).toBe(1);
      expect(stats.value.averageBatchSize).toBe(3);
    });
  });

  describe("Performance - Kitchen Display Scenario", () => {
    it("should handle high-frequency order updates efficiently", () => {
      const updateFn = vi.fn();
      const { throttledUpdate } = useThrottledRealtime<{
        orderId: number;
        status: string;
      }>(
        updateFn,
        KITCHEN_THROTTLE_CONFIG, // 30fps = 33ms
      );

      // 模擬高頻更新（每 10ms 一次訂單狀態變化）
      for (let i = 0; i < 20; i++) {
        throttledUpdate(
          { orderId: i, status: "cooking" },
          "normal",
          `order-${i}`,
        );
        vi.advanceTimersByTime(10);
      }

      // 總時間 200ms，應該執行約 6 次（200ms / 33ms ≈ 6）
      const callCount = updateFn.mock.calls.length;
      expect(callCount).toBeGreaterThanOrEqual(5);
      expect(callCount).toBeLessThanOrEqual(8);

      // 注意：使用 throttle 策略時，同一間隔內的更新會被最後一個覆蓋
      // 所以處理的總更新數會少於發送的數量（這是預期行為，用於減少渲染）
      // 實際處理的數量 ≈ 調用次數（每次調用處理當時的 pending 更新）
      const totalUpdatesProcessed = updateFn.mock.calls.reduce(
        (sum, call) => sum + call[0].length,
        0,
      );
      expect(totalUpdatesProcessed).toBeGreaterThanOrEqual(callCount);
      expect(totalUpdatesProcessed).toBeLessThanOrEqual(20);
    });

    it("should maintain 30fps throttle rate", () => {
      const updateFn = vi.fn();
      const { throttledUpdate } = useThrottledRealtime<number>(updateFn, {
        strategy: "throttle",
        interval: 33, // 30fps
        leading: true,
      });

      // 模擬 1 秒內的持續更新
      for (let i = 0; i < 100; i++) {
        throttledUpdate(i, "normal");
        vi.advanceTimersByTime(10); // 每 10ms 更新一次
      }

      // 1000ms / 33ms ≈ 30 次更新（30fps）
      const callCount = updateFn.mock.calls.length;
      expect(callCount).toBeGreaterThanOrEqual(28);
      expect(callCount).toBeLessThanOrEqual(32);
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero interval", () => {
      const updateFn = vi.fn();
      const { throttledUpdate } = useThrottledRealtime<number>(updateFn, {
        strategy: "throttle",
        interval: 0,
      });

      throttledUpdate(1, "normal");

      // 應該立即執行
      expect(updateFn).toHaveBeenCalledTimes(1);
    });

    it("should handle updates with no data", () => {
      const updateFn = vi.fn();
      const { flush } = useThrottledRealtime<number>(updateFn, {
        strategy: "batch",
        interval: 100,
      });

      // 沒有更新就 flush
      flush();

      // 不應該調用更新函數
      expect(updateFn).not.toHaveBeenCalled();
    });
  });
});

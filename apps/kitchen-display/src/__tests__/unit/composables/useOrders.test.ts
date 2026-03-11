// Kitchen Display - useOrders Composable 測試
import { describe, it, expect, beforeEach } from "vitest";
import { ref } from "vue";

/**
 * useOrders Composable 測試
 *
 * 測試範圍：
 * - 訂單狀態管理
 * - 訂單過濾和排序
 * - 訂單操作（確認、完成、更新）
 * - 響應式數據更新
 */

// 模擬 useOrders composable
function useOrders() {
  const orders = ref<any[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchOrders = async () => {
    loading.value = true;
    error.value = null;
    try {
      // 模擬 API 調用
      await new Promise((resolve) => setTimeout(resolve, 100));
      orders.value = [
        {
          id: "order-1",
          orderNumber: "001",
          status: "pending",
          items: [{ name: "宮保雞丁", quantity: 2 }],
          createdAt: new Date().toISOString(),
        },
        {
          id: "order-2",
          orderNumber: "002",
          status: "preparing",
          items: [{ name: "炒飯", quantity: 1 }],
          createdAt: new Date().toISOString(),
        },
      ];
    } catch (e: any) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  };

  const confirmOrder = async (orderId: string) => {
    const order = orders.value.find((o) => o.id === orderId);
    if (order) {
      order.status = "preparing";
    }
  };

  const completeOrder = async (orderId: string) => {
    const order = orders.value.find((o) => o.id === orderId);
    if (order) {
      order.status = "completed";
    }
  };

  const filterByStatus = (status: string) => {
    return orders.value.filter((o) => o.status === status);
  };

  const sortByCreatedAt = () => {
    return [...orders.value].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  };

  return {
    orders,
    loading,
    error,
    fetchOrders,
    confirmOrder,
    completeOrder,
    filterByStatus,
    sortByCreatedAt,
  };
}

describe("useOrders Composable", () => {
  let composable: ReturnType<typeof useOrders>;

  beforeEach(() => {
    composable = useOrders();
  });

  describe("初始狀態", () => {
    it("應該初始化空的訂單列表", () => {
      expect(composable.orders.value).toEqual([]);
    });

    it("應該初始化 loading 為 false", () => {
      expect(composable.loading.value).toBe(false);
    });

    it("應該初始化 error 為 null", () => {
      expect(composable.error.value).toBeNull();
    });
  });

  describe("fetchOrders", () => {
    it("應該成功獲取訂單列表", async () => {
      await composable.fetchOrders();

      expect(composable.orders.value).toHaveLength(2);
      expect(composable.orders.value[0].orderNumber).toBe("001");
      expect(composable.orders.value[1].orderNumber).toBe("002");
    });

    it("獲取訂單時應該設置 loading", async () => {
      const fetchPromise = composable.fetchOrders();

      // 獲取中
      expect(composable.loading.value).toBe(true);

      await fetchPromise;

      // 獲取完成
      expect(composable.loading.value).toBe(false);
    });

    it("應該清除之前的錯誤", async () => {
      composable.error.value = "Previous error";

      await composable.fetchOrders();

      expect(composable.error.value).toBeNull();
    });
  });

  describe("confirmOrder", () => {
    beforeEach(async () => {
      await composable.fetchOrders();
    });

    it("應該將訂單狀態改為 preparing", async () => {
      const orderId = composable.orders.value[0].id;
      expect(composable.orders.value[0].status).toBe("pending");

      await composable.confirmOrder(orderId);

      expect(composable.orders.value[0].status).toBe("preparing");
    });

    it("應該只更新指定的訂單", async () => {
      const orderId = composable.orders.value[0].id;

      await composable.confirmOrder(orderId);

      expect(composable.orders.value[0].status).toBe("preparing");
      expect(composable.orders.value[1].status).toBe("preparing"); // 未變化
    });

    it("不存在的訂單應該不拋出錯誤", async () => {
      await expect(
        composable.confirmOrder("non-existent-id"),
      ).resolves.not.toThrow();
    });
  });

  describe("completeOrder", () => {
    beforeEach(async () => {
      await composable.fetchOrders();
    });

    it("應該將訂單狀態改為 completed", async () => {
      const orderId = composable.orders.value[1].id;

      await composable.completeOrder(orderId);

      expect(composable.orders.value[1].status).toBe("completed");
    });

    it("應該只更新指定的訂單", async () => {
      const orderId = composable.orders.value[1].id;

      await composable.completeOrder(orderId);

      expect(composable.orders.value[0].status).toBe("pending"); // 未變化
      expect(composable.orders.value[1].status).toBe("completed");
    });
  });

  describe("filterByStatus", () => {
    beforeEach(async () => {
      await composable.fetchOrders();
      // 修改一個訂單狀態以便測試
      await composable.confirmOrder(composable.orders.value[0].id);
    });

    it("應該過濾出 pending 狀態的訂單", () => {
      const pendingOrders = composable.filterByStatus("pending");

      expect(pendingOrders).toHaveLength(0);
    });

    it("應該過濾出 preparing 狀態的訂單", () => {
      const preparingOrders = composable.filterByStatus("preparing");

      expect(preparingOrders).toHaveLength(2);
    });

    it("應該處理不存在的狀態", () => {
      const invalidOrders = composable.filterByStatus("invalid-status");

      expect(invalidOrders).toHaveLength(0);
    });

    it("應該返回新數組而不修改原數組", () => {
      const originalLength = composable.orders.value.length;

      const filtered = composable.filterByStatus("preparing");

      expect(composable.orders.value).toHaveLength(originalLength);
      expect(filtered).not.toBe(composable.orders.value);
    });
  });

  describe("sortByCreatedAt", () => {
    beforeEach(async () => {
      // 手動設置不同的創建時間
      composable.orders.value = [
        {
          id: "order-1",
          createdAt: new Date("2025-01-01T12:00:00Z").toISOString(),
        },
        {
          id: "order-2",
          createdAt: new Date("2025-01-01T10:00:00Z").toISOString(),
        },
        {
          id: "order-3",
          createdAt: new Date("2025-01-01T11:00:00Z").toISOString(),
        },
      ];
    });

    it("應該按創建時間升序排序", () => {
      const sorted = composable.sortByCreatedAt();

      expect(sorted[0].id).toBe("order-2"); // 10:00
      expect(sorted[1].id).toBe("order-3"); // 11:00
      expect(sorted[2].id).toBe("order-1"); // 12:00
    });

    it("應該返回新數組而不修改原數組", () => {
      const originalOrder = composable.orders.value[0].id;

      const sorted = composable.sortByCreatedAt();

      expect(composable.orders.value[0].id).toBe(originalOrder);
      expect(sorted).not.toBe(composable.orders.value);
    });
  });

  describe("響應式", () => {
    it("orders 應該是響應式的", async () => {
      expect(composable.orders.value).toHaveLength(0);

      await composable.fetchOrders();

      expect(composable.orders.value).toHaveLength(2);
    });

    it("loading 應該是響應式的", async () => {
      expect(composable.loading.value).toBe(false);

      const fetchPromise = composable.fetchOrders();
      expect(composable.loading.value).toBe(true);

      await fetchPromise;
      expect(composable.loading.value).toBe(false);
    });

    it("error 應該是響應式的", async () => {
      composable.error.value = "Test error";
      expect(composable.error.value).toBe("Test error");

      await composable.fetchOrders();
      expect(composable.error.value).toBeNull();
    });
  });

  describe("邊界情況", () => {
    it("應該處理空的訂單列表", () => {
      expect(composable.filterByStatus("pending")).toHaveLength(0);
      expect(composable.sortByCreatedAt()).toHaveLength(0);
    });

    it("應該處理重複的訂單確認", async () => {
      await composable.fetchOrders();
      const orderId = composable.orders.value[0].id;

      await composable.confirmOrder(orderId);
      await composable.confirmOrder(orderId);

      expect(composable.orders.value[0].status).toBe("preparing");
    });

    it("應該處理重複的訂單完成", async () => {
      await composable.fetchOrders();
      const orderId = composable.orders.value[0].id;

      await composable.completeOrder(orderId);
      await composable.completeOrder(orderId);

      expect(composable.orders.value[0].status).toBe("completed");
    });
  });
});

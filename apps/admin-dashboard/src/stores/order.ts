import { defineStore } from "pinia";
import { ref, computed, readonly } from "vue";
import type { Order, OrderStatus } from "@/types";
import { api, unwrapApiList } from "@/services/api";
import { t } from "@/i18n";
import { getApiEnvelopeMessage } from "@makanmasak/shared/utils/unknown";

export const useOrderStore = defineStore("order", () => {
  const orders = ref<Order[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Computed properties
  const pendingOrders = computed(() =>
    orders.value.filter((order) => order.status === "pending"),
  );

  const confirmedOrders = computed(() =>
    orders.value.filter((order) => order.status === "confirmed"),
  );

  const preparingOrders = computed(() =>
    orders.value.filter((order) => order.status === "preparing"),
  );

  const readyOrders = computed(() =>
    orders.value.filter((order) => order.status === "ready"),
  );

  const completedOrders = computed(() =>
    orders.value.filter((order) =>
      (["delivered", "paid"] as OrderStatus[]).includes(order.status),
    ),
  );

  const pendingOrdersCount = computed(() => pendingOrders.value.length);
  const activeOrdersCount = computed(
    () =>
      orders.value.filter((order) =>
        (
          ["pending", "confirmed", "preparing", "ready"] as OrderStatus[]
        ).includes(order.status),
      ).length,
  );

  // Actions
  const fetchOrders = async (params?: {
    status?: OrderStatus[];
    page?: number;
    limit?: number;
    date?: string;
  }) => {
    isLoading.value = true;
    error.value = null;

    try {
      const queryParams = new URLSearchParams();

      if (params?.status) {
        queryParams.append("status", params.status.join(","));
      }
      if (params?.page) {
        queryParams.append("page", params.page.toString());
      }
      if (params?.limit) {
        queryParams.append("limit", params.limit.toString());
      }
      if (params?.date) {
        queryParams.append("date", params.date);
      }

      const response = await api.get<Order[]>(
        `/orders?${queryParams.toString()}`,
      );

      if (response.data.success && response.data.data) {
        // Defensive: handle double-wrapped cache responses where
        // response.data.data may be {success, data: Order[], ...} instead of Order[]
        const payload = response.data.data;
        orders.value = unwrapApiList<Order>(payload);
      }
    } catch (err: unknown) {
      error.value = getApiEnvelopeMessage(err) || t("orderStore.fetchFailed");
    } finally {
      isLoading.value = false;
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      const response = await api.put(`/orders/${orderId}/status`, { status });

      if (response.data.success) {
        const orderIndex = orders.value.findIndex((o) => o.id === orderId);
        if (orderIndex > -1) {
          orders.value[orderIndex].status = status;
          orders.value[orderIndex].updatedAt = Date.now();

          if (status === "delivered") {
            orders.value[orderIndex].completedAt = new Date().toISOString();
          }
        }
        return true;
      }
      return false;
    } catch (err: unknown) {
      error.value =
        getApiEnvelopeMessage(err) || t("orderStore.updateStatusFailed");
      return false;
    }
  };

  const updateOrder = (updatedOrder: Order) => {
    const index = orders.value.findIndex(
      (order) => order.id === updatedOrder.id,
    );
    if (index > -1) {
      orders.value[index] = updatedOrder;
    } else {
      // Add new order to the beginning of the list
      orders.value.unshift(updatedOrder);
    }
  };

  const removeOrder = (orderId: string) => {
    const index = orders.value.findIndex((order) => order.id === orderId);
    if (index > -1) {
      orders.value.splice(index, 1);
    }
  };

  const getOrderById = (orderId: string) => {
    return orders.value.find((order) => order.id === orderId);
  };

  const getOrdersByTable = (tableId: number) => {
    return orders.value.filter((order) => order.tableId === tableId);
  };

  const getOrdersByStatus = (status: OrderStatus) => {
    return orders.value.filter((order) => order.status === status);
  };

  const getTotalRevenue = (status?: OrderStatus) => {
    const filteredOrders = status
      ? orders.value.filter((order) => order.status === status)
      : orders.value.filter((order) => order.status === "delivered");

    return filteredOrders.reduce(
      (total, order) => total + order.totalAmount,
      0,
    );
  };

  const clearOrders = () => {
    orders.value = [];
    error.value = null;
  };

  // Kitchen specific actions
  const confirmOrder = (orderId: string) => {
    return updateOrderStatus(orderId, "confirmed");
  };

  const startPreparing = (orderId: string) => {
    return updateOrderStatus(orderId, "preparing");
  };

  const markReady = (orderId: string) => {
    return updateOrderStatus(orderId, "ready");
  };

  const completeOrder = (orderId: string) => {
    return updateOrderStatus(orderId, "delivered");
  };

  const cancelOrder = async (orderId: string, reason?: string) => {
    try {
      // ApiServiceCompat.delete(url, data) already wraps `data` into the axios
      // `{ data }` config, so pass the raw payload — passing `{ data: {...} }`
      // here would double-wrap and put the body on the wire as
      // `{"data":{"reason":...}}`, which the server ignores.
      const response = await api.delete(
        `/orders/${orderId}`,
        reason ? { reason } : undefined,
      );

      if (response.data.success) {
        const orderIndex = orders.value.findIndex((o) => o.id === orderId);
        if (orderIndex > -1) {
          orders.value[orderIndex].status = "cancelled";
          orders.value[orderIndex].updatedAt = Date.now();
        }
        return true;
      }
      return false;
    } catch (err: unknown) {
      error.value = getApiEnvelopeMessage(err) || t("orderStore.cancelFailed");
      return false;
    }
  };

  return {
    orders: readonly(orders),
    isLoading: readonly(isLoading),
    error: readonly(error),
    pendingOrders,
    confirmedOrders,
    preparingOrders,
    readyOrders,
    completedOrders,
    pendingOrdersCount,
    activeOrdersCount,
    fetchOrders,
    updateOrderStatus,
    updateOrder,
    removeOrder,
    getOrderById,
    getOrdersByTable,
    getOrdersByStatus,
    getTotalRevenue,
    clearOrders,
    confirmOrder,
    startPreparing,
    markReady,
    completeOrder,
    cancelOrder,
  };
});

import { defineStore } from "pinia";
import { ref, computed, readonly } from "vue";
import { OrderStatus } from "@/types";
import { api } from "@/services/api";
export const useOrderStore = defineStore("order", () => {
  const orders = ref([]);
  const isLoading = ref(false);
  const error = ref(null);
  // Computed properties
  const pendingOrders = computed(() =>
    orders.value.filter((order) => order.status === OrderStatus.PENDING),
  );
  const confirmedOrders = computed(() =>
    orders.value.filter((order) => order.status === OrderStatus.CONFIRMED),
  );
  const preparingOrders = computed(() =>
    orders.value.filter((order) => order.status === OrderStatus.PREPARING),
  );
  const readyOrders = computed(() =>
    orders.value.filter((order) => order.status === OrderStatus.READY),
  );
  const completedOrders = computed(() =>
    orders.value.filter((order) => order.status === OrderStatus.COMPLETED),
  );
  const pendingOrdersCount = computed(() => pendingOrders.value.length);
  const activeOrdersCount = computed(
    () =>
      orders.value.filter((order) =>
        [
          OrderStatus.PENDING,
          OrderStatus.CONFIRMED,
          OrderStatus.PREPARING,
          OrderStatus.READY,
        ].includes(order.status),
      ).length,
  );
  // Actions
  const fetchOrders = async (params) => {
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
      const response = await api.get(`/orders?${queryParams.toString()}`);
      if (response.data.success && response.data.data) {
        orders.value = response.data.data;
      }
    } catch (err) {
      error.value = err.response?.data?.error?.message || "獲取訂單失敗";
    } finally {
      isLoading.value = false;
    }
  };
  const updateOrderStatus = async (orderId, status) => {
    try {
      const response = await api.patch(`/orders/${orderId}/status`, { status });
      if (response.data.success) {
        const orderIndex = orders.value.findIndex((o) => o.id === orderId);
        if (orderIndex > -1) {
          orders.value[orderIndex].status = status;
          orders.value[orderIndex].updatedAt = new Date().toISOString();
          if (status === "completed") {
            orders.value[orderIndex].completedAt = new Date().toISOString();
          }
        }
        return true;
      }
      return false;
    } catch (err) {
      error.value = err.response?.data?.error || "更新訂單狀態失敗";
      return false;
    }
  };
  const updateOrder = (updatedOrder) => {
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
  const removeOrder = (orderId) => {
    const index = orders.value.findIndex((order) => order.id === orderId);
    if (index > -1) {
      orders.value.splice(index, 1);
    }
  };
  const getOrderById = (orderId) => {
    return orders.value.find((order) => order.id === orderId);
  };
  const getOrdersByTable = (tableId) => {
    return orders.value.filter((order) => order.tableId === tableId);
  };
  const getOrdersByStatus = (status) => {
    return orders.value.filter((order) => order.status === status);
  };
  const getTotalRevenue = (status) => {
    const filteredOrders = status
      ? orders.value.filter((order) => order.status === status)
      : orders.value.filter((order) => order.status === "completed");
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
  const confirmOrder = (orderId) => {
    return updateOrderStatus(orderId, OrderStatus.CONFIRMED);
  };
  const startPreparing = (orderId) => {
    return updateOrderStatus(orderId, OrderStatus.PREPARING);
  };
  const markReady = (orderId) => {
    return updateOrderStatus(orderId, OrderStatus.READY);
  };
  const completeOrder = (orderId) => {
    return updateOrderStatus(orderId, OrderStatus.COMPLETED);
  };
  const cancelOrder = async (orderId, reason) => {
    try {
      const response = await api.patch(`/orders/${orderId}/cancel`, { reason });
      if (response.data.success) {
        const orderIndex = orders.value.findIndex((o) => o.id === orderId);
        if (orderIndex > -1) {
          orders.value[orderIndex].status = OrderStatus.CANCELLED;
          orders.value[orderIndex].updatedAt = new Date().toISOString();
        }
        return true;
      }
      return false;
    } catch (err) {
      error.value = err.response?.data?.error?.message || "取消訂單失敗";
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

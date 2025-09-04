import { ref, computed, onMounted } from 'vue';
import { useOrderStore } from '@/stores/order';
import { OrderStatus } from '@/types';
import { ClockIcon, CheckCircleIcon, XCircleIcon, MagnifyingGlassIcon, ArrowPathIcon, ShoppingBagIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import { CookingPotIcon } from '@heroicons/vue/24/solid';
const orderStore = useOrderStore();
// 響應式數據
const searchQuery = ref('');
const statusFilter = ref('');
const typeFilter = ref('');
const selectedOrder = ref(null);
const isLoading = ref(false);
const hasMore = ref(false);
const currentPage = ref(1);
const pageSize = ref(50);
// Helper functions for missing properties
const getOrderNumber = (order) => `ORD-${order.id.toString().padStart(6, '0')}`;
const getTableNumber = (order) => order.tableId ? `T${order.tableId.toString().padStart(2, '0')}` : '外帶';
const getCustomerName = (order) => order.customerInfo?.name || '客人';
const getOrderType = (order) => order.tableId ? 'dine_in' : 'takeaway';
const getMenuItemName = (item) => `菜品 #${item.menuItemId}`; // In real app, would lookup from menu
const getItemTotalPrice = (item) => (item.unitPrice * item.quantity).toFixed(2);
// 計算屬性
const stats = computed(() => ({
    pending: orderStore.orders.filter(o => o.status === OrderStatus.PENDING).length,
    preparing: orderStore.orders.filter(o => [OrderStatus.CONFIRMED, OrderStatus.PREPARING].includes(o.status)).length,
    completed: orderStore.orders.filter(o => o.status === OrderStatus.COMPLETED).length,
    cancelled: orderStore.orders.filter(o => o.status === OrderStatus.CANCELLED).length
}));
const filteredOrders = computed(() => {
    let filtered = [...orderStore.orders];
    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        filtered = filtered.filter(order => getOrderNumber(order).toLowerCase().includes(query) ||
            getCustomerName(order).toLowerCase().includes(query));
    }
    if (statusFilter.value) {
        filtered = filtered.filter(order => order.status === statusFilter.value);
    }
    if (typeFilter.value) {
        filtered = filtered.filter(order => getOrderType(order) === typeFilter.value);
    }
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
});
// 方法
const refreshOrders = async () => {
    isLoading.value = true;
    try {
        await orderStore.fetchOrders();
        // Reset pagination
        currentPage.value = 1;
        hasMore.value = orderStore.orders.length >= pageSize.value;
    }
    finally {
        isLoading.value = false;
    }
};
const loadMoreOrders = async () => {
    if (isLoading.value || !hasMore.value)
        return;
    isLoading.value = true;
    try {
        currentPage.value++;
        // In a real implementation, this would fetch the next page
        await orderStore.fetchOrders({ page: currentPage.value, limit: pageSize.value });
        // Check if there are more items to load
        hasMore.value = orderStore.orders.length % pageSize.value === 0;
    }
    finally {
        isLoading.value = false;
    }
};
// Removed onLoadMore function since we're using a simple button approach instead of virtual scroll events
const viewOrderDetails = (order) => {
    selectedOrder.value = order;
};
const updateOrderStatus = async (order) => {
    const nextStatus = getNextStatus(order.status);
    if (nextStatus) {
        await orderStore.updateOrderStatus(order.id, nextStatus);
    }
};
const cancelOrder = async (order) => {
    if (confirm(`確定要取消訂單 ${getOrderNumber(order)} 嗎？`)) {
        await orderStore.updateOrderStatus(order.id, OrderStatus.CANCELLED);
    }
};
const canUpdateStatus = (status) => {
    return !['completed', 'cancelled'].includes(status);
};
const canCancel = (status) => {
    return ['pending', 'confirmed'].includes(status);
};
const getNextStatus = (currentStatus) => {
    const statusFlow = {
        'pending': 'confirmed',
        'confirmed': 'preparing',
        'preparing': 'ready',
        'ready': 'served',
        'served': 'completed'
    };
    return statusFlow[currentStatus] || null;
};
const getStatusClass = (status) => {
    const classes = {
        'pending': 'bg-yellow-100 text-yellow-800',
        'confirmed': 'bg-blue-100 text-blue-800',
        'preparing': 'bg-purple-100 text-purple-800',
        'ready': 'bg-orange-100 text-orange-800',
        'served': 'bg-green-100 text-green-800',
        'completed': 'bg-green-100 text-green-800',
        'cancelled': 'bg-red-100 text-red-800'
    };
    return classes[status] || 'bg-gray-100 text-gray-800';
};
const getStatusText = (status) => {
    const texts = {
        'pending': '待確認',
        'confirmed': '已確認',
        'preparing': '製作中',
        'ready': '待取餐',
        'served': '已送達',
        'completed': '已完成',
        'cancelled': '已取消'
    };
    return texts[status] || status;
};
const getTypeClass = (type) => {
    const classes = {
        'dine_in': 'bg-blue-100 text-blue-800',
        'takeaway': 'bg-green-100 text-green-800',
        'delivery': 'bg-purple-100 text-purple-800'
    };
    return classes[type] || 'bg-gray-100 text-gray-800';
};
const getTypeText = (type) => {
    const texts = {
        'dine_in': '內用',
        'takeaway': '外帶',
        'delivery': '外送'
    };
    return texts[type] || type;
};
const formatDateTime = (dateTime) => {
    return new Date(dateTime).toLocaleString('zh-TW');
};
// 生命周期
onMounted(() => {
    refreshOrders();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['orders-view']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "orders-view" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-white rounded-lg shadow p-6" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "p-2 bg-yellow-100 rounded-lg" },
});
const __VLS_0 = {}.ClockIcon;
/** @type {[typeof __VLS_components.ClockIcon, ]} */ ;
// @ts-ignore
ClockIcon;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: "h-6 w-6 text-yellow-600" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "h-6 w-6 text-yellow-600" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "ml-4" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
    ...{ class: "text-lg font-semibold text-gray-900" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-2xl font-bold text-yellow-600" },
});
(__VLS_ctx.stats.pending);
// @ts-ignore
[stats,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-white rounded-lg shadow p-6" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "p-2 bg-blue-100 rounded-lg" },
});
const __VLS_5 = {}.CookingPotIcon;
/** @type {[typeof __VLS_components.CookingPotIcon, ]} */ ;
// @ts-ignore
CookingPotIcon;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
    ...{ class: "h-6 w-6 text-blue-600" },
}));
const __VLS_7 = __VLS_6({
    ...{ class: "h-6 w-6 text-blue-600" },
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "ml-4" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
    ...{ class: "text-lg font-semibold text-gray-900" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-2xl font-bold text-blue-600" },
});
(__VLS_ctx.stats.preparing);
// @ts-ignore
[stats,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-white rounded-lg shadow p-6" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "p-2 bg-green-100 rounded-lg" },
});
const __VLS_10 = {}.CheckCircleIcon;
/** @type {[typeof __VLS_components.CheckCircleIcon, ]} */ ;
// @ts-ignore
CheckCircleIcon;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent(__VLS_10, new __VLS_10({
    ...{ class: "h-6 w-6 text-green-600" },
}));
const __VLS_12 = __VLS_11({
    ...{ class: "h-6 w-6 text-green-600" },
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "ml-4" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
    ...{ class: "text-lg font-semibold text-gray-900" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-2xl font-bold text-green-600" },
});
(__VLS_ctx.stats.completed);
// @ts-ignore
[stats,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-white rounded-lg shadow p-6" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "p-2 bg-red-100 rounded-lg" },
});
const __VLS_15 = {}.XCircleIcon;
/** @type {[typeof __VLS_components.XCircleIcon, ]} */ ;
// @ts-ignore
XCircleIcon;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({
    ...{ class: "h-6 w-6 text-red-600" },
}));
const __VLS_17 = __VLS_16({
    ...{ class: "h-6 w-6 text-red-600" },
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "ml-4" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
    ...{ class: "text-lg font-semibold text-gray-900" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-2xl font-bold text-red-600" },
});
(__VLS_ctx.stats.cancelled);
// @ts-ignore
[stats,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-white rounded-lg shadow mb-6" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "p-6" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex flex-col sm:flex-row gap-4" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "relative" },
});
const __VLS_20 = {}.MagnifyingGlassIcon;
/** @type {[typeof __VLS_components.MagnifyingGlassIcon, ]} */ ;
// @ts-ignore
MagnifyingGlassIcon;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    ...{ class: "absolute left-3 top-3 h-4 w-4 text-gray-400" },
}));
const __VLS_22 = __VLS_21({
    ...{ class: "absolute left-3 top-3 h-4 w-4 text-gray-400" },
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
__VLS_asFunctionalElement(__VLS_elements.input)({
    value: (__VLS_ctx.searchQuery),
    type: "text",
    placeholder: "搜索訂單編號或客戶姓名",
    ...{ class: "pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" },
});
// @ts-ignore
[searchQuery,];
__VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
    value: (__VLS_ctx.statusFilter),
    ...{ class: "px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" },
});
// @ts-ignore
[statusFilter,];
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "pending",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "confirmed",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "preparing",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "ready",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "served",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "completed",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "cancelled",
});
__VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
    value: (__VLS_ctx.typeFilter),
    ...{ class: "px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" },
});
// @ts-ignore
[typeFilter,];
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "dine_in",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "takeaway",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "delivery",
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.refreshOrders) },
    ...{ class: "flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors" },
});
// @ts-ignore
[refreshOrders,];
const __VLS_25 = {}.ArrowPathIcon;
/** @type {[typeof __VLS_components.ArrowPathIcon, ]} */ ;
// @ts-ignore
ArrowPathIcon;
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent(__VLS_25, new __VLS_25({
    ...{ class: "h-4 w-4 mr-2" },
}));
const __VLS_27 = __VLS_26({
    ...{ class: "h-4 w-4 mr-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_26));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-white rounded-lg shadow" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "p-6" },
});
__VLS_asFunctionalElement(__VLS_elements.h2, __VLS_elements.h2)({
    ...{ class: "text-xl font-semibold text-gray-900 mb-6" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "grid grid-cols-8 gap-4 px-6 py-3 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider mb-4 rounded-t-lg" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
if (__VLS_ctx.filteredOrders.length > 0) {
    // @ts-ignore
    [filteredOrders,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "max-h-[500px] overflow-y-auto" },
    });
    for (const [order] of __VLS_getVForSourceType((__VLS_ctx.filteredOrders))) {
        // @ts-ignore
        [filteredOrders,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            key: (order.id),
            ...{ class: "grid grid-cols-8 gap-4 px-6 py-4 hover:bg-gray-50 border-b border-gray-200 items-center" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "text-sm font-medium text-gray-900" },
        });
        (__VLS_ctx.getOrderNumber(order));
        // @ts-ignore
        [getOrderNumber,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "text-sm text-gray-500" },
        });
        (__VLS_ctx.getTableNumber(order));
        // @ts-ignore
        [getTableNumber,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "text-sm text-gray-500" },
        });
        (__VLS_ctx.getCustomerName(order));
        // @ts-ignore
        [getCustomerName,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: (__VLS_ctx.getTypeClass(__VLS_ctx.getOrderType(order))) },
            ...{ class: "px-2 inline-flex text-xs leading-5 font-semibold rounded-full" },
        });
        // @ts-ignore
        [getTypeClass, getOrderType,];
        (__VLS_ctx.getTypeText(__VLS_ctx.getOrderType(order)));
        // @ts-ignore
        [getOrderType, getTypeText,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: (__VLS_ctx.getStatusClass(order.status)) },
            ...{ class: "px-2 inline-flex text-xs leading-5 font-semibold rounded-full" },
        });
        // @ts-ignore
        [getStatusClass,];
        (__VLS_ctx.getStatusText(order.status));
        // @ts-ignore
        [getStatusText,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "text-sm text-gray-500" },
        });
        (order.totalAmount);
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "text-sm text-gray-500" },
        });
        (__VLS_ctx.formatDateTime(order.createdAt));
        // @ts-ignore
        [formatDateTime,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "text-sm font-medium" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "flex items-center space-x-2" },
        });
        __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.filteredOrders.length > 0))
                        return;
                    __VLS_ctx.viewOrderDetails(order);
                    // @ts-ignore
                    [viewOrderDetails,];
                } },
            ...{ class: "text-blue-600 hover:text-blue-900" },
        });
        if (__VLS_ctx.canUpdateStatus(order.status)) {
            // @ts-ignore
            [canUpdateStatus,];
            __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.filteredOrders.length > 0))
                            return;
                        if (!(__VLS_ctx.canUpdateStatus(order.status)))
                            return;
                        __VLS_ctx.updateOrderStatus(order);
                        // @ts-ignore
                        [updateOrderStatus,];
                    } },
                ...{ class: "text-green-600 hover:text-green-900" },
            });
        }
        if (__VLS_ctx.canCancel(order.status)) {
            // @ts-ignore
            [canCancel,];
            __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.filteredOrders.length > 0))
                            return;
                        if (!(__VLS_ctx.canCancel(order.status)))
                            return;
                        __VLS_ctx.cancelOrder(order);
                        // @ts-ignore
                        [cancelOrder,];
                    } },
                ...{ class: "text-red-600 hover:text-red-900" },
            });
        }
    }
    if (__VLS_ctx.hasMore) {
        // @ts-ignore
        [hasMore,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "p-4 text-center" },
        });
        __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
            ...{ onClick: (__VLS_ctx.loadMoreOrders) },
            disabled: (__VLS_ctx.isLoading),
            ...{ class: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed" },
        });
        // @ts-ignore
        [loadMoreOrders, isLoading,];
        if (__VLS_ctx.isLoading) {
            // @ts-ignore
            [isLoading,];
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
        }
        else {
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
        }
    }
}
if (__VLS_ctx.filteredOrders.length === 0) {
    // @ts-ignore
    [filteredOrders,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-center py-12" },
    });
    const __VLS_30 = {}.ShoppingBagIcon;
    /** @type {[typeof __VLS_components.ShoppingBagIcon, ]} */ ;
    // @ts-ignore
    ShoppingBagIcon;
    // @ts-ignore
    const __VLS_31 = __VLS_asFunctionalComponent(__VLS_30, new __VLS_30({
        ...{ class: "mx-auto h-12 w-12 text-gray-400" },
    }));
    const __VLS_32 = __VLS_31({
        ...{ class: "mx-auto h-12 w-12 text-gray-400" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_31));
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
        ...{ class: "mt-2 text-sm font-medium text-gray-900" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "mt-1 text-sm text-gray-500" },
    });
}
if (__VLS_ctx.selectedOrder) {
    // @ts-ignore
    [selectedOrder,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "fixed inset-0 z-50 overflow-y-auto" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center justify-center min-h-screen px-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.selectedOrder))
                    return;
                __VLS_ctx.selectedOrder = null;
                // @ts-ignore
                [selectedOrder,];
            } },
        ...{ class: "fixed inset-0 bg-black opacity-30" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "relative bg-white rounded-lg shadow-xl max-w-2xl w-full" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "p-6" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center justify-between mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
        ...{ class: "text-lg font-semibold" },
    });
    (__VLS_ctx.getOrderNumber(__VLS_ctx.selectedOrder));
    // @ts-ignore
    [getOrderNumber, selectedOrder,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.selectedOrder))
                    return;
                __VLS_ctx.selectedOrder = null;
                // @ts-ignore
                [selectedOrder,];
            } },
        ...{ class: "text-gray-400 hover:text-gray-600" },
    });
    const __VLS_35 = {}.XMarkIcon;
    /** @type {[typeof __VLS_components.XMarkIcon, ]} */ ;
    // @ts-ignore
    XMarkIcon;
    // @ts-ignore
    const __VLS_36 = __VLS_asFunctionalComponent(__VLS_35, new __VLS_35({
        ...{ class: "h-6 w-6" },
    }));
    const __VLS_37 = __VLS_36({
        ...{ class: "h-6 w-6" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_36));
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "space-y-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "grid grid-cols-2 gap-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
        ...{ class: "block text-sm font-medium text-gray-700" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-sm text-gray-900" },
    });
    (__VLS_ctx.getTableNumber(__VLS_ctx.selectedOrder));
    // @ts-ignore
    [getTableNumber, selectedOrder,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
        ...{ class: "block text-sm font-medium text-gray-700" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-sm text-gray-900" },
    });
    (__VLS_ctx.getCustomerName(__VLS_ctx.selectedOrder));
    // @ts-ignore
    [getCustomerName, selectedOrder,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
        ...{ class: "block text-sm font-medium text-gray-700" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-sm text-gray-900" },
    });
    (__VLS_ctx.getTypeText(__VLS_ctx.getOrderType(__VLS_ctx.selectedOrder)));
    // @ts-ignore
    [getOrderType, getTypeText, selectedOrder,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
        ...{ class: "block text-sm font-medium text-gray-700" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-sm text-gray-900" },
    });
    (__VLS_ctx.getStatusText(__VLS_ctx.selectedOrder.status));
    // @ts-ignore
    [getStatusText, selectedOrder,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
        ...{ class: "block text-sm font-medium text-gray-700 mb-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "border rounded-lg divide-y" },
    });
    for (const [item] of __VLS_getVForSourceType((__VLS_ctx.selectedOrder.items))) {
        // @ts-ignore
        [selectedOrder,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            key: (item.id),
            ...{ class: "p-3" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "flex justify-between" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
        __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
            ...{ class: "font-medium" },
        });
        (__VLS_ctx.getMenuItemName(item));
        // @ts-ignore
        [getMenuItemName,];
        __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
            ...{ class: "text-sm text-gray-500" },
        });
        (item.quantity);
        __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
            ...{ class: "font-medium" },
        });
        (__VLS_ctx.getItemTotalPrice(item));
        // @ts-ignore
        [getItemTotalPrice,];
    }
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "border-t pt-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex justify-between text-lg font-semibold" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    (__VLS_ctx.selectedOrder.totalAmount);
    // @ts-ignore
    [selectedOrder,];
}
/** @type {__VLS_StyleScopedClasses['orders-view']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-4']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-6']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-8']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-yellow-100']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['w-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-yellow-600']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-yellow-600']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-100']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['w-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-green-100']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['w-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-600']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-600']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-100']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['w-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-600']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-600']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['left-3']} */ ;
/** @type {__VLS_StyleScopedClasses['top-3']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['pl-10']} */ ;
/** @type {__VLS_StyleScopedClasses['pr-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-blue-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-8']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wider']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-t-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-[500px]']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-8']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-blue-900']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-green-900']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-red-900']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-blue-700']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:cursor-not-allowed']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-12']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['h-12']} */ ;
/** @type {__VLS_StyleScopedClasses['w-12']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-50']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-screen']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-30']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['w-6']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['divide-y']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        ClockIcon: ClockIcon,
        CheckCircleIcon: CheckCircleIcon,
        XCircleIcon: XCircleIcon,
        MagnifyingGlassIcon: MagnifyingGlassIcon,
        ArrowPathIcon: ArrowPathIcon,
        ShoppingBagIcon: ShoppingBagIcon,
        XMarkIcon: XMarkIcon,
        CookingPotIcon: CookingPotIcon,
        searchQuery: searchQuery,
        statusFilter: statusFilter,
        typeFilter: typeFilter,
        selectedOrder: selectedOrder,
        isLoading: isLoading,
        hasMore: hasMore,
        getOrderNumber: getOrderNumber,
        getTableNumber: getTableNumber,
        getCustomerName: getCustomerName,
        getOrderType: getOrderType,
        getMenuItemName: getMenuItemName,
        getItemTotalPrice: getItemTotalPrice,
        stats: stats,
        filteredOrders: filteredOrders,
        refreshOrders: refreshOrders,
        loadMoreOrders: loadMoreOrders,
        viewOrderDetails: viewOrderDetails,
        updateOrderStatus: updateOrderStatus,
        cancelOrder: cancelOrder,
        canUpdateStatus: canUpdateStatus,
        canCancel: canCancel,
        getStatusClass: getStatusClass,
        getStatusText: getStatusText,
        getTypeClass: getTypeClass,
        getTypeText: getTypeText,
        formatDateTime: formatDateTime,
    }),
});
export default (await import('vue')).defineComponent({});
; /* PartiallyEnd: #4569/main.vue */

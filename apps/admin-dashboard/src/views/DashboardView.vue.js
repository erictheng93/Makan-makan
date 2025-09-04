import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useDashboardStore } from '@/stores/dashboard';
import { useOrderStore } from '@/stores/order';
import { OrderStatus } from '@/types';
import { useDashboardPolling } from '@/composables/usePolling';
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { RefreshCw, Menu, Table, Users, BarChart3 } from 'lucide-vue-next';
// Components (these would be implemented separately)
import StatsCard from '@/components/dashboard/StatsCard.vue';
import RevenueChart from '@/components/dashboard/RevenueChart.vue';
import OrdersChart from '@/components/dashboard/OrdersChart.vue';
import TopMenuItems from '@/components/dashboard/TopMenuItems.vue';
import RecentOrders from '@/components/dashboard/RecentOrders.vue';
const authStore = useAuthStore();
const dashboardStore = useDashboardStore();
const orderStore = useOrderStore();
const revenueChartPeriod = ref('daily');
const ordersChartPeriod = ref('daily');
// Start auto-refresh for dashboard data
const { start: startPolling, stop: stopPolling } = useDashboardPolling(30000);
const user = computed(() => authStore.user);
const isLoading = computed(() => dashboardStore.isLoading);
const canAccessAdminFeatures = computed(() => authStore.canAccessAdminFeatures);
// Dashboard stats
const todayOrders = computed(() => dashboardStore.todayOrders);
const todayRevenue = computed(() => dashboardStore.todayRevenue);
const averageOrderValue = computed(() => dashboardStore.averageOrderValue);
const completionRate = computed(() => dashboardStore.completionRate);
const topMenuItems = computed(() => dashboardStore.topMenuItems);
const revenueChart = computed(() => dashboardStore.revenueChart);
const ordersChart = computed(() => dashboardStore.ordersChart);
const lastUpdatedText = computed(() => {
    if (!dashboardStore.lastUpdated)
        return '從未更新';
    return formatDistanceToNow(dashboardStore.lastUpdated, {
        addSuffix: true,
        locale: zhTW
    });
});
const formatCurrency = (amount) => {
    return dashboardStore.formatCurrency(amount);
};
const formatPercentage = (value) => {
    return dashboardStore.formatPercentage(value);
};
const refreshData = async () => {
    await Promise.all([
        dashboardStore.fetchDashboardStats(),
        orderStore.fetchOrders({ status: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY] })
    ]);
};
const updateRevenueChart = async () => {
    await dashboardStore.fetchRevenueAnalytics(revenueChartPeriod.value);
};
const updateOrdersChart = async () => {
    await dashboardStore.fetchOrderAnalytics(ordersChartPeriod.value);
};
onMounted(async () => {
    // Initial data load
    await refreshData();
    // Start auto-refresh
    startPolling();
    dashboardStore.startAutoRefresh(30000);
});
onUnmounted(() => {
    stopPolling();
    dashboardStore.stopAutoRefresh();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "space-y-6" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center justify-between" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.h1, __VLS_elements.h1)({
    ...{ class: "text-2xl font-bold text-gray-900" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-gray-600" },
});
(__VLS_ctx.user?.username);
// @ts-ignore
[user,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-3" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-sm text-gray-500" },
});
(__VLS_ctx.lastUpdatedText);
// @ts-ignore
[lastUpdatedText,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.refreshData) },
    disabled: (__VLS_ctx.isLoading),
    ...{ class: "btn-secondary" },
    ...{ class: ({ 'opacity-50': __VLS_ctx.isLoading }) },
});
// @ts-ignore
[refreshData, isLoading, isLoading,];
const __VLS_0 = {}.RefreshCw;
/** @type {[typeof __VLS_components.RefreshCw, ]} */ 
// @ts-ignore
RefreshCw;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: "w-4 h-4 mr-2" },
    ...{ class: ({ 'animate-spin': __VLS_ctx.isLoading }) },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "w-4 h-4 mr-2" },
    ...{ class: ({ 'animate-spin': __VLS_ctx.isLoading }) },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
// @ts-ignore
[isLoading,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" },
});
/** @type {[typeof StatsCard, ]} */ 
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(StatsCard, new StatsCard({
    title: "今日訂單",
    value: (__VLS_ctx.todayOrders),
    icon: "shopping-cart",
    color: "blue",
    loading: (__VLS_ctx.isLoading),
}));
const __VLS_6 = __VLS_5({
    title: "今日訂單",
    value: (__VLS_ctx.todayOrders),
    icon: "shopping-cart",
    color: "blue",
    loading: (__VLS_ctx.isLoading),
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
// @ts-ignore
[isLoading, todayOrders,];
/** @type {[typeof StatsCard, ]} */ 
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(StatsCard, new StatsCard({
    title: "今日營收",
    value: (__VLS_ctx.formatCurrency(__VLS_ctx.todayRevenue)),
    icon: "dollar-sign",
    color: "green",
    loading: (__VLS_ctx.isLoading),
}));
const __VLS_10 = __VLS_9({
    title: "今日營收",
    value: (__VLS_ctx.formatCurrency(__VLS_ctx.todayRevenue)),
    icon: "dollar-sign",
    color: "green",
    loading: (__VLS_ctx.isLoading),
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
// @ts-ignore
[isLoading, formatCurrency, todayRevenue,];
/** @type {[typeof StatsCard, ]} */ 
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(StatsCard, new StatsCard({
    title: "平均客單價",
    value: (__VLS_ctx.formatCurrency(__VLS_ctx.averageOrderValue)),
    icon: "trending-up",
    color: "purple",
    loading: (__VLS_ctx.isLoading),
}));
const __VLS_14 = __VLS_13({
    title: "平均客單價",
    value: (__VLS_ctx.formatCurrency(__VLS_ctx.averageOrderValue)),
    icon: "trending-up",
    color: "purple",
    loading: (__VLS_ctx.isLoading),
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
// @ts-ignore
[isLoading, formatCurrency, averageOrderValue,];
/** @type {[typeof StatsCard, ]} */ 
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(StatsCard, new StatsCard({
    title: "完成率",
    value: (__VLS_ctx.formatPercentage(__VLS_ctx.completionRate)),
    icon: "check-circle",
    color: "orange",
    loading: (__VLS_ctx.isLoading),
}));
const __VLS_18 = __VLS_17({
    title: "完成率",
    value: (__VLS_ctx.formatPercentage(__VLS_ctx.completionRate)),
    icon: "check-circle",
    color: "orange",
    loading: (__VLS_ctx.isLoading),
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
// @ts-ignore
[isLoading, formatPercentage, completionRate,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "grid grid-cols-1 lg:grid-cols-2 gap-6" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "card p-6" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center justify-between mb-4" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
    ...{ class: "text-lg font-semibold text-gray-900" },
});
__VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
    ...{ onChange: (__VLS_ctx.updateRevenueChart) },
    value: (__VLS_ctx.revenueChartPeriod),
    ...{ class: "form-input w-auto" },
});
// @ts-ignore
[updateRevenueChart, revenueChartPeriod,];
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "daily",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "weekly",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "monthly",
});
/** @type {[typeof RevenueChart, ]} */ 
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(RevenueChart, new RevenueChart({
    data: __VLS_ctx.revenueChart,
    loading: (__VLS_ctx.isLoading),
    period: __VLS_ctx.revenueChartPeriod,
}));
const __VLS_22 = __VLS_21({
    data: __VLS_ctx.revenueChart,
    loading: (__VLS_ctx.isLoading),
    period: __VLS_ctx.revenueChartPeriod,
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
// @ts-ignore
[isLoading, revenueChartPeriod, revenueChart,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "card p-6" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center justify-between mb-4" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
    ...{ class: "text-lg font-semibold text-gray-900" },
});
__VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
    ...{ onChange: (__VLS_ctx.updateOrdersChart) },
    value: (__VLS_ctx.ordersChartPeriod),
    ...{ class: "form-input w-auto" },
});
// @ts-ignore
[updateOrdersChart, ordersChartPeriod,];
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "daily",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "weekly",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "monthly",
});
/** @type {[typeof OrdersChart, ]} */ 
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(OrdersChart, new OrdersChart({
    data: __VLS_ctx.ordersChart,
    loading: (__VLS_ctx.isLoading),
    period: __VLS_ctx.ordersChartPeriod,
}));
const __VLS_26 = __VLS_25({
    data: __VLS_ctx.ordersChart,
    loading: (__VLS_ctx.isLoading),
    period: __VLS_ctx.ordersChartPeriod,
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
// @ts-ignore
[isLoading, ordersChartPeriod, ordersChart,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "grid grid-cols-1 lg:grid-cols-3 gap-6" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "lg:col-span-2" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "card p-6" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
    ...{ class: "text-lg font-semibold text-gray-900 mb-4" },
});
/** @type {[typeof TopMenuItems, ]} */ 
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(TopMenuItems, new TopMenuItems({
    items: __VLS_ctx.topMenuItems,
    loading: (__VLS_ctx.isLoading),
}));
const __VLS_30 = __VLS_29({
    items: __VLS_ctx.topMenuItems,
    loading: (__VLS_ctx.isLoading),
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
// @ts-ignore
[isLoading, topMenuItems,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "card p-6" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center justify-between mb-4" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
    ...{ class: "text-lg font-semibold text-gray-900" },
});
const __VLS_33 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ 
// @ts-ignore
RouterLink;
// @ts-ignore
const __VLS_34 = __VLS_asFunctionalComponent(__VLS_33, new __VLS_33({
    to: "/dashboard/orders",
    ...{ class: "text-primary-600 hover:text-primary-700 text-sm font-medium" },
}));
const __VLS_35 = __VLS_34({
    to: "/dashboard/orders",
    ...{ class: "text-primary-600 hover:text-primary-700 text-sm font-medium" },
}, ...__VLS_functionalComponentArgsRest(__VLS_34));
const { default: __VLS_37 } = __VLS_36.slots;
let __VLS_36;
/** @type {[typeof RecentOrders, ]} */ 
// @ts-ignore
const __VLS_38 = __VLS_asFunctionalComponent(RecentOrders, new RecentOrders({
    loading: (__VLS_ctx.orderStore.isLoading),
}));
const __VLS_39 = __VLS_38({
    loading: (__VLS_ctx.orderStore.isLoading),
}, ...__VLS_functionalComponentArgsRest(__VLS_38));
// @ts-ignore
[orderStore,];
if (__VLS_ctx.canAccessAdminFeatures) {
    // @ts-ignore
    [canAccessAdminFeatures,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "card p-6" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
        ...{ class: "text-lg font-semibold text-gray-900 mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "grid grid-cols-2 md:grid-cols-4 gap-4" },
    });
    const __VLS_42 = {}.RouterLink;
    /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ 
    // @ts-ignore
    RouterLink;
    // @ts-ignore
    const __VLS_43 = __VLS_asFunctionalComponent(__VLS_42, new __VLS_42({
        to: "/dashboard/menu",
        ...{ class: "flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors" },
    }));
    const __VLS_44 = __VLS_43({
        to: "/dashboard/menu",
        ...{ class: "flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_43));
    const { default: __VLS_46 } = __VLS_45.slots;
    const __VLS_47 = {}.Menu;
    /** @type {[typeof __VLS_components.Menu, ]} */ 
    // @ts-ignore
    Menu;
    // @ts-ignore
    const __VLS_48 = __VLS_asFunctionalComponent(__VLS_47, new __VLS_47({
        ...{ class: "w-8 h-8 text-primary-600 mb-2" },
    }));
    const __VLS_49 = __VLS_48({
        ...{ class: "w-8 h-8 text-primary-600 mb-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_48));
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "text-sm font-medium text-gray-900" },
    });
    let __VLS_45;
    const __VLS_52 = {}.RouterLink;
    /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ 
    // @ts-ignore
    RouterLink;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
        to: "/dashboard/tables",
        ...{ class: "flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors" },
    }));
    const __VLS_54 = __VLS_53({
        to: "/dashboard/tables",
        ...{ class: "flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    const { default: __VLS_56 } = __VLS_55.slots;
    const __VLS_57 = {}.Table;
    /** @type {[typeof __VLS_components.Table, ]} */ 
    // @ts-ignore
    Table;
    // @ts-ignore
    const __VLS_58 = __VLS_asFunctionalComponent(__VLS_57, new __VLS_57({
        ...{ class: "w-8 h-8 text-primary-600 mb-2" },
    }));
    const __VLS_59 = __VLS_58({
        ...{ class: "w-8 h-8 text-primary-600 mb-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_58));
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "text-sm font-medium text-gray-900" },
    });
    let __VLS_55;
    const __VLS_62 = {}.RouterLink;
    /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ 
    // @ts-ignore
    RouterLink;
    // @ts-ignore
    const __VLS_63 = __VLS_asFunctionalComponent(__VLS_62, new __VLS_62({
        to: "/dashboard/users",
        ...{ class: "flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors" },
    }));
    const __VLS_64 = __VLS_63({
        to: "/dashboard/users",
        ...{ class: "flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_63));
    const { default: __VLS_66 } = __VLS_65.slots;
    const __VLS_67 = {}.Users;
    /** @type {[typeof __VLS_components.Users, ]} */ 
    // @ts-ignore
    Users;
    // @ts-ignore
    const __VLS_68 = __VLS_asFunctionalComponent(__VLS_67, new __VLS_67({
        ...{ class: "w-8 h-8 text-primary-600 mb-2" },
    }));
    const __VLS_69 = __VLS_68({
        ...{ class: "w-8 h-8 text-primary-600 mb-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_68));
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "text-sm font-medium text-gray-900" },
    });
    let __VLS_65;
    const __VLS_72 = {}.RouterLink;
    /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ 
    // @ts-ignore
    RouterLink;
    // @ts-ignore
    const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
        to: "/dashboard/analytics",
        ...{ class: "flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors" },
    }));
    const __VLS_74 = __VLS_73({
        to: "/dashboard/analytics",
        ...{ class: "flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_73));
    const { default: __VLS_76 } = __VLS_75.slots;
    const __VLS_77 = {}.BarChart3;
    /** @type {[typeof __VLS_components.BarChart3, ]} */ 
    // @ts-ignore
    BarChart3;
    // @ts-ignore
    const __VLS_78 = __VLS_asFunctionalComponent(__VLS_77, new __VLS_77({
        ...{ class: "w-8 h-8 text-primary-600 mb-2" },
    }));
    const __VLS_79 = __VLS_78({
        ...{ class: "w-8 h-8 text-primary-600 mb-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_78));
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "text-sm font-medium text-gray-900" },
    });
    let __VLS_75;
}
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-3']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ 
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['mr-2']} */ 
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ 
/** @type {__VLS_StyleScopedClasses['grid']} */ 
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ 
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ 
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-4']} */ 
/** @type {__VLS_StyleScopedClasses['gap-6']} */ 
/** @type {__VLS_StyleScopedClasses['grid']} */ 
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ 
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-2']} */ 
/** @type {__VLS_StyleScopedClasses['gap-6']} */ 
/** @type {__VLS_StyleScopedClasses['card']} */ 
/** @type {__VLS_StyleScopedClasses['p-6']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['mb-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['form-input']} */ 
/** @type {__VLS_StyleScopedClasses['w-auto']} */ 
/** @type {__VLS_StyleScopedClasses['card']} */ 
/** @type {__VLS_StyleScopedClasses['p-6']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['mb-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['form-input']} */ 
/** @type {__VLS_StyleScopedClasses['w-auto']} */ 
/** @type {__VLS_StyleScopedClasses['grid']} */ 
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ 
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-3']} */ 
/** @type {__VLS_StyleScopedClasses['gap-6']} */ 
/** @type {__VLS_StyleScopedClasses['lg:col-span-2']} */ 
/** @type {__VLS_StyleScopedClasses['card']} */ 
/** @type {__VLS_StyleScopedClasses['p-6']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['mb-4']} */ 
/** @type {__VLS_StyleScopedClasses['card']} */ 
/** @type {__VLS_StyleScopedClasses['p-6']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['mb-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['text-primary-600']} */ 
/** @type {__VLS_StyleScopedClasses['hover:text-primary-700']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['card']} */ 
/** @type {__VLS_StyleScopedClasses['p-6']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['mb-4']} */ 
/** @type {__VLS_StyleScopedClasses['grid']} */ 
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ 
/** @type {__VLS_StyleScopedClasses['md:grid-cols-4']} */ 
/** @type {__VLS_StyleScopedClasses['gap-4']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['flex-col']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['p-4']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-100']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ 
/** @type {__VLS_StyleScopedClasses['text-primary-600']} */ 
/** @type {__VLS_StyleScopedClasses['mb-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['flex-col']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['p-4']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-100']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['w-8']} */ 
/** @type {__VLS_StyleScopedClasses['h-8']} */ 
/** @type {__VLS_StyleScopedClasses['text-primary-600']} */ 
/** @type {__VLS_StyleScopedClasses['mb-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['flex-col']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['p-4']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-100']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['w-8']} */ 
/** @type {__VLS_StyleScopedClasses['h-8']} */ 
/** @type {__VLS_StyleScopedClasses['text-primary-600']} */ 
/** @type {__VLS_StyleScopedClasses['mb-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['flex-col']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['p-4']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-100']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['w-8']} */ 
/** @type {__VLS_StyleScopedClasses['h-8']} */ 
/** @type {__VLS_StyleScopedClasses['text-primary-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
let __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        RefreshCw: RefreshCw,
        Menu: Menu,
        Table: Table,
        Users: Users,
        BarChart3: BarChart3,
        StatsCard: StatsCard,
        RevenueChart: RevenueChart,
        OrdersChart: OrdersChart,
        TopMenuItems: TopMenuItems,
        RecentOrders: RecentOrders,
        orderStore: orderStore,
        revenueChartPeriod: revenueChartPeriod,
        ordersChartPeriod: ordersChartPeriod,
        user: user,
        isLoading: isLoading,
        canAccessAdminFeatures: canAccessAdminFeatures,
        todayOrders: todayOrders,
        todayRevenue: todayRevenue,
        averageOrderValue: averageOrderValue,
        completionRate: completionRate,
        topMenuItems: topMenuItems,
        revenueChart: revenueChart,
        ordersChart: ordersChart,
        lastUpdatedText: lastUpdatedText,
        formatCurrency: formatCurrency,
        formatPercentage: formatPercentage,
        refreshData: refreshData,
        updateRevenueChart: updateRevenueChart,
        updateOrdersChart: updateOrdersChart,
    }),
});
export default (await import('vue')).defineComponent({});
 /* PartiallyEnd: #4569/main.vue */

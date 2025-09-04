import { ref, onMounted } from 'vue';
import { CurrencyDollarIcon, ShoppingBagIcon, CalculatorIcon, TableCellsIcon, ChartBarIcon, DocumentArrowDownIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon, ClockIcon } from '@heroicons/vue/24/outline';
// 響應式數據
const selectedPeriod = ref('today');
// 模擬數據
const metrics = ref({
    totalRevenue: 25680.50,
    revenueChange: 12.5,
    totalOrders: 156,
    ordersChange: 8.3,
    averageOrderValue: 164.62,
    aovChange: 3.7,
    tableUtilization: 78,
    tableChange: -2.1
});
const orderStatusData = ref([
    { name: '已完成', count: 89, color: 'bg-green-500' },
    { name: '製作中', count: 23, color: 'bg-blue-500' },
    { name: '待確認', count: 15, color: 'bg-yellow-500' },
    { name: '已取消', count: 7, color: 'bg-red-500' }
]);
const popularItems = ref([
    { id: 1, name: '招牌炒飯', orders: 45, revenue: 540.00 },
    { id: 2, name: '冰奶茶', orders: 38, revenue: 190.00 },
    { id: 3, name: '春卷', orders: 32, revenue: 256.00 },
    { id: 4, name: '南洋咖啡', orders: 28, revenue: 78.40 },
    { id: 5, name: '紅豆冰', orders: 25, revenue: 162.50 }
]);
const businessHours = ref([
    { time: '08:00 - 10:00', orders: 12, percentage: 15 },
    { time: '10:00 - 12:00', orders: 28, percentage: 35 },
    { time: '12:00 - 14:00', orders: 45, percentage: 56 },
    { time: '14:00 - 16:00', orders: 32, percentage: 40 },
    { time: '16:00 - 18:00', orders: 38, percentage: 48 },
    { time: '18:00 - 20:00', orders: 52, percentage: 65 },
    { time: '20:00 - 22:00', orders: 35, percentage: 44 }
]);
const dailyData = ref([
    { date: '2024-08-26', orders: 156, revenue: 2568.50, averageOrder: 164.62, tableUtilization: 78 },
    { date: '2024-08-25', orders: 142, revenue: 2341.20, averageOrder: 164.93, tableUtilization: 72 },
    { date: '2024-08-24', orders: 138, revenue: 2256.80, averageOrder: 163.54, tableUtilization: 75 },
    { date: '2024-08-23', orders: 161, revenue: 2689.40, averageOrder: 167.02, tableUtilization: 82 },
    { date: '2024-08-22', orders: 149, revenue: 2445.70, averageOrder: 164.22, tableUtilization: 77 }
]);
// 方法
const formatMoney = (amount) => {
    return amount.toLocaleString('en-MY', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};
const getBusinessHourColor = (percentage) => {
    if (percentage >= 60)
        return 'bg-green-500';
    if (percentage >= 40)
        return 'bg-yellow-500';
    return 'bg-red-500';
};
const updateData = () => {
    // 根據選擇的時間段更新數據
    console.log('Updating data for period:', selectedPeriod.value);
};
const exportReport = () => {
    alert('報表匯出功能開發中...');
};
onMounted(() => {
    // 初始化數據
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['analytics-view']} */ 
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "analytics-view" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.h1, __VLS_elements.h1)({
    ...{ class: "text-2xl font-bold text-gray-900" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-gray-600" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "mt-4 sm:mt-0 flex items-center space-x-4" },
});
__VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
    ...{ onChange: (__VLS_ctx.updateData) },
    value: (__VLS_ctx.selectedPeriod),
    ...{ class: "px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" },
});
// @ts-ignore
[updateData, selectedPeriod,];
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "today",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "week",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "month",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "quarter",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "year",
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.exportReport) },
    ...{ class: "flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors" },
});
// @ts-ignore
[exportReport,];
const __VLS_0 = {}.DocumentArrowDownIcon;
/** @type {[typeof __VLS_components.DocumentArrowDownIcon, ]} */ 
// @ts-ignore
DocumentArrowDownIcon;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: "h-4 w-4 mr-2" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "h-4 w-4 mr-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
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
    ...{ class: "p-3 rounded-full bg-green-100" },
});
const __VLS_5 = {}.CurrencyDollarIcon;
/** @type {[typeof __VLS_components.CurrencyDollarIcon, ]} */ 
// @ts-ignore
CurrencyDollarIcon;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
    ...{ class: "h-8 w-8 text-green-600" },
}));
const __VLS_7 = __VLS_6({
    ...{ class: "h-8 w-8 text-green-600" },
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "ml-4" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm text-gray-500" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-2xl font-bold text-gray-900" },
});
(__VLS_ctx.formatMoney(__VLS_ctx.metrics.totalRevenue));
// @ts-ignore
[formatMoney, metrics,];
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: (__VLS_ctx.metrics.revenueChange >= 0 ? 'text-green-600' : 'text-red-600') },
    ...{ class: "text-sm" },
});
// @ts-ignore
[metrics,];
if (__VLS_ctx.metrics.revenueChange >= 0) {
    // @ts-ignore
    [metrics,];
    const __VLS_10 = {}.ArrowTrendingUpIcon;
    /** @type {[typeof __VLS_components.ArrowTrendingUpIcon, ]} */ 
    // @ts-ignore
    ArrowTrendingUpIcon;
    // @ts-ignore
    const __VLS_11 = __VLS_asFunctionalComponent(__VLS_10, new __VLS_10({
        ...{ class: "w-4 h-4 inline mr-1" },
    }));
    const __VLS_12 = __VLS_11({
        ...{ class: "w-4 h-4 inline mr-1" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_11));
}
else {
    const __VLS_15 = {}.ArrowTrendingDownIcon;
    /** @type {[typeof __VLS_components.ArrowTrendingDownIcon, ]} */ 
    // @ts-ignore
    ArrowTrendingDownIcon;
    // @ts-ignore
    const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({
        ...{ class: "w-4 h-4 inline mr-1" },
    }));
    const __VLS_17 = __VLS_16({
        ...{ class: "w-4 h-4 inline mr-1" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_16));
}
(Math.abs(__VLS_ctx.metrics.revenueChange));
// @ts-ignore
[metrics,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-white rounded-lg shadow p-6" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "p-3 rounded-full bg-blue-100" },
});
const __VLS_20 = {}.ShoppingBagIcon;
/** @type {[typeof __VLS_components.ShoppingBagIcon, ]} */ 
// @ts-ignore
ShoppingBagIcon;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    ...{ class: "h-8 w-8 text-blue-600" },
}));
const __VLS_22 = __VLS_21({
    ...{ class: "h-8 w-8 text-blue-600" },
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "ml-4" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm text-gray-500" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-2xl font-bold text-gray-900" },
});
(__VLS_ctx.metrics.totalOrders);
// @ts-ignore
[metrics,];
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: (__VLS_ctx.metrics.ordersChange >= 0 ? 'text-green-600' : 'text-red-600') },
    ...{ class: "text-sm" },
});
// @ts-ignore
[metrics,];
if (__VLS_ctx.metrics.ordersChange >= 0) {
    // @ts-ignore
    [metrics,];
    const __VLS_25 = {}.ArrowTrendingUpIcon;
    /** @type {[typeof __VLS_components.ArrowTrendingUpIcon, ]} */ 
    // @ts-ignore
    ArrowTrendingUpIcon;
    // @ts-ignore
    const __VLS_26 = __VLS_asFunctionalComponent(__VLS_25, new __VLS_25({
        ...{ class: "w-4 h-4 inline mr-1" },
    }));
    const __VLS_27 = __VLS_26({
        ...{ class: "w-4 h-4 inline mr-1" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_26));
}
else {
    const __VLS_30 = {}.ArrowTrendingDownIcon;
    /** @type {[typeof __VLS_components.ArrowTrendingDownIcon, ]} */ 
    // @ts-ignore
    ArrowTrendingDownIcon;
    // @ts-ignore
    const __VLS_31 = __VLS_asFunctionalComponent(__VLS_30, new __VLS_30({
        ...{ class: "w-4 h-4 inline mr-1" },
    }));
    const __VLS_32 = __VLS_31({
        ...{ class: "w-4 h-4 inline mr-1" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_31));
}
(Math.abs(__VLS_ctx.metrics.ordersChange));
// @ts-ignore
[metrics,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-white rounded-lg shadow p-6" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "p-3 rounded-full bg-purple-100" },
});
const __VLS_35 = {}.CalculatorIcon;
/** @type {[typeof __VLS_components.CalculatorIcon, ]} */ 
// @ts-ignore
CalculatorIcon;
// @ts-ignore
const __VLS_36 = __VLS_asFunctionalComponent(__VLS_35, new __VLS_35({
    ...{ class: "h-8 w-8 text-purple-600" },
}));
const __VLS_37 = __VLS_36({
    ...{ class: "h-8 w-8 text-purple-600" },
}, ...__VLS_functionalComponentArgsRest(__VLS_36));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "ml-4" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm text-gray-500" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-2xl font-bold text-gray-900" },
});
(__VLS_ctx.formatMoney(__VLS_ctx.metrics.averageOrderValue));
// @ts-ignore
[formatMoney, metrics,];
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: (__VLS_ctx.metrics.aovChange >= 0 ? 'text-green-600' : 'text-red-600') },
    ...{ class: "text-sm" },
});
// @ts-ignore
[metrics,];
if (__VLS_ctx.metrics.aovChange >= 0) {
    // @ts-ignore
    [metrics,];
    const __VLS_40 = {}.ArrowTrendingUpIcon;
    /** @type {[typeof __VLS_components.ArrowTrendingUpIcon, ]} */ 
    // @ts-ignore
    ArrowTrendingUpIcon;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
        ...{ class: "w-4 h-4 inline mr-1" },
    }));
    const __VLS_42 = __VLS_41({
        ...{ class: "w-4 h-4 inline mr-1" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
}
else {
    const __VLS_45 = {}.ArrowTrendingDownIcon;
    /** @type {[typeof __VLS_components.ArrowTrendingDownIcon, ]} */ 
    // @ts-ignore
    ArrowTrendingDownIcon;
    // @ts-ignore
    const __VLS_46 = __VLS_asFunctionalComponent(__VLS_45, new __VLS_45({
        ...{ class: "w-4 h-4 inline mr-1" },
    }));
    const __VLS_47 = __VLS_46({
        ...{ class: "w-4 h-4 inline mr-1" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_46));
}
(Math.abs(__VLS_ctx.metrics.aovChange));
// @ts-ignore
[metrics,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-white rounded-lg shadow p-6" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "p-3 rounded-full bg-yellow-100" },
});
const __VLS_50 = {}.TableCellsIcon;
/** @type {[typeof __VLS_components.TableCellsIcon, ]} */ 
// @ts-ignore
TableCellsIcon;
// @ts-ignore
const __VLS_51 = __VLS_asFunctionalComponent(__VLS_50, new __VLS_50({
    ...{ class: "h-8 w-8 text-yellow-600" },
}));
const __VLS_52 = __VLS_51({
    ...{ class: "h-8 w-8 text-yellow-600" },
}, ...__VLS_functionalComponentArgsRest(__VLS_51));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "ml-4" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm text-gray-500" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-2xl font-bold text-gray-900" },
});
(__VLS_ctx.metrics.tableUtilization);
// @ts-ignore
[metrics,];
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: (__VLS_ctx.metrics.tableChange >= 0 ? 'text-green-600' : 'text-red-600') },
    ...{ class: "text-sm" },
});
// @ts-ignore
[metrics,];
if (__VLS_ctx.metrics.tableChange >= 0) {
    // @ts-ignore
    [metrics,];
    const __VLS_55 = {}.ArrowTrendingUpIcon;
    /** @type {[typeof __VLS_components.ArrowTrendingUpIcon, ]} */ 
    // @ts-ignore
    ArrowTrendingUpIcon;
    // @ts-ignore
    const __VLS_56 = __VLS_asFunctionalComponent(__VLS_55, new __VLS_55({
        ...{ class: "w-4 h-4 inline mr-1" },
    }));
    const __VLS_57 = __VLS_56({
        ...{ class: "w-4 h-4 inline mr-1" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_56));
}
else {
    const __VLS_60 = {}.ArrowTrendingDownIcon;
    /** @type {[typeof __VLS_components.ArrowTrendingDownIcon, ]} */ 
    // @ts-ignore
    ArrowTrendingDownIcon;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
        ...{ class: "w-4 h-4 inline mr-1" },
    }));
    const __VLS_62 = __VLS_61({
        ...{ class: "w-4 h-4 inline mr-1" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
}
(Math.abs(__VLS_ctx.metrics.tableChange));
// @ts-ignore
[metrics,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-white rounded-lg shadow p-6" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
    ...{ class: "text-lg font-semibold text-gray-900 mb-4" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "h-64 flex items-center justify-center bg-gray-50 rounded-lg" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-center" },
});
const __VLS_65 = {}.ChartBarIcon;
/** @type {[typeof __VLS_components.ChartBarIcon, ]} */ 
// @ts-ignore
ChartBarIcon;
// @ts-ignore
const __VLS_66 = __VLS_asFunctionalComponent(__VLS_65, new __VLS_65({
    ...{ class: "mx-auto h-12 w-12 text-gray-400 mb-2" },
}));
const __VLS_67 = __VLS_66({
    ...{ class: "mx-auto h-12 w-12 text-gray-400 mb-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_66));
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-gray-500" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm text-gray-400" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-white rounded-lg shadow p-6" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
    ...{ class: "text-lg font-semibold text-gray-900 mb-4" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "h-64" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "grid grid-cols-2 gap-4 h-full" },
});
for (const [status] of __VLS_getVForSourceType((__VLS_ctx.orderStatusData))) {
    // @ts-ignore
    [orderStatusData,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        key: (status.name),
        ...{ class: "flex flex-col items-center justify-center" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: (status.color) },
        ...{ class: "w-16 h-16 rounded-full flex items-center justify-center mb-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "text-white font-bold text-lg" },
    });
    (status.count);
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-sm text-gray-600 text-center" },
    });
    (status.name);
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "grid grid-cols-1 lg:grid-cols-2 gap-8" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-white rounded-lg shadow" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "p-6" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
    ...{ class: "text-lg font-semibold text-gray-900 mb-4" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "space-y-4" },
});
for (const [item, index] of __VLS_getVForSourceType((__VLS_ctx.popularItems))) {
    // @ts-ignore
    [popularItems,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        key: (item.id),
        ...{ class: "flex items-center justify-between" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "text-blue-800 font-semibold text-sm" },
    });
    (index + 1);
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "ml-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-sm font-medium text-gray-900" },
    });
    (item.name);
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-sm text-gray-500" },
    });
    (item.orders);
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-right" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-sm font-medium text-gray-900" },
    });
    (__VLS_ctx.formatMoney(item.revenue));
    // @ts-ignore
    [formatMoney,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "w-32 bg-gray-200 rounded-full h-2 mt-1" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ style: ({ width: `${(item.orders / __VLS_ctx.popularItems[0].orders) * 100}%` }) },
        ...{ class: "bg-blue-600 h-2 rounded-full" },
    });
    // @ts-ignore
    [popularItems,];
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-white rounded-lg shadow" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "p-6" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
    ...{ class: "text-lg font-semibold text-gray-900 mb-4" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "space-y-4" },
});
for (const [period] of __VLS_getVForSourceType((__VLS_ctx.businessHours))) {
    // @ts-ignore
    [businessHours,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        key: (period.time),
        ...{ class: "flex items-center justify-between" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center" },
    });
    const __VLS_70 = {}.ClockIcon;
    /** @type {[typeof __VLS_components.ClockIcon, ]} */ 
    // @ts-ignore
    ClockIcon;
    // @ts-ignore
    const __VLS_71 = __VLS_asFunctionalComponent(__VLS_70, new __VLS_70({
        ...{ class: "w-5 h-5 text-gray-400 mr-3" },
    }));
    const __VLS_72 = __VLS_71({
        ...{ class: "w-5 h-5 text-gray-400 mr-3" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_71));
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "text-sm font-medium text-gray-900" },
    });
    (period.time);
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "w-32 bg-gray-200 rounded-full h-2 mr-3" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ style: ({ width: `${period.percentage}%` }) },
        ...{ class: (__VLS_ctx.getBusinessHourColor(period.percentage)) },
        ...{ class: "h-2 rounded-full" },
    });
    // @ts-ignore
    [getBusinessHourColor,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "text-sm text-gray-600 w-16" },
    });
    (period.orders);
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "mt-8 bg-white rounded-lg shadow" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "p-6" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
    ...{ class: "text-lg font-semibold text-gray-900 mb-4" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "overflow-x-auto" },
});
__VLS_asFunctionalElement(__VLS_elements.table, __VLS_elements.table)({
    ...{ class: "min-w-full divide-y divide-gray-200" },
});
__VLS_asFunctionalElement(__VLS_elements.thead, __VLS_elements.thead)({
    ...{ class: "bg-gray-50" },
});
__VLS_asFunctionalElement(__VLS_elements.tr, __VLS_elements.tr)({});
__VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({
    ...{ class: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" },
});
__VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({
    ...{ class: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" },
});
__VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({
    ...{ class: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" },
});
__VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({
    ...{ class: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" },
});
__VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({
    ...{ class: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" },
});
__VLS_asFunctionalElement(__VLS_elements.tbody, __VLS_elements.tbody)({
    ...{ class: "bg-white divide-y divide-gray-200" },
});
for (const [day] of __VLS_getVForSourceType((__VLS_ctx.dailyData))) {
    // @ts-ignore
    [dailyData,];
    __VLS_asFunctionalElement(__VLS_elements.tr, __VLS_elements.tr)({
        key: (day.date),
        ...{ class: "hover:bg-gray-50" },
    });
    __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
        ...{ class: "px-6 py-4 whitespace-nowrap text-sm text-gray-900" },
    });
    (day.date);
    __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
        ...{ class: "px-6 py-4 whitespace-nowrap text-sm text-gray-900" },
    });
    (day.orders);
    __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
        ...{ class: "px-6 py-4 whitespace-nowrap text-sm text-gray-900" },
    });
    (__VLS_ctx.formatMoney(day.revenue));
    // @ts-ignore
    [formatMoney,];
    __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
        ...{ class: "px-6 py-4 whitespace-nowrap text-sm text-gray-900" },
    });
    (__VLS_ctx.formatMoney(day.averageOrder));
    // @ts-ignore
    [formatMoney,];
    __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({
        ...{ class: "px-6 py-4 whitespace-nowrap text-sm text-gray-900" },
    });
    (day.tableUtilization);
}
/** @type {__VLS_StyleScopedClasses['analytics-view']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['flex-col']} */ 
/** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ 
/** @type {__VLS_StyleScopedClasses['sm:items-center']} */ 
/** @type {__VLS_StyleScopedClasses['sm:justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['mb-8']} */ 
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['mt-4']} */ 
/** @type {__VLS_StyleScopedClasses['sm:mt-0']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-4']} */ 
/** @type {__VLS_StyleScopedClasses['px-3']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['border']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-300']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['bg-green-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-green-700']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['mr-2']} */ 
/** @type {__VLS_StyleScopedClasses['grid']} */ 
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ 
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ 
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-4']} */ 
/** @type {__VLS_StyleScopedClasses['gap-6']} */ 
/** @type {__VLS_StyleScopedClasses['mb-8']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['shadow']} */ 
/** @type {__VLS_StyleScopedClasses['p-6']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['p-3']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['bg-green-100']} */ 
/** @type {__VLS_StyleScopedClasses['h-8']} */ 
/** @type {__VLS_StyleScopedClasses['w-8']} */ 
/** @type {__VLS_StyleScopedClasses['text-green-600']} */ 
/** @type {__VLS_StyleScopedClasses['ml-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['inline']} */ 
/** @type {__VLS_StyleScopedClasses['mr-1']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['inline']} */ 
/** @type {__VLS_StyleScopedClasses['mr-1']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['shadow']} */ 
/** @type {__VLS_StyleScopedClasses['p-6']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['p-3']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['bg-blue-100']} */ 
/** @type {__VLS_StyleScopedClasses['h-8']} */ 
/** @type {__VLS_StyleScopedClasses['w-8']} */ 
/** @type {__VLS_StyleScopedClasses['text-blue-600']} */ 
/** @type {__VLS_StyleScopedClasses['ml-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['inline']} */ 
/** @type {__VLS_StyleScopedClasses['mr-1']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['inline']} */ 
/** @type {__VLS_StyleScopedClasses['mr-1']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['shadow']} */ 
/** @type {__VLS_StyleScopedClasses['p-6']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['p-3']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['bg-purple-100']} */ 
/** @type {__VLS_StyleScopedClasses['h-8']} */ 
/** @type {__VLS_StyleScopedClasses['w-8']} */ 
/** @type {__VLS_StyleScopedClasses['text-purple-600']} */ 
/** @type {__VLS_StyleScopedClasses['ml-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['inline']} */ 
/** @type {__VLS_StyleScopedClasses['mr-1']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['inline']} */ 
/** @type {__VLS_StyleScopedClasses['mr-1']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['shadow']} */ 
/** @type {__VLS_StyleScopedClasses['p-6']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['p-3']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['bg-yellow-100']} */ 
/** @type {__VLS_StyleScopedClasses['h-8']} */ 
/** @type {__VLS_StyleScopedClasses['w-8']} */ 
/** @type {__VLS_StyleScopedClasses['text-yellow-600']} */ 
/** @type {__VLS_StyleScopedClasses['ml-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['inline']} */ 
/** @type {__VLS_StyleScopedClasses['mr-1']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['inline']} */ 
/** @type {__VLS_StyleScopedClasses['mr-1']} */ 
/** @type {__VLS_StyleScopedClasses['grid']} */ 
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ 
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-2']} */ 
/** @type {__VLS_StyleScopedClasses['gap-8']} */ 
/** @type {__VLS_StyleScopedClasses['mb-8']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['shadow']} */ 
/** @type {__VLS_StyleScopedClasses['p-6']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['mb-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-64']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['text-center']} */ 
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ 
/** @type {__VLS_StyleScopedClasses['h-12']} */ 
/** @type {__VLS_StyleScopedClasses['w-12']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ 
/** @type {__VLS_StyleScopedClasses['mb-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['shadow']} */ 
/** @type {__VLS_StyleScopedClasses['p-6']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['mb-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-64']} */ 
/** @type {__VLS_StyleScopedClasses['grid']} */ 
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ 
/** @type {__VLS_StyleScopedClasses['gap-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-full']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['flex-col']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['w-16']} */ 
/** @type {__VLS_StyleScopedClasses['h-16']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['mb-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-center']} */ 
/** @type {__VLS_StyleScopedClasses['grid']} */ 
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-2']} */ 
/** @type {__VLS_StyleScopedClasses['gap-8']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['shadow']} */ 
/** @type {__VLS_StyleScopedClasses['p-6']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['mb-4']} */ 
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ 
/** @type {__VLS_StyleScopedClasses['w-8']} */ 
/** @type {__VLS_StyleScopedClasses['h-8']} */ 
/** @type {__VLS_StyleScopedClasses['bg-blue-100']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['text-blue-800']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['ml-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['w-32']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['h-2']} */ 
/** @type {__VLS_StyleScopedClasses['mt-1']} */ 
/** @type {__VLS_StyleScopedClasses['bg-blue-600']} */ 
/** @type {__VLS_StyleScopedClasses['h-2']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['shadow']} */ 
/** @type {__VLS_StyleScopedClasses['p-6']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['mb-4']} */ 
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['w-5']} */ 
/** @type {__VLS_StyleScopedClasses['h-5']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ 
/** @type {__VLS_StyleScopedClasses['mr-3']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['w-32']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['h-2']} */ 
/** @type {__VLS_StyleScopedClasses['mr-3']} */ 
/** @type {__VLS_StyleScopedClasses['h-2']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['w-16']} */ 
/** @type {__VLS_StyleScopedClasses['mt-8']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['shadow']} */ 
/** @type {__VLS_StyleScopedClasses['p-6']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['mb-4']} */ 
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ 
/** @type {__VLS_StyleScopedClasses['min-w-full']} */ 
/** @type {__VLS_StyleScopedClasses['divide-y']} */ 
/** @type {__VLS_StyleScopedClasses['divide-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ 
/** @type {__VLS_StyleScopedClasses['px-6']} */ 
/** @type {__VLS_StyleScopedClasses['py-3']} */ 
/** @type {__VLS_StyleScopedClasses['text-left']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['uppercase']} */ 
/** @type {__VLS_StyleScopedClasses['px-6']} */ 
/** @type {__VLS_StyleScopedClasses['py-3']} */ 
/** @type {__VLS_StyleScopedClasses['text-left']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ 
/** @type {__VLS_StyleScopedClasses['px-6']} */ 
/** @type {__VLS_StyleScopedClasses['py-3']} */ 
/** @type {__VLS_StyleScopedClasses['text-left']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['uppercase']} */ 
/** @type {__VLS_StyleScopedClasses['px-6']} */ 
/** @type {__VLS_StyleScopedClasses['py-3']} */ 
/** @type {__VLS_StyleScopedClasses['text-left']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['uppercase']} */ 
/** @type {__VLS_StyleScopedClasses['px-6']} */ 
/** @type {__VLS_StyleScopedClasses['py-3']} */ 
/** @type {__VLS_StyleScopedClasses['text-left']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['uppercase']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['divide-y']} */ 
/** @type {__VLS_StyleScopedClasses['divide-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-50']} */ 
/** @type {__VLS_StyleScopedClasses['px-6']} */ 
/** @type {__VLS_StyleScopedClasses['py-4']} */ 
/** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['px-6']} */ 
/** @type {__VLS_StyleScopedClasses['py-4']} */ 
/** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['px-6']} */ 
/** @type {__VLS_StyleScopedClasses['py-4']} */ 
/** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['px-6']} */ 
/** @type {__VLS_StyleScopedClasses['py-4']} */ 
/** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['px-6']} */ 
/** @type {__VLS_StyleScopedClasses['py-4']} */ 
/** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
let __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        CurrencyDollarIcon: CurrencyDollarIcon,
        ShoppingBagIcon: ShoppingBagIcon,
        CalculatorIcon: CalculatorIcon,
        TableCellsIcon: TableCellsIcon,
        ChartBarIcon: ChartBarIcon,
        DocumentArrowDownIcon: DocumentArrowDownIcon,
        ArrowTrendingUpIcon: ArrowTrendingUpIcon,
        ArrowTrendingDownIcon: ArrowTrendingDownIcon,
        ClockIcon: ClockIcon,
        selectedPeriod: selectedPeriod,
        metrics: metrics,
        orderStatusData: orderStatusData,
        popularItems: popularItems,
        businessHours: businessHours,
        dailyData: dailyData,
        formatMoney: formatMoney,
        getBusinessHourColor: getBusinessHourColor,
        updateData: updateData,
        exportReport: exportReport,
    }),
});
export default (await import('vue')).defineComponent({});
 /* PartiallyEnd: #4569/main.vue */

import { computed } from "vue";
import { XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon, } from "@heroicons/vue/24/outline";
const props = defineProps();
const __VLS_emit = defineEmits();
// Computed properties
const usageRate = computed(() => {
    if (!props.coupon?.usageLimit || !props.stats?.totalUsed)
        return 0;
    return Math.round((props.stats.totalUsed / props.coupon.usageLimit) * 100);
});
// Utility functions
const formatMoney = (amount) => {
    return (amount / 100).toFixed(2);
};
const formatDateTime = (dateString) => {
    if (!dateString)
        return "-";
    return new Date(dateString).toLocaleString("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
};
const getStatusClass = (coupon) => {
    if (!coupon)
        return "";
    const now = new Date();
    const validTo = new Date(coupon.validTo);
    if (!coupon.isActive) {
        return "text-gray-600";
    }
    else if (now > validTo) {
        return "text-red-600";
    }
    else if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        return "text-yellow-600";
    }
    else {
        return "text-green-600";
    }
};
const getStatusText = (coupon) => {
    if (!coupon)
        return "-";
    const now = new Date();
    const validTo = new Date(coupon.validTo);
    if (!coupon.isActive) {
        return "已停用";
    }
    else if (now > validTo) {
        return "已過期";
    }
    else if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        return "已用完";
    }
    else {
        return "進行中";
    }
};
const getPerformanceRating = () => {
    if (!props.stats?.totalUsed || !props.coupon)
        return "無數據";
    const usage = props.stats.totalUsed;
    const avgDiscount = props.stats.avgDiscount || 0;
    // Simple scoring algorithm
    let score = 0;
    // Usage frequency score (0-40)
    if (usage >= 50)
        score += 40;
    else if (usage >= 20)
        score += 30;
    else if (usage >= 10)
        score += 20;
    else if (usage >= 5)
        score += 10;
    // Average discount score (0-30)
    if (avgDiscount >= 2000)
        score += 30; // RM20+
    else if (avgDiscount >= 1000)
        score += 25; // RM10+
    else if (avgDiscount >= 500)
        score += 20; // RM5+
    else if (avgDiscount >= 200)
        score += 15; // RM2+
    // Usage rate score (0-30)
    if (props.coupon.usageLimit) {
        const rate = usageRate.value;
        if (rate >= 80)
            score += 30;
        else if (rate >= 60)
            score += 25;
        else if (rate >= 40)
            score += 20;
        else if (rate >= 20)
            score += 15;
        else if (rate >= 10)
            score += 10;
    }
    else {
        score += 20; // Unlimited usage gets partial score
    }
    if (score >= 70)
        return "優秀";
    else if (score >= 50)
        return "良好";
    else if (score >= 30)
        return "一般";
    else
        return "需改進";
};
const getPerformanceClass = () => {
    const rating = getPerformanceRating();
    switch (rating) {
        case "優秀":
            return "text-green-600";
        case "良好":
            return "text-blue-600";
        case "一般":
            return "text-yellow-600";
        case "需改進":
            return "text-red-600";
        default:
            return "text-gray-600";
    }
};
const getPerformanceIcon = () => {
    const rating = getPerformanceRating();
    switch (rating) {
        case "優秀":
            return CheckCircleIcon;
        case "良好":
            return CheckCircleIcon;
        case "一般":
            return ExclamationTriangleIcon;
        case "需改進":
            return XCircleIcon;
        default:
            return ExclamationTriangleIcon;
    }
};
const getRecommendations = () => {
    if (!props.stats || !props.coupon)
        return [];
    const recommendations = [];
    const now = new Date();
    const validTo = new Date(props.coupon.validTo);
    const daysLeft = Math.ceil((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    // Usage-based recommendations
    if (props.stats.totalUsed < 5) {
        recommendations.push("使用次數較低，考慮調整折扣力度或推廣策略");
    }
    // Time-based recommendations
    if (daysLeft < 7 && daysLeft > 0) {
        recommendations.push("優惠券即將過期，建議加強推廣");
    }
    // Usage rate recommendations
    if (props.coupon.usageLimit && usageRate.value < 20) {
        recommendations.push("使用率偏低，可考慮延長有效期或增加推廣力度");
    }
    else if (props.coupon.usageLimit && usageRate.value > 80) {
        recommendations.push("使用率很高，可考慮增加使用次數限制");
    }
    // Discount optimization
    if (props.stats.avgDiscount < 500) {
        // Less than RM5
        recommendations.push("平均折扣金額較低，可考慮提高折扣值以增加吸引力");
    }
    return recommendations;
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "mt-3" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center justify-between pb-4 border-b" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
    ...{ class: "text-lg font-semibold text-gray-900" },
});
(__VLS_ctx.coupon?.name);
// @ts-ignore
[coupon,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('close');
            // @ts-ignore
            [$emit,];
        } },
    ...{ class: "text-gray-400 hover:text-gray-600" },
});
const __VLS_0 = {}.XMarkIcon;
/** @type {[typeof __VLS_components.XMarkIcon, ]} */ ;
// @ts-ignore
XMarkIcon;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: "h-6 w-6" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "h-6 w-6" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "mt-6 bg-gray-50 rounded-lg p-4" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "grid grid-cols-1 md:grid-cols-2 gap-4" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.h4, __VLS_elements.h4)({
    ...{ class: "text-sm font-medium text-gray-700 mb-2" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "space-y-1" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "font-medium" },
});
(__VLS_ctx.coupon?.code);
// @ts-ignore
[coupon,];
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "font-medium" },
});
(__VLS_ctx.coupon?.name);
// @ts-ignore
[coupon,];
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "font-medium" },
});
if (__VLS_ctx.coupon?.discountType === 'percentage') {
    // @ts-ignore
    [coupon,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    (__VLS_ctx.coupon?.discountValue);
    // @ts-ignore
    [coupon,];
    if (__VLS_ctx.coupon?.maxDiscountAmount) {
        // @ts-ignore
        [coupon,];
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "text-gray-500" },
        });
        (__VLS_ctx.formatMoney(__VLS_ctx.coupon?.maxDiscountAmount));
        // @ts-ignore
        [coupon, formatMoney,];
    }
}
else {
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    (__VLS_ctx.formatMoney(__VLS_ctx.coupon?.discountValue));
    // @ts-ignore
    [coupon, formatMoney,];
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.h4, __VLS_elements.h4)({
    ...{ class: "text-sm font-medium text-gray-700 mb-2" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "space-y-1" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "font-medium" },
});
(__VLS_ctx.formatDateTime(__VLS_ctx.coupon?.validFrom));
// @ts-ignore
[coupon, formatDateTime,];
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "font-medium" },
});
(__VLS_ctx.formatDateTime(__VLS_ctx.coupon?.validTo));
// @ts-ignore
[coupon, formatDateTime,];
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "font-medium" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: (__VLS_ctx.getStatusClass(__VLS_ctx.coupon)) },
});
// @ts-ignore
[coupon, getStatusClass,];
(__VLS_ctx.getStatusText(__VLS_ctx.coupon));
// @ts-ignore
[coupon, getStatusText,];
if (__VLS_ctx.stats) {
    // @ts-ignore
    [stats,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "mt-6 space-y-6" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    __VLS_asFunctionalElement(__VLS_elements.h4, __VLS_elements.h4)({
        ...{ class: "text-md font-medium text-gray-900 mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "grid grid-cols-1 md:grid-cols-4 gap-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "bg-blue-50 rounded-lg p-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-2xl font-bold text-blue-600" },
    });
    (__VLS_ctx.stats.totalUsed || 0);
    // @ts-ignore
    [stats,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-sm text-blue-700" },
    });
    if (__VLS_ctx.coupon?.usageLimit) {
        // @ts-ignore
        [coupon,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "text-xs text-blue-600 mt-1" },
        });
        (Math.max(0, __VLS_ctx.coupon.usageLimit - (__VLS_ctx.stats.totalUsed || 0)));
        // @ts-ignore
        [coupon, stats,];
    }
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "bg-green-50 rounded-lg p-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-2xl font-bold text-green-600" },
    });
    (__VLS_ctx.formatMoney(__VLS_ctx.stats.totalDiscount || 0));
    // @ts-ignore
    [formatMoney, stats,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-sm text-green-700" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "bg-purple-50 rounded-lg p-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-2xl font-bold text-purple-600" },
    });
    (__VLS_ctx.formatMoney(__VLS_ctx.stats.avgDiscount || 0));
    // @ts-ignore
    [formatMoney, stats,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-sm text-purple-700" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "bg-orange-50 rounded-lg p-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-2xl font-bold text-orange-600" },
    });
    (__VLS_ctx.usageRate);
    // @ts-ignore
    [usageRate,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-sm text-orange-700" },
    });
    if (__VLS_ctx.coupon?.usageLimit) {
        // @ts-ignore
        [coupon,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "w-full bg-orange-200 rounded-full h-2 mt-2" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "bg-orange-600 h-2 rounded-full" },
            ...{ style: ({ width: `${Math.min(100, __VLS_ctx.usageRate)}%` }) },
        });
        // @ts-ignore
        [usageRate,];
    }
    if (__VLS_ctx.stats.lastUsed) {
        // @ts-ignore
        [stats,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
        __VLS_asFunctionalElement(__VLS_elements.h4, __VLS_elements.h4)({
            ...{ class: "text-md font-medium text-gray-900 mb-4" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "bg-gray-50 rounded-lg p-4" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "flex items-center justify-between" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
        __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
            ...{ class: "text-sm font-medium text-gray-700" },
        });
        __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
            ...{ class: "text-sm text-gray-600" },
        });
        (__VLS_ctx.formatDateTime(__VLS_ctx.stats.lastUsed));
        // @ts-ignore
        [formatDateTime, stats,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "text-right" },
        });
        __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
            ...{ class: "text-sm font-medium text-gray-700" },
        });
        __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
            ...{ class: "text-sm text-gray-600" },
        });
        (__VLS_ctx.formatDateTime(__VLS_ctx.coupon?.createdAt));
        // @ts-ignore
        [coupon, formatDateTime,];
    }
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    __VLS_asFunctionalElement(__VLS_elements.h4, __VLS_elements.h4)({
        ...{ class: "text-md font-medium text-gray-900 mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "space-y-3" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "bg-white border rounded-lg p-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center justify-between" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    __VLS_asFunctionalElement(__VLS_elements.h5, __VLS_elements.h5)({
        ...{ class: "text-sm font-medium text-gray-800" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-xs text-gray-600" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "text-lg font-bold" },
        ...{ class: (__VLS_ctx.getPerformanceClass()) },
    });
    // @ts-ignore
    [getPerformanceClass,];
    (__VLS_ctx.getPerformanceRating());
    // @ts-ignore
    [getPerformanceRating,];
    const __VLS_5 = ((__VLS_ctx.getPerformanceIcon()));
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
        ...{ class: "w-5 h-5 ml-2" },
        ...{ class: (__VLS_ctx.getPerformanceClass()) },
    }));
    const __VLS_7 = __VLS_6({
        ...{ class: "w-5 h-5 ml-2" },
        ...{ class: (__VLS_ctx.getPerformanceClass()) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    // @ts-ignore
    [getPerformanceClass, getPerformanceIcon,];
    if (__VLS_ctx.getRecommendations().length > 0) {
        // @ts-ignore
        [getRecommendations,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "bg-yellow-50 border border-yellow-200 rounded-lg p-4" },
        });
        __VLS_asFunctionalElement(__VLS_elements.h5, __VLS_elements.h5)({
            ...{ class: "text-sm font-medium text-yellow-800 mb-2" },
        });
        __VLS_asFunctionalElement(__VLS_elements.ul, __VLS_elements.ul)({
            ...{ class: "space-y-1" },
        });
        for (const [recommendation] of __VLS_getVForSourceType((__VLS_ctx.getRecommendations()))) {
            // @ts-ignore
            [getRecommendations,];
            __VLS_asFunctionalElement(__VLS_elements.li, __VLS_elements.li)({
                key: (recommendation),
                ...{ class: "text-sm text-yellow-700" },
            });
            (recommendation);
        }
    }
}
else {
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "mt-6 text-center py-8" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "mt-2 text-sm text-gray-600" },
    });
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex justify-end pt-6 border-t mt-6" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('close');
            // @ts-ignore
            [$emit,];
        } },
    type: "button",
    ...{ class: "px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" },
});
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['z-50']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['top-20']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['w-11/12']} */ ;
/** @type {__VLS_StyleScopedClasses['md:w-3/4']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:w-1/2']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['w-6']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-md']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-4']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-50']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-green-50']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-700']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-purple-50']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-purple-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-purple-700']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-orange-50']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-orange-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-orange-700']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-orange-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-orange-600']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-md']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-md']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-yellow-50']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-yellow-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-yellow-800']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-yellow-700']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-8']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-offset-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-indigo-500']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        XMarkIcon: XMarkIcon,
        usageRate: usageRate,
        formatMoney: formatMoney,
        formatDateTime: formatDateTime,
        getStatusClass: getStatusClass,
        getStatusText: getStatusText,
        getPerformanceRating: getPerformanceRating,
        getPerformanceClass: getPerformanceClass,
        getPerformanceIcon: getPerformanceIcon,
        getRecommendations: getRecommendations,
    }),
    __typeEmits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */

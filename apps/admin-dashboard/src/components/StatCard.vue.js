import { computed } from 'vue';
import { QueueListIcon, CheckCircleIcon, ClockIcon, ChartBarIcon, CurrencyDollarIcon, UserGroupIcon, ShoppingBagIcon, TableCellsIcon, ExclamationTriangleIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon, MinusIcon } from '@heroicons/vue/24/outline';
const props = withDefaults(defineProps(), {
    color: 'blue'
});
// 圖標組件映射
const iconComponents = {
    QueueListIcon,
    CheckCircleIcon,
    ClockIcon,
    ChartBarIcon,
    CurrencyDollarIcon,
    UserGroupIcon,
    ShoppingBagIcon,
    TableCellsIcon,
    ExclamationTriangleIcon
};
const iconComponent = computed(() => {
    return iconComponents[props.icon] || ChartBarIcon;
});
// 顏色樣式計算
const colorClasses = {
    green: {
        border: 'border-l-green-500',
        iconBg: 'bg-green-100',
        icon: 'text-green-600',
        progress: 'bg-green-500'
    },
    blue: {
        border: 'border-l-blue-500',
        iconBg: 'bg-blue-100',
        icon: 'text-blue-600',
        progress: 'bg-blue-500'
    },
    yellow: {
        border: 'border-l-yellow-500',
        iconBg: 'bg-yellow-100',
        icon: 'text-yellow-600',
        progress: 'bg-yellow-500'
    },
    red: {
        border: 'border-l-red-500',
        iconBg: 'bg-red-100',
        icon: 'text-red-600',
        progress: 'bg-red-500'
    },
    purple: {
        border: 'border-l-purple-500',
        iconBg: 'bg-purple-100',
        icon: 'text-purple-600',
        progress: 'bg-purple-500'
    },
    gray: {
        border: 'border-l-gray-500',
        iconBg: 'bg-gray-100',
        icon: 'text-gray-600',
        progress: 'bg-gray-500'
    }
};
const borderColor = computed(() => colorClasses[props.color].border);
const iconBgColor = computed(() => colorClasses[props.color].iconBg);
const iconColor = computed(() => colorClasses[props.color].icon);
const progressColor = computed(() => colorClasses[props.color].progress);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    color: 'blue'
});
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-white rounded-lg shadow-sm p-6 border-l-4" },
    ...{ class: (__VLS_ctx.borderColor) },
});
// @ts-ignore
[borderColor,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex-shrink-0" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "p-3 rounded-lg" },
    ...{ class: (__VLS_ctx.iconBgColor) },
});
// @ts-ignore
[iconBgColor,];
const __VLS_0 = ((__VLS_ctx.iconComponent));
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: "h-8 w-8" },
    ...{ class: (__VLS_ctx.iconColor) },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "h-8 w-8" },
    ...{ class: (__VLS_ctx.iconColor) },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
// @ts-ignore
[iconComponent, iconColor,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "ml-4 flex-1" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center justify-between" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm font-medium text-gray-600" },
});
(__VLS_ctx.title);
// @ts-ignore
[title,];
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-2xl font-bold text-gray-900" },
});
(__VLS_ctx.value);
// @ts-ignore
[value,];
if (__VLS_ctx.trend) {
    // @ts-ignore
    [trend,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center" },
    });
    if (__VLS_ctx.trend === 'up') {
        // @ts-ignore
        [trend,];
        const __VLS_5 = {}.ArrowTrendingUpIcon;
        /** @type {[typeof __VLS_components.ArrowTrendingUpIcon, ]} */ ;
        // @ts-ignore
        ArrowTrendingUpIcon;
        // @ts-ignore
        const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
            ...{ class: "h-4 w-4 text-green-500 mr-1" },
        }));
        const __VLS_7 = __VLS_6({
            ...{ class: "h-4 w-4 text-green-500 mr-1" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    }
    if (__VLS_ctx.trend === 'down') {
        // @ts-ignore
        [trend,];
        const __VLS_10 = {}.ArrowTrendingDownIcon;
        /** @type {[typeof __VLS_components.ArrowTrendingDownIcon, ]} */ ;
        // @ts-ignore
        ArrowTrendingDownIcon;
        // @ts-ignore
        const __VLS_11 = __VLS_asFunctionalComponent(__VLS_10, new __VLS_10({
            ...{ class: "h-4 w-4 text-red-500 mr-1" },
        }));
        const __VLS_12 = __VLS_11({
            ...{ class: "h-4 w-4 text-red-500 mr-1" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_11));
    }
    if (__VLS_ctx.trend === 'stable') {
        // @ts-ignore
        [trend,];
        const __VLS_15 = {}.MinusIcon;
        /** @type {[typeof __VLS_components.MinusIcon, ]} */ ;
        // @ts-ignore
        MinusIcon;
        // @ts-ignore
        const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({
            ...{ class: "h-4 w-4 text-gray-500 mr-1" },
        }));
        const __VLS_17 = __VLS_16({
            ...{ class: "h-4 w-4 text-gray-500 mr-1" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_16));
    }
}
if (__VLS_ctx.subtitle) {
    // @ts-ignore
    [subtitle,];
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-sm text-gray-500 mt-1" },
    });
    (__VLS_ctx.subtitle);
    // @ts-ignore
    [subtitle,];
}
if (__VLS_ctx.progress !== undefined) {
    // @ts-ignore
    [progress,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "mt-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "w-full bg-gray-200 rounded-full h-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "h-2 rounded-full transition-all duration-300 ease-in-out" },
        ...{ class: (__VLS_ctx.progressColor) },
        ...{ style: ({ width: `${Math.min(__VLS_ctx.progress, 100)}%` }) },
    });
    // @ts-ignore
    [progress, progressColor,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex justify-between text-xs text-gray-500 mt-1" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    (__VLS_ctx.progress);
    // @ts-ignore
    [progress,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
}
if (__VLS_ctx.$slots.extra) {
    // @ts-ignore
    [$slots,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "mt-4 pt-4 border-t border-gray-200" },
    });
    var __VLS_20 = {};
}
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['border-l-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['duration-300']} */ ;
/** @type {__VLS_StyleScopedClasses['ease-in-out']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ ;
// @ts-ignore
var __VLS_21 = __VLS_20;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        ArrowTrendingUpIcon: ArrowTrendingUpIcon,
        ArrowTrendingDownIcon: ArrowTrendingDownIcon,
        MinusIcon: MinusIcon,
        iconComponent: iconComponent,
        borderColor: borderColor,
        iconBgColor: iconBgColor,
        iconColor: iconColor,
        progressColor: progressColor,
    }),
    __typeProps: {},
    props: {},
});
const __VLS_component = (await import('vue')).defineComponent({
    __typeProps: {},
    props: {},
});
export default {};
; /* PartiallyEnd: #4569/main.vue */

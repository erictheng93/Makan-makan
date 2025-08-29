/// <reference types="C:/Users/minim/OneDrive/文档/Code/platform/makanmakan/apps/admin-dashboard/node_modules/.vue-global-types/vue_3.5_0.d.ts" />
import { computed } from 'vue';
import { ShoppingCart, DollarSign, TrendingUp, TrendingDown, CheckCircle, Users, Clock, Package } from 'lucide-vue-next';
const props = withDefaults(defineProps(), {
    loading: false
});
const iconMap = {
    'shopping-cart': ShoppingCart,
    'dollar-sign': DollarSign,
    'trending-up': TrendingUp,
    'check-circle': CheckCircle,
    'users': Users,
    'clock': Clock,
    'package': Package
};
const colorMap = {
    blue: {
        text: 'text-blue-600',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600'
    },
    green: {
        text: 'text-green-600',
        iconBg: 'bg-green-100',
        iconColor: 'text-green-600'
    },
    purple: {
        text: 'text-purple-600',
        iconBg: 'bg-purple-100',
        iconColor: 'text-purple-600'
    },
    orange: {
        text: 'text-orange-600',
        iconBg: 'bg-orange-100',
        iconColor: 'text-orange-600'
    },
    red: {
        text: 'text-red-600',
        iconBg: 'bg-red-100',
        iconColor: 'text-red-600'
    },
    indigo: {
        text: 'text-indigo-600',
        iconBg: 'bg-indigo-100',
        iconColor: 'text-indigo-600'
    }
};
const iconComponent = computed(() => {
    return iconMap[props.icon] || ShoppingCart;
});
const textColorClass = computed(() => colorMap[props.color].text);
const iconBgClass = computed(() => colorMap[props.color].iconBg);
const iconColorClass = computed(() => colorMap[props.color].iconColor);
const displayValue = computed(() => {
    if (typeof props.value === 'number') {
        return props.value.toLocaleString();
    }
    return props.value;
});
const trendIcon = computed(() => {
    if (!props.trend)
        return null;
    return props.trend.value >= 0 ? TrendingUp : TrendingDown;
});
const trendColorClass = computed(() => {
    if (!props.trend)
        return '';
    return props.trend.value >= 0 ? 'text-green-600' : 'text-red-600';
});
const trendText = computed(() => {
    if (!props.trend)
        return '';
    const sign = props.trend.value >= 0 ? '+' : '';
    return `${sign}${props.trend.value.toFixed(1)}% ${props.trend.period}`;
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    loading: false
});
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "card p-6 hover:shadow-lg transition-shadow" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center justify-between" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex-1" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm font-medium text-gray-600 mb-1" },
});
(__VLS_ctx.title);
// @ts-ignore
[title,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center" },
});
if (__VLS_ctx.loading) {
    // @ts-ignore
    [loading,];
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-2xl font-bold text-gray-400 animate-pulse" },
    });
}
else {
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-2xl font-bold" },
        ...{ class: (__VLS_ctx.textColorClass) },
    });
    // @ts-ignore
    [textColorClass,];
    (__VLS_ctx.displayValue);
    // @ts-ignore
    [displayValue,];
}
if (__VLS_ctx.trend && !__VLS_ctx.loading) {
    // @ts-ignore
    [loading, trend,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "ml-2 flex items-center text-sm" },
    });
    const __VLS_0 = ((__VLS_ctx.trendIcon));
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        ...{ class: "w-4 h-4 mr-1" },
        ...{ class: (__VLS_ctx.trendColorClass) },
    }));
    const __VLS_2 = __VLS_1({
        ...{ class: "w-4 h-4 mr-1" },
        ...{ class: (__VLS_ctx.trendColorClass) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    // @ts-ignore
    [trendIcon, trendColorClass,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: (__VLS_ctx.trendColorClass) },
    });
    // @ts-ignore
    [trendColorClass,];
    (__VLS_ctx.trendText);
    // @ts-ignore
    [trendText,];
}
if (__VLS_ctx.subtitle && !__VLS_ctx.loading) {
    // @ts-ignore
    [loading, subtitle,];
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-xs text-gray-500 mt-1" },
    });
    (__VLS_ctx.subtitle);
    // @ts-ignore
    [subtitle,];
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "ml-4" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "w-12 h-12 rounded-lg flex items-center justify-center" },
    ...{ class: (__VLS_ctx.iconBgClass) },
});
// @ts-ignore
[iconBgClass,];
const __VLS_5 = ((__VLS_ctx.iconComponent));
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
    ...{ class: "w-6 h-6" },
    ...{ class: (__VLS_ctx.iconColorClass) },
}));
const __VLS_7 = __VLS_6({
    ...{ class: "w-6 h-6" },
    ...{ class: (__VLS_ctx.iconColorClass) },
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
// @ts-ignore
[iconComponent, iconColorClass,];
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:shadow-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-pulse']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-12']} */ ;
/** @type {__VLS_StyleScopedClasses['h-12']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-6']} */ ;
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        iconComponent: iconComponent,
        textColorClass: textColorClass,
        iconBgClass: iconBgClass,
        iconColorClass: iconColorClass,
        displayValue: displayValue,
        trendIcon: trendIcon,
        trendColorClass: trendColorClass,
        trendText: trendText,
    }),
    __typeProps: {},
    props: {},
});
export default (await import('vue')).defineComponent({
    __typeProps: {},
    props: {},
});
; /* PartiallyEnd: #4569/main.vue */

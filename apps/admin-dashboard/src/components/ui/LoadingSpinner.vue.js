import { computed } from "vue";
const props = withDefaults(defineProps(), {
    size: "md",
    color: "primary",
    text: "載入中...",
    showText: false,
    center: false,
    overlay: false,
});
// Computed classes
const spinnerClasses = computed(() => {
    const classes = [];
    if (props.center) {
        classes.push("spinner-center");
    }
    if (props.overlay) {
        classes.push("spinner-overlay");
    }
    if (props.showText) {
        classes.push("spinner-with-text");
    }
    return classes;
});
const sizeClasses = computed(() => {
    const sizeMap = {
        xs: "w-3 h-3",
        sm: "w-4 h-4",
        md: "w-6 h-6",
        lg: "w-8 h-8",
        xl: "w-12 h-12",
    };
    return sizeMap[props.size];
});
const textClasses = computed(() => {
    const colorMap = {
        primary: "text-blue-600",
        secondary: "text-gray-600",
        white: "text-white",
        gray: "text-gray-500",
        success: "text-green-600",
        error: "text-red-600",
        warning: "text-yellow-600",
    };
    const sizeMap = {
        xs: "text-xs",
        sm: "text-sm",
        md: "text-base",
        lg: "text-lg",
        xl: "text-xl",
    };
    return [colorMap[props.color], sizeMap[props.size]];
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    size: "md",
    color: "primary",
    text: "載入中...",
    showText: false,
    center: false,
    overlay: false,
});
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['spinner-with-text']} */ ;
/** @type {__VLS_StyleScopedClasses['spinner-svg']} */ ;
/** @type {__VLS_StyleScopedClasses['spinner-text']} */ ;
/** @type {__VLS_StyleScopedClasses['spinner-svg']} */ ;
/** @type {__VLS_StyleScopedClasses['spinner-svg']} */ ;
/** @type {__VLS_StyleScopedClasses['spinner-track']} */ ;
/** @type {__VLS_StyleScopedClasses['spinner-path']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['spinner-overlay']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['dots']} */ ;
/** @type {__VLS_StyleScopedClasses['spinner-svg']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['dots']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['dots']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['spinner-svg']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['pulse']} */ ;
/** @type {__VLS_StyleScopedClasses['spinner-track']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['pulse']} */ ;
/** @type {__VLS_StyleScopedClasses['spinner-path']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "loading-spinner" },
    ...{ class: (__VLS_ctx.spinnerClasses) },
});
// @ts-ignore
[spinnerClasses,];
__VLS_asFunctionalElement(__VLS_elements.svg, __VLS_elements.svg)({
    ...{ class: "spinner-svg" },
    ...{ class: (__VLS_ctx.sizeClasses) },
    fill: "none",
    viewBox: "0 0 24 24",
});
// @ts-ignore
[sizeClasses,];
__VLS_asFunctionalElement(__VLS_elements.circle)({
    ...{ class: "spinner-track" },
    cx: "12",
    cy: "12",
    r: "10",
    stroke: "currentColor",
    'stroke-width': "4",
});
__VLS_asFunctionalElement(__VLS_elements.path)({
    ...{ class: "spinner-path" },
    fill: "currentColor",
    d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z",
});
if (__VLS_ctx.showText) {
    // @ts-ignore
    [showText,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "spinner-text" },
        ...{ class: (__VLS_ctx.textClasses) },
    });
    // @ts-ignore
    [textClasses,];
    (__VLS_ctx.text);
    // @ts-ignore
    [text,];
}
/** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['spinner-svg']} */ ;
/** @type {__VLS_StyleScopedClasses['spinner-track']} */ ;
/** @type {__VLS_StyleScopedClasses['spinner-path']} */ ;
/** @type {__VLS_StyleScopedClasses['spinner-text']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        spinnerClasses: spinnerClasses,
        sizeClasses: sizeClasses,
        textClasses: textClasses,
    }),
    __typeProps: {},
    props: {},
});
export default (await import('vue')).defineComponent({
    __typeProps: {},
    props: {},
});
; /* PartiallyEnd: #4569/main.vue */

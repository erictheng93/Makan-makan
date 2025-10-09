import { computed } from "vue";
const props = withDefaults(defineProps(), {
    showDescriptions: true,
});
// Computed properties
const currentStepIndex = computed(() => props.steps.findIndex((step) => step.key === props.currentStep));
const currentStep = computed(() => props.steps[currentStepIndex.value]);
const progressPercentage = computed(() => {
    if (props.steps.length === 0)
        return 0;
    return Math.round(((currentStepIndex.value + 1) / props.steps.length) * 100);
});
// Step state helpers
const isStepCompleted = (index) => {
    return index < currentStepIndex.value;
};
const isStepCurrent = (index) => {
    return index === currentStepIndex.value;
};
const isStepPending = (index) => {
    return index > currentStepIndex.value;
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    showDescriptions: true,
});
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['step-item']} */ ;
/** @type {__VLS_StyleScopedClasses['step-title']} */ ;
/** @type {__VLS_StyleScopedClasses['step-title']} */ ;
/** @type {__VLS_StyleScopedClasses['step-title']} */ ;
/** @type {__VLS_StyleScopedClasses['step-current']} */ ;
/** @type {__VLS_StyleScopedClasses['step-description']} */ ;
/** @type {__VLS_StyleScopedClasses['step-item']} */ ;
/** @type {__VLS_StyleScopedClasses['step-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['step-title']} */ ;
/** @type {__VLS_StyleScopedClasses['step-description']} */ ;
/** @type {__VLS_StyleScopedClasses['step-content']} */ ;
/** @type {__VLS_StyleScopedClasses['steps-container']} */ ;
/** @type {__VLS_StyleScopedClasses['step-icon-completed']} */ ;
/** @type {__VLS_StyleScopedClasses['step-icon-current']} */ ;
/** @type {__VLS_StyleScopedClasses['step-item']} */ ;
/** @type {__VLS_StyleScopedClasses['step-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['step-pending']} */ ;
/** @type {__VLS_StyleScopedClasses['step-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['step-pending']} */ ;
/** @type {__VLS_StyleScopedClasses['step-title']} */ ;
/** @type {__VLS_StyleScopedClasses['step-icon-completed']} */ ;
/** @type {__VLS_StyleScopedClasses['step-icon-current']} */ ;
/** @type {__VLS_StyleScopedClasses['step-connector']} */ ;
/** @type {__VLS_StyleScopedClasses['step-pulse']} */ ;
/** @type {__VLS_StyleScopedClasses['progress-fill']} */ ;
/** @type {__VLS_StyleScopedClasses['step-icon-completed']} */ ;
/** @type {__VLS_StyleScopedClasses['step-icon-current']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "payment-steps" },
});
__VLS_asFunctionalElement(__VLS_elements.nav, __VLS_elements.nav)({
    ...{ class: "steps-container" },
    'aria-label': "Payment progress",
});
__VLS_asFunctionalElement(__VLS_elements.ol, __VLS_elements.ol)({
    ...{ class: "steps-list" },
});
for (const [step, index] of __VLS_getVForSourceType((__VLS_ctx.steps))) {
    // @ts-ignore
    [steps,];
    __VLS_asFunctionalElement(__VLS_elements.li, __VLS_elements.li)({
        key: (step.key),
        ...{ class: "step-item" },
        ...{ class: ({
                'step-completed': __VLS_ctx.isStepCompleted(index),
                'step-current': __VLS_ctx.isStepCurrent(index),
                'step-pending': __VLS_ctx.isStepPending(index),
            }) },
    });
    // @ts-ignore
    [isStepCompleted, isStepCurrent, isStepPending,];
    if (index < __VLS_ctx.steps.length - 1) {
        // @ts-ignore
        [steps,];
        __VLS_asFunctionalElement(__VLS_elements.div)({
            ...{ class: "step-connector" },
            ...{ class: ({
                    'connector-completed': __VLS_ctx.isStepCompleted(index),
                    'connector-pending': !__VLS_ctx.isStepCompleted(index),
                }) },
        });
        // @ts-ignore
        [isStepCompleted, isStepCompleted,];
    }
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "step-circle" },
    });
    if (__VLS_ctx.isStepCompleted(index)) {
        // @ts-ignore
        [isStepCompleted,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "step-icon step-icon-completed" },
        });
        __VLS_asFunctionalElement(__VLS_elements.svg, __VLS_elements.svg)({
            ...{ class: "w-4 h-4" },
            fill: "currentColor",
            viewBox: "0 0 20 20",
        });
        __VLS_asFunctionalElement(__VLS_elements.path)({
            'fill-rule': "evenodd",
            d: "M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z",
            'clip-rule': "evenodd",
        });
    }
    else if (__VLS_ctx.isStepCurrent(index)) {
        // @ts-ignore
        [isStepCurrent,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "step-icon step-icon-current" },
        });
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "step-number" },
        });
        (index + 1);
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "step-pulse" },
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "step-icon step-icon-pending" },
        });
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "step-number" },
        });
        (index + 1);
    }
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "step-content" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
        ...{ class: "step-title" },
    });
    (step.label);
    if (step.description) {
        __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
            ...{ class: "step-description" },
        });
        (step.description);
    }
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "progress-bar-mobile md:hidden" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "progress-track" },
});
__VLS_asFunctionalElement(__VLS_elements.div)({
    ...{ class: "progress-fill" },
    ...{ style: ({ width: `${__VLS_ctx.progressPercentage}%` }) },
});
// @ts-ignore
[progressPercentage,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "progress-text" },
});
(__VLS_ctx.currentStepIndex + 1);
(__VLS_ctx.steps.length);
(__VLS_ctx.currentStep?.label);
// @ts-ignore
[steps, currentStepIndex, currentStep,];
/** @type {__VLS_StyleScopedClasses['payment-steps']} */ ;
/** @type {__VLS_StyleScopedClasses['steps-container']} */ ;
/** @type {__VLS_StyleScopedClasses['steps-list']} */ ;
/** @type {__VLS_StyleScopedClasses['step-item']} */ ;
/** @type {__VLS_StyleScopedClasses['step-completed']} */ ;
/** @type {__VLS_StyleScopedClasses['step-current']} */ ;
/** @type {__VLS_StyleScopedClasses['step-pending']} */ ;
/** @type {__VLS_StyleScopedClasses['step-connector']} */ ;
/** @type {__VLS_StyleScopedClasses['connector-completed']} */ ;
/** @type {__VLS_StyleScopedClasses['connector-pending']} */ ;
/** @type {__VLS_StyleScopedClasses['step-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['step-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['step-icon-completed']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['step-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['step-icon-current']} */ ;
/** @type {__VLS_StyleScopedClasses['step-number']} */ ;
/** @type {__VLS_StyleScopedClasses['step-pulse']} */ ;
/** @type {__VLS_StyleScopedClasses['step-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['step-icon-pending']} */ ;
/** @type {__VLS_StyleScopedClasses['step-number']} */ ;
/** @type {__VLS_StyleScopedClasses['step-content']} */ ;
/** @type {__VLS_StyleScopedClasses['step-title']} */ ;
/** @type {__VLS_StyleScopedClasses['step-description']} */ ;
/** @type {__VLS_StyleScopedClasses['progress-bar-mobile']} */ ;
/** @type {__VLS_StyleScopedClasses['md:hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['progress-track']} */ ;
/** @type {__VLS_StyleScopedClasses['progress-fill']} */ ;
/** @type {__VLS_StyleScopedClasses['progress-text']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        currentStepIndex: currentStepIndex,
        currentStep: currentStep,
        progressPercentage: progressPercentage,
        isStepCompleted: isStepCompleted,
        isStepCurrent: isStepCurrent,
        isStepPending: isStepPending,
    }),
    __typeProps: {},
    props: {},
});
export default (await import('vue')).defineComponent({
    __typeProps: {},
    props: {},
});
; /* PartiallyEnd: #4569/main.vue */

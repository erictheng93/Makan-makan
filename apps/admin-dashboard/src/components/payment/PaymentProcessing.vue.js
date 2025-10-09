import { ref, onMounted, onUnmounted } from "vue";
const props = withDefaults(defineProps(), {
    retryDisabled: false,
});
const emit = defineEmits();
// Reactive state
const processingStep = ref(1);
const retrying = ref(false);
// Processing step animation
let stepInterval = null;
onMounted(() => {
    if (props.status === "processing") {
        startProcessingAnimation();
    }
});
onUnmounted(() => {
    if (stepInterval) {
        clearInterval(stepInterval);
    }
});
// Methods
const startProcessingAnimation = () => {
    processingStep.value = 1;
    stepInterval = setInterval(() => {
        processingStep.value =
            processingStep.value >= 3 ? 1 : processingStep.value + 1;
    }, 2000);
};
const handleRetry = async () => {
    retrying.value = true;
    try {
        emit("retry");
    }
    finally {
        // Reset retrying state after a short delay
        setTimeout(() => {
            retrying.value = false;
        }, 1000);
    }
};
const handleContinue = () => {
    emit("continue-shopping");
};
const handleViewOrder = () => {
    emit("view-order");
};
const handleCancel = () => {
    emit("cancel-order");
};
const handleContactSupport = () => {
    emit("contact-support");
};
const handleViewFaq = () => {
    // Open FAQ in new window
    window.open("/faq", "_blank");
};
const handleReturnToShopping = () => {
    emit("continue-shopping");
};
const formatDateTime = (date) => {
    return new Intl.DateTimeFormat("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(date);
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    retryDisabled: false,
});
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['cancelled-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['processing-step']} */ ;
/** @type {__VLS_StyleScopedClasses['processing-step']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['step-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['success-checkmark']} */ ;
/** @type {__VLS_StyleScopedClasses['error-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['cancelled-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['payment-processing']} */ ;
/** @type {__VLS_StyleScopedClasses['state-container']} */ ;
/** @type {__VLS_StyleScopedClasses['state-title']} */ ;
/** @type {__VLS_StyleScopedClasses['state-description']} */ ;
/** @type {__VLS_StyleScopedClasses['success-details']} */ ;
/** @type {__VLS_StyleScopedClasses['error-content']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['processing-spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['success-ring']} */ ;
/** @type {__VLS_StyleScopedClasses['success-checkmark']} */ ;
/** @type {__VLS_StyleScopedClasses['error-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['cancelled-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['processing-step']} */ ;
/** @type {__VLS_StyleScopedClasses['step-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "payment-processing" },
});
if (__VLS_ctx.status === 'processing') {
    // @ts-ignore
    [status,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "state-container processing-state" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "state-icon" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "processing-spinner" },
    });
    __VLS_asFunctionalElement(__VLS_elements.svg, __VLS_elements.svg)({
        ...{ class: "animate-spin h-16 w-16 text-blue-500" },
        fill: "none",
        viewBox: "0 0 24 24",
    });
    __VLS_asFunctionalElement(__VLS_elements.circle, __VLS_elements.circle)({
        ...{ class: "opacity-25" },
        cx: "12",
        cy: "12",
        r: "10",
        stroke: "currentColor",
        'stroke-width': "4",
    });
    __VLS_asFunctionalElement(__VLS_elements.path, __VLS_elements.path)({
        ...{ class: "opacity-75" },
        fill: "currentColor",
        d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z",
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "state-content" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h2, __VLS_elements.h2)({
        ...{ class: "state-title" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "state-description" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "processing-steps" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "processing-step" },
        ...{ class: ({ active: __VLS_ctx.processingStep >= 1 }) },
    });
    // @ts-ignore
    [processingStep,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "step-dot" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "processing-step" },
        ...{ class: ({ active: __VLS_ctx.processingStep >= 2 }) },
    });
    // @ts-ignore
    [processingStep,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "step-dot" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "processing-step" },
        ...{ class: ({ active: __VLS_ctx.processingStep >= 3 }) },
    });
    // @ts-ignore
    [processingStep,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "step-dot" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    if (__VLS_ctx.transactionId) {
        // @ts-ignore
        [transactionId,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "transaction-info" },
        });
        __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
            ...{ class: "transaction-label" },
        });
        __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
            ...{ class: "transaction-id" },
        });
        (__VLS_ctx.transactionId);
        // @ts-ignore
        [transactionId,];
    }
}
else if (__VLS_ctx.status === 'success') {
    // @ts-ignore
    [status,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "state-container success-state" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "state-icon" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "success-checkmark" },
    });
    __VLS_asFunctionalElement(__VLS_elements.svg, __VLS_elements.svg)({
        ...{ class: "h-16 w-16 text-green-500" },
        fill: "none",
        stroke: "currentColor",
        viewBox: "0 0 24 24",
    });
    __VLS_asFunctionalElement(__VLS_elements.path, __VLS_elements.path)({
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        'stroke-width': "2",
        d: "M5 13l4 4L19 7",
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "success-ring" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "state-content" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h2, __VLS_elements.h2)({
        ...{ class: "state-title text-green-700" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "state-description" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "success-details" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "detail-row" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "detail-label" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "detail-value font-mono" },
    });
    (__VLS_ctx.transactionId);
    // @ts-ignore
    [transactionId,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "detail-row" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "detail-label" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "detail-value" },
    });
    (__VLS_ctx.formatDateTime(new Date()));
    // @ts-ignore
    [formatDateTime,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "detail-row" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "detail-label" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "detail-value" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "status-badge success" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "success-actions" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.handleContinue) },
        ...{ class: "btn btn-primary" },
    });
    // @ts-ignore
    [handleContinue,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.handleViewOrder) },
        ...{ class: "btn btn-secondary" },
    });
    // @ts-ignore
    [handleViewOrder,];
}
else if (__VLS_ctx.status === 'error') {
    // @ts-ignore
    [status,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "state-container error-state" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "state-icon" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "error-icon" },
    });
    __VLS_asFunctionalElement(__VLS_elements.svg, __VLS_elements.svg)({
        ...{ class: "h-16 w-16 text-red-500" },
        fill: "none",
        stroke: "currentColor",
        viewBox: "0 0 24 24",
    });
    __VLS_asFunctionalElement(__VLS_elements.path, __VLS_elements.path)({
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        'stroke-width': "2",
        d: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "state-content" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h2, __VLS_elements.h2)({
        ...{ class: "state-title text-red-700" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "state-description" },
    });
    (__VLS_ctx.errorMessage ||
        "很抱歉，您的支付處理過程中遇到問題。請檢查支付信息後重試。");
    // @ts-ignore
    [errorMessage,];
    if (__VLS_ctx.errorDetails) {
        // @ts-ignore
        [errorDetails,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "error-details" },
        });
        __VLS_asFunctionalElement(__VLS_elements.details, __VLS_elements.details)({
            ...{ class: "error-accordion" },
        });
        __VLS_asFunctionalElement(__VLS_elements.summary, __VLS_elements.summary)({
            ...{ class: "error-summary" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "error-content" },
        });
        __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
            ...{ class: "error-code" },
        });
        (__VLS_ctx.errorDetails.code);
        // @ts-ignore
        [errorDetails,];
        __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
            ...{ class: "error-message" },
        });
        (__VLS_ctx.errorDetails.message);
        // @ts-ignore
        [errorDetails,];
    }
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "error-actions" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.handleRetry) },
        ...{ class: "btn btn-primary" },
        disabled: (__VLS_ctx.retryDisabled),
    });
    // @ts-ignore
    [handleRetry, retryDisabled,];
    if (__VLS_ctx.retrying) {
        // @ts-ignore
        [retrying,];
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "btn-loading" },
        });
        __VLS_asFunctionalElement(__VLS_elements.svg, __VLS_elements.svg)({
            ...{ class: "animate-spin -ml-1 mr-2 h-4 w-4" },
            fill: "none",
            viewBox: "0 0 24 24",
        });
        __VLS_asFunctionalElement(__VLS_elements.circle, __VLS_elements.circle)({
            ...{ class: "opacity-25" },
            cx: "12",
            cy: "12",
            r: "10",
            stroke: "currentColor",
            'stroke-width': "4",
        });
        __VLS_asFunctionalElement(__VLS_elements.path, __VLS_elements.path)({
            ...{ class: "opacity-75" },
            fill: "currentColor",
            d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z",
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    }
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.handleCancel) },
        ...{ class: "btn btn-secondary" },
    });
    // @ts-ignore
    [handleCancel,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "help-links" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "help-text" },
    });
    __VLS_asFunctionalElement(__VLS_elements.a, __VLS_elements.a)({
        ...{ onClick: (__VLS_ctx.handleContactSupport) },
        href: "#",
        ...{ class: "help-link" },
    });
    // @ts-ignore
    [handleContactSupport,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "help-divider" },
    });
    __VLS_asFunctionalElement(__VLS_elements.a, __VLS_elements.a)({
        ...{ onClick: (__VLS_ctx.handleViewFaq) },
        href: "#",
        ...{ class: "help-link" },
    });
    // @ts-ignore
    [handleViewFaq,];
}
else if (__VLS_ctx.status === 'cancelled') {
    // @ts-ignore
    [status,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "state-container cancelled-state" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "state-icon" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "cancelled-icon" },
    });
    __VLS_asFunctionalElement(__VLS_elements.svg, __VLS_elements.svg)({
        ...{ class: "h-16 w-16 text-gray-400" },
        fill: "none",
        stroke: "currentColor",
        viewBox: "0 0 24 24",
    });
    __VLS_asFunctionalElement(__VLS_elements.path, __VLS_elements.path)({
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        'stroke-width': "2",
        d: "M6 18L18 6M6 6l12 12",
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "state-content" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h2, __VLS_elements.h2)({
        ...{ class: "state-title text-gray-700" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "state-description" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "cancelled-actions" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.handleReturnToShopping) },
        ...{ class: "btn btn-primary" },
    });
    // @ts-ignore
    [handleReturnToShopping,];
}
/** @type {__VLS_StyleScopedClasses['payment-processing']} */ ;
/** @type {__VLS_StyleScopedClasses['state-container']} */ ;
/** @type {__VLS_StyleScopedClasses['processing-state']} */ ;
/** @type {__VLS_StyleScopedClasses['state-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['processing-spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['h-16']} */ ;
/** @type {__VLS_StyleScopedClasses['w-16']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-25']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-75']} */ ;
/** @type {__VLS_StyleScopedClasses['state-content']} */ ;
/** @type {__VLS_StyleScopedClasses['state-title']} */ ;
/** @type {__VLS_StyleScopedClasses['state-description']} */ ;
/** @type {__VLS_StyleScopedClasses['processing-steps']} */ ;
/** @type {__VLS_StyleScopedClasses['processing-step']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['step-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['processing-step']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['step-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['processing-step']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['step-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['transaction-info']} */ ;
/** @type {__VLS_StyleScopedClasses['transaction-label']} */ ;
/** @type {__VLS_StyleScopedClasses['transaction-id']} */ ;
/** @type {__VLS_StyleScopedClasses['state-container']} */ ;
/** @type {__VLS_StyleScopedClasses['success-state']} */ ;
/** @type {__VLS_StyleScopedClasses['state-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['success-checkmark']} */ ;
/** @type {__VLS_StyleScopedClasses['h-16']} */ ;
/** @type {__VLS_StyleScopedClasses['w-16']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-500']} */ ;
/** @type {__VLS_StyleScopedClasses['success-ring']} */ ;
/** @type {__VLS_StyleScopedClasses['state-content']} */ ;
/** @type {__VLS_StyleScopedClasses['state-title']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-700']} */ ;
/** @type {__VLS_StyleScopedClasses['state-description']} */ ;
/** @type {__VLS_StyleScopedClasses['success-details']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-row']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-label']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-value']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-row']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-label']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-value']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-row']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-label']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-value']} */ ;
/** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['success']} */ ;
/** @type {__VLS_StyleScopedClasses['success-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['state-container']} */ ;
/** @type {__VLS_StyleScopedClasses['error-state']} */ ;
/** @type {__VLS_StyleScopedClasses['state-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['error-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['h-16']} */ ;
/** @type {__VLS_StyleScopedClasses['w-16']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-500']} */ ;
/** @type {__VLS_StyleScopedClasses['state-content']} */ ;
/** @type {__VLS_StyleScopedClasses['state-title']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-700']} */ ;
/** @type {__VLS_StyleScopedClasses['state-description']} */ ;
/** @type {__VLS_StyleScopedClasses['error-details']} */ ;
/** @type {__VLS_StyleScopedClasses['error-accordion']} */ ;
/** @type {__VLS_StyleScopedClasses['error-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['error-content']} */ ;
/** @type {__VLS_StyleScopedClasses['error-code']} */ ;
/** @type {__VLS_StyleScopedClasses['error-message']} */ ;
/** @type {__VLS_StyleScopedClasses['error-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-loading']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['-ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-25']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-75']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['help-links']} */ ;
/** @type {__VLS_StyleScopedClasses['help-text']} */ ;
/** @type {__VLS_StyleScopedClasses['help-link']} */ ;
/** @type {__VLS_StyleScopedClasses['help-divider']} */ ;
/** @type {__VLS_StyleScopedClasses['help-link']} */ ;
/** @type {__VLS_StyleScopedClasses['state-container']} */ ;
/** @type {__VLS_StyleScopedClasses['cancelled-state']} */ ;
/** @type {__VLS_StyleScopedClasses['state-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['cancelled-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['h-16']} */ ;
/** @type {__VLS_StyleScopedClasses['w-16']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['state-content']} */ ;
/** @type {__VLS_StyleScopedClasses['state-title']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['state-description']} */ ;
/** @type {__VLS_StyleScopedClasses['cancelled-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        processingStep: processingStep,
        retrying: retrying,
        handleRetry: handleRetry,
        handleContinue: handleContinue,
        handleViewOrder: handleViewOrder,
        handleCancel: handleCancel,
        handleContactSupport: handleContactSupport,
        handleViewFaq: handleViewFaq,
        handleReturnToShopping: handleReturnToShopping,
        formatDateTime: formatDateTime,
    }),
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
export default (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
; /* PartiallyEnd: #4569/main.vue */

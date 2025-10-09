import { ref, computed, onMounted, watch } from "vue";
import { usePaymentStore } from "@/stores/payment";
// 組件引入
import PaymentSteps from "./PaymentSteps.vue";
import PaymentMethodSelector from "./PaymentMethodSelector.vue";
import StripeCardElement from "./StripeCardElement.vue";
import BankTransferInfo from "./BankTransferInfo.vue";
import PaymentProcessing from "./PaymentProcessing.vue";
import OrderSummary from "./OrderSummary.vue";
import LoadingSpinner from "@/components/ui/LoadingSpinner.vue";
const props = withDefaults(defineProps(), {
    autoStart: true,
});
const emit = defineEmits();
// Composables
const paymentStore = usePaymentStore();
// Stripe 配置
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "pk_test_default";
// 響應式狀態
const currentStep = ref("method");
const selectedPaymentMethod = ref();
const processingPayment = ref(false);
const clientSecret = ref("");
const transactionId = ref("");
const paymentStatus = ref("processing");
// 表單資料
const customerInfo = ref({
    name: "",
    email: "",
    phone: "",
});
// 錯誤狀態
const errors = ref({});
// 載入狀態
const loadingMethods = ref(false);
const loadingOrder = ref(false);
// 計算屬性
const paymentSteps = computed(() => [
    { key: "method", label: "選擇支付方式", icon: "credit-card" },
    { key: "details", label: "填寫資訊", icon: "edit" },
    { key: "processing", label: "處理付款", icon: "clock" },
]);
const paymentRequest = computed(() => ({
    orderId: props.orderId,
    restaurantId: props.restaurantId,
    country: props.country,
    currency: props.currency,
    amount: props.amount,
    method: selectedPaymentMethod.value || "credit_card",
    customerInfo: {
        name: customerInfo.value.name,
        email: customerInfo.value.email,
        phone: customerInfo.value.phone || undefined,
    },
}));
const availablePaymentMethods = computed(() => paymentStore.getAvailableMethodsForCountry(props.country));
const orderDetails = computed(() => ({
    id: props.orderId,
    restaurantId: props.restaurantId,
    country: props.country,
    currency: props.currency,
    subtotal: props.amount,
    total: props.amount,
    items: [], // 這裡應該從 props 或 API 獲取
    tax: 0,
}));
const canProceedToPayment = computed(() => {
    return (customerInfo.value.name &&
        customerInfo.value.email &&
        isValidEmail(customerInfo.value.email) &&
        selectedPaymentMethod.value);
});
const phonePlaceholder = computed(() => {
    const placeholders = {
        TW: "+886 912 345 678",
        MY: "+60 12 345 6789",
        VN: "+84 987 654 321",
    };
    return placeholders[props.country] || "+1 234 567 890";
});
// 方法
const handleMethodSelected = (method) => {
    selectedPaymentMethod.value = method;
};
const proceedToDetails = () => {
    currentStep.value = "details";
    emit("step-change", "details");
};
const goBack = () => {
    if (currentStep.value === "details") {
        currentStep.value = "method";
    }
    emit("step-change", currentStep.value);
};
const processPayment = async () => {
    if (!validateForm())
        return;
    processingPayment.value = true;
    currentStep.value = "processing";
    paymentStatus.value = "processing";
    try {
        const result = await paymentStore.createPayment(paymentRequest.value);
        if (result.success) {
            transactionId.value = result.transactionId;
            clientSecret.value = result.clientSecret || "";
            if (result.status === "completed") {
                paymentStatus.value = "success";
                emit("payment-success", result.transactionId);
            }
            else if (result.redirectUrl) {
                // 重定向到第三方支付
                window.location.href = result.redirectUrl;
            }
        }
        else {
            paymentStatus.value = "error";
            emit("payment-error", result.error?.message || "支付處理失敗");
        }
    }
    catch (error) {
        console.error("Payment processing error:", error);
        paymentStatus.value = "error";
        emit("payment-error", "支付過程中發生錯誤");
    }
    finally {
        processingPayment.value = false;
    }
};
const handlePaymentSuccess = (data) => {
    paymentStatus.value = "success";
    emit("payment-success", data.transactionId);
};
const handlePaymentError = (error) => {
    paymentStatus.value = "error";
    emit("payment-error", error);
};
const retryPayment = () => {
    paymentStatus.value = "processing";
    processPayment();
};
const closePayment = () => {
    emit("payment-cancel");
};
const validateForm = () => {
    errors.value = {};
    if (!customerInfo.value.name.trim()) {
        errors.value.name = "請輸入姓名";
    }
    if (!customerInfo.value.email.trim()) {
        errors.value.email = "請輸入電子郵件";
    }
    else if (!isValidEmail(customerInfo.value.email)) {
        errors.value.email = "請輸入有效的電子郵件格式";
    }
    return Object.keys(errors.value).length === 0;
};
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};
const formatAmount = (amount, currency) => {
    return paymentStore.formatAmount(amount, currency);
};
// 載入可用的支付方式
const loadPaymentMethods = async () => {
    loadingMethods.value = true;
    try {
        await paymentStore.loadPaymentMethods(props.country);
    }
    catch (error) {
        console.error("Failed to load payment methods:", error);
    }
    finally {
        loadingMethods.value = false;
    }
};
// 載入訂單詳情
const loadOrderDetails = async () => {
    loadingOrder.value = true;
    try {
        // TODO: 從 API 載入訂單詳情
        // const order = await orderApi.getOrder(props.orderId)
    }
    catch (error) {
        console.error("Failed to load order details:", error);
    }
    finally {
        loadingOrder.value = false;
    }
};
// 生命週期
onMounted(async () => {
    await Promise.all([loadPaymentMethods(), loadOrderDetails()]);
    if (props.autoStart && availablePaymentMethods.value.length === 1) {
        selectedPaymentMethod.value = availablePaymentMethods.value[0];
        proceedToDetails();
    }
});
// 監聽步驟變化
watch(currentStep, (newStep) => {
    emit("step-change", newStep);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    autoStart: true,
});
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['field-input']} */ ;
/** @type {__VLS_StyleScopedClasses['step-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['payment-form']} */ ;
/** @type {__VLS_StyleScopedClasses['step-content']} */ ;
/** @type {__VLS_StyleScopedClasses['form-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['step-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['step-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['step-content']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "payment-form" },
});
/** @type {[typeof PaymentSteps, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(PaymentSteps, new PaymentSteps({
    currentStep: (__VLS_ctx.currentStep),
    steps: (__VLS_ctx.paymentSteps),
    ...{ class: "mb-8" },
}));
const __VLS_1 = __VLS_0({
    currentStep: (__VLS_ctx.currentStep),
    steps: (__VLS_ctx.paymentSteps),
    ...{ class: "mb-8" },
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
// @ts-ignore
[currentStep, paymentSteps,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "payment-container" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "payment-content" },
});
if (__VLS_ctx.currentStep === 'method') {
    // @ts-ignore
    [currentStep,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "step-content" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "step-header" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h2, __VLS_elements.h2)({
        ...{ class: "step-title" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "step-description" },
    });
    /** @type {[typeof PaymentMethodSelector, ]} */ ;
    // @ts-ignore
    const __VLS_4 = __VLS_asFunctionalComponent(PaymentMethodSelector, new PaymentMethodSelector({
        ...{ 'onMethodSelected': {} },
        modelValue: (__VLS_ctx.selectedPaymentMethod),
        availableMethods: (__VLS_ctx.availablePaymentMethods),
        country: (__VLS_ctx.country),
        loading: (__VLS_ctx.loadingMethods),
    }));
    const __VLS_5 = __VLS_4({
        ...{ 'onMethodSelected': {} },
        modelValue: (__VLS_ctx.selectedPaymentMethod),
        availableMethods: (__VLS_ctx.availablePaymentMethods),
        country: (__VLS_ctx.country),
        loading: (__VLS_ctx.loadingMethods),
    }, ...__VLS_functionalComponentArgsRest(__VLS_4));
    let __VLS_7;
    let __VLS_8;
    const __VLS_9 = ({ methodSelected: {} },
        { onMethodSelected: (__VLS_ctx.handleMethodSelected) });
    // @ts-ignore
    [selectedPaymentMethod, availablePaymentMethods, country, loadingMethods, handleMethodSelected,];
    var __VLS_6;
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "step-actions" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.proceedToDetails) },
        ...{ class: "btn btn-primary btn-large" },
        disabled: (!__VLS_ctx.selectedPaymentMethod),
    });
    // @ts-ignore
    [selectedPaymentMethod, proceedToDetails,];
}
else if (__VLS_ctx.currentStep === 'details') {
    // @ts-ignore
    [currentStep,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "step-content" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "step-header" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h2, __VLS_elements.h2)({
        ...{ class: "step-title" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "step-description" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "form-section" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
        ...{ class: "section-title" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "form-grid" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "form-field" },
    });
    __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
        for: "customer-name",
        ...{ class: "field-label" },
    });
    __VLS_asFunctionalElement(__VLS_elements.input)({
        id: "customer-name",
        value: (__VLS_ctx.customerInfo.name),
        type: "text",
        ...{ class: "field-input" },
        placeholder: "請輸入您的姓名",
        ...{ class: ({ 'field-error': __VLS_ctx.errors.name }) },
    });
    // @ts-ignore
    [customerInfo, errors,];
    if (__VLS_ctx.errors.name) {
        // @ts-ignore
        [errors,];
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "error-message" },
        });
        (__VLS_ctx.errors.name);
        // @ts-ignore
        [errors,];
    }
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "form-field" },
    });
    __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
        for: "customer-email",
        ...{ class: "field-label" },
    });
    __VLS_asFunctionalElement(__VLS_elements.input)({
        id: "customer-email",
        type: "email",
        ...{ class: "field-input" },
        placeholder: "example@email.com",
        ...{ class: ({ 'field-error': __VLS_ctx.errors.email }) },
    });
    (__VLS_ctx.customerInfo.email);
    // @ts-ignore
    [customerInfo, errors,];
    if (__VLS_ctx.errors.email) {
        // @ts-ignore
        [errors,];
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "error-message" },
        });
        (__VLS_ctx.errors.email);
        // @ts-ignore
        [errors,];
    }
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "form-field" },
    });
    __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
        for: "customer-phone",
        ...{ class: "field-label" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "field-optional" },
    });
    __VLS_asFunctionalElement(__VLS_elements.input)({
        id: "customer-phone",
        type: "tel",
        ...{ class: "field-input" },
        placeholder: (__VLS_ctx.phonePlaceholder),
    });
    (__VLS_ctx.customerInfo.phone);
    // @ts-ignore
    [customerInfo, phonePlaceholder,];
    if (__VLS_ctx.selectedPaymentMethod === 'credit_card') {
        // @ts-ignore
        [selectedPaymentMethod,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "form-section" },
        });
        __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
            ...{ class: "section-title" },
        });
        /** @type {[typeof StripeCardElement, ]} */ ;
        // @ts-ignore
        const __VLS_11 = __VLS_asFunctionalComponent(StripeCardElement, new StripeCardElement({
            ...{ 'onPaymentSuccess': {} },
            ...{ 'onPaymentError': {} },
            clientSecret: (__VLS_ctx.clientSecret),
            publishableKey: (__VLS_ctx.stripePublishableKey),
            amount: (__VLS_ctx.amount),
            currency: (__VLS_ctx.currency),
            country: (__VLS_ctx.country),
            loading: (__VLS_ctx.processingPayment),
        }));
        const __VLS_12 = __VLS_11({
            ...{ 'onPaymentSuccess': {} },
            ...{ 'onPaymentError': {} },
            clientSecret: (__VLS_ctx.clientSecret),
            publishableKey: (__VLS_ctx.stripePublishableKey),
            amount: (__VLS_ctx.amount),
            currency: (__VLS_ctx.currency),
            country: (__VLS_ctx.country),
            loading: (__VLS_ctx.processingPayment),
        }, ...__VLS_functionalComponentArgsRest(__VLS_11));
        let __VLS_14;
        let __VLS_15;
        const __VLS_16 = ({ paymentSuccess: {} },
            { onPaymentSuccess: (__VLS_ctx.handlePaymentSuccess) });
        const __VLS_17 = ({ paymentError: {} },
            { onPaymentError: (__VLS_ctx.handlePaymentError) });
        // @ts-ignore
        [country, clientSecret, stripePublishableKey, amount, currency, processingPayment, handlePaymentSuccess, handlePaymentError,];
        var __VLS_13;
    }
    else if (__VLS_ctx.selectedPaymentMethod === 'bank_transfer') {
        // @ts-ignore
        [selectedPaymentMethod,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "form-section" },
        });
        __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
            ...{ class: "section-title" },
        });
        /** @type {[typeof BankTransferInfo, ]} */ ;
        // @ts-ignore
        const __VLS_19 = __VLS_asFunctionalComponent(BankTransferInfo, new BankTransferInfo({
            country: (__VLS_ctx.paymentRequest.country),
        }));
        const __VLS_20 = __VLS_19({
            country: (__VLS_ctx.paymentRequest.country),
        }, ...__VLS_functionalComponentArgsRest(__VLS_19));
        // @ts-ignore
        [paymentRequest,];
    }
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "step-actions" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.goBack) },
        ...{ class: "btn btn-secondary" },
    });
    // @ts-ignore
    [goBack,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.processPayment) },
        ...{ class: "btn btn-primary btn-large" },
        disabled: (!__VLS_ctx.canProceedToPayment || __VLS_ctx.processingPayment),
    });
    // @ts-ignore
    [processingPayment, processPayment, canProceedToPayment,];
    if (__VLS_ctx.processingPayment) {
        // @ts-ignore
        [processingPayment,];
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "btn-loading" },
        });
        /** @type {[typeof LoadingSpinner, ]} */ ;
        // @ts-ignore
        const __VLS_23 = __VLS_asFunctionalComponent(LoadingSpinner, new LoadingSpinner({
            size: "sm",
        }));
        const __VLS_24 = __VLS_23({
            size: "sm",
        }, ...__VLS_functionalComponentArgsRest(__VLS_23));
    }
    else {
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
        (__VLS_ctx.formatAmount(__VLS_ctx.paymentRequest.amount, __VLS_ctx.paymentRequest.currency));
        // @ts-ignore
        [paymentRequest, paymentRequest, formatAmount,];
    }
}
else if (__VLS_ctx.currentStep === 'processing') {
    // @ts-ignore
    [currentStep,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "step-content" },
    });
    /** @type {[typeof PaymentProcessing, ]} */ ;
    // @ts-ignore
    const __VLS_27 = __VLS_asFunctionalComponent(PaymentProcessing, new PaymentProcessing({
        ...{ 'onRetry': {} },
        ...{ 'onClose': {} },
        status: (__VLS_ctx.paymentStatus),
        transactionId: (__VLS_ctx.transactionId),
    }));
    const __VLS_28 = __VLS_27({
        ...{ 'onRetry': {} },
        ...{ 'onClose': {} },
        status: (__VLS_ctx.paymentStatus),
        transactionId: (__VLS_ctx.transactionId),
    }, ...__VLS_functionalComponentArgsRest(__VLS_27));
    let __VLS_30;
    let __VLS_31;
    const __VLS_32 = ({ retry: {} },
        { onRetry: (__VLS_ctx.retryPayment) });
    const __VLS_33 = ({ close: {} },
        { onClose: (__VLS_ctx.closePayment) });
    // @ts-ignore
    [paymentStatus, transactionId, retryPayment, closePayment,];
    var __VLS_29;
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "payment-sidebar" },
});
/** @type {[typeof OrderSummary, ]} */ ;
// @ts-ignore
const __VLS_35 = __VLS_asFunctionalComponent(OrderSummary, new OrderSummary({
    order: (__VLS_ctx.orderDetails),
    loading: (__VLS_ctx.loadingOrder),
    showBreakdown: (true),
}));
const __VLS_36 = __VLS_35({
    order: (__VLS_ctx.orderDetails),
    loading: (__VLS_ctx.loadingOrder),
    showBreakdown: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_35));
// @ts-ignore
[orderDetails, loadingOrder,];
/** @type {__VLS_StyleScopedClasses['payment-form']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-8']} */ ;
/** @type {__VLS_StyleScopedClasses['payment-container']} */ ;
/** @type {__VLS_StyleScopedClasses['payment-content']} */ ;
/** @type {__VLS_StyleScopedClasses['step-content']} */ ;
/** @type {__VLS_StyleScopedClasses['step-header']} */ ;
/** @type {__VLS_StyleScopedClasses['step-title']} */ ;
/** @type {__VLS_StyleScopedClasses['step-description']} */ ;
/** @type {__VLS_StyleScopedClasses['step-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-large']} */ ;
/** @type {__VLS_StyleScopedClasses['step-content']} */ ;
/** @type {__VLS_StyleScopedClasses['step-header']} */ ;
/** @type {__VLS_StyleScopedClasses['step-title']} */ ;
/** @type {__VLS_StyleScopedClasses['step-description']} */ ;
/** @type {__VLS_StyleScopedClasses['form-section']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['form-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['field-label']} */ ;
/** @type {__VLS_StyleScopedClasses['field-input']} */ ;
/** @type {__VLS_StyleScopedClasses['field-error']} */ ;
/** @type {__VLS_StyleScopedClasses['error-message']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['field-label']} */ ;
/** @type {__VLS_StyleScopedClasses['field-input']} */ ;
/** @type {__VLS_StyleScopedClasses['field-error']} */ ;
/** @type {__VLS_StyleScopedClasses['error-message']} */ ;
/** @type {__VLS_StyleScopedClasses['form-field']} */ ;
/** @type {__VLS_StyleScopedClasses['field-label']} */ ;
/** @type {__VLS_StyleScopedClasses['field-optional']} */ ;
/** @type {__VLS_StyleScopedClasses['field-input']} */ ;
/** @type {__VLS_StyleScopedClasses['form-section']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['form-section']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['step-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-large']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-loading']} */ ;
/** @type {__VLS_StyleScopedClasses['step-content']} */ ;
/** @type {__VLS_StyleScopedClasses['payment-sidebar']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        PaymentSteps: PaymentSteps,
        PaymentMethodSelector: PaymentMethodSelector,
        StripeCardElement: StripeCardElement,
        BankTransferInfo: BankTransferInfo,
        PaymentProcessing: PaymentProcessing,
        OrderSummary: OrderSummary,
        LoadingSpinner: LoadingSpinner,
        stripePublishableKey: stripePublishableKey,
        currentStep: currentStep,
        selectedPaymentMethod: selectedPaymentMethod,
        processingPayment: processingPayment,
        clientSecret: clientSecret,
        transactionId: transactionId,
        paymentStatus: paymentStatus,
        customerInfo: customerInfo,
        errors: errors,
        loadingMethods: loadingMethods,
        loadingOrder: loadingOrder,
        paymentSteps: paymentSteps,
        paymentRequest: paymentRequest,
        availablePaymentMethods: availablePaymentMethods,
        orderDetails: orderDetails,
        canProceedToPayment: canProceedToPayment,
        phonePlaceholder: phonePlaceholder,
        handleMethodSelected: handleMethodSelected,
        proceedToDetails: proceedToDetails,
        goBack: goBack,
        processPayment: processPayment,
        handlePaymentSuccess: handlePaymentSuccess,
        handlePaymentError: handlePaymentError,
        retryPayment: retryPayment,
        closePayment: closePayment,
        formatAmount: formatAmount,
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

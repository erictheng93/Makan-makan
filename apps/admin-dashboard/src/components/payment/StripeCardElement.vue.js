import { ref, onMounted, onUnmounted, watch, computed } from "vue";
import { loadStripe, } from "@stripe/stripe-js";
import { ExclamationCircleIcon, LockClosedIcon, CreditCardIcon, ChevronDownIcon, } from "@heroicons/vue/24/outline";
import ShieldCheckIcon from "@heroicons/vue/24/outline/ShieldCheckIcon";
import LoadingSpinner from "@/components/ui/LoadingSpinner.vue";
const props = withDefaults(defineProps(), {
    appearance: "default",
    loading: false,
    showPayButton: true,
});
const emit = defineEmits();
// Stripe 實例
let stripe = null;
let elements = null;
let cardElement = null;
// 響應式狀態
const cardElementRef = ref();
const stripeElementReady = ref(false);
const isCardFocused = ref(false);
const isCardComplete = ref(false);
const cardError = ref("");
const isProcessing = ref(false);
const show3DSecure = ref(false);
const showTestCards = ref(false);
// 計算屬性
const formatAmount = computed(() => {
    const formatter = new Intl.NumberFormat("zh-TW", {
        style: "currency",
        currency: props.currency,
        minimumFractionDigits: props.currency === "TWD" || props.currency === "VND" ? 0 : 2,
    });
    return formatter.format(props.amount);
});
const canPay = computed(() => {
    return (stripeElementReady.value &&
        isCardComplete.value &&
        !cardError.value &&
        !props.loading);
});
const isDevelopment = computed(() => {
    return process.env.NODE_ENV === "development";
});
// 測試卡片資料
const testCards = [
    {
        number: "4242 4242 4242 4242",
        expiry: "12/34",
        cvc: "123",
        description: "成功支付 (Visa)",
    },
    {
        number: "4000 0000 0000 0002",
        expiry: "12/34",
        cvc: "123",
        description: "卡片被拒絕",
    },
    {
        number: "4000 0000 0000 9995",
        expiry: "12/34",
        cvc: "123",
        description: "餘額不足",
    },
    {
        number: "4000 0025 0000 3155",
        expiry: "12/34",
        cvc: "123",
        description: "需要 3D Secure",
    },
];
// Stripe 外觀主題
const getStripeTheme = () => {
    return {
        theme: "stripe",
        variables: {
            colorPrimary: "#3b82f6",
            colorBackground: "#ffffff",
            colorText: "#1f2937",
            colorDanger: "#ef4444",
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            spacingUnit: "6px",
            borderRadius: "12px",
        },
        rules: {
            ".Input": {
                padding: "12px 16px",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                backgroundColor: "#ffffff",
                fontSize: "16px",
                transition: "border-color 0.2s, box-shadow 0.2s",
            },
            ".Input:focus": {
                borderColor: "#3b82f6",
                boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)",
            },
            ".Input--invalid": {
                borderColor: "#ef4444",
            },
            ".Input--complete": {
                borderColor: "#10b981",
            },
        },
    };
};
// 初始化 Stripe
const initializeStripe = async () => {
    try {
        stripe = await loadStripe(props.publishableKey);
        if (!stripe) {
            throw new Error("Failed to load Stripe");
        }
        elements = stripe.elements({
            appearance: getStripeTheme(),
            clientSecret: props.clientSecret,
        });
        cardElement = elements.create("card", {
            style: {
                base: {
                    fontSize: "16px",
                    color: "#1f2937",
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    "::placeholder": {
                        color: "#9ca3af",
                    },
                },
                invalid: {
                    color: "#ef4444",
                    iconColor: "#ef4444",
                },
                complete: {
                    color: "#10b981",
                    iconColor: "#10b981",
                },
            },
            hidePostalCode: true, // 隱藏郵遞區號欄位
        });
        // 掛載 Card Element
        if (cardElementRef.value) {
            cardElement.mount(cardElementRef.value);
        }
        // 監聽 Card Element 事件
        cardElement.on("ready", () => {
            stripeElementReady.value = true;
            emit("element-ready");
        });
        cardElement.on("focus", () => {
            isCardFocused.value = true;
        });
        cardElement.on("blur", () => {
            isCardFocused.value = false;
        });
        cardElement.on("change", (event) => {
            isCardComplete.value = event.complete;
            cardError.value = event.error?.message || "";
            emit("card-change", {
                complete: event.complete,
                error: event.error?.message,
            });
        });
    }
    catch (error) {
        console.error("Stripe initialization error:", error);
        emit("payment-error", "Failed to initialize payment system");
    }
};
// 處理支付
const handlePayment = async () => {
    if (!stripe || !cardElement || !props.clientSecret) {
        emit("payment-error", "Payment system not ready");
        return;
    }
    isProcessing.value = true;
    emit("payment-processing", true);
    try {
        const { error, paymentIntent } = await stripe.confirmCardPayment(props.clientSecret, {
            payment_method: {
                card: cardElement,
                billing_details: {
                    email: props.customerEmail,
                },
            },
        });
        if (error) {
            // 處理特定錯誤
            if (error.code === "card_declined") {
                cardError.value = "您的卡片被拒絕，請嘗試其他卡片或聯繫銀行";
            }
            else if (error.code === "expired_card") {
                cardError.value = "卡片已過期，請使用有效卡片";
            }
            else if (error.code === "insufficient_funds") {
                cardError.value = "卡片餘額不足，請使用其他支付方式";
            }
            else if (error.code === "incorrect_cvc") {
                cardError.value = "CVC 安全碼錯誤，請重新輸入";
            }
            else {
                cardError.value = error.message || "支付處理失敗";
            }
            emit("payment-error", cardError.value);
        }
        else if (paymentIntent?.status === "succeeded") {
            emit("payment-success", {
                transactionId: paymentIntent.id,
                paymentMethod: paymentIntent.payment_method,
            });
        }
        else if (paymentIntent?.status === "requires_action") {
            show3DSecure.value = true;
            // Stripe 會自動處理 3D Secure，這裡只是顯示 UI
        }
    }
    catch (error) {
        console.error("Payment error:", error);
        emit("payment-error", "支付過程中發生錯誤，請重試");
    }
    finally {
        isProcessing.value = false;
        show3DSecure.value = false;
        emit("payment-processing", false);
    }
};
// 填入測試卡片資料
const fillTestCard = (testCard) => {
    if (cardElement) {
        // 注意: Stripe Elements 不支援程式化填入資料
        // 這裡只是提供測試卡片號碼給開發者參考
        navigator.clipboard.writeText(testCard.number.replace(/\s/g, ""));
        alert(`測試卡片號碼已複製到剪貼板: ${testCard.number}`);
    }
};
// 監聽 props 變化
watch(() => props.clientSecret, (newSecret) => {
    if (newSecret && stripe && elements) {
        // 重新初始化 elements 以使用新的 clientSecret
        elements.update({ clientSecret: newSecret });
    }
});
watch(() => props.loading, (isLoading) => {
    if (isLoading) {
        cardError.value = "";
    }
});
// 生命週期
onMounted(() => {
    initializeStripe();
});
onUnmounted(() => {
    if (cardElement) {
        cardElement.destroy();
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    appearance: "default",
    loading: false,
    showPayButton: true,
});
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['skeleton-line']} */ ;
/** @type {__VLS_StyleScopedClasses['stripe-card-field']} */ ;
/** @type {__VLS_StyleScopedClasses['stripe-card-field']} */ ;
/** @type {__VLS_StyleScopedClasses['stripe-card-field']} */ ;
/** @type {__VLS_StyleScopedClasses['stripe-card-field']} */ ;
/** @type {__VLS_StyleScopedClasses['card-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['card-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['card-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['card-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['verification-header']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['pay-button']} */ ;
/** @type {__VLS_StyleScopedClasses['accepted-cards']} */ ;
/** @type {__VLS_StyleScopedClasses['card-icons']} */ ;
/** @type {__VLS_StyleScopedClasses['stripe-card-field']} */ ;
/** @type {__VLS_StyleScopedClasses['skeleton-line']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "stripe-card-element" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "card-element-container" },
});
if (!__VLS_ctx.stripeElementReady) {
    // @ts-ignore
    [stripeElementReady,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "element-loading" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "loading-skeleton" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "skeleton-line" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "skeleton-grid" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "skeleton-line short" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "skeleton-line short" },
    });
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ref: "cardElementRef",
    ...{ class: "stripe-card-field" },
    ...{ class: ({
            'field-ready': __VLS_ctx.stripeElementReady,
            'field-focused': __VLS_ctx.isCardFocused,
            'field-complete': __VLS_ctx.isCardComplete,
            'field-error': __VLS_ctx.cardError,
        }) },
});
/** @type {typeof __VLS_ctx.cardElementRef} */ ;
// @ts-ignore
[stripeElementReady, isCardFocused, isCardComplete, cardError, cardElementRef,];
if (__VLS_ctx.cardError) {
    // @ts-ignore
    [cardError,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "card-error" },
    });
    const __VLS_0 = {}.ExclamationCircleIcon;
    /** @type {[typeof __VLS_components.ExclamationCircleIcon, ]} */ ;
    // @ts-ignore
    ExclamationCircleIcon;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        ...{ class: "error-icon" },
    }));
    const __VLS_2 = __VLS_1({
        ...{ class: "error-icon" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    (__VLS_ctx.cardError);
    // @ts-ignore
    [cardError,];
}
if (!__VLS_ctx.cardError) {
    // @ts-ignore
    [cardError,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "payment-hints" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "security-info" },
    });
    const __VLS_5 = {}.LockClosedIcon;
    /** @type {[typeof __VLS_components.LockClosedIcon, ]} */ ;
    // @ts-ignore
    LockClosedIcon;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
        ...{ class: "security-icon" },
    }));
    const __VLS_7 = __VLS_6({
        ...{ class: "security-icon" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "accepted-cards" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "hint-text" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "card-icons" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "card-icon visa" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "card-icon mastercard" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "card-icon amex" },
    });
    if (__VLS_ctx.country === 'TW') {
        // @ts-ignore
        [country,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "card-icon jcb" },
        });
    }
}
if (__VLS_ctx.show3DSecure) {
    // @ts-ignore
    [show3DSecure,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "secure-verification" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "verification-header" },
    });
    const __VLS_10 = {}.ShieldCheckIcon;
    /** @type {[typeof __VLS_components.ShieldCheckIcon, ]} */ ;
    // @ts-ignore
    ShieldCheckIcon;
    // @ts-ignore
    const __VLS_11 = __VLS_asFunctionalComponent(__VLS_10, new __VLS_10({
        ...{ class: "verification-icon" },
    }));
    const __VLS_12 = __VLS_11({
        ...{ class: "verification-icon" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_11));
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({});
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "verification-message" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "verification-loading" },
    });
    /** @type {[typeof LoadingSpinner, ]} */ ;
    // @ts-ignore
    const __VLS_15 = __VLS_asFunctionalComponent(LoadingSpinner, new LoadingSpinner({}));
    const __VLS_16 = __VLS_15({}, ...__VLS_functionalComponentArgsRest(__VLS_15));
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
}
if (__VLS_ctx.showPayButton) {
    // @ts-ignore
    [showPayButton,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.handlePayment) },
        ...{ class: "pay-button" },
        disabled: (!__VLS_ctx.canPay || __VLS_ctx.isProcessing),
    });
    // @ts-ignore
    [handlePayment, canPay, isProcessing,];
    if (__VLS_ctx.isProcessing) {
        // @ts-ignore
        [isProcessing,];
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "pay-loading" },
        });
        /** @type {[typeof LoadingSpinner, ]} */ ;
        // @ts-ignore
        const __VLS_19 = __VLS_asFunctionalComponent(LoadingSpinner, new LoadingSpinner({
            size: "sm",
        }));
        const __VLS_20 = __VLS_19({
            size: "sm",
        }, ...__VLS_functionalComponentArgsRest(__VLS_19));
    }
    else {
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "pay-content" },
        });
        const __VLS_23 = {}.CreditCardIcon;
        /** @type {[typeof __VLS_components.CreditCardIcon, ]} */ ;
        // @ts-ignore
        CreditCardIcon;
        // @ts-ignore
        const __VLS_24 = __VLS_asFunctionalComponent(__VLS_23, new __VLS_23({
            ...{ class: "pay-icon" },
        }));
        const __VLS_25 = __VLS_24({
            ...{ class: "pay-icon" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_24));
        (__VLS_ctx.formatAmount);
        // @ts-ignore
        [formatAmount,];
    }
}
if (__VLS_ctx.isDevelopment && __VLS_ctx.showTestCards) {
    // @ts-ignore
    [isDevelopment, showTestCards,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "test-cards" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "test-cards-header" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isDevelopment && __VLS_ctx.showTestCards))
                    return;
                __VLS_ctx.showTestCards = !__VLS_ctx.showTestCards;
                // @ts-ignore
                [showTestCards, showTestCards,];
            } },
        ...{ class: "test-toggle" },
    });
    const __VLS_28 = {}.ChevronDownIcon;
    /** @type {[typeof __VLS_components.ChevronDownIcon, ]} */ ;
    // @ts-ignore
    ChevronDownIcon;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
        ...{ class: "toggle-icon" },
        ...{ class: ({ rotated: __VLS_ctx.showTestCards }) },
    }));
    const __VLS_30 = __VLS_29({
        ...{ class: "toggle-icon" },
        ...{ class: ({ rotated: __VLS_ctx.showTestCards }) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_29));
    // @ts-ignore
    [showTestCards,];
    if (__VLS_ctx.showTestCards) {
        // @ts-ignore
        [showTestCards,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "test-cards-list" },
        });
        for (const [testCard] of __VLS_getVForSourceType((__VLS_ctx.testCards))) {
            // @ts-ignore
            [testCards,];
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.isDevelopment && __VLS_ctx.showTestCards))
                            return;
                        if (!(__VLS_ctx.showTestCards))
                            return;
                        __VLS_ctx.fillTestCard(testCard);
                        // @ts-ignore
                        [fillTestCard,];
                    } },
                key: (testCard.number),
                ...{ class: "test-card-item" },
            });
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "test-card-number" },
            });
            (testCard.number);
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "test-card-description" },
            });
            (testCard.description);
        }
    }
}
/** @type {__VLS_StyleScopedClasses['stripe-card-element']} */ ;
/** @type {__VLS_StyleScopedClasses['card-element-container']} */ ;
/** @type {__VLS_StyleScopedClasses['element-loading']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-skeleton']} */ ;
/** @type {__VLS_StyleScopedClasses['skeleton-line']} */ ;
/** @type {__VLS_StyleScopedClasses['skeleton-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['skeleton-line']} */ ;
/** @type {__VLS_StyleScopedClasses['short']} */ ;
/** @type {__VLS_StyleScopedClasses['skeleton-line']} */ ;
/** @type {__VLS_StyleScopedClasses['short']} */ ;
/** @type {__VLS_StyleScopedClasses['stripe-card-field']} */ ;
/** @type {__VLS_StyleScopedClasses['field-ready']} */ ;
/** @type {__VLS_StyleScopedClasses['field-focused']} */ ;
/** @type {__VLS_StyleScopedClasses['field-complete']} */ ;
/** @type {__VLS_StyleScopedClasses['field-error']} */ ;
/** @type {__VLS_StyleScopedClasses['card-error']} */ ;
/** @type {__VLS_StyleScopedClasses['error-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['payment-hints']} */ ;
/** @type {__VLS_StyleScopedClasses['security-info']} */ ;
/** @type {__VLS_StyleScopedClasses['security-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['accepted-cards']} */ ;
/** @type {__VLS_StyleScopedClasses['hint-text']} */ ;
/** @type {__VLS_StyleScopedClasses['card-icons']} */ ;
/** @type {__VLS_StyleScopedClasses['card-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['visa']} */ ;
/** @type {__VLS_StyleScopedClasses['card-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['mastercard']} */ ;
/** @type {__VLS_StyleScopedClasses['card-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['amex']} */ ;
/** @type {__VLS_StyleScopedClasses['card-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['jcb']} */ ;
/** @type {__VLS_StyleScopedClasses['secure-verification']} */ ;
/** @type {__VLS_StyleScopedClasses['verification-header']} */ ;
/** @type {__VLS_StyleScopedClasses['verification-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['verification-message']} */ ;
/** @type {__VLS_StyleScopedClasses['verification-loading']} */ ;
/** @type {__VLS_StyleScopedClasses['pay-button']} */ ;
/** @type {__VLS_StyleScopedClasses['pay-loading']} */ ;
/** @type {__VLS_StyleScopedClasses['pay-content']} */ ;
/** @type {__VLS_StyleScopedClasses['pay-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['test-cards']} */ ;
/** @type {__VLS_StyleScopedClasses['test-cards-header']} */ ;
/** @type {__VLS_StyleScopedClasses['test-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['rotated']} */ ;
/** @type {__VLS_StyleScopedClasses['test-cards-list']} */ ;
/** @type {__VLS_StyleScopedClasses['test-card-item']} */ ;
/** @type {__VLS_StyleScopedClasses['test-card-number']} */ ;
/** @type {__VLS_StyleScopedClasses['test-card-description']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        ExclamationCircleIcon: ExclamationCircleIcon,
        LockClosedIcon: LockClosedIcon,
        CreditCardIcon: CreditCardIcon,
        ChevronDownIcon: ChevronDownIcon,
        ShieldCheckIcon: ShieldCheckIcon,
        LoadingSpinner: LoadingSpinner,
        cardElementRef: cardElementRef,
        stripeElementReady: stripeElementReady,
        isCardFocused: isCardFocused,
        isCardComplete: isCardComplete,
        cardError: cardError,
        isProcessing: isProcessing,
        show3DSecure: show3DSecure,
        showTestCards: showTestCards,
        formatAmount: formatAmount,
        canPay: canPay,
        isDevelopment: isDevelopment,
        testCards: testCards,
        handlePayment: handlePayment,
        fillTestCard: fillTestCard,
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

const __VLS_props = withDefaults(defineProps(), {
    showBreakdown: true,
    loading: false,
});
// Computed
const formatCurrency = (amount, currency) => {
    const formatters = {
        TWD: new Intl.NumberFormat("zh-TW", {
            style: "currency",
            currency: "TWD",
            minimumFractionDigits: 0,
        }),
        MYR: new Intl.NumberFormat("ms-MY", {
            style: "currency",
            currency: "MYR",
            minimumFractionDigits: 2,
        }),
        VND: new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency: "VND",
            minimumFractionDigits: 0,
        }),
    };
    return formatters[currency].format(amount);
};
const getTaxRate = (country) => {
    const taxRates = {
        TW: 5,
        MY: 0,
        VN: 10,
    };
    return taxRates[country] || 0;
};
const getPaymentMethodName = (method) => {
    const names = {
        credit_card: "信用卡",
        debit_card: "金融卡",
        bank_transfer: "銀行轉帳",
        digital_wallet: "數位錢包",
        cash: "現金",
        ecpay: "ECPay",
        newebpay: "藍新金流",
        line_pay: "LINE Pay",
        unipay: "統一支付",
        fpx: "FPX",
        touch_n_go: "Touch 'n Go",
        touch_n_go_direct: "Touch 'n Go Direct",
        grab_pay: "Grab Pay",
        momo: "MoMo",
        zalo_pay: "ZaloPay",
        viet_qr: "VietQR",
        vnpay: "VNPay",
    };
    return names[method] || method;
};
const getPaymentMethodIcon = (_method) => {
    // Return SVG icon component based on payment method
    // For now, return a generic card icon
    return "CreditCardIcon";
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    showBreakdown: true,
    loading: false,
});
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['breakdown-label']} */ ;
/** @type {__VLS_StyleScopedClasses['discount-row']} */ ;
/** @type {__VLS_StyleScopedClasses['breakdown-value']} */ ;
/** @type {__VLS_StyleScopedClasses['order-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-header']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-content']} */ ;
/** @type {__VLS_StyleScopedClasses['order-item']} */ ;
/** @type {__VLS_StyleScopedClasses['item-main']} */ ;
/** @type {__VLS_StyleScopedClasses['item-price']} */ ;
/** @type {__VLS_StyleScopedClasses['order-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-title']} */ ;
/** @type {__VLS_StyleScopedClasses['restaurant-name']} */ ;
/** @type {__VLS_StyleScopedClasses['order-id-value']} */ ;
/** @type {__VLS_StyleScopedClasses['item-name']} */ ;
/** @type {__VLS_StyleScopedClasses['breakdown-value']} */ ;
/** @type {__VLS_StyleScopedClasses['total-label']} */ ;
/** @type {__VLS_StyleScopedClasses['total-amount']} */ ;
/** @type {__VLS_StyleScopedClasses['restaurant-info']} */ ;
/** @type {__VLS_StyleScopedClasses['order-id-value']} */ ;
/** @type {__VLS_StyleScopedClasses['order-item']} */ ;
/** @type {__VLS_StyleScopedClasses['security-notice']} */ ;
/** @type {__VLS_StyleScopedClasses['order-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['security-notice']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "order-summary" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "summary-header" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
    ...{ class: "summary-title" },
});
if (__VLS_ctx.loading) {
    // @ts-ignore
    [loading,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "header-loading" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "loading-spinner" },
    });
}
if (__VLS_ctx.loading) {
    // @ts-ignore
    [loading,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "summary-loading" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "skeleton-lines" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "skeleton-line w-full h-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "skeleton-line w-3/4 h-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "skeleton-line w-1/2 h-4" },
    });
}
else if (__VLS_ctx.order) {
    // @ts-ignore
    [order,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "summary-content" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "restaurant-info" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "restaurant-icon" },
    });
    __VLS_asFunctionalElement(__VLS_elements.svg, __VLS_elements.svg)({
        ...{ class: "w-5 h-5 text-gray-600" },
        fill: "none",
        stroke: "currentColor",
        viewBox: "0 0 24 24",
    });
    __VLS_asFunctionalElement(__VLS_elements.path, __VLS_elements.path)({
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        'stroke-width': "2",
        d: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H7m2 0v-5a2 2 0 012-2h2a2 2 0 012 2v5m-6 0h4",
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "restaurant-details" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "restaurant-name" },
    });
    (__VLS_ctx.order.restaurantName || "餐廳");
    // @ts-ignore
    [order,];
    if (__VLS_ctx.order.tableNumber) {
        // @ts-ignore
        [order,];
        __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
            ...{ class: "table-info" },
        });
        (__VLS_ctx.order.tableNumber);
        // @ts-ignore
        [order,];
    }
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "order-id-section" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "order-id-label" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "order-id-value" },
    });
    (__VLS_ctx.order.id);
    // @ts-ignore
    [order,];
    if (__VLS_ctx.order.items && __VLS_ctx.order.items.length > 0) {
        // @ts-ignore
        [order, order,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "order-items" },
        });
        __VLS_asFunctionalElement(__VLS_elements.h4, __VLS_elements.h4)({
            ...{ class: "items-title" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "items-list" },
        });
        for (const [item] of __VLS_getVForSourceType((__VLS_ctx.order.items))) {
            // @ts-ignore
            [order,];
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                key: (`${item.id}-${item.customizations?.join(',') || 'default'}`),
                ...{ class: "order-item" },
            });
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "item-info" },
            });
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "item-main" },
            });
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                ...{ class: "item-name" },
            });
            (item.name);
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                ...{ class: "item-quantity" },
            });
            (item.quantity);
            if (item.customizations && item.customizations.length > 0) {
                __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                    ...{ class: "item-customizations" },
                });
                for (const [customization] of __VLS_getVForSourceType((item.customizations))) {
                    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                        key: (customization),
                        ...{ class: "customization-tag" },
                    });
                    (customization);
                }
            }
            if (item.notes) {
                __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                    ...{ class: "item-notes" },
                });
                __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                    ...{ class: "notes-label" },
                });
                __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                    ...{ class: "notes-text" },
                });
                (item.notes);
            }
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "item-price" },
            });
            (__VLS_ctx.formatCurrency(item.price * item.quantity, __VLS_ctx.order.currency));
            // @ts-ignore
            [order, formatCurrency,];
        }
    }
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "price-breakdown" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "breakdown-row subtotal-row" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "breakdown-label" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "breakdown-value" },
    });
    (__VLS_ctx.formatCurrency(__VLS_ctx.order.subtotal, __VLS_ctx.order.currency));
    // @ts-ignore
    [order, order, formatCurrency,];
    if (__VLS_ctx.order.tax && __VLS_ctx.order.tax > 0) {
        // @ts-ignore
        [order, order,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "breakdown-row tax-row" },
        });
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "breakdown-label" },
        });
        (__VLS_ctx.getTaxRate(__VLS_ctx.order.country));
        // @ts-ignore
        [order, getTaxRate,];
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "breakdown-value" },
        });
        (__VLS_ctx.formatCurrency(__VLS_ctx.order.tax, __VLS_ctx.order.currency));
        // @ts-ignore
        [order, order, formatCurrency,];
    }
    if (__VLS_ctx.order.serviceFee && __VLS_ctx.order.serviceFee > 0) {
        // @ts-ignore
        [order, order,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "breakdown-row service-row" },
        });
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "breakdown-label" },
        });
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "breakdown-value" },
        });
        (__VLS_ctx.formatCurrency(__VLS_ctx.order.serviceFee, __VLS_ctx.order.currency));
        // @ts-ignore
        [order, order, formatCurrency,];
    }
    if (__VLS_ctx.order.deliveryFee && __VLS_ctx.order.deliveryFee > 0) {
        // @ts-ignore
        [order, order,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "breakdown-row delivery-row" },
        });
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "breakdown-label" },
        });
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "breakdown-value" },
        });
        (__VLS_ctx.formatCurrency(__VLS_ctx.order.deliveryFee, __VLS_ctx.order.currency));
        // @ts-ignore
        [order, order, formatCurrency,];
    }
    if (__VLS_ctx.order.discount && __VLS_ctx.order.discount > 0) {
        // @ts-ignore
        [order, order,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "breakdown-row discount-row" },
        });
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "breakdown-label text-green-600" },
        });
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "breakdown-value text-green-600" },
        });
        (__VLS_ctx.formatCurrency(__VLS_ctx.order.discount, __VLS_ctx.order.currency));
        // @ts-ignore
        [order, order, formatCurrency,];
    }
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "total-section" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "total-row" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "total-label" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "total-amount" },
    });
    (__VLS_ctx.formatCurrency(__VLS_ctx.order.total, __VLS_ctx.order.currency));
    // @ts-ignore
    [order, order, formatCurrency,];
    if (__VLS_ctx.selectedPaymentMethod) {
        // @ts-ignore
        [selectedPaymentMethod,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "payment-method-display" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "payment-method-label" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "payment-method-info" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "payment-method-icon" },
        });
        const __VLS_0 = ((__VLS_ctx.getPaymentMethodIcon(__VLS_ctx.selectedPaymentMethod)));
        // @ts-ignore
        const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
            ...{ class: "w-5 h-5" },
        }));
        const __VLS_2 = __VLS_1({
            ...{ class: "w-5 h-5" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        // @ts-ignore
        [selectedPaymentMethod, getPaymentMethodIcon,];
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "payment-method-name" },
        });
        (__VLS_ctx.getPaymentMethodName(__VLS_ctx.selectedPaymentMethod));
        // @ts-ignore
        [selectedPaymentMethod, getPaymentMethodName,];
    }
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "security-notice" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "security-icon" },
    });
    __VLS_asFunctionalElement(__VLS_elements.svg, __VLS_elements.svg)({
        ...{ class: "w-4 h-4 text-green-500" },
        fill: "none",
        stroke: "currentColor",
        viewBox: "0 0 24 24",
    });
    __VLS_asFunctionalElement(__VLS_elements.path, __VLS_elements.path)({
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        'stroke-width': "2",
        d: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "security-text" },
    });
}
else {
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "summary-empty" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "empty-icon" },
    });
    __VLS_asFunctionalElement(__VLS_elements.svg, __VLS_elements.svg)({
        ...{ class: "w-12 h-12 text-gray-300" },
        fill: "none",
        stroke: "currentColor",
        viewBox: "0 0 24 24",
    });
    __VLS_asFunctionalElement(__VLS_elements.path, __VLS_elements.path)({
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
        'stroke-width': "2",
        d: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z",
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "empty-text" },
    });
}
/** @type {__VLS_StyleScopedClasses['order-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-header']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-title']} */ ;
/** @type {__VLS_StyleScopedClasses['header-loading']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-loading']} */ ;
/** @type {__VLS_StyleScopedClasses['skeleton-lines']} */ ;
/** @type {__VLS_StyleScopedClasses['skeleton-line']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['skeleton-line']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3/4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['skeleton-line']} */ ;
/** @type {__VLS_StyleScopedClasses['w-1/2']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-content']} */ ;
/** @type {__VLS_StyleScopedClasses['restaurant-info']} */ ;
/** @type {__VLS_StyleScopedClasses['restaurant-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['restaurant-details']} */ ;
/** @type {__VLS_StyleScopedClasses['restaurant-name']} */ ;
/** @type {__VLS_StyleScopedClasses['table-info']} */ ;
/** @type {__VLS_StyleScopedClasses['order-id-section']} */ ;
/** @type {__VLS_StyleScopedClasses['order-id-label']} */ ;
/** @type {__VLS_StyleScopedClasses['order-id-value']} */ ;
/** @type {__VLS_StyleScopedClasses['order-items']} */ ;
/** @type {__VLS_StyleScopedClasses['items-title']} */ ;
/** @type {__VLS_StyleScopedClasses['items-list']} */ ;
/** @type {__VLS_StyleScopedClasses['order-item']} */ ;
/** @type {__VLS_StyleScopedClasses['item-info']} */ ;
/** @type {__VLS_StyleScopedClasses['item-main']} */ ;
/** @type {__VLS_StyleScopedClasses['item-name']} */ ;
/** @type {__VLS_StyleScopedClasses['item-quantity']} */ ;
/** @type {__VLS_StyleScopedClasses['item-customizations']} */ ;
/** @type {__VLS_StyleScopedClasses['customization-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['item-notes']} */ ;
/** @type {__VLS_StyleScopedClasses['notes-label']} */ ;
/** @type {__VLS_StyleScopedClasses['notes-text']} */ ;
/** @type {__VLS_StyleScopedClasses['item-price']} */ ;
/** @type {__VLS_StyleScopedClasses['price-breakdown']} */ ;
/** @type {__VLS_StyleScopedClasses['breakdown-row']} */ ;
/** @type {__VLS_StyleScopedClasses['subtotal-row']} */ ;
/** @type {__VLS_StyleScopedClasses['breakdown-label']} */ ;
/** @type {__VLS_StyleScopedClasses['breakdown-value']} */ ;
/** @type {__VLS_StyleScopedClasses['breakdown-row']} */ ;
/** @type {__VLS_StyleScopedClasses['tax-row']} */ ;
/** @type {__VLS_StyleScopedClasses['breakdown-label']} */ ;
/** @type {__VLS_StyleScopedClasses['breakdown-value']} */ ;
/** @type {__VLS_StyleScopedClasses['breakdown-row']} */ ;
/** @type {__VLS_StyleScopedClasses['service-row']} */ ;
/** @type {__VLS_StyleScopedClasses['breakdown-label']} */ ;
/** @type {__VLS_StyleScopedClasses['breakdown-value']} */ ;
/** @type {__VLS_StyleScopedClasses['breakdown-row']} */ ;
/** @type {__VLS_StyleScopedClasses['delivery-row']} */ ;
/** @type {__VLS_StyleScopedClasses['breakdown-label']} */ ;
/** @type {__VLS_StyleScopedClasses['breakdown-value']} */ ;
/** @type {__VLS_StyleScopedClasses['breakdown-row']} */ ;
/** @type {__VLS_StyleScopedClasses['discount-row']} */ ;
/** @type {__VLS_StyleScopedClasses['breakdown-label']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-600']} */ ;
/** @type {__VLS_StyleScopedClasses['breakdown-value']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-600']} */ ;
/** @type {__VLS_StyleScopedClasses['total-section']} */ ;
/** @type {__VLS_StyleScopedClasses['total-row']} */ ;
/** @type {__VLS_StyleScopedClasses['total-label']} */ ;
/** @type {__VLS_StyleScopedClasses['total-amount']} */ ;
/** @type {__VLS_StyleScopedClasses['payment-method-display']} */ ;
/** @type {__VLS_StyleScopedClasses['payment-method-label']} */ ;
/** @type {__VLS_StyleScopedClasses['payment-method-info']} */ ;
/** @type {__VLS_StyleScopedClasses['payment-method-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['payment-method-name']} */ ;
/** @type {__VLS_StyleScopedClasses['security-notice']} */ ;
/** @type {__VLS_StyleScopedClasses['security-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-500']} */ ;
/** @type {__VLS_StyleScopedClasses['security-text']} */ ;
/** @type {__VLS_StyleScopedClasses['summary-empty']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['w-12']} */ ;
/** @type {__VLS_StyleScopedClasses['h-12']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-text']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        formatCurrency: formatCurrency,
        getTaxRate: getTaxRate,
        getPaymentMethodName: getPaymentMethodName,
        getPaymentMethodIcon: getPaymentMethodIcon,
    }),
    __typeProps: {},
    props: {},
});
export default (await import('vue')).defineComponent({
    __typeProps: {},
    props: {},
});
; /* PartiallyEnd: #4569/main.vue */

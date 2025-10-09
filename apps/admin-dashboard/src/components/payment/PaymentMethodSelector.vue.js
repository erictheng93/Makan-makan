import { ref, computed, onMounted } from "vue";
import { CreditCardIcon, ClockIcon, CurrencyDollarIcon, CheckCircleIcon, ExclamationTriangleIcon, StarIcon, InformationCircleIcon, ArrowPathIcon, MapPinIcon, } from "@heroicons/vue/24/outline";
import { CreditCardIcon as CreditCardIconSolid, BanknotesIcon, DevicePhoneMobileIcon, BuildingLibraryIcon, } from "@heroicons/vue/24/solid";
import QrCodeIcon from "@heroicons/vue/24/solid/QrCodeIcon";
const props = withDefaults(defineProps(), {
    loading: false,
    showRegionalHint: true,
});
const emit = defineEmits();
// 內部狀態
const selectedMethod = ref(props.selectedMethod);
const paymentMethodsConfig = {
    credit_card: {
        displayName: "信用卡",
        description: "使用 Visa、MasterCard 等信用卡付款",
        fullDescription: "支援所有主要信用卡品牌，包括 Visa、MasterCard、American Express 等。付款過程安全可靠，支援 3D Secure 驗證。",
        iconComponent: CreditCardIconSolid,
        processingTime: "即時",
        features: ["3d_secure", "auto_retry", "refund"],
        recommended: true,
        disabled: false,
        steps: [
            "輸入信用卡資訊",
            "驗證卡片有效性",
            "完成 3D Secure 驗證（如需要）",
            "確認付款",
        ],
        requirements: ["有效的信用卡", "卡片到期日", "CVC 安全碼"],
    },
    debit_card: {
        displayName: "金融卡",
        description: "使用銀行金融卡直接扣款",
        fullDescription: "直接從您的銀行帳戶扣款，無需信用額度。支援大部分銀行發行的金融卡。",
        iconComponent: CreditCardIconSolid,
        processingTime: "即時",
        features: ["3d_secure", "refund"],
        recommended: false,
        disabled: false,
        steps: ["輸入金融卡資訊", "驗證卡片和帳戶餘額", "完成銀行驗證", "確認扣款"],
        requirements: ["有效的金融卡", "充足的帳戶餘額", "PIN 碼或簡訊驗證"],
    },
    bank_transfer: {
        displayName: "銀行轉帳",
        description: "透過網路銀行或 ATM 轉帳付款",
        fullDescription: "提供轉帳資訊，您可以透過網路銀行、ATM 或臨櫃完成轉帳。適合喜歡傳統付款方式的用戶。",
        iconComponent: BuildingLibraryIcon,
        processingTime: "1-3 個工作天",
        features: ["manual_verify"],
        recommended: false,
        disabled: false,
        steps: [
            "取得轉帳資訊",
            "使用網銀或 ATM 轉帳",
            "保留轉帳憑證",
            "等待轉帳確認",
        ],
        requirements: ["銀行帳戶", "網路銀行或 ATM 卡", "轉帳手續費"],
    },
    digital_wallet: {
        displayName: "數位錢包",
        description: "使用行動支付 App 快速付款",
        fullDescription: "支援各種數位錢包應用程式，如 Apple Pay、Google Pay、Samsung Pay 等。快速便捷，無需輸入卡片資訊。",
        iconComponent: DevicePhoneMobileIcon,
        processingTime: "即時",
        features: ["biometric", "quick_pay"],
        recommended: true,
        disabled: false,
        steps: [
            "選擇數位錢包",
            "使用指紋或Face ID驗證",
            "確認付款金額",
            "完成付款",
        ],
        requirements: ["支援的手機", "已設定數位錢包", "生物識別或密碼"],
    },
    // 台灣特定
    ecpay: {
        displayName: "綠界支付",
        description: "台灣本地綜合支付平台",
        fullDescription: "綠界科技提供的整合支付服務，支援信用卡、ATM 轉帳、超商代碼等多種付款方式。",
        iconComponent: BanknotesIcon,
        processingTime: "即時至3天",
        features: ["multi_method", "convenience_store"],
        recommended: true,
        disabled: false,
    },
    line_pay: {
        displayName: "LINE Pay",
        description: "使用 LINE 應用程式付款",
        fullDescription: "LINE 官方支付服務，可使用 LINE Points 或綁定的信用卡付款。",
        iconComponent: DevicePhoneMobileIcon,
        processingTime: "即時",
        features: ["app_based", "points_reward"],
        recommended: false,
        disabled: false,
    },
    // 馬來西亞特定
    fpx: {
        displayName: "FPX",
        description: "馬來西亞銀行直接扣款",
        fullDescription: "Financial Process Exchange，馬來西亞央行推出的即時銀行轉帳系統。",
        iconComponent: BuildingLibraryIcon,
        processingTime: "即時",
        features: ["bank_direct", "real_time"],
        recommended: true,
        disabled: false,
    },
    touch_n_go: {
        displayName: "Touch 'n Go",
        description: "馬來西亞電子錢包",
        fullDescription: "馬來西亞最受歡迎的電子錢包之一，廣泛用於交通和日常消費。",
        iconComponent: DevicePhoneMobileIcon,
        processingTime: "即時",
        features: ["ewallet", "qr_code"],
        recommended: true,
        disabled: false,
    },
    grab_pay: {
        displayName: "GrabPay",
        description: "Grab 應用程式內建錢包",
        fullDescription: "Grab 提供的數位錢包服務，在東南亞地區廣泛使用。",
        iconComponent: DevicePhoneMobileIcon,
        processingTime: "即時",
        features: ["app_based", "rewards"],
        recommended: false,
        disabled: false,
    },
    // 越南特定
    momo: {
        displayName: "MoMo",
        description: "越南領先的電子錢包",
        fullDescription: "MoMo 是越南最大的電子錢包平台之一，提供安全便捷的付款體驗。",
        iconComponent: DevicePhoneMobileIcon,
        processingTime: "即時",
        features: ["ewallet", "qr_code", "bank_link"],
        recommended: true,
        disabled: false,
    },
    zalo_pay: {
        displayName: "ZaloPay",
        description: "Zalo 生態系統的支付服務",
        fullDescription: "ZaloPay 是 Zalo 公司推出的數位錢包，在越南具有廣泛的用戶基礎。",
        iconComponent: DevicePhoneMobileIcon,
        processingTime: "即時",
        features: ["social_pay", "qr_code"],
        recommended: false,
        disabled: false,
    },
    viet_qr: {
        displayName: "VietQR",
        description: "越南統一 QR 碼支付",
        fullDescription: "越南國家支付公司推出的 QR 碼支付標準，支援所有參與銀行。",
        iconComponent: QrCodeIcon,
        processingTime: "即時",
        features: ["qr_code", "universal", "bank_support"],
        recommended: true,
        disabled: false,
    },
    vnpay: {
        displayName: "VNPay",
        description: "越南綜合支付平台",
        fullDescription: "越南領先的支付閘道，支援多種銀行和支付方式。",
        iconComponent: BanknotesIcon,
        processingTime: "即時",
        features: ["multi_bank", "comprehensive"],
        recommended: false,
        disabled: false,
    },
    newebpay: {
        displayName: "藍新金流",
        description: "台灣藍新金流支付",
        fullDescription: "台灣知名的第三方支付服務，支援多種付款方式。",
        iconComponent: CreditCardIconSolid,
        processingTime: "即時",
        features: ["multi_payment"],
        recommended: false,
        disabled: false,
    },
    unipay: {
        displayName: "統一支付",
        description: "統一集團支付服務",
        fullDescription: "統一集團旗下的支付服務，整合多種支付管道。",
        iconComponent: CreditCardIconSolid,
        processingTime: "即時",
        features: ["unified"],
        recommended: false,
        disabled: false,
    },
    touch_n_go_direct: {
        displayName: "Touch 'n Go Direct",
        description: "Touch 'n Go 直接付款",
        fullDescription: "Touch 'n Go 電子錢包直接付款，無需 QR 碼掃描。",
        iconComponent: DevicePhoneMobileIcon,
        processingTime: "即時",
        features: ["direct_payment"],
        recommended: false,
        disabled: false,
    },
    cash: {
        displayName: "現金付款",
        description: "到店現金付款",
        fullDescription: "到餐廳現場使用現金付款。適合不方便線上付款的顧客。",
        iconComponent: BanknotesIcon,
        processingTime: "到店時",
        features: ["in_person"],
        recommended: false,
        disabled: false,
    },
};
// 計算可用方式的詳細資訊
const availableMethodsWithDetails = computed(() => {
    return props.availableMethods
        .map((method) => {
        const config = paymentMethodsConfig[method];
        return {
            id: method,
            ...config,
            // 根據國家調整推薦狀態
            recommended: getRecommendedForCountry(method, props.country),
        };
    })
        .sort((a, b) => {
        // 排序：推薦的在前，然後按字母排序
        if (a.recommended && !b.recommended)
            return -1;
        if (!a.recommended && b.recommended)
            return 1;
        return a.displayName.localeCompare(b.displayName);
    });
});
// 當前選中方式的詳細資訊
const selectedMethodDetails = computed(() => {
    if (!selectedMethod.value)
        return null;
    return availableMethodsWithDetails.value.find((m) => m.id === selectedMethod.value);
});
// 方法
const selectMethod = (method) => {
    if (method.disabled)
        return;
    selectedMethod.value = method.id;
    emit("update:selectedMethod", method.id);
    emit("method-selected", method.id);
};
const getRecommendedForCountry = (method, country) => {
    const countryRecommendations = {
        TW: ["credit_card", "ecpay", "line_pay"],
        MY: ["credit_card", "fpx", "touch_n_go"],
        VN: ["credit_card", "momo", "viet_qr"],
    };
    return countryRecommendations[country]?.includes(method) || false;
};
const getFeatureLabel = (feature) => {
    const labels = {
        "3d_secure": "3D安全驗證",
        auto_retry: "自動重試",
        refund: "支援退款",
        biometric: "生物識別",
        quick_pay: "快速付款",
        multi_method: "多種方式",
        convenience_store: "超商代碼",
        app_based: "App付款",
        points_reward: "點數回饋",
        bank_direct: "銀行直扣",
        real_time: "即時到帳",
        ewallet: "電子錢包",
        qr_code: "QR碼",
        rewards: "回饋優惠",
        bank_link: "銀行連結",
        social_pay: "社交支付",
        universal: "通用標準",
        bank_support: "銀行支援",
        multi_bank: "多銀行",
        comprehensive: "綜合平台",
        manual_verify: "人工核實",
        in_person: "現場付款",
    };
    return labels[feature] || feature;
};
const getRegionalHintTitle = () => {
    const titles = {
        TW: "台灣用戶推薦",
        MY: "馬來西亞用戶推薦",
        VN: "越南用戶推薦",
    };
    return titles[props.country] || "推薦支付方式";
};
const getRegionalHintMessage = () => {
    const messages = {
        TW: "信用卡和綠界支付在台灣使用最為廣泛，LINE Pay 也很受歡迎。",
        MY: "FPX 銀行轉帳和 Touch 'n Go 電子錢包是馬來西亞用戶的首選。",
        VN: "MoMo 和 VietQR 是越南最受歡迎的電子支付方式。",
    };
    return messages[props.country] || "選擇最適合您的支付方式。";
};
// 生命週期
onMounted(() => {
    // 自動選擇第一個推薦的方式
    if (!selectedMethod.value && availableMethodsWithDetails.value.length > 0) {
        const recommended = availableMethodsWithDetails.value.find((m) => m.recommended);
        if (recommended) {
            selectMethod(recommended);
        }
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    loading: false,
    showRegionalHint: true,
});
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['skeleton-line']} */ ;
/** @type {__VLS_StyleScopedClasses['payment-method']} */ ;
/** @type {__VLS_StyleScopedClasses['method-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['method-selected']} */ ;
/** @type {__VLS_StyleScopedClasses['method-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['icon']} */ ;
/** @type {__VLS_StyleScopedClasses['method-selected']} */ ;
/** @type {__VLS_StyleScopedClasses['feature-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['explanation-header']} */ ;
/** @type {__VLS_StyleScopedClasses['steps-list']} */ ;
/** @type {__VLS_StyleScopedClasses['requirements-list']} */ ;
/** @type {__VLS_StyleScopedClasses['hint-content']} */ ;
/** @type {__VLS_StyleScopedClasses['methods-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['method-details']} */ ;
/** @type {__VLS_StyleScopedClasses['method-features']} */ ;
/** @type {__VLS_StyleScopedClasses['payment-method']} */ ;
/** @type {__VLS_StyleScopedClasses['method-name']} */ ;
/** @type {__VLS_StyleScopedClasses['method-description']} */ ;
/** @type {__VLS_StyleScopedClasses['method-details']} */ ;
/** @type {__VLS_StyleScopedClasses['method-selected']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "payment-method-selector" },
});
if (__VLS_ctx.loading) {
    // @ts-ignore
    [loading,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "loading-container" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "loading-grid" },
    });
    for (const [i] of __VLS_getVForSourceType((4))) {
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            key: (i),
            ...{ class: "method-skeleton" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "skeleton-icon" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "skeleton-text" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "skeleton-line" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "skeleton-line short" },
        });
    }
}
else {
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "methods-grid" },
    });
    for (const [method] of __VLS_getVForSourceType((__VLS_ctx.availableMethodsWithDetails))) {
        // @ts-ignore
        [availableMethodsWithDetails,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    __VLS_ctx.selectMethod(method);
                    // @ts-ignore
                    [selectMethod,];
                } },
            key: (method.id),
            ...{ class: "payment-method" },
            ...{ class: ({
                    'method-selected': __VLS_ctx.selectedMethod === method.id,
                    'method-recommended': method.recommended,
                    'method-disabled': method.disabled,
                }) },
        });
        // @ts-ignore
        [selectedMethod,];
        if (method.recommended) {
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "recommended-badge" },
            });
            const __VLS_0 = {}.StarIcon;
            /** @type {[typeof __VLS_components.StarIcon, ]} */ ;
            // @ts-ignore
            StarIcon;
            // @ts-ignore
            const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
                ...{ class: "badge-icon" },
            }));
            const __VLS_2 = __VLS_1({
                ...{ class: "badge-icon" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        }
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "method-icon" },
        });
        const __VLS_5 = ((method.iconComponent));
        // @ts-ignore
        const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
            ...{ class: "icon" },
        }));
        const __VLS_7 = __VLS_6({
            ...{ class: "icon" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_6));
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "method-info" },
        });
        __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
            ...{ class: "method-name" },
        });
        (method.displayName);
        __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
            ...{ class: "method-description" },
        });
        (method.description);
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "method-details" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "detail-item" },
        });
        const __VLS_10 = {}.ClockIcon;
        /** @type {[typeof __VLS_components.ClockIcon, ]} */ ;
        // @ts-ignore
        ClockIcon;
        // @ts-ignore
        const __VLS_11 = __VLS_asFunctionalComponent(__VLS_10, new __VLS_10({
            ...{ class: "detail-icon" },
        }));
        const __VLS_12 = __VLS_11({
            ...{ class: "detail-icon" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_11));
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
        (method.processingTime);
        if (method.fee) {
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "detail-item" },
            });
            const __VLS_15 = {}.CurrencyDollarIcon;
            /** @type {[typeof __VLS_components.CurrencyDollarIcon, ]} */ ;
            // @ts-ignore
            CurrencyDollarIcon;
            // @ts-ignore
            const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({
                ...{ class: "detail-icon" },
            }));
            const __VLS_17 = __VLS_16({
                ...{ class: "detail-icon" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_16));
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
            (method.fee);
        }
        if (method.features.length > 0) {
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "method-features" },
            });
            for (const [feature] of __VLS_getVForSourceType((method.features))) {
                __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                    key: (feature),
                    ...{ class: "feature-tag" },
                });
                (__VLS_ctx.getFeatureLabel(feature));
                // @ts-ignore
                [getFeatureLabel,];
            }
        }
        if (__VLS_ctx.selectedMethod === method.id) {
            // @ts-ignore
            [selectedMethod,];
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "selected-indicator" },
            });
            const __VLS_20 = {}.CheckCircleIcon;
            /** @type {[typeof __VLS_components.CheckCircleIcon, ]} */ ;
            // @ts-ignore
            CheckCircleIcon;
            // @ts-ignore
            const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
                ...{ class: "check-icon" },
            }));
            const __VLS_22 = __VLS_21({
                ...{ class: "check-icon" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_21));
        }
        if (method.disabled) {
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "disabled-overlay" },
            });
            const __VLS_25 = {}.ExclamationTriangleIcon;
            /** @type {[typeof __VLS_components.ExclamationTriangleIcon, ]} */ ;
            // @ts-ignore
            ExclamationTriangleIcon;
            // @ts-ignore
            const __VLS_26 = __VLS_asFunctionalComponent(__VLS_25, new __VLS_25({
                ...{ class: "disabled-icon" },
            }));
            const __VLS_27 = __VLS_26({
                ...{ class: "disabled-icon" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_26));
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                ...{ class: "disabled-text" },
            });
            (method.disabledReason);
        }
    }
}
if (!__VLS_ctx.loading && __VLS_ctx.availableMethodsWithDetails.length === 0) {
    // @ts-ignore
    [loading, availableMethodsWithDetails,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "no-methods" },
    });
    const __VLS_30 = {}.CreditCardIcon;
    /** @type {[typeof __VLS_components.CreditCardIcon, ]} */ ;
    // @ts-ignore
    CreditCardIcon;
    // @ts-ignore
    const __VLS_31 = __VLS_asFunctionalComponent(__VLS_30, new __VLS_30({
        ...{ class: "no-methods-icon" },
    }));
    const __VLS_32 = __VLS_31({
        ...{ class: "no-methods-icon" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_31));
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
        ...{ class: "no-methods-title" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "no-methods-description" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.loading && __VLS_ctx.availableMethodsWithDetails.length === 0))
                    return;
                __VLS_ctx.$emit('retry');
                // @ts-ignore
                [$emit,];
            } },
        ...{ class: "retry-button" },
    });
    const __VLS_35 = {}.ArrowPathIcon;
    /** @type {[typeof __VLS_components.ArrowPathIcon, ]} */ ;
    // @ts-ignore
    ArrowPathIcon;
    // @ts-ignore
    const __VLS_36 = __VLS_asFunctionalComponent(__VLS_35, new __VLS_35({
        ...{ class: "retry-icon" },
    }));
    const __VLS_37 = __VLS_36({
        ...{ class: "retry-icon" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_36));
}
if (__VLS_ctx.selectedMethodDetails && !__VLS_ctx.loading) {
    // @ts-ignore
    [loading, selectedMethodDetails,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "method-explanation" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "explanation-header" },
    });
    const __VLS_40 = {}.InformationCircleIcon;
    /** @type {[typeof __VLS_components.InformationCircleIcon, ]} */ ;
    // @ts-ignore
    InformationCircleIcon;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
        ...{ class: "info-icon" },
    }));
    const __VLS_42 = __VLS_41({
        ...{ class: "info-icon" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    __VLS_asFunctionalElement(__VLS_elements.h4, __VLS_elements.h4)({});
    (__VLS_ctx.selectedMethodDetails.displayName);
    // @ts-ignore
    [selectedMethodDetails,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "explanation-content" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({});
    (__VLS_ctx.selectedMethodDetails.fullDescription);
    // @ts-ignore
    [selectedMethodDetails,];
    if (__VLS_ctx.selectedMethodDetails.steps) {
        // @ts-ignore
        [selectedMethodDetails,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "payment-steps-preview" },
        });
        __VLS_asFunctionalElement(__VLS_elements.h5, __VLS_elements.h5)({});
        __VLS_asFunctionalElement(__VLS_elements.ol, __VLS_elements.ol)({
            ...{ class: "steps-list" },
        });
        for (const [step] of __VLS_getVForSourceType((__VLS_ctx.selectedMethodDetails.steps))) {
            // @ts-ignore
            [selectedMethodDetails,];
            __VLS_asFunctionalElement(__VLS_elements.li, __VLS_elements.li)({
                key: (step),
            });
            (step);
        }
    }
    if (__VLS_ctx.selectedMethodDetails.requirements) {
        // @ts-ignore
        [selectedMethodDetails,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "requirements" },
        });
        __VLS_asFunctionalElement(__VLS_elements.h5, __VLS_elements.h5)({});
        __VLS_asFunctionalElement(__VLS_elements.ul, __VLS_elements.ul)({
            ...{ class: "requirements-list" },
        });
        for (const [req] of __VLS_getVForSourceType((__VLS_ctx.selectedMethodDetails.requirements))) {
            // @ts-ignore
            [selectedMethodDetails,];
            __VLS_asFunctionalElement(__VLS_elements.li, __VLS_elements.li)({
                key: (req),
            });
            (req);
        }
    }
}
if (__VLS_ctx.showRegionalHint) {
    // @ts-ignore
    [showRegionalHint,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "regional-hint" },
    });
    const __VLS_45 = {}.MapPinIcon;
    /** @type {[typeof __VLS_components.MapPinIcon, ]} */ ;
    // @ts-ignore
    MapPinIcon;
    // @ts-ignore
    const __VLS_46 = __VLS_asFunctionalComponent(__VLS_45, new __VLS_45({
        ...{ class: "hint-icon" },
    }));
    const __VLS_47 = __VLS_46({
        ...{ class: "hint-icon" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_46));
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "hint-content" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h4, __VLS_elements.h4)({});
    (__VLS_ctx.getRegionalHintTitle());
    // @ts-ignore
    [getRegionalHintTitle,];
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({});
    (__VLS_ctx.getRegionalHintMessage());
    // @ts-ignore
    [getRegionalHintMessage,];
}
/** @type {__VLS_StyleScopedClasses['payment-method-selector']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-container']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['method-skeleton']} */ ;
/** @type {__VLS_StyleScopedClasses['skeleton-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['skeleton-text']} */ ;
/** @type {__VLS_StyleScopedClasses['skeleton-line']} */ ;
/** @type {__VLS_StyleScopedClasses['skeleton-line']} */ ;
/** @type {__VLS_StyleScopedClasses['short']} */ ;
/** @type {__VLS_StyleScopedClasses['methods-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['payment-method']} */ ;
/** @type {__VLS_StyleScopedClasses['method-selected']} */ ;
/** @type {__VLS_StyleScopedClasses['method-recommended']} */ ;
/** @type {__VLS_StyleScopedClasses['method-disabled']} */ ;
/** @type {__VLS_StyleScopedClasses['recommended-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['method-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['icon']} */ ;
/** @type {__VLS_StyleScopedClasses['method-info']} */ ;
/** @type {__VLS_StyleScopedClasses['method-name']} */ ;
/** @type {__VLS_StyleScopedClasses['method-description']} */ ;
/** @type {__VLS_StyleScopedClasses['method-details']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['method-features']} */ ;
/** @type {__VLS_StyleScopedClasses['feature-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['selected-indicator']} */ ;
/** @type {__VLS_StyleScopedClasses['check-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled-overlay']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled-text']} */ ;
/** @type {__VLS_StyleScopedClasses['no-methods']} */ ;
/** @type {__VLS_StyleScopedClasses['no-methods-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['no-methods-title']} */ ;
/** @type {__VLS_StyleScopedClasses['no-methods-description']} */ ;
/** @type {__VLS_StyleScopedClasses['retry-button']} */ ;
/** @type {__VLS_StyleScopedClasses['retry-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['method-explanation']} */ ;
/** @type {__VLS_StyleScopedClasses['explanation-header']} */ ;
/** @type {__VLS_StyleScopedClasses['info-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['explanation-content']} */ ;
/** @type {__VLS_StyleScopedClasses['payment-steps-preview']} */ ;
/** @type {__VLS_StyleScopedClasses['steps-list']} */ ;
/** @type {__VLS_StyleScopedClasses['requirements']} */ ;
/** @type {__VLS_StyleScopedClasses['requirements-list']} */ ;
/** @type {__VLS_StyleScopedClasses['regional-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['hint-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['hint-content']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        CreditCardIcon: CreditCardIcon,
        ClockIcon: ClockIcon,
        CurrencyDollarIcon: CurrencyDollarIcon,
        CheckCircleIcon: CheckCircleIcon,
        ExclamationTriangleIcon: ExclamationTriangleIcon,
        StarIcon: StarIcon,
        InformationCircleIcon: InformationCircleIcon,
        ArrowPathIcon: ArrowPathIcon,
        MapPinIcon: MapPinIcon,
        selectedMethod: selectedMethod,
        availableMethodsWithDetails: availableMethodsWithDetails,
        selectedMethodDetails: selectedMethodDetails,
        selectMethod: selectMethod,
        getFeatureLabel: getFeatureLabel,
        getRegionalHintTitle: getRegionalHintTitle,
        getRegionalHintMessage: getRegionalHintMessage,
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

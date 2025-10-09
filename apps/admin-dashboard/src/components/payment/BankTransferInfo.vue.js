import { ref, computed, onMounted } from "vue";
const props = withDefaults(defineProps(), {
    orderReference: "ORDER_123456789",
    showQRCode: true,
});
// Reactive state
const showCopyToast = ref(false);
// Computed properties
const bankInfo = computed(() => {
    const bankConfigs = {
        TW: {
            bankName: "台灣銀行",
            bankCode: "004",
            accountNumber: "123-456-789012",
            accountName: "MakanMakan Food Service Co., Ltd.",
            qrCode: "/images/bank-qr-tw.png",
        },
        MY: {
            bankName: "Maybank",
            bankCode: "MBB0227",
            accountNumber: "1234567890123456",
            accountName: "MakanMakan Sdn Bhd",
            qrCode: "/images/bank-qr-my.png",
        },
        VN: {
            bankName: "Vietcombank",
            bankCode: "VCB",
            accountNumber: "0123456789012345",
            accountName: "MakanMakan Vietnam Co., Ltd.",
            qrCode: "/images/bank-qr-vn.png",
        },
    };
    return bankConfigs[props.country] || bankConfigs.TW;
});
const processingTime = computed(() => {
    const processingTimes = {
        TW: 24,
        MY: 48,
        VN: 72,
    };
    return processingTimes[props.country] || 24;
});
// Methods
const copyToClipboard = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        showCopyToast.value = true;
        // Hide toast after 2 seconds
        setTimeout(() => {
            showCopyToast.value = false;
        }, 2000);
    }
    catch (error) {
        console.error("Failed to copy to clipboard:", error);
        // Fallback for older browsers
        fallbackCopyToClipboard(text);
    }
};
const fallbackCopyToClipboard = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand("copy");
        showCopyToast.value = true;
        setTimeout(() => {
            showCopyToast.value = false;
        }, 2000);
    }
    catch (error) {
        console.error("Fallback copy failed:", error);
    }
    document.body.removeChild(textArea);
};
// Lifecycle
onMounted(() => {
    // Any initialization if needed
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    orderReference: "ORDER_123456789",
    showQRCode: true,
});
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['detail-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['info-header']} */ ;
/** @type {__VLS_StyleScopedClasses['instruction-item']} */ ;
/** @type {__VLS_StyleScopedClasses['instruction-step']} */ ;
/** @type {__VLS_StyleScopedClasses['copy-toast']} */ ;
/** @type {__VLS_StyleScopedClasses['copy-button']} */ ;
/** @type {__VLS_StyleScopedClasses['copy-toast']} */ ;
/** @type {__VLS_StyleScopedClasses['qr-section']} */ ;
/** @type {__VLS_StyleScopedClasses['copy-button']} */ ;
/** @type {__VLS_StyleScopedClasses['instruction-step']} */ ;
/** @type {__VLS_StyleScopedClasses['copy-button']} */ ;
/** @type {__VLS_StyleScopedClasses['toast-enter-active']} */ ;
/** @type {__VLS_StyleScopedClasses['toast-leave-active']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bank-transfer-info" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "info-header" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bank-icon" },
});
__VLS_asFunctionalElement(__VLS_elements.svg, __VLS_elements.svg)({
    ...{ class: "w-8 h-8 text-blue-600" },
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24",
});
__VLS_asFunctionalElement(__VLS_elements.path, __VLS_elements.path)({
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
    'stroke-width': "2",
    d: "M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z",
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "info-title" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
    ...{ class: "title-text" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "title-description" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "transfer-details" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bank-details-section" },
});
__VLS_asFunctionalElement(__VLS_elements.h4, __VLS_elements.h4)({
    ...{ class: "section-title" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "detail-grid" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "detail-item" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "detail-label" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "detail-value-container" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "detail-value" },
});
(__VLS_ctx.bankInfo.bankName);
// @ts-ignore
[bankInfo,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.copyToClipboard(__VLS_ctx.bankInfo.bankName);
            // @ts-ignore
            [bankInfo, copyToClipboard,];
        } },
    ...{ class: "copy-button" },
    title: ('複製 ' + __VLS_ctx.bankInfo.bankName),
});
// @ts-ignore
[bankInfo,];
__VLS_asFunctionalElement(__VLS_elements.svg, __VLS_elements.svg)({
    ...{ class: "w-4 h-4" },
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24",
});
__VLS_asFunctionalElement(__VLS_elements.path, __VLS_elements.path)({
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
    'stroke-width': "2",
    d: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z",
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "detail-item" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "detail-label" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "detail-value-container" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "detail-value font-mono" },
});
(__VLS_ctx.bankInfo.bankCode);
// @ts-ignore
[bankInfo,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.copyToClipboard(__VLS_ctx.bankInfo.bankCode);
            // @ts-ignore
            [bankInfo, copyToClipboard,];
        } },
    ...{ class: "copy-button" },
    title: "複製銀行代碼",
});
__VLS_asFunctionalElement(__VLS_elements.svg, __VLS_elements.svg)({
    ...{ class: "w-4 h-4" },
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24",
});
__VLS_asFunctionalElement(__VLS_elements.path, __VLS_elements.path)({
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
    'stroke-width': "2",
    d: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z",
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "detail-item" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "detail-label" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "detail-value-container" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "detail-value font-mono" },
});
(__VLS_ctx.bankInfo.accountNumber);
// @ts-ignore
[bankInfo,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.copyToClipboard(__VLS_ctx.bankInfo.accountNumber);
            // @ts-ignore
            [bankInfo, copyToClipboard,];
        } },
    ...{ class: "copy-button" },
    title: "複製帳戶號碼",
});
__VLS_asFunctionalElement(__VLS_elements.svg, __VLS_elements.svg)({
    ...{ class: "w-4 h-4" },
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24",
});
__VLS_asFunctionalElement(__VLS_elements.path, __VLS_elements.path)({
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
    'stroke-width': "2",
    d: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z",
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "detail-item" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "detail-label" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "detail-value-container" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "detail-value" },
});
(__VLS_ctx.bankInfo.accountName);
// @ts-ignore
[bankInfo,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.copyToClipboard(__VLS_ctx.bankInfo.accountName);
            // @ts-ignore
            [bankInfo, copyToClipboard,];
        } },
    ...{ class: "copy-button" },
    title: "複製戶名",
});
__VLS_asFunctionalElement(__VLS_elements.svg, __VLS_elements.svg)({
    ...{ class: "w-4 h-4" },
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24",
});
__VLS_asFunctionalElement(__VLS_elements.path, __VLS_elements.path)({
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
    'stroke-width': "2",
    d: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2 2v8a2 2 0 002 2z",
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "instructions-section" },
});
__VLS_asFunctionalElement(__VLS_elements.h4, __VLS_elements.h4)({
    ...{ class: "section-title" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "instructions-list" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "instruction-item" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "instruction-step" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "instruction-content" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "instruction-title" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "instruction-description" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "instruction-item" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "instruction-step" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "instruction-content" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "instruction-title" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "instruction-description" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "instruction-item" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "instruction-step" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "instruction-content" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "instruction-title" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "instruction-description" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "highlight-text" },
});
(__VLS_ctx.orderReference);
// @ts-ignore
[orderReference,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "instruction-item" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "instruction-step" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "instruction-content" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "instruction-title" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "instruction-description" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "notice-section" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "notice-header" },
});
__VLS_asFunctionalElement(__VLS_elements.svg, __VLS_elements.svg)({
    ...{ class: "w-5 h-5 text-amber-500" },
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24",
});
__VLS_asFunctionalElement(__VLS_elements.path, __VLS_elements.path)({
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
    'stroke-width': "2",
    d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z",
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "notice-title" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "notice-content" },
});
__VLS_asFunctionalElement(__VLS_elements.ul, __VLS_elements.ul)({
    ...{ class: "notice-list" },
});
__VLS_asFunctionalElement(__VLS_elements.li, __VLS_elements.li)({});
__VLS_asFunctionalElement(__VLS_elements.li, __VLS_elements.li)({});
__VLS_asFunctionalElement(__VLS_elements.li, __VLS_elements.li)({});
(__VLS_ctx.processingTime);
// @ts-ignore
[processingTime,];
__VLS_asFunctionalElement(__VLS_elements.li, __VLS_elements.li)({});
if (__VLS_ctx.showQRCode && __VLS_ctx.bankInfo.qrCode) {
    // @ts-ignore
    [bankInfo, showQRCode,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "qr-section" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h4, __VLS_elements.h4)({
        ...{ class: "section-title" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "qr-container" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "qr-code" },
    });
    __VLS_asFunctionalElement(__VLS_elements.img)({
        src: (__VLS_ctx.bankInfo.qrCode),
        alt: (`${__VLS_ctx.bankInfo.bankName} QR Code`),
        ...{ class: "qr-image" },
    });
    // @ts-ignore
    [bankInfo, bankInfo,];
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "qr-description" },
    });
}
const __VLS_0 = {}.Transition;
/** @type {[typeof __VLS_components.Transition, typeof __VLS_components.Transition, ]} */ ;
// @ts-ignore
Transition;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    name: "toast",
}));
const __VLS_2 = __VLS_1({
    name: "toast",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_4 } = __VLS_3.slots;
if (__VLS_ctx.showCopyToast) {
    // @ts-ignore
    [showCopyToast,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "copy-toast" },
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
        d: "M5 13l4 4L19 7",
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
}
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['bank-transfer-info']} */ ;
/** @type {__VLS_StyleScopedClasses['info-header']} */ ;
/** @type {__VLS_StyleScopedClasses['bank-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['info-title']} */ ;
/** @type {__VLS_StyleScopedClasses['title-text']} */ ;
/** @type {__VLS_StyleScopedClasses['title-description']} */ ;
/** @type {__VLS_StyleScopedClasses['transfer-details']} */ ;
/** @type {__VLS_StyleScopedClasses['bank-details-section']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-label']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-value-container']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-value']} */ ;
/** @type {__VLS_StyleScopedClasses['copy-button']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-label']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-value-container']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-value']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['copy-button']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-label']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-value-container']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-value']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['copy-button']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-label']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-value-container']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-value']} */ ;
/** @type {__VLS_StyleScopedClasses['copy-button']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['instructions-section']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['instructions-list']} */ ;
/** @type {__VLS_StyleScopedClasses['instruction-item']} */ ;
/** @type {__VLS_StyleScopedClasses['instruction-step']} */ ;
/** @type {__VLS_StyleScopedClasses['instruction-content']} */ ;
/** @type {__VLS_StyleScopedClasses['instruction-title']} */ ;
/** @type {__VLS_StyleScopedClasses['instruction-description']} */ ;
/** @type {__VLS_StyleScopedClasses['instruction-item']} */ ;
/** @type {__VLS_StyleScopedClasses['instruction-step']} */ ;
/** @type {__VLS_StyleScopedClasses['instruction-content']} */ ;
/** @type {__VLS_StyleScopedClasses['instruction-title']} */ ;
/** @type {__VLS_StyleScopedClasses['instruction-description']} */ ;
/** @type {__VLS_StyleScopedClasses['instruction-item']} */ ;
/** @type {__VLS_StyleScopedClasses['instruction-step']} */ ;
/** @type {__VLS_StyleScopedClasses['instruction-content']} */ ;
/** @type {__VLS_StyleScopedClasses['instruction-title']} */ ;
/** @type {__VLS_StyleScopedClasses['instruction-description']} */ ;
/** @type {__VLS_StyleScopedClasses['highlight-text']} */ ;
/** @type {__VLS_StyleScopedClasses['instruction-item']} */ ;
/** @type {__VLS_StyleScopedClasses['instruction-step']} */ ;
/** @type {__VLS_StyleScopedClasses['instruction-content']} */ ;
/** @type {__VLS_StyleScopedClasses['instruction-title']} */ ;
/** @type {__VLS_StyleScopedClasses['instruction-description']} */ ;
/** @type {__VLS_StyleScopedClasses['notice-section']} */ ;
/** @type {__VLS_StyleScopedClasses['notice-header']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-amber-500']} */ ;
/** @type {__VLS_StyleScopedClasses['notice-title']} */ ;
/** @type {__VLS_StyleScopedClasses['notice-content']} */ ;
/** @type {__VLS_StyleScopedClasses['notice-list']} */ ;
/** @type {__VLS_StyleScopedClasses['qr-section']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['qr-container']} */ ;
/** @type {__VLS_StyleScopedClasses['qr-code']} */ ;
/** @type {__VLS_StyleScopedClasses['qr-image']} */ ;
/** @type {__VLS_StyleScopedClasses['qr-description']} */ ;
/** @type {__VLS_StyleScopedClasses['copy-toast']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-500']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        showCopyToast: showCopyToast,
        bankInfo: bankInfo,
        processingTime: processingTime,
        copyToClipboard: copyToClipboard,
    }),
    __typeProps: {},
    props: {},
});
export default (await import('vue')).defineComponent({
    __typeProps: {},
    props: {},
});
; /* PartiallyEnd: #4569/main.vue */

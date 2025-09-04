import { ref, computed, onMounted, onUnmounted } from 'vue';
import { WifiIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import { errorHandler } from '@/utils/errorHandler';
const props = withDefaults(defineProps(), {
    showConnectionIndicator: true,
    showOfflineSupport: true,
    enableRecoveryPanel: true,
    position: 'top-right'
});
// 響應式狀態
const isConnected = ref(navigator.onLine);
const isSSEConnected = ref(false);
const showConnectionStatus = ref(false);
const showOfflineBanner = ref(false);
const showPendingRequests = ref(false);
const showRecoveryPanel = ref(false);
const showErrorStats = ref(false);
const pendingRequests = ref(0);
const pendingRequestsList = ref([]);
const errorStats = ref({});
const isDevelopment = ref(import.meta.env.DEV);
// 計算屬性
const connectionStatusClass = computed(() => {
    if (isConnected.value && isSSEConnected.value) {
        return 'bg-green-500 text-white';
    }
    else if (isConnected.value) {
        return 'bg-yellow-500 text-white';
    }
    else {
        return 'bg-red-500 text-white';
    }
});
const connectionStatusText = computed(() => {
    if (isConnected.value && isSSEConnected.value) {
        return '連接正常';
    }
    else if (isConnected.value) {
        return '實時連接中斷';
    }
    else {
        return '網絡已斷開';
    }
});
const offlineMessage = computed(() => {
    if (pendingRequests.value > 0) {
        return `離線模式 - ${pendingRequests.value} 個請求等待處理`;
    }
    return '離線模式 - 某些功能可能受限';
});
const canReconnect = computed(() => {
    return isConnected.value && !isSSEConnected.value;
});
const totalErrors = computed(() => {
    return Object.values(errorStats.value).reduce((sum, count) => sum + count, 0);
});
// 方法
const handleReconnect = () => {
    // 觸發重連事件
    window.dispatchEvent(new CustomEvent('manual-reconnect'));
};
const handleClearCache = () => {
    try {
        // 清理 localStorage
        const keysToKeep = ['auth_token', 'user_preferences'];
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (!keysToKeep.includes(key)) {
                localStorage.removeItem(key);
            }
        });
        // 清理 sessionStorage
        sessionStorage.clear();
        // Clear application cache if method exists
        if ('clearCache' in errorHandler && typeof errorHandler.clearCache === 'function') {
            errorHandler.clearCache();
        }
        alert('緩存已清理，請刷新頁面');
    }
    catch (error) {
        console.error('清理緩存失敗:', error);
        alert('清理緩存失敗');
    }
};
const handleRefreshPage = () => {
    window.location.reload();
};
const handleResetSettings = () => {
    if (confirm('確定要重置所有設定嗎？這將清除您的偏好設定但不會影響登入狀態。')) {
        const authToken = localStorage.getItem('auth_token');
        localStorage.clear();
        if (authToken) {
            localStorage.setItem('auth_token', authToken);
        }
        sessionStorage.clear();
        window.location.reload();
    }
};
const handleReportProblem = () => {
    const errorInfo = {
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        errorStats: errorStats.value,
        isOnline: isConnected.value,
        isSSEConnected: isSSEConnected.value
    };
    // 在實際應用中，這裡應該打開問題回報表單或發送錯誤報告
    console.log('錯誤報告信息:', errorInfo);
    alert('錯誤報告功能尚未實現。請聯繫技術支援。');
};
const clearErrorStats = () => {
    errorStats.value = {};
};
const updateErrorStats = (errorType) => {
    errorStats.value[errorType] = (errorStats.value[errorType] || 0) + 1;
};
// 事件監聽器
const handleOnlineStatusChange = () => {
    const wasOffline = !isConnected.value;
    isConnected.value = navigator.onLine;
    if (wasOffline && isConnected.value) {
        // 從離線恢復到在線
        showOfflineBanner.value = false;
        showConnectionStatus.value = true;
        setTimeout(() => {
            showConnectionStatus.value = false;
        }, 3000);
    }
    else if (!isConnected.value) {
        // 變為離線狀態
        showOfflineBanner.value = props.showOfflineSupport;
    }
};
const handleSSEStatusChange = (event) => {
    isSSEConnected.value = event.detail.connected;
    if (props.showConnectionIndicator) {
        showConnectionStatus.value = true;
        setTimeout(() => {
            if (isConnected.value && isSSEConnected.value) {
                showConnectionStatus.value = false;
            }
        }, 3000);
    }
};
const handleErrorOccurred = (event) => {
    const errorType = event.detail.type || 'unknown';
    updateErrorStats(errorType);
    // 如果錯誤比較嚴重，顯示恢復面板
    if (props.enableRecoveryPanel &&
        (errorType === 'critical' || totalErrors.value > 5)) {
        showRecoveryPanel.value = true;
    }
};
const handlePendingRequestsChange = (event) => {
    pendingRequests.value = event.detail.count;
    pendingRequestsList.value = event.detail.requests || [];
};
// 生命週期
onMounted(() => {
    // 監聽網絡狀態變化
    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);
    // 監聽 SSE 狀態變化
    window.addEventListener('sse-status-change', handleSSEStatusChange);
    // 監聽錯誤事件
    window.addEventListener('error-occurred', handleErrorOccurred);
    // 監聽待處理請求變化
    window.addEventListener('pending-requests-change', handlePendingRequestsChange);
    // 初始狀態檢查
    handleOnlineStatusChange();
    // 開發模式下顯示錯誤統計
    if (isDevelopment.value) {
        // 雙擊右下角顯示錯誤統計
        document.addEventListener('dblclick', (event) => {
            if (event.clientX > window.innerWidth - 100 &&
                event.clientY > window.innerHeight - 100) {
                showErrorStats.value = !showErrorStats.value;
            }
        });
    }
});
onUnmounted(() => {
    window.removeEventListener('online', handleOnlineStatusChange);
    window.removeEventListener('offline', handleOnlineStatusChange);
    window.removeEventListener('sse-status-change', handleSSEStatusChange);
    window.removeEventListener('error-occurred', handleErrorOccurred);
    window.removeEventListener('pending-requests-change', handlePendingRequestsChange);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    showConnectionIndicator: true,
    showOfflineSupport: true,
    enableRecoveryPanel: true,
    position: 'top-right'
});
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
const __VLS_0 = {}.Teleport;
/** @type {[typeof __VLS_components.Teleport, typeof __VLS_components.Teleport, ]} */ 
// @ts-ignore
Teleport;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    to: "body",
}));
const __VLS_2 = __VLS_1({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_4 } = __VLS_3.slots;
if (__VLS_ctx.showOfflineBanner) {
    // @ts-ignore
    [showOfflineBanner,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white p-2 text-center text-sm font-medium" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center justify-center space-x-2" },
    });
    const __VLS_5 = {}.WifiIcon;
    /** @type {[typeof __VLS_components.WifiIcon, ]} */ 
    // @ts-ignore
    WifiIcon;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
        ...{ class: "w-4 h-4" },
    }));
    const __VLS_7 = __VLS_6({
        ...{ class: "w-4 h-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    (__VLS_ctx.offlineMessage);
    // @ts-ignore
    [offlineMessage,];
    if (__VLS_ctx.pendingRequests > 0) {
        // @ts-ignore
        [pendingRequests,];
        __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showOfflineBanner))
                        return;
                    if (!(__VLS_ctx.pendingRequests > 0))
                        return;
                    __VLS_ctx.showPendingRequests = !__VLS_ctx.showPendingRequests;
                    // @ts-ignore
                    [showPendingRequests, showPendingRequests,];
                } },
            ...{ class: "text-yellow-100 hover:text-white underline" },
        });
        (__VLS_ctx.pendingRequests);
        // @ts-ignore
        [pendingRequests,];
    }
}
if (__VLS_ctx.showConnectionStatus) {
    // @ts-ignore
    [showConnectionStatus,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: ([
                'fixed top-4 right-4 z-40 px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2 text-sm font-medium transition-all duration-300',
                __VLS_ctx.connectionStatusClass
            ]) },
    });
    // @ts-ignore
    [connectionStatusClass,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: ([
                'w-2 h-2 rounded-full',
                __VLS_ctx.isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
            ]) },
    });
    // @ts-ignore
    [isConnected,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    (__VLS_ctx.connectionStatusText);
    // @ts-ignore
    [connectionStatusText,];
    if (!__VLS_ctx.isConnected && __VLS_ctx.canReconnect) {
        // @ts-ignore
        [isConnected, canReconnect,];
        __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
            ...{ onClick: (__VLS_ctx.handleReconnect) },
            ...{ class: "text-xs bg-white bg-opacity-20 px-2 py-1 rounded hover:bg-opacity-30" },
        });
        // @ts-ignore
        [handleReconnect,];
    }
}
if (__VLS_ctx.showPendingRequests && __VLS_ctx.pendingRequests > 0) {
    // @ts-ignore
    [pendingRequests, showPendingRequests,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "fixed top-12 right-4 z-40 w-80 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "p-4 bg-yellow-50 border-b border-yellow-200" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center justify-between" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
        ...{ class: "font-semibold text-gray-900" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showPendingRequests && __VLS_ctx.pendingRequests > 0))
                    return;
                __VLS_ctx.showPendingRequests = false;
                // @ts-ignore
                [showPendingRequests,];
            } },
        ...{ class: "text-gray-400 hover:text-gray-600" },
    });
    const __VLS_10 = {}.XMarkIcon;
    /** @type {[typeof __VLS_components.XMarkIcon, ]} */ 
    // @ts-ignore
    XMarkIcon;
    // @ts-ignore
    const __VLS_11 = __VLS_asFunctionalComponent(__VLS_10, new __VLS_10({
        ...{ class: "w-5 h-5" },
    }));
    const __VLS_12 = __VLS_11({
        ...{ class: "w-5 h-5" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_11));
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-sm text-gray-600 mt-1" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "max-h-64 overflow-y-auto" },
    });
    for (const [request, index] of __VLS_getVForSourceType((__VLS_ctx.pendingRequestsList))) {
        // @ts-ignore
        [pendingRequestsList,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            key: (index),
            ...{ class: "p-3 border-b border-gray-100 last:border-b-0" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "flex items-center justify-between" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
        __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
            ...{ class: "text-sm font-medium text-gray-900" },
        });
        (request.method);
        (request.url);
        __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
            ...{ class: "text-xs text-gray-500" },
        });
        (request.timestamp);
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "flex items-center space-x-2" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "w-2 h-2 bg-yellow-400 rounded-full animate-pulse" },
        });
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "text-xs text-gray-500" },
        });
    }
}
if (__VLS_ctx.showRecoveryPanel) {
    // @ts-ignore
    [showRecoveryPanel,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "fixed bottom-4 right-4 z-40 w-96 bg-white rounded-lg shadow-2xl border border-red-200 overflow-hidden" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "p-4 bg-red-50 border-b border-red-200" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center justify-between" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center space-x-2" },
    });
    const __VLS_15 = {}.ExclamationTriangleIcon;
    /** @type {[typeof __VLS_components.ExclamationTriangleIcon, ]} */ 
    // @ts-ignore
    ExclamationTriangleIcon;
    // @ts-ignore
    const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({
        ...{ class: "w-5 h-5 text-red-600" },
    }));
    const __VLS_17 = __VLS_16({
        ...{ class: "w-5 h-5 text-red-600" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_16));
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
        ...{ class: "font-semibold text-red-900" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showRecoveryPanel))
                    return;
                __VLS_ctx.showRecoveryPanel = false;
                // @ts-ignore
                [showRecoveryPanel,];
            } },
        ...{ class: "text-red-400 hover:text-red-600" },
    });
    const __VLS_20 = {}.XMarkIcon;
    /** @type {[typeof __VLS_components.XMarkIcon, ]} */ 
    // @ts-ignore
    XMarkIcon;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
        ...{ class: "w-5 h-5" },
    }));
    const __VLS_22 = __VLS_21({
        ...{ class: "w-5 h-5" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "p-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-sm text-gray-700 mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "space-y-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.handleClearCache) },
        ...{ class: "w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-md" },
    });
    // @ts-ignore
    [handleClearCache,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.handleRefreshPage) },
        ...{ class: "w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-md" },
    });
    // @ts-ignore
    [handleRefreshPage,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.handleResetSettings) },
        ...{ class: "w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-md" },
    });
    // @ts-ignore
    [handleResetSettings,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.handleReportProblem) },
        ...{ class: "w-full text-left px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 rounded-md text-blue-700" },
    });
    // @ts-ignore
    [handleReportProblem,];
}
if (__VLS_ctx.isDevelopment && __VLS_ctx.showErrorStats) {
    // @ts-ignore
    [isDevelopment, showErrorStats,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "fixed bottom-4 left-4 z-40 w-80 bg-gray-900 text-white rounded-lg shadow-2xl overflow-hidden" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "p-3 bg-gray-800 border-b border-gray-700" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center justify-between" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
        ...{ class: "font-semibold text-sm" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isDevelopment && __VLS_ctx.showErrorStats))
                    return;
                __VLS_ctx.showErrorStats = false;
                // @ts-ignore
                [showErrorStats,];
            } },
        ...{ class: "text-gray-400 hover:text-gray-200" },
    });
    const __VLS_25 = {}.XMarkIcon;
    /** @type {[typeof __VLS_components.XMarkIcon, ]} */ 
    // @ts-ignore
    XMarkIcon;
    // @ts-ignore
    const __VLS_26 = __VLS_asFunctionalComponent(__VLS_25, new __VLS_25({
        ...{ class: "w-4 h-4" },
    }));
    const __VLS_27 = __VLS_26({
        ...{ class: "w-4 h-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_26));
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "p-3 text-xs space-y-2" },
    });
    for (const [count, type] of __VLS_getVForSourceType((__VLS_ctx.errorStats))) {
        // @ts-ignore
        [errorStats,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            key: (type),
            ...{ class: "flex justify-between" },
        });
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "capitalize" },
        });
        (type);
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "font-mono" },
        });
        (count);
    }
    __VLS_asFunctionalElement(__VLS_elements.hr)({
        ...{ class: "border-gray-700" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex justify-between" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "font-mono font-bold" },
    });
    (__VLS_ctx.totalErrors);
    // @ts-ignore
    [totalErrors,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.clearErrorStats) },
        ...{ class: "w-full mt-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs" },
    });
    // @ts-ignore
    [clearErrorStats,];
}
let __VLS_3;
/** @type {__VLS_StyleScopedClasses['fixed']} */ 
/** @type {__VLS_StyleScopedClasses['top-0']} */ 
/** @type {__VLS_StyleScopedClasses['left-0']} */ 
/** @type {__VLS_StyleScopedClasses['right-0']} */ 
/** @type {__VLS_StyleScopedClasses['z-50']} */ 
/** @type {__VLS_StyleScopedClasses['bg-yellow-500']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['p-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-center']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-yellow-100']} */ 
/** @type {__VLS_StyleScopedClasses['hover:text-white']} */ 
/** @type {__VLS_StyleScopedClasses['underline']} */ 
/** @type {__VLS_StyleScopedClasses['fixed']} */ 
/** @type {__VLS_StyleScopedClasses['top-4']} */ 
/** @type {__VLS_StyleScopedClasses['right-4']} */ 
/** @type {__VLS_StyleScopedClasses['z-40']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['transition-all']} */ 
/** @type {__VLS_StyleScopedClasses['duration-300']} */ 
/** @type {__VLS_StyleScopedClasses['w-2']} */ 
/** @type {__VLS_StyleScopedClasses['h-2']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['bg-opacity-20']} */ 
/** @type {__VLS_StyleScopedClasses['px-2']} */ 
/** @type {__VLS_StyleScopedClasses['py-1']} */ 
/** @type {__VLS_StyleScopedClasses['rounded']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-opacity-30']} */ 
/** @type {__VLS_StyleScopedClasses['fixed']} */ 
/** @type {__VLS_StyleScopedClasses['top-12']} */ 
/** @type {__VLS_StyleScopedClasses['right-4']} */ 
/** @type {__VLS_StyleScopedClasses['z-40']} */ 
/** @type {__VLS_StyleScopedClasses['w-80']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['shadow-2xl']} */ 
/** @type {__VLS_StyleScopedClasses['border']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ 
/** @type {__VLS_StyleScopedClasses['p-4']} */ 
/** @type {__VLS_StyleScopedClasses['bg-yellow-50']} */ 
/** @type {__VLS_StyleScopedClasses['border-b']} */ 
/** @type {__VLS_StyleScopedClasses['border-yellow-200']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ 
/** @type {__VLS_StyleScopedClasses['hover:text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['w-5']} */ 
/** @type {__VLS_StyleScopedClasses['h-5']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['mt-1']} */ 
/** @type {__VLS_StyleScopedClasses['max-h-64']} */ 
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ 
/** @type {__VLS_StyleScopedClasses['p-3']} */ 
/** @type {__VLS_StyleScopedClasses['border-b']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-100']} */ 
/** @type {__VLS_StyleScopedClasses['last:border-b-0']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ 
/** @type {__VLS_StyleScopedClasses['w-2']} */ 
/** @type {__VLS_StyleScopedClasses['h-2']} */ 
/** @type {__VLS_StyleScopedClasses['bg-yellow-400']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-pulse']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['fixed']} */ 
/** @type {__VLS_StyleScopedClasses['bottom-4']} */ 
/** @type {__VLS_StyleScopedClasses['right-4']} */ 
/** @type {__VLS_StyleScopedClasses['z-40']} */ 
/** @type {__VLS_StyleScopedClasses['w-96']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['shadow-2xl']} */ 
/** @type {__VLS_StyleScopedClasses['border']} */ 
/** @type {__VLS_StyleScopedClasses['border-red-200']} */ 
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ 
/** @type {__VLS_StyleScopedClasses['p-4']} */ 
/** @type {__VLS_StyleScopedClasses['bg-red-50']} */ 
/** @type {__VLS_StyleScopedClasses['border-b']} */ 
/** @type {__VLS_StyleScopedClasses['border-red-200']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ 
/** @type {__VLS_StyleScopedClasses['w-5']} */ 
/** @type {__VLS_StyleScopedClasses['h-5']} */ 
/** @type {__VLS_StyleScopedClasses['text-red-600']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-red-900']} */ 
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ 
/** @type {__VLS_StyleScopedClasses['hover:text-red-600']} */ 
/** @type {__VLS_StyleScopedClasses['w-5']} */ 
/** @type {__VLS_StyleScopedClasses['h-5']} */ 
/** @type {__VLS_StyleScopedClasses['p-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ 
/** @type {__VLS_StyleScopedClasses['mb-4']} */ 
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ 
/** @type {__VLS_StyleScopedClasses['w-full']} */ 
/** @type {__VLS_StyleScopedClasses['text-left']} */ 
/** @type {__VLS_StyleScopedClasses['px-3']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-100']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ 
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ 
/** @type {__VLS_StyleScopedClasses['px-3']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-100']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ 
/** @type {__VLS_StyleScopedClasses['w-full']} */ 
/** @type {__VLS_StyleScopedClasses['text-left']} */ 
/** @type {__VLS_StyleScopedClasses['px-3']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-100']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ 
/** @type {__VLS_StyleScopedClasses['w-full']} */ 
/** @type {__VLS_StyleScopedClasses['text-left']} */ 
/** @type {__VLS_StyleScopedClasses['px-3']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['bg-blue-50']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-blue-100']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ 
/** @type {__VLS_StyleScopedClasses['text-blue-700']} */ 
/** @type {__VLS_StyleScopedClasses['fixed']} */ 
/** @type {__VLS_StyleScopedClasses['bottom-4']} */ 
/** @type {__VLS_StyleScopedClasses['left-4']} */ 
/** @type {__VLS_StyleScopedClasses['z-40']} */ 
/** @type {__VLS_StyleScopedClasses['w-80']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['shadow-2xl']} */ 
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ 
/** @type {__VLS_StyleScopedClasses['p-3']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ 
/** @type {__VLS_StyleScopedClasses['border-b']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ 
/** @type {__VLS_StyleScopedClasses['hover:text-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['p-3']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['capitalize']} */ 
/** @type {__VLS_StyleScopedClasses['font-mono']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['font-mono']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['w-full']} */ 
/** @type {__VLS_StyleScopedClasses['mt-2']} */ 
/** @type {__VLS_StyleScopedClasses['py-1']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-700']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['rounded']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
let __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        WifiIcon: WifiIcon,
        ExclamationTriangleIcon: ExclamationTriangleIcon,
        XMarkIcon: XMarkIcon,
        isConnected: isConnected,
        showConnectionStatus: showConnectionStatus,
        showOfflineBanner: showOfflineBanner,
        showPendingRequests: showPendingRequests,
        showRecoveryPanel: showRecoveryPanel,
        showErrorStats: showErrorStats,
        pendingRequests: pendingRequests,
        pendingRequestsList: pendingRequestsList,
        errorStats: errorStats,
        isDevelopment: isDevelopment,
        connectionStatusClass: connectionStatusClass,
        connectionStatusText: connectionStatusText,
        offlineMessage: offlineMessage,
        canReconnect: canReconnect,
        totalErrors: totalErrors,
        handleReconnect: handleReconnect,
        handleClearCache: handleClearCache,
        handleRefreshPage: handleRefreshPage,
        handleResetSettings: handleResetSettings,
        handleReportProblem: handleReportProblem,
        clearErrorStats: clearErrorStats,
    }),
    __typeProps: {},
    props: {},
});
export default (await import('vue')).defineComponent({
    __typeProps: {},
    props: {},
});
 /* PartiallyEnd: #4569/main.vue */

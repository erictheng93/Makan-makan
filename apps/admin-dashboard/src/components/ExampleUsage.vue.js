import { ref, onMounted, onUnmounted } from 'vue';
import { KitchenErrorHandler } from '@/utils/errorHandler';
import { useStatisticsSSE } from '@/composables/useStatisticsSSE';
import { api } from '@/services/api';
// SSE 連接狀態
const sse = useStatisticsSSE({ autoConnect: false });
const sseStatus = ref({
    isConnected: false
});
// 網絡狀態
const isOnline = ref(navigator.onLine);
// 錯誤日誌
const errorLogs = ref([]);
// API 錯誤測試方法
const testNetworkError = async () => {
    try {
        // 模擬網絡錯誤
        const error = new Error('Network connection failed');
        error.name = 'NetworkError';
        throw error;
    }
    catch (error) {
        KitchenErrorHandler.handleAPIError(error, { context: 'Manual network error test' });
        addErrorLog('network', 'high', '網絡連接失敗');
    }
};
const testAPIError = async () => {
    try {
        // 發送一個會失敗的 API 請求
        await api.get('/non-existent-endpoint');
    }
    catch (error) {
        addErrorLog('api', 'medium', 'API 端點不存在');
    }
};
const testAuthError = async () => {
    try {
        // 模擬認證錯誤
        const error = new Error('Authentication failed');
        Object.assign(error, {
            response: {
                status: 401,
                data: { error: { message: 'Token expired' } }
            }
        });
        throw error;
    }
    catch (error) {
        KitchenErrorHandler.handleAPIError(error, { context: 'Manual auth error test' });
        addErrorLog('permission', 'high', '認證令牌已過期');
    }
};
// SSE 測試方法
const toggleSSE = () => {
    if (sseStatus.value.isConnected) {
        sse.disconnect();
        sseStatus.value.isConnected = false;
    }
    else {
        sse.connect();
        sseStatus.value.isConnected = true;
    }
};
const forceSSEReconnect = () => {
    sse.reconnect();
    addErrorLog('sse', 'low', 'SSE 強制重連');
};
// 離線模式測試
const simulateOffline = () => {
    // 模擬離線狀態（僅用於演示）
    isOnline.value = !isOnline.value;
    // 觸發離線/在線事件
    if (isOnline.value) {
        window.dispatchEvent(new Event('online'));
    }
    else {
        window.dispatchEvent(new Event('offline'));
    }
    addErrorLog('network', 'medium', isOnline.value ? '網絡已恢復' : '網絡已斷開');
};
const testOfflineRequest = async () => {
    if (!isOnline.value) {
        try {
            // 在離線狀態下嘗試 API 請求
            await api.get('/analytics/dashboard', {
                offlineStrategy: 'queue'
            });
        }
        catch (error) {
            addErrorLog('network', 'medium', '離線請求已排隊');
        }
    }
    else {
        addErrorLog('info', 'low', '當前處於在線狀態');
    }
};
// 工具方法
const addErrorLog = (type, severity, message) => {
    errorLogs.value.unshift({
        type,
        severity,
        message,
        timestamp: new Date()
    });
    // 限制日誌數量
    if (errorLogs.value.length > 50) {
        errorLogs.value = errorLogs.value.slice(0, 50);
    }
};
const clearErrorLogs = () => {
    errorLogs.value = [];
};
const formatTime = (timestamp) => {
    return timestamp.toLocaleTimeString();
};
// 監聽網絡狀態變化
const handleOnlineStatusChange = () => {
    isOnline.value = navigator.onLine;
};
// 監聽 SSE 狀態變化
const handleSSEStatusChange = () => {
    sseStatus.value.isConnected = sse.isConnected.value;
};
onMounted(() => {
    // 監聽網絡狀態
    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);
    // 監聽 SSE 狀態變化
    setInterval(handleSSEStatusChange, 1000);
});
onUnmounted(() => {
    window.removeEventListener('online', handleOnlineStatusChange);
    window.removeEventListener('offline', handleOnlineStatusChange);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "space-y-4 p-6" },
});
__VLS_asFunctionalElement(__VLS_elements.h2, __VLS_elements.h2)({
    ...{ class: "text-xl font-bold" },
});
const __VLS_0 = {}.ErrorDisplay;
/** @type {[typeof __VLS_components.ErrorDisplay, ]} */ ;
// @ts-ignore
ErrorDisplay;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    showConnectionIndicator: (true),
    showOfflineSupport: (true),
    enableRecoveryPanel: (true),
    position: "top-right",
}));
const __VLS_2 = __VLS_1({
    showConnectionIndicator: (true),
    showOfflineSupport: (true),
    enableRecoveryPanel: (true),
    position: "top-right",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-white rounded-lg shadow p-4" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
    ...{ class: "font-semibold mb-3" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "space-y-2" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.testNetworkError) },
    ...{ class: "w-full px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600" },
});
// @ts-ignore
[testNetworkError,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.testAPIError) },
    ...{ class: "w-full px-3 py-2 bg-orange-500 text-white rounded hover:bg-orange-600" },
});
// @ts-ignore
[testAPIError,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.testAuthError) },
    ...{ class: "w-full px-3 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600" },
});
// @ts-ignore
[testAuthError,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-white rounded-lg shadow p-4" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
    ...{ class: "font-semibold mb-3" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "space-y-2" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-2" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: ([
            'w-3 h-3 rounded-full',
            __VLS_ctx.sseStatus.isConnected ? 'bg-green-500' : 'bg-red-500'
        ]) },
});
// @ts-ignore
[sseStatus,];
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "text-sm" },
});
(__VLS_ctx.sseStatus.isConnected ? '已連接' : '已斷開');
// @ts-ignore
[sseStatus,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.toggleSSE) },
    ...{ class: "w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" },
});
// @ts-ignore
[toggleSSE,];
(__VLS_ctx.sseStatus.isConnected ? '斷開 SSE' : '連接 SSE');
// @ts-ignore
[sseStatus,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.forceSSEReconnect) },
    ...{ class: "w-full px-3 py-2 bg-purple-500 text-white rounded hover:bg-purple-600" },
});
// @ts-ignore
[forceSSEReconnect,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-white rounded-lg shadow p-4" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
    ...{ class: "font-semibold mb-3" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "space-y-2" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-2" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: ([
            'w-3 h-3 rounded-full',
            __VLS_ctx.isOnline ? 'bg-green-500' : 'bg-red-500'
        ]) },
});
// @ts-ignore
[isOnline,];
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "text-sm" },
});
(__VLS_ctx.isOnline ? '在線' : '離線');
// @ts-ignore
[isOnline,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.simulateOffline) },
    ...{ class: "w-full px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600" },
});
// @ts-ignore
[simulateOffline,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.testOfflineRequest) },
    ...{ class: "w-full px-3 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600" },
});
// @ts-ignore
[testOfflineRequest,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-gray-50 rounded-lg p-4" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
    ...{ class: "font-semibold mb-3" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "max-h-64 overflow-y-auto space-y-1" },
});
for (const [log, index] of __VLS_getVForSourceType((__VLS_ctx.errorLogs))) {
    // @ts-ignore
    [errorLogs,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        key: (index),
        ...{ class: "text-xs font-mono p-2 bg-white rounded border-l-4" },
        ...{ class: ({
                'border-red-500': log.severity === 'high' || log.severity === 'critical',
                'border-yellow-500': log.severity === 'medium',
                'border-blue-500': log.severity === 'low'
            }) },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex justify-between items-start" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "font-semibold" },
    });
    (log.type);
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "text-gray-500" },
    });
    (__VLS_ctx.formatTime(log.timestamp));
    // @ts-ignore
    [formatTime,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-gray-700" },
    });
    (log.message);
}
if (__VLS_ctx.errorLogs.length === 0) {
    // @ts-ignore
    [errorLogs,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-gray-500 text-center py-4" },
    });
}
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.clearErrorLogs) },
    ...{ class: "mt-2 px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm" },
});
// @ts-ignore
[clearErrorLogs,];
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-3']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-red-600']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-orange-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-orange-600']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-yellow-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-yellow-600']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-purple-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-purple-600']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-indigo-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-indigo-600']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-64']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['border-l-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-red-500']} */ ;
/** @type {__VLS_StyleScopedClasses['border-yellow-500']} */ ;
/** @type {__VLS_StyleScopedClasses['border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        sseStatus: sseStatus,
        isOnline: isOnline,
        errorLogs: errorLogs,
        testNetworkError: testNetworkError,
        testAPIError: testAPIError,
        testAuthError: testAuthError,
        toggleSSE: toggleSSE,
        forceSSEReconnect: forceSSEReconnect,
        simulateOffline: simulateOffline,
        testOfflineRequest: testOfflineRequest,
        clearErrorLogs: clearErrorLogs,
        formatTime: formatTime,
    }),
});
export default (await import('vue')).defineComponent({});
; /* PartiallyEnd: #4569/main.vue */

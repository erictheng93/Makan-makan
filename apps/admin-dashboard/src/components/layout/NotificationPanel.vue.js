import { computed, ref, onMounted } from 'vue';
import { useNotificationStore } from '@/stores/notification';
import { useRouter } from 'vue-router';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { Bell, AlertTriangle, ShoppingCart, CheckCircle, Info, Clock, User } from 'lucide-vue-next';
const __VLS_emit = defineEmits();
const notificationStore = useNotificationStore();
const router = useRouter();
const isRefreshing = ref(false);
// 從 store 獲取數據
const notifications = computed(() => notificationStore.notifications);
const unreadCount = computed(() => notificationStore.unreadCount);
const soundEnabled = computed(() => notificationStore.soundEnabled);
// 按時間排序通知（未讀優先，然後按時間降序）
const sortedNotifications = computed(() => {
    return [...notifications.value].sort((a, b) => {
        if (a.read === b.read) {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return a.read ? 1 : -1;
    });
});
// 方法
const markAllAsRead = () => {
    notificationStore.markAllAsRead();
};
const clearAll = () => {
    if (confirm('確定要清除所有通知嗎？')) {
        notificationStore.clearAll();
    }
};
const toggleSound = () => {
    notificationStore.toggleSound();
};
const refreshNotifications = async () => {
    isRefreshing.value = true;
    // 模擬刷新
    setTimeout(() => {
        isRefreshing.value = false;
    }, 1000);
};
const markAsRead = (id) => {
    notificationStore.markAsRead(id);
};
const handleNotificationClick = (notification) => {
    if (!notification.read) {
        markAsRead(notification.id);
    }
    // 根據通知類型導航到相應頁面
    if (notification.type === 'order_new' || notification.type === 'order_urgent') {
        router.push('/dashboard/orders');
    }
    else if (notification.type === 'order_ready') {
        if (userCanAccessService()) {
            router.push('/service');
        }
        else {
            router.push('/dashboard/orders');
        }
    }
    else if (notification.type === 'system_alert') {
        router.push('/dashboard/analytics');
    }
};
const handleOrderAction = (notification, action) => {
    console.log('Handle order action:', action, notification);
    if (action === 'deliver') {
        router.push('/service');
    }
    else if (action === 'prioritize') {
        // 優先處理邏輯
        alert('已將訂單標記為優先處理');
        markAsRead(notification.id);
    }
};
const showAllNotifications = () => {
    router.push('/dashboard/notifications');
};
const hasActionButtons = (notification) => {
    return ['order_ready', 'order_urgent'].includes(notification.type);
};
const userCanAccessService = () => {
    // 檢查用戶是否有服務權限
    return true; // 簡化實現
};
// 通知圖標映射
const getNotificationIcon = (type) => {
    const iconMap = {
        'order_new': ShoppingCart,
        'order_urgent': AlertTriangle,
        'order_ready': CheckCircle,
        'system_alert': Info,
        'staff_update': User,
        'reminder': Clock
    };
    return iconMap[type] || Bell;
};
const getNotificationIconBg = (type) => {
    const bgMap = {
        'order_new': 'bg-blue-100',
        'order_urgent': 'bg-red-100',
        'order_ready': 'bg-green-100',
        'system_alert': 'bg-yellow-100',
        'staff_update': 'bg-purple-100',
        'reminder': 'bg-gray-100'
    };
    return bgMap[type] || 'bg-gray-100';
};
const getNotificationIconColor = (type) => {
    const colorMap = {
        'order_new': 'text-blue-600',
        'order_urgent': 'text-red-600',
        'order_ready': 'text-green-600',
        'system_alert': 'text-yellow-600',
        'staff_update': 'text-purple-600',
        'reminder': 'text-gray-600'
    };
    return colorMap[type] || 'text-gray-600';
};
const formatTime = (dateTime) => {
    const now = new Date();
    const diff = now.getTime() - dateTime.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1)
        return '剛剛';
    if (minutes < 60)
        return `${minutes} 分鐘前`;
    if (minutes < 24 * 60)
        return `${Math.floor(minutes / 60)} 小時前`;
    return format(dateTime, 'MM/dd HH:mm', { locale: zhTW });
};
onMounted(() => {
    notificationStore.initializeSoundSetting();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "fixed right-0 top-16 w-80 max-w-sm bg-white shadow-2xl z-50 border border-gray-200 rounded-bl-lg overflow-hidden" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-2" },
});
const __VLS_0 = {}.Bell;
/** @type {[typeof __VLS_components.Bell, ]} */ ;
// @ts-ignore
Bell;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: "w-5 h-5 text-gray-600" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "w-5 h-5 text-gray-600" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
    ...{ class: "text-sm font-semibold text-gray-900" },
});
if (__VLS_ctx.unreadCount > 0) {
    // @ts-ignore
    [unreadCount,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "bg-red-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[1.25rem] text-center" },
    });
    (__VLS_ctx.unreadCount > 99 ? '99+' : __VLS_ctx.unreadCount);
    // @ts-ignore
    [unreadCount, unreadCount,];
}
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('close');
            // @ts-ignore
            [$emit,];
        } },
    ...{ class: "text-gray-400 hover:text-gray-600 transition-colors" },
});
const __VLS_5 = {}.XMarkIcon;
/** @type {[typeof __VLS_components.XMarkIcon, ]} */ ;
// @ts-ignore
XMarkIcon;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
    ...{ class: "w-4 h-4" },
}));
const __VLS_7 = __VLS_6({
    ...{ class: "w-4 h-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between text-xs" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-3" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.markAllAsRead) },
    disabled: (__VLS_ctx.unreadCount === 0),
    ...{ class: "text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed" },
});
// @ts-ignore
[unreadCount, markAllAsRead,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.clearAll) },
    disabled: (__VLS_ctx.notifications.length === 0),
    ...{ class: "text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed" },
});
// @ts-ignore
[clearAll, notifications,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-2" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.toggleSound) },
    ...{ class: "p-1 rounded hover:bg-gray-200 transition-colors" },
});
// @ts-ignore
[toggleSound,];
if (__VLS_ctx.soundEnabled) {
    // @ts-ignore
    [soundEnabled,];
    const __VLS_10 = {}.SpeakerWaveIcon;
    /** @type {[typeof __VLS_components.SpeakerWaveIcon, ]} */ ;
    // @ts-ignore
    SpeakerWaveIcon;
    // @ts-ignore
    const __VLS_11 = __VLS_asFunctionalComponent(__VLS_10, new __VLS_10({
        ...{ class: "w-4 h-4 text-blue-600" },
    }));
    const __VLS_12 = __VLS_11({
        ...{ class: "w-4 h-4 text-blue-600" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_11));
}
else {
    const __VLS_15 = {}.SpeakerXMarkIcon;
    /** @type {[typeof __VLS_components.SpeakerXMarkIcon, ]} */ ;
    // @ts-ignore
    SpeakerXMarkIcon;
    // @ts-ignore
    const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({
        ...{ class: "w-4 h-4 text-gray-400" },
    }));
    const __VLS_17 = __VLS_16({
        ...{ class: "w-4 h-4 text-gray-400" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_16));
}
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.refreshNotifications) },
    ...{ class: "p-1 rounded hover:bg-gray-200 transition-colors" },
});
// @ts-ignore
[refreshNotifications,];
const __VLS_20 = {}.ArrowPathIcon;
/** @type {[typeof __VLS_components.ArrowPathIcon, ]} */ ;
// @ts-ignore
ArrowPathIcon;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    ...{ class: "w-4 h-4 text-gray-600" },
    ...{ class: ({ 'animate-spin': __VLS_ctx.isRefreshing }) },
}));
const __VLS_22 = __VLS_21({
    ...{ class: "w-4 h-4 text-gray-600" },
    ...{ class: ({ 'animate-spin': __VLS_ctx.isRefreshing }) },
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
// @ts-ignore
[isRefreshing,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "max-h-96 overflow-y-auto" },
});
if (__VLS_ctx.notifications.length === 0) {
    // @ts-ignore
    [notifications,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "p-8 text-center" },
    });
    const __VLS_25 = {}.Bell;
    /** @type {[typeof __VLS_components.Bell, ]} */ ;
    // @ts-ignore
    Bell;
    // @ts-ignore
    const __VLS_26 = __VLS_asFunctionalComponent(__VLS_25, new __VLS_25({
        ...{ class: "w-12 h-12 text-gray-300 mx-auto mb-3" },
    }));
    const __VLS_27 = __VLS_26({
        ...{ class: "w-12 h-12 text-gray-300 mx-auto mb-3" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_26));
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-gray-500 text-sm" },
    });
}
else {
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "divide-y divide-gray-100" },
    });
    for (const [notification] of __VLS_getVForSourceType((__VLS_ctx.sortedNotifications))) {
        // @ts-ignore
        [sortedNotifications,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.notifications.length === 0))
                        return;
                    __VLS_ctx.handleNotificationClick(notification);
                    // @ts-ignore
                    [handleNotificationClick,];
                } },
            key: (notification.id),
            ...{ class: "p-4 hover:bg-gray-50 cursor-pointer transition-colors" },
            ...{ class: ({ 'bg-blue-50 border-l-4 border-blue-500': !notification.read }) },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "flex items-start space-x-3" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "flex-shrink-0 mt-0.5" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: ([
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    __VLS_ctx.getNotificationIconBg(notification.type)
                ]) },
        });
        // @ts-ignore
        [getNotificationIconBg,];
        const __VLS_30 = ((__VLS_ctx.getNotificationIcon(notification.type)));
        // @ts-ignore
        const __VLS_31 = __VLS_asFunctionalComponent(__VLS_30, new __VLS_30({
            ...{ class: ([
                    'w-4 h-4',
                    __VLS_ctx.getNotificationIconColor(notification.type)
                ]) },
        }));
        const __VLS_32 = __VLS_31({
            ...{ class: ([
                    'w-4 h-4',
                    __VLS_ctx.getNotificationIconColor(notification.type)
                ]) },
        }, ...__VLS_functionalComponentArgsRest(__VLS_31));
        // @ts-ignore
        [getNotificationIcon, getNotificationIconColor,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "flex-1 min-w-0" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "flex items-center justify-between" },
        });
        __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
            ...{ class: "text-sm font-medium text-gray-900 truncate" },
        });
        (notification.title);
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "flex items-center space-x-2" },
        });
        if (!notification.read) {
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                ...{ class: "w-2 h-2 bg-blue-500 rounded-full" },
            });
        }
        __VLS_asFunctionalElement(__VLS_elements.time, __VLS_elements.time)({
            ...{ class: "text-xs text-gray-500 whitespace-nowrap" },
        });
        (__VLS_ctx.formatTime(notification.createdAt));
        // @ts-ignore
        [formatTime,];
        __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
            ...{ class: "text-sm text-gray-600 mt-1 line-clamp-2" },
        });
        (notification.message);
        if (notification.data) {
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "mt-2 text-xs text-gray-500" },
            });
            if (notification.data.orderNumber) {
                __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                    ...{ class: "inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-800" },
                });
                (notification.data.orderNumber);
            }
            if (notification.data.tableNumber) {
                __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                    ...{ class: "inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-800 ml-1" },
                });
                (notification.data.tableNumber);
            }
        }
        if (__VLS_ctx.hasActionButtons(notification)) {
            // @ts-ignore
            [hasActionButtons,];
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "mt-3 flex space-x-2" },
            });
            if (notification.type === 'order_ready') {
                __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(__VLS_ctx.notifications.length === 0))
                                return;
                            if (!(__VLS_ctx.hasActionButtons(notification)))
                                return;
                            if (!(notification.type === 'order_ready'))
                                return;
                            __VLS_ctx.handleOrderAction(notification, 'deliver');
                            // @ts-ignore
                            [handleOrderAction,];
                        } },
                    ...{ class: "text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors" },
                });
            }
            if (notification.type === 'order_urgent') {
                __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(__VLS_ctx.notifications.length === 0))
                                return;
                            if (!(__VLS_ctx.hasActionButtons(notification)))
                                return;
                            if (!(notification.type === 'order_urgent'))
                                return;
                            __VLS_ctx.handleOrderAction(notification, 'prioritize');
                            // @ts-ignore
                            [handleOrderAction,];
                        } },
                    ...{ class: "text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors" },
                });
            }
            __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.notifications.length === 0))
                            return;
                        if (!(__VLS_ctx.hasActionButtons(notification)))
                            return;
                        __VLS_ctx.markAsRead(notification.id);
                        // @ts-ignore
                        [markAsRead,];
                    } },
                ...{ class: "text-xs bg-gray-200 text-gray-800 px-3 py-1 rounded hover:bg-gray-300 transition-colors" },
            });
        }
    }
}
if (__VLS_ctx.notifications.length > 0) {
    // @ts-ignore
    [notifications,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "p-3 bg-gray-50 border-t border-gray-200" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center justify-between text-xs text-gray-500" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    (__VLS_ctx.notifications.length);
    // @ts-ignore
    [notifications,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.showAllNotifications) },
        ...{ class: "text-blue-600 hover:text-blue-800 transition-colors" },
    });
    // @ts-ignore
    [showAllNotifications,];
}
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['right-0']} */ ;
/** @type {__VLS_StyleScopedClasses['top-16']} */ ;
/** @type {__VLS_StyleScopedClasses['w-80']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['z-50']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-bl-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[1.25rem]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-blue-800']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:cursor-not-allowed']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-red-800']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:cursor-not-allowed']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-96']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['p-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-12']} */ ;
/** @type {__VLS_StyleScopedClasses['h-12']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['divide-y']} */ ;
/** @type {__VLS_StyleScopedClasses['divide-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-50']} */ ;
/** @type {__VLS_StyleScopedClasses['border-l-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-2']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['line-clamp-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-800']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-green-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-green-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-red-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-blue-800']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        Bell: Bell,
        isRefreshing: isRefreshing,
        notifications: notifications,
        unreadCount: unreadCount,
        soundEnabled: soundEnabled,
        sortedNotifications: sortedNotifications,
        markAllAsRead: markAllAsRead,
        clearAll: clearAll,
        toggleSound: toggleSound,
        refreshNotifications: refreshNotifications,
        markAsRead: markAsRead,
        handleNotificationClick: handleNotificationClick,
        handleOrderAction: handleOrderAction,
        showAllNotifications: showAllNotifications,
        hasActionButtons: hasActionButtons,
        getNotificationIcon: getNotificationIcon,
        getNotificationIconBg: getNotificationIconBg,
        getNotificationIconColor: getNotificationIconColor,
        formatTime: formatTime,
    }),
    __typeEmits: {},
});
export default (await import('vue')).defineComponent({
    __typeEmits: {},
});
; /* PartiallyEnd: #4569/main.vue */

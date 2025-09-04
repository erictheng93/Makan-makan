import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { BellIcon, UserIcon, ChevronDownIcon, XMarkIcon, ExclamationTriangleIcon, PlusIcon, ArrowPathIcon, ListBulletIcon, StarIcon } from '@heroicons/vue/24/outline';
const router = useRouter();
const authStore = useAuthStore();
// 響應式狀態
const showUserMenu = ref(false);
const showNotifications = ref(false);
const showQuickActions = ref(false);
const urgentOrderAlert = ref(null);
// 模擬數據
const currentUser = ref({
    name: '李小明',
    role: 'service_crew'
});
const pendingCount = ref(3);
const deliveringCount = ref(2);
const todayDelivered = ref(12);
const unreadNotifications = ref(2);
const notifications = ref([
    {
        id: 1,
        type: 'urgent_order',
        title: '緊急訂單',
        message: '桌號T01的訂單已等待15分鐘，請儘速配送',
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        read: false
    },
    {
        id: 2,
        type: 'new_order',
        title: '新訂單',
        message: '桌號T05有新的餐點準備完成',
        createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        read: false
    },
    {
        id: 3,
        type: 'achievement',
        title: '達成成就',
        message: '恭喜！您今日已完成10單配送',
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        read: true
    }
]);
// 方法
const toggleUserMenu = () => {
    showUserMenu.value = !showUserMenu.value;
    if (showUserMenu.value) {
        showNotifications.value = false;
        showQuickActions.value = false;
    }
};
const toggleNotifications = () => {
    showNotifications.value = !showNotifications.value;
    if (showNotifications.value) {
        showUserMenu.value = false;
        showQuickActions.value = false;
    }
};
const toggleQuickActions = () => {
    showQuickActions.value = !showQuickActions.value;
    if (showQuickActions.value) {
        showUserMenu.value = false;
        showNotifications.value = false;
    }
};
const closeNotifications = () => {
    showNotifications.value = false;
};
const openNotifications = () => {
    showNotifications.value = true;
    showQuickActions.value = false;
};
const openProfile = () => {
    showUserMenu.value = false;
    alert('個人資料功能開發中...');
};
const openSettings = () => {
    showUserMenu.value = false;
    alert('設定功能開發中...');
};
const logout = () => {
    showUserMenu.value = false;
    if (confirm('確定要登出嗎？')) {
        authStore.logout();
        router.push('/login');
    }
};
const refreshData = () => {
    showQuickActions.value = false;
    // 觸發數據刷新
    window.location.reload();
};
const handleNotificationClick = (notification) => {
    if (!notification.read) {
        notification.read = true;
        unreadNotifications.value = Math.max(0, unreadNotifications.value - 1);
    }
    // 根據通知類型執行相應操作
    if (notification.type === 'urgent_order') {
        router.push('/service');
        closeNotifications();
    }
};
const markAllAsRead = () => {
    notifications.value.forEach(n => n.read = true);
    unreadNotifications.value = 0;
};
const getNotificationIcon = (type) => {
    const icons = {
        urgent_order: ExclamationTriangleIcon,
        new_order: BellIcon,
        achievement: StarIcon
    };
    return icons[type] || BellIcon;
};
const getNotificationIconClass = (type) => {
    const classes = {
        urgent_order: 'text-red-500',
        new_order: 'text-blue-500',
        achievement: 'text-green-500'
    };
    return classes[type] || 'text-gray-500';
};
const formatNotificationTime = (dateTime) => {
    const now = new Date();
    const time = new Date(dateTime);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    if (diffInMinutes < 1)
        return '剛剛';
    if (diffInMinutes < 60)
        return `${diffInMinutes} 分鐘前`;
    const hours = Math.floor(diffInMinutes / 60);
    if (hours < 24)
        return `${hours} 小時前`;
    const days = Math.floor(hours / 24);
    return `${days} 天前`;
};
const handleUrgentOrder = () => {
    router.push('/service');
    closeUrgentAlert();
};
const dismissUrgentAlert = () => {
    // 5分鐘後再次提醒
    setTimeout(() => {
        if (!urgentOrderAlert.value) {
            showUrgentOrderAlert('訂單T01仍在等待配送，請儘快處理！');
        }
    }, 5 * 60 * 1000);
    closeUrgentAlert();
};
const closeUrgentAlert = () => {
    urgentOrderAlert.value = null;
};
const showUrgentOrderAlert = (message) => {
    urgentOrderAlert.value = { message };
};
// 點擊外部關閉選單
const handleClickOutside = (event) => {
    if (!(event.target?.closest?.('.relative'))) {
        showUserMenu.value = false;
        showQuickActions.value = false;
    }
};
// 生命週期
onMounted(() => {
    document.addEventListener('click', handleClickOutside);
    // 模擬緊急訂單提醒
    setTimeout(() => {
        showUrgentOrderAlert('桌號T01的訂單已等待超過15分鐘，請立即處理！');
    }, 3000);
});
onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ 
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ 
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ 
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "service-layout min-h-screen bg-gray-100" },
});
__VLS_asFunctionalElement(__VLS_elements.nav, __VLS_elements.nav)({
    ...{ class: "bg-white shadow-sm border-b border-gray-200" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex justify-between h-16" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex-shrink-0 flex items-center" },
});
const __VLS_0 = {}.ListBulletIcon;
/** @type {[typeof __VLS_components.ListBulletIcon, ]} */ 
// @ts-ignore
ListBulletIcon;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: "h-8 w-8 text-blue-600 mr-3" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "h-8 w-8 text-blue-600 mr-3" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_elements.h1, __VLS_elements.h1)({
    ...{ class: "text-xl font-bold text-gray-900" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "hidden sm:flex ml-8 items-center space-x-4" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center text-sm" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "w-2 h-2 bg-orange-500 rounded-full mr-2" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "text-gray-600" },
});
(__VLS_ctx.pendingCount);
// @ts-ignore
[pendingCount,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center text-sm" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "w-2 h-2 bg-blue-500 rounded-full mr-2" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "text-gray-600" },
});
(__VLS_ctx.deliveringCount);
// @ts-ignore
[deliveringCount,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-4" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.toggleNotifications) },
    ...{ class: "relative p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" },
});
// @ts-ignore
[toggleNotifications,];
const __VLS_5 = {}.BellIcon;
/** @type {[typeof __VLS_components.BellIcon, ]} */ 
// @ts-ignore
BellIcon;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
    ...{ class: "h-6 w-6" },
}));
const __VLS_7 = __VLS_6({
    ...{ class: "h-6 w-6" },
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
if (__VLS_ctx.unreadNotifications > 0) {
    // @ts-ignore
    [unreadNotifications,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center" },
    });
    (__VLS_ctx.unreadNotifications);
    // @ts-ignore
    [unreadNotifications,];
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "hidden sm:flex items-center bg-green-50 px-3 py-1 rounded-full" },
});
const __VLS_10 = {}.StarIcon;
/** @type {[typeof __VLS_components.StarIcon, ]} */ 
// @ts-ignore
StarIcon;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent(__VLS_10, new __VLS_10({
    ...{ class: "h-4 w-4 text-green-600 mr-1" },
}));
const __VLS_12 = __VLS_11({
    ...{ class: "h-4 w-4 text-green-600 mr-1" },
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "text-sm font-medium text-green-800" },
});
(__VLS_ctx.todayDelivered);
// @ts-ignore
[todayDelivered,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "relative" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.toggleUserMenu) },
    ...{ class: "flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500" },
});
// @ts-ignore
[toggleUserMenu,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center" },
});
const __VLS_15 = {}.UserIcon;
/** @type {[typeof __VLS_components.UserIcon, ]} */ 
// @ts-ignore
UserIcon;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({
    ...{ class: "h-5 w-5 text-blue-600" },
}));
const __VLS_17 = __VLS_16({
    ...{ class: "h-5 w-5 text-blue-600" },
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "hidden sm:block ml-2 text-gray-700 font-medium" },
});
(__VLS_ctx.currentUser.name);
// @ts-ignore
[currentUser,];
const __VLS_20 = {}.ChevronDownIcon;
/** @type {[typeof __VLS_components.ChevronDownIcon, ]} */ 
// @ts-ignore
ChevronDownIcon;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    ...{ class: "hidden sm:block ml-1 h-4 w-4 text-gray-500" },
}));
const __VLS_22 = __VLS_21({
    ...{ class: "hidden sm:block ml-1 h-4 w-4 text-gray-500" },
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
if (__VLS_ctx.showUserMenu) {
    // @ts-ignore
    [showUserMenu,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "px-4 py-2 border-b border-gray-200" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-sm font-medium text-gray-900" },
    });
    (__VLS_ctx.currentUser.name);
    // @ts-ignore
    [currentUser,];
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-sm text-gray-500" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.openProfile) },
        ...{ class: "block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" },
    });
    // @ts-ignore
    [openProfile,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.openSettings) },
        ...{ class: "block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" },
    });
    // @ts-ignore
    [openSettings,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "border-t border-gray-200" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.logout) },
        ...{ class: "block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" },
    });
    // @ts-ignore
    [logout,];
}
__VLS_asFunctionalElement(__VLS_elements.main, __VLS_elements.main)({
    ...{ class: "flex-1" },
});
const __VLS_25 = {}.RouterView;
/** @type {[typeof __VLS_components.RouterView, typeof __VLS_components.routerView, ]} */ 
// @ts-ignore
RouterView;
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent(__VLS_25, new __VLS_25({}));
const __VLS_27 = __VLS_26({}, ...__VLS_functionalComponentArgsRest(__VLS_26));
if (__VLS_ctx.showNotifications) {
    // @ts-ignore
    [showNotifications,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "fixed inset-0 z-50 overflow-hidden" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ onClick: (__VLS_ctx.closeNotifications) },
        ...{ class: "absolute inset-0 bg-black bg-opacity-25" },
    });
    // @ts-ignore
    [closeNotifications,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "absolute right-0 top-0 h-full w-96 bg-white shadow-xl" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center justify-between p-4 border-b border-gray-200" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
        ...{ class: "text-lg font-semibold text-gray-900" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.closeNotifications) },
        ...{ class: "text-gray-400 hover:text-gray-500" },
    });
    // @ts-ignore
    [closeNotifications,];
    const __VLS_30 = {}.XMarkIcon;
    /** @type {[typeof __VLS_components.XMarkIcon, ]} */ 
    // @ts-ignore
    XMarkIcon;
    // @ts-ignore
    const __VLS_31 = __VLS_asFunctionalComponent(__VLS_30, new __VLS_30({
        ...{ class: "h-5 w-5" },
    }));
    const __VLS_32 = __VLS_31({
        ...{ class: "h-5 w-5" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_31));
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "overflow-y-auto h-full pb-20" },
    });
    if (__VLS_ctx.notifications.length === 0) {
        // @ts-ignore
        [notifications,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "p-8 text-center" },
        });
        const __VLS_35 = {}.BellIcon;
        /** @type {[typeof __VLS_components.BellIcon, ]} */ 
        // @ts-ignore
        BellIcon;
        // @ts-ignore
        const __VLS_36 = __VLS_asFunctionalComponent(__VLS_35, new __VLS_35({
            ...{ class: "mx-auto h-12 w-12 text-gray-400 mb-4" },
        }));
        const __VLS_37 = __VLS_36({
            ...{ class: "mx-auto h-12 w-12 text-gray-400 mb-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_36));
        __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
            ...{ class: "text-gray-500" },
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "divide-y divide-gray-200" },
        });
        for (const [notification] of __VLS_getVForSourceType((__VLS_ctx.notifications))) {
            // @ts-ignore
            [notifications,];
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.showNotifications))
                            return;
                        if (__VLS_ctx.notifications.length === 0)
                            return;
                        __VLS_ctx.handleNotificationClick(notification);
                        // @ts-ignore
                        [handleNotificationClick,];
                    } },
                key: (notification.id),
                ...{ class: "p-4 hover:bg-gray-50 cursor-pointer" },
                ...{ class: ({ 'bg-blue-50': !notification.read }) },
            });
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "flex items-start" },
            });
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "flex-shrink-0" },
            });
            const __VLS_40 = ((__VLS_ctx.getNotificationIcon(notification.type)));
            // @ts-ignore
            const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
                ...{ class: (__VLS_ctx.getNotificationIconClass(notification.type)) },
                ...{ class: "h-6 w-6" },
            }));
            const __VLS_42 = __VLS_41({
                ...{ class: (__VLS_ctx.getNotificationIconClass(notification.type)) },
                ...{ class: "h-6 w-6" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_41));
            // @ts-ignore
            [getNotificationIcon, getNotificationIconClass,];
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "ml-3 flex-1" },
            });
            __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
                ...{ class: "text-sm font-medium text-gray-900" },
            });
            (notification.title);
            __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
                ...{ class: "text-sm text-gray-600 mt-1" },
            });
            (notification.message);
            __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
                ...{ class: "text-xs text-gray-500 mt-2" },
            });
            (__VLS_ctx.formatNotificationTime(notification.createdAt));
            // @ts-ignore
            [formatNotificationTime,];
            if (!notification.read) {
                __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                    ...{ class: "w-2 h-2 bg-blue-500 rounded-full" },
                });
            }
        }
    }
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.markAllAsRead) },
        ...{ class: "w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm" },
    });
    // @ts-ignore
    [markAllAsRead,];
}
if (__VLS_ctx.urgentOrderAlert) {
    // @ts-ignore
    [urgentOrderAlert,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "fixed bottom-4 right-4 z-40 max-w-sm bg-red-100 border border-red-400 rounded-lg shadow-lg p-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-start" },
    });
    const __VLS_45 = {}.ExclamationTriangleIcon;
    /** @type {[typeof __VLS_components.ExclamationTriangleIcon, ]} */ 
    // @ts-ignore
    ExclamationTriangleIcon;
    // @ts-ignore
    const __VLS_46 = __VLS_asFunctionalComponent(__VLS_45, new __VLS_45({
        ...{ class: "h-6 w-6 text-red-600 mr-3 flex-shrink-0" },
    }));
    const __VLS_47 = __VLS_46({
        ...{ class: "h-6 w-6 text-red-600 mr-3 flex-shrink-0" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_46));
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex-1" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h4, __VLS_elements.h4)({
        ...{ class: "text-sm font-semibold text-red-800" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-sm text-red-700 mt-1" },
    });
    (__VLS_ctx.urgentOrderAlert.message);
    // @ts-ignore
    [urgentOrderAlert,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "mt-3 flex space-x-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.handleUrgentOrder) },
        ...{ class: "px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors" },
    });
    // @ts-ignore
    [handleUrgentOrder,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.dismissUrgentAlert) },
        ...{ class: "px-3 py-1 bg-red-200 text-red-800 text-xs rounded hover:bg-red-300 transition-colors" },
    });
    // @ts-ignore
    [dismissUrgentAlert,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.closeUrgentAlert) },
        ...{ class: "text-red-400 hover:text-red-600 ml-2" },
    });
    // @ts-ignore
    [closeUrgentAlert,];
    const __VLS_50 = {}.XMarkIcon;
    /** @type {[typeof __VLS_components.XMarkIcon, ]} */ 
    // @ts-ignore
    XMarkIcon;
    // @ts-ignore
    const __VLS_51 = __VLS_asFunctionalComponent(__VLS_50, new __VLS_50({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_52 = __VLS_51({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_51));
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "sm:hidden fixed bottom-6 right-6 z-30" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.toggleQuickActions) },
    ...{ class: "w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center" },
});
// @ts-ignore
[toggleQuickActions,];
const __VLS_55 = ((__VLS_ctx.showQuickActions ? __VLS_ctx.XMarkIcon : __VLS_ctx.PlusIcon));
// @ts-ignore
const __VLS_56 = __VLS_asFunctionalComponent(__VLS_55, new __VLS_55({
    ...{ class: "h-6 w-6" },
}));
const __VLS_57 = __VLS_56({
    ...{ class: "h-6 w-6" },
}, ...__VLS_functionalComponentArgsRest(__VLS_56));
// @ts-ignore
[showQuickActions, XMarkIcon, PlusIcon,];
if (__VLS_ctx.showQuickActions) {
    // @ts-ignore
    [showQuickActions,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "absolute bottom-16 right-0 space-y-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.refreshData) },
        ...{ class: "flex items-center justify-center w-12 h-12 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 transition-colors" },
    });
    // @ts-ignore
    [refreshData,];
    const __VLS_60 = {}.ArrowPathIcon;
    /** @type {[typeof __VLS_components.ArrowPathIcon, ]} */ 
    // @ts-ignore
    ArrowPathIcon;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
        ...{ class: "h-5 w-5" },
    }));
    const __VLS_62 = __VLS_61({
        ...{ class: "h-5 w-5" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.openNotifications) },
        ...{ class: "flex items-center justify-center w-12 h-12 bg-yellow-600 text-white rounded-full shadow-lg hover:bg-yellow-700 transition-colors" },
    });
    // @ts-ignore
    [openNotifications,];
    const __VLS_65 = {}.BellIcon;
    /** @type {[typeof __VLS_components.BellIcon, ]} */ 
    // @ts-ignore
    BellIcon;
    // @ts-ignore
    const __VLS_66 = __VLS_asFunctionalComponent(__VLS_65, new __VLS_65({
        ...{ class: "h-5 w-5" },
    }));
    const __VLS_67 = __VLS_66({
        ...{ class: "h-5 w-5" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_66));
}
/** @type {__VLS_StyleScopedClasses['service-layout']} */ 
/** @type {__VLS_StyleScopedClasses['min-h-screen']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-100']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ 
/** @type {__VLS_StyleScopedClasses['border-b']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['max-w-7xl']} */ 
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['sm:px-6']} */ 
/** @type {__VLS_StyleScopedClasses['lg:px-8']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['h-16']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['h-8']} */ 
/** @type {__VLS_StyleScopedClasses['w-8']} */ 
/** @type {__VLS_StyleScopedClasses['text-blue-600']} */ 
/** @type {__VLS_StyleScopedClasses['mr-3']} */ 
/** @type {__VLS_StyleScopedClasses['text-xl']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['ml-2']} */ 
/** @type {__VLS_StyleScopedClasses['px-2']} */ 
/** @type {__VLS_StyleScopedClasses['py-1']} */ 
/** @type {__VLS_StyleScopedClasses['bg-green-100']} */ 
/** @type {__VLS_StyleScopedClasses['text-green-800']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['hidden']} */ 
/** @type {__VLS_StyleScopedClasses['sm:flex']} */ 
/** @type {__VLS_StyleScopedClasses['ml-8']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-4']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['w-2']} */ 
/** @type {__VLS_StyleScopedClasses['h-2']} */ 
/** @type {__VLS_StyleScopedClasses['bg-orange-500']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['mr-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['w-2']} */ 
/** @type {__VLS_StyleScopedClasses['h-2']} */ 
/** @type {__VLS_StyleScopedClasses['bg-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['mr-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-4']} */ 
/** @type {__VLS_StyleScopedClasses['relative']} */ 
/** @type {__VLS_StyleScopedClasses['p-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ 
/** @type {__VLS_StyleScopedClasses['hover:text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['h-6']} */ 
/** @type {__VLS_StyleScopedClasses['w-6']} */ 
/** @type {__VLS_StyleScopedClasses['absolute']} */ 
/** @type {__VLS_StyleScopedClasses['-top-1']} */ 
/** @type {__VLS_StyleScopedClasses['-right-1']} */ 
/** @type {__VLS_StyleScopedClasses['h-5']} */ 
/** @type {__VLS_StyleScopedClasses['w-5']} */ 
/** @type {__VLS_StyleScopedClasses['bg-red-500']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['hidden']} */ 
/** @type {__VLS_StyleScopedClasses['sm:flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['bg-green-50']} */ 
/** @type {__VLS_StyleScopedClasses['px-3']} */ 
/** @type {__VLS_StyleScopedClasses['py-1']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-green-600']} */ 
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-green-800']} */ 
/** @type {__VLS_StyleScopedClasses['relative']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['h-8']} */ 
/** @type {__VLS_StyleScopedClasses['w-8']} */ 
/** @type {__VLS_StyleScopedClasses['bg-blue-100']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['h-5']} */ 
/** @type {__VLS_StyleScopedClasses['w-5']} */ 
/** @type {__VLS_StyleScopedClasses['text-blue-600']} */ 
/** @type {__VLS_StyleScopedClasses['hidden']} */ 
/** @type {__VLS_StyleScopedClasses['sm:block']} */ 
/** @type {__VLS_StyleScopedClasses['ml-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['hidden']} */ 
/** @type {__VLS_StyleScopedClasses['sm:block']} */ 
/** @type {__VLS_StyleScopedClasses['ml-1']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['absolute']} */ 
/** @type {__VLS_StyleScopedClasses['right-0']} */ 
/** @type {__VLS_StyleScopedClasses['mt-2']} */ 
/** @type {__VLS_StyleScopedClasses['w-48']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ 
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ 
/** @type {__VLS_StyleScopedClasses['py-1']} */ 
/** @type {__VLS_StyleScopedClasses['z-50']} */ 
/** @type {__VLS_StyleScopedClasses['border']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['border-b']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['block']} */ 
/** @type {__VLS_StyleScopedClasses['w-full']} */ 
/** @type {__VLS_StyleScopedClasses['text-left']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-100']} */ 
/** @type {__VLS_StyleScopedClasses['block']} */ 
/** @type {__VLS_StyleScopedClasses['w-full']} */ 
/** @type {__VLS_StyleScopedClasses['text-left']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-100']} */ 
/** @type {__VLS_StyleScopedClasses['border-t']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['block']} */ 
/** @type {__VLS_StyleScopedClasses['w-full']} */ 
/** @type {__VLS_StyleScopedClasses['text-left']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-100']} */ 
/** @type {__VLS_StyleScopedClasses['flex-1']} */ 
/** @type {__VLS_StyleScopedClasses['fixed']} */ 
/** @type {__VLS_StyleScopedClasses['inset-0']} */ 
/** @type {__VLS_StyleScopedClasses['z-50']} */ 
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ 
/** @type {__VLS_StyleScopedClasses['absolute']} */ 
/** @type {__VLS_StyleScopedClasses['inset-0']} */ 
/** @type {__VLS_StyleScopedClasses['bg-black']} */ 
/** @type {__VLS_StyleScopedClasses['bg-opacity-25']} */ 
/** @type {__VLS_StyleScopedClasses['absolute']} */ 
/** @type {__VLS_StyleScopedClasses['right-0']} */ 
/** @type {__VLS_StyleScopedClasses['top-0']} */ 
/** @type {__VLS_StyleScopedClasses['h-full']} */ 
/** @type {__VLS_StyleScopedClasses['w-96']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['shadow-xl']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['p-4']} */ 
/** @type {__VLS_StyleScopedClasses['border-b']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ 
/** @type {__VLS_StyleScopedClasses['hover:text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['h-5']} */ 
/** @type {__VLS_StyleScopedClasses['w-5']} */ 
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ 
/** @type {__VLS_StyleScopedClasses['h-full']} */ 
/** @type {__VLS_StyleScopedClasses['pb-20']} */ 
/** @type {__VLS_StyleScopedClasses['p-8']} */ 
/** @type {__VLS_StyleScopedClasses['text-center']} */ 
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ 
/** @type {__VLS_StyleScopedClasses['h-12']} */ 
/** @type {__VLS_StyleScopedClasses['w-12']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ 
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['divide-y']} */ 
/** @type {__VLS_StyleScopedClasses['divide-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['p-4']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-50']} */ 
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ 
/** @type {__VLS_StyleScopedClasses['bg-blue-50']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-start']} */ 
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ 
/** @type {__VLS_StyleScopedClasses['h-6']} */ 
/** @type {__VLS_StyleScopedClasses['w-6']} */ 
/** @type {__VLS_StyleScopedClasses['ml-3']} */ 
/** @type {__VLS_StyleScopedClasses['flex-1']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['mt-1']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['mt-2']} */ 
/** @type {__VLS_StyleScopedClasses['w-2']} */ 
/** @type {__VLS_StyleScopedClasses['h-2']} */ 
/** @type {__VLS_StyleScopedClasses['bg-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['absolute']} */ 
/** @type {__VLS_StyleScopedClasses['bottom-0']} */ 
/** @type {__VLS_StyleScopedClasses['left-0']} */ 
/** @type {__VLS_StyleScopedClasses['right-0']} */ 
/** @type {__VLS_StyleScopedClasses['p-4']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['w-full']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['bg-blue-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-blue-700']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['fixed']} */ 
/** @type {__VLS_StyleScopedClasses['bottom-4']} */ 
/** @type {__VLS_StyleScopedClasses['right-4']} */ 
/** @type {__VLS_StyleScopedClasses['z-40']} */ 
/** @type {__VLS_StyleScopedClasses['max-w-sm']} */ 
/** @type {__VLS_StyleScopedClasses['bg-red-100']} */ 
/** @type {__VLS_StyleScopedClasses['border']} */ 
/** @type {__VLS_StyleScopedClasses['border-red-400']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ 
/** @type {__VLS_StyleScopedClasses['p-4']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-start']} */ 
/** @type {__VLS_StyleScopedClasses['h-6']} */ 
/** @type {__VLS_StyleScopedClasses['w-6']} */ 
/** @type {__VLS_StyleScopedClasses['text-red-600']} */ 
/** @type {__VLS_StyleScopedClasses['mr-3']} */ 
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ 
/** @type {__VLS_StyleScopedClasses['flex-1']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-red-800']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-red-700']} */ 
/** @type {__VLS_StyleScopedClasses['mt-1']} */ 
/** @type {__VLS_StyleScopedClasses['mt-3']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ 
/** @type {__VLS_StyleScopedClasses['px-3']} */ 
/** @type {__VLS_StyleScopedClasses['py-1']} */ 
/** @type {__VLS_StyleScopedClasses['bg-red-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['rounded']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-red-700']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['px-3']} */ 
/** @type {__VLS_StyleScopedClasses['py-1']} */ 
/** @type {__VLS_StyleScopedClasses['bg-red-200']} */ 
/** @type {__VLS_StyleScopedClasses['text-red-800']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['rounded']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-red-300']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ 
/** @type {__VLS_StyleScopedClasses['hover:text-red-600']} */ 
/** @type {__VLS_StyleScopedClasses['ml-2']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['sm:hidden']} */ 
/** @type {__VLS_StyleScopedClasses['fixed']} */ 
/** @type {__VLS_StyleScopedClasses['bottom-6']} */ 
/** @type {__VLS_StyleScopedClasses['right-6']} */ 
/** @type {__VLS_StyleScopedClasses['z-30']} */ 
/** @type {__VLS_StyleScopedClasses['w-14']} */ 
/** @type {__VLS_StyleScopedClasses['h-14']} */ 
/** @type {__VLS_StyleScopedClasses['bg-blue-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-blue-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['h-6']} */ 
/** @type {__VLS_StyleScopedClasses['w-6']} */ 
/** @type {__VLS_StyleScopedClasses['absolute']} */ 
/** @type {__VLS_StyleScopedClasses['bottom-16']} */ 
/** @type {__VLS_StyleScopedClasses['right-0']} */ 
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['w-12']} */ 
/** @type {__VLS_StyleScopedClasses['h-12']} */ 
/** @type {__VLS_StyleScopedClasses['bg-green-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-green-700']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['h-5']} */ 
/** @type {__VLS_StyleScopedClasses['w-5']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['w-12']} */ 
/** @type {__VLS_StyleScopedClasses['h-12']} */ 
/** @type {__VLS_StyleScopedClasses['bg-yellow-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-yellow-700']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['h-5']} */ 
/** @type {__VLS_StyleScopedClasses['w-5']} */ 
let __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        BellIcon: BellIcon,
        UserIcon: UserIcon,
        ChevronDownIcon: ChevronDownIcon,
        XMarkIcon: XMarkIcon,
        ExclamationTriangleIcon: ExclamationTriangleIcon,
        PlusIcon: PlusIcon,
        ArrowPathIcon: ArrowPathIcon,
        ListBulletIcon: ListBulletIcon,
        StarIcon: StarIcon,
        showUserMenu: showUserMenu,
        showNotifications: showNotifications,
        showQuickActions: showQuickActions,
        urgentOrderAlert: urgentOrderAlert,
        currentUser: currentUser,
        pendingCount: pendingCount,
        deliveringCount: deliveringCount,
        todayDelivered: todayDelivered,
        unreadNotifications: unreadNotifications,
        notifications: notifications,
        toggleUserMenu: toggleUserMenu,
        toggleNotifications: toggleNotifications,
        toggleQuickActions: toggleQuickActions,
        closeNotifications: closeNotifications,
        openNotifications: openNotifications,
        openProfile: openProfile,
        openSettings: openSettings,
        logout: logout,
        refreshData: refreshData,
        handleNotificationClick: handleNotificationClick,
        markAllAsRead: markAllAsRead,
        getNotificationIcon: getNotificationIcon,
        getNotificationIconClass: getNotificationIconClass,
        formatNotificationTime: formatNotificationTime,
        handleUrgentOrder: handleUrgentOrder,
        dismissUrgentAlert: dismissUrgentAlert,
        closeUrgentAlert: closeUrgentAlert,
    }),
});
export default (await import('vue')).defineComponent({});
 /* PartiallyEnd: #4569/main.vue */

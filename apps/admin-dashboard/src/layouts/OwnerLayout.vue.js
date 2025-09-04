import { ref, onMounted } from 'vue';
import { BuildingStorefrontIcon, BellIcon, ChartBarIcon, UsersIcon, Cog6ToothIcon, CurrencyDollarIcon, ClipboardDocumentIcon, ExclamationTriangleIcon, ChartPieIcon } from '@heroicons/vue/24/outline';
const activeTab = ref('overview');
const showNotifications = ref(false);
const unreadNotifications = ref(3);
const currentRestaurant = ref({ name: 'MakanMakan 旗艦店' });
const tabs = [
    { key: 'overview', label: '總覽儀表板', icon: ChartPieIcon },
    { key: 'analytics', label: '營運分析', icon: ChartBarIcon },
    { key: 'staff', label: '員工管理', icon: UsersIcon },
    { key: 'finance', label: '財務報表', icon: CurrencyDollarIcon },
    { key: 'operations', label: '營運管理', icon: ClipboardDocumentIcon },
    { key: 'settings', label: '店鋪設定', icon: Cog6ToothIcon }
];
const notifications = ref([
    {
        id: 1,
        type: 'urgent',
        message: '廚房設備異常，需要立即處理',
        time: '2 分鐘前'
    },
    {
        id: 2,
        type: 'warning',
        message: '庫存不足：牛肉剩餘 5 份',
        time: '15 分鐘前'
    },
    {
        id: 3,
        type: 'info',
        message: '今日營業額已達 85% 目標',
        time: '1 小時前'
    }
]);
const handleEmergency = () => {
    // 處理緊急狀況
    console.log('Emergency button clicked');
};
onMounted(() => {
    // 初始化數據
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100" },
});
__VLS_asFunctionalElement(__VLS_elements.header, __VLS_elements.header)({
    ...{ class: "bg-white shadow-lg border-b border-purple-200" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center justify-between h-16" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex-shrink-0" },
});
const __VLS_0 = {}.BuildingStorefrontIcon;
/** @type {[typeof __VLS_components.BuildingStorefrontIcon, ]} */ 
// @ts-ignore
BuildingStorefrontIcon;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: "h-8 w-8 text-purple-600" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "h-8 w-8 text-purple-600" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "ml-4" },
});
__VLS_asFunctionalElement(__VLS_elements.h1, __VLS_elements.h1)({
    ...{ class: "text-xl font-bold text-gray-900" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm text-gray-600" },
});
(__VLS_ctx.currentRestaurant?.name || 'MakanMakan');
// @ts-ignore
[currentRestaurant,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-4" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showNotifications = !__VLS_ctx.showNotifications;
            // @ts-ignore
            [showNotifications, showNotifications,];
        } },
    ...{ class: "relative p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 rounded-lg" },
});
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
        ...{ class: "absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center" },
    });
    (__VLS_ctx.unreadNotifications);
    // @ts-ignore
    [unreadNotifications,];
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-2 px-3 py-1 bg-green-100 rounded-full" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "w-2 h-2 bg-green-500 rounded-full animate-pulse" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "text-sm font-medium text-green-800" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "text-sm font-medium text-white" },
});
__VLS_asFunctionalElement(__VLS_elements.nav, __VLS_elements.nav)({
    ...{ class: "bg-white shadow-sm" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex space-x-8" },
});
for (const [tab] of __VLS_getVForSourceType((__VLS_ctx.tabs))) {
    // @ts-ignore
    [tabs,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.activeTab = tab.key;
                // @ts-ignore
                [activeTab,];
            } },
        key: (tab.key),
        ...{ class: ([
                'flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-colors duration-200',
                __VLS_ctx.activeTab === tab.key
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]) },
    });
    // @ts-ignore
    [activeTab,];
    const __VLS_10 = ((tab.icon));
    // @ts-ignore
    const __VLS_11 = __VLS_asFunctionalComponent(__VLS_10, new __VLS_10({
        ...{ class: "w-5 h-5 mr-2" },
    }));
    const __VLS_12 = __VLS_11({
        ...{ class: "w-5 h-5 mr-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_11));
    (tab.label);
}
__VLS_asFunctionalElement(__VLS_elements.main, __VLS_elements.main)({
    ...{ class: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" },
});
const __VLS_15 = {}.RouterView;
/** @type {[typeof __VLS_components.RouterView, typeof __VLS_components.routerView, ]} */ 
// @ts-ignore
RouterView;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({
    key: (__VLS_ctx.$route.fullPath),
}));
const __VLS_17 = __VLS_16({
    key: (__VLS_ctx.$route.fullPath),
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
// @ts-ignore
[$route,];
const __VLS_20 = {}.Teleport;
/** @type {[typeof __VLS_components.Teleport, typeof __VLS_components.Teleport, ]} */ 
// @ts-ignore
Teleport;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    to: "body",
}));
const __VLS_22 = __VLS_21({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
const { default: __VLS_24 } = __VLS_23.slots;
if (__VLS_ctx.showNotifications) {
    // @ts-ignore
    [showNotifications,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showNotifications))
                    return;
                __VLS_ctx.showNotifications = false;
                // @ts-ignore
                [showNotifications,];
            } },
        ...{ class: "fixed inset-0 bg-black bg-opacity-25 z-50" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ onClick: () => { } },
        ...{ class: "absolute right-0 top-16 w-96 max-h-96 bg-white shadow-2xl rounded-bl-lg overflow-hidden" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "p-4 border-b border-gray-200" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
        ...{ class: "text-lg font-semibold text-gray-900" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "overflow-y-auto max-h-80" },
    });
    for (const [notification] of __VLS_getVForSourceType((__VLS_ctx.notifications))) {
        // @ts-ignore
        [notifications,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            key: (notification.id),
            ...{ class: "p-4 border-b border-gray-100 hover:bg-gray-50" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "flex items-start" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: ([
                    'flex-shrink-0 w-2 h-2 mt-2 rounded-full',
                    notification.type === 'urgent' ? 'bg-red-500' :
                        notification.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                ]) },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "ml-3 flex-1" },
        });
        __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
            ...{ class: "text-sm text-gray-900" },
        });
        (notification.message);
        __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
            ...{ class: "text-xs text-gray-500 mt-1" },
        });
        (notification.time);
    }
}
let __VLS_23;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "fixed bottom-6 right-6" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.handleEmergency) },
    ...{ class: "w-14 h-14 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg flex items-center justify-center transition-colors duration-200" },
});
// @ts-ignore
[handleEmergency,];
const __VLS_25 = {}.ExclamationTriangleIcon;
/** @type {[typeof __VLS_components.ExclamationTriangleIcon, ]} */ 
// @ts-ignore
ExclamationTriangleIcon;
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent(__VLS_25, new __VLS_25({
    ...{ class: "w-6 h-6" },
}));
const __VLS_27 = __VLS_26({
    ...{ class: "w-6 h-6" },
}, ...__VLS_functionalComponentArgsRest(__VLS_26));
/** @type {__VLS_StyleScopedClasses['min-h-screen']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gradient-to-br']} */ 
/** @type {__VLS_StyleScopedClasses['from-purple-50']} */ 
/** @type {__VLS_StyleScopedClasses['to-indigo-100']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ 
/** @type {__VLS_StyleScopedClasses['border-b']} */ 
/** @type {__VLS_StyleScopedClasses['border-purple-200']} */ 
/** @type {__VLS_StyleScopedClasses['max-w-7xl']} */ 
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['sm:px-6']} */ 
/** @type {__VLS_StyleScopedClasses['lg:px-8']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['h-16']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ 
/** @type {__VLS_StyleScopedClasses['h-8']} */ 
/** @type {__VLS_StyleScopedClasses['w-8']} */ 
/** @type {__VLS_StyleScopedClasses['text-purple-600']} */ 
/** @type {__VLS_StyleScopedClasses['ml-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-xl']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
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
/** @type {__VLS_StyleScopedClasses['focus:ring-purple-500']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['h-6']} */ 
/** @type {__VLS_StyleScopedClasses['w-6']} */ 
/** @type {__VLS_StyleScopedClasses['absolute']} */ 
/** @type {__VLS_StyleScopedClasses['-top-1']} */ 
/** @type {__VLS_StyleScopedClasses['-right-1']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['bg-red-500']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ 
/** @type {__VLS_StyleScopedClasses['px-3']} */ 
/** @type {__VLS_StyleScopedClasses['py-1']} */ 
/** @type {__VLS_StyleScopedClasses['bg-green-100']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['w-2']} */ 
/** @type {__VLS_StyleScopedClasses['h-2']} */ 
/** @type {__VLS_StyleScopedClasses['bg-green-500']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['animate-pulse']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-green-800']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['w-8']} */ 
/** @type {__VLS_StyleScopedClasses['h-8']} */ 
/** @type {__VLS_StyleScopedClasses['bg-purple-500']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ 
/** @type {__VLS_StyleScopedClasses['max-w-7xl']} */ 
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['sm:px-6']} */ 
/** @type {__VLS_StyleScopedClasses['lg:px-8']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-8']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['border-b-2']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['duration-200']} */ 
/** @type {__VLS_StyleScopedClasses['w-5']} */ 
/** @type {__VLS_StyleScopedClasses['h-5']} */ 
/** @type {__VLS_StyleScopedClasses['mr-2']} */ 
/** @type {__VLS_StyleScopedClasses['max-w-7xl']} */ 
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['sm:px-6']} */ 
/** @type {__VLS_StyleScopedClasses['lg:px-8']} */ 
/** @type {__VLS_StyleScopedClasses['py-6']} */ 
/** @type {__VLS_StyleScopedClasses['fixed']} */ 
/** @type {__VLS_StyleScopedClasses['inset-0']} */ 
/** @type {__VLS_StyleScopedClasses['bg-black']} */ 
/** @type {__VLS_StyleScopedClasses['bg-opacity-25']} */ 
/** @type {__VLS_StyleScopedClasses['z-50']} */ 
/** @type {__VLS_StyleScopedClasses['absolute']} */ 
/** @type {__VLS_StyleScopedClasses['right-0']} */ 
/** @type {__VLS_StyleScopedClasses['top-16']} */ 
/** @type {__VLS_StyleScopedClasses['w-96']} */ 
/** @type {__VLS_StyleScopedClasses['max-h-96']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['shadow-2xl']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-bl-lg']} */ 
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ 
/** @type {__VLS_StyleScopedClasses['p-4']} */ 
/** @type {__VLS_StyleScopedClasses['border-b']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ 
/** @type {__VLS_StyleScopedClasses['max-h-80']} */ 
/** @type {__VLS_StyleScopedClasses['p-4']} */ 
/** @type {__VLS_StyleScopedClasses['border-b']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-100']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-50']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-start']} */ 
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ 
/** @type {__VLS_StyleScopedClasses['w-2']} */ 
/** @type {__VLS_StyleScopedClasses['h-2']} */ 
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['ml-3']} */ 
/** @type {__VLS_StyleScopedClasses['flex-1']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['mt-1']} */ 
/** @type {__VLS_StyleScopedClasses['fixed']} */ 
/** @type {__VLS_StyleScopedClasses['bottom-6']} */ 
/** @type {__VLS_StyleScopedClasses['right-6']} */ 
/** @type {__VLS_StyleScopedClasses['w-14']} */ 
/** @type {__VLS_StyleScopedClasses['h-14']} */ 
/** @type {__VLS_StyleScopedClasses['bg-red-500']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-red-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['duration-200']} */ 
/** @type {__VLS_StyleScopedClasses['w-6']} */ 
/** @type {__VLS_StyleScopedClasses['h-6']} */ 
let __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        BuildingStorefrontIcon: BuildingStorefrontIcon,
        BellIcon: BellIcon,
        ExclamationTriangleIcon: ExclamationTriangleIcon,
        activeTab: activeTab,
        showNotifications: showNotifications,
        unreadNotifications: unreadNotifications,
        currentRestaurant: currentRestaurant,
        tabs: tabs,
        notifications: notifications,
        handleEmergency: handleEmergency,
    }),
});
export default (await import('vue')).defineComponent({});
 /* PartiallyEnd: #4569/main.vue */

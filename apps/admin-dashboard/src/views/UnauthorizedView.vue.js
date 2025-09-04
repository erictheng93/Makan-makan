import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { ShieldExclamationIcon, ExclamationTriangleIcon, InformationCircleIcon, ArrowLeftIcon, HomeIcon } from '@heroicons/vue/24/outline';
const router = useRouter();
const authStore = useAuthStore();
// 計算屬性
const currentUser = computed(() => authStore.user);
const availablePermissions = computed(() => {
    const role = currentUser.value?.role;
    const permissions = {
        0: [
            '系統管理',
            '用戶管理',
            '餐廳管理',
            '數據分析',
            '所有功能'
        ],
        1: [
            '餐廳管理',
            '員工管理',
            '菜單管理',
            '訂單管理',
            '數據分析'
        ],
        2: [
            '廚房顯示系統',
            '訂單處理',
            '菜單查看'
        ],
        3: [
            '訂單管理',
            '桌台管理',
            '送餐服務'
        ],
        4: [
            '收銀台',
            '訂單結帳',
            '付款處理'
        ]
    };
    return permissions[role] || ['基本功能'];
});
// 方法
const getRoleText = (role) => {
    const roles = {
        0: '系統管理員',
        1: '店主',
        2: '廚師',
        3: '送菜員',
        4: '收銀員'
    };
    return roles[role] || '未知角色';
};
const goBack = () => {
    if (window.history.length > 1) {
        router.go(-1);
    }
    else {
        goToDashboard();
    }
};
const goToDashboard = () => {
    router.push('/dashboard');
};
// 生命周期
onMounted(() => {
    // 記錄未授權訪問嘗試
    console.warn('Unauthorized access attempt:', {
        user: currentUser.value?.username,
        role: currentUser.value?.role,
        timestamp: new Date().toISOString(),
        path: router.currentRoute.value.path
    });
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "unauthorized-view" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "max-w-md w-full space-y-8 text-center" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "mx-auto" },
});
const __VLS_0 = {}.ShieldExclamationIcon;
/** @type {[typeof __VLS_components.ShieldExclamationIcon, ]} */ 
// @ts-ignore
ShieldExclamationIcon;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: "mx-auto h-24 w-24 text-red-400" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "mx-auto h-24 w-24 text-red-400" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.h2, __VLS_elements.h2)({
    ...{ class: "mt-6 text-3xl font-bold text-gray-900" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "mt-2 text-sm text-gray-600" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-red-50 border border-red-200 rounded-md p-4" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex-shrink-0" },
});
const __VLS_5 = {}.ExclamationTriangleIcon;
/** @type {[typeof __VLS_components.ExclamationTriangleIcon, ]} */ 
// @ts-ignore
ExclamationTriangleIcon;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
    ...{ class: "h-5 w-5 text-red-400" },
}));
const __VLS_7 = __VLS_6({
    ...{ class: "h-5 w-5 text-red-400" },
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "ml-3" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
    ...{ class: "text-sm font-medium text-red-800" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "mt-2 text-sm text-red-700" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({});
if (__VLS_ctx.currentUser) {
    // @ts-ignore
    [currentUser,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "bg-gray-100 rounded-md p-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h4, __VLS_elements.h4)({
        ...{ class: "text-sm font-medium text-gray-900 mb-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-sm text-gray-600 space-y-1" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex justify-between" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "font-medium" },
    });
    (__VLS_ctx.currentUser.username);
    // @ts-ignore
    [currentUser,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex justify-between" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "font-medium" },
    });
    (__VLS_ctx.getRoleText(__VLS_ctx.currentUser.role));
    // @ts-ignore
    [currentUser, getRoleText,];
    if (__VLS_ctx.currentUser.restaurantName) {
        // @ts-ignore
        [currentUser,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "flex justify-between" },
        });
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "font-medium" },
        });
        (__VLS_ctx.currentUser.restaurantName);
        // @ts-ignore
        [currentUser,];
    }
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-blue-50 border border-blue-200 rounded-md p-4" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex-shrink-0" },
});
const __VLS_10 = {}.InformationCircleIcon;
/** @type {[typeof __VLS_components.InformationCircleIcon, ]} */ 
// @ts-ignore
InformationCircleIcon;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent(__VLS_10, new __VLS_10({
    ...{ class: "h-5 w-5 text-blue-400" },
}));
const __VLS_12 = __VLS_11({
    ...{ class: "h-5 w-5 text-blue-400" },
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "ml-3" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
    ...{ class: "text-sm font-medium text-blue-800" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "mt-2 text-sm text-blue-700" },
});
__VLS_asFunctionalElement(__VLS_elements.ul, __VLS_elements.ul)({
    ...{ class: "list-disc list-inside space-y-1" },
});
for (const [permission] of __VLS_getVForSourceType((__VLS_ctx.availablePermissions))) {
    // @ts-ignore
    [availablePermissions,];
    __VLS_asFunctionalElement(__VLS_elements.li, __VLS_elements.li)({
        key: (permission),
    });
    (permission);
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex flex-col sm:flex-row gap-3" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.goBack) },
    ...{ class: "flex-1 flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors" },
});
// @ts-ignore
[goBack,];
const __VLS_15 = {}.ArrowLeftIcon;
/** @type {[typeof __VLS_components.ArrowLeftIcon, ]} */ 
// @ts-ignore
ArrowLeftIcon;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({
    ...{ class: "h-4 w-4 mr-2" },
}));
const __VLS_17 = __VLS_16({
    ...{ class: "h-4 w-4 mr-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.goToDashboard) },
    ...{ class: "flex-1 flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors" },
});
// @ts-ignore
[goToDashboard,];
const __VLS_20 = {}.HomeIcon;
/** @type {[typeof __VLS_components.HomeIcon, ]} */ 
// @ts-ignore
HomeIcon;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    ...{ class: "h-4 w-4 mr-2" },
}));
const __VLS_22 = __VLS_21({
    ...{ class: "h-4 w-4 mr-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-center" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-xs text-gray-500" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-xs text-blue-600 mt-1" },
});
__VLS_asFunctionalElement(__VLS_elements.a, __VLS_elements.a)({
    href: "mailto:admin@makanmakan.com",
    ...{ class: "hover:text-blue-800 transition-colors" },
});
/** @type {__VLS_StyleScopedClasses['unauthorized-view']} */ 
/** @type {__VLS_StyleScopedClasses['min-h-screen']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ 
/** @type {__VLS_StyleScopedClasses['py-12']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['sm:px-6']} */ 
/** @type {__VLS_StyleScopedClasses['lg:px-8']} */ 
/** @type {__VLS_StyleScopedClasses['max-w-md']} */ 
/** @type {__VLS_StyleScopedClasses['w-full']} */ 
/** @type {__VLS_StyleScopedClasses['space-y-8']} */ 
/** @type {__VLS_StyleScopedClasses['text-center']} */ 
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ 
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ 
/** @type {__VLS_StyleScopedClasses['h-24']} */ 
/** @type {__VLS_StyleScopedClasses['w-24']} */ 
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ 
/** @type {__VLS_StyleScopedClasses['mt-6']} */ 
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['mt-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['bg-red-50']} */ 
/** @type {__VLS_StyleScopedClasses['border']} */ 
/** @type {__VLS_StyleScopedClasses['border-red-200']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ 
/** @type {__VLS_StyleScopedClasses['p-4']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ 
/** @type {__VLS_StyleScopedClasses['h-5']} */ 
/** @type {__VLS_StyleScopedClasses['w-5']} */ 
/** @type {__VLS_StyleScopedClasses['text-red-400']} */ 
/** @type {__VLS_StyleScopedClasses['ml-3']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-red-800']} */ 
/** @type {__VLS_StyleScopedClasses['mt-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-red-700']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-100']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ 
/** @type {__VLS_StyleScopedClasses['p-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['mb-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['bg-blue-50']} */ 
/** @type {__VLS_StyleScopedClasses['border']} */ 
/** @type {__VLS_StyleScopedClasses['border-blue-200']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ 
/** @type {__VLS_StyleScopedClasses['p-4']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ 
/** @type {__VLS_StyleScopedClasses['h-5']} */ 
/** @type {__VLS_StyleScopedClasses['w-5']} */ 
/** @type {__VLS_StyleScopedClasses['text-blue-400']} */ 
/** @type {__VLS_StyleScopedClasses['ml-3']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-blue-800']} */ 
/** @type {__VLS_StyleScopedClasses['mt-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-blue-700']} */ 
/** @type {__VLS_StyleScopedClasses['list-disc']} */ 
/** @type {__VLS_StyleScopedClasses['list-inside']} */ 
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['flex-col']} */ 
/** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ 
/** @type {__VLS_StyleScopedClasses['gap-3']} */ 
/** @type {__VLS_StyleScopedClasses['flex-1']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-300']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ 
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-50']} */ 
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-offset-2']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['mr-2']} */ 
/** @type {__VLS_StyleScopedClasses['flex-1']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['border']} */ 
/** @type {__VLS_StyleScopedClasses['border-transparent']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ 
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ 
/** @type {__VLS_StyleScopedClasses['bg-blue-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-blue-700']} */ 
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-offset-2']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['mr-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-center']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['text-blue-600']} */ 
/** @type {__VLS_StyleScopedClasses['mt-1']} */ 
/** @type {__VLS_StyleScopedClasses['hover:text-blue-800']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
let __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        ShieldExclamationIcon: ShieldExclamationIcon,
        ExclamationTriangleIcon: ExclamationTriangleIcon,
        InformationCircleIcon: InformationCircleIcon,
        ArrowLeftIcon: ArrowLeftIcon,
        HomeIcon: HomeIcon,
        currentUser: currentUser,
        availablePermissions: availablePermissions,
        getRoleText: getRoleText,
        goBack: goBack,
        goToDashboard: goToDashboard,
    }),
});
export default (await import('vue')).defineComponent({});
 /* PartiallyEnd: #4569/main.vue */

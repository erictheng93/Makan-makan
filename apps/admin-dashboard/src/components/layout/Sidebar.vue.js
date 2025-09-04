import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { UserRole } from '@/types';
import { Home, ShoppingCart, Menu, Users, Table, BarChart3, ChefHat, Calculator, Settings, User } from 'lucide-vue-next';
const __VLS_props = defineProps();
const __VLS_emit = defineEmits();
const route = useRoute();
const authStore = useAuthStore();
const user = computed(() => authStore.user);
const navigationItems = computed(() => [
    {
        name: 'dashboard',
        path: '/dashboard',
        label: '儀表板',
        icon: Home,
        visible: true
    },
    {
        name: 'orders',
        path: '/dashboard/orders',
        label: '訂單管理',
        icon: ShoppingCart,
        visible: authStore.canManageOrders
    },
    {
        name: 'menu',
        path: '/dashboard/menu',
        label: '菜單管理',
        icon: Menu,
        visible: authStore.canManageMenu
    },
    {
        name: 'tables',
        path: '/dashboard/tables',
        label: '桌台管理',
        icon: Table,
        visible: authStore.canAccessAdminFeatures
    },
    {
        name: 'users',
        path: '/dashboard/users',
        label: '員工管理',
        icon: Users,
        visible: authStore.canAccessAdminFeatures
    },
    {
        name: 'analytics',
        path: '/dashboard/analytics',
        label: '數據分析',
        icon: BarChart3,
        visible: authStore.canAccessAdminFeatures
    },
    {
        name: 'settings',
        path: '/dashboard/settings',
        label: '系統設定',
        icon: Settings,
        visible: authStore.canAccessAdminFeatures
    },
    {
        name: 'kitchen',
        path: '/kitchen',
        label: '廚房顯示',
        icon: ChefHat,
        visible: authStore.canViewKitchen
    },
    {
        name: 'cashier',
        path: '/cashier',
        label: '收銀台',
        icon: Calculator,
        visible: authStore.hasPermission([UserRole.ADMIN, UserRole.OWNER, UserRole.CASHIER])
    }
]);
const isActiveRoute = (path) => {
    return route.path === path || route.path.startsWith(path + '/');
};
const getRoleLabel = (role) => {
    const roleLabels = {
        [UserRole.ADMIN]: '系統管理員',
        [UserRole.OWNER]: '店主',
        [UserRole.CHEF]: '廚師',
        [UserRole.SERVICE]: '服務員',
        [UserRole.CASHIER]: '收銀員'
    };
    return role !== undefined ? roleLabels[role] : '';
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_elements.aside, __VLS_elements.aside)({
    ...{ class: "bg-white border-r border-gray-200 transition-all duration-300" },
    ...{ class: (__VLS_ctx.isCollapsed ? 'w-16' : 'w-64') },
});
// @ts-ignore
[isCollapsed,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex flex-col h-full" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center h-16 px-4 border-b border-gray-200" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-3" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "text-white font-bold text-sm" },
});
if (!__VLS_ctx.isCollapsed) {
    // @ts-ignore
    [isCollapsed,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "font-semibold text-gray-900" },
    });
}
__VLS_asFunctionalElement(__VLS_elements.nav, __VLS_elements.nav)({
    ...{ class: "flex-1 px-4 py-4 space-y-2" },
});
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.navigationItems))) {
    // @ts-ignore
    [navigationItems,];
    const __VLS_0 = {}.RouterLink;
    /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ 
    // @ts-ignore
    RouterLink;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        key: (item.name),
        to: (item.path),
        ...{ class: "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors" },
        ...{ class: (__VLS_ctx.isActiveRoute(item.path)
                ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900') },
    }));
    const __VLS_2 = __VLS_1({
        key: (item.name),
        to: (item.path),
        ...{ class: "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors" },
        ...{ class: (__VLS_ctx.isActiveRoute(item.path)
                ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900') },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_asFunctionalDirective(__VLS_directives.vShow)(null, { ...__VLS_directiveBindingRestFields, value: (item.visible) }, null, null);
    const { default: __VLS_4 } = __VLS_3.slots;
    // @ts-ignore
    [isActiveRoute, vShow,];
    const __VLS_5 = ((item.icon));
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
        ...{ class: "w-5 h-5 flex-shrink-0" },
    }));
    const __VLS_7 = __VLS_6({
        ...{ class: "w-5 h-5 flex-shrink-0" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    if (!__VLS_ctx.isCollapsed) {
        // @ts-ignore
        [isCollapsed,];
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "ml-3" },
        });
        (item.label);
    }
    var __VLS_3;
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "px-4 py-4 border-t border-gray-200" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center" },
});
const __VLS_10 = {}.User;
/** @type {[typeof __VLS_components.User, ]} */ 
// @ts-ignore
User;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent(__VLS_10, new __VLS_10({
    ...{ class: "w-4 h-4 text-gray-600" },
}));
const __VLS_12 = __VLS_11({
    ...{ class: "w-4 h-4 text-gray-600" },
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
if (!__VLS_ctx.isCollapsed) {
    // @ts-ignore
    [isCollapsed,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "ml-3" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-sm font-medium text-gray-900" },
    });
    (__VLS_ctx.user?.username);
    // @ts-ignore
    [user,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-xs text-gray-500" },
    });
    (__VLS_ctx.getRoleLabel(__VLS_ctx.user?.role));
    // @ts-ignore
    [user, getRoleLabel,];
}
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['border-r']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['transition-all']} */ 
/** @type {__VLS_StyleScopedClasses['duration-300']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['flex-col']} */ 
/** @type {__VLS_StyleScopedClasses['h-full']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['h-16']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['border-b']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-3']} */ 
/** @type {__VLS_StyleScopedClasses['w-8']} */ 
/** @type {__VLS_StyleScopedClasses['h-8']} */ 
/** @type {__VLS_StyleScopedClasses['bg-primary-600']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['flex-1']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['py-4']} */ 
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['px-3']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['w-5']} */ 
/** @type {__VLS_StyleScopedClasses['h-5']} */ 
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ 
/** @type {__VLS_StyleScopedClasses['ml-3']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['py-4']} */ 
/** @type {__VLS_StyleScopedClasses['border-t']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['w-8']} */ 
/** @type {__VLS_StyleScopedClasses['h-8']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-300']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['ml-3']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
let __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        User: User,
        user: user,
        navigationItems: navigationItems,
        isActiveRoute: isActiveRoute,
        getRoleLabel: getRoleLabel,
    }),
    __typeEmits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
 /* PartiallyEnd: #4569/main.vue */

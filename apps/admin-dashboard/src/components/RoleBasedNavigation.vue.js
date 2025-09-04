import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { BuildingStorefrontIcon, HomeIcon, ShoppingCartIcon, DocumentTextIcon, TableCellsIcon, UsersIcon, ChartBarIcon, Cog6ToothIcon, BellIcon, UserIcon, ArrowRightOnRectangleIcon } from '@heroicons/vue/24/outline';
import { useAuthStore } from '@/stores/auth';
import { UserRole } from '@/types';
const router = useRouter();
const authStore = useAuthStore();
const showNotifications = ref(false);
const showUserMenu = ref(false);
const unreadNotifications = ref(2);
// 導航項目定義
const allNavItems = [
    {
        name: 'dashboard',
        label: '總覽',
        href: '/dashboard',
        icon: HomeIcon,
        roles: [UserRole.ADMIN, UserRole.OWNER, UserRole.CHEF, UserRole.SERVICE, UserRole.CASHIER]
    },
    {
        name: 'owner',
        label: '店主中心',
        href: '/owner',
        icon: BuildingStorefrontIcon,
        roles: [UserRole.ADMIN, UserRole.OWNER]
    },
    {
        name: 'orders',
        label: '訂單管理',
        href: '/dashboard/orders',
        icon: ShoppingCartIcon,
        roles: [UserRole.ADMIN, UserRole.OWNER, UserRole.SERVICE, UserRole.CASHIER]
    },
    {
        name: 'menu',
        label: '菜單管理',
        href: '/dashboard/menu',
        icon: DocumentTextIcon,
        roles: [UserRole.ADMIN, UserRole.OWNER]
    },
    {
        name: 'tables',
        label: '桌台管理',
        href: '/dashboard/tables',
        icon: TableCellsIcon,
        roles: [UserRole.ADMIN, UserRole.OWNER]
    },
    {
        name: 'kitchen',
        label: '廚房顯示',
        href: '/kitchen',
        icon: HomeIcon,
        roles: [UserRole.ADMIN, UserRole.OWNER, UserRole.CHEF]
    },
    {
        name: 'service',
        label: '送菜系統',
        href: '/service',
        icon: HomeIcon,
        roles: [UserRole.ADMIN, UserRole.OWNER, UserRole.SERVICE]
    },
    {
        name: 'cashier',
        label: '收銀台',
        href: '/cashier',
        icon: HomeIcon,
        roles: [UserRole.ADMIN, UserRole.OWNER, UserRole.CASHIER]
    },
    {
        name: 'analytics',
        label: '數據分析',
        href: '/dashboard/analytics',
        icon: ChartBarIcon,
        roles: [UserRole.ADMIN, UserRole.OWNER]
    },
    {
        name: 'users',
        label: '員工管理',
        href: '/dashboard/users',
        icon: UsersIcon,
        roles: [UserRole.ADMIN, UserRole.OWNER]
    },
    {
        name: 'settings',
        label: '系統設定',
        href: '/dashboard/settings',
        icon: Cog6ToothIcon,
        roles: [UserRole.ADMIN, UserRole.OWNER]
    }
];
// 用戶菜單項目
const userMenuItems = computed(() => {
    const items = [
        { name: 'profile', label: '個人資料', href: '/profile', icon: UserIcon },
        { name: 'settings', label: '偏好設定', href: '/preferences', icon: Cog6ToothIcon }
    ];
    return items.filter(item => {
        if (item.name === 'settings') {
            return authStore.canAccessAdminFeatures;
        }
        return true;
    });
});
// 根據用戶角色篩選可見的導航項目
const visibleNavItems = computed(() => {
    if (!authStore.user)
        return [];
    return allNavItems.filter(item => authStore.hasPermission(item.roles));
});
// 角色顯示名稱
const roleDisplayName = computed(() => {
    if (!authStore.user)
        return '';
    const roleNames = {
        [UserRole.ADMIN]: '系統管理員',
        [UserRole.OWNER]: '店主',
        [UserRole.CHEF]: '廚師',
        [UserRole.SERVICE]: '送菜員',
        [UserRole.CASHIER]: '收銀員'
    };
    return roleNames[authStore.user.role] || '未知角色';
});
// 角色顏色樣式
const roleColorClass = computed(() => {
    if (!authStore.user)
        return 'bg-gray-100 text-gray-800';
    const roleColors = {
        [UserRole.ADMIN]: 'bg-red-100 text-red-800',
        [UserRole.OWNER]: 'bg-purple-100 text-purple-800',
        [UserRole.CHEF]: 'bg-orange-100 text-orange-800',
        [UserRole.SERVICE]: 'bg-blue-100 text-blue-800',
        [UserRole.CASHIER]: 'bg-green-100 text-green-800'
    };
    return roleColors[authStore.user.role] || 'bg-gray-100 text-gray-800';
});
// 用戶姓名首字母
const userInitials = computed(() => {
    if (!authStore.user?.username)
        return '?';
    return authStore.user.username
        .split(' ')
        .map(name => name.charAt(0).toUpperCase())
        .join('')
        .substring(0, 2);
});
// 處理角色切換（僅管理員）
const handleRoleSwitch = (event) => {
    const target = event.target;
    const role = target.value;
    if (!role)
        return;
    const roleRoutes = {
        owner: '/owner',
        chef: '/kitchen',
        service: '/service',
        cashier: '/cashier'
    };
    router.push(roleRoutes[role]);
    target.value = ''; // 重置選擇
};
// 處理登出
const handleLogout = async () => {
    try {
        await authStore.logout();
        router.push('/login');
    }
    catch (error) {
        console.error('Logout error:', error);
    }
};
// 點擊外部關閉下拉菜單
const handleClickOutside = (event) => {
    const target = event.target;
    if (!target.closest('.relative')) {
        showUserMenu.value = false;
        showNotifications.value = false;
    }
};
onMounted(() => {
    document.addEventListener('click', handleClickOutside);
});
onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
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
    ...{ class: "flex" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex-shrink-0 flex items-center" },
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
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "ml-2 text-xl font-bold text-gray-900" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "hidden md:ml-6 md:flex md:space-x-8" },
});
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.visibleNavItems))) {
    // @ts-ignore
    [visibleNavItems,];
    const __VLS_5 = {}.RouterLink;
    /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ 
    // @ts-ignore
    RouterLink;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
        key: (item.name),
        to: (item.href),
        ...{ class: ([
                'flex items-center px-1 pt-1 text-sm font-medium transition-colors duration-200',
                __VLS_ctx.$route.path === item.href || __VLS_ctx.$route.path.startsWith(item.href + '/')
                    ? 'border-b-2 border-purple-500 text-purple-600'
                    : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]) },
    }));
    const __VLS_7 = __VLS_6({
        key: (item.name),
        to: (item.href),
        ...{ class: ([
                'flex items-center px-1 pt-1 text-sm font-medium transition-colors duration-200',
                __VLS_ctx.$route.path === item.href || __VLS_ctx.$route.path.startsWith(item.href + '/')
                    ? 'border-b-2 border-purple-500 text-purple-600'
                    : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    const { default: __VLS_9 } = __VLS_8.slots;
    // @ts-ignore
    [$route, $route,];
    const __VLS_10 = ((item.icon));
    // @ts-ignore
    const __VLS_11 = __VLS_asFunctionalComponent(__VLS_10, new __VLS_10({
        ...{ class: "w-5 h-5 mr-2" },
    }));
    const __VLS_12 = __VLS_11({
        ...{ class: "w-5 h-5 mr-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_11));
    (item.label);
    var __VLS_8;
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-4" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: ([
            'px-3 py-1 rounded-full text-xs font-medium',
            __VLS_ctx.roleColorClass
        ]) },
});
// @ts-ignore
[roleColorClass,];
(__VLS_ctx.roleDisplayName);
// @ts-ignore
[roleDisplayName,];
if (__VLS_ctx.authStore.userRole === __VLS_ctx.UserRole.ADMIN) {
    // @ts-ignore
    [authStore, UserRole,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "relative" },
    });
    __VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
        ...{ onChange: (__VLS_ctx.handleRoleSwitch) },
        ...{ class: "text-sm border border-gray-300 rounded-md px-3 py-1 bg-white" },
    });
    // @ts-ignore
    [handleRoleSwitch,];
    __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
        value: "",
    });
    __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
        value: "owner",
    });
    __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
        value: "chef",
    });
    __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
        value: "service",
    });
    __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
        value: "cashier",
    });
}
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showNotifications = !__VLS_ctx.showNotifications;
            // @ts-ignore
            [showNotifications, showNotifications,];
        } },
    ...{ class: "relative p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 rounded-lg" },
});
const __VLS_15 = {}.BellIcon;
/** @type {[typeof __VLS_components.BellIcon, ]} */ 
// @ts-ignore
BellIcon;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({
    ...{ class: "h-6 w-6" },
}));
const __VLS_17 = __VLS_16({
    ...{ class: "h-6 w-6" },
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
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
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showUserMenu = !__VLS_ctx.showUserMenu;
            // @ts-ignore
            [showUserMenu, showUserMenu,];
        } },
    ...{ class: "relative" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ class: "flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "text-sm font-medium text-white" },
});
(__VLS_ctx.userInitials);
// @ts-ignore
[userInitials,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "hidden md:block text-left" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm font-medium text-gray-900" },
});
(__VLS_ctx.authStore.user?.username);
// @ts-ignore
[authStore,];
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-xs text-gray-500" },
});
(__VLS_ctx.authStore.user?.email);
// @ts-ignore
[authStore,];
if (__VLS_ctx.showUserMenu) {
    // @ts-ignore
    [showUserMenu,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "py-1" },
    });
    for (const [item] of __VLS_getVForSourceType((__VLS_ctx.userMenuItems))) {
        // @ts-ignore
        [userMenuItems,];
        const __VLS_20 = {}.RouterLink;
        /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ 
        // @ts-ignore
        RouterLink;
        // @ts-ignore
        const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
            ...{ 'onClick': {} },
            key: (item.name),
            to: (item.href),
            ...{ class: "flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" },
        }));
        const __VLS_22 = __VLS_21({
            ...{ 'onClick': {} },
            key: (item.name),
            to: (item.href),
            ...{ class: "flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_21));
        let __VLS_24;
        let __VLS_25;
        const __VLS_26 = ({ click: {} },
            { onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showUserMenu))
                        return;
                    __VLS_ctx.showUserMenu = false;
                    // @ts-ignore
                    [showUserMenu,];
                } });
        const { default: __VLS_27 } = __VLS_23.slots;
        const __VLS_28 = ((item.icon));
        // @ts-ignore
        const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
            ...{ class: "w-4 h-4 mr-3" },
        }));
        const __VLS_30 = __VLS_29({
            ...{ class: "w-4 h-4 mr-3" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_29));
        (item.label);
        var __VLS_23;
    }
    __VLS_asFunctionalElement(__VLS_elements.hr)({
        ...{ class: "my-1 border-gray-200" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.handleLogout) },
        ...{ class: "flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50" },
    });
    // @ts-ignore
    [handleLogout,];
    const __VLS_33 = {}.ArrowRightOnRectangleIcon;
    /** @type {[typeof __VLS_components.ArrowRightOnRectangleIcon, ]} */ 
    // @ts-ignore
    ArrowRightOnRectangleIcon;
    // @ts-ignore
    const __VLS_34 = __VLS_asFunctionalComponent(__VLS_33, new __VLS_33({
        ...{ class: "w-4 h-4 mr-3" },
    }));
    const __VLS_35 = __VLS_34({
        ...{ class: "w-4 h-4 mr-3" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_34));
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "md:hidden" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "pt-2 pb-3 space-y-1" },
});
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.visibleNavItems))) {
    // @ts-ignore
    [visibleNavItems,];
    const __VLS_38 = {}.RouterLink;
    /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ 
    // @ts-ignore
    RouterLink;
    // @ts-ignore
    const __VLS_39 = __VLS_asFunctionalComponent(__VLS_38, new __VLS_38({
        key: (item.name),
        to: (item.href),
        ...{ class: ([
                'flex items-center px-3 py-2 text-base font-medium transition-colors duration-200',
                __VLS_ctx.$route.path === item.href
                    ? 'bg-purple-50 border-r-4 border-purple-500 text-purple-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            ]) },
    }));
    const __VLS_40 = __VLS_39({
        key: (item.name),
        to: (item.href),
        ...{ class: ([
                'flex items-center px-3 py-2 text-base font-medium transition-colors duration-200',
                __VLS_ctx.$route.path === item.href
                    ? 'bg-purple-50 border-r-4 border-purple-500 text-purple-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            ]) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_39));
    const { default: __VLS_42 } = __VLS_41.slots;
    // @ts-ignore
    [$route,];
    const __VLS_43 = ((item.icon));
    // @ts-ignore
    const __VLS_44 = __VLS_asFunctionalComponent(__VLS_43, new __VLS_43({
        ...{ class: "w-5 h-5 mr-3" },
    }));
    const __VLS_45 = __VLS_44({
        ...{ class: "w-5 h-5 mr-3" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_44));
    (item.label);
    var __VLS_41;
}
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
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['h-8']} */ 
/** @type {__VLS_StyleScopedClasses['w-8']} */ 
/** @type {__VLS_StyleScopedClasses['text-purple-600']} */ 
/** @type {__VLS_StyleScopedClasses['ml-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-xl']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['hidden']} */ 
/** @type {__VLS_StyleScopedClasses['md:ml-6']} */ 
/** @type {__VLS_StyleScopedClasses['md:flex']} */ 
/** @type {__VLS_StyleScopedClasses['md:space-x-8']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['px-1']} */ 
/** @type {__VLS_StyleScopedClasses['pt-1']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['duration-200']} */ 
/** @type {__VLS_StyleScopedClasses['w-5']} */ 
/** @type {__VLS_StyleScopedClasses['h-5']} */ 
/** @type {__VLS_StyleScopedClasses['mr-2']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-4']} */ 
/** @type {__VLS_StyleScopedClasses['px-3']} */ 
/** @type {__VLS_StyleScopedClasses['py-1']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['relative']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['border']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-300']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ 
/** @type {__VLS_StyleScopedClasses['px-3']} */ 
/** @type {__VLS_StyleScopedClasses['py-1']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
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
/** @type {__VLS_StyleScopedClasses['relative']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-3']} */ 
/** @type {__VLS_StyleScopedClasses['p-2']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-50']} */ 
/** @type {__VLS_StyleScopedClasses['w-8']} */ 
/** @type {__VLS_StyleScopedClasses['h-8']} */ 
/** @type {__VLS_StyleScopedClasses['bg-purple-500']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ 
/** @type {__VLS_StyleScopedClasses['md:block']} */ 
/** @type {__VLS_StyleScopedClasses['text-left']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['absolute']} */ 
/** @type {__VLS_StyleScopedClasses['right-0']} */ 
/** @type {__VLS_StyleScopedClasses['mt-2']} */ 
/** @type {__VLS_StyleScopedClasses['w-48']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ 
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ 
/** @type {__VLS_StyleScopedClasses['ring-1']} */ 
/** @type {__VLS_StyleScopedClasses['ring-black']} */ 
/** @type {__VLS_StyleScopedClasses['ring-opacity-5']} */ 
/** @type {__VLS_StyleScopedClasses['z-50']} */ 
/** @type {__VLS_StyleScopedClasses['py-1']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-100']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['mr-3']} */ 
/** @type {__VLS_StyleScopedClasses['my-1']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['w-full']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-red-600']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-red-50']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['mr-3']} */ 
/** @type {__VLS_StyleScopedClasses['md:hidden']} */ 
/** @type {__VLS_StyleScopedClasses['pt-2']} */ 
/** @type {__VLS_StyleScopedClasses['pb-3']} */ 
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['px-3']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-base']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['duration-200']} */ 
/** @type {__VLS_StyleScopedClasses['w-5']} */ 
/** @type {__VLS_StyleScopedClasses['h-5']} */ 
/** @type {__VLS_StyleScopedClasses['mr-3']} */ 
let __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        BuildingStorefrontIcon: BuildingStorefrontIcon,
        BellIcon: BellIcon,
        ArrowRightOnRectangleIcon: ArrowRightOnRectangleIcon,
        UserRole: UserRole,
        authStore: authStore,
        showNotifications: showNotifications,
        showUserMenu: showUserMenu,
        unreadNotifications: unreadNotifications,
        userMenuItems: userMenuItems,
        visibleNavItems: visibleNavItems,
        roleDisplayName: roleDisplayName,
        roleColorClass: roleColorClass,
        userInitials: userInitials,
        handleRoleSwitch: handleRoleSwitch,
        handleLogout: handleLogout,
    }),
});
export default (await import('vue')).defineComponent({});
 /* PartiallyEnd: #4569/main.vue */

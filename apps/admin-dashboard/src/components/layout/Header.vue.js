import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notification';
import { useSSE } from '@/composables/useSSE';
import { UserRole } from '@/types';
import { Menu, Bell, User, ChevronDown, ChevronRight, LogOut } from 'lucide-vue-next';
const __VLS_emit = defineEmits();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();
const { isConnected } = useSSE();
const showUserMenu = ref(false);
const showNotificationPanel = ref(false);
const user = computed(() => authStore.user);
const unreadNotifications = computed(() => notificationStore.unreadCount);
const pageTitle = computed(() => {
    return route.meta.title || 'MakanMakan 管理後台';
});
const breadcrumbs = computed(() => {
    const crumbs = [];
    const pathSegments = route.path.split('/').filter(Boolean);
    crumbs.push({ label: '首頁', path: '/dashboard' });
    if (pathSegments.length > 1) {
        const routeMapping = {
            orders: '訂單管理',
            menu: '菜單管理',
            tables: '桌台管理',
            users: '員工管理',
            analytics: '數據分析'
        };
        pathSegments.slice(1).forEach((segment, index) => {
            const label = routeMapping[segment] || segment;
            const path = '/' + pathSegments.slice(0, index + 2).join('/');
            crumbs.push({ label, path });
        });
    }
    return crumbs;
});
const toggleUserMenu = () => {
    showUserMenu.value = !showUserMenu.value;
};
const toggleNotifications = () => {
    showNotificationPanel.value = !showNotificationPanel.value;
};
const handleLogout = async () => {
    await authStore.logout();
    router.push('/login');
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
const handleClickOutside = (event) => {
    const target = event.target;
    if (!target.closest('.relative')) {
        showUserMenu.value = false;
        showNotificationPanel.value = false;
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
__VLS_asFunctionalElement(__VLS_elements.header, __VLS_elements.header)({
    ...{ class: "bg-white border-b border-gray-200 px-4 py-3" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center justify-between" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-4" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('toggle-sidebar');
            // @ts-ignore
            [$emit,];
        } },
    ...{ class: "p-2 rounded-lg hover:bg-gray-100 transition-colors" },
});
const __VLS_0 = {}.Menu;
/** @type {[typeof __VLS_components.Menu, ]} */ 
// @ts-ignore
Menu;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: "w-5 h-5 text-gray-600" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "w-5 h-5 text-gray-600" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "hidden sm:block" },
});
__VLS_asFunctionalElement(__VLS_elements.h1, __VLS_elements.h1)({
    ...{ class: "text-lg font-semibold text-gray-900" },
});
(__VLS_ctx.pageTitle);
// @ts-ignore
[pageTitle,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-4" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.toggleNotifications) },
    ...{ class: "relative p-2 rounded-lg hover:bg-gray-100 transition-colors" },
});
// @ts-ignore
[toggleNotifications,];
const __VLS_5 = {}.Bell;
/** @type {[typeof __VLS_components.Bell, ]} */ 
// @ts-ignore
Bell;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
    ...{ class: "w-5 h-5 text-gray-600" },
}));
const __VLS_7 = __VLS_6({
    ...{ class: "w-5 h-5 text-gray-600" },
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
if (__VLS_ctx.unreadNotifications > 0) {
    // @ts-ignore
    [unreadNotifications,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center" },
    });
    (__VLS_ctx.unreadNotifications > 99 ? '99+' : __VLS_ctx.unreadNotifications);
    // @ts-ignore
    [unreadNotifications, unreadNotifications,];
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "hidden sm:flex items-center space-x-2 text-sm text-gray-500" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "w-2 h-2 rounded-full" },
    ...{ class: (__VLS_ctx.isConnected ? 'bg-green-500' : 'bg-red-500') },
});
// @ts-ignore
[isConnected,];
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
(__VLS_ctx.isConnected ? '即時連線' : '連線中斷');
// @ts-ignore
[isConnected,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "relative" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.toggleUserMenu) },
    ...{ class: "flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors" },
});
// @ts-ignore
[toggleUserMenu,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center" },
});
const __VLS_10 = {}.User;
/** @type {[typeof __VLS_components.User, ]} */ 
// @ts-ignore
User;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent(__VLS_10, new __VLS_10({
    ...{ class: "w-4 h-4 text-primary-600" },
}));
const __VLS_12 = __VLS_11({
    ...{ class: "w-4 h-4 text-primary-600" },
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "hidden sm:block text-left" },
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
const __VLS_15 = {}.ChevronDown;
/** @type {[typeof __VLS_components.ChevronDown, ]} */ 
// @ts-ignore
ChevronDown;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({
    ...{ class: "w-4 h-4 text-gray-600" },
}));
const __VLS_17 = __VLS_16({
    ...{ class: "w-4 h-4 text-gray-600" },
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
if (__VLS_ctx.showUserMenu) {
    // @ts-ignore
    [showUserMenu,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "py-1" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.handleLogout) },
        ...{ class: "w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors" },
    });
    // @ts-ignore
    [handleLogout,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center space-x-2" },
    });
    const __VLS_20 = {}.LogOut;
    /** @type {[typeof __VLS_components.LogOut, ]} */ 
    // @ts-ignore
    LogOut;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
        ...{ class: "w-4 h-4" },
    }));
    const __VLS_22 = __VLS_21({
        ...{ class: "w-4 h-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
}
if (__VLS_ctx.breadcrumbs.length > 1) {
    // @ts-ignore
    [breadcrumbs,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "mt-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.nav, __VLS_elements.nav)({
        ...{ class: "flex items-center space-x-1 text-sm text-gray-500" },
    });
    for (const [crumb, index] of __VLS_getVForSourceType((__VLS_ctx.breadcrumbs))) {
        (crumb.path);
        // @ts-ignore
        [breadcrumbs,];
        if (index < __VLS_ctx.breadcrumbs.length - 1) {
            // @ts-ignore
            [breadcrumbs,];
            const __VLS_25 = {}.RouterLink;
            /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ 
            // @ts-ignore
            RouterLink;
            // @ts-ignore
            const __VLS_26 = __VLS_asFunctionalComponent(__VLS_25, new __VLS_25({
                to: (crumb.path),
                ...{ class: "hover:text-gray-700 transition-colors" },
            }));
            const __VLS_27 = __VLS_26({
                to: (crumb.path),
                ...{ class: "hover:text-gray-700 transition-colors" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_26));
            const { default: __VLS_29 } = __VLS_28.slots;
            (crumb.label);
            var __VLS_28;
        }
        else {
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                ...{ class: "text-gray-900 font-medium" },
            });
            (crumb.label);
        }
        if (index < __VLS_ctx.breadcrumbs.length - 1) {
            // @ts-ignore
            [breadcrumbs,];
            const __VLS_30 = {}.ChevronRight;
            /** @type {[typeof __VLS_components.ChevronRight, ]} */ 
            // @ts-ignore
            ChevronRight;
            // @ts-ignore
            const __VLS_31 = __VLS_asFunctionalComponent(__VLS_30, new __VLS_30({
                ...{ class: "w-4 h-4" },
            }));
            const __VLS_32 = __VLS_31({
                ...{ class: "w-4 h-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_31));
        }
    }
}
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['border-b']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['py-3']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-4']} */ 
/** @type {__VLS_StyleScopedClasses['p-2']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-100']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['w-5']} */ 
/** @type {__VLS_StyleScopedClasses['h-5']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['hidden']} */ 
/** @type {__VLS_StyleScopedClasses['sm:block']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-4']} */ 
/** @type {__VLS_StyleScopedClasses['relative']} */ 
/** @type {__VLS_StyleScopedClasses['p-2']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-100']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['w-5']} */ 
/** @type {__VLS_StyleScopedClasses['h-5']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['absolute']} */ 
/** @type {__VLS_StyleScopedClasses['-top-1']} */ 
/** @type {__VLS_StyleScopedClasses['-right-1']} */ 
/** @type {__VLS_StyleScopedClasses['bg-red-500']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['w-5']} */ 
/** @type {__VLS_StyleScopedClasses['h-5']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['hidden']} */ 
/** @type {__VLS_StyleScopedClasses['sm:flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['w-2']} */ 
/** @type {__VLS_StyleScopedClasses['h-2']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['relative']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ 
/** @type {__VLS_StyleScopedClasses['p-2']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-100']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['w-8']} */ 
/** @type {__VLS_StyleScopedClasses['h-8']} */ 
/** @type {__VLS_StyleScopedClasses['bg-primary-100']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-primary-600']} */ 
/** @type {__VLS_StyleScopedClasses['hidden']} */ 
/** @type {__VLS_StyleScopedClasses['sm:block']} */ 
/** @type {__VLS_StyleScopedClasses['text-left']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['absolute']} */ 
/** @type {__VLS_StyleScopedClasses['right-0']} */ 
/** @type {__VLS_StyleScopedClasses['mt-2']} */ 
/** @type {__VLS_StyleScopedClasses['w-48']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ 
/** @type {__VLS_StyleScopedClasses['border']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['z-50']} */ 
/** @type {__VLS_StyleScopedClasses['py-1']} */ 
/** @type {__VLS_StyleScopedClasses['w-full']} */ 
/** @type {__VLS_StyleScopedClasses['text-left']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-100']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['mt-2']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-1']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['hover:text-gray-700']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
let __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        Menu: Menu,
        Bell: Bell,
        User: User,
        ChevronDown: ChevronDown,
        ChevronRight: ChevronRight,
        LogOut: LogOut,
        isConnected: isConnected,
        showUserMenu: showUserMenu,
        user: user,
        unreadNotifications: unreadNotifications,
        pageTitle: pageTitle,
        breadcrumbs: breadcrumbs,
        toggleUserMenu: toggleUserMenu,
        toggleNotifications: toggleNotifications,
        handleLogout: handleLogout,
        getRoleLabel: getRoleLabel,
    }),
    __typeEmits: {},
});
export default (await import('vue')).defineComponent({
    __typeEmits: {},
});
 /* PartiallyEnd: #4569/main.vue */

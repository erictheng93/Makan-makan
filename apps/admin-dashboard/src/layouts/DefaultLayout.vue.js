/// <reference types="C:/Users/minim/OneDrive/文档/Code/platform/makanmakan/apps/admin-dashboard/node_modules/.vue-global-types/vue_3.5_0.d.ts" />
import { ref, onMounted, onUnmounted } from 'vue';
import Sidebar from '@/components/layout/Sidebar.vue';
import Header from '@/components/layout/Header.vue';
import NotificationPanel from '@/components/layout/NotificationPanel.vue';
import { useSSE } from '@/composables/useSSE';
const isSidebarCollapsed = ref(false);
const showNotifications = ref(false);
const { connect, disconnect } = useSSE();
const toggleSidebar = () => {
    isSidebarCollapsed.value = !isSidebarCollapsed.value;
};
onMounted(() => {
    connect();
});
onUnmounted(() => {
    disconnect();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex h-screen bg-gray-100" },
});
/** @type {[typeof Sidebar, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(Sidebar, new Sidebar({
    ...{ 'onToggle': {} },
    isCollapsed: (__VLS_ctx.isSidebarCollapsed),
}));
const __VLS_1 = __VLS_0({
    ...{ 'onToggle': {} },
    isCollapsed: (__VLS_ctx.isSidebarCollapsed),
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
let __VLS_3;
let __VLS_4;
const __VLS_5 = ({ toggle: {} },
    { onToggle: (__VLS_ctx.toggleSidebar) });
// @ts-ignore
[isSidebarCollapsed, toggleSidebar,];
var __VLS_2;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex-1 flex flex-col overflow-hidden" },
});
/** @type {[typeof Header, ]} */ ;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent(Header, new Header({
    ...{ 'onToggleSidebar': {} },
}));
const __VLS_8 = __VLS_7({
    ...{ 'onToggleSidebar': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
let __VLS_10;
let __VLS_11;
const __VLS_12 = ({ toggleSidebar: {} },
    { onToggleSidebar: (__VLS_ctx.toggleSidebar) });
// @ts-ignore
[toggleSidebar,];
var __VLS_9;
__VLS_asFunctionalElement(__VLS_elements.main, __VLS_elements.main)({
    ...{ class: "flex-1 overflow-y-auto p-4" },
});
const __VLS_14 = {}.RouterView;
/** @type {[typeof __VLS_components.RouterView, typeof __VLS_components.routerView, ]} */ ;
// @ts-ignore
RouterView;
// @ts-ignore
const __VLS_15 = __VLS_asFunctionalComponent(__VLS_14, new __VLS_14({}));
const __VLS_16 = __VLS_15({}, ...__VLS_functionalComponentArgsRest(__VLS_15));
if (__VLS_ctx.showNotifications) {
    // @ts-ignore
    [showNotifications,];
    /** @type {[typeof NotificationPanel, ]} */ ;
    // @ts-ignore
    const __VLS_19 = __VLS_asFunctionalComponent(NotificationPanel, new NotificationPanel({
        ...{ 'onClose': {} },
    }));
    const __VLS_20 = __VLS_19({
        ...{ 'onClose': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_19));
    let __VLS_22;
    let __VLS_23;
    const __VLS_24 = ({ close: {} },
        { onClose: (...[$event]) => {
                if (!(__VLS_ctx.showNotifications))
                    return;
                __VLS_ctx.showNotifications = false;
                // @ts-ignore
                [showNotifications,];
            } });
    var __VLS_21;
}
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-screen']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        Sidebar: Sidebar,
        Header: Header,
        NotificationPanel: NotificationPanel,
        isSidebarCollapsed: isSidebarCollapsed,
        showNotifications: showNotifications,
        toggleSidebar: toggleSidebar,
    }),
});
export default (await import('vue')).defineComponent({});
; /* PartiallyEnd: #4569/main.vue */

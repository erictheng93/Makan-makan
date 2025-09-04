import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useDashboardStore } from '@/stores/dashboard';
import { format } from 'date-fns';
const authStore = useAuthStore();
const dashboardStore = useDashboardStore();
const currentDate = ref('');
const isOnline = ref(navigator.onLine);
const userName = computed(() => authStore.user?.username || '');
const restaurantName = computed(() => 'MakanMakan Restaurant');
const todayRevenue = computed(() => `$${dashboardStore.todayRevenue?.toFixed(2) || '0.00'}`);
const todayOrderCount = computed(() => dashboardStore.todayOrders || 0);
const updateDate = () => {
    currentDate.value = format(new Date(), 'yyyy/MM/dd HH:mm');
};
onMounted(() => {
    updateDate();
    setInterval(updateDate, 60000); // Update every minute
    window.addEventListener('online', () => isOnline.value = true);
    window.addEventListener('offline', () => isOnline.value = false);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "h-screen bg-white flex flex-col" },
});
__VLS_asFunctionalElement(__VLS_elements.header, __VLS_elements.header)({
    ...{ class: "bg-primary-600 text-white px-4 py-3 border-b shadow-sm" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center justify-between" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-3" },
});
__VLS_asFunctionalElement(__VLS_elements.h1, __VLS_elements.h1)({
    ...{ class: "text-xl font-semibold" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-sm opacity-90" },
});
(__VLS_ctx.restaurantName);
// @ts-ignore
[restaurantName,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-4" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-sm" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
(__VLS_ctx.userName);
// @ts-ignore
[userName,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
(__VLS_ctx.currentDate);
// @ts-ignore
[currentDate,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$router.push('/dashboard');
            // @ts-ignore
            [$router,];
        } },
    ...{ class: "bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm transition-colors" },
});
__VLS_asFunctionalElement(__VLS_elements.main, __VLS_elements.main)({
    ...{ class: "flex-1 overflow-hidden" },
});
const __VLS_0 = {}.RouterView;
/** @type {[typeof __VLS_components.RouterView, typeof __VLS_components.routerView, ]} */ 
// @ts-ignore
RouterView;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_elements.footer, __VLS_elements.footer)({
    ...{ class: "bg-gray-50 px-4 py-2 border-t" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center justify-between text-sm text-gray-600" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
(__VLS_ctx.todayRevenue);
// @ts-ignore
[todayRevenue,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
(__VLS_ctx.todayOrderCount);
// @ts-ignore
[todayOrderCount,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-2" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "w-2 h-2 rounded-full" },
    ...{ class: (__VLS_ctx.isOnline ? 'bg-green-500' : 'bg-red-500') },
});
// @ts-ignore
[isOnline,];
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
(__VLS_ctx.isOnline ? '已連線' : '離線');
// @ts-ignore
[isOnline,];
/** @type {__VLS_StyleScopedClasses['h-screen']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['flex-col']} */ 
/** @type {__VLS_StyleScopedClasses['bg-primary-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['py-3']} */ 
/** @type {__VLS_StyleScopedClasses['border-b']} */ 
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-3']} */ 
/** @type {__VLS_StyleScopedClasses['text-xl']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['opacity-90']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white/20']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-white/30']} */ 
/** @type {__VLS_StyleScopedClasses['px-3']} */ 
/** @type {__VLS_StyleScopedClasses['py-1']} */ 
/** @type {__VLS_StyleScopedClasses['rounded']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['flex-1']} */ 
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['border-t']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ 
/** @type {__VLS_StyleScopedClasses['w-2']} */ 
/** @type {__VLS_StyleScopedClasses['h-2']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
let __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        currentDate: currentDate,
        isOnline: isOnline,
        userName: userName,
        restaurantName: restaurantName,
        todayRevenue: todayRevenue,
        todayOrderCount: todayOrderCount,
    }),
});
export default (await import('vue')).defineComponent({});
 /* PartiallyEnd: #4569/main.vue */

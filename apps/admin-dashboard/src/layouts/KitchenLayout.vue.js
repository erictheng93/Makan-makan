import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Clock } from 'lucide-vue-next';
import { useOrderStore } from '@/stores/order';
import { format } from 'date-fns';
const orderStore = useOrderStore();
const currentTime = ref('');
const pendingOrdersCount = computed(() => orderStore.pendingOrdersCount);
let timeInterval = null;
const updateTime = () => {
    currentTime.value = format(new Date(), 'yyyy/MM/dd HH:mm:ss');
};
onMounted(() => {
    updateTime();
    timeInterval = setInterval(updateTime, 1000);
});
onUnmounted(() => {
    if (timeInterval) {
        clearInterval(timeInterval);
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "h-screen bg-gray-900 text-white" },
});
__VLS_asFunctionalElement(__VLS_elements.header, __VLS_elements.header)({
    ...{ class: "bg-gray-800 px-6 py-4 border-b border-gray-700" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center justify-between" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-4" },
});
__VLS_asFunctionalElement(__VLS_elements.h1, __VLS_elements.h1)({
    ...{ class: "text-2xl font-bold text-primary-400" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-2 text-sm text-gray-300" },
});
const __VLS_0 = {}.Clock;
/** @type {[typeof __VLS_components.Clock, ]} */ 
// @ts-ignore
Clock;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: "w-4 h-4" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "w-4 h-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
(__VLS_ctx.currentTime);
// @ts-ignore
[currentTime,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-4" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-2" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "text-sm text-gray-300" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "bg-red-600 text-white px-3 py-1 rounded-full text-lg font-bold" },
});
(__VLS_ctx.pendingOrdersCount);
// @ts-ignore
[pendingOrdersCount,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$router.push('/dashboard');
            // @ts-ignore
            [$router,];
        } },
    ...{ class: "btn-secondary" },
});
__VLS_asFunctionalElement(__VLS_elements.main, __VLS_elements.main)({
    ...{ class: "h-full overflow-hidden p-6" },
});
const __VLS_5 = {}.RouterView;
/** @type {[typeof __VLS_components.RouterView, typeof __VLS_components.routerView, ]} */ 
// @ts-ignore
RouterView;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({}));
const __VLS_7 = __VLS_6({}, ...__VLS_functionalComponentArgsRest(__VLS_6));
/** @type {__VLS_StyleScopedClasses['h-screen']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-800']} */ 
/** @type {__VLS_StyleScopedClasses['px-6']} */ 
/** @type {__VLS_StyleScopedClasses['py-4']} */ 
/** @type {__VLS_StyleScopedClasses['border-b']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-700']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-primary-400']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-4']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-300']} */ 
/** @type {__VLS_StyleScopedClasses['bg-red-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['px-3']} */ 
/** @type {__VLS_StyleScopedClasses['py-1']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ 
/** @type {__VLS_StyleScopedClasses['h-full']} */ 
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ 
/** @type {__VLS_StyleScopedClasses['p-6']} */ 
let __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        Clock: Clock,
        currentTime: currentTime,
        pendingOrdersCount: pendingOrdersCount,
    }),
});
export default (await import('vue')).defineComponent({});
 /* PartiallyEnd: #4569/main.vue */

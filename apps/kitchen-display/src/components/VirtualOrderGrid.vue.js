import { ref, computed, watch, onMounted, nextTick } from 'vue';
const props = withDefaults(defineProps(), {
    containerHeight: 600,
    columnsCount: 3,
    bufferSize: 3,
    loading: false,
    hasMore: false
});
const emit = defineEmits();
// Refs
const container = ref();
const scrollTop = ref(0);
const isLoadingMore = ref(false);
// Computed properties
const totalOrders = computed(() => props.orders.length);
const rowsPerView = computed(() => Math.ceil(props.containerHeight / props.itemHeight));
const totalRows = computed(() => Math.ceil(totalOrders.value / props.columnsCount));
const gridCols = computed(() => {
    const colsMap = {
        1: 'grid-cols-1',
        2: 'grid-cols-1 md:grid-cols-2',
        3: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
        4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
        5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
        6: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'
    };
    return colsMap[props.columnsCount] || 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';
});
const startRow = computed(() => {
    const row = Math.floor(scrollTop.value / props.itemHeight) - props.bufferSize;
    return Math.max(0, row);
});
const endRow = computed(() => {
    const row = startRow.value + rowsPerView.value + props.bufferSize * 2;
    return Math.min(totalRows.value - 1, row);
});
const visibleOrders = computed(() => {
    const startIndex = startRow.value * props.columnsCount;
    const endIndex = (endRow.value + 1) * props.columnsCount - 1;
    const orders = [];
    for (let i = startIndex; i <= endIndex && i < props.orders.length; i++) {
        if (props.orders[i]) {
            orders.push({
                ...props.orders[i],
                _virtualIndex: i
            });
        }
    }
    return orders;
});
const beforeHeight = computed(() => startRow.value * props.itemHeight);
const afterHeight = computed(() => {
    const remaining = totalRows.value - endRow.value - 1;
    return Math.max(0, remaining * props.itemHeight);
});
// Methods
const handleScroll = async (event) => {
    const target = event.target;
    scrollTop.value = target.scrollTop;
    // Check if we need to load more items
    if (props.hasMore && !isLoadingMore.value && props.loadMore) {
        const scrolledPercentage = (target.scrollTop + target.clientHeight) / target.scrollHeight;
        if (scrolledPercentage > 0.9) { // Load more when 90% scrolled
            await loadMoreItems();
        }
    }
};
const loadMoreItems = async () => {
    if (isLoadingMore.value || !props.loadMore)
        return;
    try {
        isLoadingMore.value = true;
        await props.loadMore();
        emit('load-more');
    }
    catch (error) {
        console.error('Error loading more kitchen orders:', error);
    }
    finally {
        isLoadingMore.value = false;
    }
};
const scrollToTop = (behavior = 'smooth') => {
    if (!container.value)
        return;
    container.value.scrollTo({
        top: 0,
        behavior
    });
};
const scrollToBottom = (behavior = 'smooth') => {
    if (!container.value)
        return;
    container.value.scrollTo({
        top: container.value.scrollHeight,
        behavior
    });
};
const scrollToOrder = (orderId, behavior = 'smooth') => {
    const orderIndex = props.orders.findIndex(order => order.id === orderId);
    if (orderIndex === -1 || !container.value)
        return;
    const row = Math.floor(orderIndex / props.columnsCount);
    const scrollPosition = row * props.itemHeight;
    container.value.scrollTo({
        top: scrollPosition,
        behavior
    });
};
// Watch for orders changes and maintain scroll position
let previousOrdersLength = 0;
watch(() => props.orders.length, (newLength) => {
    const ordersAdded = newLength - previousOrdersLength;
    // If orders were prepended, adjust scroll position
    if (ordersAdded > 0 && previousOrdersLength > 0) {
        nextTick(() => {
            if (container.value) {
                const newRows = Math.ceil(ordersAdded / props.columnsCount);
                const newScrollTop = scrollTop.value + (newRows * props.itemHeight);
                container.value.scrollTop = newScrollTop;
            }
        });
    }
    previousOrdersLength = newLength;
});
// Lifecycle
onMounted(() => {
    if (container.value) {
        scrollTop.value = container.value.scrollTop;
    }
});
// Expose methods for parent components
const __VLS_exposed = {
    scrollToTop,
    scrollToBottom,
    scrollToOrder,
    container
};
defineExpose(__VLS_exposed);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    containerHeight: 600,
    columnsCount: 3,
    bufferSize: 3,
    loading: false,
    hasMore: false
});
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['virtual-grid-container']} */ ;
/** @type {__VLS_StyleScopedClasses['virtual-grid-container']} */ ;
/** @type {__VLS_StyleScopedClasses['virtual-grid-container']} */ ;
/** @type {__VLS_StyleScopedClasses['virtual-grid-container']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ onScroll: (__VLS_ctx.handleScroll) },
    ref: "container",
    ...{ style: ({ height: __VLS_ctx.containerHeight + 'px', overflowY: 'auto' }) },
    ...{ class: "virtual-grid-container grid gap-6" },
    ...{ class: (__VLS_ctx.gridCols) },
});
/** @type {typeof __VLS_ctx.container} */ ;
// @ts-ignore
[handleScroll, containerHeight, gridCols, container,];
if (__VLS_ctx.beforeHeight > 0) {
    // @ts-ignore
    [beforeHeight,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ style: ({
                height: __VLS_ctx.beforeHeight + 'px',
                gridColumn: `1 / -1`
            }) },
    });
    // @ts-ignore
    [beforeHeight,];
}
for (const [order] of __VLS_getVForSourceType((__VLS_ctx.visibleOrders))) {
    // @ts-ignore
    [visibleOrders,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        key: (order.id),
        ...{ style: ({ minHeight: __VLS_ctx.itemHeight + 'px' }) },
        ...{ class: "virtual-grid-item" },
    });
    // @ts-ignore
    [itemHeight,];
    var __VLS_0 = {
        order: (order),
        index: (order._virtualIndex),
    };
}
if (__VLS_ctx.afterHeight > 0) {
    // @ts-ignore
    [afterHeight,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ style: ({
                height: __VLS_ctx.afterHeight + 'px',
                gridColumn: `1 / -1`
            }) },
    });
    // @ts-ignore
    [afterHeight,];
}
if (__VLS_ctx.loading && __VLS_ctx.hasMore) {
    // @ts-ignore
    [loading, hasMore,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ style: ({ height: __VLS_ctx.itemHeight + 'px', gridColumn: `1 / -1` }) },
        ...{ class: "virtual-grid-loading" },
    });
    // @ts-ignore
    [itemHeight,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center justify-center h-full" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "ml-3 text-gray-600" },
    });
}
/** @type {__VLS_StyleScopedClasses['virtual-grid-container']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-6']} */ ;
/** @type {__VLS_StyleScopedClasses['virtual-grid-item']} */ ;
/** @type {__VLS_StyleScopedClasses['virtual-grid-loading']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
// @ts-ignore
var __VLS_1 = __VLS_0;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        container: container,
        gridCols: gridCols,
        visibleOrders: visibleOrders,
        beforeHeight: beforeHeight,
        afterHeight: afterHeight,
        handleScroll: handleScroll,
    }),
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
const __VLS_component = (await import('vue')).defineComponent({
    setup: () => (__VLS_exposed),
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
export default {};
; /* PartiallyEnd: #4569/main.vue */

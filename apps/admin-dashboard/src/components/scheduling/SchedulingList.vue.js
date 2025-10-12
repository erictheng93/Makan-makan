import { ref, computed } from 'vue';
const props = withDefaults(defineProps(), {
    loading: false
});
const __VLS_emit = defineEmits();
// State
const searchQuery = ref('');
const statusFilter = ref('');
// Computed
const filteredSchedules = computed(() => {
    let result = props.schedules;
    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        result = result.filter(s => s.employeeName?.toLowerCase().includes(query) ?? false);
    }
    if (statusFilter.value) {
        result = result.filter(s => s.status === statusFilter.value);
    }
    return result.sort((a, b) => {
        // Sort by date descending
        return new Date(b.workDate).getTime() - new Date(a.workDate).getTime();
    });
});
// Methods
const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const weekday = weekdays[date.getDay()];
    return `${month}/${day} (${weekday})`;
};
const getStatusLabel = (status) => {
    const labels = {
        scheduled: '已排班',
        confirmed: '已確認',
        completed: '已完成',
        cancelled: '已取消',
        no_show: '缺席'
    };
    return labels[status] || status;
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    loading: false
});
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['search-input']} */ ;
/** @type {__VLS_StyleScopedClasses['search-input']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-select']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-icon']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "scheduling-list" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "list-filters" },
});
__VLS_asFunctionalElement(__VLS_elements.input)({
    value: (__VLS_ctx.searchQuery),
    type: "text",
    placeholder: "搜尋員工姓名...",
    ...{ class: "search-input" },
});
// @ts-ignore
[searchQuery,];
__VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
    value: (__VLS_ctx.statusFilter),
    ...{ class: "filter-select" },
});
// @ts-ignore
[statusFilter,];
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "scheduled",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "confirmed",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "completed",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "cancelled",
});
if (__VLS_ctx.loading) {
    // @ts-ignore
    [loading,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "loading-state" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "spinner-small" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({});
}
else if (__VLS_ctx.filteredSchedules.length === 0) {
    // @ts-ignore
    [filteredSchedules,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "empty-state" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "empty-icon" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({});
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({});
}
else {
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "schedules-table" },
    });
    __VLS_asFunctionalElement(__VLS_elements.table, __VLS_elements.table)({});
    __VLS_asFunctionalElement(__VLS_elements.thead, __VLS_elements.thead)({});
    __VLS_asFunctionalElement(__VLS_elements.tr, __VLS_elements.tr)({});
    __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({});
    __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({});
    __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({});
    __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({});
    __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({});
    __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({});
    __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({});
    __VLS_asFunctionalElement(__VLS_elements.tbody, __VLS_elements.tbody)({});
    for (const [schedule] of __VLS_getVForSourceType((__VLS_ctx.filteredSchedules))) {
        // @ts-ignore
        [filteredSchedules,];
        __VLS_asFunctionalElement(__VLS_elements.tr, __VLS_elements.tr)({
            key: (schedule.id),
        });
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({});
        (__VLS_ctx.formatDate(schedule.workDate));
        // @ts-ignore
        [formatDate,];
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({});
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "employee-cell" },
        });
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "employee-name" },
        });
        (schedule.employeeName);
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({});
        if (schedule.shiftTemplate) {
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                ...{ class: "shift-badge" },
                ...{ style: ({ backgroundColor: schedule.shiftTemplate.colorCode + '20', color: schedule.shiftTemplate.colorCode }) },
            });
            (schedule.shiftTemplate.name);
        }
        else {
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                ...{ class: "text-muted" },
            });
        }
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({});
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "time-range" },
        });
        (schedule.startTime);
        (schedule.endTime);
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({});
        (schedule.scheduledHours);
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({});
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "status-badge" },
            ...{ class: (`status-${schedule.status}`) },
        });
        (__VLS_ctx.getStatusLabel(schedule.status));
        // @ts-ignore
        [getStatusLabel,];
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({});
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "action-buttons" },
        });
        __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    if (!!(__VLS_ctx.filteredSchedules.length === 0))
                        return;
                    __VLS_ctx.$emit('edit', schedule);
                    // @ts-ignore
                    [$emit,];
                } },
            ...{ class: "btn-icon" },
            title: "編輯",
        });
        __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    if (!!(__VLS_ctx.filteredSchedules.length === 0))
                        return;
                    __VLS_ctx.$emit('delete', schedule);
                    // @ts-ignore
                    [$emit,];
                } },
            ...{ class: "btn-icon" },
            title: "刪除",
        });
    }
}
/** @type {__VLS_StyleScopedClasses['scheduling-list']} */ ;
/** @type {__VLS_StyleScopedClasses['list-filters']} */ ;
/** @type {__VLS_StyleScopedClasses['search-input']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-select']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-state']} */ ;
/** @type {__VLS_StyleScopedClasses['spinner-small']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['schedules-table']} */ ;
/** @type {__VLS_StyleScopedClasses['employee-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['employee-name']} */ ;
/** @type {__VLS_StyleScopedClasses['shift-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['text-muted']} */ ;
/** @type {__VLS_StyleScopedClasses['time-range']} */ ;
/** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['action-buttons']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-icon']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        searchQuery: searchQuery,
        statusFilter: statusFilter,
        filteredSchedules: filteredSchedules,
        formatDate: formatDate,
        getStatusLabel: getStatusLabel,
    }),
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
export default (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
; /* PartiallyEnd: #4569/main.vue */

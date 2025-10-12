import { ref, computed } from 'vue';
const props = withDefaults(defineProps(), {
    loading: false
});
const emit = defineEmits();
// State
const currentDate = ref(new Date());
// Computed
const currentMonthYear = computed(() => {
    const year = currentDate.value.getFullYear();
    const month = currentDate.value.getMonth() + 1;
    return `${year}年 ${month}月`;
});
const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
const calendarDays = computed(() => {
    const year = currentDate.value.getFullYear();
    const month = currentDate.value.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
        const dayNumber = prevMonthLastDay - i;
        const date = new Date(year, month - 1, dayNumber);
        days.push({
            dayNumber,
            date: formatDate(date),
            isOtherMonth: true,
            isToday: false,
            scheduleCount: getScheduleCount(formatDate(date))
        });
    }
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        const formattedDate = formatDate(date);
        days.push({
            dayNumber: i,
            date: formattedDate,
            isOtherMonth: false,
            isToday: isSameDay(date, today),
            scheduleCount: getScheduleCount(formattedDate)
        });
    }
    // Next month days
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    for (let i = 1; i <= remainingDays; i++) {
        const date = new Date(year, month + 1, i);
        days.push({
            dayNumber: i,
            date: formatDate(date),
            isOtherMonth: true,
            isToday: false,
            scheduleCount: getScheduleCount(formatDate(date))
        });
    }
    return days;
});
// Methods
const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const isSameDay = (date1, date2) => {
    return (date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate());
};
const getScheduleCount = (date) => {
    return props.schedules.filter(s => s.workDate === date).length;
};
const previousMonth = () => {
    currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, 1);
};
const nextMonth = () => {
    currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 1);
};
const selectDate = (date) => {
    emit('dateSelect', date);
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    loading: false
});
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['nav-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['calendar-day']} */ ;
/** @type {__VLS_StyleScopedClasses['calendar-day']} */ ;
/** @type {__VLS_StyleScopedClasses['calendar-day']} */ ;
/** @type {__VLS_StyleScopedClasses['calendar-day']} */ ;
/** @type {__VLS_StyleScopedClasses['today']} */ ;
/** @type {__VLS_StyleScopedClasses['calendar-day']} */ ;
/** @type {__VLS_StyleScopedClasses['day-number']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "scheduling-calendar" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "calendar-header" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.previousMonth) },
    ...{ class: "nav-btn" },
});
// @ts-ignore
[previousMonth,];
__VLS_asFunctionalElement(__VLS_elements.i, __VLS_elements.i)({});
__VLS_asFunctionalElement(__VLS_elements.h2, __VLS_elements.h2)({
    ...{ class: "current-month" },
});
(__VLS_ctx.currentMonthYear);
// @ts-ignore
[currentMonthYear,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.nextMonth) },
    ...{ class: "nav-btn" },
});
// @ts-ignore
[nextMonth,];
__VLS_asFunctionalElement(__VLS_elements.i, __VLS_elements.i)({});
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
else {
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "calendar-grid" },
    });
    for (const [day] of __VLS_getVForSourceType((__VLS_ctx.weekdays))) {
        // @ts-ignore
        [weekdays,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            key: (day),
            ...{ class: "day-header" },
        });
        (day);
    }
    for (const [day] of __VLS_getVForSourceType((__VLS_ctx.calendarDays))) {
        // @ts-ignore
        [calendarDays,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    __VLS_ctx.selectDate(day.date);
                    // @ts-ignore
                    [selectDate,];
                } },
            key: (day.date),
            ...{ class: "calendar-day" },
            ...{ class: ({
                    'other-month': day.isOtherMonth,
                    'today': day.isToday,
                    'has-schedules': day.scheduleCount > 0
                }) },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "day-number" },
        });
        (day.dayNumber);
        if (day.scheduleCount > 0) {
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "schedule-indicators" },
            });
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                ...{ class: "schedule-badge" },
            });
            (day.scheduleCount);
        }
    }
}
/** @type {__VLS_StyleScopedClasses['scheduling-calendar']} */ ;
/** @type {__VLS_StyleScopedClasses['calendar-header']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['current-month']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-state']} */ ;
/** @type {__VLS_StyleScopedClasses['spinner-small']} */ ;
/** @type {__VLS_StyleScopedClasses['calendar-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['day-header']} */ ;
/** @type {__VLS_StyleScopedClasses['calendar-day']} */ ;
/** @type {__VLS_StyleScopedClasses['other-month']} */ ;
/** @type {__VLS_StyleScopedClasses['today']} */ ;
/** @type {__VLS_StyleScopedClasses['has-schedules']} */ ;
/** @type {__VLS_StyleScopedClasses['day-number']} */ ;
/** @type {__VLS_StyleScopedClasses['schedule-indicators']} */ ;
/** @type {__VLS_StyleScopedClasses['schedule-badge']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        currentMonthYear: currentMonthYear,
        weekdays: weekdays,
        calendarDays: calendarDays,
        previousMonth: previousMonth,
        nextMonth: nextMonth,
        selectDate: selectDate,
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

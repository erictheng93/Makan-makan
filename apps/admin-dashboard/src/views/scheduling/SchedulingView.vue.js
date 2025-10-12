import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { schedulingService } from '@/services/schedulingService';
import SchedulingCalendar from '@/components/scheduling/SchedulingCalendar.vue';
import SchedulingList from '@/components/scheduling/SchedulingList.vue';
import ShiftTemplatesList from '@/components/scheduling/ShiftTemplatesList.vue';
import SchedulingConflicts from '@/components/scheduling/SchedulingConflicts.vue';
import SwapRequests from '@/components/scheduling/SwapRequests.vue';
import ScheduleFormModal from '@/components/scheduling/ScheduleFormModal.vue';
// Auth
const authStore = useAuthStore();
// State
const loading = ref(false);
const error = ref(null);
const activeTab = ref('calendar');
const schedules = ref([]);
const shiftTemplates = ref([]);
const conflicts = ref([]);
const swapRequests = ref([]);
const showScheduleModal = ref(false);
const selectedSchedule = ref(null);
// Get restaurant ID from auth store
const restaurantId = computed(() => authStore.user?.restaurantId || 1);
// Tabs
const tabs = computed(() => [
    { id: 'calendar', label: '日曆視圖', icon: '📅', badge: null },
    { id: 'list', label: '清單視圖', icon: '📋', badge: schedules.value.length },
    { id: 'templates', label: '班別模板', icon: '🏷️', badge: shiftTemplates.value.length },
    { id: 'conflicts', label: '衝突警告', icon: '⚠️', badge: conflicts.value.filter(c => c.severity === 'error').length || null },
    { id: 'swaps', label: '換班申請', icon: '🔄', badge: swapRequests.value.filter(r => r.status === 'pending').length || null },
]);
// Methods
const switchTab = (tabId) => {
    activeTab.value = tabId;
};
const refreshData = async () => {
    loading.value = true;
    error.value = null;
    try {
        await Promise.all([
            fetchSchedules(),
            fetchShiftTemplates(),
            fetchConflicts(),
            fetchSwapRequests(),
        ]);
    }
    catch (err) {
        console.error('Failed to refresh data:', err);
        error.value = err instanceof Error ? err.message : 'Failed to load data';
    }
    finally {
        loading.value = false;
    }
};
const fetchSchedules = async () => {
    try {
        // Get schedules for the next 30 days
        const today = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);
        const response = await schedulingService.getSchedules({
            restaurantId: restaurantId.value,
            startDate: formatDate(today),
            endDate: formatDate(endDate),
            limit: 100,
        });
        schedules.value = response.data;
    }
    catch (err) {
        console.error('Failed to fetch schedules:', err);
        throw err;
    }
};
const fetchShiftTemplates = async () => {
    try {
        shiftTemplates.value = await schedulingService.getShiftTemplates(restaurantId.value);
    }
    catch (err) {
        console.error('Failed to fetch shift templates:', err);
        throw err;
    }
};
const fetchConflicts = async () => {
    try {
        const response = await schedulingService.getConflicts({
            restaurantId: restaurantId.value,
            status: 'unresolved',
            limit: 50,
        });
        conflicts.value = response.data;
    }
    catch (err) {
        console.error('Failed to fetch conflicts:', err);
        // Don't throw - conflicts are optional
        conflicts.value = [];
    }
};
const fetchSwapRequests = async () => {
    try {
        const response = await schedulingService.getSwapRequests({
            restaurantId: restaurantId.value,
            status: 'pending',
            limit: 50,
        });
        swapRequests.value = response.data;
    }
    catch (err) {
        console.error('Failed to fetch swap requests:', err);
        // Don't throw - swap requests are optional
        swapRequests.value = [];
    }
};
const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const showCreateScheduleModal = () => {
    selectedSchedule.value = null;
    showScheduleModal.value = true;
};
const closeScheduleModal = () => {
    showScheduleModal.value = false;
    selectedSchedule.value = null;
};
const handleDateSelect = (date) => {
    console.log('Date selected:', date);
    // TODO: Filter schedules by date or open create modal
};
const handleScheduleClick = (schedule) => {
    selectedSchedule.value = schedule;
    showScheduleModal.value = true;
};
const handleEditSchedule = (schedule) => {
    selectedSchedule.value = schedule;
    showScheduleModal.value = true;
};
const handleDeleteSchedule = async (schedule) => {
    if (confirm(`確定要刪除此排班嗎？`)) {
        try {
            loading.value = true;
            await schedulingService.deleteSchedule(schedule.id);
            await refreshData();
            console.log('Schedule deleted successfully:', schedule.id);
        }
        catch (err) {
            console.error('Failed to delete schedule:', err);
            error.value = err instanceof Error ? err.message : 'Failed to delete schedule';
            alert('刪除排班失敗，請稍後再試');
        }
        finally {
            loading.value = false;
        }
    }
};
const handleSaveSchedule = async (scheduleData) => {
    try {
        loading.value = true;
        if (selectedSchedule.value?.id) {
            // Update existing schedule
            await schedulingService.updateSchedule(selectedSchedule.value.id, scheduleData);
        }
        else {
            // Create new schedule
            await schedulingService.createSchedule(restaurantId.value, scheduleData);
        }
        closeScheduleModal();
        await refreshData();
    }
    catch (err) {
        console.error('Failed to save schedule:', err);
        error.value = err instanceof Error ? err.message : 'Failed to save schedule';
        alert('儲存排班失敗，請稍後再試');
    }
    finally {
        loading.value = false;
    }
};
const handleEditTemplate = (template) => {
    // TODO: Open template edit modal (Part 4 implementation)
    console.log('Edit template:', template.id);
};
const handleDeleteTemplate = async (template) => {
    if (confirm(`確定要刪除班別模板「${template.name}」嗎？`)) {
        try {
            loading.value = true;
            await schedulingService.deleteShiftTemplate(template.id);
            await refreshData();
            console.log('Template deleted successfully:', template.id);
        }
        catch (err) {
            console.error('Failed to delete template:', err);
            error.value = err instanceof Error ? err.message : 'Failed to delete template';
            alert('刪除班別模板失敗，請稍後再試');
        }
        finally {
            loading.value = false;
        }
    }
};
const handleResolveConflict = async (conflict) => {
    // Get current user ID from auth store
    const userId = authStore.user?.id;
    if (!userId) {
        alert('無法取得使用者資訊');
        return;
    }
    const resolutionNotes = prompt('請輸入解決方案說明：');
    if (resolutionNotes) {
        try {
            loading.value = true;
            await schedulingService.resolveConflict(conflict.id, userId, resolutionNotes);
            await refreshData();
            console.log('Conflict resolved:', conflict.id);
        }
        catch (err) {
            console.error('Failed to resolve conflict:', err);
            error.value = err instanceof Error ? err.message : 'Failed to resolve conflict';
            alert('解決衝突失敗，請稍後再試');
        }
        finally {
            loading.value = false;
        }
    }
};
const handleApproveSwap = async (request) => {
    if (confirm(`確定要核准此換班申請嗎？`)) {
        // Get current manager ID from auth store
        const managerId = authStore.user?.id;
        if (!managerId) {
            alert('無法取得管理員資訊');
            return;
        }
        try {
            loading.value = true;
            await schedulingService.approveSwapRequest(request.id, managerId);
            await refreshData();
            console.log('Swap request approved:', request.id);
        }
        catch (err) {
            console.error('Failed to approve swap request:', err);
            error.value = err instanceof Error ? err.message : 'Failed to approve swap';
            alert('核准換班申請失敗，請稍後再試');
        }
        finally {
            loading.value = false;
        }
    }
};
const handleRejectSwap = async (request) => {
    const reason = prompt('請輸入拒絕原因：');
    if (reason) {
        // Get current manager ID from auth store
        const managerId = authStore.user?.id;
        if (!managerId) {
            alert('無法取得管理員資訊');
            return;
        }
        try {
            loading.value = true;
            await schedulingService.rejectSwapRequest(request.id, managerId, reason);
            await refreshData();
            console.log('Swap request rejected:', request.id);
        }
        catch (err) {
            console.error('Failed to reject swap request:', err);
            error.value = err instanceof Error ? err.message : 'Failed to reject swap';
            alert('拒絕換班申請失敗，請稍後再試');
        }
        finally {
            loading.value = false;
        }
    }
};
// Lifecycle
onMounted(() => {
    refreshData();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-overlay']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "scheduling-view" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "view-header" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "header-content" },
});
__VLS_asFunctionalElement(__VLS_elements.h1, __VLS_elements.h1)({
    ...{ class: "view-title" },
});
__VLS_asFunctionalElement(__VLS_elements.i, __VLS_elements.i)({
    ...{ class: "icon" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "view-subtitle" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "header-actions" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.refreshData) },
    ...{ class: "btn btn-secondary" },
});
// @ts-ignore
[refreshData,];
__VLS_asFunctionalElement(__VLS_elements.i, __VLS_elements.i)({
    ...{ class: "icon" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.showCreateScheduleModal) },
    ...{ class: "btn btn-primary" },
});
// @ts-ignore
[showCreateScheduleModal,];
__VLS_asFunctionalElement(__VLS_elements.i, __VLS_elements.i)({
    ...{ class: "icon" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "tab-navigation" },
});
for (const [tab] of __VLS_getVForSourceType((__VLS_ctx.tabs))) {
    // @ts-ignore
    [tabs,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.switchTab(tab.id);
                // @ts-ignore
                [switchTab,];
            } },
        key: (tab.id),
        ...{ class: "tab-btn" },
        ...{ class: ({ active: __VLS_ctx.activeTab === tab.id }) },
    });
    // @ts-ignore
    [activeTab,];
    __VLS_asFunctionalElement(__VLS_elements.i, __VLS_elements.i)({
        ...{ class: "icon" },
    });
    (tab.icon);
    (tab.label);
    if (tab.badge) {
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "badge" },
        });
        (tab.badge);
    }
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "tab-content" },
});
if (__VLS_ctx.activeTab === 'calendar') {
    // @ts-ignore
    [activeTab,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "tab-pane" },
    });
    /** @type {[typeof SchedulingCalendar, ]} */ ;
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(SchedulingCalendar, new SchedulingCalendar({
        ...{ 'onDateSelect': {} },
        ...{ 'onScheduleClick': {} },
        schedules: (__VLS_ctx.schedules),
        loading: (__VLS_ctx.loading),
    }));
    const __VLS_1 = __VLS_0({
        ...{ 'onDateSelect': {} },
        ...{ 'onScheduleClick': {} },
        schedules: (__VLS_ctx.schedules),
        loading: (__VLS_ctx.loading),
    }, ...__VLS_functionalComponentArgsRest(__VLS_0));
    let __VLS_3;
    let __VLS_4;
    const __VLS_5 = ({ dateSelect: {} },
        { onDateSelect: (__VLS_ctx.handleDateSelect) });
    const __VLS_6 = ({ scheduleClick: {} },
        { onScheduleClick: (__VLS_ctx.handleScheduleClick) });
    // @ts-ignore
    [schedules, loading, handleDateSelect, handleScheduleClick,];
    var __VLS_2;
}
if (__VLS_ctx.activeTab === 'list') {
    // @ts-ignore
    [activeTab,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "tab-pane" },
    });
    /** @type {[typeof SchedulingList, ]} */ ;
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent(SchedulingList, new SchedulingList({
        ...{ 'onEdit': {} },
        ...{ 'onDelete': {} },
        schedules: (__VLS_ctx.schedules),
        loading: (__VLS_ctx.loading),
    }));
    const __VLS_9 = __VLS_8({
        ...{ 'onEdit': {} },
        ...{ 'onDelete': {} },
        schedules: (__VLS_ctx.schedules),
        loading: (__VLS_ctx.loading),
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    let __VLS_11;
    let __VLS_12;
    const __VLS_13 = ({ edit: {} },
        { onEdit: (__VLS_ctx.handleEditSchedule) });
    const __VLS_14 = ({ delete: {} },
        { onDelete: (__VLS_ctx.handleDeleteSchedule) });
    // @ts-ignore
    [schedules, loading, handleEditSchedule, handleDeleteSchedule,];
    var __VLS_10;
}
if (__VLS_ctx.activeTab === 'templates') {
    // @ts-ignore
    [activeTab,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "tab-pane" },
    });
    /** @type {[typeof ShiftTemplatesList, ]} */ ;
    // @ts-ignore
    const __VLS_16 = __VLS_asFunctionalComponent(ShiftTemplatesList, new ShiftTemplatesList({
        ...{ 'onEdit': {} },
        ...{ 'onDelete': {} },
        templates: (__VLS_ctx.shiftTemplates),
        loading: (__VLS_ctx.loading),
    }));
    const __VLS_17 = __VLS_16({
        ...{ 'onEdit': {} },
        ...{ 'onDelete': {} },
        templates: (__VLS_ctx.shiftTemplates),
        loading: (__VLS_ctx.loading),
    }, ...__VLS_functionalComponentArgsRest(__VLS_16));
    let __VLS_19;
    let __VLS_20;
    const __VLS_21 = ({ edit: {} },
        { onEdit: (__VLS_ctx.handleEditTemplate) });
    const __VLS_22 = ({ delete: {} },
        { onDelete: (__VLS_ctx.handleDeleteTemplate) });
    // @ts-ignore
    [loading, shiftTemplates, handleEditTemplate, handleDeleteTemplate,];
    var __VLS_18;
}
if (__VLS_ctx.activeTab === 'conflicts') {
    // @ts-ignore
    [activeTab,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "tab-pane" },
    });
    /** @type {[typeof SchedulingConflicts, ]} */ ;
    // @ts-ignore
    const __VLS_24 = __VLS_asFunctionalComponent(SchedulingConflicts, new SchedulingConflicts({
        ...{ 'onResolve': {} },
        conflicts: (__VLS_ctx.conflicts),
        loading: (__VLS_ctx.loading),
    }));
    const __VLS_25 = __VLS_24({
        ...{ 'onResolve': {} },
        conflicts: (__VLS_ctx.conflicts),
        loading: (__VLS_ctx.loading),
    }, ...__VLS_functionalComponentArgsRest(__VLS_24));
    let __VLS_27;
    let __VLS_28;
    const __VLS_29 = ({ resolve: {} },
        { onResolve: (__VLS_ctx.handleResolveConflict) });
    // @ts-ignore
    [loading, conflicts, handleResolveConflict,];
    var __VLS_26;
}
if (__VLS_ctx.activeTab === 'swaps') {
    // @ts-ignore
    [activeTab,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "tab-pane" },
    });
    /** @type {[typeof SwapRequests, ]} */ ;
    // @ts-ignore
    const __VLS_31 = __VLS_asFunctionalComponent(SwapRequests, new SwapRequests({
        ...{ 'onApprove': {} },
        ...{ 'onReject': {} },
        requests: (__VLS_ctx.swapRequests),
        loading: (__VLS_ctx.loading),
    }));
    const __VLS_32 = __VLS_31({
        ...{ 'onApprove': {} },
        ...{ 'onReject': {} },
        requests: (__VLS_ctx.swapRequests),
        loading: (__VLS_ctx.loading),
    }, ...__VLS_functionalComponentArgsRest(__VLS_31));
    let __VLS_34;
    let __VLS_35;
    const __VLS_36 = ({ approve: {} },
        { onApprove: (__VLS_ctx.handleApproveSwap) });
    const __VLS_37 = ({ reject: {} },
        { onReject: (__VLS_ctx.handleRejectSwap) });
    // @ts-ignore
    [loading, swapRequests, handleApproveSwap, handleRejectSwap,];
    var __VLS_33;
}
if (__VLS_ctx.showScheduleModal) {
    // @ts-ignore
    [showScheduleModal,];
    /** @type {[typeof ScheduleFormModal, ]} */ ;
    // @ts-ignore
    const __VLS_39 = __VLS_asFunctionalComponent(ScheduleFormModal, new ScheduleFormModal({
        ...{ 'onSave': {} },
        ...{ 'onClose': {} },
        schedule: (__VLS_ctx.selectedSchedule),
        shiftTemplates: (__VLS_ctx.shiftTemplates),
    }));
    const __VLS_40 = __VLS_39({
        ...{ 'onSave': {} },
        ...{ 'onClose': {} },
        schedule: (__VLS_ctx.selectedSchedule),
        shiftTemplates: (__VLS_ctx.shiftTemplates),
    }, ...__VLS_functionalComponentArgsRest(__VLS_39));
    let __VLS_42;
    let __VLS_43;
    const __VLS_44 = ({ save: {} },
        { onSave: (__VLS_ctx.handleSaveSchedule) });
    const __VLS_45 = ({ close: {} },
        { onClose: (__VLS_ctx.closeScheduleModal) });
    // @ts-ignore
    [shiftTemplates, selectedSchedule, handleSaveSchedule, closeScheduleModal,];
    var __VLS_41;
}
if (__VLS_ctx.loading) {
    // @ts-ignore
    [loading,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "loading-overlay" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "spinner" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({});
}
/** @type {__VLS_StyleScopedClasses['scheduling-view']} */ ;
/** @type {__VLS_StyleScopedClasses['view-header']} */ ;
/** @type {__VLS_StyleScopedClasses['header-content']} */ ;
/** @type {__VLS_StyleScopedClasses['view-title']} */ ;
/** @type {__VLS_StyleScopedClasses['icon']} */ ;
/** @type {__VLS_StyleScopedClasses['view-subtitle']} */ ;
/** @type {__VLS_StyleScopedClasses['header-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['icon']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['icon']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-navigation']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['icon']} */ ;
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-content']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-pane']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-pane']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-pane']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-pane']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-pane']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-overlay']} */ ;
/** @type {__VLS_StyleScopedClasses['spinner']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        SchedulingCalendar: SchedulingCalendar,
        SchedulingList: SchedulingList,
        ShiftTemplatesList: ShiftTemplatesList,
        SchedulingConflicts: SchedulingConflicts,
        SwapRequests: SwapRequests,
        ScheduleFormModal: ScheduleFormModal,
        loading: loading,
        activeTab: activeTab,
        schedules: schedules,
        shiftTemplates: shiftTemplates,
        conflicts: conflicts,
        swapRequests: swapRequests,
        showScheduleModal: showScheduleModal,
        selectedSchedule: selectedSchedule,
        tabs: tabs,
        switchTab: switchTab,
        refreshData: refreshData,
        showCreateScheduleModal: showCreateScheduleModal,
        closeScheduleModal: closeScheduleModal,
        handleDateSelect: handleDateSelect,
        handleScheduleClick: handleScheduleClick,
        handleEditSchedule: handleEditSchedule,
        handleDeleteSchedule: handleDeleteSchedule,
        handleSaveSchedule: handleSaveSchedule,
        handleEditTemplate: handleEditTemplate,
        handleDeleteTemplate: handleDeleteTemplate,
        handleResolveConflict: handleResolveConflict,
        handleApproveSwap: handleApproveSwap,
        handleRejectSwap: handleRejectSwap,
    }),
});
export default (await import('vue')).defineComponent({});
; /* PartiallyEnd: #4569/main.vue */

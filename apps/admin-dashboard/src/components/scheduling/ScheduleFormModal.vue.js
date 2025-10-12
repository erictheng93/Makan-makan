import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { schedulingService } from '@/services/schedulingService';
const props = defineProps();
const emit = defineEmits();
// Auth
const authStore = useAuthStore();
const restaurantId = computed(() => authStore.user?.restaurantId || 1);
// State
const loading = ref(false);
const error = ref(null);
const availableEmployees = ref([]);
// Form Data
const formData = reactive({
    employeeId: '',
    workDate: '',
    shiftTemplateId: '',
    startTime: '',
    endTime: '',
    breakDurationMinutes: 0,
    scheduledHours: 0,
    notes: '',
    managerNotes: '',
});
// Calculated Hours
const calculatedHours = computed(() => {
    if (!formData.startTime || !formData.endTime)
        return '0.0';
    const [startHour, startMin] = formData.startTime.split(':').map(Number);
    const [endHour, endMin] = formData.endTime.split(':').map(Number);
    let totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    // Handle overnight shifts
    if (totalMinutes < 0) {
        totalMinutes += 24 * 60;
    }
    // Subtract break time
    totalMinutes -= formData.breakDurationMinutes || 0;
    const hours = (totalMinutes / 60).toFixed(1);
    formData.scheduledHours = parseFloat(hours);
    return hours;
});
// Fetch available employees when date changes
const handleDateChange = async () => {
    if (!formData.workDate)
        return;
    try {
        loading.value = true;
        error.value = null;
        availableEmployees.value = await schedulingService.getAvailableEmployees(restaurantId.value, formData.workDate, formData.shiftTemplateId || undefined);
        // Reset employee selection if current employee is not available
        if (formData.employeeId &&
            !availableEmployees.value.find(emp => emp.id === formData.employeeId)) {
            formData.employeeId = '';
        }
    }
    catch (err) {
        console.error('Failed to fetch available employees:', err);
        error.value = '無法載入可用員工列表';
    }
    finally {
        loading.value = false;
    }
};
// Auto-fill time when template is selected
const handleTemplateChange = () => {
    if (!formData.shiftTemplateId)
        return;
    const template = props.shiftTemplates.find(t => t.id === parseInt(formData.shiftTemplateId));
    if (template) {
        formData.startTime = template.startTime;
        formData.endTime = template.endTime;
        formData.breakDurationMinutes = template.breakDurationMinutes || 0;
    }
};
// Form Validation
const validateForm = () => {
    error.value = null;
    if (!formData.employeeId) {
        error.value = '請選擇員工';
        return false;
    }
    if (!formData.workDate) {
        error.value = '請選擇排班日期';
        return false;
    }
    if (!formData.startTime || !formData.endTime) {
        error.value = '請設定開始和結束時間';
        return false;
    }
    if (formData.scheduledHours <= 0) {
        error.value = '預計工時必須大於 0';
        return false;
    }
    return true;
};
// Submit Form
const handleSubmit = async () => {
    if (!validateForm())
        return;
    try {
        loading.value = true;
        const scheduleData = {
            employeeId: parseInt(formData.employeeId),
            workDate: formData.workDate,
            shiftTemplateId: formData.shiftTemplateId ? parseInt(formData.shiftTemplateId) : undefined,
            startTime: formData.startTime,
            endTime: formData.endTime,
            breakDurationMinutes: formData.breakDurationMinutes || 0,
            scheduledHours: formData.scheduledHours,
            notes: formData.notes || undefined,
            managerNotes: formData.managerNotes || undefined,
        };
        emit('save', scheduleData);
    }
    catch (err) {
        console.error('Form submission error:', err);
        error.value = err instanceof Error ? err.message : '表單提交失敗';
    }
    finally {
        loading.value = false;
    }
};
// Initialize form when editing
const initializeForm = () => {
    if (props.schedule) {
        formData.employeeId = props.schedule.employeeId;
        formData.workDate = props.schedule.workDate;
        formData.shiftTemplateId = props.schedule.shiftTemplateId || '';
        formData.startTime = props.schedule.startTime;
        formData.endTime = props.schedule.endTime;
        formData.breakDurationMinutes = props.schedule.breakDurationMinutes || 0;
        formData.scheduledHours = props.schedule.scheduledHours;
        formData.notes = props.schedule.notes || '';
        formData.managerNotes = props.schedule.managerNotes || '';
    }
    else {
        // Default to today for new schedules
        const today = new Date();
        formData.workDate = today.toISOString().split('T')[0];
    }
};
// Watch for schedule changes
watch(() => props.schedule, () => {
    initializeForm();
}, { immediate: true });
// Fetch available employees on mount if date is set
onMounted(() => {
    if (formData.workDate) {
        handleDateChange();
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
/** @type {__VLS_StyleScopedClasses['close-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('close');
            // @ts-ignore
            [$emit,];
        } },
    ...{ class: "modal-overlay" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "modal-content" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "modal-header" },
});
__VLS_asFunctionalElement(__VLS_elements.h2, __VLS_elements.h2)({});
(__VLS_ctx.schedule ? '編輯排班' : '新增排班');
// @ts-ignore
[schedule,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('close');
            // @ts-ignore
            [$emit,];
        } },
    ...{ class: "close-btn" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "modal-body" },
});
__VLS_asFunctionalElement(__VLS_elements.form, __VLS_elements.form)({
    ...{ onSubmit: (__VLS_ctx.handleSubmit) },
});
// @ts-ignore
[handleSubmit,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "form-group" },
});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    ...{ class: "form-label" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "required" },
});
__VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
    value: (__VLS_ctx.formData.employeeId),
    ...{ class: "form-control" },
    disabled: (__VLS_ctx.loading || !!__VLS_ctx.schedule),
    required: true,
});
// @ts-ignore
[schedule, formData, loading,];
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "",
});
for (const [emp] of __VLS_getVForSourceType((__VLS_ctx.availableEmployees))) {
    // @ts-ignore
    [availableEmployees,];
    __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
        key: (emp.id),
        value: (emp.id),
    });
    (emp.fullName);
}
if (__VLS_ctx.schedule) {
    // @ts-ignore
    [schedule,];
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "form-hint" },
    });
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "form-group" },
});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    ...{ class: "form-label" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "required" },
});
__VLS_asFunctionalElement(__VLS_elements.input)({
    ...{ onChange: (__VLS_ctx.handleDateChange) },
    type: "date",
    ...{ class: "form-control" },
    required: true,
});
(__VLS_ctx.formData.workDate);
// @ts-ignore
[formData, handleDateChange,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "form-group" },
});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    ...{ class: "form-label" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "optional" },
});
__VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
    ...{ onChange: (__VLS_ctx.handleTemplateChange) },
    value: (__VLS_ctx.formData.shiftTemplateId),
    ...{ class: "form-control" },
});
// @ts-ignore
[formData, handleTemplateChange,];
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "",
});
for (const [template] of __VLS_getVForSourceType((__VLS_ctx.shiftTemplates))) {
    // @ts-ignore
    [shiftTemplates,];
    __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
        key: (template.id),
        value: (template.id),
    });
    (template.name);
    (template.startTime);
    (template.endTime);
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "form-row" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "form-group" },
});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    ...{ class: "form-label" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "required" },
});
__VLS_asFunctionalElement(__VLS_elements.input)({
    type: "time",
    ...{ class: "form-control" },
    required: true,
});
(__VLS_ctx.formData.startTime);
// @ts-ignore
[formData,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "form-group" },
});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    ...{ class: "form-label" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "required" },
});
__VLS_asFunctionalElement(__VLS_elements.input)({
    type: "time",
    ...{ class: "form-control" },
    required: true,
});
(__VLS_ctx.formData.endTime);
// @ts-ignore
[formData,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "form-group" },
});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    ...{ class: "form-label" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "optional" },
});
__VLS_asFunctionalElement(__VLS_elements.input)({
    type: "number",
    ...{ class: "form-control" },
    min: "0",
    max: "240",
    step: "15",
});
(__VLS_ctx.formData.breakDurationMinutes);
// @ts-ignore
[formData,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "form-group" },
});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    ...{ class: "form-label" },
});
__VLS_asFunctionalElement(__VLS_elements.input)({
    value: (__VLS_ctx.calculatedHours),
    type: "text",
    ...{ class: "form-control" },
    disabled: true,
});
// @ts-ignore
[calculatedHours,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "form-group" },
});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    ...{ class: "form-label" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "optional" },
});
__VLS_asFunctionalElement(__VLS_elements.textarea, __VLS_elements.textarea)({
    value: (__VLS_ctx.formData.notes),
    ...{ class: "form-control" },
    rows: "3",
    placeholder: "排班備註...",
});
// @ts-ignore
[formData,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "form-group" },
});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    ...{ class: "form-label" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "optional" },
});
__VLS_asFunctionalElement(__VLS_elements.textarea, __VLS_elements.textarea)({
    value: (__VLS_ctx.formData.managerNotes),
    ...{ class: "form-control" },
    rows: "2",
    placeholder: "管理員備註...",
});
// @ts-ignore
[formData,];
if (__VLS_ctx.error) {
    // @ts-ignore
    [error,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "error-message" },
    });
    __VLS_asFunctionalElement(__VLS_elements.i, __VLS_elements.i)({});
    (__VLS_ctx.error);
    // @ts-ignore
    [error,];
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "modal-footer" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('close');
            // @ts-ignore
            [$emit,];
        } },
    type: "button",
    ...{ class: "btn btn-secondary" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.handleSubmit) },
    type: "button",
    ...{ class: "btn btn-primary" },
    disabled: (__VLS_ctx.loading),
});
// @ts-ignore
[handleSubmit, loading,];
(__VLS_ctx.loading ? '儲存中...' : '儲存');
// @ts-ignore
[loading,];
/** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-content']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
/** @type {__VLS_StyleScopedClasses['close-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-label']} */ ;
/** @type {__VLS_StyleScopedClasses['required']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['form-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-label']} */ ;
/** @type {__VLS_StyleScopedClasses['required']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-label']} */ ;
/** @type {__VLS_StyleScopedClasses['optional']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['form-row']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-label']} */ ;
/** @type {__VLS_StyleScopedClasses['required']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-label']} */ ;
/** @type {__VLS_StyleScopedClasses['required']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-label']} */ ;
/** @type {__VLS_StyleScopedClasses['optional']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-label']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-label']} */ ;
/** @type {__VLS_StyleScopedClasses['optional']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-label']} */ ;
/** @type {__VLS_StyleScopedClasses['optional']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['error-message']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        loading: loading,
        error: error,
        availableEmployees: availableEmployees,
        formData: formData,
        calculatedHours: calculatedHours,
        handleDateChange: handleDateChange,
        handleTemplateChange: handleTemplateChange,
        handleSubmit: handleSubmit,
    }),
    __typeEmits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */

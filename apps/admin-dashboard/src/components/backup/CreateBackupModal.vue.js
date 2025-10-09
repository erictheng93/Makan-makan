import { ref, reactive, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBackupStore } from '@/stores/backup';
import { useAuthStore } from '@/stores/auth';
import { XMarkIcon } from '@heroicons/vue/24/outline';
const emit = defineEmits();
const { t } = useI18n();
const backupStore = useBackupStore();
const authStore = useAuthStore();
// Reactive data
const isSubmitting = ref(false);
const configMode = ref('existing');
const tableMode = ref('all');
const configurations = ref([]);
const availableTables = ref([
    'orders', 'order_items', 'menu_items', 'customers',
    'tables', 'reservations', 'payments', 'users'
]);
const form = reactive({
    restaurant_id: '',
    name: '',
    description: '',
    backup_type: 'full',
    configuration_id: '',
    include_tables: [],
    exclude_tables: [],
    force_immediate: false
});
const errors = reactive({
    name: ''
});
// Methods
const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
        emit('close');
    }
};
const getBackupTypeDescription = (type) => {
    return t(`backup.types.${type}Description`);
};
const handleConfigModeChange = () => {
    if (configMode.value === 'existing') {
        form.include_tables = [];
        form.exclude_tables = [];
        form.configuration_id = '';
    }
    else {
        form.configuration_id = undefined;
    }
};
const handleTableModeChange = () => {
    form.include_tables = [];
    form.exclude_tables = [];
};
const validateForm = () => {
    errors.name = '';
    if (!form.name.trim()) {
        errors.name = t('backup.errors.nameRequired');
        return false;
    }
    if (form.name.length > 100) {
        errors.name = t('backup.errors.nameTooLong');
        return false;
    }
    if (configMode.value === 'existing' && !form.configuration_id) {
        return false;
    }
    if (tableMode.value === 'include' && (!form.include_tables || form.include_tables.length === 0)) {
        return false;
    }
    return true;
};
const handleSubmit = async () => {
    if (!validateForm() || isSubmitting.value)
        return;
    isSubmitting.value = true;
    try {
        // Clean up form data based on mode
        const submitData = {
            restaurant_id: String(authStore.restaurantId || ''),
            name: form.name.trim(),
            description: form.description?.trim() || undefined,
            backup_type: form.backup_type,
            force_immediate: form.force_immediate
        };
        if (configMode.value === 'existing') {
            submitData.configuration_id = form.configuration_id;
        }
        else {
            // Manual configuration
            if (tableMode.value === 'include') {
                submitData.include_tables = [...(form.include_tables || [])];
            }
            else if (tableMode.value === 'exclude') {
                submitData.exclude_tables = [...(form.exclude_tables || [])];
            }
        }
        const response = await backupStore.createBackup(submitData);
        emit('created', response.backup_id);
    }
    catch (error) {
        console.error('Error creating backup:', error);
        // Handle error (show toast notification)
    }
    finally {
        isSubmitting.value = false;
    }
};
const loadConfigurations = async () => {
    try {
        const restaurantId = authStore.restaurantId;
        if (!restaurantId)
            return;
        configurations.value = await backupStore.getBackupConfigurations(String(restaurantId));
    }
    catch (error) {
        console.error('Error loading configurations:', error);
    }
};
// Generate default backup name
const generateDefaultName = () => {
    const now = new Date();
    const restaurantName = 'Restaurant';
    const timestamp = now.toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
    return `${restaurantName}_Backup_${timestamp}`;
};
// Lifecycle
onMounted(() => {
    form.restaurant_id = String(authStore.restaurantId || '');
    form.name = generateDefaultName();
    loadConfigurations();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
/** @type {__VLS_StyleScopedClasses['close-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['form-section']} */ ;
/** @type {__VLS_StyleScopedClasses['form-input']} */ ;
/** @type {__VLS_StyleScopedClasses['form-textarea']} */ ;
/** @type {__VLS_StyleScopedClasses['form-select']} */ ;
/** @type {__VLS_StyleScopedClasses['form-input']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-option']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-content']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
/** @type {__VLS_StyleScopedClasses['backup-form']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['form-actions']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ onClick: (__VLS_ctx.handleOverlayClick) },
    ...{ class: "modal-overlay" },
});
// @ts-ignore
[handleOverlayClick,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ onClick: () => { } },
    ...{ class: "modal-content" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "modal-header" },
});
__VLS_asFunctionalElement(__VLS_elements.h2, __VLS_elements.h2)({});
(__VLS_ctx.t('backup.create.title'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('close');
            // @ts-ignore
            [$emit,];
        } },
    ...{ class: "close-btn" },
});
const __VLS_0 = {}.XMarkIcon;
/** @type {[typeof __VLS_components.XMarkIcon, ]} */ ;
// @ts-ignore
XMarkIcon;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_elements.form, __VLS_elements.form)({
    ...{ onSubmit: (__VLS_ctx.handleSubmit) },
    ...{ class: "backup-form" },
});
// @ts-ignore
[handleSubmit,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "form-section" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({});
(__VLS_ctx.t('backup.create.basicInfo'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "form-group" },
});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    for: "backup-name",
    ...{ class: "form-label" },
});
(__VLS_ctx.t('backup.create.name'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.input)({
    id: "backup-name",
    value: (__VLS_ctx.form.name),
    type: "text",
    ...{ class: "form-input" },
    ...{ class: ({ 'error': __VLS_ctx.errors.name }) },
    placeholder: (__VLS_ctx.t('backup.create.namePlaceholder')),
    required: true,
});
// @ts-ignore
[t, form, errors,];
if (__VLS_ctx.errors.name) {
    // @ts-ignore
    [errors,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "error-text" },
    });
    (__VLS_ctx.errors.name);
    // @ts-ignore
    [errors,];
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "form-group" },
});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    for: "backup-description",
    ...{ class: "form-label" },
});
(__VLS_ctx.t('backup.create.description'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.textarea, __VLS_elements.textarea)({
    id: "backup-description",
    value: (__VLS_ctx.form.description),
    ...{ class: "form-textarea" },
    placeholder: (__VLS_ctx.t('backup.create.descriptionPlaceholder')),
    rows: "3",
});
// @ts-ignore
[t, form,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "form-group" },
});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    for: "backup-type",
    ...{ class: "form-label" },
});
(__VLS_ctx.t('backup.create.type'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
    id: "backup-type",
    value: (__VLS_ctx.form.backup_type),
    ...{ class: "form-select" },
    required: true,
});
// @ts-ignore
[form,];
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "full",
});
(__VLS_ctx.t('backup.types.full'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "incremental",
});
(__VLS_ctx.t('backup.types.incremental'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "differential",
});
(__VLS_ctx.t('backup.types.differential'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "form-help" },
});
(__VLS_ctx.getBackupTypeDescription(__VLS_ctx.form.backup_type || 'full'));
// @ts-ignore
[form, getBackupTypeDescription,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "form-section" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({});
(__VLS_ctx.t('backup.create.configuration'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "form-group" },
});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    ...{ class: "form-label" },
});
(__VLS_ctx.t('backup.create.useConfiguration'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "radio-group" },
});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    ...{ class: "radio-option" },
});
__VLS_asFunctionalElement(__VLS_elements.input)({
    ...{ onChange: (__VLS_ctx.handleConfigModeChange) },
    type: "radio",
    value: "existing",
});
(__VLS_ctx.configMode);
// @ts-ignore
[handleConfigModeChange, configMode,];
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
(__VLS_ctx.t('backup.create.useExisting'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    ...{ class: "radio-option" },
});
__VLS_asFunctionalElement(__VLS_elements.input)({
    ...{ onChange: (__VLS_ctx.handleConfigModeChange) },
    type: "radio",
    value: "manual",
});
(__VLS_ctx.configMode);
// @ts-ignore
[handleConfigModeChange, configMode,];
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
(__VLS_ctx.t('backup.create.manualConfig'));
// @ts-ignore
[t,];
if (__VLS_ctx.configMode === 'existing') {
    // @ts-ignore
    [configMode,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
        for: "config-select",
        ...{ class: "form-label" },
    });
    (__VLS_ctx.t('backup.create.selectConfig'));
    // @ts-ignore
    [t,];
    __VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
        id: "config-select",
        value: (__VLS_ctx.form.configuration_id),
        ...{ class: "form-select" },
        required: true,
    });
    // @ts-ignore
    [form,];
    __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
        value: "",
    });
    (__VLS_ctx.t('backup.create.selectConfigPlaceholder'));
    // @ts-ignore
    [t,];
    for (const [config] of __VLS_getVForSourceType((__VLS_ctx.configurations))) {
        // @ts-ignore
        [configurations,];
        __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
            key: (config.id),
            value: (config.id),
        });
        (config.name);
        (__VLS_ctx.t(`backup.types.${config.backup_type}`));
        // @ts-ignore
        [t,];
    }
}
if (__VLS_ctx.configMode === 'manual') {
    // @ts-ignore
    [configMode,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "form-section" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({});
    (__VLS_ctx.t('backup.create.advancedOptions'));
    // @ts-ignore
    [t,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
        ...{ class: "form-label" },
    });
    (__VLS_ctx.t('backup.create.tableSelection'));
    // @ts-ignore
    [t,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "radio-group" },
    });
    __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
        ...{ class: "radio-option" },
    });
    __VLS_asFunctionalElement(__VLS_elements.input)({
        ...{ onChange: (__VLS_ctx.handleTableModeChange) },
        type: "radio",
        value: "all",
    });
    (__VLS_ctx.tableMode);
    // @ts-ignore
    [handleTableModeChange, tableMode,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    (__VLS_ctx.t('backup.create.allTables'));
    // @ts-ignore
    [t,];
    __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
        ...{ class: "radio-option" },
    });
    __VLS_asFunctionalElement(__VLS_elements.input)({
        ...{ onChange: (__VLS_ctx.handleTableModeChange) },
        type: "radio",
        value: "include",
    });
    (__VLS_ctx.tableMode);
    // @ts-ignore
    [handleTableModeChange, tableMode,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    (__VLS_ctx.t('backup.create.includeTables'));
    // @ts-ignore
    [t,];
    __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
        ...{ class: "radio-option" },
    });
    __VLS_asFunctionalElement(__VLS_elements.input)({
        ...{ onChange: (__VLS_ctx.handleTableModeChange) },
        type: "radio",
        value: "exclude",
    });
    (__VLS_ctx.tableMode);
    // @ts-ignore
    [handleTableModeChange, tableMode,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    (__VLS_ctx.t('backup.create.excludeTables'));
    // @ts-ignore
    [t,];
    if (__VLS_ctx.tableMode === 'include') {
        // @ts-ignore
        [tableMode,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "form-group" },
        });
        __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
            ...{ class: "form-label" },
        });
        (__VLS_ctx.t('backup.create.tablesToInclude'));
        // @ts-ignore
        [t,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "checkbox-grid" },
        });
        for (const [table] of __VLS_getVForSourceType((__VLS_ctx.availableTables))) {
            // @ts-ignore
            [availableTables,];
            __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
                key: (table),
                ...{ class: "checkbox-option" },
            });
            __VLS_asFunctionalElement(__VLS_elements.input)({
                type: "checkbox",
                value: (table),
            });
            (__VLS_ctx.form.include_tables);
            // @ts-ignore
            [form,];
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
            (table);
        }
    }
    if (__VLS_ctx.tableMode === 'exclude') {
        // @ts-ignore
        [tableMode,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "form-group" },
        });
        __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
            ...{ class: "form-label" },
        });
        (__VLS_ctx.t('backup.create.tablesToExclude'));
        // @ts-ignore
        [t,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "checkbox-grid" },
        });
        for (const [table] of __VLS_getVForSourceType((__VLS_ctx.availableTables))) {
            // @ts-ignore
            [availableTables,];
            __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
                key: (table),
                ...{ class: "checkbox-option" },
            });
            __VLS_asFunctionalElement(__VLS_elements.input)({
                type: "checkbox",
                value: (table),
            });
            (__VLS_ctx.form.exclude_tables);
            // @ts-ignore
            [form,];
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
            (table);
        }
    }
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "form-section" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({});
(__VLS_ctx.t('backup.create.execution'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "form-group" },
});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    ...{ class: "checkbox-option large" },
});
__VLS_asFunctionalElement(__VLS_elements.input)({
    type: "checkbox",
});
(__VLS_ctx.form.force_immediate);
// @ts-ignore
[form,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "checkbox-label" },
});
(__VLS_ctx.t('backup.create.forceImmediate'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "checkbox-description" },
});
(__VLS_ctx.t('backup.create.forceImmediateDescription'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "form-actions" },
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
(__VLS_ctx.t('common.cancel'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    type: "submit",
    ...{ class: "btn btn-primary" },
    disabled: (__VLS_ctx.isSubmitting),
});
// @ts-ignore
[isSubmitting,];
if (__VLS_ctx.isSubmitting) {
    // @ts-ignore
    [isSubmitting,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "loading-spinner" },
    });
}
(__VLS_ctx.isSubmitting ? __VLS_ctx.t('backup.create.creating') : __VLS_ctx.t('backup.create.create'));
// @ts-ignore
[t, t, isSubmitting,];
/** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-content']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
/** @type {__VLS_StyleScopedClasses['close-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['backup-form']} */ ;
/** @type {__VLS_StyleScopedClasses['form-section']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-label']} */ ;
/** @type {__VLS_StyleScopedClasses['form-input']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
/** @type {__VLS_StyleScopedClasses['error-text']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-label']} */ ;
/** @type {__VLS_StyleScopedClasses['form-textarea']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-label']} */ ;
/** @type {__VLS_StyleScopedClasses['form-select']} */ ;
/** @type {__VLS_StyleScopedClasses['form-help']} */ ;
/** @type {__VLS_StyleScopedClasses['form-section']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-label']} */ ;
/** @type {__VLS_StyleScopedClasses['radio-group']} */ ;
/** @type {__VLS_StyleScopedClasses['radio-option']} */ ;
/** @type {__VLS_StyleScopedClasses['radio-option']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-label']} */ ;
/** @type {__VLS_StyleScopedClasses['form-select']} */ ;
/** @type {__VLS_StyleScopedClasses['form-section']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-label']} */ ;
/** @type {__VLS_StyleScopedClasses['radio-group']} */ ;
/** @type {__VLS_StyleScopedClasses['radio-option']} */ ;
/** @type {__VLS_StyleScopedClasses['radio-option']} */ ;
/** @type {__VLS_StyleScopedClasses['radio-option']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-label']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-option']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['form-label']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-option']} */ ;
/** @type {__VLS_StyleScopedClasses['form-section']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-option']} */ ;
/** @type {__VLS_StyleScopedClasses['large']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-label']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-description']} */ ;
/** @type {__VLS_StyleScopedClasses['form-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        XMarkIcon: XMarkIcon,
        t: t,
        isSubmitting: isSubmitting,
        configMode: configMode,
        tableMode: tableMode,
        configurations: configurations,
        availableTables: availableTables,
        form: form,
        errors: errors,
        handleOverlayClick: handleOverlayClick,
        getBackupTypeDescription: getBackupTypeDescription,
        handleConfigModeChange: handleConfigModeChange,
        handleTableModeChange: handleTableModeChange,
        handleSubmit: handleSubmit,
    }),
    __typeEmits: {},
});
export default (await import('vue')).defineComponent({
    __typeEmits: {},
});
; /* PartiallyEnd: #4569/main.vue */

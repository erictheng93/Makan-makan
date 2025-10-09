import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
// Icons (using placeholder components - replace with actual icons)
import { CheckCircleIcon, XCircleIcon, ClockIcon, ExclamationTriangleIcon, ArrowDownTrayIcon as DownloadIcon, ArrowPathIcon, InformationCircleIcon, TrashIcon } from '@heroicons/vue/24/outline';
const props = defineProps();
const __VLS_emit = defineEmits();
const { t } = useI18n();
const showDetails = ref(false);
// Computed properties
const statusClass = computed(() => ({
    'status-completed': props.backup.status === 'completed',
    'status-in_progress': props.backup.status === 'in_progress',
    'status-failed': props.backup.status === 'failed',
    'status-pending': props.backup.status === 'pending',
    'status-cancelled': props.backup.status === 'cancelled'
}));
const statusIcon = computed(() => {
    switch (props.backup.status) {
        case 'completed': return CheckCircleIcon;
        case 'failed': return XCircleIcon;
        case 'in_progress': return ClockIcon;
        case 'pending': return ClockIcon;
        case 'cancelled': return XCircleIcon;
        default: return ExclamationTriangleIcon;
    }
});
const iconClass = computed(() => ({
    'text-green-500': props.backup.status === 'completed',
    'text-red-500': props.backup.status === 'failed',
    'text-blue-500': props.backup.status === 'in_progress',
    'text-yellow-500': props.backup.status === 'pending',
    'text-gray-500': props.backup.status === 'cancelled'
}));
// Methods
const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};
const formatFileSize = (bytes) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};
const formatDuration = (startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const duration = Math.round((end.getTime() - start.getTime()) / 1000);
    if (duration < 60) {
        return `${duration}s`;
    }
    else if (duration < 3600) {
        return `${Math.round(duration / 60)}m`;
    }
    else {
        return `${Math.round(duration / 3600)}h`;
    }
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['backup-item']} */ ;
/** @type {__VLS_StyleScopedClasses['download-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['restore-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['info-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['delete-btn']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "backup-item" },
    ...{ class: (__VLS_ctx.statusClass) },
});
// @ts-ignore
[statusClass,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "backup-main" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "backup-icon" },
});
const __VLS_0 = ((__VLS_ctx.statusIcon));
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: (__VLS_ctx.iconClass) },
}));
const __VLS_2 = __VLS_1({
    ...{ class: (__VLS_ctx.iconClass) },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
// @ts-ignore
[statusIcon, iconClass,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "backup-info" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
    ...{ class: "backup-name" },
});
(__VLS_ctx.backup.name);
// @ts-ignore
[backup,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "backup-meta" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "backup-type" },
});
(__VLS_ctx.t(`backup.types.${__VLS_ctx.backup.backup_type}`));
// @ts-ignore
[backup, t,];
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "backup-separator" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "backup-date" },
});
(__VLS_ctx.formatDate(__VLS_ctx.backup.started_at));
// @ts-ignore
[backup, formatDate,];
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "backup-separator" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "backup-size" },
});
(__VLS_ctx.formatFileSize(__VLS_ctx.backup.file_size));
// @ts-ignore
[backup, formatFileSize,];
if (__VLS_ctx.backup.status !== 'completed') {
    // @ts-ignore
    [backup,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "backup-status" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "status-badge" },
        ...{ class: (`status-${__VLS_ctx.backup.status}`) },
    });
    // @ts-ignore
    [backup,];
    (__VLS_ctx.t(`backup.status.${__VLS_ctx.backup.status}`));
    // @ts-ignore
    [backup, t,];
    if (__VLS_ctx.backup.error_message) {
        // @ts-ignore
        [backup,];
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "error-message" },
        });
        (__VLS_ctx.backup.error_message);
        // @ts-ignore
        [backup,];
    }
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "backup-actions" },
});
if (__VLS_ctx.backup.status === 'in_progress') {
    // @ts-ignore
    [backup,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "progress-indicator" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "spinner" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "progress-text" },
    });
    (__VLS_ctx.t('backup.status.processing'));
    // @ts-ignore
    [t,];
}
else if (__VLS_ctx.backup.status === 'completed' && __VLS_ctx.backup.completed_at) {
    // @ts-ignore
    [backup, backup,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "duration-info" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "duration" },
    });
    (__VLS_ctx.formatDuration(__VLS_ctx.backup.started_at, __VLS_ctx.backup.completed_at));
    // @ts-ignore
    [backup, backup, formatDuration,];
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "action-buttons" },
});
if (__VLS_ctx.backup.status === 'completed') {
    // @ts-ignore
    [backup,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.backup.status === 'completed'))
                    return;
                __VLS_ctx.$emit('download', __VLS_ctx.backup);
                // @ts-ignore
                [backup, $emit,];
            } },
        ...{ class: "action-btn download-btn" },
        title: (__VLS_ctx.t('backup.actions.download')),
    });
    // @ts-ignore
    [t,];
    const __VLS_5 = {}.DownloadIcon;
    /** @type {[typeof __VLS_components.DownloadIcon, ]} */ ;
    // @ts-ignore
    DownloadIcon;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({}));
    const __VLS_7 = __VLS_6({}, ...__VLS_functionalComponentArgsRest(__VLS_6));
}
if (__VLS_ctx.backup.status === 'completed') {
    // @ts-ignore
    [backup,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.backup.status === 'completed'))
                    return;
                __VLS_ctx.$emit('restore', __VLS_ctx.backup);
                // @ts-ignore
                [backup, $emit,];
            } },
        ...{ class: "action-btn restore-btn" },
        title: (__VLS_ctx.t('backup.actions.restore')),
    });
    // @ts-ignore
    [t,];
    const __VLS_10 = {}.ArrowPathIcon;
    /** @type {[typeof __VLS_components.ArrowPathIcon, ]} */ ;
    // @ts-ignore
    ArrowPathIcon;
    // @ts-ignore
    const __VLS_11 = __VLS_asFunctionalComponent(__VLS_10, new __VLS_10({}));
    const __VLS_12 = __VLS_11({}, ...__VLS_functionalComponentArgsRest(__VLS_11));
}
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showDetails = !__VLS_ctx.showDetails;
            // @ts-ignore
            [showDetails, showDetails,];
        } },
    ...{ class: "action-btn info-btn" },
    title: (__VLS_ctx.t('backup.actions.details')),
});
// @ts-ignore
[t,];
const __VLS_15 = {}.InformationCircleIcon;
/** @type {[typeof __VLS_components.InformationCircleIcon, ]} */ ;
// @ts-ignore
InformationCircleIcon;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({}));
const __VLS_17 = __VLS_16({}, ...__VLS_functionalComponentArgsRest(__VLS_16));
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('delete', __VLS_ctx.backup);
            // @ts-ignore
            [backup, $emit,];
        } },
    ...{ class: "action-btn delete-btn" },
    title: (__VLS_ctx.t('backup.actions.delete')),
});
// @ts-ignore
[t,];
const __VLS_20 = {}.TrashIcon;
/** @type {[typeof __VLS_components.TrashIcon, ]} */ ;
// @ts-ignore
TrashIcon;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({}));
const __VLS_22 = __VLS_21({}, ...__VLS_functionalComponentArgsRest(__VLS_21));
if (__VLS_ctx.showDetails) {
    // @ts-ignore
    [showDetails,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "backup-details" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "details-grid" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "detail-item" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "detail-label" },
    });
    (__VLS_ctx.t('backup.details.id'));
    // @ts-ignore
    [t,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "detail-value" },
    });
    (__VLS_ctx.backup.id);
    // @ts-ignore
    [backup,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "detail-item" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "detail-label" },
    });
    (__VLS_ctx.t('backup.details.configuration'));
    // @ts-ignore
    [t,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "detail-value" },
    });
    (__VLS_ctx.backup.configuration_id || __VLS_ctx.t('backup.details.manual'));
    // @ts-ignore
    [backup, t,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "detail-item" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "detail-label" },
    });
    (__VLS_ctx.t('backup.details.recordsCount'));
    // @ts-ignore
    [t,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "detail-value" },
    });
    (__VLS_ctx.backup.records_count?.toLocaleString() || 0);
    // @ts-ignore
    [backup,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "detail-item" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "detail-label" },
    });
    (__VLS_ctx.t('backup.details.storage'));
    // @ts-ignore
    [t,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "detail-value" },
    });
    (__VLS_ctx.backup.storage_provider.toUpperCase());
    // @ts-ignore
    [backup,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "detail-item" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "detail-label" },
    });
    (__VLS_ctx.t('backup.details.encrypted'));
    // @ts-ignore
    [t,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "detail-value" },
    });
    (__VLS_ctx.backup.encryption_enabled ? __VLS_ctx.t('common.yes') : __VLS_ctx.t('common.no'));
    // @ts-ignore
    [backup, t, t,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "detail-item" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "detail-label" },
    });
    (__VLS_ctx.t('backup.details.checksum'));
    // @ts-ignore
    [t,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "detail-value checksum" },
    });
    (__VLS_ctx.backup.checksum || '-');
    // @ts-ignore
    [backup,];
    if (__VLS_ctx.backup.tables_included) {
        // @ts-ignore
        [backup,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "tables-info" },
        });
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "detail-label" },
        });
        (__VLS_ctx.t('backup.details.tables'));
        // @ts-ignore
        [t,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "table-tags" },
        });
        for (const [table] of __VLS_getVForSourceType((__VLS_ctx.backup.tables_included))) {
            // @ts-ignore
            [backup,];
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                key: (table),
                ...{ class: "table-tag" },
            });
            (table);
        }
    }
    if (__VLS_ctx.backup.metadata?.performance_metrics) {
        // @ts-ignore
        [backup,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "performance-info" },
        });
        __VLS_asFunctionalElement(__VLS_elements.h4, __VLS_elements.h4)({});
        (__VLS_ctx.t('backup.details.performance'));
        // @ts-ignore
        [t,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "performance-grid" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "metric" },
        });
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "metric-label" },
        });
        (__VLS_ctx.t('backup.metrics.duration'));
        // @ts-ignore
        [t,];
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "metric-value" },
        });
        (Math.round(__VLS_ctx.backup.metadata.performance_metrics.backup_duration_ms / 1000));
        // @ts-ignore
        [backup,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "metric" },
        });
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "metric-label" },
        });
        (__VLS_ctx.t('backup.metrics.compression'));
        // @ts-ignore
        [t,];
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "metric-value" },
        });
        (Math.round(__VLS_ctx.backup.metadata.performance_metrics.compression_ratio * 100));
        // @ts-ignore
        [backup,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "metric" },
        });
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "metric-label" },
        });
        (__VLS_ctx.t('backup.metrics.uploadSpeed'));
        // @ts-ignore
        [t,];
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "metric-value" },
        });
        (__VLS_ctx.backup.metadata.performance_metrics.upload_speed_mbps.toFixed(1));
        // @ts-ignore
        [backup,];
    }
}
/** @type {__VLS_StyleScopedClasses['backup-item']} */ ;
/** @type {__VLS_StyleScopedClasses['backup-main']} */ ;
/** @type {__VLS_StyleScopedClasses['backup-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['backup-info']} */ ;
/** @type {__VLS_StyleScopedClasses['backup-name']} */ ;
/** @type {__VLS_StyleScopedClasses['backup-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['backup-type']} */ ;
/** @type {__VLS_StyleScopedClasses['backup-separator']} */ ;
/** @type {__VLS_StyleScopedClasses['backup-date']} */ ;
/** @type {__VLS_StyleScopedClasses['backup-separator']} */ ;
/** @type {__VLS_StyleScopedClasses['backup-size']} */ ;
/** @type {__VLS_StyleScopedClasses['backup-status']} */ ;
/** @type {__VLS_StyleScopedClasses['status-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['error-message']} */ ;
/** @type {__VLS_StyleScopedClasses['backup-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['progress-indicator']} */ ;
/** @type {__VLS_StyleScopedClasses['spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['progress-text']} */ ;
/** @type {__VLS_StyleScopedClasses['duration-info']} */ ;
/** @type {__VLS_StyleScopedClasses['duration']} */ ;
/** @type {__VLS_StyleScopedClasses['action-buttons']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['download-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['restore-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['info-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['delete-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['backup-details']} */ ;
/** @type {__VLS_StyleScopedClasses['details-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-label']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-value']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-label']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-value']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-label']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-value']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-label']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-value']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-label']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-value']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-item']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-label']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-value']} */ ;
/** @type {__VLS_StyleScopedClasses['checksum']} */ ;
/** @type {__VLS_StyleScopedClasses['tables-info']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-label']} */ ;
/** @type {__VLS_StyleScopedClasses['table-tags']} */ ;
/** @type {__VLS_StyleScopedClasses['table-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['performance-info']} */ ;
/** @type {__VLS_StyleScopedClasses['performance-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['metric']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-label']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-value']} */ ;
/** @type {__VLS_StyleScopedClasses['metric']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-label']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-value']} */ ;
/** @type {__VLS_StyleScopedClasses['metric']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-label']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-value']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        DownloadIcon: DownloadIcon,
        ArrowPathIcon: ArrowPathIcon,
        InformationCircleIcon: InformationCircleIcon,
        TrashIcon: TrashIcon,
        t: t,
        showDetails: showDetails,
        statusClass: statusClass,
        statusIcon: statusIcon,
        iconClass: iconClass,
        formatDate: formatDate,
        formatFileSize: formatFileSize,
        formatDuration: formatDuration,
    }),
    __typeEmits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */

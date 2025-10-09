import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBackupStore } from '@/stores/backup';
import { useAuthStore } from '@/stores/auth';
import BackupListItem from '@/components/backup/BackupListItem.vue';
import BackupAlert from '@/components/backup/BackupAlert.vue';
import CreateBackupModal from '@/components/backup/CreateBackupModal.vue';
import RestoreBackupModal from '@/components/backup/RestoreBackupModal.vue';
const { t } = useI18n();
const backupStore = useBackupStore();
const authStore = useAuthStore();
// Reactive data
const isLoading = ref(false);
const showCreateBackupModal = ref(false);
const showRestoreModal = ref(false);
const selectedBackup = ref(null);
const systemHealth = ref(null);
const backupMetrics = ref(null);
const recentBackups = ref([]);
const alerts = ref([]);
// Computed properties
const healthStatusClass = computed(() => {
    const status = systemHealth.value?.overall_status;
    return {
        'health-healthy': status === 'healthy',
        'health-warning': status === 'warning',
        'health-critical': status === 'critical'
    };
});
const healthStatusIcon = computed(() => {
    const status = systemHealth.value?.overall_status;
    switch (status) {
        case 'healthy': return 'CheckCircleIcon';
        case 'warning': return 'ExclamationTriangleIcon';
        case 'critical': return 'XCircleIcon';
        default: return 'QuestionMarkCircleIcon';
    }
});
const healthStatusMessage = computed(() => {
    if (!systemHealth.value)
        return t('backup.health.loading');
    const { running_backups, failed_backups_24h } = systemHealth.value;
    if (failed_backups_24h > 0) {
        return t('backup.health.failuresDetected', { count: failed_backups_24h });
    }
    if (running_backups > 0) {
        return t('backup.health.backupsRunning', { count: running_backups });
    }
    return t('backup.health.allSystemsNormal');
});
// Methods
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
const refreshDashboard = async () => {
    if (isLoading.value)
        return;
    isLoading.value = true;
    try {
        // Get current restaurant from auth store
        const restaurantId = authStore.restaurantId;
        if (!restaurantId)
            throw new Error('No restaurant selected');
        // Fetch all dashboard data
        await Promise.all([
            loadSystemHealth(),
            loadBackupMetrics(String(restaurantId)),
            loadRecentBackups(String(restaurantId)),
            loadAlerts(String(restaurantId))
        ]);
    }
    catch (error) {
        console.error('Error refreshing dashboard:', error);
        // Handle error (show toast notification)
    }
    finally {
        isLoading.value = false;
    }
};
const loadSystemHealth = async () => {
    try {
        systemHealth.value = await backupStore.getSystemHealth();
    }
    catch (error) {
        console.error('Error loading system health:', error);
    }
};
const loadBackupMetrics = async (restaurantId) => {
    try {
        backupMetrics.value = await backupStore.getRestaurantMetrics(restaurantId);
    }
    catch (error) {
        console.error('Error loading backup metrics:', error);
    }
};
const loadRecentBackups = async (restaurantId) => {
    try {
        const response = await backupStore.listBackups({
            restaurant_id: restaurantId,
            limit: 5,
            sort_by: 'created_at',
            sort_order: 'desc'
        });
        recentBackups.value = response;
    }
    catch (error) {
        console.error('Error loading recent backups:', error);
    }
};
const loadAlerts = async (restaurantId) => {
    try {
        alerts.value = await backupStore.getRestaurantAlerts(restaurantId, true); // unresolved only
    }
    catch (error) {
        console.error('Error loading alerts:', error);
    }
};
// Event handlers
const handleDownloadBackup = async (backup) => {
    try {
        await backupStore.downloadBackup(backup.id);
    }
    catch (error) {
        console.error('Error downloading backup:', error);
    }
};
const handleRestoreBackup = (backup) => {
    selectedBackup.value = backup;
    showRestoreModal.value = true;
};
const handleDeleteBackup = async (backup) => {
    if (!confirm(t('backup.confirm.delete', { name: backup.name })))
        return;
    try {
        await backupStore.deleteBackup(backup.id);
        await refreshDashboard();
    }
    catch (error) {
        console.error('Error deleting backup:', error);
    }
};
const handleBackupCreated = () => {
    showCreateBackupModal.value = false;
    refreshDashboard();
};
const handleRestoreCompleted = () => {
    showRestoreModal.value = false;
    selectedBackup.value = null;
    refreshDashboard();
};
const handleAcknowledgeAlert = async (alert) => {
    try {
        await backupStore.acknowledgeAlert(alert.id);
        await loadAlerts(String(authStore.restaurantId || ''));
    }
    catch (error) {
        console.error('Error acknowledging alert:', error);
    }
};
const handleResolveAlert = async (alert) => {
    try {
        await backupStore.resolveAlert(alert.id);
        await loadAlerts(String(authStore.restaurantId || ''));
    }
    catch (error) {
        console.error('Error resolving alert:', error);
    }
};
// Lifecycle
onMounted(() => {
    refreshDashboard();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['dashboard-header']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['status-info']} */ ;
/** @type {__VLS_StyleScopedClasses['status-info']} */ ;
/** @type {__VLS_StyleScopedClasses['section-header']} */ ;
/** @type {__VLS_StyleScopedClasses['view-all-link']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "backup-dashboard" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "dashboard-header" },
});
__VLS_asFunctionalElement(__VLS_elements.h1, __VLS_elements.h1)({});
(__VLS_ctx.t('backup.dashboard.title'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "header-actions" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showCreateBackupModal = true;
            // @ts-ignore
            [showCreateBackupModal,];
        } },
    ...{ class: "btn btn-primary" },
});
(__VLS_ctx.t('backup.actions.create'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.refreshDashboard) },
    ...{ class: "btn btn-secondary" },
    disabled: (__VLS_ctx.isLoading),
});
// @ts-ignore
[refreshDashboard, isLoading,];
(__VLS_ctx.t('backup.actions.refresh'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "health-status-card" },
    ...{ class: (__VLS_ctx.healthStatusClass) },
});
// @ts-ignore
[healthStatusClass,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "status-icon" },
});
const __VLS_0 = ((__VLS_ctx.healthStatusIcon));
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
// @ts-ignore
[healthStatusIcon,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "status-info" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({});
(__VLS_ctx.t(`backup.health.${__VLS_ctx.systemHealth?.overall_status || 'unknown'}`));
// @ts-ignore
[t, systemHealth,];
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({});
(__VLS_ctx.healthStatusMessage);
// @ts-ignore
[healthStatusMessage,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "status-metrics" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "metric-value" },
});
(__VLS_ctx.systemHealth?.running_backups || 0);
// @ts-ignore
[systemHealth,];
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "metric-label" },
});
(__VLS_ctx.t('backup.metrics.running'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "metric-value" },
});
(__VLS_ctx.systemHealth?.failed_backups_24h || 0);
// @ts-ignore
[systemHealth,];
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "metric-label" },
});
(__VLS_ctx.t('backup.metrics.failed24h'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "stats-grid" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "stat-card" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "stat-icon backup-icon" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "stat-content" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "stat-value" },
});
(__VLS_ctx.backupMetrics?.total_backups || 0);
// @ts-ignore
[backupMetrics,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "stat-label" },
});
(__VLS_ctx.t('backup.stats.totalBackups'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "stat-card" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "stat-icon success-icon" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "stat-content" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "stat-value" },
});
(__VLS_ctx.backupMetrics?.successful_backups || 0);
// @ts-ignore
[backupMetrics,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "stat-label" },
});
(__VLS_ctx.t('backup.stats.successful'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "stat-card" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "stat-icon storage-icon" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "stat-content" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "stat-value" },
});
(__VLS_ctx.formatFileSize(__VLS_ctx.backupMetrics?.storage_usage_bytes || 0));
// @ts-ignore
[backupMetrics, formatFileSize,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "stat-label" },
});
(__VLS_ctx.t('backup.stats.storageUsed'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "stat-card" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "stat-icon cost-icon" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "stat-content" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "stat-value" },
});
((__VLS_ctx.backupMetrics?.cost_estimation || 0).toFixed(3));
// @ts-ignore
[backupMetrics,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "stat-label" },
});
(__VLS_ctx.t('backup.stats.estimatedCost'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "recent-backups-section" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "section-header" },
});
__VLS_asFunctionalElement(__VLS_elements.h2, __VLS_elements.h2)({});
(__VLS_ctx.t('backup.recent.title'));
// @ts-ignore
[t,];
const __VLS_5 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
// @ts-ignore
RouterLink;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
    to: "/backup/history",
    ...{ class: "view-all-link" },
}));
const __VLS_7 = __VLS_6({
    to: "/backup/history",
    ...{ class: "view-all-link" },
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
const { default: __VLS_9 } = __VLS_8.slots;
(__VLS_ctx.t('backup.recent.viewAll'));
// @ts-ignore
[t,];
var __VLS_8;
if (__VLS_ctx.recentBackups.length > 0) {
    // @ts-ignore
    [recentBackups,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "backup-list" },
    });
    for (const [backup] of __VLS_getVForSourceType((__VLS_ctx.recentBackups))) {
        // @ts-ignore
        [recentBackups,];
        /** @type {[typeof BackupListItem, ]} */ ;
        // @ts-ignore
        const __VLS_10 = __VLS_asFunctionalComponent(BackupListItem, new BackupListItem({
            ...{ 'onDownload': {} },
            ...{ 'onRestore': {} },
            ...{ 'onDelete': {} },
            key: (backup.id),
            backup: (backup),
        }));
        const __VLS_11 = __VLS_10({
            ...{ 'onDownload': {} },
            ...{ 'onRestore': {} },
            ...{ 'onDelete': {} },
            key: (backup.id),
            backup: (backup),
        }, ...__VLS_functionalComponentArgsRest(__VLS_10));
        let __VLS_13;
        let __VLS_14;
        const __VLS_15 = ({ download: {} },
            { onDownload: (__VLS_ctx.handleDownloadBackup) });
        const __VLS_16 = ({ restore: {} },
            { onRestore: (__VLS_ctx.handleRestoreBackup) });
        const __VLS_17 = ({ delete: {} },
            { onDelete: (__VLS_ctx.handleDeleteBackup) });
        // @ts-ignore
        [handleDownloadBackup, handleRestoreBackup, handleDeleteBackup,];
        var __VLS_12;
    }
}
else {
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "empty-state" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "empty-icon" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({});
    (__VLS_ctx.t('backup.empty.title'));
    // @ts-ignore
    [t,];
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({});
    (__VLS_ctx.t('backup.empty.description'));
    // @ts-ignore
    [t,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.recentBackups.length > 0))
                    return;
                __VLS_ctx.showCreateBackupModal = true;
                // @ts-ignore
                [showCreateBackupModal,];
            } },
        ...{ class: "btn btn-primary" },
    });
    (__VLS_ctx.t('backup.empty.createFirst'));
    // @ts-ignore
    [t,];
}
if (__VLS_ctx.alerts.length > 0) {
    // @ts-ignore
    [alerts,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "alerts-section" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h2, __VLS_elements.h2)({});
    (__VLS_ctx.t('backup.alerts.title'));
    // @ts-ignore
    [t,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "alert-list" },
    });
    for (const [alert] of __VLS_getVForSourceType((__VLS_ctx.alerts))) {
        // @ts-ignore
        [alerts,];
        /** @type {[typeof BackupAlert, ]} */ ;
        // @ts-ignore
        const __VLS_19 = __VLS_asFunctionalComponent(BackupAlert, new BackupAlert({
            ...{ 'onAcknowledge': {} },
            ...{ 'onResolve': {} },
            key: (alert.id),
            alert: (alert),
        }));
        const __VLS_20 = __VLS_19({
            ...{ 'onAcknowledge': {} },
            ...{ 'onResolve': {} },
            key: (alert.id),
            alert: (alert),
        }, ...__VLS_functionalComponentArgsRest(__VLS_19));
        let __VLS_22;
        let __VLS_23;
        const __VLS_24 = ({ acknowledge: {} },
            { onAcknowledge: (__VLS_ctx.handleAcknowledgeAlert) });
        const __VLS_25 = ({ resolve: {} },
            { onResolve: (__VLS_ctx.handleResolveAlert) });
        // @ts-ignore
        [handleAcknowledgeAlert, handleResolveAlert,];
        var __VLS_21;
    }
}
if (__VLS_ctx.showCreateBackupModal) {
    // @ts-ignore
    [showCreateBackupModal,];
    /** @type {[typeof CreateBackupModal, ]} */ ;
    // @ts-ignore
    const __VLS_27 = __VLS_asFunctionalComponent(CreateBackupModal, new CreateBackupModal({
        ...{ 'onClose': {} },
        ...{ 'onCreated': {} },
    }));
    const __VLS_28 = __VLS_27({
        ...{ 'onClose': {} },
        ...{ 'onCreated': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_27));
    let __VLS_30;
    let __VLS_31;
    const __VLS_32 = ({ close: {} },
        { onClose: (...[$event]) => {
                if (!(__VLS_ctx.showCreateBackupModal))
                    return;
                __VLS_ctx.showCreateBackupModal = false;
                // @ts-ignore
                [showCreateBackupModal,];
            } });
    const __VLS_33 = ({ created: {} },
        { onCreated: (__VLS_ctx.handleBackupCreated) });
    // @ts-ignore
    [handleBackupCreated,];
    var __VLS_29;
}
if (__VLS_ctx.showRestoreModal) {
    // @ts-ignore
    [showRestoreModal,];
    /** @type {[typeof RestoreBackupModal, ]} */ ;
    // @ts-ignore
    const __VLS_35 = __VLS_asFunctionalComponent(RestoreBackupModal, new RestoreBackupModal({
        ...{ 'onClose': {} },
        ...{ 'onRestored': {} },
        backup: (__VLS_ctx.selectedBackup),
    }));
    const __VLS_36 = __VLS_35({
        ...{ 'onClose': {} },
        ...{ 'onRestored': {} },
        backup: (__VLS_ctx.selectedBackup),
    }, ...__VLS_functionalComponentArgsRest(__VLS_35));
    let __VLS_38;
    let __VLS_39;
    const __VLS_40 = ({ close: {} },
        { onClose: (...[$event]) => {
                if (!(__VLS_ctx.showRestoreModal))
                    return;
                __VLS_ctx.showRestoreModal = false;
                // @ts-ignore
                [showRestoreModal, selectedBackup,];
            } });
    const __VLS_41 = ({ restored: {} },
        { onRestored: (__VLS_ctx.handleRestoreCompleted) });
    // @ts-ignore
    [handleRestoreCompleted,];
    var __VLS_37;
}
/** @type {__VLS_StyleScopedClasses['backup-dashboard']} */ ;
/** @type {__VLS_StyleScopedClasses['dashboard-header']} */ ;
/** @type {__VLS_StyleScopedClasses['header-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['health-status-card']} */ ;
/** @type {__VLS_StyleScopedClasses['status-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['status-info']} */ ;
/** @type {__VLS_StyleScopedClasses['status-metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['metric']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-value']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-label']} */ ;
/** @type {__VLS_StyleScopedClasses['metric']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-value']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-label']} */ ;
/** @type {__VLS_StyleScopedClasses['stats-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['backup-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-content']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['success-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-content']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['storage-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-content']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-card']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['cost-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-content']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
/** @type {__VLS_StyleScopedClasses['recent-backups-section']} */ ;
/** @type {__VLS_StyleScopedClasses['section-header']} */ ;
/** @type {__VLS_StyleScopedClasses['view-all-link']} */ ;
/** @type {__VLS_StyleScopedClasses['backup-list']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['alerts-section']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-list']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        BackupListItem: BackupListItem,
        BackupAlert: BackupAlert,
        CreateBackupModal: CreateBackupModal,
        RestoreBackupModal: RestoreBackupModal,
        t: t,
        isLoading: isLoading,
        showCreateBackupModal: showCreateBackupModal,
        showRestoreModal: showRestoreModal,
        selectedBackup: selectedBackup,
        systemHealth: systemHealth,
        backupMetrics: backupMetrics,
        recentBackups: recentBackups,
        alerts: alerts,
        healthStatusClass: healthStatusClass,
        healthStatusIcon: healthStatusIcon,
        healthStatusMessage: healthStatusMessage,
        formatFileSize: formatFileSize,
        refreshDashboard: refreshDashboard,
        handleDownloadBackup: handleDownloadBackup,
        handleRestoreBackup: handleRestoreBackup,
        handleDeleteBackup: handleDeleteBackup,
        handleBackupCreated: handleBackupCreated,
        handleRestoreCompleted: handleRestoreCompleted,
        handleAcknowledgeAlert: handleAcknowledgeAlert,
        handleResolveAlert: handleResolveAlert,
    }),
});
export default (await import('vue')).defineComponent({});
; /* PartiallyEnd: #4569/main.vue */

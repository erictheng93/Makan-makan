import { ref, computed, onMounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useBackupStore } from '@/stores/backup';
import { CheckCircleIcon, ExclamationTriangleIcon, ExclamationCircleIcon, XCircleIcon } from '@heroicons/vue/24/outline';
const { t } = useI18n();
const router = useRouter();
const backupStore = useBackupStore();
// Reactive data
const isLoading = ref(false);
const systemHealth = ref(null);
const performanceData = ref([]);
const restaurants = ref([]);
const criticalAlerts = ref([]);
const selectedPeriod = ref('7d');
const statusFilter = ref('all');
// Chart reference
const performanceChart = ref();
// Computed properties
const overallHealthClass = computed(() => {
    const status = systemHealth.value?.overall_status;
    return {
        'health-healthy': status === 'healthy',
        'health-warning': status === 'warning',
        'health-critical': status === 'critical'
    };
});
const healthIcon = computed(() => {
    const status = systemHealth.value?.overall_status;
    switch (status) {
        case 'healthy': return CheckCircleIcon;
        case 'warning': return ExclamationTriangleIcon;
        case 'critical': return XCircleIcon;
        default: return ExclamationCircleIcon;
    }
});
const healthIconClass = computed(() => {
    const status = systemHealth.value?.overall_status;
    return {
        'text-green-500': status === 'healthy',
        'text-yellow-500': status === 'warning',
        'text-red-500': status === 'critical',
        'text-gray-500': !status
    };
});
const filteredRestaurants = computed(() => {
    if (statusFilter.value === 'all')
        return restaurants.value;
    if (statusFilter.value === 'healthy') {
        return restaurants.value.filter(r => r.status === 'healthy');
    }
    if (statusFilter.value === 'issues') {
        return restaurants.value.filter(r => r.status !== 'healthy');
    }
    return restaurants.value;
});
// Methods
const formatBytes = (bytes) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};
const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    if (diffHours < 1)
        return t('backup.monitoring.justNow');
    if (diffHours < 24)
        return t('backup.monitoring.hoursAgo', { hours: diffHours });
    if (diffHours < 48)
        return t('backup.monitoring.yesterday');
    return date.toLocaleDateString();
};
const getRestaurantStatusClass = (restaurant) => {
    return {
        'status-healthy': restaurant.status === 'healthy',
        'status-warning': restaurant.status === 'warning',
        'status-critical': restaurant.status === 'critical'
    };
};
const refreshData = async () => {
    if (isLoading.value)
        return;
    isLoading.value = true;
    try {
        await Promise.all([
            loadSystemHealth(),
            loadPerformanceData(),
            loadRestaurants(),
            loadCriticalAlerts()
        ]);
    }
    catch (error) {
        console.error('Error refreshing monitoring data:', error);
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
const loadPerformanceData = async () => {
    try {
        // Mock performance data - replace with actual API call
        performanceData.value = generateMockPerformanceData();
        await nextTick();
        if (performanceChart.value) {
            renderPerformanceChart();
        }
    }
    catch (error) {
        console.error('Error loading performance data:', error);
    }
};
const loadRestaurants = async () => {
    try {
        // Mock restaurant data - replace with actual API call
        restaurants.value = generateMockRestaurantData();
    }
    catch (error) {
        console.error('Error loading restaurants:', error);
    }
};
const loadCriticalAlerts = async () => {
    try {
        // Get all unresolved alerts from all restaurants
        // In production, this would be a system-wide alert endpoint
        criticalAlerts.value = []; // Replace with actual API call
    }
    catch (error) {
        console.error('Error loading critical alerts:', error);
    }
};
const filterRestaurants = () => {
    // Filtering is handled by computed property
};
const viewRestaurantDetails = (restaurantId) => {
    router.push(`/backup/restaurant/${restaurantId}`);
};
const acknowledgeAlert = async (alertId) => {
    try {
        await backupStore.acknowledgeAlert(alertId);
        await loadCriticalAlerts();
    }
    catch (error) {
        console.error('Error acknowledging alert:', error);
    }
};
const resolveAlert = async (alertId) => {
    try {
        await backupStore.resolveAlert(alertId);
        await loadCriticalAlerts();
    }
    catch (error) {
        console.error('Error resolving alert:', error);
    }
};
// Chart rendering
const renderPerformanceChart = () => {
    const canvas = performanceChart.value;
    if (!canvas)
        return;
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return;
    // Simple line chart implementation
    // In production, use a proper charting library like Chart.js
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw axes and data points
    // This is a simplified implementation
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    performanceData.value.forEach((point, index) => {
        const x = (index / (performanceData.value.length - 1)) * canvas.width;
        const y = canvas.height - ((point.value / 100) * canvas.height);
        if (index === 0) {
            ctx.moveTo(x, y);
        }
        else {
            ctx.lineTo(x, y);
        }
    });
    ctx.stroke();
};
// Mock data generators
const generateMockPerformanceData = () => {
    const data = [];
    const days = selectedPeriod.value === '24h' ? 24 : selectedPeriod.value === '7d' ? 7 : 30;
    for (let i = 0; i < days; i++) {
        data.push({
            timestamp: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000),
            value: Math.random() * 30 + 70 // Success rate between 70-100%
        });
    }
    return data;
};
const generateMockRestaurantData = () => {
    return [
        {
            id: 'rest-1',
            name: 'MakanMakan Central',
            status: 'healthy',
            last_backup_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            success_rate: 98,
            total_backups: 45,
            storage_used: 2.5 * 1024 * 1024 * 1024 // 2.5 GB
        },
        {
            id: 'rest-2',
            name: 'Downtown Branch',
            status: 'warning',
            last_backup_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
            success_rate: 85,
            total_backups: 32,
            storage_used: 1.8 * 1024 * 1024 * 1024 // 1.8 GB
        }
    ];
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
/** @type {__VLS_StyleScopedClasses['monitoring-header']} */ ;
/** @type {__VLS_StyleScopedClasses['health-card']} */ ;
/** @type {__VLS_StyleScopedClasses['health-card']} */ ;
/** @type {__VLS_StyleScopedClasses['health-card']} */ ;
/** @type {__VLS_StyleScopedClasses['health-header']} */ ;
/** @type {__VLS_StyleScopedClasses['chart-card']} */ ;
/** @type {__VLS_StyleScopedClasses['chart-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['section-header']} */ ;
/** @type {__VLS_StyleScopedClasses['restaurant-card']} */ ;
/** @type {__VLS_StyleScopedClasses['restaurant-card']} */ ;
/** @type {__VLS_StyleScopedClasses['restaurant-card']} */ ;
/** @type {__VLS_StyleScopedClasses['restaurant-header']} */ ;
/** @type {__VLS_StyleScopedClasses['status-indicator']} */ ;
/** @type {__VLS_StyleScopedClasses['status-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['status-indicator']} */ ;
/** @type {__VLS_StyleScopedClasses['status-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['status-indicator']} */ ;
/** @type {__VLS_StyleScopedClasses['status-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-row']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-label']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-row']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-value']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-item']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-item']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "backup-monitoring" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "monitoring-header" },
});
__VLS_asFunctionalElement(__VLS_elements.h1, __VLS_elements.h1)({});
(__VLS_ctx.t('backup.monitoring.title'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "header-actions" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.refreshData) },
    ...{ class: "btn btn-secondary" },
    disabled: (__VLS_ctx.isLoading),
});
// @ts-ignore
[refreshData, isLoading,];
(__VLS_ctx.t('backup.actions.refresh'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "health-overview" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "health-card" },
    ...{ class: (__VLS_ctx.overallHealthClass) },
});
// @ts-ignore
[overallHealthClass,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "health-header" },
});
__VLS_asFunctionalElement(__VLS_elements.h2, __VLS_elements.h2)({});
(__VLS_ctx.t('backup.monitoring.systemHealth'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "health-status" },
});
const __VLS_0 = ((__VLS_ctx.healthIcon));
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: (__VLS_ctx.healthIconClass) },
}));
const __VLS_2 = __VLS_1({
    ...{ class: (__VLS_ctx.healthIconClass) },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
// @ts-ignore
[healthIcon, healthIconClass,];
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "status-text" },
});
(__VLS_ctx.t(`backup.health.${__VLS_ctx.systemHealth?.overall_status || 'unknown'}`));
// @ts-ignore
[t, systemHealth,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "health-metrics" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-group" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "metric-value" },
});
(__VLS_ctx.systemHealth?.total_restaurants || 0);
// @ts-ignore
[systemHealth,];
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "metric-label" },
});
(__VLS_ctx.t('backup.monitoring.totalRestaurants'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "metric-value" },
});
(__VLS_ctx.systemHealth?.active_configurations || 0);
// @ts-ignore
[systemHealth,];
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "metric-label" },
});
(__VLS_ctx.t('backup.monitoring.activeConfigs'));
// @ts-ignore
[t,];
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
(__VLS_ctx.t('backup.monitoring.runningBackups'));
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
(__VLS_ctx.t('backup.monitoring.failed24h'));
// @ts-ignore
[t,];
if (__VLS_ctx.systemHealth?.storage_usage) {
    // @ts-ignore
    [systemHealth,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "storage-info" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({});
    (__VLS_ctx.t('backup.monitoring.storageUsage'));
    // @ts-ignore
    [t,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "storage-bar" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "storage-fill" },
        ...{ style: ({ width: __VLS_ctx.systemHealth.storage_usage.usage_percentage + '%' }) },
    });
    // @ts-ignore
    [systemHealth,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "storage-details" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    (__VLS_ctx.formatBytes(__VLS_ctx.systemHealth.storage_usage.total_bytes));
    // @ts-ignore
    [systemHealth, formatBytes,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    (__VLS_ctx.systemHealth.storage_usage.usage_percentage.toFixed(1));
    // @ts-ignore
    [systemHealth,];
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "performance-section" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "chart-card" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({});
(__VLS_ctx.t('backup.monitoring.performanceTrends'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "chart-controls" },
});
__VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
    ...{ onChange: (__VLS_ctx.loadPerformanceData) },
    value: (__VLS_ctx.selectedPeriod),
});
// @ts-ignore
[loadPerformanceData, selectedPeriod,];
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "24h",
});
(__VLS_ctx.t('backup.monitoring.last24h'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "7d",
});
(__VLS_ctx.t('backup.monitoring.last7days'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "30d",
});
(__VLS_ctx.t('backup.monitoring.last30days'));
// @ts-ignore
[t,];
if (__VLS_ctx.performanceData.length > 0) {
    // @ts-ignore
    [performanceData,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "chart-container" },
    });
    __VLS_asFunctionalElement(__VLS_elements.canvas, __VLS_elements.canvas)({
        ref: "performanceChart",
        width: "800",
        height: "300",
    });
    /** @type {typeof __VLS_ctx.performanceChart} */ ;
    // @ts-ignore
    [performanceChart,];
}
else {
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "empty-chart" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({});
    (__VLS_ctx.t('backup.monitoring.noPerformanceData'));
    // @ts-ignore
    [t,];
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "restaurants-section" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "section-header" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({});
(__VLS_ctx.t('backup.monitoring.restaurantStatus'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "filter-controls" },
});
__VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
    ...{ onChange: (__VLS_ctx.filterRestaurants) },
    value: (__VLS_ctx.statusFilter),
});
// @ts-ignore
[filterRestaurants, statusFilter,];
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "all",
});
(__VLS_ctx.t('backup.monitoring.allRestaurants'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "healthy",
});
(__VLS_ctx.t('backup.monitoring.healthyOnly'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "issues",
});
(__VLS_ctx.t('backup.monitoring.withIssues'));
// @ts-ignore
[t,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "restaurants-grid" },
});
for (const [restaurant] of __VLS_getVForSourceType((__VLS_ctx.filteredRestaurants))) {
    // @ts-ignore
    [filteredRestaurants,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        key: (restaurant.id),
        ...{ class: "restaurant-card" },
        ...{ class: (__VLS_ctx.getRestaurantStatusClass(restaurant)) },
    });
    // @ts-ignore
    [getRestaurantStatusClass,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "restaurant-header" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h4, __VLS_elements.h4)({});
    (restaurant.name);
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "status-indicator" },
        ...{ class: (restaurant.status) },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "status-dot" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "status-text" },
    });
    (__VLS_ctx.t(`backup.monitoring.${restaurant.status}`));
    // @ts-ignore
    [t,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "restaurant-metrics" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "metric-row" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "metric-label" },
    });
    (__VLS_ctx.t('backup.monitoring.lastBackup'));
    // @ts-ignore
    [t,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "metric-value" },
    });
    (__VLS_ctx.formatDate(restaurant.last_backup_at));
    // @ts-ignore
    [formatDate,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "metric-row" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "metric-label" },
    });
    (__VLS_ctx.t('backup.monitoring.successRate'));
    // @ts-ignore
    [t,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "metric-value" },
    });
    (restaurant.success_rate);
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "metric-row" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "metric-label" },
    });
    (__VLS_ctx.t('backup.monitoring.totalBackups'));
    // @ts-ignore
    [t,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "metric-value" },
    });
    (restaurant.total_backups);
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "metric-row" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "metric-label" },
    });
    (__VLS_ctx.t('backup.monitoring.storageUsed'));
    // @ts-ignore
    [t,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "metric-value" },
    });
    (__VLS_ctx.formatBytes(restaurant.storage_used));
    // @ts-ignore
    [formatBytes,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "restaurant-actions" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.viewRestaurantDetails(restaurant.id);
                // @ts-ignore
                [viewRestaurantDetails,];
            } },
        ...{ class: "btn btn-sm btn-primary" },
    });
    (__VLS_ctx.t('backup.monitoring.viewDetails'));
    // @ts-ignore
    [t,];
}
if (__VLS_ctx.criticalAlerts.length > 0) {
    // @ts-ignore
    [criticalAlerts,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "alerts-section" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "section-header" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({});
    (__VLS_ctx.t('backup.monitoring.criticalAlerts'));
    // @ts-ignore
    [t,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "alert-count" },
    });
    (__VLS_ctx.criticalAlerts.length);
    // @ts-ignore
    [criticalAlerts,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "alerts-list" },
    });
    for (const [alert] of __VLS_getVForSourceType((__VLS_ctx.criticalAlerts))) {
        // @ts-ignore
        [criticalAlerts,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            key: (alert.id),
            ...{ class: "alert-item" },
            ...{ class: ('severity-' + alert.severity) },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "alert-icon" },
        });
        if (alert.severity === 'critical') {
            const __VLS_5 = {}.ExclamationTriangleIcon;
            /** @type {[typeof __VLS_components.ExclamationTriangleIcon, ]} */ ;
            // @ts-ignore
            ExclamationTriangleIcon;
            // @ts-ignore
            const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({}));
            const __VLS_7 = __VLS_6({}, ...__VLS_functionalComponentArgsRest(__VLS_6));
        }
        else {
            const __VLS_10 = {}.ExclamationCircleIcon;
            /** @type {[typeof __VLS_components.ExclamationCircleIcon, ]} */ ;
            // @ts-ignore
            ExclamationCircleIcon;
            // @ts-ignore
            const __VLS_11 = __VLS_asFunctionalComponent(__VLS_10, new __VLS_10({}));
            const __VLS_12 = __VLS_11({}, ...__VLS_functionalComponentArgsRest(__VLS_11));
        }
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "alert-content" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "alert-title" },
        });
        (alert.title);
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "alert-message" },
        });
        (alert.message);
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "alert-meta" },
        });
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
        (__VLS_ctx.formatDate(alert.triggered_at));
        // @ts-ignore
        [formatDate,];
        if (alert.related_backup_id) {
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
            (__VLS_ctx.t('backup.monitoring.relatedBackup'));
            (alert.related_backup_id.slice(0, 8));
            // @ts-ignore
            [t,];
        }
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "alert-actions" },
        });
        if (!alert.acknowledged) {
            __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.criticalAlerts.length > 0))
                            return;
                        if (!(!alert.acknowledged))
                            return;
                        __VLS_ctx.acknowledgeAlert(alert.id);
                        // @ts-ignore
                        [acknowledgeAlert,];
                    } },
                ...{ class: "btn btn-sm btn-secondary" },
            });
            (__VLS_ctx.t('backup.monitoring.acknowledge'));
            // @ts-ignore
            [t,];
        }
        if (!alert.resolved) {
            __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.criticalAlerts.length > 0))
                            return;
                        if (!(!alert.resolved))
                            return;
                        __VLS_ctx.resolveAlert(alert.id);
                        // @ts-ignore
                        [resolveAlert,];
                    } },
                ...{ class: "btn btn-sm btn-primary" },
            });
            (__VLS_ctx.t('backup.monitoring.resolve'));
            // @ts-ignore
            [t,];
        }
    }
}
/** @type {__VLS_StyleScopedClasses['backup-monitoring']} */ ;
/** @type {__VLS_StyleScopedClasses['monitoring-header']} */ ;
/** @type {__VLS_StyleScopedClasses['header-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['health-overview']} */ ;
/** @type {__VLS_StyleScopedClasses['health-card']} */ ;
/** @type {__VLS_StyleScopedClasses['health-header']} */ ;
/** @type {__VLS_StyleScopedClasses['health-status']} */ ;
/** @type {__VLS_StyleScopedClasses['status-text']} */ ;
/** @type {__VLS_StyleScopedClasses['health-metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-group']} */ ;
/** @type {__VLS_StyleScopedClasses['metric']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-value']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-label']} */ ;
/** @type {__VLS_StyleScopedClasses['metric']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-value']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-label']} */ ;
/** @type {__VLS_StyleScopedClasses['metric']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-value']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-label']} */ ;
/** @type {__VLS_StyleScopedClasses['metric']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-value']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-label']} */ ;
/** @type {__VLS_StyleScopedClasses['storage-info']} */ ;
/** @type {__VLS_StyleScopedClasses['storage-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['storage-fill']} */ ;
/** @type {__VLS_StyleScopedClasses['storage-details']} */ ;
/** @type {__VLS_StyleScopedClasses['performance-section']} */ ;
/** @type {__VLS_StyleScopedClasses['chart-card']} */ ;
/** @type {__VLS_StyleScopedClasses['chart-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['chart-container']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-chart']} */ ;
/** @type {__VLS_StyleScopedClasses['restaurants-section']} */ ;
/** @type {__VLS_StyleScopedClasses['section-header']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-controls']} */ ;
/** @type {__VLS_StyleScopedClasses['restaurants-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['restaurant-card']} */ ;
/** @type {__VLS_StyleScopedClasses['restaurant-header']} */ ;
/** @type {__VLS_StyleScopedClasses['status-indicator']} */ ;
/** @type {__VLS_StyleScopedClasses['status-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['status-text']} */ ;
/** @type {__VLS_StyleScopedClasses['restaurant-metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-row']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-label']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-value']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-row']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-label']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-value']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-row']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-label']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-value']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-row']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-label']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-value']} */ ;
/** @type {__VLS_StyleScopedClasses['restaurant-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['alerts-section']} */ ;
/** @type {__VLS_StyleScopedClasses['section-header']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-count']} */ ;
/** @type {__VLS_StyleScopedClasses['alerts-list']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-item']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-content']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-title']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-message']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        ExclamationTriangleIcon: ExclamationTriangleIcon,
        ExclamationCircleIcon: ExclamationCircleIcon,
        t: t,
        isLoading: isLoading,
        systemHealth: systemHealth,
        performanceData: performanceData,
        criticalAlerts: criticalAlerts,
        selectedPeriod: selectedPeriod,
        statusFilter: statusFilter,
        performanceChart: performanceChart,
        overallHealthClass: overallHealthClass,
        healthIcon: healthIcon,
        healthIconClass: healthIconClass,
        filteredRestaurants: filteredRestaurants,
        formatBytes: formatBytes,
        formatDate: formatDate,
        getRestaurantStatusClass: getRestaurantStatusClass,
        refreshData: refreshData,
        loadPerformanceData: loadPerformanceData,
        filterRestaurants: filterRestaurants,
        viewRestaurantDetails: viewRestaurantDetails,
        acknowledgeAlert: acknowledgeAlert,
        resolveAlert: resolveAlert,
    }),
});
export default (await import('vue')).defineComponent({});
; /* PartiallyEnd: #4569/main.vue */

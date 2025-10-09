import { computed, ref } from 'vue';
import { usePerformanceMonitor } from '../composables/usePerformanceMonitor';
const { webVitals, metrics, resources, getPerformanceScore, getPerformanceGrade, generateReport } = usePerformanceMonitor();
const isRefreshing = ref(false);
const performanceScore = computed(() => getPerformanceScore());
const performanceGrade = computed(() => getPerformanceGrade());
const recentMetrics = computed(() => {
    return metrics.value
        .slice()
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 20);
});
const slowResources = computed(() => {
    return resources.value
        .filter((r) => r.duration > 1000)
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10);
});
function getVitalStatus(metric, value) {
    if (!value)
        return 'unknown';
    const thresholds = {
        LCP: { good: 2500, poor: 4000 },
        FID: { good: 100, poor: 300 },
        CLS: { good: 0.1, poor: 0.25 },
        FCP: { good: 1800, poor: 3000 },
        TTFB: { good: 800, poor: 1800 },
        TTI: { good: 3800, poor: 7300 }
    };
    const threshold = thresholds[metric];
    if (!threshold)
        return 'unknown';
    if (value <= threshold.good)
        return 'good';
    if (value <= threshold.poor)
        return 'needs-improvement';
    return 'poor';
}
function formatMetricValue(metric) {
    if (metric.unit === 'ms') {
        return metric.value.toFixed(2);
    }
    if (metric.unit === 'bytes') {
        return formatBytes(metric.value);
    }
    return metric.value.toString();
}
function formatBytes(bytes) {
    if (bytes === 0)
        return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
function formatResourceName(name) {
    try {
        const url = new URL(name);
        return url.pathname.split('/').pop() || url.pathname;
    }
    catch {
        return name;
    }
}
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
}
async function refresh() {
    isRefreshing.value = true;
    await new Promise(resolve => setTimeout(resolve, 1000));
    isRefreshing.value = false;
}
function exportReport() {
    const report = generateReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], {
        type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['dashboard-header']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['score-card']} */ ;
/** @type {__VLS_StyleScopedClasses['score-card']} */ ;
/** @type {__VLS_StyleScopedClasses['score-card']} */ ;
/** @type {__VLS_StyleScopedClasses['score-card']} */ ;
/** @type {__VLS_StyleScopedClasses['score-card']} */ ;
/** @type {__VLS_StyleScopedClasses['metrics-section']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-card']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-card']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-card']} */ ;
/** @type {__VLS_StyleScopedClasses['metrics-table']} */ ;
/** @type {__VLS_StyleScopedClasses['metrics-table']} */ ;
/** @type {__VLS_StyleScopedClasses['metrics-table']} */ ;
/** @type {__VLS_StyleScopedClasses['resource-item']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "performance-dashboard" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "dashboard-header" },
});
__VLS_asFunctionalElement(__VLS_elements.h2, __VLS_elements.h2)({});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "header-actions" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.refresh) },
    ...{ class: "btn-secondary" },
    disabled: (__VLS_ctx.isRefreshing),
});
// @ts-ignore
[refresh, isRefreshing,];
if (__VLS_ctx.isRefreshing) {
    // @ts-ignore
    [isRefreshing,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
}
else {
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
}
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.exportReport) },
    ...{ class: "btn-primary" },
});
// @ts-ignore
[exportReport,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "score-card" },
    ...{ class: (`grade-${__VLS_ctx.performanceGrade.toLowerCase()}`) },
});
// @ts-ignore
[performanceGrade,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "score-value" },
});
(__VLS_ctx.performanceScore);
// @ts-ignore
[performanceScore,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "score-grade" },
});
(__VLS_ctx.performanceGrade);
// @ts-ignore
[performanceGrade,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "score-label" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metrics-section" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metrics-grid" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-card" },
    ...{ class: (__VLS_ctx.getVitalStatus('LCP', __VLS_ctx.webVitals.LCP)) },
});
// @ts-ignore
[getVitalStatus, webVitals,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-label" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-value" },
});
(__VLS_ctx.webVitals.LCP ? `${(__VLS_ctx.webVitals.LCP / 1000).toFixed(2)}s` : 'N/A');
// @ts-ignore
[webVitals, webVitals,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-description" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-target" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-card" },
    ...{ class: (__VLS_ctx.getVitalStatus('FID', __VLS_ctx.webVitals.FID)) },
});
// @ts-ignore
[getVitalStatus, webVitals,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-label" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-value" },
});
(__VLS_ctx.webVitals.FID ? `${__VLS_ctx.webVitals.FID.toFixed(0)}ms` : 'N/A');
// @ts-ignore
[webVitals, webVitals,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-description" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-target" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-card" },
    ...{ class: (__VLS_ctx.getVitalStatus('CLS', __VLS_ctx.webVitals.CLS)) },
});
// @ts-ignore
[getVitalStatus, webVitals,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-label" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-value" },
});
(__VLS_ctx.webVitals.CLS ? __VLS_ctx.webVitals.CLS.toFixed(3) : 'N/A');
// @ts-ignore
[webVitals, webVitals,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-description" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-target" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-card" },
    ...{ class: (__VLS_ctx.getVitalStatus('FCP', __VLS_ctx.webVitals.FCP)) },
});
// @ts-ignore
[getVitalStatus, webVitals,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-label" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-value" },
});
(__VLS_ctx.webVitals.FCP ? `${(__VLS_ctx.webVitals.FCP / 1000).toFixed(2)}s` : 'N/A');
// @ts-ignore
[webVitals, webVitals,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-description" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-target" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-card" },
    ...{ class: (__VLS_ctx.getVitalStatus('TTFB', __VLS_ctx.webVitals.TTFB)) },
});
// @ts-ignore
[getVitalStatus, webVitals,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-label" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-value" },
});
(__VLS_ctx.webVitals.TTFB ? `${__VLS_ctx.webVitals.TTFB.toFixed(0)}ms` : 'N/A');
// @ts-ignore
[webVitals, webVitals,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-description" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-target" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-card" },
    ...{ class: (__VLS_ctx.getVitalStatus('TTI', __VLS_ctx.webVitals.TTI)) },
});
// @ts-ignore
[getVitalStatus, webVitals,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-label" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-value" },
});
(__VLS_ctx.webVitals.TTI ? `${(__VLS_ctx.webVitals.TTI / 1000).toFixed(2)}s` : 'N/A');
// @ts-ignore
[webVitals, webVitals,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-description" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metric-target" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metrics-section" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metrics-table" },
});
if (__VLS_ctx.metrics.length > 0) {
    // @ts-ignore
    [metrics,];
    __VLS_asFunctionalElement(__VLS_elements.table, __VLS_elements.table)({});
    __VLS_asFunctionalElement(__VLS_elements.thead, __VLS_elements.thead)({});
    __VLS_asFunctionalElement(__VLS_elements.tr, __VLS_elements.tr)({});
    __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({});
    __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({});
    __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({});
    __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({});
    __VLS_asFunctionalElement(__VLS_elements.th, __VLS_elements.th)({});
    __VLS_asFunctionalElement(__VLS_elements.tbody, __VLS_elements.tbody)({});
    for (const [metric] of __VLS_getVForSourceType((__VLS_ctx.recentMetrics))) {
        // @ts-ignore
        [recentMetrics,];
        __VLS_asFunctionalElement(__VLS_elements.tr, __VLS_elements.tr)({
            key: (`${metric.name}-${metric.timestamp}`),
        });
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({});
        (metric.name);
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({});
        (__VLS_ctx.formatMetricValue(metric));
        // @ts-ignore
        [formatMetricValue,];
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({});
        (metric.unit);
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({});
        if (metric.tags) {
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                ...{ class: "tags" },
            });
            for (const [value, key] of __VLS_getVForSourceType((metric.tags))) {
                __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                    key: (key),
                    ...{ class: "tag" },
                });
                (key);
                (value);
            }
        }
        __VLS_asFunctionalElement(__VLS_elements.td, __VLS_elements.td)({});
        (__VLS_ctx.formatTimestamp(metric.timestamp));
        // @ts-ignore
        [formatTimestamp,];
    }
}
else {
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "empty-state" },
    });
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "metrics-section" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "resources-list" },
});
if (__VLS_ctx.slowResources.length > 0) {
    // @ts-ignore
    [slowResources,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    for (const [resource] of __VLS_getVForSourceType((__VLS_ctx.slowResources))) {
        // @ts-ignore
        [slowResources,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            key: (resource.name),
            ...{ class: "resource-item" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "resource-name" },
        });
        (__VLS_ctx.formatResourceName(resource.name));
        // @ts-ignore
        [formatResourceName,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "resource-meta" },
        });
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "resource-type" },
        });
        (resource.type);
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "resource-duration" },
        });
        (resource.duration.toFixed(0));
        if (resource.size) {
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                ...{ class: "resource-size" },
            });
            (__VLS_ctx.formatBytes(resource.size));
            // @ts-ignore
            [formatBytes,];
        }
    }
}
else {
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "empty-state" },
    });
}
/** @type {__VLS_StyleScopedClasses['performance-dashboard']} */ ;
/** @type {__VLS_StyleScopedClasses['dashboard-header']} */ ;
/** @type {__VLS_StyleScopedClasses['header-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['score-card']} */ ;
/** @type {__VLS_StyleScopedClasses['score-value']} */ ;
/** @type {__VLS_StyleScopedClasses['score-grade']} */ ;
/** @type {__VLS_StyleScopedClasses['score-label']} */ ;
/** @type {__VLS_StyleScopedClasses['metrics-section']} */ ;
/** @type {__VLS_StyleScopedClasses['metrics-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-card']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-label']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-value']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-description']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-target']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-card']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-label']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-value']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-description']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-target']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-card']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-label']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-value']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-description']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-target']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-card']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-label']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-value']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-description']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-target']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-card']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-label']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-value']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-description']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-target']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-card']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-label']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-value']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-description']} */ ;
/** @type {__VLS_StyleScopedClasses['metric-target']} */ ;
/** @type {__VLS_StyleScopedClasses['metrics-section']} */ ;
/** @type {__VLS_StyleScopedClasses['metrics-table']} */ ;
/** @type {__VLS_StyleScopedClasses['tags']} */ ;
/** @type {__VLS_StyleScopedClasses['tag']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
/** @type {__VLS_StyleScopedClasses['metrics-section']} */ ;
/** @type {__VLS_StyleScopedClasses['resources-list']} */ ;
/** @type {__VLS_StyleScopedClasses['resource-item']} */ ;
/** @type {__VLS_StyleScopedClasses['resource-name']} */ ;
/** @type {__VLS_StyleScopedClasses['resource-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['resource-type']} */ ;
/** @type {__VLS_StyleScopedClasses['resource-duration']} */ ;
/** @type {__VLS_StyleScopedClasses['resource-size']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-state']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        webVitals: webVitals,
        metrics: metrics,
        isRefreshing: isRefreshing,
        performanceScore: performanceScore,
        performanceGrade: performanceGrade,
        recentMetrics: recentMetrics,
        slowResources: slowResources,
        getVitalStatus: getVitalStatus,
        formatMetricValue: formatMetricValue,
        formatBytes: formatBytes,
        formatResourceName: formatResourceName,
        formatTimestamp: formatTimestamp,
        refresh: refresh,
        exportReport: exportReport,
    }),
});
export default (await import('vue')).defineComponent({});
; /* PartiallyEnd: #4569/main.vue */

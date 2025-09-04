import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Chart } from 'chart.js';
import { ChartBarIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon, MinusIcon } from '@heroicons/vue/24/outline';
// 註冊 Chart.js 組件
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);
const props = withDefaults(defineProps(), {
    title: '績效趨勢圖',
    width: 800,
    height: 400,
    isLoading: false
});
// 圖表狀態
const chartCanvas = ref(null);
const chartInstance = ref(null);
const chartType = ref('line');
const selectedMetric = ref('completion_rate');
const isFullscreen = ref(false);
// 計算圖表數據
const chartData = computed(() => {
    if (!props.data || props.data.length === 0)
        return null;
    const labels = props.data.map(item => {
        const date = new Date(item.date);
        return date.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });
    });
    const values = props.data.map(item => {
        switch (selectedMetric.value) {
            case 'completion_rate':
                return item.completion_rate;
            case 'avg_prep_time':
                return Math.round(item.avg_prep_time || 0);
            case 'revenue':
                return item.revenue;
            case 'total_orders':
                return item.total_orders;
            default:
                return 0;
        }
    });
    return {
        labels,
        datasets: [{
                label: getMetricLabel(selectedMetric.value),
                data: values,
                borderColor: getMetricColor(selectedMetric.value),
                backgroundColor: chartType.value === 'area'
                    ? getMetricColor(selectedMetric.value, 0.2)
                    : getMetricColor(selectedMetric.value, 0.8),
                borderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: chartType.value === 'area',
                tension: 0.4
            }]
    };
});
// 計算平均值
const averageValue = computed(() => {
    if (!props.data || props.data.length === 0)
        return null;
    const values = props.data.map(item => {
        switch (selectedMetric.value) {
            case 'completion_rate':
                return item.completion_rate;
            case 'avg_prep_time':
                return item.avg_prep_time || 0;
            case 'revenue':
                return item.revenue;
            case 'total_orders':
                return item.total_orders;
            default:
                return 0;
        }
    });
    return values.reduce((sum, val) => sum + val, 0) / values.length;
});
// 計算趨勢方向
const trendDirection = computed(() => {
    if (!props.data || props.data.length < 3)
        return null;
    const recent = props.data.slice(0, Math.ceil(props.data.length / 2));
    const earlier = props.data.slice(Math.floor(props.data.length / 2));
    const recentAvg = recent.reduce((sum, item) => {
        switch (selectedMetric.value) {
            case 'completion_rate':
                return sum + item.completion_rate;
            case 'avg_prep_time':
                return sum + (item.avg_prep_time || 0);
            case 'revenue':
                return sum + item.revenue;
            case 'total_orders':
                return sum + item.total_orders;
            default:
                return sum;
        }
    }, 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, item) => {
        switch (selectedMetric.value) {
            case 'completion_rate':
                return sum + item.completion_rate;
            case 'avg_prep_time':
                return sum + (item.avg_prep_time || 0);
            case 'revenue':
                return sum + item.revenue;
            case 'total_orders':
                return sum + item.total_orders;
            default:
                return sum;
        }
    }, 0) / earlier.length;
    const difference = recentAvg - earlierAvg;
    const threshold = earlierAvg * 0.05; // 5% threshold
    if (Math.abs(difference) < threshold)
        return 'stable';
    return difference > 0 ? 'up' : 'down';
});
// 圖表配置
const chartOptions = computed(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
        intersect: false,
        mode: 'index',
    },
    plugins: {
        legend: {
            display: false
        },
        tooltip: {
            callbacks: {
                label: (context) => {
                    const label = context.dataset.label || '';
                    const value = formatValue(context.parsed.y, selectedMetric.value);
                    return `${label}: ${value}`;
                }
            }
        }
    },
    scales: {
        x: {
            grid: {
                display: true,
                color: 'rgba(0, 0, 0, 0.05)'
            }
        },
        y: {
            beginAtZero: selectedMetric.value !== 'revenue',
            grid: {
                display: true,
                color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
                callback: (value) => formatValue(value, selectedMetric.value)
            }
        }
    },
    elements: {
        point: {
            hoverBackgroundColor: getMetricColor(selectedMetric.value)
        }
    }
}));
// 創建或更新圖表
const createChart = () => {
    if (!chartCanvas.value || !chartData.value)
        return;
    if (chartInstance.value) {
        chartInstance.value.destroy();
    }
    const ctx = chartCanvas.value.getContext('2d');
    if (!ctx)
        return;
    chartInstance.value = new Chart(ctx, {
        type: chartType.value === 'area' ? 'line' : chartType.value,
        data: chartData.value,
        options: chartOptions.value
    });
};
// 更新圖表
const updateChart = () => {
    if (!chartInstance.value || !chartData.value)
        return;
    chartInstance.value.data = chartData.value;
    chartInstance.value.options = chartOptions.value;
    chartInstance.value.update('resize');
};
// 輔助函數
const getMetricLabel = (metric) => {
    const labels = {
        completion_rate: '完成率 (%)',
        avg_prep_time: '平均時間 (分鐘)',
        revenue: '營收 (RM)',
        total_orders: '訂單數量'
    };
    return labels[metric] || metric;
};
const getMetricColor = (metric, alpha = 1) => {
    const colors = {
        completion_rate: `rgba(34, 197, 94, ${alpha})`, // green
        avg_prep_time: `rgba(59, 130, 246, ${alpha})`, // blue  
        revenue: `rgba(168, 85, 247, ${alpha})`, // purple
        total_orders: `rgba(245, 158, 11, ${alpha})` // amber
    };
    return colors[metric] || `rgba(107, 114, 128, ${alpha})`;
};
const formatValue = (value, metric) => {
    switch (metric) {
        case 'completion_rate':
            return `${value.toFixed(1)}%`;
        case 'avg_prep_time':
            return `${Math.round(value)}分鐘`;
        case 'revenue':
            return `RM${value.toFixed(2)}`;
        case 'total_orders':
            return `${value}筆`;
        default:
            return value.toString();
    }
};
const getTrendText = (direction) => {
    const texts = {
        up: '上升',
        down: '下降',
        stable: '穩定'
    };
    return texts[direction] || direction;
};
const toggleFullscreen = () => {
    isFullscreen.value = !isFullscreen.value;
    // 實際的全屏邏輯需要額外實現
};
const exportChart = () => {
    if (!chartInstance.value)
        return;
    const url = chartInstance.value.toBase64Image();
    const link = document.createElement('a');
    link.download = `performance-trend-${selectedMetric.value}-${new Date().toISOString().split('T')[0]}.png`;
    link.href = url;
    link.click();
};
// 監聽數據變化
watch(() => props.data, () => {
    nextTick(() => {
        if (chartInstance.value) {
            updateChart();
        }
        else {
            createChart();
        }
    });
});
watch(chartType, () => {
    nextTick(createChart);
});
watch(selectedMetric, () => {
    nextTick(() => {
        if (chartInstance.value) {
            updateChart();
        }
        else {
            createChart();
        }
    });
});
// 生命週期
onMounted(() => {
    nextTick(createChart);
});
onUnmounted(() => {
    if (chartInstance.value) {
        chartInstance.value.destroy();
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    title: '績效趨勢圖',
    width: 800,
    height: 400,
    isLoading: false
});
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['chart-container']} */ 
/** @type {__VLS_StyleScopedClasses['chart-container']} */ 
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "performance-trend-chart" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center justify-between mb-4" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
    ...{ class: "text-lg font-semibold text-gray-900" },
});
(__VLS_ctx.title);
// @ts-ignore
[title,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-2" },
});
__VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
    value: (__VLS_ctx.chartType),
    ...{ class: "text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" },
});
// @ts-ignore
[chartType,];
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "line",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "bar",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "area",
});
__VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
    value: (__VLS_ctx.selectedMetric),
    ...{ class: "text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" },
});
// @ts-ignore
[selectedMetric,];
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "completion_rate",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "avg_prep_time",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "revenue",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "total_orders",
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "chart-container" },
    ...{ class: ({ 'loading': __VLS_ctx.isLoading }) },
});
// @ts-ignore
[isLoading,];
__VLS_asFunctionalElement(__VLS_elements.canvas, __VLS_elements.canvas)({
    ref: "chartCanvas",
    width: (__VLS_ctx.width),
    height: (__VLS_ctx.height),
    ...{ class: "max-w-full" },
});
/** @type {typeof __VLS_ctx.chartCanvas} */ 
// @ts-ignore
[width, height, chartCanvas,];
if (__VLS_ctx.isLoading) {
    // @ts-ignore
    [isLoading,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "absolute inset-0 flex items-center justify-center bg-white bg-opacity-75" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center space-x-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "text-sm text-gray-600" },
    });
}
if (!__VLS_ctx.isLoading && (!__VLS_ctx.data || __VLS_ctx.data.length === 0)) {
    // @ts-ignore
    [isLoading, data, data,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "absolute inset-0 flex items-center justify-center" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-center" },
    });
    const __VLS_0 = {}.ChartBarIcon;
    /** @type {[typeof __VLS_components.ChartBarIcon, ]} */ 
    // @ts-ignore
    ChartBarIcon;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        ...{ class: "mx-auto h-12 w-12 text-gray-400 mb-2" },
    }));
    const __VLS_2 = __VLS_1({
        ...{ class: "mx-auto h-12 w-12 text-gray-400 mb-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-gray-500" },
    });
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "mt-4 flex items-center justify-between text-sm text-gray-600" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-4" },
});
if (__VLS_ctx.averageValue !== null) {
    // @ts-ignore
    [averageValue,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "w-3 h-3 bg-blue-500 rounded-full mr-1" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    (__VLS_ctx.formatValue(__VLS_ctx.averageValue, __VLS_ctx.selectedMetric));
    // @ts-ignore
    [selectedMetric, averageValue, formatValue,];
}
if (__VLS_ctx.trendDirection) {
    // @ts-ignore
    [trendDirection,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center" },
    });
    if (__VLS_ctx.trendDirection === 'up') {
        // @ts-ignore
        [trendDirection,];
        const __VLS_5 = {}.ArrowTrendingUpIcon;
        /** @type {[typeof __VLS_components.ArrowTrendingUpIcon, ]} */ 
        // @ts-ignore
        ArrowTrendingUpIcon;
        // @ts-ignore
        const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
            ...{ class: "w-4 h-4 text-green-500 mr-1" },
        }));
        const __VLS_7 = __VLS_6({
            ...{ class: "w-4 h-4 text-green-500 mr-1" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    }
    if (__VLS_ctx.trendDirection === 'down') {
        // @ts-ignore
        [trendDirection,];
        const __VLS_10 = {}.ArrowTrendingDownIcon;
        /** @type {[typeof __VLS_components.ArrowTrendingDownIcon, ]} */ 
        // @ts-ignore
        ArrowTrendingDownIcon;
        // @ts-ignore
        const __VLS_11 = __VLS_asFunctionalComponent(__VLS_10, new __VLS_10({
            ...{ class: "w-4 h-4 text-red-500 mr-1" },
        }));
        const __VLS_12 = __VLS_11({
            ...{ class: "w-4 h-4 text-red-500 mr-1" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_11));
    }
    if (__VLS_ctx.trendDirection === 'stable') {
        // @ts-ignore
        [trendDirection,];
        const __VLS_15 = {}.MinusIcon;
        /** @type {[typeof __VLS_components.MinusIcon, ]} */ 
        // @ts-ignore
        MinusIcon;
        // @ts-ignore
        const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({
            ...{ class: "w-4 h-4 text-gray-500 mr-1" },
        }));
        const __VLS_17 = __VLS_16({
            ...{ class: "w-4 h-4 text-gray-500 mr-1" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_16));
    }
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    (__VLS_ctx.getTrendText(__VLS_ctx.trendDirection));
    // @ts-ignore
    [trendDirection, getTrendText,];
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-2" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.toggleFullscreen) },
    ...{ class: "text-blue-600 hover:text-blue-800 underline" },
});
// @ts-ignore
[toggleFullscreen,];
(__VLS_ctx.isFullscreen ? '退出全屏' : '全屏顯示');
// @ts-ignore
[isFullscreen,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.exportChart) },
    ...{ class: "text-green-600 hover:text-green-800 underline" },
});
// @ts-ignore
[exportChart,];
/** @type {__VLS_StyleScopedClasses['performance-trend-chart']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['mb-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['border']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-300']} */ 
/** @type {__VLS_StyleScopedClasses['rounded']} */ 
/** @type {__VLS_StyleScopedClasses['px-2']} */ 
/** @type {__VLS_StyleScopedClasses['py-1']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['border']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-300']} */ 
/** @type {__VLS_StyleScopedClasses['rounded']} */ 
/** @type {__VLS_StyleScopedClasses['px-2']} */ 
/** @type {__VLS_StyleScopedClasses['py-1']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['chart-container']} */ 
/** @type {__VLS_StyleScopedClasses['loading']} */ 
/** @type {__VLS_StyleScopedClasses['max-w-full']} */ 
/** @type {__VLS_StyleScopedClasses['absolute']} */ 
/** @type {__VLS_StyleScopedClasses['inset-0']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['bg-opacity-75']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ 
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['h-6']} */ 
/** @type {__VLS_StyleScopedClasses['w-6']} */ 
/** @type {__VLS_StyleScopedClasses['border-b-2']} */ 
/** @type {__VLS_StyleScopedClasses['border-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['absolute']} */ 
/** @type {__VLS_StyleScopedClasses['inset-0']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['text-center']} */ 
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ 
/** @type {__VLS_StyleScopedClasses['h-12']} */ 
/** @type {__VLS_StyleScopedClasses['w-12']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ 
/** @type {__VLS_StyleScopedClasses['mb-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['mt-4']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-4']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['w-3']} */ 
/** @type {__VLS_StyleScopedClasses['h-3']} */ 
/** @type {__VLS_StyleScopedClasses['bg-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['mr-1']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-green-500']} */ 
/** @type {__VLS_StyleScopedClasses['mr-1']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-red-500']} */ 
/** @type {__VLS_StyleScopedClasses['mr-1']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['mr-1']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-blue-600']} */ 
/** @type {__VLS_StyleScopedClasses['hover:text-blue-800']} */ 
/** @type {__VLS_StyleScopedClasses['underline']} */ 
/** @type {__VLS_StyleScopedClasses['text-green-600']} */ 
/** @type {__VLS_StyleScopedClasses['hover:text-green-800']} */ 
/** @type {__VLS_StyleScopedClasses['underline']} */ 
let __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        ChartBarIcon: ChartBarIcon,
        ArrowTrendingUpIcon: ArrowTrendingUpIcon,
        ArrowTrendingDownIcon: ArrowTrendingDownIcon,
        MinusIcon: MinusIcon,
        chartCanvas: chartCanvas,
        chartType: chartType,
        selectedMetric: selectedMetric,
        isFullscreen: isFullscreen,
        averageValue: averageValue,
        trendDirection: trendDirection,
        formatValue: formatValue,
        getTrendText: getTrendText,
        toggleFullscreen: toggleFullscreen,
        exportChart: exportChart,
    }),
    __typeProps: {},
    props: {},
});
export default (await import('vue')).defineComponent({
    __typeProps: {},
    props: {},
});
 /* PartiallyEnd: #4569/main.vue */

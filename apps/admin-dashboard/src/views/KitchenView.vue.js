import { ref, computed, onMounted, onUnmounted } from 'vue';
// import VirtualOrderGrid from '../../../kitchen-display/src/components/VirtualOrderGrid.vue'
import { ArrowPathIcon, ClockIcon, PlayIcon, CheckCircleIcon, ExclamationTriangleIcon, ExclamationCircleIcon, ChartBarIcon, SpeakerWaveIcon } from '@heroicons/vue/24/outline';
// 響應式數據
const currentTime = ref('');
const isAutoRefresh = ref(true);
const notificationSound = ref(null);
const soundEnabled = ref(true);
const isLoadingOrders = ref(false);
const hasMoreOrders = ref(false);
const currentOrderPage = ref(1);
const orderPageSize = ref(30);
let timeInterval = null;
let refreshInterval = null;
// 廚房績效數據
const kitchenStats = ref({
    avgCompletionTime: 18,
    efficiencyScore: 87,
    onTimeRate: 92,
    todayCompleted: 45,
    preparationSpeed: 85,
    qualityScore: 94,
    workload: 68
});
// 模擬廚房訂單數據
const orders = ref([
    {
        id: 1,
        orderNumber: 'ORD-001',
        tableNumber: 'T01',
        status: 'pending',
        priority: 'normal',
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        estimatedReadyTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        items: [
            {
                id: 1,
                menuItemName: '招牌炒飯',
                quantity: 2,
                specialInstructions: '不要蔥',
                customizations: { '辣度': '中辣', '配菜': '加蛋' }
            },
            {
                id: 2,
                menuItemName: '冰奶茶',
                quantity: 1,
                specialInstructions: '',
                customizations: { '甜度': '半糖', '冰量': '正常冰' }
            }
        ]
    },
    {
        id: 2,
        orderNumber: 'ORD-002',
        tableNumber: 'T03',
        status: 'preparing',
        priority: 'high',
        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        estimatedReadyTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        items: [
            {
                id: 3,
                menuItemName: '春卷',
                quantity: 1,
                specialInstructions: '要蘸醬',
                customizations: {}
            }
        ]
    },
    {
        id: 3,
        orderNumber: 'ORD-003',
        tableNumber: 'T05',
        status: 'ready',
        priority: 'normal',
        createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        estimatedReadyTime: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        items: [
            {
                id: 4,
                menuItemName: '南洋咖啡',
                quantity: 2,
                specialInstructions: '',
                customizations: { '甜度': '正常', '濃度': '濃' }
            }
        ]
    }
]);
// 計算屬性
const pendingOrders = computed(() => orders.value.filter(o => ['pending', 'confirmed', 'preparing'].includes(o.status)));
const kitchenOrders = computed(() => {
    return orders.value
        .filter(o => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status))
        .sort((a, b) => {
        // 優先級排序
        if (a.priority === 'high' && b.priority !== 'high')
            return -1;
        if (b.priority === 'high' && a.priority !== 'high')
            return 1;
        // 時間排序
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
});
const orderStats = computed(() => ({
    pending: orders.value.filter(o => o.status === 'pending').length,
    preparing: orders.value.filter(o => ['confirmed', 'preparing'].includes(o.status)).length,
    ready: orders.value.filter(o => o.status === 'ready').length,
    served: orders.value.filter(o => o.status === 'served').length
}));
// 績效計算屬性
const avgCompletionTime = computed(() => kitchenStats.value.avgCompletionTime);
const efficiencyScore = computed(() => kitchenStats.value.efficiencyScore);
const onTimeRate = computed(() => kitchenStats.value.onTimeRate);
const todayCompleted = computed(() => kitchenStats.value.todayCompleted);
const preparationSpeed = computed(() => kitchenStats.value.preparationSpeed);
const qualityScore = computed(() => kitchenStats.value.qualityScore);
const workload = computed(() => kitchenStats.value.workload);
// 方法
const updateCurrentTime = () => {
    currentTime.value = new Date().toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};
const refreshOrders = async () => {
    isLoadingOrders.value = true;
    try {
        // 模擬API調用
        console.log('Refreshing kitchen orders...');
        // 在實際應用中，這裡會調用 API 獲取最新訂單
        // Reset pagination
        currentOrderPage.value = 1;
        hasMoreOrders.value = orders.value.length >= orderPageSize.value;
    }
    finally {
        isLoadingOrders.value = false;
    }
};
/*
const loadMoreKitchenOrders = async () => {
  if (isLoadingOrders.value || !hasMoreOrders.value) return
  
  isLoadingOrders.value = true
  try {
    currentOrderPage.value++
    
    // 模擬載入更多訂單
    console.log(`Loading more kitchen orders - page ${currentOrderPage.value}`)
    
    // 模擬新增一些訂單
    const newOrders = Array.from({ length: 5 }, (_, i) => ({
      id: orders.value.length + i + 1,
      orderNumber: `ORD-${String(orders.value.length + i + 1).padStart(3, '0')}`,
      tableNumber: `T${String((orders.value.length + i) % 10 + 1).padStart(2, '0')}`,
      status: ['pending', 'confirmed', 'preparing', 'ready'][Math.floor(Math.random() * 4)],
      priority: Math.random() > 0.7 ? 'high' : 'normal',
      createdAt: new Date(Date.now() - Math.random() * 30 * 60 * 1000).toISOString(),
      estimatedReadyTime: new Date(Date.now() + Math.random() * 20 * 60 * 1000).toISOString(),
      items: [{
        id: orders.value.length + i + 1,
        menuItemName: ['招牌炒飯', '冰奶茶', '春卷', '南洋咖啡'][Math.floor(Math.random() * 4)],
        quantity: Math.floor(Math.random() * 3) + 1,
        specialInstructions: Math.random() > 0.5 ? '不要蔥' : '',
        customizations: Math.random() > 0.5 ? { '辣度': '中辣' } : {}
      }]
    }))
    
    orders.value.push(...newOrders)
    
    // Check if there are more items to load
    hasMoreOrders.value = newOrders.length >= 5
  } finally {
    isLoadingOrders.value = false
  }
}
*/
/*
const onLoadMoreOrders = () => {
  console.log('Kitchen orders load more event triggered')
}
*/
const getOrderCardClass = (order) => {
    const baseClass = 'bg-white';
    const statusClasses = {
        'pending': 'border-yellow-400',
        'confirmed': 'border-blue-400',
        'preparing': 'border-orange-400',
        'ready': 'border-green-400'
    };
    const priorityClass = order.priority === 'high' ? 'ring-2 ring-red-300' : '';
    return `${baseClass} ${statusClasses[order.status] || 'border-gray-400'} ${priorityClass}`;
};
const getStatusIcon = (status) => {
    const icons = {
        'pending': ClockIcon,
        'confirmed': PlayIcon,
        'preparing': PlayIcon,
        'ready': CheckCircleIcon
    };
    return icons[status] || ClockIcon;
};
const getStatusIconClass = (status) => {
    const classes = {
        'pending': 'bg-yellow-100 text-yellow-600',
        'confirmed': 'bg-blue-100 text-blue-600',
        'preparing': 'bg-orange-100 text-orange-600',
        'ready': 'bg-green-100 text-green-600'
    };
    return classes[status] || 'bg-gray-100 text-gray-600';
};
const getPriorityBadgeClass = (priority) => {
    return priority === 'high'
        ? 'bg-red-100 text-red-800'
        : 'bg-gray-100 text-gray-600';
};
const getPriorityText = (priority) => {
    return priority === 'high' ? '緊急' : '普通';
};
const getTimeElapsed = (createdAt) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffInMinutes = Math.floor((now.getTime() - created.getTime()) / (1000 * 60));
    if (diffInMinutes < 1)
        return '剛下單';
    if (diffInMinutes < 60)
        return `${diffInMinutes} 分鐘前`;
    const hours = Math.floor(diffInMinutes / 60);
    return `${hours} 小時前`;
};
const formatTime = (dateTime) => {
    return new Date(dateTime).toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit'
    });
};
const confirmOrder = async (order) => {
    const index = orders.value.findIndex(o => o.id === order.id);
    if (index > -1) {
        orders.value[index].status = 'confirmed';
        playNotificationSound();
    }
};
const startCooking = async (order) => {
    const index = orders.value.findIndex(o => o.id === order.id);
    if (index > -1) {
        orders.value[index].status = 'preparing';
        // 設置預計完成時間（例如：15分鐘後）
        orders.value[index].estimatedReadyTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    }
};
const markReady = async (order) => {
    const index = orders.value.findIndex(o => o.id === order.id);
    if (index > -1) {
        orders.value[index].status = 'ready';
        playNotificationSound();
    }
};
const markServed = async (order) => {
    const index = orders.value.findIndex(o => o.id === order.id);
    if (index > -1) {
        orders.value[index].status = 'served';
    }
};
const togglePriority = (order) => {
    const index = orders.value.findIndex(o => o.id === order.id);
    if (index > -1) {
        orders.value[index].priority = orders.value[index].priority === 'high' ? 'normal' : 'high';
    }
};
const playNotificationSound = () => {
    if (!soundEnabled.value)
        return;
    try {
        notificationSound.value?.play();
    }
    catch (error) {
        console.log('Could not play notification sound:', error);
    }
};
const getEfficiencyColor = (score) => {
    if (score >= 90)
        return 'text-green-600';
    if (score >= 80)
        return 'text-yellow-600';
    return 'text-red-600';
};
// 計算預計完成時間（基於歷史數據和當前負載）
const calculateEstimatedTime = (order) => {
    const baseTime = 15; // 基礎時間15分鐘
    const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const complexityFactor = itemCount * 2; // 每個菜品增加2分鐘
    const loadFactor = Math.max(0, (workload.value - 50) * 0.2); // 高負載時增加時間
    return Math.round(baseTime + complexityFactor + loadFactor);
};
// 更新廚房統計數據
const updateKitchenStats = () => {
    // 模擬統計數據更新
    const completedToday = orders.value.filter(o => o.status === 'served').length;
    // const totalProcessed = completedToday + orderStats.value.preparing + orderStats.value.ready
    kitchenStats.value = {
        ...kitchenStats.value,
        todayCompleted: completedToday,
        workload: Math.min(100, (orderStats.value.preparing / 8) * 100), // 假設最大並發8單
        onTimeRate: Math.max(80, 100 - (orderStats.value.pending * 2)) // 待處理越多，準時率越低
    };
};
const toggleSound = () => {
    soundEnabled.value = !soundEnabled.value;
};
// 生命周期
onMounted(() => {
    updateCurrentTime();
    timeInterval = setInterval(updateCurrentTime, 1000);
    // 設置自動刷新
    refreshInterval = setInterval(() => {
        if (isAutoRefresh.value) {
            refreshOrders();
            updateKitchenStats();
        }
    }, 10000); // 每10秒刷新一次
    // 初始化統計數據
    updateKitchenStats();
});
onUnmounted(() => {
    if (timeInterval)
        clearInterval(timeInterval);
    if (refreshInterval)
        clearInterval(refreshInterval);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['kitchen-view']} */ 
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "kitchen-view" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex justify-between items-center mb-8" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.h1, __VLS_elements.h1)({
    ...{ class: "text-3xl font-bold text-gray-900" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-gray-600" },
});
(__VLS_ctx.currentTime);
(__VLS_ctx.pendingOrders.length);
// @ts-ignore
[currentTime, pendingOrders,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-4" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.refreshOrders) },
    disabled: (__VLS_ctx.isAutoRefresh),
    ...{ class: "flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50" },
});
// @ts-ignore
[refreshOrders, isAutoRefresh,];
const __VLS_0 = {}.ArrowPathIcon;
/** @type {[typeof __VLS_components.ArrowPathIcon, ]} */ 
// @ts-ignore
ArrowPathIcon;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: (['h-4 w-4 mr-2', __VLS_ctx.isAutoRefresh && 'animate-spin']) },
}));
const __VLS_2 = __VLS_1({
    ...{ class: (['h-4 w-4 mr-2', __VLS_ctx.isAutoRefresh && 'animate-spin']) },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
// @ts-ignore
[isAutoRefresh,];
(__VLS_ctx.isAutoRefresh ? '自動刷新中' : '手動刷新');
// @ts-ignore
[isAutoRefresh,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.toggleSound) },
    ...{ class: ([
            'flex items-center px-4 py-2 rounded-lg transition-colors',
            __VLS_ctx.soundEnabled ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
        ]) },
});
// @ts-ignore
[toggleSound, soundEnabled,];
const __VLS_5 = {}.SpeakerWaveIcon;
/** @type {[typeof __VLS_components.SpeakerWaveIcon, ]} */ 
// @ts-ignore
SpeakerWaveIcon;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
    ...{ class: "h-4 w-4 mr-2" },
}));
const __VLS_7 = __VLS_6({
    ...{ class: "h-4 w-4 mr-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
(__VLS_ctx.soundEnabled ? '音效開啟' : '音效關閉');
// @ts-ignore
[soundEnabled,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center" },
});
__VLS_asFunctionalElement(__VLS_elements.input)({
    id: "auto-refresh",
    type: "checkbox",
    ...{ class: "rounded border-gray-300 text-blue-600 focus:ring-blue-500" },
});
(__VLS_ctx.isAutoRefresh);
// @ts-ignore
[isAutoRefresh,];
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    for: "auto-refresh",
    ...{ class: "ml-2 text-sm text-gray-700" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-yellow-100 rounded-lg p-6 border-l-4 border-yellow-500" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center" },
});
const __VLS_10 = {}.ClockIcon;
/** @type {[typeof __VLS_components.ClockIcon, ]} */ 
// @ts-ignore
ClockIcon;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent(__VLS_10, new __VLS_10({
    ...{ class: "h-8 w-8 text-yellow-600 mr-3" },
}));
const __VLS_12 = __VLS_11({
    ...{ class: "h-8 w-8 text-yellow-600 mr-3" },
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm font-medium text-yellow-800" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-2xl font-bold text-yellow-900" },
});
(__VLS_ctx.orderStats.pending);
// @ts-ignore
[orderStats,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-blue-100 rounded-lg p-6 border-l-4 border-blue-500" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center" },
});
const __VLS_15 = {}.PlayIcon;
/** @type {[typeof __VLS_components.PlayIcon, ]} */ 
// @ts-ignore
PlayIcon;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({
    ...{ class: "h-8 w-8 text-blue-600 mr-3" },
}));
const __VLS_17 = __VLS_16({
    ...{ class: "h-8 w-8 text-blue-600 mr-3" },
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm font-medium text-blue-800" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-2xl font-bold text-blue-900" },
});
(__VLS_ctx.orderStats.preparing);
// @ts-ignore
[orderStats,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-green-100 rounded-lg p-6 border-l-4 border-green-500" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center" },
});
const __VLS_20 = {}.CheckCircleIcon;
/** @type {[typeof __VLS_components.CheckCircleIcon, ]} */ 
// @ts-ignore
CheckCircleIcon;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    ...{ class: "h-8 w-8 text-green-600 mr-3" },
}));
const __VLS_22 = __VLS_21({
    ...{ class: "h-8 w-8 text-green-600 mr-3" },
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm font-medium text-green-800" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-2xl font-bold text-green-900" },
});
(__VLS_ctx.orderStats.ready);
// @ts-ignore
[orderStats,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-purple-100 rounded-lg p-6 border-l-4 border-purple-500" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center" },
});
const __VLS_25 = {}.ChartBarIcon;
/** @type {[typeof __VLS_components.ChartBarIcon, ]} */ 
// @ts-ignore
ChartBarIcon;
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent(__VLS_25, new __VLS_25({
    ...{ class: "h-8 w-8 text-purple-600 mr-3" },
}));
const __VLS_27 = __VLS_26({
    ...{ class: "h-8 w-8 text-purple-600 mr-3" },
}, ...__VLS_functionalComponentArgsRest(__VLS_26));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm font-medium text-purple-800" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-2xl font-bold text-purple-900" },
});
(__VLS_ctx.avgCompletionTime);
// @ts-ignore
[avgCompletionTime,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-white rounded-lg shadow p-6 mb-8" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center justify-between mb-4" },
});
__VLS_asFunctionalElement(__VLS_elements.h2, __VLS_elements.h2)({
    ...{ class: "text-xl font-semibold text-gray-900" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-4" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-center" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm text-gray-600" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-lg font-bold" },
    ...{ class: (__VLS_ctx.getEfficiencyColor(__VLS_ctx.efficiencyScore)) },
});
// @ts-ignore
[getEfficiencyColor, efficiencyScore,];
(__VLS_ctx.efficiencyScore);
// @ts-ignore
[efficiencyScore,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-center" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm text-gray-600" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-lg font-bold" },
    ...{ class: (__VLS_ctx.getEfficiencyColor(__VLS_ctx.onTimeRate)) },
});
// @ts-ignore
[getEfficiencyColor, onTimeRate,];
(__VLS_ctx.onTimeRate);
// @ts-ignore
[onTimeRate,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-center" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm text-gray-600" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-lg font-bold text-green-600" },
});
(__VLS_ctx.todayCompleted);
// @ts-ignore
[todayCompleted,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "grid grid-cols-1 md:grid-cols-3 gap-4" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex justify-between text-sm mb-1" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "text-gray-600" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "font-medium" },
});
(__VLS_ctx.preparationSpeed);
// @ts-ignore
[preparationSpeed,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "w-full bg-gray-200 rounded-full h-2" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-blue-500 h-2 rounded-full transition-all duration-300" },
    ...{ style: ({ width: `${__VLS_ctx.preparationSpeed}%` }) },
});
// @ts-ignore
[preparationSpeed,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex justify-between text-sm mb-1" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "text-gray-600" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "font-medium" },
});
(__VLS_ctx.qualityScore);
// @ts-ignore
[qualityScore,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "w-full bg-gray-200 rounded-full h-2" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-green-500 h-2 rounded-full transition-all duration-300" },
    ...{ style: ({ width: `${__VLS_ctx.qualityScore}%` }) },
});
// @ts-ignore
[qualityScore,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex justify-between text-sm mb-1" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "text-gray-600" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "font-medium" },
});
(__VLS_ctx.workload);
// @ts-ignore
[workload,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "w-full bg-gray-200 rounded-full h-2" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "h-2 rounded-full transition-all duration-300" },
    ...{ class: (__VLS_ctx.workload > 80 ? 'bg-red-500' : __VLS_ctx.workload > 60 ? 'bg-yellow-500' : 'bg-green-500') },
    ...{ style: ({ width: `${__VLS_ctx.workload}%` }) },
});
// @ts-ignore
[workload, workload, workload,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" },
});
for (const [order] of __VLS_getVForSourceType((__VLS_ctx.kitchenOrders))) {
    // @ts-ignore
    [kitchenOrders,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        key: (order.id),
        ...{ class: (__VLS_ctx.getOrderCardClass(order)) },
        ...{ class: "rounded-lg shadow-lg p-6 border-l-4 transition-all duration-300 h-full" },
    });
    // @ts-ignore
    [getOrderCardClass,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center justify-between mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: (__VLS_ctx.getStatusIconClass(order.status)) },
        ...{ class: "p-2 rounded-full mr-3" },
    });
    // @ts-ignore
    [getStatusIconClass,];
    const __VLS_30 = ((__VLS_ctx.getStatusIcon(order.status)));
    // @ts-ignore
    const __VLS_31 = __VLS_asFunctionalComponent(__VLS_30, new __VLS_30({
        ...{ class: "h-6 w-6" },
    }));
    const __VLS_32 = __VLS_31({
        ...{ class: "h-6 w-6" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_31));
    // @ts-ignore
    [getStatusIcon,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
        ...{ class: "text-lg font-bold text-gray-900" },
    });
    (order.orderNumber);
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-sm text-gray-600" },
    });
    (order.tableNumber || 'N/A');
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-right" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: (__VLS_ctx.getPriorityBadgeClass(order.priority)) },
        ...{ class: "px-3 py-1 rounded-full text-xs font-medium" },
    });
    // @ts-ignore
    [getPriorityBadgeClass,];
    (__VLS_ctx.getPriorityText(order.priority));
    // @ts-ignore
    [getPriorityText,];
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-xs text-gray-500 mt-1" },
    });
    (__VLS_ctx.getTimeElapsed(order.createdAt));
    // @ts-ignore
    [getTimeElapsed,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "space-y-3 mb-4" },
    });
    for (const [item] of __VLS_getVForSourceType((order.items))) {
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            key: (item.id),
            ...{ class: "flex items-center justify-between bg-gray-50 rounded-lg p-3" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "flex items-center" },
        });
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full font-semibold text-sm mr-3" },
        });
        (item.quantity);
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
        __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
            ...{ class: "font-medium text-gray-900" },
        });
        (item.menuItemName);
        if (item.specialInstructions) {
            __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
                ...{ class: "text-sm text-orange-600 mt-1" },
            });
            const __VLS_35 = {}.ExclamationTriangleIcon;
            /** @type {[typeof __VLS_components.ExclamationTriangleIcon, ]} */ 
            // @ts-ignore
            ExclamationTriangleIcon;
            // @ts-ignore
            const __VLS_36 = __VLS_asFunctionalComponent(__VLS_35, new __VLS_35({
                ...{ class: "w-4 h-4 inline mr-1" },
            }));
            const __VLS_37 = __VLS_36({
                ...{ class: "w-4 h-4 inline mr-1" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_36));
            (item.specialInstructions);
        }
        if (item.customizations && Object.keys(item.customizations).length > 0) {
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "mt-1" },
            });
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "flex flex-wrap gap-1" },
            });
            for (const [value, key] of __VLS_getVForSourceType((item.customizations))) {
                __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                    key: (key),
                    ...{ class: "inline-block px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full" },
                });
                (key);
                (value);
            }
        }
    }
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex space-x-2" },
    });
    if (order.status === 'pending') {
        __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(order.status === 'pending'))
                        return;
                    __VLS_ctx.confirmOrder(order);
                    // @ts-ignore
                    [confirmOrder,];
                } },
            ...{ class: "flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium" },
        });
    }
    else if (order.status === 'confirmed') {
        __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
            ...{ onClick: (...[$event]) => {
                    if (order.status === 'pending')
                        return;
                    if (!(order.status === 'confirmed'))
                        return;
                    __VLS_ctx.startCooking(order);
                    // @ts-ignore
                    [startCooking,];
                } },
            ...{ class: "flex-1 bg-yellow-600 text-white py-2 px-4 rounded-lg hover:bg-yellow-700 transition-colors font-medium" },
        });
    }
    else if (order.status === 'preparing') {
        __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
            ...{ onClick: (...[$event]) => {
                    if (order.status === 'pending')
                        return;
                    if (order.status === 'confirmed')
                        return;
                    if (!(order.status === 'preparing'))
                        return;
                    __VLS_ctx.markReady(order);
                    // @ts-ignore
                    [markReady,];
                } },
            ...{ class: "flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium" },
        });
    }
    else if (order.status === 'ready') {
        __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
            ...{ onClick: (...[$event]) => {
                    if (order.status === 'pending')
                        return;
                    if (order.status === 'confirmed')
                        return;
                    if (order.status === 'preparing')
                        return;
                    if (!(order.status === 'ready'))
                        return;
                    __VLS_ctx.markServed(order);
                    // @ts-ignore
                    [markServed,];
                } },
            ...{ class: "flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors font-medium" },
        });
    }
    if (['pending', 'confirmed', 'preparing'].includes(order.status)) {
        __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(['pending', 'confirmed', 'preparing'].includes(order.status)))
                        return;
                    __VLS_ctx.togglePriority(order);
                    // @ts-ignore
                    [togglePriority,];
                } },
            ...{ class: (order.priority === 'high' ? 'bg-red-100 text-red-800 hover:bg-red-200' : 'bg-gray-100 text-gray-800 hover:bg-gray-200') },
            ...{ class: "px-3 py-2 rounded-lg transition-colors" },
        });
        const __VLS_40 = {}.ExclamationCircleIcon;
        /** @type {[typeof __VLS_components.ExclamationCircleIcon, ]} */ 
        // @ts-ignore
        ExclamationCircleIcon;
        // @ts-ignore
        const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
            ...{ class: "w-5 h-5" },
        }));
        const __VLS_42 = __VLS_41({
            ...{ class: "w-5 h-5" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    }
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "mt-4 pt-4 border-t border-gray-200" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center justify-between text-sm mb-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center" },
    });
    const __VLS_45 = {}.ClockIcon;
    /** @type {[typeof __VLS_components.ClockIcon, ]} */ 
    // @ts-ignore
    ClockIcon;
    // @ts-ignore
    const __VLS_46 = __VLS_asFunctionalComponent(__VLS_45, new __VLS_45({
        ...{ class: "w-4 h-4 text-gray-500 mr-2" },
    }));
    const __VLS_47 = __VLS_46({
        ...{ class: "w-4 h-4 text-gray-500 mr-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_46));
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "text-gray-600" },
    });
    (__VLS_ctx.calculateEstimatedTime(order));
    // @ts-ignore
    [calculateEstimatedTime,];
    if (order.status === 'preparing') {
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "flex items-center" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "w-20 bg-gray-200 rounded-full h-1 mr-2" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "bg-blue-500 h-1 rounded-full transition-all duration-300" },
            ...{ style: ({ width: `${Math.min(100, (__VLS_ctx.getTimeElapsed(order.createdAt).includes('分鐘前') ? parseInt(__VLS_ctx.getTimeElapsed(order.createdAt)) : 0) / __VLS_ctx.calculateEstimatedTime(order) * 100)}%` }) },
        });
        // @ts-ignore
        [getTimeElapsed, getTimeElapsed, calculateEstimatedTime,];
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "text-xs text-gray-500" },
        });
        (Math.min(100, Math.round((__VLS_ctx.getTimeElapsed(order.createdAt).includes('分鐘前') ? parseInt(__VLS_ctx.getTimeElapsed(order.createdAt)) : 0) / __VLS_ctx.calculateEstimatedTime(order) * 100)));
        // @ts-ignore
        [getTimeElapsed, getTimeElapsed, calculateEstimatedTime,];
    }
    if (order.estimatedReadyTime) {
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "flex items-center text-xs text-gray-500" },
        });
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
        (__VLS_ctx.formatTime(order.estimatedReadyTime));
        // @ts-ignore
        [formatTime,];
    }
}
if (__VLS_ctx.kitchenOrders.length === 0) {
    // @ts-ignore
    [kitchenOrders,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-center py-12" },
    });
    const __VLS_50 = {}.CheckCircleIcon;
    /** @type {[typeof __VLS_components.CheckCircleIcon, ]} */ 
    // @ts-ignore
    CheckCircleIcon;
    // @ts-ignore
    const __VLS_51 = __VLS_asFunctionalComponent(__VLS_50, new __VLS_50({
        ...{ class: "mx-auto h-16 w-16 text-gray-400 mb-4" },
    }));
    const __VLS_52 = __VLS_51({
        ...{ class: "mx-auto h-16 w-16 text-gray-400 mb-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_51));
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
        ...{ class: "text-xl font-medium text-gray-900 mb-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-gray-500" },
    });
}
__VLS_asFunctionalElement(__VLS_elements.audio, __VLS_elements.audio)({
    ref: "notificationSound",
    preload: "auto",
});
/** @type {typeof __VLS_ctx.notificationSound} */ 
// @ts-ignore
[notificationSound,];
__VLS_asFunctionalElement(__VLS_elements.source)({
    src: "/notification.mp3",
    type: "audio/mpeg",
});
/** @type {__VLS_StyleScopedClasses['kitchen-view']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['mb-8']} */ 
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-4']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['bg-blue-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-blue-700']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['mr-2']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['mr-2']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['rounded']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-300']} */ 
/** @type {__VLS_StyleScopedClasses['text-blue-600']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['ml-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ 
/** @type {__VLS_StyleScopedClasses['grid']} */ 
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ 
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ 
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-4']} */ 
/** @type {__VLS_StyleScopedClasses['gap-6']} */ 
/** @type {__VLS_StyleScopedClasses['mb-8']} */ 
/** @type {__VLS_StyleScopedClasses['bg-yellow-100']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['p-6']} */ 
/** @type {__VLS_StyleScopedClasses['border-l-4']} */ 
/** @type {__VLS_StyleScopedClasses['border-yellow-500']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['h-8']} */ 
/** @type {__VLS_StyleScopedClasses['w-8']} */ 
/** @type {__VLS_StyleScopedClasses['text-yellow-600']} */ 
/** @type {__VLS_StyleScopedClasses['mr-3']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-yellow-800']} */ 
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-yellow-900']} */ 
/** @type {__VLS_StyleScopedClasses['bg-blue-100']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['p-6']} */ 
/** @type {__VLS_StyleScopedClasses['border-l-4']} */ 
/** @type {__VLS_StyleScopedClasses['border-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['h-8']} */ 
/** @type {__VLS_StyleScopedClasses['w-8']} */ 
/** @type {__VLS_StyleScopedClasses['text-blue-600']} */ 
/** @type {__VLS_StyleScopedClasses['mr-3']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-blue-800']} */ 
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-blue-900']} */ 
/** @type {__VLS_StyleScopedClasses['bg-green-100']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['p-6']} */ 
/** @type {__VLS_StyleScopedClasses['border-l-4']} */ 
/** @type {__VLS_StyleScopedClasses['border-green-500']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['h-8']} */ 
/** @type {__VLS_StyleScopedClasses['w-8']} */ 
/** @type {__VLS_StyleScopedClasses['text-green-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-3']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-green-800']} */ 
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-green-900']} */ 
/** @type {__VLS_StyleScopedClasses['bg-purple-100']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['p-6']} */ 
/** @type {__VLS_StyleScopedClasses['border-l-4']} */ 
/** @type {__VLS_StyleScopedClasses['border-purple-500']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['h-8']} */ 
/** @type {__VLS_StyleScopedClasses['w-8']} */ 
/** @type {__VLS_StyleScopedClasses['text-purple-600']} */ 
/** @type {__VLS_StyleScopedClasses['mr-3']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-purple-800']} */ 
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-purple-900']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['shadow']} */ 
/** @type {__VLS_StyleScopedClasses['p-6']} */ 
/** @type {__VLS_StyleScopedClasses['mb-8']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['mb-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-xl']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-center']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-center']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-center']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-green-600']} */ 
/** @type {__VLS_StyleScopedClasses['grid']} */ 
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ 
/** @type {__VLS_StyleScopedClasses['md:grid-cols-3']} */ 
/** @type {__VLS_StyleScopedClasses['gap-4']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['mb-1']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['w-full']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['h-2']} */ 
/** @type {__VLS_StyleScopedClasses['bg-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['h-2']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['transition-all']} */ 
/** @type {__VLS_StyleScopedClasses['duration-300']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['mb-1']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['w-full']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['h-2']} */ 
/** @type {__VLS_StyleScopedClasses['bg-green-500']} */ 
/** @type {__VLS_StyleScopedClasses['h-2']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['transition-all']} */ 
/** @type {__VLS_StyleScopedClasses['duration-300']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['mb-1']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['w-full']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['h-2']} */ 
/** @type {__VLS_StyleScopedClasses['h-2']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['transition-all']} */ 
/** @type {__VLS_StyleScopedClasses['duration-300']} */ 
/** @type {__VLS_StyleScopedClasses['grid']} */ 
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ 
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ 
/** @type {__VLS_StyleScopedClasses['xl:grid-cols-3']} */ 
/** @type {__VLS_StyleScopedClasses['gap-6']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ 
/** @type {__VLS_StyleScopedClasses['p-6']} */ 
/** @type {__VLS_StyleScopedClasses['border-l-4']} */ 
/** @type {__VLS_StyleScopedClasses['transition-all']} */ 
/** @type {__VLS_StyleScopedClasses['duration-300']} */ 
/** @type {__VLS_StyleScopedClasses['h-full']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['mb-4']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['p-2']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['mr-3']} */ 
/** @type {__VLS_StyleScopedClasses['h-6']} */ 
/** @type {__VLS_StyleScopedClasses['w-6']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-right']} */ 
/** @type {__VLS_StyleScopedClasses['px-3']} */ 
/** @type {__VLS_StyleScopedClasses['py-1']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['mt-1']} */ 
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ 
/** @type {__VLS_StyleScopedClasses['mb-4']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['p-3']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['w-8']} */ 
/** @type {__VLS_StyleScopedClasses['h-8']} */ 
/** @type {__VLS_StyleScopedClasses['bg-blue-100']} */ 
/** @type {__VLS_StyleScopedClasses['text-blue-800']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['mr-3']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-orange-600']} */ 
/** @type {__VLS_StyleScopedClasses['mt-1']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['inline']} */ 
/** @type {__VLS_StyleScopedClasses['mr-1']} */ 
/** @type {__VLS_StyleScopedClasses['mt-1']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ 
/** @type {__VLS_StyleScopedClasses['gap-1']} */ 
/** @type {__VLS_StyleScopedClasses['inline-block']} */ 
/** @type {__VLS_StyleScopedClasses['px-2']} */ 
/** @type {__VLS_StyleScopedClasses['py-1']} */ 
/** @type {__VLS_StyleScopedClasses['bg-yellow-100']} */ 
/** @type {__VLS_StyleScopedClasses['text-yellow-800']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ 
/** @type {__VLS_StyleScopedClasses['flex-1']} */ 
/** @type {__VLS_StyleScopedClasses['bg-blue-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-blue-700']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['flex-1']} */ 
/** @type {__VLS_StyleScopedClasses['bg-yellow-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-yellow-700']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['flex-1']} */ 
/** @type {__VLS_StyleScopedClasses['bg-green-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-green-700']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['flex-1']} */ 
/** @type {__VLS_StyleScopedClasses['bg-purple-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-purple-700']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['px-3']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['w-5']} */ 
/** @type {__VLS_StyleScopedClasses['h-5']} */ 
/** @type {__VLS_StyleScopedClasses['mt-4']} */ 
/** @type {__VLS_StyleScopedClasses['pt-4']} */ 
/** @type {__VLS_StyleScopedClasses['border-t']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['mb-2']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['mr-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['w-20']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['h-1']} */ 
/** @type {__VLS_StyleScopedClasses['mr-2']} */ 
/** @type {__VLS_StyleScopedClasses['bg-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['h-1']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['transition-all']} */ 
/** @type {__VLS_StyleScopedClasses['duration-300']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['text-center']} */ 
/** @type {__VLS_StyleScopedClasses['py-12']} */ 
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ 
/** @type {__VLS_StyleScopedClasses['h-16']} */ 
/** @type {__VLS_StyleScopedClasses['w-16']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ 
/** @type {__VLS_StyleScopedClasses['mb-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-xl']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['mb-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
let __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        ArrowPathIcon: ArrowPathIcon,
        ClockIcon: ClockIcon,
        PlayIcon: PlayIcon,
        CheckCircleIcon: CheckCircleIcon,
        ExclamationTriangleIcon: ExclamationTriangleIcon,
        ExclamationCircleIcon: ExclamationCircleIcon,
        ChartBarIcon: ChartBarIcon,
        SpeakerWaveIcon: SpeakerWaveIcon,
        currentTime: currentTime,
        isAutoRefresh: isAutoRefresh,
        notificationSound: notificationSound,
        soundEnabled: soundEnabled,
        pendingOrders: pendingOrders,
        kitchenOrders: kitchenOrders,
        orderStats: orderStats,
        avgCompletionTime: avgCompletionTime,
        efficiencyScore: efficiencyScore,
        onTimeRate: onTimeRate,
        todayCompleted: todayCompleted,
        preparationSpeed: preparationSpeed,
        qualityScore: qualityScore,
        workload: workload,
        refreshOrders: refreshOrders,
        getOrderCardClass: getOrderCardClass,
        getStatusIcon: getStatusIcon,
        getStatusIconClass: getStatusIconClass,
        getPriorityBadgeClass: getPriorityBadgeClass,
        getPriorityText: getPriorityText,
        getTimeElapsed: getTimeElapsed,
        formatTime: formatTime,
        confirmOrder: confirmOrder,
        startCooking: startCooking,
        markReady: markReady,
        markServed: markServed,
        togglePriority: togglePriority,
        getEfficiencyColor: getEfficiencyColor,
        calculateEstimatedTime: calculateEstimatedTime,
        toggleSound: toggleSound,
    }),
});
export default (await import('vue')).defineComponent({});
 /* PartiallyEnd: #4569/main.vue */

import { ref, computed, onMounted } from "vue";
import { UsersIcon, ClockIcon, BuildingStorefrontIcon, ChartBarIcon, ExclamationTriangleIcon, ArrowPathIcon, StarIcon, PlusIcon, SparklesIcon, BellIcon, XMarkIcon, } from "@heroicons/vue/24/outline";
import DocumentChartBarIcon from "@heroicons/vue/24/outline/DocumentChartBarIcon";
import { queueService } from "@/services/queueService";
import { useRealtimeQueue } from "@/composables/useRealtimeQueue";
import { useAuthStore } from "@/stores/auth";
// 響應式狀態
const authStore = useAuthStore();
const {} = useRealtimeQueue();
const queueFilter = ref("");
const tableViewFilter = ref("all");
const selectedQueueItem = ref(null);
const selectedTable = ref(null);
const showAddDialog = ref(false);
const showSeatDialog = ref(false);
const autoAssignment = ref(true);
// 數據狀態
const queueItems = ref([]);
const loading = ref(false);
const error = ref(null);
const queueStatus = ref(null);
// 統計數據 - 從新 API 和即時數據計算
const currentWaiting = computed(() => {
    return queueStatus.value?.queue?.total_waiting || 0;
});
const avgWaitTime = computed(() => {
    return queueStatus.value?.queue?.avg_estimated_wait || 0;
});
const availableTables = ref(12); // 暫時保留，等待桌位 API 整合
const occupiedTables = ref(8);
const todayServed = computed(() => {
    return queueStatus.value?.activity?.seated_today || 0;
});
const overdueQueue = computed(() => {
    // 計算超過預期等待時間的候位
    return queueItems.value.filter(item => {
        if (item.status !== 'waiting')
            return false;
        const waitTime = getWaitTime(item.joinedAt);
        return waitTime > (item.estimatedWaitMinutes + 10); // 超過預估時間10分鐘
    }).length;
});
// 表單數據 - 適配新 API 結構
const newQueueItem = ref({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    partySize: 2,
    tablePreferences: [],
    specialRequests: "",
    queueType: 'walkin',
    notificationMethods: ['sms'],
    isVIP: false,
});
const seatAssignment = ref({
    tableId: "",
    notes: "",
});
// 排隊數據現在從 API 獲取
// queueItems 在響應式狀態部分已定義
// 模擬桌位數據
const tables = ref([
    {
        id: "table_001",
        number: "T01",
        capacity: 2,
        status: "available",
        occupiedSince: null,
        cleaningStatus: "clean",
    },
    {
        id: "table_002",
        number: "T02",
        capacity: 2,
        status: "occupied",
        occupiedSince: new Date(Date.now() - 2700000).toISOString(),
        cleaningStatus: "clean",
    },
    {
        id: "table_003",
        number: "T03",
        capacity: 4,
        status: "available",
        occupiedSince: null,
        cleaningStatus: "clean",
    },
    {
        id: "table_004",
        number: "T04",
        capacity: 4,
        status: "cleaning",
        occupiedSince: null,
        cleaningStatus: "cleaning",
    },
    {
        id: "table_005",
        number: "T05",
        capacity: 6,
        status: "available",
        occupiedSince: null,
        cleaningStatus: "clean",
    },
    {
        id: "table_006",
        number: "T06",
        capacity: 6,
        status: "occupied",
        occupiedSince: new Date(Date.now() - 3600000).toISOString(),
        cleaningStatus: "clean",
    },
    {
        id: "table_007",
        number: "T07",
        capacity: 8,
        status: "available",
        occupiedSince: null,
        cleaningStatus: "clean",
    },
    {
        id: "table_008",
        number: "T08",
        capacity: 8,
        status: "reserved",
        occupiedSince: null,
        cleaningStatus: "clean",
    },
]);
// 計算屬性
const filteredQueue = computed(() => {
    let filtered = [...queueItems.value];
    if (queueFilter.value) {
        filtered = filtered.filter((item) => item.status === queueFilter.value);
    }
    return filtered.sort((a, b) => {
        // 優先級排序，然後按加入時間
        if (a.priority !== b.priority) {
            return b.priority - a.priority;
        }
        return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
    });
});
const filteredTables = computed(() => {
    if (tableViewFilter.value === "all") {
        return tables.value;
    }
    const statusMap = {
        available: ["available"],
        occupied: ["occupied", "reserved"],
    };
    return tables.value.filter((table) => statusMap[tableViewFilter.value]?.includes(table.status));
});
const recommendedTables = computed(() => {
    if (!selectedQueueItem.value)
        return [];
    const availableTables = tables.value.filter((table) => table.status === "available");
    const partySize = selectedQueueItem.value.partySize;
    return availableTables
        .map((table) => {
        let score = 100;
        // 容量匹配度
        if (table.capacity === partySize) {
            score += 20;
        }
        else if (table.capacity === partySize + 1) {
            score += 10;
        }
        else if (table.capacity < partySize) {
            score -= 50;
        }
        else if (table.capacity > partySize + 2) {
            score -= 10;
        }
        // 偏好匹配（簡化處理）
        if (selectedQueueItem.value?.tablePreferences?.length) {
            if (table.number.includes("1") || table.number.includes("2")) {
                // 假設靠窗
                if (selectedQueueItem.value.tablePreferences.includes(1))
                    score += 15; // 1 = window preference
            }
        }
        return { ...table, matchScore: Math.max(0, Math.min(100, score)) };
    })
        .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
        .slice(0, 4);
});
const canAddToQueue = computed(() => {
    return newQueueItem.value.customerName &&
        (newQueueItem.value.customerPhone || newQueueItem.value.customerEmail) &&
        newQueueItem.value.partySize > 0;
});
// 工具方法
const formatTime = (dateTime) => new Date(dateTime).toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
});
const getWaitTime = (joinedAt) => {
    const now = new Date();
    const joined = new Date(joinedAt);
    return Math.floor((now.getTime() - joined.getTime()) / (1000 * 60));
};
const getOccupiedTime = (occupiedSince) => {
    const now = new Date();
    const occupied = new Date(occupiedSince);
    return Math.floor((now.getTime() - occupied.getTime()) / (1000 * 60));
};
const calculateEstimatedWait = (queueIndex) => {
    return (queueIndex + 1) * avgWaitTime.value;
};
// 狀態樣式方法
const getQueueNumberColor = (status) => {
    const colors = {
        waiting: "bg-blue-100 text-blue-800",
        called: "bg-yellow-100 text-yellow-800",
        notified: "bg-purple-100 text-purple-800",
        seated: "bg-green-100 text-green-800",
        no_show: "bg-red-100 text-red-800",
        cancelled: "bg-gray-100 text-gray-800",
        expired: "bg-orange-100 text-orange-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
};
const getStatusText = (status) => {
    const texts = {
        waiting: "候位中",
        called: "已叫號",
        notified: "已通知",
        seated: "已入座",
        no_show: "未到場",
        cancelled: "已取消",
        expired: "已過期",
    };
    return texts[status] || status;
};
const getStatusClass = (status) => {
    const classes = {
        waiting: "bg-blue-100 text-blue-800",
        called: "bg-yellow-100 text-yellow-800",
        notified: "bg-purple-100 text-purple-800",
        seated: "bg-green-100 text-green-800",
        no_show: "bg-red-100 text-red-800",
        cancelled: "bg-gray-100 text-gray-800",
        expired: "bg-orange-100 text-orange-800",
    };
    return classes[status] || "bg-gray-100 text-gray-800";
};
const getTableStatusColor = (status) => {
    const colors = {
        available: "border-green-200 bg-green-50",
        occupied: "border-red-200 bg-red-50",
        reserved: "border-yellow-200 bg-yellow-50",
        cleaning: "border-orange-200 bg-orange-50",
    };
    return colors[status] || "border-gray-200 bg-gray-50";
};
const getTableStatusTextColor = (status) => {
    const colors = {
        available: "bg-green-100 text-green-800",
        occupied: "bg-red-100 text-red-800",
        reserved: "bg-yellow-100 text-yellow-800",
        cleaning: "bg-orange-100 text-orange-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
};
const getTableStatusText = (status) => {
    const texts = {
        available: "可用",
        occupied: "使用中",
        reserved: "已預約",
        cleaning: "清潔中",
    };
    return texts[status] || status;
};
// 操作方法
const selectQueueItem = (item) => {
    selectedQueueItem.value = item;
};
const selectTable = (table) => {
    selectedTable.value = table;
};
const toggleTableView = (filter) => {
    tableViewFilter.value = filter;
};
// API 方法 - 使用新模組化服務
const refreshQueue = async () => {
    if (!authStore.user?.restaurantId)
        return;
    loading.value = true;
    error.value = null;
    try {
        const [queueData, statusData] = await Promise.all([
            queueService.getQueue(authStore.user.restaurantId),
            queueService.getQueueStatus(authStore.user.restaurantId)
        ]);
        queueItems.value = queueData;
        queueStatus.value = statusData;
    }
    catch (err) {
        error.value = '獲取候位數據失敗';
        console.error('Failed to refresh queue:', err);
    }
    finally {
        loading.value = false;
    }
};
const callNextCustomer = async () => {
    if (!authStore.user?.restaurantId)
        return;
    try {
        const result = await queueService.callNext(authStore.user.restaurantId, {});
        if (result.success && result.data) {
            // 更新本地數據
            const index = queueItems.value.findIndex(item => item.id === result.data.id);
            if (index !== -1) {
                queueItems.value[index] = result.data;
            }
            alert(`已呼叫 ${result.data.customerName || `排號 ${result.data.queueNumber}`}`);
        }
        else {
            alert(result.error || '呼叫失敗');
        }
    }
    catch (err) {
        alert('呼叫操作失敗，請重試');
        console.error('Failed to call next customer:', err);
    }
};
const callCustomer = async (queueItem) => {
    if (!authStore.user?.restaurantId)
        return;
    try {
        const result = await queueService.callNext(authStore.user.restaurantId, {
            specificQueueId: queueItem.id
        });
        if (result.success && result.data) {
            // 更新本地數據
            const index = queueItems.value.findIndex(item => item.id === queueItem.id);
            if (index !== -1) {
                queueItems.value[index] = result.data;
            }
            alert(`已呼叫 ${queueItem.customerName || `排號 ${queueItem.queueNumber}`}`);
        }
        else {
            alert(result.error || '呼叫失敗');
        }
    }
    catch (error) {
        alert("呼叫失敗，請重試");
        console.error('Failed to call customer:', error);
    }
};
const seatCustomer = (queueItem) => {
    selectedQueueItem.value = queueItem;
    showSeatDialog.value = true;
    seatAssignment.value = { tableId: "", notes: "" };
};
const addToQueue = () => {
    showAddDialog.value = true;
    newQueueItem.value = {
        customerName: "",
        customerPhone: "",
        customerEmail: "",
        partySize: 2,
        tablePreferences: [],
        specialRequests: "",
        queueType: 'walkin',
        notificationMethods: ['sms'],
        isVIP: false,
    };
};
const closeAddDialog = () => {
    showAddDialog.value = false;
};
const submitAddToQueue = async () => {
    if (!canAddToQueue.value || !authStore.user?.restaurantId)
        return;
    loading.value = true;
    try {
        const joinData = {
            restaurantId: authStore.user.restaurantId,
            customerName: newQueueItem.value.customerName,
            customerPhone: newQueueItem.value.customerPhone,
            customerEmail: newQueueItem.value.customerEmail,
            partySize: newQueueItem.value.partySize,
            specialRequests: newQueueItem.value.specialRequests || undefined,
            queueType: newQueueItem.value.queueType,
            tablePreferences: newQueueItem.value.tablePreferences,
            notificationMethods: newQueueItem.value.notificationMethods,
        };
        const result = await queueService.joinQueue(joinData);
        if (result.success && result.data) {
            closeAddDialog();
            alert(`已加入排隊！排號: ${result.data.queueNumber}，預估等待 ${result.data.estimatedWaitMinutes} 分鐘`);
            // 刷新隊列數據
            await refreshQueue();
        }
        else {
            alert(result.error || '加入排隊失敗');
        }
    }
    catch (error) {
        alert("加入排隊失敗，請重試");
        console.error('Failed to add to queue:', error);
    }
    finally {
        loading.value = false;
    }
};
const closeSeatDialog = () => {
    showSeatDialog.value = false;
    selectedQueueItem.value = null;
};
const confirmSeatAssignment = async () => {
    if (!selectedQueueItem.value || !seatAssignment.value.tableId)
        return;
    try {
        const result = await queueService.seatCustomer(selectedQueueItem.value.id, {
            tableId: Number(seatAssignment.value.tableId)
        });
        if (result.success) {
            // 更新本地數據
            const index = queueItems.value.findIndex(item => item.id === selectedQueueItem.value.id);
            if (index !== -1) {
                queueItems.value[index].status = "seated";
                queueItems.value[index].seatedAt = new Date().toISOString();
                queueItems.value[index].assignedTableId = Number(seatAssignment.value.tableId);
            }
            // 更新桌位狀態 (等待桌位 API 整合)
            const table = tables.value.find(t => t.id === seatAssignment.value.tableId.toString());
            if (table) {
                table.status = "occupied";
                table.occupiedSince = new Date().toISOString();
            }
            closeSeatDialog();
            alert("座位安排完成！");
        }
        else {
            alert(result.error || '座位安排失敗');
        }
    }
    catch (error) {
        alert("座位安排失敗，請重試");
        console.error('Failed to seat customer:', error);
    }
};
const editQueueItem = (queueItem) => {
    console.log("Edit queue item:", queueItem.id);
    alert("編輯功能開發中...");
};
const cleanTable = async (table) => {
    try {
        table.status = "cleaning";
        table.cleaningStatus = "cleaning";
        table.occupiedSince = null;
        // 模擬清潔時間
        setTimeout(() => {
            table.status = "available";
            table.cleaningStatus = "clean";
            alert(`桌號 ${table.number} 清潔完成，可接受新顧客`);
        }, 3000);
        alert(`開始清潔桌號 ${table.number}`);
    }
    catch (error) {
        alert("清潔操作失敗");
    }
};
const sendNotification = () => {
    alert("批量通知功能開發中...");
};
const generateReport = () => {
    alert("統計報表功能開發中...");
};
const toggleAutoAssignment = () => {
    console.log("Auto assignment:", autoAssignment.value);
    if (autoAssignment.value) {
        alert("已開啟智慧分配功能");
    }
    else {
        alert("已關閉智慧分配功能");
    }
};
const openQueueSettings = () => {
    alert("排隊設定功能開發中...");
};
const openDisplaySettings = () => {
    alert("顯示設定功能開發中...");
};
// 監聽即時更新
// watch(queueUpdates, () => {
//   // 當有新的即時更新時，刷新隊列數據
//   refreshQueue();
// }, { deep: true });
// 生命週期
onMounted(async () => {
    // 初始化加載數據
    await refreshQueue();
    // 初始化時選擇第一個排隊項目
    if (queueItems.value.length > 0) {
        selectedQueueItem.value = queueItems.value[0];
    }
    // 自動刷新數據
    setInterval(async () => {
        if (!loading.value) {
            await refreshQueue();
        }
    }, 30000); // 每30秒更新一次
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['queue-view']} */ ;
/** @type {__VLS_StyleScopedClasses['queue-view']} */ ;
/** @type {__VLS_StyleScopedClasses['queue-view']} */ ;
/** @type {__VLS_StyleScopedClasses['queue-view']} */ ;
/** @type {__VLS_StyleScopedClasses['queue-view']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "queue-view" },
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
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-4" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-green-100 px-4 py-2 rounded-lg" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm text-green-800 font-medium" },
});
(__VLS_ctx.currentWaiting);
// @ts-ignore
[currentWaiting,];
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-xs text-green-600" },
});
(__VLS_ctx.avgWaitTime);
// @ts-ignore
[avgWaitTime,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.openQueueSettings) },
    ...{ class: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors" },
});
// @ts-ignore
[openQueueSettings,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.openDisplaySettings) },
    ...{ class: "px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors" },
});
// @ts-ignore
[openDisplaySettings,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.callNextCustomer) },
    ...{ class: "px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors" },
});
// @ts-ignore
[callNextCustomer,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "grid grid-cols-1 md:grid-cols-5 gap-6 mb-8" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-white rounded-lg shadow p-6" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "p-3 rounded-full bg-blue-100" },
});
const __VLS_0 = {}.UsersIcon;
/** @type {[typeof __VLS_components.UsersIcon, ]} */ ;
// @ts-ignore
UsersIcon;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: "h-6 w-6 text-blue-600" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "h-6 w-6 text-blue-600" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "ml-4" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm font-medium text-gray-500" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-2xl font-semibold text-gray-900" },
});
(__VLS_ctx.currentWaiting);
// @ts-ignore
[currentWaiting,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-white rounded-lg shadow p-6" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "p-3 rounded-full bg-green-100" },
});
const __VLS_5 = {}.ClockIcon;
/** @type {[typeof __VLS_components.ClockIcon, ]} */ ;
// @ts-ignore
ClockIcon;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
    ...{ class: "h-6 w-6 text-green-600" },
}));
const __VLS_7 = __VLS_6({
    ...{ class: "h-6 w-6 text-green-600" },
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "ml-4" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm font-medium text-gray-500" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-2xl font-semibold text-gray-900" },
});
(__VLS_ctx.avgWaitTime);
// @ts-ignore
[avgWaitTime,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-white rounded-lg shadow p-6" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "p-3 rounded-full bg-purple-100" },
});
const __VLS_10 = {}.BuildingStorefrontIcon;
/** @type {[typeof __VLS_components.BuildingStorefrontIcon, ]} */ ;
// @ts-ignore
BuildingStorefrontIcon;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent(__VLS_10, new __VLS_10({
    ...{ class: "h-6 w-6 text-purple-600" },
}));
const __VLS_12 = __VLS_11({
    ...{ class: "h-6 w-6 text-purple-600" },
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "ml-4" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm font-medium text-gray-500" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-2xl font-semibold text-gray-900" },
});
(__VLS_ctx.availableTables);
// @ts-ignore
[availableTables,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-white rounded-lg shadow p-6" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "p-3 rounded-full bg-orange-100" },
});
const __VLS_15 = {}.ChartBarIcon;
/** @type {[typeof __VLS_components.ChartBarIcon, ]} */ ;
// @ts-ignore
ChartBarIcon;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({
    ...{ class: "h-6 w-6 text-orange-600" },
}));
const __VLS_17 = __VLS_16({
    ...{ class: "h-6 w-6 text-orange-600" },
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "ml-4" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm font-medium text-gray-500" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-2xl font-semibold text-gray-900" },
});
(__VLS_ctx.todayServed);
// @ts-ignore
[todayServed,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-white rounded-lg shadow p-6" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "p-3 rounded-full bg-red-100" },
});
const __VLS_20 = {}.ExclamationTriangleIcon;
/** @type {[typeof __VLS_components.ExclamationTriangleIcon, ]} */ ;
// @ts-ignore
ExclamationTriangleIcon;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    ...{ class: "h-6 w-6 text-red-600" },
}));
const __VLS_22 = __VLS_21({
    ...{ class: "h-6 w-6 text-red-600" },
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "ml-4" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm font-medium text-gray-500" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-2xl font-semibold text-gray-900" },
});
(__VLS_ctx.overdueQueue);
// @ts-ignore
[overdueQueue,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "grid grid-cols-1 lg:grid-cols-4 gap-8" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "lg:col-span-2" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-white rounded-lg shadow" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "p-6 border-b border-gray-200" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center justify-between" },
});
__VLS_asFunctionalElement(__VLS_elements.h2, __VLS_elements.h2)({
    ...{ class: "text-xl font-semibold text-gray-900" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-4" },
});
__VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
    value: (__VLS_ctx.queueFilter),
    ...{ class: "px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" },
});
// @ts-ignore
[queueFilter,];
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "waiting",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "called",
});
__VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
    value: "no_show",
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.refreshQueue) },
    ...{ class: "p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors" },
});
// @ts-ignore
[refreshQueue,];
const __VLS_25 = {}.ArrowPathIcon;
/** @type {[typeof __VLS_components.ArrowPathIcon, ]} */ ;
// @ts-ignore
ArrowPathIcon;
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent(__VLS_25, new __VLS_25({
    ...{ class: "h-5 w-5" },
}));
const __VLS_27 = __VLS_26({
    ...{ class: "h-5 w-5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_26));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "divide-y divide-gray-200" },
});
for (const [queueItem, index] of __VLS_getVForSourceType((__VLS_ctx.filteredQueue))) {
    // @ts-ignore
    [filteredQueue,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.selectQueueItem(queueItem);
                // @ts-ignore
                [selectQueueItem,];
            } },
        key: (queueItem.id),
        ...{ class: ([
                'p-4 cursor-pointer hover:bg-gray-50 transition-colors',
                queueItem.status === 'called' ? 'bg-yellow-50' : '',
                queueItem.status === 'no_show' ? 'bg-red-50' : '',
            ]) },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center justify-between" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex-shrink-0" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: ([
                'w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg',
                __VLS_ctx.getQueueNumberColor(queueItem.status),
            ]) },
    });
    // @ts-ignore
    [getQueueNumberColor,];
    (queueItem.queueNumber);
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "ml-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
        ...{ class: "text-lg font-medium text-gray-900" },
    });
    (queueItem.customerName ||
        `顧客 ${queueItem.queueNumber}`);
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: (__VLS_ctx.getStatusClass(queueItem.status)) },
        ...{ class: "ml-2 px-2 py-1 text-xs font-medium rounded-full" },
    });
    // @ts-ignore
    [getStatusClass,];
    (__VLS_ctx.getStatusText(queueItem.status));
    // @ts-ignore
    [getStatusText,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center mt-1 text-sm text-gray-500" },
    });
    const __VLS_30 = {}.UsersIcon;
    /** @type {[typeof __VLS_components.UsersIcon, ]} */ ;
    // @ts-ignore
    UsersIcon;
    // @ts-ignore
    const __VLS_31 = __VLS_asFunctionalComponent(__VLS_30, new __VLS_30({
        ...{ class: "w-4 h-4 mr-1" },
    }));
    const __VLS_32 = __VLS_31({
        ...{ class: "w-4 h-4 mr-1" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_31));
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    (queueItem.partySize);
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "mx-2" },
    });
    const __VLS_35 = {}.ClockIcon;
    /** @type {[typeof __VLS_components.ClockIcon, ]} */ ;
    // @ts-ignore
    ClockIcon;
    // @ts-ignore
    const __VLS_36 = __VLS_asFunctionalComponent(__VLS_35, new __VLS_35({
        ...{ class: "w-4 h-4 mr-1" },
    }));
    const __VLS_37 = __VLS_36({
        ...{ class: "w-4 h-4 mr-1" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_36));
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    (__VLS_ctx.getWaitTime(queueItem.joinedAt));
    // @ts-ignore
    [getWaitTime,];
    if (queueItem.tablePreferences?.length) {
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "mx-2" },
        });
    }
    if (queueItem.tablePreferences?.length) {
        const __VLS_40 = {}.BuildingStorefrontIcon;
        /** @type {[typeof __VLS_components.BuildingStorefrontIcon, ]} */ ;
        // @ts-ignore
        BuildingStorefrontIcon;
        // @ts-ignore
        const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
            ...{ class: "w-4 h-4 mr-1" },
        }));
        const __VLS_42 = __VLS_41({
            ...{ class: "w-4 h-4 mr-1" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    }
    if (queueItem.tablePreferences?.length) {
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
        (queueItem.tablePreferences.join(', '));
    }
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center space-x-2" },
    });
    if (queueItem.priority > 0) {
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "flex items-center" },
        });
        const __VLS_45 = {}.StarIcon;
        /** @type {[typeof __VLS_components.StarIcon, ]} */ ;
        // @ts-ignore
        StarIcon;
        // @ts-ignore
        const __VLS_46 = __VLS_asFunctionalComponent(__VLS_45, new __VLS_45({
            ...{ class: "w-4 h-4 text-yellow-500" },
        }));
        const __VLS_47 = __VLS_46({
            ...{ class: "w-4 h-4 text-yellow-500" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_46));
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "text-xs text-yellow-600 ml-1" },
        });
    }
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-right" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-sm font-medium text-gray-900" },
    });
    (__VLS_ctx.calculateEstimatedWait(index));
    // @ts-ignore
    [calculateEstimatedWait,];
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-xs text-gray-500" },
    });
    (__VLS_ctx.formatTime(queueItem.joinedAt));
    // @ts-ignore
    [formatTime,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex flex-col space-y-1" },
    });
    if (queueItem.status === 'waiting') {
        __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(queueItem.status === 'waiting'))
                        return;
                    __VLS_ctx.callCustomer(queueItem);
                    // @ts-ignore
                    [callCustomer,];
                } },
            ...{ class: "px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors" },
        });
    }
    if (queueItem.status === 'called') {
        __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(queueItem.status === 'called'))
                        return;
                    __VLS_ctx.seatCustomer(queueItem);
                    // @ts-ignore
                    [seatCustomer,];
                } },
            ...{ class: "px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors" },
        });
    }
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.editQueueItem(queueItem);
                // @ts-ignore
                [editQueueItem,];
            } },
        ...{ class: "px-3 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors" },
    });
    if (queueItem.specialRequests || queueItem.notes) {
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "mt-3 p-2 bg-gray-50 rounded" },
        });
        if (queueItem.specialRequests) {
            __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
                ...{ class: "text-xs text-gray-600" },
            });
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                ...{ class: "font-medium" },
            });
            (queueItem.specialRequests);
        }
        if (queueItem.notes) {
            __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
                ...{ class: "text-xs text-gray-600 mt-1" },
            });
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                ...{ class: "font-medium" },
            });
            (queueItem.notes);
        }
    }
}
if (__VLS_ctx.filteredQueue.length === 0) {
    // @ts-ignore
    [filteredQueue,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "p-12 text-center" },
    });
    const __VLS_50 = {}.UsersIcon;
    /** @type {[typeof __VLS_components.UsersIcon, ]} */ ;
    // @ts-ignore
    UsersIcon;
    // @ts-ignore
    const __VLS_51 = __VLS_asFunctionalComponent(__VLS_50, new __VLS_50({
        ...{ class: "mx-auto h-12 w-12 text-gray-400 mb-4" },
    }));
    const __VLS_52 = __VLS_51({
        ...{ class: "mx-auto h-12 w-12 text-gray-400 mb-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_51));
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
        ...{ class: "text-lg font-medium text-gray-900 mb-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-gray-500" },
    });
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "lg:col-span-2" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-white rounded-lg shadow mb-6" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "p-6 border-b border-gray-200" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center justify-between" },
});
__VLS_asFunctionalElement(__VLS_elements.h2, __VLS_elements.h2)({
    ...{ class: "text-xl font-semibold text-gray-900" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex space-x-2" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.toggleTableView('available');
            // @ts-ignore
            [toggleTableView,];
        } },
    ...{ class: "px-3 py-1 bg-green-100 text-green-800 rounded text-sm" },
    ...{ class: ({
            'bg-green-600 text-white': __VLS_ctx.tableViewFilter === 'available',
        }) },
});
// @ts-ignore
[tableViewFilter,];
(__VLS_ctx.availableTables);
// @ts-ignore
[availableTables,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.toggleTableView('occupied');
            // @ts-ignore
            [toggleTableView,];
        } },
    ...{ class: "px-3 py-1 bg-red-100 text-red-800 rounded text-sm" },
    ...{ class: ({
            'bg-red-600 text-white': __VLS_ctx.tableViewFilter === 'occupied',
        }) },
});
// @ts-ignore
[tableViewFilter,];
(__VLS_ctx.occupiedTables);
// @ts-ignore
[occupiedTables,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.toggleTableView('all');
            // @ts-ignore
            [toggleTableView,];
        } },
    ...{ class: "px-3 py-1 bg-gray-100 text-gray-800 rounded text-sm" },
    ...{ class: ({
            'bg-gray-600 text-white': __VLS_ctx.tableViewFilter === 'all',
        }) },
});
// @ts-ignore
[tableViewFilter,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "p-6" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "grid grid-cols-2 md:grid-cols-4 gap-4" },
});
for (const [table] of __VLS_getVForSourceType((__VLS_ctx.filteredTables))) {
    // @ts-ignore
    [filteredTables,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.selectTable(table);
                // @ts-ignore
                [selectTable,];
            } },
        key: (table.id),
        ...{ class: ([
                'relative p-4 rounded-lg border-2 cursor-pointer transition-all',
                __VLS_ctx.getTableStatusColor(table.status),
                __VLS_ctx.selectedTable?.id === table.id ? 'ring-2 ring-blue-500' : '',
            ]) },
    });
    // @ts-ignore
    [getTableStatusColor, selectedTable,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-center" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "font-bold text-lg" },
    });
    (table.number);
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-sm text-gray-600" },
    });
    (table.capacity);
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "mt-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: (__VLS_ctx.getTableStatusTextColor(table.status)) },
        ...{ class: "text-xs font-medium px-2 py-1 rounded-full" },
    });
    // @ts-ignore
    [getTableStatusTextColor,];
    (__VLS_ctx.getTableStatusText(table.status));
    // @ts-ignore
    [getTableStatusText,];
    if (table.occupiedSince) {
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "text-xs text-gray-500 mt-1" },
        });
        (__VLS_ctx.getOccupiedTime(table.occupiedSince));
        // @ts-ignore
        [getOccupiedTime,];
    }
    if (table.cleaningStatus === 'cleaning') {
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "absolute top-2 right-2" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "w-3 h-3 bg-yellow-400 rounded-full animate-pulse" },
        });
    }
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-white rounded-lg shadow" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "p-6" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
    ...{ class: "text-lg font-semibold text-gray-900 mb-4" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "grid grid-cols-2 gap-4" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.addToQueue) },
    ...{ class: "p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-center" },
});
// @ts-ignore
[addToQueue,];
const __VLS_55 = {}.PlusIcon;
/** @type {[typeof __VLS_components.PlusIcon, ]} */ ;
// @ts-ignore
PlusIcon;
// @ts-ignore
const __VLS_56 = __VLS_asFunctionalComponent(__VLS_55, new __VLS_55({
    ...{ class: "w-6 h-6 text-gray-400 mx-auto mb-2" },
}));
const __VLS_57 = __VLS_56({
    ...{ class: "w-6 h-6 text-gray-400 mx-auto mb-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_56));
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "text-sm font-medium text-gray-700" },
});
if (__VLS_ctx.selectedTable && __VLS_ctx.selectedTable.status === 'occupied') {
    // @ts-ignore
    [selectedTable, selectedTable,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.selectedTable && __VLS_ctx.selectedTable.status === 'occupied'))
                    return;
                __VLS_ctx.cleanTable(__VLS_ctx.selectedTable);
                // @ts-ignore
                [selectedTable, cleanTable,];
            } },
        ...{ class: "p-4 bg-orange-100 rounded-lg hover:bg-orange-200 transition-colors text-center" },
    });
    const __VLS_60 = {}.SparklesIcon;
    /** @type {[typeof __VLS_components.SparklesIcon, ]} */ ;
    // @ts-ignore
    SparklesIcon;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
        ...{ class: "w-6 h-6 text-orange-600 mx-auto mb-2" },
    }));
    const __VLS_62 = __VLS_61({
        ...{ class: "w-6 h-6 text-orange-600 mx-auto mb-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "text-sm font-medium text-orange-800" },
    });
}
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.sendNotification) },
    ...{ class: "p-4 bg-purple-100 rounded-lg hover:bg-purple-200 transition-colors text-center" },
});
// @ts-ignore
[sendNotification,];
const __VLS_65 = {}.BellIcon;
/** @type {[typeof __VLS_components.BellIcon, ]} */ ;
// @ts-ignore
BellIcon;
// @ts-ignore
const __VLS_66 = __VLS_asFunctionalComponent(__VLS_65, new __VLS_65({
    ...{ class: "w-6 h-6 text-purple-600 mx-auto mb-2" },
}));
const __VLS_67 = __VLS_66({
    ...{ class: "w-6 h-6 text-purple-600 mx-auto mb-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_66));
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "text-sm font-medium text-purple-800" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.generateReport) },
    ...{ class: "p-4 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-center" },
});
// @ts-ignore
[generateReport,];
const __VLS_70 = {}.DocumentChartBarIcon;
/** @type {[typeof __VLS_components.DocumentChartBarIcon, ]} */ ;
// @ts-ignore
DocumentChartBarIcon;
// @ts-ignore
const __VLS_71 = __VLS_asFunctionalComponent(__VLS_70, new __VLS_70({
    ...{ class: "w-6 h-6 text-gray-600 mx-auto mb-2" },
}));
const __VLS_72 = __VLS_71({
    ...{ class: "w-6 h-6 text-gray-600 mx-auto mb-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_71));
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "text-sm font-medium text-gray-800" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center justify-between mb-3" },
});
__VLS_asFunctionalElement(__VLS_elements.h4, __VLS_elements.h4)({
    ...{ class: "font-medium text-gray-900" },
});
__VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
    ...{ class: "relative inline-flex items-center cursor-pointer" },
});
__VLS_asFunctionalElement(__VLS_elements.input)({
    ...{ onChange: (__VLS_ctx.toggleAutoAssignment) },
    type: "checkbox",
    ...{ class: "sr-only peer" },
});
(__VLS_ctx.autoAssignment);
// @ts-ignore
[toggleAutoAssignment, autoAssignment,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm text-gray-600" },
});
(__VLS_ctx.autoAssignment ? "已開啟自動座位分配" : "已關閉自動座位分配");
// @ts-ignore
[autoAssignment,];
if (__VLS_ctx.showAddDialog) {
    // @ts-ignore
    [showAddDialog,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "fixed inset-0 z-50 overflow-y-auto" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center justify-center min-h-screen px-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div)({
        ...{ onClick: (__VLS_ctx.closeAddDialog) },
        ...{ class: "fixed inset-0 bg-black opacity-30" },
    });
    // @ts-ignore
    [closeAddDialog,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "relative bg-white rounded-lg shadow-xl max-w-md w-full p-6" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center justify-between mb-6" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
        ...{ class: "text-xl font-semibold text-gray-900" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.closeAddDialog) },
        ...{ class: "text-gray-400 hover:text-gray-600" },
    });
    // @ts-ignore
    [closeAddDialog,];
    const __VLS_75 = {}.XMarkIcon;
    /** @type {[typeof __VLS_components.XMarkIcon, ]} */ ;
    // @ts-ignore
    XMarkIcon;
    // @ts-ignore
    const __VLS_76 = __VLS_asFunctionalComponent(__VLS_75, new __VLS_75({
        ...{ class: "w-6 h-6" },
    }));
    const __VLS_77 = __VLS_76({
        ...{ class: "w-6 h-6" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_76));
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "space-y-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
        ...{ class: "block text-sm font-medium text-gray-700 mb-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.input)({
        value: (__VLS_ctx.newQueueItem.customerName),
        type: "text",
        ...{ class: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" },
        placeholder: "輸入顧客姓名（可選）",
    });
    // @ts-ignore
    [newQueueItem,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
        ...{ class: "block text-sm font-medium text-gray-700 mb-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.input)({
        type: "tel",
        ...{ class: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" },
        placeholder: "輸入聯絡電話",
    });
    (__VLS_ctx.newQueueItem.customerPhone);
    // @ts-ignore
    [newQueueItem,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
        ...{ class: "block text-sm font-medium text-gray-700 mb-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
        value: (__VLS_ctx.newQueueItem.partySize),
        ...{ class: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" },
    });
    // @ts-ignore
    [newQueueItem,];
    for (const [n] of __VLS_getVForSourceType((12))) {
        __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
            key: (n),
            value: (n),
        });
        (n);
    }
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
        ...{ class: "block text-sm font-medium text-gray-700 mb-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
        value: (__VLS_ctx.newQueueItem.tablePreferences),
        ...{ class: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" },
    });
    // @ts-ignore
    [newQueueItem,];
    __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
        value: "",
    });
    __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
        value: "window",
    });
    __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
        value: "corner",
    });
    __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
        value: "center",
    });
    __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
        value: "quiet",
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
        ...{ class: "block text-sm font-medium text-gray-700 mb-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.textarea)({
        value: (__VLS_ctx.newQueueItem.specialRequests),
        rows: "3",
        ...{ class: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" },
        placeholder: "兒童座椅、輪椅通道等（可選）",
    });
    // @ts-ignore
    [newQueueItem,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
        ...{ class: "flex items-center" },
    });
    __VLS_asFunctionalElement(__VLS_elements.input)({
        type: "checkbox",
        ...{ class: "rounded border-gray-300 text-yellow-600 shadow-sm focus:border-yellow-300 focus:ring focus:ring-yellow-200 focus:ring-opacity-50" },
    });
    (__VLS_ctx.newQueueItem.isVIP);
    // @ts-ignore
    [newQueueItem,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "ml-2 text-sm text-gray-700" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex justify-end space-x-3 mt-6" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.closeAddDialog) },
        ...{ class: "px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors" },
    });
    // @ts-ignore
    [closeAddDialog,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.submitAddToQueue) },
        disabled: (!__VLS_ctx.canAddToQueue),
        ...{ class: "px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" },
    });
    // @ts-ignore
    [submitAddToQueue, canAddToQueue,];
}
if (__VLS_ctx.showSeatDialog) {
    // @ts-ignore
    [showSeatDialog,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "fixed inset-0 z-50 overflow-y-auto" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center justify-center min-h-screen px-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div)({
        ...{ onClick: (__VLS_ctx.closeSeatDialog) },
        ...{ class: "fixed inset-0 bg-black opacity-30" },
    });
    // @ts-ignore
    [closeSeatDialog,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center justify-between mb-6" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
        ...{ class: "text-xl font-semibold text-gray-900" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.closeSeatDialog) },
        ...{ class: "text-gray-400 hover:text-gray-600" },
    });
    // @ts-ignore
    [closeSeatDialog,];
    const __VLS_80 = {}.XMarkIcon;
    /** @type {[typeof __VLS_components.XMarkIcon, ]} */ ;
    // @ts-ignore
    XMarkIcon;
    // @ts-ignore
    const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
        ...{ class: "w-6 h-6" },
    }));
    const __VLS_82 = __VLS_81({
        ...{ class: "w-6 h-6" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_81));
    if (__VLS_ctx.selectedQueueItem) {
        // @ts-ignore
        [selectedQueueItem,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "space-y-4" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "bg-gray-50 p-4 rounded-lg" },
        });
        __VLS_asFunctionalElement(__VLS_elements.h4, __VLS_elements.h4)({
            ...{ class: "font-medium text-gray-900 mb-2" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "text-sm space-y-1" },
        });
        __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({});
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "text-gray-600" },
        });
        (__VLS_ctx.selectedQueueItem.queueNumber);
        // @ts-ignore
        [selectedQueueItem,];
        __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({});
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "text-gray-600" },
        });
        (__VLS_ctx.selectedQueueItem.customerName || "未提供");
        // @ts-ignore
        [selectedQueueItem,];
        __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({});
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "text-gray-600" },
        });
        (__VLS_ctx.selectedQueueItem.partySize);
        // @ts-ignore
        [selectedQueueItem,];
        if (__VLS_ctx.selectedQueueItem.tablePreferences?.length) {
            // @ts-ignore
            [selectedQueueItem,];
            __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({});
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                ...{ class: "text-gray-600" },
            });
            (__VLS_ctx.selectedQueueItem.tablePreferences.join(', '));
            // @ts-ignore
            [selectedQueueItem,];
        }
        __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({});
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "text-gray-600" },
        });
        (__VLS_ctx.getWaitTime(__VLS_ctx.selectedQueueItem.joinedAt));
        // @ts-ignore
        [getWaitTime, selectedQueueItem,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
        __VLS_asFunctionalElement(__VLS_elements.h4, __VLS_elements.h4)({
            ...{ class: "font-medium text-gray-900 mb-3" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "grid grid-cols-2 gap-3" },
        });
        for (const [table] of __VLS_getVForSourceType((__VLS_ctx.recommendedTables))) {
            // @ts-ignore
            [recommendedTables,];
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.showSeatDialog))
                            return;
                        if (!(__VLS_ctx.selectedQueueItem))
                            return;
                        __VLS_ctx.seatAssignment.tableId = table.id;
                        // @ts-ignore
                        [seatAssignment,];
                    } },
                key: (table.id),
                ...{ class: ([
                        'p-3 border-2 rounded-lg cursor-pointer transition-all',
                        __VLS_ctx.seatAssignment.tableId === table.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300',
                    ]) },
            });
            // @ts-ignore
            [seatAssignment,];
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "text-center" },
            });
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "font-bold" },
            });
            (table.number);
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "text-sm text-gray-600" },
            });
            (table.capacity);
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "text-xs text-green-600 mt-1" },
            });
            (table.matchScore);
        }
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
        __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
            ...{ class: "block text-sm font-medium text-gray-700 mb-2" },
        });
        __VLS_asFunctionalElement(__VLS_elements.textarea)({
            value: (__VLS_ctx.seatAssignment.notes),
            rows: "3",
            ...{ class: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" },
            placeholder: "座位安排備註...",
        });
        // @ts-ignore
        [seatAssignment,];
    }
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex justify-end space-x-3 mt-6" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.closeSeatDialog) },
        ...{ class: "px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors" },
    });
    // @ts-ignore
    [closeSeatDialog,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.confirmSeatAssignment) },
        disabled: (!__VLS_ctx.seatAssignment.tableId),
        ...{ class: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" },
    });
    // @ts-ignore
    [seatAssignment, confirmSeatAssignment,];
}
/** @type {__VLS_StyleScopedClasses['queue-view']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-4']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-green-100']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-800']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-600']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-blue-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-purple-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-purple-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-green-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-green-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-5']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-6']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-8']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-100']} */ ;
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['w-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-green-100']} */ ;
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['w-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-600']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-purple-100']} */ ;
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['w-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-purple-600']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-orange-100']} */ ;
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['w-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-orange-600']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-100']} */ ;
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['w-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-600']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-4']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-8']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:col-span-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-4']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['divide-y']} */ ;
/** @type {__VLS_StyleScopedClasses['divide-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-12']} */ ;
/** @type {__VLS_StyleScopedClasses['h-12']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-yellow-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-yellow-600']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-green-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-green-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-blue-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['p-12']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['h-12']} */ ;
/** @type {__VLS_StyleScopedClasses['w-12']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:col-span-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-green-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-800']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-green-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-800']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-red-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-4']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border-2']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['top-2']} */ ;
/** @type {__VLS_StyleScopedClasses['right-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-yellow-400']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-pulse']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-blue-50']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-6']} */ ;
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-orange-100']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-orange-200']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-6']} */ ;
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-orange-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-orange-800']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-purple-100']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-purple-200']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-6']} */ ;
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-purple-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-purple-800']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-6']} */ ;
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gradient-to-r']} */ ;
/** @type {__VLS_StyleScopedClasses['from-blue-50']} */ ;
/** @type {__VLS_StyleScopedClasses['to-indigo-50']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['sr-only']} */ ;
/** @type {__VLS_StyleScopedClasses['peer']} */ ;
/** @type {__VLS_StyleScopedClasses['w-11']} */ ;
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['peer-focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['peer-focus:ring-4']} */ ;
/** @type {__VLS_StyleScopedClasses['peer-focus:ring-blue-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['peer']} */ ;
/** @type {__VLS_StyleScopedClasses['peer-checked:after:translate-x-full']} */ ;
/** @type {__VLS_StyleScopedClasses['peer-checked:after:border-white']} */ ;
/** @type {__VLS_StyleScopedClasses['after:content-[\'\']']} */ ;
/** @type {__VLS_StyleScopedClasses['after:absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['after:top-[2px]']} */ ;
/** @type {__VLS_StyleScopedClasses['after:left-[2px]']} */ ;
/** @type {__VLS_StyleScopedClasses['after:bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['after:border-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['after:border']} */ ;
/** @type {__VLS_StyleScopedClasses['after:rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['after:h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['after:w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['after:transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['peer-checked:bg-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-50']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-screen']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-30']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-md']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['w-6']} */ ;
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-yellow-600']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-yellow-300']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-yellow-200']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-green-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-green-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:cursor-not-allowed']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-50']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-screen']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-30']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['w-6']} */ ;
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['border-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-800']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-200']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-blue-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:cursor-not-allowed']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        UsersIcon: UsersIcon,
        ClockIcon: ClockIcon,
        BuildingStorefrontIcon: BuildingStorefrontIcon,
        ChartBarIcon: ChartBarIcon,
        ExclamationTriangleIcon: ExclamationTriangleIcon,
        ArrowPathIcon: ArrowPathIcon,
        StarIcon: StarIcon,
        PlusIcon: PlusIcon,
        SparklesIcon: SparklesIcon,
        BellIcon: BellIcon,
        XMarkIcon: XMarkIcon,
        DocumentChartBarIcon: DocumentChartBarIcon,
        queueFilter: queueFilter,
        tableViewFilter: tableViewFilter,
        selectedQueueItem: selectedQueueItem,
        selectedTable: selectedTable,
        showAddDialog: showAddDialog,
        showSeatDialog: showSeatDialog,
        autoAssignment: autoAssignment,
        currentWaiting: currentWaiting,
        avgWaitTime: avgWaitTime,
        availableTables: availableTables,
        occupiedTables: occupiedTables,
        todayServed: todayServed,
        overdueQueue: overdueQueue,
        newQueueItem: newQueueItem,
        seatAssignment: seatAssignment,
        filteredQueue: filteredQueue,
        filteredTables: filteredTables,
        recommendedTables: recommendedTables,
        canAddToQueue: canAddToQueue,
        formatTime: formatTime,
        getWaitTime: getWaitTime,
        getOccupiedTime: getOccupiedTime,
        calculateEstimatedWait: calculateEstimatedWait,
        getQueueNumberColor: getQueueNumberColor,
        getStatusText: getStatusText,
        getStatusClass: getStatusClass,
        getTableStatusColor: getTableStatusColor,
        getTableStatusTextColor: getTableStatusTextColor,
        getTableStatusText: getTableStatusText,
        selectQueueItem: selectQueueItem,
        selectTable: selectTable,
        toggleTableView: toggleTableView,
        refreshQueue: refreshQueue,
        callNextCustomer: callNextCustomer,
        callCustomer: callCustomer,
        seatCustomer: seatCustomer,
        addToQueue: addToQueue,
        closeAddDialog: closeAddDialog,
        submitAddToQueue: submitAddToQueue,
        closeSeatDialog: closeSeatDialog,
        confirmSeatAssignment: confirmSeatAssignment,
        editQueueItem: editQueueItem,
        cleanTable: cleanTable,
        sendNotification: sendNotification,
        generateReport: generateReport,
        toggleAutoAssignment: toggleAutoAssignment,
        openQueueSettings: openQueueSettings,
        openDisplaySettings: openDisplaySettings,
    }),
});
export default (await import('vue')).defineComponent({});
; /* PartiallyEnd: #4569/main.vue */

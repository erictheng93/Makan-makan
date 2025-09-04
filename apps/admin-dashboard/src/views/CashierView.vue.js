import { ref, computed, onMounted, onUnmounted } from 'vue';
import { MagnifyingGlassIcon, ArrowPathIcon, DocumentTextIcon, MapPinIcon, ClockIcon, ShoppingBagIcon, CursorArrowRaysIcon, CheckCircleIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import { CreditCardIcon, BanknotesIcon, DevicePhoneMobileIcon, BuildingLibraryIcon } from '@heroicons/vue/24/solid';
// 響應式數據
const currentTime = ref('');
const searchQuery = ref('');
const selectedOrder = ref(null);
const selectedPaymentMethod = ref('cash');
const cashReceived = ref(0);
const showPaymentSuccess = ref(false);
const completedOrder = ref(null);
// 新增的狀態
const showShiftReport = ref(false);
const showRefundDialog = ref(false);
const actualCashAmount = ref(0);
const todayRevenue = ref(1250.75);
let timeInterval = null;
// 班次資訊
const currentShift = ref({
    name: '早班',
    startTime: '08:00',
    endTime: '16:00',
    cashierName: '李小明'
});
// 班次報告數據
const shiftReport = ref({
    name: '早班',
    startTime: '08:00',
    endTime: '16:00',
    cashierName: '李小明',
    cashTotal: 450.25,
    cardTotal: 680.50,
    digitalTotal: 120.00,
    totalRevenue: 1250.75,
    totalOrders: 28,
    avgOrderValue: 44.67,
    refundCount: 2,
    systemCashAmount: 450.25
});
// 退款數據
const refundData = ref({
    orderNumber: '',
    amount: 0,
    reason: '',
    notes: ''
});
// 付款方式
const paymentMethods = [
    { id: 'cash', name: '現金', icon: BanknotesIcon },
    { id: 'card', name: '刷卡', icon: CreditCardIcon },
    { id: 'digital_wallet', name: '電子錢包', icon: DevicePhoneMobileIcon },
    { id: 'bank_transfer', name: '銀行轉帳', icon: BuildingLibraryIcon }
];
// 模擬待結帳訂單
const orders = ref([
    {
        id: 1,
        orderNumber: 'ORD-001',
        tableNumber: 'T01',
        customerName: '張先生',
        status: 'ready',
        paymentStatus: 'unpaid',
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        subtotal: 45.00,
        serviceCharge: 4.50,
        taxAmount: 2.97,
        discountAmount: 0,
        totalAmount: 52.47,
        items: [
            { id: 1, menuItemName: '招牌炒飯', quantity: 2, unitPrice: 12.00, totalPrice: 24.00 },
            { id: 2, menuItemName: '冰奶茶', quantity: 1, unitPrice: 5.00, totalPrice: 5.00 },
            { id: 3, menuItemName: '春卷', quantity: 2, unitPrice: 8.00, totalPrice: 16.00 }
        ]
    },
    {
        id: 2,
        orderNumber: 'ORD-002',
        tableNumber: 'T03',
        customerName: '李小姐',
        status: 'served',
        paymentStatus: 'unpaid',
        createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        subtotal: 28.50,
        serviceCharge: 2.85,
        taxAmount: 1.88,
        discountAmount: 5.00,
        totalAmount: 28.23,
        items: [
            { id: 4, menuItemName: '南洋咖啡', quantity: 2, unitPrice: 2.80, totalPrice: 5.60 },
            { id: 5, menuItemName: '咖椰吐司', quantity: 1, unitPrice: 3.50, totalPrice: 3.50 },
            { id: 6, menuItemName: '半生熟蛋', quantity: 2, unitPrice: 2.40, totalPrice: 4.80 },
            { id: 7, menuItemName: '紅豆冰', quantity: 2, unitPrice: 6.50, totalPrice: 13.00 }
        ]
    }
]);
// 計算屬性
const filteredOrders = computed(() => {
    let filtered = orders.value.filter(order => ['ready', 'served'].includes(order.status) && order.paymentStatus === 'unpaid');
    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        filtered = filtered.filter(order => order.orderNumber.toLowerCase().includes(query) ||
            order.tableNumber?.toLowerCase().includes(query) ||
            order.customerName?.toLowerCase().includes(query));
    }
    return filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
});
const change = computed(() => {
    if (!selectedOrder.value || selectedPaymentMethod.value !== 'cash')
        return 0;
    return cashReceived.value - selectedOrder.value.totalAmount;
});
const canProcessPayment = computed(() => {
    if (!selectedOrder.value || !selectedPaymentMethod.value)
        return false;
    if (selectedPaymentMethod.value === 'cash') {
        return cashReceived.value >= selectedOrder.value.totalAmount;
    }
    return true;
});
const canProcessRefund = computed(() => {
    return refundData.value.orderNumber &&
        refundData.value.amount > 0 &&
        refundData.value.reason;
});
const cashDifference = computed(() => {
    return actualCashAmount.value - shiftReport.value.systemCashAmount;
});
// 方法
const updateCurrentTime = () => {
    currentTime.value = new Date().toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};
const refreshOrders = async () => {
    // 模擬API調用
    console.log('Refreshing cashier orders...');
};
const selectOrder = (order) => {
    selectedOrder.value = order;
    cashReceived.value = 0;
    selectedPaymentMethod.value = 'cash';
};
const formatMoney = (amount) => {
    return amount.toFixed(2);
};
const formatTime = (dateTime) => {
    return new Date(dateTime).toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit'
    });
};
const formatDateTime = (dateTime) => {
    return new Date(dateTime).toLocaleString('zh-TW');
};
const getOrderStatusClass = (status) => {
    const classes = {
        'ready': 'bg-green-100 text-green-800',
        'served': 'bg-blue-100 text-blue-800',
        'completed': 'bg-gray-100 text-gray-800'
    };
    return classes[status] || 'bg-gray-100 text-gray-800';
};
const getOrderStatusText = (status) => {
    const texts = {
        'ready': '待取餐',
        'served': '已送達',
        'completed': '已完成'
    };
    return texts[status] || status;
};
const processPayment = async () => {
    if (!canProcessPayment.value)
        return;
    try {
        // 模擬支付處理
        const orderIndex = orders.value.findIndex(o => o.id === selectedOrder.value.id);
        if (orderIndex > -1) {
            orders.value[orderIndex].paymentStatus = 'paid';
            orders.value[orderIndex].status = 'completed';
            orders.value[orderIndex].paymentMethod = selectedPaymentMethod.value;
            completedOrder.value = { ...selectedOrder.value };
            showPaymentSuccess.value = true;
            selectedOrder.value = null;
        }
    }
    catch (error) {
        console.error('Payment processing error:', error);
        alert('支付處理失敗，請重試');
    }
};
const applyDiscount = () => {
    if (!selectedOrder.value)
        return;
    const discountPercent = prompt('請輸入折扣百分比 (例如: 10 表示 10% 折扣)');
    if (discountPercent && !isNaN(parseFloat(discountPercent))) {
        const discount = (selectedOrder.value.subtotal + selectedOrder.value.serviceCharge + selectedOrder.value.taxAmount) * (parseFloat(discountPercent) / 100);
        selectedOrder.value.discountAmount = Math.max(0, discount);
        selectedOrder.value.totalAmount = Math.max(0, selectedOrder.value.subtotal +
            selectedOrder.value.serviceCharge +
            selectedOrder.value.taxAmount -
            selectedOrder.value.discountAmount);
    }
};
const printReceipt = () => {
    alert('收據列印功能開發中...');
};
const printFinalReceipt = () => {
    alert(`正在列印 ${completedOrder.value?.orderNumber} 的收據...`);
    closePaymentSuccess();
};
const closePaymentSuccess = () => {
    showPaymentSuccess.value = false;
    completedOrder.value = null;
};
// 班次報告相關方法
const openShiftReport = () => {
    showShiftReport.value = true;
    actualCashAmount.value = shiftReport.value.systemCashAmount;
};
const closeShiftReport = () => {
    showShiftReport.value = false;
};
const printShiftReport = () => {
    alert('正在列印班次報告...');
};
const endShift = () => {
    if (confirm('確定要結束當前班次嗎？結束後將無法再進行修改。')) {
        alert('班次已結束，資料已保存。');
        closeShiftReport();
    }
};
// 退款相關方法
const openRefundDialog = () => {
    showRefundDialog.value = true;
    refundData.value = {
        orderNumber: '',
        amount: 0,
        reason: '',
        notes: ''
    };
};
const closeRefundDialog = () => {
    showRefundDialog.value = false;
};
const processRefund = async () => {
    try {
        // 模擬退款處理
        alert(`退款處理成功：\n訂單: ${refundData.value.orderNumber}\n金額: RM${formatMoney(refundData.value.amount)}\n原因: ${getRefundReasonText(refundData.value.reason)}`);
        // 更新統計數據
        shiftReport.value.refundCount++;
        shiftReport.value.totalRevenue -= refundData.value.amount;
        todayRevenue.value -= refundData.value.amount;
        closeRefundDialog();
    }
    catch (error) {
        console.error('Refund processing error:', error);
        alert('退款處理失敗，請重試');
    }
};
const getRefundReasonText = (reason) => {
    const reasons = {
        quality_issue: '菜品品質問題',
        wrong_order: '上錯菜',
        customer_change: '客戶改變主意',
        service_issue: '服務問題',
        other: '其他原因'
    };
    return reasons[reason] || reason;
};
// 生命周期
onMounted(() => {
    updateCurrentTime();
    timeInterval = setInterval(updateCurrentTime, 1000);
});
onUnmounted(() => {
    if (timeInterval)
        clearInterval(timeInterval);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['cashier-view']} */ 
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "cashier-view" },
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
    ...{ class: "flex items-center space-x-6" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-blue-100 px-4 py-2 rounded-lg" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm text-blue-800 font-medium" },
});
(__VLS_ctx.currentShift.name);
// @ts-ignore
[currentShift,];
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-xs text-blue-600" },
});
(__VLS_ctx.currentShift.startTime);
(__VLS_ctx.currentShift.endTime);
// @ts-ignore
[currentShift, currentShift,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-right" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm text-gray-500" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-lg font-semibold text-green-600" },
});
(__VLS_ctx.formatMoney(__VLS_ctx.todayRevenue));
// @ts-ignore
[formatMoney, todayRevenue,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-right" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-sm text-gray-500" },
});
__VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
    ...{ class: "text-lg font-semibold" },
});
(__VLS_ctx.currentTime);
// @ts-ignore
[currentTime,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-2" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.openShiftReport) },
    ...{ class: "px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm" },
});
// @ts-ignore
[openShiftReport,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.openRefundDialog) },
    ...{ class: "px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm" },
});
// @ts-ignore
[openRefundDialog,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "grid grid-cols-1 lg:grid-cols-3 gap-8" },
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
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "relative" },
});
const __VLS_0 = {}.MagnifyingGlassIcon;
/** @type {[typeof __VLS_components.MagnifyingGlassIcon, ]} */ 
// @ts-ignore
MagnifyingGlassIcon;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: "absolute left-3 top-3 h-4 w-4 text-gray-400" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "absolute left-3 top-3 h-4 w-4 text-gray-400" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_elements.input)({
    value: (__VLS_ctx.searchQuery),
    type: "text",
    placeholder: "搜索訂單編號或桌號...",
    ...{ class: "pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" },
});
// @ts-ignore
[searchQuery,];
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.refreshOrders) },
    ...{ class: "p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors" },
});
// @ts-ignore
[refreshOrders,];
const __VLS_5 = {}.ArrowPathIcon;
/** @type {[typeof __VLS_components.ArrowPathIcon, ]} */ 
// @ts-ignore
ArrowPathIcon;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
    ...{ class: "h-5 w-5" },
}));
const __VLS_7 = __VLS_6({
    ...{ class: "h-5 w-5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "divide-y divide-gray-200" },
});
for (const [order] of __VLS_getVForSourceType((__VLS_ctx.filteredOrders))) {
    // @ts-ignore
    [filteredOrders,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.selectOrder(order);
                // @ts-ignore
                [selectOrder,];
            } },
        key: (order.id),
        ...{ class: ([
                'p-6 cursor-pointer hover:bg-gray-50 transition-colors',
                __VLS_ctx.selectedOrder?.id === order.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
            ]) },
    });
    // @ts-ignore
    [selectedOrder,];
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
        ...{ class: "w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center" },
    });
    const __VLS_10 = {}.DocumentTextIcon;
    /** @type {[typeof __VLS_components.DocumentTextIcon, ]} */ 
    // @ts-ignore
    DocumentTextIcon;
    // @ts-ignore
    const __VLS_11 = __VLS_asFunctionalComponent(__VLS_10, new __VLS_10({
        ...{ class: "w-5 h-5 text-blue-600" },
    }));
    const __VLS_12 = __VLS_11({
        ...{ class: "w-5 h-5 text-blue-600" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_11));
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "ml-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
        ...{ class: "text-lg font-medium text-gray-900" },
    });
    (order.orderNumber);
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: (__VLS_ctx.getOrderStatusClass(order.status)) },
        ...{ class: "ml-2 px-2 py-1 text-xs font-medium rounded-full" },
    });
    // @ts-ignore
    [getOrderStatusClass,];
    (__VLS_ctx.getOrderStatusText(order.status));
    // @ts-ignore
    [getOrderStatusText,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center mt-1 text-sm text-gray-500" },
    });
    const __VLS_15 = {}.MapPinIcon;
    /** @type {[typeof __VLS_components.MapPinIcon, ]} */ 
    // @ts-ignore
    MapPinIcon;
    // @ts-ignore
    const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({
        ...{ class: "w-4 h-4 mr-1" },
    }));
    const __VLS_17 = __VLS_16({
        ...{ class: "w-4 h-4 mr-1" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_16));
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    (order.tableNumber ? `桌號 ${order.tableNumber}` : '外帶');
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "mx-2" },
    });
    const __VLS_20 = {}.ClockIcon;
    /** @type {[typeof __VLS_components.ClockIcon, ]} */ 
    // @ts-ignore
    ClockIcon;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
        ...{ class: "w-4 h-4 mr-1" },
    }));
    const __VLS_22 = __VLS_21({
        ...{ class: "w-4 h-4 mr-1" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    (__VLS_ctx.formatTime(order.createdAt));
    // @ts-ignore
    [formatTime,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-right" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-xl font-bold text-gray-900" },
    });
    (__VLS_ctx.formatMoney(order.totalAmount));
    // @ts-ignore
    [formatMoney,];
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-sm text-gray-500" },
    });
    (order.items.length);
}
if (__VLS_ctx.filteredOrders.length === 0) {
    // @ts-ignore
    [filteredOrders,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "p-12 text-center" },
    });
    const __VLS_25 = {}.ShoppingBagIcon;
    /** @type {[typeof __VLS_components.ShoppingBagIcon, ]} */ 
    // @ts-ignore
    ShoppingBagIcon;
    // @ts-ignore
    const __VLS_26 = __VLS_asFunctionalComponent(__VLS_25, new __VLS_25({
        ...{ class: "mx-auto h-12 w-12 text-gray-400 mb-4" },
    }));
    const __VLS_27 = __VLS_26({
        ...{ class: "mx-auto h-12 w-12 text-gray-400 mb-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_26));
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
        ...{ class: "text-lg font-medium text-gray-900 mb-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-gray-500" },
    });
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "space-y-6" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-white rounded-lg shadow" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "p-6" },
});
__VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
    ...{ class: "text-lg font-semibold text-gray-900 mb-4" },
});
(__VLS_ctx.selectedOrder ? '訂單詳情' : '選擇訂單');
// @ts-ignore
[selectedOrder,];
if (__VLS_ctx.selectedOrder) {
    // @ts-ignore
    [selectedOrder,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "mb-6" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center justify-between mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h4, __VLS_elements.h4)({
        ...{ class: "font-medium text-gray-900" },
    });
    (__VLS_ctx.selectedOrder.orderNumber);
    // @ts-ignore
    [selectedOrder,];
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: (__VLS_ctx.getOrderStatusClass(__VLS_ctx.selectedOrder.status)) },
        ...{ class: "px-2 py-1 text-xs font-medium rounded-full" },
    });
    // @ts-ignore
    [selectedOrder, getOrderStatusClass,];
    (__VLS_ctx.getOrderStatusText(__VLS_ctx.selectedOrder.status));
    // @ts-ignore
    [selectedOrder, getOrderStatusText,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-sm text-gray-600 space-y-1" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex justify-between" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    (__VLS_ctx.selectedOrder.tableNumber || '外帶');
    // @ts-ignore
    [selectedOrder,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex justify-between" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    (__VLS_ctx.formatDateTime(__VLS_ctx.selectedOrder.createdAt));
    // @ts-ignore
    [selectedOrder, formatDateTime,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex justify-between" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    (__VLS_ctx.selectedOrder.customerName || '客戶');
    // @ts-ignore
    [selectedOrder,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "mb-6" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h5, __VLS_elements.h5)({
        ...{ class: "font-medium text-gray-900 mb-3" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "space-y-2" },
    });
    for (const [item] of __VLS_getVForSourceType((__VLS_ctx.selectedOrder.items))) {
        // @ts-ignore
        [selectedOrder,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            key: (item.id),
            ...{ class: "flex justify-between text-sm" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "font-medium" },
        });
        (item.menuItemName);
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "text-gray-500 ml-2" },
        });
        (item.quantity);
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
        (__VLS_ctx.formatMoney(item.totalPrice));
        // @ts-ignore
        [formatMoney,];
    }
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "border-t border-gray-200 pt-4 space-y-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex justify-between text-sm" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    (__VLS_ctx.formatMoney(__VLS_ctx.selectedOrder.subtotal));
    // @ts-ignore
    [formatMoney, selectedOrder,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex justify-between text-sm" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    (__VLS_ctx.formatMoney(__VLS_ctx.selectedOrder.serviceCharge));
    // @ts-ignore
    [formatMoney, selectedOrder,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex justify-between text-sm" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    (__VLS_ctx.formatMoney(__VLS_ctx.selectedOrder.taxAmount));
    // @ts-ignore
    [formatMoney, selectedOrder,];
    if (__VLS_ctx.selectedOrder.discountAmount > 0) {
        // @ts-ignore
        [selectedOrder,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "flex justify-between text-sm text-green-600" },
        });
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
        (__VLS_ctx.formatMoney(__VLS_ctx.selectedOrder.discountAmount));
        // @ts-ignore
        [formatMoney, selectedOrder,];
    }
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    (__VLS_ctx.formatMoney(__VLS_ctx.selectedOrder.totalAmount));
    // @ts-ignore
    [formatMoney, selectedOrder,];
}
else {
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-center py-8" },
    });
    const __VLS_30 = {}.CursorArrowRaysIcon;
    /** @type {[typeof __VLS_components.CursorArrowRaysIcon, ]} */ 
    // @ts-ignore
    CursorArrowRaysIcon;
    // @ts-ignore
    const __VLS_31 = __VLS_asFunctionalComponent(__VLS_30, new __VLS_30({
        ...{ class: "mx-auto h-12 w-12 text-gray-400 mb-2" },
    }));
    const __VLS_32 = __VLS_31({
        ...{ class: "mx-auto h-12 w-12 text-gray-400 mb-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_31));
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-gray-500" },
    });
}
if (__VLS_ctx.selectedOrder) {
    // @ts-ignore
    [selectedOrder,];
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
        ...{ class: "grid grid-cols-2 gap-3 mb-4" },
    });
    for (const [method] of __VLS_getVForSourceType((__VLS_ctx.paymentMethods))) {
        // @ts-ignore
        [paymentMethods,];
        __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.selectedOrder))
                        return;
                    __VLS_ctx.selectedPaymentMethod = method.id;
                    // @ts-ignore
                    [selectedPaymentMethod,];
                } },
            key: (method.id),
            ...{ class: ([
                    'flex flex-col items-center p-4 border-2 rounded-lg transition-colors',
                    __VLS_ctx.selectedPaymentMethod === method.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                ]) },
        });
        // @ts-ignore
        [selectedPaymentMethod,];
        const __VLS_35 = ((method.icon));
        // @ts-ignore
        const __VLS_36 = __VLS_asFunctionalComponent(__VLS_35, new __VLS_35({
            ...{ class: "w-6 h-6 mb-2" },
        }));
        const __VLS_37 = __VLS_36({
            ...{ class: "w-6 h-6 mb-2" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_36));
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "text-sm font-medium" },
        });
        (method.name);
    }
    if (__VLS_ctx.selectedPaymentMethod === 'cash') {
        // @ts-ignore
        [selectedPaymentMethod,];
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "mb-4" },
        });
        __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
            ...{ class: "block text-sm font-medium text-gray-700 mb-2" },
        });
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
            ...{ class: "relative" },
        });
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "absolute left-3 top-3 text-gray-500" },
        });
        __VLS_asFunctionalElement(__VLS_elements.input)({
            type: "number",
            step: "0.01",
            min: "0",
            ...{ class: "w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg" },
            placeholder: "0.00",
        });
        (__VLS_ctx.cashReceived);
        // @ts-ignore
        [cashReceived,];
        if (__VLS_ctx.cashReceived > 0) {
            // @ts-ignore
            [cashReceived,];
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "mt-2 p-3 bg-gray-50 rounded-lg" },
            });
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "flex justify-between text-sm" },
            });
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                ...{ class: "font-medium" },
            });
            (__VLS_ctx.formatMoney(__VLS_ctx.selectedOrder.totalAmount));
            // @ts-ignore
            [formatMoney, selectedOrder,];
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "flex justify-between text-sm" },
            });
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                ...{ class: "font-medium" },
            });
            (__VLS_ctx.formatMoney(__VLS_ctx.cashReceived));
            // @ts-ignore
            [formatMoney, cashReceived,];
            __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
                ...{ class: "flex justify-between text-lg font-bold mt-1 pt-1 border-t border-gray-200" },
            });
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                ...{ class: (__VLS_ctx.change >= 0 ? 'text-green-600' : 'text-red-600') },
            });
            // @ts-ignore
            [change,];
            (__VLS_ctx.formatMoney(__VLS_ctx.change));
            // @ts-ignore
            [formatMoney, change,];
        }
    }
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "space-y-3" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.processPayment) },
        disabled: (!__VLS_ctx.canProcessPayment),
        ...{ class: "w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg" },
    });
    // @ts-ignore
    [processPayment, canProcessPayment,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "grid grid-cols-2 gap-3" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.applyDiscount) },
        ...{ class: "py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm" },
    });
    // @ts-ignore
    [applyDiscount,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.printReceipt) },
        ...{ class: "py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm" },
    });
    // @ts-ignore
    [printReceipt,];
}
if (__VLS_ctx.showShiftReport) {
    // @ts-ignore
    [showShiftReport,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "fixed inset-0 z-50 overflow-y-auto" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center justify-center min-h-screen px-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ onClick: (__VLS_ctx.closeShiftReport) },
        ...{ class: "fixed inset-0 bg-black opacity-30" },
    });
    // @ts-ignore
    [closeShiftReport,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "relative bg-white rounded-lg shadow-xl max-w-2xl w-full p-6" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center justify-between mb-6" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
        ...{ class: "text-xl font-semibold text-gray-900" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.closeShiftReport) },
        ...{ class: "text-gray-400 hover:text-gray-600" },
    });
    // @ts-ignore
    [closeShiftReport,];
    const __VLS_40 = {}.XMarkIcon;
    /** @type {[typeof __VLS_components.XMarkIcon, ]} */ 
    // @ts-ignore
    XMarkIcon;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
        ...{ class: "w-6 h-6" },
    }));
    const __VLS_42 = __VLS_41({
        ...{ class: "w-6 h-6" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "space-y-6" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "grid grid-cols-2 gap-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "bg-blue-50 p-4 rounded-lg" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h4, __VLS_elements.h4)({
        ...{ class: "font-medium text-blue-900 mb-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-sm text-blue-800 space-y-1" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({});
    (__VLS_ctx.shiftReport.name);
    // @ts-ignore
    [shiftReport,];
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({});
    (__VLS_ctx.shiftReport.startTime);
    (__VLS_ctx.shiftReport.endTime);
    // @ts-ignore
    [shiftReport, shiftReport,];
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({});
    (__VLS_ctx.shiftReport.cashierName);
    // @ts-ignore
    [shiftReport,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "bg-green-50 p-4 rounded-lg" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h4, __VLS_elements.h4)({
        ...{ class: "font-medium text-green-900 mb-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-sm text-green-800 space-y-1" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({});
    (__VLS_ctx.formatMoney(__VLS_ctx.shiftReport.cashTotal));
    // @ts-ignore
    [formatMoney, shiftReport,];
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({});
    (__VLS_ctx.formatMoney(__VLS_ctx.shiftReport.cardTotal));
    // @ts-ignore
    [formatMoney, shiftReport,];
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({});
    (__VLS_ctx.formatMoney(__VLS_ctx.shiftReport.digitalTotal));
    // @ts-ignore
    [formatMoney, shiftReport,];
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "font-bold text-lg pt-1 border-t border-green-200" },
    });
    (__VLS_ctx.formatMoney(__VLS_ctx.shiftReport.totalRevenue));
    // @ts-ignore
    [formatMoney, shiftReport,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    __VLS_asFunctionalElement(__VLS_elements.h4, __VLS_elements.h4)({
        ...{ class: "font-medium text-gray-900 mb-3" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "grid grid-cols-3 gap-4 text-center" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "bg-gray-50 p-3 rounded" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-sm text-gray-600" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-2xl font-bold text-gray-900" },
    });
    (__VLS_ctx.shiftReport.totalOrders);
    // @ts-ignore
    [shiftReport,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "bg-gray-50 p-3 rounded" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-sm text-gray-600" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-2xl font-bold text-gray-900" },
    });
    (__VLS_ctx.formatMoney(__VLS_ctx.shiftReport.avgOrderValue));
    // @ts-ignore
    [formatMoney, shiftReport,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "bg-gray-50 p-3 rounded" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-sm text-gray-600" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-2xl font-bold text-gray-900" },
    });
    (__VLS_ctx.shiftReport.refundCount);
    // @ts-ignore
    [shiftReport,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "bg-yellow-50 p-4 rounded-lg" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h4, __VLS_elements.h4)({
        ...{ class: "font-medium text-yellow-900 mb-3" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "grid grid-cols-2 gap-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
        ...{ class: "block text-sm font-medium text-yellow-800 mb-1" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-lg font-bold text-yellow-900" },
    });
    (__VLS_ctx.formatMoney(__VLS_ctx.shiftReport.systemCashAmount));
    // @ts-ignore
    [formatMoney, shiftReport,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
        ...{ class: "block text-sm font-medium text-yellow-800 mb-1" },
    });
    __VLS_asFunctionalElement(__VLS_elements.input)({
        type: "number",
        step: "0.01",
        ...{ class: "w-full px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500" },
        placeholder: "0.00",
    });
    (__VLS_ctx.actualCashAmount);
    // @ts-ignore
    [actualCashAmount,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "mt-3 p-2 rounded" },
        ...{ class: (__VLS_ctx.cashDifference === 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800') },
    });
    // @ts-ignore
    [cashDifference,];
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-sm font-medium" },
    });
    (__VLS_ctx.cashDifference === 0 ? '盤點符合' :
        __VLS_ctx.cashDifference > 0 ? `現金多 RM${__VLS_ctx.formatMoney(Math.abs(__VLS_ctx.cashDifference))}` :
            `現金少 RM${__VLS_ctx.formatMoney(Math.abs(__VLS_ctx.cashDifference))}`);
    // @ts-ignore
    [formatMoney, formatMoney, cashDifference, cashDifference, cashDifference, cashDifference,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex justify-end space-x-3 mt-6" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.closeShiftReport) },
        ...{ class: "px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors" },
    });
    // @ts-ignore
    [closeShiftReport,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.printShiftReport) },
        ...{ class: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors" },
    });
    // @ts-ignore
    [printShiftReport,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.endShift) },
        ...{ class: "px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors" },
    });
    // @ts-ignore
    [endShift,];
}
if (__VLS_ctx.showRefundDialog) {
    // @ts-ignore
    [showRefundDialog,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "fixed inset-0 z-50 overflow-y-auto" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center justify-center min-h-screen px-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ onClick: (__VLS_ctx.closeRefundDialog) },
        ...{ class: "fixed inset-0 bg-black opacity-30" },
    });
    // @ts-ignore
    [closeRefundDialog,];
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
        ...{ onClick: (__VLS_ctx.closeRefundDialog) },
        ...{ class: "text-gray-400 hover:text-gray-600" },
    });
    // @ts-ignore
    [closeRefundDialog,];
    const __VLS_45 = {}.XMarkIcon;
    /** @type {[typeof __VLS_components.XMarkIcon, ]} */ 
    // @ts-ignore
    XMarkIcon;
    // @ts-ignore
    const __VLS_46 = __VLS_asFunctionalComponent(__VLS_45, new __VLS_45({
        ...{ class: "w-6 h-6" },
    }));
    const __VLS_47 = __VLS_46({
        ...{ class: "w-6 h-6" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_46));
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "space-y-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
        ...{ class: "block text-sm font-medium text-gray-700 mb-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.input)({
        value: (__VLS_ctx.refundData.orderNumber),
        type: "text",
        ...{ class: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" },
        placeholder: "輸入訂單編號",
    });
    // @ts-ignore
    [refundData,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
        ...{ class: "block text-sm font-medium text-gray-700 mb-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "relative" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "absolute left-3 top-3 text-gray-500" },
    });
    __VLS_asFunctionalElement(__VLS_elements.input)({
        type: "number",
        step: "0.01",
        min: "0",
        ...{ class: "w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" },
        placeholder: "0.00",
    });
    (__VLS_ctx.refundData.amount);
    // @ts-ignore
    [refundData,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
        ...{ class: "block text-sm font-medium text-gray-700 mb-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.select, __VLS_elements.select)({
        value: (__VLS_ctx.refundData.reason),
        ...{ class: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" },
    });
    // @ts-ignore
    [refundData,];
    __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
        value: "",
    });
    __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
        value: "quality_issue",
    });
    __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
        value: "wrong_order",
    });
    __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
        value: "customer_change",
    });
    __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
        value: "service_issue",
    });
    __VLS_asFunctionalElement(__VLS_elements.option, __VLS_elements.option)({
        value: "other",
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    __VLS_asFunctionalElement(__VLS_elements.label, __VLS_elements.label)({
        ...{ class: "block text-sm font-medium text-gray-700 mb-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.textarea, __VLS_elements.textarea)({
        value: (__VLS_ctx.refundData.notes),
        rows: "3",
        ...{ class: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" },
        placeholder: "選填備註資訊",
    });
    // @ts-ignore
    [refundData,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex justify-end space-x-3 mt-6" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.closeRefundDialog) },
        ...{ class: "px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors" },
    });
    // @ts-ignore
    [closeRefundDialog,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.processRefund) },
        disabled: (!__VLS_ctx.canProcessRefund),
        ...{ class: "px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" },
    });
    // @ts-ignore
    [processRefund, canProcessRefund,];
}
if (__VLS_ctx.showPaymentSuccess) {
    // @ts-ignore
    [showPaymentSuccess,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "fixed inset-0 z-50 overflow-y-auto" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center justify-center min-h-screen px-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "fixed inset-0 bg-black opacity-30" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "relative bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-center" },
    });
    const __VLS_50 = {}.CheckCircleIcon;
    /** @type {[typeof __VLS_components.CheckCircleIcon, ]} */ 
    // @ts-ignore
    CheckCircleIcon;
    // @ts-ignore
    const __VLS_51 = __VLS_asFunctionalComponent(__VLS_50, new __VLS_50({
        ...{ class: "mx-auto h-16 w-16 text-green-600 mb-4" },
    }));
    const __VLS_52 = __VLS_51({
        ...{ class: "mx-auto h-16 w-16 text-green-600 mb-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_51));
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
        ...{ class: "text-xl font-semibold text-gray-900 mb-2" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-gray-600 mb-6" },
    });
    (__VLS_ctx.completedOrder?.orderNumber);
    // @ts-ignore
    [completedOrder,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "space-y-3" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.printFinalReceipt) },
        ...{ class: "w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors" },
    });
    // @ts-ignore
    [printFinalReceipt,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.closePaymentSuccess) },
        ...{ class: "w-full py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors" },
    });
    // @ts-ignore
    [closePaymentSuccess,];
}
/** @type {__VLS_StyleScopedClasses['cashier-view']} */ 
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
/** @type {__VLS_StyleScopedClasses['space-x-6']} */ 
/** @type {__VLS_StyleScopedClasses['bg-blue-100']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-blue-800']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['text-blue-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-right']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-green-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-right']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ 
/** @type {__VLS_StyleScopedClasses['px-3']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['bg-purple-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-purple-700']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['px-3']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['bg-orange-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-orange-700']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['grid']} */ 
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ 
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-3']} */ 
/** @type {__VLS_StyleScopedClasses['gap-8']} */ 
/** @type {__VLS_StyleScopedClasses['lg:col-span-2']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['shadow']} */ 
/** @type {__VLS_StyleScopedClasses['p-6']} */ 
/** @type {__VLS_StyleScopedClasses['border-b']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['text-xl']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-4']} */ 
/** @type {__VLS_StyleScopedClasses['relative']} */ 
/** @type {__VLS_StyleScopedClasses['absolute']} */ 
/** @type {__VLS_StyleScopedClasses['left-3']} */ 
/** @type {__VLS_StyleScopedClasses['top-3']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ 
/** @type {__VLS_StyleScopedClasses['pl-10']} */ 
/** @type {__VLS_StyleScopedClasses['pr-4']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['border']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-300']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['p-2']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-100']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ 
/** @type {__VLS_StyleScopedClasses['divide-y']} */ 
/** @type {__VLS_StyleScopedClasses['divide-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['p-6']} */ 
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-50']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ 
/** @type {__VLS_StyleScopedClasses['w-10']} */ 
/** @type {__VLS_StyleScopedClasses['h-10']} */ 
/** @type {__VLS_StyleScopedClasses['bg-blue-100']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['w-5']} */ 
/** @type {__VLS_StyleScopedClasses['h-5']} */ 
/** @type {__VLS_StyleScopedClasses['text-blue-600']} */ 
/** @type {__VLS_StyleScopedClasses['ml-4']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['ml-2']} */ 
/** @type {__VLS_StyleScopedClasses['px-2']} */ 
/** @type {__VLS_StyleScopedClasses['py-1']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['mt-1']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['mr-1']} */ 
/** @type {__VLS_StyleScopedClasses['mx-2']} */ 
/** @type {__VLS_StyleScopedClasses['w-4']} */ 
/** @type {__VLS_StyleScopedClasses['h-4']} */ 
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ 
/** @type {__VLS_StyleScopedClasses['text-xl']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['p-12']} */ 
/** @type {__VLS_StyleScopedClasses['text-center']} */ 
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ 
/** @type {__VLS_StyleScopedClasses['h-12']} */ 
/** @type {__VLS_StyleScopedClasses['w-12']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ 
/** @type {__VLS_StyleScopedClasses['mb-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['mb-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['shadow']} */ 
/** @type {__VLS_StyleScopedClasses['p-6']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['mb-4']} */ 
/** @type {__VLS_StyleScopedClasses['mb-6']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['mb-4']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['px-2']} */ 
/** @type {__VLS_StyleScopedClasses['py-1']} */ 
/** @type {__VLS_StyleScopedClasses['text-xs']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['mb-6']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['mb-3']} */ 
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['ml-2']} */ 
/** @type {__VLS_StyleScopedClasses['border-t']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['pt-4']} */ 
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-green-600']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['pt-2']} */ 
/** @type {__VLS_StyleScopedClasses['border-t']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['text-center']} */ 
/** @type {__VLS_StyleScopedClasses['py-8']} */ 
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ 
/** @type {__VLS_StyleScopedClasses['h-12']} */ 
/** @type {__VLS_StyleScopedClasses['w-12']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ 
/** @type {__VLS_StyleScopedClasses['mb-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['shadow']} */ 
/** @type {__VLS_StyleScopedClasses['p-6']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['mb-4']} */ 
/** @type {__VLS_StyleScopedClasses['grid']} */ 
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ 
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['flex-col']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['p-4']} */ 
/** @type {__VLS_StyleScopedClasses['border-2']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['w-6']} */ 
/** @type {__VLS_StyleScopedClasses['h-6']} */ 
/** @type {__VLS_StyleScopedClasses['mb-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['mb-4']} */ 
/** @type {__VLS_StyleScopedClasses['block']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ 
/** @type {__VLS_StyleScopedClasses['mb-2']} */ 
/** @type {__VLS_StyleScopedClasses['relative']} */ 
/** @type {__VLS_StyleScopedClasses['absolute']} */ 
/** @type {__VLS_StyleScopedClasses['left-3']} */ 
/** @type {__VLS_StyleScopedClasses['top-3']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['w-full']} */ 
/** @type {__VLS_StyleScopedClasses['pl-10']} */ 
/** @type {__VLS_StyleScopedClasses['pr-4']} */ 
/** @type {__VLS_StyleScopedClasses['py-3']} */ 
/** @type {__VLS_StyleScopedClasses['border']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-300']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['mt-2']} */ 
/** @type {__VLS_StyleScopedClasses['p-3']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['mt-1']} */ 
/** @type {__VLS_StyleScopedClasses['pt-1']} */ 
/** @type {__VLS_StyleScopedClasses['border-t']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ 
/** @type {__VLS_StyleScopedClasses['w-full']} */ 
/** @type {__VLS_StyleScopedClasses['py-3']} */ 
/** @type {__VLS_StyleScopedClasses['bg-green-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-green-700']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ 
/** @type {__VLS_StyleScopedClasses['disabled:cursor-not-allowed']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['grid']} */ 
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ 
/** @type {__VLS_StyleScopedClasses['gap-3']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['bg-yellow-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-yellow-700']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-700']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['fixed']} */ 
/** @type {__VLS_StyleScopedClasses['inset-0']} */ 
/** @type {__VLS_StyleScopedClasses['z-50']} */ 
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['min-h-screen']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['fixed']} */ 
/** @type {__VLS_StyleScopedClasses['inset-0']} */ 
/** @type {__VLS_StyleScopedClasses['bg-black']} */ 
/** @type {__VLS_StyleScopedClasses['opacity-30']} */ 
/** @type {__VLS_StyleScopedClasses['relative']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['shadow-xl']} */ 
/** @type {__VLS_StyleScopedClasses['max-w-2xl']} */ 
/** @type {__VLS_StyleScopedClasses['w-full']} */ 
/** @type {__VLS_StyleScopedClasses['p-6']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['mb-6']} */ 
/** @type {__VLS_StyleScopedClasses['text-xl']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ 
/** @type {__VLS_StyleScopedClasses['hover:text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['w-6']} */ 
/** @type {__VLS_StyleScopedClasses['h-6']} */ 
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ 
/** @type {__VLS_StyleScopedClasses['grid']} */ 
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ 
/** @type {__VLS_StyleScopedClasses['gap-4']} */ 
/** @type {__VLS_StyleScopedClasses['bg-blue-50']} */ 
/** @type {__VLS_StyleScopedClasses['p-4']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-blue-900']} */ 
/** @type {__VLS_StyleScopedClasses['mb-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-blue-800']} */ 
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ 
/** @type {__VLS_StyleScopedClasses['bg-green-50']} */ 
/** @type {__VLS_StyleScopedClasses['p-4']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-green-900']} */ 
/** @type {__VLS_StyleScopedClasses['mb-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-green-800']} */ 
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['pt-1']} */ 
/** @type {__VLS_StyleScopedClasses['border-t']} */ 
/** @type {__VLS_StyleScopedClasses['border-green-200']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['mb-3']} */ 
/** @type {__VLS_StyleScopedClasses['grid']} */ 
/** @type {__VLS_StyleScopedClasses['grid-cols-3']} */ 
/** @type {__VLS_StyleScopedClasses['gap-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-center']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ 
/** @type {__VLS_StyleScopedClasses['p-3']} */ 
/** @type {__VLS_StyleScopedClasses['rounded']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ 
/** @type {__VLS_StyleScopedClasses['p-3']} */ 
/** @type {__VLS_StyleScopedClasses['rounded']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ 
/** @type {__VLS_StyleScopedClasses['p-3']} */ 
/** @type {__VLS_StyleScopedClasses['rounded']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['bg-yellow-50']} */ 
/** @type {__VLS_StyleScopedClasses['p-4']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-yellow-900']} */ 
/** @type {__VLS_StyleScopedClasses['mb-3']} */ 
/** @type {__VLS_StyleScopedClasses['grid']} */ 
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ 
/** @type {__VLS_StyleScopedClasses['gap-4']} */ 
/** @type {__VLS_StyleScopedClasses['block']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-yellow-800']} */ 
/** @type {__VLS_StyleScopedClasses['mb-1']} */ 
/** @type {__VLS_StyleScopedClasses['text-lg']} */ 
/** @type {__VLS_StyleScopedClasses['font-bold']} */ 
/** @type {__VLS_StyleScopedClasses['text-yellow-900']} */ 
/** @type {__VLS_StyleScopedClasses['block']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-yellow-800']} */ 
/** @type {__VLS_StyleScopedClasses['mb-1']} */ 
/** @type {__VLS_StyleScopedClasses['w-full']} */ 
/** @type {__VLS_StyleScopedClasses['px-3']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['border']} */ 
/** @type {__VLS_StyleScopedClasses['border-yellow-300']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-yellow-500']} */ 
/** @type {__VLS_StyleScopedClasses['focus:border-yellow-500']} */ 
/** @type {__VLS_StyleScopedClasses['mt-3']} */ 
/** @type {__VLS_StyleScopedClasses['p-2']} */ 
/** @type {__VLS_StyleScopedClasses['rounded']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-3']} */ 
/** @type {__VLS_StyleScopedClasses['mt-6']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-100']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-800']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['bg-blue-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-blue-700']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['bg-red-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-red-700']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['fixed']} */ 
/** @type {__VLS_StyleScopedClasses['inset-0']} */ 
/** @type {__VLS_StyleScopedClasses['z-50']} */ 
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['min-h-screen']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['fixed']} */ 
/** @type {__VLS_StyleScopedClasses['inset-0']} */ 
/** @type {__VLS_StyleScopedClasses['bg-black']} */ 
/** @type {__VLS_StyleScopedClasses['opacity-30']} */ 
/** @type {__VLS_StyleScopedClasses['relative']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['shadow-xl']} */ 
/** @type {__VLS_StyleScopedClasses['max-w-md']} */ 
/** @type {__VLS_StyleScopedClasses['w-full']} */ 
/** @type {__VLS_StyleScopedClasses['p-6']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-between']} */ 
/** @type {__VLS_StyleScopedClasses['mb-6']} */ 
/** @type {__VLS_StyleScopedClasses['text-xl']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ 
/** @type {__VLS_StyleScopedClasses['hover:text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['w-6']} */ 
/** @type {__VLS_StyleScopedClasses['h-6']} */ 
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ 
/** @type {__VLS_StyleScopedClasses['block']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ 
/** @type {__VLS_StyleScopedClasses['mb-2']} */ 
/** @type {__VLS_StyleScopedClasses['w-full']} */ 
/** @type {__VLS_StyleScopedClasses['px-3']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['border']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-300']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['block']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ 
/** @type {__VLS_StyleScopedClasses['mb-2']} */ 
/** @type {__VLS_StyleScopedClasses['relative']} */ 
/** @type {__VLS_StyleScopedClasses['absolute']} */ 
/** @type {__VLS_StyleScopedClasses['left-3']} */ 
/** @type {__VLS_StyleScopedClasses['top-3']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ 
/** @type {__VLS_StyleScopedClasses['w-full']} */ 
/** @type {__VLS_StyleScopedClasses['pl-10']} */ 
/** @type {__VLS_StyleScopedClasses['pr-4']} */ 
/** @type {__VLS_StyleScopedClasses['py-3']} */ 
/** @type {__VLS_StyleScopedClasses['border']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-300']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['block']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ 
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ 
/** @type {__VLS_StyleScopedClasses['px-3']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['border']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-300']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['block']} */ 
/** @type {__VLS_StyleScopedClasses['text-sm']} */ 
/** @type {__VLS_StyleScopedClasses['font-medium']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ 
/** @type {__VLS_StyleScopedClasses['mb-2']} */ 
/** @type {__VLS_StyleScopedClasses['w-full']} */ 
/** @type {__VLS_StyleScopedClasses['px-3']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['border']} */ 
/** @type {__VLS_StyleScopedClasses['border-gray-300']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ 
/** @type {__VLS_StyleScopedClasses['focus:ring-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['focus:border-blue-500']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['justify-end']} */ 
/** @type {__VLS_StyleScopedClasses['space-x-3']} */ 
/** @type {__VLS_StyleScopedClasses['mt-6']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-100']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-800']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['bg-red-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-red-700']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ 
/** @type {__VLS_StyleScopedClasses['disabled:cursor-not-allowed']} */ 
/** @type {__VLS_StyleScopedClasses['fixed']} */ 
/** @type {__VLS_StyleScopedClasses['inset-0']} */ 
/** @type {__VLS_StyleScopedClasses['z-50']} */ 
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ 
/** @type {__VLS_StyleScopedClasses['flex']} */ 
/** @type {__VLS_StyleScopedClasses['items-center']} */ 
/** @type {__VLS_StyleScopedClasses['justify-center']} */ 
/** @type {__VLS_StyleScopedClasses['min-h-screen']} */ 
/** @type {__VLS_StyleScopedClasses['px-4']} */ 
/** @type {__VLS_StyleScopedClasses['fixed']} */ 
/** @type {__VLS_StyleScopedClasses['inset-0']} */ 
/** @type {__VLS_StyleScopedClasses['bg-black']} */ 
/** @type {__VLS_StyleScopedClasses['opacity-30']} */ 
/** @type {__VLS_StyleScopedClasses['relative']} */ 
/** @type {__VLS_StyleScopedClasses['bg-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['shadow-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-md']} */ 
/** @type {__VLS_StyleScopedClasses['w-full']} */ 
/** @type {__VLS_StyleScopedClasses['p-6']} */ 
/** @type {__VLS_StyleScopedClasses['text-center']} */ 
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ 
/** @type {__VLS_StyleScopedClasses['h-16']} */ 
/** @type {__VLS_StyleScopedClasses['w-16']} */ 
/** @type {__VLS_StyleScopedClasses['text-green-600']} */ 
/** @type {__VLS_StyleScopedClasses['mb-4']} */ 
/** @type {__VLS_StyleScopedClasses['text-xl']} */ 
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ 
/** @type {__VLS_StyleScopedClasses['mb-2']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ 
/** @type {__VLS_StyleScopedClasses['mb-6']} */ 
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ 
/** @type {__VLS_StyleScopedClasses['w-full']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['bg-blue-600']} */ 
/** @type {__VLS_StyleScopedClasses['text-white']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-blue-700']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
/** @type {__VLS_StyleScopedClasses['w-full']} */ 
/** @type {__VLS_StyleScopedClasses['py-2']} */ 
/** @type {__VLS_StyleScopedClasses['bg-gray-100']} */ 
/** @type {__VLS_StyleScopedClasses['text-gray-800']} */ 
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ 
/** @type {__VLS_StyleScopedClasses['hover:bg-gray-200']} */ 
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ 
let __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        MagnifyingGlassIcon: MagnifyingGlassIcon,
        ArrowPathIcon: ArrowPathIcon,
        DocumentTextIcon: DocumentTextIcon,
        MapPinIcon: MapPinIcon,
        ClockIcon: ClockIcon,
        ShoppingBagIcon: ShoppingBagIcon,
        CursorArrowRaysIcon: CursorArrowRaysIcon,
        CheckCircleIcon: CheckCircleIcon,
        XMarkIcon: XMarkIcon,
        currentTime: currentTime,
        searchQuery: searchQuery,
        selectedOrder: selectedOrder,
        selectedPaymentMethod: selectedPaymentMethod,
        cashReceived: cashReceived,
        showPaymentSuccess: showPaymentSuccess,
        completedOrder: completedOrder,
        showShiftReport: showShiftReport,
        showRefundDialog: showRefundDialog,
        actualCashAmount: actualCashAmount,
        todayRevenue: todayRevenue,
        currentShift: currentShift,
        shiftReport: shiftReport,
        refundData: refundData,
        paymentMethods: paymentMethods,
        filteredOrders: filteredOrders,
        change: change,
        canProcessPayment: canProcessPayment,
        canProcessRefund: canProcessRefund,
        cashDifference: cashDifference,
        refreshOrders: refreshOrders,
        selectOrder: selectOrder,
        formatMoney: formatMoney,
        formatTime: formatTime,
        formatDateTime: formatDateTime,
        getOrderStatusClass: getOrderStatusClass,
        getOrderStatusText: getOrderStatusText,
        processPayment: processPayment,
        applyDiscount: applyDiscount,
        printReceipt: printReceipt,
        printFinalReceipt: printFinalReceipt,
        closePaymentSuccess: closePaymentSuccess,
        openShiftReport: openShiftReport,
        closeShiftReport: closeShiftReport,
        printShiftReport: printShiftReport,
        endShift: endShift,
        openRefundDialog: openRefundDialog,
        closeRefundDialog: closeRefundDialog,
        processRefund: processRefund,
    }),
});
export default (await import('vue')).defineComponent({});
 /* PartiallyEnd: #4569/main.vue */

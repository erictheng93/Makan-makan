import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ArrowLeftIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import QRCodeIcon from '@heroicons/vue/24/outline/QrCodeIcon';
import SeatManagement from '../components/tables/SeatManagement.vue';
import QRModeSelector from '../components/tables/QRModeSelector.vue';
const router = useRouter();
const route = useRoute();
// 響應式數據
const table = ref({
    id: 1,
    tableNumber: 'T01',
    tableName: 'Table 1',
    capacity: 4,
    location: '靠窗位置',
    status: 'available',
    qrMode: 'table',
    qrCode: 'QR_REST1_T01_ABC123',
    totalUsage: 45
});
const seats = ref([]);
const showEditModal = ref(false);
const showModeSwitchModal = ref(false);
const newQRMode = ref('table');
const newSeatConfig = ref({
    count: 10,
    numberingStyle: 'numeric'
});
// 方法
const goBack = () => {
    router.push('/tables');
};
const getStatusBadgeClass = (status) => {
    const classes = {
        available: 'bg-green-100 text-green-800',
        occupied: 'bg-red-100 text-red-800',
        reserved: 'bg-yellow-100 text-yellow-800',
        maintenance: 'bg-gray-100 text-gray-800'
    };
    return classes[status] || 'bg-gray-100 text-gray-800';
};
const getStatusText = (status) => {
    const texts = {
        available: '可用',
        occupied: '使用中',
        reserved: '已預約',
        maintenance: '維護中'
    };
    return texts[status] || status;
};
const loadSeats = async () => {
    if (table.value.qrMode === 'seat') {
        // TODO: 從 API 載入座位數據
        console.log('Loading seats for table:', table.value.id);
        // 模擬數據
        seats.value = Array.from({ length: 10 }, (_, i) => ({
            id: i + 1,
            tableId: table.value.id,
            seatNumber: String(i + 1).padStart(2, '0'),
            seatName: `座位 ${i + 1}`,
            qrCode: `QR_SEAT_${table.value.id}_${String(i + 1).padStart(2, '0')}`,
            isOccupied: Math.random() > 0.7,
            isActive: true,
            totalUsage: Math.floor(Math.random() * 50),
            currentOrderId: Math.random() > 0.7 ? Math.floor(Math.random() * 1000) : undefined,
            occupiedBy: Math.random() > 0.7 ? `User ${Math.floor(Math.random() * 100)}` : undefined
        }));
    }
};
const switchQRMode = async () => {
    if (table.value.status === 'occupied') {
        alert('桌台使用中，無法切換模式');
        return;
    }
    if (!confirm(`確定要切換到${newQRMode.value === 'table' ? '桌子模式' : '座位模式'}嗎？`)) {
        return;
    }
    try {
        // TODO: 調用 API 切換模式
        console.log('Switching QR mode:', {
            tableId: table.value.id,
            newMode: newQRMode.value,
            seatConfig: newSeatConfig.value
        });
        table.value.qrMode = newQRMode.value;
        showModeSwitchModal.value = false;
        if (newQRMode.value === 'seat') {
            await loadSeats();
        }
        alert('模式切換成功');
    }
    catch (error) {
        console.error('Failed to switch QR mode:', error);
        alert('模式切換失敗');
    }
};
const downloadQRCode = () => {
    alert('QR 碼下載功能開發中...');
};
const printQRCode = () => {
    alert('QR 碼列印功能開發中...');
};
const regenerateQRCode = async () => {
    if (!confirm('確定要重新生成 QR 碼嗎？')) {
        return;
    }
    try {
        // TODO: 調用 API 重新生成 QR
        console.log('Regenerating QR code for table:', table.value.id);
        alert('QR 碼已重新生成');
    }
    catch (error) {
        console.error('Failed to regenerate QR code:', error);
        alert('重新生成 QR 碼失敗');
    }
};
onMounted(() => {
    // 從路由參數獲取桌台 ID 並載入數據
    const tableId = route.params.id;
    console.log('Loading table:', tableId);
    // TODO: 從 API 載入桌台數據
    // 如果是座位模式，載入座位數據
    if (table.value.qrMode === 'seat') {
        loadSeats();
    }
    // 初始化新模式為當前模式
    newQRMode.value = table.value.qrMode;
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['table-detail-view']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "table-detail-view" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "mb-6" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (__VLS_ctx.goBack) },
    ...{ class: "flex items-center text-gray-600 hover:text-gray-900" },
});
// @ts-ignore
[goBack,];
const __VLS_0 = {}.ArrowLeftIcon;
/** @type {[typeof __VLS_components.ArrowLeftIcon, ]} */ ;
// @ts-ignore
ArrowLeftIcon;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: "h-5 w-5 mr-2" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "h-5 w-5 mr-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "bg-white rounded-lg shadow p-6 mb-6" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex justify-between items-start" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.h1, __VLS_elements.h1)({
    ...{ class: "text-2xl font-bold text-gray-900 mb-2" },
});
(__VLS_ctx.table.tableNumber);
// @ts-ignore
[table,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex items-center space-x-4" },
});
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: (__VLS_ctx.getStatusBadgeClass(__VLS_ctx.table.status)) },
    ...{ class: "px-3 py-1 text-sm font-medium rounded-full" },
});
// @ts-ignore
[table, getStatusBadgeClass,];
(__VLS_ctx.getStatusText(__VLS_ctx.table.status));
// @ts-ignore
[table, getStatusText,];
__VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
    ...{ class: "px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full" },
});
(__VLS_ctx.table.qrMode === 'table' ? '桌子模式' : '座位模式');
// @ts-ignore
[table,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "flex space-x-2" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showEditModal = true;
            // @ts-ignore
            [showEditModal,];
        } },
    ...{ class: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors" },
});
__VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showModeSwitchModal = true;
            // @ts-ignore
            [showModeSwitchModal,];
        } },
    ...{ class: "px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "grid grid-cols-2 md:grid-cols-4 gap-4 mt-6" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-sm text-gray-600" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-lg font-semibold" },
});
(__VLS_ctx.table.capacity);
// @ts-ignore
[table,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-sm text-gray-600" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-lg font-semibold" },
});
(__VLS_ctx.table.location || '未設定');
// @ts-ignore
[table,];
if (__VLS_ctx.table.qrMode === 'seat') {
    // @ts-ignore
    [table,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-sm text-gray-600" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-lg font-semibold" },
    });
    (__VLS_ctx.seats.length);
    // @ts-ignore
    [seats,];
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-sm text-gray-600" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "text-lg font-semibold" },
});
(__VLS_ctx.table.totalUsage || 0);
// @ts-ignore
[table,];
if (__VLS_ctx.table.qrMode === 'seat') {
    // @ts-ignore
    [table,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    /** @type {[typeof SeatManagement, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(SeatManagement, new SeatManagement({
        ...{ 'onUpdate': {} },
        tableId: (__VLS_ctx.table.id),
        tableNumber: (__VLS_ctx.table.tableNumber),
        seats: (__VLS_ctx.seats),
        gridColumns: (4),
    }));
    const __VLS_6 = __VLS_5({
        ...{ 'onUpdate': {} },
        tableId: (__VLS_ctx.table.id),
        tableNumber: (__VLS_ctx.table.tableNumber),
        seats: (__VLS_ctx.seats),
        gridColumns: (4),
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
    let __VLS_8;
    let __VLS_9;
    const __VLS_10 = ({ update: {} },
        { onUpdate: (__VLS_ctx.loadSeats) });
    // @ts-ignore
    [table, table, seats, loadSeats,];
    var __VLS_7;
}
else {
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "bg-white rounded-lg shadow p-6" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h2, __VLS_elements.h2)({
        ...{ class: "text-xl font-bold text-gray-900 mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex flex-col items-center" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "p-6 bg-gray-50 rounded-lg" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "w-64 h-64 bg-white border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "text-center" },
    });
    const __VLS_12 = {}.QRCodeIcon;
    /** @type {[typeof __VLS_components.QRCodeIcon, ]} */ ;
    // @ts-ignore
    QRCodeIcon;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
        ...{ class: "mx-auto h-24 w-24 text-gray-400 mb-2" },
    }));
    const __VLS_14 = __VLS_13({
        ...{ class: "mx-auto h-24 w-24 text-gray-400 mb-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-sm text-gray-500" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-xs text-gray-400 mt-2 break-all px-4" },
    });
    (__VLS_ctx.table.qrCode);
    // @ts-ignore
    [table,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "mt-6 flex space-x-3" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.downloadQRCode) },
        ...{ class: "px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors" },
    });
    // @ts-ignore
    [downloadQRCode,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.printQRCode) },
        ...{ class: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors" },
    });
    // @ts-ignore
    [printQRCode,];
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.regenerateQRCode) },
        ...{ class: "px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors" },
    });
    // @ts-ignore
    [regenerateQRCode,];
}
if (__VLS_ctx.showModeSwitchModal) {
    // @ts-ignore
    [showModeSwitchModal,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "fixed inset-0 z-50 overflow-y-auto" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex items-center justify-center min-h-screen px-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showModeSwitchModal))
                    return;
                __VLS_ctx.showModeSwitchModal = false;
                // @ts-ignore
                [showModeSwitchModal,];
            } },
        ...{ class: "fixed inset-0 bg-black opacity-30" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "p-6" },
    });
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex justify-between items-center mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({
        ...{ class: "text-lg font-semibold" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showModeSwitchModal))
                    return;
                __VLS_ctx.showModeSwitchModal = false;
                // @ts-ignore
                [showModeSwitchModal,];
            } },
        ...{ class: "text-gray-400 hover:text-gray-600" },
    });
    const __VLS_17 = {}.XMarkIcon;
    /** @type {[typeof __VLS_components.XMarkIcon, ]} */ ;
    // @ts-ignore
    XMarkIcon;
    // @ts-ignore
    const __VLS_18 = __VLS_asFunctionalComponent(__VLS_17, new __VLS_17({
        ...{ class: "h-6 w-6" },
    }));
    const __VLS_19 = __VLS_18({
        ...{ class: "h-6 w-6" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_18));
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "mb-6" },
    });
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "text-sm text-gray-600" },
    });
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
        ...{ class: "font-semibold" },
    });
    (__VLS_ctx.table.qrMode === 'table' ? '桌子模式' : '座位模式');
    // @ts-ignore
    [table,];
    /** @type {[typeof QRModeSelector, ]} */ ;
    // @ts-ignore
    const __VLS_22 = __VLS_asFunctionalComponent(QRModeSelector, new QRModeSelector({
        modelValue: (__VLS_ctx.newQRMode),
        seatConfig: (__VLS_ctx.newSeatConfig),
    }));
    const __VLS_23 = __VLS_22({
        modelValue: (__VLS_ctx.newQRMode),
        seatConfig: (__VLS_ctx.newSeatConfig),
    }, ...__VLS_functionalComponentArgsRest(__VLS_22));
    // @ts-ignore
    [newQRMode, newSeatConfig,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "flex justify-end space-x-3 mt-6" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showModeSwitchModal))
                    return;
                __VLS_ctx.showModeSwitchModal = false;
                // @ts-ignore
                [showModeSwitchModal,];
            } },
        type: "button",
        ...{ class: "px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors" },
    });
    __VLS_asFunctionalElement(__VLS_elements.button, __VLS_elements.button)({
        ...{ onClick: (__VLS_ctx.switchQRMode) },
        type: "button",
        ...{ class: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors" },
    });
    // @ts-ignore
    [switchQRMode,];
}
/** @type {__VLS_StyleScopedClasses['table-detail-view']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-4']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-blue-700']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-blue-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-yellow-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-yellow-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-4']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-900']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-50']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['w-64']} */ ;
/** @type {__VLS_StyleScopedClasses['h-64']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['border-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
/** @type {__VLS_StyleScopedClasses['border-gray-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['h-24']} */ ;
/** @type {__VLS_StyleScopedClasses['w-24']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-500']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['break-all']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-3']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-green-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-green-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-blue-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-blue-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-yellow-600']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-yellow-700']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
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
/** @type {__VLS_StyleScopedClasses['max-w-4xl']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-[90vh]']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-400']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['w-6']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-700']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gray-100']} */ ;
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
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        ArrowLeftIcon: ArrowLeftIcon,
        XMarkIcon: XMarkIcon,
        QRCodeIcon: QRCodeIcon,
        SeatManagement: SeatManagement,
        QRModeSelector: QRModeSelector,
        table: table,
        seats: seats,
        showEditModal: showEditModal,
        showModeSwitchModal: showModeSwitchModal,
        newQRMode: newQRMode,
        newSeatConfig: newSeatConfig,
        goBack: goBack,
        getStatusBadgeClass: getStatusBadgeClass,
        getStatusText: getStatusText,
        loadSeats: loadSeats,
        switchQRMode: switchQRMode,
        downloadQRCode: downloadQRCode,
        printQRCode: printQRCode,
        regenerateQRCode: regenerateQRCode,
    }),
});
export default (await import('vue')).defineComponent({});
; /* PartiallyEnd: #4569/main.vue */

export interface RealtimePOSTransaction {
    transactionId: string;
    registerId: string;
    type: "sale" | "refund" | "cash_in" | "cash_out" | "drawer_count";
    amount: number;
    description: string;
    operatorId: number;
    timestamp: string;
}
export interface RealtimeCashMovement {
    movementId: string;
    registerId: string;
    type: "cash_in" | "cash_out" | "drawer_count" | "refund";
    amount: number;
    description: string;
    operatorId: number;
    timestamp: string;
}
export interface RealtimeShiftEvent {
    shiftId: string;
    registerId: string;
    operatorId: number;
    type: "started" | "ended";
    timestamp: string;
    data: {
        startingCash?: number;
        endingCash?: number;
        totalSales?: number;
        totalRefunds?: number;
    };
}
export interface RealtimeRegisterStatus {
    registerId: string;
    status: "active" | "inactive" | "maintenance";
    currentBalance: number;
    lastActivity: string;
    timestamp: string;
}
export declare function useRealtimePOS(): {
    isConnected: import("vue").Ref<boolean, boolean>;
    transactions: import("vue").Ref<{
        transactionId: string;
        registerId: string;
        type: "sale" | "refund" | "cash_in" | "cash_out" | "drawer_count";
        amount: number;
        description: string;
        operatorId: number;
        timestamp: string;
    }[], RealtimePOSTransaction[] | {
        transactionId: string;
        registerId: string;
        type: "sale" | "refund" | "cash_in" | "cash_out" | "drawer_count";
        amount: number;
        description: string;
        operatorId: number;
        timestamp: string;
    }[]>;
    cashMovements: import("vue").Ref<{
        movementId: string;
        registerId: string;
        type: "cash_in" | "cash_out" | "drawer_count" | "refund";
        amount: number;
        description: string;
        operatorId: number;
        timestamp: string;
    }[], RealtimeCashMovement[] | {
        movementId: string;
        registerId: string;
        type: "cash_in" | "cash_out" | "drawer_count" | "refund";
        amount: number;
        description: string;
        operatorId: number;
        timestamp: string;
    }[]>;
    shiftEvents: import("vue").Ref<{
        shiftId: string;
        registerId: string;
        operatorId: number;
        type: "started" | "ended";
        timestamp: string;
        data: {
            startingCash?: number | undefined;
            endingCash?: number | undefined;
            totalSales?: number | undefined;
            totalRefunds?: number | undefined;
        };
    }[], RealtimeShiftEvent[] | {
        shiftId: string;
        registerId: string;
        operatorId: number;
        type: "started" | "ended";
        timestamp: string;
        data: {
            startingCash?: number | undefined;
            endingCash?: number | undefined;
            totalSales?: number | undefined;
            totalRefunds?: number | undefined;
        };
    }[]>;
    registerStatuses: import("vue").Ref<Map<string, {
        registerId: string;
        status: "active" | "inactive" | "maintenance";
        currentBalance: number;
        lastActivity: string;
        timestamp: string;
    }> & Omit<Map<string, RealtimeRegisterStatus>, keyof Map<any, any>>, Map<string, RealtimeRegisterStatus> | (Map<string, {
        registerId: string;
        status: "active" | "inactive" | "maintenance";
        currentBalance: number;
        lastActivity: string;
        timestamp: string;
    }> & Omit<Map<string, RealtimeRegisterStatus>, keyof Map<any, any>>)>;
    posStats: import("vue").Ref<{
        todayTransactions: number;
        todayRevenue: number;
        activeRegisters: number;
        currentShifts: number;
        lastTransactionTime: string | null;
    }, {
        todayTransactions: number;
        todayRevenue: number;
        activeRegisters: number;
        currentShifts: number;
        lastTransactionTime: string | null;
    } | {
        todayTransactions: number;
        todayRevenue: number;
        activeRegisters: number;
        currentShifts: number;
        lastTransactionTime: string | null;
    }>;
    connectionStatus: import("vue").Ref<"error" | "connecting" | "connected" | "disconnected", "error" | "connecting" | "connected" | "disconnected">;
    startListening: () => void;
    stopListening: () => void;
    clearUpdates: () => void;
    resetStats: () => void;
    getRecentTransactions: (limit?: number) => {
        transactionId: string;
        registerId: string;
        type: "sale" | "refund" | "cash_in" | "cash_out" | "drawer_count";
        amount: number;
        description: string;
        operatorId: number;
        timestamp: string;
    }[];
    getRecentCashMovements: (limit?: number) => {
        movementId: string;
        registerId: string;
        type: "cash_in" | "cash_out" | "drawer_count" | "refund";
        amount: number;
        description: string;
        operatorId: number;
        timestamp: string;
    }[];
    getRecentShiftEvents: (limit?: number) => {
        shiftId: string;
        registerId: string;
        operatorId: number;
        type: "started" | "ended";
        timestamp: string;
        data: {
            startingCash?: number | undefined;
            endingCash?: number | undefined;
            totalSales?: number | undefined;
            totalRefunds?: number | undefined;
        };
    }[];
    getTransactionsByRegister: (registerId: string) => {
        transactionId: string;
        registerId: string;
        type: "sale" | "refund" | "cash_in" | "cash_out" | "drawer_count";
        amount: number;
        description: string;
        operatorId: number;
        timestamp: string;
    }[];
    getTransactionsByType: (type: string) => {
        transactionId: string;
        registerId: string;
        type: "sale" | "refund" | "cash_in" | "cash_out" | "drawer_count";
        amount: number;
        description: string;
        operatorId: number;
        timestamp: string;
    }[];
    getRegisterStatus: (registerId: string) => {
        registerId: string;
        status: "active" | "inactive" | "maintenance";
        currentBalance: number;
        lastActivity: string;
        timestamp: string;
    } | undefined;
    getAllRegisterStatuses: () => {
        registerId: string;
        status: "active" | "inactive" | "maintenance";
        currentBalance: number;
        lastActivity: string;
        timestamp: string;
    }[];
    getTodaySalesTotal: () => number;
    getTodayRefundsTotal: () => number;
};
export default useRealtimePOS;

export interface CashRegister {
    id: string;
    name: string;
    status: "active" | "inactive" | "maintenance";
    currentBalance: number;
    location: string;
    createdAt: string;
    updatedAt: string;
}
export interface CashShift {
    id: string;
    registerId: string;
    operatorId: number;
    startTime: string;
    endTime?: string;
    startingCash: number;
    endingCash?: number;
    totalSales: number;
    totalRefunds: number;
    status: "active" | "ended";
}
export interface CashMovement {
    id: string;
    registerId: string;
    type: "cash_in" | "cash_out" | "drawer_count" | "refund";
    amount: number;
    description: string;
    operatorId: number;
    createdAt: string;
}
export interface Receipt {
    id: string;
    orderId: string;
    registerId: string;
    receiptNumber: string;
    items: any[];
    totalAmount: number;
    paymentMethod: string;
    createdAt: string;
}
export interface Promotion {
    id: string;
    title: string;
    description: string;
    discountType: "percentage" | "fixed_amount";
    discountValue: number;
    minOrderAmount?: number;
    isActive: boolean;
    startDate: string;
    endDate: string;
}
export declare const posService: {
    getRegisters(): Promise<CashRegister[]>;
    createRegister(data: Omit<CashRegister, "id" | "createdAt" | "updatedAt">): Promise<CashRegister>;
    updateRegister(id: string, data: Partial<CashRegister>): Promise<CashRegister>;
    activateRegister(id: string): Promise<void>;
    deactivateRegister(id: string): Promise<void>;
    startShift(data: {
        registerId: string;
        startingCash: number;
        operatorId: number;
    }): Promise<CashShift>;
    endShift(shiftId: string, data: {
        endingCash: number;
        notes?: string;
    }): Promise<CashShift>;
    getCurrentShift(registerId: string): Promise<CashShift | null>;
    createCashMovement(data: {
        registerId: string;
        type: CashMovement["type"];
        amount: number;
        description: string;
        operatorId: number;
    }): Promise<CashMovement>;
    getCashMovements(registerId: string, params?: {
        startDate?: string;
        endDate?: string;
        type?: CashMovement["type"];
    }): Promise<CashMovement[]>;
    printReceipt(data: {
        orderId: string;
        registerId: string;
        items: any[];
        totalAmount: number;
        paymentMethod: string;
    }): Promise<Receipt>;
    getReceipts(registerId: string, params?: {
        startDate?: string;
        endDate?: string;
    }): Promise<Receipt[]>;
    processRefund(data: {
        orderId: string;
        registerId: string;
        amount: number;
        reason: string;
        operatorId: number;
        notes?: string;
    }): Promise<any>;
    getPromotions(): Promise<Promotion[]>;
    createPromotion(data: Omit<Promotion, "id">): Promise<Promotion>;
    updatePromotion(id: string, data: Partial<Promotion>): Promise<Promotion>;
    deletePromotion(id: string): Promise<void>;
    getDailyStats(registerId: string, date?: string): Promise<{
        totalSales: number;
        totalOrders: number;
        totalRefunds: number;
        cashBalance: number;
        avgOrderValue: number;
    }>;
    getShiftReport(shiftId: string): Promise<{
        shift: CashShift;
        sales: number;
        orders: number;
        refunds: number;
        cashMovements: CashMovement[];
        receipts: Receipt[];
    }>;
    processQuickPayment(data: {
        orderId: string;
        registerId: string;
        amount: number;
        paymentMethod: string;
        operatorId: number;
    }): Promise<any>;
};
export default posService;

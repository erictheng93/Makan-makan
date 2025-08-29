import type { Order } from '@/types';
import { OrderStatus } from '@/types';
export declare const useOrderStore: import("pinia").StoreDefinition<"order", Pick<{
    orders: Readonly<import("vue").Ref<readonly {
        readonly id: number;
        readonly restaurantId: number;
        readonly tableId?: number | undefined;
        readonly status: OrderStatus;
        readonly totalAmount: number;
        readonly items: readonly {
            readonly id: number;
            readonly menuItemId: number;
            readonly quantity: number;
            readonly unitPrice: number;
            readonly customizations: readonly {
                readonly customizationId: string;
                readonly optionId: string;
                readonly name: string;
                readonly priceModifier: number;
            }[];
            readonly notes?: string | undefined;
        }[];
        readonly notes?: string | undefined;
        readonly customerInfo?: {
            readonly name?: string | undefined;
            readonly phone?: string | undefined;
            readonly email?: string | undefined;
        } | undefined;
        readonly createdAt: string;
        readonly updatedAt: string;
        readonly completedAt?: string | undefined;
    }[], readonly {
        readonly id: number;
        readonly restaurantId: number;
        readonly tableId?: number | undefined;
        readonly status: OrderStatus;
        readonly totalAmount: number;
        readonly items: readonly {
            readonly id: number;
            readonly menuItemId: number;
            readonly quantity: number;
            readonly unitPrice: number;
            readonly customizations: readonly {
                readonly customizationId: string;
                readonly optionId: string;
                readonly name: string;
                readonly priceModifier: number;
            }[];
            readonly notes?: string | undefined;
        }[];
        readonly notes?: string | undefined;
        readonly customerInfo?: {
            readonly name?: string | undefined;
            readonly phone?: string | undefined;
            readonly email?: string | undefined;
        } | undefined;
        readonly createdAt: string;
        readonly updatedAt: string;
        readonly completedAt?: string | undefined;
    }[]>>;
    isLoading: Readonly<import("vue").Ref<boolean, boolean>>;
    error: Readonly<import("vue").Ref<string | null, string | null>>;
    pendingOrders: import("vue").ComputedRef<{
        id: number;
        restaurantId: number;
        tableId?: number | undefined;
        status: OrderStatus;
        totalAmount: number;
        items: {
            id: number;
            menuItemId: number;
            quantity: number;
            unitPrice: number;
            customizations: {
                customizationId: string;
                optionId: string;
                name: string;
                priceModifier: number;
            }[];
            notes?: string | undefined;
        }[];
        notes?: string | undefined;
        customerInfo?: {
            name?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        } | undefined;
        createdAt: string;
        updatedAt: string;
        completedAt?: string | undefined;
    }[]>;
    confirmedOrders: import("vue").ComputedRef<{
        id: number;
        restaurantId: number;
        tableId?: number | undefined;
        status: OrderStatus;
        totalAmount: number;
        items: {
            id: number;
            menuItemId: number;
            quantity: number;
            unitPrice: number;
            customizations: {
                customizationId: string;
                optionId: string;
                name: string;
                priceModifier: number;
            }[];
            notes?: string | undefined;
        }[];
        notes?: string | undefined;
        customerInfo?: {
            name?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        } | undefined;
        createdAt: string;
        updatedAt: string;
        completedAt?: string | undefined;
    }[]>;
    preparingOrders: import("vue").ComputedRef<{
        id: number;
        restaurantId: number;
        tableId?: number | undefined;
        status: OrderStatus;
        totalAmount: number;
        items: {
            id: number;
            menuItemId: number;
            quantity: number;
            unitPrice: number;
            customizations: {
                customizationId: string;
                optionId: string;
                name: string;
                priceModifier: number;
            }[];
            notes?: string | undefined;
        }[];
        notes?: string | undefined;
        customerInfo?: {
            name?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        } | undefined;
        createdAt: string;
        updatedAt: string;
        completedAt?: string | undefined;
    }[]>;
    readyOrders: import("vue").ComputedRef<{
        id: number;
        restaurantId: number;
        tableId?: number | undefined;
        status: OrderStatus;
        totalAmount: number;
        items: {
            id: number;
            menuItemId: number;
            quantity: number;
            unitPrice: number;
            customizations: {
                customizationId: string;
                optionId: string;
                name: string;
                priceModifier: number;
            }[];
            notes?: string | undefined;
        }[];
        notes?: string | undefined;
        customerInfo?: {
            name?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        } | undefined;
        createdAt: string;
        updatedAt: string;
        completedAt?: string | undefined;
    }[]>;
    completedOrders: import("vue").ComputedRef<{
        id: number;
        restaurantId: number;
        tableId?: number | undefined;
        status: OrderStatus;
        totalAmount: number;
        items: {
            id: number;
            menuItemId: number;
            quantity: number;
            unitPrice: number;
            customizations: {
                customizationId: string;
                optionId: string;
                name: string;
                priceModifier: number;
            }[];
            notes?: string | undefined;
        }[];
        notes?: string | undefined;
        customerInfo?: {
            name?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        } | undefined;
        createdAt: string;
        updatedAt: string;
        completedAt?: string | undefined;
    }[]>;
    pendingOrdersCount: import("vue").ComputedRef<number>;
    activeOrdersCount: import("vue").ComputedRef<number>;
    fetchOrders: (params?: {
        status?: OrderStatus[];
        page?: number;
        limit?: number;
        date?: string;
    }) => Promise<void>;
    updateOrderStatus: (orderId: number, status: OrderStatus) => Promise<boolean>;
    updateOrder: (updatedOrder: Order) => void;
    removeOrder: (orderId: number) => void;
    getOrderById: (orderId: number) => {
        id: number;
        restaurantId: number;
        tableId?: number | undefined;
        status: OrderStatus;
        totalAmount: number;
        items: {
            id: number;
            menuItemId: number;
            quantity: number;
            unitPrice: number;
            customizations: {
                customizationId: string;
                optionId: string;
                name: string;
                priceModifier: number;
            }[];
            notes?: string | undefined;
        }[];
        notes?: string | undefined;
        customerInfo?: {
            name?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        } | undefined;
        createdAt: string;
        updatedAt: string;
        completedAt?: string | undefined;
    } | undefined;
    getOrdersByTable: (tableId: number) => {
        id: number;
        restaurantId: number;
        tableId?: number | undefined;
        status: OrderStatus;
        totalAmount: number;
        items: {
            id: number;
            menuItemId: number;
            quantity: number;
            unitPrice: number;
            customizations: {
                customizationId: string;
                optionId: string;
                name: string;
                priceModifier: number;
            }[];
            notes?: string | undefined;
        }[];
        notes?: string | undefined;
        customerInfo?: {
            name?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        } | undefined;
        createdAt: string;
        updatedAt: string;
        completedAt?: string | undefined;
    }[];
    getOrdersByStatus: (status: OrderStatus) => {
        id: number;
        restaurantId: number;
        tableId?: number | undefined;
        status: OrderStatus;
        totalAmount: number;
        items: {
            id: number;
            menuItemId: number;
            quantity: number;
            unitPrice: number;
            customizations: {
                customizationId: string;
                optionId: string;
                name: string;
                priceModifier: number;
            }[];
            notes?: string | undefined;
        }[];
        notes?: string | undefined;
        customerInfo?: {
            name?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        } | undefined;
        createdAt: string;
        updatedAt: string;
        completedAt?: string | undefined;
    }[];
    getTotalRevenue: (status?: OrderStatus) => number;
    clearOrders: () => void;
    confirmOrder: (orderId: number) => Promise<boolean>;
    startPreparing: (orderId: number) => Promise<boolean>;
    markReady: (orderId: number) => Promise<boolean>;
    completeOrder: (orderId: number) => Promise<boolean>;
    cancelOrder: (orderId: number, reason?: string) => Promise<boolean>;
}, "isLoading" | "error" | "orders">, Pick<{
    orders: Readonly<import("vue").Ref<readonly {
        readonly id: number;
        readonly restaurantId: number;
        readonly tableId?: number | undefined;
        readonly status: OrderStatus;
        readonly totalAmount: number;
        readonly items: readonly {
            readonly id: number;
            readonly menuItemId: number;
            readonly quantity: number;
            readonly unitPrice: number;
            readonly customizations: readonly {
                readonly customizationId: string;
                readonly optionId: string;
                readonly name: string;
                readonly priceModifier: number;
            }[];
            readonly notes?: string | undefined;
        }[];
        readonly notes?: string | undefined;
        readonly customerInfo?: {
            readonly name?: string | undefined;
            readonly phone?: string | undefined;
            readonly email?: string | undefined;
        } | undefined;
        readonly createdAt: string;
        readonly updatedAt: string;
        readonly completedAt?: string | undefined;
    }[], readonly {
        readonly id: number;
        readonly restaurantId: number;
        readonly tableId?: number | undefined;
        readonly status: OrderStatus;
        readonly totalAmount: number;
        readonly items: readonly {
            readonly id: number;
            readonly menuItemId: number;
            readonly quantity: number;
            readonly unitPrice: number;
            readonly customizations: readonly {
                readonly customizationId: string;
                readonly optionId: string;
                readonly name: string;
                readonly priceModifier: number;
            }[];
            readonly notes?: string | undefined;
        }[];
        readonly notes?: string | undefined;
        readonly customerInfo?: {
            readonly name?: string | undefined;
            readonly phone?: string | undefined;
            readonly email?: string | undefined;
        } | undefined;
        readonly createdAt: string;
        readonly updatedAt: string;
        readonly completedAt?: string | undefined;
    }[]>>;
    isLoading: Readonly<import("vue").Ref<boolean, boolean>>;
    error: Readonly<import("vue").Ref<string | null, string | null>>;
    pendingOrders: import("vue").ComputedRef<{
        id: number;
        restaurantId: number;
        tableId?: number | undefined;
        status: OrderStatus;
        totalAmount: number;
        items: {
            id: number;
            menuItemId: number;
            quantity: number;
            unitPrice: number;
            customizations: {
                customizationId: string;
                optionId: string;
                name: string;
                priceModifier: number;
            }[];
            notes?: string | undefined;
        }[];
        notes?: string | undefined;
        customerInfo?: {
            name?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        } | undefined;
        createdAt: string;
        updatedAt: string;
        completedAt?: string | undefined;
    }[]>;
    confirmedOrders: import("vue").ComputedRef<{
        id: number;
        restaurantId: number;
        tableId?: number | undefined;
        status: OrderStatus;
        totalAmount: number;
        items: {
            id: number;
            menuItemId: number;
            quantity: number;
            unitPrice: number;
            customizations: {
                customizationId: string;
                optionId: string;
                name: string;
                priceModifier: number;
            }[];
            notes?: string | undefined;
        }[];
        notes?: string | undefined;
        customerInfo?: {
            name?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        } | undefined;
        createdAt: string;
        updatedAt: string;
        completedAt?: string | undefined;
    }[]>;
    preparingOrders: import("vue").ComputedRef<{
        id: number;
        restaurantId: number;
        tableId?: number | undefined;
        status: OrderStatus;
        totalAmount: number;
        items: {
            id: number;
            menuItemId: number;
            quantity: number;
            unitPrice: number;
            customizations: {
                customizationId: string;
                optionId: string;
                name: string;
                priceModifier: number;
            }[];
            notes?: string | undefined;
        }[];
        notes?: string | undefined;
        customerInfo?: {
            name?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        } | undefined;
        createdAt: string;
        updatedAt: string;
        completedAt?: string | undefined;
    }[]>;
    readyOrders: import("vue").ComputedRef<{
        id: number;
        restaurantId: number;
        tableId?: number | undefined;
        status: OrderStatus;
        totalAmount: number;
        items: {
            id: number;
            menuItemId: number;
            quantity: number;
            unitPrice: number;
            customizations: {
                customizationId: string;
                optionId: string;
                name: string;
                priceModifier: number;
            }[];
            notes?: string | undefined;
        }[];
        notes?: string | undefined;
        customerInfo?: {
            name?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        } | undefined;
        createdAt: string;
        updatedAt: string;
        completedAt?: string | undefined;
    }[]>;
    completedOrders: import("vue").ComputedRef<{
        id: number;
        restaurantId: number;
        tableId?: number | undefined;
        status: OrderStatus;
        totalAmount: number;
        items: {
            id: number;
            menuItemId: number;
            quantity: number;
            unitPrice: number;
            customizations: {
                customizationId: string;
                optionId: string;
                name: string;
                priceModifier: number;
            }[];
            notes?: string | undefined;
        }[];
        notes?: string | undefined;
        customerInfo?: {
            name?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        } | undefined;
        createdAt: string;
        updatedAt: string;
        completedAt?: string | undefined;
    }[]>;
    pendingOrdersCount: import("vue").ComputedRef<number>;
    activeOrdersCount: import("vue").ComputedRef<number>;
    fetchOrders: (params?: {
        status?: OrderStatus[];
        page?: number;
        limit?: number;
        date?: string;
    }) => Promise<void>;
    updateOrderStatus: (orderId: number, status: OrderStatus) => Promise<boolean>;
    updateOrder: (updatedOrder: Order) => void;
    removeOrder: (orderId: number) => void;
    getOrderById: (orderId: number) => {
        id: number;
        restaurantId: number;
        tableId?: number | undefined;
        status: OrderStatus;
        totalAmount: number;
        items: {
            id: number;
            menuItemId: number;
            quantity: number;
            unitPrice: number;
            customizations: {
                customizationId: string;
                optionId: string;
                name: string;
                priceModifier: number;
            }[];
            notes?: string | undefined;
        }[];
        notes?: string | undefined;
        customerInfo?: {
            name?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        } | undefined;
        createdAt: string;
        updatedAt: string;
        completedAt?: string | undefined;
    } | undefined;
    getOrdersByTable: (tableId: number) => {
        id: number;
        restaurantId: number;
        tableId?: number | undefined;
        status: OrderStatus;
        totalAmount: number;
        items: {
            id: number;
            menuItemId: number;
            quantity: number;
            unitPrice: number;
            customizations: {
                customizationId: string;
                optionId: string;
                name: string;
                priceModifier: number;
            }[];
            notes?: string | undefined;
        }[];
        notes?: string | undefined;
        customerInfo?: {
            name?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        } | undefined;
        createdAt: string;
        updatedAt: string;
        completedAt?: string | undefined;
    }[];
    getOrdersByStatus: (status: OrderStatus) => {
        id: number;
        restaurantId: number;
        tableId?: number | undefined;
        status: OrderStatus;
        totalAmount: number;
        items: {
            id: number;
            menuItemId: number;
            quantity: number;
            unitPrice: number;
            customizations: {
                customizationId: string;
                optionId: string;
                name: string;
                priceModifier: number;
            }[];
            notes?: string | undefined;
        }[];
        notes?: string | undefined;
        customerInfo?: {
            name?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        } | undefined;
        createdAt: string;
        updatedAt: string;
        completedAt?: string | undefined;
    }[];
    getTotalRevenue: (status?: OrderStatus) => number;
    clearOrders: () => void;
    confirmOrder: (orderId: number) => Promise<boolean>;
    startPreparing: (orderId: number) => Promise<boolean>;
    markReady: (orderId: number) => Promise<boolean>;
    completeOrder: (orderId: number) => Promise<boolean>;
    cancelOrder: (orderId: number, reason?: string) => Promise<boolean>;
}, "pendingOrders" | "confirmedOrders" | "preparingOrders" | "readyOrders" | "completedOrders" | "pendingOrdersCount" | "activeOrdersCount">, Pick<{
    orders: Readonly<import("vue").Ref<readonly {
        readonly id: number;
        readonly restaurantId: number;
        readonly tableId?: number | undefined;
        readonly status: OrderStatus;
        readonly totalAmount: number;
        readonly items: readonly {
            readonly id: number;
            readonly menuItemId: number;
            readonly quantity: number;
            readonly unitPrice: number;
            readonly customizations: readonly {
                readonly customizationId: string;
                readonly optionId: string;
                readonly name: string;
                readonly priceModifier: number;
            }[];
            readonly notes?: string | undefined;
        }[];
        readonly notes?: string | undefined;
        readonly customerInfo?: {
            readonly name?: string | undefined;
            readonly phone?: string | undefined;
            readonly email?: string | undefined;
        } | undefined;
        readonly createdAt: string;
        readonly updatedAt: string;
        readonly completedAt?: string | undefined;
    }[], readonly {
        readonly id: number;
        readonly restaurantId: number;
        readonly tableId?: number | undefined;
        readonly status: OrderStatus;
        readonly totalAmount: number;
        readonly items: readonly {
            readonly id: number;
            readonly menuItemId: number;
            readonly quantity: number;
            readonly unitPrice: number;
            readonly customizations: readonly {
                readonly customizationId: string;
                readonly optionId: string;
                readonly name: string;
                readonly priceModifier: number;
            }[];
            readonly notes?: string | undefined;
        }[];
        readonly notes?: string | undefined;
        readonly customerInfo?: {
            readonly name?: string | undefined;
            readonly phone?: string | undefined;
            readonly email?: string | undefined;
        } | undefined;
        readonly createdAt: string;
        readonly updatedAt: string;
        readonly completedAt?: string | undefined;
    }[]>>;
    isLoading: Readonly<import("vue").Ref<boolean, boolean>>;
    error: Readonly<import("vue").Ref<string | null, string | null>>;
    pendingOrders: import("vue").ComputedRef<{
        id: number;
        restaurantId: number;
        tableId?: number | undefined;
        status: OrderStatus;
        totalAmount: number;
        items: {
            id: number;
            menuItemId: number;
            quantity: number;
            unitPrice: number;
            customizations: {
                customizationId: string;
                optionId: string;
                name: string;
                priceModifier: number;
            }[];
            notes?: string | undefined;
        }[];
        notes?: string | undefined;
        customerInfo?: {
            name?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        } | undefined;
        createdAt: string;
        updatedAt: string;
        completedAt?: string | undefined;
    }[]>;
    confirmedOrders: import("vue").ComputedRef<{
        id: number;
        restaurantId: number;
        tableId?: number | undefined;
        status: OrderStatus;
        totalAmount: number;
        items: {
            id: number;
            menuItemId: number;
            quantity: number;
            unitPrice: number;
            customizations: {
                customizationId: string;
                optionId: string;
                name: string;
                priceModifier: number;
            }[];
            notes?: string | undefined;
        }[];
        notes?: string | undefined;
        customerInfo?: {
            name?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        } | undefined;
        createdAt: string;
        updatedAt: string;
        completedAt?: string | undefined;
    }[]>;
    preparingOrders: import("vue").ComputedRef<{
        id: number;
        restaurantId: number;
        tableId?: number | undefined;
        status: OrderStatus;
        totalAmount: number;
        items: {
            id: number;
            menuItemId: number;
            quantity: number;
            unitPrice: number;
            customizations: {
                customizationId: string;
                optionId: string;
                name: string;
                priceModifier: number;
            }[];
            notes?: string | undefined;
        }[];
        notes?: string | undefined;
        customerInfo?: {
            name?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        } | undefined;
        createdAt: string;
        updatedAt: string;
        completedAt?: string | undefined;
    }[]>;
    readyOrders: import("vue").ComputedRef<{
        id: number;
        restaurantId: number;
        tableId?: number | undefined;
        status: OrderStatus;
        totalAmount: number;
        items: {
            id: number;
            menuItemId: number;
            quantity: number;
            unitPrice: number;
            customizations: {
                customizationId: string;
                optionId: string;
                name: string;
                priceModifier: number;
            }[];
            notes?: string | undefined;
        }[];
        notes?: string | undefined;
        customerInfo?: {
            name?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        } | undefined;
        createdAt: string;
        updatedAt: string;
        completedAt?: string | undefined;
    }[]>;
    completedOrders: import("vue").ComputedRef<{
        id: number;
        restaurantId: number;
        tableId?: number | undefined;
        status: OrderStatus;
        totalAmount: number;
        items: {
            id: number;
            menuItemId: number;
            quantity: number;
            unitPrice: number;
            customizations: {
                customizationId: string;
                optionId: string;
                name: string;
                priceModifier: number;
            }[];
            notes?: string | undefined;
        }[];
        notes?: string | undefined;
        customerInfo?: {
            name?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        } | undefined;
        createdAt: string;
        updatedAt: string;
        completedAt?: string | undefined;
    }[]>;
    pendingOrdersCount: import("vue").ComputedRef<number>;
    activeOrdersCount: import("vue").ComputedRef<number>;
    fetchOrders: (params?: {
        status?: OrderStatus[];
        page?: number;
        limit?: number;
        date?: string;
    }) => Promise<void>;
    updateOrderStatus: (orderId: number, status: OrderStatus) => Promise<boolean>;
    updateOrder: (updatedOrder: Order) => void;
    removeOrder: (orderId: number) => void;
    getOrderById: (orderId: number) => {
        id: number;
        restaurantId: number;
        tableId?: number | undefined;
        status: OrderStatus;
        totalAmount: number;
        items: {
            id: number;
            menuItemId: number;
            quantity: number;
            unitPrice: number;
            customizations: {
                customizationId: string;
                optionId: string;
                name: string;
                priceModifier: number;
            }[];
            notes?: string | undefined;
        }[];
        notes?: string | undefined;
        customerInfo?: {
            name?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        } | undefined;
        createdAt: string;
        updatedAt: string;
        completedAt?: string | undefined;
    } | undefined;
    getOrdersByTable: (tableId: number) => {
        id: number;
        restaurantId: number;
        tableId?: number | undefined;
        status: OrderStatus;
        totalAmount: number;
        items: {
            id: number;
            menuItemId: number;
            quantity: number;
            unitPrice: number;
            customizations: {
                customizationId: string;
                optionId: string;
                name: string;
                priceModifier: number;
            }[];
            notes?: string | undefined;
        }[];
        notes?: string | undefined;
        customerInfo?: {
            name?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        } | undefined;
        createdAt: string;
        updatedAt: string;
        completedAt?: string | undefined;
    }[];
    getOrdersByStatus: (status: OrderStatus) => {
        id: number;
        restaurantId: number;
        tableId?: number | undefined;
        status: OrderStatus;
        totalAmount: number;
        items: {
            id: number;
            menuItemId: number;
            quantity: number;
            unitPrice: number;
            customizations: {
                customizationId: string;
                optionId: string;
                name: string;
                priceModifier: number;
            }[];
            notes?: string | undefined;
        }[];
        notes?: string | undefined;
        customerInfo?: {
            name?: string | undefined;
            phone?: string | undefined;
            email?: string | undefined;
        } | undefined;
        createdAt: string;
        updatedAt: string;
        completedAt?: string | undefined;
    }[];
    getTotalRevenue: (status?: OrderStatus) => number;
    clearOrders: () => void;
    confirmOrder: (orderId: number) => Promise<boolean>;
    startPreparing: (orderId: number) => Promise<boolean>;
    markReady: (orderId: number) => Promise<boolean>;
    completeOrder: (orderId: number) => Promise<boolean>;
    cancelOrder: (orderId: number, reason?: string) => Promise<boolean>;
}, "fetchOrders" | "updateOrderStatus" | "updateOrder" | "removeOrder" | "getOrderById" | "getOrdersByTable" | "getOrdersByStatus" | "getTotalRevenue" | "clearOrders" | "confirmOrder" | "startPreparing" | "markReady" | "completeOrder" | "cancelOrder">>;

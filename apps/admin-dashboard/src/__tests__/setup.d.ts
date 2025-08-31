export declare const mockAuthStore: {
    user: null;
    isAuthenticated: boolean;
    token: null;
    login: import("vitest").Mock<any, any>;
    logout: import("vitest").Mock<any, any>;
    checkAuth: import("vitest").Mock<any, any>;
    refreshToken: import("vitest").Mock<any, any>;
    canManageOrders: boolean;
    canManageMenu: boolean;
    canAccessAdminFeatures: boolean;
    canViewKitchen: boolean;
    hasPermission: import("vitest").Mock<[], boolean>;
    userRole: number;
    restaurantId: number;
};
export declare const mockNotificationStore: {
    notifications: never[];
    addNotification: import("vitest").Mock<any, any>;
    removeNotification: import("vitest").Mock<any, any>;
    clearAll: import("vitest").Mock<any, any>;
};
export declare const mockOrderStore: {
    orders: never[];
    currentOrder: null;
    updateOrder: import("vitest").Mock<any, any>;
    fetchOrders: import("vitest").Mock<any, any>;
    updateOrderStatus: import("vitest").Mock<any, any>;
};

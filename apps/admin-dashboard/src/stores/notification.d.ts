export interface Notification {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info' | 'order_ready' | 'order_urgent';
    title: string;
    message: string;
    sound?: boolean;
    persistent?: boolean;
    createdAt: Date;
    read?: boolean;
    data?: {
        orderNumber?: string;
        tableNumber?: string | number;
        [key: string]: any;
    };
}
export declare const useNotificationStore: import("pinia").StoreDefinition<"notification", Pick<{
    notifications: Readonly<import("vue").Ref<readonly {
        readonly id: string;
        readonly type: "success" | "error" | "warning" | "info" | "order_ready" | "order_urgent";
        readonly title: string;
        readonly message: string;
        readonly sound?: boolean | undefined;
        readonly persistent?: boolean | undefined;
        readonly createdAt: Date;
        readonly read?: boolean | undefined;
        readonly data?: {
            readonly [x: string]: any;
            readonly orderNumber?: string | undefined;
            readonly tableNumber?: string | number | undefined;
        } | undefined;
    }[], readonly {
        readonly id: string;
        readonly type: "success" | "error" | "warning" | "info" | "order_ready" | "order_urgent";
        readonly title: string;
        readonly message: string;
        readonly sound?: boolean | undefined;
        readonly persistent?: boolean | undefined;
        readonly createdAt: Date;
        readonly read?: boolean | undefined;
        readonly data?: {
            readonly [x: string]: any;
            readonly orderNumber?: string | undefined;
            readonly tableNumber?: string | number | undefined;
        } | undefined;
    }[]>>;
    unreadCount: import("vue").ComputedRef<number>;
    soundEnabled: Readonly<import("vue").Ref<boolean, boolean>>;
    addNotification: (notification: Omit<Notification, "id" | "createdAt">) => string;
    removeNotification: (id: string) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    clearAll: () => void;
    clearRead: () => void;
    toggleSound: () => void;
    initializeSoundSetting: () => void;
    success: (title: string, message: string, options?: Partial<Notification>) => string;
    error: (title: string, message: string, options?: Partial<Notification>) => string;
    warning: (title: string, message: string, options?: Partial<Notification>) => string;
    info: (title: string, message: string, options?: Partial<Notification>) => string;
}, "notifications" | "soundEnabled">, Pick<{
    notifications: Readonly<import("vue").Ref<readonly {
        readonly id: string;
        readonly type: "success" | "error" | "warning" | "info" | "order_ready" | "order_urgent";
        readonly title: string;
        readonly message: string;
        readonly sound?: boolean | undefined;
        readonly persistent?: boolean | undefined;
        readonly createdAt: Date;
        readonly read?: boolean | undefined;
        readonly data?: {
            readonly [x: string]: any;
            readonly orderNumber?: string | undefined;
            readonly tableNumber?: string | number | undefined;
        } | undefined;
    }[], readonly {
        readonly id: string;
        readonly type: "success" | "error" | "warning" | "info" | "order_ready" | "order_urgent";
        readonly title: string;
        readonly message: string;
        readonly sound?: boolean | undefined;
        readonly persistent?: boolean | undefined;
        readonly createdAt: Date;
        readonly read?: boolean | undefined;
        readonly data?: {
            readonly [x: string]: any;
            readonly orderNumber?: string | undefined;
            readonly tableNumber?: string | number | undefined;
        } | undefined;
    }[]>>;
    unreadCount: import("vue").ComputedRef<number>;
    soundEnabled: Readonly<import("vue").Ref<boolean, boolean>>;
    addNotification: (notification: Omit<Notification, "id" | "createdAt">) => string;
    removeNotification: (id: string) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    clearAll: () => void;
    clearRead: () => void;
    toggleSound: () => void;
    initializeSoundSetting: () => void;
    success: (title: string, message: string, options?: Partial<Notification>) => string;
    error: (title: string, message: string, options?: Partial<Notification>) => string;
    warning: (title: string, message: string, options?: Partial<Notification>) => string;
    info: (title: string, message: string, options?: Partial<Notification>) => string;
}, "unreadCount">, Pick<{
    notifications: Readonly<import("vue").Ref<readonly {
        readonly id: string;
        readonly type: "success" | "error" | "warning" | "info" | "order_ready" | "order_urgent";
        readonly title: string;
        readonly message: string;
        readonly sound?: boolean | undefined;
        readonly persistent?: boolean | undefined;
        readonly createdAt: Date;
        readonly read?: boolean | undefined;
        readonly data?: {
            readonly [x: string]: any;
            readonly orderNumber?: string | undefined;
            readonly tableNumber?: string | number | undefined;
        } | undefined;
    }[], readonly {
        readonly id: string;
        readonly type: "success" | "error" | "warning" | "info" | "order_ready" | "order_urgent";
        readonly title: string;
        readonly message: string;
        readonly sound?: boolean | undefined;
        readonly persistent?: boolean | undefined;
        readonly createdAt: Date;
        readonly read?: boolean | undefined;
        readonly data?: {
            readonly [x: string]: any;
            readonly orderNumber?: string | undefined;
            readonly tableNumber?: string | number | undefined;
        } | undefined;
    }[]>>;
    unreadCount: import("vue").ComputedRef<number>;
    soundEnabled: Readonly<import("vue").Ref<boolean, boolean>>;
    addNotification: (notification: Omit<Notification, "id" | "createdAt">) => string;
    removeNotification: (id: string) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    clearAll: () => void;
    clearRead: () => void;
    toggleSound: () => void;
    initializeSoundSetting: () => void;
    success: (title: string, message: string, options?: Partial<Notification>) => string;
    error: (title: string, message: string, options?: Partial<Notification>) => string;
    warning: (title: string, message: string, options?: Partial<Notification>) => string;
    info: (title: string, message: string, options?: Partial<Notification>) => string;
}, "markAllAsRead" | "error" | "warning" | "info" | "success" | "addNotification" | "removeNotification" | "markAsRead" | "clearAll" | "clearRead" | "toggleSound" | "initializeSoundSetting">>;

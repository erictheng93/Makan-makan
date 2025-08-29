export interface Notification {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    sound?: boolean;
    persistent?: boolean;
    createdAt: Date;
    read?: boolean;
}
export declare const useNotificationStore: import("pinia").StoreDefinition<"notification", Pick<{
    notifications: Readonly<import("vue").Ref<readonly {
        readonly id: string;
        readonly type: "success" | "error" | "warning" | "info";
        readonly title: string;
        readonly message: string;
        readonly sound?: boolean | undefined;
        readonly persistent?: boolean | undefined;
        readonly createdAt: Date;
        readonly read?: boolean | undefined;
    }[], readonly {
        readonly id: string;
        readonly type: "success" | "error" | "warning" | "info";
        readonly title: string;
        readonly message: string;
        readonly sound?: boolean | undefined;
        readonly persistent?: boolean | undefined;
        readonly createdAt: Date;
        readonly read?: boolean | undefined;
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
        readonly type: "success" | "error" | "warning" | "info";
        readonly title: string;
        readonly message: string;
        readonly sound?: boolean | undefined;
        readonly persistent?: boolean | undefined;
        readonly createdAt: Date;
        readonly read?: boolean | undefined;
    }[], readonly {
        readonly id: string;
        readonly type: "success" | "error" | "warning" | "info";
        readonly title: string;
        readonly message: string;
        readonly sound?: boolean | undefined;
        readonly persistent?: boolean | undefined;
        readonly createdAt: Date;
        readonly read?: boolean | undefined;
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
        readonly type: "success" | "error" | "warning" | "info";
        readonly title: string;
        readonly message: string;
        readonly sound?: boolean | undefined;
        readonly persistent?: boolean | undefined;
        readonly createdAt: Date;
        readonly read?: boolean | undefined;
    }[], readonly {
        readonly id: string;
        readonly type: "success" | "error" | "warning" | "info";
        readonly title: string;
        readonly message: string;
        readonly sound?: boolean | undefined;
        readonly persistent?: boolean | undefined;
        readonly createdAt: Date;
        readonly read?: boolean | undefined;
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
}, "error" | "success" | "warning" | "info" | "addNotification" | "removeNotification" | "markAsRead" | "markAllAsRead" | "clearAll" | "clearRead" | "toggleSound" | "initializeSoundSetting">>;

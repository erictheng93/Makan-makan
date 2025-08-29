import { UserRole } from '@/types';
export declare const useAuthStore: import("pinia").StoreDefinition<"auth", Pick<{
    user: Readonly<import("vue").Ref<{
        readonly id: number;
        readonly username: string;
        readonly email: string;
        readonly role: UserRole;
        readonly restaurantId: number;
        readonly createdAt: string;
        readonly updatedAt: string;
    } | null, {
        readonly id: number;
        readonly username: string;
        readonly email: string;
        readonly role: UserRole;
        readonly restaurantId: number;
        readonly createdAt: string;
        readonly updatedAt: string;
    } | null>>;
    token: Readonly<import("vue").Ref<string | null, string | null>>;
    isLoading: Readonly<import("vue").Ref<boolean, boolean>>;
    isAuthenticated: import("vue").ComputedRef<boolean>;
    userRole: import("vue").ComputedRef<UserRole | undefined>;
    restaurantId: import("vue").ComputedRef<number | undefined>;
    hasPermission: (requiredRole: UserRole | UserRole[]) => boolean;
    canAccessAdminFeatures: import("vue").ComputedRef<boolean>;
    canManageOrders: import("vue").ComputedRef<boolean>;
    canManageMenu: import("vue").ComputedRef<boolean>;
    canViewKitchen: import("vue").ComputedRef<boolean>;
    login: (username: string, password: string) => Promise<{
        success: boolean;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
    }>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<boolean>;
    refreshToken: () => Promise<boolean | undefined>;
}, "user" | "token" | "isLoading">, Pick<{
    user: Readonly<import("vue").Ref<{
        readonly id: number;
        readonly username: string;
        readonly email: string;
        readonly role: UserRole;
        readonly restaurantId: number;
        readonly createdAt: string;
        readonly updatedAt: string;
    } | null, {
        readonly id: number;
        readonly username: string;
        readonly email: string;
        readonly role: UserRole;
        readonly restaurantId: number;
        readonly createdAt: string;
        readonly updatedAt: string;
    } | null>>;
    token: Readonly<import("vue").Ref<string | null, string | null>>;
    isLoading: Readonly<import("vue").Ref<boolean, boolean>>;
    isAuthenticated: import("vue").ComputedRef<boolean>;
    userRole: import("vue").ComputedRef<UserRole | undefined>;
    restaurantId: import("vue").ComputedRef<number | undefined>;
    hasPermission: (requiredRole: UserRole | UserRole[]) => boolean;
    canAccessAdminFeatures: import("vue").ComputedRef<boolean>;
    canManageOrders: import("vue").ComputedRef<boolean>;
    canManageMenu: import("vue").ComputedRef<boolean>;
    canViewKitchen: import("vue").ComputedRef<boolean>;
    login: (username: string, password: string) => Promise<{
        success: boolean;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
    }>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<boolean>;
    refreshToken: () => Promise<boolean | undefined>;
}, "restaurantId" | "isAuthenticated" | "userRole" | "canAccessAdminFeatures" | "canManageOrders" | "canManageMenu" | "canViewKitchen">, Pick<{
    user: Readonly<import("vue").Ref<{
        readonly id: number;
        readonly username: string;
        readonly email: string;
        readonly role: UserRole;
        readonly restaurantId: number;
        readonly createdAt: string;
        readonly updatedAt: string;
    } | null, {
        readonly id: number;
        readonly username: string;
        readonly email: string;
        readonly role: UserRole;
        readonly restaurantId: number;
        readonly createdAt: string;
        readonly updatedAt: string;
    } | null>>;
    token: Readonly<import("vue").Ref<string | null, string | null>>;
    isLoading: Readonly<import("vue").Ref<boolean, boolean>>;
    isAuthenticated: import("vue").ComputedRef<boolean>;
    userRole: import("vue").ComputedRef<UserRole | undefined>;
    restaurantId: import("vue").ComputedRef<number | undefined>;
    hasPermission: (requiredRole: UserRole | UserRole[]) => boolean;
    canAccessAdminFeatures: import("vue").ComputedRef<boolean>;
    canManageOrders: import("vue").ComputedRef<boolean>;
    canManageMenu: import("vue").ComputedRef<boolean>;
    canViewKitchen: import("vue").ComputedRef<boolean>;
    login: (username: string, password: string) => Promise<{
        success: boolean;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
    }>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<boolean>;
    refreshToken: () => Promise<boolean | undefined>;
}, "hasPermission" | "login" | "logout" | "checkAuth" | "refreshToken">>;

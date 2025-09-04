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
    canAccessService: import("vue").ComputedRef<boolean>;
    canAccessCashier: import("vue").ComputedRef<boolean>;
    canAccessOwnerDashboard: import("vue").ComputedRef<boolean>;
    canManageStaff: import("vue").ComputedRef<boolean>;
    canViewAnalytics: import("vue").ComputedRef<boolean>;
    canManageSettings: import("vue").ComputedRef<boolean>;
    getDefaultRoute: () => "/login" | "/dashboard" | "/owner" | "/kitchen" | "/service" | "/cashier";
    canAccessRoute: (routeName: string) => boolean;
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
    canAccessService: import("vue").ComputedRef<boolean>;
    canAccessCashier: import("vue").ComputedRef<boolean>;
    canAccessOwnerDashboard: import("vue").ComputedRef<boolean>;
    canManageStaff: import("vue").ComputedRef<boolean>;
    canViewAnalytics: import("vue").ComputedRef<boolean>;
    canManageSettings: import("vue").ComputedRef<boolean>;
    getDefaultRoute: () => "/login" | "/dashboard" | "/owner" | "/kitchen" | "/service" | "/cashier";
    canAccessRoute: (routeName: string) => boolean;
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
}, "restaurantId" | "isAuthenticated" | "userRole" | "canAccessAdminFeatures" | "canManageOrders" | "canManageMenu" | "canViewKitchen" | "canAccessService" | "canAccessCashier" | "canAccessOwnerDashboard" | "canManageStaff" | "canViewAnalytics" | "canManageSettings">, Pick<{
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
    canAccessService: import("vue").ComputedRef<boolean>;
    canAccessCashier: import("vue").ComputedRef<boolean>;
    canAccessOwnerDashboard: import("vue").ComputedRef<boolean>;
    canManageStaff: import("vue").ComputedRef<boolean>;
    canViewAnalytics: import("vue").ComputedRef<boolean>;
    canManageSettings: import("vue").ComputedRef<boolean>;
    getDefaultRoute: () => "/login" | "/dashboard" | "/owner" | "/kitchen" | "/service" | "/cashier";
    canAccessRoute: (routeName: string) => boolean;
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
}, "hasPermission" | "getDefaultRoute" | "canAccessRoute" | "login" | "logout" | "checkAuth" | "refreshToken">>;

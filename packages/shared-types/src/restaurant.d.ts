import { UUIDEntity, Status, BusinessHours } from "./common";
export interface Restaurant extends UUIDEntity {
    name: string;
    type?: string;
    category?: string;
    description?: string;
    address?: string;
    district?: string;
    city?: string;
    phone?: string;
    email?: string;
    website?: string;
    businessHours?: BusinessHours;
    logoUrl?: string;
    bannerUrl?: string;
    imageUrls?: string[];
    isAvailable?: boolean;
    isActive?: boolean;
    rating?: number;
    reviewCount?: number;
    totalOrders?: number;
    status: Status;
    planType: PlanType;
    settings?: RestaurantSettings;
    shopQrCode?: string;
    shopQrCodeImageUrl?: string;
    enableShopMode?: boolean;
    shopQrSettings?: ShopQrSettings;
    shopQrVersion?: number;
}
export interface ShopQrSettings {
    displayName?: string;
    instructions?: string;
    requirePhone?: boolean;
}
export declare enum PlanType {
    FREE = 0,
    BASIC = 1,
    PRO = 2
}
export interface RestaurantSettings {
    currency?: string;
    timezone?: string;
    language?: string;
    autoAcceptOrders?: boolean;
    estimatedPrepTime?: number;
    maxTablesPerQR?: number;
    enableNotifications?: boolean;
    theme?: {
        primaryColor?: string;
        logoUrl?: string;
        backgroundImage?: string;
    };
    enableDineIn?: boolean;
    enableTakeaway?: boolean;
    enableDelivery?: boolean;
    deliveryFee?: number;
    estimatedPrepTimeMin?: number;
    estimatedPrepTimeMax?: number;
}
export interface CreateRestaurantRequest {
    name: string;
    description?: string;
    address?: string;
    phone?: string;
    email?: string;
    businessHours?: BusinessHours;
}
export interface UpdateRestaurantRequest extends Partial<CreateRestaurantRequest> {
    settings?: Partial<RestaurantSettings>;
}
export interface RestaurantStats {
    totalOrders: number;
    todayOrders: number;
    totalRevenue: number;
    todayRevenue: number;
    averageOrderValue: number;
    activeMenuItems: number;
    totalTables: number;
    occupiedTables: number;
}
